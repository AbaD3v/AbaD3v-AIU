"use client";
import { useSiteNames } from "@/app/lib/site-names/store";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
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
  ShieldCheck,
  Terminal,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { SiteDocumentTitle } from "./site-name";
import { brandName, type NameKey } from "@/app/lib/site-names/registry";
import { retryStudySync, useStudy, useStudySyncStatus } from "@/app/lib/sql/store";
import { getStats } from "@/app/lib/sql/progress";
import { tasks } from "@/app/lib/sql/course";
import { useAccounts } from "@/app/lib/accounts/store";
import { practiceAccountHref } from "@/app/lib/accounts/registration";
import { cloudEnabled } from "@/app/lib/supabase/client";

type NavItem = { href: string; nameKey: NameKey; icon: LucideIcon };

const links: NavItem[] = [
  { href: "/", nameKey: "nav.catalog", icon: Layers3 },
  { href: "/database/", nameKey: "nav.database", icon: Database },
  { href: "/profile/", nameKey: "nav.profile", icon: ChartNoAxesCombined },
];
const tools: NavItem[] = [
  { href: "/reference/", nameKey: "nav.reference", icon: BookOpen },
  { href: "/history/", nameKey: "nav.history", icon: History },
  { href: "/notes/", nameKey: "nav.notes", icon: NotebookPen },
];
const adminLink: NavItem = { href: "/admin/", nameKey: "nav.admin", icon: ShieldCheck };
const accountLink: NavItem = { href: "/account/", nameKey: "nav.account", icon: UserRound };

export default function SqlShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return children;
  return <LearningShell pathname={pathname}>{children}</LearningShell>;
}

function LearningShell({ children, pathname }: { children: ReactNode; pathname: string }) {
  const name = useSiteNames();
  const { active, ready } = useAccounts();
  const accountHref = cloudEnabled && !active ? practiceAccountHref(pathname) : accountLink.href;
  const state = useStudy();
  const syncStatus = useStudySyncStatus();
  const studyPage = pathname === "/" || /^\/(practice|profile|checklist|notes|history|quiz)(\/|$)/.test(pathname);
  const studyLoading = cloudEnabled && studyPage && (!ready || syncStatus === "loading");
  const studyUnavailable = studyPage && syncStatus === "load-error";
  const stats = getStats(state);
  const displayName = active || state.name !== "Студент" ? state.name : name("nav.guest");
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const openMenuButton = menuButton.current;
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
      openMenuButton?.focus();
    };
  }, [mobileOpen]);
  const current = [...links, ...tools, adminLink, accountLink].find((link) =>
    link.href === "/"
      ? pathname === "/" || pathname.startsWith("/practice")
      : pathname.startsWith(link.href.replace(/\/$/, "")),
  );
  function navItem(link: NavItem) {
    const active = current?.href === link.href;
    const separateTab = link === adminLink && cloudEnabled;
    return (
      <Link
        key={link.href}
        href={link === accountLink ? accountHref : link.href}
        target={separateTab ? "_blank" : undefined}
        rel={separateTab ? "noopener" : undefined}
        className={"nav-item " + (active ? "active" : "")}
        aria-current={active ? "page" : undefined}
        onClick={() => setMobileOpen(false)}
      >
        <link.icon size={18} strokeWidth={1.75} />
        <span>
          {name(link.nameKey)}
          {separateTab && <span className="sr-only"> {name("admin.newTab")}</span>}
        </span>
        {separateTab && <ArrowUpRight size={14} aria-hidden="true" />}
        {active && <span className="nav-active-dot" />}
      </Link>
    );
  }
  return (
    <div className="app-layout">
      <Suspense fallback={null}>
        <SiteDocumentTitle />
      </Suspense>
      <a className="skip-link" href="#main-content">
        {name("nav.skip")}
      </a>
      <aside
        ref={sidebar}
        id="navigation"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label={name("nav.region")}
        className={"sidebar " + (mobileOpen ? "mobile-open" : "")}
      >
        <div className="sidebar-brand">
          <Link href="/" className="brand" onClick={() => setMobileOpen(false)}>
            <span className="brand-symbol">
              <Terminal size={23} strokeWidth={2.3} />
            </span>
            <span>
              {brandName(name("site.name"))}<span className="brand-dot">.</span>
              <small>{name("site.subtitle")}</small>
            </span>
          </Link>
          <button
            className="icon-button mobile-only"
            onClick={() => setMobileOpen(false)}
            aria-label={name("nav.closeMenu")}
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label={name("nav.main")}>
          <span className="nav-label">{name("nav.learning")}</span>
          {links.map(navItem)}
          <span className="nav-label secondary">{name("nav.tools")}</span>
          {tools.map(navItem)}
          {active?.role === "admin" && navItem(adminLink)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-progress">
            <span className="sidebar-progress-icon">
              <ChartNoAxesCombined size={18} />
            </span>
            <div className="sidebar-progress-heading">
              <strong>{name("nav.progressTitle")}</strong>
              <span>
                {stats.completed} из {tasks.length} задач решено
              </span>
            </div>
            <div className="progress-track">
              <span style={{ width: stats.percent + "%" }} />
            </div>
            <Link href="/profile/" onClick={() => setMobileOpen(false)}>
              {name("nav.viewProgress")} <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link
            className="about-link"
            href="/about/"
            onClick={() => setMobileOpen(false)}
          >
            {name("nav.about")} <ArrowUpRight size={14} />
          </Link>
          <Link
            className="profile-link"
            href={accountHref}
            onClick={() => setMobileOpen(false)}
          >
            <span className="avatar">
              {active ? (
                displayName.slice(0, 1).toUpperCase()
              ) : (
                <UserRound size={16} />
              )}
            </span>
            <span>
              <strong>{displayName}</strong>
              <small>
                {active?.role === "admin"
                  ? name("common.roleAdmin")
                  : active
                    ? name("common.roleStudent")
                    : name("account.entry")}
              </small>
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
              aria-label={name("nav.openMenu")}
              aria-expanded={mobileOpen}
              aria-controls="navigation"
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-root">{name("nav.breadcrumb")}</span>
            <ChevronRight size={14} />
            <strong>{name(current?.nameKey ?? "nav.about")}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-save">
              <Check size={14} />
              {state.storageIssue
                ? name("nav.storageUnavailable")
                : syncStatus === "synced" ? name("nav.cloudProgress")
                : syncStatus === "saving" ? "Синхронизация…"
                  : syncStatus === "loading" ? "Загрузка…"
                    : name("nav.localProgress")}
            </span>
            <Link href={accountHref} className="topbar-account">
              <UserRound size={15} />
              {active ? name("nav.account") : name("account.signIn")}
            </Link>
          </div>
        </header>
        {state.storageIssue && (
          <div className="storage-warning" role="status">
            {state.storageIssue}{" "}
            {syncStatus !== "load-error" && <Link href="/profile/">{name("nav.progressWarning")}</Link>}
            {(syncStatus === "load-error" || syncStatus === "save-error") && (
              <button type="button" className="button button-secondary" onClick={retryStudySync}>Повторить</button>
            )}
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          {studyLoading ? <p className="page" role="status">Загружаем прогресс…</p>
            : studyUnavailable ? <p className="page" role="status">Не удалось открыть сохранения аккаунта.</p>
              : <Fragment key={pathname.startsWith("/account") ? "account-page" : active?.id ?? "guest"}>{children}</Fragment>}
        </main>
      </div>
    </div>
  );
}
