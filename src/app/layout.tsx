import type { Metadata } from "next";
import { Inter } from "next/font/google";
import WebVitals from "@/components/WebVitals";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "NovelShelf — Reading Tracker",
  description: "Track your web novels, light novels, and manga",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="antialiased">
        <WebVitals />
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
