"use client";

import type { ReactNode } from "react";
import AppSidebar from "./app-sidebar";
import { useSession } from "./session-provider";
import styles from "./app-shell.module.css";

export default function AppShell({ children }: { children: ReactNode }) {
  const { account, notice } = useSession();
  return (
    <div className={styles.layout}>
      {account && <AppSidebar />}
      <div className={account ? styles.content : undefined}>
        {notice && (
          <div className="storage-notice" role="alert">
            {notice}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
