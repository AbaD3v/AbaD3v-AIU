"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getAccounts, refreshAccounts } from "../accounts/store";
import { cloudEnabled, getSupabase } from "../supabase/client";
import {
  mergeNameChanges,
  nameDefaults,
  resolveName,
  type NameChanges,
  type NameKey,
  type NameValues,
} from "./registry";

export const siteNamesStorageKey = "codeproof.site-names.v1";
const initial: NameValues = {};
let snapshot = { raw: null as string | null, values: initial };
const listeners = new Set<() => void>();
let cloudNames: NameValues = {};
let cloudRequest = 0;
type LoadStatus = "loading" | "ready" | "error";
let loadStatus: LoadStatus = cloudEnabled ? "loading" : "ready";

export async function refreshCloudNames() {
  if (!cloudEnabled) return;
  const request = ++cloudRequest;
  loadStatus = "loading";
  notify();
  try {
    const { data, error } = await getSupabase().from("codeproof_site_names").select("key, value");
    if (request !== cloudRequest) return;
    if (error) throw error;
    const next: NameValues = {};
    for (const { key, value } of data) {
      if (nameDefaults.has(key as NameKey) && typeof value === "string") next[key as NameKey] = value;
    }
    cloudNames = next;
    loadStatus = "ready";
  } catch {
    if (request !== cloudRequest) return;
    loadStatus = "error";
  }
  notify();
}

function readNames() {
  if (typeof window === "undefined") return initial;
  if (cloudEnabled) return cloudNames;
  try {
    const raw = window.localStorage.getItem(siteNamesStorageKey);
    if (raw === snapshot.raw) return snapshot.values;
    let values = initial;
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          values = Object.fromEntries(
            Object.entries(parsed).filter(([key, value]) =>
              nameDefaults.has(key as NameKey) && typeof value === "string" && value.trim(),
            ).map(([key, value]) => [key, value.trim()]),
          );
        }
      } catch {
        // Broken data uses the shipped defaults.
      }
    }
    snapshot = { raw, values };
    return values;
  } catch {
    return initial;
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === siteNamesStorageKey) notify();
}

function subscribe(listener: () => void) {
  if (!listeners.size) {
    if (cloudEnabled) {
      refreshCloudNames();
      window.addEventListener("focus", refreshCloudNames);
    } else {
      window.addEventListener("storage", onStorage);
    }
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener("focus", refreshCloudNames);
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function useNameValues() {
  return useSyncExternalStore(subscribe, readNames, () => initial);
}

export function useNamesLoadStatus() {
  return useSyncExternalStore(subscribe, () => loadStatus, () => cloudEnabled ? "loading" : "ready");
}

export function useSiteNames() {
  const values = useNameValues();
  return useCallback((key: NameKey) => resolveName(key, values), [values]);
}

export async function saveSiteNames(changes: NameChanges) {
  if (typeof window === "undefined") throw new Error("Сохранение доступно только в браузере.");
  if (!cloudEnabled) refreshAccounts();
  if (getAccounts().active?.role !== "admin") throw new Error("Нужен аккаунт администратора.");

  const normalized: NameChanges = {};
  const values = readNames();
  for (const [key, value] of Object.entries(changes) as [NameKey, unknown][]) {
    if (!nameDefaults.has(key)) throw new Error("Неизвестное название.");
    if (value !== null && (typeof value !== "string" || !value.trim())) {
      throw new Error(`${resolveName("admin.nameEmpty", values)}: ${nameDefaults.get(key)}.`);
    }
    normalized[key] = value === null ? null : value.trim();
  }

  if (cloudEnabled) {
    const rows = Object.entries(normalized).map(([key, value]) => ({ key, value }));
    if (!rows.length) return;
    const { error } = await getSupabase().from("codeproof_site_names").upsert(rows);
    if (error) throw new Error("Не удалось сохранить названия в Supabase.");
    cloudRequest += 1;
    cloudNames = mergeNameChanges(cloudNames, normalized);
    loadStatus = "ready";
    notify();
    return;
  }

  try {
    const next = mergeNameChanges(values, normalized);
    if (Object.keys(next).length) window.localStorage.setItem(siteNamesStorageKey, JSON.stringify(next));
    else window.localStorage.removeItem(siteNamesStorageKey);
  } catch {
    throw new Error("Не удалось сохранить названия в браузере. Попробуйте ещё раз.");
  }
  notify();
}
