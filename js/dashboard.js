// Startseite: eine Kachel je Bereich, jeweils mit der Zahl, die dort zählt.
// Soll die Frage beantworten „wo will ich gerade hin" statt nur zu verlinken.

import { el, money, clear } from './util.js';
import { symbolSvg, wortmarke } from './logo.js';
import { netWorth } from './accounts.js';
import { berechne } from './immobilien.js';
import { auswerten } from './tanken.js';
import { SEED_GERICHTE } from './gerichte-daten.js';
import { HUB_ID } from './store.js';

const dezimal = (v, stellen = 2) =>
  v === null || !Number.isFinite(v) ? '–' : v.toLocaleString('de-DE', {
    minimumFractionDigits: stellen, maximumFractionDigits: stellen,
  });

function kennzahlen(data) {
  const einnahmen = data.sankey.flows
    .filter(f => f.to === HUB_ID)
    .reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const ausgaben = data.sankey.flows
    .filter(f => f.from === HUB_ID)
    .reduce((s, f) => s + (Number(f.amount) || 0), 0);

  const objekte = data.immobilien.items;
  const aktiv = objekte.find(o => o.id === data.immobilien.activeId) ?? objekte[0];
  const immo = aktiv ? berechne(aktiv) : null;

  const tank = auswerten(data.tanken.eintraege, { fixkosten: data.tanken.fixkosten });

  return {
    flow: {
      wert: money(Math.round(einnahmen - ausgaben)),
      zusatz: `${money(Math.round(einnahmen))} rein, ${money(Math.round(ausgaben))} raus`,
    },
    konten: {
      wert: money(Math.round(netWorth(data.accounts))),
      zusatz: `${data.accounts.nodes.length} Konten`,
    },
    immobilien: {
      wert: immo ? `${money(Math.round(immo.cashflowNach / 12))} / Monat` : '–',
      zusatz: objekte.length === 1 ? `${objekte.length} Objekt` : `${objekte.length} Objekte`,
    },
    gerichte: {
      wert: `${data.gerichte.favoriten.length} gemerkt`,
      zusatz: `${SEED_GERICHTE.length} Gerichte in der Sammlung`,
    },
    tanken: {
      wert: tank.verbrauch === null ? '–' : `${dezimal(tank.verbrauch)} l`,
      zusatz: tank.zeilen.length
        ? `je 100 km · ${tank.summeKm.toLocaleString('de-DE')} km erfasst`
        : 'noch keine Tankfüllung',
    },
  };
}

const BEREICHE = [
  { tab: 'flow', symbol: 'flow', titel: 'Geldfluss', text: 'Wohin dein Geld jeden Monat fließt, als Sankey-Diagramm.', kennzahl: 'flow' },
  { tab: 'accounts', symbol: 'konten', titel: 'Konten', text: 'Deine Konten, ihre Stände und die Umbuchungen dazwischen.', kennzahl: 'konten' },
  { tab: 'immo', symbol: 'immobilien', titel: 'Immobilien', text: 'Rendite, Finanzierung und Cashflow einer Kapitalanlage.', kennzahl: 'immobilien' },
  { tab: 'gerichte', symbol: 'gerichte', titel: 'Gerichte', text: 'Günstig und eiweißreich kochen, mit Preis und Aufwand je Portion.', kennzahl: 'gerichte' },
  { tab: 'tanken', symbol: 'tanken', titel: 'Tanken', text: 'Verbrauch und Spritkosten über alle Tankfüllungen.', kennzahl: 'tanken' },
];

export function createDashboard({ host, store, onOeffne }) {
  function renderAll() {
    clear(host);

    const kopf = el('div', { class: 'dash-kopf' });
    kopf.appendChild(wortmarke({ size: 44 }));
    kopf.appendChild(el('p', { class: 'dash-text' },
      'Alles an einem Ort. Such dir aus, womit du anfangen willst.'));
    host.appendChild(kopf);

    const zahlen = kennzahlen(store.data);
    const gitter = el('div', { class: 'dash-gitter' });

    for (const b of BEREICHE) {
      const karte = el('button', { type: 'button', class: 'dash-karte' });
      const z = zahlen[b.kennzahl];

      const oben = el('div', { class: 'dash-oben' });
      const symbol = el('span', { class: `dash-symbol dash-${b.tab}` });
      symbol.appendChild(symbolSvg(b.symbol, { size: 24 }));
      oben.append(symbol, el('h3', {}, b.titel));

      const wert = el('div', { class: 'dash-wert' });
      wert.append(el('strong', {}, z.wert), el('span', {}, z.zusatz));

      karte.append(oben, el('p', { class: 'dash-karte-text' }, b.text), wert);
      karte.addEventListener('click', () => onOeffne(b.tab));
      gitter.appendChild(karte);
    }

    host.appendChild(gitter);
  }

  return { renderAll };
}
