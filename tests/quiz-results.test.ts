import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { completeQuiz, quizResultKey, readQuizResult } from "../app/quiz/results";
import { getQuizQuestions } from "../app/lib/sql/quiz";
import { refreshAccounts } from "../app/lib/accounts/store";
import { getStudyScope } from "../app/lib/sql/store";
import { tasks } from "../app/lib/sql/course";

test("completed quiz results survive reload, replace only on completion and isolate guest/accounts/tasks", () => {
  const records = new Map<string, string>();
  const sessions = new Map<string, string>();
  const storage = { getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => { records.set(key, value); } };
  const browser = Object.assign(new EventTarget(), { localStorage: storage,
    sessionStorage: { getItem: (key: string) => sessions.get(key) ?? null,
      removeItem: (key: string) => sessions.delete(key) } });
  Object.defineProperty(globalThis, "window", { value: browser, configurable: true });
  try {
    refreshAccounts();
    const taskId = tasks[0].id;
    const questions = getQuizQuestions(taskId);
    const answers = questions.map((q) => q.correctIndex);
    const guestScope = getStudyScope();
    assert.equal(readQuizResult(taskId), null);
    const first = completeQuiz(taskId, questions, answers);
    assert.equal(first.saved, true);
    assert.equal(first.result.score, questions.length);
    assert.equal(first.result.questionCount, questions.length);
    assert.ok(Number.isFinite(Date.parse(first.result.completedAt)));
    assert.deepEqual(readQuizResult(taskId), first.result);
    assert.equal(records.has(guestScope), false);
    assert.equal(records.has(`codeproof.quiz.v1.${taskId}`), false);
    assert.equal(readQuizResult(tasks[1].id), null);
    const reloaded = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import { readFileSync } from 'node:fs';
      import { readQuizResult } from './app/quiz/results.ts';
      const { entries, taskId, scope } = JSON.parse(readFileSync(0, 'utf8'));
      const records = new Map(entries);
      globalThis.window = { localStorage: { getItem: key => records.get(key) ?? null } };
      process.stdout.write(JSON.stringify(readQuizResult(taskId, scope)));
    `], { input: JSON.stringify({ entries: [...records], taskId, scope: guestScope }), encoding: "utf8" });
    assert.equal(reloaded.status, 0, reloaded.stderr);
    assert.deepEqual(JSON.parse(reloaded.stdout), first.result);
    assert.throws(() => completeQuiz(taskId, questions, answers.slice(1)), /не завершена/);
    assert.deepEqual(readQuizResult(taskId), first.result);
    const second = completeQuiz(taskId, questions, answers.map((a, i) => (a + 1) % questions[i].options.length));
    assert.equal(second.result.score, 0);
    assert.deepEqual(readQuizResult(taskId), second.result);

    const accounts = ["12345678-1234-1234-1234-123456789abc", "22345678-1234-1234-1234-123456789abc"].map((id, i) => ({
      id, name: `Student ${i}`, login: `student${i}`, role: "student", blocked: false,
      salt: "0".repeat(32), hash: "0".repeat(64),
    }));
    records.set("codeproof.accounts.v1", JSON.stringify(accounts));
    for (const account of accounts) {
      sessions.set("codeproof.session.v1", account.id);
      refreshAccounts();
      assert.notEqual(getStudyScope(), guestScope);
      assert.equal(readQuizResult(taskId), null);
      assert.equal(completeQuiz(taskId, questions, answers, guestScope).saved, false);
      assert.equal(completeQuiz(taskId, questions, answers).saved, true);
    }
    sessions.clear();
    refreshAccounts();
    assert.deepEqual(readQuizResult(taskId), second.result);
    browser.localStorage = { ...storage, setItem: () => { throw new Error("quota"); } };
    const failed = completeQuiz(taskId, questions, answers);
    assert.equal(failed.saved, false);
    assert.equal(failed.result.score, questions.length);
    assert.deepEqual(readQuizResult(taskId), second.result);
    browser.localStorage = { ...storage, getItem: () => { throw new Error("blocked"); } };
    assert.equal(readQuizResult(taskId), null);
    assert.deepEqual(getQuizQuestions(taskId), questions);
    browser.localStorage = storage;
    for (const value of ["invalid", "null", "{}", JSON.stringify({ ...first.result, score: -1 }),
      JSON.stringify({ ...first.result, questionCount: 0 }), JSON.stringify({ ...first.result, completedAt: "bad" })]) {
      records.set(quizResultKey(taskId), value);
      assert.equal(readQuizResult(taskId), null);
    }
    assert.throws(() => completeQuiz("unknown", questions, answers));
    assert.throws(() => completeQuiz(taskId, questions, answers.map(() => -1)));
  } finally { Reflect.deleteProperty(globalThis, "window"); }
});
