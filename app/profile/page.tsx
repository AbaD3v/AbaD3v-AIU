"use client";
import { useSiteNames } from "@/app/lib/site-names/store";
import Link from "next/link";
import { useRef, useState } from "react";
import { useAccounts } from "@/app/lib/accounts/store";
import {
  ArrowRight,
  Award,
  Check,
  CheckCheck,
  Download,
  Flame,
  Pencil,
  RotateCcw,
  Target,
  Upload,
} from "lucide-react";
import { useStudy, updateStudy, replaceStudy, useStudySyncStatus } from "@/app/lib/sql/store";
import { cloudEnabled } from "@/app/lib/supabase/client";
import {
  getStats,
  emptyStudy,
  parseStudy,
  serializeStudy,
  getContinueTask,
  isTaskStarted,
  MAX_BACKUP_BYTES,
  type StudyState,
} from "@/app/lib/sql/progress";
import { modules, tasks, taskHref } from "@/app/lib/sql/course";
import {
  Modal,
  PageHeading,
  Status,
  downloadText,
} from "@/app/components/sql/ui";

export default function ProfilePage() {
  const name = useSiteNames();
  const { active } = useAccounts();
  const state = useStudy();
  const syncStatus = useStudySyncStatus();
  const unavailable = syncStatus === "loading" || syncStatus === "load-error";
  const stats = getStats(state);
  const [modal, setModal] = useState<"reset" | "import" | "undo" | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [backup, setBackup] = useState<StudyState | null>(null);
  const [imported, setImported] = useState<ReturnType<
    typeof parseStudy
  > | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const nextTask = getContinueTask(state);
  function exportProgress() {
    try {
      downloadText(
        "codeproof-sql-progress.json",
        serializeStudy(state),
        "application/json",
      );
      setNotice("Скачивание файла прогресса запрошено.");
    } catch {
      setNotice("Не удалось скачать файл. Попробуйте ещё раз.");
    }
  }
  function closeModal() {
    setModal(null);
    setImported(null);
  }
  async function loadFile(file?: File) {
    if (!file) return;
    setLoading(true);
    setImported(null);
    setNotice("");
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error("Размер файла не должен превышать 16 МБ.");
      setImported(parseStudy(await file.text()));
      setModal("import");
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Не удалось прочитать файл.",
      );
    } finally {
      setLoading(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="page progress-page">
      <PageHeading
        eyebrow={name("profile.eyebrow")}
        title={name("profile.heading")}
        description="Здесь виден реальный результат: решённые задачи, самостоятельные попытки и освоенные темы."
      >
        <Link
          className="button button-primary"
          href={nextTask ? taskHref(nextTask.id) : "/"}
        >
          {nextTask ? name("profile.practice") : name("profile.repeat")}
          <ArrowRight size={16} />
        </Link>
      </PageHeading>
      <div className="progress-hero">
        <div
          className="large-progress-ring"
          style={{ "--progress": stats.percent + "%" } as React.CSSProperties}
        >
          <div>
            <strong>
              {stats.percent}
              <small>%</small>
            </strong>
            <span>{name("profile.percent")}</span>
          </div>
        </div>
        <div>
          <span className="eyebrow">{name("profile.course")}</span>
          <h2>
            {stats.completed === 15
              ? name("profile.completeHeading")
              : stats.completed
                ? name("profile.startedHeading")
                : name("profile.startHeading")}
          </h2>
          <p>
            {stats.completed} из 15 задач решено.{" "}
            {stats.completed === tasks.length
              ? "Можно вернуться к сложным темам и попробовать другой способ решения."
              : stats.completed && nextTask
                ? `${name("profile.nextTask")} — ${name(`task.${nextTask.id}`)}.`
                : "Выбери задачу, запусти запрос и проверь решение."}
          </p>
        </div>
        <Award size={86} className="progress-hero-award" strokeWidth={1} />
      </div>
      <div className="progress-stats">
        <div>
          <CheckCheck size={21} />
          <strong>
            {stats.completed}
            <small>/ 15</small>
          </strong>
          <span>{name("profile.solved")}</span>
        </div>
        <div>
          <Target size={21} />
          <strong>{stats.independent}</strong>
          <span>{name("profile.independent")}</span>
        </div>
        <div>
          <Flame size={21} />
          <strong>{stats.attempts}</strong>
          <span>{name("profile.checks")}</span>
        </div>
        <div>
          <Pencil size={21} />
          <strong>{stats.runs}</strong>
          <span>{name("profile.runs")}</span>
        </div>
      </div>
      <div className="section-title">
        <div>
          <h2>{name("profile.skills")}</h2>
          <p>
            Тема засчитывается после решения задач, а не после просмотра
            объяснения.
          </p>
        </div>
      </div>
      <div className="skill-cards">
        {modules.map((module) => {
          const moduleTasks = tasks.filter((task) => task.module === module.id);
          const completed = moduleTasks.filter(
            (task) => state.progress[task.id]?.solvedAt,
          ).length;
          return (
            <article key={module.id} className="skill-card">
              <div className="skill-card-title">
                <span>
                  {completed === 3 ? (
                    <Check size={18} />
                  ) : (
                    String(module.id).padStart(2, "0")
                  )}
                </span>
                <h3>{name(`module.${module.id}`)}</h3>
                <strong>{completed}/3</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: (completed / 3) * 100 + "%" }} />
              </div>
              {moduleTasks.map((task) => (
                <Link key={task.id} href={taskHref(task.id)}>
                  <span>{name(`task.${task.id}`)}</span>
                  <Status
                    progress={state.progress[task.id]}
                    started={isTaskStarted(state, task.id)}
                  />
                </Link>
              ))}
            </article>
          );
        })}
      </div>
      <section className="settings-card">
        <div>
          <h2>{name("profile.settings")}</h2>
          <p>
            {active
              ? cloudEnabled ? "Прогресс этого аккаунта синхронизируется через Supabase."
                : "Прогресс этого аккаунта хранится отдельно в данном браузере."
              : "Гостевой прогресс хранится отдельно от аккаунтов в этом браузере."}{" "}
            {cloudEnabled && active
              ? "Экспортируйте резервную копию для восстановления."
              : "Экспортируйте прогресс для переноса на другое устройство."}
          </p>
          <p role="status">
            {syncStatus === "loading" ? "Загружаем сохранения аккаунта…"
              : syncStatus === "load-error" ? "Сохранения аккаунта пока недоступны."
                : syncStatus === "conflict" ? "Изменения этой вкладки ещё не отправлены: сохранение изменилось на другом устройстве."
                  : syncStatus === "save-error" ? "Изменения этой вкладки ещё не синхронизированы. Повторите сохранение."
                    : syncStatus === "saving" ? "Синхронизируем изменения…"
                      : syncStatus === "synced" ? "Изменения сохранены в облаке."
                        : state.storageIssue ? "Изменения доступны только в этой вкладке."
                          : "Сохранение в этом браузере."}
          </p>
          {!active && (
            <Link href="/account/" className="text-link">
              {name("account.entry")} <ArrowRight size={14} />
            </Link>
          )}
          <label className="profile-name-label">
            {name("profile.name")}
            <input
              value={state.name}
              disabled={unavailable}
              maxLength={40}
              onChange={(event) =>
                updateStudy((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              onBlur={() => {
                if (!state.name.trim())
                  updateStudy((current) => ({ ...current, name: "Студент" }));
              }}
            />
          </label>
        </div>
        <div className="settings-actions">
          <button className="button button-secondary" onClick={exportProgress}>
            <Download size={16} />
            {name("profile.export")}
          </button>
          <button
            className="button button-secondary"
            disabled={loading || unavailable}
            onClick={() => input.current?.click()}
          >
            <Upload size={16} />
            {loading ? name("profile.reading") : name("profile.import")}
          </button>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label={name("profile.file")}
            onChange={(event) => loadFile(event.target.files?.[0])}
          />
          <button
            className="danger-link"
            disabled={loading || unavailable}
            onClick={() => setModal("reset")}
          >
            <RotateCcw size={14} />
            {name("profile.resetSql")}
          </button>
        </div>
      </section>
      {notice && (
        <p className="notice-banner" role="status">
          {notice}
        </p>
      )}
      {backup && (
        <button className="text-link" onClick={() => setModal("undo")}>
          <RotateCcw size={14} />
          {name("profile.undo")}
        </button>
      )}
      {modal === "undo" && backup && (
        <Modal title={name("profile.undoTitle")} onClose={closeModal}>
          <p>
            Вернём состояние до импорта или сброса. Изменения, сделанные после
            него, будут заменены. Эта отмена доступна, пока открыта страница.
          </p>
          <div className="modal-actions">
            <button className="button button-secondary" onClick={closeModal}>
              {name("common.cancel")}
            </button>
            <button
              className="button button-primary"
              disabled={unavailable}
              onClick={() => {
                replaceStudy(backup);
                setBackup(null);
                closeModal();
                setNotice("Предыдущий прогресс возвращён в этой вкладке.");
              }}
            >
              {name("profile.restore")}
            </button>
          </div>
        </Modal>
      )}
      {modal === "reset" && (
        <Modal title={name("profile.resetTitle")} onClose={() => setModal(null)}>
          <p>
            {cloudEnabled && active
              ? "SQL-решения, черновики, история и заметки аккаунта будут сброшены на всех устройствах."
              : "SQL-решения, черновики, история и заметки будут сброшены в этом браузере."}{" "}
            Сначала можно экспортировать прогресс.
          </p>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={exportProgress}
            >
              {name("profile.downloadCopy")}
            </button>
            <button
              className="button button-secondary"
              onClick={() => setModal(null)}
            >
              {name("common.cancel")}
            </button>
            <button
              className="button button-danger"
              disabled={unavailable}
              onClick={() => {
                setBackup(state);
                replaceStudy({ ...emptyStudy, name: state.name });
                setModal(null);
                setNotice("SQL-прогресс сброшен в этой вкладке.");
              }}
            >
              {name("profile.reset")}
            </button>
          </div>
        </Modal>
      )}
      {modal === "import" && imported && (
        <Modal title={name("profile.importTitle")} onClose={closeModal}>
          <p>
            В файле: {getStats(imported).completed} решённых задач. Текущие
            SQL-сохранения будут заменены. Перед заменой можно экспортировать
            текущий прогресс.
          </p>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={exportProgress}
            >
              {name("profile.downloadCopy")}
            </button>
            <button className="button button-secondary" onClick={closeModal}>
              {name("common.cancel")}
            </button>
            <button
              className="button button-primary"
              disabled={unavailable}
              onClick={() => {
                setBackup(state);
                replaceStudy(imported);
                setImported(null);
                setModal(null);
                setNotice("Прогресс из файла открыт в этой вкладке.");
              }}
            >
              {name("common.restore")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
