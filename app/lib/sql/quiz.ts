"use client";

import { useSyncExternalStore } from "react";
import { getAccounts, refreshAccounts } from "../accounts/store";
import { getTask, tasks } from "./course";

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

const prefix = "codeproof.quiz.v1.";
const empty: QuizQuestion[] = [];
const initial = new Map<string, QuizQuestion[]>(tasks.map((task, index) => {
  const options = [task.solution, tasks[(index + 1) % tasks.length].solution,
    tasks[(index + 2) % tasks.length].solution];
  const correctIndex = index % options.length;
  [options[0], options[correctIndex]] = [options[correctIndex], options[0]];
  return [task.id, [{ id: `${task.id}-query`,
    prompt: `Какой запрос выполняет условие задания? ${task.requirement}`,
    options, correctIndex, explanation: task.explanation }]];
}));
const cache = new Map<string, { raw: string | null; questions: QuizQuestion[] }>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Validates the complete replacement; an empty array deliberately disables a quiz. */
export function validateQuizQuestions(value: unknown): QuizQuestion[] {
  if (!Array.isArray(value)) throw new Error("Вопросы должны быть массивом.");
  const ids = new Set<string>();
  return Array.from(value, (item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Некорректный вопрос.");
    const q = item as Partial<QuizQuestion>;
    if (typeof q.id !== "string" || !q.id.trim() || ids.has(q.id.trim()))
      throw new Error("У каждого вопроса должен быть уникальный непустой id.");
    if (typeof q.prompt !== "string" || !q.prompt.trim())
      throw new Error("Введите текст вопроса.");
    if (!Array.isArray(q.options) || q.options.length < 2 ||
      Array.from(q.options).some((option) => typeof option !== "string" || !option.trim()))
      throw new Error("Добавьте минимум два непустых варианта ответа.");
    if (!Number.isInteger(q.correctIndex) || q.correctIndex! < 0 || q.correctIndex! >= q.options.length)
      throw new Error("Выберите правильный ответ: индекс начинается с нуля.");
    if (q.explanation !== undefined && typeof q.explanation !== "string")
      throw new Error("Объяснение должно быть строкой.");
    ids.add(q.id.trim());
    return { id: q.id.trim(), prompt: q.prompt.trim(), options: q.options.map((s) => s.trim()),
      correctIndex: q.correctIndex!, explanation: q.explanation?.trim() ?? "" };
  });
}

export function getQuizQuestions(taskId: string): QuizQuestion[] {
  if (!getTask(taskId)) return empty;
  if (typeof window === "undefined") return empty;
  let raw: string | null;
  try { raw = window.localStorage.getItem(prefix + taskId); }
  catch { return empty; }
  const previous = cache.get(taskId);
  if (previous && previous.raw === raw) return previous.questions;
  let questions = initial.get(taskId) ?? empty;
  if (raw !== null) {
    // Corrupt overrides must not resurrect questions an administrator removed.
    try { questions = validateQuizQuestions(JSON.parse(raw)); }
    catch { questions = empty; }
  }
  cache.set(taskId, { raw, questions });
  return questions;
}

function onStorage(event: StorageEvent) {
  if (event.key === null || event.key.startsWith(prefix)) emit();
}

export function subscribeQuizQuestions(listener: () => void) {
  if (!listeners.size) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}

export function useQuizQuestions(taskId: string): QuizQuestion[] {
  return useSyncExternalStore(subscribeQuizQuestions, () => getQuizQuestions(taskId), () => empty);
}

/** Throws on invalid input, insufficient permissions, or failed persistence. */
export function saveQuizQuestions(taskId: string, questions: QuizQuestion[]): void {
  if (typeof window === "undefined") throw new Error("Сохранение доступно только в браузере.");
  refreshAccounts();
  if (getAccounts().active?.role !== "admin") throw new Error("Нужен аккаунт администратора.");
  if (!getTask(taskId)) throw new Error("Задание не найдено.");
  const validated = validateQuizQuestions(questions);
  try { window.localStorage.setItem(prefix + taskId, JSON.stringify(validated)); }
  catch { throw new Error("Не удалось сохранить вопросы в браузере. Повторите сохранение."); }
  emit();
}
