// Kleiner Gewohnheitstracker für die Startseite: eine Zeile je Gewohnheit,
// die letzten sieben Tage als Haken, dazu die laufende Serie.
//
// Bewusst klein gehalten - er steht neben allem anderen auf der Startseite und
// soll in zwei Sekunden abgehakt sein, nicht zu einer eigenen App werden.

import { el, clear, uid } from './util.js';

export const HABIT_FARBEN = [
  '#2f6feb', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0891b2',
];

const isoVon = d => d.toISOString().slice(0, 10);

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

export function quote(habit, tage = 28, heute = new Date()) {
  const gesetzt = new Set(habit.tage ?? []);
  const fenster = letzteTage(tage, heute);
  const treffer = fenster.filter(t => gesetzt.has(t.iso)).length;
  return { treffer, von: tage, prozent: Math.round((treffer / tage) * 100) };
}

export function createHabitWidget({ store, onAenderung }) {
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
    const stift = el('button', { class: 'link-btn', type: 'button' },
      bearbeiten ? 'Fertig' : 'Bearbeiten');
    stift.addEventListener('click', () => { bearbeiten = !bearbeiten; render(); });
    kopf.appendChild(stift);
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
