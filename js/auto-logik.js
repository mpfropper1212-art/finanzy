// Rechnen rund ums Auto: Kosten je Kilometer und wann die nächste Wartung
// fällig ist. Ohne DOM, damit es sich für sich prüfen lässt.

import { isoDatum, uid } from './util.js';
import { KATEGORIEN, KATEGORIE_IDS, RHYTHMEN, vorschlagFuer } from './auto-daten.js';

const zahl = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const alsDatum = iso => new Date(`${iso}T12:00:00`);

export const runde = v => Math.round(zahl(v) * 100) / 100;

export function createKosten(vorlage = {}) {
  return {
    id: uid('ak'), datum: isoDatum(), art: 'Neue Ausgabe',
    betrag: 0, kategorie: 'sonstiges', ...vorlage,
  };
}

export function createLaufend(vorlage = {}) {
  return {
    id: uid('al'), art: 'Neue laufende Kosten', betrag: 0,
    rhythmus: 'monatlich', kategorie: 'fix', ...vorlage,
  };
}

export function createWartung(vorlage = {}) {
  return {
    id: uid('aw'), teil: 'Neue Position', km: null, datum: null,
    intervallKm: null, intervallJahre: null, ...vorlage,
  };
}

/* ------------------------------ Kosten ------------------------------ */

export function kostenAuswerten(auto, aktuellKm) {
  const liste = [...(auto?.kosten ?? [])].sort((a, b) =>
    String(b.datum).localeCompare(String(a.datum)));

  const gesamt = runde(liste.reduce((s, x) => s + zahl(x.betrag), 0));
  const anschaffung = runde(liste
    .filter(x => x.kategorie === 'anschaffung')
    .reduce((s, x) => s + zahl(x.betrag), 0));

  // Der Kaufpreis verzerrt die Kosten je Kilometer stark, solange man das
  // Auto noch nicht lange fährt. Deshalb ist er abwählbar.
  const laufend = runde(gesamt - anschaffung);
  const basis = auto?.kaufpreisMitrechnen === false ? laufend : gesamt;

  const gefahren = Math.max(0, Math.round(zahl(aktuellKm) - zahl(auto?.startKm)));

  const proKategorie = KATEGORIE_IDS
    .map(id => ({
      id,
      label: KATEGORIEN[id].label,
      farbe: KATEGORIEN[id].farbe,
      betrag: runde(liste.filter(x => x.kategorie === id).reduce((s, x) => s + zahl(x.betrag), 0)),
    }))
    .filter(x => x.betrag > 0)
    .sort((a, b) => b.betrag - a.betrag);

  // Monate seit dem ersten Beleg - daraus die Kosten je Monat.
  const daten = liste.map(x => x.datum).filter(Boolean).sort();
  let monate = null;
  if (daten.length) {
    const tage = (new Date(isoDatum()) - alsDatum(daten[0])) / 86400000;
    if (tage > 20) monate = tage / 30.44;
  }

  return {
    liste,
    gesamt,
    anschaffung,
    laufend,
    basis,
    gefahren,
    proKm: gefahren > 0 ? basis / gefahren : null,
    proMonat: monate ? basis / monate : null,
    proKategorie,
    monate,
  };
}

/* -------------------------- Laufende Kosten -------------------------- */

/**
 * Was das Auto Monat für Monat kostet, unabhängig davon, wann die Rechnung
 * kommt. Alles wird auf einen Monatswert umgerechnet.
 *
 * Bewusst getrennt von den Einzelausgaben: die eine Liste ist Vergangenheit
 * (was tatsächlich bezahlt wurde), die andere eine Vorausschau. Würde man
 * beides addieren, zählte man die Versicherung doppelt.
 */
export function laufendAuswerten(auto, spritProMonat = null) {
  const liste = [...(auto?.laufend ?? [])];

  const proMonat = runde(liste.reduce((s, x) => {
    const r = RHYTHMEN[x.rhythmus] ?? RHYTHMEN.monatlich;
    return s + (zahl(x.betrag) * r.proJahr) / 12;
  }, 0));

  const posten = liste.map(x => {
    const r = RHYTHMEN[x.rhythmus] ?? RHYTHMEN.monatlich;
    return { ...x, proMonat: runde((zahl(x.betrag) * r.proJahr) / 12), rhythmusLabel: r.label };
  }).sort((a, b) => b.proMonat - a.proMonat);

  // Ohne Klammer um Number(): Number(null) ist 0 und gilt als endlich -
  // dann stünde "0 € Sprit" da, wo noch gar nichts erfasst ist.
  const sprit = Number.isFinite(spritProMonat) ? runde(spritProMonat) : null;

  return {
    posten,
    proMonat,
    proJahr: runde(proMonat * 12),
    sprit,
    // Fixkosten plus Sprit: das ist die Zahl, die man im Kopf haben will.
    gesamtProMonat: sprit === null ? proMonat : runde(proMonat + sprit),
  };
}

