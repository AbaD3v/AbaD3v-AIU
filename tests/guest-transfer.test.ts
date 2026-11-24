import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeGuestStudy } from "../app/lib/accounts/guest-study";
import { practiceAccountHref, suggestEmailAddress } from "../app/lib/accounts/registration";
import { tasks } from "../app/lib/sql/course";
import { emptyProgress, emptyStudy, type HistoryEntry, type StudyState } from "../app/lib/sql/progress";

test("only existing practice tasks are preserved in registration links", () => {
  assert.equal(practiceAccountHref("/practice/first-query/"), "/account/?task=first-query");
  assert.equal(practiceAccountHref("/practice/missing/"), "/account/");
  assert.equal(practiceAccountHref("//other.test/practice/first-query/"), "/account/");
  assert.equal(practiceAccountHref("/practice/first-query/extra"), "/account/");
});

test("email suggestion fixes a recognized domain typo only", () => {
  assert.equal(suggestEmailAddress(" Student@gmial.com "), "Student@gmail.com");
  assert.equal(suggestEmailAddress("student@school.edu"), null);
  assert.equal(suggestEmailAddress("bad@@gmial.com"), null);
  assert.equal(suggestEmailAddress("bad address@gmial.com"), null);
});

test("copying guest progress preserves current work and is safe to repeat", () => {
  const first = tasks[0].id;
  const second = tasks[1].id;
  const solvedAt = "2026-11-24T20:00:00.000Z";
  const attempt: HistoryEntry = {
    id: "guest-query", taskId: first, sql: "SELECT 1", action: "check",
    success: true, rows: 1, elapsed: 1, date: solvedAt,
  };
  const account: StudyState = {
    ...emptyStudy,
    name: "Existing student",
    drafts: { [first]: "SELECT 'account'" },
    notes: "Account notes",
    progress: { [first]: { ...emptyProgress, runs: 3, attempts: 3 } },
  };
  const guest: StudyState = {
    ...emptyStudy,
    drafts: { [first]: "SELECT 'guest'", [second]: "SELECT 'new'" },
    progress: { [first]: { ...emptyProgress, solvedAt, independent: true, runs: 2, attempts: 2 } },
    history: [attempt],
    notes: "Guest notes",
  };

  const merged = mergeGuestStudy(account, guest);
  assert.equal(merged.name, "Existing student");
  assert.equal(merged.notes, "Account notes");
  assert.equal(merged.drafts[first], account.drafts[first]);
  assert.equal(merged.drafts[second], guest.drafts[second]);
  assert.equal(merged.progress[first].solvedAt, solvedAt);
  assert.equal(merged.progress[first].runs, 3);
  assert.equal(merged.progress[first].independent, true);
  assert.deepEqual(merged.history, [attempt]);
  assert.deepEqual(mergeGuestStudy(merged, guest), merged);
});
