// Download-Helfer: SVG, PNG, JSON.

import { isoDatum } from './util.js';

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function slugFilename(text, ext) {
  const base = String(text || 'diagramm').toLowerCase()
    .replace(/[äöüß]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c]))
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'diagramm';
  const d = isoDatum();
  return `${base}-${d}.${ext}`;
}

// Im Dokument lösen Browser `currentColor` und `var(--x)` auf, in einer
// exportierten Datei nicht. Darum vor dem Serialisieren fest einsetzen.
function standalone(source) {
  const clone = source.cloneNode(true);
  const origs = [source, ...source.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  const bodyStyle = getComputedStyle(document.body);

  for (let i = 0; i < origs.length; i++) {
    const style = getComputedStyle(origs[i]);
    for (const attr of ['fill', 'stroke', 'stop-color']) {
      const v = copies[i].getAttribute(attr);
      if (!v) continue;
      if (v === 'currentColor') {
        copies[i].setAttribute(attr, style.color);
      } else if (v.startsWith('var(')) {
        const name = v.slice(4, -1).trim();
        const resolved = bodyStyle.getPropertyValue(name).trim();
        if (resolved) copies[i].setAttribute(attr, resolved);
      }
    }
  }

  const bg = clone.querySelector('[data-export-bg]');
  const surface = bodyStyle.getPropertyValue('--surface').trim() || '#ffffff';
  if (bg) {
    bg.setAttribute('fill', surface);
  } else {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', 0);
    rect.setAttribute('y', 0);
    rect.setAttribute('width', clone.getAttribute('width') || 1000);
    rect.setAttribute('height', clone.getAttribute('height') || 600);
    rect.setAttribute('fill', surface);
    clone.insertBefore(rect, clone.firstChild);
  }

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('class');
  return clone;
}

function serialize(source) {
  const clone = standalone(source);
  return {
    markup: '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone),
    width: Number(clone.getAttribute('width')) || 1000,
    height: Number(clone.getAttribute('height')) || 600,
  };
}

export function downloadSvg(source, filename) {
  const { markup } = serialize(source);
  saveBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

export async function downloadPng(source, filename, scale = 2) {
  const { markup, width, height } = serialize(source);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Das Diagramm konnte nicht als Bild gerendert werden.'));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('PNG konnte nicht erzeugt werden.');
  saveBlob(blob, filename);
}

export function downloadJson(obj, filename) {
  saveBlob(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename);
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new Error('Die Datei ist kein gültiges JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden.'));
    reader.readAsText(file);
  });
}
