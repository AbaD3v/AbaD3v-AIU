"use client";

import { useEffect, useRef, type FormEvent } from "react";
import type { Question } from "../lib/workspace";
import { Icon } from "./ui-icon";
import s from "./learning.module.css";

export default function QuestionCard({
  question,
  codeChanged,
  onUpdate,
  onSubmit,
  onHint,
  onClose,
  onRetry,
  disabled,
}: {
  question: Question;
  codeChanged: boolean;
  onUpdate: (answer: string) => void;
  onSubmit: () => void;
  onHint: () => void;
  onClose: () => void;
  onRetry: () => void;
  disabled: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [question.id]);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <section className={s.questionCard} aria-labelledby="question-title">
      <div className={s.questionTop}>
        <span>
          <Icon name="book" size={15} />
          {question.kind === "code"
            ? "Практика в редакторе"
            : "Вопрос на понимание"}
        </span>
        <button
          className={s.iconButton}
          aria-label="Свернуть вопрос"
          onClick={onClose}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className={s.questionContent}>
        <h3 ref={heading} tabIndex={-1} id="question-title">
          {question.text}
        </h3>
        <details className={s.questionSource}>
          <summary>
            {codeChanged && question.kind !== "code"
              ? "Код изменился · открыть фрагмент вопроса"
              : "Фрагмент, к которому относится вопрос"}
          </summary>
          <pre>{question.code}</pre>
        </details>
        <form onSubmit={submit}>
          {question.kind === "choice" && (
            <fieldset
              className={s.answerChoices}
              disabled={question.feedback !== null || disabled}
            >
              <legend className={s.srOnly}>Выбери ответ</legend>
              {question.choices.map((choice) => (
                <label key={choice}>
                  <input
                    type="radio"
                    name={`answer-${question.id}`}
                    value={choice}
                    checked={question.answer === choice}
                    onChange={() => onUpdate(choice)}
                  />
                  <span>{choice}</span>
                </label>
              ))}
            </fieldset>
          )}
          {question.kind === "text" && (
            <textarea
              aria-label="Ответ на вопрос"
              placeholder="Объясни своими словами…"
              value={question.answer}
              onChange={(event) => onUpdate(event.target.value)}
              disabled={question.feedback !== null || disabled}
              maxLength={2000}
              rows={3}
            />
          )}
          {question.kind === "code" && (
            <p className={s.muted}>
              Внеси изменение в редакторе и нажми «Проверить код».
            </p>
          )}
          {question.hintUsed && (
            <p className={s.hint}>
              <strong>Подсказка</strong> {question.hint}
            </p>
          )}
          {question.feedback ? (
            <div className={s.feedback} role="status">
              <p>{question.feedback}</p>
              <div className={s.questionActions}>
                <button type="button" className={s.secondary} onClick={onRetry}>
                  Попробовать ещё
                </button>
                <button
                  type="button"
                  className={s.textButton}
                  onClick={onClose}
                >
                  Вернуться к диалогу
                </button>
              </div>
            </div>
          ) : (
            <div className={s.questionActions}>
              <button
                className={s.primary}
                type="submit"
                disabled={
                  disabled ||
                  (question.kind !== "code" && !question.answer.trim())
                }
              >
                {question.kind === "code" ? "Проверить код" : "Отправить ответ"}
                <Icon name="arrow" size={15} />
              </button>
              <button
                className={s.textButton}
                type="button"
                onClick={onHint}
                disabled={question.hintUsed}
              >
                Подсказка
              </button>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
