// Stromverbrauch: du trägst Zählerstände ein, alles andere ergibt sich daraus.
//
// Ein Zählerstand allein sagt nichts - erst der Abstand zum vorherigen ergibt
// Verbrauch und Zeitraum. Deshalb ist jede Kennzahl hier eine Differenz
// zwischen zwei Ablesungen, nie ein einzelner Wert.

import { el, svg, clear, money, uid } from './util.js';

const zahl = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

const TAG_MS = 86400000;
const TAGE_JE_MONAT = 365.25 / 12;

export function createStand(vorlage = {}) {
  return {
    id: uid('st'),
    datum: new Date().toISOString().slice(0, 10),
    zaehler: 0,
    notiz: '',
    ...vorlage,
  };
}

const datumKurz = iso => new Date(iso).toLocaleDateString('de-DE', {
  day: '2-digit', month: '2-digit', year: '2-digit',
});

const dezimal = (v, stellen = 2) =>
  v === null || !Number.isFinite(v) ? '–' : v.toLocaleString('de-DE', {
    minimumFractionDigits: stellen, maximumFractionDigits: stellen,
  });

const kwh = v => (v === null || !Number.isFinite(v) ? '–' : `${dezimal(v, 0)} kWh`);

/* ----------------------------- Rechnen ----------------------------- */

// Aus den Zählerständen die Zeiträume dazwischen bilden und daraus
// hochrechnen, was der Strom im Monat und im Jahr kostet.
export function auswerten(staende, tarif = {}) {
  const arbeitspreis = zahl(tarif.arbeitspreis);
  const grundpreis = zahl(tarif.grundpreis);
  const abschlag = zahl(tarif.abschlag);

  const sortiert = [...(staende ?? [])]
    .filter(s => s && s.datum)
    .sort((a, b) => a.datum.localeCompare(b.datum));

  const perioden = [];
  for (let i = 1; i < sortiert.length; i++) {
    const von = sortiert[i - 1];
    const bis = sortiert[i];
    const tage = Math.round((new Date(bis.datum) - new Date(von.datum)) / TAG_MS);
    const verbrauch = zahl(bis.zaehler) - zahl(von.zaehler);
    // Ein gleiches Datum zweimal ergibt keine Zeitspanne, und ein
    // zurückgedrehter Zähler ist ein Tippfehler - beides nicht hochrechnen.
    const gueltig = tage > 0 && verbrauch >= 0;
    perioden.push({
      id: bis.id,
      von: von.datum,
      bis: bis.datum,
      tage,
      zaehler: zahl(bis.zaehler),
      verbrauch,
      gueltig,
      proTag: gueltig ? verbrauch / tage : null,
      kosten: gueltig
        ? verbrauch * arbeitspreis + (tage / TAGE_JE_MONAT) * grundpreis
        : null,
      notiz: String(bis.notiz ?? ''),
    });
  }

  const gueltige = perioden.filter(p => p.gueltig);
  const gesamtVerbrauch = gueltige.reduce((s, p) => s + p.verbrauch, 0);
  const gesamtTage = gueltige.reduce((s, p) => s + p.tage, 0);

  const proTag = gesamtTage > 0 ? gesamtVerbrauch / gesamtTage : null;
  const proMonat = proTag === null ? null : proTag * TAGE_JE_MONAT;
  const proJahr = proTag === null ? null : proTag * 365.25;

  // Der Grundpreis fällt unabhängig vom Verbrauch an, deshalb steht er
  // getrennt - sonst wirkt eine Sparmaßnahme wirksamer, als sie ist.
  const arbeitProMonat = proMonat === null ? null : proMonat * arbeitspreis;
  const kostenProMonat = arbeitProMonat === null ? null : arbeitProMonat + grundpreis;
  const kostenProJahr = kostenProMonat === null ? null : kostenProMonat * 12;

  // Positiv heißt: du zahlst mehr, als du verbrauchst - Guthaben.
  const differenz = kostenProMonat === null || abschlag <= 0
    ? null
    : abschlag - kostenProMonat;

  // Nur der letzte Zeitraum gegenüber dem Schnitt - zeigt, ob es gerade
  // besser oder schlechter läuft als sonst.
  const letzte = gueltige[gueltige.length - 1] ?? null;
  const trend = letzte && proTag !== null && gueltige.length > 1
    ? letzte.proTag - proTag
    : null;

  return {
    staende: sortiert,
    perioden,
    gueltige,
    gesamtVerbrauch,
    gesamtTage,
    proTag,
    proMonat,
    proJahr,
    arbeitspreis,
    grundpreis,
    abschlag,
    arbeitProMonat,
    kostenProMonat,
    kostenProJahr,
    differenz,
    trend,
    fehlerhaft: perioden.filter(p => !p.gueltig),
  };
}

