import { test } from "node:test";
import assert from "node:assert/strict";
import { compareDraftBackup, MAX_DRAFT_LENGTH, parseDraftBackup } from "../app/lib/sql/draft-recovery";

test("a draft can be restored over its saved base or its preceding in-flight write", () => {
  const backup = parseDraftBackup(JSON.stringify({
    base: null,
    writing: "SELECT 1;",
    value: "SELECT 2;",
  }))!;
  assert.equal(compareDraftBackup(backup, null), "recover");
  assert.equal(compareDraftBackup(backup, "SELECT 1;"), "recover");
  assert.equal(compareDraftBackup(backup, "SELECT 2;"), "saved");
  assert.equal(compareDraftBackup(backup, "SELECT 3;"), "conflict");
});

test("draft recovery distinguishes an empty query from removing a saved draft", () => {
  assert.equal(compareDraftBackup({ base: null, value: "" }, null), "recover");
  assert.equal(compareDraftBackup({ base: "SELECT 1;", value: null }, null), "saved");
});

test("invalid browser recovery copies are ignored", () => {
  assert.equal(parseDraftBackup("{"), undefined);
  assert.equal(parseDraftBackup('{"value":"SELECT 1;"}'), undefined);
  assert.equal(parseDraftBackup(JSON.stringify({
    base: null,
    value: "x".repeat(MAX_DRAFT_LENGTH + 1),
  })), undefined);
});
