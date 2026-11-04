"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./ui-icon";
import s from "./app-sidebar.module.css";
import { useSession } from "./session-provider";

export default function AppSidebar() {
  const pathname = usePathname();
  const { account } = useSession();
  const initials = account?.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const onHome = pathname === "/";
  const onAbout = pathname === "/about";
  const onProfile = pathname === "/profile";

  return (
    <aside className={s.sidebar}>
      <Link
        href="/"
        className={s.brand}
        aria-label="CodeProof — главная"
        data-tooltip="CodeProof"
      >
        <Icon name="code" size={22} />
      </Link>

      <div className={s.divider} />

      <nav className={s.navigation} aria-label="Основная навигация">
        <Link
          href="/"
          className={`${s.navLink} ${onHome ? s.active : ""}`}
          aria-label="Главная"
          aria-current={onHome ? "page" : undefined}
          data-tooltip="Главная"
        >
          <Icon name="home" size={20} />
        </Link>
        <Link
          href="/about"
          className={`${s.navLink} ${onAbout ? s.active : ""}`}
          aria-label="О проекте"
          aria-current={onAbout ? "page" : undefined}
          data-tooltip="О проекте"
        >
          <Icon name="book" size={20} />
        </Link>
      </nav>

      <div className={s.bottom}>
        <Link
          href="/profile"
          className={`${s.profileLink} ${onProfile ? s.profileActive : ""}`}
          aria-label={`Открыть профиль ${account?.name ?? ""}`}
          aria-current={onProfile ? "page" : undefined}
          data-tooltip="Профиль"
        >
          <span className={s.avatar} aria-hidden="true">
            {initials}
          </span>
        </Link>
      </div>
    </aside>
  );
}
