"use client";
import { useSiteNames } from "@/app/lib/site-names/store";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { PageHeading } from "@/app/components/sql/ui";
import { flushStudy, retryStudySync, updateStudy, useStudySyncStatus } from "@/app/lib/sql/store";
import { accountDestination, rememberRegistrationTask, suggestEmailAddress } from "@/app/lib/accounts/registration";
import {
  getGuestTransfer,
  getPendingGuestTransfer,
  markGuestTransferOffered,
  mergeGuestStudy,
  rememberGuestTransfer,
} from "@/app/lib/accounts/guest-study";
import {
  cloudEnabled,
  dismissEmailConfirmation,
  readEmailConfirmation,
} from "@/app/lib/supabase/client";
import {
  getAccounts,
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
type GuestTransfer = NonNullable<ReturnType<typeof getGuestTransfer>> & { accountId: string; href: string };

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
  const syncStatus = useStudySyncStatus();
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [guestTransfer, setGuestTransfer] = useState<GuestTransfer | null>(null);
  const [transferStarted, setTransferStarted] = useState(false);
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
  const activeLogin = accounts.active?.login ?? "";
  const transfer = guestTransfer?.accountId === activeId ? guestTransfer : null;
  const resetting = Boolean(resetFor && resetFor === activeId);
  const accessDenied = mode === "login" ? accounts.accessDenied : undefined;
  const suggestedAddress = cloudEnabled && mode === "register" ? suggestEmailAddress(login) : null;

  const enterAccount = useCallback((role: Role, email: string) => {
    const href = cloudEnabled ? accountDestination(role, email) : accountHome(role);
    const account = getAccounts().active;
    if (cloudEnabled && role === "student" && account?.role === "student" && account.login === email) {
      const guest = getGuestTransfer(account.id);
      if (guest) {
        rememberGuestTransfer(account.id, href);
        setTransferStarted(false);
        setGuestTransfer({ ...guest, accountId: account.id, href });
        return;
      }
    }
    router.replace(href);
  }, [router]);

  useEffect(() => {
    if (!cloudEnabled || !accounts.ready) return;
    let cancelled = false;
    void readEmailConfirmation().then((result) => {
      if (cancelled) return;
      if (!result) {
        setResetFor(null);
        if (activeRole === "student" && activeId) {
          const pendingTransfer = getPendingGuestTransfer(activeId);
          if (pendingTransfer) setGuestTransfer(pendingTransfer);
        }
        return;
      }
      if ((result === "confirmed" || result === "recovery") && accounts.error && !activeRole) return;
      dismissEmailConfirmation();
      if (result === "recovery" && activeId) {
        setResetFor(activeId);
        return;
      }
      if (result === "confirmed" && activeRole) {
        enterAccount(activeRole, activeLogin);
      } else if (!accessDenied) {
        setError(result === "expired"
          ? "Ссылка истекла или уже использована. Запросите новую ссылку со страницы входа."
          : "Не удалось открыть ссылку из письма. Запросите новую ссылку со страницы входа.");
      }
    }).catch(() => {
      if (!cancelled) setError("Не удалось проверить ссылку. Обновите страницу и попробуйте ещё раз.");
    });
    return () => { cancelled = true; };
  }, [accounts.ready, accounts.error, activeRole, activeId, activeLogin, accessDenied, enterAccount]);

  function switchMode(next: Mode) {
    setMode(next);
    setPendingEmail(null);
    setPassword("");
    setPasswordAgain("");
    setError("");
    setNotice("");
  }

  function openLinkForm(next: "resend" | "forgot") {
    switchMode(next);
    emailField.current?.focus();
  }

  async function resendPendingConfirmation(email: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await resendCloudConfirmation(email);
      setNotice("Проверьте почту и папку «Спам». Подтвердить адрес можно по новой ссылке.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось отправить ссылку.");
    } finally {
      setBusy(false);
    }
  }

  async function finishTransfer(offer: GuestTransfer, copy: boolean) {
    if (getAccounts().active?.id !== offer.accountId) return;
    setBusy(true);
    setError("");
    try {
      if (copy) {
        setTransferStarted(true);
        updateStudy((current) => mergeGuestStudy(current, offer.study));
        await flushStudy();
      }
      if (getAccounts().active?.id !== offer.accountId) return;
      markGuestTransferOffered(offer.accountId);
      setTransferStarted(false);
      setGuestTransfer(null);
      router.replace(offer.href);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось перенести гостевой прогресс.");
    } finally {
      setBusy(false);
    }
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
          rememberRegistrationTask(created.email);
          switchMode("login");
          if (created.confirmationRequired) {
            setPendingEmail(created.email);
          } else {
            enterAccount(created.role, created.email);
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
        enterAccount(role, getAccounts().active?.login ?? login);
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
      ) : transfer && !resetting ? (
        <section className="account-card account-signed-in" aria-labelledby="guest-transfer-title">
          <h2 id="guest-transfer-title">Перенести гостевой прогресс?</h2>
          <p>В этом браузере решено задач — {transfer.solved}, сохранено черновиков — {transfer.drafts}.</p>
          <p>Отредактированные черновики и заметки, которые уже есть в аккаунте, сохранятся.</p>
          {syncStatus === "loading" && <p role="status">Загружаем прогресс аккаунта…</p>}
          {(syncStatus === "load-error" || syncStatus === "conflict") && (
            <p className="account-error" role="alert">
              {syncStatus === "conflict"
                ? "Прогресс изменился на другом устройстве. Обновите страницу, чтобы попробовать ещё раз."
                : "Не удалось загрузить прогресс аккаунта."}
            </p>
          )}
          {error && <p className="account-error" role="alert">{error}</p>}
          <div className="account-actions">
            {syncStatus === "load-error" ? (
              <button type="button" className="button button-primary" onClick={retryStudySync}>Загрузить снова</button>
            ) : (
              <button
                type="button"
                className="button button-primary"
                disabled={busy || syncStatus === "loading" || syncStatus === "conflict" || syncStatus === "local"}
                onClick={() => { void finishTransfer(transfer, true); }}
              >
                {busy ? "Переносим…" : transferStarted ? "Повторить сохранение" : "Перенести прогресс"}
              </button>
            )}
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={() => { void finishTransfer(transfer, false); }}
            >
              {transferStarted ? "Продолжить" : "Продолжить без переноса"}
            </button>
          </div>
        </section>
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
      ) : pendingEmail ? (
        <section className="account-card account-signed-in" aria-labelledby="check-email-title">
          <h2 id="check-email-title">Проверьте почту</h2>
          <p>Откройте ссылку подтверждения из письма на <strong style={{ overflowWrap: "anywhere" }}>{pendingEmail}</strong>.</p>
          <div className="account-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={busy}
              onClick={() => { void resendPendingConfirmation(pendingEmail); }}
            >
              {busy ? name("account.wait") : "Отправить ещё раз"}
            </button>
            <button type="button" className="button button-secondary" disabled={busy} onClick={() => switchMode("register")}>
              Исправить адрес
            </button>
            <button type="button" className="button button-secondary" disabled={busy} onClick={() => switchMode("login")}>
              К форме входа
            </button>
          </div>
          {error && <p className="account-error" role="alert">{error}</p>}
          {notice && <p className="notice-banner" role="status">{notice}</p>}
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
              {suggestedAddress && (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => { setLogin(suggestedAddress); emailField.current?.focus(); }}
                >
                  Использовать {suggestedAddress}?
                </button>
              )}
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
                <p className="account-help" id="password-help">
                  {password.length === 0 ? "От 8 до 64 символов."
                    : password.length < 8 ? `До минимума ещё ${8 - password.length} симв.`
                      : password.trim() ? "Длина подходит." : "Добавьте символы кроме пробелов."}
                </p>
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
