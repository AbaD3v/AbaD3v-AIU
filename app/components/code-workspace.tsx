"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "./ui-icon";
import LearnerOnboarding from "./learner-onboarding";
import {
  parseProfile,
  profileStorageKey,
  type LearnerProfile,
} from "../lib/onboarding";
import {
  createTraining,
  submitAnswer,
  type Training,
  type TrainingQuestion,
  type AnswerResult,
  type Feedback,
  type CodeRange,
} from "../lib/training-api";
import s from "./code-workspace.module.css";

function subscribe(fn: () => void) {
  window.addEventListener("storage", fn);
  return () => window.removeEventListener("storage", fn);
}
function readProfile() {
  try {
    return localStorage.getItem(profileStorageKey);
  } catch {
    return null;
  }
}
const noSubscribe = () => () => {};
type Turn = { question: TrainingQuestion; answer: string; feedback: Feedback };

export default function CodeWorkspace() {
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const stored = useSyncExternalStore(subscribe, readProfile, () => null);
  const [sessionProfile, setSessionProfile] = useState<LearnerProfile | null>(
    null,
  );
  const profile = sessionProfile ?? parseProfile(stored);
  const [editingProfile, setEditingProfile] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  const [code, setCode] = useState("");
  const [training, setTraining] = useState<Training | null>(null);
  const [current, setCurrent] = useState<TrainingQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedRange, setSelectedRange] = useState<CodeRange | null>(null);
  const controller = useRef<AbortController | null>(null);
  const createId = useRef<string | null>(null);
  const answerId = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function focus() {
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  }
  function saveProfile(p: LearnerProfile) {
    setSessionProfile(p);
    setEditingProfile(false);
    createId.current = null;
    setError("");
    try {
      localStorage.setItem(profileStorageKey, JSON.stringify(p));
      setStorageNotice("");
    } catch {
      setStorageNotice(
        "Браузер не разрешает сохранение профиля. После перезагрузки знакомство нужно будет пройти снова.",
      );
    }
    focus();
  }
  async function prepare(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || controller.current || !profile) return;
    if (!code.trim() || code.length > 10000) {
      setError("Вставь непустой код длиной до 10 000 символов.");
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    createId.current ??= crypto.randomUUID();
    try {
      const data = await createTraining(
        code,
        profile,
        createId.current,
        abort.signal,
      );
      setTraining(data);
      setCurrent(data.firstQuestion);
      setTurns([]);
      setResult(null);
      setAnswer("");
      setFinished(false);
      setSelectedRange(null);
      focus();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось подготовить тренировку.",
      );
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }
  async function checkAnswer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !training ||
      !current ||
      busy ||
      controller.current ||
      result ||
      !answer.trim()
    )
      return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    answerId.current ??= crypto.randomUUID();
    try {
      const data = await submitAnswer(
        training.id,
        current,
        answer,
        code,
        answerId.current,
        abort.signal,
      );
      setResult(data);
      setTurns((previous) => [
        ...previous,
        { question: current, answer, feedback: data.feedback },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось проверить ответ.");
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }
  function next() {
    if (!result) return;
    if (result.complete) {
      setFinished(true);
      setSelectedRange(null);
    } else {
      setCurrent(result.nextQuestion);
      setAnswer("");
      setResult(null);
      setSelectedRange(null);
      answerId.current = null;
    }
    focus();
  }
  function reset() {
    if (busy) return;
    if (
      !finished &&
      !window.confirm(
        "Вернуться к коду? Текущий разбор и ответы исчезнут с этой страницы.",
      )
    )
      return;
    setTraining(null);
    setCurrent(null);
    setResult(null);
    setTurns([]);
    setFinished(false);
    setError("");
    createId.current = null;
  }
  const highlight = selectedRange ?? (finished ? null : current);

  return (
    <div className={s.root}>
      <a href="#main" className={s.skip}>
        К содержимому
      </a>
      <header className={s.header}>
        <a href="#main" className={s.brand}>
          <span>
            <Icon name="code" size={23} />
          </span>
          CodeProof<b>.</b>
        </a>
        <span className={s.headerCaption}>
          Понимание начинается с твоего кода
        </span>
        {profile && !training && !editingProfile && (
          <button
            className={s.headerButton}
            disabled={busy}
            onClick={() => setEditingProfile(true)}
          >
            <Icon name="spark" size={15} /> Настроить объяснения
          </button>
        )}
      </header>
      <main id="main" className={s.main}>
        {!hydrated ? (
          <p role="status" className={s.loading}>
            Открываем твоё пространство…
          </p>
        ) : !profile || editingProfile ? (
          <LearnerOnboarding
            initial={profile}
            onComplete={saveProfile}
            onCancel={profile ? () => setEditingProfile(false) : undefined}
          />
        ) : (
          <>
            {storageNotice && (
              <p role="status" className={s.notice}>
                {storageNotice}
              </p>
            )}
            {!training ? (
              <>
                <section className={s.intro}>
                  <div>
                    <span className={s.eyebrow}>ТВОЙ КОД. ТВОЁ ПОНИМАНИЕ.</span>
                    <h1>
                      Вставь свою работу.
                      <br />
                      <em>Разберём её вместе.</em>
                    </h1>
                    <p>
                      ИИ разберётся в программе, подберёт вопросы и поможет
                      подготовиться к объяснению — на понятном тебе языке.
                    </p>
                  </div>
                  <div className={s.profileCard}>
                    <Icon name="spark" size={24} />
                    <span>ОБЪЯСНЕНИЯ ПОД ТЕБЯ</span>
                    <strong>
                      {profile.languages.length
                        ? profile.languages.join(" · ")
                        : "Начнём с основ"}
                    </strong>
                    <p>
                      Без ярлыков «новичок» и «эксперт». Термины и формулировки
                      уточняются по твоим ответам.
                    </p>
                  </div>
                </section>
                <div className={s.homeGrid}>
                  <form
                    onSubmit={prepare}
                    className={s.inputCard}
                    aria-label="Подготовка своей работы"
                  >
                    <div className={s.editorTitle}>
                      <span>
                        <Icon name="code" /> Твой код
                      </span>
                      <span>Язык определится автоматически</span>
                    </div>
                    <label className={s.srOnly} htmlFor="source-code">
                      Код программы
                    </label>
                    <textarea
                      id="source-code"
                      className={s.codeInput}
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\r\n?/g, "\n"));
                        createId.current = null;
                        setError("");
                      }}
                      disabled={busy}
                      maxLength={10000}
                      spellCheck={false}
                      autoCapitalize="off"
                      autoComplete="off"
                      placeholder={
                        "// Вставь сюда свою программу…\n\nНазвание, язык и вопросы подготовит ИИ."
                      }
                    />
                    <div className={s.inputMeta}>
                      <span>Один фрагмент · до 10 000 символов</span>
                      <span>
                        {code.length.toLocaleString("ru-RU")} / 10 000
                      </span>
                    </div>
                    {error && (
                      <div className={s.error} role="alert">
                        {error}
                      </div>
                    )}
                    <div className={s.inputBottom}>
                      <button
                        className={s.primary}
                        disabled={busy || !code.trim()}
                        type="submit"
                      >
                        {busy ? (
                          <>
                            <span className={s.spinner} /> Подготавливаем
                            разбор…
                          </>
                        ) : (
                          <>
                            Подготовиться к защите{" "}
                            <Icon name="arrow" size={18} />
                          </>
                        )}
                      </button>
                      {busy ? (
                        <button
                          className={s.textButton}
                          type="button"
                          onClick={() => controller.current?.abort()}
                        >
                          Отменить запрос
                        </button>
                      ) : (
                        <span>Никаких дополнительных настроек</span>
                      )}
                    </div>
                    {busy && (
                      <p role="status" className={s.loadingHint}>
                        Ждём ответ ИИ: название работы, объяснение кода и первый
                        вопрос.
                      </p>
                    )}
                  </form>
                  <aside className={s.guide}>
                    <span className={s.eyebrow}>ЧТО БУДЕТ ДАЛЬШЕ</span>
                    <h2>
                      От работающего кода
                      <br />к ясному объяснению.
                    </h2>
                    <ol>
                      <li>
                        <span>01</span>
                        <div>
                          <h3>Поймём твою программу</h3>
                          <p>
                            Назначение, логика и важные фрагменты — в одном
                            разборе.
                          </p>
                        </div>
                      </li>
                      <li>
                        <span>02</span>
                        <div>
                          <h3>Порепетируем защиту</h3>
                          <p>
                            Вопросы по твоему коду, с учётом знакомых тебе
                            терминов.
                          </p>
                        </div>
                      </li>
                      <li>
                        <span>03</span>
                        <div>
                          <h3>Разберём ответы</h3>
                          <p>
                            Что получилось объяснить и к чему стоит вернуться.
                          </p>
                        </div>
                      </li>
                    </ol>
                    <div className={s.softNote}>
                      <Icon name="book" />
                      <p>
                        Не знаешь термин? Это не значит, что ты не понимаешь
                        код. Объясняй своими словами.
                      </p>
                    </div>
                  </aside>
                </div>
                <div className={s.privacy}>
                  <Icon name="check" size={16} />
                  <p>
                    Профиль знакомства хранится в этом браузере. Код
                    отправляется на разбор только по нажатию кнопки и не
                    записывается в localStorage.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className={s.trainingHeading}>
                  <div>
                    <span className={s.eyebrow}>
                      {training.language} · ТВОЯ РАБОТА
                    </span>
                    <h1>{training.title}</h1>
                  </div>
                  <button
                    className={s.secondary}
                    disabled={busy}
                    onClick={reset}
                  >
                    Вернуться к коду
                  </button>
                </div>
                <div className={s.trainingGrid}>
                  <div className={s.codeColumn}>
                    <section className={s.codeCard} aria-label="Исходный код">
                      <div className={s.editorTitle}>
                        <span>
                          <Icon name="code" size={18} /> {training.language}
                        </span>
                        <span>
                          {highlight
                            ? `Строки ${highlight.lineStart}–${highlight.lineEnd}`
                            : "Твой исходник"}
                        </span>
                      </div>
                      <div className={s.source}>
                        {code.split("\n").map((line, i) => (
                          <div
                            key={i}
                            className={
                              highlight &&
                              i + 1 >= highlight.lineStart &&
                              i + 1 <= highlight.lineEnd
                                ? s.highlight
                                : ""
                            }
                          >
                            <span aria-hidden="true">{i + 1}</span>
                            <code>{line || " "}</code>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className={s.card}>
                      <span className={s.eyebrow}>РАЗБОР ПРОГРАММЫ</span>
                      <h2>Что делает твой код</h2>
                      <p className={s.prose}>{training.overview}</p>
                      {training.sections.map((section, i) => (
                        <details className={s.review} key={i}>
                          <summary>{section.title}</summary>
                          <p className={s.prose}>{section.explanation}</p>
                          <button
                            className={s.textButton}
                            onClick={() => setSelectedRange(section)}
                          >
                            Выделить строки {section.lineStart}–
                            {section.lineEnd}
                          </button>
                        </details>
                      ))}
                      {selectedRange && (
                        <button
                          className={s.textButton}
                          onClick={() => setSelectedRange(null)}
                        >
                          Вернуть подсветку вопроса
                        </button>
                      )}
                    </section>
                  </div>
                  <section className={s.card} aria-label="Репетиция защиты">
                    {finished ? (
                      <>
                        <span className={s.eyebrow}>ТРЕНИРОВКА ЗАВЕРШЕНА</span>
                        <h2 ref={heading} tabIndex={-1}>
                          Теперь объяснить проще
                        </h2>
                        <div className={s.score}>
                          <strong>
                            {turns.reduce(
                              (sum, t) => sum + t.feedback.score,
                              0,
                            )}
                            <small>/50</small>
                          </strong>
                          <span>Оценка ИИ для самопроверки</span>
                        </div>
                        <p className={s.muted}>
                          Вернись к объяснениям, которые вызвали трудности.
                          Оценка ИИ может содержать ошибки.
                        </p>
                        {turns.map((turn, i) => (
                          <details key={turn.question.id} className={s.review}>
                            <summary>
                              {i + 1}. {turn.question.text} ·{" "}
                              {turn.feedback.score}/10
                            </summary>
                            <p className={s.prose}>
                              <strong>Твой ответ:</strong> {turn.answer}
                            </p>
                            <p className={s.prose}>{turn.feedback.summary}</p>
                            <p className={s.prose}>
                              {turn.feedback.explanation}
                            </p>
                          </details>
                        ))}
                        <button className={s.primary} onClick={reset}>
                          Вернуться к своей работе{" "}
                          <Icon name="arrow" size={17} />
                        </button>
                      </>
                    ) : (
                      current && (
                        <>
                          <div className={s.between}>
                            <span className={s.eyebrow}>
                              ВОПРОС {current.number} ИЗ 5
                            </span>
                            <span className={s.tag}>Без таймера</span>
                          </div>
                          <div className={s.progressTrack}>
                            <span
                              style={{
                                width: `${((current.number - 1) / 5) * 100}%`,
                              }}
                            />
                          </div>
                          <h2 ref={heading} tabIndex={-1}>
                            {current.text}
                          </h2>
                          {current.modifiedCode && (
                            <div className={s.modification}>
                              <strong>Если заменить выделенные строки:</strong>
                              <pre>
                                <code>{current.modifiedCode}</code>
                              </pre>
                              <span>Исходный код слева не изменён.</span>
                            </div>
                          )}
                          <form onSubmit={checkAnswer}>
                            <label className={s.field}>
                              Твоё объяснение
                              <textarea
                                value={answer}
                                onChange={(e) => {
                                  setAnswer(e.target.value);
                                  answerId.current = null;
                                  setError("");
                                }}
                                disabled={busy}
                                readOnly={!!result}
                                maxLength={2000}
                                required
                                placeholder="Объясни своими словами. Можно написать «Не знаю»."
                              />
                            </label>
                            <div className={s.inputMeta}>
                              <span>Не нужно угадывать</span>
                              <span>{answer.length} / 2 000</span>
                            </div>
                            {error && (
                              <div role="alert" className={s.error}>
                                {error}
                              </div>
                            )}
                            {result ? (
                              <>
                                <div className={s.feedback} role="status">
                                  <strong>{result.feedback.summary}</strong>
                                  <p className={s.prose}>
                                    {result.feedback.explanation}
                                  </p>
                                  <span>
                                    {result.feedback.score}/10 · Оценка ИИ для
                                    самопроверки
                                  </span>
                                </div>
                                <button
                                  className={s.primary}
                                  type="button"
                                  onClick={next}
                                >
                                  {result.complete
                                    ? "Посмотреть результат"
                                    : "Следующий вопрос"}
                                  <Icon name="arrow" size={17} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className={s.primary}
                                  type="submit"
                                  disabled={busy || !answer.trim()}
                                >
                                  {busy ? "Проверяем объяснение…" : "Ответить"}
                                  <Icon name="arrow" size={17} />
                                </button>
                                {busy && (
                                  <button
                                    className={s.textButton}
                                    type="button"
                                    onClick={() => controller.current?.abort()}
                                  >
                                    Отменить запрос
                                  </button>
                                )}
                              </>
                            )}
                          </form>
                        </>
                      )
                    )}
                  </section>
                </div>
                <p className={s.small}>
                  Код и текущая тренировка доступны до перезагрузки страницы.
                  Долговременное хранение появится после подключения аккаунта.
                </p>
              </>
            )}
          </>
        )}
        <footer className={s.footer}>
          <span>
            CodeProof<span>.</span> <small>Учись объяснять свой код.</small>
          </span>
          <a href="/about" target="_blank" rel="noopener noreferrer">
            О себе ↗<span className={s.srOnly}> (в новой вкладке)</span>
          </a>
        </footer>
      </main>
    </div>
  );
}
