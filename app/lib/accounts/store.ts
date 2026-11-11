"use client";
import { useSyncExternalStore } from "react";

export type Role = "student" | "admin";
export type Account = {
  id: string;
  name: string;
  login: string;
  role: Role;
  blocked: boolean;
};
type SavedAccount = Account & { salt: string; hash: string };
type AccountsState = {
  ready: boolean;
  active: Account | null;
  students: Account[];
  hasAdmin: boolean;
  error: string;
};

const accountsKey = "codeproof.accounts.v1";
const sessionKey = "codeproof.session.v1";
const loginPattern = /^[a-z0-9._-]{3,32}$/;
const initial: AccountsState = {
  ready: false,
  active: null,
  students: [],
  hasAdmin: false,
  error: "",
};
const listeners = new Set<() => void>();
let state = initial;

function validAccount(value: unknown): value is SavedAccount {
  if (!value || typeof value !== "object") return false;
  const a = value as Partial<SavedAccount>;
  return (
    typeof a.id === "string" &&
    /^[0-9a-f-]{36}$/.test(a.id) &&
    typeof a.name === "string" &&
    a.name.trim().length > 0 &&
    a.name.length <= 40 &&
    typeof a.login === "string" &&
    loginPattern.test(a.login) &&
    (a.role === "student" || a.role === "admin") &&
    typeof a.blocked === "boolean" &&
    typeof a.salt === "string" &&
    /^[0-9a-f]{32}$/.test(a.salt) &&
    typeof a.hash === "string" &&
    /^[0-9a-f]{64}$/.test(a.hash)
  );
}

function readAccounts(): SavedAccount[] {
  const raw = window.localStorage.getItem(accountsKey);
  if (raw === null) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || !data.every(validAccount)) {
    throw new Error("Данные аккаунтов повреждены.");
  }
  return data;
}

function publicAccount({
  id,
  name,
  login,
  role,
  blocked,
}: SavedAccount): Account {
  return { id, name, login, role, blocked };
}

function activeAccount(accounts: SavedAccount[]) {
  const id = window.sessionStorage.getItem(sessionKey);
  const account = accounts.find((item) => item.id === id && !item.blocked);
  if (id && !account) window.sessionStorage.removeItem(sessionKey);
  return account;
}

function refresh() {
  try {
    const accounts = readAccounts();
    const active = activeAccount(accounts);
    state = {
      ready: true,
      active: active ? publicAccount(active) : null,
      students:
        active?.role === "admin"
          ? accounts.filter((a) => a.role === "student").map(publicAccount)
          : [],
      hasAdmin: accounts.some((a) => a.role === "admin"),
      error: "",
    };
  } catch {
    state = {
      ...initial,
      ready: true,
      error: "Хранилище аккаунтов недоступно. Проверьте настройки браузера.",
    };
  }
}

function publish() {
  refresh();
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  if (
    event.key === accountsKey ||
    event.key === sessionKey ||
    event.key === null
  )
    publish();
}

export function subscribeAccounts(listener: () => void) {
  if (!listeners.size) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}

export function getAccounts() {
  if (!state.ready && typeof window !== "undefined") refresh();
  return state;
}

export function useAccounts() {
  return useSyncExternalStore(subscribeAccounts, getAccounts, () => initial);
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function passwordHash(password: string, salt: string) {
  if (!crypto.subtle)
    throw new Error("Для входа откройте сайт через HTTPS или localhost.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const saltBytes = Uint8Array.from(salt.match(/../g)!, (byte) =>
    parseInt(byte, 16),
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 600_000 },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

function persist(accounts: SavedAccount[]) {
  try {
    window.localStorage.setItem(accountsKey, JSON.stringify(accounts));
  } catch {
    throw new Error("Не удалось сохранить аккаунты в браузере.");
  }
  publish();
}

async function createAccount(
  input: { name: string; login: string; password: string },
  role: Role,
) {
  const name = input.name.trim();
  const login = input.login.trim().toLowerCase();
  if (!name || name.length > 40)
    throw new Error("Введите имя длиной до 40 символов.");
  if (!loginPattern.test(login))
    throw new Error(
      "Логин — от 3 до 32 символов: латинские буквы, цифры, точка, дефис или подчёркивание.",
    );
  if (
    input.password.length < 8 ||
    input.password.length > 64 ||
    !input.password.trim()
  ) {
    throw new Error("Пароль должен содержать от 8 до 64 символов.");
  }
  function checkAvailability(accounts: SavedAccount[]) {
    if (activeAccount(accounts))
      throw new Error("Выйдите из текущего аккаунта перед регистрацией.");
    if (accounts.some((a) => a.login === login))
      throw new Error("Этот логин уже занят.");
    if (role === "admin" && accounts.some((a) => a.role === "admin")) {
      throw new Error("Демо администратор уже создан в этом браузере.");
    }
  }
  checkAvailability(readAccounts());
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await passwordHash(input.password, salt);
  const accounts = readAccounts();
  checkAvailability(accounts);
  persist([
    ...accounts,
    { id: crypto.randomUUID(), name, login, role, blocked: false, salt, hash },
  ]);
  return login;
}

export function registerStudent(input: {
  name: string;
  login: string;
  password: string;
}) {
  return createAccount(input, "student");
}

export function setupDemoAdmin(input: {
  name: string;
  login: string;
  password: string;
}) {
  return createAccount(input, "admin");
}

export async function signIn(login: string, password: string) {
  const normalized = login.trim().toLowerCase();
  const invalid = "Неверный логин или пароль.";
  if (
    !loginPattern.test(normalized) ||
    password.length < 8 ||
    password.length > 64
  )
    throw new Error(invalid);
  const account = readAccounts().find((a) => a.login === normalized);
  if (!account || (await passwordHash(password, account.salt)) !== account.hash)
    throw new Error(invalid);
  const fresh = readAccounts().find((a) => a.id === account.id);
  if (!fresh || fresh.hash !== account.hash) throw new Error(invalid);
  if (fresh.blocked)
    throw new Error("Вход для этого студента приостановлен администратором.");
  try {
    window.sessionStorage.setItem(sessionKey, fresh.id);
  } catch {
    throw new Error("Не удалось сохранить вход в этой вкладке.");
  }
  publish();
  return fresh.role;
}

export function signOut() {
  window.sessionStorage.removeItem(sessionKey);
  publish();
}

export function setStudentBlocked(id: string, blocked: boolean) {
  const accounts = readAccounts();
  if (activeAccount(accounts)?.role !== "admin")
    throw new Error("Нужен аккаунт администратора.");
  if (!accounts.some((a) => a.id === id && a.role === "student"))
    throw new Error("Студент не найден.");
  persist(accounts.map((a) => (a.id === id ? { ...a, blocked } : a)));
}
