// Startseite: erst der Monat in einer Zeile, dann die Bereiche.
// Soll beantworten "wie stehe ich gerade" und danach "wo will ich hin".

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

function monatszahlen(data) {
  const summe = fn => data.sankey.flows.filter(fn).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const einnahmen = summe(f => f.to === HUB_ID);
  const ausgaben = summe(f => f.from === HUB_ID);
  return { einnahmen, ausgaben, rest: einnahmen - ausgaben };
}

function kennzahlen(data) {
  const objekte = data.immobilien.items;
  const aktiv = objekte.find(o => o.id === data.immobilien.activeId) ?? objekte[0];
  const immo = aktiv ? berechne(aktiv) : null;
  const tank = auswerten(data.tanken.eintraege, { fixkosten: data.tanken.fixkosten });
  const m = monatszahlen(data);

  return {
    flow: {
      wert: money(Math.round(m.rest)),
      zusatz: `${money(Math.round(m.einnahmen))} rein, ${money(Math.round(m.ausgaben))} raus`,
    },
    konten: {
      wert: money(Math.round(netWorth(data.accounts))),
      zusatz: `${data.accounts.nodes.length} Konten`,
    },
    immobilien: {
      wert: immo ? `${money(Math.round(immo.cashflowNach / 12))} / Monat` : '–',
      zusatz: objekte.length === 1 ? '1 Objekt' : `${objekte.length} Objekte`,
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
  // Ein Balken, der zeigt, wie viel der Einnahmen die Ausgaben auffressen.
  function monatsbalken(m) {
    const balken = el('div', { class: 'monat-balken' });
    if (m.einnahmen <= 0) {
      balken.appendChild(el('span', { class: 'monat-leer' }));
      return balken;
    }
    const anteil = Math.min(100, (m.ausgaben / m.einnahmen) * 100);
    balken.appendChild(el('span', {
      class: 'monat-ausgaben' + (m.rest < 0 ? ' ist-zuviel' : ''),
      style: `width:${anteil}%`,
    }));
    return balken;
  }

  function monatsblock(m) {
    const box = el('section', { class: 'monat' });
    box.appendChild(el('h2', { class: 'monat-titel' }, store.data.sankey.title || 'Dein Monat'));

    const zahlen = el('div', { class: 'monat-zahlen' });
    const posten = (label, wert, klasse) => {
      const p = el('div', { class: `monat-posten${klasse ? ' ' + klasse : ''}` });
      p.append(el('span', { class: 'monat-label' }, label), el('strong', {}, money(Math.round(wert))));
      return p;
    };
    zahlen.append(
      posten('Einnahmen', m.einnahmen),
      posten('Ausgaben', m.ausgaben),
      posten(m.rest < 0 ? 'Fehlt' : 'Bleibt übrig', Math.abs(m.rest),
        m.rest < 0 ? 'ist-minus' : 'ist-plus'),
    );
    box.append(zahlen, monatsbalken(m));

    const quote = m.einnahmen > 0 ? (m.rest / m.einnahmen) * 100 : null;
    box.appendChild(el('p', { class: 'monat-hinweis' },
      quote === null
        ? 'Trage im Geldfluss deine Einnahmen ein, dann steht hier dein Monat.'
        : m.rest < 0
          ? `Du gibst ${dezimal(-quote, 0)} % mehr aus, als hereinkommt.`
          : `Du legst ${dezimal(quote, 0)} % deiner Einnahmen zur Seite.`));

    return box;
  }

  function renderAll() {
    clear(host);

    const kopf = el('div', { class: 'dash-kopf' });
    kopf.appendChild(wortmarke({ size: 40 }));
    host.appendChild(kopf);

    host.appendChild(monatsblock(monatszahlen(store.data)));

    host.appendChild(el('h3', { class: 'dash-ueberschrift' }, 'Bereiche'));

    const zahlen = kennzahlen(store.data);
    const gitter = el('div', { class: 'dash-gitter' });

    for (const b of BEREICHE) {
      const karte = el('button', { type: 'button', class: 'dash-karte' });
      const z = zahlen[b.kennzahl];

      const oben = el('div', { class: 'dash-oben' });
      const symbol = el('span', { class: `dash-symbol dash-${b.tab}` });
      symbol.appendChild(symbolSvg(b.symbol, { size: 22 }));
      oben.append(symbol, el('h4', {}, b.titel));

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