/* ----------------------------- Anzeige ----------------------------- */

function kachel(label, wert, hint) {
  const box = el('div', { class: 'kpi' });
  box.append(el('span', { class: 'kpi-label' }, label), el('strong', { class: 'kpi-value' }, wert));
  if (hint) box.appendChild(el('span', { class: 'kpi-hint' }, hint));
  return box;
}

// Balken je Zeitraum: die Höhe ist der Verbrauch pro Tag, damit sich
// unterschiedlich lange Ablesezeiträume überhaupt vergleichen lassen.
function verbrauchsChart(host, a) {
  clear(host);
  if (!a.gueltige.length) {
    host.appendChild(el('p', { class: 'empty' },
      'Ab dem zweiten Zählerstand erscheint hier der Verlauf.'));
    return;
  }

  const width = 800, height = 200;
  const pad = { top: 16, right: 14, bottom: 30, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(...a.gueltige.map(p => p.proTag)) * 1.12 || 1;

  const breite = plotW / a.gueltige.length;
  const y = v => pad.top + plotH - (v / max) * plotH;

  const root = svg('svg', {
    width, height, viewBox: `0 0 ${width} ${height}`,
    'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  });
  root.appendChild(svg('rect', { x: 0, y: 0, width, height, fill: 'transparent', 'data-export-bg': '1' }));

  if (a.proTag !== null) {
    const yy = y(a.proTag);
    root.appendChild(svg('line', {
      x1: pad.left, x2: width - pad.right, y1: yy, y2: yy,
      stroke: 'currentColor', 'stroke-opacity': 0.25, 'stroke-dasharray': '4 4',
    }));
    root.appendChild(svg('text', {
      x: width - pad.right, y: yy - 6, 'text-anchor': 'end',
      'font-size': 10.5, fill: 'currentColor', opacity: 0.6,
    }, `Schnitt ${dezimal(a.proTag, 1)} kWh/Tag`));
  }

  for (const v of [max, max / 2]) {
    root.appendChild(svg('text', {
      x: pad.left - 8, y: y(v) + 4, 'text-anchor': 'end',
      'font-size': 10.5, fill: 'currentColor', opacity: 0.55,
    }, dezimal(v, 1)));
  }

  // Bei wenigen Ablesungen würden die Balken sonst fast das halbe Bild
  // füllen - deshalb eine Obergrenze, mittig im jeweiligen Abschnitt.
  const balkenBreite = Math.max(2, Math.min(54, breite * 0.7));

  a.gueltige.forEach((p, i) => {
    const x = pad.left + i * breite;
    const hoch = pad.top + plotH - y(p.proTag);
    const balken = svg('rect', {
      x: x + (breite - balkenBreite) / 2,
      y: y(p.proTag),
      width: balkenBreite,
      height: Math.max(1, hoch),
      rx: 3,
      fill: p.proTag > (a.proTag ?? 0) ? '#d97706' : '#2f6feb',
    });
    balken.appendChild(svg('title', {},
      `${datumKurz(p.von)} – ${datumKurz(p.bis)}: ${dezimal(p.proTag, 2)} kWh/Tag `
      + `(${kwh(p.verbrauch)} in ${p.tage} Tagen)`));
    root.appendChild(balken);

    // Nicht jede Ablesung beschriften, sonst klebt die Achse zu.
    if (a.gueltige.length <= 12 || i % Math.ceil(a.gueltige.length / 12) === 0) {
      root.appendChild(svg('text', {
        x: x + breite / 2, y: height - 10, 'text-anchor': 'middle',
        'font-size': 10, fill: 'currentColor', opacity: 0.55,
      }, datumKurz(p.bis)));
    }
  });

  host.appendChild(root);
}

export function createStromView({ kpiHost, chartHost, tabelleHost, formHost, tarifHost, store }) {
  const daten = () => store.data.strom;
  const staende = () => daten().staende;

  // Im leeren Formular soll kein Wert stehen, auch keine 0.
  const leererEntwurf = () => createStand({ zaehler: '' });
  let entwurf = leererEntwurf();

  function valueChange() {
    store.commit({ silent: true });
    renderAll();
  }

  /* ------------------------------ KPIs ------------------------------ */

  function renderKpis(a) {
    clear(kpiHost);

    const box = el('div', { class: 'kpis' });
    box.append(
      kachel('Verbrauch je Monat', kwh(a.proMonat),
        a.proTag === null ? 'zwei Zählerstände nötig' : `${dezimal(a.proTag, 1)} kWh am Tag`),
      kachel('Verbrauch je Jahr', kwh(a.proJahr),
        a.gesamtTage ? `aus ${a.gesamtTage} Tagen gerechnet` : ''),
      kachel('Kosten je Monat', a.kostenProMonat === null ? '–' : money(Math.round(a.kostenProMonat)),
        a.arbeitProMonat === null
          ? 'Tarif rechts eintragen'
          : `${money(Math.round(a.arbeitProMonat))} Strom + ${money(Math.round(a.grundpreis))} Grundpreis`),
      kachel('Kosten je Jahr', a.kostenProJahr === null ? '–' : money(Math.round(a.kostenProJahr)),
        a.arbeitspreis ? `${dezimal(a.arbeitspreis * 100, 1)} ct je kWh` : 'Arbeitspreis fehlt'),
    );

    if (a.abschlag > 0) {
      const d = a.differenz;
      box.appendChild(kachel(
        d === null ? 'Abschlag' : d >= 0 ? 'Guthaben je Monat' : 'Nachzahlung je Monat',
        d === null ? money(a.abschlag) : money(Math.round(Math.abs(d))),
        d === null
          ? 'Verbrauch fehlt noch'
          : `Abschlag ${money(Math.round(a.abschlag))} · hochgerechnet `
            + `${money(Math.round(Math.abs(d) * 12))} im Jahr`,
      ));
    }

    if (a.trend !== null && Math.abs(a.trend) >= 0.1) {
      box.appendChild(kachel(
        'Letzter Zeitraum',
        `${a.trend > 0 ? '+' : '−'}${dezimal(Math.abs(a.trend), 1)} kWh/Tag`,
        a.trend > 0 ? 'über dem Schnitt' : 'unter dem Schnitt',
      ));
    }

    kpiHost.appendChild(box);

    if (a.fehlerhaft.length) {
      kpiHost.appendChild(el('p', { class: 'feld-hinweis' },
        `${a.fehlerhaft.length === 1 ? 'Ein Zeitraum wird' : `${a.fehlerhaft.length} Zeiträume werden`} `
        + 'nicht mitgerechnet: der Zählerstand ist kleiner als der davor oder das Datum ist gleich. '
        + 'In der Tabelle sind sie durchgestrichen.'));
    }
  }

  /* ----------------------------- Tabelle ----------------------------- */

  function renderTabelle(a) {
    clear(tabelleHost);

    if (!staende().length) {
      tabelleHost.appendChild(el('p', { class: 'empty' },
        'Noch kein Zählerstand. Trag rechts den ersten ein – ab dem zweiten rechnet die Seite.'));
      return;
    }

    const tabelle = el('table', { class: 'tank-tabelle' });
    const kopf = el('thead');
    const kopfZeile = el('tr');
    for (const t of ['Datum', 'Zählerstand', 'Tage', 'Verbrauch', 'je Tag', 'Kosten', '']) {
      kopfZeile.appendChild(el('th', {}, t));
    }
    kopf.appendChild(kopfZeile);
    tabelle.appendChild(kopf);

    const koerper = el('tbody');
    // Neueste oben - danach sucht man beim Nachtragen.
    const nachId = new Map(a.perioden.map(p => [p.id, p]));
    for (const s of [...a.staende].reverse()) {
      const p = nachId.get(s.id) ?? null;
      const zeile = el('tr', p && !p.gueltig ? { class: 'ist-ungueltig' } : {});

      zeile.appendChild(el('td', {}, datumKurz(s.datum)));
      zeile.appendChild(el('td', {}, `${dezimal(zahl(s.zaehler), 0)} kWh`));
      zeile.appendChild(el('td', {}, p ? String(p.tage) : '–'));
      zeile.appendChild(el('td', {}, p ? kwh(p.verbrauch) : 'Startwert'));
      zeile.appendChild(el('td', {}, p && p.gueltig ? dezimal(p.proTag, 2) : '–'));
      zeile.appendChild(el('td', {}, p && p.kosten !== null ? money(Math.round(p.kosten)) : '–'));

      const weg = el('button', { class: 'link-btn', type: 'button', title: 'Löschen' }, '✕');
      weg.addEventListener('click', () => {
        daten().staende = staende().filter(x => x.id !== s.id);
        valueChange();
      });
      const letzteZelle = el('td');
      letzteZelle.appendChild(weg);
      zeile.appendChild(letzteZelle);

      if (s.notiz) zeile.title = s.notiz;
      koerper.appendChild(zeile);
    }
    tabelle.appendChild(koerper);
    tabelleHost.appendChild(tabelle);
  }

  /* ---------------------------- Eingabe ---------------------------- */

  function feld(host, obj, key, label, attrs = {}, onChange) {
    const row = el('label', { class: 'feld' });
    row.appendChild(el('span', { class: 'feld-label' }, label));
    const input = el('input', { value: obj[key] ?? '', ...attrs });
    input.addEventListener('input', () => {
      if (onChange) onChange(input.value);
      else obj[key] = input.value;
    });
    const wrap = el('div', { class: 'feld-input' });
    wrap.appendChild(input);
    if (attrs['data-einheit']) wrap.appendChild(el('span', { class: 'feld-einheit' }, attrs['data-einheit']));
    row.appendChild(wrap);
    host.appendChild(row);
    return input;
  }

  function renderFormular(a) {
    clear(formHost);
    const letzter = a.staende[a.staende.length - 1] ?? null;

    feld(formHost, entwurf, 'datum', 'Abgelesen am', { type: 'date' });
    feld(formHost, entwurf, 'zaehler', 'Zählerstand',
      { type: 'number', min: '0', step: '1', 'data-einheit': 'kWh' });

    if (letzter) {
      formHost.appendChild(el('p', { class: 'feld-hinweis' },
        `Letzter Stand: ${dezimal(zahl(letzter.zaehler), 0)} kWh am ${datumKurz(letzter.datum)}.`));
    } else {
      formHost.appendChild(el('p', { class: 'feld-hinweis' },
        'Der erste Stand ist nur der Startwert. Gerechnet wird ab dem zweiten.'));
    }

    const notizRow = el('label', { class: 'feld feld-breit' });
    notizRow.appendChild(el('span', { class: 'feld-label' }, 'Notiz (optional)'));
    const notiz = el('input', {
      type: 'text', value: entwurf.notiz, placeholder: 'z. B. Jahresablesung, neuer Kühlschrank',
    });
    notiz.addEventListener('input', () => { entwurf.notiz = notiz.value; });
    notizRow.appendChild(notiz);
    formHost.appendChild(notizRow);

    const fehler = el('p', { class: 'msg is-error', hidden: true });
    formHost.appendChild(fehler);

    const knopf = el('button', { class: 'btn btn-primary btn-block', type: 'button' }, 'Zählerstand eintragen');
    knopf.addEventListener('click', () => {
      const stand = zahl(entwurf.zaehler);
      let text = '';
      if (!entwurf.datum) text = 'Bitte das Ablesedatum eintragen.';
      else if (stand <= 0) text = 'Bitte den Zählerstand eintragen.';
      else if (staende().some(s => s.datum === entwurf.datum)) {
        text = 'Für dieses Datum gibt es schon einen Stand.';
      } else if (letzter && entwurf.datum > letzter.datum && stand < zahl(letzter.zaehler)) {
        text = `Der Zähler kann nicht zurücklaufen – zuletzt ${dezimal(zahl(letzter.zaehler), 0)} kWh.`;
      }
      if (text) {
        fehler.textContent = text;
        fehler.hidden = false;
        return;
      }
      staende().push(createStand({
        datum: entwurf.datum,
        zaehler: stand,
        notiz: entwurf.notiz.trim(),
      }));
      entwurf = leererEntwurf();
      valueChange();
    });
    formHost.appendChild(knopf);
  }

  function renderTarif(a) {
    clear(tarifHost);
    const t = daten().tarif;

    // Der Arbeitspreis steht auf der Rechnung in Cent, nicht in Euro -
    // also wird er auch so abgefragt und nur intern umgerechnet.
    feld(tarifHost, {}, 'arbeitspreis', 'Arbeitspreis', {
      type: 'number', min: '0', step: '0.1', 'data-einheit': 'ct/kWh',
      value: t.arbeitspreis ? Math.round(t.arbeitspreis * 1000) / 10 : '',
    }, v => { t.arbeitspreis = zahl(v) / 100; store.commit({ silent: true }); renderAbgeleitet(); });

    feld(tarifHost, {}, 'grundpreis', 'Grundpreis', {
      type: 'number', min: '0', step: '0.01', 'data-einheit': '€/Monat', value: t.grundpreis || '',
    }, v => { t.grundpreis = zahl(v); store.commit({ silent: true }); renderAbgeleitet(); });

    feld(tarifHost, {}, 'abschlag', 'Dein Abschlag', {
      type: 'number', min: '0', step: '1', 'data-einheit': '€/Monat', value: t.abschlag || '',
    }, v => { t.abschlag = zahl(v); store.commit({ silent: true }); renderAbgeleitet(); });

    tarifHost.appendChild(el('p', { class: 'feld-hinweis' },
      a.kostenProJahr === null
        ? 'Alles drei steht auf deiner Stromrechnung. Der Abschlag ist optional.'
        : `${dezimal(a.proJahr, 0)} kWh im Jahr zu ${dezimal(a.arbeitspreis * 100, 1)} ct `
          + `ergeben ${money(Math.round(a.kostenProJahr))} im Jahr.`));
  }

  // Tarifänderungen dürfen die Eingabefelder nicht neu aufbauen, sonst
  // springt der Fokus beim Tippen raus.
  function renderAbgeleitet() {
    const a = auswerten(staende(), daten().tarif);
    renderKpis(a);
    verbrauchsChart(chartHost, a);
    renderTabelle(a);
  }

  function renderAll() {
    const a = auswerten(staende(), daten().tarif);
    renderKpis(a);
    verbrauchsChart(chartHost, a);
    renderTabelle(a);
    renderFormular(a);
    renderTarif(a);
  }

  return { renderAll };
}
