"use client";
import { difficultyNames, checkNames } from "@/app/lib/site-names/registry";
import { useSiteNames } from "@/app/lib/site-names/store";
import { lessonFieldKey } from "@/app/lib/site-names/practice-lesson";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  Copy,
  Download,
  FileCode2,
  History,
  KeyRound,
  Lightbulb,
  LoaderCircle,
  Play,
  RotateCcw,
  Square,
  Table2,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { tasks, getTask, taskHref } from "@/app/lib/sql/course";
import { trainingTables, trainingTask } from "@/app/lib/sql/training-database";
import { reloadTrainingDatabase, useTrainingDatabase } from "@/app/lib/sql/training-database-store";
import { SqlClient } from "@/app/lib/sql/client";
import type { QueryResult, GradeResult } from "@/app/lib/sql/engine";
import {
  useStudy,
  getStudyScope,
  saveDraft,
  addAttempt,
  revealHint,
  revealSolution,
  visitTask,
  restartTask,
} from "@/app/lib/sql/store";
import { emptyProgress, getNextTask } from "@/app/lib/sql/progress";
import { DataTable, DatabaseBadge, Modal, downloadText } from "./ui";
import RestoreQuery from "./restore-query";
import { useQuizQuestions } from "@/app/lib/sql/quiz";
import { formatCheckFeedback } from "@/app/lib/sql/check-feedback";
import quizEntryStyles from "./workspace-quiz-entry.module.css";
import contentStyles from "./workspace-content.module.css";

function EditorLoading() {
  const name = useSiteNames();
  return (
    <div className="editor-loading">
      <LoaderCircle size={20} className="spin" />
      {name("practice.loadingEditor")}
    </div>
  );
}

const Editor = dynamic(() => import("./editor"), {
  ssr: false,
  loading: EditorLoading,
});

