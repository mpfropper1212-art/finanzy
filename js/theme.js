// Hell, dunkel oder dem Gerät folgen. Die Wahl gehört zum Gerät, nicht zum
// Konto - deshalb localStorage und nicht der Datensatz in der Cloud.

const SCHLUESSEL = 'finanzsankey.theme';

export const MODI = {
  system: { label: 'Folgt dem Gerät', symbol: 'system' },
  hell: { label: 'Immer hell', symbol: 'hell' },
  dunkel: { label: 'Immer dunkel', symbol: 'dunkel' },
};

export function aktuellerModus() {
  try {
    const wert = localStorage.getItem(SCHLUESSEL);
    return MODI[wert] ? wert : 'system';
  } catch {
    return 'system';
  }
}

export function setzeModus(modus) {
  const gueltig = MODI[modus] ? modus : 'system';
  try {
    if (gueltig === 'system') localStorage.removeItem(SCHLUESSEL);
    else localStorage.setItem(SCHLUESSEL, gueltig);
  } catch { /* privater Modus - dann gilt die Wahl nur für diese Sitzung */ }
  anwenden(gueltig);
  return gueltig;
}

export function anwenden(modus = aktuellerModus()) {
  const wurzel = document.documentElement;
  if (modus === 'hell') wurzel.dataset.theme = 'light';
  else if (modus === 'dunkel') wurzel.dataset.theme = 'dark';
  else delete wurzel.dataset.theme;
}

export function naechsterModus(modus = aktuellerModus()) {
  const reihe = ['system', 'hell', 'dunkel'];
  return reihe[(reihe.indexOf(modus) + 1) % reihe.length];
}
