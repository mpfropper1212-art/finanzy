// Tanktabelle: je Tankfüllung Datum, Liter, Preis und Tachostand. Alles
// andere - gefahrene Kilometer, Verbrauch, Preis je Liter - ergibt sich daraus.

import { el, svg, clear, money, uid } from './util.js';

const zahl = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function createTankung(vorlage = {}) {
  return {
    id: uid('tk'),
    datum: new Date().toISOString().slice(0, 10),
    liter: 0,
    euro: 0,
    tacho: 0,
    notiz: '',
    ...vorlage,
  };
}

const datumKurz = iso => new Date(iso).toLocaleDateString('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});

const dezimal = (v, stellen = 2) =>
  v === null || !Number.isFinite(v) ? '–' : v.toLocaleString('de-DE', {
    minimumFractionDigits: stellen, maximumFractionDigits: stellen,
  });

// Nach Tachostand sortieren, nicht nach Datum: der Zählerstand bestimmt die
// Reihenfolge, auch wenn jemand eine Quittung später nachträgt.
export function auswerten(eintraege) {
  const sortiert = [...eintraege].sort((a, b) => zahl(a.tacho) - zahl(b.tacho) || String(a.datum).localeCompare(String(b.datum)));

  const zeilen = sortiert.map((e, i) => {
    const vorher = i > 0 ? zahl(sortiert[i - 1].tacho) : null;
    const tacho = zahl(e.tacho);
    const km = vorher !== null && tacho > vorher ? tacho - vorher : null;
    const liter = zahl(e.liter);
    const euro = zahl(e.euro);
    return {
      ...e,
      liter, euro, tacho, km,
      verbrauch: km && liter > 0 ? (liter / km) * 100 : null,
      preisProLiter: liter > 0 ? euro / liter : null,
      kostenProKm: km ? euro / km : null,
    };
  });

  const mitKm = zeilen.filter(z => z.km !== null);
  const summeLiter = zeilen.reduce((s, z) => s + z.liter, 0);
  const summeEuro = zeilen.reduce((s, z) => s + z.euro, 0);
  const summeKm = mitKm.reduce((s, z) => s + z.km, 0);
  // Für den Gesamtverbrauch zählt nur, was auch einer Strecke zugeordnet ist -
  // die allererste Füllung legt bloß den Startpunkt fest.
  const literMitKm = mitKm.reduce((s, z) => s + z.liter, 0);

  const daten = zeilen.map(z => z.datum).filter(Boolean).sort();
  let monate = null;
  if (daten.length > 1) {
    const von = new Date(daten[0]);
    const bis = new Date(daten[daten.length - 1]);
    const tage = (bis - von) / 86400000;
    if (tage > 0) monate = tage / 30.44;
  }

  return {
    zeilen,
    summeLiter,
    summeEuro,
    summeKm,
    verbrauch: summeKm > 0 ? (literMitKm / summeKm) * 100 : null,
    preisProLiter: summeLiter > 0 ? summeEuro / summeLiter : null,
    kostenProKm: summeKm > 0 ? summeEuro / summeKm : null,
    kostenProMonat: monate ? summeEuro / monate : null,
  };
}

function kachel(label, wert, hint) {
  const box = el('div', { class: 'kpi' });
  box.append(el('span', { class: 'kpi-label' }, label), el('strong', { class: 'kpi-value' }, wert));
  if (hint) box.appendChild(el('span', { class: 'kpi-hint' }, hint));
  return box;
}

// Verbrauchsverlauf, damit Ausreißer und Trends auffallen.
function verbrauchsChart(host, a) {
  clear(host);
  const punkte = a.zeilen.filter(z => z.verbrauch !== null);
  if (punkte.length < 2) {
    host.appendChild(el('p', { class: 'empty' }, 'Ab der zweiten Tankfüllung mit Tachostand erscheint hier der Verlauf.'));
    return;
  }

  const width = 800, height = 200;
  const pad = { top: 16, right: 14, bottom: 26, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const werte = punkte.map(p => p.verbrauch);
  const min = Math.min(...werte) * 0.92;
  const max = Math.max(...werte) * 1.08;
  const spanne = max - min || 1;

  const x = i => pad.left + (punkte.length === 1 ? plotW / 2 : (i / (punkte.length - 1)) * plotW);
  const y = v => pad.top + plotH - ((v - min) / spanne) * plotH;

  const root = svg('svg', {
    width, height, viewBox: `0 0 ${width} ${height}`,
    'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  });
  root.appendChild(svg('rect', { x: 0, y: 0, width, height, fill: 'transparent', 'data-export-bg': '1' }));

  if (a.verbrauch !== null) {
    const yy = y(a.verbrauch);
    root.appendChild(svg('line', {
      x1: pad.left, x2: width - pad.right, y1: yy, y2: yy,
      stroke: 'currentColor', 'stroke-opacity': 0.25, 'stroke-dasharray': '4 4',
    }));
    root.appendChild(svg('text', {
      x: width - pad.right, y: yy - 6, 'text-anchor': 'end',
      'font-size': 10.5, fill: 'currentColor', opacity: 0.6,
    }, `Schnitt ${dezimal(a.verbrauch)} l`));
  }

  for (const v of [min, max]) {
    root.appendChild(svg('text', {
      x: pad.left - 8, y: y(v) + 4, 'text-anchor': 'end',
      'font-size': 10.5, fill: 'currentColor', opacity: 0.55,
    }, dezimal(v, 1)));
  }

  const d = punkte.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.verbrauch)}`).join(' ');
  root.appendChild(svg('path', { d, fill: 'none', stroke: '#2f6feb', 'stroke-width': 2.2 }));
  punkte.forEach((p, i) => {
    const kreis = svg('circle', { cx: x(i), cy: y(p.verbrauch), r: 3.2, fill: '#2f6feb' });
    kreis.appendChild(svg('title', {}, `${p.datum}: ${dezimal(p.verbrauch)} l/100 km`));
    root.appendChild(kreis);
  });

  host.appendChild(root);
}

export function createTankenView({ kpiHost, chartHost, tabelleHost, formHost, store }) {
  const eintraege = () => store.data.tanken.eintraege;
  let entwurf = createTankung();

  function valueChange() {
    store.commit({ silent: true });
    renderAll();
  }

  function renderKpis(a) {
    clear(kpiHost);
    const box = el('div', { class: 'kpis' });
    box.append(
      kachel('Verbrauch', a.verbrauch === null ? '–' : `${dezimal(a.verbrauch)} l`, 'je 100 km, gesamt'),
      kachel('Preis je Liter', a.preisProLiter === null ? '–' : `${dezimal(a.preisProLiter, 3)} €`, 'Schnitt über alle Füllungen'),
      kachel('Kosten je km', a.kostenProKm === null ? '–' : `${dezimal(a.kostenProKm, 3)} €`, 'nur Kraftstoff'),
      kachel('Kosten je Monat', a.kostenProMonat === null ? '–' : money(Math.round(a.kostenProMonat)), 'Schnitt über den Zeitraum'),
      kachel('Gefahren', `${a.summeKm.toLocaleString('de-DE')} km`, `${a.zeilen.length} Tankfüllungen`),
      kachel('Gesamtkosten', money(a.summeEuro), `${dezimal(a.summeLiter, 2)} Liter`),
    );
    kpiHost.appendChild(box);
  }

  function renderTabelle(a) {
    clear(tabelleHost);
    if (!a.zeilen.length) {
      tabelleHost.appendChild(el('p', { class: 'empty' }, 'Noch keine Tankfüllung erfasst – rechts die erste eintragen.'));
      return;
    }

    const tabelle = el('table', { class: 'tank-tabelle' });
    const kopf = el('tr');
    for (const [titel, klasse] of [
      ['Datum', ''], ['Liter', 'num'], ['Preis', 'num'], ['€/l', 'num'],
      ['Tacho', 'num'], ['km', 'num'], ['l/100km', 'num'], ['', ''],
    ]) kopf.appendChild(el('th', { class: klasse }, titel));
    const thead = el('thead');
    thead.appendChild(kopf);
    tabelle.appendChild(thead);

    const body = el('tbody');
    // Neueste zuerst: der letzte Tankvorgang interessiert am meisten.
    for (const z of [...a.zeilen].reverse()) {
      const tr = el('tr');
      tr.append(
        el('td', {}, z.datum ? datumKurz(z.datum) : '–'),
        el('td', { class: 'num' }, dezimal(z.liter, 2)),
        el('td', { class: 'num' }, money(z.euro)),
        el('td', { class: 'num' }, dezimal(z.preisProLiter, 3)),
        el('td', { class: 'num' }, z.tacho.toLocaleString('de-DE')),
        el('td', { class: 'num' }, z.km === null ? '–' : z.km.toLocaleString('de-DE')),
        el('td', { class: 'num stark' }, dezimal(z.verbrauch)),
      );
      const aktion = el('td', {});
      const del = el('button', { class: 'icon-btn', type: 'button', title: 'Eintrag löschen' }, '×');
      del.addEventListener('click', () => {
        store.data.tanken.eintraege = eintraege().filter(x => x.id !== z.id);
        valueChange();
      });
      aktion.appendChild(del);
      tr.appendChild(aktion);
      if (z.notiz) tr.title = z.notiz;
      body.appendChild(tr);
    }
    tabelle.appendChild(body);

    const fuss = el('tfoot');
    const summe = el('tr');
    summe.append(
      el('th', {}, 'Summe'),
      el('th', { class: 'num' }, dezimal(a.summeLiter, 2)),
      el('th', { class: 'num' }, money(a.summeEuro)),
      el('th', { class: 'num' }, dezimal(a.preisProLiter, 3)),
      el('th', {}, ''),
      el('th', { class: 'num' }, a.summeKm.toLocaleString('de-DE')),
      el('th', { class: 'num stark' }, dezimal(a.verbrauch)),
      el('th', {}, ''),
    );
    fuss.appendChild(summe);
    tabelle.appendChild(fuss);

    tabelleHost.appendChild(tabelle);
  }

  function renderFormular() {
    clear(formHost);
    const letzte = [...eintraege()].sort((a, b) => zahl(b.tacho) - zahl(a.tacho))[0];

    const feld = (key, label, attrs = {}) => {
      const row = el('label', { class: 'feld' });
      row.appendChild(el('span', { class: 'feld-label' }, label));
      const input = el('input', { value: entwurf[key] ?? '', ...attrs });
      input.addEventListener('input', () => {
        entwurf[key] = attrs.type === 'number' ? input.value : input.value;
      });
      const wrap = el('div', { class: 'feld-input' });
      wrap.appendChild(input);
      if (attrs['data-einheit']) wrap.appendChild(el('span', { class: 'feld-einheit' }, attrs['data-einheit']));
      row.appendChild(wrap);
      formHost.appendChild(row);
    };

    feld('datum', 'Datum', { type: 'date' });
    feld('liter', 'Getankt', { type: 'number', min: '0', step: '0.01', 'data-einheit': 'l' });
    feld('euro', 'Bezahlt', { type: 'number', min: '0', step: '0.01', 'data-einheit': '€' });
    feld('tacho', 'Tachostand', { type: 'number', min: '0', step: '1', 'data-einheit': 'km' });

    if (letzte) {
      formHost.appendChild(el('p', { class: 'feld-hinweis' },
        `Letzter Tachostand: ${zahl(letzte.tacho).toLocaleString('de-DE')} km`));
    }

    const notizRow = el('label', { class: 'feld feld-breit' });
    notizRow.appendChild(el('span', { class: 'feld-label' }, 'Notiz (optional)'));
    const notiz = el('input', { type: 'text', value: entwurf.notiz, placeholder: 'z. B. Tankstelle, Autobahn, Anhänger' });
    notiz.addEventListener('input', () => { entwurf.notiz = notiz.value; });
    notizRow.appendChild(notiz);
    formHost.appendChild(notizRow);

    const fehler = el('p', { class: 'msg is-error', hidden: true });
    formHost.appendChild(fehler);

    const knopf = el('button', { class: 'btn btn-primary btn-block', type: 'button' }, 'Tankfüllung eintragen');
    knopf.addEventListener('click', () => {
      const liter = zahl(entwurf.liter);
      const tacho = zahl(entwurf.tacho);
      let text = '';
      if (liter <= 0) text = 'Bitte die getankte Menge eintragen.';
      else if (tacho <= 0) text = 'Bitte den Tachostand eintragen.';
      else if (letzte && tacho <= zahl(letzte.tacho)) {
        text = `Der Tachostand muss über dem letzten liegen (${zahl(letzte.tacho).toLocaleString('de-DE')} km).`;
      }
      if (text) {
        fehler.textContent = text;
        fehler.hidden = false;
        return;
      }
      eintraege().push(createTankung({
        datum: entwurf.datum,
        liter,
        euro: zahl(entwurf.euro),
        tacho,
        notiz: entwurf.notiz.trim(),
      }));
      entwurf = createTankung();
      valueChange();
    });
    formHost.appendChild(knopf);
  }

  function renderAll() {
    const a = auswerten(eintraege());
    renderKpis(a);
    verbrauchsChart(chartHost, a);
    renderTabelle(a);
    renderFormular();
  }

  return { renderAll };
}
