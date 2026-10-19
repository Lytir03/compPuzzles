import type { Metadata } from "next";
import { LegalIndexPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Legal · CompPuzzles" };

export default function LegalIndex() {
  return <LegalIndexPage locale="en" />;
}
