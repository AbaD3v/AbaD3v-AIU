import { getTask, taskHref, tasks } from "../sql/course";
import {
  emptyProgress,
  getStats,
  isTaskStarted,
  parseStudy,
  STORAGE_KEY,
  type StudyState,
} from "../sql/progress";

const decisionKey = (id: string) => `codeproof.guest-transfer.v1.${id}`;
const pendingKey = "codeproof.pending-guest-transfer";

export function guestDraftCount(study: StudyState) {
  return tasks.filter((task) => {
    const draft = study.drafts[task.id];
    return draft?.trim() && draft !== task.starter;
  }).length;
}

export function getGuestTransfer(id: string) {
  try {
    if (window.localStorage.getItem(decisionKey(id))) return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const study = parseStudy(raw);
    if (!guestDraftCount(study) && !study.notes.trim() && !study.history.length &&
      !Object.values(study.progress).some((task) => task.solvedAt || task.runs || task.attempts || task.hints || task.solutionViewed)) {
      return null;
    }
    return { study, solved: getStats(study).completed, drafts: guestDraftCount(study) };
  } catch {
    return null;
  }
}

export function rememberGuestTransfer(id: string, href: string) {
  try {
    window.sessionStorage.setItem(pendingKey, JSON.stringify({ id, href }));
  } catch {
    // The offer still works until this page is closed.
  }
}

export function getPendingGuestTransfer(id: string) {
  try {
    const pending = JSON.parse(window.sessionStorage.getItem(pendingKey) ?? "null");
    if (pending?.id !== id || typeof pending.href !== "string") return null;
    const taskId = /^\/practice\/([a-z0-9-]+)\/$/.exec(pending.href)?.[1];
    const href = taskId && getTask(taskId) ? taskHref(taskId) : "/profile/";
    const guest = getGuestTransfer(id);
    return guest ? { ...guest, accountId: id, href } : null;
  } catch {
    return null;
  }
}

export function markGuestTransferOffered(id: string) {
  try {
    window.sessionStorage.removeItem(pendingKey);
  } catch {
    // No resumable offer was stored.
  }
  try {
    window.localStorage.setItem(decisionKey(id), "1");
  } catch {
    // A later offer is safe because merging the same study is idempotent.
  }
}

export function mergeGuestStudy(account: StudyState, guest: StudyState): StudyState {
  const drafts = { ...account.drafts };
  const progress = { ...account.progress };
  for (const { id, starter } of tasks) {
    const guestDraft = guest.drafts[id];
    if (guestDraft?.trim() && guestDraft !== starter && (drafts[id] === undefined || drafts[id] === starter)) {
      drafts[id] = guestDraft;
    }

    const incoming = guest.progress[id];
    if (!incoming) continue;
    const current = progress[id] ?? emptyProgress;
    progress[id] = {
      startedAt: current.startedAt ?? incoming.startedAt ?? null,
      solvedAt: current.solvedAt ?? incoming.solvedAt,
      runs: Math.max(current.runs, incoming.runs),
      attempts: Math.max(current.attempts, incoming.attempts),
      hints: Math.max(current.hints, incoming.hints),
      solutionViewed: current.solutionViewed || incoming.solutionViewed,
      independent: current.independent || incoming.independent,
    };
  }

  const byId = new Map(account.history.map((entry) => [entry.id, entry]));
  for (const entry of guest.history) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  const history = Array.from(byId.values())
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 100);

  return {
    ...account,
    activeTaskId: tasks.some(({ id }) => isTaskStarted(account, id)) ? account.activeTaskId : guest.activeTaskId,
    drafts,
    progress,
    history,
    notes: account.notes.trim() ? account.notes : guest.notes,
  };
}
