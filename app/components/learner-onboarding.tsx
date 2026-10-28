"use client";
import { useRef, useState } from "react";
import {
  diagnosticQuestions,
  languageOptions,
  type Language,
  type LearnerProfile,
  type DiagnosticAnswer,
} from "../lib/onboarding";
import { Icon } from "./ui-icon";
import s from "./code-workspace.module.css";

export default function LearnerOnboarding({
  initial,
  onComplete,
  onCancel,
}: {
  initial: LearnerProfile | null;
  onComplete: (profile: LearnerProfile) => void;
  onCancel?: () => void;
}) {
  const [languages, setLanguages] = useState<Language[]>(
    initial?.languages ?? [],
  );
  const [stage, setStage] = useState<"languages" | "questions">("languages");
  const [answers, setAnswers] = useState<Record<string, number | "unknown">>(
    {},
  );
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const questions = diagnosticQuestions.filter((q) =>
    languages.includes(q.language),
  );
  const q = questions[step];
  function focus() {
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  }
  function complete(
    selected: Language[],
    evidence: Record<string, number | "unknown">,
  ) {
    const list: DiagnosticAnswer[] = diagnosticQuestions
      .filter((q) => selected.includes(q.language))
      .map((q) => ({ questionId: q.id, choice: evidence[q.id] }));
    onComplete({
      version: 1,
      languages: selected,
      answers: list,
      completedAt: new Date().toISOString(),
    });
  }
  return (
    <section className={s.onboarding} aria-label="Знакомство">
      <div className={s.onboardingIntro}>
        <span className={s.eyebrow}>СНАЧАЛА ПОЗНАКОМИМСЯ</span>
        <h1>
          Будем говорить
          <br />
          на понятном тебе языке<span>.</span>
        </h1>
        <p>
          Пара вопросов поможет выбрать подходящие объяснения. Это не экзамен и
          не оценка твоих способностей.
        </p>
        <div className={s.honesty}>
          <Icon name="spark" />
          <div>
            <strong>Отвечай честно, без подсказок.</strong>
            <p>
              «Не знаю» — полезный ответ. Так мы поймём, что стоит объяснить
              подробнее.
            </p>
          </div>
        </div>
        <div className={s.onboardingMeta}>
          <Icon name="clock" size={16} /> До 3 минут · без таймера
        </div>
      </div>
      <div className={s.card}>
        {stage === "languages" ? (
          <>
            <span className={s.eyebrow}>ШАГ 1 / ЗНАКОМСТВО</span>
            <h2 ref={heading} tabIndex={-1}>
              Какие языки ты уже изучал?
            </h2>
            <p className={s.muted}>
              Можно выбрать несколько. Не нужно знать их идеально.
            </p>
            <div
              className={s.languageGrid}
              role="group"
              aria-label="Знакомые языки"
            >
              {languageOptions.map((language, i) => (
                <button
                  key={language}
                  aria-label={language}
                  className={`${s.languageOption} ${languages.includes(language) ? s.chosen : ""}`}
                  aria-pressed={languages.includes(language)}
                  onClick={() =>
                    setLanguages(
                      languages.includes(language)
                        ? languages.filter((l) => l !== language)
                        : [...languages, language],
                    )
                  }
                >
                  <span className={s.languageSymbol}>
                    {["Py", "JS", "Ja"][i]}
                  </span>
                  <strong>{language}</strong>
                  <span>
                    {languages.includes(language) ? (
                      <Icon name="check" size={17} />
                    ) : (
                      "+"
                    )}
                  </span>
                </button>
              ))}
            </div>
            <button
              className={s.primary}
              disabled={languages.length === 0}
              onClick={() => {
                setStage("questions");
                setStep(0);
                focus();
              }}
            >
              Продолжить <Icon name="arrow" size={17} />
            </button>
            <button className={s.textButton} onClick={() => complete([], {})}>
              Я только начинаю — пока ни одного
            </button>
          </>
        ) : (
          <>
            <div className={s.between}>
              <span className={s.eyebrow}>
                {q.language} · {step + 1} ИЗ {questions.length}
              </span>
              <span className={s.tag}>
                {q.kind === "code"
                  ? "Понимание кода"
                  : "Знакомство с терминами"}
              </span>
            </div>
            <div
              className={s.progressTrack}
              role="progressbar"
              aria-label="Вопросы знакомства"
              aria-valuemin={0}
              aria-valuemax={questions.length}
              aria-valuenow={step}
            >
              <span style={{ width: `${(step / questions.length) * 100}%` }} />
            </div>
            <h2 ref={heading} tabIndex={-1}>
              {q.text}
            </h2>
            {q.code && (
              <>
                <pre className={s.diagnosticCode}>
                  <code>{q.code}</code>
                </pre>
                {q.language === "Java" && (
                  <p className={s.small}>Фрагмент внутри метода main.</p>
                )}
              </>
            )}
            <div
              className={s.choices}
              role="group"
              aria-label="Ответ на вопрос"
            >
              {[...q.choices, "Не знаю"].map((choice, i) => {
                const value = i === q.choices.length ? "unknown" : i;
                return (
                  <button
                    key={choice}
                    aria-pressed={answers[q.id] === value}
                    className={`${s.choice} ${answers[q.id] === value ? s.chosen : ""}`}
                    onClick={() => setAnswers({ ...answers, [q.id]: value })}
                  >
                    <span>
                      {i === q.choices.length
                        ? "?"
                        : String.fromCharCode(65 + i)}
                    </span>
                    {choice}
                    <span>{answers[q.id] === value ? "●" : "○"}</span>
                  </button>
                );
              })}
            </div>
            <div className={s.actions}>
              <button
                className={s.secondary}
                onClick={() => {
                  if (step === 0) setStage("languages");
                  else setStep(step - 1);
                  focus();
                }}
              >
                Назад
              </button>
              <button
                className={s.primary}
                disabled={answers[q.id] === undefined}
                onClick={() => {
                  if (step + 1 === questions.length)
                    complete(languages, answers);
                  else {
                    setStep(step + 1);
                    focus();
                  }
                }}
              >
                {step + 1 === questions.length
                  ? "Перейти к своему коду"
                  : "Дальше"}
                <Icon name="arrow" size={17} />
              </button>
            </div>
            <p className={s.small}>
              Ответы нужны для начальной настройки объяснений. Понимание будет
              уточняться по ходу тренировки.
            </p>
          </>
        )}
        {onCancel && (
          <button className={s.textButton} onClick={onCancel}>
            Отменить изменения
          </button>
        )}
      </div>
    </section>
  );
}
