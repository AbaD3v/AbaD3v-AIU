"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getTask, taskHref } from "@/app/lib/sql/course";
import { useStudy, saveDraft } from "@/app/lib/sql/store";
import { Modal, downloadText } from "./ui";

export default function RestoreQuery({
  taskId,
  sql,
  navigate = false,
  children = "В редактор",
  className = "text-button",
}: {
  taskId: string;
  sql: string;
  navigate?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const state = useStudy();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const draft = state.drafts[taskId] ?? getTask(taskId)!.starter;
  function restore() {
    saveDraft(taskId, sql);
    setConfirm(false);
    if (navigate) router.push(taskHref(taskId));
  }
  return (
    <>
      <button
        className={className}
        onClick={() => {
          if (
            draft.trim() &&
            draft !== sql &&
            draft !== getTask(taskId)!.starter
          ) {
            setNotice("");
            setConfirm(true);
          } else restore();
        }}
      >
        {children}
        <ArrowUpRight size={14} />
      </button>
      {confirm && (
        <Modal
          title="Заменить текущий черновик?"
          onClose={() => setConfirm(false)}
        >
          <p>
            В задании «{getTask(taskId)!.title}» уже есть другой запрос. Можно
            скачать его перед заменой. История запусков сохранится.
          </p>
          <pre className="code-snippet solution-code">{draft}</pre>
          {notice && <p role="status">{notice}</p>}
          <div className="modal-actions">
            <button
              className="button button-secondary"
              onClick={() => setConfirm(false)}
            >
              Отмена
            </button>
            <button
              className="button button-secondary"
              onClick={() => {
                try {
                  downloadText(taskId + "-draft.sql", draft);
                  setNotice("Скачивание черновика запрошено.");
                } catch {
                  setNotice(
                    "Не удалось скачать файл. Скопируйте запрос из окна перед заменой.",
                  );
                }
              }}
            >
              Скачать черновик
            </button>
            <button className="button button-primary" onClick={restore}>
              Заменить запрос
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
