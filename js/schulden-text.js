// Aus einem gesprochenen oder getippten Satz einen Schuldeneintrag lesen.
//
// Bewusst Regeln statt Sprachmodell: ein Modell bräuchte einen Schlüssel im
// Browser, der in einem öffentlichen Repo für jeden lesbar wäre. Für den engen
// Satzbau "X schuldet mir Y Euro für Z" reichen Regeln, und sie laufen ohne
// Netz, ohne Kosten und ohne dass ein Satz das Gerät verlässt.

// Muster statt fester Wortketten: "hat mir 20 Euro geliehen" hat Wörter
// dazwischen, die eine einfache Textsuche nicht überspringt.
const SCHULDE_ICH = [
  /\bich schulde\b/,
  /\bschulde ich\b/,
  /\bhat (?:mir|mich)\b[^.!?]{0,30}?\b(?:geliehen|geborgt|gegeben|ausgelegt|bezahlt|eingeladen|gezahlt)\b/,
  /\b(?:geliehen|geborgt|bekommen|geschenkt) von\b/,
  /\bich muss\b[^.!?]{0,30}?\b(?:zurück|zurueck|zahlen|geben)\b/,
  /\bvon\b[^.!?]{0,20}?\b(?:geliehen|geborgt)\b/,
];

const BEKOMME_ICH = [
  /\bschuldet? mir\b/,
  /\bschulden mir\b/,
  /\bschuldet\b/,
  /\b(?:geliehen|geborgt|gegeben) an\b/,
  /\ban\b[^.!?]{0,20}?\b(?:geliehen|geborgt)\b/,
  /\bich (?:habe|hab)\b[^.!?]{0,30}?\b(?:ausgelegt|bezahlt|vorgestreckt|gezahlt|übernommen)\b/,
  /\bfür\b[^.!?]{0,25}?\b(?:ausgelegt|bezahlt|vorgestreckt|gezahlt)\b/,
];

// "für Jonas bezahlt" nennt keinen Grund, sondern die Person.
const FUER_IST_PERSON = /\bf(?:ü|ue)r\b[^.!?]{0,30}?\b(?:ausgelegt|bezahlt|vorgestreckt|gezahlt|eingeladen|übernommen)\b/;

const KEINE_NAMEN = new Set([
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mir', 'mich', 'dir', 'dich',
  'euro', 'eur', 'cent', 'der', 'die', 'das', 'den', 'dem', 'ein', 'eine',
  'für', 'fuer', 'fürs', 'fuers', 'wegen', 'weil', 'von', 'an', 'am', 'und',
  'hat', 'habe', 'hab', 'zum', 'zur', 'beim', 'im', 'ins',
  'schulde', 'schuldet', 'schulden', 'geliehen', 'geborgt', 'bezahlt',
  'ausgelegt', 'gestern', 'heute', 'vorgestern', 'noch', 'insgesamt',
  'zurück', 'zurueck', 'bekommen', 'gegeben', 'muss', 'bin', 'ist',
]);

// "fürs", "für die", "wegen" - alles, was einen Grund einleiten kann.
const GRUND_EINLEITUNG = /\b(f(?:ü|ue)rs?|wegen|weil)\b/i;

function betragAus(text) {
  // "20", "20,50", "20.50", "1.200,50" – jeweils optional mit Euro dahinter.
  const treffer = [...text.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(€|eur\b|euro\b)?/gi)];
  if (!treffer.length) return null;

  // Ein Betrag mit Währung schlägt eine nackte Zahl, sonst gilt der erste.
  const mitWaehrung = treffer.find(t => t[3]);
  const t = mitWaehrung ?? treffer[0];
  const ganz = Number(t[1].replace(/\./g, ''));
  const rest = t[2] ? Number(`0.${t[2]}`) : 0;
  const wert = ganz + rest;
  return Number.isFinite(wert) && wert > 0 ? { wert, stelle: t.index, laenge: t[0].length } : null;
}

function richtungAus(klein) {
  const fund = liste => liste
    .map(r => klein.match(r))
    .filter(Boolean)
    .sort((a, b) => a.index - b.index)[0];

  const schulde = fund(SCHULDE_ICH);
  const bekomme = fund(BEKOMME_ICH);
  // Bei zwei Treffern gewinnt der frühere - "hat mir geliehen" steht vor dem
  // allgemeineren "geliehen an".
  if (schulde && bekomme) return schulde.index <= bekomme.index ? 'schulde' : 'bekomme';
  if (schulde) return 'schulde';
  if (bekomme) return 'bekomme';
  return null;
}

