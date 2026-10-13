// Startseite: eine Kachel je Bereich, jeweils mit der Zahl, die dort zählt.
// Soll die Frage beantworten "wo will ich gerade hin" statt nur zu verlinken.

import { el, money, clear } from './util.js';
import { symbolSvg, wortmarke } from './logo.js';
import { netWorth } from './accounts.js';
import { berechne } from './immobilien.js';
import { auswerten } from './tanken.js';
import { SEED_GERICHTE } from './gerichte-daten.js';
import { auswerten as schuldenAuswerten } from './schulden.js';
import { salden, ausgleich } from './gruppen.js';
import { HUB_ID } from './store.js';
import { renderNachrichten } from './nachrichten.js';

const dezimal = (v, stellen = 2) =>
  v === null || !Number.isFinite(v) ? '–' : v.toLocaleString('de-DE', {
    minimumFractionDigits: stellen, maximumFractionDigits: stellen,
  });

function monatsrest(data) {
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
  const m = monatsrest(data);
  const sch = schuldenAuswerten(data.schulden.eintraege);

  const nachId = new Map(SEED_GERICHTE.map(g => [g.id, g]));
  const plan = data.wochenplan.eintraege.filter(e => nachId.has(e.gerichtId));
  const portionen = plan.reduce((s, e) => s + e.portionen, 0);
  const kosten = plan.reduce((s, e) => s + nachId.get(e.gerichtId).preis * e.portionen, 0);

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
    woche: {
      wert: plan.length ? `${plan.length} Mahlzeiten` : 'leer',
      zusatz: plan.length ? `${portionen} Portionen · ${money(Math.round(kosten))}` : 'nichts geplant',
    },
    gruppen: (() => {
      const g = data.gruppen.items.find(x => x.id === data.gruppen.activeId) ?? data.gruppen.items[0];
      if (!g) return { wert: '–', zusatz: 'keine Gruppe angelegt' };
      const liste = salden(g);
      const ich = liste.find(p => p.id === g.ichId);
      const gesamt = g.ausgaben.reduce((s, a) => s + (Number(a.betrag) || 0), 0);
      return {
        wert: ich ? money(Math.round(ich.saldo * 100) / 100) : money(Math.round(gesamt * 100) / 100),
        zusatz: `${g.name} · ${money(Math.round(gesamt))} · ${ausgleich(liste).length} Zahlungen offen`,
      };
    })(),
    schulden: {
      wert: money(Math.round(sch.saldo * 100) / 100),
      zusatz: sch.offen.length
        ? `${money(Math.round(sch.bekomme))} offen, ${money(Math.round(sch.schulde))} geschuldet`
        : 'nichts offen',
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
  { tab: 'woche', symbol: 'woche', titel: 'Wochenplan', text: 'Essen für die Woche planen – die Einkaufsliste entsteht daraus.', kennzahl: 'woche' },
  { tab: 'schulden', symbol: 'schulden', titel: 'Schulden', text: 'Wer dir was schuldet und was du schuldest – per Satz erfasst.', kennzahl: 'schulden' },
  { tab: 'gruppen', symbol: 'gruppen', titel: 'Gruppenkasse', text: 'Gemeinsame Ausgaben einer Reise – und wer am Ende wem was zahlt.', kennzahl: 'gruppen' },
  { tab: 'tanken', symbol: 'tanken', titel: 'Tanken', text: 'Verbrauch und Spritkosten über alle Tankfüllungen.', kennzahl: 'tanken' },
];

export function createDashboard({ host, store, onOeffne }) {
  function renderAll() {
    clear(host);

    const kopf = el('div', { class: 'dash-kopf' });
    kopf.appendChild(wortmarke({ size: 40 }));
    kopf.appendChild(el('p', { class: 'dash-text' },
      'Such dir aus, womit du anfangen willst.'));
    host.appendChild(kopf);

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

    // Lädt nebenher; die Kacheln sollen nicht auf das Netz warten.
    const news = el('section', { class: 'news' });
    host.appendChild(news);
    renderNachrichten(news);
  }

  return { renderAll };
}
