import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { referenceCardFields, referenceCardKey, resolveName } from "../app/lib/site-names/registry";
import { tasks } from "../app/lib/sql/course";

test("cloud reference batches reload public content, preserve cache on failure and round-trip reset", async (context) => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://reference-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";
  context.mock.method(React, "useSyncExternalStore", <T>(_subscribe: unknown, getSnapshot: () => T) => getSnapshot());
  const records = new Map<string, string>();
  const storage = { getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => { records.set(key, value); },
    removeItem: (key: string) => { records.delete(key); } };
  Object.defineProperty(globalThis, "window", { configurable: true,
    value: Object.assign(new EventTarget(), { localStorage: storage, sessionStorage: storage,
      location: { pathname: "/", hash: "", href: "http://localhost/" } }) });
  const { getSupabase } = await import("../app/lib/supabase/client");
  const { refreshAccounts } = await import("../app/lib/accounts/store");
  const { refreshCloudNames, saveSiteNames, useNameValues, useNamesLoadStatus } = await import("../app/lib/site-names/store");
  const client = getSupabase();
  let role = "admin";
  let signedIn = true;
  let failWrite = false;
  let failRead = false;
  const remote = new Map<string, string | null>();
  // Older keys still occupy rows in the public query, before the reference cards.
  for (let index = 0; index < 500; index++) remote.set(`legacy.${index}`, "Старое название");
  let writes = 0;
  let lastBatch: { key: string; value: string | null }[] = [];
  const userId = "12345678-1234-1234-1234-123456789abc";
  client.auth.getSession = (async () => ({ data: { session: signedIn ? { user: { id: userId, email: "admin@example.com" } } : null }, error: null })) as typeof client.auth.getSession;
  client.from = ((table: string) => {
    if (table === "codeproof_site_names") return {
      select: () => ({
        order: (column: string) => {
          assert.equal(column, "key");
          return {
            range: async (from: number, to: number) => {
              if (failRead && from > 0) return { data: null, error: new Error("offline") };
              const rows = [...remote].sort(([a], [b]) => a.localeCompare(b)).slice(from, to + 1);
              return { data: rows.map(([key, value]) => ({ key, value })), error: null };
            },
          };
        },
      }),
      upsert: async (rows: typeof lastBatch) => {
        writes++;
        lastBatch = rows;
        if (failWrite) return { error: new Error("offline") };
        for (const { key, value } of rows) remote.set(key, value);
        return { error: null };
      },
    };
    const query = {
      select: () => query, eq: () => query, order: () => query, range: () => query,
      returns: async () => ({ data: [], error: null }),
      single: async () => ({ data: { id: userId, name: "Admin", role, blocked: false }, error: null }),
    };
    return query;
  }) as unknown as typeof client.from;
  const title = referenceCardKey("first-query", "title");
  const example = referenceCardKey("first-query", "example");

  try {
    await refreshAccounts();
    await refreshCloudNames();
    assert.equal(useNamesLoadStatus(), "ready");
    const changes = Object.fromEntries(referenceCardFields.map((field) => [referenceCardKey("first-query", field), `Правка ${field}\nSQL` ]));
    await saveSiteNames(changes);
    assert.equal(writes, 1, "all four card fields use a single database batch");
    assert.equal(lastBatch.length, 4);
    await refreshCloudNames();
    assert.equal(useNameValues()[example], changes[example]);
    assert.equal(useNameValues()[title], changes[title]);

    const before = useNameValues();
    failWrite = true;
    await assert.rejects(saveSiteNames({ [title]: "Новая версия", [example]: "SELECT 1;" }), /Не удалось сохранить/);
    assert.deepEqual(useNameValues(), before, "failed publication does not change the visible snapshot");
    assert.equal(remote.get(title), before[title]);
    failWrite = false;
    failRead = true;
    await refreshCloudNames();
    assert.equal(useNamesLoadStatus(), "error");
    assert.deepEqual(useNameValues(), before, "failed refresh retains published content");
    failRead = false;

    remote.set(title, "Из другого браузера");
    remote.set("reference.card.unknown.title", "Неизвестная карточка");
    await refreshCloudNames();
    assert.equal(useNameValues()[title], "Из другого браузера", "loads the reference card from the second page");
    assert.equal(useNameValues()["reference.card.unknown.title"], undefined);
    await saveSiteNames(Object.fromEntries(referenceCardFields.map((field) => [referenceCardKey("first-query", field), null])));
    assert.ok(lastBatch.every((row) => row.value === null));
    await refreshCloudNames();
    assert.equal(useNameValues()[title], undefined);
    assert.equal(resolveName(example, useNameValues()), tasks[0].example);

    const beforeInvalid = writes;
    await assert.rejects(saveSiteNames({ [example]: "x".repeat(2001) }), /2000/);
    await assert.rejects(saveSiteNames({ [title]: " " }));
    await assert.rejects(saveSiteNames({ "reference.card.unknown.title": "Неизвестная карточка" }));
    role = "student";
    await refreshAccounts();
    await assert.rejects(saveSiteNames({ [title]: "Запрещено" }), /администратора/);
    signedIn = false;
    await refreshAccounts();
    await assert.rejects(saveSiteNames({ [title]: "Запрещено" }), /администратора/);
    assert.equal(writes, beforeInvalid, "invalid input and non-admin users cannot send writes");
  } finally {
    client.auth.stopAutoRefresh();
    Reflect.deleteProperty(globalThis, "window");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  }
});
