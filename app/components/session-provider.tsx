"use client";

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  isLanguage,
  isLevel,
  type Language,
  type Level,
} from "../lib/languages";
import { parseProfile, profileStorageKey } from "../lib/onboarding";

export type Account = {
  id: string;
  name: string;
  email: string;
  languages: Language[];
  level: Level;
  preferencesSet: boolean;
  createdAt: string;
};

const accountsKey = "codeproof.accounts.v1";
const activeKey = "codeproof.active-account.v1";
const subscribe = () => () => {};
const SessionContext = createContext<{
  account: Account | null;
  notice: string;
  register: (name: string, email: string) => string | null;
  login: (email: string) => string | null;
  logout: () => void;
  updatePreferences: (languages: Language[], level: Level) => void;
} | null>(null);

function readAccounts() {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(accountsKey) ?? "[]",
    );
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is Account =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.email === "string" &&
        Array.isArray(item.languages) &&
        item.languages.every(isLanguage) &&
        isLevel(item.level) &&
        typeof item.preferencesSet === "boolean" &&
        typeof item.createdAt === "string",
    );
  } catch {
    return [];
  }
}

function readActiveId() {
  try {
    return sessionStorage.getItem(activeKey);
  } catch {
    return null;
  }
}

function ReadySession({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>(readAccounts);
  const [activeId, setActiveId] = useState(readActiveId);
  const [notice, setNotice] = useState("");
  const account = accounts.find((item) => item.id === activeId) ?? null;

  function activate(id: string | null) {
    setActiveId(id);
    try {
      if (id) sessionStorage.setItem(activeKey, id);
      else sessionStorage.removeItem(activeKey);
    } catch {
      setNotice(
        "Браузер запретил сохранение входа. После обновления страницы войди снова.",
      );
    }
  }

  function save(next: Account[]) {
    setAccounts(next);
    try {
      localStorage.setItem(accountsKey, JSON.stringify(next));
      setNotice("");
    } catch {
      setNotice(
        "Профиль доступен до закрытия страницы. Браузер не разрешает сохранить его.",
      );
    }
  }

  function register(name: string, email: string) {
    const normalized = email.trim().toLowerCase();
    const latest = readAccounts();
    const merged = [
      ...latest,
      ...accounts.filter(
        (item) => !latest.some((saved) => saved.id === item.id),
      ),
    ];
    if (merged.some((item) => item.email === normalized))
      return "Этот профиль уже создан. Перейди во вкладку «Войти».";
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
      return "Укажи имя и корректную почту.";
    let legacyLanguages: Language[] = [];
    if (merged.length === 0) {
      try {
        legacyLanguages =
          parseProfile(localStorage.getItem(profileStorageKey))?.languages ??
          [];
      } catch {
        /* Private browsing can block storage. */
      }
    }
    const created: Account = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalized,
      languages: legacyLanguages,
      level: "beginner",
      preferencesSet: false,
      createdAt: new Date().toISOString(),
    };
    save([...merged, created]);
    activate(created.id);
    return null;
  }

  function login(email: string) {
    const latest = readAccounts();
    const merged = [
      ...latest,
      ...accounts.filter(
        (item) => !latest.some((saved) => saved.id === item.id),
      ),
    ];
    const found = merged.find(
      (item) => item.email === email.trim().toLowerCase(),
    );
    if (!found)
      return "В этом браузере ещё нет такого профиля. Создай его во вкладке «Регистрация».";
    setAccounts(merged);
    activate(found.id);
    return null;
  }

  function updatePreferences(languages: Language[], level: Level) {
    const latest = readAccounts();
    const merged = [
      ...latest,
      ...accounts.filter(
        (item) => !latest.some((saved) => saved.id === item.id),
      ),
    ];
    save(
      merged.map((item) =>
        item.id === activeId
          ? { ...item, languages, level, preferencesSet: true }
          : item,
      ),
    );
  }

  return (
    <SessionContext.Provider
      value={{
        account,
        notice,
        register,
        login,
        logout: () => activate(null),
        updatePreferences,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!ready)
    return (
      <div className="app-loading" role="status">
        Открываем CodeProof…
      </div>
    );
  return <ReadySession>{children}</ReadySession>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("SessionProvider is required");
  return context;
}
