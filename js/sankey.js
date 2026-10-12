// Sankey: Layout (Spalten, Stapelung, Kreuzungsreduktion) und SVG-Rendering.

import { PALETTE, money, moneyShort, svg, fitText, mixWithWhite, isValidHex, clear } from './util.js';

const NODE_W = 15;
const NODE_GAP = 16;
const PAD = { top: 26, right: 150, bottom: 26, left: 18 };
const MIN_COL_SPACE = 162;
const HUB_COLOR = '#64748b';
const LABEL_PAD = 9;

export function computeLayout(sankey, { width, height }) {
  const result = { nodes: [], links: [], warnings: [], error: null, width, height };

  const byId = new Map(sankey.nodes.map(n => [n.id, n]));
  const flows = sankey.flows.filter(f =>
    Number(f.amount) > 0 && byId.has(f.from) && byId.has(f.to) && f.from !== f.to);

  if (!flows.length) {
    result.error = { kind: 'empty' };
    return result;
  }

  const used = new Set();
  for (const f of flows) { used.add(f.from); used.add(f.to); }
  const active = sankey.nodes.filter(n => used.has(n.id));
  result.unusedCount = sankey.nodes.length - active.length;

  const outL = new Map(), inL = new Map();
  for (const n of active) { outL.set(n.id, []); inL.set(n.id, []); }
  for (const f of flows) { outL.get(f.from).push(f); inL.get(f.to).push(f); }

  // Spaltenzuordnung per Kahn-Topologie; der längste Pfad bestimmt die Tiefe.
  const indeg = new Map(active.map(n => [n.id, inL.get(n.id).length]));
  const depth = new Map(active.map(n => [n.id, 0]));
  const queue = active.filter(n => indeg.get(n.id) === 0).map(n => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const f of outL.get(id)) {
      if (depth.get(f.to) < depth.get(id) + 1) depth.set(f.to, depth.get(id) + 1);
      indeg.set(f.to, indeg.get(f.to) - 1);
      if (indeg.get(f.to) === 0) queue.push(f.to);
    }
  }
  if (order.length !== active.length) {
    const done = new Set(order);
    const stuck = new Set(active.filter(n => !done.has(n.id)).map(n => n.id));
    result.error = { kind: 'cycle', names: cycleMembers(stuck, flows).map(id => byId.get(id).name) };
    return result;
  }

  const sum = list => list.reduce((s, f) => s + Number(f.amount), 0);
  const value = new Map();
  const inSum = new Map(), outSum = new Map();
  for (const n of active) {
    const si = sum(inL.get(n.id)), so = sum(outL.get(n.id));
    inSum.set(n.id, si);
    outSum.set(n.id, so);
    value.set(n.id, Math.max(si, so));
  }

  const colCount = Math.max(...depth.values()) + 1;
  const columns = Array.from({ length: colCount }, () => []);
  for (const n of active) columns[depth.get(n.id)].push(n.id);

  // Breite so wählen, dass Labels zwischen die Spalten passen; sonst scrollt der Host.
  const neededWidth = PAD.left + PAD.right + colCount * NODE_W + Math.max(0, colCount - 1) * (MIN_COL_SPACE - NODE_W);
  const w = Math.max(width, neededWidth);
  const plotH = height - PAD.top - PAD.bottom;

  let k = Infinity;
  for (const col of columns) {
    const space = plotH - (col.length - 1) * NODE_GAP;
    const total = col.reduce((s, id) => s + value.get(id), 0);
    if (space <= 10) {
      result.error = { kind: 'too-tall', count: col.length };
      return result;
    }
    if (total > 0) k = Math.min(k, space / total);
  }
  if (!Number.isFinite(k) || k <= 0) {
    result.error = { kind: 'empty' };
    return result;
  }

  const colStep = colCount > 1 ? (w - PAD.left - PAD.right - NODE_W) / (colCount - 1) : 0;
  const xOf = d => PAD.left + d * colStep;
  const labelSpace = (colCount > 1 ? colStep - NODE_W : PAD.right) - LABEL_PAD * 2;

  const y0 = new Map();
  const stack = () => {
    for (const col of columns) {
      const total = col.reduce((s, id) => s + value.get(id) * k, 0) + (col.length - 1) * NODE_GAP;
      let y = PAD.top + Math.max(0, (plotH - total) / 2);
      for (const id of col) {
        y0.set(id, y);
        y += value.get(id) * k + NODE_GAP;
      }
    }
  };
  const center = id => y0.get(id) + value.get(id) * k / 2;

  // Knoten innerhalb einer Spalte an die Nachbarspalte angleichen -> weniger Kreuzungen.
  const barycenter = (id, links, endKey) => {
    const ls = links.get(id);
    if (!ls.length) return center(id);
    let wsum = 0, acc = 0;
    for (const f of ls) {
      const a = Number(f.amount);
      acc += center(f[endKey]) * a;
      wsum += a;
    }
    return wsum > 0 ? acc / wsum : center(id);
  };

  stack();
  for (let pass = 0; pass < 3; pass++) {
    for (let d = 1; d < colCount; d++) {
      const keys = new Map(columns[d].map(id => [id, barycenter(id, inL, 'from')]));
      columns[d].sort((a, b) => keys.get(a) - keys.get(b));
    }
    stack();
    for (let d = colCount - 2; d >= 0; d--) {
      const keys = new Map(columns[d].map(id => [id, barycenter(id, outL, 'to')]));
      columns[d].sort((a, b) => keys.get(a) - keys.get(b));
    }
    stack();
  }

  const colors = assignColors({ order, active, byId, inL, outL, value, columns });

  for (const n of active) {
    result.nodes.push({
      id: n.id,
      name: n.name,
      x: xOf(depth.get(n.id)),
      y: y0.get(n.id),
      w: NODE_W,
      h: Math.max(1, value.get(n.id) * k),
      value: value.get(n.id),
      inSum: inSum.get(n.id),
      outSum: outSum.get(n.id),
      color: colors.get(n.id),
      depth: depth.get(n.id),
      isLast: depth.get(n.id) === colCount - 1,
    });
  }
  const nodeById = new Map(result.nodes.map(n => [n.id, n]));

  // Bandansätze an den Knotenkanten stapeln, von oben, sortiert nach Gegenseite.
  const cursorOut = new Map(), cursorIn = new Map();
  for (const n of active) {
    cursorOut.set(n.id, y0.get(n.id));
    cursorIn.set(n.id, y0.get(n.id));
    outL.get(n.id).sort((a, b) => center(a.to) - center(b.to));
    inL.get(n.id).sort((a, b) => center(a.from) - center(b.from));
  }
  for (const n of active) {
    for (const f of outL.get(n.id)) {
      f._sy = cursorOut.get(n.id);
      cursorOut.set(n.id, f._sy + Number(f.amount) * k);
    }
  }
  for (const n of active) {
    for (const f of inL.get(n.id)) {
      f._ty = cursorIn.get(n.id);
      cursorIn.set(n.id, f._ty + Number(f.amount) * k);
    }
  }

  for (const f of flows) {
    const a = nodeById.get(f.from), b = nodeById.get(f.to);
    const h = Math.max(1, Number(f.amount) * k);
    const x0 = a.x + a.w, x1 = b.x;
    const cx = (x0 + x1) / 2;
    result.links.push({
      id: f.id,
      from: f.from,
      to: f.to,
      amount: Number(f.amount),
      note: f.note,
      thickness: h,
      colorFrom: a.color,
      colorTo: b.color,
      d: `M${x0},${f._sy}C${cx},${f._sy} ${cx},${f._ty} ${x1},${f._ty}`
        + `L${x1},${f._ty + h}C${cx},${f._ty + h} ${cx},${f._sy + h} ${x0},${f._sy + h}Z`,
    });
  }

  for (const n of result.nodes) {
    if (n.inSum > 0 && n.outSum > 0 && Math.abs(n.inSum - n.outSum) > 0.005) {
      result.warnings.push({
        node: n.name,
        inSum: n.inSum,
        outSum: n.outSum,
        diff: n.inSum - n.outSum,
      });
    }
  }

  result.width = w;
  result.labelSpace = Math.max(60, labelSpace);
  result.rightLabelSpace = PAD.right - LABEL_PAD * 2;
  return result;
}

