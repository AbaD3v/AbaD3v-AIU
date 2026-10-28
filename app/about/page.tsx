import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "../components/ui-icon";
import shared from "../components/code-workspace.module.css";
import s from "./page.module.css";

export const metadata: Metadata = {
  title: "О себе | CodeProof",
  description: "О проекте CodeProof и нашей команде: Ерасыл, Абзал и Ерсұлтан. Готовимся к защите кода с помощью ИИ.",
};

export default function AboutPage() {
  return (
    <div className={shared.root}>
      <a href="#about" className={shared.skip}>К содержимому</a>
      <header className={shared.header}>
        <Link href="/" className={shared.brand} aria-label="CodeProof, главная">
          <span><Icon name="code" size={23} /></span>CodeProof<b>.</b>
        </Link>
        <span className={shared.headerCaption}>Понимание начинается с твоего кода</span>
        <Link href="/" className={shared.headerButton}>К приложению <span aria-hidden="true">↗</span></Link>
      </header>
      <main id="about" className={shared.main}>
        <nav className={s.breadcrumb} aria-label="Хлебные крошки"><Link href="/">Главная</Link><span aria-hidden="true">/</span><span aria-current="page">О себе</span></nav>
        <section className={s.hero} aria-labelledby="about-heading">
          <div>
            <span className={shared.eyebrow}>О СЕБЕ · КОМАНДА CODEPROOF</span>
            <h1 id="about-heading">Мы создаём CodeProof.<br /><span>Чтобы код было<br />легче объяснить.</span></h1>
            <p className={s.lead}>Мы Ерасыл, Абзал и Ерсұлтан. Вместе работаем над CodeProof, приложением для подготовки студентов к защите программного кода с помощью искусственного интеллекта.</p>
            <div className={s.actions}><a className={shared.primary} href="#team">Наша команда <span aria-hidden="true">↗</span></a><a className={shared.secondary} href="#project">О проекте <span aria-hidden="true">↓</span></a></div>
          </div>
          <aside className={s.identity} aria-label="Наша команда">
            <div className={s.cardTop}><span>ТРИ УЧАСТНИКА · ОДНА ИДЕЯ</span><Icon name="code" size={24} /></div>
            <div className={s.monogram} aria-hidden="true">3<span>.</span></div>
            <strong>Ерасыл · Абзал · Ерсұлтан</strong><span className={s.handle}>Команда CodeProof</span>
            <div className={s.cardBottom}><span>ПРОЕКТ</span><b>CodeProof</b></div>
          </aside>
        </section>
        <section id="project" className={s.project} aria-labelledby="project-heading">
          <div><span className={shared.eyebrow}>ПРОЕКТ, НАД КОТОРЫМ МЫ РАБОТАЕМ</span><h2 id="project-heading">Написать код.<br />Понять. Объяснить.</h2><p>CodeProof помогает студентам готовиться к защите программного кода с помощью ИИ. Идея проста: тренироваться на своей работе и учиться объяснять, почему она работает.</p><a href="https://github.com/AbaD3v/AbaD3v-AIU" className={shared.primary}>Репозиторий проекта <span aria-hidden="true">↗</span></a></div>
          <div className={s.scenario}><span className={shared.eyebrow}>СЦЕНАРИЙ ИЗ ТЕХНИЧЕСКОГО ЗАДАНИЯ</span><ol><li><b>Добавляешь свой код</b><p>Выбираешь язык и сложность тренировки.</p></li><li><b>Отвечаешь на пять вопросов</b><p>Объясняешь строки и прогнозируешь результат изменения кода.</p></li><li><b>Разбираешь ошибки</b><p>Получаешь обратную связь и видишь темы для повторения.</p></li></ol><small>Проект развивается. Полный сценарий описывает цель первой версии.</small></div>
        </section>
        <section id="team" className={s.section} aria-labelledby="team-heading">
          <div className={s.sectionHeading}><span className={shared.eyebrow}>КОМАНДА</span><h2 id="team-heading">Знакомься, это мы.</h2></div>
          <div className={s.team}>
            <article><span className={s.avatar} aria-hidden="true">Е</span><span className={s.badge}>ФРОНТЕНД</span><h3>Ерасыл</h3><span className={s.fullName}>Куанышбек Ерасыл</span><p>Отвечает за дизайн и интерфейс: страницы на React и Next.js, формы, экраны тренировок и удобство на телефонах.</p><a href="https://github.com/Smylorx">@Smylorx <span aria-hidden="true">↗</span></a></article>
            <article><span className={s.avatar} aria-hidden="true">А</span><span className={s.badge}>БЭКЕНД</span><h3>Абзал</h3><span className={s.fullName}>Маметжан Абзал</span><p>Отвечает за серверную часть: API, базу данных, авторизацию, интеграцию с ИИ и сохранение результатов тренировок.</p><a href="https://github.com/AbaD3v">@AbaD3v <span aria-hidden="true">↗</span></a></article>
            <article><span className={s.avatar} aria-hidden="true">Е</span><span className={s.badge}>UI/UX-ДИЗАЙН</span><h3>Ерсұлтан</h3><span className={s.fullName}>Кәрғұл Ерсұлтан</span><p>Проектирует сценарии, прототипы и макеты экранов. Отвечает за визуальный стиль, адаптивный дизайн и удобство интерфейса.</p><a href="https://github.com/ersultankargul07-alt">@ersultankargul07-alt <span aria-hidden="true">↗</span></a></article>
          </div>
        </section>
        <section className={s.stack} aria-labelledby="stack-heading"><h2 id="stack-heading">Стек проекта по README</h2><ul>{["Next.js", "React", "JavaScript", "CSS Modules", "PostgreSQL", "Prisma", "API языковой модели"].map(technology => <li key={technology}>{technology}</li>)}</ul></section>
        <footer className={shared.footer}><span>CodeProof<span>.</span><small>Учись объяснять свой код.</small></span><Link href="/">Вернуться к приложению ↗</Link></footer>
      </main>
    </div>
  );
}
