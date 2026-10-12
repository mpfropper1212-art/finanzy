// Kontomodell: Konten als verschiebbare Knoten, Umbuchungen als Pfeile.

import { uid } from './store.js';
import { money, moneyShort, svg, el, clear, fitText } from './util.js';

const W = 176;
const H = 68;
const MARGIN = 28;

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

function anchorPoint(node, towardsCx, towardsCy) {
  const cx = node.x + W / 2, cy = node.y + H / 2;
  const dx = towardsCx - cx, dy = towardsCy - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const tx = dx ? (W / 2) / Math.abs(dx) : Infinity;
  const ty = dy ? (H / 2) / Math.abs(dy) : Infinity;
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
    const g = ev.target.closest('[data-account]');
    if (!g) return;
    const node = data().nodes.find(n => n.id === g.dataset.account);
    if (!node) return;

    if (connectMode) {
      handleConnectClick(node);
      return;
    }
    const p = canvasPoint(ev);
    drag = { id: node.id, dx: p.x - node.x, dy: p.y - node.y, moved: false };
    root.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }

  function onPointerMove(ev) {
    if (!drag) return;
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
      n.x = MARGIN + (i % cols) * (W + 110);
      n.y = MARGIN + Math.floor(i / cols) * (H + 76);
    });
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
    const height = Math.max(420, ...nodes.map(n => n.y + H + MARGIN));
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

    for (const list of groups.values()) {
      list.forEach((t, i) => {
        const a = byId.get(t.from), b = byId.get(t.to);
        const acx = a.x + W / 2, acy = a.y + H / 2;
        const bcx = b.x + W / 2, bcy = b.y + H / 2;
        const offset = (i - (list.length - 1) / 2) * 38;

        const mx = (acx + bcx) / 2, my = (acy + bcy) / 2;
        const len = Math.hypot(bcx - acx, bcy - acy) || 1;
        const px = -(bcy - acy) / len, py = (bcx - acx) / len;
        const ctrl = { x: mx + px * offset, y: my + py * offset };

        const p0 = anchorPoint(a, ctrl.x, ctrl.y);
        const p1 = anchorPoint(b, ctrl.x, ctrl.y);

        const path = svg('path', {
          d: `M${p0.x},${p0.y} Q${ctrl.x},${ctrl.y} ${p1.x},${p1.y}`,
          fill: 'none',
          stroke: 'currentColor',
          'stroke-opacity': 0.42,
          'stroke-width': 1.8,
          'marker-end': 'url(#acct-arrow)',
        });
        path.appendChild(svg('title', {}, transferTitle(t, a, b)));
        layerLinks.appendChild(path);

        const lx = (p0.x + 2 * ctrl.x + p1.x) / 4;
        const ly = (p0.y + 2 * ctrl.y + p1.y) / 4;
        const text = t.label
          ? `${moneyShort(t.amount)} · ${t.label}`
          : `${moneyShort(t.amount)}${t.interval === 'jaehrlich' ? ' / Jahr' : ''}`;
        const wBox = text.length * 6.2 + 12;

        layerLinks.appendChild(svg('rect', {
          x: lx - wBox / 2, y: ly - 10, width: wBox, height: 20, rx: 6,
          fill: 'var(--surface)', stroke: 'var(--border)',
        }));
        layerLinks.appendChild(svg('text', {
          x: lx, y: ly + 4, 'text-anchor': 'middle',
          'font-size': 11.5, fill: 'currentColor', opacity: 0.8,
        }, text));
      });
    }

    for (const n of nodes) {
      const meta = ACCOUNT_TYPES[n.type] ?? ACCOUNT_TYPES.giro;
      const g = svg('g', {
        class: 'acct-node' + (connectFrom === n.id ? ' is-selected' : ''),
        transform: `translate(${n.x},${n.y})`,
      });
      g.setAttribute('data-account', n.id);

      g.appendChild(svg('rect', {
        x: 0, y: 0, width: W, height: H, rx: 11,
        fill: 'var(--surface)',
        stroke: connectFrom === n.id ? meta.color : 'var(--border-strong)',
        'stroke-width': connectFrom === n.id ? 2.5 : 1.2,
      }));
      g.appendChild(svg('rect', { x: 0, y: 0, width: 5, height: H, rx: 2.5, fill: meta.color }));
      g.appendChild(svg('text', {
        x: 16, y: 25, 'font-size': 13.5, 'font-weight': 600, fill: 'currentColor',
      }, fitText(n.name, W - 28, 7)));
      g.appendChild(svg('text', {
        x: 16, y: 44, 'font-size': 14, fill: 'currentColor',
        'font-variant-numeric': 'tabular-nums',
      }, money(n.balance)));
      g.appendChild(svg('text', {
        x: 16, y: 59, 'font-size': 10.5, fill: 'currentColor', opacity: 0.5,
        'letter-spacing': '.04em',
      }, meta.label.toUpperCase()));

      g.appendChild(svg('title', {}, `${n.name} · ${meta.label} · ${money(n.balance)}`));
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

  return { draw, toggleConnectMode, setConnectMode, tidy, renderNotes, isConnecting: () => connectMode };
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
      const name = el('input', { type: 'text', value: node.name, placeholder: 'Kontoname' });
      const type = el('select');
      for (const [key, meta] of Object.entries(ACCOUNT_TYPES)) {
        const opt = el('option', { value: key }, meta.label);
        if (key === node.type) opt.selected = true;
        type.appendChild(opt);
      }
      const balance = el('input', { type: 'number', step: '10', value: node.balance });
      const del = el('button', { class: 'icon-btn', type: 'button', title: 'Konto löschen' }, '×');

      name.addEventListener('input', () => { node.name = name.value; valueChange(); });
      type.addEventListener('change', () => { node.type = type.value; valueChange(); });
      balance.addEventListener('input', () => { node.balance = Number(balance.value) || 0; valueChange(); });
      del.addEventListener('click', () => {
        data().nodes = data().nodes.filter(n => n.id !== node.id);
        data().transfers = data().transfers.filter(t => t.from !== node.id && t.to !== node.id);
        structuralChange();
      });

      row.append(name, type, balance, del);
      accountHost.appendChild(row);
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
    data().nodes.push({
      id: uid('a'), name: 'Neues Konto', type: 'giro', balance: 0,
      x: MARGIN + (n % 3) * (W + 110), y: MARGIN + Math.floor(n / 3) * (H + 76),
    });
    structuralChange();
    accountHost.querySelector('.row-account:nth-of-type(2) input')?.focus();
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
