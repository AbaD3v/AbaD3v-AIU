"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getTask, taskHref } from "../lib/sql/course";
import { useQuizQuestions, type QuizQuestion } from "../lib/sql/quiz";
import { useAccounts } from "../lib/accounts/store";
import { getStudyScope, useStudy } from "../lib/sql/store";
import { completeQuiz, readQuizResult } from "./results";
import styles from "./quiz.module.css";

export default function QuizChat() {
  const taskId = useSearchParams().get("task") ?? "";
  const accounts = useAccounts();
  if (!accounts.ready) return <div className="page" role="status">Загрузка сессии…</div>;
  if (accounts.error) return <div className="page" role="status">Не удалось прочитать сессию. Обновите страницу, чтобы проверить доступ к тесту.</div>;
  return <QuizForUser key={getStudyScope()} taskId={taskId} />;
}

function QuizForUser({ taskId }: { taskId: string }) {
  const task = getTask(taskId);
  const study = useStudy();
  const questions = useQuizQuestions(taskId);
  return (
    <div className={`page ${styles.page}`}>
      <Link className="back-link" href={task ? taskHref(taskId) : "/"}>
        ← {task ? "Вернуться к заданию" : "Все задания"}
      </Link>
      <h1>{task ? task.title : "Тест по SQL"}</h1>
      {!task ? <p role="status">Задание не найдено. Выберите задание из списка.</p>
        : !questions.length ? <p role="status">Тест недоступен: он отключён администратором или вопросы не удалось загрузить.</p>
        : !study.progress[taskId]?.solvedAt ? <p role="status">Сначала решите задание и получите успешную проверку SQL. После этого откроется тест на понимание. <Link href={taskHref(taskId)}>Перейти к заданию</Link></p>
        : <Attempt key={taskId + JSON.stringify(questions)} taskId={taskId} questions={questions} />}
    </div>
  );
}

type AttemptProps = { taskId: string; questions: QuizQuestion[] } & (
  { training?: false; onReturn?: never } | { training: true; onReturn: () => void }
);

function Attempt({ taskId, questions, training = false, onReturn }: AttemptProps) {
  const scope = getStudyScope();
  const [lastResult, setLastResult] = useState(() => training ? null : readQuizResult(taskId, scope));
  const [showTraining, setShowTraining] = useState(false);
  const [storageIssue, setStorageIssue] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const submitted = useRef<number[]>([]);
  const [current, setCurrent] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const finished = answers.length === questions.length;
  const answered = answers.length > current;
  const score = answers.reduce((total, answer, index) => total + Number(answer === questions[index].correctIndex), 0);
  const mistakes = questions.flatMap((question, index) =>
    answers[index] !== undefined && answers[index] !== question.correctIndex
      ? [{ question, answer: answers[index] }] : []);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [answers.length, current, showTraining]);

  function answerQuestion(answer: number) {
    if (submitted.current.length !== current || scope !== getStudyScope()) return;
    const next = [...submitted.current, answer];
    submitted.current = next;
    setAnswers(next);
    if (!training && next.length === questions.length) {
      const completion = completeQuiz(taskId, questions, next, scope);
      setLastResult(completion.result);
      setStorageIssue(!completion.saved);
    }
  }

  // A separate mounted instance owns training answers; the full attempt stays intact.
  if (showTraining) return <Attempt training taskId={taskId}
    questions={mistakes.map(({ question }) => question)} onReturn={() => setShowTraining(false)} />;

  return <>
    <p>{training ? "Тренировка ошибок" : "Тест в чате"} · {questions.length} вопросов</p>
    {training && <p>Тренировка не изменяет результат полной попытки.</p>}
    {lastResult && <p role="status">Последний результат: {lastResult.score} из {lastResult.questionCount} · <time dateTime={lastResult.completedAt}>{new Date(lastResult.completedAt).toLocaleString("ru-RU")}</time></p>}
    {storageIssue && <p role="status">Не удалось сохранить результат в браузере. Итог текущей попытки показан здесь, но после перезагрузки может быть потерян.</p>}
    <div className={styles.chat} role="log" aria-label="Диалог теста" aria-live="polite">
      <div className={styles.message}>Выбирай один ответ. После ответа разберём результат.</div>
      {questions.slice(0, current + 1).map((question, index) => (
        <div className={styles.exchange} key={question.id}>
          <div className={styles.message}>
            <small>Вопрос {index + 1} из {questions.length}</small>
            <p>{question.prompt}</p>
          </div>
          {answers[index] !== undefined && <>
            <div className={`${styles.message} ${styles.answer}`}><small>Твой ответ</small><p>{question.options[answers[index]]}</p></div>
            <div className={styles.message}>
              <strong>{answers[index] === question.correctIndex ? "Верно!" : "Неверно."}</strong>
              {answers[index] !== question.correctIndex && <p>Правильный ответ: {question.options[question.correctIndex]}</p>}
              {question.explanation && <p>{question.explanation}</p>}
            </div>
          </>}
        </div>
      ))}
      {finished && <div className={styles.message}>
        <h2>{training ? "Тренировка завершена" : "Тест завершён"}</h2>
        <p>{training ? `Исправлено ошибок: ${score} из ${questions.length}`
          : `Итоговый балл: ${score} из ${questions.length} (${Math.round(score / questions.length * 100)}%)`}</p>
      </div>}
      <div ref={end} />
    </div>
    {finished && !training && <section className={styles.review} aria-labelledby="mistakes-title">
      <h2 id="mistakes-title">Разбор ошибок</h2>
      {mistakes.length === 0 ? <p>Все ответы верны</p> : mistakes.map(({ question, answer }) => (
        <article className={styles.message} key={question.id}>
          <h3>{question.prompt}</h3>
          <p><strong>Выбранный ответ:</strong> {question.options[answer]}</p>
          <p><strong>Правильный ответ:</strong> {question.options[question.correctIndex]}</p>
          {question.explanation && <p><strong>Объяснение:</strong> {question.explanation}</p>}
        </article>
      ))}
    </section>}
    <div className={styles.controls}>
      {finished ? training
        ? <button className="button button-primary" onClick={onReturn}>Вернуться к результату полной попытки</button>
        : <>
          {mistakes.length > 0 && <button className="button button-primary" onClick={() => setShowTraining(true)}>Повторить ошибочные вопросы</button>}
          <button className="button button-primary" onClick={() => { submitted.current = []; setAnswers([]); setCurrent(0); }}>Новая попытка</button>
        </>
        : answered ? <button className="button button-primary" onClick={() => setCurrent(current + 1)}>Следующий вопрос</button>
        : <fieldset className={styles.options}><legend>Выбери ответ на вопрос {current + 1}</legend>
          {questions[current].options.map((option, index) => <button key={index} className={styles.option}
            onClick={() => answerQuestion(index)}>
            <span>{index + 1}.</span> {option}
          </button>)}
        </fieldset>}
    </div>
  </>;
}
