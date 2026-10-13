// Tanktabelle: je Tankfüllung Datum, Liter, Preis und Tachostand. Alles
// andere - gefahrene Kilometer, Verbrauch, Preis je Liter - ergibt sich daraus.

import { el, svg, clear, money, uid } from './util.js';

const zahl = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const TAG_VORSCHLAEGE = ['Urlaub', 'Autobahn', 'Stadt', 'Kurzstrecke', 'Anhänger', 'Winter'];

export function createTankung(vorlage = {}) {
  return {
    id: uid('tk'),
    datum: new Date().toISOString().slice(0, 10),
    liter: 0,
    euro: 0,
    tacho: 0,
    notiz: '',
    tags: [],
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

export const ZEITRAEUME = {
  alle: { label: 'Alle Daten', monate: null },
  '12monate': { label: 'Letzte 12 Monate', monate: 12 },
  '3monate': { label: 'Letzte 3 Monate', monate: 3 },
};

export const FIXKOSTEN_FELDER = [
  ['versicherung', 'Versicherung'],
  ['steuer', 'Kfz-Steuer'],
  ['wartung', 'Wartung und TÜV'],
  ['sonstiges', 'Sonstiges'],
];

// Nach Tachostand sortieren, nicht nach Datum: der Zählerstand bestimmt die
// Reihenfolge, auch wenn jemand eine Quittung später nachträgt.
export function auswerten(eintraege, optionen = {}) {
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

  // Kilometer zuerst über alle Zeilen rechnen, dann den Zeitraum ausschneiden -
  // sonst fehlte der ersten Zeile im Fenster ihr Vorgänger.
  const grenze = grenzDatum(optionen.zeitraum);
  const ausgeschlossen = new Set(optionen.ausgeschlossen ?? []);
  const imZeitraum = grenze ? zeilen.filter(z => z.datum && z.datum >= grenze) : zeilen;
  // Eine ausgeschlossene Füllung fällt mit ihren Kilometern heraus - die
  // Strecke gehört ja zu derselben Fahrt.
  const imFenster = ausgeschlossen.size
    ? imZeitraum.filter(z => !(z.tags ?? []).some(tag => ausgeschlossen.has(tag)))
    : imZeitraum;

  const mitKm = imFenster.filter(z => z.km !== null);
  const summeLiter = imFenster.reduce((s, z) => s + z.liter, 0);
  const summeEuro = imFenster.reduce((s, z) => s + z.euro, 0);
  const summeKm = mitKm.reduce((s, z) => s + z.km, 0);
  // Für den Gesamtverbrauch zählt nur, was auch einer Strecke zugeordnet ist -
  // die allererste Füllung legt bloß den Startpunkt fest.
  const literMitKm = mitKm.reduce((s, z) => s + z.liter, 0);

  const daten = imFenster.map(z => z.datum).filter(Boolean).sort();
  let monate = null;
  if (daten.length > 1) {
    const tage = (new Date(daten[daten.length - 1]) - new Date(daten[0])) / 86400000;
    if (tage > 0) monate = tage / 30.44;
  }

  const fix = optionen.fixkosten ?? {};
  const fixProJahr = FIXKOSTEN_FELDER.reduce((s, [key]) => s + (Number(fix[key]) || 0), 0);
  const fixProMonat = fixProJahr / 12;

  const spritProMonat = monate ? summeEuro / monate : null;
  const kmProMonat = monate ? summeKm / monate : null;
  const gesamtProMonat = spritProMonat === null ? null : spritProMonat + fixProMonat;

  return {
    zeilen,
    imFenster,
    imZeitraum,
    tags: tagUebersicht(imZeitraum),
    ausgeschlossen: [...ausgeschlossen],
    summeLiter,
    summeEuro,
    summeKm,
    monate,
    verbrauch: summeKm > 0 ? (literMitKm / summeKm) * 100 : null,
    preisProLiter: summeLiter > 0 ? summeEuro / summeLiter : null,
    spritProKm: summeKm > 0 ? summeEuro / summeKm : null,
    spritProMonat,
    fixProJahr,
    fixProMonat,
    gesamtProMonat,
    gesamtProJahr: gesamtProMonat === null ? null : gesamtProMonat * 12,
    kmProMonat,
    kmProJahr: kmProMonat === null ? null : kmProMonat * 12,
    // Vollkosten je Kilometer: Sprit plus anteilige Fixkosten.
    kostenProKm: summeKm > 0 && monate
      ? (summeEuro + fixProMonat * monate) / summeKm
      : (summeKm > 0 ? summeEuro / summeKm : null),
  };
}

// Je Markierung der eigene Verbrauch, damit sich Urlaub und Alltag
// vergleichen lassen statt nur auszuschließen.
function tagUebersicht(zeilen) {
  const namen = new Set();
  for (const z of zeilen) for (const tag of z.tags ?? []) namen.add(tag);

  return [...namen].sort().map(tag => {
    const mit = zeilen.filter(z => (z.tags ?? []).includes(tag) && z.km !== null);
    const ohne = zeilen.filter(z => !(z.tags ?? []).includes(tag) && z.km !== null);
    const schnitt = liste => {
      const km = liste.reduce((s, z) => s + z.km, 0);
      const liter = liste.reduce((s, z) => s + z.liter, 0);
      return km > 0 ? (liter / km) * 100 : null;
    };
    return {
      tag,
      anzahl: zeilen.filter(z => (z.tags ?? []).includes(tag)).length,
      verbrauchMit: schnitt(mit),
      verbrauchOhne: schnitt(ohne),
    };
  });
}

function grenzDatum(zeitraum) {
  const monate = ZEITRAEUME[zeitraum]?.monate;
  if (!monate) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - monate);
  return d.toISOString().slice(0, 10);
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
  // Markierte Füllungen abgesetzt zeichnen - so sieht man sofort, ob ein
  // Ausschlag eine Urlaubsfahrt war.
  punkte.forEach((p, i) => {
    const markiert = (p.tags ?? []).length > 0;
    const kreis = svg('circle', {
      cx: x(i), cy: y(p.verbrauch),
      r: markiert ? 5 : 3.2,
      fill: markiert ? 'var(--surface)' : '#2f6feb',
      stroke: markiert ? '#d97706' : 'none',
      'stroke-width': markiert ? 2.4 : 0,
    });
    const beschriftung = markiert ? ` · ${(p.tags ?? []).join(', ')}` : '';
    kreis.appendChild(svg('title', {}, `${p.datum}: ${dezimal(p.verbrauch)} l/100 km${beschriftung}`));
    root.appendChild(kreis);
  });

  host.appendChild(root);
}

/* --------------------- Import aus einer Tabelle --------------------- */

// Deutsches Zahlformat: Punkt trennt Tausender, Komma die Dezimalstellen.
export function zelleZuZahl(text) {
  // Währungszeichen weg, der Rest muss reine Zahl sein - sonst würde aus
  // einer Notiz wie "1st time full" eine 1.
  // Ein Datum wie 16.05.2025 würde sonst als 16052025 durchgehen und als
  // größte Zahl den Tachostand verdrängen.
  if (zelleZuDatum(text) !== null) return null;
  const roh = String(text ?? '').replace(/€|eur/gi, '').replace(/\s/g, '').trim();
  if (!roh || !/^-?[\d.,]+$/.test(roh)) return null;
  const normal = roh.includes(',') ? roh.replace(/\./g, '').replace(',', '.') : roh.replace(/\./g, '');
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

export function zelleZuDatum(text) {
  const t = String(text ?? '').trim();
  let m = t.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
  if (m) {
    const jahr = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${jahr}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
}

export function zerlege(text) {
  const zeilen = String(text).split(/\r?\n/).map(z => z.trimEnd()).filter(z => z.trim());
  const trenner = zeilen.some(z => z.includes('\t')) ? /\t/
    : zeilen.some(z => z.includes(';')) ? /;/
      : /\s{2,}/;
  return zeilen.map(z => z.split(trenner).map(c => c.trim()));
}

// Spalten erraten: Tacho ist die größte aufsteigende Zahlenspalte, der Betrag
// steht meist mit Währungszeichen da, Liter sind die kleineren Mengen.
export function rateSpalten(gitter) {
  const breite = Math.max(...gitter.map(z => z.length));
  const spalten = [];

  for (let i = 0; i < breite; i++) {
    const zellen = gitter.map(z => z[i] ?? '');
    const zahlen = zellen.map(zelleZuZahl).filter(n => n !== null);
    const daten = zellen.map(zelleZuDatum).filter(Boolean);
    const sortiert = [...zahlen].sort((a, b) => a - b);
    spalten.push({
      index: i,
      beispiel: zellen.find(c => c) ?? '',
      datumAnteil: zellen.length ? daten.length / zellen.length : 0,
      zahlAnteil: zellen.length ? zahlen.length / zellen.length : 0,
      median: sortiert.length ? sortiert[Math.floor(sortiert.length / 2)] : null,
      max: zahlen.length ? Math.max(...zahlen) : null,
      waehrung: zellen.some(c => /€|eur/i.test(c)),
      steigend: zahlen.length > 2 && zahlen.every((n, k) => k === 0 || n >= zahlen[k - 1]),
    });
  }

  const datum = spalten.find(s2 => s2.datumAnteil > 0.5)?.index ?? null;
  const zahlSpalten = spalten.filter(s2 => s2.zahlAnteil > 0.5);
  // Bei wenigen Zeilen lässt sich "steigend" nicht beurteilen - dann zählt
  // nur noch die Größenordnung.
  const tachoKandidaten = zahlSpalten.filter(s2 => s2.index !== datum && s2.max > 1000);
  const tacho = tachoKandidaten
    .filter(s2 => s2.steigend)
    .sort((a, b) => b.max - a.max)[0]?.index
    ?? [...tachoKandidaten].sort((a, b) => b.max - a.max)[0]?.index
    ?? null;

  const rest = zahlSpalten.filter(s2 => s2.index !== tacho && s2.index !== datum
    && s2.median !== null && s2.median > 1);

  // Betrag geteilt durch Liter muss einen realistischen Spritpreis ergeben.
  // Das trennt die Literspalte zuverlässig von anderen Zahlenspalten, die
  // zufällig in derselben Größenordnung liegen.
  const guete = (euroWert, literWert) => {
    if (!euroWert || !literWert || literWert <= 0) return null;
    const preis = euroWert / literWert;
    if (preis < 0.8 || preis > 3.5) return null;
    return -Math.abs(preis - 1.75);
  };

  let euro = rest.find(s2 => s2.waehrung)?.index ?? null;
  let liter = null;

  if (euro !== null) {
    const euroMedian = rest.find(s2 => s2.index === euro).median;
    liter = rest
      .filter(s2 => s2.index !== euro)
      .map(s2 => ({ index: s2.index, wert: guete(euroMedian, s2.median) }))
      .filter(x => x.wert !== null)
      .sort((a, b) => b.wert - a.wert)[0]?.index ?? null;
  } else {
    let beste = null;
    for (const a of rest) {
      for (const b of rest) {
        if (a.index === b.index) continue;
        const wert = guete(a.median, b.median);
        if (wert !== null && (!beste || wert > beste.wert)) {
          beste = { euro: a.index, liter: b.index, wert };
        }
      }
    }
    if (beste) { euro = beste.euro; liter = beste.liter; }
  }

  return { datum, liter, euro, tacho, spalten };
}

export function zeilenAusGitter(gitter, zuordnung) {
  const treffer = [];
  for (const zeile of gitter) {
    const tacho = zelleZuZahl(zeile[zuordnung.tacho]);
    if (tacho === null || tacho <= 0) continue;
    treffer.push({
      datum: zelleZuDatum(zeile[zuordnung.datum]) ?? '',
      liter: Math.max(0, zelleZuZahl(zeile[zuordnung.liter]) ?? 0),
      euro: Math.max(0, zelleZuZahl(zeile[zuordnung.euro]) ?? 0),
      tacho,
    });
  }
  return treffer;
}

export function createTankenView({ kpiHost, chartHost, tabelleHost, formHost, fixHost, importHost, store }) {
  const eintraege = () => store.data.tanken.eintraege;
  const einstellungen = () => ({
    zeitraum: store.data.tanken.zeitraum,
    fixkosten: store.data.tanken.fixkosten,
    ausgeschlossen: store.data.tanken.ausgeschlosseneTags,
  });

  // Chips zum An- und Abwählen von Markierungen, einmal für den Entwurf und
  // einmal für vorhandene Einträge.
  function tagChips(aktuelle, umschalten, zusatz = []) {
    const box = el('div', { class: 'tag-chips' });
    const alle = [...new Set([...TAG_VORSCHLAEGE, ...zusatz, ...aktuelle])];
    for (const tag of alle) {
      const an = aktuelle.includes(tag);
      const chip = el('button', { type: 'button', class: 'tag' + (an ? ' is-an' : '') }, tag);
      chip.addEventListener('click', () => umschalten(tag, !an));
      box.appendChild(chip);
    }
    return box;
  }
  let entwurf = createTankung();

  function valueChange() {
    store.commit({ silent: true });
    renderAll();
  }

  function renderKpis(a) {
    clear(kpiHost);

    const kopf = el('div', { class: 'tank-zeitraum' });
    for (const [key, z] of Object.entries(ZEITRAEUME)) {
      const btn = el('button', {
        type: 'button',
        class: 'pill' + (einstellungen().zeitraum === key ? ' is-active' : ''),
      }, z.label);
      btn.addEventListener('click', () => {
        store.data.tanken.zeitraum = key;
        valueChange();
      });
      kopf.appendChild(btn);
    }
    kpiHost.appendChild(kopf);

    const euro = v => (v === null ? '–' : money(Math.round(v)));
    const box = el('div', { class: 'kpis' });
    box.append(
      kachel('Verbrauch', a.verbrauch === null ? '–' : `${dezimal(a.verbrauch)} l`, 'je 100 km'),
      kachel('Preis je Liter', a.preisProLiter === null ? '–' : `${dezimal(a.preisProLiter, 3)} €`, 'Schnitt im Zeitraum'),
      kachel('Sprit je Monat', euro(a.spritProMonat),
        a.kmProMonat === null ? '' : `${Math.round(a.kmProMonat).toLocaleString('de-DE')} km im Monat`),
      kachel('Fixkosten je Monat', euro(a.fixProMonat),
        a.fixProJahr ? `${money(Math.round(a.fixProJahr))} im Jahr` : 'rechts eintragen'),
      kachel('Alles zusammen', euro(a.gesamtProMonat),
        a.gesamtProJahr === null ? 'je Monat' : `${money(Math.round(a.gesamtProJahr))} im Jahr`),
      kachel('Kosten je km', a.kostenProKm === null ? '–' : `${dezimal(a.kostenProKm, 3)} €`,
        a.fixProJahr ? 'Sprit und Fixkosten' : 'nur Sprit'),
    );
    kpiHost.appendChild(box);

    if (a.tags.length) {
      const zeile = el('div', { class: 'tank-tagfilter' });
      zeile.appendChild(el('span', { class: 'tank-tagfilter-label' }, 'Nicht mitrechnen:'));
      for (const t of a.tags) {
        const aus = a.ausgeschlossen.includes(t.tag);
        const chip = el('button', {
          type: 'button',
          class: 'tag' + (aus ? ' is-aus' : ''),
          title: t.verbrauchMit === null
            ? `${t.anzahl} Tankfüllungen`
            : `${t.anzahl} Tankfüllungen · ${dezimal(t.verbrauchMit)} l gegenüber ${dezimal(t.verbrauchOhne)} l sonst`,
        }, `${t.tag} (${t.anzahl})`);
        chip.addEventListener('click', () => {
          const liste = store.data.tanken.ausgeschlosseneTags;
          const i = liste.indexOf(t.tag);
          if (i >= 0) liste.splice(i, 1);
          else liste.push(t.tag);
          valueChange();
        });
        zeile.appendChild(chip);
      }
      kpiHost.appendChild(zeile);

      for (const t of a.tags) {
        if (t.verbrauchMit === null || t.verbrauchOhne === null) continue;
        const diff = t.verbrauchMit - t.verbrauchOhne;
        if (Math.abs(diff) < 0.15) continue;
        kpiHost.appendChild(el('p', { class: 'feld-hinweis' },
          `Mit „${t.tag}" liegt der Verbrauch bei ${dezimal(t.verbrauchMit)} l, sonst bei `
          + `${dezimal(t.verbrauchOhne)} l – ${diff > 0 ? 'ein Mehrverbrauch' : 'weniger'} von `
          + `${dezimal(Math.abs(diff))} l je 100 km.`));
      }
    }

    kpiHost.appendChild(el('p', { class: 'feld-hinweis' },
      `${a.imFenster.length} von ${a.zeilen.length} Tankfüllungen gerechnet · `
      + `${a.summeKm.toLocaleString('de-DE')} km · ${money(a.summeEuro)} Sprit · `
      + `${dezimal(a.summeLiter, 2)} Liter`));
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
      ['Tacho', 'num'], ['km', 'num'], ['l/100km', 'num'], ['Markierung', ''], ['', ''],
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

      const tagZelle = el('td', { class: 'tag-zelle' });
      for (const tag of z.tags ?? []) tagZelle.appendChild(el('span', { class: 'tag tag-klein' }, tag));
      if (!(z.tags ?? []).length) tagZelle.appendChild(el('span', { class: 'tag-leer' }, '+ markieren'));
      tagZelle.addEventListener('click', () => oeffneTagEditor(z, tr));
      tr.appendChild(tagZelle);

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
      el('th', {}, ''),
    );
    fuss.appendChild(summe);
    tabelle.appendChild(fuss);

    tabelleHost.appendChild(tabelle);
  }

  // Markierungen einer vorhandenen Zeile ändern, ohne die ganze Tabelle neu
  // zu bauen - sonst klappt der Editor beim ersten Klick wieder zu.
  function oeffneTagEditor(zeile, tr) {
    const offen = tr.nextElementSibling?.classList.contains('tag-editor-zeile');
    tr.parentElement.querySelectorAll('.tag-editor-zeile').forEach(n => n.remove());
    if (offen) return;

    const eintrag = eintraege().find(e => e.id === zeile.id);
    if (!eintrag) return;
    if (!Array.isArray(eintrag.tags)) eintrag.tags = [];

    const editorZeile = el('tr', { class: 'tag-editor-zeile' });
    const zelle = el('td', { colspan: '9' });
    const bekannte = [...new Set(eintraege().flatMap(e => e.tags ?? []))];

    const zeichne = () => {
      clear(zelle);
      zelle.appendChild(tagChips(eintrag.tags, (tag, an) => {
        if (an) eintrag.tags.push(tag);
        else eintrag.tags = eintrag.tags.filter(x => x !== tag);
        store.commit({ silent: true });
        zeichne();
        // Nur die Abhängigen neu zeichnen, die Tabelle bleibt stehen.
        const a = auswerten(eintraege(), einstellungen());
        renderKpis(a);
        verbrauchsChart(chartHost, a);
        aktualisiereTagZelle(tr, eintrag);
      }, bekannte));

      const eigen = el('input', { type: 'text', placeholder: 'eigene Markierung', class: 'tag-eingabe' });
      eigen.addEventListener('keydown', ev => {
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        const wert = eigen.value.trim();
        if (!wert || eintrag.tags.includes(wert)) return;
        eintrag.tags.push(wert);
        store.commit({ silent: true });
        renderAll();
      });
      zelle.appendChild(eigen);
    };

    zeichne();
    editorZeile.appendChild(zelle);
    tr.after(editorZeile);
  }

  function aktualisiereTagZelle(tr, eintrag) {
    const zelle = tr.querySelector('.tag-zelle');
    if (!zelle) return;
    clear(zelle);
    for (const tag of eintrag.tags) zelle.appendChild(el('span', { class: 'tag tag-klein' }, tag));
    if (!eintrag.tags.length) zelle.appendChild(el('span', { class: 'tag-leer' }, '+ markieren'));
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

    const tagZeile = el('div', { class: 'feld feld-breit' });
    tagZeile.appendChild(el('span', { class: 'feld-label' }, 'Markierung (optional)'));
    const chipBox = el('div');
    const zeichneChips = () => {
      clear(chipBox);
      chipBox.appendChild(tagChips(entwurf.tags, (tag, an) => {
        entwurf.tags = an ? [...entwurf.tags, tag] : entwurf.tags.filter(x => x !== tag);
        zeichneChips();
      }, [...new Set(eintraege().flatMap(e => e.tags ?? []))]));
    };
    zeichneChips();
    tagZeile.appendChild(chipBox);
    formHost.appendChild(tagZeile);

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
        tags: [...entwurf.tags],
      }));
      entwurf = createTankung();
      valueChange();
    });
    formHost.appendChild(knopf);
  }

  /* ----------------------------- Import ----------------------------- */

  function renderImport() {
    clear(importHost);

    importHost.appendChild(el('p', { class: 'feld-hinweis' },
      'Zeilen aus Excel oder Numbers hier einfügen – mit Kopfzeile, das macht nichts. '
      + 'Die Spalten erkennt die App selbst und zeigt sie zum Prüfen an.'));

    const feld = el('textarea', { rows: '5', placeholder: '16.05.2025\t82,39\t123,48 €\t196529' });
    importHost.appendChild(feld);

    const vorschau = el('div', { class: 'import-vorschau' });
    importHost.appendChild(vorschau);

    const pruefen = el('button', { class: 'btn btn-block', type: 'button' }, 'Auswerten');
    pruefen.addEventListener('click', () => {
      clear(vorschau);
      const gitter = zerlege(feld.value);
      if (!gitter.length) {
        vorschau.appendChild(el('p', { class: 'msg is-error' }, 'Da war nichts zum Auswerten.'));
        return;
      }
      zeigeZuordnung(vorschau, gitter, rateSpalten(gitter));
    });
    importHost.appendChild(pruefen);
  }

  function zeigeZuordnung(host, gitter, zuordnung) {
    clear(host);
    const auswahl = {};

    const gitterBreite = Math.max(...gitter.map(z => z.length));
    for (const [key, label] of [['datum', 'Datum'], ['liter', 'Liter'], ['euro', 'Betrag'], ['tacho', 'Tachostand']]) {
      const row = el('label', { class: 'feld' });
      row.appendChild(el('span', { class: 'feld-label' }, label));
      const sel = el('select');
      sel.appendChild(el('option', { value: '' }, '– keine –'));
      for (let i = 0; i < gitterBreite; i++) {
        const beispiel = gitter.find(z => z[i])?.[i] ?? '';
        const opt = el('option', { value: String(i) }, `Spalte ${i + 1}: ${beispiel.slice(0, 14)}`);
        if (zuordnung[key] === i) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => { auswahl[key] = sel.value === '' ? null : Number(sel.value); aktualisiere(); });
      auswahl[key] = zuordnung[key];
      const wrap = el('div', { class: 'feld-input' });
      wrap.appendChild(sel);
      row.appendChild(wrap);
      host.appendChild(row);
    }

    const info = el('p', { class: 'feld-hinweis' });
    host.appendChild(info);
    const uebernehmen = el('button', { class: 'btn btn-primary btn-block', type: 'button' }, 'Übernehmen');
    host.appendChild(uebernehmen);

    let treffer = [];
    function aktualisiere() {
      treffer = auswahl.tacho === null || auswahl.tacho === undefined
        ? []
        : zeilenAusGitter(gitter, auswahl);
      const vorhandene = new Set(eintraege().map(e => Number(e.tacho)));
      const neue = treffer.filter(t2 => !vorhandene.has(t2.tacho));
      info.textContent = treffer.length
        ? `${treffer.length} Zeilen erkannt, davon ${neue.length} neu. `
          + `Tachostände von ${Math.min(...treffer.map(t2 => t2.tacho)).toLocaleString('de-DE')} `
          + `bis ${Math.max(...treffer.map(t2 => t2.tacho)).toLocaleString('de-DE')} km.`
        : 'Keine brauchbaren Zeilen – ohne Tachostand geht es nicht.';
      uebernehmen.disabled = neue.length === 0;
      uebernehmen.textContent = neue.length ? `${neue.length} Tankfüllungen übernehmen` : 'Nichts zu übernehmen';
    }

    uebernehmen.addEventListener('click', () => {
      // Schon vorhandene Tachostände überspringen, damit zweimaliges
      // Einfügen keine Doppelten anlegt.
      const vorhandene = new Set(eintraege().map(e => Number(e.tacho)));
      for (const t2 of treffer) {
        if (vorhandene.has(t2.tacho)) continue;
        vorhandene.add(t2.tacho);
        eintraege().push(createTankung(t2));
      }
      valueChange();
    });

    aktualisiere();
  }

  function renderEinstellungen() {
    clear(fixHost);
    fixHost.appendChild(el('p', { class: 'feld-hinweis' },
      'Was das Auto unabhängig vom Fahren kostet. Jahresbeträge – die App rechnet '
      + 'sie auf Monat und Kilometer herunter.'));

    for (const [key, label] of FIXKOSTEN_FELDER) {
      const row = el('label', { class: 'feld' });
      row.appendChild(el('span', { class: 'feld-label' }, label));
      const input = el('input', {
        type: 'number', min: '0', step: '10',
        value: einstellungen().fixkosten[key] || '',
        placeholder: '0',
      });
      input.addEventListener('input', () => {
        store.data.tanken.fixkosten[key] = Math.max(0, Number(input.value) || 0);
        store.commit({ silent: true });
        renderKpis(auswerten(eintraege(), einstellungen()));
      });
      const wrap = el('div', { class: 'feld-input' });
      wrap.append(input, el('span', { class: 'feld-einheit' }, '€/Jahr'));
      row.appendChild(wrap);
      fixHost.appendChild(row);
    }
  }

  function renderAll() {
    const a = auswerten(eintraege(), einstellungen());
    renderKpis(a);
    verbrauchsChart(chartHost, a);
    renderTabelle(a);
    renderFormular();
    renderEinstellungen();
    renderImport();
  }

  return { renderAll };
}
