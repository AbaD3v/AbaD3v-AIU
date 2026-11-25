"use client";
import { refreshCloudNames, useNamesLoadStatus, useNameValues, useSiteNames } from "@/app/lib/site-names/store";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Search } from "lucide-react";
import { tasks, taskHref } from "@/app/lib/sql/course";
import { resolveReferenceCard } from "@/app/lib/sql/reference";
import { useTrainingDatabase } from "@/app/lib/sql/training-database-store";
import { PageHeading } from "@/app/components/sql/ui";

export default function ReferencePage() {
  const name = useSiteNames();
  const { config } = useTrainingDatabase();
  const loadStatus = useNamesLoadStatus();
  const values = useNameValues();
  const [search, setSearch] = useState("");
  const cards = tasks.map((task, index) => ({
    id: task.id,
    number: index + 1,
    ...resolveReferenceCard(task, values, config),
  }));
  const selected = cards.filter((card) =>
    `${card.tags} ${card.title} ${card.theory} ${card.example}`
      .toLocaleLowerCase("ru")
      .includes(search.trim().toLocaleLowerCase("ru")),
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
      {loadStatus === "loading" && <p role="status">Загружаем справочник…</p>}
      {loadStatus === "error" && <div role="alert">
        <p>Не удалось загрузить обновления справочника. Показаны доступные материалы.</p>
        <button type="button" className="button button-secondary" onClick={() => void refreshCloudNames()}>
          Повторить загрузку справочника
        </button>
      </div>}
      <div className="reference-grid">
        {selected.map((card) => (
          <article className="reference-card" key={card.id}>
            <div>
              <span className="reference-number">
                {String(card.number).padStart(2, "0")}
              </span>
              <span className="reference-tags">{card.tags}</span>
            </div>
            <h2>{card.title}</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{card.theory}</p>
            <pre className="code-snippet">{card.example}</pre>
            <Link className="text-link" href={taskHref(card.id)}>
              {name("reference.tryTask")}
              <ArrowUpRight size={15} />
            </Link>
          </article>
        ))}
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
