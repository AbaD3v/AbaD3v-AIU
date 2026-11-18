import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  Code2,
  Database,
  ShieldCheck,
} from "lucide-react";
import { SiteBrand, SiteName } from "@/app/components/sql/site-name";
import { staticNames } from "@/app/lib/site-names/registry";

export const metadata = { title: staticNames["nav.about"] };
export default function AboutPage() {
  return (
    <div className="page about-page">
      <span className="eyebrow">
        <SiteBrand uppercase /> · <SiteName nameKey="site.subtitle" />
      </span>
      <h1><SiteName nameKey="about.heading" /></h1>
      <p className="about-lead">
        <SiteBrand /> помогает освоить SQL на связанных задачах одного
        интернет-магазина. Изучай таблицы, пиши запросы и проверяй, работает ли
        решение на разных данных.
      </p>
      <Link className="button button-primary" href="/">
        <SiteName nameKey="about.start" />
        <ArrowRight size={17} />
      </Link>
      <div className="about-features">
        <article>
          <Database size={25} />
          <h2><SiteName nameKey="about.database" /></h2>
          <p>
            Пять связанных таблиц SQLite. Запросы действительно выполняются и
            возвращают строки данных.
          </p>
        </article>
        <article>
          <CheckCheck size={25} />
          <h2><SiteName nameKey="about.check" /></h2>
          <p>
            Каждое решение проверяется на трёх наборах данных. Разные правильные
            способы решения принимаются.
          </p>
        </article>
        <article>
          <ShieldCheck size={25} />
          <h2><SiteName nameKey="about.pace" /></h2>
          <p>
            Все задания открыты. Подсказки, теория и разборы рядом с редактором.
            Прогресс сохраняется в браузере.
          </p>
        </article>
      </div>
      <section className="about-section">
        <div>
          <span className="eyebrow"><SiteName nameKey="about.overview" /></span>
          <h2><SiteName nameKey="about.overviewHeading" /></h2>
        </div>
        <div>
          <p>
            Начинаем с SELECT и WHERE, затем переходим к сортировке,
            соединениям, группировкам и задачам аналитика. В конце — отчёт по
            продажам и аудит платежей.
          </p>
          <p>
            Наборы данных и проверки входят в приложение. ИИ, внешние API и
            сервер для учебных запросов не нужны. Сохранения локальные: для
            переноса между устройствами доступны экспорт и импорт.
          </p>
          <p>
            Это учебная среда, а не экзаменационная система: задания и эталоны
            находятся в клиентском приложении, а прогресс можно редактировать на
            своём устройстве.
          </p>
          <p>
            Студент сохраняет работу в своём аккаунте. Демо администратор видит
            результаты студентов этого браузера и управляет их входом.
          </p>
        </div>
      </section>
      <section className="team-section">
        <span className="eyebrow"><SiteName nameKey="about.team" /> <SiteBrand uppercase /></span>
        <h2><SiteName nameKey="about.teamHeading" /></h2>
        <div>
          {([
            {
              name: "Куанышбек Ерасыл",
              role: "about.frontend",
              handle: "Smylorx",
              initial: "Е",
            },
            {
              name: "Маметжан Абзал",
              role: "about.development",
              handle: "AbaD3v",
              initial: "А",
            },
            {
              name: "Кәрғұл Ерсұлтан",
              role: "about.design",
              handle: "ersultankargul07-alt",
              initial: "Е",
            },
          ] as const).map((member) => (
            <article key={member.handle}>
              <span className="team-avatar">{member.initial}</span>
              <small><SiteName nameKey={member.role} /></small>
              <h3>{member.name}</h3>
              <a
                href={"https://github.com/" + member.handle}
                target="_blank"
                rel="noreferrer"
              >
                <SiteName nameKey="about.github" />
                <ArrowUpRight size={14} />
              </a>
            </article>
          ))}
        </div>
      </section>
      <footer className="page-footer">
        <span>
          <Code2 size={16} />
          Next.js · React · TypeScript · SQLite
        </span>
        <a
          href="https://github.com/AbaD3v/AbaD3v-AIU"
          target="_blank"
          rel="noreferrer"
        >
          <SiteName nameKey="about.source" />
          <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
