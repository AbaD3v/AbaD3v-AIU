import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { getQuizQuestions, saveQuizQuestions, subscribeQuizQuestions, validateQuizQuestions } from "../app/lib/sql/quiz";
import { refreshAccounts } from "../app/lib/accounts/store";
import { tasks } from "../app/lib/sql/course";

test("quiz overrides persist, replace deleted questions, disable quizzes and require a current admin", () => {
  const records = new Map<string, string>();
  const sessions = new Map<string, string>();
  const localStorage = { getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => { records.set(key, value); } };
  const browser = Object.assign(new EventTarget(), { localStorage,
    sessionStorage: { getItem: (key: string) => sessions.get(key) ?? null,
      removeItem: (key: string) => sessions.delete(key) } });
  Object.defineProperty(globalThis, "window", { value: browser, configurable: true });
  const id = "12345678-1234-1234-1234-123456789abc";
  const admin = { id, name: "Admin", login: "admin", role: "admin", blocked: false,
    salt: "0".repeat(32), hash: "0".repeat(64) };
  records.set("codeproof.accounts.v1", JSON.stringify([admin]));
  sessions.set("codeproof.session.v1", id);
  refreshAccounts();
  let notifications = 0;
  const unsubscribe = subscribeQuizQuestions(() => { notifications++; });
  const readAfterReload = (taskId: string) => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import { readFileSync } from 'node:fs';
      import { getQuizQuestions } from './app/lib/sql/quiz.ts';
      const { records, taskId } = JSON.parse(readFileSync(0, 'utf8'));
      const storage = new Map(records);
      globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null } };
      process.stdout.write(JSON.stringify(getQuizQuestions(taskId)));
    `], { input: JSON.stringify({ records: [...records], taskId }), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  try {
    for (const task of tasks) assert.ok(getQuizQuestions(task.id).length > 0);
    const taskId = tasks[0].id;
    const source = getQuizQuestions(taskId);
    const edited = [{ ...source[0], id: "edited", prompt: "Правка администратора", correctIndex: 1 },
      { ...source[0], id: "to-delete" }];
    saveQuizQuestions(taskId, edited);
    assert.deepEqual(getQuizQuestions(taskId), edited);
    assert.equal(notifications, 1);
    saveQuizQuestions(taskId, [edited[0]]);
    assert.deepEqual(readAfterReload(taskId), [edited[0]]);
    // Reconstruct browser storage as after a reload, with no reliance on emitted events.
    const persisted = new Map(records);
    browser.localStorage = { ...localStorage, getItem: (key) => persisted.get(key) ?? null };
    assert.deepEqual(getQuizQuestions(taskId).map((q) => q.id), ["edited"]);
    assert.deepEqual(validateQuizQuestions(JSON.parse(persisted.get(`codeproof.quiz.v1.${taskId}`)!)), [edited[0]]);
    browser.localStorage = localStorage;
    saveQuizQuestions(taskId, []);
    assert.deepEqual(getQuizQuestions(taskId), []);
    assert.deepEqual(readAfterReload(taskId), []);
    assert.equal(records.get(`codeproof.quiz.v1.${taskId}`), "[]");
    assert.ok(getQuizQuestions(tasks[1].id).length > 0);
    assert.deepEqual(getQuizQuestions("unknown"), []);
    assert.throws(() => saveQuizQuestions("unknown", []), /не найдено/);
    for (const changes of [{ correctIndex: -1 }, { correctIndex: 0.5 }, { correctIndex: 3 },
      { prompt: " " }, { options: ["one"] }, { options: ["one", " "] }, { explanation: null }]) {
      assert.throws(() => saveQuizQuestions(taskId, [{ ...edited[0], ...changes }] as never));
    }
    assert.throws(() => saveQuizQuestions(taskId, [edited[0], edited[0]]), /уникальный/);
    assert.equal(validateQuizQuestions([{ ...edited[0], explanation: undefined }])[0].explanation, "");
    records.set(`codeproof.quiz.v1.${taskId}`, "invalid");
    assert.deepEqual(getQuizQuestions(taskId), []);
    records.delete(`codeproof.quiz.v1.${taskId}`);
    assert.deepEqual(getQuizQuestions(taskId), source);
    browser.localStorage = { ...localStorage, setItem: () => { throw new Error("quota"); } };
    assert.throws(() => saveQuizQuestions(taskId, []), /Не удалось сохранить/);
    assert.deepEqual(getQuizQuestions(taskId), source);
    browser.localStorage = localStorage;
    // Role changes must be re-read at save time, even without a storage event.
    records.set("codeproof.accounts.v1", JSON.stringify([{ ...admin, role: "student" }]));
    assert.throws(() => saveQuizQuestions(taskId, []), /администратора/);
    records.set("codeproof.accounts.v1", JSON.stringify([{ ...admin, blocked: true }]));
    assert.throws(() => saveQuizQuestions(taskId, []), /администратора/);
    sessions.clear();
    assert.throws(() => saveQuizQuestions(taskId, []), /администратора/);
  } finally { unsubscribe(); Reflect.deleteProperty(globalThis, "window"); }
});
