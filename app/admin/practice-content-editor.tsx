"use client";

import { useState } from "react";
import { BookOpen, ChevronRight, FileText, RotateCcw, Search } from "lucide-react";
import { modules, tasks } from "@/app/lib/sql/course";
import { lessonContentGroups } from "@/app/lib/site-names/practice-lesson";
import {
  mergeNameChanges, nameDefaults, resolveName,
  type NameChanges, type NameKey, type NameValues,
} from "@/app/lib/site-names/registry";
import {
  refreshCloudNames, saveSiteNames, useNamesLoadStatus, useNameValues,
} from "@/app/lib/site-names/store";
import styles from "./practice-content-editor.module.css";

type Field = { key: NameKey; label: string; kind: "text" | "multiline" | "sql" };
type Section = { id: string; title: string; titleKey?: NameKey; module?: number; fields: Field[] };

function field(key: NameKey, label: string, kind: Field["kind"] = "text"): Field {
  return { key, label, kind };
}

function interfaceFields(prefix: string): Field[] {
  return Array.from(nameDefaults).filter(([key]) => key.startsWith(prefix)).map(([key, original]) =>
    field(key, original, original.length > 65 || original.includes("\n") ? "multiline" : "text"));
}

function variablesIn(key: NameKey) {
  return (nameDefaults.get(key) ?? "").match(/\{[a-zA-Z][a-zA-Z0-9]*\}/g) ?? [];
}

const sections: Section[] = modules.flatMap<Section>((module) => [
  {
    id: `module-${module.id}`, title: "Карточка модуля", module: module.id,
    fields: [
      field(`module.${module.id}`, "Название модуля"),
      field(`module.short.${module.id}`, "Короткое название для фильтра"),
      field(`module.subtitle.${module.id}`, "Подзаголовок"),
      field(`module.description.${module.id}`, "Описание", "multiline"),
    ],
  },
  ...tasks.filter((task) => task.module === module.id).map((task) => ({
    id: task.id, title: task.title, titleKey: `task.${task.id}` as NameKey, module: module.id,
    fields: [
      field(`task.${task.id}`, "Название задания"),
      ...(lessonContentGroups.find((group) => group.id === `lesson-${task.id}`)?.fields ?? []),
    ],
  })),
]);
sections.push(
  { id: "catalog", title: "Главная практикума", fields: interfaceFields("catalog.") },
  { id: "workspace", title: "Страница задания", fields: [
    ...interfaceFields("practice."),
    field("quiz.open", "Кнопка перехода к тесту"),
    field("quiz.entryLocked", "Сообщение до решения задания"),
    field("quiz.entryReady", "Приглашение пройти тест"),
  ] },
  { id: "shared", title: "Общие подписи", fields: interfaceFields("common.") },
);

function titleOf(section: Section, values: NameValues) {
  return section.titleKey ? resolveName(section.titleKey, values) : section.title;
}

function topicOf(key: NameKey) {
  if (key.includes(".hint.")) return "Подсказки";
  if (key.endsWith(".theory") || key.endsWith(".example")) return "Теория";
  if (/\.(starter|solution|explanation)$/.test(key)) return "SQL и разбор";
  return "Условие";
}

