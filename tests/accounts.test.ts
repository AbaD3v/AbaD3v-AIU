import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getAccounts,
  registerStudent,
  setupDemoAdmin,
  setStudentBlocked,
  signIn,
  signOut,
  subscribeAccounts,
} from "../app/lib/accounts/store";
import {
  addAttempt,
  getStudyScope,
  readStudentStudy,
  updateStudy,
} from "../app/lib/sql/store";
import { getStats } from "../app/lib/sql/progress";

function memoryStorage() {
  const records = new Map<string, string>();
  return {
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => records.set(key, value),
    removeItem: (key: string) => records.delete(key),
  };
}

test("student progress stays separate and only the demo admin can suspend or restore a student's login", async () => {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const browser = Object.assign(new EventTarget(), {
    localStorage,
    sessionStorage,
  });
  Object.defineProperty(globalThis, "window", {
    value: browser,
    configurable: true,
  });
  const unsubscribe = subscribeAccounts(() => {});
  const student = {
    name: "Учебный студент",
    login: "learner",
    password: "sql-demo-only",
  };
  const admin = {
    name: "Демо администратор",
    login: "manager",
    password: "admin-demo-only",
  };
  const guestKey = getStudyScope();
  try {
    updateStudy((current) => ({ ...current, notes: "гостевой черновик" }));
    await registerStudent(student);
    await assert.rejects(
      registerStudent({ ...student, login: "Learner" }),
      /уже занят/,
    );
    await assert.rejects(signIn(student.login, "wrong-pass"), /Неверный/);
    assert.equal(await signIn(student.login, student.password), "student");
    const studentId = getAccounts().active!.id;
    const studentKey = getStudyScope();
    assert.notEqual(studentKey, guestKey);
    assert.throws(
      () => setStudentBlocked(studentId, true),
      /Нужен аккаунт администратора/,
    );
    assert.equal(readStudentStudy(studentId), null);
    addAttempt({
      taskId: "first-query",
      sql: "SELECT name, price FROM products;",
      action: "check",
      success: true,
      rows: 12,
      elapsed: 1,
    });
    signOut();
    assert.equal(getStudyScope(), guestKey);
    assert.equal(
      JSON.parse(localStorage.getItem(guestKey)!).notes,
      "гостевой черновик",
    );
    await setupDemoAdmin(admin);
    await assert.rejects(
      setupDemoAdmin({ ...admin, login: "another" }),
      /уже создан/,
    );
    assert.equal(await signIn(admin.login, admin.password), "admin");
    assert.equal(getAccounts().students.length, 1);
    assert.equal(getStats(readStudentStudy(studentId)!).completed, 1);
    assert.ok(
      !localStorage
        .getItem("codeproof.accounts.v1")!
        .includes(student.password),
    );
    setStudentBlocked(studentId, true);
    signOut();
    await assert.rejects(
      signIn(student.login, student.password),
      /приостановлен/,
    );
    assert.equal(getAccounts().active, null);
    await signIn(admin.login, admin.password);
    setStudentBlocked(studentId, false);
    signOut();
    await signIn(student.login, student.password);
    assert.equal(getStudyScope(), studentKey);
    assert.ok(
      JSON.parse(localStorage.getItem(studentKey)!).progress["first-query"]
        .solvedAt,
    );

    // A change from another tab invalidates a live student session.
    const accounts = JSON.parse(localStorage.getItem("codeproof.accounts.v1")!);
    accounts.find(
      (account: { id: string }) => account.id === studentId,
    ).blocked = true;
    localStorage.setItem("codeproof.accounts.v1", JSON.stringify(accounts));
    browser.dispatchEvent(
      Object.assign(new Event("storage"), { key: "codeproof.accounts.v1" }),
    );
    assert.equal(getAccounts().active, null);
    assert.equal(getStudyScope(), guestKey);
  } finally {
    unsubscribe();
    Reflect.deleteProperty(globalThis, "window");
  }
});
