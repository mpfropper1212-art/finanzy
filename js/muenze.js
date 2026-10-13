// Münze für schnelle Entscheidungen. Kopf ist ein Lama, Zahl eine "#1".
// Kein Knopf, sondern ein Ding, das herumliegt und sich antippen lässt.

import { el, svg } from './util.js';

// Lama im Seitenprofil, flächig und kantig gezeichnet. Eigener Entwurf:
// Haltung, Flächenaufteilung und Proportionen sind meine, nicht die einer
// bestehenden Spielfigur.
const LAMA = {
  dunkel: '#7c6a9c',
  koerper: '#b3a7d6',
  hell: '#d9d2f0',
  weiss: '#f6f4fd',
  auge: '#3f4654',
};

// Zahl-Seite: eine klotzige "#1" in Gelb mit weißer Kontur.
const EINS = { gelb: '#ffd200', kontur: '#ffffff' };

function einsSvg(size = 44) {
  const root = svg('svg', { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': 'true' });

  // Die Kontur entsteht über paint-order: erst der breite Strich, dann die
  // Füllung darüber - so braucht es keine zweite Pfadkopie.
  const stil = {
    fill: EINS.gelb,
    stroke: EINS.kontur,
    'stroke-width': 3.5,
    'stroke-linejoin': 'round',
    'paint-order': 'stroke fill',
  };

  // Die Raute steht leicht schräg, wie beim handgemalten "#1". Die vier
  // Balken kreuzen sich, deshalb erst alle weiß als Unterlage und dann alle
  // gelb darüber - sonst zöge die Kontur Striche quer durchs Innere.
  const balken = [
    { x: 9, y: 18, width: 5.5, height: 32 },
    { x: 19.5, y: 18, width: 5.5, height: 32 },
    { x: 2, y: 25, width: 30, height: 5.5 },
    { x: 2, y: 37.5, width: 30, height: 5.5 },
  ];
  const raute = svg('g', { transform: 'skewX(-9) translate(5,0)' });
  for (const r of balken) {
    raute.appendChild(svg('rect', {
      ...r, fill: EINS.kontur, stroke: EINS.kontur,
      'stroke-width': 3.5, 'stroke-linejoin': 'round',
    }));
  }
  for (const r of balken) raute.appendChild(svg('rect', { ...r, fill: EINS.gelb }));
  root.appendChild(raute);

  root.appendChild(svg('path', {
    d: 'M57,10 L57,56 L46,56 L46,22 L38,26 L36,18 L48,10 Z',
    ...stil,
  }));

  return root;
}

function lamaSvg(size = 46) {
  const root = svg('svg', { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': 'true' });

  // Aus Grundformen statt Freihand-Polygonen: Hals, Kopf, Schnauze und zwei
  // lange Ohren. Die langen Ohren und die stumpfe Schnauze sind das, woran
  // man ein Lama erkennt - ein Pferd hat kurze Ohren und eine lange Nase.
  const ohr = (x, y, winkel) => {
    const g = svg('g', { transform: `rotate(${winkel} ${x + 3} ${y + 16})` });
    g.appendChild(svg('rect', { x, y, width: 6.4, height: 21, rx: 3.2, fill: LAMA.dunkel }));
    g.appendChild(svg('rect', {
      x: x + 1.6, y: y + 3, width: 3.2, height: 14, rx: 1.6, fill: LAMA.hell,
    }));
    return g;
  };
  root.appendChild(ohr(25, 1, -17));
  root.appendChild(ohr(39, 0, 11));

  // Hals
  root.appendChild(svg('rect', {
    x: 33, y: 24, width: 18, height: 42, rx: 9,
    fill: LAMA.koerper, transform: 'rotate(5 42 45)',
  }));
  root.appendChild(svg('rect', {
    x: 36.5, y: 33, width: 8, height: 33, rx: 4,
    fill: LAMA.hell, transform: 'rotate(5 42 45)',
  }));

  // Kopf
  root.appendChild(svg('rect', { x: 21, y: 15, width: 28, height: 21, rx: 9, fill: LAMA.koerper }));
  // Stirnschopf
  root.appendChild(svg('rect', { x: 23, y: 14, width: 24, height: 10, rx: 5, fill: LAMA.hell }));

  // Schnauze, stumpf und etwas abgesenkt
  root.appendChild(svg('rect', { x: 8, y: 23, width: 21, height: 14, rx: 6.5, fill: LAMA.koerper }));
  root.appendChild(svg('rect', { x: 9, y: 27, width: 19, height: 9, rx: 4.5, fill: LAMA.weiss }));
  root.appendChild(svg('circle', { cx: 12.5, cy: 28, r: 1.6, fill: LAMA.dunkel }));

  // Auge
  root.appendChild(svg('circle', { cx: 31, cy: 25.5, r: 2.8, fill: LAMA.auge }));
  root.appendChild(svg('circle', { cx: 32, cy: 24.6, r: 1, fill: LAMA.weiss }));

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
