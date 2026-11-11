import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyStudy,
  emptyProgress,
  getStats,
  parseStudy,
  recordAttempt,
  visitTaskState,
  restartTaskState,
  isTaskStarted,
  getContinueTask,
  getNextTask,
  serializeStudy,
  MAX_BACKUP_BYTES,
  type HistoryEntry,
  type StudyState,
} from "../app/lib/sql/progress";
import { tasks } from "../app/lib/sql/course";

const entry: HistoryEntry = {
  id: "test",
  taskId: "first-query",
  sql: "SELECT name, price FROM products;",
  action: "check",
  success: true,
  rows: 12,
  elapsed: 2,
  date: "2026-01-01T12:00:00.000Z",
};

test("running valid SQL does not mark a lesson solved; passing a check does", () => {
  const ran = recordAttempt(emptyStudy, { ...entry, action: "run" });
  assert.equal(getStats(ran).completed, 0);
  assert.equal(getStats(ran).attempts, 0);
  const solved = recordAttempt(ran, entry);
  assert.equal(getStats(solved).completed, 1);
  assert.equal(getStats(solved).independent, 1);
  assert.equal(getStats(solved).runs, 2);
  assert.equal(getStats(solved).attempts, 1);
  const failedLater = recordAttempt(solved, { ...entry, success: false });
  assert.equal(getStats(failedLater).completed, 1);
});

test("hints and solutions distinguish assisted completion; failed checks cannot award completion", () => {
  for (const help of [{ hints: 1 }, { solutionViewed: true }]) {
    const state = recordAttempt(
      {
        ...emptyStudy,
        progress: { "first-query": { ...emptyProgress, ...help } },
      },
      entry,
    );
    assert.equal(getStats(state).completed, 1);
    assert.equal(getStats(state).independent, 0);
  }
  assert.equal(
    getStats(recordAttempt(emptyStudy, { ...entry, success: false })).completed,
    0,
  );
});

test("finishing a slow query does not overwrite edits made while it ran", () => {
  const state = recordAttempt(
    { ...emptyStudy, drafts: { "first-query": "SELECT name FROM products;" } },
    entry,
  );
  assert.equal(state.drafts["first-query"], "SELECT name FROM products;");
  assert.equal(state.history[0].sql, entry.sql);
});

test("progress, notes and drafts round-trip; history remains bounded", () => {
  let state: StudyState = {
    ...emptyStudy,
    notes: "JOIN по id",
    drafts: { "first-query": entry.sql },
  };
  for (let i = 0; i < 120; i++)
    state = recordAttempt(state, { ...entry, id: String(i) });
  assert.equal(state.history.length, 100);
  const restored = parseStudy(JSON.stringify(state));
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), state);
  assert.equal(getStats(restored).completed, 1);
});

test("imports reject unrelated data and sanitize malformed or excessive fields", () => {
  for (const raw of [
    "{",
    "[]",
    "{}",
    '{"version":2}',
    "x".repeat(MAX_BACKUP_BYTES + 1),
  ])
    assert.throws(() => parseStudy(raw));
  const restored = parseStudy(
    JSON.stringify({
      ...emptyStudy,
      name: " ",
      activeTaskId: "unknown",
      notes: "x".repeat(50010),
      drafts: {
        "first-query": "x".repeat(20010),
        unknown: "DROP TABLE products",
      },
      progress: {
        "first-query": {
          attempts: -4,
          runs: "3",
          hints: 99,
          independent: true,
          solvedAt: "invalid",
        },
      },
      history: [
        { ...entry, taskId: "unknown" },
        { ...entry, sql: null },
        entry,
      ],
    }),
  );
  assert.equal(restored.name, "Студент");
  assert.equal(restored.activeTaskId, "first-query");
  assert.equal(restored.notes.length, 50000);
  assert.equal(restored.drafts["first-query"].length, 20000);
  assert.equal(restored.drafts.unknown, undefined);
  assert.equal(restored.progress["first-query"].attempts, 0);
  assert.equal(restored.progress["first-query"].hints, 3);
  assert.equal(getStats(restored).independent, 0);
  assert.equal(restored.history.length, 1);
});

