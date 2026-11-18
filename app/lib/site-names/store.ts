"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getAccounts, refreshAccounts } from "../accounts/store";
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

function readNames() {
  if (typeof window === "undefined") return initial;
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
  if (!listeners.size) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}

export function useNameValues() {
  return useSyncExternalStore(subscribe, readNames, () => initial);
}

export function useSiteNames() {
  const values = useNameValues();
  return useCallback((key: NameKey) => resolveName(key, values), [values]);
}

export function saveSiteNames(changes: NameChanges) {
  if (typeof window === "undefined") throw new Error("Сохранение доступно только в браузере.");
  refreshAccounts();
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

  try {
    const next = mergeNameChanges(values, normalized);
    if (Object.keys(next).length) window.localStorage.setItem(siteNamesStorageKey, JSON.stringify(next));
    else window.localStorage.removeItem(siteNamesStorageKey);
  } catch {
    throw new Error("Не удалось сохранить названия в браузере. Попробуйте ещё раз.");
  }
  notify();
}
