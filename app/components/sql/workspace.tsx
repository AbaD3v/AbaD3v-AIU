"use client";
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
import { tasks, getTask, modules, taskHref } from "@/app/lib/sql/course";
import { tables } from "@/app/lib/sql/schema";
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

const Editor = dynamic(() => import("./editor"), {
  ssr: false,
  loading: () => (
    <div className="editor-loading">
      <LoaderCircle size={20} className="spin" />
      Загрузка редактора…
    </div>
  ),
});

export default function Workspace({ taskId }: { taskId: string }) {
  const quizQuestions = useQuizQuestions(taskId);
  const task = getTask(taskId)!;
  const index = tasks.findIndex((item) => item.id === taskId);
  const currentModule = modules[task.module - 1];
  const state = useStudy();
  const progress = state.progress[taskId] ?? emptyProgress;
  const code = state.drafts[taskId] ?? task.starter;
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
    if (busyRef.current || !ready || !code.trim()) return;
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
          ? await client.grade(taskId, code)
          : await client.run(code);
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
        error instanceof Error ? error.message : "Не удалось выполнить запрос.";
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
      "Запрос остановлен. Можно изменить его и запустить снова. Попытка не засчитана.",
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
      setNotice("Скачивание SQL-запроса запрошено.");
    } catch {
      setNotice("Не удалось скачать запрос. Скопируйте текст из редактора.");
    }
  }
  const stale = !!feedbackCode && feedbackCode !== code;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setNotice("Запрос скопирован.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice(
        "Не удалось скопировать запрос. Выделите текст в редакторе и скопируйте вручную.",
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
      setNotice("Скачивание результата CSV запрошено.");
    } catch {
      setNotice("Не удалось скачать CSV. Попробуйте ещё раз.");
    }
  }
  return (
    <div className="workspace-page">
      <div className="workspace-heading">
        <div>
          <Link href="/" className="back-link">
            <ArrowLeft size={14} />
            Все задания
          </Link>
          <div className="workspace-title-line">
            <span className="workspace-task-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h1>{task.title}</h1>
            {progress.solvedAt && (
              <span className="solved-label">
                <Check size={14} />
                Решено
              </span>
            )}
          </div>
          <p>
            {currentModule.title}
            <span>·</span>
            {task.difficulty}
            <span>·</span>
            <Clock3 size={12} />
            {task.minutes} мин
          </p>
        </div>
        <div className="task-pager">
          {quizQuestions.length > 0 && (
            <Link className="button button-secondary" href={`/quiz/?task=${encodeURIComponent(taskId)}`}>
              Пройти тест
            </Link>
          )}
          <button
            className="text-button"
            disabled={!!busy}
            onClick={() => setModal("restart")}
          >
            <RotateCcw size={14} />
            Пройти заново
          </button>
          <span>
            {index + 1} <small>/ 15</small>
          </span>
          {index > 0 ? (
            <Link
              className="icon-button"
              href={taskHref(tasks[index - 1].id)}
              aria-label="Предыдущее задание"
            >
              <ChevronLeft size={18} />
            </Link>
          ) : (
            <button
              className="icon-button"
              disabled
              aria-label="Предыдущее задание"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {index < tasks.length - 1 ? (
            <Link
              className="icon-button"
              href={taskHref(tasks[index + 1].id)}
              aria-label="Следующее задание"
            >
              <ChevronRight size={18} />
            </Link>
          ) : (
            <button
              className="icon-button"
              disabled
              aria-label="Следующее задание"
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
            aria-label="Информация о задании"
          >
            {(
              [
                { id: "task", label: "Задание" },
                { id: "hints", label: "Подсказки" },
                { id: "theory", label: "Теория" },
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
                {tab.id === "hints" && <span>{progress.hints}/3</span>}
              </button>
            ))}
          </div>
          <div className="task-panel-body">
            {leftTab === "task" && (
              <>
                <span className="eyebrow">КОНТЕКСТ</span>
                <p className="task-description">{task.description}</p>
                <div className="task-requirement">
                  <span>
                    <Zap size={15} />
                    Что нужно сделать
                  </span>
                  <p>{task.requirement}</p>
                </div>
                <h3 className="small-heading">Столбцы результата</h3>
                <div className="column-chips">
                  {task.columns.map((column) => (
                    <code key={column}>{column}</code>
                  ))}
                </div>
                <p className="helper-text">
                  Столбцы в указанном порядке. Псевдонимы могут отличаться.
                  {task.ordered
                    ? " Порядок строк учитывается."
                    : " Порядок строк не важен."}
                </p>
                <div className="task-tags">
                  {task.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
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
                  Нужна небольшая подсказка?
                  <ArrowRight size={14} />
                </button>
              </>
            )}
            {leftTab === "hints" && (
              <>
                <div className="panel-section-heading">
                  <Lightbulb size={19} />
                  <h3>Немного направления</h3>
                </div>
                <p className="muted small">
                  Открывайте подсказки постепенно. Решение с помощью тоже
                  засчитывается.
                </p>
                {task.hints.slice(0, progress.hints).map((hint, i) => (
                  <div className="hint-card" key={i}>
                    <span>ПОДСКАЗКА {i + 1}</span>
                    <p>{hint}</p>
                  </div>
                ))}
                {progress.hints < 3 && (
                  <button
                    className="button button-secondary full-width"
                    onClick={() => revealHint(taskId)}
                  >
                    <Lightbulb size={16} />
                    {progress.hints
                      ? "Следующая подсказка"
                      : "Открыть первую подсказку"}
                  </button>
                )}
                <button
                  className="solution-link"
                  onClick={() => setModal("solution")}
                >
                  <Code2 size={15} />
                  Посмотреть разбор решения
                </button>
              </>
            )}
            {leftTab === "theory" && (
              <>
                <div className="panel-section-heading">
                  <BookOpen size={19} />
                  <h3>Коротко о главном</h3>
                </div>
                <p className="theory-text">{task.theory}</p>
                <h3 className="small-heading">Пример на других данных</h3>
                <pre className="code-snippet">{task.example}</pre>
                <Link className="text-link" href="/reference/">
                  Полный справочник
                  <ArrowRight size={15} />
                </Link>
              </>
            )}
          </div>
          <div className="schema-panel">
            <div className="schema-heading">
              <DatabaseBadge />
              <Link href="/database/">
                Открыть базу <ArrowRight size={13} />
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
        <section className="query-area" aria-label="Редактор и результаты">
          <div className="editor-card">
            <div className="editor-toolbar">
              <span className="editor-file">
                <FileCode2 size={15} />
                solution.sql
                <span />
              </span>
              <div>
                <span className="editor-dialect">SQLite</span>
                <button
                  className="dark-icon-button"
                  onClick={downloadQuery}
                  disabled={!code.trim()}
                  aria-label="Скачать SQL-запрос"
                  title="Скачать SQL-запрос"
                >
                  <Download size={15} />
                </button>
                <button
                  className="dark-icon-button"
                  onClick={copy}
                  aria-label="Скопировать запрос"
                  title="Скопировать запрос"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
                <button
                  className="dark-icon-button"
                  onClick={() => setModal("reset")}
                  disabled={!!busy}
                  aria-label="Восстановить начальный запрос"
                  title="Восстановить начальный запрос"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            </div>
            <Editor
              value={code}
              onChange={(value) => {
                if (value.length > 20000)
                  setNotice(
                    "Запрос ограничен 20 000 символами. Сохранены первые 20 000 — сократите запрос перед запуском.",
                  );
                saveDraft(taskId, value);
              }}
              onRun={onRun}
              onCheck={onCheck}
            />
            <div className="editor-footer">
              <span className="keyboard-tip">
                <kbd>Ctrl / ⌘</kbd> + <kbd>Enter</kbd>
                <span>запустить</span>
              </span>
              <div className="editor-actions">
                {busy && (
                  <button className="button button-run" onClick={stop}>
                    <Square size={14} />
                    Остановить
                  </button>
                )}
                <button
                  className="button button-run"
                  disabled={!!busy || !ready || !code.trim()}
                  onClick={onRun}
                >
                  {busy === "run" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Play size={15} />
                  )}
                  Запустить
                </button>
                <button
                  className="button button-lime"
                  disabled={!!busy || !ready || !code.trim()}
                  onClick={onCheck}
                >
                  {busy === "check" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <CheckCheck size={17} />
                  )}
                  Проверить решение
                </button>
              </div>
            </div>
          </div>
          {notice && (
            <p className="notice-banner" role="status">
              {notice}
            </p>
          )}
          {loadError && (
            <div className="error-banner" role="alert">
              <X size={17} />
              <span>{loadError}</span>
              <button onClick={retry}>Повторить</button>
            </div>
          )}
          {!ready && !loadError && (
            <div className="engine-loading" role="status">
              <LoaderCircle size={15} className="spin" />
              Подготавливаем учебную базу…
            </div>
          )}
          <div className="results-card">
            <div className="result-tabs">
              <div role="tablist" aria-label="Результаты запроса">
                <button
                  role="tab"
                  aria-selected={bottomTab === "result"}
                  className={bottomTab === "result" ? "active" : ""}
                  onClick={() => setBottomTab("result")}
                >
                  <Table2 size={15} />
                  Результат{result && <span>{result.rows.length}</span>}
                </button>
                <button
                  role="tab"
                  aria-selected={bottomTab === "check"}
                  className={bottomTab === "check" ? "active" : ""}
                  onClick={() => setBottomTab("check")}
                >
                  <CheckCheck size={16} />
                  Проверка{grade?.passed && <i className="status-dot" />}
                </button>
                <button
                  role="tab"
                  aria-selected={bottomTab === "history"}
                  className={bottomTab === "history" ? "active" : ""}
                  onClick={() => setBottomTab("history")}
                >
                  <History size={15} />
                  История
                </button>
              </div>
              {result && bottomTab === "result" && (
                <button
                  className="icon-button"
                  onClick={exportCsv}
                  disabled={!!busy}
                  aria-label="Скачать результат CSV"
                  title="Скачать CSV"
                >
                  <Download size={15} />
                </button>
              )}
            </div>
            {stale && (result || grade || error) && bottomTab !== "history" && (
              <div className="stale-notice">
                Запрос изменён. Запустите его снова, чтобы обновить результат.
              </div>
            )}
            <div aria-live="polite" className="results-body">
              {busy && (
                <div className="result-placeholder">
                  <LoaderCircle size={30} className="spin" />
                  <strong>
                    {busy === "check"
                      ? "Проверяем на трёх наборах данных…"
                      : "Выполняем запрос…"}
                  </strong>
                </div>
              )}
              {!busy && error && bottomTab !== "history" && (
                <div className="query-error">
                  <span className="error-symbol">
                    <X size={22} />
                  </span>
                  <div>
                    <h3>Запрос требует внимания</h3>
                    <p>{error}</p>
                    <button
                      className="text-link"
                      onClick={() => setLeftTab("theory")}
                    >
                      Посмотреть теорию
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
                    <DataTable columns={result.columns} rows={result.rows} />
                    <div className="result-footer">
                      <span>
                        <Check size={13} />
                        Запрос выполнен
                        {result.truncated
                          ? " · показаны первые 1 000 строк"
                          : ""}
                      </span>
                      <span>
                        {result.rows.length} строк <i />
                        {result.elapsed} мс
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="result-placeholder">
                    <span className="placeholder-icon">
                      <Terminal size={27} />
                    </span>
                    <h3>Данные ждут твоего запроса</h3>
                    <p>
                      Напиши SQL и нажми «Запустить».
                      <br />
                      Результат появится здесь в виде таблицы.
                    </p>
                    <span className="placeholder-code">
                      SELECT <em>возможности</em> FROM <em>практика</em>;
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
                            ? "Отлично, решение работает!"
                            : "Почти. Проверим детали."}
                        </h3>
                        <p>
                          {grade.passed
                            ? "Запрос прошёл все три набора данных. " +
                              (state.storageIssue
                                ? "Прогресс доступен в этой вкладке — экспортируйте его перед выходом."
                                : "Прогресс сохранён.")
                            : "Посмотрите, какая проверка не прошла, и уточните запрос."}
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
                            <strong>{check.label}</strong>
                            <p>{check.message}</p>
                          </div>
                          <span>{i + 1}/3</span>
                        </div>
                      ))}
                    </div>
                    {grade.passed && (
                      <div className="grade-next">
                        <p>
                          {progress.independent
                            ? "Самостоятельное решение — без подсказок."
                            : "Решение с помощью — можно вернуться и потренироваться ещё."}
                        </p>
                        {nextTask ? (
                          <Link
                            className="button button-primary"
                            href={taskHref(nextTask.id)}
                          >
                            Следующая задача
                            <ArrowRight size={16} />
                          </Link>
                        ) : (
                          <Link
                            className="button button-primary"
                            href="/profile/"
                          >
                            Посмотреть результаты
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
                    <h3>Проверь, что решение универсально</h3>
                    <p>
                      «Проверить решение» сравнит результат
                      <br />
                      на учебной базе и двух дополнительных наборах.
                    </p>
                    <small>
                      Проверяются значения и число строк, а не текст запроса.
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
                            {entry.action === "run" ? "Запуск" : "Проверка"}
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
                    <h3>Здесь будет история попыток</h3>
                    <p>
                      После первого запуска сохраним запрос
                      <br />и результат его выполнения.
                    </p>
                  </div>
                ))}
            </div>
          </div>
          <div className="workspace-footnote">
            <span>
              <span className="status-dot" />
              {ready ? "База готова к работе" : "Подключаем базу"}
            </span>
            <span>Только чтение · исходные данные остаются целыми</span>
          </div>
        </section>
      </div>
      {modal === "restart" && (
        <Modal title="Пройти эту задачу заново?" onClose={() => setModal(null)}>
          <p>
            Начнём новую попытку: сбросим результат этой задачи, подсказки и
            черновик. История запросов, заметки и остальные задания останутся.
            Текущий запрос можно скачать перед сбросом.
          </p>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={() => setModal(null)}
            >
              Отмена
            </button>
            <button className="button button-secondary" onClick={downloadQuery}>
              Скачать запрос
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                restartTask(taskId);
                clearFeedback();
                setLeftTab("task");
                setNotice(
                  "Задача начата заново. История предыдущих попыток сохранена.",
                );
                setModal(null);
              }}
            >
              Начать заново
            </button>
          </div>
        </Modal>
      )}
      {modal === "replace-solution" && (
        <Modal
          title="Заменить черновик решением?"
          onClose={() => setModal(null)}
        >
          <p>
            Твой текущий запрос будет заменён готовым решением. Сначала его
            можно скачать.
          </p>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={() => setModal("solution")}
            >
              Назад
            </button>
            <button className="button button-secondary" onClick={downloadQuery}>
              Скачать черновик
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                saveDraft(taskId, task.solution);
                setModal(null);
              }}
            >
              Заменить запрос
            </button>
          </div>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal
          title="Восстановить начальный запрос?"
          onClose={() => setModal(null)}
        >
          <p>
            Текущий черновик будет заменён шаблоном задания. Предыдущие запуски
            останутся в истории.
          </p>
          <div className="modal-actions">
            <button className="button button-secondary" onClick={downloadQuery}>
              Скачать черновик
            </button>
            <button
              className="button button-secondary"
              onClick={() => setModal(null)}
            >
              Отмена
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                saveDraft(taskId, task.starter);
                setModal(null);
              }}
            >
              Восстановить
            </button>
          </div>
        </Modal>
      )}
      {modal === "solution" && (
        <Modal
          title={
            progress.solutionViewed
              ? "Разбор решения"
              : "Открыть готовое решение?"
          }
          onClose={() => setModal(null)}
        >
          {progress.solutionViewed ? (
            <>
              <pre className="code-snippet solution-code">{task.solution}</pre>
              <p>{task.explanation}</p>
              <div className="modal-actions">
                <button
                  className="button button-secondary"
                  onClick={() => setModal(null)}
                >
                  Закрыть
                </button>
                <button
                  className="button button-primary"
                  onClick={() => {
                    if (
                      code.trim() &&
                      code !== task.starter &&
                      code !== task.solution
                    ) {
                      setModal("replace-solution");
                      return;
                    }
                    saveDraft(taskId, task.solution);
                    setModal(null);
                  }}
                >
                  Перенести в редактор
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                После просмотра новая успешная попытка будет отмечена как
                решение с помощью. Уже полученная отметка о самостоятельном
                решении сохранится.
              </p>
              <div className="modal-actions">
                <button
                  className="button button-secondary"
                  onClick={() => setModal(null)}
                >
                  Попробую сам
                </button>
                <button
                  className="button button-primary"
                  onClick={() => revealSolution(taskId)}
                >
                  Показать решение
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
