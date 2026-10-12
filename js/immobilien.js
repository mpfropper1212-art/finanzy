// Immobilien-Rechner: Kaufnebenkosten, Annuitätendarlehen, Renditekennzahlen
// und Cashflow vor und nach Steuern. Mehrere Objekte pro Konto.

import { money, moneyShort, el, svg, clear, uid } from './util.js';

// Grunderwerbsteuer in Prozent, Stand Oktober 2026.
export const BUNDESLAENDER = {
  Bayern: 3.5,
  'Baden-Württemberg': 5.0,
  Bremen: 5.0,
  Niedersachsen: 5.0,
  'Rheinland-Pfalz': 5.0,
  'Sachsen-Anhalt': 5.0,
  Thüringen: 5.0,
  Hamburg: 5.5,
  Sachsen: 5.5,
  Berlin: 6.0,
  Hessen: 6.0,
  'Mecklenburg-Vorpommern': 6.0,
  Brandenburg: 6.5,
  'Nordrhein-Westfalen': 6.5,
  Saarland: 6.5,
  'Schleswig-Holstein': 6.5,
};

// § 7 Abs. 4 EStG: Altbauten vor 1925 schneller, Neubauten ab 2023 mit 3 %.
export function afaFromBaujahr(baujahr) {
  const jahr = Number(baujahr) || 0;
  if (jahr >= 2023) return 3;
  if (jahr > 0 && jahr < 1925) return 2.5;
  return 2;
}

export function createImmobilie(name = 'Neue Immobilie') {
  return {
    id: uid('i'),
    name,
    bundesland: 'Nordrhein-Westfalen',
    baujahr: 1998,
    wohnflaeche: 72,
    kaufpreis: 280000,
    grunderwerbsteuer: 6.5,
    notar: 2,
    makler: 3.57,
    eigenkapital: 60000,
    sollzins: 3.6,
    tilgung: 2,
    zinsbindung: 10,
    kaltmiete: 950,
    verwaltung: 25,
    instandhaltung: 9,
    mietausfall: 3,
    gebaeudeanteil: 80,
    afaSatz: 2,
    grenzsteuersatz: 42,
  };
}

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pct = v => num(v) / 100;

// Monatsgenauer Tilgungsverlauf. Reicht die Rate nicht einmal für die Zinsen,
// steht die Tilgung auf null statt ins Negative zu laufen.
function tilgungsplan(darlehen, zinsPaProzent, rateMonat, monate) {
  const i = pct(zinsPaProzent) / 12;
  const jahre = [];
  let rest = darlehen;
  let zinsenJahr = 0;
  let tilgungJahr = 0;

  for (let m = 1; m <= monate; m++) {
    const zins = rest * i;
    let tilgung = Math.max(0, rateMonat - zins);
    if (tilgung > rest) tilgung = rest;
    rest -= tilgung;
    zinsenJahr += zins;
    tilgungJahr += tilgung;
    if (m % 12 === 0) {
      jahre.push({ jahr: m / 12, zinsen: zinsenJahr, tilgung: tilgungJahr, restschuld: rest });
      zinsenJahr = 0;
      tilgungJahr = 0;
    }
  }
  return jahre;
}

