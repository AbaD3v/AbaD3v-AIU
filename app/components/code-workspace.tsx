"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  examples,
  languages,
  sampleKind,
  type Language,
} from "../lib/languages";
import {
  checkQuestion,
  createLesson,
  inferIntent,
  loadWorkspace,
  makeQuestion,
  message,
  reply,
  workspaceKey,
  type ChatIntent,
  type Lesson,
  type LineRange,
  type Message,
} from "../lib/workspace";
import AuthScreen from "./auth-screen";
import CodeEditor from "./code-editor";
import LearnerOnboarding from "./learner-onboarding";
import QuestionCard from "./question-card";
import { useSession, type Account } from "./session-provider";
import { Icon } from "./ui-icon";
import s from "./learning.module.css";

function WorkspaceView({ account }: { account: Account }) {
  const [initial] = useState(() =>
    loadWorkspace(account.id, account.languages[0] ?? "JavaScript"),
  );
  const [workspace, setWorkspace] = useState(initial.workspace);
  const [saved, setSaved] = useState({
    snapshot: initial.workspace,
    error: "",
  });
  const [notice, setNotice] = useState(initial.notice);
  const [selected, setSelected] = useState<LineRange | null>(null);
  const [questionOpen, setQuestionOpen] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<"code" | "chat">("code");
  const [copied, setCopied] = useState(false);
  const transcript = useRef<HTMLDivElement>(null);
  const chatInput = useRef<HTMLTextAreaElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lesson = workspace.lessons.find(
    (item) => item.id === workspace.activeId,
  )!;
  const language = languages.find((item) => item.name === lesson.language)!;
  const isSample = sampleKind(lesson.code, lesson.language);
  const chatFull = lesson.messages.length >= 200;

  useEffect(() => {
    const serialized = JSON.stringify(workspace);
    function persist() {
      try {
        localStorage.setItem(workspaceKey(account.id), serialized);
        return "";
      } catch {
        return "Не удалось сохранить занятие. Скопируй код перед закрытием страницы.";
      }
    }
    const timer = setTimeout(
      () => setSaved({ snapshot: workspace, error: persist() }),
      180,
    );
    window.addEventListener("pagehide", persist);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, [workspace, account.id]);

  useEffect(() => {
    const element = transcript.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lesson.id, lesson.messages.length]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  function updateLesson(change: Partial<Lesson>) {
    setWorkspace((previous) => ({
      ...previous,
      lessons: previous.lessons.map((item) => {
        if (item.id !== previous.activeId) return item;
        return { ...item, ...change };
      }),
    }));
  }

  function updateCode(code: string) {
    updateLesson({
      code,
      title:
        lesson.title === "Новое занятие" && code.trim()
          ? `Код на ${lesson.language}`
          : lesson.title,
    });
    setSelected(null);
  }

  function chooseLanguage(next: Language) {
    updateLesson({
      language: next,
      code: isSample ? examples[next] : lesson.code,
      lastEdit: null,
    });
    setSelected(null);
  }

  function loadExample() {
    if (
      lesson.code.trim() &&
      lesson.code !== examples[lesson.language] &&
      !window.confirm(
        "Заменить код учебным примером? Последнюю замену можно будет отменить.",
      )
    )
      return;
    updateLesson({
      code: examples[lesson.language],
      title: "Сумма чётных чисел",
      lastEdit: { before: lesson.code, after: examples[lesson.language] },
    });
    setSelected(null);
  }

  function newLesson() {
    if (workspace.lessons.length >= 20) {
      setNotice(
        "Сохранено 20 занятий. Удали ненужное в списке занятий, чтобы создать новое.",
      );
      return;
    }
    const created = createLesson(lesson.language);
    setWorkspace((previous) => ({
      ...previous,
      activeId: created.id,
      lessons: [...previous.lessons, created],
    }));
    setSelected(null);
    setQuestionOpen(true);
    setMobilePanel("code");
  }

  function deleteLesson(id: string) {
    if (!window.confirm("Удалить это занятие вместе с кодом и диалогом?"))
      return;
    const remaining = workspace.lessons.filter((item) => item.id !== id);
    if (!remaining.length) remaining.push(createLesson(lesson.language));
    setWorkspace({
      version: 2,
      activeId:
        workspace.activeId === id ? remaining[0].id : workspace.activeId,
      lessons: remaining,
    });
    setSelected(null);
  }

  function send(text: string, requestedIntent?: ChatIntent) {
    const input = text.trim();
    if (!input || chatFull) return;
    const intent = requestedIntent ?? inferIntent(input);
    const additions: Message[] = [
      message(
        "user",
        input,
        selected ? { range: selected, sourceCode: lesson.code } : {},
      ),
    ];
    let question = lesson.question;
    if (intent === "question" && lesson.code.trim()) {
      if (!question || question.feedback !== null)
        question = makeQuestion(lesson);
      additions.push(
        message(
          "assistant",
          "Открыл вопрос в карточке ниже. Можешь отвечать там, а здесь — уточнять непонятное или просить подсказку.",
          { range: question.range, sourceCode: question.code },
        ),
      );
      setQuestionOpen(true);
      if (question.code === lesson.code) setSelected(question.range);
    } else {
      additions.push(reply(lesson, intent, account.level, selected));
      if (intent === "hint" && question)
        question = { ...question, hintUsed: true };
    }
    updateLesson({
      messages: [...lesson.messages, ...additions],
      draft: "",
      question,
    });
    setMobilePanel("chat");
    chatInput.current?.focus({ preventScroll: true });
  }

  function submitChat(event: FormEvent) {
    event.preventDefault();
    send(lesson.draft);
  }

  function submitAnswer() {
    const question = lesson.question;
    if (
      !question ||
      question.feedback !== null ||
      (question.kind !== "code" && !question.answer.trim()) ||
      chatFull
    )
      return;
    const feedback = checkQuestion(question, lesson.code);
    updateLesson({
      question: { ...question, feedback },
      answered: lesson.answered + 1,
      messages: [
        ...lesson.messages,
        message(
          "user",
          `${question.text}\n\nМой ответ — ${question.kind === "code" ? "изменение в редакторе" : question.answer}`,
          {
            kind: "answer",
            range: question.range,
            sourceCode: question.kind === "code" ? lesson.code : question.code,
          },
        ),
        message(
          "assistant",
          feedback +
            (question.hintUsed
              ? "\n\nВ этой попытке использована подсказка."
              : ""),
        ),
      ],
    });
  }

  function applyProposal(item: Message) {
    if (!item.proposal || lesson.code !== item.proposal.before) return;
    updateLesson({ code: item.proposal.after, lastEdit: item.proposal });
    setSelected(null);
  }

  function undo() {
    if (!lesson.lastEdit || lesson.code !== lesson.lastEdit.after) return;
    updateLesson({ code: lesson.lastEdit.before, lastEdit: null });
    setSelected(null);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(lesson.code);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice(
        "Копирование недоступно. Выдели текст в редакторе и скопируй вручную.",
      );
    }
  }

  return (
    <main className={s.workspace}>
      <a className={s.skipLink} href="#chat-input">
        К диалогу
      </a>
      <header className={s.workspaceHeader}>
        <Link href="/" className={s.logo}>
          CodeProof<span>.</span>
        </Link>
        <span className={s.headerDivider} />
        <span className={s.headerCaption}>Учебная мастерская</span>
        <details className={s.demoInfo}>
          <summary className={s.badge}>
            <span className={s.dot} />
            Демо-режим
          </summary>
          <div>
            Профиль и занятия сохраняются в этом браузере. Для 12 языков
            подготовлены учебные примеры, реплики и вопросы. Свободный диалог с
            ИИ и серверный вход будут доступны после подключения бэкенда.
          </div>
        </details>
        <Link href="/profile" className={s.accountName}>
          {account.name}
          <Icon name="user" size={16} />
        </Link>
      </header>
      <div className={s.workspaceTitle}>
        <div>
          <span className={s.eyebrow}>ПРОСТРАНСТВО ДЛЯ ТВОИХ ИДЕЙ</span>
          <h1>
            Разберём твой код<span>.</span>
          </h1>
          <p>Пиши, спрашивай и проверяй себя — всё в одном месте.</p>
        </div>
        <div className={s.lessonTools}>
          <details className={s.lessonHistory}>
            <summary className={s.secondary}>
              <Icon name="clock" size={15} />
              Занятия <span>{workspace.lessons.length}</span>
            </summary>
            <div className={s.historyList}>
              <strong>Твои занятия</strong>
              {[...workspace.lessons].reverse().map((item) => (
                <div key={item.id}>
                  <button
                    aria-current={lesson.id === item.id ? "true" : undefined}
                    onClick={(event) => {
                      setWorkspace((previous) => ({
                        ...previous,
                        activeId: item.id,
                      }));
                      setSelected(null);
                      setQuestionOpen(true);
                      const details = event.currentTarget.closest("details");
                      if (details) details.open = false;
                    }}
                  >
                    <span>{item.title}</span>
                    <small>
                      {item.language} · ответов {item.answered}
                    </small>
                  </button>
                  <button
                    className={s.iconButton}
                    aria-label={`Удалить занятие ${item.title}`}
                    onClick={() => deleteLesson(item.id)}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </details>
          <button className={s.primary} onClick={newLesson}>
            <span aria-hidden="true">+</span>Новое занятие
          </button>
        </div>
      </div>
      {(notice || saved.error) && (
        <div className={s.notice} role="alert">
          {saved.error || notice}
          {!saved.error && (
            <button
              aria-label="Скрыть уведомление"
              onClick={() => setNotice("")}
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>
      )}
      <div
        className={s.mobileTabs}
        role="group"
        aria-label="Панель рабочей области"
      >
        <button
          aria-pressed={mobilePanel === "code"}
          onClick={() => setMobilePanel("code")}
        >
          <Icon name="code" size={17} />
          Код
        </button>
        <button
          aria-pressed={mobilePanel === "chat"}
          onClick={() => setMobilePanel("chat")}
        >
          <Icon name="spark" size={17} />
          Диалог{" "}
          {lesson.question && !lesson.question.feedback && (
            <span className={s.dot} />
          )}
        </button>
      </div>
      <div className={s.workbench}>
        <section
          className={`${s.editorPanel} ${mobilePanel !== "code" ? s.mobileHidden : ""}`}
          aria-label="Работа с кодом"
        >
          <div className={s.editorToolbar}>
            <span>
              <Icon name="code" size={16} />
              main.{language.extension}
            </span>
            <select
              aria-label="Язык кода"
              value={lesson.language}
              onChange={(event) =>
                chooseLanguage(event.target.value as Language)
              }
            >
              {languages.map((item) => (
                <option key={item.name}>{item.name}</option>
              ))}
            </select>
            <button onClick={loadExample}>Учебный пример</button>
          </div>
          <div className={s.editorSubbar}>
            <span>{isSample ? "Сумма выбранных чисел" : "Твой код"}</span>
            <div>
              <button
                onClick={undo}
                disabled={
                  !lesson.lastEdit || lesson.code !== lesson.lastEdit.after
                }
                aria-label="Отменить замену кода"
                title="Отменить замену"
              >
                <Icon name="repeat" size={15} />
              </button>
              <button onClick={copyCode} aria-label="Скопировать код">
                {copied ? "Скопировано" : "Копировать"}
              </button>
            </div>
          </div>
          <CodeEditor
            code={lesson.code}
            onChange={updateCode}
            highlight={selected}
            onSelection={setSelected}
          />
          <div className={s.editorFooter}>
            <span>
              <span className={s.dot} />
              {saved.error
                ? "Не сохранено"
                : saved.snapshot === workspace
                  ? "Сохранено в браузере"
                  : "Сохраняем…"}
            </span>
            <span>
              {lesson.code.split("\n").length} строк · {lesson.code.length} / 20
              000
            </span>
          </div>
          <div className={s.editorHelp} id="editor-help">
            <Icon name="spark" size={16} />
            <span>
              Выдели строки, чтобы обсудить конкретный фрагмент. Tab — отступ,
              Shift+Tab — выход из редактора.
            </span>
          </div>
        </section>
        <section
          className={`${s.chatPanel} ${mobilePanel !== "chat" ? s.mobileHidden : ""}`}
          aria-label="Диалог с помощником"
        >
          <div className={s.chatHeader}>
            <span className={s.assistantIcon}>
              <Icon name="spark" size={19} />
            </span>
            <div>
              <h2>Разбираемся вместе</h2>
              <p>CodeProof · учебный помощник</p>
            </div>
            <span className={s.chatStatus}>Демо</span>
          </div>
          <div
            className={s.transcript}
            ref={transcript}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label="История диалога"
          >
            <div className={s.chatDate}>
              ТВОЁ ЗАНЯТИЕ · {lesson.language.toUpperCase()}
            </div>
            {lesson.messages.map((item) => (
              <article
                className={`${s.message} ${item.role === "user" ? s.userMessage : s.assistantMessage}`}
                key={item.id}
              >
                <span className={s.messageAuthor}>
                  {item.role === "user" ? (
                    "Ты"
                  ) : (
                    <>
                      <Icon name="spark" size={13} /> CodeProof
                    </>
                  )}
                  {item.kind === "answer" && <small>Ответ на вопрос</small>}
                </span>
                <p>{item.text}</p>
                {item.range && (
                  <button
                    className={s.codeReference}
                    disabled={item.sourceCode !== lesson.code}
                    onClick={() => {
                      setSelected(item.range!);
                      setMobilePanel("code");
                    }}
                  >
                    <Icon name="code" size={13} />
                    Строки {item.range.start}–{item.range.end}
                    {item.sourceCode !== lesson.code
                      ? " · предыдущая версия"
                      : " ↗"}
                  </button>
                )}
                {item.range && item.sourceCode !== lesson.code && (
                  <details className={s.oldCode}>
                    <summary>Посмотреть прежний фрагмент</summary>
                    <pre>
                      {item.sourceCode
                        ?.split("\n")
                        .slice(item.range.start - 1, item.range.end)
                        .join("\n")}
                    </pre>
                  </details>
                )}
                {item.proposal && (
                  <div className={s.proposal}>
                    <span>ПРЕДЛОЖЕНИЕ ДЛЯ РЕДАКТОРА</span>
                    <pre>
                      <del>
                        {item.proposal.before
                          .split("\n")
                          .find((line) => line.includes("% 2"))}
                      </del>
                      <ins>
                        {item.proposal.after
                          .split("\n")
                          .find((line) => line.includes("% 2"))}
                      </ins>
                    </pre>
                    <button
                      className={s.secondary}
                      disabled={lesson.code !== item.proposal.before}
                      onClick={() => applyProposal(item)}
                    >
                      {lesson.code === item.proposal.after
                        ? "Уже в редакторе"
                        : lesson.code !== item.proposal.before
                          ? "Код уже изменён"
                          : "Применить изменение"}
                      <Icon name="arrow" size={14} />
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
          {lesson.question &&
            (questionOpen ? (
              <QuestionCard
                disabled={chatFull}
                question={lesson.question}
                codeChanged={lesson.question.code !== lesson.code}
                onUpdate={(answer) =>
                  updateLesson({ question: { ...lesson.question!, answer } })
                }
                onSubmit={submitAnswer}
                onHint={() =>
                  updateLesson({
                    question: { ...lesson.question!, hintUsed: true },
                  })
                }
                onClose={() => {
                  setQuestionOpen(false);
                  chatInput.current?.focus();
                }}
                onRetry={() =>
                  updateLesson({
                    question: {
                      ...lesson.question!,
                      id: crypto.randomUUID(),
                      feedback: null,
                      answer: "",
                      hintUsed: false,
                    },
                  })
                }
              />
            ) : (
              <button
                className={s.restoreQuestion}
                onClick={() => setQuestionOpen(true)}
              >
                <Icon name="book" size={15} />
                {lesson.question.feedback
                  ? "Посмотреть ответ"
                  : "Вопрос ждёт твоего ответа"}
                <Icon name="chevron" size={14} />
              </button>
            ))}
          <div className={s.composerArea}>
            <div className={s.quickActions}>
              <button
                disabled={chatFull}
                onClick={() => send("Объясни этот код", "explain")}
              >
                Объясни код
              </button>
              <button
                disabled={chatFull}
                onClick={() => send("Задай мне вопрос", "question")}
              >
                Проверь меня
              </button>
              <button
                disabled={chatFull}
                onClick={() => send("Предложи изменение кода", "change")}
              >
                Что если…
              </button>
            </div>
            {selected && (
              <div className={s.selectedContext}>
                <Icon name="code" size={13} />В контексте строки{" "}
                {selected.start}–{selected.end}
                <button
                  aria-label="Убрать выделение из контекста"
                  onClick={() => setSelected(null)}
                >
                  <Icon name="close" size={13} />
                </button>
              </div>
            )}
            <form className={s.composer} onSubmit={submitChat}>
              <label htmlFor="chat-input" className={s.srOnly}>
                Сообщение помощнику
              </label>
              <textarea
                id="chat-input"
                ref={chatInput}
                rows={2}
                placeholder="Спроси о коде или попроси подсказку…"
                value={lesson.draft}
                onChange={(event) =>
                  updateLesson({ draft: event.target.value })
                }
                maxLength={2000}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    send(lesson.draft);
                  }
                }}
              />
              <button
                type="submit"
                className={s.sendButton}
                aria-label="Отправить сообщение"
                disabled={!lesson.draft.trim() || chatFull}
              >
                <Icon name="arrow" size={19} />
              </button>
            </form>
            <div className={s.composerFootnote}>
              <span>
                {chatFull
                  ? "Диалог заполнен. Создай новое занятие."
                  : "Enter — отправить · Shift+Enter — новая строка"}
              </span>
              <span>{lesson.draft.length}/2000</span>
            </div>
          </div>
        </section>
      </div>
      <footer className={s.workspaceFooter}>
        <span>Понимание начинается с хорошего вопроса.</span>
        <Link href="/profile">
          Настройки обучения <Icon name="arrow" size={13} />
        </Link>
      </footer>
    </main>
  );
}

export default function CodeWorkspace() {
  const { account } = useSession();
  if (!account) return <AuthScreen />;
  if (!account.preferencesSet) return <LearnerOnboarding />;
  return <WorkspaceView key={account.id} account={account} />;
}
