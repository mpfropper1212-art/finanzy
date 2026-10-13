// Gezeichneter Teller je Gericht. Bewusst keine Fotos: die müssten gehostet
// und lizenziert werden, und ein falsches Foto ist irreführender als gar keins.
// Die Anordnung hängt am Namen, dasselbe Gericht sieht also immer gleich aus.

import { svg } from './util.js';
import { ART_FARBEN } from './gerichte-daten.js';

const ESSEN = [
  '#e0a33c', '#cf6a3b', '#7fa44c', '#c44a4a', '#e6dab4',
  '#9a6434', '#5f9e6e', '#d98b35', '#b8863f', '#8fae5a',
];

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function zufall(saat) {
  let s = saat || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function tellerSvg(gericht, { size = 76 } = {}) {
  const r = zufall(hash(gericht.id || gericht.name));
  const root = svg('svg', {
    width: size, height: size, viewBox: '0 0 76 76',
    class: 'teller', 'aria-hidden': 'true',
  });

  root.appendChild(svg('circle', {
    cx: 38, cy: 38, r: 35, fill: 'var(--surface)', stroke: 'var(--border-strong)',
  }));
  root.appendChild(svg('circle', {
    cx: 38, cy: 38, r: 27, fill: 'none', stroke: 'var(--border)',
  }));

  // Drei bis fünf Portionen, gleichmäßig verteilt und leicht versetzt, damit
  // es nach Essen aussieht und nicht nach Diagramm.
  const anzahl = 3 + Math.floor(r() * 3);
  const start = r() * Math.PI * 2;
  const farben = [...ESSEN].sort(() => r() - 0.5);

  for (let i = 0; i < anzahl; i++) {
    const winkel = start + (i / anzahl) * Math.PI * 2 + (r() - 0.5) * 0.5;
    const abstand = 9 + r() * 6;
    const groesse = 7.5 + r() * 4.5;
    const cx = 38 + Math.cos(winkel) * abstand;
    const cy = 38 + Math.sin(winkel) * abstand;

    if (r() < 0.35) {
      root.appendChild(svg('rect', {
        x: cx - groesse, y: cy - groesse * 0.6,
        width: groesse * 2, height: groesse * 1.2, rx: groesse * 0.5,
        fill: farben[i % farben.length],
        transform: `rotate(${Math.round((winkel * 180) / Math.PI)} ${cx} ${cy})`,
      }));
    } else {
      root.appendChild(svg('circle', { cx, cy, r: groesse, fill: farben[i % farben.length] }));
    }
  }

  // Ein Streifen in der Farbe der Ernährungsform als stille Wiederholung
  // der Kennzeichnung auf der Karte.
  root.appendChild(svg('path', {
    d: 'M10,58 A35,35 0 0 0 66,58',
    fill: 'none',
    stroke: ART_FARBEN[gericht.art] ?? ART_FARBEN.vegetarisch,
    'stroke-width': 3.5,
    'stroke-linecap': 'round',
    opacity: 0.85,
  }));

  return root;
}
