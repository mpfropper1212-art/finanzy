// Startseite: der Nutzer entscheidet, was hier steht. Die Kacheln zeigen je
// Bereich die eine Zahl, die dort zählt - alles Übrige hängt im Bereichsmenü.

import { el, money, clear, isoDatum } from './util.js';
import { symbolSvg, wortmarke } from './logo.js';
import { netWorth } from './accounts.js';
import { berechne } from './immobilien.js';
import { auswerten } from './tanken.js';
import { auswerten as stromAuswerten } from './strom.js';
import { auswerten as gymAuswerten, formatGewicht } from './gym-logik.js';
import { SEED_GERICHTE } from './gerichte-daten.js';
import { auswerten as schuldenAuswerten } from './schulden.js';
import { salden, ausgleich } from './gruppen.js';
import { HUB_ID } from './store.js';
import { renderNachrichten } from './nachrichten.js';
import { createMuenze } from './muenze.js';
import { createHabitWidget, serie } from './habits.js';
import { BEREICHE, WIDGETS, bereichZu } from './bereiche.js';
import { planen } from './projekte-logik.js';

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
  const strom = stromAuswerten(data.strom.staende, data.strom.tarif);
  const gym = gymAuswerten(data.gym);

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
    pdf: { wert: 'Werkzeug', zusatz: 'läuft ganz in deinem Browser' },
    projekte: (() => {
      const liste = data.projekte.items;
      const p = liste.find(x => x.id === data.projekte.activeId) ?? liste[0];
      if (!p) return { wert: '–', zusatz: 'kein Projekt angelegt' };
      const plan = planen(p);
      return {
        wert: `${plan.fortschritt} %`,
        zusatz: plan.aufgaben.length
          ? `${p.name} · fertig am ${new Date(`${plan.ende}T12:00:00`).toLocaleDateString('de-DE')}`
          : `${p.name} · noch keine Aufgabe`,
      };
    })(),
    habits: (() => {
      const items = data.habits.items;
      if (!items.length) return { wert: '–', zusatz: 'noch keine angelegt' };
      const heute = isoDatum();
      const offen = items.filter(h => !h.tage.includes(heute)).length;
      const beste = Math.max(...items.map(h => serie(h)));
      return {
        wert: offen ? `${offen} offen` : 'alles erledigt',
        zusatz: `${items.length} Gewohnheiten · längste Serie ${beste} Tage`,
      };
    })(),
    gym: {
      wert: gym.aktiv ? 'läuft gerade' : gym.anzahl ? `${gym.proMonat} in 4 Wochen` : 'noch keins',
      zusatz: gym.letztesVolumen === null
        ? `${data.gym.uebungen.length} Übungen angelegt`
        : `zuletzt ${formatGewicht(gym.letztesVolumen)} kg bewegt`,
    },
    strom: {
      wert: strom.kostenProMonat === null ? '–' : `${money(Math.round(strom.kostenProMonat))} / Monat`,
      zusatz: strom.proMonat === null
        ? `${data.strom.staende.length} Zählerstände erfasst`
        : `${dezimal(strom.proMonat, 0)} kWh im Monat`,
    },
    tanken: {
      wert: tank.verbrauch === null ? '–' : `${dezimal(tank.verbrauch)} l`,
      zusatz: tank.zeilen.length
        ? `je 100 km · ${tank.summeKm.toLocaleString('de-DE')} km erfasst`
        : 'noch keine Tankfüllung',
    },
  };
}

