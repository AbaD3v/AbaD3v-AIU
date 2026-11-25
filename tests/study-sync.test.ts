import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://study.test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

function memoryStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  };
}

test("cloud study recovers writes, detects conflicts and isolates guest and account saves", async () => {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  Object.defineProperty(globalThis, "window", { configurable: true, value: Object.assign(new EventTarget(), {
    localStorage, sessionStorage, location: { pathname: "/", hash: "", origin: "http://localhost" },
  }) });
  const { getSupabase } = await import("../app/lib/supabase/client");
  const { refreshAccounts } = await import("../app/lib/accounts/store");
  const { emptyStudy, serializeStudy } = await import("../app/lib/sql/progress");
  const store = await import("../app/lib/sql/store");
  const client = getSupabase();
  let account: string | null = "student-a";
  type Row = { revision: string; state: typeof emptyStudy };
  const rows = new Map<string, Row>();
  let failRead = false;
  let failWrite = false;
  let loseResponse = false;
  let duringWrite: (() => void) | undefined;
  let delayRead: Promise<void> | undefined;
  let reads = 0;
  let writes = 0;
  client.auth.getSession = async () => ({ data: { session: account ? { user: { id: account } } : null }, error: null }) as Awaited<ReturnType<typeof client.auth.getSession>>;
  client.from = ((table: string) => {
    const filters: Record<string, string> = {};
    let payload: Row & { user_id?: string };
    let operation = "read";
    const query = {
      select() { return query; },
      eq(key: string, value: string) { filters[key] = value; return query; },
      upsert(value: typeof payload) { operation = "insert"; payload = value; return query; },
      update(value: typeof payload) { operation = "update"; payload = value; return query; },
      single() { return query.maybeSingle(); },
      async maybeSingle() {
        if (table === "codeproof_profiles") return { data: { id: account, name: account, role: "student", blocked: false }, error: null };
        if (table !== "codeproof_study") return { data: null, error: null };
        const id = filters.user_id ?? payload?.user_id;
        const row = rows.get(id!);
        if (operation === "read") {
          reads++;
          const delay = delayRead;
          delayRead = undefined;
          await delay;
          return { data: failRead ? null : row ?? null, error: failRead ? new Error("offline") : null };
        }
        writes++;
        if (failWrite) return { data: null, error: new Error("offline") };
        const matches = operation === "insert" ? !row : row?.revision === filters.revision;
        if (matches) rows.set(id!, { revision: payload.revision, state: structuredClone(payload.state) });
        duringWrite?.();
        duringWrite = undefined;
        if (loseResponse) { loseResponse = false; return { data: null, error: new Error("response lost") }; }
        return { data: matches ? { revision: payload.revision } : null, error: null };
      },
    };
    return query;
  }) as unknown as typeof client.from;
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
  const readState = () => {
    let result = emptyStudy;
    store.updateStudy((state) => { result = state; return state; });
    return result;
  };
  const switchAccount = async (id: string | null) => {
    account = id;
    await refreshAccounts();
    store.getStudySyncStatus();
    await settle();
  };
  try {
    await switchAccount(null);
    store.updateStudy((state) => ({ ...state, notes: "guest notes" }));
    assert.equal(store.getStudySyncStatus(), "local");

    failRead = true;
    await switchAccount("student-a");
    assert.equal(store.getStudySyncStatus(), "load-error");
    store.updateStudy((state) => ({ ...state, notes: "must not replace unread cloud data" }));
    failRead = false;
    const previousReads = reads;
    store.retryStudySync();
    store.retryStudySync();
    await settle();
    assert.equal(reads - previousReads, 1, "concurrent load retries are coalesced");
    assert.equal(store.getStudySyncStatus(), "synced");
    assert.equal(readState().notes, "");

    store.saveDraft("first-query", "SELECT name, price FROM products;");
    store.addAttempt({ taskId: "first-query", sql: "SELECT name, price FROM products;", action: "check", success: true, rows: 10, elapsed: 1 });
    store.updateStudy((state) => ({ ...state, notes: "account notes" }));
    duringWrite = () => store.updateStudy((state) => ({ ...state, notes: "edited during save" }));
    await store.flushStudy();
    assert.equal(store.getStudySyncStatus(), "synced");
    assert.equal(rows.get("student-a")!.state.notes, "edited during save");
    assert.ok(rows.get("student-a")!.state.progress["first-query"].solvedAt);
    assert.equal(rows.get("student-a")!.state.history.length, 1);
    assert.match(rows.get("student-a")!.state.drafts["first-query"], /SELECT/);

    loseResponse = true;
    store.updateStudy((state) => ({ ...state, notes: "committed without acknowledgement" }));
    await assert.rejects(store.flushStudy(), /не синхронизирован/);
    assert.equal(store.getStudySyncStatus(), "save-error");
    await store.flushStudy();
    assert.equal(store.getStudySyncStatus(), "synced", "idempotent verification recognizes an already committed revision");

    failWrite = true;
    store.updateStudy((state) => ({ ...state, notes: "offline recovery" }));
    await assert.rejects(store.flushStudy());
    await switchAccount("student-b");
    assert.equal(readState().notes, "");
    await switchAccount(null);
    assert.equal(readState().notes, "guest notes");
    failWrite = false;
    await switchAccount("student-a");
    await store.flushStudy();
    assert.equal(rows.get("student-a")!.state.notes, "offline recovery", "pending data survives reinitializing the account store");

    store.updateStudy((state) => ({ ...state, notes: "local conflict copy" }));
    rows.set("student-a", { revision: "other-device", state: { ...emptyStudy, notes: "other device notes" } });
    await assert.rejects(store.flushStudy());
    assert.equal(store.getStudySyncStatus(), "conflict");
    store.replaceStudy({ ...readState(), storageIssue: null });
    assert.match(readState().storageIssue!, /другом устройстве/, "import or reset cannot hide conflict recovery actions");
    assert.equal(JSON.parse(serializeStudy(readState())).notes, "local conflict copy", "export contains the unsaved local version");
    const writesBeforeRetry = writes;
    store.retryStudySync();
    await settle();
    assert.equal(writes, writesBeforeRetry, "retry never overwrites a conflicting cloud version");
    await switchAccount(null);
    await switchAccount("student-a");
    assert.equal(store.getStudySyncStatus(), "conflict", "recovery does not silently discard conflict data");
    assert.equal(readState().notes, "local conflict copy");
    failRead = true;
    await assert.rejects(store.reloadStudyFromCloud());
    assert.equal(readState().notes, "local conflict copy", "failed cloud replacement retains exportable work");
    failRead = false;
    await store.reloadStudyFromCloud();
    assert.equal(readState().notes, "other device notes");
    assert.equal(store.getStudySyncStatus(), "synced");
    await switchAccount(null);
    await switchAccount("student-a");
    assert.equal(readState().notes, "other device notes");
    assert.equal(sessionStorage.getItem("codeproof.sql.v1.account.student-a.pending"), null);

    await switchAccount(null);
    let releaseRead!: () => void;
    delayRead = new Promise<void>((resolve) => { releaseRead = resolve; });
    await switchAccount("student-a");
    assert.equal(store.getStudySyncStatus(), "loading");
    await switchAccount("student-b");
    releaseRead();
    await settle();
    assert.equal(readState().notes, "", "a delayed account A response cannot replace account B state");
    assert.equal(store.getStudySyncStatus(), "synced");
  } finally {
    await client.auth.stopAutoRefresh();
    Reflect.deleteProperty(globalThis, "window");
  }
});
