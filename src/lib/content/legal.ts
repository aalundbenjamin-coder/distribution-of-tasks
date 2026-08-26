/**
 * The terms of service and privacy policy.
 *
 * Kept as data rather than as markup so exactly the same words appear in three
 * places: the full page at /legal/terms, the panel that opens inside the
 * sign-up form, and any future export. The version string is what gets written
 * into the consent record, so editing these documents means bumping the version
 * in `src/lib/auth/consent.ts` and asking everyone again.
 *
 * These are plain-language operating terms for the product. They are not legal
 * advice, and an organisation deploying this should have its own counsel review
 * them before going live.
 */

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  slug: 'terms' | 'privacy';
  title: string;
  version: string;
  updated: string;
  summary: string;
  sections: LegalSection[];
}

export const TERMS_DOCUMENT: LegalDocument = {
  slug: 'terms',
  title: 'Terms of service',
  version: '2026-01-15',
  updated: '15 January 2026',
  summary:
    'What you can expect from Distribution of Tasks, and what we expect from you when you use it at work.',
  sections: [
    {
      heading: '1. What this service does',
      paragraphs: [
        'Distribution of Tasks receives work items placed in a folder by a head of distribution and matches each one against the recorded capabilities of the people in your organisation. It then either assigns the work to the best-matched qualified person or, where the folder is configured to do so, presents a shortlist for a human to decide.',
        'The matching is a decision aid. It applies the rules and the capability records that your organisation has entered. It does not know anything your organisation has not told it, and it does not replace the judgement of the person accountable for the work.',
      ],
    },
    {
      heading: '2. Your account',
      paragraphs: [
        'You may create an account with an e-mail address and a password, with a Google account, or with a phone number verified by a one-time code. Whichever door you use, you get one account: adding a second sign-in method later links to the same profile rather than creating a duplicate.',
        'You are responsible for keeping your credentials to yourself. Tell your administrator immediately if you think someone else has access to your account. We will never ask you for your password or for a one-time code.',
        'Your employer may create, suspend or deactivate accounts on this service, and may see the work-related information described in the privacy policy.',
      ],
    },
    {
      heading: '3. Capability records and assignment',
      paragraphs: [
        'Capability records — skills, levels, certifications, expiry dates, languages, capacity and availability — determine what work you can be given. Records marked as verified have been signed off by a lead; unverified records are self-declared.',
        'Entering a capability you do not have, or a certification you do not hold, can result in work being routed to you that you are not qualified to do. Keep your profile accurate, and tell your lead when a certification lapses.',
        'A head of distribution can assign a task by hand and, where the system says a person does not meet a requirement, can override that only by recording a written reason. Those overrides are logged and visible.',
      ],
    },
    {
      heading: '4. Acceptable use',
      paragraphs: [
        'Use the service for coordinating work in your organisation. Do not attempt to access accounts, folders or records you have not been granted access to, do not attempt to disrupt the service, and do not use it to store personal data that has nothing to do with work.',
        'We may suspend access that puts the service or other users at risk, and will tell your administrator when we do.',
      ],
    },
    {
      heading: '5. Availability and changes',
      paragraphs: [
        'We aim to keep the service available, but we do not promise it will never be interrupted. Planned maintenance is announced in the notification bell in advance where practical.',
        'If we change these terms in a way that affects your rights, we will publish a new version and ask you to accept it. Your previous acceptance is not carried over to a new version — you will be asked again.',
      ],
    },
    {
      heading: '6. Ending your use',
      paragraphs: [
        'You can stop using the service at any time and ask your administrator to deactivate your account. Records that your employer must keep — such as who a task was assigned to and why — remain in the audit trail, as described in the privacy policy.',
      ],
    },
    {
      heading: '7. Liability',
      paragraphs: [
        'The service is provided to your organisation under the agreement your organisation has with the operator. Nothing in these terms limits liability that cannot be limited by law, such as for death or personal injury caused by negligence, or for fraud.',
      ],
    },
    {
      heading: '8. Contact',
      paragraphs: [
        'Questions about these terms go to your organisation’s administrator in the first instance. They can raise anything they cannot answer with the operator of the service.',
      ],
    },
  ],
};

