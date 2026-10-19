import "server-only";

export const LEGAL_DOCUMENTS = [
  "privacy",
  "terms",
  "cookies",
  "cookie-preferences",
  "contact",
] as const;

export type LegalDocumentSlug = (typeof LEGAL_DOCUMENTS)[number];
export type LegalLocale = "en" | "it";

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalCopy {
  title: string;
  summary: string;
  sections: LegalSection[];
}

const controller =
  process.env.LEGAL_CONTROLLER_NAME ?? "[controller name required before public launch]";
const privacyEmail =
  process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "privacy@example.invalid";
const securityEmail =
  process.env.NEXT_PUBLIC_SECURITY_EMAIL ?? privacyEmail;
const country = process.env.LEGAL_CONTROLLER_COUNTRY ?? "Italy";
const updated = process.env.LEGAL_LAST_UPDATED ?? "17 August 2026";

const providerList =
  "Supabase (EU database and authentication), Railway (EU realtime service), Netlify (web delivery and functions), Upstash (security rate limiting), Resend (transactional email), Cloudflare R2 (encrypted backups), and Sentry (PII-minimised error monitoring).";
const providerListIt =
  "Supabase (database UE e autenticazione), Railway (servizio realtime UE), Netlify (distribuzione web e funzioni), Upstash (rate limiting di sicurezza), Resend (email transazionali), Cloudflare R2 (backup cifrati) e Sentry (monitoraggio errori minimizzato e privo di PII).";