// Kahn lässt nicht nur den Kreis selbst übrig, sondern auch alles dahinter.
// Wer im Teilgraph keinen Vorgänger oder keinen Nachfolger mehr hat, kann nicht
// auf einem Kreis liegen - wegstreichen, bis nur noch der Kreis übrig ist.
function cycleMembers(stuck, flows) {
  const members = new Set(stuck);
  for (;;) {
    const inside = flows.filter(f => members.has(f.from) && members.has(f.to));
    const hasIn = new Set(inside.map(f => f.to));
    const hasOut = new Set(inside.map(f => f.from));
    const drop = [...members].filter(id => !hasIn.has(id) || !hasOut.has(id));
    if (!drop.length) break;
    for (const id of drop) members.delete(id);
  }
  return members.size ? [...members] : [...stuck];
}

// Eigene Farbe für alles, was verzweigt; Blätter erben einen helleren Ton ihres
// Oberpostens, außer sie hängen direkt am Hauptknoten (meist "Netto").
function assignColors({ order, active, byId, inL, outL, value }) {
  let hub = null, hubOut = 1;
  for (const n of active) {
    const deg = outL.get(n.id).length;
    if (deg > hubOut || (deg === hubOut && hub && value.get(n.id) > value.get(hub))) {
      hub = n.id;
      hubOut = deg;
    }
  }

  const colors = new Map();
  const shade = new Map();
  let next = 0;

  for (const id of order) {
    const node = byId.get(id);
    if (isValidHex(node.color)) {
      colors.set(id, node.color);
      shade.set(id, 0);
      continue;
    }
    // Der Knoten, an dem sich alles aufteilt, ist eine Summe und keine
    // Kategorie - eine Signalfarbe würde ihn falsch gewichten.
    if (id === hub) {
      colors.set(id, HUB_COLOR);
      shade.set(id, 0);
      continue;
    }
    const ins = inL.get(id);
    let parent = null;
    for (const f of ins) {
      if (!parent || Number(f.amount) > Number(parent.amount)) parent = f;
    }
    const isLeaf = outL.get(id).length === 0;
    if (parent && isLeaf && parent.from !== hub) {
      const lvl = (shade.get(parent.from) ?? 0) + 1;
      shade.set(id, lvl);
      colors.set(id, mixWithWhite(colors.get(parent.from) ?? PALETTE[0], Math.min(0.5, lvl * 0.3)));
    } else {
      shade.set(id, 0);
      colors.set(id, PALETTE[next % PALETTE.length]);
      next++;
    }
  }
  return colors;
}

