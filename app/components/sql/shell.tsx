"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Database,
  History,
  Layers3,
  Menu,
  NotebookPen,
  Terminal,
  X,
} from "lucide-react";
import { useStudy } from "@/app/lib/sql/store";
import { getStats } from "@/app/lib/sql/progress";
import { tasks } from "@/app/lib/sql/course";

const links = [
  { href: "/", label: "Практикум", icon: Layers3 },
  { href: "/database/", label: "База магазина", icon: Database },
  { href: "/profile/", label: "Мой прогресс", icon: ChartNoAxesCombined },
];
const tools = [
  { href: "/reference/", label: "Справочник SQL", icon: BookOpen },
  { href: "/history/", label: "История запросов", icon: History },
  { href: "/notes/", label: "Мои заметки", icon: NotebookPen },
];

export default function SqlShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const state = useStudy();
  const stats = getStats(state);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ) ?? [],
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth > 850) setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      menuButton.current?.focus();
    };
  }, [mobileOpen]);
  const current = [...links, ...tools].find((link) =>
    link.href === "/"
      ? pathname === "/" || pathname.startsWith("/practice")
      : pathname.startsWith(link.href.replace(/\/$/, "")),
  );
  function navItem(link: (typeof links)[number]) {
    const active = current?.href === link.href;
    return (
      <Link
        key={link.href}
        href={link.href}
        className={"nav-item " + (active ? "active" : "")}
        aria-current={active ? "page" : undefined}
        onClick={() => setMobileOpen(false)}
      >
        <link.icon size={18} strokeWidth={1.75} />
        <span>{link.label}</span>
        {active && <span className="nav-active-dot" />}
      </Link>
    );
  }
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        К содержимому
      </a>
      <aside
        ref={sidebar}
        id="navigation"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label="Навигация"
        className={"sidebar " + (mobileOpen ? "mobile-open" : "")}
      >
        <div className="sidebar-brand">
          <Link href="/" className="brand" onClick={() => setMobileOpen(false)}>
            <span className="brand-symbol">
              <Terminal size={23} strokeWidth={2.3} />
            </span>
            <span>
              CodeProof<span className="brand-dot">.</span>
              <small>SQL ПРАКТИКУМ</small>
            </span>
          </Link>
          <button
            className="icon-button mobile-only"
            onClick={() => setMobileOpen(false)}
            aria-label="Закрыть меню"
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Основная навигация">
          <span className="nav-label">ОБУЧЕНИЕ</span>
          {links.map(navItem)}
          <span className="nav-label secondary">ИНСТРУМЕНТЫ</span>
          {tools.map(navItem)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-progress">
            <span className="sidebar-progress-icon">
              <ChartNoAxesCombined size={18} />
            </span>
            <div className="sidebar-progress-heading">
              <strong>Шаг за шагом</strong>
              <span>
                {stats.completed} из {tasks.length} задач решено
              </span>
            </div>
            <div className="progress-track">
              <span style={{ width: stats.percent + "%" }} />
            </div>
            <Link href="/profile/" onClick={() => setMobileOpen(false)}>
              Посмотреть прогресс <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link
            className="about-link"
            href="/about/"
            onClick={() => setMobileOpen(false)}
          >
            О проекте <ArrowUpRight size={14} />
          </Link>
          <Link
            className="profile-link"
            href="/profile/"
            onClick={() => setMobileOpen(false)}
          >
            <span className="avatar">
              {state.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{state.name}</strong>
              <small>Учебный профиль</small>
            </span>
            <ChevronRight size={16} />
          </Link>
        </div>
      </aside>
      <div className="main-area" inert={mobileOpen || undefined}>
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              ref={menuButton}
              className="icon-button mobile-only"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Открыть меню"
              aria-expanded={mobileOpen}
              aria-controls="navigation"
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-root">Рабочее пространство</span>
            <ChevronRight size={14} />
            <strong>{current?.label ?? "О проекте"}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-save">
              <Check size={14} />
              {state.storageIssue
                ? "Сохранение недоступно"
                : "Прогресс в этом браузере"}
            </span>
            <span className="sql-pill">SQL</span>
          </div>
        </header>
        {state.storageIssue && (
          <div className="storage-warning" role="status">
            {state.storageIssue}{" "}
            <Link href="/profile/">Открыть прогресс →</Link>
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
