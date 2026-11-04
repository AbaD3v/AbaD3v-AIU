"use client";

import { useState } from "react";
import { languages, levels } from "../lib/languages";
import { useSession } from "./session-provider";
import { Icon } from "./ui-icon";
import s from "./learning.module.css";

export default function LearnerOnboarding({
  onDone,
  editing = false,
}: {
  onDone?: () => void;
  editing?: boolean;
}) {
  const { account, updatePreferences } = useSession();
  const [selected, setSelected] = useState(account?.languages ?? []);
  const [level, setLevel] = useState(account?.level ?? "beginner");
  const [search, setSearch] = useState("");
  const filtered = languages.filter((language) =>
    language.name.toLowerCase().includes(search.toLowerCase()),
  );

  function save() {
    updatePreferences(selected, level);
    onDone?.();
  }

  return (
    <section className={s.preferences} aria-labelledby="preferences-title">
      <div className={s.preferencesHeading}>
        <span className={s.eyebrow}>
          {editing
            ? "НАСТРОЙКИ ОБУЧЕНИЯ"
            : `ПРИВЕТ, ${account?.name.toUpperCase()}`}
        </span>
        <h1 id="preferences-title">Как тебе удобнее учиться?</h1>
        <p>
          Отметь знакомые языки и выбери глубину объяснений. Эти настройки можно
          изменить в профиле в любой момент.
        </p>
      </div>
      <div className={s.preferenceCard}>
        <div className={s.sectionTitle}>
          <div>
            <h2>Какие языки ты уже изучал?</h2>
            <p>Можно выбрать несколько или пока ни одного.</p>
          </div>
          <span className={s.badge}>{selected.length} выбрано</span>
        </div>
        <input
          className={s.languageSearch}
          type="search"
          aria-label="Найти язык"
          placeholder="Найти язык…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className={s.languageGrid}>
          {filtered.map((language) => (
            <label className={s.languageChoice} key={language.name}>
              <input
                type="checkbox"
                checked={selected.includes(language.name)}
                onChange={() =>
                  setSelected((previous) =>
                    previous.includes(language.name)
                      ? previous.filter((name) => name !== language.name)
                      : [...previous, language.name],
                  )
                }
              />
              <span className={s.languageMark}>{language.mark}</span>
              <strong>{language.name}</strong>
            </label>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className={s.muted}>
            Такого языка пока нет в списке. Можно продолжить без выбора и
            вставить свой код.
          </p>
        )}
        <fieldset className={s.levels}>
          <legend>Как подробно объяснять?</legend>
          {levels.map((item) => (
            <label key={item.value}>
              <input
                type="radio"
                name="level"
                value={item.value}
                checked={level === item.value}
                onChange={() => setLevel(item.value)}
              />
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className={s.preferencesActions}>
          <button className={s.primary} onClick={save}>
            {editing ? "Сохранить настройки" : "Открыть рабочую область"}
            <Icon name="arrow" size={17} />
          </button>
          <button
            className={s.textButton}
            onClick={() => {
              if (!editing)
                updatePreferences(
                  account?.languages ?? [],
                  account?.level ?? "beginner",
                );
              onDone?.();
            }}
          >
            {editing ? "Отмена" : "Настрою позже"}
          </button>
        </div>
      </div>
    </section>
  );
}
