// Rezepttext zerlegen und Zutatenmengen zusammenrechnen.
//
// Eingefügter Text ist erstaunlich gut strukturiert: Überschriften wie
// "Zutaten" trennen die Abschnitte, Mengenangaben stehen am Zeilenanfang,
// Schritte sind ganze Sätze. Dafür reichen Regeln.

const EINHEITEN = {
  g: 'g', gramm: 'g', kg: 'kg', mg: 'mg',
  ml: 'ml', l: 'l', liter: 'l',
  el: 'EL', esslöffel: 'EL', esslöffeln: 'EL',
  tl: 'TL', teelöffel: 'TL', teelöffeln: 'TL',
  stück: 'Stück', stk: 'Stück', st: 'Stück',
  dose: 'Dose', dosen: 'Dose', packung: 'Packung', packungen: 'Packung',
  bund: 'Bund', prise: 'Prise', prisen: 'Prise',
  scheibe: 'Scheibe', scheiben: 'Scheibe',
  zehe: 'Zehe', zehen: 'Zehe', becher: 'Becher', tasse: 'Tasse', tassen: 'Tasse',
};

const BRUECHE = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

const ZUTATEN_MARKE = /^\s*(zutaten|einkaufsliste|du brauchst|ingredients)\s*:?\s*$/i;
const SCHRITT_MARKE = /^\s*(zubereitung|anleitung|schritte|so geht'?s|zubereiten|instructions)\s*:?\s*$/i;
const NAEHRWERT_MARKE = /^\s*(n(ä|ae)hrwerte|pro portion|kalorien)\s*:?/i;

// "250 g Magerquark" -> { menge: 250, einheit: 'g', name: 'Magerquark' }
export function zutatZerlegen(zeile) {
  const roh = String(zeile ?? '').replace(/^[-–•*\s]+/, '').trim();
  if (!roh) return null;

  // "1/2" kommt in Rezepten genauso oft vor wie "½".
  const treffer = roh.match(
    /^(\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔])\s*([a-zA-ZäöüÄÖÜ]+\.?)?\s+(.{2,})$/,
  );
  if (!treffer) return { menge: null, einheit: '', name: roh, roh };

  const mengeText = treffer[1];
  const bruch = mengeText.match(/^(\d+)\/(\d+)$/);
  const menge = bruch
    ? Number(bruch[1]) / Number(bruch[2])
    : BRUECHE[mengeText] ?? Number(mengeText.replace(',', '.'));
  const wort = (treffer[2] ?? '').replace(/\.$/, '').toLowerCase();
  const einheit = EINHEITEN[wort] ?? '';
  // War das zweite Wort keine Einheit, gehört es zum Namen.
  const name = einheit ? treffer[3].trim() : `${treffer[2] ?? ''} ${treffer[3]}`.trim();

  if (!Number.isFinite(menge) || !name) return { menge: null, einheit: '', name: roh, roh };
  return { menge, einheit, name, roh };
}

// Zutaten aus mehreren Gerichten und Portionen zu einer Einkaufsliste bündeln.
export function einkaufsliste(posten) {
  const gebuendelt = new Map();

  for (const { zutaten, faktor } of posten) {
    for (const zeile of zutaten ?? []) {
      const z = zutatZerlegen(zeile);
      if (!z) continue;
      const schluessel = `${z.name.toLowerCase()}|${z.einheit}`;
      if (!gebuendelt.has(schluessel)) {
        gebuendelt.set(schluessel, { name: z.name, einheit: z.einheit, menge: 0, ohneMenge: 0 });
      }
      const eintrag = gebuendelt.get(schluessel);
      // Zeilen ohne Zahl ("Salz, Pfeffer") werden gezählt statt addiert.
      if (z.menge === null) eintrag.ohneMenge += 1;
      else eintrag.menge += z.menge * faktor;
    }
  }

  return [...gebuendelt.values()]
    .map(e => ({
      ...e,
      // Krumme Mengen sind beim Einkaufen unbrauchbar.
      menge: e.menge > 0 ? Math.round(e.menge * 100) / 100 : 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export function mengeText(eintrag) {
  if (eintrag.menge > 0) {
    const zahl = eintrag.menge.toLocaleString('de-DE', { maximumFractionDigits: 2 });
    return eintrag.einheit ? `${zahl} ${eintrag.einheit}` : `${zahl} ×`;
  }
  return eintrag.ohneMenge > 1 ? `${eintrag.ohneMenge} ×` : '';
}

/* ----------------------- Rezept aus Text lesen ----------------------- */

const beginntMitMenge = zeile => /^\s*[-–•*]?\s*(\d|[½¼¾⅓⅔])/.test(zeile);
const istSchrittnummer = zeile => /^\s*\d{1,2}[.)]\s+\S/.test(zeile);

export function leseRezept(text) {
  const zeilen = String(text ?? '')
    .split(/\r?\n/)
    .map(z => z.trim())
    .filter(Boolean);

  if (!zeilen.length) return { name: '', zutaten: [], schritte: [], erfolg: false };

  const zutaten = [];
  const schritte = [];
  let name = '';
  let abschnitt = 'unbekannt';

  for (const zeile of zeilen) {
    if (ZUTATEN_MARKE.test(zeile)) { abschnitt = 'zutaten'; continue; }
    if (SCHRITT_MARKE.test(zeile)) { abschnitt = 'schritte'; continue; }
    if (NAEHRWERT_MARKE.test(zeile)) { abschnitt = 'egal'; continue; }
    if (abschnitt === 'egal') continue;

    // Nummerierte Zeilen sind Schritte, auch ohne Überschrift davor.
    if (istSchrittnummer(zeile)) {
      schritte.push(zeile.replace(/^\s*\d{1,2}[.)]\s*/, ''));
      abschnitt = 'schritte';
      continue;
    }

    if (abschnitt === 'zutaten') { zutaten.push(zeile.replace(/^[-–•*]\s*/, '')); continue; }
    if (abschnitt === 'schritte') { schritte.push(zeile.replace(/^[-–•*]\s*/, '')); continue; }

    // Noch keine Überschrift gesehen: erste kurze Zeile ist der Name,
    // danach entscheiden Mengenangabe und Länge.
    if (!name && zeile.length <= 70 && !beginntMitMenge(zeile)) { name = zeile; continue; }
    if (beginntMitMenge(zeile) && zeile.length <= 60) zutaten.push(zeile.replace(/^[-–•*]\s*/, ''));
    else if (zeile.length > 30) schritte.push(zeile.replace(/^[-–•*]\s*/, ''));
    else zutaten.push(zeile.replace(/^[-–•*]\s*/, ''));
  }

  return {
    name,
    zutaten,
    schritte,
    erfolg: Boolean(name || zutaten.length || schritte.length),
  };
}
