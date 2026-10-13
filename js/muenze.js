// Münze für schnelle Entscheidungen. Kopf ist ein Lama, Zahl eine "#1".
// Kein Knopf, sondern ein Ding, das herumliegt und sich antippen lässt.

import { el, svg } from './util.js';

// Lama im Seitenprofil, flächig mit kräftiger Kontur. Eigener Entwurf:
// Kopfform, Flächenaufteilung und Proportionen sind meine, nicht die einer
// bestehenden Spielfigur.
const LAMA = {
  kontur: '#4a2d63',
  koerper: '#b6a8d4',
  schatten: '#9789bd',
  hell: '#ded6f2',
  weiss: '#ffffff',
  rosa: '#c98fc4',
};

// Zahl-Seite: klotzige "#1" in Gold, weiß umrandet.
const EINS = {
  kontur: '#fdf6e3',
  rand: '#d08a07',
  gold: '#fbb90c',
  glanz: '#ffd34d',
};

let idZaehler = 0;

// Für den Aufkleber-Look: dieselbe Form zweimal - erst breit weiß als
// Unterlage, dann schmal orange gerandet und gefüllt darüber.
function aufkleber(ziel, form, attrs) {
  ziel.appendChild(svg(form, {
    ...attrs, fill: EINS.kontur, stroke: EINS.kontur,
    'stroke-width': 7, 'stroke-linejoin': 'round',
  }));
  ziel.appendChild(svg(form, {
    ...attrs, stroke: EINS.rand,
    'stroke-width': 2.2, 'stroke-linejoin': 'round', 'paint-order': 'stroke fill',
  }));
}

