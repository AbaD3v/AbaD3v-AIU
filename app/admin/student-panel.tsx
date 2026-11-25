import { useSiteNames } from "@/app/lib/site-names/store";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Modal } from "@/app/components/sql/ui";
import StudentProgress from "./student-progress";
import {
  setStudentBlocked,
  type Account,
} from "@/app/lib/accounts/store";
import { tasks } from "@/app/lib/sql/course";
import { getStats, STORAGE_KEY } from "@/app/lib/sql/progress";
import { clearAdminStudies, readStudentStudy, refreshAdminStudies } from "@/app/lib/sql/store";
import { cloudEnabled } from "@/app/lib/supabase/client";
import styles from "./admin-workspace.module.css";

type AccessFilter = "all" | "open" | "blocked";

export default function StudentPanel({
  adminId,
  students,
  showEmpty,
}: {
  adminId: string;
  students: Account[];
  showEmpty: boolean;
}) {
  const name = useSiteNames();
  const [search, setSearch] = useState("");
  const [access, setAccess] = useState<AccessFilter>("all");
  const [progressId, setProgressId] = useState<string | null>(null);
  const [target, setTarget] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [, refreshProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState<"loading" | "ready" | "error">(
    cloudEnabled ? "loading" : "ready",
  );
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (cloudEnabled) {
      let latest = 0;
      const refresh = async () => {
        const request = ++latest;
        setProgressStatus("loading");
        try {
          await refreshAdminStudies();
          if (latest === request) setProgressStatus("ready");
        } catch {
          if (latest === request) setProgressStatus("error");
        }
      };
      void refresh();
      window.addEventListener("focus", refresh);
      return () => {
        latest++;
        window.removeEventListener("focus", refresh);
        clearAdminStudies();
      };
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(STORAGE_KEY + ".account."))
        refreshProgress((version) => version + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [adminId, reload]);

  const query = search.trim().toLocaleLowerCase("ru");
  const rows = students.filter((student) =>
    (access === "all" || student.blocked === (access === "blocked")) &&
    `${student.name} ${student.login}`.toLocaleLowerCase("ru").includes(query),
  );
  const selectedStudent = students.find((student) => student.id === progressId);
  const accessTarget = students.find((student) => student.id === target?.id);
  const progressPlaceholder = progressStatus === "loading" ? "Загрузка…" : "Данные недоступны";
  const retryProgress = () => setReload((version) => version + 1);

  async function toggleAccess(student: Account) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await setStudentBlocked(student.id, !student.blocked);
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section
        className="account-card admin-students"
        aria-labelledby="student-list-title"
      >
        <div className="admin-list-heading">
          <h2 id="student-list-title">{name("admin.studentList")}</h2>
          <div className={styles.studentFilters}>
            <label className="search-input">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                aria-label={name("admin.search")}
                placeholder={name("admin.searchPlaceholder")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              aria-label={name("admin.access")}
              value={access}
              onChange={(event) => setAccess(event.target.value as AccessFilter)}
            >
              <option value="all">{name("admin.allAccess")}</option>
              <option value="open">{name("admin.accessOpen")}</option>
              <option value="blocked">{name("admin.accessSuspended")}</option>
            </select>
          </div>
        </div>
        {notice && (
          <p role="status" className="notice-banner">
            {notice}
          </p>
        )}
        {progressStatus === "error" && (
          <div className={styles.listNotice} role="alert">
            Не удалось загрузить прогресс студентов.
            <button className="button button-secondary" onClick={retryProgress}>
              {name("admin.retryStudents")}
            </button>
          </div>
        )}
        {rows.length ? (
          <div
            className={`data-scroll admin-table-wrap ${styles.studentTable}`}
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
                  const study = progressStatus === "ready" ? readStudentStudy(student.id) : null;
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
                          : progressPlaceholder}
                      </td>
                      <td>{stats?.independent ?? progressPlaceholder}</td>
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
                        <div className={styles.studentActions}>
                          <button
                            className="button button-secondary"
                            onClick={() => setProgressId(student.id)}
                          >
                            {name("nav.viewProgress")}
                            <span className="sr-only"> для {student.login}</span>
                          </button>
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (students.length > 0 || showEmpty) && (
          <p className="account-help admin-empty">
            {students.length
              ? "Студенты не найдены."
              : cloudEnabled ? "Здесь появятся студенты после регистрации и подтверждения почты."
                : "Здесь появятся студенты после регистрации в этом браузере."}
          </p>
        )}
      </section>
      {selectedStudent && (
        <StudentProgress student={selectedStudent} status={progressStatus}
          retry={retryProgress} onClose={() => setProgressId(null)} />
      )}
      {target && accessTarget && target.blocked === accessTarget.blocked && (
        <Modal
          title={target.blocked ? name("admin.restoreAccessTitle") : name("admin.suspendAccessTitle")}
          onClose={() => { if (!busy) setTarget(null); }}
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
              disabled={busy}
              onClick={() => setTarget(null)}
            >
              {name("common.cancel")}
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => { void toggleAccess(target); }}
            >
              {target.blocked ? name("admin.restore") : name("admin.suspend")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
