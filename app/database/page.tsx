"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  GitBranch,
  KeyRound,
  Search,
  Table2,
} from "lucide-react";
import { tables, shopData } from "@/app/lib/sql/schema";
import { tasks, taskHref } from "@/app/lib/sql/course";
import { DataTable, PageHeading, DatabaseBadge } from "@/app/components/sql/ui";

export default function DatabasePage() {
  const [selected, setSelected] = useState("products");
  const [tab, setTab] = useState("data");
  const [query, setQuery] = useState("");
  const table = tables.find((item) => item.name === selected)!;
  const rows = shopData[selected].filter((row) =>
    row.some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
  );
  const task = tasks.find((item) => item.tables.includes(selected))!;
  return (
    <div className="page">
      <PageHeading
        eyebrow="ДАННЫЕ ДЛЯ ПРАКТИКИ"
        title="Познакомься с магазином."
        description="Все задания используют эту базу. Изучи таблицы, значения и связи между ними."
      >
        <DatabaseBadge />
      </PageHeading>
      <div className="database-overview">
        <div>
          <Database size={23} />
          <span>
            <strong>shop.db</strong>
            <small>Учебный интернет-магазин</small>
          </span>
        </div>
        <span>
          <strong>{tables.length}</strong> таблиц
        </span>
        <span>
          <strong>
            {Object.values(shopData).reduce(
              (sum, rows) => sum + rows.length,
              0,
            )}
          </strong>{" "}
          строк данных
        </span>
        <span className="database-period">Январь — март 2026</span>
      </div>
      <div className="segmented-control">
        <button
          className={tab === "data" ? "active" : ""}
          onClick={() => setTab("data")}
        >
          <Table2 size={15} />
          Данные и столбцы
        </button>
        <button
          className={tab === "schema" ? "active" : ""}
          onClick={() => setTab("schema")}
        >
          <GitBranch size={15} />
          Связи таблиц
        </button>
      </div>
      {tab === "data" ? (
        <div className="database-layout">
          <aside className="table-list">
            {tables.map((item) => (
              <button
                key={item.name}
                className={selected === item.name ? "active" : ""}
                onClick={() => {
                  setSelected(item.name);
                  setQuery("");
                }}
              >
                <Table2 size={17} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.label}</small>
                </span>
                <span>{shopData[item.name].length}</span>
              </button>
            ))}
            <p>
              <KeyRound size={13} />
              Первичный ключ однозначно определяет каждую строку.
            </p>
          </aside>
          <section className="table-inspector">
            <div className="inspector-heading">
              <div>
                <span className="eyebrow">{table.label}</span>
                <h2>{table.name}</h2>
                <p>{table.description}</p>
              </div>
              <Link
                className="button button-secondary"
                href={taskHref(task.id)}
              >
                К заданию
                <ArrowRight size={15} />
              </Link>
            </div>
            <div className="field-list">
              {table.fields.map((field) => (
                <div key={field.name}>
                  <span>
                    {field.key === "pk" ? (
                      <KeyRound size={12} />
                    ) : field.key === "fk" ? (
                      <GitBranch size={12} />
                    ) : (
                      <span className="field-dot" />
                    )}
                  </span>
                  <code>{field.name}</code>
                  <span>{field.type}</span>
                  <p>
                    {field.description}
                    {field.reference && <small> → {field.reference}</small>}
                  </p>
                </div>
              ))}
            </div>
            <div className="table-search-row">
              <span>
                {rows.length} из {shopData[selected].length} строк
              </span>
              <label className="search-input">
                <Search size={15} />
                <input
                  aria-label="Поиск по таблице"
                  placeholder="Поиск по таблице"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <DataTable
              columns={table.fields.map((field) => field.name)}
              rows={rows}
              caption={table.label}
            />
          </section>
        </div>
      ) : (
        <>
          <div className="relationship-intro">
            <GitBranch size={21} />
            <p>
              Покупатель создаёт заказы. Заказ содержит позиции и платежи.
              Каждая позиция ссылается на товар.
            </p>
          </div>
          <div className="schema-grid">
            {tables.map((item) => (
              <button
                key={item.name}
                className="schema-card"
                onClick={() => {
                  setSelected(item.name);
                  setTab("data");
                  setQuery("");
                }}
              >
                <div>
                  <Table2 size={17} />
                  <strong>{item.name}</strong>
                  <span>{shopData[item.name].length}</span>
                </div>
                {item.fields.map((field) => (
                  <p key={field.name}>
                    <span>
                      {field.key === "pk" && <KeyRound size={11} />}
                      {field.key === "fk" && <GitBranch size={11} />}
                      {field.name}
                    </span>
                    <small>{field.reference ?? field.type}</small>
                  </p>
                ))}
                <span className="schema-card-action">
                  Посмотреть данные
                  <ArrowRight size={13} />
                </span>
              </button>
            ))}
          </div>
          <div className="relationship-list">
            {tables.flatMap((item) =>
              item.fields
                .filter((field) => field.reference)
                .map((field) => (
                  <div key={item.name + field.name}>
                    <code>
                      {item.name}.{field.name}
                    </code>
                    <span>много → один</span>
                    <code>{field.reference}</code>
                  </div>
                )),
            )}
          </div>
        </>
      )}
      <p className="data-disclaimer">
        Все записи вымышлены. Суммы — в условных единицах. При проверке
        используются ещё два набора с изменёнными данными.
      </p>
    </div>
  );
}
