// Kontomodell: Konten als verschiebbare Knoten, Umbuchungen als Pfeile.

import { money, moneyShort, svg, el, clear, fitText, uid, isValidHex } from './util.js';

const W = 214;
const H_BASE = 72;
const H_INFO = 92;
const MARGIN = 28;

// Nur Konten mit Notiz brauchen die zusätzliche Zeile.
const heightOf = node => (String(node.info || '').trim() ? H_INFO : H_BASE);

// Eigene Farbe schlägt die Farbe der Kontoart.
export function farbeVon(node) {
  if (isValidHex(node.color)) return node.color;
  return (ACCOUNT_TYPES[node.type] ?? ACCOUNT_TYPES.giro).color;
}

export const ACCOUNT_TYPES = {
  giro: { label: 'Girokonto', color: '#2f6feb' },
  tagesgeld: { label: 'Tagesgeld', color: '#0d9488' },
  depot: { label: 'Depot', color: '#7c3aed' },
  bar: { label: 'Bargeld', color: '#d97706' },
  kredit: { label: 'Kredit', color: '#dc2626' },
};

export function netWorth(accounts) {
  return accounts.nodes.reduce((s, n) => s + (Number(n.balance) || 0), 0);
}

export function monthlyTransferSum(accounts) {
  return accounts.transfers.reduce((s, t) => {
    const a = Number(t.amount) || 0;
    if (t.interval === 'monatlich') return s + a;
    if (t.interval === 'jaehrlich') return s + a / 12;
    return s;
  }, 0);
}

// Rechtwinkliger Verlauf mit abgerundeten Ecken. Je nachdem, ob die Konten
// eher neben- oder übereinander liegen, wird waagerecht oder senkrecht gestartet.
function elbowPoints(a, b, offset) {
  const ha = heightOf(a), hb = heightOf(b);
  const acx = a.x + W / 2, acy = a.y + ha / 2;
  const bcx = b.x + W / 2, bcy = b.y + hb / 2;

  if (Math.abs(bcx - acx) >= Math.abs(bcy - acy)) {
    const right = bcx > acx;
    const p0 = { x: right ? a.x + W : a.x, y: acy };
    const p1 = { x: right ? b.x : b.x + W, y: bcy };
    const mx = (p0.x + p1.x) / 2 + offset;
    return [p0, { x: mx, y: p0.y }, { x: mx, y: p1.y }, p1];
  }
  const below = bcy > acy;
  const p0 = { x: acx, y: below ? a.y + ha : a.y };
  const p1 = { x: bcx, y: below ? b.y : b.y + hb };
  const my = (p0.y + p1.y) / 2 + offset;
  return [p0, { x: p0.x, y: my }, { x: p1.x, y: my }, p1];
}

function roundedPath(points, radius = 12) {
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i], prev = points[i - 1], next = points[i + 1];
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y) || 1;
    const outLen = Math.hypot(next.x - p.x, next.y - p.y) || 1;
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const from = { x: p.x + (prev.x - p.x) / inLen * r, y: p.y + (prev.y - p.y) / inLen * r };
    const to = { x: p.x + (next.x - p.x) / outLen * r, y: p.y + (next.y - p.y) / outLen * r };
    d += ` L${from.x},${from.y} Q${p.x},${p.y} ${to.x},${to.y}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last.x},${last.y}`;
}

