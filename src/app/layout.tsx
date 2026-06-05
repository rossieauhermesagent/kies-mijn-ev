import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Kies Mijn EV",
  description: "Vergelijk elektrische auto's op real range, prijs, verbruik en praktische specificaties.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body className={dmSans.className}>{children}</body>
    </html>
  );
}
