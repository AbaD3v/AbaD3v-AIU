"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Database,
  Search,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Terminal,
} from "lucide-react";
import { modules, tasks, taskHref } from "@/app/lib/sql/course";
import { useStudy } from "@/app/lib/sql/store";
import {
  getStats,
  getContinueTask,
  isTaskStarted,
} from "@/app/lib/sql/progress";
import { TaskLink } from "./ui";

export default function Catalog() {
  const state = useStudy();
  const stats = getStats(state);
  const [search, setSearch] = useState("");
  const [moduleId, setModuleId] = useState(0);
  const [status, setStatus] = useState("all");
  const nextTask = getContinueTask(state);
  const started = tasks.some((task) => isTaskStarted(state, task.id));
  const filtered = tasks.filter((task) => {
    const progress = state.progress[task.id];
    const matches = (
      task.title +
      " " +
      task.tags.join(" ") +
      " " +
      task.description
    )
      .toLowerCase()
      .includes(search.toLowerCase());
    return (
      matches &&
      (!moduleId || task.module === moduleId) &&
      (status === "all" ||
        (status === "done" && !!progress?.solvedAt) ||
        (status === "started" &&
          isTaskStarted(state, task.id) &&
          !progress?.solvedAt) ||
        (status === "new" && !isTaskStarted(state, task.id)))
    );
  });
  return (
    <div className="page catalog-page">
      <div className="catalog-title">
        <div>
          <span className="eyebrow">УЧЕБНАЯ ЛАБОРАТОРИЯ</span>
          <h1>
            От первого SELECT
            <br className="mobile-only" /> до анализа продаж<span>.</span>
          </h1>
          <p>
            Пиши запросы, исследуй данные и проверяй решения в настоящей базе.
          </p>
        </div>
        <span className="course-label">
          <span />
          <strong>Практический курс</strong>
          <small>SQLite</small>
        </span>
      </div>
      <section className="course-hero" aria-label="Продолжить обучение">
        <div className="hero-copy">
          <span className="hero-eyebrow">
            <span className="hero-spark">
              <Sparkles size={14} />
            </span>
            {stats.completed === 15
              ? "ОТЛИЧНАЯ РАБОТА — КУРС ПРОЙДЕН"
              : started
                ? "ПРОДОЛЖАЕМ С ТОГО ЖЕ МЕСТА"
                : "БОЛЬШИЕ ВЫВОДЫ НАЧИНАЮТСЯ С МАЛЕНЬКОГО ЗАПРОСА"}
          </span>
          <h2>
            {!nextTask ? (
              "Все 15 задач решены."
            ) : started ? (
              nextTask.title
            ) : (
              <>
                Твоя первая работа
                <br />с настоящими данными.
              </>
            )}
          </h2>
          <p>
            Один интернет-магазин. Пять связанных таблиц.
            <br />
            Пятнадцать задач, которые решает аналитик.
          </p>
          <Link
            href={nextTask ? taskHref(nextTask.id) : "/profile/"}
            className="button button-lime"
          >
            {!nextTask
              ? "Посмотреть результаты"
              : started
                ? "Продолжить практику"
                : "Начать практику"}
            <ArrowRight size={17} />
          </Link>
          <span className="hero-footnote">
            <Check size={13} />
            Все задания открыты. Можно идти в своём темпе.
          </span>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-grid" />
          <div className="mini-table mini-customers">
            <div>
              <Table2 size={13} />
              <strong>customers</strong>
              <span>10 строк</span>
            </div>
            <p>
              <span className="art-key">⌑</span> id <small>INTEGER</small>
            </p>
            <p>
              name <small>TEXT</small>
            </p>
            <p>
              city <small>TEXT</small>
            </p>
          </div>
          <span className="art-connector" />
          <div className="mini-table mini-orders">
            <div>
              <Table2 size={13} />
              <strong>orders</strong>
              <span>18 строк</span>
            </div>
            <p>
              <span className="art-key">⌑</span> id <small>INTEGER</small>
            </p>
            <p>
              <span className="art-fk">↳</span> customer_id{" "}
              <small>INTEGER</small>
            </p>
            <p>
              status <small>TEXT</small>
            </p>
          </div>
          <div className="mini-query">
            <div>
              <Terminal size={13} />
              <span>first_query.sql</span>
              <i />
              <i />
              <i />
            </div>
            <code>
              <em>SELECT</em> name, price
              <br />
              <em>FROM</em> products
              <br />
              <em>WHERE</em> price &gt; <b>100</b>;
            </code>
            <span className="mini-query-result">
              <Check size={12} />
              Запрос выполнен
            </span>
          </div>
        </div>
      </section>
      <div className="overview-stats">
        <div>
          <span className="stat-icon">
            <BookOpen size={19} />
          </span>
          <span>
            <strong>15</strong>
            <small>практических задач</small>
          </span>
        </div>
        <div>
          <span className="stat-icon">
            <Database size={19} />
          </span>
          <span>
            <strong>5</strong>
            <small>связанных таблиц</small>
          </span>
        </div>
        <div>
          <span className="stat-icon">
            <Clock3 size={19} />
          </span>
          <span>
            <strong>
              5–20 <em>мин</em>
            </strong>
            <small>на одно задание</small>
          </span>
        </div>
        <div className="overview-progress">
          <span
            className="progress-ring"
            style={{ "--progress": stats.percent + "%" } as React.CSSProperties}
          >
            <span>{stats.percent}%</span>
          </span>
          <span>
            <strong>
              {stats.completed} <em>/ 15</em>
            </strong>
            <small>твой прогресс</small>
          </span>
        </div>
      </div>
      <div className="catalog-columns">
        <section className="task-catalog" aria-labelledby="course-heading">
          <div className="section-title">
            <div>
              <h2 id="course-heading">Программа практикума</h2>
              <p>От простых выборок до ответов на бизнес-вопросы.</p>
            </div>
            <span className="count-label">5 модулей</span>
          </div>
          <div className="catalog-toolbar">
            <label className="search-input">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Найти задание или SQL-команду"
                aria-label="Поиск заданий"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Очистить поиск"
                >
                  ×
                </button>
              )}
            </label>
            <label className="filter-select">
              <SlidersHorizontal size={15} />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                aria-label="Статус заданий"
              >
                <option value="all">Все задания</option>
                <option value="new">Не начаты</option>
                <option value="started">В процессе</option>
                <option value="done">Решены</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
          <div className="module-filters" aria-label="Модули">
            {[
              { id: 0, title: "Все темы" },
              ...modules.map((module) => ({
                id: module.id,
                title:
                  String(module.id).padStart(2, "0") +
                  " · " +
                  ["Основы", "Сортировка", "Связи", "Отчёты", "Аналитика"][
                    module.id - 1
                  ],
              })),
            ].map((module) => (
              <button
                key={module.id}
                className={moduleId === module.id ? "active" : ""}
                onClick={() => setModuleId(module.id)}
                aria-pressed={moduleId === module.id}
              >
                {module.title}
              </button>
            ))}
          </div>
          <div className="module-list">
            {modules
              .filter((module) =>
                filtered.some((task) => task.module === module.id),
              )
              .map((module) => {
                const completed = tasks.filter(
                  (task) =>
                    task.module === module.id &&
                    state.progress[task.id]?.solvedAt,
                ).length;
                return (
                  <div className="module-card" key={module.id}>
                    <div className="module-heading">
                      <span
                        className={
                          "module-icon " +
                          (completed === 3 ? "module-complete" : "")
                        }
                      >
                        {completed === 3 ? (
                          <Check size={18} />
                        ) : (
                          String(module.id).padStart(2, "0")
                        )}
                      </span>
                      <div>
                        <h3>{module.title}</h3>
                        <p>{module.subtitle}</p>
                      </div>
                      <span className="module-completion">{completed} / 3</span>
                    </div>
                    <div>
                      {filtered
                        .filter((task) => task.module === module.id)
                        .map((task) => (
                          <TaskLink
                            key={task.id}
                            task={task}
                            index={tasks.indexOf(task)}
                            progress={state.progress[task.id]}
                            started={isTaskStarted(state, task.id)}
                          />
                        ))}
                    </div>
                  </div>
                );
              })}
            {!filtered.length && (
              <div className="empty-state">
                <Search size={30} />
                <h3>Задания не найдены</h3>
                <p>Попробуйте другой запрос или сбросьте фильтры.</p>
                <button
                  className="button button-secondary"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                    setModuleId(0);
                  }}
                >
                  Сбросить фильтры
                </button>
              </div>
            )}
          </div>
        </section>
        <aside className="catalog-aside">
          <div className="database-card">
            <div className="card-icon">
              <Database size={23} />
            </div>
            <span className="eyebrow">УЧЕБНЫЙ ПРОЕКТ</span>
            <h3>
              Данные одного
              <br />
              интернет-магазина.
            </h3>
            <p>
              Товары, покупатели, заказы и платежи. Все задачи связаны одной
              историей.
            </p>
            <div className="database-file">
              <Database size={15} />
              <span>shop.db</span>
              <span className="status-dot" />
            </div>
            <Link href="/database/" className="text-link">
              Исследовать базу <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="tips-card">
            <BookOpen size={21} />
            <h3>Забыл синтаксис?</h3>
            <p>Короткие объяснения и примеры SQL-команд всегда под рукой.</p>
            <Link href="/reference/" className="text-link">
              Открыть справочник <ArrowRight size={15} />
            </Link>
          </div>
          <div className="course-note">
            <span>МАЛЕНЬКИЙ СОВЕТ</span>
            <p>
              Сначала посмотри на данные. Хороший запрос начинается с хорошего
              вопроса.
            </p>
            <span className="note-rule" />
          </div>
        </aside>
      </div>
      <footer className="page-footer">
        <span>
          CodeProof SQL <span>·</span> Учись на практике.
        </span>
        <Link href="/about/">
          Как устроен практикум <ArrowUpRight size={13} />
        </Link>
      </footer>
    </div>
  );
}
