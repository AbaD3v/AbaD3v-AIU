import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

test("cloud quiz results retry durably, serialize completions and isolate accounts", async (context) => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://quiz-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";
  const records = new Map<string, string>();
  const storage = {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => { records.set(key, value); },
    removeItem: (key: string) => { records.delete(key); },
  };
  Object.defineProperty(globalThis, "window", { configurable: true,
    value: Object.assign(new EventTarget(), { localStorage: storage, sessionStorage: storage,
      location: { pathname: "/", hash: "", href: "http://localhost/" } }) });

  const { getSupabase } = await import("../app/lib/supabase/client");
  const { refreshAccounts } = await import("../app/lib/accounts/store");
  const { getStudyScope } = await import("../app/lib/sql/store");
  const { completeQuiz, flushQuizResults, getQuizSyncStatus, readCloudQuizResult,
    readPendingQuizResult, retryQuizResultSync, saveCloudQuizResult, subscribeQuizResults, quizResultKey } = await import("../app/quiz/results");
  const { getQuizQuestions, refreshCloudQuestions } = await import("../app/lib/sql/quiz");
  const client = getSupabase();
  type Row = { user_id: string; task_id: string; score: number; question_count: number; completed_at: string };
  const remote = new Map<string, Row>();
  let userId: string | null = "12345678-1234-1234-1234-123456789abc";
  let writeError = false;
  let responseLost = false;
  let readError = false;
  let holdWrite: Promise<void> | undefined;
  let holdRead: Promise<void> | undefined;
  let writes = 0;
  let unsubscribe: (() => void) | undefined;
  client.auth.getSession = (async () => ({ data: { session: userId ? { user: { id: userId, email: "student@example.com" } } : null }, error: null })) as typeof client.auth.getSession;
  client.from = ((table: string) => {
    if (table === "codeproof_quizzes") {
      return { select: async () => ({ data: [], error: null }) };
    }
    const filters = new Map<string, unknown>();
    let payload: Partial<Row> | undefined;
    let insert = false;
    let requestSignal: AbortSignal | undefined;
    const query = {
      select() { return query; },
      eq(key: string, value: unknown) { filters.set(key, value); return query; },
      update(value: Partial<Row>) { payload = value; return query; },
      upsert(value: Row) { payload = value; insert = true; return query; },
      abortSignal(signal: AbortSignal) { requestSignal = signal; return query; },
      single: async () => ({ data: { id: userId, name: "Student", role: "student", blocked: false }, error: null }),
      maybeSingle: async () => {
        assert.equal(table, "codeproof_quiz_results");
        const id = `${payload?.user_id ?? filters.get("user_id")}:${payload?.task_id ?? filters.get("task_id")}`;
        if (!payload) {
          await holdRead;
          if (requestSignal?.aborted) return { data: null, error: new Error("aborted") };
          if (readError) return { data: null, error: new Error("offline") };
          return { data: remote.get(id) ?? null, error: null };
        }
        writes++;
        await holdWrite;
        if (requestSignal?.aborted) return { data: null, error: new Error("aborted") };
        if (writeError) return { data: null, error: new Error("offline") };
        const previous = remote.get(id);
        if (insert ? previous : previous?.completed_at !== filters.get("completed_at")) return { data: null, error: null };
        const row = { ...previous, ...payload } as Row;
        remote.set(id, row);
        if (responseLost) return { data: null, error: new Error("response lost after commit") };
        return { data: { completed_at: row.completed_at }, error: null };
      },
    };
    return query;
  }) as unknown as typeof client.from;

  try {
    await refreshAccounts();
    await refreshCloudQuestions();
    const scope = getStudyScope();
    const taskId = "first-query";
    const questions = getQuizQuestions(taskId);
    assert.ok(questions.length, "load published questions before completing an attempt");
    const answers = questions.map((question) => question.correctIndex);
    const first = completeQuiz(taskId, questions, answers, scope).result;
    assert.equal(await saveCloudQuizResult(taskId, first, scope), true);
    assert.deepEqual(await readCloudQuizResult(taskId, scope), first);
    assert.equal(getQuizSyncStatus(), "synced");

    const failed = { ...first, score: 0, completedAt: "2090-01-01T00:00:00.000Z" };
    writeError = true;
    assert.equal(await saveCloudQuizResult(taskId, failed, scope), false);
    assert.deepEqual(readPendingQuizResult(taskId, scope), failed);
    assert.equal(getQuizSyncStatus(), "save-error");
    assert.ok([...records].some(([key, value]) => key.endsWith(".pending") && value.includes(failed.completedAt)));
    const reloaded = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import { readFileSync } from 'node:fs';
      const { records, userId, taskId } = JSON.parse(readFileSync(0, 'utf8'));
      const data = new Map(records);
      const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
      globalThis.window = Object.assign(new EventTarget(), { localStorage: storage, sessionStorage: storage, location: { pathname: '/', hash: '', href: 'http://localhost/' } });
      const { getSupabase } = await import('./app/lib/supabase/client.ts');
      const client = getSupabase();
      client.auth.getSession = async () => ({ data: { session: { user: { id: userId } } }, error: null });
      client.from = () => { const query = { select: () => query, eq: () => query, single: async () => ({ data: { id: userId, name: 'Student', role: 'student', blocked: false }, error: null }) }; return query; };
      const { refreshAccounts } = await import('./app/lib/accounts/store.ts');
      await refreshAccounts();
      const { readPendingQuizResult } = await import('./app/quiz/results.ts');
      process.stdout.write(JSON.stringify(readPendingQuizResult(taskId)));
      client.auth.stopAutoRefresh();
    `], { input: JSON.stringify({ records: [...records], userId, taskId }), encoding: "utf8" });
    assert.equal(reloaded.status, 0, reloaded.stderr);
    assert.deepEqual(JSON.parse(reloaded.stdout), failed, "the retry queue survives a page reload");
    await assert.rejects(flushQuizResults(), /не синхронизирован/);
    writeError = false;
    await flushQuizResults();
    assert.deepEqual(await readCloudQuizResult(taskId, scope), failed);
    assert.equal(readPendingQuizResult(taskId, scope), null);

    const unacknowledged = { ...first, completedAt: "2090-01-02T00:00:00.000Z" };
    responseLost = true;
    assert.equal(await saveCloudQuizResult(taskId, unacknowledged, scope), false);
    const writesBeforeRetry = writes;
    responseLost = false;
    await flushQuizResults();
    assert.equal(writes, writesBeforeRetry, "a committed result with a lost acknowledgement is verified without rewriting");

    let release!: () => void;
    holdWrite = new Promise<void>((resolve) => { release = resolve; });
    const slow = { ...first, completedAt: "2090-01-03T00:00:00.000Z" };
    const newer = { ...first, score: 0, completedAt: "2090-01-04T00:00:00.000Z" };
    const saving = saveCloudQuizResult(taskId, slow, scope);
    await new Promise((resolve) => setImmediate(resolve));
    const savingNewer = saveCloudQuizResult(taskId, newer, scope);
    release();
    holdWrite = undefined;
    await Promise.all([saving, savingNewer]);
    assert.deepEqual(await readCloudQuizResult(taskId, scope), newer);
    assert.equal(await saveCloudQuizResult(taskId, slow, scope), true);
    assert.deepEqual(await readCloudQuizResult(taskId, scope), newer, "an older offline attempt cannot replace the last full result");

    readError = true;
    await assert.rejects(readCloudQuizResult(taskId, scope), /Не удалось загрузить/);
    readError = false;
    const pendingBeforeLogout = { ...first, completedAt: "2090-01-05T00:00:00.000Z" };
    writeError = true;
    await saveCloudQuizResult(taskId, pendingBeforeLogout, scope);
    userId = "22345678-1234-1234-1234-123456789abc";
    await refreshAccounts();
    assert.equal(readPendingQuizResult(taskId), null);
    assert.equal(await readCloudQuizResult(taskId, getStudyScope()), null);
    assert.equal(await saveCloudQuizResult(taskId, first, scope), false);
    assert.equal(getQuizSyncStatus(), "synced");
    const otherAccountCompletion = completeQuiz(taskId, questions, answers).result;
    assert.ok(Date.parse(otherAccountCompletion.completedAt) < Date.parse("2090-01-01"), "future timestamps are isolated by account");
    userId = null;
    await refreshAccounts();
    assert.equal(getQuizSyncStatus(), "local");
    assert.equal(completeQuiz(taskId, questions, answers).saved, true);
    userId = "12345678-1234-1234-1234-123456789abc";
    await refreshAccounts();
    assert.deepEqual(readPendingQuizResult(taskId), pendingBeforeLogout);
    writeError = false;
    await flushQuizResults();
    assert.deepEqual(await readCloudQuizResult(taskId, scope), pendingBeforeLogout);

    const key = `${quizResultKey(taskId, scope)}.pending`;
    const otherTab = { ...first, completedAt: "2090-01-06T00:00:00.000Z" };
    records.set(key, JSON.stringify(otherTab));
    await flushQuizResults();
    assert.deepEqual(await readCloudQuizResult(taskId, scope), otherTab, "retry discovers another tab's pending result after initial restoration");

    client.auth.onAuthStateChange = (() => ({ data: { subscription: { unsubscribe() {} } } })) as unknown as typeof client.auth.onAuthStateChange;
    unsubscribe = subscribeQuizResults(() => {});
    await new Promise((resolve) => setImmediate(resolve));
    writeError = true;
    const eventResult = { ...first, completedAt: "2090-01-07T00:00:00.000Z" };
    records.set(key, JSON.stringify(eventResult));
    window.dispatchEvent(Object.assign(new Event("storage"), { key }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(readPendingQuizResult(taskId), eventResult, "storage events recover the latest pending result");
    assert.equal(getQuizSyncStatus(), "save-error");

    records.set(key, JSON.stringify(otherTab));
    retryQuizResultSync();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(readPendingQuizResult(taskId), eventResult, "reconciliation preserves a newer in-memory result");
    userId = "22345678-1234-1234-1234-123456789abc";
    await refreshAccounts();
    const onReentry = { ...first, completedAt: "2090-01-08T00:00:00.000Z" };
    records.set(key, JSON.stringify(onReentry));
    userId = "12345678-1234-1234-1234-123456789abc";
    await refreshAccounts();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(readPendingQuizResult(taskId), onReentry, "account reentry reconciles newly persisted pending results");
    writeError = false;
    await flushQuizResults();
    assert.deepEqual(await readCloudQuizResult(taskId, scope), onReentry);

    const afterFutureServer = completeQuiz(taskId, questions, answers, scope).result;
    assert.ok(Date.parse(afterFutureServer.completedAt) > Date.parse(onReentry.completedAt), "a new full attempt follows the observed server result even when this device's clock is behind");
    assert.equal(await saveCloudQuizResult(taskId, afterFutureServer, scope), true);
    assert.deepEqual(await readCloudQuizResult(taskId, scope), afterFutureServer);

    const secondTaskId = "premium-products";
    const secondQuestions = getQuizQuestions(secondTaskId);
    const secondResult = completeQuiz(secondTaskId, secondQuestions,
      secondQuestions.map((question) => question.correctIndex), scope).result;
    const firstPending = { ...afterFutureServer, completedAt: new Date(Date.parse(afterFutureServer.completedAt) + 1).toISOString() };
    let releaseScopedWrite!: () => void;
    holdWrite = new Promise<void>((resolve) => { releaseScopedWrite = resolve; });
    writeError = true;
    const firstSaving = saveCloudQuizResult(taskId, firstPending, scope);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(getQuizSyncStatus(taskId), "saving");
    assert.equal(getQuizSyncStatus(secondTaskId), "synced", "another task's save must not block loading the current result");
    releaseScopedWrite();
    holdWrite = undefined;
    assert.equal(await firstSaving, false);
    assert.equal(getQuizSyncStatus(taskId), "save-error");
    assert.equal(getQuizSyncStatus(secondTaskId), "synced", "another task's failure must not appear as the current test's error");
    assert.equal(getQuizSyncStatus(), "save-error", "the shell still reports pending results across all tasks");
    assert.equal(await saveCloudQuizResult(secondTaskId, secondResult, scope), false);
    writeError = false;
    const beforeScopedRetry = writes;
    retryQuizResultSync("not-a-task");
    retryQuizResultSync("");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(writes, beforeScopedRetry, "invalid task filters never fall back to retrying every task");
    retryQuizResultSync(secondTaskId);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(writes, beforeScopedRetry + 1, "the current test's retry writes only its own result");
    assert.deepEqual(await readCloudQuizResult(secondTaskId, scope), secondResult);
    assert.equal(getQuizSyncStatus(secondTaskId), "synced");
    assert.equal(getQuizSyncStatus(taskId), "save-error");
    assert.equal(getQuizSyncStatus(), "save-error");
    assert.deepEqual(readPendingQuizResult(taskId, scope), firstPending);
    await flushQuizResults();
    assert.equal(getQuizSyncStatus(), "synced", "global flush still saves all tasks before sign-out");

    context.mock.timers.enable({ apis: ["setTimeout"] });
    holdRead = new Promise<void>(() => {});
    const stalledRead = assert.rejects(readCloudQuizResult(taskId, scope), /не ответил за 15 секунд/);
    await new Promise((resolve) => setImmediate(resolve));
    context.mock.timers.tick(15_000);
    await stalledRead;
    holdRead = undefined;
    assert.deepEqual(await readCloudQuizResult(taskId, scope), firstPending, "loading can retry after a stalled request");

    let releaseTimedOutWrite!: () => void;
    holdWrite = new Promise<void>((resolve) => { releaseTimedOutWrite = resolve; });
    const timedOutResult = completeQuiz(taskId, questions, answers, scope).result;
    const stalledSave = saveCloudQuizResult(taskId, timedOutResult, scope);
    await new Promise((resolve) => setImmediate(resolve));
    context.mock.timers.tick(15_000);
    assert.equal(await stalledSave, false);
    assert.equal(getQuizSyncStatus(taskId), "save-error");
    assert.deepEqual(readPendingQuizResult(taskId, scope), timedOutResult, "a timeout retains the completed attempt for retry");
    holdWrite = undefined;
    await flushQuizResults(taskId);
    assert.equal(getQuizSyncStatus(taskId), "synced");
    assert.deepEqual(await readCloudQuizResult(taskId, scope), timedOutResult);
    releaseTimedOutWrite();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(getQuizSyncStatus(taskId), "synced", "a late aborted response cannot restore a stale error");
    context.mock.timers.reset();
  } finally {
    unsubscribe?.();
    client.auth.stopAutoRefresh();
    Reflect.deleteProperty(globalThis, "window");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  }
});
