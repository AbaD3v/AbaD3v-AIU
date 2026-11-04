import type { Metadata } from "next";
import AppShell from "./components/app-shell";
import { SessionProvider } from "./components/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeProof — подготовка к защите кода",
  description: "Добавь свою программу и подготовься объяснять её на защите.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
