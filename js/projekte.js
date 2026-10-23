// Projektplanung: Aufgaben mit Dauer und Reihenfolge, daraus ein Gantt.

import { el, svg, clear, uid, isoDatum } from './util.js';
import {
  planen, createProjekt, createAufgabe, moeglicheVorgaenger,
  tageZwischen, datumPlus, STATUS, statusVon,
} from './projekte-logik.js';

const zahl = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

const kurz = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', {
  day: '2-digit', month: '2-digit',
});
const lang = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function kachel(label, wert, hint) {
  const box = el('div', { class: 'kpi' });
  box.append(el('span', { class: 'kpi-label' }, label), el('strong', { class: 'kpi-value' }, wert));
  if (hint) box.appendChild(el('span', { class: 'kpi-hint' }, hint));
  return box;
}

/* ------------------------------- Gantt ------------------------------- */

const ZEILE = 34;
const KOPF = 44;

function gantt(host, plan, { onTippen } = {}) {
  clear(host);

  if (!plan.aufgaben.length) {
    host.appendChild(el('p', { class: 'empty' },
      'Noch keine Aufgabe. Trag rechts die erste ein – Dauer genügt, '
      + 'die Termine rechnet die Seite.'));
    return;
  }

  // Ein paar Tage Luft an beiden Enden, damit Balken nicht am Rand kleben.
  const von = datumPlus(plan.start, -2);
  const bis = datumPlus(plan.ende, 3);
  const tage = tageZwischen(von, bis) + 1;

  // Je weniger Tage, desto breiter darf ein Tag sein - sonst wird ein
  // Zweiwochenprojekt zu einem Strich in der linken Ecke.
  const proTag = Math.max(7, Math.min(34, Math.round(1100 / tage)));
  const breite = tage * proTag;
  const hoehe = KOPF + plan.aufgaben.length * ZEILE + 12;

  const x = iso => tageZwischen(von, iso) * proTag;

  // Die Namen stehen in einer eigenen, feststehenden Spalte daneben. Scrollt
  // man im Zeitplan nach rechts, weiß man sonst nach drei Wochen nicht mehr,
  // welche Zeile welche Aufgabe ist.
  const wrap = el('div', { class: 'gantt-wrap' });
  const namen = el('div', { class: 'gantt-namen' });
  namen.appendChild(el('div', { class: 'gantt-namen-kopf', style: `height: ${KOPF}px` }, 'Aufgabe'));
  plan.aufgaben.forEach((a, i) => {
    const zeile = el('div', {
      class: 'gantt-name' + (i % 2 ? ' ist-grau' : ''),
      style: `height: ${ZEILE}px; --status: ${STATUS[a.status].farbe}`,
      title: a.name,
    });
    zeile.append(el('span', { class: 'gantt-name-punkt' }), el('span', {}, a.name));
    if (onTippen) {
      zeile.classList.add('ist-klickbar');
      zeile.addEventListener('click', () => onTippen(a.id));
    }
    namen.appendChild(zeile);
  });
  wrap.appendChild(namen);

  const root = svg('svg', {
    width: breite, height: hoehe, viewBox: `0 0 ${breite} ${hoehe}`,
    'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    class: 'gantt',
  });
  root.appendChild(svg('rect', { x: 0, y: 0, width: breite, height: hoehe, fill: 'transparent', 'data-export-bg': '1' }));

  /* Kopfzeile: Monate oben, Tage darunter */
  let letzterMonat = '';
  for (let i = 0; i < tage; i++) {
    const iso = datumPlus(von, i);
    const d = new Date(`${iso}T12:00:00`);
    const wochenende = d.getDay() === 0 || d.getDay() === 6;
    const xx = i * proTag;

    if (wochenende) {
      root.appendChild(svg('rect', {
        x: xx, y: KOPF, width: proTag, height: hoehe - KOPF - 12,
        fill: 'currentColor', opacity: 0.05,
      }));
    }

    const monat = `${d.getMonth()}-${d.getFullYear()}`;
    if (monat !== letzterMonat) {
      letzterMonat = monat;
      root.appendChild(svg('text', {
        x: xx + 3, y: 14, 'font-size': 11, 'font-weight': 650,
        fill: 'currentColor', opacity: 0.75,
      }, `${MONATE[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`));
      root.appendChild(svg('line', {
        x1: xx, x2: xx, y1: 4, y2: hoehe - 12,
        stroke: 'currentColor', 'stroke-opacity': 0.18,
      }));
    }

    // Tageszahlen nur, wenn genug Platz ist.
    if (proTag >= 16 || d.getDate() === 1 || d.getDate() % 5 === 0) {
      root.appendChild(svg('text', {
        x: xx + proTag / 2, y: 34, 'text-anchor': 'middle', 'font-size': 9.5,
        fill: 'currentColor', opacity: wochenende ? 0.35 : 0.6,
      }, String(d.getDate())));
    }
  }

  root.appendChild(svg('line', {
    x1: 0, x2: breite, y1: KOPF, y2: KOPF,
    stroke: 'currentColor', 'stroke-opacity': 0.25,
  }));

  /* Heute-Linie */
  if (plan.heute >= von && plan.heute <= bis) {
    const hx = x(plan.heute) + proTag / 2;
    root.appendChild(svg('line', {
      x1: hx, x2: hx, y1: KOPF - 10, y2: hoehe - 12,
      stroke: '#dc2626', 'stroke-width': 1.6, 'stroke-dasharray': '4 3',
    }));
    root.appendChild(svg('text', {
      x: hx + 4, y: KOPF - 13, 'font-size': 9.5, fill: '#dc2626', 'font-weight': 650,
    }, 'heute'));
  }

  /* Abhängigkeitspfeile zuerst, damit die Balken darüber liegen */
  const nachId = new Map(plan.aufgaben.map((a, i) => [a.id, { a, i }]));
  for (const [i, a] of plan.aufgaben.entries()) {
    if (!a.nach || !nachId.has(a.nach)) continue;
    const vor = nachId.get(a.nach);
    const x1 = x(vor.a.ende) + proTag - 3;
    const y1 = KOPF + vor.i * ZEILE + ZEILE / 2;
    const x2 = x(a.start) + 1;
    const y2 = KOPF + i * ZEILE + ZEILE / 2;
    const mx = Math.max(x1 + 7, x2 - 9);
    root.appendChild(svg('path', {
      d: `M${x1},${y1} H${mx} V${y2} H${x2}`,
      fill: 'none', stroke: 'currentColor', 'stroke-opacity': 0.38, 'stroke-width': 1.3,
    }));
    root.appendChild(svg('path', {
      d: `M${x2},${y2} l-5,-3.2 v6.4 Z`,
      fill: 'currentColor', 'stroke-opacity': 0, opacity: 0.45,
    }));
  }

  /* Zeilen */
  plan.aufgaben.forEach((a, i) => {
    const y = KOPF + i * ZEILE;
    const farbe = STATUS[a.status].farbe;
    const ueberfaellig = a.ende < plan.heute && a.status !== 'fertig';

    const gruppe = svg('g', { class: 'gantt-zeile' });
    if (onTippen) {
      gruppe.setAttribute('data-aufgabe', a.id);
      gruppe.classList.add('ist-klickbar');
    }

    gruppe.appendChild(svg('rect', {
      x: 0, y, width: breite, height: ZEILE,
      fill: i % 2 ? 'currentColor' : 'transparent', opacity: i % 2 ? 0.025 : 0,
    }));

    const bx = x(a.start);
    const bw = Math.max(proTag, (tageZwischen(a.start, a.ende) + 1) * proTag);
    const by = y + 7;
    const bh = ZEILE - 14;

    gruppe.appendChild(svg('rect', {
      x: bx, y: by, width: bw, height: bh, rx: 4,
      fill: farbe, opacity: 0.22,
      stroke: ueberfaellig ? '#dc2626' : farbe,
      'stroke-width': ueberfaellig ? 1.6 : 1,
    }));

    const anteil = Math.min(100, Math.max(0, zahl(a.fortschritt))) / 100;
    if (anteil > 0) {
      gruppe.appendChild(svg('rect', {
        x: bx, y: by, width: Math.max(2, bw * anteil), height: bh, rx: 4, fill: farbe,
      }));
    }

    // Beschriftung außerhalb, wenn der Balken zu schmal ist.
    const innen = bw > 58;
    gruppe.appendChild(svg('text', {
      x: innen ? bx + 6 : bx + bw + 6,
      y: by + bh / 2 + 3.5,
      'font-size': 10,
      'font-weight': 600,
      fill: innen && anteil > 0.35 ? '#fff' : 'currentColor',
      opacity: innen && anteil > 0.35 ? 1 : 0.7,
    }, `${a.dauer} T${a.person ? ` · ${a.person}` : ''}`));

    gruppe.appendChild(svg('title', {}, [
      a.name,
      `${lang(a.start)} – ${lang(a.ende)} (${a.dauer} Tage)`,
      `${STATUS[a.status].label}, ${Math.round(zahl(a.fortschritt))} %`,
      a.person ? `Zuständig: ${a.person}` : '',
      ueberfaellig ? 'Termin überschritten' : '',
    ].filter(Boolean).join('\n')));

    root.appendChild(gruppe);
  });

  if (onTippen) {
    root.addEventListener('click', ev => {
      const g = ev.target.closest('[data-aufgabe]');
      if (g) onTippen(g.dataset.aufgabe);
    });
  }

  const scroller = el('div', { class: 'gantt-scroll' });
  scroller.appendChild(root);
  wrap.appendChild(scroller);
  host.appendChild(wrap);
}

