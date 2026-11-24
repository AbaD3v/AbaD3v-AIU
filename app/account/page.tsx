"use client";
import { useSiteNames } from "@/app/lib/site-names/store";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LogOut, ShieldCheck, UserRound } from "lucide-react";
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
  resendCloudConfirmation,
  requestCloudPasswordReset,
  updateCloudPassword,
  refreshAccounts,
  setupDemoAdmin,
  signIn,
  signOut,
  useAccounts,
  type Role,
} from "@/app/lib/accounts/store";

type Mode = "login" | "register" | "setup" | "resend" | "forgot";

function accountHome(role: Role) {
  return role === "admin" ? "/admin/" : "/profile/";
}

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  newPassword: boolean;
  descriptionId?: string;
};

function PasswordField({ label, value, onChange, disabled, newPassword, descriptionId }: PasswordFieldProps) {
  const inputId = useId();
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  return (
    <>
      <label>
        {label}
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          autoComplete={newPassword ? "new-password" : "current-password"}
          autoCapitalize="none"
          spellCheck={false}
          disabled={disabled}
          required
          minLength={newPassword ? 8 : undefined}
          maxLength={64}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))}
          onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
          onBlur={() => setCapsLock(false)}
          aria-describedby={descriptionId}
        />
      </label>
      <button
        type="button"
        className="button button-secondary"
        disabled={disabled}
        aria-controls={inputId}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        {visible ? "Скрыть пароль" : "Показать пароль"}
      </button>
      {capsLock && <p className="account-help" role="status">Включён Caps Lock.</p>}
    </>
  );
}