export const PRIVACY_DOCUMENT: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy policy',
  version: '2026-01-15',
  updated: '15 January 2026',
  summary:
    'What we hold about you, why we hold it, how notification consent works, and how to change your mind.',
  sections: [
    {
      heading: '1. What we hold',
      paragraphs: [
        'Account details: your name, and whichever of an e-mail address and a phone number you signed up with. If you used Google, we store the account identifier Google gives us and the e-mail address on that account — we never receive your Google password.',
        'Work profile: your position, department, capabilities and their levels, certifications and expiry dates, languages, weekly capacity, availability, and free-text notes your lead adds.',
        'Activity: tasks assigned to you, when they were assigned and completed, and the full record of each matching run — including the runs where you were considered and not chosen, and the reason.',
        'Consent: every consent decision you make, with the version of the document you were shown, the time, and the IP address and browser it came from.',
        'Security: session records, sign-in times, and one-time codes. Passwords are stored only as salted scrypt hashes; session tokens and one-time codes are stored only as SHA-256 digests. None of these can be reversed to the original value.',
      ],
    },
    {
      heading: '2. Why we hold it',
      paragraphs: [
        'To route work to people who are qualified to do it, which is the purpose of the service and the basis of your employer’s legitimate interest in operating it.',
        'To show why a particular person received a particular task. Because assignment decisions can affect pay, safety and workload, the reasoning behind each one is recorded and can be inspected.',
        'To keep the service secure and to investigate misuse.',
        'To send you the notifications you have agreed to.',
      ],
    },
    {
      heading: '3. Notifications and consent',
      paragraphs: [
        'Notifications about your own work — a task assigned to you, a decision waiting on you — are part of using the service. They always appear in the bell in the top-right corner of the app.',
        'Sending those same notifications to your e-mail address or your phone is separate, and only happens if you switch it on. Product news and feature announcements are separate again, and off unless you ask for them.',
        'If you do not consent to anything, nothing is lost: every notification still reaches you in the bell. Consent widens where a message goes, never whether it exists.',
        'You can change any of these at any time under Settings → Notifications. A change applies from the moment you save it. We keep the record of what you previously chose, because we need to be able to show why a message was sent on a given day.',
      ],
    },
    {
      heading: '4. Who can see what',
      paragraphs: [
        'You can see your own profile, your own tasks, your own notifications and your own consent history.',
        'A head of distribution can see capability profiles, folders, tasks and matching records for the organisation — this is what lets them distribute work and check that it went to the right person.',
        'A platform administrator can additionally see the audit trail and manage accounts.',
        'We do not sell your data, and we do not use it to train anything.',
      ],
    },
    {
      heading: '5. Third parties',
      paragraphs: [
        'If your deployment is configured to send e-mail or SMS, the content of those messages and your address or number are passed to the configured provider for delivery. Where no provider is configured, no message leaves the server.',
        'If you sign in with Google, Google tells us your account identifier, e-mail address, whether it is verified, and your display name. We ask for nothing else.',
      ],
    },
    {
      heading: '6. How long we keep it',
      paragraphs: [
        'Account and profile data are kept while your account is active. Sessions expire after 30 days; one-time codes after 10 minutes.',
        'Assignment history, matching records and the audit trail are retained for as long as your organisation’s record-keeping obligations require, because they are the evidence of why work was distributed as it was. They are kept even after an account is deactivated, and are linked to a person only by an internal identifier.',
      ],
    },
    {
      heading: '7. Your rights',
      paragraphs: [
        'You can ask for a copy of the data held about you, ask for a correction, ask for deletion, object to processing, or withdraw a consent. Withdrawing a consent does not affect messages already sent under it.',
        'Start with your organisation’s administrator, who can action most requests directly in the app. If you are not satisfied, you can complain to your national data-protection authority.',
      ],
    },
    {
      heading: '8. Changes',
      paragraphs: [
        'If this policy changes materially we publish a new version and ask you to read it again. Your acceptance is recorded against a specific version, so an older acceptance never silently carries over.',
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<'terms' | 'privacy', LegalDocument> = {
  terms: TERMS_DOCUMENT,
  privacy: PRIVACY_DOCUMENT,
};

// ===========================================================================
// Dansk
// ===========================================================================

export const TERMS_DOCUMENT_DA: LegalDocument = {
  slug: 'terms',
  title: 'Servicevilkår',
  version: '2026-01-15',
  updated: '15. januar 2026',
  summary:
    'Hvad du kan forvente af Fordeling af opgaver, og hvad vi forventer af dig, når du bruger tjenesten på arbejdet.',
  sections: [
    {
      heading: '1. Hvad tjenesten gør',
      paragraphs: [
        'Fordeling af opgaver modtager de opgaver, en fordelingsansvarlig lægger i en mappe, og holder hver enkelt op mod de registrerede kompetencer hos medarbejderne i din organisation. Derefter tildeles arbejdet enten til den bedst matchende kvalificerede person, eller — hvis mappen er sat op til det — vises en kandidatliste, som et menneske træffer beslutningen ud fra.',
        'Matchningen er en beslutningsstøtte. Den anvender de regler og de kompetenceoplysninger, din organisation har indtastet. Den ved intet, som din organisation ikke har fortalt den, og den erstatter ikke dømmekraften hos den, der er ansvarlig for arbejdet.',
      ],
    },
    {
      heading: '2. Din konto',
      paragraphs: [
        'Du kan oprette en konto med en e-mailadresse og en adgangskode, med en Google-konto eller med et telefonnummer bekræftet ved en engangskode. Uanset hvilken vej du bruger, får du én konto: tilføjer du senere en anden loginmetode, knyttes den til den samme profil frem for at oprette en dublet.',
        'Du er selv ansvarlig for at holde dine loginoplysninger for dig selv. Kontakt straks din administrator, hvis du har mistanke om, at andre har adgang til din konto. Vi beder dig aldrig om din adgangskode eller om en engangskode.',
        'Din arbejdsgiver kan oprette, suspendere og deaktivere konti i tjenesten og kan se de arbejdsrelaterede oplysninger, der er beskrevet i privatlivspolitikken.',
      ],
    },
    {
      heading: '3. Kompetencer og tildeling',
      paragraphs: [
        'Kompetenceoplysninger — færdigheder, niveauer, certifikater, udløbsdatoer, sprog, kapacitet og tilgængelighed — afgør, hvilket arbejde du kan få tildelt. Oplysninger, der er markeret som verificerede, er godkendt af en leder; oplysninger uden markering er selvangivne.',
        'Angiver du en kompetence, du ikke har, eller et certifikat, du ikke besidder, kan det føre til, at du får arbejde, du ikke er kvalificeret til. Hold din profil opdateret, og sig til over for din leder, når et certifikat udløber.',
        'En fordelingsansvarlig kan tildele en opgave manuelt og kan — hvor systemet vurderer, at en person ikke opfylder et krav — kun overstyre dette ved at angive en skriftlig begrundelse. Sådanne overstyringer bliver registreret og er synlige.',
      ],
    },
    {
      heading: '4. Acceptabel brug',
      paragraphs: [
        'Brug tjenesten til at koordinere arbejde i din organisation. Forsøg ikke at få adgang til konti, mapper eller oplysninger, du ikke har fået adgang til, forsøg ikke at forstyrre driften, og brug ikke tjenesten til at opbevare personoplysninger, der er arbejdet uvedkommende.',
        'Vi kan suspendere adgang, der udgør en risiko for tjenesten eller for andre brugere, og vi orienterer din administrator, når vi gør det.',
      ],
    },
    {
      heading: '5. Tilgængelighed og ændringer',
      paragraphs: [
        'Vi bestræber os på at holde tjenesten tilgængelig, men vi lover ikke, at den aldrig afbrydes. Planlagt vedligeholdelse varsles på forhånd i notifikationsklokken, hvor det er praktisk muligt.',
        'Ændrer vi disse vilkår på en måde, der berører dine rettigheder, offentliggør vi en ny version og beder dig acceptere den. Din tidligere accept overføres ikke automatisk til en ny version — du bliver spurgt igen.',
      ],
    },
    {
      heading: '6. Ophør',
      paragraphs: [
        'Du kan til enhver tid holde op med at bruge tjenesten og bede din administrator om at deaktivere din konto. Oplysninger, som din arbejdsgiver er forpligtet til at opbevare — for eksempel hvem en opgave blev tildelt og hvorfor — forbliver i revisionsloggen som beskrevet i privatlivspolitikken.',
      ],
    },
    {
      heading: '7. Ansvar',
      paragraphs: [
        'Tjenesten stilles til rådighed for din organisation i henhold til den aftale, din organisation har med leverandøren. Intet i disse vilkår begrænser et ansvar, der ikke kan begrænses efter loven, herunder ansvar for dødsfald eller personskade forårsaget af uagtsomhed eller for svig.',
      ],
    },
    {
      heading: '8. Kontakt',
      paragraphs: [
        'Spørgsmål til disse vilkår rettes i første omgang til din organisations administrator. Hvad de ikke kan besvare, kan de tage op med leverandøren af tjenesten.',
      ],
    },
  ],
};

export const PRIVACY_DOCUMENT_DA: LegalDocument = {
  slug: 'privacy',
  title: 'Privatlivspolitik',
  version: '2026-01-15',
  updated: '15. januar 2026',
  summary:
    'Hvad vi opbevarer om dig, hvorfor vi gør det, hvordan samtykke til notifikationer fungerer, og hvordan du ombestemmer dig.',
  sections: [
    {
      heading: '1. Hvad vi opbevarer',
      paragraphs: [
        'Kontooplysninger: dit navn og den e-mailadresse og/eller det telefonnummer, du oprettede kontoen med. Har du brugt Google, gemmer vi den konto-id, Google giver os, og e-mailadressen på den konto — vi modtager aldrig din Google-adgangskode.',
        'Arbejdsprofil: din stilling, afdeling, dine kompetencer og deres niveauer, certifikater og udløbsdatoer, sprog, ugentlig kapacitet, tilgængelighed og de fritekstnoter, din leder tilføjer.',
        'Aktivitet: opgaver, du er blevet tildelt, hvornår de blev tildelt og fuldført, samt den fulde registrering af hver matchningskørsel — herunder de kørsler, hvor du blev overvejet uden at blive valgt, og begrundelsen for det.',
        'Samtykke: hver samtykkebeslutning, du træffer, med den version af dokumentet, du fik vist, tidspunktet samt den IP-adresse og browser, beslutningen kom fra.',
        'Sikkerhed: sessionsoplysninger, logintidspunkter og engangskoder. Adgangskoder gemmes udelukkende som saltede scrypt-hashes; sessionsnøgler og engangskoder gemmes udelukkende som SHA-256-kontrolsummer. Ingen af delene kan føres tilbage til den oprindelige værdi.',
      ],
    },
    {
      heading: '2. Hvorfor vi opbevarer det',
      paragraphs: [
        'For at sende arbejde til medarbejdere, der er kvalificerede til at udføre det, hvilket er tjenestens formål og grundlaget for din arbejdsgivers legitime interesse i at drive den.',
        'For at kunne vise, hvorfor en bestemt person fik en bestemt opgave. Fordi tildelinger kan påvirke løn, sikkerhed og arbejdsbyrde, registreres begrundelsen bag hver enkelt og kan efterprøves.',
        'For at holde tjenesten sikker og undersøge misbrug.',
        'For at sende dig de notifikationer, du har givet samtykke til.',
      ],
    },
    {
      heading: '3. Notifikationer og samtykke',
      paragraphs: [
        'Notifikationer om dit eget arbejde — en opgave, du er blevet tildelt, eller en beslutning, der venter på dig — er en del af at bruge tjenesten. De vises altid i klokken i øverste højre hjørne.',
        'At sende de samme notifikationer til din e-mailadresse eller din telefon er noget andet og sker kun, hvis du slår det til. Produktnyheder og meddelelser om nye funktioner er igen noget andet og er slået fra, medmindre du beder om dem.',
        'Giver du ikke samtykke til noget, går du ikke glip af noget: alle notifikationer når stadig frem til dig i klokken. Samtykke udvider, hvor en besked havner — aldrig om den findes.',
        'Du kan til enhver tid ændre dette under Indstillinger → Notifikationer. En ændring gælder fra det øjeblik, du gemmer den. Vi bevarer registreringen af, hvad du tidligere valgte, fordi vi skal kunne vise, hvorfor en besked blev sendt på en given dag.',
      ],
    },
    {
      heading: '4. Hvem kan se hvad',
      paragraphs: [
        'Du kan se din egen profil, dine egne opgaver, dine egne notifikationer og din egen samtykkehistorik.',
        'En fordelingsansvarlig kan se kompetenceprofiler, mapper, opgaver og matchningsoplysninger for organisationen — det er dét, der gør det muligt at fordele arbejdet og kontrollere, at det gik til den rette.',
        'En platformadministrator kan derudover se revisionsloggen og administrere konti.',
        'Vi sælger ikke dine oplysninger, og vi bruger dem ikke til at træne noget.',
      ],
    },
    {
      heading: '5. Tredjeparter',
      paragraphs: [
        'Er din installation sat op til at sende e-mail eller sms, videregives indholdet af disse beskeder samt din adresse eller dit nummer til den valgte udbyder med henblik på levering. Er der ikke opsat en udbyder, forlader ingen besked serveren.',
        'Logger du ind med Google, oplyser Google os din konto-id, din e-mailadresse, om den er bekræftet, og dit viste navn. Vi beder ikke om andet.',
      ],
    },
    {
      heading: '6. Hvor længe vi opbevarer det',
      paragraphs: [
        'Konto- og profiloplysninger opbevares, så længe din konto er aktiv. Sessioner udløber efter 30 dage, engangskoder efter 10 minutter.',
        'Tildelingshistorik, matchningsoplysninger og revisionsloggen opbevares, så længe din organisations dokumentationspligt kræver det, fordi de udgør dokumentationen for, hvorfor arbejdet blev fordelt, som det blev. De bevares også, efter en konto er deaktiveret, og er kun knyttet til en person via en intern identifikator.',
      ],
    },
    {
      heading: '7. Dine rettigheder',
      paragraphs: [
        'Du kan bede om en kopi af de oplysninger, vi har om dig, bede om at få dem rettet, bede om at få dem slettet, gøre indsigelse mod behandlingen eller trække et samtykke tilbage. At trække et samtykke tilbage påvirker ikke beskeder, der allerede er sendt på grundlag af det.',
        'Henvend dig først til din organisations administrator, som kan behandle de fleste anmodninger direkte i systemet. Er du ikke tilfreds, kan du klage til Datatilsynet.',
      ],
    },
    {
      heading: '8. Ændringer',
      paragraphs: [
        'Ændres denne politik væsentligt, offentliggør vi en ny version og beder dig læse den igen. Din accept registreres altid mod en bestemt version, så en ældre accept overføres aldrig i stilhed.',
      ],
    },
  ],
};

const BY_LOCALE = {
  en: { terms: TERMS_DOCUMENT, privacy: PRIVACY_DOCUMENT },
  da: { terms: TERMS_DOCUMENT_DA, privacy: PRIVACY_DOCUMENT_DA },
} as const;

/** The pair of documents in the reader's language. */
export function legalDocuments(locale: 'da' | 'en') {
  return BY_LOCALE[locale] ?? BY_LOCALE.en;
}
