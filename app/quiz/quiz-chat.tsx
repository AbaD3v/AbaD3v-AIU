"use client";

import { useSiteNames } from "@/app/lib/site-names/store";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getTask, taskHref } from "../lib/sql/course";
import { refreshCloudQuestions, useQuizLoadStatus, useQuizQuestions, type QuizQuestion } from "../lib/sql/quiz";
import { useAccounts } from "../lib/accounts/store";
import { getStudyScope, useStudy, useStudySyncStatus } from "../lib/sql/store";
import { completeQuiz, isCloudQuiz, readCloudQuizResult, readPendingQuizResult, readQuizResult, retryQuizResultSync, saveCloudQuizResult, useQuizSyncStatus } from "./results";
import styles from "./quiz.module.css";

export default function QuizChat() {
  const taskId = useSearchParams().get("task") ?? "";
  const accounts = useAccounts();
  if (!accounts.ready) return <div className="page" role="status">Загрузка сессии…</div>;
  if (accounts.error) return <div className="page" role="status">Не удалось прочитать сессию. Обновите страницу, чтобы проверить доступ к тесту.</div>;
  return <QuizForUser key={getStudyScope()} taskId={taskId} />;
}

function QuizForUser({ taskId }: { taskId: string }) {
  const name = useSiteNames();
  const task = getTask(taskId);
  const study = useStudy();
  const studySync = useStudySyncStatus();
  const questions = useQuizQuestions(taskId);
  const questionLoad = useQuizLoadStatus(taskId);
  const taskName = task ? name(`task.${task.id}`) : "";
  const quizTitle = task ? name(`quiz.title.${task.id}`) : name("quiz.heading");
  return (
    <div className={`page ${styles.page}`}>
      <Link className="back-link" href={task ? taskHref(taskId) : "/"}>
        ← {task ? name("quiz.backToTask") : name("common.allTasks")}
      </Link>
      <h1>{quizTitle}</h1>
      {taskName && taskName !== quizTitle && <p>{taskName}</p>}
      {task && questionLoad === "error" && <div role="status">
        <p>Не удалось загрузить вопросы теста.{questions.length > 0 && " Можно продолжить текущую попытку."}</p>
        <button type="button" className="button button-secondary" onClick={() => void refreshCloudQuestions()}>
          Повторить загрузку вопросов
        </button>
      </div>}
      {!task ? <p role="status">Задание не найдено. Выберите задание из списка.</p>
        : studySync === "loading" || studySync === "load-error" ? <p role="status">Дождитесь загрузки прогресса, чтобы открыть тест.</p>
        : !questions.length && questionLoad === "loading" ? <p role="status">Загружаем вопросы теста…</p>
        : !questions.length && questionLoad === "error" ? null
        : !questions.length ? <p role="status">Тест недоступен: он отключён администратором.</p>
        : !study.progress[taskId]?.solvedAt ? <p role="status">Сначала решите задание и получите успешную проверку SQL. После этого откроется тест на понимание. <Link href={taskHref(taskId)}>{name("quiz.toTask")}</Link></p>
        : <Attempt key={taskId + JSON.stringify(questions)} taskId={taskId} questions={questions} />}
    </div>
  );
}

type AttemptProps = { taskId: string; questions: QuizQuestion[] } & (
  { training?: false; onReturn?: never } | { training: true; onReturn: () => void }
);

