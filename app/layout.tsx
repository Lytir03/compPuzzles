import type { Metadata, Viewport } from "next";
import { Navbar } from "@/components/Navbar";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "CompPuzzles — Ranked Puzzle Battles",
  description: "Race real players in Sudoku and Nonograms, then clear no-guess Minesweeper boards.",
};

/**
 * Puzzle boards are dense grids on a phone, so the viewport must fill the
 * screen edge-to-edge — but pinch-zoom stays enabled (no `maximum-scale`),
 * since disabling it is an accessibility failure for anyone who needs to
 * magnify a dense puzzle cell.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#f5f2e8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Navbar />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
