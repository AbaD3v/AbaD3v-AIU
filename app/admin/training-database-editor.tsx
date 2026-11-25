"use client";

import { Check, Database, GitBranch, KeyRound, Plus, RotateCcw, Search, Table2, Trash2 } from "lucide-react";
import { useState } from "react";
import { SqlClient } from "@/app/lib/sql/client";
import { shopData, tables } from "@/app/lib/sql/schema";
import {
  defaultTrainingDatabase,
  parseTrainingDatabase,
  type TrainingDatabase,
} from "@/app/lib/sql/training-database";
import {
  publishTrainingDatabase,
  reloadTrainingDatabase,
  useTrainingDatabase,
} from "@/app/lib/sql/training-database-store";
import { cloudEnabled } from "@/app/lib/supabase/client";
import styles from "./training-database-editor.module.css";

type Draft = { names: TrainingDatabase["names"]; rows: Record<string, string[][]> };
const pageSize = 12;

function editDatabase(config: TrainingDatabase): Draft {
  return {
    names: { ...config.names },
    rows: Object.fromEntries(tables.map(table => [
      table.name,
      (config.rows[table.name] ?? shopData[table.name]).map(row => row.map(cell => String(cell ?? ""))),
    ])),
  };
}

export default function TrainingDatabaseEditor() {
  const published = useTrainingDatabase();
  const [editing, setEditing] = useState<{ draft: Draft; revision: string | null } | null>(null);
  const [selected, setSelected] = useState(tables[0].name);
  const [tab, setTab] = useState<"rows" | "schema">("rows");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<"validate" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const draft = editing?.draft ?? editDatabase(published.config);
  const table = tables.find(item => item.name === selected)!;
  const rows = draft.rows[selected];
  const label = (key: string) => draft.names[key] || key;
  const filtered = rows.map((row, index) => ({ row, index })).filter(({ row }) =>
    row.some(value => value.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const stale = editing !== null && editing.revision !== published.revision;
  const unavailable = published.status !== "ready" || (cloudEnabled && published.revision === null);
  const unchanged = editing === null;

  function update(next: Draft) {
    setEditing({ draft: next, revision: editing ? editing.revision : published.revision });
    setError("");
    setNotice("");
  }

  function updateRows(next: string[][]) {
    update({ ...draft, rows: { ...draft.rows, [selected]: next } });
  }

  function addRow() {
    const id = rows.reduce((max, row) => Math.max(max, Number(row[0]) || 0), 0) + 1;
    setQuery("");
    setPage(Math.floor(rows.length / pageSize));
    updateRows([...rows, table.fields.map((field, index) => {
      if (index === 0) return String(id);
      return field.type === "TEXT" || field.key === "fk" ? "" : "0";
    })]);
  }

  async function submit(publish: boolean) {
    if (busy || unchanged || unavailable || stale) return;
    setBusy(publish ? "publish" : "validate");
    setError("");
    setNotice("");
    const worker = new SqlClient();
    try {
      const config = parseTrainingDatabase({
        names: Object.fromEntries(Object.entries(draft.names).map(([key, value]) => [key, value.trim()])),
        rows: Object.fromEntries(tables.map(item => [item.name, draft.rows[item.name].map(row =>
          row.map((value, index) => item.fields[index].type === "TEXT" || !value.trim() ? value : Number(value)),
        )])),
      });
      await worker.validateDatabase(config);
      if (publish) {
        await publishTrainingDatabase(config, editing.revision);
        setEditing(null);
      }
      setNotice(publish
        ? cloudEnabled ? "Учебная база опубликована." : "Учебная база сохранена в этом браузере."
        : "Проверены связи между таблицами и SQL-примеры всех 15 заданий на трёх наборах данных.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось проверить учебную базу.");
    } finally {
      worker.destroy();
      setBusy(null);
    }
  }

  return (
    <section className={styles.editor} aria-label="Редактор учебной базы">
      <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          <Database size={20} aria-hidden="true" />
          <div><strong>Учебная база</strong><small>{editing ? "Есть черновик" : "Опубликованные данные"}</small></div>
        </div>
        <div className={styles.actions}>
          <button className="button button-secondary" type="button" disabled={!!busy || unchanged}
            onClick={() => { setEditing(null); setError(""); setNotice(""); void reloadTrainingDatabase(); }}>
            Отбросить правки
          </button>
          <button className="button button-secondary" type="button" disabled={!!busy || unchanged || unavailable || stale}
            onClick={() => void submit(false)}>Проверить</button>
          <button className="button button-primary" type="button" disabled={!!busy || unchanged || unavailable || stale}
            onClick={() => void submit(true)}>
            <Check size={16} aria-hidden="true" />
            {busy === "publish" ? "Публикуем…" : cloudEnabled ? "Опубликовать" : "Сохранить в браузере"}
          </button>
        </div>
      </div>
      {published.status === "loading" && <p className={styles.message} role="status">Загружаем учебную базу…</p>}
      {published.status === "error" && (
        <div className={styles.message} role="alert">
          Не удалось загрузить учебную базу.{" "}
          <button className="button button-secondary" type="button" onClick={reloadTrainingDatabase}>Повторить</button>
        </div>
      )}
      {published.status === "ready" && unavailable && (
        <p className={styles.message} role="status">Подключение публикации учебной базы ещё не настроено.</p>
      )}
      {stale && <p className={styles.message} role="alert">Опубликована более новая версия. Отбросьте черновик, чтобы открыть её.</p>}
      {busy === "validate" && <p className={styles.message} role="status">Проверяем задания и связи…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}
      <div className={styles.layout}>
        <nav className={styles.tables} aria-label="Таблицы учебной базы">
          {tables.map(item => (
            <button key={item.name} type="button" aria-pressed={item.name === selected}
              onClick={() => { setSelected(item.name); setPage(0); setQuery(""); }}>
              <Table2 size={17} aria-hidden="true" />
              <span><strong>{item.label}</strong><small>{label(item.name)}</small></span>
              <span className={styles.count}>{draft.rows[item.name].length}</span>
            </button>
          ))}
          <button className={styles.restore} type="button" disabled={!!busy || unavailable}
            onClick={() => { update(editDatabase(defaultTrainingDatabase)); setNotice("Исходная база загружена в черновик. Проверьте и опубликуйте её."); }}>
            <RotateCcw size={16} aria-hidden="true" />
            <span>Исходная база</span>
          </button>
        </nav>
        <div className={styles.detail}>
          <div className={styles.detailHeader}>
            <div><h2>{table.label}</h2><p><code>{label(table.name)}</code> · {rows.length} строк</p></div>
            <div className={styles.tabs} aria-label="Вид таблицы">
              <button type="button" aria-pressed={tab === "rows"} onClick={() => setTab("rows")}>Данные</button>
              <button type="button" aria-pressed={tab === "schema"} onClick={() => setTab("schema")}>Структура</button>
            </div>
          </div>
          <fieldset className={styles.fields} disabled={!!busy || unavailable || stale}>
            <legend className="sr-only">{tab === "schema" ? "Редактирование структуры" : "Редактирование данных"}</legend>
            {tab === "schema" ? (
              <div className={styles.schema}>
                <label>Имя таблицы в SQL
                  <input value={draft.names[table.name] ?? table.name} maxLength={48}
                    onChange={event => update({ ...draft, names: { ...draft.names, [table.name]: event.target.value } })} />
                </label>
                <p>Имена в SQL могут содержать латинские строчные буквы, цифры и подчёркивания. Общие имена столбцов обновляются во всех таблицах.</p>
                {table.fields.map(field => (
                  <label className={styles.column} key={field.name}>
                    <span>
                      {field.key === "pk" && <KeyRound size={14} aria-label="Первичный ключ" />}
                      {field.key === "fk" && <GitBranch size={14} aria-label="Внешний ключ" />}
                      {field.description}<small>{field.type}{field.reference && ` · ${field.reference.split(".").map(label).join(".")}`}</small>
                    </span>
                    <input aria-label={`Имя столбца ${field.name}`} value={draft.names[field.name] ?? field.name} maxLength={48}
                      onChange={event => update({ ...draft, names: { ...draft.names, [field.name]: event.target.value } })} />
                  </label>
                ))}
              </div>
            ) : (
              <>
                <div className={styles.rowTools}>
                  <label className="search-input">
                    <Search size={16} aria-hidden="true" />
                    <input type="search" aria-label="Поиск по строкам" placeholder="Поиск по строкам" value={query}
                      onChange={event => { setQuery(event.target.value); setPage(0); }} />
                  </label>
                  <button className="button button-secondary" type="button" onClick={addRow} disabled={rows.length >= 500}>
                    <Plus size={16} aria-hidden="true" /> Добавить строку
                  </button>
                </div>
                <div className={styles.grid} tabIndex={0} aria-label={`Данные таблицы ${label(selected)}`}>
                  <table>
                    <thead><tr>
                      {table.fields.map(field => <th key={field.name} scope="col" title={field.description}>{label(field.name)}</th>)}
                      <th scope="col" aria-label="Действия" />
                    </tr></thead>
                    <tbody>
                      {filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(({ row, index }) => (
                        <tr key={index}>
                          {table.fields.map((field, column) => (
                            <td key={field.name}>
                              <input aria-label={`Строка ${index + 1}, ${label(field.name)}`} value={row[column]}
                                inputMode={field.type === "TEXT" ? "text" : field.type === "INTEGER" ? "numeric" : "decimal"}
                                maxLength={field.type === "TEXT" ? 2000 : 24}
                                onChange={event => {
                                  const value = event.target.value;
                                  updateRows(rows.map((item, rowIndex) => rowIndex === index
                                    ? item.map((cell, cellIndex) => cellIndex === column ? value : cell) : item));
                                }} />
                            </td>
                          ))}
                          <td><button className={styles.remove} type="button" aria-label={`Удалить строку ${index + 1}`}
                            onClick={() => updateRows(rows.filter((_, rowIndex) => rowIndex !== index))}>
                            <Trash2 size={16} aria-hidden="true" />
                          </button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filtered.length && <p className={styles.empty}>{query ? "Строки не найдены." : "Таблица пока пуста."}</p>}
                </div>
                <div className={styles.pagination}>
                  <span>Страница {currentPage + 1} из {pages} · {filtered.length} строк</span>
                  <button type="button" className="button button-secondary" disabled={!currentPage}
                    onClick={() => setPage(currentPage - 1)}>Назад</button>
                  <button type="button" className="button button-secondary" disabled={currentPage + 1 >= pages}
                    onClick={() => setPage(currentPage + 1)}>Далее</button>
                </div>
              </>
            )}
          </fieldset>
        </div>
      </div>
    </section>
  );
}