function Attempt({ taskId, questions, training = false, onReturn }: AttemptProps) {
  const name = useSiteNames();
  const scope = getStudyScope();
  const cloud = isCloudQuiz();
  const syncStatus = useQuizSyncStatus(taskId);
  const [lastResult, setLastResult] = useState(() => training ? null : cloud ? readPendingQuizResult(taskId, scope) : readQuizResult(taskId, scope));
  const [showTraining, setShowTraining] = useState(false);
  const [storageIssue, setStorageIssue] = useState(false);
  const [resultLoad, setResultLoad] = useState<"loading" | "ready" | "error">(cloud && !training ? "loading" : "ready");
  const [loadRequest, setLoadRequest] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const submitted = useRef<number[]>([]);
  const completions = useRef(0);
  const [current, setCurrent] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const finished = answers.length === questions.length;
  const answered = answers.length > current;
  const score = answers.reduce((total, answer, index) => total + Number(answer === questions[index].correctIndex), 0);
  const mistakes = questions.flatMap((question, index) =>
    answers[index] !== undefined && answers[index] !== question.correctIndex
      ? [{ question, answer: answers[index] }] : []);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [answers.length, current, showTraining]);

  useEffect(() => {
    if (training || !cloud || syncStatus === "saving") return;
    let mounted = true;
    const completion = completions.current;
    void readCloudQuizResult(taskId, scope).then((result) => {
      if (!mounted) return;
      if (completions.current === completion) {
        const pending = readPendingQuizResult(taskId, scope);
        const loaded = pending && (!result || Date.parse(pending.completedAt) > Date.parse(result.completedAt)) ? pending : result;
        setLastResult((current) => current && (!loaded || Date.parse(current.completedAt) > Date.parse(loaded.completedAt)) ? current : loaded);
      }
      setResultLoad("ready");
    }).catch(() => { if (mounted) setResultLoad("error"); });
    return () => { mounted = false; };
  }, [cloud, taskId, scope, training, loadRequest, syncStatus]);

  function answerQuestion(answer: number) {
    if (submitted.current.length !== current || scope !== getStudyScope()) return;
    const next = [...submitted.current, answer];
    submitted.current = next;
    setAnswers(next);
    if (!training && next.length === questions.length) {
      completions.current += 1;
      const completion = completeQuiz(taskId, questions, next, scope);
      setLastResult(completion.result);
      if (cloud) void saveCloudQuizResult(taskId, completion.result, scope);
      else setStorageIssue(!completion.saved);
    }
  }

  // A separate mounted instance owns training answers; the full attempt stays intact.
  if (showTraining) return <>
    {lastResult && <p role="status">{name("quiz.lastResult")} {lastResult.score} из {lastResult.questionCount}</p>}
    <Attempt training taskId={taskId} questions={mistakes.map(({ question }) => question)} onReturn={() => setShowTraining(false)} />
  </>;

  return <>
    <p>{training ? name("quiz.training") : name("quiz.chat")} · {questions.length} вопросов</p>
    {training && <p>Тренировка не изменяет результат полной попытки.</p>}
    {lastResult && <p role="status">{name("quiz.lastResult")} {lastResult.score} из {lastResult.questionCount} · <time dateTime={lastResult.completedAt}>{new Date(lastResult.completedAt).toLocaleString("ru-RU")}</time></p>}
    {resultLoad === "loading" && <p role="status">Загружаем прошлый результат…</p>}
    {resultLoad === "error" && <div role="status"><p>Не удалось загрузить прошлый результат теста.</p>
      <button type="button" className="button button-secondary" onClick={() => { setResultLoad("loading"); setLoadRequest((request) => request + 1); }}>Повторить загрузку</button>
    </div>}
    {cloud && syncStatus === "saving" && <p role="status">Сохраняем результат…</p>}
    {cloud && finished && !training && syncStatus === "synced" && <p role="status">Результат синхронизирован.</p>}
    {(cloud ? syncStatus === "save-error" : storageIssue) && <div role="status">
      <p>Не удалось сохранить результат. Итог текущей попытки показан ниже.</p>
      {cloud && <button type="button" className="button button-secondary" onClick={() => retryQuizResultSync(taskId)}>Повторить сохранение</button>}
    </div>}
    <div className={styles.chat} role="log" aria-label={name("quiz.dialog")} aria-live="polite">
      <div className={styles.message}>Выбирай один ответ. После ответа разберём результат.</div>
      {questions.slice(0, current + 1).map((question, index) => (
        <div className={styles.exchange} key={question.id}>
          <div className={styles.message}>
            <small>{name("quiz.question")} {index + 1} из {questions.length}</small>
            <p>{question.prompt}</p>
          </div>
          {answers[index] !== undefined && <>
            <div className={`${styles.message} ${styles.answer}`}><small>{name("quiz.yourAnswer")}</small><p>{question.options[answers[index]]}</p></div>
            <div className={styles.message}>
              <strong>{answers[index] === question.correctIndex ? name("quiz.correct") : name("quiz.wrong")}</strong>
              {answers[index] !== question.correctIndex && <p>{name("quiz.correctAnswer")} {question.options[question.correctIndex]}</p>}
              {question.explanation && <p>{question.explanation}</p>}
            </div>
          </>}
        </div>
      ))}
      {finished && <div className={styles.message}>
        <h2>{training ? name("quiz.trainingFinished") : name("quiz.finished")}</h2>
        <p>{training ? `${name("quiz.trainingScore")} ${score} из ${questions.length}`
          : `${name("quiz.score")} ${score} из ${questions.length} (${Math.round(score / questions.length * 100)}%)`}</p>
      </div>}
      <div ref={end} />
    </div>
    {finished && !training && <section className={styles.review} aria-labelledby="mistakes-title">
      <h2 id="mistakes-title">{name("quiz.review")}</h2>
      {mistakes.length === 0 ? <p>{name("quiz.noMistakes")}</p> : mistakes.map(({ question, answer }) => (
        <article className={styles.message} key={question.id}>
          <h3>{question.prompt}</h3>
          <p><strong>{name("quiz.selectedAnswer")}</strong> {question.options[answer]}</p>
          <p><strong>{name("quiz.correctAnswer")}</strong> {question.options[question.correctIndex]}</p>
          {question.explanation && <p><strong>{name("quiz.explanation")}</strong> {question.explanation}</p>}
        </article>
      ))}
    </section>}
    <div className={styles.controls}>
      {finished ? training
        ? <button className="button button-primary" onClick={onReturn}>{name("quiz.backToResult")}</button>
        : <>
          {mistakes.length > 0 && <button className="button button-primary" onClick={() => setShowTraining(true)}>{name("quiz.repeatMistakes")}</button>}
          <button className="button button-primary" onClick={() => { submitted.current = []; setAnswers([]); setCurrent(0); }}>{name("quiz.retry")}</button>
        </>
        : answered ? <button className="button button-primary" onClick={() => setCurrent(current + 1)}>{name("quiz.next")}</button>
        : <fieldset className={styles.options}><legend>{name("quiz.choose")} {current + 1}</legend>
          {questions[current].options.map((option, index) => <button key={index} className={styles.option}
            disabled={cloud && !training && resultLoad === "loading"}
            onClick={() => answerQuestion(index)}>
            <span>{index + 1}.</span> {option}
          </button>)}
        </fieldset>}
    </div>
  </>;
}
