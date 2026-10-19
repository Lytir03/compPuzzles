import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentPage } from "@/components/legal/LegalPage";
import { getLegalCopy, isLegalDocument } from "@/components/legal/legalContent";

export async function generateMetadata(
  props: PageProps<"/legal/[document]">,
): Promise<Metadata> {
  const { document } = await props.params;
  if (!isLegalDocument(document)) return {};
  return { title: `${getLegalCopy("en", document).title} · CompPuzzles` };
}

export default async function LegalDocument(props: PageProps<"/legal/[document]">) {
  const { document } = await props.params;
  if (!isLegalDocument(document)) notFound();
  return <LegalDocumentPage locale="en" document={document} />;
}
