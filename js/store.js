// Zustand der App: halten, verteilen, verschlüsselt zurückschreiben.

import * as cloud from './cloud.js';

export const DATA_VERSION = 2;
const SAVE_DEBOUNCE_MS = 400;

// Der Knoten, in den alle Einnahmen laufen und aus dem alle Ausgaben kommen.
// Der Editor ist um ihn herum gebaut, deshalb hat er eine feste id.
export const HUB_ID = 'einnahmen';

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
        n('gehalt', 'Gehalt'), n('nebenjob', 'Nebeneinkünfte'), n(HUB_ID, 'Einnahmen'),
        n('wohnen', 'Wohnen'), n('miete', 'Miete'), n('strom', 'Strom'),
        n('internet', 'Internet'), n('nebenkosten', 'Nebenkosten'),
        n('lebensmittel', 'Lebensmittel'), n('mobilitaet', 'Mobilität'),
        n('oepnv', 'ÖPNV'), n('auto', 'Auto'),
        n('freizeit', 'Freizeit'), n('versicherung', 'Versicherungen'),
        n('sparen', 'Sparen'), n('notgroschen', 'Notgroschen'), n('etf', 'ETF-Depot'),
      ],
      flows: [
        f('gehalt', HUB_ID, 2300), f('nebenjob', HUB_ID, 300),
        f(HUB_ID, 'wohnen', 950), f(HUB_ID, 'lebensmittel', 420), f(HUB_ID, 'mobilitaet', 220),
        f(HUB_ID, 'freizeit', 260), f(HUB_ID, 'versicherung', 110), f(HUB_ID, 'sparen', 640),
        f('wohnen', 'miete', 780), f('wohnen', 'strom', 70),
        f('wohnen', 'internet', 40), f('wohnen', 'nebenkosten', 60),
        f('mobilitaet', 'oepnv', 60), f('mobilitaet', 'auto', 160),
        f('sparen', 'notgroschen', 150), f('sparen', 'etf', 490),
      ],
    },
    accounts: {
      edgeStyle: 'kurve',
      nodes: [
        { id: 'giro', name: 'Girokonto', type: 'giro', bank: 'DKB', info: 'Gehalt & Lastschriften', balance: 2400, x: 60, y: 60 },
        { id: 'tagesgeld', name: 'Tagesgeld', type: 'tagesgeld', bank: 'ING', info: 'Notgroschen, 3 Monatsausgaben', balance: 8500, x: 470, y: 30 },
        { id: 'depot', name: 'ETF-Depot', type: 'depot', bank: 'Trade Republic', info: 'MSCI World, Sparplan am 1.', balance: 12400, x: 470, y: 170 },
        { id: 'kreditkarte', name: 'Kreditkarte', type: 'kredit', bank: 'DKB', info: '', balance: -320, x: 470, y: 310 },
        { id: 'bargeld', name: 'Bargeld', type: 'bar', bank: '', info: '', balance: 150, x: 60, y: 310 },
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

  const a = raw.accounts && typeof raw.accounts === 'object' ? raw.accounts : {};

  // Vor Version 2 lief der Geldfluss über Brutto/Netto statt über einen
  // Einnahmen-Knoten. Der Editor setzt diese Form voraus, also wird der
  // Geldfluss-Teil auf die Startvorlage gesetzt; die Konten bleiben erhalten.
  const s = Number(raw.version) === DATA_VERSION && raw.sankey && typeof raw.sankey === 'object'
    ? raw.sankey
    : base.sankey;

  const nodes = Array.isArray(s.nodes) ? s.nodes.filter(x => x && x.id).map(x => ({
    id: String(x.id),
    name: String(x.name ?? x.id),
    color: typeof x.color === 'string' ? x.color : null,
  })) : [];
  if (!nodes.some(x => x.id === HUB_ID)) nodes.push({ id: HUB_ID, name: 'Einnahmen', color: null });

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
    bank: String(x.bank ?? ''),
    info: String(x.info ?? ''),
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
    accounts: {
      edgeStyle: a.edgeStyle === 'knick' ? 'knick' : 'kurve',
      nodes: accNodes,
      transfers,
    },
  };
}

export class Store {
  constructor() {
    this.data = null;
    this._listeners = new Set();
    this._statusCb = () => {};
    this._timer = null;
    this._pending = false;
  }

  attach(data) {
    this.data = data;
  }

  detach() {
    this.flushNow();
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
    if (!this._pending || !this.data) return;

    // Erst lokal sichern, dann hochladen: schlägt der Upload fehl, ist der
    // Stand trotzdem nicht verloren.
    cloud.writeBackup(this.data);
    this._pending = false;
    try {
      await cloud.saveData(this.data);
      cloud.clearBackup();
      this._statusCb('saved');
    } catch (err) {
      this._pending = true;
      this._statusCb('error', err);
    }
  }
}