export function berechne(o) {
  const kaufpreis = num(o.kaufpreis);
  const grunderwerbsteuer = kaufpreis * pct(o.grunderwerbsteuer);
  const notar = kaufpreis * pct(o.notar);
  const makler = kaufpreis * pct(o.makler);
  const nebenkosten = grunderwerbsteuer + notar + makler;
  const gesamtinvestition = kaufpreis + nebenkosten;

  const eigenkapital = Math.min(num(o.eigenkapital), gesamtinvestition);
  const darlehen = Math.max(0, gesamtinvestition - eigenkapital);

  const jahresmiete = num(o.kaltmiete) * 12;
  const verwaltung = num(o.verwaltung) * 12;
  const instandhaltung = num(o.instandhaltung) * num(o.wohnflaeche);
  const mietausfall = jahresmiete * pct(o.mietausfall);
  const bewirtschaftung = verwaltung + instandhaltung + mietausfall;

  const annuitaetJahr = darlehen * (pct(o.sollzins) + pct(o.tilgung));
  const rateMonat = annuitaetJahr / 12;
  const zinsbindung = Math.max(1, Math.round(num(o.zinsbindung)));
  const plan = tilgungsplan(darlehen, o.sollzins, rateMonat, zinsbindung * 12);
  const jahr1 = plan[0] ?? { zinsen: 0, tilgung: 0, restschuld: darlehen };
  const restschuld = plan.length ? plan[plan.length - 1].restschuld : darlehen;

  // Nur der Gebäudeanteil ist abschreibbar, Grund und Boden nicht. Die
  // Kaufnebenkosten gehen anteilig in die Bemessungsgrundlage ein.
  const afaBasis = gesamtinvestition * pct(o.gebaeudeanteil);
  const afa = afaBasis * pct(o.afaSatz);

  // Werbungskosten: Verwaltung, Instandhaltung, Zinsen, AfA. Das
  // Mietausfallwagnis ist ein Risikopuffer und keine Ausgabe.
  const werbungskosten = verwaltung + instandhaltung + jahr1.zinsen + afa;
  const steuerErgebnis = jahresmiete - werbungskosten;
  const steuerEffekt = -steuerErgebnis * pct(o.grenzsteuersatz);

  const cashflowVor = jahresmiete - bewirtschaftung - annuitaetJahr;
  const cashflowNach = cashflowVor + steuerEffekt;

  return {
    kaufpreis, grunderwerbsteuer, notar, makler, nebenkosten, gesamtinvestition,
    eigenkapital, darlehen, jahresmiete,
    verwaltung, instandhaltung, mietausfall, bewirtschaftung,
    annuitaetJahr, rateMonat, zinsenJahr1: jahr1.zinsen, tilgungJahr1: jahr1.tilgung,
    restschuld, zinsbindung, plan,
    afaBasis, afa, steuerErgebnis, steuerEffekt,
    cashflowVor, cashflowNach,
    bruttorendite: kaufpreis > 0 ? jahresmiete / kaufpreis : null,
    nettorendite: gesamtinvestition > 0 ? (jahresmiete - bewirtschaftung) / gesamtinvestition : null,
    kaufpreisfaktor: jahresmiete > 0 ? kaufpreis / jahresmiete : null,
    ekRendite: eigenkapital > 0 ? (cashflowNach + jahr1.tilgung) / eigenkapital : null,
    nebenkostenQuote: kaufpreis > 0 ? nebenkosten / kaufpreis : null,
  };
}

/* ----------------------------- Darstellung ----------------------------- */

const prozent = v => (v === null ? '–' : `${(v * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`);
const faktor = v => (v === null ? '–' : `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })}×`);

function kachel(label, wert, hint, tone) {
  const box = el('div', { class: `kpi${tone ? ' kpi-' + tone : ''}` });
  box.append(
    el('span', { class: 'kpi-label' }, label),
    el('strong', { class: 'kpi-value' }, wert),
  );
  if (hint) box.appendChild(el('span', { class: 'kpi-hint' }, hint));
  return box;
}

function zeile(label, wert, { stark = false, eingerueckt = false } = {}) {
  const row = el('div', { class: `brk${stark ? ' brk-strong' : ''}${eingerueckt ? ' brk-sub' : ''}` });
  row.append(el('span', {}, label), el('span', { class: 'brk-num' }, wert));
  return row;
}

