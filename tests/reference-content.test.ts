import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import React from "react";
import { tasks } from "../app/lib/sql/course";
import { resolveReferenceCard } from "../app/lib/sql/reference";
import {
  MAX_NAME_LENGTH, mergeNameChanges, nameDefaults, nameGroups,
  referenceCardFields, referenceCardKey, resolveName, type NameValues,
} from "../app/lib/site-names/registry";
import { saveSiteNames, siteNamesStorageKey, useNameValues } from "../app/lib/site-names/store";

test("reference defaults follow training database names and explicit edits survive until reset", () => {
  const task = { ...tasks[0], theory: "Таблица customers, поле name." };
  const config = { names: { customers: "clients", name: "display_name" }, rows: {} };
  const defaults = resolveReferenceCard(task, {}, config);
  assert.equal(defaults.theory, "Таблица clients, поле display_name.");
  assert.match(defaults.example, /"clients"/);
  assert.match(defaults.example, /"display_name"/);
  const exampleKey = referenceCardKey(task.id, "example");
  const theoryKey = referenceCardKey(task.id, "theory");
  const values = { [exampleKey]: "SELECT 'customers.name' AS note;", [theoryKey]: "Авторское объяснение customers.name" };
  const edited = resolveReferenceCard(task, values, config);
  assert.equal(edited.example, values[exampleKey]);
  assert.equal(edited.theory, values[theoryKey]);
  assert.deepEqual(resolveReferenceCard(task, mergeNameChanges(values, { [exampleKey]: null, [theoryKey]: null }), config), defaults);
});

test("all reference cards have independent defaults and title fallback follows renamed tasks", () => {
  assert.equal(tasks.length, 15);
  const labelKeys = new Set(nameGroups.flatMap((group) => group.fields.map((field) => field.key)));
  for (const task of tasks) {
    for (const field of referenceCardFields) {
      const key = referenceCardKey(task.id, field);
      assert.ok(nameDefaults.has(key));
      assert.equal(resolveName(key, {}), field === "tags" ? task.tags.join(" / ") : task[field]);
      assert.equal(labelKeys.has(key), false, "card fields use the dedicated multiline editor");
      assert.match(key, /^[A-Za-z0-9._-]{1,128}$/);
    }
  }

  const taskKey = `task.${tasks[0].id}` as const;
  const titleKey = referenceCardKey(tasks[0].id, "title");
  const values: NameValues = { [taskKey]: "Название задания", [titleKey]: "Отдельная карточка" };
  assert.equal(resolveName(titleKey, values), "Отдельная карточка");
  assert.equal(resolveName(taskKey, values), "Название задания");
  assert.equal(resolveName(titleKey, mergeNameChanges(values, { [titleKey]: null })), "Название задания");
});

test("reference edits persist locally, reset after reload and reject invalid or unauthorized batches", async (context) => {
  context.mock.method(React, "useSyncExternalStore", <T>(_subscribe: unknown, getSnapshot: () => T) => getSnapshot());
  const records = new Map<string, string>();
  const sessions = new Map<string, string>();
  const storage = {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => { records.set(key, value); },
    removeItem: (key: string) => { records.delete(key); },
  };
  const browser = Object.assign(new EventTarget(), {
    localStorage: storage,
    sessionStorage: { getItem: (key: string) => sessions.get(key) ?? null,
      removeItem: (key: string) => { sessions.delete(key); } },
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  const admin = { id: "12345678-1234-1234-1234-123456789abc", name: "Admin", login: "admin",
    role: "admin", blocked: false, salt: "0".repeat(32), hash: "0".repeat(64) };
  records.set("codeproof.accounts.v1", JSON.stringify([admin]));
  sessions.set("codeproof.session.v1", admin.id);
  const title = referenceCardKey("first-query", "title");
  const tags = referenceCardKey("first-query", "tags");
  const theory = referenceCardKey("first-query", "theory");
  const example = referenceCardKey("first-query", "example");
  const readAfterReload = () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import { readFileSync } from 'node:fs';
      import React from 'react';
      React.useSyncExternalStore = (_subscribe, snapshot) => snapshot();
      const records = new Map(JSON.parse(readFileSync(0, 'utf8')));
      globalThis.window = { localStorage: { getItem: key => records.get(key) ?? null } };
      const { useNameValues } = await import('./app/lib/site-names/store.ts');
      process.stdout.write(JSON.stringify(useNameValues()));
    `], { input: JSON.stringify([...records]), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout) as NameValues;
  };

  try {
    const changes = { [title]: "  Выбор столбцов  ", [tags]: "SELECT / FROM",
      [theory]: "Первая строка.\nВторая строка.", [example]: "SELECT name\nFROM customers;", "site.name": "Учебный сайт" };
    await saveSiteNames(changes);
    assert.equal(useNameValues()[title], "Выбор столбцов");
    assert.equal(readAfterReload()[example], changes[example]);
    assert.equal(readAfterReload()[theory], changes[theory]);

    await saveSiteNames({ [theory]: "я".repeat(MAX_NAME_LENGTH) });
    const before = records.get(siteNamesStorageKey);
    for (const invalid of [
      { [title]: "Не сохранять часть", [theory]: " " },
      { [title]: "Не сохранять часть", [example]: "x".repeat(MAX_NAME_LENGTH + 1) },
      { "reference.card.unknown.title": "Нет такой карточки" },
    ]) {
      await assert.rejects(saveSiteNames(invalid));
      assert.equal(records.get(siteNamesStorageKey), before, "an invalid field rejects the whole batch");
    }

    browser.localStorage = { ...storage, setItem: () => { throw new Error("quota"); } };
    await assert.rejects(saveSiteNames({ [title]: "Не сохранится" }), /Не удалось сохранить/);
    assert.equal(useNameValues()[title], "Выбор столбцов");
    browser.localStorage = storage;
    await saveSiteNames({ [title]: null, [tags]: null, [theory]: null, [example]: null });
    const reset = readAfterReload();
    assert.equal(reset[title], undefined);
    assert.equal(reset[example], undefined);
    assert.equal(reset["site.name"], "Учебный сайт", "reset only affects this card");
    assert.equal(resolveName(example, reset), tasks[0].example);

    for (const account of [{ ...admin, role: "student" }, { ...admin, blocked: true }]) {
      records.set("codeproof.accounts.v1", JSON.stringify([account]));
      sessions.set("codeproof.session.v1", admin.id);
      await assert.rejects(saveSiteNames({ [title]: "Запрещено" }), /администратора/);
    }
    sessions.clear();
    await assert.rejects(saveSiteNames({ [title]: "Запрещено" }), /администратора/);
    assert.deepEqual(useNameValues(), reset);
  } finally {
    Reflect.deleteProperty(globalThis, "window");
  }
});
