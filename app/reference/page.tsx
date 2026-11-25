"use client";
import { useSiteNames } from "@/app/lib/site-names/store";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import { tasks, taskHref } from "@/app/lib/sql/course";
import { trainingTask } from "@/app/lib/sql/training-database";
import { useTrainingDatabase } from "@/app/lib/sql/training-database-store";
import { PageHeading } from "@/app/components/sql/ui";

export default function ReferencePage() {
  const name = useSiteNames();
  const { config } = useTrainingDatabase();
  const [search, setSearch] = useState("");
  const selected = tasks.filter((task) =>
    (`${task.tags.join(" ")} ${name(`task.${task.id}`)} ${task.theory}`)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="page reference-page">
      <PageHeading
        eyebrow={name("reference.eyebrow")}
        title={name("reference.heading")}
        description="Короткая теория, рабочие примеры и задания, в которых можно сразу попробовать."
      />
      <div className="reference-toolbar">
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label={name("reference.search")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={name("reference.searchPlaceholder")}
          />
        </label>
        <span>
          <BookOpen size={15} />
          {name("reference.dialect")}
        </span>
      </div>
      <div className="query-order">
        <span>{name("reference.order")}</span>
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
        {selected.map((original) => {
          const task = trainingTask(original, config);
          return (
            <article className="reference-card" key={task.id}>
              <div>
                <span className="reference-number">
                  {String(tasks.indexOf(original) + 1).padStart(2, "0")}
                </span>
                <span className="reference-tags">{task.tags.join(" / ")}</span>
              </div>
              <h2>{name(`task.${task.id}`)}</h2>
              <p>{task.theory}</p>
              <pre className="code-snippet">{task.example}</pre>
              <Link className="text-link" href={taskHref(task.id)}>
                {name("reference.tryTask")}
                <ArrowUpRight size={15} />
              </Link>
            </article>
          );
        })}
      </div>
      {!selected.length && (
        <div className="empty-state">
          <Search size={28} />
          <h3>{name("reference.empty")}</h3>
          <p>Попробуйте название SQL-команды или другую формулировку.</p>
          <button
            className="button button-secondary"
            onClick={() => setSearch("")}
          >
            {name("common.clearSearch")}
          </button>
        </div>
      )}
    </div>
  );
}
