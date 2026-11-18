import { getTask } from "@/app/lib/sql/course";

export const actionOptions = [
  { value: "run", nameKey: "history.run" },
  { value: "check", nameKey: "history.check" },
] as const;

export const resultOptions = [
  { value: "success", nameKey: "history.success" },
  { value: "failure", nameKey: "history.failure" },
] as const;

export const defaultFilters = { search: "", taskId: "", action: "", result: "" };
type HistoryFilters = typeof defaultFilters;

function isSelection(value: unknown, options: readonly { value: string }[]): value is string {
  return value === "" || options.some((option) => option.value === value);
}

export function readFilters(key: string | null): HistoryFilters {
  if (!key) return defaultFilters;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return defaultFilters;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return defaultFilters;
    const { search, taskId, action, result } = data as Partial<HistoryFilters>;
    if (
      typeof search !== "string" ||
      typeof taskId !== "string" ||
      (taskId !== "" && !getTask(taskId)) ||
      !isSelection(action, actionOptions) ||
      !isSelection(result, resultOptions)
    ) {
      return defaultFilters;
    }
    return { search, taskId, action, result };
  } catch {
    return defaultFilters;
  }
}

export function saveFilters(key: string | null, filters: HistoryFilters) {
  if (!key) return;
  try {
    if (Object.values(filters).some(Boolean)) {
      window.sessionStorage.setItem(key, JSON.stringify(filters));
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // The controls still work for this visit if the browser cannot save them.
  }
}
