import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentPage } from "@/components/legal/LegalPage";
import { getLegalCopy, isLegalDocument } from "@/components/legal/legalContent";

export async function generateMetadata(
  props: PageProps<"/it/legal/[document]">,
): Promise<Metadata> {
  const { document } = await props.params;
  if (!isLegalDocument(document)) return {};
  return { title: `${getLegalCopy("it", document).title} · CompPuzzles` };
}

export default async function ItalianLegalDocument(
  props: PageProps<"/it/legal/[document]">,
) {
  const { document } = await props.params;
  if (!isLegalDocument(document)) notFound();
  return <LegalDocumentPage locale="it" document={document} />;
}
