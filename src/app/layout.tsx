import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kies Mijn EV",
  description: "Vergelijk elektrische auto's op real range, prijs, verbruik en praktische specificaties.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
