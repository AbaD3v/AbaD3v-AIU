"use client";
import type { AuthError, User } from "@supabase/supabase-js";
import {
  clearPasswordRecovery,
  getSupabase,
  hasPasswordRecoverySession,
} from "../supabase/client";
import { initial, type Account, type AccountsState } from "./local-store";

type Profile = Omit<Account, "login">;
const profileFields = "id, name, role, blocked";
const blockedMessage = "Доступ к этому аккаунту приостановлен администратором.";
const profileErrorMessage = "Не удалось загрузить аккаунт. Повторите попытку.";
const listeners = new Set<() => void>();
let state = initial;
let request = 0;
let started = false;
let authenticating = false;

function publish(next: AccountsState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export async function refreshAccounts() {
  const current = ++request;
  try {
    const { data: { session }, error } = await getSupabase().auth.getSession();
    if (error) throw error;
    if (current !== request) return;
    if (!session) {
      if (!state.ready || state.active || state.error)
        publish({ ...initial, ready: true, accessDenied: state.accessDenied });
      return;
    }
    return await loadAccount(session.user, current);
  } catch (error) {
    if (current === request) {
      if (!state.active && !state.accessDenied) {
        publish({ ...initial, ready: true, error: profileErrorMessage });
      } else if (state.studentListStatus === "loading") {
        publish({ ...state, studentListStatus: "error" });
      }
    }
    throw (error instanceof Error && error.message === blockedMessage)
      ? error : new Error(profileErrorMessage);
  }
}

async function loadAccount(user: User, current: number) {
  if (current !== request) return;
  if (state.active && user.id !== state.active.id) publish(initial);
  const supabase = getSupabase();
  const { data, error } = await supabase.from("codeproof_profiles")
    .select(profileFields).eq("id", user.id).single<Profile>();
  if (current !== request) return;
  if (error || !data) throw new Error(profileErrorMessage);
  if (data.blocked) {
    publish({ ...initial, ready: true, accessDenied: blockedMessage });
    await supabase.auth.signOut({ scope: "local" });
    throw new Error(blockedMessage);
  }

  const active = { ...data, login: user.email ?? "" };
  const students = active.role === "admin" && state.active?.id === active.id
    ? state.students : [];
  publish({
    ...initial,
    ready: true,
    active,
    students,
    studentListStatus: active.role === "admin" ? "loading" : "ready",
  });
  if (active.role === "admin") void loadStudents(current);
  return active;
}

async function loadStudents(current: number) {
  const students: Account[] = [];
  const pageSize = 500;
  try {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await getSupabase().from("codeproof_admin_students")
        .select("id, name, login, role, blocked").order("id")
        .range(offset, offset + pageSize - 1).returns<Account[]>();
      if (current !== request) return;
      if (error) throw error;
      students.push(...data);
      if (data.length < pageSize) break;
    }
    publish({ ...state, students, studentListStatus: "ready" });
  } catch {
    if (current === request) {
      publish({ ...state, studentListStatus: "error" });
    }
  }
}

function refreshInBackground() {
  if (!authenticating) void refreshAccounts().catch(() => {});
}

export function getAccounts() {
  return state;
}

export function subscribeAccounts(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    getSupabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        request += 1;
        publish({ ...initial, ready: true, accessDenied: state.accessDenied });
      } else if (!authenticating) {
        // The callback runs under the SDK's auth lock.
        setTimeout(refreshInBackground, 0);
      }
    });
    window.addEventListener("focus", refreshInBackground);
  }
  return () => { listeners.delete(listener); };
}

