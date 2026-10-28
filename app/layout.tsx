import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeProof — понимай свой код",
  description: "Практика для подготовки к защите программного кода.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="ru"><body>{children}</body></html>;
}
