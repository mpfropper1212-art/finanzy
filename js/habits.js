// Kleiner Gewohnheitstracker für die Startseite: eine Zeile je Gewohnheit,
// die letzten sieben Tage als Haken, dazu die laufende Serie.
//
// Bewusst klein gehalten - er steht neben allem anderen auf der Startseite und
// soll in zwei Sekunden abgehakt sein, nicht zu einer eigenen App werden.

import { el, clear, uid, isoDatum } from './util.js';

export const HABIT_FARBEN = [
  '#2f6feb', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0891b2',
];

const isoVon = isoDatum;

export function createHabit(vorlage = {}) {
  return { id: uid('h'), name: 'Neue Gewohnheit', farbe: HABIT_FARBEN[0], tage: [], ...vorlage };
}

// Die letzten n Tage, ältester zuerst - so liest sich die Zeile wie ein Kalender.
export function letzteTage(n = 7, heute = new Date()) {
  const tage = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(heute);
    d.setDate(d.getDate() - i);
    tage.push({
      iso: isoVon(d),
      kurz: d.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2),
      tag: d.getDate(),
      istHeute: i === 0,
    });
  }
  return tage;
}

/**
 * Serie: wie viele Tage am Stück bis heute abgehakt sind.
 *
 * Heute noch offen bricht die Serie nicht ab - der Tag ist ja noch nicht
 * vorbei. Erst wenn auch gestern fehlt, steht die Serie auf null. Ohne diese
 * Regel zeigt der Tracker jeden Morgen eine Null und entwertet sich selbst.
 */
export function serie(habit, heute = new Date()) {
  const gesetzt = new Set(habit.tage ?? []);
  const d = new Date(heute);
  if (!gesetzt.has(isoVon(d))) d.setDate(d.getDate() - 1);

  let zahl = 0;
  while (gesetzt.has(isoVon(d))) {
    zahl += 1;
    d.setDate(d.getDate() - 1);
  }
  return zahl;
}

/** Die längste je erreichte Serie - der Wert, auf den man stolz ist. */
export function laengsteSerie(habit) {
  const tage = [...new Set(habit.tage ?? [])].sort();
  let beste = 0;
  let lauf = 0;
  let vorher = null;

  for (const iso of tage) {
    const d = new Date(iso);
    const davor = new Date(d);
    davor.setDate(davor.getDate() - 1);
    lauf = vorher === isoVon(davor) ? lauf + 1 : 1;
    beste = Math.max(beste, lauf);
    vorher = iso;
  }
  return beste;
}

const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

/**
 * Trefferquote je Wochentag über ein Zeitfenster. Zeigt das Muster, das man
 * selbst nicht sieht - fast immer bricht es am selben Tag ein.
 */
export function proWochentag(habit, tage = 84, heute = new Date()) {
  const gesetzt = new Set(habit.tage ?? []);
  const zaehler = WOCHENTAGE.map((name, i) => ({ name, kurz: name.slice(0, 2), index: i, treffer: 0, von: 0 }));

  for (const t of letzteTage(tage, heute)) {
    // getDay() zählt ab Sonntag, die Woche beginnt hier aber montags.
    const i = (new Date(t.iso).getDay() + 6) % 7;
    zaehler[i].von += 1;
    if (gesetzt.has(t.iso)) zaehler[i].treffer += 1;
  }
  return zaehler.map(z => ({ ...z, prozent: z.von ? Math.round((z.treffer / z.von) * 100) : 0 }));
}

export function statistik(habit, heute = new Date()) {
  const wochentage = proWochentag(habit, 84, heute);
  const mitDaten = wochentage.filter(w => w.von > 0);
  const sortiert = [...mitDaten].sort((a, b) => b.prozent - a.prozent);

  return {
    serie: serie(habit, heute),
    laengste: laengsteSerie(habit),
    gesamt: new Set(habit.tage ?? []).size,
    quote30: quote(habit, 30, heute),
    wochentage,
    bester: sortiert[0] ?? null,
    schwaechster: sortiert[sortiert.length - 1] ?? null,
    seit: [...(habit.tage ?? [])].sort()[0] ?? null,
  };
}

