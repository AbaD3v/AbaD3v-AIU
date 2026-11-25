"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ClipboardList,
  LayoutDashboard,
  ShieldCheck,
  Type,
  UserRound,
  UsersRound,
} from "lucide-react";
import { refreshAccounts, useAccounts } from "@/app/lib/accounts/store";
import { useSiteNames } from "@/app/lib/site-names/store";
import QuizEditor from "@/app/components/sql/quiz-editor";
import SiteNamesEditor from "@/app/components/sql/site-names-editor";
import StudentPanel from "./student-panel";
import PracticeContentEditor from "./practice-content-editor";
import styles from "./admin-workspace.module.css";

const sections = [
  { id: "overview", title: "admin.overview", description: "admin.overviewIntro", Icon: LayoutDashboard },
  { id: "students", title: "admin.students", description: "admin.studentsIntro", Icon: UsersRound },
  { id: "practice", title: "admin.practiceContent", description: "admin.practiceContentIntro", Icon: BookOpen },
  { id: "quizzes", title: "admin.quizzes", description: "admin.quizzesIntro", Icon: ClipboardList },
  { id: "texts", title: "admin.siteTexts", description: "admin.siteTextsIntro", Icon: Type },
] as const;

function subscribeToSection(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

function currentSection() {
  return sections.find(({ id }) => window.location.hash === "#" + id) ?? sections[0];
}

export default function AdminWorkspace() {
  const name = useSiteNames();
  const accounts = useAccounts();

  if (!accounts.ready) {
    return <main className={styles.gate}><p role="status">Проверяем доступ…</p></main>;
  }
  if (accounts.active?.role !== "admin") {
    return (
      <main className={styles.gate}>
        <ShieldCheck size={28} aria-hidden="true" />
        <h1>{name("admin.heading")}</h1>
        <p>{accounts.error || accounts.accessDenied || "Этот раздел доступен после входа с ролью администратора."}</p>
        {accounts.error && (
          <button type="button" className="button button-secondary"
            onClick={() => { void Promise.resolve(refreshAccounts()).catch(() => {}); }}>
            {name("admin.retryStudents")}
          </button>
        )}
        <Link href="/account/" className="button button-primary">
          {name("admin.toAccount")}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </main>
    );
  }

  return (
    <Workspace
      key={accounts.active.id}
      admin={accounts.active}
      students={accounts.students}
      studentListStatus={accounts.studentListStatus}
    />
  );
}

function Workspace({
  admin,
  students,
  studentListStatus,
}: Pick<ReturnType<typeof useAccounts>, "students" | "studentListStatus"> & {
  admin: NonNullable<ReturnType<typeof useAccounts>["active"]>;
}) {
  const name = useSiteNames();
  const section = useSyncExternalStore(subscribeToSection, currentSection, () => sections[0]);
  const main = useRef<HTMLElement>(null);
  const previousSection = useRef(section.id);
  useEffect(() => {
    if (section.id === previousSection.current) return;
    previousSection.current = section.id;
    window.scrollTo({ top: 0, behavior: "instant" });
    main.current?.focus({ preventScroll: true });
  }, [section.id]);

  const blocked = students.filter((student) => student.blocked).length;
  const hasCounts = studentListStatus === "ready" || students.length > 0;
  const listSection = section.id === "overview" || section.id === "students";
  const counts = [
    { label: "admin.totalStudents", value: students.length },
    { label: "admin.accessOpen", value: students.length - blocked },
    { label: "admin.accessSuspended", value: blocked },
  ] as const;

  return (
    <div className={styles.workspace}>
      <a
        className="skip-link"
        href="#admin-content"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        {name("nav.skip")}
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.emblem}><ShieldCheck size={21} aria-hidden="true" /></span>
          <div>
            <span>{name("site.name")}</span>
            <strong>{name("admin.heading")}</strong>
          </div>
        </div>
        <nav className={styles.nav} aria-label={name("admin.menu")}>
          {sections.map(({ id, title, Icon }) => (
            <a key={id} href={`#${id}`} aria-current={id === section.id ? "location" : undefined}>
              <Icon size={18} aria-hidden="true" />
              <span>{name(title)}</span>
            </a>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <Link className={styles.account} href="/account/" title={name("admin.myAccount")}>
            <UserRound size={18} aria-hidden="true" />
            <span><strong>{admin.name}</strong><small>{name("common.roleAdmin")}</small></span>
          </Link>
          <Link href="/" className={styles.back}>
            <ArrowLeft size={16} aria-hidden="true" />
            {name("admin.backToPractice")}
          </Link>
        </div>
      </aside>
      <main id="admin-content" className={styles.main} ref={main} tabIndex={-1}>
        <header className={styles.heading}>
          <h1>{name(section.title)}</h1>
          <p>{name(section.description)}</p>
        </header>

        {listSection && studentListStatus === "loading" && !students.length && (
          <p className={styles.listNotice} role="status">{name("admin.loadingStudents")}</p>
        )}
        {listSection && studentListStatus === "error" && (
          <div className={styles.listNotice} role="status">
            {name("admin.studentsLoadError")}
            <button
              type="button"
              className="button button-secondary"
              onClick={() => { void Promise.resolve(refreshAccounts()).catch(() => {}); }}
            >
              {name("admin.retryStudents")}
            </button>
          </div>
        )}

        {section.id === "overview" && (
          <>
            <dl className={styles.metrics}>
              {counts.map(({ label, value }) => (
                <div key={label}>
                  <dt>{name(label)}</dt>
                  <dd>{hasCounts ? value : "—"}</dd>
                </div>
              ))}
            </dl>
            <div className={styles.shortcuts}>
              {sections.slice(1).map(({ id, title, description, Icon }) => (
                <a key={id} href={`#${id}`} className={styles.shortcut}>
                  <div className={styles.shortcutHeader}>
                    <Icon size={20} aria-hidden="true" />
                    <ArrowRight size={17} aria-hidden="true" />
                  </div>
                  <h2>{name(title)}</h2>
                  <p>{name(description)}</p>
                </a>
              ))}
            </div>
          </>
        )}

        {section.id === "students" && (
          <StudentPanel adminId={admin.id} students={students} showEmpty={studentListStatus === "ready"} />
        )}
        <div hidden={section.id !== "practice"}>
          <PracticeContentEditor />
        </div>
        <div hidden={section.id !== "quizzes"}>
          <QuizEditor adminId={admin.id} />
        </div>
        <div hidden={section.id !== "texts"}>
          <SiteNamesEditor />
        </div>
      </main>
    </div>
  );
}
