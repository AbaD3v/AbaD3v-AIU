"use client";
import { useSyncExternalStore } from "react";
import { getAccounts, subscribeAccounts } from "../accounts/store";
import {
  emptyStudy,
  emptyProgress,
  parseStudy,
  recordAttempt,
  visitTaskState,
  restartTaskState,
  STORAGE_KEY,
  type StudyState,
  type HistoryEntry,
} from "./progress";

let state: StudyState = emptyStudy;
let loadedKey: string | undefined;
let unsubscribeAccounts: (() => void) | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function storageKey(id?: string) {
  return id ? `${STORAGE_KEY}.account.${id}` : STORAGE_KEY;
}

export function getStudyScope() {
  return storageKey(getAccounts().active?.id);
}

function readStudy(key: string, name?: string) {
  const fallback = name ? { ...emptyStudy, name } : emptyStudy;
  const raw = window.localStorage.getItem(key);
  return raw === null ? fallback : parseStudy(raw);
}

export function readStudentStudy(id: string) {
  const accounts = getAccounts();
  const student = accounts.students.find((account) => account.id === id);
  if (accounts.active?.role !== "admin" || !student) return null;
  try {
    return readStudy(storageKey(id), student.name);
  } catch {
    return null;
  }
}

function readStorage(key: string) {
  const previous = key === loadedKey ? state : emptyStudy;
  loadedKey = key;
  try {
    state = readStudy(key, getAccounts().active?.name);
  } catch {
    state = {
      ...previous,
      storageIssue:
        "Не удалось прочитать сохранения. Работа продолжится в этой вкладке. Экспортируйте прогресс, чтобы не потерять его.",
    };
  }
}

function snapshot() {
  if (typeof window !== "undefined") {
    const key = getStudyScope();
    if (loadedKey !== key) readStorage(key);
  }
  return state;
}

function onStorage(event: StorageEvent) {
  const key = getStudyScope();
  if (event.key === key || event.key === null) {
    readStorage(key);
    emit();
  }
}

function subscribe(listener: () => void) {
  if (!listeners.size) {
    unsubscribeAccounts = subscribeAccounts(() => {
      snapshot();
      emit();
    });
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      unsubscribeAccounts?.();
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function useStudy() {
  return useSyncExternalStore(subscribe, snapshot, () => emptyStudy);
}

export function updateStudy(update: (current: StudyState) => StudyState) {
  const next = update(snapshot());
  if (next === state) return;
  state = next;
  try {
    state = { ...state, storageIssue: null };
    window.localStorage.setItem(getStudyScope(), JSON.stringify(state));
  } catch {
    state = {
      ...state,
      storageIssue:
        "Сохранение недоступно. Изменения останутся только в этой вкладке — экспортируйте прогресс перед выходом.",
    };
  }
  emit();
}

export const saveDraft = (id: string, sql: string) =>
  updateStudy((current) => ({
    ...current,
    activeTaskId: id,
    drafts: { ...current.drafts, [id]: sql.slice(0, 20000) },
  }));
export const addAttempt = (entry: Omit<HistoryEntry, "id" | "date">) =>
  updateStudy((current) =>
    recordAttempt(current, {
      ...entry,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    }),
  );
export const revealHint = (id: string) =>
  updateStudy((current) => {
    const progress = current.progress[id] ?? emptyProgress;
    return {
      ...current,
      progress: {
        ...current.progress,
        [id]: { ...progress, hints: Math.min(3, progress.hints + 1) },
      },
    };
  });
export const revealSolution = (id: string) =>
  updateStudy((current) => ({
    ...current,
    progress: {
      ...current.progress,
      [id]: {
        ...(current.progress[id] ?? emptyProgress),
        solutionViewed: true,
      },
    },
  }));
export const replaceStudy = (next: StudyState) => updateStudy(() => next);
export const visitTask = (id: string) =>
  updateStudy((current) =>
    visitTaskState(current, id, new Date().toISOString()),
  );
export const restartTask = (id: string) =>
  updateStudy((current) =>
    restartTaskState(current, id, new Date().toISOString()),
  );
