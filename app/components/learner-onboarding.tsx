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
    <section
      className="grid min-h-162.5 grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start gap-18 py-6 pb-9 max-lg:gap-10 max-md:min-h-0 max-md:grid-cols-1 max-md:gap-7 max-md:py-0 [&>div:last-child>button]:w-full [&>div:last-child>button]:justify-center [&>div:last-child>button:last-child]:mt-2.5"
      aria-label="Знакомство"
    >
      <div className="pt-10 [&_h1]:mb-5 [&_h1]:text-[43px] [&_h1]:leading-[1.14] [&_h1]:font-semibold [&_h1]:tracking-[-1.7px] [&_h1>span]:text-[#8cac65] [&>p]:max-w-137.5 [&>p]:text-[15px] [&>p]:leading-[1.85] [&>p]:text-[#6b7f65] max-lg:[&_h1]:text-4xl max-md:pt-0 max-md:[&>p]:text-sm max-sm:[&_h1]:text-3xl">
        <span className="mb-4 block text-[10px] font-semibold tracking-[1.8px] text-[#718768] max-md:text-[9px]">
          СНАЧАЛА ПОЗНАКОМИМСЯ
        </span>
        <h1>
          Будем говорить
          <br />
          на понятном тебе языке<span>.</span>
        </h1>
        <p>
          Пара вопросов поможет выбрать подходящие объяснения. Это не экзамен и
          не оценка твоих способностей.
        </p>
        <div className="mt-8 flex gap-3.5 rounded-xl border border-[#dce8cd] bg-[#e8f0dc] p-5 [&>svg]:shrink-0 [&>svg]:text-[#799c52] [&_strong]:text-sm [&_strong]:font-semibold [&_p]:mt-2 [&_p]:text-[13px] [&_p]:leading-[1.8] [&_p]:text-[#6a8254] max-md:mt-5 max-md:p-4">
          <Icon name="spark" />
          <div>
            <strong>Отвечай честно, без подсказок.</strong>
            <p>
              «Не знаю» — полезный ответ. Так мы поймём, что стоит объяснить
              подробнее.
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2 text-xs text-[#778c67] max-md:mt-4">
          <Icon name="clock" size={16} /> До 3 минут · без таймера
        </div>
      </div>
      <div className="min-w-0 rounded-xl border border-[#dce6d3] bg-white p-7.5 [&_h2]:mb-4 [&_h2]:text-[25px] [&_h2]:leading-[1.4] [&_h2]:font-semibold [&_h2]:tracking-[-.5px] max-lg:p-6 max-md:[&_h2]:text-[23px] max-sm:p-5 max-sm:[&_h2]:text-xl">
        {stage === "languages" ? (
          <>
            <span className="mb-4 block text-[10px] font-semibold tracking-[1.8px] text-[#718768] max-md:text-[9px]">
              ШАГ 1 / ЗНАКОМСТВО
            </span>
            <h2 ref={heading} tabIndex={-1}>
              Какие языки ты уже изучал?
            </h2>
            <p className="mb-6 text-sm leading-[1.8] text-[#738667]">
              Можно выбрать несколько. Не нужно знать их идеально.
            </p>
            <div
              className="my-6 grid gap-3"
              role="group"
              aria-label="Знакомые языки"
            >
              {languageOptions.map((language, i) => (
                <button
                  key={language}
                  aria-label={language}
                  className={`flex w-full cursor-pointer items-center gap-4 rounded-lg border border-[#dfe7d6] bg-[#fbfcf8] p-4 text-left text-[#3b5830] [&>strong]:text-[15px] [&>strong]:font-medium [&>span:last-child]:ml-auto ${languages.includes(language) ? "border-[#8eb361]! bg-[#f1f8e8]! shadow-[inset_0_0_0_1px_#8eb361]" : ""}`}
                  aria-pressed={languages.includes(language)}
                  onClick={() =>
                    setLanguages(
                      languages.includes(language)
                        ? languages.filter((l) => l !== language)
                        : [...languages, language],
                    )
                  }
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-[#e9f0df] text-[13px] font-bold text-[#789553]">
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
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-3.5 rounded-lg border border-transparent bg-[#28573e] px-4.5 py-3 text-[13px] font-semibold text-[#f4f9ec] transition-colors enabled:hover:bg-[#3d704b] max-sm:gap-2 max-sm:px-3 max-sm:text-xs"
              disabled={languages.length === 0}
              onClick={() => {
                setStage("questions");
                setStep(0);
                focus();
              }}
            >
              Продолжить <Icon name="arrow" size={17} />
            </button>
            <button
              className="inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent py-3 text-xs text-[#5e7d4c] hover:underline"
              onClick={() => complete([], {})}
            >
              Я только начинаю — пока ни одного
            </button>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-4 [&>span:first-child]:mb-0 max-md:gap-2.5 max-md:[&>span:last-child]:text-[8px]">
              <span className="mb-4 block text-[10px] font-semibold tracking-[1.8px] text-[#718768] max-md:text-[9px]">
                {q.language} · {step + 1} ИЗ {questions.length}
              </span>
              <span className="rounded border border-[#e1ead7] bg-[#f6f9f0] px-2 py-1 text-[10px] text-[#698652]">
                {q.kind === "code"
                  ? "Понимание кода"
                  : "Знакомство с терминами"}
              </span>
            </div>
            <div
              className="mb-6 h-1 overflow-hidden rounded bg-[#e9f0e0] [&>span]:block [&>span]:h-full [&>span]:rounded [&>span]:bg-[#96b66b] [&>span]:transition-[width]"
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
                <pre className="my-5 overflow-auto rounded-lg bg-[#20382e] p-5 font-mono text-[13px] leading-[1.8] text-[#e3edd6] max-sm:p-4 max-sm:text-[11px]">
                  <code>{q.code}</code>
                </pre>
                {q.language === "Java" && (
                  <p className="mt-4 text-[11px] leading-[1.8] text-[#758966]">
                    Фрагмент внутри метода main.
                  </p>
                )}
              </>
            )}
            <div
              className="my-5 grid gap-2.5"
              role="group"
              aria-label="Ответ на вопрос"
            >
              {[...q.choices, "Не знаю"].map((choice, i) => {
                const value = i === q.choices.length ? "unknown" : i;
                return (
                  <button
                    key={choice}
                    aria-pressed={answers[q.id] === value}
                    className={`flex min-h-11.5 cursor-pointer items-center gap-3 rounded-md border border-[#dde6d1] bg-white px-4 py-3 text-left text-[13px] text-[#49663b] [&>span:first-child]:text-[11px] [&>span:first-child]:text-[#758f60] [&>span:last-child]:ml-auto [&>span:last-child]:text-[#8da875] ${answers[q.id] === value ? "border-[#8eb361]! bg-[#f1f8e8]! shadow-[inset_0_0_0_1px_#8eb361]" : ""}`}
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
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-3.5 rounded-lg border border-[#dbe6d0] bg-white px-4.5 py-3 text-[13px] font-semibold text-[#617e4d] transition-colors enabled:hover:bg-[#f2f7ea] max-sm:gap-2 max-sm:px-3 max-sm:text-xs"
                onClick={() => {
                  if (step === 0) setStage("languages");
                  else setStep(step - 1);
                  focus();
                }}
              >
                Назад
              </button>
              <button
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-3.5 rounded-lg border border-transparent bg-[#28573e] px-4.5 py-3 text-[13px] font-semibold text-[#f4f9ec] transition-colors enabled:hover:bg-[#3d704b] max-sm:gap-2 max-sm:px-3 max-sm:text-xs"
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
            <p className="mt-4 text-[11px] leading-[1.8] text-[#758966]">
              Ответы нужны для начальной настройки объяснений. Понимание будет
              уточняться по ходу тренировки.
            </p>
          </>
        )}
        {onCancel && (
          <button
            className="inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent py-3 text-xs text-[#5e7d4c] hover:underline"
            onClick={onCancel}
          >
            Отменить изменения
          </button>
        )}
      </div>
    </section>
  );
}