function datumAus(klein) {
  const heute = new Date();
  const verschieben = tage => {
    const d = new Date(heute);
    d.setDate(d.getDate() - tage);
    return d.toISOString().slice(0, 10);
  };
  if (/\bvorgestern\b/.test(klein)) return verschieben(2);
  if (/\bgestern\b/.test(klein)) return verschieben(1);

  const m = klein.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?\b/);
  if (m) {
    const jahr = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : String(heute.getFullYear());
    return `${jahr}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return heute.toISOString().slice(0, 10);
}

function grundAus(text) {
  // Steht nach "für" die Person, gibt es aus diesem Teil keinen Grund.
  if (FUER_IST_PERSON.test(text.toLowerCase())) return '';

  const treffer = text.match(GRUND_EINLEITUNG);
  if (!treffer) return '';

  // Beträge und Datumsangaben gehören nicht in den Grund.
  const sauber = text.slice(treffer.index + treffer[0].length)
    .replace(/\d+(?:[.,]\d{1,2})?\s*(€|eur\b|euro\b)?/gi, '')
    .replace(/\b(gestern|heute|vorgestern)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[-–,.\s]+|[-–,.\s]+$/g, '');
  return sauber ? sauber.charAt(0).toUpperCase() + sauber.slice(1) : '';
}

function personAus(text, betrag) {
  // "für Jonas bezahlt": dann ist der Name genau das Wort nach "für".
  if (FUER_IST_PERSON.test(text.toLowerCase())) {
    const m = text.match(/\bf(?:ü|ue)r\s+([^\s.,!?;:]+)/i);
    if (m && !KEINE_NAMEN.has(m[1].toLowerCase()) && !/\d/.test(m[1])) return gross(m[1]);
  }

  // Alles wegnehmen, was sicher kein Name ist, dann bleibt meist genau einer.
  const ohneBetrag = betrag
    ? text.slice(0, betrag.stelle) + ' ' + text.slice(betrag.stelle + betrag.laenge)
    : text;
  const ohneGrund = ohneBetrag.split(GRUND_EINLEITUNG)[0];

  const woerter = ohneGrund
    .replace(/[.,!?;:]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const kandidaten = woerter.filter(w => {
    if (KEINE_NAMEN.has(w.toLowerCase())) return false;
    if (/\d/.test(w)) return false;
    return /^[A-ZÄÖÜ]/.test(w);
  });
  if (kandidaten.length) return kandidaten[0];

  // Diktierte Sätze kommen oft klein geschrieben an - dann hilft die Position:
  // das Wort direkt vor "schuldet" oder direkt nach "an" / "schulde".
  const klein = ohneGrund.toLowerCase().replace(/[.,!?;:]/g, ' ').split(/\s+/).filter(Boolean);
  const vor = klein.findIndex(w => w.startsWith('schuldet'));
  if (vor > 0 && !KEINE_NAMEN.has(klein[vor - 1])) return gross(klein[vor - 1]);

  for (const marke of ['schulde', 'an', 'von']) {
    const i = klein.indexOf(marke);
    if (i >= 0 && klein[i + 1] && !KEINE_NAMEN.has(klein[i + 1])) return gross(klein[i + 1]);
  }
  return '';
}

const gross = w => w.charAt(0).toUpperCase() + w.slice(1);

export function leseSatz(text) {
  const roh = String(text ?? '').trim();
  if (!roh) return { erfolg: false, fehlt: ['Text'], betrag: null, person: '', richtung: 'bekomme', grund: '', datum: '' };

  const klein = roh.toLowerCase();
  const betrag = betragAus(roh);
  const richtung = richtungAus(klein);
  const person = personAus(roh, betrag);

  const fehlt = [];
  if (!betrag) fehlt.push('Betrag');
  if (!person) fehlt.push('Name');

  return {
    erfolg: fehlt.length === 0,
    fehlt,
    betrag: betrag?.wert ?? null,
    person,
    // Ohne Hinweis im Satz ist die häufigere Richtung die wahrscheinlichere.
    richtung: richtung ?? 'bekomme',
    richtungSicher: richtung !== null,
    grund: grundAus(roh),
    datum: datumAus(klein),
  };
}