export function renderErgebnis(host, chartHost, o, r) {
  clear(host);

  const kpis = el('div', { class: 'kpis' });
  kpis.append(
    kachel('Bruttomietrendite', prozent(r.bruttorendite), 'Jahresmiete ÷ Kaufpreis'),
    kachel('Nettomietrendite', prozent(r.nettorendite),
      'nach Bewirtschaftung, auf die Gesamtinvestition',
      r.nettorendite !== null && r.nettorendite < 0.035 ? 'warn' : 'good'),
    kachel('Kaufpreisfaktor', faktor(r.kaufpreisfaktor), 'Kaufpreis ÷ Jahresmiete'),
    kachel('Cashflow vor Steuern', `${money(Math.round(r.cashflowVor / 12))} / Monat`,
      `${money(Math.round(r.cashflowVor))} pro Jahr`,
      r.cashflowVor < 0 ? 'warn' : 'good'),
    kachel('Cashflow nach Steuern', `${money(Math.round(r.cashflowNach / 12))} / Monat`,
      `${money(Math.round(r.cashflowNach))} pro Jahr`,
      r.cashflowNach < 0 ? 'warn' : 'good'),
    kachel('Eigenkapitalrendite', prozent(r.ekRendite), 'Cashflow + Tilgung ÷ Eigenkapital'),
  );
  host.appendChild(kpis);

  const spalten = el('div', { class: 'breakdowns' });

  const kauf = el('div', { class: 'breakdown' });
  kauf.append(
    el('h3', {}, 'Kaufpreis und Nebenkosten'),
    zeile('Kaufpreis', money(Math.round(r.kaufpreis))),
    zeile(`Grunderwerbsteuer ${o.grunderwerbsteuer} %`, money(Math.round(r.grunderwerbsteuer)), { eingerueckt: true }),
    zeile(`Notar und Grundbuch ${o.notar} %`, money(Math.round(r.notar)), { eingerueckt: true }),
    zeile(`Maklerprovision ${o.makler} %`, money(Math.round(r.makler)), { eingerueckt: true }),
    zeile(`Nebenkosten gesamt (${prozent(r.nebenkostenQuote)})`, money(Math.round(r.nebenkosten))),
    zeile('Gesamtinvestition', money(Math.round(r.gesamtinvestition)), { stark: true }),
    zeile('davon Eigenkapital', money(Math.round(r.eigenkapital)), { eingerueckt: true }),
    zeile('davon Darlehen', money(Math.round(r.darlehen)), { eingerueckt: true }),
  );

  const lauf = el('div', { class: 'breakdown' });
  lauf.append(
    el('h3', {}, 'Jahr 1 im Überblick'),
    zeile('Jahreskaltmiete', money(Math.round(r.jahresmiete))),
    zeile('Verwaltung', `− ${money(Math.round(r.verwaltung))}`, { eingerueckt: true }),
    zeile('Instandhaltungsrücklage', `− ${money(Math.round(r.instandhaltung))}`, { eingerueckt: true }),
    zeile('Mietausfallwagnis', `− ${money(Math.round(r.mietausfall))}`, { eingerueckt: true }),
    zeile('Kapitaldienst (Zins und Tilgung)', `− ${money(Math.round(r.annuitaetJahr))}`),
    zeile('davon Zinsen', money(Math.round(r.zinsenJahr1)), { eingerueckt: true }),
    zeile('davon Tilgung', money(Math.round(r.tilgungJahr1)), { eingerueckt: true }),
    zeile('Cashflow vor Steuern', money(Math.round(r.cashflowVor)), { stark: true }),
  );

  const steuer = el('div', { class: 'breakdown' });
  steuer.append(
    el('h3', {}, 'Steuerliche Betrachtung'),
    zeile('Jahreskaltmiete', money(Math.round(r.jahresmiete))),
    zeile('Verwaltung und Instandhaltung', `− ${money(Math.round(r.verwaltung + r.instandhaltung))}`, { eingerueckt: true }),
    zeile('Schuldzinsen', `− ${money(Math.round(r.zinsenJahr1))}`, { eingerueckt: true }),
    zeile(`AfA ${o.afaSatz} % auf ${money(Math.round(r.afaBasis))}`, `− ${money(Math.round(r.afa))}`, { eingerueckt: true }),
    zeile('Steuerliches Ergebnis', money(Math.round(r.steuerErgebnis)), { stark: true }),
    zeile(r.steuerEffekt >= 0 ? 'Steuererstattung' : 'Steuerlast',
      money(Math.round(Math.abs(r.steuerEffekt)))),
    zeile('Cashflow nach Steuern', money(Math.round(r.cashflowNach)), { stark: true }),
  );

  spalten.append(kauf, lauf, steuer);
  host.appendChild(spalten);

  host.appendChild(el('p', { class: 'note note-info' },
    'Überschlagsrechnung, keine Steuerberatung. Vereinfacht: Instandhaltungsrücklage wirkt '
    + 'steuerlich erst, wenn sie tatsächlich ausgegeben wird, und Zinsen sowie Tilgung '
    + 'verschieben sich über die Jahre. Gezeigt ist jeweils das erste Jahr.'));

  renderTilgungschart(chartHost, r);
}

