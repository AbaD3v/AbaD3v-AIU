"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getTask, taskHref } from "../lib/sql/course";
import { useQuizQuestions, type QuizQuestion } from "../lib/sql/quiz";
import styles from "./quiz.module.css";

export default function QuizChat() {
  const taskId = useSearchParams().get("task") ?? "";
  const task = getTask(taskId);
  const questions = useQuizQuestions(taskId);
  return (
    <div className={`page ${styles.page}`}>
      <Link className="back-link" href={task ? taskHref(taskId) : "/"}>
        ← {task ? "Вернуться к заданию" : "Все задания"}
      </Link>
      <h1>{task ? task.title : "Тест по SQL"}</h1>
      {questions.length ? (
        <Attempt key={taskId + JSON.stringify(questions)} questions={questions} />
      ) : <p role="status">Тест недоступен. Для этого задания нет вопросов.</p>}
    </div>
  );
}

function Attempt({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const finished = answers.length === questions.length;
  const answered = answers.length > current;
  const score = answers.reduce((total, answer, index) => total + Number(answer === questions[index].correctIndex), 0);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [answers.length, current]);

  return <>
    <p>Тест в чате · {questions.length} вопросов</p>
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
      {finished && <div className={styles.message}><h2>Тест завершён</h2><p>Итоговый балл: {score} из {questions.length} ({Math.round(score / questions.length * 100)}%)</p></div>}
      <div ref={end} />
    </div>
    <div className={styles.controls}>
      {finished ? <button className="button button-primary" onClick={() => { setAnswers([]); setCurrent(0); }}>Новая попытка</button>
        : answered ? <button className="button button-primary" onClick={() => setCurrent(current + 1)}>Следующий вопрос</button>
        : <fieldset className={styles.options}><legend>Выбери ответ на вопрос {current + 1}</legend>
          {questions[current].options.map((option, index) => <button key={index} className={styles.option}
            onClick={() => setAnswers((previous) => previous.length === current ? [...previous, index] : previous)}>
            <span>{index + 1}.</span> {option}
          </button>)}
        </fieldset>}
    </div>
  </>;
}
