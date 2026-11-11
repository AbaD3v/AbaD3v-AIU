"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import { tasks, taskHref } from "@/app/lib/sql/course";
import { PageHeading } from "@/app/components/sql/ui";

export default function ReferencePage() {
  const [search, setSearch] = useState("");
  const selected = tasks.filter((task) =>
    (task.tags.join(" ") + task.title + task.theory)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="page reference-page">
      <PageHeading
        eyebrow="ОБЪЯСНЕНИЯ И ПРИМЕРЫ"
        title="SQL под рукой."
        description="Короткая теория, рабочие примеры и задания, в которых можно сразу попробовать."
      />
      <div className="reference-toolbar">
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="Поиск в справочнике"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Например: JOIN, NULL или группировка"
          />
        </label>
        <span>
          <BookOpen size={15} />
          Диалект SQLite
        </span>
      </div>
      <div className="query-order">
        <span>ПОРЯДОК ЗАПИСИ ЗАПРОСА</span>
        <div>
          {[
            "SELECT",
            "FROM",
            "JOIN … ON",
            "WHERE",
            "GROUP BY",
            "HAVING",
            "ORDER BY",
            "LIMIT",
          ].map((step, i) => (
            <span key={step}>
              {i > 0 && <i>→</i>}
              <code>{step}</code>
            </span>
          ))}
        </div>
        <p>
          Логически строки сначала формируются через FROM / JOIN, затем
          фильтруются и группируются. Сортировка и LIMIT применяются к итоговому
          результату.
        </p>
      </div>
      <div className="reference-grid">
        {selected.map((task) => (
          <article className="reference-card" key={task.id}>
            <div>
              <span className="reference-number">
                {String(tasks.indexOf(task) + 1).padStart(2, "0")}
              </span>
              <span className="reference-tags">{task.tags.join(" / ")}</span>
            </div>
            <h2>{task.title}</h2>
            <p>{task.theory}</p>
            <pre className="code-snippet">{task.example}</pre>
            <Link className="text-link" href={taskHref(task.id)}>
              Попробовать на задаче
              <ArrowUpRight size={15} />
            </Link>
          </article>
        ))}
      </div>
      {!selected.length && (
        <div className="empty-state">
          <Search size={28} />
          <h3>Ничего не найдено</h3>
          <p>Попробуйте название SQL-команды или другую формулировку.</p>
          <button
            className="button button-secondary"
            onClick={() => setSearch("")}
          >
            Очистить поиск
          </button>
        </div>
      )}
    </div>
  );
}
