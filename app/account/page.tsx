"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { PageHeading } from "@/app/components/sql/ui";
import {
  registerStudent,
  setupDemoAdmin,
  signIn,
  signOut,
  useAccounts,
} from "@/app/lib/accounts/store";

type Mode = "login" | "register" | "setup";

export default function AccountPage() {
  const accounts = useAccounts();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const setup = mode === "setup" && !accounts.hasAdmin;
  const registering = mode === "register" || setup;

  function switchMode(next: Mode) {
    setMode(next);
    setPassword("");
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (registering) {
        const create = setup ? setupDemoAdmin : registerStudent;
        const createdLogin = await create({ name, login, password });
        setLogin(createdLogin);
        switchMode("login");
        setNotice(
          setup
            ? "Демо администратор создан. Войдите с выбранным паролем."
            : "Аккаунт студента создан. Войдите с выбранным паролем.",
        );
      } else {
        const role = await signIn(login, password);
        router.replace(role === "admin" ? "/admin/" : "/profile/");
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось выполнить действие.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page account-page">
      <PageHeading
        eyebrow="CODEPROOF SQL"
        title="Аккаунт практикума"
        description="Учебные аккаунты и прогресс хранятся в этом браузере."
      />
      {!accounts.ready ? (
        <p role="status">Загружаем аккаунты…</p>
      ) : accounts.active ? (
        <section className="account-card account-signed-in">
          <span className="account-icon">
            {accounts.active.role === "admin" ? (
              <ShieldCheck size={24} />
            ) : (
              <UserRound size={24} />
            )}
          </span>
          <h2>{accounts.active.name}</h2>
          <p>
            {accounts.active.role === "admin" ? "Администратор" : "Студент"} ·{" "}
            {accounts.active.login}
          </p>
          <div className="account-actions">
            <Link
              className="button button-primary"
              href={accounts.active.role === "admin" ? "/admin/" : "/profile/"}
            >
              {accounts.active.role === "admin"
                ? "Админ-панель"
                : "Мой прогресс"}
              <ArrowRight size={16} />
            </Link>
            <button
              className="button button-secondary"
              onClick={() => {
                try {
                  signOut();
                } catch {
                  setError(
                    "Не удалось завершить вход. Закройте вкладку и откройте сайт снова.",
                  );
                }
              }}
            >
              <LogOut size={16} />
              Выйти
            </button>
          </div>
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
        </section>
      ) : (
        <div className="account-grid">
          <section
            className="account-card"
            aria-labelledby="account-form-title"
          >
            <div className="account-switch" aria-label="Действие с аккаунтом">
              <button
                type="button"
                aria-pressed={!registering}
                disabled={busy}
                onClick={() => switchMode("login")}
              >
                Вход
              </button>
              <button
                type="button"
                aria-pressed={mode === "register"}
                disabled={busy}
                onClick={() => switchMode("register")}
              >
                Регистрация студента
              </button>
            </div>
            <h2 id="account-form-title">
              {setup
                ? "Создать демо администратора"
                : registering
                  ? "Регистрация студента"
                  : "Войти в аккаунт"}
            </h2>
            {setup && (
              <p className="account-help">
                Создайте отдельный логин и учебный пароль. В этом браузере
                доступен один аккаунт администратора.
              </p>
            )}
            <form className="account-form" onSubmit={submit}>
              {registering && (
                <label>
                  Имя
                  <input
                    autoComplete="name"
                    required
                    maxLength={40}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
              )}
              <label>
                Логин
                <input
                  autoComplete="username"
                  required
                  maxLength={32}
                  autoCapitalize="none"
                  spellCheck={false}
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                />
              </label>
              <label>
                Пароль
                <input
                  type="password"
                  autoComplete={
                    registering ? "new-password" : "current-password"
                  }
                  required
                  minLength={registering ? 8 : undefined}
                  maxLength={64}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-describedby={registering ? "password-help" : undefined}
                />
              </label>
              {registering && (
                <p className="account-help" id="password-help">
                  От 8 до 64 символов. Используйте отдельный пароль для
                  демонстрации.
                </p>
              )}
              {(error || accounts.error) && (
                <p className="account-error" role="alert">
                  {error || accounts.error}
                </p>
              )}
              {notice && (
                <p className="notice-banner" role="status">
                  {notice}
                </p>
              )}
              <button
                className="button button-primary"
                disabled={busy || !!accounts.error}
              >
                {busy
                  ? "Подождите…"
                  : setup
                    ? "Создать администратора"
                    : registering
                      ? "Зарегистрироваться"
                      : "Войти"}
                <ArrowRight size={16} />
              </button>
            </form>
          </section>
          <aside
            className="account-card account-guide"
            aria-labelledby="account-guide-title"
          >
            <span className="account-icon">
              <ShieldCheck size={24} />
            </span>
            <h2 id="account-guide-title">Роли в практикуме</h2>
            <p>
              <strong>Студент</strong> решает задания и ведёт свой прогресс.
            </p>
            <p>
              <strong>Администратор</strong> видит прогресс студентов и
              управляет их входом.
            </p>
            {!accounts.hasAdmin && !accounts.error && !setup && (
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => {
                  switchMode("setup");
                  setName("");
                  setLogin("");
                }}
              >
                Настроить демо администратора
              </button>
            )}
            <small>
              Аккаунты работают локально для демонстрации ролей. На другом
              устройстве список аккаунтов будет отдельным.
            </small>
            <Link className="text-link" href="/">
              Открыть практикум как гость
              <ArrowRight size={15} />
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
