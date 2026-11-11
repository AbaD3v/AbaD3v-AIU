"use client";
import { useSyncExternalStore } from "react";
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
let initialized = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = parseStudy(raw);
    else state = emptyStudy;
  } catch {
    state = {
      ...state,
      storageIssue:
        "Не удалось прочитать сохранения. Работа продолжится в этой вкладке. Экспортируйте прогресс, чтобы не потерять его.",
    };
  }
}

function snapshot() {
  if (!initialized && typeof window !== "undefined") {
    readStorage();
    initialized = true;
  }
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      readStorage();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
