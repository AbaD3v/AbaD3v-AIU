"use client";

import Link from "next/link";
import { useState } from "react";
import { levels } from "../lib/languages";
import { parseWorkspace, workspaceKey } from "../lib/workspace";
import AuthScreen from "./auth-screen";
import LearnerOnboarding from "./learner-onboarding";
import { useSession, type Account } from "./session-provider";
import { Icon } from "./ui-icon";
import s from "./learning.module.css";

function ProfileContent({ account }: { account: Account }) {
  const { logout } = useSession();
  const [editing, setEditing] = useState(false);
  const [progress] = useState(() => {
    try {
      return parseWorkspace(localStorage.getItem(workspaceKey(account.id)));
    } catch {
      return null;
    }
  });
  const initials = account.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  if (editing)
    return <LearnerOnboarding editing onDone={() => setEditing(false)} />;
  return (
    <main className={s.profilePage}>
      <header className={s.profileHeader}>
        <div>
          <span className={s.eyebrow}>ТВОЙ CODEPROOF</span>
          <h1>Профиль</h1>
        </div>
        <Link href="/" className={s.textButton}>
          К работе с кодом
          <Icon name="arrow" size={15} />
        </Link>
      </header>
      <section className={s.profileIdentity}>
        <span className={s.largeAvatar} aria-hidden="true">
          {initials}
        </span>
        <div>
          <span className={s.badge}>Учебный профиль</span>
          <h2>{account.name}</h2>
          <p>{account.email}</p>
        </div>
      </section>
      <div className={s.profileCards}>
        <section className={s.profileCard}>
          <h2>Настройки обучения</h2>
          <p className={s.muted}>Знакомые языки</p>
          <div className={s.tags}>
            {account.languages.length ? (
              account.languages.map((language) => (
                <span className={s.badge} key={language}>
                  {language}
                </span>
              ))
            ) : (
              <span className={s.muted}>Пока не выбраны</span>
            )}
          </div>
          <p className={s.muted}>
            {levels.find((level) => level.value === account.level)?.detail}
          </p>
          <button className={s.textButton} onClick={() => setEditing(true)}>
            Изменить настройки
            <Icon name="arrow" size={14} />
          </button>
        </section>
        <section className={s.profileCard}>
          <h2>Твоя практика</h2>
          <div className={s.profileStats}>
            <div>
              <strong>{progress?.lessons.length ?? 0}</strong>
              <span>сохранённых занятий</span>
            </div>
            <div>
              <strong>
                {progress?.lessons.reduce(
                  (sum, lesson) => sum + lesson.answered,
                  0,
                ) ?? 0}
              </strong>
              <span>отправленных ответов</span>
            </div>
          </div>
          <p className={s.muted}>
            Счётчики отражают занятия, сохранённые в этом браузере.
          </p>
        </section>
      </div>
      <div className={s.profileBottom}>
        <p>
          Это локальный учебный профиль. После выхода код и диалоги останутся в
          браузере и будут доступны при следующем входе по этой почте.
        </p>
        <button className={s.secondary} onClick={logout}>
          Выйти из профиля
          <Icon name="arrow" size={15} />
        </button>
      </div>
    </main>
  );
}

export default function LearnerProfile() {
  const { account } = useSession();
  return account ? (
    <ProfileContent key={account.id} account={account} />
  ) : (
    <AuthScreen />
  );
}
