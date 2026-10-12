// Zustand der App: halten, verteilen, verschlüsselt zurückschreiben.

import * as vault from './vault.js';

export const DATA_VERSION = 1;
const SAVE_DEBOUNCE_MS = 400;

export function uid(prefix) {
  return prefix + Math.random().toString(36).slice(2, 9);
}

export function createDefaultData() {
  const n = (id, name) => ({ id, name, color: null });
  const f = (from, to, amount) => ({ id: uid('f'), from, to, amount, note: '' });

  return {
    version: DATA_VERSION,
    sankey: {
      title: 'Monatsübersicht',
      currency: 'EUR',
      height: 620,
      nodes: [
        n('gehalt', 'Gehalt'), n('nebenjob', 'Nebeneinkünfte'), n('brutto', 'Brutto'),
        n('lohnsteuer', 'Lohnsteuer'), n('sozial', 'Sozialabgaben'), n('netto', 'Netto'),
        n('wohnen', 'Wohnen'), n('miete', 'Miete'), n('strom', 'Strom'),
        n('internet', 'Internet'), n('nebenkosten', 'Nebenkosten'),
        n('lebensmittel', 'Lebensmittel'), n('mobilitaet', 'Mobilität'),
        n('oepnv', 'ÖPNV'), n('auto', 'Auto'),
        n('freizeit', 'Freizeit'), n('versicherung', 'Versicherungen'),
        n('sparen', 'Sparen'), n('notgroschen', 'Notgroschen'), n('etf', 'ETF-Depot'),
      ],
      flows: [
        f('gehalt', 'brutto', 3200), f('nebenjob', 'brutto', 300),
        f('brutto', 'lohnsteuer', 520), f('brutto', 'sozial', 680), f('brutto', 'netto', 2300),
        f('netto', 'wohnen', 950), f('netto', 'lebensmittel', 420), f('netto', 'mobilitaet', 220),
        f('netto', 'freizeit', 260), f('netto', 'versicherung', 110), f('netto', 'sparen', 340),
        f('wohnen', 'miete', 780), f('wohnen', 'strom', 70),
        f('wohnen', 'internet', 40), f('wohnen', 'nebenkosten', 60),
        f('mobilitaet', 'oepnv', 60), f('mobilitaet', 'auto', 160),
        f('sparen', 'notgroschen', 100), f('sparen', 'etf', 240),
      ],
    },
    accounts: {
      nodes: [
        { id: 'giro', name: 'Girokonto', type: 'giro', balance: 2400, x: 60, y: 60 },
        { id: 'tagesgeld', name: 'Tagesgeld', type: 'tagesgeld', balance: 8500, x: 400, y: 30 },
        { id: 'depot', name: 'ETF-Depot', type: 'depot', balance: 12400, x: 400, y: 150 },
        { id: 'kreditkarte', name: 'Kreditkarte', type: 'kredit', balance: -320, x: 400, y: 270 },
        { id: 'bargeld', name: 'Bargeld', type: 'bar', balance: 150, x: 60, y: 270 },
      ],
      transfers: [
        { id: uid('t'), from: 'giro', to: 'tagesgeld', amount: 100, label: 'Notgroschen', interval: 'monatlich' },
        { id: uid('t'), from: 'giro', to: 'depot', amount: 240, label: 'ETF-Sparplan', interval: 'monatlich' },
        { id: uid('t'), from: 'giro', to: 'kreditkarte', amount: 320, label: 'Ausgleich', interval: 'monatlich' },
      ],
    },
  };
}

// Fehlende Felder auffüllen, damit eine ältere oder handgeschriebene Datei nicht
// irgendwo tief im Rendering auf undefined läuft.
export function migrate(raw) {
  const base = createDefaultData();
  if (!raw || typeof raw !== 'object') return base;

  const s = raw.sankey && typeof raw.sankey === 'object' ? raw.sankey : {};
  const a = raw.accounts && typeof raw.accounts === 'object' ? raw.accounts : {};

  const nodes = Array.isArray(s.nodes) ? s.nodes.filter(x => x && x.id).map(x => ({
    id: String(x.id),
    name: String(x.name ?? x.id),
    color: typeof x.color === 'string' ? x.color : null,
  })) : [];

  const known = new Set(nodes.map(x => x.id));
  const flows = Array.isArray(s.flows) ? s.flows.filter(x => x && known.has(x.from) && known.has(x.to)).map(x => ({
    id: x.id || uid('f'),
    from: x.from,
    to: x.to,
    amount: Number(x.amount) || 0,
    note: String(x.note ?? ''),
  })) : [];

  const accNodes = Array.isArray(a.nodes) ? a.nodes.filter(x => x && x.id).map((x, i) => ({
    id: String(x.id),
    name: String(x.name ?? x.id),
    type: ['giro', 'tagesgeld', 'depot', 'bar', 'kredit'].includes(x.type) ? x.type : 'giro',
    balance: Number(x.balance) || 0,
    x: Number.isFinite(Number(x.x)) ? Number(x.x) : 60 + (i % 3) * 320,
    y: Number.isFinite(Number(x.y)) ? Number(x.y) : 60 + Math.floor(i / 3) * 140,
  })) : [];

  const accKnown = new Set(accNodes.map(x => x.id));
  const transfers = Array.isArray(a.transfers) ? a.transfers.filter(x => x && accKnown.has(x.from) && accKnown.has(x.to)).map(x => ({
    id: x.id || uid('t'),
    from: x.from,
    to: x.to,
    amount: Number(x.amount) || 0,
    label: String(x.label ?? ''),
    interval: ['monatlich', 'jaehrlich', 'einmalig'].includes(x.interval) ? x.interval : 'monatlich',
  })) : [];

  return {
    version: DATA_VERSION,
    sankey: {
      title: String(s.title ?? base.sankey.title),
      currency: String(s.currency ?? 'EUR'),
      height: Math.min(1400, Math.max(420, Number(s.height) || base.sankey.height)),
      nodes,
      flows,
    },
    accounts: { nodes: accNodes, transfers },
  };
}

export class Store {
  constructor() {
    this.data = null;
    this.session = null;
    this._listeners = new Set();
    this._statusCb = () => {};
    this._timer = null;
    this._pending = false;
  }

  attach(session, data) {
    this.session = session;
    this.data = data;
  }

  detach() {
    this.flushNow();
    this.session = null;
    this.data = null;
    this._listeners.clear();
  }

  onStatus(cb) { this._statusCb = cb; }

  subscribe(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  // Nach jeder Änderung aufrufen: Views neu zeichnen und gebündelt speichern.
  commit({ silent = false } = {}) {
    if (!silent) for (const cb of this._listeners) cb(this.data);
    this._pending = true;
    this._statusCb('dirty');
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flushNow(), SAVE_DEBOUNCE_MS);
  }

  async flushNow() {
    clearTimeout(this._timer);
    this._timer = null;
    if (!this._pending || !this.session) return;
    this._pending = false;
    try {
      await vault.save(this.session, this.data);
      this._statusCb('saved');
    } catch (err) {
      this._pending = true;
      this._statusCb('error', err);
    }
  }
}
