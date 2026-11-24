"use client";

import { useSiteNames } from "@/app/lib/site-names/store";
import { useEffect, useState } from "react";
import { tasks } from "@/app/lib/sql/course";
import {
  saveQuizQuestions,
  useQuizQuestions,
  type QuizQuestion,
} from "@/app/lib/sql/quiz";
import quizStyles from "@/app/quiz/quiz.module.css";
import styles from "./quiz-editor.module.css";

type Drafts = Partial<Record<string, QuizQuestion[]>>;
type SaveResult = { errors: string[] } | { notice: string };

const draftPrefix = "codeproof.quiz-draft.v1.";
const draftKey = (adminId: string, taskId: string) =>
  `${draftPrefix}${adminId}.${taskId}`;
const draftFallbacks = new Map<string, QuizQuestion[] | null>();
const adminsWithDrafts = new Set<string>();

function isDraftQuestion(value: unknown): value is QuizQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Partial<QuizQuestion>;
  return (
    typeof question.id === "string" &&
    typeof question.prompt === "string" &&
    Array.isArray(question.options) &&
    question.options.every((option) => typeof option === "string") &&
    Number.isInteger(question.correctIndex) &&
    typeof question.explanation === "string"
  );
}

function readDrafts(adminId: string): Drafts {
  const drafts: Drafts = {};
  if (typeof window === "undefined") return drafts;
  for (const { id } of tasks) {
    const key = draftKey(adminId, id);
    const fallback = draftFallbacks.get(key);
    if (fallback !== undefined) {
      if (fallback !== null) drafts[id] = fallback;
      continue;
    }
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw === null) continue;
      const value: unknown = JSON.parse(raw);
      if (Array.isArray(value) && value.every(isDraftQuestion)) {
        drafts[id] = value;
      }
    } catch {
      // Skip unreadable storage entries without discarding the remaining drafts.
    }
  }
  return drafts;
}

function writeDraft(adminId: string, taskId: string, questions: QuizQuestion[] | null) {
  const key = draftKey(adminId, taskId);
  try {
    if (questions === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(questions));
    draftFallbacks.delete(key);
  } catch {
    draftFallbacks.set(key, questions);
  }
}

function warnBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = true;
}

// Keep warning after client-side navigation away from the editor.
function updateUnloadWarning(adminId: string, hasDrafts: boolean) {
  if (hasDrafts) adminsWithDrafts.add(adminId);
  else adminsWithDrafts.delete(adminId);
  if (adminsWithDrafts.size) window.addEventListener("beforeunload", warnBeforeUnload);
  else window.removeEventListener("beforeunload", warnBeforeUnload);
}

