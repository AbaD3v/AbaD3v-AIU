"use client";
import Link from "next/link";
import { useRef, useState } from "react";
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
import { useStudy, updateStudy, replaceStudy } from "@/app/lib/sql/store";
import { getStats, emptyStudy, parseStudy } from "@/app/lib/sql/progress";
import { modules, tasks, taskHref } from "@/app/lib/sql/course";
import {
  Modal,
  PageHeading,
  Status,
  downloadText,
} from "@/app/components/sql/ui";

export default function ProfilePage() {
  const state = useStudy();
  const stats = getStats(state);
  const [modal, setModal] = useState<"reset" | "import" | null>(null);
  const [notice, setNotice] = useState("");
  const [imported, setImported] = useState<ReturnType<
    typeof parseStudy
  > | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const nextTask =
    tasks.find((task) => !state.progress[task.id]?.solvedAt) ?? tasks[0];
  async function loadFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 4_000_000)
        throw new Error("Размер файла не должен превышать 4 МБ.");
      setImported(parseStudy(await file.text()));
      setModal("import");
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Не удалось прочитать файл.",
      );
    }
    if (input.current) input.current.value = "";
  }
  return (
    <div className="page progress-page">
      <PageHeading
        eyebrow="ТВОЙ ПУТЬ В SQL"
        title="Каждый запрос — шаг вперёд."
        description="Здесь виден реальный результат: решённые задачи, самостоятельные попытки и освоенные темы."
      >
        <Link className="button button-primary" href={taskHref(nextTask.id)}>
          К практике
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
            <span>курса пройдено</span>
          </div>
        </div>
        <div>
          <span className="eyebrow">ПРАКТИКУМ ПО SQL</span>
          <h2>
            {stats.completed === 15
              ? "Все задачи решены. Отличная работа!"
              : stats.completed
                ? "Хорошее начало. Продолжай."
                : "Всё начинается с первого запроса."}
          </h2>
          <p>
            {stats.completed} из 15 задач решено.{" "}
            {stats.completed === tasks.length
              ? "Можно вернуться к сложным темам и попробовать другой способ решения."
              : stats.completed
                ? "Следующий шаг — " + nextTask.title.toLowerCase() + "."
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
          <span>решено задач</span>
        </div>
        <div>
          <Target size={21} />
          <strong>{stats.independent}</strong>
          <span>без подсказок</span>
        </div>
        <div>
          <Flame size={21} />
          <strong>{stats.attempts}</strong>
          <span>проверок решений</span>
        </div>
        <div>
          <Pencil size={21} />
          <strong>{stats.runs}</strong>
          <span>запусков запросов</span>
        </div>
      </div>
      <div className="section-title">
        <div>
          <h2>Навыки по модулям</h2>
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
                <h3>{module.title}</h3>
                <strong>{completed}/3</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: (completed / 3) * 100 + "%" }} />
              </div>
              {moduleTasks.map((task) => (
                <Link key={task.id} href={taskHref(task.id)}>
                  <span>{task.title}</span>
                  <Status progress={state.progress[task.id]} />
                </Link>
              ))}
            </article>
          );
        })}
      </div>
      <section className="settings-card">
        <div>
          <h2>Учебный профиль</h2>
          <p>
            Прогресс хранится только в этом браузере. Экспортируй его для
            переноса на другое устройство.
          </p>
          <label className="profile-name-label">
            Как к тебе обращаться
            <input
              value={state.name}
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
          <button
            className="button button-secondary"
            onClick={() => {
              downloadText(
                "codeproof-sql-progress.json",
                JSON.stringify(state, null, 2),
                "application/json",
              );
              setNotice("Файл прогресса подготовлен для скачивания.");
            }}
          >
            <Download size={16} />
            Экспорт прогресса
          </button>
          <button
            className="button button-secondary"
            onClick={() => input.current?.click()}
          >
            <Upload size={16} />
            Импорт прогресса
          </button>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Файл прогресса"
            onChange={(event) => loadFile(event.target.files?.[0])}
          />
          <button className="danger-link" onClick={() => setModal("reset")}>
            <RotateCcw size={14} />
            Сбросить SQL-прогресс
          </button>
        </div>
      </section>
      {notice && (
        <p className="notice-banner" role="status">
          {notice}
        </p>
      )}
      {modal === "reset" && (
        <Modal title="Начать практикум заново?" onClose={() => setModal(null)}>
          <p>
            Будут удалены SQL-решения, черновики, история и заметки в этом
            браузере. Сначала можно экспортировать прогресс. Данные старой
            версии CodeProof не затрагиваются.
          </p>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={() => setModal(null)}
            >
              Отмена
            </button>
            <button
              className="button button-danger"
              onClick={() => {
                replaceStudy({ ...emptyStudy, name: state.name });
                setModal(null);
                setNotice("SQL-прогресс сброшен.");
              }}
            >
              Сбросить прогресс
            </button>
          </div>
        </Modal>
      )}
      {modal === "import" && imported && (
        <Modal
          title="Загрузить прогресс из файла?"
          onClose={() => setModal(null)}
        >
          <p>
            В файле: {getStats(imported).completed} решённых задач. Текущие
            SQL-сохранения будут заменены. Перед заменой можно экспортировать
            текущий прогресс.
          </p>
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={() => setModal(null)}
            >
              Отмена
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                replaceStudy(imported);
                setImported(null);
                setModal(null);
                setNotice("Прогресс восстановлен.");
              }}
            >
              Восстановить
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
