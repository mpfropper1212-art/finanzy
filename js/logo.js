// Wortmarke und Bereichssymbole als Inline-SVG - keine Bilddateien, damit die
// App weiterhin ohne externe Ressourcen auskommt und in beiden Themes passt.

import { svg } from './util.js';

// Der Stamm des F trägt zwei Bänder, die nach außen dünner werden - dieselbe
// Verjüngung wie bei einem Sankey-Band, das sich weiter aufteilt.
const F_STAMM = { x: 5, y: 4, width: 6.2, height: 24, rx: 2.4 };
const F_ARM_OBEN = 'M11.2,4.5 C18,4.5 20,3.2 28,3.2 L28,7.8 C20,7.8 18,11.1 11.2,11.1 Z';
const F_ARM_UNTEN = 'M11.2,14.4 C16,14.4 17.5,13.6 23,13.6 L23,17.3 C17.5,17.3 16,20.3 11.2,20.3 Z';

export function markeSvg({ size = 30, titel = 'Finanzy' } = {}) {
  const root = svg('svg', {
    width: size, height: size, viewBox: '0 0 32 32',
    role: 'img', 'aria-label': titel, class: 'marke',
  });
  root.appendChild(svg('rect', { ...F_STAMM, fill: 'var(--marke-stamm)' }));
  root.appendChild(svg('path', { d: F_ARM_OBEN, fill: 'var(--marke-a)' }));
  root.appendChild(svg('path', { d: F_ARM_UNTEN, fill: 'var(--marke-b)' }));
  return root;
}

// Dasselbe Zeichen im abgerundeten Quadrat. Freistehend geht es auf einem
// bunten Hintergrundbild unter, deshalb für App- und Tab-Symbole der Rahmen.
export function blockSvg({ size = 60 } = {}) {
  const root = svg('svg', {
    width: size, height: size, viewBox: '0 0 32 32',
    role: 'img', 'aria-label': 'Finanzy', class: 'marke-block',
  });
  root.appendChild(svg('rect', { x: 0, y: 0, width: 32, height: 32, rx: 7.4, fill: '#1b2130' }));
  const innen = svg('g', { transform: 'translate(5.4 5.4) scale(0.66)' });
  innen.appendChild(svg('rect', { ...F_STAMM, fill: '#aeb8c7' }));
  innen.appendChild(svg('path', { d: F_ARM_OBEN, fill: '#5b8cf5' }));
  innen.appendChild(svg('path', { d: F_ARM_UNTEN, fill: '#22c55e' }));
  root.appendChild(innen);
  return root;
}

export function wortmarke({ size = 30 } = {}) {
  const box = document.createElement('span');
  box.className = 'wortmarke';
  box.appendChild(markeSvg({ size }));
  const text = document.createElement('span');
  text.className = 'wortmarke-text';
  text.textContent = 'Finanzy';
  box.appendChild(text);
  return box;
}

// Strichsymbole auf 24×24, einheitliche Strichstärke.
const PFADE = {
  start: ['M4,4 h7 v7 h-7 Z', 'M13,4 h7 v7 h-7 Z', 'M4,13 h7 v7 h-7 Z', 'M13,13 h7 v7 h-7 Z'],
  flow: ['M4,6 h4 c6,0 4,5 12,5', 'M4,12 h4 c6,0 4,-5 12,-5', 'M4,18 h4 c6,0 4,-1 12,-1'],
  konten: ['M3,8 l9,-4 l9,4', 'M5,8 v10', 'M12,8 v10', 'M19,8 v10', 'M3,20 h18'],
  immobilien: ['M4,11 l8,-7 l8,7', 'M6,10 v10 h12 v-10', 'M10,20 v-6 h4 v6'],
  gerichte: ['M7,3 v8 a2,2 0 0 0 4,0 v-8', 'M9,11 v10', 'M17,3 c-2,2 -2,6 0,7 v11'],
  tanken: ['M4,20 v-15 a1,1 0 0 1 1,-1 h7 a1,1 0 0 1 1,1 v15', 'M3,20 h12', 'M6,8 h5',
    'M14,9 h3 a1,1 0 0 1 1,1 v7 a1,1 0 0 0 2,0 v-7 l-2,-3'],
  gruppen: ['M9,8 a3,3 0 1 0 0.01,0', 'M3,20 c0,-3.3 2.7,-5 6,-5 s6,1.7 6,5', 'M16,5 a2.6,2.6 0 1 0 0.01,0', 'M17,15 c2.6,0.4 4,2 4,5'],
  woche: ['M4,6 h16 v14 h-16 Z', 'M4,10 h16', 'M9,4 v4', 'M15,4 v4', 'M8,14 h3', 'M8,17 h7'],
  schulden: ['M3,9 h14', 'M14,6 l3,3 l-3,3', 'M21,15 H7', 'M10,12 l-3,3 l3,3'],
  hell: ['M12,5 a7,7 0 1 0 0.01,0', 'M12,1 v2', 'M12,21 v2', 'M4.2,4.2 l1.4,1.4',
    'M18.4,18.4 l1.4,1.4', 'M1,12 h2', 'M21,12 h2', 'M4.2,19.8 l1.4,-1.4', 'M18.4,5.6 l1.4,-1.4'],
  dunkel: ['M20,14.5 A8.5,8.5 0 1 1 9.5,4 a6.6,6.6 0 0 0 10.5,10.5 z'],
  system: ['M12,3 a9,9 0 1 0 0.01,0', 'M12,3 v18', 'M12,3 a9,9 0 0 1 0,18 z'],
};

export function symbolSvg(name, { size = 22 } = {}) {
  const root = svg('svg', {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    class: 'symbol', 'aria-hidden': 'true',
  });
  for (const d of PFADE[name] ?? []) root.appendChild(svg('path', { d }));
  return root;
}

// Dasselbe Zeichen als Browser-Symbol im Tab.
export function faviconDataUri() {
  const markup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
    + '<rect width="32" height="32" rx="7.4" fill="#1b2130"/>'
    + '<g transform="translate(5.4 5.4) scale(0.66)">'
    + `<rect x="5" y="4" width="6.2" height="24" rx="2.4" fill="#aeb8c7"/>`
    + `<path d="${F_ARM_OBEN}" fill="#5b8cf5"/>`
    + `<path d="${F_ARM_UNTEN}" fill="#22c55e"/>`
    + '</g></svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(markup);
}