// Restschuldverlauf über die Zinsbindung - zeigt, was nach Ablauf noch offen ist.
function renderTilgungschart(host, r) {
  clear(host);
  if (!r.plan.length || r.darlehen <= 0) {
    host.appendChild(el('p', { class: 'empty' }, 'Ohne Darlehen gibt es keinen Tilgungsverlauf.'));
    return;
  }

  // Feste Zeichenfläche, per CSS auf die Containerbreite skaliert. Sonst würde
  // das Diagramm zu schmal geraten, solange der Tab noch keine Breite hat.
  const width = 800;
  const height = 210;
  const pad = { top: 18, right: 16, bottom: 30, left: 76 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const punkte = [{ jahr: 0, rest: r.darlehen }, ...r.plan.map(p => ({ jahr: p.jahr, rest: p.restschuld }))];
  const maxJahr = punkte[punkte.length - 1].jahr || 1;
  const x = j => pad.left + (j / maxJahr) * plotW;
  const y = v => pad.top + plotH - (v / r.darlehen) * plotH;

  const root = svg('svg', {
    width, height, viewBox: `0 0 ${width} ${height}`,
    'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  });
  root.appendChild(svg('rect', { x: 0, y: 0, width, height, fill: 'transparent', 'data-export-bg': '1' }));

  for (const anteil of [0, 0.5, 1]) {
    const yy = y(r.darlehen * anteil);
    root.appendChild(svg('line', {
      x1: pad.left, x2: width - pad.right, y1: yy, y2: yy,
      stroke: 'currentColor', 'stroke-opacity': 0.14,
    }));
    root.appendChild(svg('text', {
      x: pad.left - 9, y: yy + 4, 'text-anchor': 'end',
      'font-size': 10.5, fill: 'currentColor', opacity: 0.55,
    }, moneyShort(r.darlehen * anteil)));
  }

  const linie = punkte.map((p, i) => `${i ? 'L' : 'M'}${x(p.jahr)},${y(p.rest)}`).join(' ');
  root.appendChild(svg('path', {
    d: `${linie} L${x(maxJahr)},${y(0)} L${x(0)},${y(0)} Z`,
    fill: '#2f6feb', 'fill-opacity': 0.12,
  }));
  root.appendChild(svg('path', { d: linie, fill: 'none', stroke: '#2f6feb', 'stroke-width': 2.2 }));

  for (const p of punkte) {
    if (p.jahr !== 0 && p.jahr !== maxJahr) continue;
    root.appendChild(svg('circle', { cx: x(p.jahr), cy: y(p.rest), r: 3.5, fill: '#2f6feb' }));
  }

  root.appendChild(svg('text', {
    x: pad.left, y: height - 9, 'font-size': 11, fill: 'currentColor', opacity: 0.6,
  }, 'Kauf'));
  root.appendChild(svg('text', {
    x: width - pad.right, y: height - 9, 'text-anchor': 'end',
    'font-size': 11, fill: 'currentColor', opacity: 0.6,
  }, `nach ${r.zinsbindung} Jahren: ${moneyShort(r.restschuld)} Restschuld`));

  host.appendChild(root);
}

/* ------------------------------- Editor ------------------------------- */

const FELDER = [
  { gruppe: 'Objekt', felder: [
    { key: 'name', label: 'Bezeichnung', typ: 'text' },
    { key: 'bundesland', label: 'Bundesland', typ: 'select', optionen: Object.keys(BUNDESLAENDER) },
    { key: 'baujahr', label: 'Baujahr', typ: 'zahl', step: 1 },
    { key: 'wohnflaeche', label: 'Wohnfläche', typ: 'zahl', step: 1, einheit: 'm²' },
  ] },
  { gruppe: 'Kaufpreis und Nebenkosten', felder: [
    { key: 'kaufpreis', label: 'Kaufpreis', typ: 'zahl', step: 1000, einheit: '€' },
    { key: 'grunderwerbsteuer', label: 'Grunderwerbsteuer', typ: 'zahl', step: 0.1, einheit: '%' },
    { key: 'notar', label: 'Notar und Grundbuch', typ: 'zahl', step: 0.1, einheit: '%' },
    { key: 'makler', label: 'Maklerprovision', typ: 'zahl', step: 0.01, einheit: '%' },
  ] },
  { gruppe: 'Finanzierung', felder: [
    { key: 'eigenkapital', label: 'Eigenkapital', typ: 'zahl', step: 1000, einheit: '€' },
    { key: 'sollzins', label: 'Sollzins', typ: 'zahl', step: 0.05, einheit: '% p.a.' },
    { key: 'tilgung', label: 'Anfängliche Tilgung', typ: 'zahl', step: 0.25, einheit: '% p.a.' },
    { key: 'zinsbindung', label: 'Zinsbindung', typ: 'zahl', step: 1, einheit: 'Jahre' },
  ] },
  { gruppe: 'Miete und Bewirtschaftung', felder: [
    { key: 'kaltmiete', label: 'Kaltmiete', typ: 'zahl', step: 10, einheit: '€/Monat' },
    { key: 'verwaltung', label: 'Verwaltung', typ: 'zahl', step: 5, einheit: '€/Monat' },
    { key: 'instandhaltung', label: 'Instandhaltung', typ: 'zahl', step: 1, einheit: '€/m²·Jahr' },
    { key: 'mietausfall', label: 'Mietausfallwagnis', typ: 'zahl', step: 0.5, einheit: '%' },
  ] },
  { gruppe: 'Steuer', felder: [
    { key: 'gebaeudeanteil', label: 'Gebäudeanteil', typ: 'zahl', step: 1, einheit: '%' },
    { key: 'afaSatz', label: 'AfA-Satz', typ: 'zahl', step: 0.5, einheit: '%' },
    { key: 'grenzsteuersatz', label: 'Grenzsteuersatz', typ: 'zahl', step: 1, einheit: '%' },
  ] },
];

export function createImmobilienView({ listHost, formHost, resultHost, chartHost, store }) {
  const alle = () => store.data.immobilien.items;
  const aktiv = () => alle().find(x => x.id === store.data.immobilien.activeId) ?? alle()[0] ?? null;

  function valueChange() {
    store.commit({ silent: true });
    renderErgebnisse();
  }

  function structureChange() {
    store.commit({ silent: true });
    renderAll();
  }

  function renderListe() {
    clear(listHost);
    const current = aktiv();
    for (const item of alle()) {
      const chip = el('button', {
        type: 'button',
        class: 'obj-chip' + (current && item.id === current.id ? ' is-active' : ''),
      }, item.name || 'Ohne Namen');
      chip.addEventListener('click', () => {
        store.data.immobilien.activeId = item.id;
        structureChange();
      });
      listHost.appendChild(chip);
    }
  }

  function renderFormular() {
    clear(formHost);
    const o = aktiv();
    if (!o) {
      formHost.appendChild(el('p', { class: 'empty' }, 'Noch keine Immobilie angelegt.'));
      return;
    }

    for (const { gruppe, felder } of FELDER) {
      formHost.appendChild(el('h3', { class: 'feld-gruppe' }, gruppe));
      for (const f of felder) {
        const row = el('label', { class: 'feld' });
        row.appendChild(el('span', { class: 'feld-label' }, f.label));

        let input;
        if (f.typ === 'select') {
          input = el('select');
          for (const opt of f.optionen) {
            const option = el('option', { value: opt }, opt);
            if (o[f.key] === opt) option.selected = true;
            input.appendChild(option);
          }
        } else {
          input = el('input', {
            type: f.typ === 'text' ? 'text' : 'number',
            step: f.step ?? 'any',
            value: o[f.key] ?? '',
          });
        }
        input.addEventListener('input', () => applyField(o, f, input));
        if (f.typ === 'select') input.addEventListener('change', () => applyField(o, f, input));

        const wrap = el('div', { class: 'feld-input' });
        wrap.appendChild(input);
        if (f.einheit) wrap.appendChild(el('span', { class: 'feld-einheit' }, f.einheit));
        row.appendChild(wrap);
        formHost.appendChild(row);
      }
    }
  }

  // Bundesland und Baujahr setzen Werte vor, die man danach überschreiben kann.
  function applyField(o, f, input) {
    if (f.typ === 'text') {
      o[f.key] = input.value;
      renderListe();
      valueChange();
      return;
    }
    if (f.typ === 'select') {
      o[f.key] = input.value;
      if (f.key === 'bundesland') {
        o.grunderwerbsteuer = BUNDESLAENDER[input.value] ?? o.grunderwerbsteuer;
        renderFormular();
      }
      valueChange();
      return;
    }
    o[f.key] = Number(input.value) || 0;
    if (f.key === 'baujahr' && String(input.value).length === 4) {
      o.afaSatz = afaFromBaujahr(o.baujahr);
      const feld = [...formHost.querySelectorAll('.feld')]
        .find(n => n.querySelector('.feld-label')?.textContent === 'AfA-Satz');
      const ziel = feld?.querySelector('input');
      if (ziel) ziel.value = o.afaSatz;
    }
    valueChange();
  }

  function renderErgebnisse() {
    const o = aktiv();
    if (!o) {
      clear(resultHost);
      clear(chartHost);
      return;
    }
    renderErgebnis(resultHost, chartHost, o, berechne(o));
  }

  function renderAll() {
    renderListe();
    renderFormular();
    renderErgebnisse();
  }

  function hinzufuegen() {
    const neu = createImmobilie(`Immobilie ${alle().length + 1}`);
    alle().push(neu);
    store.data.immobilien.activeId = neu.id;
    structureChange();
  }

  function duplizieren() {
    const o = aktiv();
    if (!o) return;
    const kopie = { ...o, id: uid('i'), name: `${o.name} (Kopie)` };
    alle().push(kopie);
    store.data.immobilien.activeId = kopie.id;
    structureChange();
  }

  function entfernen() {
    const o = aktiv();
    if (!o) return;
    if (!window.confirm(`„${o.name}" wirklich löschen?`)) return;
    store.data.immobilien.items = alle().filter(x => x.id !== o.id);
    store.data.immobilien.activeId = store.data.immobilien.items[0]?.id ?? null;
    structureChange();
  }

  return { renderAll, hinzufuegen, duplizieren, entfernen, aktiv };
}
