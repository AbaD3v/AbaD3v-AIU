"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, History, Search, X } from "lucide-react";
import { useStudy, saveDraft } from "@/app/lib/sql/store";
import { getTask, taskHref } from "@/app/lib/sql/course";
import { PageHeading } from "@/app/components/sql/ui";

export default function HistoryPage() {
  const state = useStudy();
  const [search, setSearch] = useState("");
  const entries = state.history.filter((entry) =>
    (entry.sql + " " + getTask(entry.taskId)?.title)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="page">
      <PageHeading
        eyebrow="ТВОИ ПОПЫТКИ"
        title="У каждого решения есть история."
        description="Последние 100 запусков и проверок. Верни любой запрос в редактор и продолжи работу."
      />
      <label className="search-input history-search">
        <Search size={17} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по запросу или заданию"
          aria-label="Поиск в истории"
        />
      </label>
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
                <Link
                  href={taskHref(entry.taskId)}
                  onClick={() => saveDraft(entry.taskId, entry.sql)}
                  className="text-link"
                >
                  Вернуть в редактор
                  <ArrowUpRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <History size={35} />
          <h2>{search ? "Попытки не найдены" : "Первый запрос ещё впереди"}</h2>
          <p>
            {search
              ? "Измените поисковый запрос."
              : "Запускай SQL в заданиях — здесь появятся запросы и результаты проверок."}
          </p>
          <Link href="/" className="button button-primary">
            Открыть практикум
            <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}
