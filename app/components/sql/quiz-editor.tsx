"use client";

import { useState } from "react";
import { tasks } from "@/app/lib/sql/course";
import {
  saveQuizQuestions,
  useQuizQuestions,
  type QuizQuestion,
} from "@/app/lib/sql/quiz";
import styles from "./quiz-editor.module.css";

type Draft = { questions: QuizQuestion[]; errors: string[] };

export default function QuizEditor() {
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const savedQuestions = useQuizQuestions(taskId);
  // Keep unsaved edits per task, without copying a potentially unhydrated store.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [notices, setNotices] = useState<Record<string, string>>({});
  const draft = drafts[taskId];
  const questions = draft?.questions ?? savedQuestions;

  function edit(next: QuizQuestion[]) {
    setDrafts((current) => ({
      ...current,
      [taskId]: { questions: next, errors: [] },
    }));
    setNotices((current) => ({ ...current, [taskId]: "" }));
  }

  function updateQuestion(id: string, patch: Partial<QuizQuestion>) {
    edit(questions.map((question) => question.id === id ? { ...question, ...patch } : question));
  }

  function save() {
    const normalized = questions.map((question) => ({
      ...question,
      prompt: question.prompt.trim(),
      options: question.options.map((option) => option.trim()),
      explanation: question.explanation.trim(),
    }));
    const errors: string[] = [];
    normalized.forEach((question, index) => {
      const prefix = `Вопрос ${index + 1}: `;
      if (!question.prompt) errors.push(prefix + "введите текст вопроса.");
      if (question.options.length < 2 || question.options.some((option) => !option))
        errors.push(prefix + "нужно минимум два непустых варианта ответа.");
      if (new Set(question.options.map((option) => option.toLocaleLowerCase("ru"))).size !== question.options.length)
        errors.push(prefix + "варианты ответа должны различаться.");
      if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= question.options.length)
        errors.push(prefix + "выберите один правильный ответ.");
    });
    if (errors.length) {
      setDrafts((current) => ({ ...current, [taskId]: { questions, errors } }));
      return;
    }
    try {
      saveQuizQuestions(taskId, normalized);
      setDrafts((current) => {
        const next = { ...current };
        delete next[taskId];
        return next;
      });
      setNotices((current) => ({
        ...current,
        [taskId]: normalized.length ? "Вопросы сохранены." : "Изменения сохранены. Тест для задания отключён.",
      }));
    } catch (error) {
      setDrafts((current) => ({
        ...current,
        [taskId]: {
          questions,
          errors: [error instanceof Error ? error.message : "Не удалось сохранить вопросы. Попробуйте ещё раз."],
        },
      }));
    }
  }

  return (
    <section className={`account-card ${styles.editor}`} aria-labelledby="quiz-editor-title">
      <div>
        <h2 id="quiz-editor-title">Вопросы тестов</h2>
        <p className="account-help">Выберите задание и настройте тест. Изменения применяются только по кнопке сохранения.</p>
      </div>
      <label className={styles.field}>
        Задание
        <select value={taskId} onChange={(event) => setTaskId(event.target.value)}>
          {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}{drafts[task.id] ? " • не сохранено" : ""}</option>)}
        </select>
      </label>
      <p className="account-help">Черновики сохраняются при переключении заданий, но теряются при уходе со страницы. Сохраняйте каждое задание отдельно.</p>
      <form key={taskId} className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); save(); }}>
        <p className="account-help">Вопросов: {questions.length}.{draft && " Есть несохранённые изменения."}</p>
        {!questions.length && <p className={styles.empty}>Вопросов нет. Сохраните пустой список, чтобы отключить тест для этого задания.</p>}
        {questions.map((question, questionIndex) => (
          <fieldset key={question.id} className={styles.question}>
            <legend>Вопрос {questionIndex + 1}</legend>
            <label className={styles.field}>
              Текст вопроса
              <textarea rows={3} value={question.prompt} onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })} />
            </label>
            <fieldset className={styles.options}>
              <legend>Варианты ответа</legend>
              <p className="account-help">Добавьте минимум два разных непустых варианта и отметьте один правильный.</p>
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} className={styles.option}>
                  <label className={styles.correct}>
                    <input type="radio" name={`correct-${question.id}`} checked={question.correctIndex === optionIndex} onChange={() => updateQuestion(question.id, { correctIndex: optionIndex })} />
                    <span>Правильный<span className="sr-only"> вариант {optionIndex + 1}</span></span>
                  </label>
                  <label className={styles.field}>
                    <span className="sr-only">Вариант {optionIndex + 1}</span>
                    <input type="text" placeholder={`Вариант ${optionIndex + 1}`} value={option} onChange={(event) => updateQuestion(question.id, { options: question.options.map((text, index) => index === optionIndex ? event.target.value : text) })} />
                  </label>
                  <button type="button" className="button button-secondary" disabled={question.options.length <= 2} aria-label={`Удалить вариант ${optionIndex + 1}`} onClick={() => updateQuestion(question.id, {
                    options: question.options.filter((_, index) => index !== optionIndex),
                    correctIndex: question.correctIndex === optionIndex ? -1 : question.correctIndex > optionIndex ? question.correctIndex - 1 : question.correctIndex,
                  })}>Удалить</button>
                </div>
              ))}
              <button type="button" className="button button-secondary" onClick={() => updateQuestion(question.id, { options: [...question.options, ""] })}>Добавить вариант</button>
            </fieldset>
            <label className={styles.field}>
              Объяснение (необязательно)
              <textarea rows={2} value={question.explanation} onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })} />
            </label>
            <button type="button" className={`button button-secondary ${styles.remove}`} onClick={() => edit(questions.filter((item) => item.id !== question.id))}>Удалить вопрос {questionIndex + 1}</button>
          </fieldset>
        ))}
        {draft?.errors.length ? <div role="alert" className="account-error"><p>Не удалось сохранить:</p><ul>{draft.errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
        {notices[taskId] && <p role="status" className="notice-banner">{notices[taskId]}</p>}
        <div className={styles.actions}>
          <button type="button" className="button button-secondary" onClick={() => edit([...questions, { id: crypto.randomUUID(), prompt: "", options: ["", ""], correctIndex: -1, explanation: "" }])}>Добавить вопрос</button>
          <button type="submit" className="button button-primary">Сохранить вопросы</button>
        </div>
      </form>
    </section>
  );
}
