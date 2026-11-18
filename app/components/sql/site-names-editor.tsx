"use client";

import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import {
  mergeNameChanges,
  nameGroups,
  resolveName,
  type NameChanges,
  type NameKey,
} from "@/app/lib/site-names/registry";
import { saveSiteNames, useNameValues } from "@/app/lib/site-names/store";
import styles from "./site-names-editor.module.css";

export default function SiteNamesEditor() {
  const stored = useNameValues();
  const [search, setSearch] = useState("");
  const [changes, setChanges] = useState<NameChanges>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const query = search.trim().toLocaleLowerCase("ru");
  const name = (key: NameKey) => resolveName(key, stored);
  const draft = mergeNameChanges(stored, changes);
  const hasChanges = Object.keys(changes).length > 0;
  const matches = (value: string) => value.toLocaleLowerCase("ru").includes(query);
  const groups = nameGroups
    .map((group) => ({
      ...group,
      fields: matches(group.title) ? group.fields : group.fields.filter(({ key, original }) =>
        matches(original) || matches(name(key)) || matches(resolveName(key, draft)) || matches(key),
      ),
    }))
    .filter((group) => group.fields.length > 0);

  function change(key: NameKey, value: string | null) {
    setNotice("");
    setError("");
    setChanges((current) => {
      const next = { ...current };
      if (value === null ? stored[key] === undefined : value === name(key)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasChanges) return;
    setNotice("");
    setError("");
    try {
      saveSiteNames(changes);
      setChanges({});
      setNotice("Названия сохранены.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось сохранить названия.");
    }
  }

  return (
    <section className={`account-card ${styles.editor}`} aria-labelledby="site-names-heading">
      <h2 id="site-names-heading">{name("admin.namesHeading")}</h2>
      <form className={styles.form} onSubmit={save} noValidate>
        <label className={`search-input ${styles.search}`}>
          <Search size={16} />
          <input
            type="search"
            placeholder={name("admin.namesSearch")}
            aria-label={name("admin.namesSearch")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {groups.map(({ id, title, fields }) => (
          <details key={id + (query ? "-search" : "")} className={styles.group} open={!!query || id === "site"}>
            <summary>{title}</summary>
            <div className={styles.fields}>
              {fields.map(({ key, original }) => {
                const value = resolveName(key, draft);
                const saved = name(key);
                const pending = changes[key] !== undefined;
                return (
                  <div className={styles.field} key={key}>
                    <label>
                      <span>{original}</span>
                      <input
                        type="text"
                        name={key}
                        value={value}
                        required
                        aria-invalid={pending && !value.trim()}
                        onChange={(event) => change(key, event.target.value)}
                      />
                    </label>
                    <button
                      className="button button-secondary"
                      type="button"
                      aria-label={`${name("admin.resetName")} — ${original}`}
                      disabled={stored[key] === undefined && !pending}
                      onClick={() => change(key, null)}
                    >
                      {name("admin.resetName")}
                    </button>
                    {pending && (
                      <small className="account-help">{name("admin.nameSaved")} · {saved}</small>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        ))}
        {!groups.length && <p>{name("admin.namesNotFound")}</p>}
        {error && <p className="account-error" role="alert">{error}</p>}
        {notice && <p className="notice-banner" role="status">{notice}</p>}
        <div>
          <button type="submit" className="button button-primary" disabled={!hasChanges}>{name("admin.saveNames")}</button>
        </div>
      </form>
    </section>
  );
}
