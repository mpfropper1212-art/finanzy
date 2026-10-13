// Wortmarke und Bereichssymbole als Inline-SVG - keine Bilddateien, damit die
// App weiterhin ohne externe Ressourcen auskommt und in beiden Themes passt.

import { svg } from './util.js';

const MARKE_FARBEN = ['#2f6feb', '#16a34a', '#d97706'];

// Ein Stamm, der sich nach rechts in drei Bänder aufteilt - dasselbe Bild wie
// das Sankey, das der Kern der App ist.
export function markeSvg({ size = 30, titel = 'Finanzy' } = {}) {
  const root = svg('svg', {
    width: size, height: size, viewBox: '0 0 32 32',
    role: 'img', 'aria-label': titel, class: 'marke',
  });
  root.appendChild(svg('rect', { x: 3, y: 8, width: 7, height: 16, rx: 2.5, fill: '#64748b' }));
  const baender = [
    'M10,8 C18,8 20,4 28,4 L28,9 C20,9 18,13 10,13 Z',
    'M10,13 C18,13 20,12 28,12 L28,18 C20,18 18,19 10,19 Z',
    'M10,19 C18,19 20,22 28,22 L28,28 C20,28 18,24 10,24 Z',
  ];
  baender.forEach((d, i) => root.appendChild(svg('path', { d, fill: MARKE_FARBEN[i] })));
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
    + '<rect width="32" height="32" rx="7" fill="#15191f"/>'
    + '<rect x="4" y="9" width="6" height="14" rx="2" fill="#94a3b8"/>'
    + '<path d="M10,9 C18,9 19,5 28,5 L28,10 C19,10 18,14 10,14 Z" fill="#5b8cf5"/>'
    + '<path d="M10,14 C18,14 19,13 28,13 L28,18 C19,18 18,19 10,19 Z" fill="#22c55e"/>'
    + '<path d="M10,19 C18,19 19,22 28,22 L28,27 C19,27 18,23 10,23 Z" fill="#f59e0b"/>'
    + '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(markup);
}
