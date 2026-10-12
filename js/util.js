// Formatierung, Farben, kleine DOM-Helfer.

const SVG_NS = 'http://www.w3.org/2000/svg';

export function uid(prefix) {
  return prefix + Math.random().toString(36).slice(2, 9);
}

export const PALETTE = [
  '#2f6feb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2',
  '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#a16207',
];

const nfWhole = new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});
const nfCents = new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export function money(value) {
  const v = Number(value) || 0;
  return Number.isInteger(v) ? nfWhole.format(v) : nfCents.format(v);
}

export function moneyShort(value) {
  return nfWhole.format(Number(value) || 0);
}

export function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

export function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    node.setAttribute(k, v);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  const p = v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return '#' + p(r) + p(g) + p(b);
}

export function mixWithWhite(hex, t) {
  const [r, g, b] = hexToRgb(hex);
  const f = Math.max(0, Math.min(0.75, t));
  return rgbToHex([r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f]);
}

export function isValidHex(value) {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

// Nur eine Schätzung für das Kürzen von Labels - reicht, um Überlappungen zu vermeiden.
export function fitText(text, maxWidth, pxPerChar = 6.6) {
  const max = Math.floor(maxWidth / pxPerChar);
  if (max >= text.length) return text;
  if (max <= 1) return '';
  return text.slice(0, Math.max(1, max - 1)).trimEnd() + '…';
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
