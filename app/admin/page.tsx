"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, ShieldCheck, UsersRound } from "lucide-react";
import { Modal, PageHeading } from "@/app/components/sql/ui";
import {
  setStudentBlocked,
  useAccounts,
  type Account,
} from "@/app/lib/accounts/store";
import { tasks } from "@/app/lib/sql/course";
import { getStats, STORAGE_KEY } from "@/app/lib/sql/progress";
import { readStudentStudy } from "@/app/lib/sql/store";

export default function AdminPage() {
  const { active, ready, students } = useAccounts();
  const isAdmin = active?.role === "admin";
  const [search, setSearch] = useState("");
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
          eyebrow="АККАУНТЫ"
          title="Панель администратора"
          description="Этот раздел доступен после входа с ролью администратора."
        />
        <Link className="button button-primary" href="/account/">
          К аккаунту
          <ArrowRight size={16} />
        </Link>
      </div>
    );

  const query = search.trim().toLocaleLowerCase("ru");
  const rows = students.filter((student) =>
    `${student.name} ${student.login}`.toLocaleLowerCase("ru").includes(query),
  );
  const blocked = students.filter((student) => student.blocked).length;

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
        eyebrow="УПРАВЛЕНИЕ ПРАКТИКУМОМ"
        title="Панель администратора"
        description="Управляйте доступом студентов и смотрите их прогресс в этом браузере."
      >
        <Link href="/account/" className="button button-secondary">
          <ShieldCheck size={16} />
          Мой аккаунт
        </Link>
      </PageHeading>
      <div className="admin-stats">
        <div className="account-card">
          <UsersRound size={20} />
          <strong>{students.length}</strong>
          <span>Всего студентов</span>
        </div>
        <div className="account-card">
          <strong>{students.length - blocked}</strong>
          <span>Вход открыт</span>
        </div>
        <div className="account-card">
          <strong>{blocked}</strong>
          <span>Вход приостановлен</span>
        </div>
      </div>
      <section
        className="account-card admin-students"
        aria-labelledby="student-list-title"
      >
        <div className="admin-list-heading">
          <h2 id="student-list-title">Студенты</h2>
          <label className="search-input">
            <Search size={16} />
            <input
              aria-label="Поиск студентов"
              placeholder="Имя или логин"
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
            aria-label="Список студентов"
          >
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th scope="col">Студент</th>
                  <th scope="col">Решено</th>
                  <th scope="col">Без подсказок</th>
                  <th scope="col">Доступ</th>
                  <th scope="col">Действие</th>
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
                          {student.blocked ? "Приостановлен" : "Открыт"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="button button-secondary"
                          onClick={() => {
                            setError("");
                            setTarget(student);
                          }}
                        >
                          {student.blocked
                            ? "Восстановить вход"
                            : "Приостановить вход"}
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
      {target && (
        <Modal
          title={target.blocked ? "Восстановить вход?" : "Приостановить вход?"}
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
              Отмена
            </button>
            <button
              className="button button-primary"
              onClick={() => toggleAccess(target)}
            >
              {target.blocked ? "Восстановить" : "Приостановить"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
