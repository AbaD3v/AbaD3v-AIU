"use client";

import { useSyncExternalStore } from "react";
import { getAccounts, refreshAccounts } from "../accounts/store";
import { cloudEnabled, getSupabase } from "../supabase/client";
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
// Defaults only: a saved administrator replacement remains authoritative.
const understanding: Record<string, [string, string[], number, string]> = {
  "first-query": ["Гарантирует ли SELECT name, price FROM products порядок строк по цене?", ["Да, по возрастанию", "Нет, нужен ORDER BY", "Да, по убыванию"], 1, "Без ORDER BY порядок строк не гарантирован. SELECT задаёт только выбранные столбцы."],
  "premium-products": ["Какой товар пройдёт фильтр price > 100 AND is_active = 1?", ["Активный с ценой 100", "Неактивный с ценой 150", "Активный с ценой 150"], 2, "Оба условия должны выполняться одновременно; цена 100 исключена строгим сравнением."],
  "out-of-stock": ["Что изменится, если заменить AND на OR в stock = 0 AND is_active = 1?", ["Попадут также активные товары с ненулевым остатком", "Ничего", "Останутся только неактивные товары"], 0, "OR достаточно одного условия: он включит и все активные товары, и неактивные с нулевым остатком."],
  "top-prices": ["У активных товаров id 7 и id 3 одинаковая цена. Кто будет раньше при ORDER BY price DESC, id ASC?", ["id 7", "id 3", "Порядок не определён"], 1, "Второй ключ id ASC разрешает равенство цен: меньший id идёт первым."],
  "customer-cities": ["Что произойдёт при добавлении name к SELECT DISTINCT city?", ["Города по-прежнему всегда уникальны", "DISTINCT перестанет работать", "Будут уникальны пары city, name; город может повторяться"], 2, "DISTINCT применяется ко всей выбранной строке, а не только к первому столбцу."],
  "category-overview": ["В категории два активных товара по 100 и 200 и неактивный по 900. Какова AVG(price) после WHERE is_active = 1?", ["150", "400", "900"], 0, "WHERE исключает неактивный товар до GROUP BY и вычисления среднего."],
  "orders-and-customers": ["Почему JOIN должен использовать o.customer_id = c.id, а не o.id = c.id?", ["Так запрос автоматически сортирует заказы", "customer_id ссылается на покупателя, а o.id обозначает заказ", "Оба условия всегда равнозначны"], 1, "Идентификатор заказа не является ссылкой на покупателя. Связь задаёт orders.customer_id."],
  "order-totals": ["У заказа две позиции: 2 × 100 и 3 × 50. Что даст SUM(quantity * unit_price) в группе order_id?", ["150", "500", "350"], 2, "Сначала вычисляется стоимость каждой позиции, затем 200 и 150 складываются внутри заказа."],
  "customers-without-orders": ["Почему после LEFT JOIN orders используется o.id IS NULL?", ["Так обнаруживаются покупатели без соответствующего заказа", "Это выбирает только отменённые заказы", "Проверка o.id = NULL даст тот же результат"], 0, "При отсутствии заказа столбцы правой таблицы равны NULL. Для проверки нужен IS NULL, а не = NULL."],
  "product-revenue": ["Почему выручку группируют по p.id, p.name, а не только по p.name?", ["Чтобы включить отменённые заказы", "Разные товары могут иметь одинаковое название", "Чтобы использовать текущую цену каталога"], 1, "Группировка по устойчивому id не смешивает продажи разных товаров с одинаковыми названиями."],
  "repeat-customers": ["У покупателя один completed и один cancelled заказ. Пройдёт ли он HAVING COUNT(*) >= 2 после фильтра completed?", ["Да, всего два заказа", "Да, HAVING учитывает все статусы", "Нет, в группе остался только один заказ"], 2, "WHERE отбирает completed до группировки; HAVING проверяет количество оставшихся заказов."],
  "monthly-revenue": ["Почему группировка использует YYYY-MM, а не только номер месяца?", ["Чтобы не объединять продажи одного месяца разных лет", "Чтобы добавить месяцы без продаж", "Чтобы включить отменённые заказы"], 0, "Год в ключе группы разделяет, например, январь 2025 и январь 2026."],
  "unpaid-orders": ["У неотменённого заказа есть failed и success платежи. Попадёт ли он в заказы без успешной оплаты?", ["Да, есть failed", "Нет, существует хотя бы один success", "Да, если failed был первым"], 1, "NOT EXISTS проверяет отсутствие любого успешного платежа; одна успешная оплата уже исключает заказ."],
  "payment-audit": ["Что должен вернуть paid_total для completed-заказа без успешных платежей после LEFT JOIN итогов оплат?", ["NULL без замены", "Сумму позиций заказа", "0 благодаря COALESCE"], 2, "LEFT JOIN даёт NULL при отсутствии итогов оплат; COALESCE(p.total, 0) заменяет его нулём для сравнения сумм."],
  "top-customers": ["У покупателей id 8 и id 2 одинаковый total_spent. Кто будет раньше в топ-3?", ["id 2 благодаря customer_id ASC", "id 8 благодаря total_spent DESC", "Любой: LIMIT сам выбирает порядок"], 0, "При равных суммах второй ключ customer_id ASC задаёт однозначный порядок до LIMIT 3."],
};
const initial = new Map<string, QuizQuestion[]>(tasks.map((task, index) => {
  const options = [task.solution, tasks[(index + 1) % tasks.length].solution,
    tasks[(index + 2) % tasks.length].solution];
  const correctIndex = index % options.length;
  [options[0], options[correctIndex]] = [options[correctIndex], options[0]];
  const [prompt, choices, answer, explanation] = understanding[task.id];
  return [task.id, [{ id: `${task.id}-query`,
    prompt: `Какой запрос выполняет условие задания? ${task.requirement}`,
    options, correctIndex, explanation: task.explanation },
    { id: `${task.id}-understanding`, prompt, options: choices, correctIndex: answer, explanation }]];
}));
const cache = new Map<string, { raw: string | null; questions: QuizQuestion[] }>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
let cloudQuestions: Map<string, QuizQuestion[]> | undefined;
type QuizLoadStatus = "loading" | "ready" | "error";
let cloudStatus: QuizLoadStatus = "loading";
let invalidQuizzes = new Set<string>();
let cloudRequest = 0;

