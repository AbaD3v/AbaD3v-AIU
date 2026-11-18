"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, History, Search, X } from "lucide-react";
import { useAccounts } from "@/app/lib/accounts/store";
import { getStudyScope, useStudy } from "@/app/lib/sql/store";
import { getTask, tasks } from "@/app/lib/sql/course";
import { PageHeading } from "@/app/components/sql/ui";
import RestoreQuery from "@/app/components/sql/restore-query";
import { actionOptions, defaultFilters, readFilters, resultOptions, saveFilters } from "./history-filters";
import styles from "./history-filters.module.css";

export default function HistoryPage() {
  const { ready, error } = useAccounts();
  const storageKey = ready && !error ? `${getStudyScope()}.history-filters.v1` : null;
  return (
    <div className="page">
      <PageHeading
        eyebrow="ТВОИ ПОПЫТКИ"
        title="У каждого решения есть история."
        description="Последние 100 запусков и проверок. Верни любой запрос в редактор и продолжи работу."
      />
      {ready ? (
        <HistoryForScope key={storageKey} storageKey={storageKey} />
      ) : (
        <p role="status">Загружаем историю…</p>
      )}
    </div>
  );
}

function HistoryForScope({ storageKey }: { storageKey: string | null }) {
  const state = useStudy();
  const [filters, setFilters] = useState(() => readFilters(storageKey));
  const query = filters.search.trim().toLowerCase();
  const chips = [
    { key: "taskId", label: getTask(filters.taskId)?.title },
    { key: "action", label: actionOptions.find((option) => option.value === filters.action)?.label },
    { key: "result", label: resultOptions.find((option) => option.value === filters.result)?.label },
    { key: "search", label: filters.search && `Поиск: «${filters.search}»` },
  ] as const;
  const entries = state.history.filter((entry) => {
    const result = entry.success ? "success" : "failure";
    if (filters.taskId && filters.taskId !== entry.taskId) return false;
    if (filters.action && filters.action !== entry.action) return false;
    if (filters.result && filters.result !== result) return false;
    return (
      !query ||
      entry.sql.toLowerCase().includes(query) ||
      getTask(entry.taskId)?.title.toLowerCase().includes(query)
    );
  });

  function updateFilters(next: typeof filters) {
    setFilters(next);
    saveFilters(storageKey, next);
  }

  function setFilter(key: keyof typeof filters, value: string) {
    updateFilters({ ...filters, [key]: value });
  }

  return (
    <>
      <div className={styles.filters}>
        <label className={`search-input ${styles.search}`}>
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => setFilter("search", event.target.value)}
            placeholder="Поиск по запросу или заданию"
            aria-label="Поиск в истории"
          />
        </label>
        <label className={styles.field}>
          Задание
          <select
            value={filters.taskId}
            onChange={(event) => setFilter("taskId", event.target.value)}
          >
            <option value="">Все задания</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Действие
          <select
            value={filters.action}
            onChange={(event) => setFilter("action", event.target.value)}
          >
            <option value="">Все попытки</option>
            {actionOptions.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Результат
          <select
            value={filters.result}
            onChange={(event) => setFilter("result", event.target.value)}
          >
            <option value="">Все результаты</option>
            {resultOptions.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.summary}>
        <output>Найдено записей: {entries.length}</output>
        <div className={styles.chips}>
          {chips.map(({ key, label }) => label && (
            <button
              key={key}
              type="button"
              className={styles.chip}
              aria-label={key === "search" ? "Очистить поиск" : `Снять фильтр: ${label}`}
              onClick={() => setFilter(key, "")}
            >
              <span>{label}</span>
              <X size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="button button-secondary"
          disabled={!chips.some((chip) => chip.label)}
          onClick={() => updateFilters(defaultFilters)}
        >
          Сбросить фильтры
        </button>
      </div>
      {entries.length ? (
        <div className="history-page-list">
          {entries.map((entry) => (
            <article key={entry.id}>
              <div className="history-entry-heading">
                <span
                  className={
                    entry.success ? "history-success" : "history-error"
                  }
                >
                  {entry.success ? <Check size={14} /> : <X size={14} />}
                  {entry.action === "check"
                    ? entry.success
                      ? "Решение верное"
                      : "Проверка не пройдена"
                    : entry.success
                      ? "Запрос выполнен"
                      : "Ошибка запроса"}
                </span>
                <time>
                  {new Date(entry.date).toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <h2>{getTask(entry.taskId)?.title}</h2>
              <pre className="code-snippet">{entry.sql}</pre>
              {entry.error && (
                <p className="history-error-text">{entry.error}</p>
              )}
              <div className="history-entry-footer">
                <span>
                  {entry.rows} строк · {entry.elapsed} мс
                </span>
                <RestoreQuery
                  taskId={entry.taskId}
                  sql={entry.sql}
                  navigate
                  className="text-link"
                >
                  Вернуть в редактор
                </RestoreQuery>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <History size={35} />
          <h2>
            {state.history.length ? "Попытки не найдены" : "Первый запрос ещё впереди"}
          </h2>
          <p>
            {state.history.length
              ? "Измените поиск или сбросьте фильтры."
              : "Запускай SQL в заданиях — здесь появятся запросы и результаты проверок."}
          </p>
          {state.history.length === 0 && (
            <Link href="/" className="button button-primary">
              Открыть практикум
              <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      )}
    </>
  );
}
