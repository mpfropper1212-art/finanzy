// Zustand der App: halten, verteilen, verschlüsselt zurückschreiben.

import * as cloud from './cloud.js';
import { createImmobilie, BUNDESLAENDER } from './immobilien.js';
import { uid } from './util.js';
import { SEED_GERAETE, SEED_UEBUNGEN, MUSKELGRUPPEN } from './gym-daten.js';

export const DATA_VERSION = 2;
const SAVE_DEBOUNCE_MS = 400;

// Der Knoten, in den alle Einnahmen laufen und aus dem alle Ausgaben kommen.
// Der Editor ist um ihn herum gebaut, deshalb hat er eine feste id.
export const HUB_ID = 'einnahmen';

export function createDefaultData() {
  const n = (id, name) => ({ id, name, color: null });
  const f = (from, to, amount) => ({ id: uid('f'), from, to, amount, note: '' });

  return {
    version: DATA_VERSION,
    sankey: {
      title: 'Monatsübersicht',
      currency: 'EUR',
      height: 620,
      anzeige: 'euro',
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
        { id: 'giro', name: 'Girokonto', type: 'giro', bank: 'DKB', info: 'Gehalt & Lastschriften', color: null, balance: 2400, x: 60, y: 60 },
        { id: 'tagesgeld', name: 'Tagesgeld', type: 'tagesgeld', bank: 'ING', info: 'Notgroschen, 3 Monatsausgaben', color: null, balance: 8500, x: 470, y: 30 },
        { id: 'depot', name: 'ETF-Depot', type: 'depot', bank: 'Trade Republic', info: 'MSCI World, Sparplan am 1.', color: null, balance: 12400, x: 470, y: 170 },
        { id: 'kreditkarte', name: 'Kreditkarte', type: 'kredit', bank: 'DKB', info: '', color: null, balance: -320, x: 470, y: 310 },
        { id: 'bargeld', name: 'Bargeld', type: 'bar', bank: '', info: '', color: null, balance: 150, x: 60, y: 310 },
      ],
      transfers: [
        { id: uid('t'), from: 'giro', to: 'tagesgeld', amount: 100, label: 'Notgroschen', interval: 'monatlich' },
        { id: uid('t'), from: 'giro', to: 'depot', amount: 240, label: 'ETF-Sparplan', interval: 'monatlich' },
        { id: uid('t'), from: 'giro', to: 'kreditkarte', amount: 320, label: 'Ausgleich', interval: 'monatlich' },
      ],
    },
    immobilien: createImmobilienTeil(),
    gerichte: { favoriten: [] },
    schulden: { eintraege: [] },
    gruppen: { items: [], activeId: null },
    wochenplan: { start: montagVon(new Date()), eintraege: [], abgehakt: [] },
    gym: {
      geraete: SEED_GERAETE.map(g => ({ ...g })),
      uebungen: SEED_UEBUNGEN.map(u => ({ ...u })),
      workouts: [],
      aktivId: null,
    },
    strom: { staende: [], tarif: { arbeitspreis: 0.35, grundpreis: 12, abschlag: 0 } },
    tanken: { eintraege: [], zeitraum: 'alle', eigen: { monate: 1, von: '', bis: '' }, ausgeschlosseneTags: [], fixkosten: { versicherung: 0, steuer: 0, wartung: 0, sonstiges: 0 } },
  };
}

// Wochen beginnen montags; der Plan hängt am Montagsdatum.
export function montagVon(datum) {
  const d = new Date(datum);
  const tag = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - tag);
  return d.toISOString().slice(0, 10);
}

