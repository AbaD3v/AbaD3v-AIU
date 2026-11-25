"use client";

import { useSyncExternalStore } from "react";
import { getAccounts } from "../accounts/store";
import { cloudEnabled, getSupabase } from "../supabase/client";
import {
  defaultTrainingDatabase,
  parseTrainingDatabase,
  type TrainingDatabase,
} from "./training-database";

const storageKey = "codeproof.training-database.v1";
type Publication = {
  config: TrainingDatabase;
  revision: string | null;
  status: "loading" | "ready" | "error";
};
const initial: Publication = {
  config: defaultTrainingDatabase,
  revision: null,
  status: cloudEnabled ? "loading" : "ready",
};
let publication = initial;
let request = 0;
const listeners = new Set<() => void>();

function notify(next: Publication) {
  publication = next;
  listeners.forEach(listener => listener());
}

export async function reloadTrainingDatabase() {
  const current = ++request;
  try {
    if (cloudEnabled) {
      const { data, error } = await getSupabase().from("codeproof_training_database")
        .select("config, revision").eq("id", true).single();
      if (current !== request) return;
      // A deployment can briefly precede its database migration.
      if (error?.code === "PGRST205") {
        notify({ ...initial, status: "ready" });
        return;
      }
      if (error || !data) throw error ?? new Error("Не найдена опубликованная версия.");
      notify({ config: parseTrainingDatabase(data.config), revision: data.revision, status: "ready" });
    } else {
      const raw = window.localStorage.getItem(storageKey);
      const saved = raw ? JSON.parse(raw) : null;
      notify({
        config: saved ? parseTrainingDatabase(saved.config) : defaultTrainingDatabase,
        revision: saved?.revision ?? null,
        status: "ready",
      });
    }
  } catch {
    if (current === request) notify({ ...publication, status: "error" });
  }
}

function onStorage(event: StorageEvent) {
  if (event.key === storageKey || event.key === null) void reloadTrainingDatabase();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void reloadTrainingDatabase();
    window.addEventListener("focus", reloadTrainingDatabase);
    if (!cloudEnabled) window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener("focus", reloadTrainingDatabase);
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function useTrainingDatabase() {
  return useSyncExternalStore(subscribe, () => publication, () => initial);
}

export async function publishTrainingDatabase(input: TrainingDatabase, previousRevision: string | null) {
  if (getAccounts().active?.role !== "admin") throw new Error("Требуется доступ администратора.");
  const config = parseTrainingDatabase(input);
  const revision = crypto.randomUUID();
  if (cloudEnabled) {
    if (!previousRevision) throw new Error("Версия для публикации недоступна. Обновите страницу.");
    const { data, error } = await getSupabase().from("codeproof_training_database")
      .update({ config, revision }).eq("id", true).eq("revision", previousRevision)
      .select("revision").maybeSingle();
    if (error) throw new Error("Не удалось опубликовать учебную базу. Повторите попытку.");
    if (!data) throw new Error("Другой администратор уже опубликовал изменения. Загрузите свежую версию.");
  } else {
    const raw = window.localStorage.getItem(storageKey);
    const existing = raw ? JSON.parse(raw) : null;
    if ((existing?.revision ?? null) !== previousRevision) {
      throw new Error("Учебная база изменилась в другой вкладке. Загрузите свежую версию.");
    }
    window.localStorage.setItem(storageKey, JSON.stringify({ config, revision }));
  }
  request += 1;
  notify({ config, revision, status: "ready" });
}
