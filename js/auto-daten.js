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
