import { getTask, tasks } from "./course";

export type TaskProgress = {
  startedAt?: string | null;
  attempts: number;
  runs: number;
  hints: number;
  solutionViewed: boolean;
  solvedAt: string | null;
  independent: boolean;
};
export type HistoryEntry = {
  id: string;
  taskId: string;
  sql: string;
  action: "run" | "check";
  success: boolean;
  rows: number;
  elapsed: number;
  date: string;
  error?: string;
};
export type StudyState = {
  version: 1;
  name: string;
  activeTaskId: string;
  drafts: Record<string, string>;
  progress: Record<string, TaskProgress>;
  history: HistoryEntry[];
  notes: string;
  storageIssue: string | null;
};
export const STORAGE_KEY = "codeproof.sql.v1";
export const MAX_BACKUP_BYTES = 16_000_000;
export const emptyProgress: TaskProgress = {
  startedAt: null,
  attempts: 0,
  runs: 0,
  hints: 0,
  solutionViewed: false,
  solvedAt: null,
  independent: false,
};
export const emptyStudy: StudyState = {
  version: 1,
  name: "Студент",
  activeTaskId: tasks[0].id,
  drafts: {},
  progress: {},
  history: [],
  notes: "",
  storageIssue: null,
};

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function count(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? Math.min(value, 1000000)
    : 0;
}
function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 40 &&
    Number.isFinite(Date.parse(value))
  );
}

export function parseStudy(raw: string): StudyState {
  if (raw.length > MAX_BACKUP_BYTES) throw new Error("Файл слишком большой.");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(
      "Не удалось прочитать JSON. Выберите файл, скачанный через «Экспорт прогресса».",
    );
  }
  if (
    !object(value) ||
    value.version !== 1 ||
    !object(value.drafts) ||
    !object(value.progress) ||
    !Array.isArray(value.history)
  ) {
    throw new Error("Это не файл прогресса CodeProof SQL.");
  }
  const drafts: Record<string, string> = {};
  const progress: Record<string, TaskProgress> = {};
  for (const task of tasks) {
    const draft = value.drafts[task.id];
    if (typeof draft === "string") drafts[task.id] = draft.slice(0, 20000);
    const item = value.progress[task.id];
    if (object(item)) {
      progress[task.id] = {
        startedAt: validDate(item.startedAt) ? item.startedAt : null,
        attempts: count(item.attempts),
        runs: count(item.runs),
        hints: Math.min(3, count(item.hints)),
        solutionViewed: item.solutionViewed === true,
        solvedAt: validDate(item.solvedAt) ? item.solvedAt : null,
        independent: item.independent === true && validDate(item.solvedAt),
      };
    }
  }
  const history: HistoryEntry[] = value.history
    .filter(
      (item): item is Record<string, unknown> =>
        object(item) &&
        typeof item.taskId === "string" &&
        !!getTask(item.taskId) &&
        typeof item.sql === "string" &&
        (item.action === "run" || item.action === "check") &&
        validDate(item.date),
    )
    .slice(0, 100)
    .map((item, i) => ({
      id: typeof item.id === "string" ? item.id.slice(0, 100) : "import-" + i,
      taskId: item.taskId as string,
      sql: (item.sql as string).slice(0, 20000),
      action: item.action as "run" | "check",
      success: item.success === true,
      rows: count(item.rows),
      elapsed:
        typeof item.elapsed === "number" && Number.isFinite(item.elapsed)
          ? Math.max(0, item.elapsed)
          : 0,
      date: item.date as string,
      error:
        typeof item.error === "string" ? item.error.slice(0, 1000) : undefined,
    }));
  return {
    version: 1,
    name:
      typeof value.name === "string" && value.name.trim()
        ? value.name.trim().slice(0, 40)
        : "Студент",
    activeTaskId:
      typeof value.activeTaskId === "string" && getTask(value.activeTaskId)
        ? value.activeTaskId
        : tasks[0].id,
    drafts,
    progress,
    history,
    notes: typeof value.notes === "string" ? value.notes.slice(0, 50000) : "",
    storageIssue: null,
  };
}

export function recordAttempt(
  state: StudyState,
  entry: HistoryEntry,
): StudyState {
  const current = state.progress[entry.taskId] ?? emptyProgress;
  const passed = entry.action === "check" && entry.success;
  return {
    ...state,
    activeTaskId: entry.taskId,
    progress: {
      ...state.progress,
      [entry.taskId]: {
        ...current,
        attempts: current.attempts + (entry.action === "check" ? 1 : 0),
        runs: current.runs + 1,
        solvedAt: passed ? (current.solvedAt ?? entry.date) : current.solvedAt,
        independent:
          current.independent ||
          (passed && current.hints === 0 && !current.solutionViewed),
      },
    },
    history: [entry, ...state.history].slice(0, 100),
  };
}

export function getStats(state: StudyState) {
  const completed = tasks.filter(
    (task) => state.progress[task.id]?.solvedAt,
  ).length;
  const independent = tasks.filter(
    (task) => state.progress[task.id]?.independent,
  ).length;
  const attempts = Object.values(state.progress).reduce(
    (sum, item) => sum + item.attempts,
    0,
  );
  const runs = Object.values(state.progress).reduce(
    (sum, item) => sum + item.runs,
    0,
  );
  return {
    completed,
    independent,
    attempts,
    runs,
    percent: Math.round((completed / tasks.length) * 100),
  };
}

export function isTaskStarted(state: StudyState, id: string): boolean {
  const progress = state.progress[id];
  return !!(
    progress?.startedAt ||
    progress?.runs ||
    progress?.hints ||
    progress?.solutionViewed ||
    progress?.solvedAt ||
    (state.drafts[id]?.trim() && state.drafts[id] !== getTask(id)?.starter)
  );
}

export function visitTaskState(
  state: StudyState,
  id: string,
  date: string,
): StudyState {
  if (!getTask(id)) return state;
  const current = state.progress[id] ?? emptyProgress;
  if (state.activeTaskId === id && current.startedAt) return state;
  return {
    ...state,
    activeTaskId: id,
    progress: {
      ...state.progress,
      [id]: { ...current, startedAt: current.startedAt ?? date },
    },
  };
}

export function restartTaskState(
  state: StudyState,
  id: string,
  date: string,
): StudyState {
  const task = getTask(id);
  if (!task) return state;
  return {
    ...state,
    activeTaskId: id,
    drafts: { ...state.drafts, [id]: task.starter },
    progress: {
      ...state.progress,
      [id]: { ...emptyProgress, startedAt: date },
    },
  };
}

export function getContinueTask(state: StudyState) {
  const active = getTask(state.activeTaskId);
  return active && !state.progress[active.id]?.solvedAt
    ? active
    : tasks.find((task) => !state.progress[task.id]?.solvedAt);
}

export function getNextTask(state: StudyState, currentId: string) {
  const index = tasks.findIndex((task) => task.id === currentId);
  return [...tasks.slice(index + 1), ...tasks.slice(0, index)].find(
    (task) => !state.progress[task.id]?.solvedAt,
  );
}

export function serializeStudy(state: StudyState): string {
  return JSON.stringify({ ...state, storageIssue: null }, null, 2);
}
