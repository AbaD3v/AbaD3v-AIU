import type { Metadata } from "next";
import AppSidebar from "./components/app-sidebar";
import shell from "./components/app-shell.module.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeProof — подготовка к защите кода",
  description:
    "Добавь свою программу и подготовься объяснять её на защите.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <div className={shell.layout}>
          <AppSidebar />
          <div className={shell.content}>{children}</div>
        </div>
      </body>
    </html>
  );
}