/* ----------------------------- Wartung ----------------------------- */

export const WARTUNG_STATUS = {
  faellig: { label: 'Fällig', farbe: '#dc2626', rang: 0 },
  bald: { label: 'Bald fällig', farbe: '#d97706', rang: 1 },
  ok: { label: 'In Ordnung', farbe: '#16a34a', rang: 2 },
  offen: { label: 'Kein Intervall', farbe: '#64748b', rang: 3 },
};

// Vorwarnzeit: 2.000 km bzw. 60 Tage. Früh genug, um einen Termin zu
// bekommen, spät genug, dass nicht alles dauerhaft orange leuchtet.
const VORWARN_KM = 2000;
const VORWARN_TAGE = 60;

export function wartungAuswerten(auto, aktuellKm) {
  const heute = isoDatum();
  const km = zahl(aktuellKm);

  const liste = (auto?.wartung ?? []).map(w => {
    const hatKm = Number.isFinite(Number(w.km)) && zahl(w.km) > 0;
    const faelligKm = w.intervallKm && hatKm ? zahl(w.km) + zahl(w.intervallKm) : null;
    const restKm = faelligKm === null ? null : Math.round(faelligKm - km);

    let faelligAm = null;
    let restTage = null;
    if (w.intervallJahre && w.datum) {
      const d = alsDatum(w.datum);
      d.setFullYear(d.getFullYear() + Math.round(zahl(w.intervallJahre)));
      faelligAm = isoDatum(d);
      restTage = Math.round((d - alsDatum(heute)) / 86400000);
    }

    let status = 'offen';
    if (restKm !== null || restTage !== null) {
      const ueber = (restKm !== null && restKm <= 0) || (restTage !== null && restTage <= 0);
      const nah = (restKm !== null && restKm <= VORWARN_KM)
        || (restTage !== null && restTage <= VORWARN_TAGE);
      status = ueber ? 'faellig' : nah ? 'bald' : 'ok';
    }

    // Positionen ohne Intervall bekommen einen Vorschlag mit auf den Weg.
    const vorschlag = status === 'offen' ? vorschlagFuer(w.teil) : null;

    return { ...w, faelligKm, restKm, faelligAm, restTage, status, vorschlag };
  });

  // Was ansteht, zuerst; innerhalb der Gruppe das Dringendste oben.
  liste.sort((a, b) => {
    const r = WARTUNG_STATUS[a.status].rang - WARTUNG_STATUS[b.status].rang;
    if (r !== 0) return r;
    const ar = a.restKm ?? Infinity;
    const br = b.restKm ?? Infinity;
    if (ar !== br) return ar - br;
    return String(a.teil).localeCompare(String(b.teil), 'de');
  });

  return {
    liste,
    faellig: liste.filter(x => x.status === 'faellig'),
    bald: liste.filter(x => x.status === 'bald'),
  };
}

/* ------------------------- Alles zusammen ------------------------- */

/**
 * Der aktuelle Kilometerstand kommt entweder von Hand oder aus dem höchsten
 * Tachostand im Tanken-Tab. Letzteres erspart die doppelte Pflege.
 */
export function aktuellerKm(auto, tankEintraege = []) {
  if (auto?.kmQuelle !== 'tanken') return Math.round(zahl(auto?.aktuellKm));
  const hoechster = tankEintraege.reduce((m, e) => Math.max(m, zahl(e.tacho)), 0);
  return Math.round(hoechster > 0 ? hoechster : zahl(auto?.aktuellKm));
}

export function auswerten(auto, tankEintraege = [], spritProMonat = null) {
  const km = aktuellerKm(auto, tankEintraege);
  return {
    km,
    kosten: kostenAuswerten(auto, km),
    laufend: laufendAuswerten(auto, spritProMonat),
    wartung: wartungAuswerten(auto, km),
  };
}
