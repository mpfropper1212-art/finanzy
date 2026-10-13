// Münze für schnelle Entscheidungen. Kopf ist ein Lama, Zahl eine "#1".
// Kein Knopf, sondern ein Ding, das herumliegt und sich antippen lässt.

import { el, svg } from './util.js';

// Lama im Seitenprofil, flächig mit kräftiger Kontur. Eigener Entwurf:
// Kopfform, Flächenaufteilung und Proportionen sind meine, nicht die einer
// bestehenden Spielfigur.
const LAMA = {
  kontur: '#3b2357',
  koerper: '#9b7fd4',
  schatten: '#7a5fb5',
  hell: '#ddd0f5',
  weiss: '#ffffff',
  rosa: '#d98fd4',
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

  // Ohren zuerst, damit der Kopf ihre Ansätze überdeckt. Kantig statt rund -
  // das Tier ist aus geklebtem Papier, nicht aus Plüsch.
  const ohr = (d, innen) => {
    g.appendChild(svg('path', { d, fill: LAMA.koerper, ...umriss }));
    g.appendChild(svg('path', { d: innen, fill: LAMA.rosa }));
  };
  ohr('M28,21 L29,6 L32,2 L35,7 L34,21 Z', 'M30,18 L30.5,8 L32,5.5 L33,9 L32.5,18 Z');
  ohr('M40,20 L43,5 L47,2 L49,8 L46,21 Z', 'M42,17 L44,8 L46,5.5 L47,9 L45,17 Z');

  const koerperPfad = 'M32,17 L44,17 L52,27 L54,57 L32,57 L29,44 L20,46 L12,46 '
    + 'L9,38 L15,32 L23,23 Z';

  // Kopf, Schnauze und Hals als eine Form - eine durchgehende Kontur außen
  // herum ist das, was den Aufkleber-Look ausmacht.
  g.appendChild(svg('path', { d: koerperPfad, fill: LAMA.koerper, ...umriss }));

  // Papierfransen auf dem Hals, am Körper abgeschnitten.
  const id = `lamaK${++idZaehler}`;
  const defs = svg('defs');
  const clip = svg('clipPath', { id });
  clip.appendChild(svg('path', { d: koerperPfad }));
  defs.appendChild(clip);
  g.appendChild(defs);

  const fransen = svg('g', { 'clip-path': `url(#${id})` });
  const zacken = (y, farbe) => {
    let d = `M26,${y}`;
    for (let x = 26; x <= 58; x += 4) d += ` L${x + 2},${y + 2.6} L${x + 4},${y}`;
    d += ` L58,${y + 5.4} L26,${y + 5.4} Z`;
    fransen.appendChild(svg('path', { d, fill: farbe }));
  };
  zacken(40, LAMA.hell);
  zacken(46, LAMA.rosa);
  zacken(52, LAMA.hell);
  g.appendChild(fransen);

  // Kontur erneut obendrauf, damit die Fransen sie nicht überdecken.
  g.appendChild(svg('path', { d: koerperPfad, fill: 'none', ...umriss }));

  // Helle Flächen auf Stirn und Schnauze.
  g.appendChild(svg('path', { d: 'M32,17 L44,17 L50,26 L27,31 L23,23 Z', fill: LAMA.hell }));
  g.appendChild(svg('path', { d: 'M15,32 L24,29 L26,40 L13,43 L9,38 Z', fill: LAMA.hell }));
  g.appendChild(svg('path', { d: 'M49,30 L52,30 L52.6,40 L47,41 Z', fill: LAMA.schatten }));

  // Maul und Nüstern
  g.appendChild(svg('path', {
    d: 'M12,43 L16,41.6 L21,43', fill: 'none',
    stroke: LAMA.kontur, 'stroke-width': 2.2, 'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }));
  g.appendChild(svg('path', { d: 'M12.5,34 L15,34.6 L14,38 Z', fill: LAMA.kontur }));
  g.appendChild(svg('path', { d: 'M17,33 L19.4,33.6 L18.4,37 Z', fill: LAMA.kontur }));

  // Auge als abgerundetes Quadrat - das gibt dem Gesicht den Comic-Ausdruck.
  g.appendChild(svg('rect', {
    x: 32, y: 27, width: 12, height: 12, rx: 3.4,
    fill: LAMA.weiss, stroke: LAMA.kontur, 'stroke-width': 2.4,
  }));
  g.appendChild(svg('circle', { cx: 37, cy: 34, r: 2.7, fill: LAMA.kontur }));
  g.appendChild(svg('circle', { cx: 38.2, cy: 32.8, r: 0.9, fill: LAMA.weiss }));

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
