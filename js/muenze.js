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
  const nr = ++idZaehler;
  const defs = svg('defs');
  root.appendChild(defs);

  const lauf = svg('linearGradient', { id: `gold${nr}`, x1: '0', y1: '0', x2: '0.3', y2: '1' });
  lauf.appendChild(svg('stop', { offset: '0', 'stop-color': EINS.glanz }));
  lauf.appendChild(svg('stop', { offset: '0.5', 'stop-color': EINS.gold }));
  lauf.appendChild(svg('stop', { offset: '1', 'stop-color': '#ef9f00' }));
  defs.appendChild(lauf);

  // Ein Zeichen besteht aus drei Lagen: breite weiße Unterlage, Füllung mit
  // orangefarbener Innenkante, und eine aufgehellte Hälfte als Glanzkante.
  const zeichen = (d, regel) => {
    const gruppe = svg('g');
    const form = { d, ...(regel ? { 'fill-rule': regel } : {}) };

    gruppe.appendChild(svg('path', {
      ...form, fill: EINS.kontur, stroke: EINS.kontur,
      'stroke-width': 7, 'stroke-linejoin': 'round',
    }));
    gruppe.appendChild(svg('path', {
      ...form, fill: `url(#gold${nr})`, stroke: EINS.rand,
      'stroke-width': 2.2, 'stroke-linejoin': 'round', 'paint-order': 'stroke fill',
    }));

    const clipId = `c${nr}_${d.length}`;
    const clip = svg('clipPath', { id: clipId });
    clip.appendChild(svg('path', form));
    defs.appendChild(clip);

    // Diagonale Trennung oben links heller - der typische Aufkleber-Glanz.
    const glanz = svg('g', { 'clip-path': `url(#${clipId})` });
    glanz.appendChild(svg('path', { d: 'M-20,-20 L80,-20 L-20,80 Z', fill: '#fff', opacity: 0.26 }));
    gruppe.appendChild(glanz);
    return gruppe;
  };

  // Die Raute als ein Umriss plus das Loch in der Mitte. Die kleinen Stufen
  // an den Balkenenden geben ihr den Pixel-Look.
  const raute = 'M9.5,0 L13.5,0 L13.5,8 L18,8 L18,2 L19.5,2 L19.5,0 L23.5,0 L23.5,8 '
    + 'L28.5,8 L28.5,9.5 L30,9.5 L30,13.5 L23.5,13.5 L23.5,21 L28.5,21 L28.5,22.5 '
    + 'L30,22.5 L30,26.5 L23.5,26.5 L23.5,32 L22,32 L22,34 L18,34 L18,26.5 '
    + 'L13.5,26.5 L13.5,32 L12,32 L12,34 L8,34 L8,26.5 L1.5,26.5 L1.5,25 L0,25 '
    + 'L0,21 L8,21 L8,13.5 L1.5,13.5 L1.5,12 L0,12 L0,8 L8,8 L8,2 L9.5,2 Z '
    + 'M13.5,13.5 L18,13.5 L18,21 L13.5,21 Z';

  const lockup = svg('g', { transform: 'rotate(-3 32 32)' });
  const rauteG = zeichen(raute, 'evenodd');
  rauteG.setAttribute('transform', 'translate(2,17) skewX(-6)');
  lockup.append(rauteG, zeichen('M58,7 L58,58 L45,58 L45,22 L36,26 L33,16 L47,7 Z'));
  root.appendChild(lockup);

  // Funkel, wie auf einem Sticker.
  const funke = (x, y, r) => root.appendChild(svg('path', {
    d: 'M0,-1 C0.15,-0.15 0.15,-0.15 1,0 C0.15,0.15 0.15,0.15 0,1 '
      + 'C-0.15,0.15 -0.15,0.15 -1,0 C-0.15,-0.15 -0.15,-0.15 0,-1 Z',
    fill: '#fff', transform: `translate(${x} ${y}) scale(${r})`,
  }));
  funke(52, 14, 3.4);
  funke(56, 36, 2.2);
  funke(26, 50, 2.6);

  return root;
}

function lamaSvg(size = 46) {
  const root = svg('svg', { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': 'true' });
  // Die Münze ist rund und schneidet die Ecken weg, also muss die Figur
  // kompakt in der Mitte sitzen statt bis an den Rand zu laufen.
  // Die Figur misst 9..54 / 2..57 - so skaliert und verschoben liegt ihr
  // Mittelpunkt genau auf der Kreismitte und nichts wird abgeschnitten.
  const g = svg('g', { transform: 'translate(5.2,6.9) scale(0.85)' });
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