function einsSvg(size = 44) {
  const root = svg('svg', { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': 'true' });
  const id = `gold${++idZaehler}`;

  const defs = svg('defs');
  const lauf = svg('linearGradient', { id, x1: '0', y1: '0', x2: '0.4', y2: '1' });
  lauf.appendChild(svg('stop', { offset: '0', 'stop-color': EINS.glanz }));
  lauf.appendChild(svg('stop', { offset: '0.55', 'stop-color': EINS.gold }));
  lauf.appendChild(svg('stop', { offset: '1', 'stop-color': '#f0a500' }));
  defs.appendChild(lauf);
  root.appendChild(defs);

  const fuellung = `url(#${id})`;

  // Die Raute als ein einziger Umriss plus das Loch in der Mitte - so läuft
  // die Kontur außen herum und nicht quer durch die Balken.
  const raute = 'M8,0 L13.5,0 L13.5,8 L18,8 L18,0 L23.5,0 L23.5,8 L30,8 L30,13.5 '
    + 'L23.5,13.5 L23.5,21 L30,21 L30,26.5 L23.5,26.5 L23.5,34 L18,34 L18,26.5 '
    + 'L13.5,26.5 L13.5,34 L8,34 L8,26.5 L0,26.5 L0,21 L8,21 L8,13.5 L0,13.5 '
    + 'L0,8 L8,8 Z M13.5,13.5 L18,13.5 L18,21 L13.5,21 Z';

  const g = svg('g', { transform: 'translate(3,15) skewX(-7)' });
  aufkleber(g, 'path', { d: raute, 'fill-rule': 'evenodd', fill: fuellung });
  root.appendChild(g);

  aufkleber(root, 'path', {
    d: 'M57,9 L57,57 L45,57 L45,22 L37,26 L34,17 L47,9 Z',
    fill: fuellung,
  });

  // Ein schmaler Glanzstreifen oben, wie auf einem glänzenden Aufkleber.
  root.appendChild(svg('path', {
    d: 'M47,11 L55,11 L55,30 L47,34 Z', fill: '#ffffff', opacity: 0.32,
  }));

  return root;
}

function lamaSvg(size = 46) {
  const root = svg('svg', { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': 'true' });
  // Die Münze ist rund und schneidet die Ecken weg, also muss die Figur
  // kompakt in der Mitte sitzen statt bis an den Rand zu laufen.
  const g = svg('g', { transform: 'translate(2,3)' });
  root.appendChild(g);

  const umriss = {
    stroke: LAMA.kontur, 'stroke-width': 3, 'stroke-linejoin': 'round',
    'stroke-linecap': 'round', 'paint-order': 'stroke fill',
  };

  // Ohren zuerst, damit der Kopf ihre Ansätze überdeckt.
  const ohr = (d, innen) => {
    g.appendChild(svg('path', { d, fill: LAMA.koerper, ...umriss }));
    g.appendChild(svg('path', { d: innen, fill: LAMA.rosa, opacity: 0.75 }));
  };
  ohr('M28,20 C25,12 26,5 30,3 C34,6 35,13 34,20 Z',
      'M29,17 C27,12 28,8 30,7 C32,9 32,13 31.5,17 Z');
  ohr('M40,19 C40,10 43,4 47,3 C50,7 49,14 46,20 Z',
      'M41.5,16 C42,11 44,8 46,7 C47.5,10 47,14 45,17 Z');

  // Kopf, Schnauze und Hals als eine Form - eine durchgehende Kontur außen
  // herum ist das, was den Aufkleber-Look ausmacht.
  g.appendChild(svg('path', {
    d: 'M32,17 L44,17 L52,27 L54,57 L32,57 L29,44 L20,46 L12,46 L9,38 L15,32 L23,23 Z',
    fill: LAMA.koerper, ...umriss,
  }));

  // Helle Flächen obenauf: Stirn, Schnauzenrücken, Halsvorderseite.
  g.appendChild(svg('path', { d: 'M32,17 L44,17 L50,26 L27,31 L23,23 Z', fill: LAMA.hell }));
  g.appendChild(svg('path', { d: 'M15,32 L24,29 L26,40 L13,43 L9,38 Z', fill: LAMA.hell }));
  g.appendChild(svg('path', { d: 'M34,57 L31,46 L41,44 L43,57 Z', fill: LAMA.hell }));
  g.appendChild(svg('path', { d: 'M49,30 L52,30 L53.5,57 L47,57 Z', fill: LAMA.schatten }));

  // Maul und Nüstern
  g.appendChild(svg('path', {
    d: 'M12,43 C15,41.5 19,41.5 21,43', fill: 'none',
    stroke: LAMA.kontur, 'stroke-width': 2.2, 'stroke-linecap': 'round',
  }));
  g.appendChild(svg('ellipse', { cx: 13.5, cy: 36, rx: 1.4, ry: 2, fill: LAMA.kontur }));
  g.appendChild(svg('ellipse', { cx: 18, cy: 35, rx: 1.4, ry: 2, fill: LAMA.kontur }));

  // Auge als abgerundetes Quadrat - das gibt dem Gesicht den Comic-Ausdruck.
  g.appendChild(svg('rect', {
    x: 32, y: 27, width: 12, height: 12, rx: 3.8,
    fill: LAMA.weiss, stroke: LAMA.kontur, 'stroke-width': 2.4,
  }));
  g.appendChild(svg('circle', { cx: 37, cy: 34, r: 2.7, fill: LAMA.kontur }));
  g.appendChild(svg('circle', { cx: 38.2, cy: 32.8, r: 0.9, fill: LAMA.weiss }));

  // Halsband mit Zacken - das Lama ist geschmückt, nicht nackt.
  g.appendChild(svg('path', {
    d: 'M30,45 L50,41 L51,47 L31,51 Z', fill: LAMA.schatten,
    stroke: LAMA.kontur, 'stroke-width': 2, 'stroke-linejoin': 'round',
  }));
  for (let i = 0; i < 3; i++) {
    const x = 34 + i * 5.4;
    const y = 47.8 - i * 1.1;
    g.appendChild(svg('path', {
      d: `M${x},${y} L${x + 3.2},${y - 0.7} L${x + 1.6},${y + 3} Z`, fill: LAMA.rosa,
    }));
  }

  return root;
}

export function createMuenze() {
  let drehung = 0;
  let zeigtZahl = false;
  let laeuft = false;

  const box = el('div', { class: 'muenze-box' });

  const muenze = el('button', {
    class: 'muenze',
    type: 'button',
    title: 'Antippen für eine Entscheidung',
    'aria-label': 'Münze werfen',
  });
  const innen = el('div', { class: 'muenze-innen' });

  const kopf = el('div', { class: 'muenze-seite muenze-kopf' });
  kopf.appendChild(lamaSvg(46));

  const zahl = el('div', { class: 'muenze-seite muenze-zahl' });
  zahl.appendChild(einsSvg(42));

  innen.append(kopf, zahl);
  muenze.appendChild(innen);

  const ergebnis = el('span', { class: 'muenze-ergebnis', 'aria-live': 'polite' }, 'Entscheidungshilfe');

  muenze.addEventListener('click', () => {
    if (laeuft) return;
    laeuft = true;
    ergebnis.textContent = '…';
    ergebnis.classList.remove('ist-fertig');

    const zielZahl = Math.random() < 0.5;
    // Zwei volle Umdrehungen, plus eine halbe, wenn die Seite wechseln soll.
    drehung += (4 + (zielZahl !== zeigtZahl ? 1 : 0)) * 180;
    zeigtZahl = zielZahl;
    innen.style.transform = `rotateY(${drehung}deg)`;

    const dauer = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1100;
    setTimeout(() => {
      ergebnis.textContent = zielZahl ? 'Zahl' : 'Kopf';
      ergebnis.classList.add('ist-fertig');
      laeuft = false;
    }, dauer);
  });

  box.append(muenze, ergebnis);
  return box;
}