export function createDashboard({ host, store, onOeffne, onLayout }) {
  let anpassen = false;

  const einstellung = () => store.data.start;

  function speichern() {
    store.commit({ silent: true });
    // Die Reiterleiste hängt an denselben Einstellungen und muss mit.
    onLayout?.();
    renderAll();
  }

  /* ---------------------------- Kacheln ---------------------------- */

  function kartenBlock(zahlen) {
    const gewaehlt = einstellung().karten.map(bereichZu).filter(Boolean);

    const gitter = el('div', { class: 'dash-gitter' });
    for (const b of gewaehlt) {
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

    // Eine gestrichelte Kachel am Ende: so sieht man überhaupt erst, dass
    // sich die Startseite zusammenstellen lässt.
    if (gewaehlt.length < BEREICHE.length) {
      const mehr = el('button', { type: 'button', class: 'dash-karte dash-karte-mehr' });
      mehr.append(
        el('span', { class: 'dash-plus' }, '+'),
        el('strong', {}, 'Bereich hinzufügen'),
        el('span', { class: 'dash-karte-text' },
          `${BEREICHE.length - gewaehlt.length} weitere stehen zur Auswahl`),
      );
      mehr.addEventListener('click', () => { anpassen = true; renderAll(); });
      gitter.appendChild(mehr);
    }
    return gitter;
  }

  /* -------------------------- Anpassen-Modus -------------------------- */

  // Haken und Pfeile. Dieselbe Mechanik für Startblöcke, Kacheln und Reiter -
  // nur die Quelle und ein paar Regeln unterscheiden sich.
  function auswahlListe({ alle, schluessel, titel, hinweis, sortierbar = false, maximum = null }) {
    const gewaehlt = einstellung()[schluessel];
    const block = el('div', { class: 'anpassen-block' });
    block.appendChild(el('h4', {}, titel));
    if (hinweis) block.appendChild(el('p', { class: 'anpassen-hinweis' }, hinweis));

    const liste = el('div', { class: 'anpassen-liste' });

    // Gewähltes zuerst in seiner Reihenfolge, der Rest danach - sonst springt
    // ein Eintrag beim Anhaken quer durch die Liste.
    const sortiert = [
      ...gewaehlt.map(id => alle.find(x => x.id === id)).filter(Boolean),
      ...alle.filter(x => !gewaehlt.includes(x.id)),
    ];

    for (const eintrag of sortiert) {
      const an = gewaehlt.includes(eintrag.id);
      const zeile = el('div', { class: 'anpassen-zeile' + (an ? ' ist-an' : '') });

      const feld = el('label', { class: 'anpassen-wahl' });
      const haken = el('input', { type: 'checkbox' });
      haken.checked = an;
      haken.addEventListener('change', () => {
        const l = einstellung()[schluessel];
        if (haken.checked) {
          if (maximum && l.length >= maximum) {
            haken.checked = false;
            window.alert(`Hier passen höchstens ${maximum} Einträge rein. Nimm zuerst einen raus.`);
            return;
          }
          l.push(eintrag.id);
        } else {
          einstellung()[schluessel] = l.filter(x => x !== eintrag.id);
        }
        speichern();
      });

      feld.append(haken, el('span', { class: 'anpassen-name' }, eintrag.titel));
      if (eintrag.text) feld.appendChild(el('span', { class: 'anpassen-text' }, eintrag.text));
      zeile.appendChild(feld);

      if (sortierbar && an) {
        const i = gewaehlt.indexOf(eintrag.id);
        const schieben = richtung => {
          const l = einstellung()[schluessel];
          const j = i + richtung;
          if (j < 0 || j >= l.length) return;
          [l[i], l[j]] = [l[j], l[i]];
          speichern();
        };
        const pfeile = el('span', { class: 'anpassen-pfeile' });
        const hoch = el('button', { class: 'link-btn', type: 'button', title: 'Nach oben' }, '↑');
        hoch.disabled = i === 0;
        hoch.addEventListener('click', () => schieben(-1));
        const runter = el('button', { class: 'link-btn', type: 'button', title: 'Nach unten' }, '↓');
        runter.disabled = i === gewaehlt.length - 1;
        runter.addEventListener('click', () => schieben(1));
        pfeile.append(hoch, runter);
        zeile.appendChild(pfeile);
      }

      liste.appendChild(zeile);
    }

    block.appendChild(liste);
    return block;
  }

  function anpassenPanel() {
    const panel = el('section', { class: 'anpassen' });
    const bereichsListe = () => BEREICHE.map(b => ({ id: b.tab, titel: b.titel }));

    panel.appendChild(auswahlListe({
      alle: WIDGETS,
      schluessel: 'widgets',
      titel: 'Was auf der Startseite steht',
      hinweis: 'Von oben nach unten, Reihenfolge über die Pfeile.',
      sortierbar: true,
    }));

    panel.appendChild(auswahlListe({
      alle: bereichsListe(),
      schluessel: 'karten',
      titel: 'Welche Bereiche als Kachel',
      hinweis: 'Erscheinen in dieser Reihenfolge.',
      sortierbar: true,
    }));

    panel.appendChild(auswahlListe({
      alle: bereichsListe(),
      schluessel: 'favoriten',
      titel: 'Reiter oben in der Leiste',
      hinweis: 'Höchstens fünf. Alles andere bleibt über „Bereiche" erreichbar.',
      maximum: 5,
    }));

    const sonst = el('div', { class: 'anpassen-block' });
    sonst.appendChild(el('h4', {}, 'Sonstiges'));
    const zeile = el('div', { class: 'anpassen-zeile' + (einstellung().muenze ? ' ist-an' : '') });
    const feld = el('label', { class: 'anpassen-wahl' });
    const haken = el('input', { type: 'checkbox' });
    haken.checked = einstellung().muenze;
    haken.addEventListener('change', () => {
      einstellung().muenze = haken.checked;
      speichern();
    });
    feld.append(haken, el('span', { class: 'anpassen-name' }, 'Münze zum Werfen'));
    zeile.appendChild(feld);
    sonst.appendChild(zeile);
    panel.appendChild(sonst);

    return panel;
  }

  /* ----------------------------- Aufbau ----------------------------- */

  function renderAll() {
    clear(host);

    const kopf = el('div', { class: 'dash-kopf' });
    const text = el('div', { class: 'dash-kopf-text' });
    text.appendChild(wortmarke({ size: 40 }));
    text.appendChild(el('p', { class: 'dash-text' },
      anpassen
        ? 'Setz die Haken für das, was du hier sehen willst.'
        : 'Such dir aus, womit du anfangen willst.'));
    kopf.appendChild(text);

    const rechts = el('div', { class: 'dash-kopf-rechts' });
    // Deutlich sichtbarer Knopf statt grauem Text - der alte war so
    // zurückhaltend, dass niemand ihn gefunden hat.
    const knopf = el('button', {
      class: 'btn ' + (anpassen ? 'btn-primary' : 'btn-ghost') + ' dash-anpassen',
      type: 'button',
    });
    if (!anpassen) knopf.appendChild(symbolSvg('regler', { size: 17 }));
    knopf.appendChild(el('span', {}, anpassen ? 'Fertig' : 'Startseite anpassen'));
    knopf.addEventListener('click', () => { anpassen = !anpassen; renderAll(); });
    rechts.appendChild(knopf);

    if (einstellung().muenze && !anpassen) rechts.appendChild(createMuenze());
    kopf.appendChild(rechts);
    host.appendChild(kopf);

    if (anpassen) {
      host.appendChild(anpassenPanel());
      return;
    }

    const zahlen = kennzahlen(store.data);

    for (const id of einstellung().widgets) {
      if (id === 'habits') {
        host.appendChild(createHabitWidget({ store, onUebersicht: () => onOeffne('habits') }));
      }
      else if (id === 'karten') host.appendChild(kartenBlock(zahlen));
      else if (id === 'nachrichten') {
        // Lädt nebenher; die Kacheln sollen nicht auf das Netz warten.
        const news = el('section', { class: 'news' });
        host.appendChild(news);
        renderNachrichten(news);
      }
    }

    if (!einstellung().widgets.length) {
      host.appendChild(el('p', { class: 'empty' },
        'Die Startseite ist leer. Über „Startseite anpassen" wählst du, was hier stehen soll.'));
    }
  }

  return { renderAll };
}
