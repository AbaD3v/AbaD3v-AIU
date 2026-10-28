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
    <div className="min-h-screen text-[#203c31] [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-45 motion-reduce:[&_*]:transition-none">
      <a
        href="#main"
        className="fixed -top-20 left-4 z-100 bg-[#d9f2ab] p-3 focus:top-4"
      >
        К содержимому
      </a>
      <header className="flex min-h-21 items-center gap-8 bg-[#16372d] px-7 text-[#eef6e6] max-md:min-h-18 max-md:gap-3 max-md:px-4 max-sm:flex-wrap max-sm:gap-y-2 max-sm:py-3 max-sm:[&>button]:ml-0 max-sm:[&>button]:w-full">
        <a
          href="#main"
          className="flex shrink-0 items-center gap-1 text-2xl font-bold tracking-tight [&>span]:mr-2 [&>span]:flex [&>span]:text-[#cef398] [&>b]:text-[#c4ea8c] max-md:text-xl"
        >
          <span>
            <Icon name="code" size={23} />
          </span>
          CodeProof<b>.</b>
        </a>
        <span className="text-xs text-[#b0c5b1] max-lg:hidden">
          Понимание начинается с твоего кода
        </span>
        {profile && !training && !editingProfile && (
          <button
            className="ml-auto flex cursor-pointer items-center gap-2 rounded-lg border border-[#416343] bg-[#274c39] px-3 py-2.5 text-xs text-[#d4e5c2] max-md:max-w-36 max-md:text-[10px]"
            disabled={busy}
            onClick={() => setEditingProfile(true)}
          >
            <Icon name="spark" size={15} /> Настроить объяснения
          </button>
        )}
      </header>
      <main
        id="main"
        className="mx-auto max-w-314 px-7 pt-13 max-md:px-4 max-md:pt-7"
      >
        {!hydrated ? (
          <p
            role="status"
            className="min-h-75 py-25 text-center text-[#718663]"
          >
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
              <p
                role="status"
                className="mb-5 rounded-lg bg-[#f4eddc] px-5 py-4 text-[13px] leading-[1.7] text-[#776039]"
              >
                {storageNotice}
              </p>
            )}
            {!training ? (
              <>
                <section className="mb-9 grid grid-cols-[minmax(0,1fr)_300px] items-center gap-15 [&_h1]:mb-5 [&_h1]:text-[45px] [&_h1]:leading-[1.14] [&_h1]:font-semibold [&_h1]:tracking-[-1.7px] [&_h1_em]:text-[#63874b] [&_h1_em]:not-italic [&>div>p]:max-w-137.5 [&>div>p]:text-[15px] [&>div>p]:leading-[1.85] [&>div>p]:text-[#6b7f65] max-lg:grid-cols-[minmax(0,1fr)_270px] max-lg:gap-7 max-lg:[&_h1]:text-[38px] max-md:grid-cols-1 max-md:gap-6 max-md:[&_h1]:text-4xl max-sm:[&_h1]:text-3xl">
                  <div>
                    <span className="mb-4 block text-[10px] font-semibold tracking-[1.8px] text-[#718768] max-md:text-[9px]">
                      ТВОЙ КОД. ТВОЁ ПОНИМАНИЕ.
                    </span>
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
                  <div className="rounded-xl border border-[#dfe9d4] bg-[#eaf1e0] p-6 [&>svg]:mb-4 [&>svg]:text-[#88a85b] [&>span]:mb-3 [&>span]:block [&>span]:text-[9px] [&>span]:tracking-[1.6px] [&>span]:text-[#6f855c] [&>strong]:block [&>strong]:text-lg [&>strong]:font-semibold [&>p]:mt-3 [&>p]:text-xs! [&>p]:leading-[1.8] [&>p]:text-[#6b805c] max-md:p-5 max-md:[&>svg]:float-right max-md:[&>svg]:mb-0">
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
                <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(270px,1fr)] gap-8 max-lg:gap-6 max-md:grid-cols-1">
                  <form
                    onSubmit={prepare}
                    className="min-w-0 overflow-hidden rounded-xl border border-[#dbe4d4] bg-white"
                    aria-label="Подготовка своей работы"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-[#dfe8d5] bg-[#f0f5e9] px-6 py-4.5 text-xs text-[#5b7550] [&>span:first-child]:flex [&>span:first-child]:items-center [&>span:first-child]:gap-2.5 [&>span:first-child]:text-sm [&>span:first-child]:font-semibold [&>span:last-child]:text-right [&>span:last-child]:text-[10px] max-md:px-4 max-md:[&>span:last-child]:max-w-32 max-md:[&>span:last-child]:text-[9px]">
                      <span>
                        <Icon name="code" /> Твой код
                      </span>
                      <span>Язык определится автоматически</span>
                    </div>
                    <label className="sr-only" htmlFor="source-code">
                      Код программы
                    </label>
                    <textarea
                      id="source-code"
                      className="block min-h-87.5 w-full resize-y border-0 bg-[#20392f] px-6 py-6 font-mono text-sm leading-[1.8] text-[#e4eddb] [tab-size:4] placeholder:text-[#a7baa1] focus:outline-2 focus:-outline-offset-3 focus:outline-[#93bd66] max-md:min-h-75 max-md:p-5 max-md:text-[13px]"
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
                    <div className="flex items-center justify-between gap-3 px-6 py-3.5 text-[11px] text-[#6e7d64] max-md:px-4 max-md:text-[10px]">
                      <span>Один фрагмент · до 10 000 символов</span>
                      <span>
                        {code.length.toLocaleString("ru-RU")} / 10 000
                      </span>
                    </div>
                    {error && (
                      <div
                        className="mx-6 mt-2.5 mb-4.5 rounded-lg border border-[#ebcdb8] bg-[#fff1e8] px-5 py-4 text-[13px] leading-[1.7] text-[#885d3f] max-md:mx-4"
                        role="alert"
                      >
                        {error}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-5 px-6 pt-2.5 pb-6 [&>span]:text-[11px] [&>span]:text-[#748367] max-md:gap-3.5 max-md:px-4 max-md:pb-5 max-md:[&>button:first-child]:w-full max-md:[&>span]:w-full max-md:[&>span]:text-center">
                      <button
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-3.5 rounded-lg border border-transparent bg-[#28573e] px-4.5 py-3 text-[13px] font-semibold text-[#f4f9ec] transition-colors enabled:hover:bg-[#3d704b] max-sm:gap-2 max-sm:px-3 max-sm:text-xs"
                        disabled={busy || !code.trim()}
                        type="submit"
                      >
                        {busy ? (
                          <>
                            <span className="size-3.5 animate-spin rounded-full border-2 border-[#8eac77] border-t-[#e6f1d4] motion-reduce:animate-none" />{" "}
                            Подготавливаем разбор…
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
                          className="inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent py-3 text-xs text-[#5e7d4c] hover:underline"
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
                      <p
                        role="status"
                        className="mx-6 mb-5 text-xs leading-[1.7] text-[#667e54]"
                      >
                        Ждём ответ ИИ: название работы, объяснение кода и первый
                        вопрос.
                      </p>
                    )}
                  </form>
                  <aside className="pt-4 [&_h2]:mb-7 [&_h2]:text-[27px] [&_h2]:leading-[1.3] [&_h2]:font-medium [&_h2]:tracking-[-.8px] [&_ol]:m-0 [&_ol]:list-none [&_ol]:p-0 [&_li]:my-6 [&_li]:flex [&_li]:gap-4 [&_li>span]:grid [&_li>span]:size-8 [&_li>span]:shrink-0 [&_li>span]:place-items-center [&_li>span]:rounded-full [&_li>span]:border [&_li>span]:border-[#dce8cd] [&_li>span]:bg-[#eaf2df] [&_li>span]:text-[11px] [&_li>span]:text-[#6d8d4e] [&_h3]:mt-1 [&_h3]:mb-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_li_p]:text-[13px] [&_li_p]:leading-[1.75] [&_li_p]:text-[#73846a]">
                    <span className="mb-4 block text-[10px] font-semibold tracking-[1.8px] text-[#718768] max-md:text-[9px]">
                      ЧТО БУДЕТ ДАЛЬШЕ
                    </span>
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
                    <div className="mt-6 flex gap-3 rounded-lg bg-[#eaf0e1] p-4.5 [&>svg]:mt-1 [&>svg]:shrink-0 [&>svg]:text-[#7d9d59] [&>p]:text-xs [&>p]:leading-[1.8] [&>p]:text-[#60784e]">
                      <Icon name="book" />
                      <p>
                        Не знаешь термин? Это не значит, что ты не понимаешь
                        код. Объясняй своими словами.
                      </p>
                    </div>
                  </aside>
                </div>
                <div className="my-6 flex gap-2.5 text-[#73846a] [&>svg]:mt-1 [&>svg]:shrink-0 [&>p]:max-w-187.5 [&>p]:text-[11px] [&>p]:leading-[1.7]">
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
                <div className="mb-7.5 flex items-center justify-between gap-6 [&_h1]:m-0 [&_h1]:text-[35px] [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:[overflow-wrap:anywhere] max-lg:[&_h1]:text-[29px] max-md:flex-col max-md:items-start max-md:gap-4">
                  <div>
                    <span className="mb-4 block text-[10px] font-semibold tracking-[1.8px] text-[#718768] max-md:text-[9px]">
                      {training.language} · ТВОЯ РАБОТА
                    </span>
                    <h1>{training.title}</h1>
                  </div>
                  <button
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-3.5 rounded-lg border border-[#dbe6d0] bg-white px-4.5 py-3 text-[13px] font-semibold text-[#617e4d] transition-colors enabled:hover:bg-[#f2f7ea] max-sm:gap-2 max-sm:px-3 max-sm:text-xs"
                    disabled={busy}
                    onClick={reset}
                  >
                    Вернуться к коду
                  </button>
                </div>
                <div className="grid grid-cols-2 items-start gap-7 max-lg:gap-5 max-md:grid-cols-1 [&_form>div]:mx-0 [&_form>div]:px-0 [&_form>div[role=alert]]:px-4 [&_form>div[role=status]]:px-4">
                  <div className="grid min-w-0 gap-6">
                    <section
                      className="overflow-hidden rounded-xl bg-[#20382e] text-[#deead1] [&>div:first-child]:border-[#3d5741] [&>div:first-child]:bg-[#2a4536] [&>div:first-child]:text-[#b6cda1]"
                      aria-label="Исходный код"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-[#dfe8d5] bg-[#f0f5e9] px-6 py-4.5 text-xs text-[#5b7550] [&>span:first-child]:flex [&>span:first-child]:items-center [&>span:first-child]:gap-2.5 [&>span:first-child]:text-sm [&>span:first-child]:font-semibold [&>span:last-child]:text-right [&>span:last-child]:text-[10px] max-md:px-4 max-md:[&>span:last-child]:max-w-32 max-md:[&>span:last-child]:text-[9px]">
                        <span>
                          <Icon name="code" size={18} /> {training.language}
                        </span>
                        <span>
                          {highlight
                            ? `Строки ${highlight.lineStart}–${highlight.lineEnd}`
                            : "Твой исходник"}
                        </span>
                      </div>
                      <div className="max-h-130 overflow-auto py-5 font-mono text-[13px] leading-8 [&>div]:flex [&>div]:min-w-max [&>div]:px-5 [&>div]:whitespace-pre [&>div>span]:w-8.5 [&>div>span]:shrink-0 [&>div>span]:text-[#a0b594] [&>div>span]:select-none max-md:max-h-87.5 max-md:text-xs">
                        {code.split("\n").map((line, i) => (
                          <div
                            key={i}
                            className={
                              highlight &&
                              i + 1 >= highlight.lineStart &&
                              i + 1 <= highlight.lineEnd
                                ? "bg-[#3c5639] shadow-[inset_3px_0_#c1df86]"
                                : ""
                            }
                          >
                            <span aria-hidden="true">{i + 1}</span>
                            <code>{line || " "}</code>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="min-w-0 rounded-xl border border-[#dce6d3] bg-white p-7.5 [&_h2]:mb-4 [&_h2]:text-[25px] [&_h2]:leading-[1.4] [&_h2]:font-semibold [&_h2]:tracking-[-.5px] max-lg:p-6 max-md:[&_h2]:text-[23px] max-sm:p-5 max-sm:[&_h2]:text-xl">
                      <span className="mb-4 block text-[10px] font-semibold tracking-[1.8px] text-[#718768] max-md:text-[9px]">
                        РАЗБОР ПРОГРАММЫ
                      </span>
                      <h2>Что делает твой код</h2>
                      <p className="text-sm leading-[1.85] whitespace-pre-wrap text-[#607650] [overflow-wrap:anywhere]">
                        {training.overview}
                      </p>
                      {training.sections.map((section, i) => (
                        <details
                          className="mb-4 border-b border-[#e0e8d6] py-4 [&_summary]:cursor-pointer [&_summary]:text-sm [&_summary]:leading-[1.7] [&_summary]:text-[#476b39] [&_summary]:[overflow-wrap:anywhere]"
                          key={i}
                        >
                          <summary>{section.title}</summary>
                          <p className="text-sm leading-[1.85] whitespace-pre-wrap text-[#607650] [overflow-wrap:anywhere]">
                            {section.explanation}
                          </p>
                          <button
                            className="inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent py-3 text-xs text-[#5e7d4c] hover:underline"
                            onClick={() => setSelectedRange(section)}
                          >
                            Выделить строки {section.lineStart}–
                            {section.lineEnd}
                          </button>
                        </details>
                      ))}
                      {selectedRange && (
                        <button
                          className="inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent py-3 text-xs text-[#5e7d4c] hover:underline"
                          onClick={() => setSelectedRange(null)}
                        >
                          Вернуть подсветку вопроса
                        </button>
                      )}
                    </section>
                  </div>
                  <section
                    className="min-w-0 rounded-xl border border-[#dce6d3] bg-white p-7.5 [&_h2]:mb-4 [&_h2]:text-[25px] [&_h2]:leading-[1.4] [&_h2]:font-semibold [&_h2]:tracking-[-.5px] max-lg:p-6 max-md:[&_h2]:text-[23px] max-sm:p-5 max-sm:[&_h2]:text-xl"
                    aria-label="Репетиция защиты"
                  >
                    {finished ? (
                      <>
                        <span className="mb-4 block text-[10px] font-semibold tracking-[1.8px] text-[#718768] max-md:text-[9px]">
                          ТРЕНИРОВКА ЗАВЕРШЕНА
                        </span>
                        <h2 ref={heading} tabIndex={-1}>
                          Теперь объяснить проще
                        </h2>
                        <div className="my-5 flex items-center gap-5 rounded-lg bg-[#eff6e5] p-5 [&_strong]:text-[37px] [&_strong]:tracking-tight [&_strong]:text-[#5a803e] [&_small]:text-xl [&_small]:text-[#819966] [&>span]:text-[11px] [&>span]:text-[#6e835a]">
                          <strong>
                            {turns.reduce(
                              (sum, t) => sum + t.feedback.score,
                              0,
                            )}
                            <small>/50</small>
                          </strong>
                          <span>Оценка ИИ для самопроверки</span>
                        </div>
                        <p className="mb-6 text-sm leading-[1.8] text-[#738667]">
                          Вернись к объяснениям, которые вызвали трудности.
                          Оценка ИИ может содержать ошибки.
                        </p>
                        {turns.map((turn, i) => (
                          <details
                            key={turn.question.id}
                            className="mb-4 border-b border-[#e0e8d6] py-4 [&_summary]:cursor-pointer [&_summary]:text-sm [&_summary]:leading-[1.7] [&_summary]:text-[#476b39] [&_summary]:[overflow-wrap:anywhere]"
                          >
                            <summary>
                              {i + 1}. {turn.question.text} ·{" "}
                              {turn.feedback.score}/10
                            </summary>
                            <p className="text-sm leading-[1.85] whitespace-pre-wrap text-[#607650] [overflow-wrap:anywhere]">
                              <strong>Твой ответ:</strong> {turn.answer}
                            </p>
                            <p className="text-sm leading-[1.85] whitespace-pre-wrap text-[#607650] [overflow-wrap:anywhere]">
                              {turn.feedback.summary}
                            </p>
                            <p className="text-sm leading-[1.85] whitespace-pre-wrap text-[#607650] [overflow-wrap:anywhere]">
                              {turn.feedback.explanation}
                            </p>
                          </details>
                        ))}
                        <button
                          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-3.5 rounded-lg border border-transparent bg-[#28573e] px-4.5 py-3 text-[13px] font-semibold text-[#f4f9ec] transition-colors enabled:hover:bg-[#3d704b] max-sm:gap-2 max-sm:px-3 max-sm:text-xs"
                          onClick={reset}
                        >
                          Вернуться к своей работе{" "}
                          <Icon name="arrow" size={17} />
                        </button>
                      </>
                    ) : (
                      current && (
                        <>
                          <div className="mb-4 flex items-center justify-between gap-4 [&>span:first-child]:mb-0 max-md:gap-2.5 max-md:[&>span:last-child]:text-[8px]">
                            <span className="mb-4 block text-[10px] font-semibold tracking-[1.8px] text-[#718768] max-md:text-[9px]">
                              ВОПРОС {current.number} ИЗ 5
                            </span>
                            <span className="rounded border border-[#e1ead7] bg-[#f6f9f0] px-2 py-1 text-[10px] text-[#698652]">
                              Без таймера
                            </span>
                          </div>
                          <div className="mb-6 h-1 overflow-hidden rounded bg-[#e9f0e0] [&>span]:block [&>span]:h-full [&>span]:rounded [&>span]:bg-[#96b66b] [&>span]:transition-[width]">
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
                            <div className="rounded-lg border border-[#e4dfbf] bg-[#f9f6e8] p-4 text-xs text-[#73683d] [&_pre]:overflow-auto [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-[1.8] [&_pre]:whitespace-pre [&>span]:text-[10px]">
                              <strong>Если заменить выделенные строки:</strong>
                              <pre>
                                <code>{current.modifiedCode}</code>
                              </pre>
                              <span>Исходный код слева не изменён.</span>
                            </div>
                          )}
                          <form onSubmit={checkAnswer}>
                            <label className="mt-6 flex flex-col gap-3 text-[13px] font-semibold [&_textarea]:min-h-44 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#d9e4cc] [&_textarea]:bg-[#fbfcf8] [&_textarea]:p-4 [&_textarea]:text-sm [&_textarea]:leading-[1.8] [&_textarea]:font-normal [&_textarea]:text-[#34502c] [&_textarea:focus-visible]:outline-2 [&_textarea:focus-visible]:outline-offset-2 [&_textarea:focus-visible]:outline-[#8fac67] [&_textarea:read-only]:bg-[#f0f4e9]">
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
                            <div className="flex items-center justify-between gap-3 px-6 py-3.5 text-[11px] text-[#6e7d64] max-md:px-4 max-md:text-[10px]">
                              <span>Не нужно угадывать</span>
                              <span>{answer.length} / 2 000</span>
                            </div>
                            {error && (
                              <div
                                role="alert"
                                className="mx-6 mt-2.5 mb-4.5 rounded-lg border border-[#ebcdb8] bg-[#fff1e8] px-5 py-4 text-[13px] leading-[1.7] text-[#885d3f] max-md:mx-4"
                              >
                                {error}
                              </div>
                            )}
                            {result ? (
                              <>
                                <div
                                  className="mb-6 rounded-lg border border-[#dfebce] bg-[#eef5e4] p-5 text-sm text-[#567b3f] [&>span]:text-[10px]"
                                  role="status"
                                >
                                  <strong>{result.feedback.summary}</strong>
                                  <p className="text-sm leading-[1.85] whitespace-pre-wrap text-[#607650] [overflow-wrap:anywhere]">
                                    {result.feedback.explanation}
                                  </p>
                                  <span>
                                    {result.feedback.score}/10 · Оценка ИИ для
                                    самопроверки
                                  </span>
                                </div>
                                <button
                                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-3.5 rounded-lg border border-transparent bg-[#28573e] px-4.5 py-3 text-[13px] font-semibold text-[#f4f9ec] transition-colors enabled:hover:bg-[#3d704b] max-sm:gap-2 max-sm:px-3 max-sm:text-xs"
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
                                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-3.5 rounded-lg border border-transparent bg-[#28573e] px-4.5 py-3 text-[13px] font-semibold text-[#f4f9ec] transition-colors enabled:hover:bg-[#3d704b] max-sm:gap-2 max-sm:px-3 max-sm:text-xs"
                                  type="submit"
                                  disabled={busy || !answer.trim()}
                                >
                                  {busy ? "Проверяем объяснение…" : "Ответить"}
                                  <Icon name="arrow" size={17} />
                                </button>
                                {busy && (
                                  <button
                                    className="inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent py-3 text-xs text-[#5e7d4c] hover:underline"
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
                <p className="mt-4 text-[11px] leading-[1.8] text-[#758966]">
                  Код и текущая тренировка доступны до перезагрузки страницы.
                  Долговременное хранение появится после подключения аккаунта.
                </p>
              </>
            )}
          </>
        )}
        <footer className="mt-10 flex items-center justify-between gap-5 border-t border-[#dfe7d7] py-7.5 text-sm font-semibold text-[#5d774b] [&>span>span]:text-[#91ad71] [&_small]:ml-4 [&_small]:text-[11px] [&_small]:font-normal [&_small]:text-[#718465] [&>span:last-child]:text-[11px] [&>span:last-child]:font-normal [&>span:last-child]:text-[#788a6c] max-md:items-start max-md:[&_small]:mt-2 max-md:[&_small]:ml-0 max-md:[&_small]:block max-md:[&_small]:leading-[1.7] max-md:[&>span:last-child]:max-w-25 max-md:[&>span:last-child]:text-right max-md:[&>span:last-child]:leading-[1.7]">
          <span>
            CodeProof<span>.</span> <small>Учись объяснять свой код.</small>
          </span>
          <a href="/about" target="_blank" rel="noopener noreferrer">
            О себе ↗<span className="sr-only"> (в новой вкладке)</span>
          </a>
        </footer>
      </main>
    </div>
  );
}
