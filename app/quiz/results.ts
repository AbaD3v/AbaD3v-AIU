"use client";

import { useSyncExternalStore } from "react";
import { getTask, tasks } from "../lib/sql/course";
import type { QuizQuestion } from "../lib/sql/quiz";
import { getStudyScope } from "../lib/sql/store";
import { getAccounts, subscribeAccounts } from "../lib/accounts/store";
import { cloudEnabled, getSupabase } from "../lib/supabase/client";
import { requestQuizData } from "./request";

export type QuizResult = { score: number; questionCount: number; completedAt: string };
const completionTimes = new Map<string, number>();

function parseResult(value: unknown): QuizResult | null {
  if (!value || typeof value !== "object") return null;
  const result = value as QuizResult;
  if (!Number.isInteger(result.score) || !Number.isInteger(result.questionCount) ||
    result.questionCount < 1 || result.questionCount > 100 || result.score < 0 || result.score > result.questionCount ||
    typeof result.completedAt !== "string" || !Number.isFinite(Date.parse(result.completedAt))) return null;
  return { score: result.score, questionCount: result.questionCount, completedAt: result.completedAt };
}

export function quizResultKey(taskId: string, scope = getStudyScope()) {
  return `codeproof.quiz-results.v1.${scope}.${taskId}`;
}

function rememberCompletionTime(taskId: string, scope: string, result: QuizResult) {
  const key = quizResultKey(taskId, scope);
  completionTimes.set(key, Math.max(completionTimes.get(key) ?? 0, Date.parse(result.completedAt)));
}

export function readQuizResult(taskId: string, scope = getStudyScope()): QuizResult | null {
  if (!getTask(taskId) || typeof window === "undefined") return null;
  try {
    const result = parseResult(JSON.parse(window.localStorage.getItem(quizResultKey(taskId, scope)) ?? "null"));
    if (result) rememberCompletionTime(taskId, scope, result);
    return result;
  } catch { return null; }
}

/** Incomplete attempts never write; failed writes still return the current result. */
export function completeQuiz(taskId: string, questions: QuizQuestion[], answers: number[], scope = getStudyScope()) {
  if (!getTask(taskId) || !questions.length || questions.length > 100 || answers.length !== questions.length ||
    Array.from(answers).some((answer, index) => !Number.isInteger(answer) || answer < 0 || answer >= questions[index].options.length))
    throw new Error("Попытка не завершена.");
  const result: QuizResult = {
    score: answers.reduce((sum, answer, index) => sum + Number(answer === questions[index].correctIndex), 0),
    questionCount: questions.length,
    completedAt: new Date(Math.max(Date.now(), (completionTimes.get(quizResultKey(taskId, scope)) ?? 0) + 1)).toISOString(),
  };
  rememberCompletionTime(taskId, scope, result);
  let saved = false;
  // A stale click after switching accounts must never write to another user's scope.
  if (scope === getStudyScope()) {
    const user = cloudEnabled ? getAccounts().active : null;
    if (user) return { result, saved: false };
    try {
      window.localStorage.setItem(quizResultKey(taskId, scope), JSON.stringify(result));
      saved = true;
    } catch { /* The caller displays the in-memory result. */ }
  }
  return { result, saved };
}

export function isCloudQuiz() {
  return cloudEnabled && Boolean(getAccounts().active);
}

export async function readCloudQuizResult(taskId: string, scope: string): Promise<QuizResult | null> {
  const user = getAccounts().active;
  if (!cloudEnabled || !user || scope !== getStudyScope() || !getTask(taskId)) return null;
  const { data, error } = await requestQuizData((signal) => getSupabase().from("codeproof_quiz_results")
    .select("score, question_count, completed_at").eq("user_id", user.id).eq("task_id", taskId)
    .abortSignal(signal).maybeSingle());
  if (error) throw new Error("Не удалось загрузить прошлый результат теста.");
  if (!data || scope !== getStudyScope()) return null;
  const result = parseResult({ score: data.score, questionCount: data.question_count, completedAt: data.completed_at });
  if (!result) throw new Error("Сохранённый результат теста повреждён.");
  rememberCompletionTime(taskId, scope, result);
  return result;
}

type PendingResult = {
  taskId: string;
  scope: string;
  result: QuizResult;
  error: boolean;
  saving?: Promise<boolean>;
};
const pending = new Map<string, PendingResult>();
const restoredScopes = new Set<string>();
const listeners = new Set<() => void>();
let unsubscribeAccounts: (() => void) | undefined;
const emit = () => listeners.forEach((listener) => listener());
const pendingKey = (taskId: string, scope: string) => `${quizResultKey(taskId, scope)}.pending`;

function restorePending(scope: string, reconcile = false) {
  if (!isCloudQuiz() || scope !== getStudyScope() || (!reconcile && restoredScopes.has(scope))) return;
  restoredScopes.add(scope);
  for (const task of tasks) {
    const key = pendingKey(task.id, scope);
    try {
      const result = parseResult(JSON.parse(window.localStorage.getItem(key) ?? "null"));
      if (!result) continue;
      rememberCompletionTime(task.id, scope, result);
      const current = pending.get(key);
      if (!current) pending.set(key, { taskId: task.id, scope, result, error: false });
      else if (Date.parse(result.completedAt) > Date.parse(current.result.completedAt)) current.result = result;
    } catch { /* An in-memory pending result remains available if storage is blocked. */ }
  }
}

