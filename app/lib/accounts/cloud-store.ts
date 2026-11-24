"use client";
import { getSupabase } from "../supabase/client";
import { initial, type Account, type AccountsState } from "./local-store";

type Profile = Omit<Account, "login">;
const profileFields = "id, name, role, blocked";
const listeners = new Set<() => void>();
let state = initial;
let request = 0;
let started = false;
let signingIn = false;

function publish(next: AccountsState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export async function refreshAccounts() {
  const current = ++request;
  const supabase = getSupabase();
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (current !== request) return;
    if (!session) {
      publish({ ...initial, ready: true });
      return;
    }
    if (state.active && session.user.id !== state.active.id) publish(initial);
    const { data, error } = await supabase.from("codeproof_profiles")
      .select(profileFields).eq("id", session.user.id).single<Profile>();
    if (error) throw error;
    if (current !== request) return;
    if (data.blocked) {
      publish({ ...initial, ready: true });
      await supabase.auth.signOut({ scope: "local" });
      return;
    }

    const active = { ...data, login: session.user.email ?? "" };
    const students: Account[] = [];
    if (active.role === "admin") {
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data: page, error: listError } = await supabase.from("codeproof_admin_students")
          .select("id, name, login, role, blocked").order("id")
          .range(offset, offset + pageSize - 1).returns<Account[]>();
        if (listError) throw listError;
        if (current !== request) return;
        students.push(...page);
        if (page.length < pageSize) break;
      }
    }
    publish({ ...initial, ready: true, active, students, hasAdmin: true });
    return active;
  } catch (error) {
    if (current === request && !state.active) {
      publish({ ...initial, ready: true, error: "Не удалось загрузить аккаунт. Повторите попытку." });
    }
    throw error;
  }
}

function refreshInBackground() {
  if (!signingIn) void refreshAccounts().catch(() => {});
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
        publish({ ...initial, ready: true });
      } else {
        // The callback runs under the SDK's auth lock.
        setTimeout(refreshInBackground, 0);
      }
    });
    window.addEventListener("focus", refreshInBackground);
  }
  return () => { listeners.delete(listener); };
}

export async function registerCloudStudent(input: { name: string; login: string; password: string }) {
  const name = input.name.trim();
  const email = input.login.trim().toLowerCase();
  if (!name || name.length > 40) throw new Error("Введите имя длиной до 40 символов.");
  if (input.password.length < 8 || input.password.length > 64 || !input.password.trim())
    throw new Error("Пароль должен содержать от 8 до 64 символов.");

  const { data, error } = await getSupabase().auth.signUp({
    email,
    password: input.password,
    options: { data: { name }, emailRedirectTo: new URL("/account/", window.location.origin).href },
  });
  if (error) throw new Error("Не удалось зарегистрироваться. Проверьте данные и повторите попытку.");
  return { email, confirmationRequired: !data.session };
}

export async function signIn(login: string, password: string) {
  request += 1;
  signingIn = true;
  try {
    return await signInWithProfile(login, password);
  } finally {
    signingIn = false;
  }
}

async function signInWithProfile(login: string, password: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: login.trim().toLowerCase(),
    password,
  });
  if (error) {
    throw new Error(error.code === "email_not_confirmed"
      ? "Подтвердите адрес по ссылке из письма."
      : "Не удалось войти. Проверьте почту и пароль.");
  }

  // Check the current role directly, independently of the auth event listener.
  const { data: profile, error: profileError } = await supabase.from("codeproof_profiles")
    .select("role, blocked").eq("id", data.user.id).single<Pick<Profile, "role" | "blocked">>();
  if (profileError || !profile || profile.blocked) {
    await signOut();
    throw new Error(profile?.blocked
      ? "Доступ к этому аккаунту приостановлен администратором."
      : "Не удалось загрузить профиль.");
  }
  await refreshAccounts();
  return profile.role;
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut({ scope: "local" });
  if (error) throw new Error("Не удалось завершить сеанс. Повторите попытку.");
}

export async function setStudentBlocked(id: string, blocked: boolean) {
  const { data, error } = await getSupabase().from("codeproof_profiles")
    .update({ blocked }).eq("id", id).select("id").maybeSingle();
  if (error || !data) throw new Error("Не удалось изменить доступ студента.");
  await refreshAccounts();
}