const ENGLISH: Record<LegalDocumentSlug, LegalCopy> = {
  privacy: {
    title: "Privacy notice",
    summary: `This notice explains how ${controller}, based in ${country}, handles personal data when you use CompPuzzles. Last updated: ${updated}.`,
    sections: [
      {
        heading: "Controller and contact",
        paragraphs: [
          `The data controller is ${controller}. Privacy questions and data-rights requests can be sent to ${privacyEmail}.`,
        ],
      },
      {
        heading: "Data we process",
        bullets: [
          "Account data: email address, username, account state and acceptance of the Terms and 16+ declaration.",
          "Competition data: rating, game mode, result, timestamps and the minimum audit data needed to preserve rating integrity.",
          "Private play data: practice attempts and solve details, retained for no more than 90 days.",
          "Security and technical data: IP address, short-lived identifiers, rate-limit events, device/browser information and redacted error diagnostics.",
          "Support data: information you choose to include when contacting us.",
        ],
        paragraphs: [
          "Passwords are handled by Supabase Auth and are never stored in the CompPuzzles application database. We do not collect a birth date, precise location, advertising profile or special-category data.",
        ],
      },
      {
        heading: "Purposes and legal bases",
        bullets: [
          "Contract: create and secure your account, provide matches, ratings, history and requested support.",
          "Legitimate interests: prevent abuse, investigate failures, protect players and maintain fair rating records, balanced against user rights.",
          "Legal obligation: respond to valid legal requests and exercise or defend legal claims.",
          "Consent: only for optional cookies or advertising technology if those features are introduced later.",
        ],
      },
      {
        heading: "Service providers and international transfers",
        paragraphs: [
          providerList,
          "Some requests may transit through Netlify infrastructure in the United States. Where personal data leaves the EEA, we rely on an applicable adequacy decision (including an active EU–US Data Privacy Framework certification) and/or the European Commission Standard Contractual Clauses, together with data minimisation and transport encryption. Provider status is reviewed before launch and at least annually.",
        ],
      },
      {
        heading: "Retention",
        bullets: [
          "Private practice and detailed match data: up to 90 days.",
          "Security and Sentry logs: normally up to 30 days.",
          "Unverified registrations: removed after 7 days.",
          "Account/profile data: until deletion or while needed to provide the service.",
          "Pseudonymised result and rating audit: retained as necessary to protect ladder integrity; deleted players are displayed generically.",
          "Encrypted backups: 7 daily and 4 weekly copies, so deleted personal data ages out within 28 days and is not reintroduced after restoration.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          `Depending on applicable law, you may request access, correction, deletion, restriction, portability or objection by writing to ${privacyEmail}. You may also withdraw consent at any time and complain to the Italian Data Protection Authority or your local supervisory authority.`,
          "Account deletion is immediate after re-authentication. It removes the account link and private data while retaining only non-linkable competitive records needed to avoid corrupting other players’ ratings.",
        ],
      },
      {
        heading: "Age and changes",
        paragraphs: [
          "CompPuzzles is intended for people aged 16 or older. We do not knowingly offer accounts to children under 16.",
          "Material changes to this notice will be announced in the app before they take effect when required.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of service",
    summary: `These Terms govern use of the CompPuzzles public beta operated by ${controller}. Last updated: ${updated}.`,
    sections: [
      {
        heading: "Eligibility and accounts",
        bullets: [
          "You must be at least 16 years old and provide accurate registration information.",
          "Keep your credentials private and notify us promptly if you suspect account misuse.",
          "One person may not operate multiple accounts to manipulate matchmaking or ratings.",
        ],
      },
      {
        heading: "Fair play",
        paragraphs: [
          "Do not automate play, scrape private endpoints, exploit bugs, interfere with another player, evade limits, reverse engineer hidden puzzle answers, or manipulate results. We may invalidate results or restrict accounts where reasonably necessary to protect players and the ladder.",
        ],
      },
      {
        heading: "Ratings and rewards",
        paragraphs: [
          "Ranked results affect an in-app Elo-style rating. Ratings have no monetary value, cannot be transferred or redeemed, and are not prizes. We may correct ratings affected by bugs, fraud or invalid matches.",
        ],
      },
      {
        heading: "Public beta and availability",
        paragraphs: [
          "The service is provided as a public beta without a service-level guarantee. Features may change, restart or be temporarily unavailable. We will use reasonable care but cannot promise uninterrupted or error-free operation.",
        ],
      },
      {
        heading: "Content and intellectual property",
        paragraphs: [
          "The CompPuzzles software, branding and original presentation remain the property of their respective owners. Puzzle data is used only when generated by us or supplied under terms that permit commercial use. You may use the service for personal gameplay, not republish its puzzle catalogue or hidden answers.",
        ],
      },
      {
        heading: "Suspension, deletion and liability",
        paragraphs: [
          "You may delete your account from account settings. We may suspend access for material breaches, security threats or legal requirements, with proportionate notice where practical.",
          "Nothing in these Terms excludes liability that cannot legally be excluded. To the extent permitted by law, CompPuzzles is not liable for indirect loss arising from use of this free beta.",
        ],
      },
      {
        heading: "Law and contact",
        paragraphs: [
          `These Terms are governed by Italian law without removing mandatory consumer protections in your country. Questions can be sent to ${privacyEmail}.`,
        ],
      },
    ],
  },
  cookies: {
    title: "Cookie notice",
    summary: `CompPuzzles currently uses only cookies and similar storage that are necessary to operate and secure the beta. Last updated: ${updated}.`,
    sections: [
      {
        heading: "Necessary storage",
        bullets: [
          "Authentication cookies keep an account signed in and rotate securely. They are HttpOnly, host-only, SameSite=Lax and Secure on HTTPS.",
          "Short-lived security state protects sign-in, email verification, password reset, CSRF defences and realtime admission.",
          "Essential interface state may remember a choice needed to provide a feature you requested.",
        ],
      },
      {
        heading: "Advertising and analytics",
        paragraphs: [
          "Advertising is disabled during the public beta. CompPuzzles does not currently set advertising cookies, load an ad network, use cross-site tracking or run session replay.",
          "If non-essential advertising or analytics is introduced, it will remain off until you make a choice through an equal Accept/Reject consent interface. You will be able to change that choice later.",
        ],
      },
      {
        heading: "Controlling cookies",
        paragraphs: [
          "You can delete or block cookies in your browser. Blocking strictly necessary cookies may prevent account login or ranked play. See Cookie preferences for the current consent status.",
        ],
      },
    ],
  },
  "cookie-preferences": {
    title: "Cookie preferences",
    summary: "There are currently no optional cookie categories to enable or disable.",
    sections: [
      {
        heading: "Current beta setting",
        paragraphs: [
          "Necessary cookies are always active because they provide authentication, security and requested realtime functionality. Advertising, personalisation, non-essential analytics and session replay are disabled.",
          "No consent cookie is created merely by visiting this page. A certified consent manager with equally prominent Accept and Reject controls will appear before any optional advertising technology is enabled.",
        ],
      },
    ],
  },
  contact: {
    title: "Contact",
    summary: `CompPuzzles is operated by ${controller} in ${country}.`,
    sections: [
      {
        heading: "Privacy and account requests",
        paragraphs: [`Email ${privacyEmail} for access, correction, export, deletion or other privacy requests.`],
      },
      {
        heading: "Security reports",
        paragraphs: [
          `Report suspected vulnerabilities privately to ${securityEmail}. Do not access other users’ data, degrade the service or publish a vulnerability before we have had a reasonable opportunity to investigate.`,
        ],
      },
      {
        heading: "Support",
        paragraphs: [
          `For beta support, include a short description, the game mode and approximate time of the problem. Do not send passwords, authentication links or sensitive personal data. Use ${privacyEmail}.`,
        ],
      },
    ],
  },
};

const ITALIAN: Record<LegalDocumentSlug, LegalCopy> = {
  privacy: {
    title: "Informativa privacy",
    summary: `Questa informativa descrive come ${controller}, con sede in ${country}, tratta i dati personali durante l’uso di CompPuzzles. Ultimo aggiornamento: ${updated}.`,
    sections: [
      {
        heading: "Titolare e contatti",
        paragraphs: [`Il titolare del trattamento è ${controller}. Per domande o richieste sui diritti privacy: ${privacyEmail}.`],
      },
      {
        heading: "Dati trattati",
        bullets: [
          "Account: indirizzo email, username, stato dell’account e accettazione dei Termini e della dichiarazione 16+.",
          "Competizione: rating, modalità, risultato, date e audit minimo necessario all’integrità del rating.",
          "Gioco privato: tentativi practice e dettagli di risoluzione, conservati per non oltre 90 giorni.",
          "Sicurezza e tecnica: indirizzo IP, identificatori temporanei, eventi di rate limiting, dati di browser/dispositivo e diagnostica errori redatta.",
          "Assistenza: informazioni scelte dall’utente nel contatto.",
        ],
        paragraphs: [
          "Le password sono gestite da Supabase Auth e non vengono salvate nel database applicativo CompPuzzles. Non raccogliamo data di nascita, posizione precisa, profili pubblicitari o categorie particolari di dati.",
        ],
      },
      {
        heading: "Finalità e basi giuridiche",
        bullets: [
          "Contratto: creare e proteggere l’account, fornire match, rating, storico e assistenza richiesta.",
          "Legittimo interesse: prevenire abusi, analizzare malfunzionamenti, proteggere i giocatori e mantenere corretti i rating.",
          "Obbligo legale: rispondere a richieste valide ed esercitare o difendere diritti.",
          "Consenso: soltanto per cookie o tecnologie pubblicitarie opzionali eventualmente aggiunte in futuro.",
        ],
      },
      {
        heading: "Fornitori e trasferimenti internazionali",
        paragraphs: [
          providerListIt,
          "Alcune richieste possono transitare nell’infrastruttura Netlify negli Stati Uniti. Per i trasferimenti fuori dallo SEE utilizziamo, quando applicabile, una decisione di adeguatezza (inclusa una certificazione attiva EU–US Data Privacy Framework) e/o le Clausole Contrattuali Standard della Commissione europea, insieme a minimizzazione e cifratura in transito. Lo stato dei fornitori viene verificato prima del lancio e almeno annualmente.",
        ],
      },
      {
        heading: "Conservazione",
        bullets: [
          "Tentativi practice e dettagli match privati: fino a 90 giorni.",
          "Log di sicurezza e Sentry: normalmente fino a 30 giorni.",
          "Registrazioni non verificate: 7 giorni.",
          "Account e profilo: fino alla cancellazione o finché necessari al servizio.",
          "Risultato pseudonimizzato e audit rating: quanto necessario all’integrità della classifica; i giocatori cancellati appaiono in modo generico.",
          "Backup cifrati: 7 copie giornaliere e 4 settimanali; i dati cancellati scadono entro 28 giorni e non vengono reintrodotti dopo un ripristino.",
        ],
      },
      {
        heading: "Diritti",
        paragraphs: [
          `Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità o opporti scrivendo a ${privacyEmail}. Puoi revocare il consenso e proporre reclamo al Garante per la protezione dei dati personali o all’autorità locale competente.`,
          "La cancellazione dell’account è immediata dopo una nuova autenticazione: elimina il collegamento all’identità e i dati privati, conservando soltanto registri competitivi non collegabili necessari a non alterare i rating degli altri giocatori.",
        ],
      },
      {
        heading: "Età e modifiche",
        paragraphs: [
          "CompPuzzles è destinato a persone di almeno 16 anni. Non offriamo consapevolmente account a minori di 16 anni.",
          "Le modifiche sostanziali verranno comunicate nell’app prima della loro efficacia, quando richiesto.",
        ],
      },
    ],
  },
  terms: {
    title: "Termini di servizio",
    summary: `Questi Termini regolano la beta pubblica CompPuzzles gestita da ${controller}. Ultimo aggiornamento: ${updated}.`,
    sections: [
      {
        heading: "Requisiti e account",
        bullets: [
          "Devi avere almeno 16 anni e fornire informazioni di registrazione corrette.",
          "Mantieni riservate le credenziali e segnala tempestivamente eventuali abusi.",
          "Non è consentito usare più account per manipolare matchmaking o rating.",
        ],
      },
      {
        heading: "Fair play",
        paragraphs: [
          "Non automatizzare il gioco, estrarre endpoint privati, sfruttare bug, disturbare altri giocatori, aggirare limiti, ricostruire risposte nascoste o manipolare risultati. Possiamo annullare risultati o limitare account quando ragionevolmente necessario per proteggere utenti e classifica.",
        ],
      },
      {
        heading: "Rating e ricompense",
        paragraphs: [
          "I risultati ranked modificano un rating in-app simile all’Elo. Il rating non ha valore economico, non è trasferibile o riscattabile e non costituisce un premio. Possiamo correggere rating alterati da bug, frodi o match invalidi.",
        ],
      },
      {
        heading: "Beta pubblica e disponibilità",
        paragraphs: [
          "Il servizio è una beta pubblica senza livelli di servizio garantiti. Funzioni e dati operativi possono cambiare o essere temporaneamente indisponibili. Adotteremo ragionevole diligenza, senza garantire funzionamento continuo o privo di errori.",
        ],
      },
      {
        heading: "Contenuti e proprietà intellettuale",
        paragraphs: [
          "Software, marchi e presentazione originale appartengono ai rispettivi titolari. Utilizziamo puzzle generati internamente o forniti con condizioni compatibili con l’uso commerciale. Il servizio è destinato al gioco personale, non alla ripubblicazione del catalogo o delle soluzioni nascoste.",
        ],
      },
      {
        heading: "Sospensione, cancellazione e responsabilità",
        paragraphs: [
          "Puoi eliminare l’account dalle impostazioni. Possiamo sospendere l’accesso per violazioni sostanziali, minacce alla sicurezza o obblighi legali, con preavviso proporzionato quando possibile.",
          "Nulla esclude responsabilità inderogabili. Nei limiti di legge, CompPuzzles non risponde di danni indiretti derivanti dall’uso di questa beta gratuita.",
        ],
      },
      {
        heading: "Legge e contatti",
        paragraphs: [`Si applica la legge italiana, fatti salvi i diritti inderogabili del consumatore nel proprio Paese. Contatti: ${privacyEmail}.`],
      },
    ],
  },
  cookies: {
    title: "Informativa cookie",
    summary: `CompPuzzles usa attualmente soltanto cookie e tecnologie analoghe necessari al funzionamento e alla sicurezza della beta. Ultimo aggiornamento: ${updated}.`,
    sections: [
      {
        heading: "Memoria necessaria",
        bullets: [
          "I cookie di autenticazione mantengono la sessione e vengono ruotati in sicurezza. Sono HttpOnly, host-only, SameSite=Lax e Secure su HTTPS.",
          "Stati di sicurezza temporanei proteggono accesso, verifica email, reset password, difese CSRF e ammissione realtime.",
          "Uno stato essenziale dell’interfaccia può ricordare una scelta necessaria a una funzione richiesta.",
        ],
      },
      {
        heading: "Pubblicità e analytics",
        paragraphs: [
          "La pubblicità è disabilitata durante la beta pubblica. Non impostiamo cookie pubblicitari, non carichiamo reti pubblicitarie, non eseguiamo tracking cross-site o session replay.",
          "Prima di introdurre pubblicità o analytics non essenziali mostreremo un’interfaccia di consenso con Accetta e Rifiuta equivalenti. La preferenza sarà modificabile in ogni momento.",
        ],
      },
      {
        heading: "Controllo dei cookie",
        paragraphs: [
          "Puoi eliminare o bloccare i cookie nel browser. Il blocco dei cookie strettamente necessari può impedire login o ranked. La pagina Preferenze cookie descrive lo stato corrente.",
        ],
      },
    ],
  },
  "cookie-preferences": {
    title: "Preferenze cookie",
    summary: "Al momento non esistono categorie opzionali da attivare o disattivare.",
    sections: [
      {
        heading: "Configurazione della beta",
        paragraphs: [
          "I cookie necessari sono sempre attivi perché forniscono autenticazione, sicurezza e funzionalità realtime richieste. Pubblicità, personalizzazione, analytics non essenziali e session replay sono disabilitati.",
          "La visita a questa pagina non crea un cookie di consenso. Prima di attivare tecnologie pubblicitarie opzionali verrà aggiunto un gestore certificato con controlli Accetta e Rifiuta di pari evidenza.",
        ],
      },
    ],
  },
  contact: {
    title: "Contatti",
    summary: `CompPuzzles è gestito da ${controller} in ${country}.`,
    sections: [
      {
        heading: "Privacy e account",
        paragraphs: [`Per accesso, rettifica, export, cancellazione o altre richieste privacy: ${privacyEmail}.`],
      },
      {
        heading: "Segnalazioni di sicurezza",
        paragraphs: [
          `Segnala in modo riservato le vulnerabilità a ${securityEmail}. Non accedere ai dati di altri utenti, non degradare il servizio e non pubblicare una vulnerabilità prima di averci concesso un tempo ragionevole per analizzarla.`,
        ],
      },
      {
        heading: "Assistenza",
        paragraphs: [
          `Indica una breve descrizione, la modalità di gioco e l’orario approssimativo del problema. Non inviare password, link di autenticazione o dati personali sensibili. Scrivi a ${privacyEmail}.`,
        ],
      },
    ],
  },
};

export function isLegalDocument(value: string): value is LegalDocumentSlug {
  return LEGAL_DOCUMENTS.includes(value as LegalDocumentSlug);
}

export function getLegalCopy(locale: LegalLocale, document: LegalDocumentSlug): LegalCopy {
  return locale === "it" ? ITALIAN[document] : ENGLISH[document];
}
