"use client";
import { Download, NotebookPen } from "lucide-react";
import { useStudy, updateStudy } from "@/app/lib/sql/store";
import { PageHeading, downloadText } from "@/app/components/sql/ui";
export default function NotesPage() {
  const state = useStudy();
  return (
    <div className="page">
      <PageHeading
        eyebrow="ЛИЧНЫЙ КОНСПЕКТ"
        title="Запиши то, что пригодится."
        description="Наблюдения, полезные запросы и ошибки, к которым хочется вернуться."
      >
        <button
          className="button button-secondary"
          disabled={!state.notes.trim()}
          onClick={() => downloadText("codeproof-sql-notes.txt", state.notes)}
        >
          <Download size={15} />
          Скачать заметки
        </button>
      </PageHeading>
      <div className="notes-card">
        <div>
          <NotebookPen size={17} />
          <strong>Мой SQL-конспект</strong>
          <span>
            {state.storageIssue
              ? "Только в этой вкладке"
              : "Сохраняется автоматически"}
          </span>
        </div>
        <textarea
          aria-label="Заметки по SQL"
          maxLength={50000}
          value={state.notes}
          onChange={(event) =>
            updateStudy((current) => ({
              ...current,
              notes: event.target.value,
            }))
          }
          placeholder={
            "Например:\n\nWHERE фильтрует строки, а HAVING — группы.\n\nЧтобы найти строки без пары, использую LEFT JOIN и IS NULL.\n\nМой полезный запрос:\n"
          }
        />
        <footer>
          {state.notes.length.toLocaleString("ru-RU")} / 50 000 символов
        </footer>
      </div>
    </div>
  );
}
