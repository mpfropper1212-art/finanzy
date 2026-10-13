// Münze für schnelle Entscheidungen. Kopf ist ein Lama, Zahl das Finanzy-Zeichen.
// Kein Knopf, sondern ein Ding, das herumliegt und sich antippen lässt.

import { el, svg } from './util.js';
import { markeSvg } from './logo.js';

function lamaSvg(size = 40) {
  const root = svg('svg', { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': 'true' });

  const defs = svg('defs');
  const clip = svg('clipPath', { id: 'lama-kopf' });
  clip.appendChild(svg('rect', { x: 17, y: 13, width: 30, height: 31, rx: 13 }));
  defs.appendChild(clip);
  root.appendChild(defs);

  // Ohren liegen hinter dem Kopf.
  root.appendChild(svg('path', { d: 'M22,19 L17.5,5 L28,13 Z', fill: '#6d28d9' }));
  root.appendChild(svg('path', { d: 'M42,19 L46.5,5 L36,13 Z', fill: '#6d28d9' }));

  root.appendChild(svg('rect', { x: 17, y: 13, width: 30, height: 31, rx: 13, fill: '#8b5cf6' }));

  // Fransen wie bei einer Piñata, auf die Kopfform beschnitten.
  const fransen = svg('g', { 'clip-path': 'url(#lama-kopf)' });
  fransen.appendChild(svg('rect', { x: 17, y: 27, width: 30, height: 6, fill: '#22d3ee' }));
  fransen.appendChild(svg('rect', { x: 17, y: 33, width: 30, height: 11, fill: '#f472b6' }));
  root.appendChild(fransen);

  root.appendChild(svg('rect', { x: 23, y: 37, width: 18, height: 17, rx: 8.5, fill: '#f5f3ff' }));
  root.appendChild(svg('circle', { cx: 25, cy: 22, r: 2.8, fill: '#1b2130' }));
  root.appendChild(svg('circle', { cx: 39, cy: 22, r: 2.8, fill: '#1b2130' }));
  root.appendChild(svg('circle', { cx: 29, cy: 46, r: 1.5, fill: '#a78bfa' }));
  root.appendChild(svg('circle', { cx: 35, cy: 46, r: 1.5, fill: '#a78bfa' }));

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
  zahl.appendChild(markeSvg({ size: 32, titel: 'Zahl' }));

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
