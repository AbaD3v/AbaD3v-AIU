"use client";
import { useSiteNames } from "@/app/lib/site-names/store";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X, Check, Circle, ArrowUpRight, Database, Table2 } from "lucide-react";
import Link from "next/link";
import type { Cell } from "@/app/lib/sql/schema";
import { taskHref, type Task } from "@/app/lib/sql/course";
import { difficultyNames } from "@/app/lib/site-names/registry";
import type { TaskProgress } from "@/app/lib/sql/progress";

export function Status({
  progress,
  started,
}: {
  progress?: TaskProgress;
  started?: boolean;
}) {
  const name = useSiteNames();
  if (progress?.solvedAt)
    return (
      <span className="status status-done">
        <Check size={13} />
        {name("common.solved")}
      </span>
    );
  if (
    started ||
    progress?.startedAt ||
    progress?.runs ||
    progress?.hints ||
    progress?.solutionViewed
  )
    return (
      <span className="status status-started">
        <span className="status-dot" />{name("common.inProgress")}
      </span>
    );
  return (
    <span className="status status-idle">
      <Circle size={12} />
      {name("common.notStarted")}
    </span>
  );
}

export function TaskLink({
  task,
  index,
  progress,
  started,
}: {
  task: Task;
  index: number;
  progress?: TaskProgress;
  started?: boolean;
}) {
  const name = useSiteNames();
  return (
    <Link className="task-row" href={taskHref(task.id)}>
      <span className={"task-number " + (progress?.solvedAt ? "done" : "")}>
        {progress?.solvedAt ? (
          <Check size={17} />
        ) : (
          String(index + 1).padStart(2, "0")
        )}
      </span>
      <span className="task-row-main">
        <strong>{name(`task.${task.id}`)}</strong>
        <span>{task.tags.join(" · ")}</span>
      </span>
      <span
        className={
          "difficulty " +
          (task.difficulty === "Начальный"
            ? "easy"
            : task.difficulty === "Средний"
              ? "medium"
              : "advanced")
        }
      >
        <i />
        <i />
        <i />
        <span>{name(difficultyNames[task.difficulty])}</span>
      </span>
      <span className="task-time">{task.minutes} {name("common.minutes")}</span>
      <Status progress={progress} started={started} />
      <ArrowUpRight size={16} className="row-arrow" />
    </Link>
  );
}

export function DataTable({
  columns,
  rows,
  max = 1000,
  caption,
  emptyMessage = "Запрос выполнен. Ни одна строка не соответствует условиям.",
}: {
  columns: string[];
  rows: Cell[][];
  max?: number;
  caption?: string;
  emptyMessage?: string;
}) {
  const name = useSiteNames();
  return (
    <div
      className="data-scroll"
      tabIndex={0}
      role="region"
      aria-label={caption || name("common.resultTable")}
    >
      <table className="data-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col" className="row-index" aria-label={name("common.rowNumber")}>
              #
            </th>
            {columns.map((column, i) => (
              <th key={i} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, max).map((row, i) => (
            <tr key={i}>
              <td className="row-index">{i + 1}</td>
              {row.map((value, j) => (
                <td
                  key={j}
                  className={typeof value === "number" ? "cell-number" : ""}
                >
                  {value === null ? (
                    <span className="cell-null">NULL</span>
                  ) : (
                    String(value)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="table-empty">
          <Table2 size={25} />
          <strong>{name("common.noRows")}</strong>
          <span>{emptyMessage}</span>
        </div>
      )}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const name = useSiteNames();
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== ref.current) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
      aria-labelledby={headingId}
    >
      <div className="modal-heading">
        <h2 id={headingId}>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label={name("common.close")}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

export function DatabaseBadge() {
  const name = useSiteNames();
  return (
    <span className="database-badge">
      <Database size={13} />
      <span>{name("common.databaseFile")}</span>
      <i />
    </span>
  );
}

export function downloadText(
  name: string,
  content: string,
  type = "text/plain",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
