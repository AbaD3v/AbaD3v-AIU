"use client";
import { useSiteNames } from "@/app/lib/site-names/store";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { PageHeading } from "@/app/components/sql/ui";
import { flushStudy } from "@/app/lib/sql/store";
import {
  cloudEnabled,
  dismissEmailConfirmation,
  readEmailConfirmation,
} from "@/app/lib/supabase/client";
import {
  registerStudent,
  registerCloudStudent,
  refreshAccounts,
  setupDemoAdmin,
  signIn,
  signOut,
  useAccounts,
  type Role,
} from "@/app/lib/accounts/store";

type Mode = "login" | "register" | "setup";

function accountHome(role: Role) {
  return role === "admin" ? "/admin/" : "/profile/";
}

export default function AccountPage() {
  const name = useSiteNames();
  const accounts = useAccounts();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const setup = !cloudEnabled && mode === "setup" && !accounts.hasAdmin;
  const registering = mode === "register" || setup;
  const activeRole = accounts.active?.role;
  const accessDenied = accounts.accessDenied;

  useEffect(() => {
    if (!cloudEnabled || !accounts.ready) return;
    let cancelled = false;
    void readEmailConfirmation().then((result) => {
      if (cancelled || !result) return;
      if (result === "confirmed" && accounts.error && !activeRole) return;
      dismissEmailConfirmation();
      if (result === "confirmed" && activeRole) {
        router.replace(accountHome(activeRole));
      } else if (!accessDenied) {
        setError(result === "expired"
          ? "Ссылка истекла или уже использована. Если почта подтверждена, войдите. Иначе повторите регистрацию."
          : "Не удалось подтвердить почту по этой ссылке. Попробуйте войти или повторите регистрацию.");
      }
    }).catch(() => {
      if (!cancelled) setError("Не удалось проверить ссылку. Обновите страницу и попробуйте ещё раз.");
    });
    return () => { cancelled = true; };
  }, [accounts.ready, accounts.error, activeRole, accessDenied, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setPassword("");
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || accounts.error) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (registering) {
        if (cloudEnabled) {
          const created = await registerCloudStudent({ name: displayName, login, password });
          setLogin(created.email);
          switchMode("login");
          if (created.confirmationRequired) {
            setNotice("Откройте ссылку из письма, чтобы подтвердить адрес.");
          } else {
            router.replace(accountHome(created.role));
          }
          return;
        }
        const create = setup ? setupDemoAdmin : registerStudent;
        const createdLogin = await create({ name: displayName, login, password });
        setLogin(createdLogin);
        switchMode("login");
        setNotice(
          setup
            ? "Демо администратор создан. Войдите с выбранным паролем."
            : "Аккаунт студента создан. Войдите с выбранным паролем.",
        );
      } else {
        const role = await signIn(login, password);
        router.replace(accountHome(role));
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
        title={name("account.heading")}
        description={cloudEnabled
          ? "Войдите, чтобы сохранять прогресс и продолжать практику на другом устройстве."
          : "Учебные аккаунты и прогресс хранятся в этом браузере."}
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
            {accounts.active.role === "admin" ? name("common.roleAdmin") : name("common.roleStudent")} ·{" "}
            {accounts.active.login}
          </p>
          <div className="account-actions">
            <Link
              className="button button-primary"
              href={accountHome(accounts.active.role)}
            >
              {accounts.active.role === "admin"
                ? name("nav.admin")
                : name("nav.profile")}
              <ArrowRight size={16} />
            </Link>
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await flushStudy();
                  await signOut();
                } catch (error) {
                  setError(
                    error instanceof Error ? error.message : "Не удалось завершить сеанс.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <LogOut size={16} />
              {name("account.signOut")}
            </button>
          </div>
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          {accounts.temporarySession && (
            <p className="account-help">
              Вход действует до обновления страницы.
            </p>
          )}
        </section>
      ) : (
        <div className="account-grid">
          <section
            className="account-card"
            aria-labelledby="account-form-title"
          >
            <div className="account-switch" aria-label={name("account.mode")}>
              <button
                type="button"
                aria-pressed={!registering}
                disabled={busy}
                onClick={() => switchMode("login")}
              >
                {name("account.signInTab")}
              </button>
              <button
                type="button"
                aria-pressed={mode === "register"}
                disabled={busy}
                onClick={() => switchMode("register")}
              >
                {name("account.registerTab")}
              </button>
            </div>
            <h2 id="account-form-title">
              {setup
                ? name("account.setupHeading")
                : registering
                  ? name("account.registerTab")
                  : name("account.signInHeading")}
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
                  {name("account.name")}
                  <input
                    autoComplete="name"
                    required
                    maxLength={40}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </label>
              )}
              <label>
                {name(cloudEnabled ? "account.email" : "account.login")}
                <input
                  type={cloudEnabled ? "email" : "text"}
                  autoComplete="username"
                  required
                  maxLength={cloudEnabled ? 254 : 32}
                  autoCapitalize="none"
                  spellCheck={false}
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                />
              </label>
              <label>
                {name("account.password")}
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
                  От 8 до 64 символов.
                </p>
              )}
              {(error || accounts.error || accessDenied) && (
                <p className="account-error" role="alert">
                  {error || accounts.error || accessDenied}
                </p>
              )}
              {accounts.error && (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={async () => {
                    setError("");
                    try { await refreshAccounts(); }
                    catch (error) { setError(error instanceof Error ? error.message : "Попробуйте ещё раз."); }
                  }}
                >
                  {name("account.retryStorage")}
                </button>
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
                  ? name("account.wait")
                  : setup
                    ? name("account.createAdmin")
                    : registering
                      ? name("account.register")
                      : name("account.signIn")}
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
            <h2 id="account-guide-title">{name("account.roles")}</h2>
            <p>
              <strong>{name("common.roleStudent")}</strong> решает задания и ведёт свой прогресс.
            </p>
            <p>
              <strong>{name("common.roleAdmin")}</strong> видит прогресс студентов и
              управляет их входом.
            </p>
            {!cloudEnabled && !accounts.hasAdmin && !setup && (
              <button
                className="button button-secondary"
                disabled={busy || !!accounts.error}
                onClick={() => {
                  switchMode("setup");
                  setDisplayName("");
                  setLogin("");
                }}
              >
                {name("account.setup")}
              </button>
            )}
            {accounts.temporarySession && (
              <small>Вход действует до обновления страницы.</small>
            )}
            {!cloudEnabled && <small>
              Аккаунты работают локально для демонстрации ролей. На другом
              устройстве список аккаунтов будет отдельным.
            </small>}
            <Link className="text-link" href="/">
              {name("account.guestPractice")}
              <ArrowRight size={15} />
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