export function renderSankey(host, sankey, layout) {
  clear(host);

  const root = svg('svg', {
    width: layout.width,
    height: layout.height,
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  });
  root.appendChild(svg('rect', {
    x: 0, y: 0, width: layout.width, height: layout.height, fill: 'transparent',
    'data-export-bg': '1',
  }));

  if (layout.error) {
    root.appendChild(svg('text', {
      x: layout.width / 2, y: layout.height / 2, 'text-anchor': 'middle',
      fill: 'currentColor', 'font-size': 14, opacity: 0.55,
    }, errorText(layout.error)));
    host.appendChild(root);
    return;
  }

  const defs = svg('defs');
  const gLinks = svg('g', { 'fill-opacity': 0.55 });
  const gNodes = svg('g');
  const gLabels = svg('g');
  const inlinePairs = [];

  for (const link of layout.links) {
    const gid = `grad-${link.id}`;
    const grad = svg('linearGradient', { id: gid, x1: '0%', x2: '100%', y1: '0%', y2: '0%' });
    grad.appendChild(svg('stop', { offset: '0%', 'stop-color': link.colorFrom }));
    grad.appendChild(svg('stop', { offset: '100%', 'stop-color': link.colorTo }));
    defs.appendChild(grad);

    const path = svg('path', {
      d: link.d,
      fill: `url(#${gid})`,
      class: 'sankey-link',
      'data-from': link.from,
      'data-to': link.to,
    });
    const label = `${nameOf(layout, link.from)} → ${nameOf(layout, link.to)}: ${money(link.amount)}`;
    path.appendChild(svg('title', {}, link.note ? `${label}\n${link.note}` : label));
    gLinks.appendChild(path);
  }

  for (const n of layout.nodes) {
    const rect = svg('rect', {
      x: n.x, y: n.y, width: n.w, height: n.h, rx: 3,
      fill: n.color, class: 'sankey-node', 'data-node': n.id,
    });
    rect.appendChild(svg('title', {}, `${n.name}: ${money(n.value)}`));
    gNodes.appendChild(rect);

    const space = n.isLast ? layout.rightLabelSpace : layout.labelSpace;
    const tx = n.x + n.w + LABEL_PAD;
    const cy = n.y + n.h / 2;
    const twoLines = n.h >= 26;

    const name = svg('text', {
      x: tx,
      y: twoLines ? cy - 2 : cy + 4,
      fill: 'currentColor',
      'font-size': 12.5,
      'font-weight': 600,
    }, fitText(n.name, space));
    gLabels.appendChild(name);

    const amount = svg('text', {
      x: tx,
      y: twoLines ? cy + 12 : cy + 4,
      fill: 'currentColor',
      'font-size': 11.5,
      opacity: 0.62,
    }, moneyShort(n.value));
    gLabels.appendChild(amount);

    if (!twoLines) inlinePairs.push({ name, amount, tx });
  }

  root.append(defs, gLinks, gNodes, gLabels);
  host.appendChild(root);

  // Erst im Dokument lässt sich die Textbreite messen; geschätzte Breiten
  // ließen den Betrag in den Namen hineinlaufen.
  for (const { name, amount, tx } of inlinePairs) {
    amount.setAttribute('x', tx + name.getComputedTextLength() + 7);
  }

  wireHighlight(root);
}

