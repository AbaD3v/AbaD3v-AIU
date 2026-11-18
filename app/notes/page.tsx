"use client";
import { useSiteNames } from "@/app/lib/site-names/store";
import { useState } from "react";
import { Download, NotebookPen } from "lucide-react";
import { useStudy, updateStudy } from "@/app/lib/sql/store";
import { PageHeading, downloadText } from "@/app/components/sql/ui";
export default function NotesPage() {
  const name = useSiteNames();
  const state = useStudy();
  const [notice, setNotice] = useState("");
  return (
    <div className="page">
      <PageHeading
        eyebrow={name("notes.eyebrow")}
        title={name("notes.heading")}
        description="Наблюдения, полезные запросы и ошибки, к которым хочется вернуться."
      >
        <button
          className="button button-secondary"
          disabled={!state.notes.trim()}
          onClick={() => {
            try {
              downloadText("codeproof-sql-notes.txt", state.notes);
              setNotice("Скачивание заметок запрошено.");
            } catch {
              setNotice(
                "Не удалось скачать заметки. Выделите текст и скопируйте вручную.",
              );
            }
          }}
        >
          <Download size={15} />
          {name("notes.download")}
        </button>
      </PageHeading>
      {notice && (
        <p className="notice-banner" role="status">
          {notice}
        </p>
      )}
      <div className="notes-card">
        <div>
          <NotebookPen size={17} />
          <strong>{name("notes.editor")}</strong>
          <span>
            {state.storageIssue
              ? name("notes.temporary")
              : name("notes.autoSave")}
          </span>
        </div>
        <textarea
          aria-label={name("notes.input")}
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
