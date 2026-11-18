"use client";
import { useSiteNames } from "@/app/lib/site-names/store";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, ShieldCheck, UsersRound } from "lucide-react";
import { Modal, PageHeading } from "@/app/components/sql/ui";
import QuizEditor from "@/app/components/sql/quiz-editor";
import SiteNamesEditor from "@/app/components/sql/site-names-editor";
import StudentProgress from "./student-progress";
import {
  setStudentBlocked,
  useAccounts,
  type Account,
} from "@/app/lib/accounts/store";
import { tasks } from "@/app/lib/sql/course";
import { getStats, STORAGE_KEY } from "@/app/lib/sql/progress";
import { readStudentStudy } from "@/app/lib/sql/store";

export default function AdminPage() {
  const name = useSiteNames();
  const { active, ready, students } = useAccounts();
  const isAdmin = active?.role === "admin";
  const [search, setSearch] = useState("");
  const [progressId, setProgressId] = useState<string | null>(null);
  const [target, setTarget] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [, refreshProgress] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(STORAGE_KEY + ".account."))
        refreshProgress((version) => version + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isAdmin]);

  if (!ready)
    return (
      <div className="page">
        <p role="status">Проверяем доступ…</p>
      </div>
    );
  if (!isAdmin)
    return (
      <div className="page">
        <PageHeading
          eyebrow={name("admin.restrictedEyebrow")}
          title={name("admin.heading")}
          description="Этот раздел доступен после входа с ролью администратора."
        />
        <Link className="button button-primary" href="/account/">
          {name("admin.toAccount")}
          <ArrowRight size={16} />
        </Link>
      </div>
    );

  const query = search.trim().toLocaleLowerCase("ru");
  const rows = students.filter((student) =>
    `${student.name} ${student.login}`.toLocaleLowerCase("ru").includes(query),
  );
  const blocked = students.filter((student) => student.blocked).length;
  const selectedStudent = students.find((student) => student.id === progressId);

  function toggleAccess(student: Account) {
    setError("");
    setNotice("");
    try {
      setStudentBlocked(student.id, !student.blocked);
      setTarget(null);
      setNotice(
        student.blocked
          ? `Вход для ${student.login} восстановлен.`
          : `Вход для ${student.login} приостановлен.`,
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось изменить доступ.",
      );
    }
  }

  return (
    <div className="page admin-page">
      <PageHeading
        eyebrow={name("admin.eyebrow")}
        title={name("admin.heading")}
        description="Управляйте доступом студентов и смотрите их прогресс в этом браузере."
      >
        <Link href="/account/" className="button button-secondary">
          <ShieldCheck size={16} />
          {name("admin.myAccount")}
        </Link>
      </PageHeading>
      <div className="admin-stats">
        <div className="account-card">
          <UsersRound size={20} />
          <strong>{students.length}</strong>
          <span>{name("admin.totalStudents")}</span>
        </div>
        <div className="account-card">
          <strong>{students.length - blocked}</strong>
          <span>{name("admin.accessOpen")}</span>
        </div>
        <div className="account-card">
          <strong>{blocked}</strong>
          <span>{name("admin.accessSuspended")}</span>
        </div>
      </div>
      <section
        className="account-card admin-students"
        aria-labelledby="student-list-title"
      >
        <div className="admin-list-heading">
          <h2 id="student-list-title">{name("admin.students")}</h2>
          <label className="search-input">
            <Search size={16} />
            <input
              aria-label={name("admin.search")}
              placeholder={name("admin.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        {notice && (
          <p role="status" className="notice-banner">
            {notice}
          </p>
        )}
        {rows.length ? (
          <div
            className="data-scroll admin-table-wrap"
            tabIndex={0}
            role="region"
            aria-label={name("admin.studentList")}
          >
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th scope="col">{name("common.roleStudent")}</th>
                  <th scope="col">{name("common.solved")}</th>
                  <th scope="col">{name("admin.independent")}</th>
                  <th scope="col">{name("admin.access")}</th>
                  <th scope="col">{name("admin.action")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((student) => {
                  const study = readStudentStudy(student.id);
                  const stats = study && getStats(study);
                  return (
                    <tr key={student.id}>
                      <td>
                        <strong>{student.name}</strong>
                        <small>{student.login}</small>
                      </td>
                      <td>
                        {stats
                          ? `${stats.completed} из ${tasks.length}`
                          : "Недоступно"}
                      </td>
                      <td>{stats?.independent ?? "Недоступно"}</td>
                      <td>
                        <span
                          className={
                            student.blocked
                              ? "admin-blocked"
                              : "status status-done"
                          }
                        >
                          {student.blocked ? name("admin.suspended") : name("admin.open")}
                        </span>
                      </td>
                      <td>
                        <button
                          className="button button-secondary"
                          onClick={() => setProgressId(student.id)}
                        >
                          {name("nav.viewProgress")}
                          <span className="sr-only"> для {student.login}</span>
                        </button>{" "}
                        <button
                          className="button button-secondary"
                          onClick={() => {
                            setError("");
                            setTarget(student);
                          }}
                        >
                          {student.blocked
                            ? name("admin.restoreAccess")
                            : name("admin.suspendAccess")}
                          <span className="sr-only"> для {student.login}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="account-help admin-empty">
            {students.length
              ? "Студенты не найдены."
              : "Здесь появятся студенты после регистрации в этом браузере."}
          </p>
        )}
      </section>
      <SiteNamesEditor key={active.id} />
      <QuizEditor key={active.id} adminId={active.id} />
      {selectedStudent && (
        <StudentProgress student={selectedStudent} onClose={() => setProgressId(null)} />
      )}
      {target && (
        <Modal
          title={target.blocked ? name("admin.restoreAccessTitle") : name("admin.suspendAccessTitle")}
          onClose={() => setTarget(null)}
        >
          <p>
            {target.blocked
              ? "Студент снова сможет войти в аккаунт."
              : "Студент выйдет из аккаунта и не сможет войти до восстановления доступа. Его прогресс сохранится."}{" "}
            Аккаунт: {target.login}.
          </p>
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={() => setTarget(null)}
            >
              {name("common.cancel")}
            </button>
            <button
              className="button button-primary"
              onClick={() => toggleAccess(target)}
            >
              {target.blocked ? name("admin.restore") : name("admin.suspend")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
