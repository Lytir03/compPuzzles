import type { Metadata } from "next";
import { LegalIndexPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Informazioni legali · CompPuzzles" };

export default function ItalianLegalIndex() {
  return <LegalIndexPage locale="it" />;
}
