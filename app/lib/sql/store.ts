"use client";
import { useSyncExternalStore } from "react";
import { getAccounts, subscribeAccounts } from "../accounts/store";
import { cloudEnabled, getSupabase } from "../supabase/client";
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

type CloudStudy = {
  userId: string;
  revision: string | null;
  ready: boolean;
  pending: boolean;
  conflict: boolean;
  change: number;
  write?: { revision: string; state: StudyState; change: number };
  timer?: ReturnType<typeof setTimeout>;
  saving?: Promise<void>;
};
let cloudStudy: CloudStudy | undefined;
const failedSave = "Не удалось синхронизировать прогресс. Изменения открыты в этой вкладке.";

function beforeUnload(event: BeforeUnloadEvent) {
  if (cloudStudy?.pending) {
    event.preventDefault();
    event.returnValue = true;
  }
}

async function loadCloudStudy(current: CloudStudy) {
  try {
    const { data, error } = await getSupabase().from("codeproof_study")
      .select("state, revision").eq("user_id", current.userId).maybeSingle();
    if (error) throw error;
    if (current !== cloudStudy) return;
    if (data) {
      state = parseStudy(JSON.stringify(data.state));
      current.revision = data.revision;
    } else {
      state = { ...state, storageIssue: null };
    }
    current.ready = true;
  } catch {
    if (current !== cloudStudy) return;
    state = { ...state, storageIssue: "Не удалось загрузить прогресс из Supabase." };
  }
  emit();
}

async function saveCloudStudy(current: CloudStudy) {
  if (current.saving) return current.saving;
  if (!current.pending || !current.ready || current.conflict || current !== cloudStudy) return;
  clearTimeout(current.timer);
  current.saving = (async () => {
    while (current.pending && current === cloudStudy) {
      const writeAttempt = current.write ??= {
        revision: crypto.randomUUID(),
        state: { ...state, storageIssue: null },
        change: current.change,
      };
      const table = getSupabase().from("codeproof_study");
      const payload = { revision: writeAttempt.revision, state: writeAttempt.state };
      const write = current.revision === null
        ? table.upsert({ ...payload, user_id: current.userId }, { onConflict: "user_id", ignoreDuplicates: true })
        : table.update(payload).eq("user_id", current.userId).eq("revision", current.revision);
      try {
        const { data, error } = await write.select("revision").maybeSingle();
        if (error) throw error;
        if (current !== cloudStudy) return;
        if (!data) {
          const { data: latest, error: verifyError } = await getSupabase().from("codeproof_study")
            .select("revision").eq("user_id", current.userId).maybeSingle();
          if (verifyError) throw verifyError;
          if (current !== cloudStudy) return;
          if (latest?.revision !== writeAttempt.revision) {
            current.conflict = true;
            state = {
              ...state,
              storageIssue: "Сохранение изменилось на другом устройстве. Экспортируйте изменения этой вкладки, затем обновите страницу.",
            };
            return;
          }
        }
        current.revision = writeAttempt.revision;
        current.write = undefined;
        if (current.change === writeAttempt.change) {
          current.pending = false;
          state = { ...state, storageIssue: null };
        }
      } catch {
        if (current === cloudStudy) state = { ...state, storageIssue: failedSave };
        return;
      }
    }
  })().finally(() => {
    current.saving = undefined;
    if (current === cloudStudy) emit();
  });
  return current.saving;
}

export function retryStudySync() {
  if (!cloudStudy) return;
  if (!cloudStudy.ready) {
    state = { ...state, storageIssue: null };
    emit();
    void loadCloudStudy(cloudStudy);
  } else {
    void saveCloudStudy(cloudStudy);
  }
}

export async function flushStudy() {
  const current = cloudStudy;
  if (!current) return;
  await saveCloudStudy(current);
  if (current.pending) throw new Error("Прогресс ещё не синхронизирован. Сохраните изменения или экспортируйте их перед выходом.");
}

export function useStudySyncStatus() {
  return useSyncExternalStore(subscribe, () => {
    snapshot();
    if (!cloudStudy) return "local";
    if (!cloudStudy.ready) return state.storageIssue ? "load-error" : "loading";
    if (cloudStudy.conflict) return "conflict";
    if (cloudStudy.pending) return state.storageIssue ? "save-error" : "saving";
    return "synced";
  }, () => "local");
}

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

let adminStudies: Record<string, StudyState> = {};
let adminStudyRequest = 0;

export function clearAdminStudies() {
  adminStudyRequest += 1;
  adminStudies = {};
}

export async function refreshAdminStudies() {
  const admin = getAccounts().active;
  if (!cloudEnabled || admin?.role !== "admin") return;
  const request = ++adminStudyRequest;
  const records: Record<string, StudyState> = {};
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await getSupabase().from("codeproof_admin_progress")
      .select("user_id, progress").order("user_id").range(offset, offset + pageSize - 1);
    if (error) throw new Error("Не удалось загрузить прогресс студентов.");
    if (request !== adminStudyRequest || admin.id !== getAccounts().active?.id) return;
    for (const row of data) {
      records[row.user_id] = parseStudy(JSON.stringify({ ...emptyStudy, progress: row.progress ?? {} }));
    }
    if (data.length < pageSize) break;
  }
  adminStudies = records;
}

export function readStudentStudy(id: string) {
  const accounts = getAccounts();
  const student = accounts.students.find((account) => account.id === id);
  if (accounts.active?.role !== "admin" || !student) return null;
  if (cloudEnabled) return adminStudies[id] ?? null;
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
    const account = getAccounts().active;
    const key = storageKey(account?.id);
    if (loadedKey !== key) {
      clearTimeout(cloudStudy?.timer);
      cloudStudy = undefined;
      if (cloudEnabled && account) {
        loadedKey = key;
        state = { ...emptyStudy, name: account.name };
        cloudStudy = { userId: account.id, revision: null, ready: false, pending: false, conflict: false, change: 0 };
        // Snapshots can run during React render. Start I/O after the render.
        const current = cloudStudy;
        queueMicrotask(() => { if (current === cloudStudy) void loadCloudStudy(current); });
      } else {
        readStorage(key);
      }
    }
  }
  return state;
}

function onStorage(event: StorageEvent) {
  if (cloudStudy) return;
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
    if (cloudEnabled) {
      window.addEventListener("online", retryStudySync);
      window.addEventListener("beforeunload", beforeUnload);
    }
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      unsubscribeAccounts?.();
      window.removeEventListener("storage", onStorage);
      if (cloudEnabled) {
        window.removeEventListener("online", retryStudySync);
        window.removeEventListener("beforeunload", beforeUnload);
      }
    }
  };
}

export function useStudy() {
  return useSyncExternalStore(subscribe, snapshot, () => emptyStudy);
}

export function updateStudy(update: (current: StudyState) => StudyState) {
  const previous = snapshot();
  const current = cloudStudy;
  if (current && !current.ready) return;
  const next = update(previous);
  if (next === state) return;
  state = next;
  if (current) {
    current.pending = true;
    current.change += 1;
    if (!current.saving && !current.conflict) {
      clearTimeout(current.timer);
      current.timer = setTimeout(() => { void saveCloudStudy(current); }, 450);
    }
    emit();
    return;
  }
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
