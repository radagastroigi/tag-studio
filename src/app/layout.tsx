import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Monkthetics â€” Daily Goal Execution",
  description: "One long-term goal. One short-term goal. Quiet daily focus.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#17211E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}