export default function QuizEditor({ adminId }: { adminId: string }) {
  const name = useSiteNames();
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const savedQuestions = useQuizQuestions(taskId);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState(() => readDrafts(adminId));
  const [saveResults, setSaveResults] = useState<Partial<Record<string, SaveResult>>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const draft = drafts[taskId];
  const questions = draft ?? savedQuestions;
  const hasDrafts = Object.keys(drafts).length > 0;
  const saveResult = saveResults[taskId];

  useEffect(() => {
    updateUnloadWarning(adminId, hasDrafts);
  }, [adminId, hasDrafts]);

  function updateDraft(questions: QuizQuestion[] | null) {
    writeDraft(adminId, taskId, questions);
    setDrafts((current) => {
      const next = { ...current };
      if (questions === null) delete next[taskId];
      else next[taskId] = questions;
      return next;
    });
  }

  function edit(next: QuizQuestion[]) {
    updateDraft(next);
    setSaveResults((current) => ({ ...current, [taskId]: undefined }));
  }

  function updateQuestion(id: string, patch: Partial<QuizQuestion>) {
    edit(questions.map((question) => question.id === id ? { ...question, ...patch } : question));
  }

  async function save() {
    if (saving) return;
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
      setSaveResults((current) => ({ ...current, [taskId]: { errors } }));
      return;
    }
    setSaving(true);
    try {
      await saveQuizQuestions(taskId, normalized);
      updateDraft(null);
      setSaveResults((current) => ({
        ...current,
        [taskId]: {
          notice: normalized.length
            ? "Вопросы сохранены."
            : "Изменения сохранены. Тест для задания отключён.",
        },
      }));
    } catch (error) {
      setSaveResults((current) => ({
        ...current,
        [taskId]: {
          errors: [error instanceof Error ? error.message : "Не удалось сохранить вопросы. Попробуйте ещё раз."],
        },
      }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`account-card ${styles.editor}`} aria-labelledby="quiz-editor-title">
      <div>
        <h2 id="quiz-editor-title">{name("admin.quizHeading")}</h2>
        <p className="account-help">Выберите задание и настройте тест. Изменения применяются только по кнопке сохранения.</p>
      </div>
      <label className={styles.field}>
        {name("practice.task")}
        <select disabled={saving} value={taskId} onChange={(event) => setTaskId(event.target.value)}>
          {tasks.map((task) => <option key={task.id} value={task.id}>{name(`task.${task.id}`)}{drafts[task.id] ? ` • ${name("admin.draftBadge")}` : ""}</option>)}
        </select>
      </label>
      <p className="account-help">Черновики остаются в этой вкладке при переходах по сайту. Сохраняйте каждое задание отдельно.</p>
      <div className={styles.actions}>
        <button
          type="button"
          className="button button-secondary"
          aria-expanded={previewOpen}
          aria-controls="quiz-editor-preview"
          onClick={() => setPreviewOpen(!previewOpen)}
        >
          {previewOpen ? name("admin.hidePreview") : name("admin.preview")}
        </button>
      </div>
      <section
        id="quiz-editor-preview"
        className={styles.preview}
        aria-labelledby="quiz-preview-title"
        hidden={!previewOpen}
      >
        <h3 id="quiz-preview-title">{name("admin.preview")}</h3>
        {previewOpen && (questions.length ? (
          <QuizPreview key={taskId + JSON.stringify(questions)} questions={questions} />
        ) : (
          <p role="status">Тест недоступен. Для этого задания нет вопросов.</p>
        ))}
      </section>
      <form key={taskId} className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset disabled={saving} style={{ display: "contents" }}>
        <p className="account-help">{name("admin.questionCount")} {questions.length}.{draft && " Есть несохранённые изменения."}</p>
        {!questions.length && <p className={styles.empty}>Вопросов нет. Сохраните пустой список, чтобы отключить тест для этого задания.</p>}
        {questions.map((question, questionIndex) => (
          <fieldset key={question.id} className={styles.question}>
            <legend>{name("quiz.question")} {questionIndex + 1}</legend>
            <label className={styles.field}>
              {name("admin.questionText")}
              <textarea rows={3} value={question.prompt} onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })} />
            </label>
            <fieldset className={styles.options}>
              <legend>{name("admin.answerOptions")}</legend>
              <p className="account-help">Добавьте минимум два разных непустых варианта и отметьте один правильный.</p>
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} className={styles.option}>
                  <label className={styles.correct}>
                    <input type="radio" name={`correct-${question.id}`} checked={question.correctIndex === optionIndex} onChange={() => updateQuestion(question.id, { correctIndex: optionIndex })} />
                    <span>{name("admin.correct")}<span className="sr-only"> {name("admin.option").toLocaleLowerCase("ru")} {optionIndex + 1}</span></span>
                  </label>
                  <label className={styles.field}>
                    <span className="sr-only">{name("admin.option")} {optionIndex + 1}</span>
                    <input type="text" placeholder={`${name("admin.option")} ${optionIndex + 1}`} value={option} onChange={(event) => updateQuestion(question.id, { options: question.options.map((text, index) => index === optionIndex ? event.target.value : text) })} />
                  </label>
                  <button type="button" className="button button-secondary" disabled={question.options.length <= 2} aria-label={`${name("common.delete")} ${name("admin.option").toLocaleLowerCase("ru")} ${optionIndex + 1}`} onClick={() => updateQuestion(question.id, {
                    options: question.options.filter((_, index) => index !== optionIndex),
                    correctIndex: question.correctIndex === optionIndex ? -1 : question.correctIndex > optionIndex ? question.correctIndex - 1 : question.correctIndex,
                  })}>{name("common.delete")}</button>
                </div>
              ))}
              <button type="button" className="button button-secondary" onClick={() => updateQuestion(question.id, { options: [...question.options, ""] })}>{name("admin.addOption")}</button>
            </fieldset>
            <label className={styles.field}>
              {name("admin.explanation")}
              <textarea rows={2} value={question.explanation} onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })} />
            </label>
            <button type="button" className={`button button-secondary ${styles.remove}`} onClick={() => edit(questions.filter((item) => item.id !== question.id))}>{name("admin.deleteQuestion")} {questionIndex + 1}</button>
          </fieldset>
        ))}
        {saveResult && "errors" in saveResult && (
          <div role="alert" className="account-error">
            <p>Не удалось сохранить:</p>
            <ul>{saveResult.errors.map((error) => <li key={error}>{error}</li>)}</ul>
          </div>
        )}
        {saveResult && "notice" in saveResult && (
          <p role="status" className="notice-banner">{saveResult.notice}</p>
        )}
        <div className={styles.actions}>
          <button type="button" className="button button-secondary" onClick={() => edit([...questions, { id: crypto.randomUUID(), prompt: "", options: ["", ""], correctIndex: -1, explanation: "" }])}>{name("admin.addQuestion")}</button>
          <button type="submit" className="button button-primary">{name("admin.saveQuiz")}</button>
        </div>
        </fieldset>
      </form>
    </section>
  );
}