/**
 * Ein Monat als Kalendergitter, montags beginnend. Die Tage davor und danach
 * werden mitgeliefert, damit die Wochen vollständig sind.
 */
export function monatsGitter(jahr, monat, heute = new Date()) {
  const erster = new Date(jahr, monat, 1);
  const start = new Date(erster);
  start.setDate(start.getDate() - ((erster.getDay() + 6) % 7));

  const heuteIso = isoVon(heute);
  const tage = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = isoVon(d);
    tage.push({
      iso,
      tag: d.getDate(),
      imMonat: d.getMonth() === monat,
      istHeute: iso === heuteIso,
      istZukunft: iso > heuteIso,
    });
    // Sechste Zeile nur anhängen, wenn der Monat sie wirklich braucht.
    if (i >= 34 && (i + 1) % 7 === 0 && tage[i].imMonat === false && tage[i - 6].imMonat === false) {
      tage.length = i - 6;
      break;
    }
  }
  return tage;
}

export function quote(habit, tage = 28, heute = new Date()) {
  const gesetzt = new Set(habit.tage ?? []);
  const fenster = letzteTage(tage, heute);
  const treffer = fenster.filter(t => gesetzt.has(t.iso)).length;
  return { treffer, von: tage, prozent: Math.round((treffer / tage) * 100) };
}

export function createHabitWidget({ store, onAenderung, onUebersicht }) {
  const daten = () => store.data.habits;
  let bearbeiten = false;

  const box = el('section', { class: 'habits' });

  function umschalten(habit, iso) {
    const i = habit.tage.indexOf(iso);
    if (i >= 0) habit.tage.splice(i, 1);
    else habit.tage.push(iso);
    store.commit({ silent: true });
    render();
  }

  function render() {
    clear(box);

    const kopf = el('div', { class: 'habits-kopf' });
    kopf.appendChild(el('h3', {}, 'Gewohnheiten'));
    const knoepfe = el('div', { class: 'habits-kopf-knoepfe' });
    if (onUebersicht && daten().items.length) {
      const mehr = el('button', { class: 'link-btn', type: 'button' }, 'Kalender');
      mehr.addEventListener('click', onUebersicht);
      knoepfe.appendChild(mehr);
    }
    const stift = el('button', { class: 'link-btn', type: 'button' },
      bearbeiten ? 'Fertig' : 'Bearbeiten');
    stift.addEventListener('click', () => { bearbeiten = !bearbeiten; render(); });
    knoepfe.appendChild(stift);
    kopf.appendChild(knoepfe);
    box.appendChild(kopf);

    const tage = letzteTage(7);

    if (!daten().items.length) {
      box.appendChild(el('p', { class: 'empty' },
        'Noch keine Gewohnheit. Trag unten eine ein – Wasser trinken, Laufen, Lesen.'));
    } else {
      const kalender = el('div', { class: 'habits-tage' });
      kalender.appendChild(el('span', {}, ''));
      for (const t of tage) {
        kalender.appendChild(el('span', { class: 'habits-tag' + (t.istHeute ? ' ist-heute' : '') },
          t.kurz));
      }
      kalender.appendChild(el('span', {}, ''));
      box.appendChild(kalender);
    }

    for (const h of daten().items) {
      const zeile = el('div', { class: 'habits-zeile', style: `--habit: ${h.farbe}` });

      if (bearbeiten) {
        const name = el('input', { type: 'text', value: h.name, class: 'habits-name-feld' });
        name.addEventListener('input', () => { h.name = name.value; store.commit({ silent: true }); });
        name.addEventListener('change', render);
        zeile.appendChild(name);
      } else {
        zeile.appendChild(el('span', { class: 'habits-name' }, h.name));
      }

      for (const t of tage) {
        const an = h.tage.includes(t.iso);
        const knopf = el('button', {
          type: 'button',
          class: 'habits-haken' + (an ? ' ist-an' : '') + (t.istHeute ? ' ist-heute' : ''),
          'aria-pressed': String(an),
          'aria-label': `${h.name} am ${t.iso}`,
          title: t.iso,
        }, an ? '✓' : '');
        knopf.addEventListener('click', () => umschalten(h, t.iso));
        zeile.appendChild(knopf);
      }

      if (bearbeiten) {
        const weg = el('button', { class: 'link-btn', type: 'button', title: 'Gewohnheit löschen' }, '✕');
        weg.addEventListener('click', () => {
          daten().items = daten().items.filter(x => x.id !== h.id);
          store.commit({ silent: true });
          onAenderung?.();
          render();
        });
        zeile.appendChild(weg);
      } else {
        const s = serie(h);
        const q = quote(h);
        zeile.appendChild(el('span', {
          class: 'habits-serie' + (s > 0 ? ' ist-aktiv' : ''),
          title: `${q.treffer} von ${q.von} Tagen abgehakt`,
        }, s > 0 ? `${s}×` : '–'));
      }

      box.appendChild(zeile);
    }

    if (bearbeiten) {
      const zeile = el('form', { class: 'habits-neu' });
      const feld = el('input', { type: 'text', placeholder: 'Neue Gewohnheit', 'aria-label': 'Neue Gewohnheit' });
      const knopf = el('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Hinzufügen');
      zeile.append(feld, knopf);
      zeile.addEventListener('submit', ev => {
        ev.preventDefault();
        const name = feld.value.trim();
        if (!name) return;
        daten().items.push(createHabit({
          name,
          // Farben der Reihe nach durchgehen, damit die Zeilen auseinander
          // zu halten sind, ohne dass jemand etwas auswählen muss.
          farbe: HABIT_FARBEN[daten().items.length % HABIT_FARBEN.length],
        }));
        feld.value = '';
        store.commit({ silent: true });
        onAenderung?.();
        render();
      });
      box.appendChild(zeile);
    }

    return box;
  }

  render();
  return box;
}


