import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "../components/ui-icon";
import s from "./page.module.css";

export const metadata: Metadata = {
  title: "О себе | CodeProof",
  description: "О проекте CodeProof и нашей команде: Ерасыл, Абзал и Ерсұлтан. Готовимся к защите кода с помощью ИИ.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen text-[#203c31] [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-45 motion-reduce:[&_*]:transition-none">
      <a href="#about" className="fixed -top-20 left-4 z-100 bg-[#d9f2ab] p-3 focus:top-4">К содержимому</a>
      <header className="flex min-h-21 items-center gap-8 bg-[#16372d] px-7 text-[#eef6e6] max-md:min-h-18 max-md:gap-3 max-md:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-1 text-2xl font-bold tracking-tight [&>span]:mr-2 [&>span]:flex [&>span]:text-[#cef398] [&>b]:text-[#c4ea8c] max-md:text-xl" aria-label="CodeProof, главная">
          <span><Icon name="code" size={23} /></span>CodeProof<b>.</b>
        </Link>
        <span className="text-xs text-[#b0c5b1] max-lg:hidden">Понимание начинается с твоего кода</span>
        <Link href="/" className="ml-auto flex cursor-pointer items-center gap-2 rounded-lg border border-[#416343] bg-[#274c39] px-3 py-2.5 text-xs text-[#d4e5c2] max-md:max-w-36 max-md:text-[10px]">К приложению <span aria-hidden="true">↗</span></Link>
      </header>
      <main id="about" className="mx-auto max-w-314 px-7 pt-13 max-md:px-4 max-md:pt-7">
        <nav className={s.breadcrumb} aria-label="Хлебные крошки"><Link href="/">Главная</Link><span aria-hidden="true">/</span><span aria-current="page">О себе</span></nav>
        <section className={s.hero} aria-labelledby="about-heading">
          <div>
            <span className="mb-4 block text-[10px] font-semibold tracking-[1.8px] text-[#718768] max-md:text-[9px]">О СЕБЕ · КОМАНДА CODEPROOF</span>
            <h1 id="about-heading">Мы создаём CodeProof.<br /><span>Чтобы код было<br />легче объяснить.</span></h1>
            <p className={s.lead}>Мы Ерасыл, Абзал и Ерсұлтан. Вместе работаем над CodeProof, приложением для подготовки студентов к защите программного кода с помощью искусственного интеллекта.</p>
            <div className={s.actions}><a className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-3.5 rounded-lg border border-transparent bg-[#28573e] px-4.5 py-3 text-[13px] font-semibold text-[#f4f9ec] transition-colors enabled:hover:bg-[#3d704b] max-sm:gap-2 max-sm:px-3 max-sm:text-xs" href="#team">Наша команда <span aria-hidden="true">↗</span></a><a className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-3.5 rounded-lg border border-[#dbe6d0] bg-white px-4.5 py-3 text-[13px] font-semibold text-[#617e4d] transition-colors enabled:hover:bg-[#f2f7ea] max-sm:gap-2 max-sm:px-3 max-sm:text-xs" href="#project">О проекте <span aria-hidden="true">↓</span></a></div>
          </div>
          <aside className={s.identity} aria-label="Наша команда">
            <div className={s.cardTop}><span>ТРИ УЧАСТНИКА · ОДНА ИДЕЯ</span><Icon name="code" size={24} /></div>
            <div className={s.monogram} aria-hidden="true">3<span>.</span></div>
            <strong>Ерасыл · Абзал · Ерсұлтан</strong><span className={s.handle}>Команда CodeProof</span>
            <div className={s.cardBottom}><span>ПРОЕКТ</span><b>CodeProof</b></div>
          </aside>
        </section>
        <section id="project" className={s.project} aria-labelledby="project-heading">
          <div><span className="mb-4 block text-[10px] font-semibold tracking-[1.8px] text-[#718768] max-md:text-[9px]">ПРОЕКТ, НАД КОТОРЫМ МЫ РАБОТАЕМ</span><h2 id="project-heading">Написать код.<br />Понять. Объяснить.</h2><p>CodeProof помогает студентам готовиться к защите программного кода с помощью ИИ. Идея проста: тренироваться на своей работе и учиться объяснять, почему она работает.</p><a href="https://github.com/AbaD3v/AbaD3v-AIU" className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-3.5 rounded-lg border border-transparent bg-[#28573e] px-4.5 py-3 text-[13px] font-semibold text-[#f4f9ec] transition-colors enabled:hover:bg-[#3d704b] max-sm:gap-2 max-sm:px-3 max-sm:text-xs">Репозиторий проекта <span aria-hidden="true">↗</span></a></div>
          <div className={s.scenario}><span className="mb-4 block text-[10px] font-semibold tracking-[1.8px] text-[#718768] max-md:text-[9px]">СЦЕНАРИЙ ИЗ ТЕХНИЧЕСКОГО ЗАДАНИЯ</span><ol className="list-decimal"><li><b>Добавляешь свой код</b><p>Выбираешь язык и сложность тренировки.</p></li><li><b>Отвечаешь на пять вопросов</b><p>Объясняешь строки и прогнозируешь результат изменения кода.</p></li><li><b>Разбираешь ошибки</b><p>Получаешь обратную связь и видишь темы для повторения.</p></li></ol><small>Проект развивается. Полный сценарий описывает цель первой версии.</small></div>
        </section>
        <section id="team" className={s.section} aria-labelledby="team-heading">
          <div className={s.sectionHeading}><span className="mb-4 block text-[10px] font-semibold tracking-[1.8px] text-[#718768] max-md:text-[9px]">КОМАНДА</span><h2 id="team-heading">Знакомься, это мы.</h2></div>
          <div className={s.team}>
            <article><span className={s.avatar} aria-hidden="true">Е</span><span className={s.badge}>ФРОНТЕНД</span><h3>Ерасыл</h3><span className={s.fullName}>Куанышбек Ерасыл</span><p>Отвечает за дизайн и интерфейс: страницы на React и Next.js, формы, экраны тренировок и удобство на телефонах.</p><a href="https://github.com/Smylorx">@Smylorx <span aria-hidden="true">↗</span></a></article>
            <article><span className={s.avatar} aria-hidden="true">А</span><span className={s.badge}>БЭКЕНД</span><h3>Абзал</h3><span className={s.fullName}>Маметжан Абзал</span><p>Отвечает за серверную часть: API, базу данных, авторизацию, интеграцию с ИИ и сохранение результатов тренировок.</p><a href="https://github.com/AbaD3v">@AbaD3v <span aria-hidden="true">↗</span></a></article>
            <article><span className={s.avatar} aria-hidden="true">Е</span><span className={s.badge}>UI/UX-ДИЗАЙН</span><h3>Ерсұлтан</h3><span className={s.fullName}>Кәрғұл Ерсұлтан</span><p>Проектирует сценарии, прототипы и макеты экранов. Отвечает за визуальный стиль, адаптивный дизайн и удобство интерфейса.</p><a href="https://github.com/ersultankargul07-alt">@ersultankargul07-alt <span aria-hidden="true">↗</span></a></article>
          </div>
        </section>
        <section className={s.stack} aria-labelledby="stack-heading"><h2 id="stack-heading">Стек проекта по README</h2><ul>{["Next.js", "React", "JavaScript", "Tailwind CSS", "CSS Modules", "PostgreSQL", "Prisma", "API языковой модели"].map(technology => <li key={technology}>{technology}</li>)}</ul></section>
        <footer className="mt-10 flex items-center justify-between gap-5 border-t border-[#dfe7d7] py-7.5 text-sm font-semibold text-[#5d774b] [&>span>span]:text-[#91ad71] [&_small]:ml-4 [&_small]:text-[11px] [&_small]:font-normal [&_small]:text-[#718465] [&>span:last-child]:text-[11px] [&>span:last-child]:font-normal [&>span:last-child]:text-[#788a6c] max-md:items-start max-md:[&_small]:mt-2 max-md:[&_small]:ml-0 max-md:[&_small]:block max-md:[&_small]:leading-[1.7] max-md:[&>span:last-child]:max-w-25 max-md:[&>span:last-child]:text-right max-md:[&>span:last-child]:leading-[1.7]"><span>CodeProof<span>.</span><small>Учись объяснять свой код.</small></span><Link href="/">Вернуться к приложению ↗</Link></footer>
      </main>
    </div>
  );
}
