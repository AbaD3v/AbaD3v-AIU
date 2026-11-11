import type { Metadata } from "next";
import SqlShell from "./components/sql/shell";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CodeProof SQL — практикум по анализу данных",
    template: "%s · CodeProof SQL",
  },
  description:
    "15 задач на данных интернет-магазина. Пишите и запускайте SQL, изучайте таблицы, проверяйте решения и сохраняйте прогресс.",
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <SqlShell>{children}</SqlShell>
      </body>
    </html>
  );
}