/* ======================= Kalender und Statistik ======================= */

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function kachel(label, wert, hint) {
  const box = el('div', { class: 'kpi' });
  box.append(el('span', { class: 'kpi-label' }, label), el('strong', { class: 'kpi-value' }, wert));
  if (hint) box.appendChild(el('span', { class: 'kpi-hint' }, hint));
  return box;
}

const datumLang = iso => new Date(iso).toLocaleDateString('de-DE', {
  day: '2-digit', month: 'long', year: 'numeric',
});

export function createHabitsView({ kalenderHost, statHost, seiteHost, store }) {
  const daten = () => store.data.habits;

  const jetzt = new Date();
  let jahr = jetzt.getFullYear();
  let monat = jetzt.getMonth();
  // null heißt "alle Gewohnheiten übereinander".
  let gewaehlt = null;

  function aenderung() {
    store.commit({ silent: true });
    renderAll();
  }

  const aktive = () => (gewaehlt ? daten().items.filter(h => h.id === gewaehlt) : daten().items);

  /* ---------------------------- Kalender ---------------------------- */

  function renderKalender() {
    clear(kalenderHost);

    const kopf = el('div', { class: 'kal-kopf' });
    const zurueck = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': 'Voriger Monat' }, '‹');
    const vor = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': 'Nächster Monat' }, '›');
    const heuteKnopf = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Heute');

    const schieben = n => {
      const d = new Date(jahr, monat + n, 1);
      jahr = d.getFullYear();
      monat = d.getMonth();
      renderAll();
    };
    zurueck.addEventListener('click', () => schieben(-1));
    vor.addEventListener('click', () => schieben(1));
    heuteKnopf.addEventListener('click', () => {
      jahr = new Date().getFullYear();
      monat = new Date().getMonth();
      renderAll();
    });

    kopf.append(zurueck, el('strong', { class: 'kal-titel' }, `${MONATE[monat]} ${jahr}`), vor, heuteKnopf);
    kalenderHost.appendChild(kopf);

    if (!daten().items.length) {
      kalenderHost.appendChild(el('p', { class: 'empty' },
        'Noch keine Gewohnheit angelegt. Auf der Startseite trägst du die erste ein.'));
      return;
    }

    // Filterleiste: eine einzelne Gewohnheit lässt sich hier auch nachtragen.
    const filter = el('div', { class: 'kal-filter' });
    const alle = el('button', {
      type: 'button', class: 'pill' + (gewaehlt === null ? ' is-active' : ''),
    }, 'Alle');
    alle.addEventListener('click', () => { gewaehlt = null; renderAll(); });
    filter.appendChild(alle);
    for (const h of daten().items) {
      const knopf = el('button', {
        type: 'button',
        class: 'pill' + (gewaehlt === h.id ? ' is-active' : ''),
        style: `--habit: ${h.farbe}`,
      }, h.name);
      knopf.addEventListener('click', () => { gewaehlt = h.id; renderAll(); });
      filter.appendChild(knopf);
    }
    kalenderHost.appendChild(filter);

    const gitter = el('div', { class: 'kal-gitter' });
    for (const k of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) {
      gitter.appendChild(el('span', { class: 'kal-wochentag' }, k));
    }

    const liste = aktive();
    for (const tag of monatsGitter(jahr, monat)) {
      const treffer = liste.filter(h => h.tage.includes(tag.iso));

      const zelle = el(gewaehlt ? 'button' : 'div', {
        class: 'kal-tag'
          + (tag.imMonat ? '' : ' ist-fremd')
          + (tag.istHeute ? ' ist-heute' : '')
          + (tag.istZukunft ? ' ist-zukunft' : '')
          + (gewaehlt && treffer.length ? ' ist-an' : ''),
        ...(gewaehlt ? { type: 'button' } : {}),
        ...(gewaehlt && liste[0] ? { style: `--habit: ${liste[0].farbe}` } : {}),
      });
      zelle.appendChild(el('span', { class: 'kal-zahl' }, String(tag.tag)));

      if (gewaehlt) {
        // Nachtragen ja, in die Zukunft haken nein.
        if (!tag.istZukunft) {
          zelle.title = `${datumLang(tag.iso)} – zum Umschalten antippen`;
          zelle.addEventListener('click', () => {
            const h = liste[0];
            const i = h.tage.indexOf(tag.iso);
            if (i >= 0) h.tage.splice(i, 1);
            else h.tage.push(tag.iso);
            aenderung();
          });
        } else {
          zelle.disabled = true;
        }
      } else if (treffer.length) {
        const punkte = el('span', { class: 'kal-punkte' });
        for (const h of treffer) {
          punkte.appendChild(el('span', { class: 'kal-punkt', style: `background: ${h.farbe}`, title: h.name }));
        }
        zelle.appendChild(punkte);
        zelle.title = `${datumLang(tag.iso)}: ${treffer.map(h => h.name).join(', ')}`;
      }

      gitter.appendChild(zelle);
    }
    kalenderHost.appendChild(gitter);

    if (!gewaehlt) {
      kalenderHost.appendChild(el('p', { class: 'feld-hinweis' },
        'Wähl oben eine Gewohnheit, um einzelne Tage nachzutragen.'));
    }
  }

  /* ---------------------------- Statistik ---------------------------- */

  function renderStatistik() {
    clear(statHost);
    if (!daten().items.length) return;

    statHost.appendChild(el('div', { class: 'immo-chart-head' }, 'Statistik'));

    for (const h of aktive()) {
      const st = statistik(h);
      const block = el('section', { class: 'habit-stat', style: `--habit: ${h.farbe}` });

      const kopf = el('div', { class: 'habit-stat-kopf' });
      kopf.append(
        el('span', { class: 'habit-punkt' }),
        el('h3', {}, h.name),
        el('span', { class: 'habit-stat-seit' },
          st.seit ? `seit ${datumLang(st.seit)}` : 'noch nie abgehakt'),
      );
      block.appendChild(kopf);

      const kpis = el('div', { class: 'kpis' });
      kpis.append(
        kachel('Aktuelle Serie', st.serie ? `${st.serie} Tage` : '–',
          st.serie ? 'am Stück' : 'gestern und heute offen'),
        kachel('Längste Serie', st.laengste ? `${st.laengste} Tage` : '–', 'bisher'),
        kachel('Letzte 30 Tage', `${st.quote30.prozent} %`, `${st.quote30.treffer} von 30`),
        kachel('Insgesamt', `${st.gesamt} Tage`, 'abgehakt'),
      );
      block.appendChild(kpis);

      // Balken je Wochentag - das Muster sieht man sonst nie.
      const max = Math.max(1, ...st.wochentage.map(w => w.prozent));
      const balken = el('div', { class: 'habit-wochen' });
      for (const w of st.wochentage) {
        const spalte = el('div', { class: 'habit-woche' });
        const saeule = el('div', { class: 'habit-saeule' });
        const fuellung = el('div', {
          class: 'habit-fuellung',
          style: `height: ${Math.round((w.prozent / max) * 100)}%`,
          title: `${w.name}: ${w.treffer} von ${w.von} (${w.prozent} %)`,
        });
        saeule.appendChild(fuellung);
        spalte.append(saeule, el('span', { class: 'habit-woche-label' }, w.kurz),
          el('span', { class: 'habit-woche-wert' }, `${w.prozent}%`));
        balken.appendChild(spalte);
      }
      block.appendChild(balken);

      if (st.bester && st.schwaechster && st.bester.prozent > st.schwaechster.prozent) {
        block.appendChild(el('p', { class: 'feld-hinweis' },
          `Am besten läuft es ${st.bester.name}s (${st.bester.prozent} %), `
          + `am schwersten ${st.schwaechster.name}s (${st.schwaechster.prozent} %). `
          + 'Gerechnet über die letzten zwölf Wochen.'));
      }

      statHost.appendChild(block);
    }
  }

  /* ------------------------------ Seite ------------------------------ */

  function renderSeite() {
    clear(seiteHost);

    const kopf = el('div', { class: 'editor-head' });
    kopf.appendChild(el('h2', {}, 'Gewohnheiten'));
    seiteHost.appendChild(kopf);

    const liste = el('div', { class: 'rows' });
    for (const h of daten().items) {
      const zeile = el('div', { class: 'row row-habit', style: `--habit: ${h.farbe}` });

      const name = el('input', { type: 'text', value: h.name, 'aria-label': 'Name' });
      name.addEventListener('input', () => { h.name = name.value; store.commit({ silent: true }); });
      name.addEventListener('change', renderAll);
      zeile.appendChild(name);

      const farben = el('div', { class: 'habit-farben' });
      for (const f of HABIT_FARBEN) {
        const knopf = el('button', {
          type: 'button',
          class: 'habit-farbe' + (h.farbe === f ? ' ist-an' : ''),
          style: `background: ${f}`,
          'aria-label': `Farbe ${f}`,
        });
        knopf.addEventListener('click', () => { h.farbe = f; aenderung(); });
        farben.appendChild(knopf);
      }
      zeile.appendChild(farben);

      const weg = el('button', { class: 'link-btn', type: 'button', title: 'Löschen' }, '✕');
      weg.addEventListener('click', () => {
        if (h.tage.length && !window.confirm(
          `„${h.name}" samt ${h.tage.length} abgehakten Tagen löschen?`)) return;
        daten().items = daten().items.filter(x => x.id !== h.id);
        if (gewaehlt === h.id) gewaehlt = null;
        aenderung();
      });
      zeile.appendChild(weg);

      liste.appendChild(zeile);
    }
    seiteHost.appendChild(liste);

    const form = el('form', { class: 'habits-neu' });
    const feld = el('input', { type: 'text', placeholder: 'Neue Gewohnheit', 'aria-label': 'Neue Gewohnheit' });
    form.append(feld, el('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Hinzufügen'));
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const name = feld.value.trim();
      if (!name) return;
      daten().items.push(createHabit({
        name, farbe: HABIT_FARBEN[daten().items.length % HABIT_FARBEN.length],
      }));
      feld.value = '';
      aenderung();
    });
    seiteHost.appendChild(form);
  }

  function renderAll() {
    // Eine gelöschte Gewohnheit darf nicht als Filter hängen bleiben.
    if (gewaehlt && !daten().items.some(h => h.id === gewaehlt)) gewaehlt = null;
    renderKalender();
    renderStatistik();
    renderSeite();
  }

  return { renderAll };
}