function createImmobilienTeil() {
  const erste = createImmobilie('Beispielwohnung');
  return { items: [erste], activeId: erste.id };
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
    color: typeof x.color === 'string' ? x.color : null,
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
    labelDx: Number(x.labelDx) || 0,
    labelDy: Number(x.labelDy) || 0,
  })) : [];

  return {
    version: DATA_VERSION,
    sankey: {
      title: String(s.title ?? base.sankey.title),
      currency: String(s.currency ?? 'EUR'),
      height: Math.min(1400, Math.max(420, Number(s.height) || base.sankey.height)),
      anzeige: ['euro', 'prozent', 'beide'].includes(s.anzeige) ? s.anzeige : 'euro',
      nodes,
      flows,
    },
    accounts: {
      edgeStyle: a.edgeStyle === 'knick' ? 'knick' : 'kurve',
      nodes: accNodes,
      transfers,
    },
    immobilien: migrateImmobilien(raw.immobilien),
    gerichte: {
      favoriten: Array.isArray(raw.gerichte?.favoriten)
        ? raw.gerichte.favoriten.filter(x => typeof x === 'string')
        : [],
    },
    schulden: { eintraege: migrateSchulden(raw.schulden?.eintraege) },
    gruppen: migrateGruppen(raw.gruppen),
    wochenplan: {
      start: typeof raw.wochenplan?.start === 'string' ? raw.wochenplan.start : montagVon(new Date()),
      eintraege: Array.isArray(raw.wochenplan?.eintraege)
        ? raw.wochenplan.eintraege.filter(x => x && x.id).map(x => ({
          id: String(x.id),
          tag: Math.min(6, Math.max(0, Number(x.tag) || 0)),
          mahlzeit: x.mahlzeit === 'abend' ? 'abend' : 'mittag',
          gerichtId: String(x.gerichtId ?? ''),
          portionen: Math.max(1, Number(x.portionen) || 1),
        }))
        : [],
      abgehakt: Array.isArray(raw.wochenplan?.abgehakt)
        ? raw.wochenplan.abgehakt.filter(x => typeof x === 'string')
        : [],
    },
    gym: migrateGym(raw.gym),
    strom: migrateStrom(raw.strom),
    tanken: {
      eintraege: migrateTankungen(raw.tanken?.eintraege),
      zeitraum: ['alle', '12monate', '3monate', 'eigen'].includes(raw.tanken?.zeitraum) ? raw.tanken.zeitraum : 'alle',
      eigen: {
        monate: Math.max(1, Number(raw.tanken?.eigen?.monate) || 1),
        von: typeof raw.tanken?.eigen?.von === 'string' ? raw.tanken.eigen.von : '',
        bis: typeof raw.tanken?.eigen?.bis === 'string' ? raw.tanken.eigen.bis : '',
      },
      ausgeschlosseneTags: Array.isArray(raw.tanken?.ausgeschlosseneTags)
        ? raw.tanken.ausgeschlosseneTags.filter(x => typeof x === 'string')
        : [],
      fixkosten: {
        versicherung: Number(raw.tanken?.fixkosten?.versicherung) || 0,
        steuer: Number(raw.tanken?.fixkosten?.steuer) || 0,
        wartung: Number(raw.tanken?.fixkosten?.wartung) || 0,
        sonstiges: Number(raw.tanken?.fixkosten?.sonstiges) || 0,
      },
    },
  };
}

// Der Trainingsteil. Wer die Startliste leer räumt, soll sie nicht beim
// nächsten Laden zurückbekommen - deshalb zählt nur, ob der Schlüssel fehlt.
function migrateGym(roh) {
  if (!roh || typeof roh !== 'object') {
    return {
      geraete: SEED_GERAETE.map(g => ({ ...g })),
      uebungen: SEED_UEBUNGEN.map(u => ({ ...u })),
      workouts: [],
      aktivId: null,
    };
  }

  const geraete = Array.isArray(roh.geraete)
    ? roh.geraete.filter(x => x && x.id).map(x => ({ id: String(x.id), name: String(x.name ?? '') }))
    : [];
  const geraetIds = new Set(geraete.map(g => g.id));

  const uebungen = Array.isArray(roh.uebungen)
    ? roh.uebungen.filter(x => x && x.id).map(x => ({
      id: String(x.id),
      name: String(x.name ?? 'Übung'),
      geraetId: geraetIds.has(x.geraetId) ? x.geraetId : null,
      muskel: MUSKELGRUPPEN.includes(x.muskel) ? x.muskel : null,
      zielWdh: Math.min(50, Math.max(1, Number(x.zielWdh) || 10)),
      steigerung: Math.min(20, Math.max(0, Number(x.steigerung) || 0)),
    }))
    : [];
  const uebungIds = new Set(uebungen.map(u => u.id));

  const workouts = Array.isArray(roh.workouts)
    ? roh.workouts.filter(x => x && x.id && typeof x.datum === 'string').map(x => ({
      id: String(x.id),
      datum: x.datum,
      notiz: String(x.notiz ?? ''),
      // Sätze zu längst gelöschten Übungen wären im Verlauf nicht mehr
      // zuzuordnen und fallen deshalb raus.
      saetze: Array.isArray(x.saetze)
        ? x.saetze.filter(s => s && uebungIds.has(s.uebungId)).map(s => ({
          id: s.id || uid('s'),
          uebungId: s.uebungId,
          wdh: Number(s.wdh) || 0,
          gewicht: Number(s.gewicht) || 0,
        }))
        : [],
    }))
    : [];

  return {
    geraete,
    uebungen,
    workouts,
    aktivId: workouts.some(w => w.id === roh.aktivId) ? roh.aktivId : null,
  };
}