test("visiting a task resumes it and draft-only and assisted tasks count as started", () => {
  assert.equal(isTaskStarted(emptyStudy, "first-query"), false);
  const visited = visitTaskState(emptyStudy, "top-prices", entry.date);
  assert.equal(getContinueTask(visited)?.id, "top-prices");
  assert.equal(isTaskStarted(visited, "top-prices"), true);
  assert.equal(visitTaskState(visited, "top-prices", entry.date), visited);
  assert.equal(
    isTaskStarted(
      { ...emptyStudy, drafts: { "first-query": entry.sql } },
      "first-query",
    ),
    true,
  );
  assert.equal(
    isTaskStarted(
      { ...emptyStudy, drafts: { "first-query": tasks[0].starter } },
      "first-query",
    ),
    false,
  );
  assert.equal(
    isTaskStarted(
      {
        ...emptyStudy,
        progress: { "first-query": { ...emptyProgress, hints: 1 } },
      },
      "first-query",
    ),
    true,
  );
  const restored = parseStudy(serializeStudy(visited));
  assert.equal(getContinueTask(restored)?.id, "top-prices");
});

test("continuation wraps to unfinished tasks and ends when all tasks are solved", () => {
  const completed = tasks.reduce(
    (state, task) => recordAttempt(state, { ...entry, taskId: task.id }),
    emptyStudy,
  );
  assert.equal(getContinueTask(completed), undefined);
  assert.equal(getNextTask(completed, tasks.at(-1)!.id), undefined);
  const repeat = restartTaskState(completed, "premium-products", entry.date);
  assert.equal(getNextTask(repeat, tasks.at(-1)!.id)?.id, "premium-products");
  assert.equal(getContinueTask(repeat)?.id, "premium-products");
});

test("restarting one task clears assistance and completion, preserves other work and allows independent completion", () => {
  const assisted = recordAttempt(
    {
      ...emptyStudy,
      notes: "Мой конспект",
      drafts: { "first-query": entry.sql, "top-prices": "SELECT 2;" },
      progress: {
        "first-query": { ...emptyProgress, hints: 2, solutionViewed: true },
      },
    },
    entry,
  );
  const withOther = recordAttempt(assisted, { ...entry, taskId: "top-prices" });
  const repeated = restartTaskState(withOther, "first-query", entry.date);
  assert.equal(repeated.progress["first-query"].solvedAt, null);
  assert.equal(repeated.progress["first-query"].hints, 0);
  assert.equal(repeated.progress["first-query"].solutionViewed, false);
  assert.equal(repeated.drafts["first-query"], tasks[0].starter);
  assert.equal(repeated.drafts["top-prices"], "SELECT 2;");
  assert.equal(
    repeated.progress["top-prices"],
    withOther.progress["top-prices"],
  );
  assert.equal(repeated.history, withOther.history);
  assert.equal(repeated.notes, "Мой конспект");
  assert.equal(
    recordAttempt(repeated, entry).progress["first-query"].independent,
    true,
  );
});

test("backups omit storage errors and remain importable with long non-ASCII queries", () => {
  const state = {
    ...emptyStudy,
    storageIssue: "Unavailable",
    history: Array.from({ length: 100 }, (_, i) => ({
      ...entry,
      id: String(i),
      sql: "Ж".repeat(20000),
    })),
  };
  const exported = serializeStudy(state);
  assert.ok(Buffer.byteLength(exported) > 4_000_000);
  assert.ok(Buffer.byteLength(exported) < MAX_BACKUP_BYTES);
  assert.equal(parseStudy(exported).storageIssue, null);
  assert.equal(parseStudy(exported).history.length, 100);
  assert.throws(() => parseStudy("{broken"), /Не удалось прочитать JSON/);
});