function anchorPoint(node, towardsCx, towardsCy) {
  const h = heightOf(node);
  const cx = node.x + W / 2, cy = node.y + h / 2;
  const dx = towardsCx - cx, dy = towardsCy - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const tx = dx ? (W / 2) / Math.abs(dx) : Infinity;
  const ty = dy ? (h / 2) / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

export function createAccountsView({ host, store, requestEditor }) {
  const data = () => store.data.accounts;
  let root = null, layerLinks = null, layerNodes = null;
  let connectMode = false;
  let connectFrom = null;
  let drag = null;

  function ensureRoot() {
    if (root) return;
    root = svg('svg', {
      class: 'acct-canvas',
      'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    });

    const defs = svg('defs');
    const marker = svg('marker', {
      id: 'acct-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5,
      markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse',
    });
    marker.appendChild(svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'currentColor' }));
    defs.appendChild(marker);

    layerLinks = svg('g');
    layerNodes = svg('g');
    root.append(defs, layerLinks, layerNodes);
    host.appendChild(root);

    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerUp);
  }

  function canvasPoint(ev) {
    const r = root.getBoundingClientRect();
    return { x: ev.clientX - r.left + host.scrollLeft, y: ev.clientY - r.top + host.scrollTop };
  }

  function onPointerDown(ev) {
    const label = ev.target.closest('[data-transfer-label]');
    if (label && !connectMode) {
      const t = data().transfers.find(x => x.id === label.dataset.transferLabel);
      if (t) {
        const p = canvasPoint(ev);
        drag = {
          typ: 'label', id: t.id, moved: false,
          startX: p.x, startY: p.y,
          startDx: Number(t.labelDx) || 0, startDy: Number(t.labelDy) || 0,
        };
        root.setPointerCapture(ev.pointerId);
        ev.preventDefault();
        return;
      }
    }

    const g = ev.target.closest('[data-account]');
    if (!g) return;
    const node = data().nodes.find(n => n.id === g.dataset.account);
    if (!node) return;

    if (connectMode) {
      // Ohne das setzt der Browser den Fokus zurück auf die Zeichenfläche und
      // nimmt ihn dem Betragsfeld, das handleConnectClick gerade aktiviert hat.
      ev.preventDefault();
      handleConnectClick(node);
      return;
    }
    const p = canvasPoint(ev);
    drag = { typ: 'konto', id: node.id, dx: p.x - node.x, dy: p.y - node.y, moved: false };
    root.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }

  function onPointerMove(ev) {
    if (!drag) return;

    if (drag.typ === 'label') {
      const t = data().transfers.find(x => x.id === drag.id);
      if (!t) return;
      const p = canvasPoint(ev);
      t.labelDx = Math.round(drag.startDx + (p.x - drag.startX));
      t.labelDy = Math.round(drag.startDy + (p.y - drag.startY));
      drag.moved = true;
      draw();
      return;
    }

    const node = data().nodes.find(n => n.id === drag.id);
    if (!node) return;
    const p = canvasPoint(ev);
    const nx = Math.max(8, Math.round(p.x - drag.dx));
    const ny = Math.max(8, Math.round(p.y - drag.dy));
    if (!drag.moved && Math.abs(nx - node.x) < 3 && Math.abs(ny - node.y) < 3) return;
    drag.moved = true;
    node.x = nx;
    node.y = ny;
    draw();
  }

  function onPointerUp(ev) {
    if (!drag) return;
    if (root.hasPointerCapture(ev.pointerId)) root.releasePointerCapture(ev.pointerId);
    if (drag.moved) store.commit({ silent: true });
    drag = null;
  }

  function handleConnectClick(node) {
    if (!connectFrom) {
      connectFrom = node.id;
      draw();
      return;
    }
    if (connectFrom === node.id) {
      connectFrom = null;
      draw();
      return;
    }
    data().transfers.push({
      id: uid('t'), from: connectFrom, to: node.id,
      amount: 0, label: '', interval: 'monatlich',
    });
    connectFrom = null;
    setConnectMode(false);
    store.commit({ silent: true });
    draw();
    requestEditor({ focusLastTransfer: true });
  }

  function setConnectMode(on) {
    connectMode = on;
    connectFrom = null;
    root?.classList.toggle('is-connecting', on);
    document.getElementById('btn-connect')?.classList.toggle('is-active', on);
    draw();
  }

  function toggleConnectMode() {
    setConnectMode(!connectMode);
  }

  function tidy() {
    const nodes = data().nodes;
    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    nodes.forEach((n, i) => {
      n.x = MARGIN + (i % cols) * (W + 118);
      n.y = MARGIN + Math.floor(i / cols) * (H_INFO + 64);
    });
    for (const t of data().transfers) { t.labelDx = 0; t.labelDy = 0; }
    store.commit({ silent: true });
    draw();
  }

  function draw() {
    ensureRoot();
    clear(layerLinks);
    clear(layerNodes);

    const nodes = data().nodes;
    const byId = new Map(nodes.map(n => [n.id, n]));
    const width = Math.max(host.clientWidth - 2, ...nodes.map(n => n.x + W + MARGIN), 520);
    const height = Math.max(420, ...nodes.map(n => n.y + heightOf(n) + MARGIN));
    root.setAttribute('width', width);
    root.setAttribute('height', height);
    root.setAttribute('viewBox', `0 0 ${width} ${height}`);

    if (!nodes.length) {
      layerNodes.appendChild(svg('text', {
        x: width / 2, y: height / 2, 'text-anchor': 'middle',
        fill: 'currentColor', 'font-size': 14, opacity: 0.55,
      }, 'Noch keine Konten – rechts eines anlegen.'));
      return;
    }

    // Mehrere Verbindungen zwischen denselben zwei Konten versetzt zeichnen,
    // damit Hin- und Rückfluss sich nicht überdecken.
    const groups = new Map();
    for (const t of data().transfers) {
      if (!byId.has(t.from) || !byId.has(t.to) || t.from === t.to) continue;
      const key = [t.from, t.to].sort().join('|');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }

    const elbow = data().edgeStyle === 'knick';

    for (const list of groups.values()) {
      list.forEach((t, i) => {
        const a = byId.get(t.from), b = byId.get(t.to);
        const offset = (i - (list.length - 1) / 2) * 38;

        let d, lx, ly;
        if (elbow) {
          const pts = elbowPoints(a, b, offset);
          d = roundedPath(pts);
          lx = (pts[1].x + pts[2].x) / 2;
          ly = (pts[1].y + pts[2].y) / 2;
        } else {
          const acx = a.x + W / 2, acy = a.y + heightOf(a) / 2;
          const bcx = b.x + W / 2, bcy = b.y + heightOf(b) / 2;
          const mx = (acx + bcx) / 2, my = (acy + bcy) / 2;
          const len = Math.hypot(bcx - acx, bcy - acy) || 1;
          const px = -(bcy - acy) / len, py = (bcx - acx) / len;
          const ctrl = { x: mx + px * offset, y: my + py * offset };
          const p0 = anchorPoint(a, ctrl.x, ctrl.y);
          const p1 = anchorPoint(b, ctrl.x, ctrl.y);
          d = `M${p0.x},${p0.y} Q${ctrl.x},${ctrl.y} ${p1.x},${p1.y}`;
          lx = (p0.x + 2 * ctrl.x + p1.x) / 4;
          ly = (p0.y + 2 * ctrl.y + p1.y) / 4;
        }

        const path = svg('path', {
          d,
          fill: 'none',
          stroke: 'currentColor',
          'stroke-opacity': 0.42,
          'stroke-width': 1.8,
          'marker-end': 'url(#acct-arrow)',
        });
        path.appendChild(svg('title', {}, transferTitle(t, a, b)));
        layerLinks.appendChild(path);

        const text = t.label
          ? `${moneyShort(t.amount)} · ${t.label}`
          : `${moneyShort(t.amount)}${t.interval === 'jaehrlich' ? ' / Jahr' : ''}`;
        const wBox = text.length * 6.2 + 12;

        const dx = Number(t.labelDx) || 0;
        const dy = Number(t.labelDy) || 0;
        const bx = lx + dx;
        const by = ly + dy;

        // Verschobene Beschriftungen bekommen eine dünne Linie zum Pfeil,
        // damit klar bleibt, zu welcher Umbuchung sie gehören.
        if (Math.hypot(dx, dy) > 24) {
          layerLinks.appendChild(svg('line', {
            x1: lx, y1: ly, x2: bx, y2: by,
            stroke: 'currentColor', 'stroke-opacity': 0.25, 'stroke-dasharray': '2 3',
          }));
        }

        const beschriftung = svg('g', { class: 'acct-label' });
        beschriftung.setAttribute('data-transfer-label', t.id);
        beschriftung.appendChild(svg('rect', {
          x: bx - wBox / 2, y: by - 10, width: wBox, height: 20, rx: 6,
          fill: 'var(--surface)', stroke: 'var(--border)',
        }));
        beschriftung.appendChild(svg('text', {
          x: bx, y: by + 4, 'text-anchor': 'middle',
          'font-size': 11.5, fill: 'currentColor', opacity: 0.8,
        }, text));
        beschriftung.appendChild(svg('title', {}, `${text} – zum Verschieben ziehen`));
        layerLinks.appendChild(beschriftung);
      });
    }

    for (const n of nodes) {
      const meta = ACCOUNT_TYPES[n.type] ?? ACCOUNT_TYPES.giro;
      const farbe = farbeVon(n);
      const g = svg('g', {
        class: 'acct-node' + (connectFrom === n.id ? ' is-selected' : ''),
        transform: `translate(${n.x},${n.y})`,
      });
      g.setAttribute('data-account', n.id);

      const h = heightOf(n);
      const bank = String(n.bank || '').trim();
      const info = String(n.info || '').trim();

      g.appendChild(svg('rect', {
        x: 0, y: 0, width: W, height: h, rx: 11,
        fill: 'var(--surface)',
        stroke: connectFrom === n.id ? farbe : 'var(--border-strong)',
        'stroke-width': connectFrom === n.id ? 2.5 : 1.2,
      }));
      g.appendChild(svg('rect', { x: 0, y: 0, width: 5, height: h, rx: 2.5, fill: farbe }));
      g.appendChild(svg('text', {
        x: 16, y: 25, 'font-size': 13.5, 'font-weight': 600, fill: 'currentColor',
      }, fitText(n.name, W - 28, 7)));
      g.appendChild(svg('text', {
        x: 16, y: 45, 'font-size': 14, fill: 'currentColor',
        'font-variant-numeric': 'tabular-nums',
      }, money(n.balance)));
      g.appendChild(svg('text', {
        x: 16, y: 61, 'font-size': 10.5, fill: 'currentColor', opacity: 0.55,
        'letter-spacing': '.04em',
      }, fitText(bank ? `${meta.label.toUpperCase()} · ${bank}` : meta.label.toUpperCase(), W - 28, 5.9)));
      if (info) {
        g.appendChild(svg('text', {
          x: 16, y: 80, 'font-size': 11, fill: 'currentColor', opacity: 0.72,
        }, fitText(info, W - 28, 5.5)));
      }

      g.appendChild(svg('title', {},
        [`${n.name} · ${meta.label}`, bank, money(n.balance), info].filter(Boolean).join('\n')));
      layerNodes.appendChild(g);
    }
  }

  function transferTitle(t, a, b) {
    const parts = [`${a.name} → ${b.name}`, money(t.amount), t.interval];
    if (t.label) parts.push(t.label);
    return parts.join(' · ');
  }

  function renderNotes(notesHost) {
    clear(notesHost);
    if (connectMode) {
      notesHost.appendChild(el('p', { class: 'note note-info' },
        connectFrom
          ? 'Jetzt das Zielkonto anklicken.'
          : 'Verbinden-Modus: erst Quellkonto, dann Zielkonto anklicken.'));
    }
  }

  function toggleEdgeStyle() {
    data().edgeStyle = data().edgeStyle === 'knick' ? 'kurve' : 'knick';
    store.commit({ silent: true });
    draw();
    return data().edgeStyle;
  }

  return {
    draw, toggleConnectMode, setConnectMode, tidy, renderNotes, toggleEdgeStyle,
    edgeStyle: () => data().edgeStyle,
    isConnecting: () => connectMode,
  };
}

