import Link from "next/link";
import { Icon } from "../components/ui-icon";
import s from "./profile.module.css";

export const metadata = {
  title: "Профиль — CodeProof",
};

const demoProfile = {
  name: "Алексей Морозов",
  email: "alexey.morozov@example.com",
  memberSince: "Сентябрь 2025",
  plan: "Базовый доступ",
  languages: ["Python", "JavaScript"],
  goal: "Подготовиться к защите учебных проектов",
};

const demoProgress = [
  { value: "8", label: "разборов кода" },
  { value: "21", label: "вопросов пройдено" },
  { value: "4 дня", label: "занимался подряд" },
];

export default function ProfilePage() {
  return (
    <main className={s.page}>
      <div className={s.topline}>
        <div>
          <span className={s.eyebrow}>АККАУНТ CODEPROOF</span>
          <h1>Профиль</h1>
          <p className={s.subtitle}>
            Информация об аккаунте и твоём обучении.
          </p>
        </div>
        <Link href="/" className={s.backLink}>
          <Icon name="arrow" size={17} />
          К работе с кодом
        </Link>
      </div>

      <section className={s.hero} aria-label="Демо-профиль">
        <div className={s.largeAvatar} aria-hidden="true">
          АМ
        </div>
        <div className={s.heroInfo}>
          <span className={s.demoBadge}>ДЕМО-ПРОФИЛЬ</span>
          <h2>{demoProfile.name}</h2>
          <p>{demoProfile.email}</p>
        </div>
        <div className={s.planBadge}>
          <Icon name="spark" size={16} />
          {demoProfile.plan}
        </div>
      </section>

      <div className={s.contentGrid}>
        <section className={s.card} aria-labelledby="personal-heading">
          <div className={s.cardHeading}>
            <span className={s.cardIcon}>
              <Icon name="user" size={19} />
            </span>
            <div>
              <h2 id="personal-heading">Личные данные</h2>
              <p>Основная информация аккаунта</p>
            </div>
          </div>
          <dl className={s.details}>
            <div>
              <dt>Имя</dt>
              <dd>{demoProfile.name}</dd>
            </div>
            <div>
              <dt>Электронная почта</dt>
              <dd>{demoProfile.email}</dd>
            </div>
            <div>
              <dt>В CodeProof с</dt>
              <dd>{demoProfile.memberSince}</dd>
            </div>
          </dl>
        </section>

        <section className={s.card} aria-labelledby="learning-heading">
          <div className={s.cardHeading}>
            <span className={s.cardIcon}>
              <Icon name="book" size={19} />
            </span>
            <div>
              <h2 id="learning-heading">Обучение</h2>
              <p>Предпочтения для занятий</p>
            </div>
          </div>
          <div className={s.learningItem}>
            <span>Языки программирования</span>
            <div className={s.tags}>
              {demoProfile.languages.map((language) => (
                <span className={s.tag} key={language}>
                  {language}
                </span>
              ))}
            </div>
          </div>
          <div className={s.learningItem}>
            <span>Цель</span>
            <strong>{demoProfile.goal}</strong>
          </div>
        </section>
      </div>

      <section className={s.progressCard} aria-labelledby="progress-heading">
        <div className={s.progressHeading}>
          <div>
            <span className={s.eyebrow}>ТВОИ РЕЗУЛЬТАТЫ</span>
            <h2 id="progress-heading">Прогресс обучения</h2>
          </div>
          <span className={s.progressDemo}>Данные для примера</span>
        </div>
        <div className={s.stats}>
          {demoProgress.map((stat) => (
            <div className={s.stat} key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <p className={s.disclaimer}>
        Сейчас здесь отображаются тестовые данные. Настоящий профиль появится
        после подключения аккаунта.
      </p>
    </main>
  );
}
