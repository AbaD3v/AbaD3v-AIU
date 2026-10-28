import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
