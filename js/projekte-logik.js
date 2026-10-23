// Terminrechnung für die Projektplanung.
//
// Der Kern: eine Aufgabe hat eine Dauer und folgt auf eine andere. Daraus
// ergeben sich alle Termine von selbst - verschiebt sich vorne etwas, wandert
// der ganze Rattenschwanz mit. Deshalb werden Start- und Enddaten nie
// gespeichert, sondern bei jeder Anzeige neu gerechnet.

import { isoDatum, uid } from './util.js';

const zahl = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Mittags rechnen, dann kippt keine Zeitumstellung das Datum.
const alsDatum = iso => new Date(`${iso}T12:00:00`);

export const istWerktag = d => d.getDay() !== 0 && d.getDay() !== 6;

export function datumPlus(iso, tage) {
  const d = alsDatum(iso);
  d.setDate(d.getDate() + tage);
  return isoDatum(d);
}

export function naechsterWerktag(iso) {
  const d = alsDatum(iso);
  while (!istWerktag(d)) d.setDate(d.getDate() + 1);
  return isoDatum(d);
}

// n Kalender- oder Arbeitstage weiter.
export function tagePlus(iso, tage, nurWerktage) {
  if (!nurWerktage) return datumPlus(iso, tage);
  const d = alsDatum(iso);
  let rest = tage;
  while (rest > 0) {
    d.setDate(d.getDate() + 1);
    if (istWerktag(d)) rest -= 1;
  }
  return isoDatum(d);
}

export function tageZwischen(von, bis) {
  return Math.round((alsDatum(bis) - alsDatum(von)) / 86400000);
}

export const STATUS = {
  offen: { label: 'Offen', farbe: '#94a3b8' },
  laeuft: { label: 'Läuft', farbe: '#2f6feb' },
  fertig: { label: 'Fertig', farbe: '#16a34a' },
};

export function statusVon(aufgabe) {
  const f = zahl(aufgabe.fortschritt);
  if (f >= 100) return 'fertig';
  if (f > 0) return 'laeuft';
  return 'offen';
}

export function createAufgabe(vorlage = {}) {
  return {
    id: uid('ag'),
    name: 'Neue Aufgabe',
    dauer: 3,
    nach: null,        // id der Vorgängeraufgabe
    fest: null,        // festes Startdatum, schlägt den Vorgänger
    fortschritt: 0,
    person: '',
    ...vorlage,
  };
}

export function createProjekt(name = 'Neues Projekt') {
  const a = createAufgabe({ name: 'Planung', dauer: 3 });
  const b = createAufgabe({ name: 'Umsetzung', dauer: 10, nach: a.id });
  const c = createAufgabe({ name: 'Abnahme', dauer: 2, nach: b.id });
  return {
    id: uid('pr'),
    name,
    start: isoDatum(),
    nurWerktage: true,
    notiz: '',
    aufgaben: [a, b, c],
  };
}

/**
 * Alle Termine aus Dauer und Reihenfolge rechnen.
 *
 * Reihenfolge über Kahn: wer keinen offenen Vorgänger mehr hat, kann geplant
 * werden. Was am Ende übrig bleibt, hängt in einem Ring - das wird gemeldet
 * statt die Schleife ewig laufen zu lassen.
 */
export function planen(projekt) {
  const roh = projekt?.aufgaben ?? [];
  const bekannt = new Set(roh.map(a => a.id));
  const start = projekt?.start || isoDatum();
  const nurWerktage = Boolean(projekt?.nurWerktage);

  // Ein Vorgänger, den es nicht mehr gibt, wird wie keiner behandelt.
  const aufgaben = roh.map(a => ({
    ...a,
    nach: a.nach && bekannt.has(a.nach) && a.nach !== a.id ? a.nach : null,
  }));
  const nachId = new Map(aufgaben.map(a => [a.id, a]));

  const offeneVorgaenger = new Map(aufgaben.map(a => [a.id, a.nach ? 1 : 0]));
  const nachfolger = new Map(aufgaben.map(a => [a.id, []]));
  for (const a of aufgaben) if (a.nach) nachfolger.get(a.nach).push(a.id);

  const schlange = aufgaben.filter(a => !a.nach).map(a => a.id);
  const geplant = new Map();
  const reihenfolge = [];

  while (schlange.length) {
    const id = schlange.shift();
    const a = nachId.get(id);
    const vor = a.nach ? geplant.get(a.nach) : null;

    let beginn = vor ? tagePlus(vor.ende, 1, nurWerktage) : start;
    // Ein festes Datum gewinnt, zieht den Start aber nie vor das Projekt.
    if (a.fest && a.fest > beginn) beginn = a.fest;
    if (nurWerktage) beginn = naechsterWerktag(beginn);

    const dauer = Math.max(1, Math.round(zahl(a.dauer)) || 1);
    const ende = tagePlus(beginn, dauer - 1, nurWerktage);

    const fertig = { ...a, dauer, start: beginn, ende, status: statusVon(a) };
    geplant.set(id, fertig);
    reihenfolge.push(fertig);

    for (const n of nachfolger.get(id)) {
      offeneVorgaenger.set(n, offeneVorgaenger.get(n) - 1);
      if (offeneVorgaenger.get(n) === 0) schlange.push(n);
    }
  }

  const imRing = aufgaben.filter(a => !geplant.has(a.id)).map(a => a.name);

  const alle = reihenfolge;
  const projektStart = alle.length ? alle.reduce((m, a) => (a.start < m ? a.start : m), alle[0].start) : start;
  const projektEnde = alle.length ? alle.reduce((m, a) => (a.ende > m ? a.ende : m), alle[0].ende) : start;

  // Fortschritt nach Dauer gewichtet: eine zehntägige Aufgabe zählt mehr als
  // eine eintägige, sonst täuscht das Abhaken von Kleinkram Fortschritt vor.
  const gewicht = alle.reduce((s, a) => s + a.dauer, 0);
  const erledigt = alle.reduce((s, a) => s + a.dauer * Math.min(100, Math.max(0, zahl(a.fortschritt))) / 100, 0);

  const heute = isoDatum();
  const ueberfaellig = alle.filter(a => a.ende < heute && a.status !== 'fertig');

  return {
    aufgaben: alle,
    imRing,
    start: projektStart,
    ende: projektEnde,
    tage: alle.length ? tageZwischen(projektStart, projektEnde) + 1 : 0,
    arbeitstage: alle.reduce((s, a) => s + a.dauer, 0),
    fortschritt: gewicht ? Math.round((erledigt / gewicht) * 100) : 0,
    ueberfaellig,
    heute,
    nurWerktage,
  };
}

// Wer darf Vorgänger sein? Alles, was nicht auf einem Weg zurück zu mir führt -
// sonst baut man sich mit zwei Klicks einen Ring.
export function moeglicheVorgaenger(aufgaben, id) {
  const nachId = new Map(aufgaben.map(a => [a.id, a]));
  const verboten = new Set([id]);

  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (const a of aufgaben) {
      if (!verboten.has(a.id) && a.nach && verboten.has(a.nach)) {
        verboten.add(a.id);
        gewachsen = true;
      }
    }
  }
  return aufgaben.filter(a => !verboten.has(a.id)).map(a => nachId.get(a.id));
}
