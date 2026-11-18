// Die gesammelten Daten des VW Touran als Startbestand.
//
// Übernommen aus der bisherigen Tabelle. Alles davon lässt sich in der App
// ändern, ergänzen und löschen - das hier ist nur der Ausgangspunkt, damit
// nichts neu eingetippt werden muss.

export const KATEGORIEN = {
  anschaffung: { label: 'Anschaffung', farbe: '#7c3aed' },
  fix: { label: 'Steuer & Versicherung', farbe: '#2f6feb' },
  wartung: { label: 'Wartung', farbe: '#0d9488' },
  reparatur: { label: 'Reparatur', farbe: '#dc2626' },
  zubehoer: { label: 'Zubehör', farbe: '#d97706' },
  sonstiges: { label: 'Sonstiges', farbe: '#64748b' },
};

export const KATEGORIE_IDS = Object.keys(KATEGORIEN);

const k = (datum, art, betrag, kategorie) => ({ datum, art, betrag, kategorie });

export const SEED_KOSTEN = [
  k('2024-12-03', 'Kauf des Autos', 4300, 'anschaffung'),
  k('2024-12-20', 'Zulassung', 120, 'anschaffung'),
  k('2024-12-31', 'KFZ-Steuer', 304, 'fix'),
  k('2025-01-01', 'Versicherung (inkl. 250 Youngdriver)', 1203.33, 'fix'),
  k('2025-01-22', 'Inspektion mit Öl', 515.5, 'wartung'),
  k('2025-01-30', 'Neue Reifen', 383.88, 'wartung'),
  k('2025-03-06', 'Gasdruckdämpfer', 17.39, 'reparatur'),
  k('2025-03-09', 'Parksensor', 15.99, 'reparatur'),
  k('2025-03-26', 'Bluetooth-Adapter', 46.9, 'zubehoer'),
  k('2025-03-26', 'Antennen-Adapter', 12.99, 'zubehoer'),
  k('2025-10-16', 'Standlicht W5W 12V 5W', 3.95, 'reparatur'),
  k('2025-11-13', 'Gummimatten', 31, 'zubehoer'),
  k('2025-11-14', 'Innenraumfilter', 7.57, 'wartung'),
  k('2026-11-17', 'TÜV bis 2027', 175, 'fix'),
  k('2025-01-01', 'Versicherung (inkl. 250 Youngdriver)', 1600.33, 'fix'),
  k('2026-04-04', 'Ölwechsel', 51.72, 'wartung'),
  k('2026-11-04', 'Umrüstung auf LED', 170.89, 'zubehoer'),
];

// intervallKm / intervallJahre: null heißt "kein festes Intervall bekannt" -
// dann merkt sich die App nur, wann es zuletzt gemacht wurde.
const w = (teil, km, datum, intervallKm = null, intervallJahre = null) =>
  ({ teil, km, datum, intervallKm, intervallJahre });

export const SEED_WARTUNG = [
  w('Innenraumfilter', 201192, '2025-11-14', 30000),
  w('Intervallservice QG1', 195587, '2025-01-22'),
  w('Intervallservice QG0/1', null, null),
  w('Inspektionsservice', 195587, '2025-01-22'),
  w('Bremsflüssigkeitswechsel', 195587, '2025-01-22', null, 2),
  w('Long-Life-Motoröl', 195587, '2025-01-22', 10000),
  w('DSG-Öl und Filter', 174485, '2022-10-12'),
  w('Kraftstofffilter', 153200, '2020-09-18'),
  w('Reifenfüllflasche', 46757, '2013-09-17'),
  w('Luftfiltereinsatz', 153200, '2020-09-18'),
  w('Zahnriemen', 153200, '2020-09-18', 150000),
];

export const SEED_AUTO = {
  name: 'VW Touran',
  hsn: '0603',
  tsn: 'ABL00114X',
  startKm: 195286,
  // Der aktuelle Stand kann aus den Tankfüllungen kommen - dann muss er
  // nicht zweimal gepflegt werden.
  kmQuelle: 'manuell',
  aktuellKm: 201495,
  kaufpreisMitrechnen: true,
};

/* ----------------------- Intervall-Vorschläge ----------------------- */