export async function refreshCloudQuestions() {
  if (!cloudEnabled) return;
  const request = ++cloudRequest;
  if (!cloudQuestions) {
    cloudStatus = "loading";
    emit();
  }
  try {
    const { data, error } = await getSupabase().from("codeproof_quizzes").select("task_id, questions");
    if (request !== cloudRequest) return;
    if (error) throw error;
    const next = new Map<string, QuizQuestion[]>();
    const invalid = new Set<string>();
    for (const row of data) {
      if (!getTask(row.task_id)) continue;
      try {
        next.set(row.task_id, validateQuizQuestions(row.questions));
      } catch {
        invalid.add(row.task_id);
        next.set(row.task_id, empty);
      }
    }
    invalidQuizzes = invalid;
    cloudQuestions = next;
    cloudStatus = "ready";
  } catch {
    if (request !== cloudRequest) return;
    cloudStatus = "error";
  }
  emit();
}

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
  if (cloudEnabled) {
    if (!cloudQuestions) return empty;
    return cloudQuestions.get(taskId) ?? initial.get(taskId) ?? empty;
  }
  let raw: string | null;
  try { raw = window.localStorage.getItem(prefix + taskId); }
  catch { return cache.get(taskId)?.questions ?? empty; }
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
  if (!listeners.size) {
    if (cloudEnabled) {
      refreshCloudQuestions();
      window.addEventListener("focus", refreshCloudQuestions);
    } else {
      window.addEventListener("storage", onStorage);
    }
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener("focus", refreshCloudQuestions);
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function useQuizQuestions(taskId: string): QuizQuestion[] {
  return useSyncExternalStore(subscribeQuizQuestions, () => getQuizQuestions(taskId), () => empty);
}

function quizLoadStatus(taskId: string): QuizLoadStatus {
  if (!cloudEnabled) return "ready";
  return invalidQuizzes.has(taskId) ? "error" : cloudStatus;
}

export function useQuizLoadStatus(taskId: string) {
  return useSyncExternalStore(subscribeQuizQuestions, () => quizLoadStatus(taskId), () => cloudEnabled ? "loading" : "ready");
}

/** Throws on invalid input, insufficient permissions, or failed persistence. */
export function saveQuizQuestions(taskId: string, questions: QuizQuestion[]) {
  if (typeof window === "undefined") throw new Error("Сохранение доступно только в браузере.");
  if (!cloudEnabled) refreshAccounts();
  if (getAccounts().active?.role !== "admin") throw new Error("Нужен аккаунт администратора.");
  if (!getTask(taskId)) throw new Error("Задание не найдено.");
  const validated = validateQuizQuestions(questions);
  if (cloudEnabled) return saveCloudQuestions(taskId, validated);
  try { window.localStorage.setItem(prefix + taskId, JSON.stringify(validated)); }
  catch { throw new Error("Не удалось сохранить вопросы в браузере. Повторите сохранение."); }
  emit();
}

async function saveCloudQuestions(taskId: string, questions: QuizQuestion[]) {
  if (questions.length > 100) throw new Error("В одном тесте может быть до 100 вопросов.");
  if (!cloudQuestions || quizLoadStatus(taskId) !== "ready") {
    throw new Error("Перед публикацией загрузите вопросы задания.");
  }
  const { data, error } = await getSupabase().from("codeproof_quizzes")
    .upsert({ task_id: taskId, questions }).select("questions").single();
  if (error || !data) throw new Error("Не удалось опубликовать вопросы. Проверьте подключение и повторите сохранение.");
  cloudRequest += 1;
  cloudQuestions.set(taskId, validateQuizQuestions(data.questions));
  emit();
}