export function readPendingQuizResult(taskId: string, scope = getStudyScope()) {
  if (scope !== getStudyScope()) return null;
  restorePending(scope);
  return pending.get(pendingKey(taskId, scope))?.result ?? null;
}

// CAS protects concurrent writes. Ordering uses client timestamps; observed server times
// keep new online attempts monotonic, but offline devices still depend on their clocks.
async function writeResult(current: PendingResult, result: QuizResult, userId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const latest = await readCloudQuizResult(current.taskId, current.scope);
    if (current.scope !== getStudyScope()) return false;
    if (latest && Date.parse(latest.completedAt) >= Date.parse(result.completedAt)) return true;
    const payload = { score: result.score, question_count: result.questionCount, completed_at: result.completedAt };
    const table = getSupabase().from("codeproof_quiz_results");
    const write = latest
      ? table.update(payload).eq("user_id", userId).eq("task_id", current.taskId).eq("completed_at", latest.completedAt)
      : table.upsert({ ...payload, user_id: userId, task_id: current.taskId }, { onConflict: "user_id,task_id", ignoreDuplicates: true });
    const { data, error } = await requestQuizData((signal) => write.select("completed_at").abortSignal(signal).maybeSingle());
    if (error) throw error;
    if (current.scope !== getStudyScope()) return false;
    if (data) return true;
  }
  throw new Error("Результат теста изменился на другом устройстве. Повторите синхронизацию.");
}

function savePending(current: PendingResult): Promise<boolean> {
  if (current.saving) return current.saving;
  const user = getAccounts().active;
  if (!cloudEnabled || !user || current.scope !== getStudyScope()) return Promise.resolve(false);
  current.error = false;
  const key = pendingKey(current.taskId, current.scope);
  current.saving = (async () => {
    try {
      while (pending.get(key) === current) {
        const result = current.result;
        if (!await writeResult(current, result, user.id)) return false;
        if (current.result !== result) continue;
        pending.delete(key);
        try {
          // Do not remove a newer pending attempt from another tab.
          const stored = parseResult(JSON.parse(window.localStorage.getItem(key) ?? "null"));
          if (stored && Date.parse(stored.completedAt) <= Date.parse(result.completedAt)) window.localStorage.removeItem(key);
        } catch { /* Successful cloud persistence is authoritative. */ }
      }
      return true;
    } catch {
      current.error = true;
      return false;
    }
  })().finally(() => {
    current.saving = undefined;
    emit();
  });
  emit();
  return current.saving;
}

export async function saveCloudQuizResult(taskId: string, result: QuizResult, scope: string) {
  if (!isCloudQuiz() || scope !== getStudyScope() || !getTask(taskId) || !parseResult(result)) return false;
  rememberCompletionTime(taskId, scope, result);
  restorePending(scope, true);
  const key = pendingKey(taskId, scope);
  const current = pending.get(key) ?? { taskId, scope, result, error: false };
  if (Date.parse(result.completedAt) >= Date.parse(current.result.completedAt)) current.result = result;
  pending.set(key, current);
  try { window.localStorage.setItem(key, JSON.stringify(current.result)); }
  catch { /* Keep the retry queue in memory and warn before leaving. */ }
  return savePending(current);
}

function activePending(taskId?: string) {
  if (taskId !== undefined && !getTask(taskId)) return [];
  const scope = getStudyScope();
  restorePending(scope);
  return isCloudQuiz() ? [...pending.values()].filter((item) =>
    item.scope === scope && (taskId === undefined || item.taskId === taskId)) : [];
}

export async function flushQuizResults(taskId?: string) {
  if (taskId !== undefined && !getTask(taskId)) return;
  restorePending(getStudyScope(), true);
  await Promise.all(activePending(taskId).map(savePending));
  if (activePending(taskId).length) throw new Error("Результат теста ещё не синхронизирован. Повторите сохранение перед выходом.");
}

export function retryQuizResultSync(taskId?: string) {
  void flushQuizResults(taskId).catch(() => {});
}

const retryAllQuizResults = () => retryQuizResultSync();

function onStorage(event: StorageEvent) {
  if (event.key === null || tasks.some((task) => event.key === pendingKey(task.id, getStudyScope()))) {
    retryQuizResultSync();
    emit();
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (activePending().length) {
    event.preventDefault();
    event.returnValue = true;
  }
}

export function subscribeQuizResults(listener: () => void) {
  if (!listeners.size) {
    unsubscribeAccounts = subscribeAccounts(() => { retryQuizResultSync(); emit(); });
    window.addEventListener("online", retryAllQuizResults);
    window.addEventListener("storage", onStorage);
    window.addEventListener("beforeunload", beforeUnload);
    queueMicrotask(retryAllQuizResults);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      unsubscribeAccounts?.();
      window.removeEventListener("online", retryAllQuizResults);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", beforeUnload);
    }
  };
}

export function getQuizSyncStatus(taskId?: string) {
  if (!isCloudQuiz()) return "local";
  const entries = activePending(taskId);
  if (entries.some((item) => item.error && !item.saving)) return "save-error";
  return entries.length ? "saving" : "synced";
}

export function useQuizSyncStatus(taskId?: string) {
  return useSyncExternalStore(subscribeQuizResults, () => getQuizSyncStatus(taskId), () => "local");
}
