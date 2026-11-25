import assert from "node:assert/strict";
import { test } from "node:test";
import { tasks } from "../app/lib/sql/course";
import { restartTaskState, emptyStudy } from "../app/lib/sql/progress";
import { lessonContentGroups, lessonFieldKey } from "../app/lib/site-names/practice-lesson";
import { mergeNameChanges, resolveName } from "../app/lib/site-names/registry";

test("published lesson material can be reset independently of other editors and grading SQL", () => {
  for (const group of lessonContentGroups) {
    for (const field of group.fields) {
      assert.equal(resolveName(field.key, {}), field.original, field.key);
    }
  }
  const task = tasks[0];
  const starter = lessonFieldKey(task.id, "starter");
  const solution = lessonFieldKey(task.id, "solution");
  const hint = lessonFieldKey(task.id, "hint.1");
  const published = mergeNameChanges({ "reference.heading": "SQL" }, {
    [hint]: "Подумайте о столбцах.", [starter]: "SELECT 7;", [solution]: "SELECT 8;",
  });
  assert.equal(resolveName(hint, published), "Подумайте о столбцах.");
  assert.equal(resolveName(solution, published), "SELECT 8;");
  assert.notEqual(task.solution, published[solution]);
  const restarted = restartTaskState(emptyStudy, task.id, "2026-01-01", resolveName(starter, published));
  assert.equal(restarted.drafts[task.id], "SELECT 7;");
  const restored = mergeNameChanges(published, { [hint]: null });
  assert.equal(resolveName(hint, restored), task.hints[0]);
  assert.equal(resolveName(starter, restored), "SELECT 7;");
  assert.equal(resolveName("reference.heading", restored), "SQL");
});