// Zählerstände: alles, was kein brauchbares Datum hat, ist nicht zu retten.
function migrateStrom(roh) {
  const t = roh?.tarif ?? {};
  return {
    staende: Array.isArray(roh?.staende)
      ? roh.staende
        .filter(x => x && typeof x.datum === 'string' && x.datum)
        .map(x => ({
          id: x.id || uid('st'),
          datum: x.datum,
          zaehler: Number(x.zaehler) || 0,
          notiz: String(x.notiz ?? ''),
        }))
      : [],
    tarif: {
      arbeitspreis: Number(t.arbeitspreis) >= 0 ? Number(t.arbeitspreis) || 0.35 : 0.35,
      grundpreis: Number(t.grundpreis) || 0,
      abschlag: Number(t.abschlag) || 0,
    },
  };
}

function migrateGruppen(roh) {
  const items = Array.isArray(roh?.items) ? roh.items.filter(x => x && x.id).map(x => {
    const personen = Array.isArray(x.personen)
      ? x.personen.filter(p => p && p.id).map(p => ({ id: String(p.id), name: String(p.name ?? '') }))
      : [];
    const bekannt = new Set(personen.map(p => p.id));
    return {
      id: String(x.id),
      name: String(x.name ?? 'Gruppe'),
      ichId: bekannt.has(x.ichId) ? x.ichId : (personen[0]?.id ?? null),
      personen,
      ausgaben: Array.isArray(x.ausgaben) ? x.ausgaben.filter(a => a && a.id).map(a => ({
        id: String(a.id),
        titel: String(a.titel ?? ''),
        betrag: Number(a.betrag) || 0,
        zahlerId: bekannt.has(a.zahlerId) ? a.zahlerId : (personen[0]?.id ?? ''),
        beteiligte: Array.isArray(a.beteiligte) ? a.beteiligte.filter(id => bekannt.has(id)) : [],
        datum: typeof a.datum === 'string' ? a.datum : '',
      })) : [],
    };
  }).filter(g => g.personen.length) : [];

  const activeId = items.some(g => g.id === roh?.activeId) ? roh.activeId : (items[0]?.id ?? null);
  return { items, activeId };
}

function migrateSchulden(roh) {
  if (!Array.isArray(roh)) return [];
  return roh.filter(x => x && x.id).map(x => ({
    id: String(x.id),
    person: String(x.person ?? ''),
    betrag: Number(x.betrag) || 0,
    richtung: x.richtung === 'schulde' ? 'schulde' : 'bekomme',
    grund: String(x.grund ?? ''),
    datum: typeof x.datum === 'string' ? x.datum : '',
    erledigt: x.erledigt === true,
  }));
}

function migrateTankungen(roh) {
  if (!Array.isArray(roh)) return [];
  return roh.filter(x => x && x.id).map(x => ({
    id: String(x.id),
    datum: typeof x.datum === 'string' ? x.datum : '',
    liter: Number(x.liter) || 0,
    euro: Number(x.euro) || 0,
    tacho: Number(x.tacho) || 0,
    notiz: String(x.notiz ?? ''),
    tags: Array.isArray(x.tags) ? x.tags.filter(t => typeof t === 'string' && t.trim()) : [],
  }));
}

function migrateImmobilien(raw) {
  const items = Array.isArray(raw?.items) ? raw.items.filter(x => x && x.id).map(x => {
    const vorlage = createImmobilie();
    const o = { ...vorlage, id: String(x.id), name: String(x.name ?? vorlage.name) };
    for (const key of Object.keys(vorlage)) {
      if (key === 'id' || key === 'name' || x[key] === undefined) continue;
      o[key] = key === 'bundesland'
        ? (BUNDESLAENDER[x[key]] !== undefined ? x[key] : vorlage.bundesland)
        : Number(x[key]) || 0;
    }
    return o;
  }) : [];

  if (!items.length) return createImmobilienTeil();
  const activeId = items.some(x => x.id === raw?.activeId) ? raw.activeId : items[0].id;
  return { items, activeId };
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