export default function Workspace({ taskId }: { taskId: string }) {
  const name = useSiteNames();
  const quizQuestions = useQuizQuestions(taskId);
  const { config, status: databaseStatus } = useTrainingDatabase();
  const originalTask = getTask(taskId)!;
  const task = useMemo(() => {
    const field = (key: Parameters<typeof lessonFieldKey>[1]) => name(lessonFieldKey(taskId, key));
    return trainingTask({
      ...originalTask,
      description: field("description"),
      requirement: field("requirement"),
      hints: originalTask.hints.map((_, index) => field(`hint.${index + 1}`)),
      theory: field("theory"),
      example: field("example"),
      starter: field("starter"),
      solution: field("solution"),
      explanation: field("explanation"),
    }, config);
  }, [originalTask, config, name, taskId]);
  const tables = useMemo(() => trainingTables(config), [config]);
  const sqlSchema = useMemo(() => Object.fromEntries(
    tables.map(table => [table.name, table.fields.map(field => field.name)]),
  ), [tables]);
  const index = tasks.findIndex((item) => item.id === taskId);
  const state = useStudy();
  const progress = state.progress[taskId] ?? emptyProgress;
  const { starter, solution } = task;
  const storedDraft = state.drafts[taskId];
  const code = storedDraft === undefined || storedDraft === originalTask.starter
    ? starter : storedDraft;
  const [leftTab, setLeftTab] = useState<"task" | "hints" | "theory">("task");
  const [bottomTab, setBottomTab] = useState<"result" | "check" | "history">(
    "result",
  );
  const [result, setResult] = useState<QueryResult | null>(null);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"run" | "check" | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState<
    "reset" | "solution" | "restart" | "replace-solution" | null
  >(null);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [feedbackCode, setFeedbackCode] = useState("");
  const client = useMemo(() => new SqlClient(), []);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const requestId = useRef(0);
  const nextTask = getNextTask(state, taskId);
  const history = state.history
    .filter((entry) => entry.taskId === taskId)
    .slice(0, 10);
  useEffect(() => {
    visitTask(taskId);
  }, [taskId]);
  useEffect(() => {
    alive.current = true;
    let current = true;
    client
      .init()
      .then(() => {
        if (current) setReady(true);
      })
      .catch((error) => {
        if (current) setLoadError(error.message);
      });
    return () => {
      current = false;
      alive.current = false;
      requestId.current++;
      client.destroy();
    };
  }, [client]);
  const retry = async () => {
    setLoadError("");
    try {
      await client.init();
      setReady(true);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  };
  const execute = async (action: "run" | "check") => {
    if (busyRef.current || !ready || databaseStatus !== "ready" || !code.trim()) return;
    const currentRequest = ++requestId.current;
    const scope = getStudyScope();
    busyRef.current = true;
    setBusy(action);
    setError("");
    setNotice("");
    setFeedbackCode(code);
    setBottomTab(action === "check" ? "check" : "result");
    try {
      const response =
        action === "check"
          ? await client.grade(taskId, code, config)
          : await client.run(code, config);
      if (
        !alive.current ||
        currentRequest !== requestId.current ||
        scope !== getStudyScope()
      )
        return;
      const checked = action === "check" ? (response as GradeResult) : null;
      const output = checked ? checked.result : (response as QueryResult);
      setResult(output);
      setGrade(checked);
      addAttempt({
        taskId,
        sql: code,
        action,
        success: checked ? checked.passed : true,
        rows: output.rows.length,
        elapsed: output.elapsed,
      });
    } catch (error) {
      if (
        !alive.current ||
        currentRequest !== requestId.current ||
        scope !== getStudyScope()
      )
        return;
      const message =
        error instanceof Error ? error.message : name("practice.runError");
      setError(message);
      setResult(null);
      setGrade(null);
      addAttempt({
        taskId,
        sql: code,
        action,
        success: false,
        rows: 0,
        elapsed: 0,
        error: message,
      });
    } finally {
      if (alive.current && currentRequest === requestId.current) {
        busyRef.current = false;
        setBusy(null);
      }
    }
  };
  const onRun = () => {
    void execute("run");
  };
  const onCheck = () => {
    void execute("check");
  };
  function stop() {
    requestId.current++;
    client.destroy();
    busyRef.current = false;
    setBusy(null);
    clearFeedback();
    setNotice(
      name("practice.stopNotice"),
    );
  }
  function clearFeedback() {
    setResult(null);
    setGrade(null);
    setError("");
    setFeedbackCode("");
    setBottomTab("result");
  }
  function downloadQuery() {
    try {
      downloadText(taskId + ".sql", code);
      setNotice(name("practice.downloadNotice"));
    } catch {
      setNotice(name("practice.downloadError"));
    }
  }
  const stale = !!feedbackCode && feedbackCode !== code;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setNotice(name("practice.copyNotice"));
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice(
        name("practice.copyError"),
      );
    }
  };
  function exportCsv() {
    if (!result) return;
    const cell = (value: unknown) =>
      '"' + String(value ?? "").replace(/"/g, '""') + '"';
    try {
      downloadText(
        taskId + ".csv",
        "\ufeff" +
          [result.columns, ...result.rows]
            .map((row) => row.map(cell).join(","))
            .join("\r\n"),
        "text/csv;charset=utf-8",
      );
      setNotice(name("practice.csvNotice"));
    } catch {
      setNotice(name("practice.csvError"));
    }
  }
  return (
    <div className="workspace-page">
      <div className="workspace-heading">
        <div>
          <Link href="/" className="back-link">
            <ArrowLeft size={14} />
            {name("common.allTasks")}
          </Link>
          <div className="workspace-title-line">
            <span className="workspace-task-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h1>{name(`task.${task.id}`)}</h1>
            {progress.solvedAt && (
              <span className="solved-label">
                <Check size={14} />
                {name("common.solved")}
              </span>
            )}
          </div>
          <p>
            {name(`module.${task.module}`)}
            <span>·</span>
            {name(difficultyNames[task.difficulty])}
            <span>·</span>
            <Clock3 size={12} />
            {task.minutes} {name("common.minutes")}
          </p>
        </div>
        <div className="task-pager">
          <button
            className="text-button"
            disabled={!!busy}
            onClick={() => setModal("restart")}
          >
            <RotateCcw size={14} />
            {name("practice.restart")}
          </button>
          <span>
            {index + 1} <small>/ {tasks.length}</small>
          </span>
          {index > 0 ? (
            <Link
              className="icon-button"
              href={taskHref(tasks[index - 1].id)}
              aria-label={name("practice.previousTask")}
            >
              <ChevronLeft size={18} />
            </Link>
          ) : (
            <button
              className="icon-button"
              disabled
              aria-label={name("practice.previousTask")}
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {index < tasks.length - 1 ? (
            <Link
              className="icon-button"
              href={taskHref(tasks[index + 1].id)}
              aria-label={name("practice.nextTask")}
            >
              <ChevronRight size={18} />
            </Link>
          ) : (
            <button
              className="icon-button"
              disabled
              aria-label={name("practice.nextTask")}
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="workspace-grid">
        <aside className="task-panel">
          <div
            className="panel-tabs"
            role="tablist"
            aria-label={name("practice.info")}
          >
            {(
              [
                { id: "task", label: name("practice.task") },
                { id: "hints", label: name("practice.hints") },
                { id: "theory", label: name("practice.theory") },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={leftTab === tab.id}
                className={leftTab === tab.id ? "active" : ""}
                onClick={() => setLeftTab(tab.id)}
              >
                {tab.label}
                {tab.id === "hints" && <span>{progress.hints}/{task.hints.length}</span>}
              </button>
            ))}
          </div>
          <div className="task-panel-body">
            {leftTab === "task" && (
              <>
                <span className="eyebrow">{name("practice.context")}</span>
                <p className={`task-description ${contentStyles.prose}`}>{task.description}</p>
                <div className="task-requirement">
                  <span>
                    <Zap size={15} />
                    {name("practice.requirement")}
                  </span>
                  <p className={contentStyles.prose}>{task.requirement}</p>
                </div>
                <h3 className="small-heading">{name("practice.columns")}</h3>
                <div className="column-chips">
                  {task.columns.map((column) => (
                    <code key={column}>{column}</code>
                  ))}
                </div>
                <p className="helper-text">
                  {name("practice.columnOrder")}
                  {" "}{name(task.ordered ? "practice.ordered" : "practice.unordered")}
                </p>
                <div className="task-tags">
                  {task.tags.map((tag, i) => (
                    <span key={tag}>{name(lessonFieldKey(taskId, `tag.${i + 1}`))}</span>
                  ))}
                </div>
                <button
                  className="hint-link"
                  onClick={() => {
                    setLeftTab("hints");
                    if (!progress.hints) revealHint(taskId);
                  }}
                >
                  <Lightbulb size={17} />
                  {name("practice.askHint")}
                  <ArrowRight size={14} />
                </button>
              </>
            )}
            {leftTab === "hints" && (
              <>
                <div className="panel-section-heading">
                  <Lightbulb size={19} />
                  <h3>{name("practice.hintsHeading")}</h3>
                </div>
                <p className="muted small">
                  {name("practice.hintAdvice")}
                </p>
                {task.hints.slice(0, progress.hints).map((hint, i) => (
                  <div className="hint-card" key={i}>
                    <span>{name("practice.hint")} {i + 1}</span>
                    <p className={contentStyles.prose}>{hint}</p>
                  </div>
                ))}
                {progress.hints < task.hints.length && (
                  <button
                    className="button button-secondary full-width"
                    onClick={() => revealHint(taskId)}
                  >
                    <Lightbulb size={16} />
                    {progress.hints
                      ? name("practice.nextHint")
                      : name("practice.firstHint")}
                  </button>
                )}
                <button
                  className="solution-link"
                  onClick={() => setModal("solution")}
                >
                  <Code2 size={15} />
                  {name("practice.showAnalysis")}
                </button>
              </>
            )}
            {leftTab === "theory" && (
              <>
                <div className="panel-section-heading">
                  <BookOpen size={19} />
                  <h3>{name("practice.theoryHeading")}</h3>
                </div>
                <p className={`theory-text ${contentStyles.prose}`}>{task.theory}</p>
                <h3 className="small-heading">{name("practice.exampleHeading")}</h3>
                <pre className="code-snippet">{task.example}</pre>
                <Link className="text-link" href="/reference/">
                  {name("practice.fullReference")}
                  <ArrowRight size={15} />
                </Link>
              </>
            )}
          </div>
          <div className="schema-panel">
            <div className="schema-heading">
              <DatabaseBadge />
              <Link href="/database/">
                {name("practice.openDatabase")} <ArrowRight size={13} />
              </Link>
            </div>
            {tables.map((table) => (
              <details
                key={table.name}
                className={
                  "schema-table " +
                  (task.tables.includes(table.name) ? "relevant" : "")
                }
              >
                <summary>
                  <Table2 size={14} />
                  <span>{table.name}</span>
                  {task.tables.includes(table.name) && (
                    <span className="table-relevant-dot" />
                  )}
                  <ChevronDown size={13} />
                </summary>
                <div>
                  {table.fields.map((field) => (
                    <p key={field.name} title={field.description}>
                      <span>
                        {field.key === "pk" ? (
                          <KeyRound size={10} />
                        ) : field.key === "fk" ? (
                          <span className="fk-arrow">↳</span>
                        ) : (
                          <i />
                        )}
                        {field.name}
                      </span>
                      <small>{field.type}</small>
                    </p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </aside>
        <section className="query-area" aria-label={name("practice.queryArea")}>
          <div className="editor-card">
            <div className="editor-toolbar">
              <span className="editor-file">
                <FileCode2 size={15} />
                {name("practice.editorFile")}
                <span />
              </span>
              <div>
                <span className="editor-dialect">SQLite</span>
                <button
                  className="dark-icon-button"
                  onClick={downloadQuery}
                  disabled={!code.trim()}
                  aria-label={name("practice.downloadSql")}
                  title={name("practice.downloadSql")}
                >
                  <Download size={15} />
                </button>
                <button
                  className="dark-icon-button"
                  onClick={copy}
                  aria-label={name("practice.copySql")}
                  title={name("practice.copySql")}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
                <button
                  className="dark-icon-button"
                  onClick={() => setModal("reset")}
                  disabled={!!busy}
                  aria-label={name("practice.restoreSql")}
                  title={name("practice.restoreSql")}
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            </div>
            <Editor
              schema={sqlSchema}
              value={code}
              onChange={(value) => {
                if (value.length > 20000)
                  setNotice(
                    name("practice.queryLimit"),
                  );
                saveDraft(taskId, value);
              }}
              onRun={onRun}
              onCheck={onCheck}
            />
            <div className="editor-footer">
              <span className="keyboard-tip">
                <kbd>Ctrl / ⌘</kbd> + <kbd>Enter</kbd>
                <span>{name("practice.run")}</span>
              </span>
              <div className="editor-actions">
                {busy && (
                  <button className="button button-run" onClick={stop}>
                    <Square size={14} />
                    {name("practice.stop")}
                  </button>
                )}
                <button
                  className="button button-run"
                  disabled={!!busy || !ready || databaseStatus !== "ready" || !code.trim()}
                  onClick={onRun}
                >
                  {busy === "run" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Play size={15} />
                  )}
                  {name("practice.run")}
                </button>
                <button
                  className="button button-lime"
                  disabled={!!busy || !ready || databaseStatus !== "ready" || !code.trim()}
                  onClick={onCheck}
                >
                  {busy === "check" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <CheckCheck size={17} />
                  )}
                  {name("practice.check")}
                </button>
              </div>
            </div>
          </div>
          {notice && (
            <p className="notice-banner" role="status">
              {notice}
            </p>
          )}
          {databaseStatus === "loading" && <p role="status">Загружаем учебную базу…</p>}
          {databaseStatus === "error" && (
            <div className="notice-banner" role="status">
              Не удалось загрузить учебную базу.{" "}
              <button className="button button-secondary" type="button" onClick={reloadTrainingDatabase}>
                Повторить
              </button>
            </div>
          )}
          {loadError && (
            <div className="error-banner" role="alert">
              <X size={17} />
              <span>{loadError}</span>
              <button onClick={retry}>{name("practice.retry")}</button>
            </div>
          )}
          {!ready && !loadError && (
            <div className="engine-loading" role="status">
              <LoaderCircle size={15} className="spin" />
              {name("practice.preparingDatabase")}
            </div>
          )}
          {quizQuestions.length > 0 && (
            <div className={quizEntryStyles.entry} aria-live="polite">
              <p>
                {name(progress.solvedAt ? "quiz.entryReady" : "quiz.entryLocked")}
              </p>
              {progress.solvedAt && (
                <Link
                  className={`button button-secondary ${quizEntryStyles.link}`}
                  href={`/quiz/?task=${encodeURIComponent(taskId)}`}
                >
                  {name("quiz.open")}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          )}
          <div className="results-card">
            <div className="result-tabs">
              <div role="tablist" aria-label={name("practice.results")}>
                <button
                  role="tab"
                  aria-selected={bottomTab === "result"}
                  className={bottomTab === "result" ? "active" : ""}
                  onClick={() => setBottomTab("result")}
                >
                  <Table2 size={15} />
                  {name("practice.resultTab")}{result && <span>{result.rows.length}</span>}
                </button>
                <button
                  role="tab"
                  aria-selected={bottomTab === "check"}
                  className={bottomTab === "check" ? "active" : ""}
                  onClick={() => setBottomTab("check")}
                >
                  <CheckCheck size={16} />
                  {name("practice.checkTab")}{grade?.passed && <i className="status-dot" />}
                </button>
                <button
                  role="tab"
                  aria-selected={bottomTab === "history"}
                  className={bottomTab === "history" ? "active" : ""}
                  onClick={() => setBottomTab("history")}
                >
                  <History size={15} />
                  {name("practice.historyTab")}
                </button>
              </div>
              {result && bottomTab === "result" && (
                <button
                  className="icon-button"
                  onClick={exportCsv}
                  disabled={!!busy}
                  aria-label={name("practice.downloadResult")}
                  title={name("practice.downloadCsv")}
                >
                  <Download size={15} />
                </button>
              )}
            </div>
            {stale && (result || grade || error) && bottomTab !== "history" && (
              <div className="stale-notice">
                {name("practice.staleResult")}
              </div>
            )}
            <div aria-live="polite" className="results-body">
              {busy && (
                <div className="result-placeholder">
                  <LoaderCircle size={30} className="spin" />
                  <strong>
                    {busy === "check"
                      ? name("practice.checking")
                      : name("practice.running")}
                  </strong>
                </div>
              )}
              {!busy && error && bottomTab !== "history" && (
                <div className="query-error">
                  <span className="error-symbol">
                    <X size={22} />
                  </span>
                  <div>
                    <h3>{name("practice.queryError")}</h3>
                    <p>{error}</p>
                    <button
                      className="text-link"
                      onClick={() => setLeftTab("theory")}
                    >
                      {name("practice.showTheory")}
                      <BookOpen size={14} />
                    </button>
                  </div>
                </div>
              )}
              {!busy &&
                !error &&
                bottomTab === "result" &&
                (result ? (
                  <>
                    <DataTable columns={result.columns} rows={result.rows} emptyMessage={name("practice.noMatches")} />
                    <div className="result-footer">
                      <span>
                        <Check size={13} />
                        {name("common.querySuccess")}
                        {result.truncated
                          ? ` · ${name("practice.truncatedResult")}`
                          : ""}
                      </span>
                      <span>
                        {result.rows.length} {name("practice.rowsUnit")} <i />
                        {result.elapsed} {name("practice.elapsedUnit")}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="result-placeholder">
                    <span className="placeholder-icon">
                      <Terminal size={27} />
                    </span>
                    <h3>{name("practice.emptyResult")}</h3>
                    <p>
                      {name("practice.emptyResultTip").replace("{button}", () => name("practice.run"))}
                    </p>
                    <span className="placeholder-code">
                      {name("practice.emptyResultExample")}
                    </span>
                  </div>
                ))}
              {!busy &&
                !error &&
                bottomTab === "check" &&
                (grade ? (
                  <div className="grade-result">
                    <div
                      className={
                        "grade-heading " + (grade.passed ? "success" : "failed")
                      }
                    >
                      <span>
                        {grade.passed ? (
                          <CheckCheck size={23} />
                        ) : (
                          <Zap size={23} />
                        )}
                      </span>
                      <div>
                        <h3>
                          {grade.passed
                            ? name("practice.checkPassed")
                            : name("practice.checkFailed")}
                        </h3>
                        <p>
                          {grade.passed
                            ? name("practice.checkSummary") + " " +
                              (state.storageIssue
                                ? name("practice.progressLocal")
                                : name("practice.progressSaved"))
                            : name("practice.checkAdvice")}
                        </p>
                      </div>
                    </div>
                    <div className="checks-list">
                      {grade.checks.map((check, i) => (
                        <div key={i}>
                          <span
                            className={
                              check.passed ? "check-pass" : "check-fail"
                            }
                          >
                            {check.passed ? (
                              <Check size={14} />
                            ) : (
                              <X size={14} />
                            )}
                          </span>
                          <div>
                            <strong>{checkNames[i] ? name(checkNames[i]) : check.label}</strong>
                            <p>{check.feedback ? formatCheckFeedback(name(check.feedback.key), check.feedback.counts) : check.message}</p>
                          </div>
                          <span>{i + 1}/3</span>
                        </div>
                      ))}
                    </div>
                    {grade.passed && (
                      <div className="grade-next">
                        <p>
                          {progress.independent
                            ? name("practice.independentResult")
                            : name("practice.assistedResult")}
                        </p>
                        {nextTask ? (
                          <Link
                            className="button button-primary"
                            href={taskHref(nextTask.id)}
                          >
                            {name("practice.nextTaskAction")}
                            <ArrowRight size={16} />
                          </Link>
                        ) : (
                          <Link
                            className="button button-primary"
                            href="/profile/"
                          >
                            {name("common.viewResults")}
                            <ArrowRight size={16} />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="result-placeholder">
                    <span className="placeholder-icon">
                      <CheckCheck size={28} />
                    </span>
                    <h3>{name("practice.emptyCheck")}</h3>
                    <p>
                      {name("practice.checkIntro").replace("{button}", () => name("practice.check"))}
                    </p>
                    <small>
                      {name("practice.checkCriteria")}
                    </small>
                  </div>
                ))}
              {!busy &&
                bottomTab === "history" &&
                (history.length ? (
                  <div className="query-history">
                    {history.map((entry) => (
                      <div key={entry.id}>
                        <div>
                          <span
                            className={
                              entry.success
                                ? "history-success"
                                : "history-error"
                            }
                          >
                            {entry.success ? (
                              <Check size={13} />
                            ) : (
                              <X size={13} />
                            )}
                            {entry.action === "run" ? name("practice.historyRun") : name("practice.checkTab")}
                          </span>
                          <time>
                            {new Date(entry.date).toLocaleTimeString("ru-RU", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                          <RestoreQuery taskId={taskId} sql={entry.sql} />
                        </div>
                        <pre>{entry.sql}</pre>
                        {entry.error && <p>{entry.error}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="result-placeholder">
                    <History size={28} />
                    <h3>{name("practice.emptyHistory")}</h3>
                    <p>
                      {name("practice.emptyHistoryTip")}
                    </p>
                  </div>
                ))}
            </div>
          </div>
          <div className="workspace-footnote">
            <span>
              <span className="status-dot" />
              {ready ? name("practice.databaseReady") : name("practice.databaseConnecting")}
            </span>
            <span>{name("practice.readOnly")}</span>
          </div>
        </section>
      </div>
      {modal === "restart" && (
        <Modal title={name("practice.restartTitle")} onClose={() => setModal(null)}>
          <p>
            {name("practice.restartWarning")}
          </p>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={() => setModal(null)}
            >
              {name("common.cancel")}
            </button>
            <button className="button button-secondary" onClick={downloadQuery}>
              {name("practice.downloadQuery")}
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                restartTask(taskId, starter);
                clearFeedback();
                setLeftTab("task");
                setNotice(
                  name("practice.restartNotice"),
                );
                setModal(null);
              }}
            >
              {name("practice.restartAction")}
            </button>
          </div>
        </Modal>
      )}
      {modal === "replace-solution" && (
        <Modal
          title={name("practice.replaceWithSolution")}
          onClose={() => setModal(null)}
        >
          <p>
            {name("practice.replaceWarning")}
          </p>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={() => setModal("solution")}
            >
              {name("common.back")}
            </button>
            <button className="button button-secondary" onClick={downloadQuery}>
              {name("common.downloadDraft")}
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                saveDraft(taskId, solution);
                setModal(null);
              }}
            >
              {name("common.replaceQuery")}
            </button>
          </div>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal
          title={name("practice.restoreTitle")}
          onClose={() => setModal(null)}
        >
          <p>
            {name("practice.resetWarning")}
          </p>
          <div className="modal-actions">
            <button className="button button-secondary" onClick={downloadQuery}>
              {name("common.downloadDraft")}
            </button>
            <button
              className="button button-secondary"
              onClick={() => setModal(null)}
            >
              {name("common.cancel")}
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                saveDraft(taskId, starter);
                setModal(null);
              }}
            >
              {name("common.restore")}
            </button>
          </div>
        </Modal>
      )}
      {modal === "solution" && (
        <Modal
          title={
            progress.solutionViewed
              ? name("practice.solutionTitle")
              : name("practice.solutionConfirm")
          }
          onClose={() => setModal(null)}
        >
          {progress.solutionViewed ? (
            <>
              <pre className="code-snippet solution-code">{solution}</pre>
              <p className={contentStyles.prose}>{task.explanation}</p>
              <div className="modal-actions">
                <button
                  className="button button-secondary"
                  onClick={() => setModal(null)}
                >
                  {name("common.close")}
                </button>
                <button
                  className="button button-primary"
                  onClick={() => {
                    if (
                      code.trim() &&
                      code !== starter &&
                      code !== solution
                    ) {
                      setModal("replace-solution");
                      return;
                    }
                    saveDraft(taskId, solution);
                    setModal(null);
                  }}
                >
                  {name("practice.useSolution")}
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                {name("practice.solutionWarning")}
              </p>
              <div className="modal-actions">
                <button
                  className="button button-secondary"
                  onClick={() => setModal(null)}
                >
                  {name("practice.tryAlone")}
                </button>
                <button
                  className="button button-primary"
                  onClick={() => revealSolution(taskId)}
                >
                  {name("practice.showSolution")}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
