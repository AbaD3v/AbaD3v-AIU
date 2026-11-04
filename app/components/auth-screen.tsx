"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSession } from "./session-provider";
import { Icon } from "./ui-icon";
import s from "./learning.module.css";

export default function AuthScreen() {
  const { register, login } = useSession();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = mode === "register" ? register(name, email) : login(email);
    setError(problem ?? "");
  }

  return (
    <main className={s.welcome}>
      <header className={s.publicHeader}>
        <Link href="/" className={s.logo}>
          <Icon name="code" />
          CodeProof<span>.</span>
        </Link>
        <Link href="/about" className={s.textButton}>
          О проекте <Icon name="arrow" size={15} />
        </Link>
      </header>
      <div className={s.welcomeGrid}>
        <section className={s.introduction}>
          <span className={s.eyebrow}>
            <span className={s.dot} />
            ТВОЙ КОД. ТВОЁ ПОНИМАНИЕ.
          </span>
          <h1>
            Научись объяснять
            <br />
            <em>то, что написал.</em>
          </h1>
          <p>
            Работай с кодом и обсуждай его с помощником. Задавай вопросы,
            проверяй идеи и готовься к защите в своём темпе.
          </p>
          <div
            className={s.miniWorkspace}
            aria-label="Пример совместной работы с кодом"
          >
            <div className={s.miniCode}>
              <span>main.py</span>
              <pre>
                <code>
                  {
                    "total = 0\nfor number in numbers:\n    if number % 2 == 0:\n        total += number"
                  }
                </code>
              </pre>
              <small>
                <span className={s.dot} />
                Код и обсуждение рядом
              </small>
            </div>
            <div className={s.miniChat}>
              <span className={s.assistantBadge}>
                <Icon name="spark" size={16} /> CodeProof
              </span>
              <p>Почему здесь проверяется остаток от деления?</p>
              <span className={s.miniAnswer}>Чтобы выбрать чётные числа</span>
              <small>Ответь своими словами ↗</small>
            </div>
          </div>
          <div className={s.featureRow}>
            <span>
              <Icon name="code" size={16} />
              12 языков
            </span>
            <span>
              <Icon name="book" size={16} />
              Обучение в диалоге
            </span>
            <span>
              <Icon name="clock" size={16} />В своём темпе
            </span>
          </div>
        </section>
        <section className={s.authCard} aria-labelledby="auth-title">
          <span className={s.badge}>Учебный режим</span>
          <h2 id="auth-title">
            {mode === "register" ? "Твоя рабочая область" : "С возвращением"}
          </h2>
          <p>
            {mode === "register"
              ? "Создай профиль, чтобы сохранять код, диалоги и настройки обучения."
              : "Войди в профиль, созданный в этом браузере, и продолжи занятие."}
          </p>
          <div
            className={s.segmented}
            role="group"
            aria-label="Вход или регистрация"
          >
            <button
              type="button"
              aria-pressed={mode === "register"}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Регистрация
            </button>
            <button
              type="button"
              aria-pressed={mode === "login"}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Войти
            </button>
          </div>
          <form onSubmit={submit} className={s.authForm}>
            {mode === "register" && (
              <label>
                Как тебя зовут
                <input
                  autoComplete="given-name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Твоё имя"
                  required
                  maxLength={60}
                />
              </label>
            )}
            <label>
              Электронная почта
              <input
                type="email"
                autoComplete="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                maxLength={120}
              />
            </label>
            {error && (
              <p className={s.error} role="alert">
                {error}
              </p>
            )}
            <button className={s.primary} type="submit">
              {mode === "register"
                ? "Создать учебный профиль"
                : "Войти в профиль"}
              <Icon name="arrow" size={17} />
            </button>
          </form>
          <p className={s.localNote}>
            Демонстрация входа без пароля. Профиль хранится в этом браузере.
            Полноценная авторизация и ИИ будут подключены позже.
          </p>
        </section>
      </div>
      <footer className={s.publicFooter}>
        <span>CodeProof · Astana International University</span>
        <span>Место, где код становится понятнее.</span>
      </footer>
    </main>
  );
}