function QuizPreview({ questions }: { questions: QuizQuestion[] }) {
  const name = useSiteNames();
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const question = questions[current];
  const lastQuestion = current === questions.length - 1;
  const correctOption = question.options[question.correctIndex];
  const optionText = (index: number) =>
    question.options[index]?.trim() || `${name("admin.option")} ${index + 1}`;

  return (
    <div className={styles.previewBody}>
      <div className={quizStyles.message}>
        <small>{name("quiz.question")} {current + 1} из {questions.length}</small>
        <p>{question.prompt.trim() || "Текст вопроса ещё не заполнен."}</p>
      </div>
      {answer === null ? (
        <fieldset className={quizStyles.options}>
          <legend>{name("quiz.choose")} {current + 1}</legend>
          {question.options.map((_, index) => (
            <button
              key={index}
              type="button"
              className={quizStyles.option}
              onClick={() => setAnswer(index)}
            >
              {index + 1}. {optionText(index)}
            </button>
          ))}
        </fieldset>
      ) : (
        <>
          <div className={`${quizStyles.message} ${quizStyles.answer}`}>
            <small>{name("quiz.yourAnswer")}</small>
            <p>{optionText(answer)}</p>
          </div>
          <div className={quizStyles.message} role="status">
            {correctOption === undefined ? (
              <strong>Правильный ответ ещё не выбран.</strong>
            ) : (
              <>
                <strong>{answer === question.correctIndex ? name("quiz.correct") : name("quiz.wrong")}</strong>
                {answer !== question.correctIndex && (
                  <p>{name("quiz.correctAnswer")} {optionText(question.correctIndex)}</p>
                )}
              </>
            )}
            {question.explanation.trim() && <p>{question.explanation}</p>}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setCurrent(lastQuestion ? 0 : current + 1);
                setAnswer(null);
              }}
            >
              {lastQuestion ? name("quiz.retry") : name("quiz.next")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
