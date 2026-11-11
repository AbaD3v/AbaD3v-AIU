import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  Code2,
  Database,
  ShieldCheck,
} from "lucide-react";
export const metadata = { title: "О проекте" };
export default function AboutPage() {
  return (
    <div className="page about-page">
      <span className="eyebrow">CODEPROOF · SQL ПРАКТИКУМ</span>
      <h1>
        Знание начинается
        <br />с работающего запроса<span>.</span>
      </h1>
      <p className="about-lead">
        CodeProof помогает освоить SQL на связанных задачах одного
        интернет-магазина. Изучай таблицы, пиши запросы и проверяй, работает ли
        решение на разных данных.
      </p>
      <Link className="button button-primary" href="/">
        Перейти к практике
        <ArrowRight size={17} />
      </Link>
      <div className="about-features">
        <article>
          <Database size={25} />
          <h2>Настоящая база</h2>
          <p>
            Пять связанных таблиц SQLite. Запросы действительно выполняются и
            возвращают строки данных.
          </p>
        </article>
        <article>
          <CheckCheck size={25} />
          <h2>Проверка по результату</h2>
          <p>
            Каждое решение проверяется на трёх наборах данных. Разные правильные
            способы решения принимаются.
          </p>
        </article>
        <article>
          <ShieldCheck size={25} />
          <h2>В своём темпе</h2>
          <p>
            Все задания открыты. Подсказки, теория и разборы рядом с редактором.
            Прогресс сохраняется в браузере.
          </p>
        </article>
      </div>
      <section className="about-section">
        <div>
          <span className="eyebrow">КАК УСТРОЕН ПРАКТИКУМ</span>
          <h2>
            Пять модулей.
            <br />
            Одна цель — самостоятельность.
          </h2>
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
        </div>
      </section>
      <section className="team-section">
        <span className="eyebrow">КОМАНДА CODEPROOF</span>
        <h2>Три участника. Общая работа.</h2>
        <div>
          {[
            {
              name: "Куанышбек Ерасыл",
              role: "Фронтенд",
              handle: "Smylorx",
              initial: "Е",
            },
            {
              name: "Маметжан Абзал",
              role: "Разработка",
              handle: "AbaD3v",
              initial: "А",
            },
            {
              name: "Кәрғұл Ерсұлтан",
              role: "UI/UX-дизайн",
              handle: "ersultankargul07-alt",
              initial: "Е",
            },
          ].map((member) => (
            <article key={member.handle}>
              <span className="team-avatar">{member.initial}</span>
              <small>{member.role}</small>
              <h3>{member.name}</h3>
              <a
                href={"https://github.com/" + member.handle}
                target="_blank"
                rel="noreferrer"
              >
                GitHub
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
          Исходный код
          <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