export default function PracticeContentEditor() {
  const stored = useNameValues();
  const status = useNamesLoadStatus();
  const [selectedId, select] = useState(tasks[0].id);
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("Все поля");
  const [changes, setChanges] = useState<NameChanges>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const count = Object.keys(changes).length;
  const draft = mergeNameChanges(stored, changes);
  const query = search.trim().toLocaleLowerCase("ru");
  const matches = (text: string) => text.toLocaleLowerCase("ru").includes(query);
  const results = sections.flatMap((section) => {
    const moduleName = section.module ? resolveName(`module.${section.module}`, stored) : "";
    if (!query || matches(titleOf(section, stored)) || matches(moduleName)) return [section];
    const fields = section.fields.filter(({ key, label }) =>
      matches(label) || matches(resolveName(key, stored)) || matches(key));
    return fields.length ? [{ ...section, fields }] : [];
  });
  const active = results.find((section) => section.id === selectedId) ?? results[0];
  const showTopics = active?.titleKey !== undefined && !query;
  const visibleFields = showTopics && topic !== "Все поля"
    ? active.fields.filter(({ key }) => topicOf(key) === topic)
    : active?.fields;
  const disabled = saving || status !== "ready";

  function change(key: NameKey, value: string | null) {
    setError("");
    setNotice("");
    setChanges((current) => {
      const next = { ...current };
      if (value === null ? stored[key] === undefined : value === resolveName(key, stored)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  async function publish() {
    if (disabled || !count) return;
    setNotice("");
    setError("");
    for (const section of sections) {
      for (const { key, label } of section.fields) {
        const value = changes[key];
        if (typeof value !== "string") continue;
        const missing = variablesIn(key).filter((variable) => !value.includes(variable));
        if (!value.trim() || missing.length) {
          setSearch("");
          select(section.id);
          setTopic("Все поля");
          setError(missing.length ? `Добавьте ${missing.join(", ")} в поле «${label}».`
            : `Заполните поле «${label}» или верните исходный текст.`);
          requestAnimationFrame(() => document.getElementById(`practice-content-${key}`)?.focus());
          return;
        }
      }
    }
    setSaving(true);
    try {
      await saveSiteNames(changes);
      setChanges({});
      setNotice("Изменения опубликованы.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось опубликовать изменения. Попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.editor}>
      <aside className={styles.library} aria-label="Материалы практикума">
        <label className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label="Поиск по материалам" placeholder="Найти текст или задание"
            value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className={styles.outline}>
          {[...modules.map(({ id }) => ({ id, title: resolveName(`module.${id}`, stored) })),
            { id: 0, title: "Тексты интерфейса" }].map((group) => {
              const items = results.filter((item) => (item.module ?? 0) === group.id);
              if (!items.length) return null;
              return <div className={styles.group} key={group.id}>
                <h3>{group.id > 0 && `${group.id}. `}{group.title}</h3>
                {items.map((item) => (
                  <button type="button" key={item.id} aria-current={item.id === active?.id ? "true" : undefined}
                    onClick={() => { select(item.id); setTopic("Все поля"); }}>
                    <span>{titleOf(item, stored)}</span>
                    {sections.find((section) => section.id === item.id)?.fields.some(({ key }) => key in changes)
                      && <span className={styles.dot} aria-label="Есть изменения" />}
                  </button>
                ))}
              </div>;
            })}
        </div>
      </aside>
      <div className={styles.panel}>
        {active ? (
          <>
            <header className={styles.header}>
              <div className={styles.context}><BookOpen size={16} aria-hidden="true" />
                {active.module ? resolveName(`module.${active.module}`, stored) : "Тексты интерфейса"}
                <ChevronRight size={14} aria-hidden="true" />
                {active.titleKey ? "Задание" : active.module ? "Модуль" : "Практикум"}
              </div>
              <h2>{titleOf(active, stored)}</h2>
              {showTopics && <div className={styles.topics} role="group" aria-label="Раздел задания">
                {["Все поля", "Условие", "Подсказки", "Теория", "SQL и разбор"].map((label) => (
                  <button key={label} type="button" aria-pressed={label === topic} onClick={() => setTopic(label)}>
                    {label}
                  </button>
                ))}
              </div>}
            </header>
            <div className={styles.fields}>
              {visibleFields?.map(({ key, label, kind }) => {
                const value = resolveName(key, draft);
                const modified = key in changes;
                const variables = variablesIn(key);
                const inputProps = {
                  id: `practice-content-${key}`, name: key, value, disabled, maxLength: 2000,
                  "aria-invalid": modified && !value.trim(),
                };
                return <div className={styles.field} key={key}>
                  <div className={styles.fieldHeading}>
                    <label htmlFor={inputProps.id}>{label}</label>
                    <button type="button" className={styles.reset}
                      title="Вернуть исходный текст" aria-label={`Вернуть исходный текст — ${label}`}
                      disabled={disabled || (!modified && stored[key] === undefined) || changes[key] === null}
                      onClick={() => change(key, null)}>
                      <RotateCcw size={15} aria-hidden="true" />
                    </button>
                  </div>
                  {kind === "text"
                    ? <input {...inputProps} type="text" onChange={(event) => change(key, event.target.value)} />
                    : <textarea {...inputProps} rows={kind === "sql" ? 4 : 3} spellCheck={kind !== "sql"}
                        className={kind === "sql" ? styles.sql : undefined}
                        onChange={(event) => change(key, event.target.value)} />}
                  {variables.length > 0 && <small>Сохраните подстановки: {variables.join(", ")}</small>}
                  {key.endsWith(".solution") && <small>Этот пример увидит студент в разборе. Проверка использует эталонный запрос курса.</small>}
                  {modified && <small>{changes[key] === null ? "Исходный текст будет восстановлен" : "Не опубликовано"}</small>}
                </div>;
              })}
            </div>
          </>
        ) : <div className={styles.empty}><FileText size={28} aria-hidden="true" /><h2>Ничего не найдено</h2>
          <button className="button button-secondary" onClick={() => setSearch("")}>Сбросить поиск</button>
        </div>}
        <footer className={styles.footer}>
          {status === "error" && <div className={styles.problem} role="alert">
            Не удалось загрузить материалы. <button type="button" onClick={() => void refreshCloudNames()}>Повторить загрузку</button>
          </div>}
          {error && <p role="alert" className={styles.problem}>{error}</p>}
          <div className={styles.publishRow}>
            <span role="status">{status === "loading" ? "Загружаем материалы…"
              : count ? `Изменено полей: ${count}` : notice}</span>
            <button type="button" className="button button-primary" disabled={disabled || !count} onClick={publish}>
              {saving ? "Публикуем…" : "Опубликовать изменения"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
