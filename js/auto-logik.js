// Rechnen rund ums Auto: Kosten je Kilometer und wann die nächste Wartung
// fällig ist. Ohne DOM, damit es sich für sich prüfen lässt.

import { isoDatum, uid } from './util.js';
import { KATEGORIEN, KATEGORIE_IDS, RHYTHMEN, vorschlagFuer,
  ADAC_PAUSCHALEN, REPARATUR_SCHWELLE_KM } from './auto-daten.js';

const zahl = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const alsDatum = iso => new Date(`${iso}T12:00:00`);

export const runde = v => Math.round(zahl(v) * 100) / 100;

export function createKosten(vorlage = {}) {
  return {
    id: uid('ak'), datum: isoDatum(), art: 'Neue Ausgabe',
    betrag: 0, kategorie: 'sonstiges', ...vorlage,
  };
}

export function createKmStand(vorlage = {}) {
  return { id: uid('km'), datum: isoDatum(), km: 0, notiz: '', ...vorlage };
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




/* --------------------------- Kilometerstände --------------------------- */

/**
 * Alle bekannten Kilometerstände auf einer Zeitachse: eigene Ablesungen und
 * die Tachostände aus den Tankfüllungen zusammengelegt.
 *
 * Doppelt pflegen soll niemand. Steht zu einem Datum beides, gewinnt die
 * eigene Ablesung - die ist ausdrücklich dafür eingetragen worden.
 */
export function kmVerlauf(auto, tankEintraege = []) {
  const punkte = new Map();

  for (const e of tankEintraege) {
    const km = zahl(e.tacho);
    if (!e.datum || km <= 0) continue;
    punkte.set(e.datum, { datum: e.datum, km, quelle: 'tanken' });
  }
  for (const s of auto?.kmStaende ?? []) {
    const km = zahl(s.km);
    if (!s.datum || km <= 0) continue;
    punkte.set(s.datum, { datum: s.datum, km, quelle: 'eigen', id: s.id, notiz: s.notiz ?? '' });
  }

  const liste = [...punkte.values()].sort((a, b) => a.datum.localeCompare(b.datum));

  // Abschnitte zwischen zwei Ablesungen - daraus ergibt sich, wie viel
  // zuletzt wirklich gefahren wurde.
  const abschnitte = [];
  for (let i = 1; i < liste.length; i++) {
    const tage = Math.round(
      (new Date(`${liste[i].datum}T12:00:00`) - new Date(`${liste[i - 1].datum}T12:00:00`)) / 86400000);
    const strecke = liste[i].km - liste[i - 1].km;
    if (tage <= 0 || strecke < 0) continue;
    abschnitte.push({ ...liste[i], tage, strecke, proTag: strecke / tage });
  }

  const gesamtTage = abschnitte.reduce((s2, a) => s2 + a.tage, 0);
  const gesamtKm = abschnitte.reduce((s2, a) => s2 + a.strecke, 0);
  const proTag = gesamtTage > 0 ? gesamtKm / gesamtTage : null;

  // Die letzten 12 Monate zählen mehr als der Schnitt über Jahre.
  const grenze = new Date();
  grenze.setFullYear(grenze.getFullYear() - 1);
  const letzte = abschnitte.filter(a => a.datum >= isoDatum(grenze));
  const letzteTage = letzte.reduce((s2, a) => s2 + a.tage, 0);
  const letzteKm = letzte.reduce((s2, a) => s2 + a.strecke, 0);

  return {
    liste,
    abschnitte,
    gesamtKm,
    gesamtTage,
    proMonat: proTag === null ? null : runde(proTag * 30.44),
    proJahr: proTag === null ? null : Math.round(proTag * 365.25),
    letzteProMonat: letzteTage > 0 ? runde((letzteKm / letzteTage) * 30.44) : null,
    hoechster: liste.length ? liste[liste.length - 1].km : null,
  };
}

/* ------------------------- Vollkostenrechnung ------------------------- */

/**
 * Was das Auto im Monat wirklich kostet - nach den Kostenarten der
 * ADAC-Autokostenberechnung.
 *
 * Zwei Dinge rechnet der ADAC anders, weil seine Methodik für Neuwagen
 * gedacht ist: Der Wertverlust kommt dort aus Gebrauchtwagennotierungen, hier
 * aus dem selbst geschätzten heutigen Wert. Und die Reparaturpauschale, die
 * der ADAC ab 80.000 km ansetzt, wird hier aus der eigenen Kostenhistorie
 * abgeleitet - die ist für genau dieses Auto aussagekräftiger als jeder
 * Durchschnittswert.
 */
export function vollkosten(auto, { spritProMonat = null, monate = null } = {}) {
  // Ohne Fahrzeug gibt es auch keine Pauschalen - sonst stuenden 37,50 Euro
  // Pflegekosten fuer ein Auto da, das gar nicht existiert.
  if (!auto) {
    return {
      bloecke: [], gesamt: 0, proJahr: 0, werkstatt: 0, werkstattVorschlag: null,
      werkstattHistorie: 0, pauschalen: 0, kaufpreis: 0, restwert: null,
      verlustGesamt: null, wertverlust: null, zinsen: 0, zinssatz: 0,
      monate: null, fehlt: [],
    };
  }
  const v = { ...(auto?.vollkosten ?? {}) };
  const laufend = laufendAuswerten(auto, spritProMonat);

  // Werkstattrücklage aus der Historie: was bisher für Wartung und
  // Reparatur ausgegeben wurde, auf den Monat gerechnet.
  const historie = (auto?.kosten ?? [])
    .filter(k => k.kategorie === 'wartung' || k.kategorie === 'reparatur')
    .reduce((s, k) => s + zahl(k.betrag), 0);
  const werkstattVorschlag = monate && monate > 0 ? runde(historie / monate) : null;

  const werkstatt = v.werkstattQuelle === 'manuell'
    ? runde(v.werkstattProMonat)
    : (werkstattVorschlag ?? 0);

  // Pauschalen für das, was man selbst nie aufschreibt.
  const pauschalen = v.pauschalenAn === false
    ? 0
    : runde((ADAC_PAUSCHALEN.allgemein.proJahr + ADAC_PAUSCHALEN.pflege.proJahr) / 12);

  // Wertverlust: Kaufpreis minus heutiger Schätzwert, auf die bisherige
  // Haltedauer verteilt.
  const kaufpreis = runde((auto?.kosten ?? [])
    .filter(k => k.kategorie === 'anschaffung')
    .reduce((s, k) => s + zahl(k.betrag), 0));
  // Number.isFinite OHNE Number() davor: Number(null) waere 0 und wuerde als
  // "Auto ist nichts mehr wert" gelesen statt als "noch nicht geschaetzt".
  const restwert = Number.isFinite(v.restwert) && v.restwert >= 0
    ? runde(v.restwert) : null;
  const verlustGesamt = restwert === null ? null : runde(Math.max(0, kaufpreis - restwert));
  const wertverlust = verlustGesamt === null || !monate || monate <= 0
    ? null : runde(verlustGesamt / monate);

  // Kalkulatorische Zinsen: der ADAC lässt sie bewusst weg, empfiehlt aber,
  // sie mitzurechnen, wenn das Geld aus Erspartem oder vom Kredit kam.
  const satz = Math.max(0, zahl(v.zinssatz));
  const gebunden = restwert === null ? kaufpreis : restwert;
  const zinsen = satz > 0 ? runde((gebunden * (satz / 100)) / 12) : 0;

  const bloecke = [
    { id: 'fix', label: 'Versicherung, Steuer & Co.', wert: laufend.proMonat, farbe: KATEGORIEN.fix.farbe },
    { id: 'sprit', label: 'Sprit', wert: laufend.sprit ?? 0, farbe: '#d97706' },
    { id: 'werkstatt', label: 'Werkstattrücklage', wert: werkstatt, farbe: KATEGORIEN.wartung.farbe },
    { id: 'pauschalen', label: 'Pflege & Kleinkram', wert: pauschalen, farbe: KATEGORIEN.sonstiges.farbe },
    { id: 'wertverlust', label: 'Wertverlust', wert: wertverlust ?? 0, farbe: KATEGORIEN.anschaffung.farbe },
    { id: 'zinsen', label: 'Entgangene Zinsen', wert: zinsen, farbe: '#0891b2' },
  ].filter(b => b.wert > 0);

  const gesamt = runde(bloecke.reduce((s, b) => s + b.wert, 0));

  return {
    bloecke,
    gesamt,
    proJahr: runde(gesamt * 12),
    werkstatt,
    werkstattVorschlag,
    werkstattHistorie: runde(historie),
    pauschalen,
    kaufpreis,
    restwert,
    verlustGesamt,
    wertverlust,
    zinsen,
    zinssatz: satz,
    monate,
    // Offene Punkte, die das Ergebnis verfälschen, wenn man sie ignoriert.
    fehlt: [
      restwert === null ? 'restwert' : null,
      laufend.sprit === null ? 'sprit' : null,
      laufend.proMonat === 0 ? 'fix' : null,
    ].filter(Boolean),
  };
}

export function auswerten(auto, tankEintraege = [], spritProMonat = null) {
  const verlauf = kmVerlauf(auto, tankEintraege);
  // Der höchste bekannte Stand schlägt den von Hand gepflegten Wert, wenn er
  // neuer ist - sonst rechnet die Wartung mit veralteten Kilometern.
  const km = Math.max(aktuellerKm(auto, tankEintraege), verlauf.hoechster ?? 0);
  const kosten = kostenAuswerten(auto, km);
  return {
    km,
    verlauf,
    kosten,
    laufend: laufendAuswerten(auto, spritProMonat),
    wartung: wartungAuswerten(auto, km),
    voll: vollkosten(auto, { spritProMonat, monate: kosten.monate }),
  };
}