export function createAccountsEditor({ accountHost, transferHost, store, requestChart }) {
  const data = () => store.data.accounts;

  function structuralChange(opts = {}) {
    store.commit({ silent: true });
    renderAll(opts);
    requestChart();
  }

  function valueChange() {
    store.commit({ silent: true });
    requestChart();
  }

  function renderAccounts() {
    clear(accountHost);
    const nodes = data().nodes;
    if (!nodes.length) {
      accountHost.appendChild(el('p', { class: 'empty' }, 'Noch keine Konten.'));
      return;
    }
    const head = el('div', { class: 'row row-account' });
    head.append(
      el('span', { class: 'stat-label' }, 'Name'),
      el('span', { class: 'stat-label' }, 'Art'),
      el('span', { class: 'stat-label' }, 'Stand'),
      el('span'),
    );
    accountHost.appendChild(head);

    for (const node of nodes) {
      const row = el('div', { class: 'row row-account' });
      const name = el('input', {
        type: 'text', value: node.name, placeholder: 'Kontoname',
        'data-account-name': node.id,
      });
      const type = el('select');
      for (const [key, meta] of Object.entries(ACCOUNT_TYPES)) {
        const opt = el('option', { value: key }, meta.label);
        if (key === node.type) opt.selected = true;
        type.appendChild(opt);
      }
      const balance = el('input', { type: 'number', step: '10', value: node.balance });
      const del = el('button', { class: 'icon-btn', type: 'button', title: 'Konto löschen' }, '×');

      name.addEventListener('input', () => {
        node.name = name.value;
        // Die Auswahlfelder der Umbuchungen zeigen denselben Namen - direkt
        // nachziehen, statt die Zeilen unter dem Cursor neu zu bauen.
        for (const opt of transferHost.querySelectorAll(`option[value="${node.id}"]`)) {
          opt.textContent = name.value;
        }
        valueChange();
      });
      type.addEventListener('change', () => {
        node.type = type.value;
        if (!isValidHex(node.color)) farbe.value = farbeVon(node);
        valueChange();
      });
      balance.addEventListener('input', () => { node.balance = Number(balance.value) || 0; valueChange(); });
      del.addEventListener('click', () => {
        data().nodes = data().nodes.filter(n => n.id !== node.id);
        data().transfers = data().transfers.filter(t => t.from !== node.id && t.to !== node.id);
        structuralChange();
      });

      row.append(name, type, balance, del);
      accountHost.appendChild(row);

      const detail = el('div', { class: 'row row-account-detail' });
      const farbe = el('input', {
        type: 'color', value: farbeVon(node),
        title: `Farbe für ${node.name} – Doppelklick setzt sie zurück`,
      });
      const bank = el('input', { type: 'text', value: node.bank ?? '', placeholder: 'Bank' });
      const info = el('input', { type: 'text', value: node.info ?? '', placeholder: 'Info (optional)' });

      farbe.addEventListener('input', () => { node.color = farbe.value; valueChange(); });
      // Zurück zur Farbe der Kontoart, ohne einen zweiten Knopf je Zeile.
      farbe.addEventListener('dblclick', () => {
        node.color = null;
        farbe.value = farbeVon(node);
        valueChange();
      });
      bank.addEventListener('input', () => { node.bank = bank.value; valueChange(); });
      info.addEventListener('input', () => { node.info = info.value; valueChange(); });

      detail.append(farbe, bank, info, el('span'));
      accountHost.appendChild(detail);
    }
  }

  function renderTransfers() {
    clear(transferHost);
    const list = data().transfers;
    if (!list.length) {
      transferHost.appendChild(el('p', { class: 'empty' },
        'Noch keine Umbuchungen. Tipp: „Verbinden“ über dem Diagramm.'));
      return;
    }
    for (const t of list) {
      const row = el('div', { class: 'row' });
      const from = accountSelect(t.from);
      const to = accountSelect(t.to);
      const amount = el('input', {
        type: 'number', min: '0', step: '10', value: t.amount || '',
        'data-transfer-amount': t.id,
      });
      const del = el('button', { class: 'icon-btn', type: 'button', title: 'Umbuchung löschen' }, '×');

      from.addEventListener('change', () => { t.from = from.value; valueChange(); });
      to.addEventListener('change', () => { t.to = to.value; valueChange(); });
      amount.addEventListener('input', () => { t.amount = Math.max(0, Number(amount.value) || 0); valueChange(); });
      del.addEventListener('click', () => {
        data().transfers = data().transfers.filter(x => x.id !== t.id);
        structuralChange();
      });

      row.append(from, to, amount, del);
      transferHost.appendChild(row);

      const detail = el('div', { class: 'row', style: 'grid-template-columns: 1fr 120px 26px; margin-bottom:2px' });
      const label = el('input', { type: 'text', value: t.label, placeholder: 'Bezeichnung (optional)' });
      const interval = el('select');
      for (const v of ['monatlich', 'jaehrlich', 'einmalig']) {
        const opt = el('option', { value: v }, v === 'jaehrlich' ? 'jährlich' : v);
        if (v === t.interval) opt.selected = true;
        interval.appendChild(opt);
      }
      label.addEventListener('input', () => { t.label = label.value; valueChange(); });
      interval.addEventListener('change', () => { t.interval = interval.value; valueChange(); });
      detail.append(label, interval, el('span'));
      transferHost.appendChild(detail);
    }
  }

  function accountSelect(selected) {
    const sel = el('select');
    for (const n of data().nodes) {
      const opt = el('option', { value: n.id }, n.name);
      if (n.id === selected) opt.selected = true;
      sel.appendChild(opt);
    }
    return sel;
  }

  function renderAll({ focusLastTransfer = false } = {}) {
    renderAccounts();
    renderTransfers();
    if (focusLastTransfer) {
      const last = data().transfers[data().transfers.length - 1];
      if (last) transferHost.querySelector(`[data-transfer-amount="${last.id}"]`)?.focus();
    }
  }

  function addAccount() {
    const n = data().nodes.length;
    const node = {
      id: uid('a'), name: 'Neues Konto', type: 'giro', bank: '', info: '', color: null, balance: 0,
      x: MARGIN + (n % 3) * (W + 118), y: MARGIN + Math.floor(n / 3) * (H_INFO + 64),
    };
    data().nodes.push(node);
    structuralChange();
    const input = accountHost.querySelector(`[data-account-name="${node.id}"]`);
    input?.scrollIntoView({ block: 'nearest' });
    input?.focus();
    input?.select();
  }

  function addTransfer() {
    const nodes = data().nodes;
    if (nodes.length < 2) {
      window.alert('Für eine Umbuchung braucht es mindestens zwei Konten.');
      return;
    }
    data().transfers.push({
      id: uid('t'), from: nodes[0].id, to: nodes[1].id,
      amount: 0, label: '', interval: 'monatlich',
    });
    structuralChange({ focusLastTransfer: true });
  }

  return { renderAll, addAccount, addTransfer };
}