export default function AccountPage() {
  const name = useSiteNames();
  const accounts = useAccounts();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const emailField = useRef<HTMLInputElement>(null);
  const setup = !cloudEnabled && mode === "setup" && !accounts.hasAdmin;
  const registering = mode === "register" || setup;
  const resending = cloudEnabled && mode === "resend";
  const forgotPassword = cloudEnabled && mode === "forgot";
  const requestingLink = resending || forgotPassword;
  const activeRole = accounts.active?.role;
  const activeId = accounts.active?.id;
  const resetting = Boolean(resetFor && resetFor === activeId);
  const accessDenied = mode === "login" ? accounts.accessDenied : undefined;

  useEffect(() => {
    if (!cloudEnabled || !accounts.ready) return;
    let cancelled = false;
    void readEmailConfirmation().then((result) => {
      if (cancelled) return;
      if (!result) {
        setResetFor(null);
        return;
      }
      if ((result === "confirmed" || result === "recovery") && accounts.error && !activeRole) return;
      dismissEmailConfirmation();
      if (result === "recovery" && activeId) {
        setResetFor(activeId);
        return;
      }
      if (result === "confirmed" && activeRole) {
        router.replace(accountHome(activeRole));
      } else if (!accessDenied) {
        setError(result === "expired"
          ? "Ссылка истекла или уже использована. Запросите новую ссылку со страницы входа."
          : "Не удалось открыть ссылку из письма. Запросите новую ссылку со страницы входа.");
      }
    }).catch(() => {
      if (!cancelled) setError("Не удалось проверить ссылку. Обновите страницу и попробуйте ещё раз.");
    });
    return () => { cancelled = true; };
  }, [accounts.ready, accounts.error, activeRole, activeId, accessDenied, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setPassword("");
    setPasswordAgain("");
    setError("");
    setNotice("");
  }

  function openLinkForm(next: "resend" | "forgot") {
    switchMode(next);
    emailField.current?.focus();
  }

  async function cancelReset() {
    setBusy(true);
    setError("");
    try {
      await signOut();
      setResetFor(null);
      switchMode("login");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось завершить восстановление.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || (accounts.error && !resetting)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (resetting) {
        if (password !== passwordAgain) {
          setError("Пароли не совпадают.");
          return;
        }
        await updateCloudPassword(password);
        setResetFor(null);
        switchMode("login");
        setNotice("Пароль обновлён.");
        return;
      }
      if (requestingLink) {
        if (forgotPassword) {
          await requestCloudPasswordReset(login);
        } else {
          await resendCloudConfirmation(login);
        }
        switchMode("login");
        setNotice(forgotPassword
          ? "Если для этого адреса есть аккаунт, проверьте почту и папку «Спам»."
          : "Если этот адрес зарегистрирован и ещё не подтверждён, проверьте почту и папку «Спам».");
        return;
      }
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
      ) : accounts.active && !resetting ? (
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
          {notice && <p className="notice-banner" role="status">{notice}</p>}
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
            {!resetting && <div className="account-switch" aria-label={name("account.mode")}>
              <button
                type="button"
                aria-pressed={mode === "login"}
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
            </div>}
            <h2 id="account-form-title">
              {resetting ? "Новый пароль"
                : forgotPassword ? "Восстановление пароля"
                  : resending ? "Новая ссылка подтверждения"
                    : setup ? name("account.setupHeading")
                      : registering ? name("account.registerTab") : name("account.signInHeading")}
            </h2>
            {setup && (
              <p className="account-help">
                Создайте отдельный логин и учебный пароль. В этом браузере
                доступен один аккаунт администратора.
              </p>
            )}
            {requestingLink && <p className="account-help">Введите адрес, который указали при регистрации.</p>}
            {resetting && <p className="account-help">Аккаунт {accounts.active?.login}</p>}
            <form className="account-form" onSubmit={submit}>
              {registering && !resetting && (
                <label>
                  {name("account.name")}
                  <input
                    autoComplete="name"
                    disabled={busy}
                    required
                    maxLength={40}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </label>
              )}
              {!resetting && <label>
                {name(cloudEnabled ? "account.email" : "account.login")}
                <input
                  ref={emailField}
                  type={cloudEnabled ? "email" : "text"}
                  autoComplete={requestingLink ? "email" : "username"}
                  disabled={busy}
                  required
                  maxLength={cloudEnabled ? 254 : 32}
                  autoCapitalize="none"
                  spellCheck={false}
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                />
              </label>}
              {(!requestingLink || resetting) && (
                <PasswordField
                  key={resetting ? "reset" : mode}
                  label={resetting ? "Новый пароль" : name("account.password")}
                  value={password}
                  onChange={setPassword}
                  disabled={busy}
                  newPassword={resetting || registering}
                  descriptionId={resetting || registering ? "password-help" : undefined}
                />
              )}
              {resetting && (
                <PasswordField
                  label="Повторите новый пароль"
                  value={passwordAgain}
                  onChange={setPasswordAgain}
                  disabled={busy}
                  newPassword
                />
              )}
              {(registering || resetting) && (
                <p className="account-help" id="password-help">От 8 до 64 символов.</p>
              )}
              {(error || (!resetting && (accounts.error || accessDenied))) && (
                <p className="account-error" role="alert">
                  {error || accounts.error || accessDenied}
                </p>
              )}
              {accounts.error && !resetting && (
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
                type="submit"
                className="button button-primary"
                disabled={busy || (!!accounts.error && !resetting)}
              >
                {busy ? name("account.wait")
                  : resetting ? "Сохранить пароль"
                    : requestingLink ? "Отправить ссылку"
                      : setup ? name("account.createAdmin")
                        : registering ? name("account.register") : name("account.signIn")}
                <ArrowRight size={16} />
              </button>
              {resetting && (
                <button type="button" className="button button-secondary" disabled={busy} onClick={cancelReset}>
                  Отменить восстановление
                </button>
              )}
              {cloudEnabled && mode === "login" && !resetting && (
                <>
                  <button type="button" className="button button-secondary" disabled={busy} onClick={() => openLinkForm("forgot")}>
                    Забыли пароль?
                  </button>
                  <button type="button" className="button button-secondary" disabled={busy} onClick={() => openLinkForm("resend")}>
                    Получить новую ссылку подтверждения
                  </button>
                </>
              )}
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