/* -------------------------------- View -------------------------------- */

export function createProjekteView({ kpiHost, chartHost, listeHost, seiteHost, store }) {
  const daten = () => store.data.projekte;
  const aktiv = () => daten().items.find(p => p.id === daten().activeId) ?? daten().items[0] ?? null;

  // Welche Aufgabe im Editor hervorgehoben ist.
  let markiert = null;

  function aenderung() {
    store.commit({ silent: true });
    renderAll();
  }

  /* ------------------------------ Kopf ------------------------------ */

  function renderKpis(p, plan) {
    clear(kpiHost);

    const leiste = el('div', { class: 'projekt-leiste' });
    for (const x of daten().items) {
      const b = el('button', {
        type: 'button', class: 'pill' + (x.id === p?.id ? ' is-active' : ''),
      }, x.name);
      b.addEventListener('click', () => { daten().activeId = x.id; markiert = null; aenderung(); });
      leiste.appendChild(b);
    }
    const neu = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, '+ Projekt');
    neu.addEventListener('click', () => {
      const projekt = createProjekt(`Projekt ${daten().items.length + 1}`);
      daten().items.push(projekt);
      daten().activeId = projekt.id;
      aenderung();
    });
    leiste.appendChild(neu);
    kpiHost.appendChild(leiste);

    if (!p) return;

    const box = el('div', { class: 'kpis' });
    box.append(
      kachel('Fertig', `${plan.fortschritt} %`,
        `${plan.aufgaben.filter(a => a.status === 'fertig').length} von ${plan.aufgaben.length} Aufgaben`),
      kachel('Start', plan.aufgaben.length ? kurz(plan.start) : '–',
        plan.nurWerktage ? 'nur Werktage' : 'auch Wochenende'),
      kachel('Fertig am', plan.aufgaben.length ? lang(plan.ende) : '–',
        plan.tage ? `${plan.tage} Kalendertage` : ''),
      kachel('Aufwand', `${plan.arbeitstage} Tage`, 'alle Aufgaben zusammen'),
    );
    if (plan.ueberfaellig.length) {
      box.appendChild(kachel('Überfällig', String(plan.ueberfaellig.length),
        plan.ueberfaellig.map(a => a.name).join(', ')));
    }
    kpiHost.appendChild(box);

    if (plan.imRing.length) {
      kpiHost.appendChild(el('p', { class: 'msg is-error' },
        `Diese Aufgaben warten im Kreis aufeinander und lassen sich nicht einplanen: `
        + `${plan.imRing.join(', ')}. Lös eine der Abhängigkeiten auf.`));
    }
  }

  /* ------------------------------ Liste ------------------------------ */

  function renderListe(p, plan) {
    clear(listeHost);
    if (!p || !plan.aufgaben.length) return;

    listeHost.appendChild(el('div', { class: 'immo-chart-head' }, 'Aufgaben nach Status'));

    const spalten = el('div', { class: 'planner' });
    for (const [key, meta] of Object.entries(STATUS)) {
      const liste = plan.aufgaben.filter(a => a.status === key);
      const spalte = el('div', { class: 'planner-spalte', style: `--status: ${meta.farbe}` });
      const kopf = el('div', { class: 'planner-kopf' });
      kopf.append(el('strong', {}, meta.label), el('span', {}, String(liste.length)));
      spalte.appendChild(kopf);

      for (const a of liste) {
        const karte = el('button', {
          type: 'button',
          class: 'planner-karte' + (markiert === a.id ? ' ist-markiert' : ''),
        });
        karte.appendChild(el('strong', {}, a.name));
        karte.appendChild(el('span', { class: 'planner-zeit' },
          `${kurz(a.start)} – ${kurz(a.ende)} · ${a.dauer} T`));
        if (a.person) karte.appendChild(el('span', { class: 'planner-person' }, a.person));
        if (a.ende < plan.heute && a.status !== 'fertig') {
          karte.appendChild(el('span', { class: 'planner-spaet' }, 'Termin überschritten'));
        }
        karte.addEventListener('click', () => { markiert = a.id; renderAll(); });
        spalte.appendChild(karte);
      }

      if (!liste.length) spalte.appendChild(el('p', { class: 'planner-leer' }, '–'));
      spalten.appendChild(spalte);
    }
    listeHost.appendChild(spalten);
  }

  /* ------------------------------ Seite ------------------------------ */

  function feld(host, label, attrs, onChange, einheit) {
    const row = el('label', { class: 'feld' });
    row.appendChild(el('span', { class: 'feld-label' }, label));
    const input = el('input', attrs);
    input.addEventListener('change', () => onChange(input.value));
    const wrap = el('div', { class: 'feld-input' });
    wrap.appendChild(input);
    if (einheit) wrap.appendChild(el('span', { class: 'feld-einheit' }, einheit));
    row.appendChild(wrap);
    host.appendChild(row);
    return input;
  }

  function renderSeite(p, plan) {
    clear(seiteHost);
    if (!p) {
      seiteHost.appendChild(el('p', { class: 'empty' }, 'Leg links ein Projekt an.'));
      return;
    }

    const kopf = el('div', { class: 'editor-head' });
    kopf.appendChild(el('h2', {}, 'Projekt'));
    const weg = el('button', { class: 'link-btn', type: 'button' }, 'Löschen');
    weg.addEventListener('click', () => {
      if (!window.confirm(`„${p.name}" mit ${p.aufgaben.length} Aufgaben löschen?`)) return;
      daten().items = daten().items.filter(x => x.id !== p.id);
      daten().activeId = daten().items[0]?.id ?? null;
      aenderung();
    });
    kopf.appendChild(weg);
    seiteHost.appendChild(kopf);

    const name = el('input', { type: 'text', value: p.name, 'aria-label': 'Projektname' });
    name.addEventListener('input', () => { p.name = name.value; store.commit({ silent: true }); });
    name.addEventListener('change', aenderung);
    const nameRow = el('label', { class: 'feld feld-breit' });
    nameRow.append(el('span', { class: 'feld-label' }, 'Name'), name);
    seiteHost.appendChild(nameRow);

    feld(seiteHost, 'Projektstart', { type: 'date', value: p.start },
      v => { if (v) { p.start = v; aenderung(); } });

    const werk = el('label', { class: 'feld feld-breit projekt-schalter' });
    const haken = el('input', { type: 'checkbox' });
    haken.checked = p.nurWerktage;
    haken.addEventListener('change', () => { p.nurWerktage = haken.checked; aenderung(); });
    werk.append(haken, el('span', {}, 'Nur Werktage rechnen (Sa/So überspringen)'));
    seiteHost.appendChild(werk);

    const kopf2 = el('div', { class: 'editor-head editor-head-sep' });
    kopf2.appendChild(el('h2', {}, 'Aufgaben'));
    const neu = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, '+ Aufgabe');
    neu.addEventListener('click', () => {
      const letzte = p.aufgaben[p.aufgaben.length - 1];
      const a = createAufgabe({ nach: letzte?.id ?? null });
      p.aufgaben.push(a);
      markiert = a.id;
      aenderung();
    });
    kopf2.appendChild(neu);
    seiteHost.appendChild(kopf2);

    const liste = el('div', { class: 'rows' });
    for (const a of p.aufgaben) liste.appendChild(aufgabeZeile(p, a, plan));
    seiteHost.appendChild(liste);
  }

  function aufgabeZeile(p, a, plan) {
    const gerechnet = plan.aufgaben.find(x => x.id === a.id) ?? null;
    const box = el('div', {
      class: 'row row-aufgabe' + (markiert === a.id ? ' ist-markiert' : ''),
      style: `--status: ${STATUS[statusVon(a)].farbe}`,
    });

    const name = el('input', { type: 'text', value: a.name, class: 'aufgabe-name', 'aria-label': 'Aufgabe' });
    name.addEventListener('input', () => { a.name = name.value; store.commit({ silent: true }); });
    name.addEventListener('change', aenderung);
    name.addEventListener('focus', () => { markiert = a.id; });

    const weg = el('button', { class: 'link-btn', type: 'button', title: 'Aufgabe löschen' }, '✕');
    weg.addEventListener('click', () => {
      // Nachfolger hängen sonst ins Leere - sie rücken an die freie Stelle.
      for (const x of p.aufgaben) if (x.nach === a.id) x.nach = a.nach;
      p.aufgaben = p.aufgaben.filter(x => x.id !== a.id);
      if (markiert === a.id) markiert = null;
      aenderung();
    });
    box.append(name, weg);

    const dauer = el('input', {
      type: 'number', min: '1', max: '365', step: '1', value: a.dauer,
      'aria-label': 'Dauer in Tagen', title: 'Dauer in Tagen',
    });
    dauer.addEventListener('change', () => {
      a.dauer = Math.max(1, Math.round(zahl(dauer.value)) || 1);
      aenderung();
    });
    const dauerFeld = el('label', { class: 'gym-mini' });
    dauerFeld.append(el('span', {}, 'Dauer'), dauer, el('span', {}, 'Tage'));
    box.appendChild(dauerFeld);

    const fort = el('input', {
      type: 'number', min: '0', max: '100', step: '10', value: Math.round(zahl(a.fortschritt)),
      'aria-label': 'Fortschritt', title: 'Fortschritt in Prozent',
    });
    fort.addEventListener('change', () => {
      a.fortschritt = Math.min(100, Math.max(0, Math.round(zahl(fort.value))));
      aenderung();
    });
    const fortFeld = el('label', { class: 'gym-mini' });
    fortFeld.append(el('span', {}, 'Fertig'), fort, el('span', {}, '%'));
    box.appendChild(fortFeld);

    const nach = el('select', { 'aria-label': 'Folgt auf' });
    nach.appendChild(el('option', { value: '' }, 'startet am Projektbeginn'));
    for (const v of moeglicheVorgaenger(p.aufgaben, a.id)) {
      const opt = el('option', { value: v.id }, `nach: ${v.name}`);
      if (a.nach === v.id) opt.selected = true;
      nach.appendChild(opt);
    }
    nach.addEventListener('change', () => { a.nach = nach.value || null; aenderung(); });
    box.appendChild(nach);

    const person = el('input', {
      type: 'text', value: a.person, placeholder: 'Zuständig (optional)', 'aria-label': 'Zuständig',
    });
    person.addEventListener('input', () => { a.person = person.value; store.commit({ silent: true }); });
    person.addEventListener('change', aenderung);
    box.appendChild(person);

    if (gerechnet) {
      box.appendChild(el('span', { class: 'aufgabe-termin' },
        `${lang(gerechnet.start)} – ${lang(gerechnet.ende)}`));
    } else {
      box.appendChild(el('span', { class: 'aufgabe-termin ist-fehler' },
        'hängt im Kreis, kein Termin'));
    }

    return box;
  }

  function renderAll() {
    const p = aktiv();
    if (p && daten().activeId !== p.id) daten().activeId = p.id;
    const plan = planen(p);
    renderKpis(p, plan);
    gantt(chartHost, plan, { onTippen: id => { markiert = id; renderAll(); } });
    renderListe(p, plan);
    renderSeite(p, plan);
  }

  return { renderAll };
}
