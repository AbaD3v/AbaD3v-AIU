"use client";
import { useSiteNames } from "@/app/lib/site-names/store";
import { lessonFieldKey } from "@/app/lib/site-names/practice-lesson";
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
  const name = useSiteNames();
  const state = useStudy();
  const stats = getStats(state);
  const [search, setSearch] = useState("");
  const [moduleId, setModuleId] = useState(0);
  const [status, setStatus] = useState("all");
  const nextTask = getContinueTask(state);
  const started = tasks.some((task) => isTaskStarted(state, task.id));
  const displayedTasks = tasks.map((task) => ({
    ...task,
    description: name(lessonFieldKey(task.id, "description")),
    tags: task.tags.map((_, index) => name(lessonFieldKey(task.id, `tag.${index + 1}`))),
  }));
  const filtered = displayedTasks.filter((task) => {
    const progress = state.progress[task.id];
    const matches = (
      name(`task.${task.id}`) +
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
          <span className="eyebrow">{name("catalog.eyebrow")}</span>
          <h1>{name("catalog.heading")}</h1>
          <p>{name("catalog.intro")}</p>
        </div>
        <span className="course-label">
          <span />
          <strong>{name("catalog.courseBadge")}</strong>
          <small>{name("catalog.engine")}</small>
        </span>
      </div>
      <section className="course-hero" aria-label={name("catalog.continueRegion")}>
        <div className="hero-copy">
          <span className="hero-eyebrow">
            <span className="hero-spark">
              <Sparkles size={14} />
            </span>
            {stats.completed === tasks.length
              ? name("catalog.completedEyebrow")
              : started
                ? name("catalog.continueEyebrow")
                : name("catalog.startEyebrow")}
          </span>
          <h2>
            {!nextTask
              ? name("catalog.completedHeading")
              : started
                ? name(`task.${nextTask.id}`)
                : name("catalog.startHeading")}
          </h2>
          <p style={{ whiteSpace: "pre-line" }}>{name("catalog.heroDescription")}</p>
          <Link
            href={nextTask ? taskHref(nextTask.id) : "/profile/"}
            className="button button-lime"
          >
            {!nextTask
              ? name("common.viewResults")
              : started
                ? name("catalog.resume")
                : name("catalog.start")}
            <ArrowRight size={17} />
          </Link>
          <span className="hero-footnote">
            <Check size={13} />
            {name("catalog.heroFootnote")}
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
              {name("common.querySuccess")}
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
            <strong>{tasks.length}</strong>
            <small>{name("catalog.taskCount")}</small>
          </span>
        </div>
        <div>
          <span className="stat-icon">
            <Database size={19} />
          </span>
          <span>
            <strong>5</strong>
            <small>{name("catalog.tableCount")}</small>
          </span>
        </div>
        <div>
          <span className="stat-icon">
            <Clock3 size={19} />
          </span>
          <span>
            <strong>
              5–20 <em>{name("common.minutes")}</em>
            </strong>
            <small>{name("catalog.timePerTask")}</small>
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
              {stats.completed} <em>/ {tasks.length}</em>
            </strong>
            <small>{name("catalog.progress")}</small>
          </span>
        </div>
      </div>
      <div className="catalog-columns">
        <section className="task-catalog" aria-labelledby="course-heading">
          <div className="section-title">
            <div>
              <h2 id="course-heading">{name("catalog.program")}</h2>
              <p>{name("catalog.programDescription")}</p>
            </div>
            <span className="count-label">{name("catalog.moduleCount")}</span>
          </div>
          <div className="catalog-toolbar">
            <label className="search-input">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={name("catalog.searchPlaceholder")}
                aria-label={name("catalog.search")}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label={name("common.clearSearch")}
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
                aria-label={name("catalog.statusFilter")}
              >
                <option value="all">{name("common.allTasks")}</option>
                <option value="new">{name("catalog.statusNew")}</option>
                <option value="started">{name("common.inProgress")}</option>
                <option value="done">{name("catalog.statusDone")}</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
          <div className="module-filters" aria-label={name("catalog.modules")}>
            {[
              { id: 0, title: name("catalog.allModules") },
              ...modules.map((module) => ({
                id: module.id,
                title:
                  String(module.id).padStart(2, "0") +
                  " · " +
                  name(`module.short.${module.id}`),
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
                const moduleTasks = tasks.filter((task) => task.module === module.id);
                const completed = moduleTasks.filter((task) => state.progress[task.id]?.solvedAt).length;
                return (
                  <div className="module-card" key={module.id}>
                    <div className="module-heading">
                      <span
                        className={
                          "module-icon " +
                          (completed === moduleTasks.length ? "module-complete" : "")
                        }
                      >
                        {completed === moduleTasks.length ? (
                          <Check size={18} />
                        ) : (
                          String(module.id).padStart(2, "0")
                        )}
                      </span>
                      <div>
                        <h3>{name(`module.${module.id}`)}</h3>
                        <p>{name(`module.subtitle.${module.id}`)}</p>
                        <p>{name(`module.description.${module.id}`)}</p>
                      </div>
                      <span className="module-completion">{completed} / {moduleTasks.length}</span>
                    </div>
                    <div>
                      {filtered
                        .filter((task) => task.module === module.id)
                        .map((task) => (
                          <TaskLink
                            key={task.id}
                            task={task}
                            index={displayedTasks.indexOf(task)}
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
                <h3>{name("catalog.empty")}</h3>
                <p>{name("catalog.emptyHelp")}</p>
                <button
                  className="button button-secondary"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                    setModuleId(0);
                  }}
                >
                  {name("catalog.clearFilters")}
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
            <span className="eyebrow">{name("catalog.databaseEyebrow")}</span>
            <h3>{name("catalog.databaseHeading")}</h3>
            <p>{name("catalog.databaseDescription")}</p>
            <div className="database-file">
              <Database size={15} />
              <span>{name("common.databaseFile")}</span>
              <span className="status-dot" />
            </div>
            <Link href="/database/" className="text-link">
              {name("catalog.exploreDatabase")} <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="tips-card">
            <BookOpen size={21} />
            <h3>{name("catalog.referenceHeading")}</h3>
            <p>{name("catalog.referenceDescription")}</p>
            <Link href="/reference/" className="text-link">
              {name("catalog.openReference")} <ArrowRight size={15} />
            </Link>
          </div>
          <div className="course-note">
            <span>{name("catalog.tip")}</span>
            <p>{name("catalog.tipBody")}</p>
            <span className="note-rule" />
          </div>
        </aside>
      </div>
      <footer className="page-footer">
        <span>
          {name("site.name")} <span>·</span> {name("catalog.footerTagline")}
        </span>
        <Link href="/about/">
          {name("catalog.aboutLink")} <ArrowUpRight size={13} />
        </Link>
      </footer>
    </div>
  );
}
