import Link from "next/link";
import {
  LEGAL_DOCUMENTS,
  getLegalCopy,
  type LegalDocumentSlug,
  type LegalLocale,
} from "./legalContent";

const LABELS: Record<LegalLocale, Record<LegalDocumentSlug, string>> = {
  en: {
    privacy: "Privacy",
    terms: "Terms",
    cookies: "Cookies",
    "cookie-preferences": "Cookie preferences",
    contact: "Contact",
  },
  it: {
    privacy: "Privacy",
    terms: "Termini",
    cookies: "Cookie",
    "cookie-preferences": "Preferenze cookie",
    contact: "Contatti",
  },
};

function legalHref(locale: LegalLocale, document?: LegalDocumentSlug): string {
  const root = locale === "it" ? "/it/legal" : "/legal";
  return document ? `${root}/${document}` : root;
}

export function LegalIndexPage({ locale }: { locale: LegalLocale }) {
  const italian = locale === "it";
  return (
    <main lang={locale} className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">{italian ? "Informazioni legali" : "Legal information"}</p>
          <Link
            href={legalHref(italian ? "en" : "it")}
            className="soft-button rounded-xl px-3 py-2 text-sm font-bold"
          >
            {italian ? "English" : "Italiano"}
          </Link>
        </div>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">
          {italian ? "Trasparenza prima del gioco." : "Transparency before play."}
        </h1>
        <p className="subtle-text mt-4 max-w-2xl text-base font-medium leading-7">
          {italian
            ? "Qui trovi le regole della beta, il trattamento dei dati e i canali per contattarci. Durante la beta la pubblicità è disabilitata."
            : "Find the beta rules, data practices and contact routes here. Advertising remains disabled during beta."}
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {LEGAL_DOCUMENTS.map((document) => {
            const copy = getLegalCopy(locale, document);
            return (
              <Link
                key={document}
                href={legalHref(locale, document)}
                className="game-panel group rounded-2xl p-5 transition hover:-translate-y-0.5"
              >
                <h2 className="font-black">{LABELS[locale][document]}</h2>
                <p className="subtle-text mt-2 line-clamp-3 text-sm font-medium leading-6">
                  {copy.summary}
                </p>
                <span className="mt-4 inline-block text-sm font-black text-[var(--brand-text)]">
                  {italian ? "Apri" : "Open"} →
                </span>
              </Link>
            );
          })}
        </div>
    </main>
  );
}

export function LegalDocumentPage({
  locale,
  document,
}: {
  locale: LegalLocale;
  document: LegalDocumentSlug;
}) {
  const copy = getLegalCopy(locale, document);
  const italian = locale === "it";
  return (
    <main lang={locale} className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={legalHref(locale)} className="nav-link px-3 py-2 text-sm font-bold">
            ← {italian ? "Documenti legali" : "Legal documents"}
          </Link>
          <Link
            href={legalHref(italian ? "en" : "it", document)}
            className="soft-button rounded-xl px-3 py-2 text-sm font-bold"
          >
            {italian ? "English" : "Italiano"}
          </Link>
        </div>
        <article className="game-panel mt-6 rounded-3xl px-5 py-7 sm:px-9 sm:py-10">
          <p className="eyebrow">CompPuzzles public beta</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{copy.title}</h1>
          <p className="subtle-text mt-4 text-base font-medium leading-7">{copy.summary}</p>
          <div className="mt-9 space-y-9">
            {copy.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-black tracking-tight">{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="subtle-text mt-3 text-sm font-medium leading-7">
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="subtle-text mt-3 list-disc space-y-2 pl-5 text-sm font-medium leading-7">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </article>
    </main>
  );
}
