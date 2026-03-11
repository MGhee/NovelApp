import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovelShelf — Reading Tracker",
  description: "Track your web novels, light novels, and manga",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