function authMessage(error: AuthError, fallback: string) {
  switch (error.code) {
    case "invalid_credentials":
      return "Неверная почта или пароль.";
    case "email_not_confirmed":
      return "Подтвердите адрес по ссылке из письма, затем войдите.";
    case "email_address_invalid":
      return "Проверьте, правильно ли указан адрес электронной почты.";
    case "email_address_not_authorized":
      return "Письмо не отправлено. Обратитесь к администратору курса.";
    case "same_password":
      return "Выберите пароль, отличный от текущего.";
    case "weak_password":
      return "Выберите более надёжный пароль.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Слишком много попыток. Попробуйте чуть позже.";
    case "user_banned":
      return blockedMessage;
    default:
      return error.name === "AuthRetryableFetchError"
        ? "Нет связи с сервисом входа. Проверьте интернет и повторите попытку."
        : fallback;
  }
}

async function authenticate<T>(action: (current: number) => Promise<T>) {
  if (authenticating) throw new Error("Дождитесь завершения текущей операции.");
  const current = ++request;
  authenticating = true;
  if (state.accessDenied) publish({ ...state, accessDenied: undefined });
  try {
    return await action(current);
  } finally {
    authenticating = false;
  }
}

function accountEmailUrl() {
  return new URL("/account/", window.location.origin).href;
}

export async function resendCloudConfirmation(login: string) {
  const { error } = await getSupabase().auth.resend({
    type: "signup",
    email: login.trim().toLowerCase(),
    options: { emailRedirectTo: accountEmailUrl() },
  });
  if (error) throw new Error(authMessage(error, "Не удалось отправить новую ссылку. Попробуйте ещё раз."));
}

export async function requestCloudPasswordReset(login: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(login.trim().toLowerCase(), {
    redirectTo: accountEmailUrl(),
  });
  if (error) throw new Error(authMessage(error, "Не удалось отправить ссылку для сброса пароля. Попробуйте ещё раз."));
}

export async function updateCloudPassword(password: string) {
  if (password.length < 8 || password.length > 64 || !password.trim())
    throw new Error("Пароль должен содержать от 8 до 64 символов.");
  if (!await hasPasswordRecoverySession())
    throw new Error("Сессия восстановления недоступна. Запросите новую ссылку со страницы входа.");
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw new Error(authMessage(error, "Не удалось обновить пароль. Попробуйте ещё раз."));
  clearPasswordRecovery();
}

export async function registerCloudStudent(input: { name: string; login: string; password: string }) {
  const name = input.name.trim();
  const email = input.login.trim().toLowerCase();
  if (!name || name.length > 40) throw new Error("Введите имя длиной до 40 символов.");
  if (input.password.length < 8 || input.password.length > 64 || !input.password.trim())
    throw new Error("Пароль должен содержать от 8 до 64 символов.");

  return authenticate(async (current) => {
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password: input.password,
      options: { data: { name }, emailRedirectTo: accountEmailUrl() },
    });
    if (error) throw new Error(authMessage(error, "Не удалось зарегистрироваться. Попробуйте ещё раз."));
    if (!data.session) return { email, confirmationRequired: true as const };
    const active = await loadAccount(data.session.user, current);
    if (!active) throw new Error(profileErrorMessage);
    return { email, confirmationRequired: false as const, role: active.role };
  });
}

export async function signIn(login: string, password: string) {
  return authenticate(async (current) => {
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email: login.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(authMessage(error, "Не удалось войти. Попробуйте ещё раз."));
    const active = await loadAccount(data.user, current);
    if (!active) throw new Error(profileErrorMessage);
    return active.role;
  });
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut({ scope: "local" });
  if (error) throw new Error("Не удалось завершить сеанс. Повторите попытку.");
  clearPasswordRecovery();
}

export async function setStudentBlocked(id: string, blocked: boolean) {
  const admin = state.active?.id;
  const { data, error } = await getSupabase().from("codeproof_profiles")
    .update({ blocked }).eq("id", id).select("id").maybeSingle();
  if (error || !data) throw new Error("Не удалось изменить доступ студента.");
  if (state.active?.role === "admin" && state.active.id === admin) {
    publish({ ...state, students: state.students.map((student) =>
      student.id === id ? { ...student, blocked } : student) });
    refreshInBackground();
  }
}