function nameOf(layout, id) {
  return layout.nodes.find(n => n.id === id)?.name ?? id;
}

function errorText(error) {
  if (error.kind === 'empty') return 'Noch keine Flüsse – rechts einen Posten anlegen.';
  if (error.kind === 'cycle') return 'Kreislauf in den Flüssen – siehe Hinweis unten.';
  if (error.kind === 'too-tall') return 'Zu viele Posten für diese Höhe – Höhe erhöhen.';
  return 'Diagramm kann nicht gezeichnet werden.';
}

// Beim Überfahren eines Knotens nur dessen Bänder hervorheben.
function wireHighlight(root) {
  const links = [...root.querySelectorAll('.sankey-link')];

  const lightUp = predicate => {
    root.classList.add('is-hovering');
    for (const l of links) l.classList.toggle('is-lit', predicate(l));
  };
  const reset = () => {
    root.classList.remove('is-hovering');
    for (const l of links) l.classList.remove('is-lit');
  };

  root.addEventListener('mouseover', ev => {
    const node = ev.target.closest('.sankey-node');
    if (node) {
      const id = node.dataset.node;
      lightUp(l => l.dataset.from === id || l.dataset.to === id);
      return;
    }
    const link = ev.target.closest('.sankey-link');
    if (link) lightUp(l => l === link);
  });
  root.addEventListener('mouseleave', reset);
  root.addEventListener('mouseout', ev => {
    if (!ev.relatedTarget || !root.contains(ev.relatedTarget)) reset();
  });
}