// Übliche VW-Werte als Starthilfe für Positionen, bei denen in der Tabelle
// kein Intervall stand. Das sind Richtwerte, keine Zusage: was für dieses
// Fahrzeug gilt, steht im Serviceplan und hängt an Motor und Getriebe.
//
// Dass hier LongLife (QG1) angenommen wird, steht so in der übernommenen
// Tabelle - "Intervallservice QG1" ist der VW-Code dafür.
export const INTERVALL_VORSCHLAEGE = {
  'Intervallservice QG1': {
    km: 30000, jahre: 2,
    hinweis: 'LongLife: bis 30.000 km oder 2 Jahre, je nachdem was zuerst kommt. '
      + 'Das Auto meldet sich selbst, wenn es früher so weit ist.',
  },
  'Intervallservice QG0/1': {
    km: 15000, jahre: 1,
    hinweis: 'Fester Service (QG0): jährlich oder alle 15.000 km. Gilt nur, '
      + 'wenn nicht auf LongLife gefahren wird.',
  },
  Inspektionsservice: {
    km: 30000, jahre: 2,
    hinweis: 'Bei LongLife alle 2 Jahre, bei festem Intervall jährlich.',
  },
  'DSG-Öl und Filter': {
    km: 60000, jahre: null,
    hinweis: 'Gilt für das DSG mit nasser Kupplung (DQ250, 6-Gang). Das '
      + 'trockene 7-Gang-DSG (DQ200) hat eine Lebensdauerfüllung. Welches '
      + 'verbaut ist, sagt dir die Werkstatt.',
  },
  Kraftstofffilter: {
    km: 60000, jahre: null,
    hinweis: 'Üblich beim Diesel. Benziner haben meist keinen Wechselfilter.',
  },
  Luftfiltereinsatz: {
    km: 60000, jahre: null,
    hinweis: 'Bei viel Staub oder Kurzstrecke eher früher.',
  },
  Reifenfüllflasche: {
    km: null, jahre: 5,
    hinweis: 'Das Dichtmittel läuft ab. Das Datum steht auf der Flasche selbst.',
  },
  Zahnriemen: {
    km: 180000, jahre: null,
    hinweis: 'Je nach Motor 180.000 bis 210.000 km. Deine eingetragenen '
      + '150.000 km sind die vorsichtigere Variante – dabei zu bleiben '
      + 'schadet nicht. Manche Motoren haben zusätzlich eine Altersgrenze.',
  },
  Bremsflüssigkeitswechsel: {
    km: null, jahre: 2,
    hinweis: 'Erstmals nach 3 Jahren, danach alle 2 Jahre.',
  },
  Innenraumfilter: {
    km: 30000, jahre: 2,
    hinweis: 'Bei Allergie oder Stadtverkehr gern jährlich.',
  },
};

export const vorschlagFuer = teil => INTERVALL_VORSCHLAEGE[String(teil ?? '').trim()] ?? null;

/* -------------------------- Laufende Kosten -------------------------- */

export const RHYTHMEN = {
  monatlich: { label: 'monatlich', proJahr: 12 },
  vierteljaehrlich: { label: 'vierteljährlich', proJahr: 4 },
  halbjaehrlich: { label: 'halbjährlich', proJahr: 2 },
  jaehrlich: { label: 'jährlich', proJahr: 1 },
};

export const RHYTHMUS_IDS = Object.keys(RHYTHMEN);

// Aus der Tabelle ableitbar: Versicherung und Steuer laufen weiter.
export const SEED_LAUFEND = [
  { art: 'Versicherung', betrag: 1600.33, rhythmus: 'jaehrlich', kategorie: 'fix' },
  { art: 'KFZ-Steuer', betrag: 304, rhythmus: 'jaehrlich', kategorie: 'fix' },
];

/* ------------------------- Vollkostenrechnung ------------------------- */

// Pauschalen aus den Grundlagen der ADAC-Autokostenberechnung (Stand 10/2026,
// "Berechnungsgrundlagen für die standardisierte Autokostenberechnung").
// Sie decken Posten ab, die man selbst selten aufschreibt.
export const ADAC_PAUSCHALEN = {
  allgemein: {
    proJahr: 200,
    label: 'Allgemeine Kosten',
    text: 'Parkgebühren, Kleinzubehör, HU/AU und Ähnliches',
  },
  pflege: {
    proJahr: 250,
    label: 'Wagenwäsche und Pflege',
    text: 'Waschanlage, Pflegemittel',
  },
};

export const ADAC_QUELLE = 'ADAC-Autokostenberechnung, Grundlagen Stand 10/2026';

// Der ADAC setzt ab über drei Jahren Haltedauer oder ab 80.000 km
// Gesamtlaufleistung zusätzlich eine Reparaturkostenpauschale an. Welche
// Höhe, steht nicht im Grundlagenpapier - deshalb wird sie hier nicht
// geraten, sondern aus der eigenen Kostenhistorie abgeleitet.
export const REPARATUR_SCHWELLE_KM = 80000;

export const VOLLKOSTEN_VORGABE = {
  werkstattQuelle: 'historie',
  werkstattProMonat: 0,
  restwert: null,
  pauschalenAn: true,
  zinssatz: 0,
};
