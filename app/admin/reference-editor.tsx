"use client";

import { useEffect, useState, type FormEvent } from "react";
import { tasks } from "@/app/lib/sql/course";
import { resolveReferenceCard } from "@/app/lib/sql/reference";
import { reloadTrainingDatabase, useTrainingDatabase } from "@/app/lib/sql/training-database-store";
import { cloudEnabled } from "@/app/lib/supabase/client";
import {
  MAX_NAME_LENGTH, mergeNameChanges, referenceCardFields, referenceCardKey, resolveName,
  type NameChanges, type ReferenceCardField,
} from "@/app/lib/site-names/registry";
import {
  refreshCloudNames, saveSiteNames, useNamesLoadStatus, useNameValues,
} from "@/app/lib/site-names/store";
import styles from "./reference-editor.module.css";

const labels: Record<ReferenceCardField, string> = {
  title: "Заголовок карточки",
  tags: "Теги SQL",
  theory: "Объяснение",
  example: "SQL-пример",
};

export default function ReferenceEditor() {
  const stored = useNameValues();
  const database = useTrainingDatabase();
  const loadStatus = useNamesLoadStatus();
  const [taskId, setTaskId] = useState(tasks[0].id);
  const [changes, setChanges] = useState<NameChanges>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const draft = mergeNameChanges(stored, changes);
  const keys = referenceCardFields.map((field) => referenceCardKey(taskId, field));
  const dirty = keys.some((key) => changes[key] !== undefined);
  const hasDrafts = Object.keys(changes).length > 0;
  const locked = saving || loadStatus !== "ready" || database.status !== "ready";
  const task = tasks.find((item) => item.id === taskId)!;
  const card = resolveReferenceCard(task, draft, database.config);
  const savedCard = resolveReferenceCard(task, stored, database.config);
  const value = (field: ReferenceCardField) => card[field];

  useEffect(() => {
    if (!hasDrafts) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = true; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDrafts]);

  function change(field: ReferenceCardField, text: string) {
    const key = referenceCardKey(taskId, field);
    setNotice("");
    setError("");
    setChanges((current) => {
      const next = { ...current };
      if (text === savedCard[field]) delete next[key];
      else next[key] = text;
      return next;
    });
  }

  function discard() {
    setChanges((current) => {
      const next = { ...current };
      keys.forEach((key) => { delete next[key]; });
      return next;
    });
    setError("");
    setNotice("");
  }

  function resetCard() {
    setChanges((current) => {
      const next = { ...current };
      keys.forEach((key) => {
        if (stored[key] === undefined) delete next[key];
        else next[key] = null;
      });
      return next;
    });
    setError("");
    setNotice(keys.some((key) => stored[key] !== undefined)
      ? "Исходные значения подготовлены. Нажмите «Сохранить карточку», чтобы применить возврат."
      : "Несохранённые изменения карточки отменены.");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || !dirty) return;
    setNotice("");
    setError("");
    for (const field of referenceCardFields) {
      const text = value(field).trim();
      if (!text || text.length > MAX_NAME_LENGTH) {
        setError(`${labels[field]}: введите от 1 до ${MAX_NAME_LENGTH} символов.`);
        return;
      }
    }
    const submitted: NameChanges = {};
    keys.forEach((key) => { if (changes[key] !== undefined) submitted[key] = changes[key]; });
    setSaving(true);
    try {
      await saveSiteNames(submitted);
      setChanges((current) => {
        const next = { ...current };
        keys.forEach((key) => { if (next[key] === submitted[key]) delete next[key]; });
        return next;
      });
      setNotice("Карточка справочника сохранена.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось сохранить карточку. Повторите попытку.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`account-card ${styles.editor}`} aria-labelledby="reference-editor-title">
      <h2 id="reference-editor-title">Карточки справочника</h2>
      <p className="account-help">{cloudEnabled
        ? "После сохранения изменения доступны всем посетителям справочника."
        : "В деморежиме изменения сохраняются в этом браузере."}</p>
      {loadStatus === "loading" && <p role="status">Загружаем справочник…</p>}
      {database.status === "loading" && <p role="status">Загружаем учебную базу для примеров…</p>}
      {database.status === "error" && <div role="alert">
        <p className="account-error">Не удалось загрузить учебную базу для примеров.</p>
        <button type="button" className="button button-secondary" onClick={() => void reloadTrainingDatabase()}>
          Повторить загрузку учебной базы
        </button>
      </div>}
      {loadStatus === "error" && <div role="alert">
        <p className="account-error">Не удалось загрузить справочник. Черновики сохранены в открытой форме.</p>
        <button type="button" className="button button-secondary" onClick={() => void refreshCloudNames()}>
          Повторить загрузку справочника
        </button>
      </div>}
      <label className={styles.field}>
        Карточка справочника
        <select aria-label="Карточка справочника" value={taskId} disabled={saving} onChange={(event) => {
          setTaskId(event.target.value); setError(""); setNotice("");
        }}>
          {tasks.map((task, index) => <option key={task.id} value={task.id}>
            {String(index + 1).padStart(2, "0")}. {resolveName(referenceCardKey(task.id, "title"), stored)}
            {referenceCardFields.some((field) => changes[referenceCardKey(task.id, field)] !== undefined) ? " — не сохранено" : ""}
          </option>)}
        </select>
      </label>
      <form onSubmit={save} noValidate aria-busy={saving} className={styles.form}>
        <fieldset disabled={locked} className={styles.fields}>
          <legend className="sr-only">Содержание выбранной карточки</legend>
          {referenceCardFields.map((field) => {
            const text = value(field);
            const invalid = !text.trim() || text.trim().length > MAX_NAME_LENGTH;
            return <label key={field} className={styles.field}>
              {labels[field]}
              {field === "theory" || field === "example"
                ? <textarea name={field} aria-label={labels[field]} aria-describedby={`reference-${field}-length`}
                    value={text} rows={field === "example" ? 7 : 5}
                    className={field === "example" ? styles.sql : undefined}
                    spellCheck={field !== "example"} required aria-invalid={invalid}
                    onChange={(event) => change(field, event.target.value)} />
                : <input name={field} aria-label={labels[field]} aria-describedby={`reference-${field}-length`}
                    value={text} required aria-invalid={invalid}
                    onChange={(event) => change(field, event.target.value)} />}
              <small id={`reference-${field}-length`}>{text.trim().length} / {MAX_NAME_LENGTH}</small>
            </label>;
          })}
        </fieldset>
        {error && <p className="account-error" role="alert">{error}</p>}
        {notice && <p className="notice-banner" role="status">{notice}</p>}
        <div className={styles.actions}>
          <button type="submit" className="button button-primary" disabled={locked || !dirty}>
            {saving ? "Сохраняем…" : "Сохранить карточку"}
          </button>
          <button type="button" className="button button-secondary" disabled={locked || !dirty} onClick={discard}>
            Отменить изменения
          </button>
          <button type="button" className="button button-secondary"
            disabled={locked || (!dirty && keys.every((key) => stored[key] === undefined))} onClick={resetCard}>
            Вернуть исходную карточку
          </button>
        </div>
      </form>
      <div className={styles.preview}>
        <h3>Предпросмотр карточки</h3>
        <article className="reference-card">
          <div><span className="reference-tags">{value("tags")}</span></div>
          <h2>{value("title")}</h2>
          <p>{value("theory")}</p>
          <pre className="code-snippet">{value("example")}</pre>
        </article>
      </div>
    </section>
  );
}
