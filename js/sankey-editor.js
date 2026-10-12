// Editor für die Flüsse: Von/Nach als freie Namen, Beträge, Farben.

import { uid } from './store.js';
import { el, clear, isValidHex } from './util.js';

const UMLAUTS = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

function slug(name) {
  const base = name.toLowerCase().replace(/[äöüß]/g, c => UMLAUTS[c])
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return base || 'posten';
}

function uniqueId(data, base) {
  const taken = new Set(data.sankey.nodes.map(n => n.id));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function nodeName(data, id) {
  return data.sankey.nodes.find(n => n.id === id)?.name ?? '';
}

// Leerer Name -> keine Zuordnung; unbekannter Name -> neuer Posten.
function resolveNode(data, rawName) {
  const name = String(rawName || '').trim();
  if (!name) return '';
  const hit = data.sankey.nodes.find(n => n.name.toLowerCase() === name.toLowerCase());
  if (hit) return hit.id;
  const node = { id: uniqueId(data, slug(name)), name, color: null };
  data.sankey.nodes.push(node);
  return node.id;
}

// Posten, die in keinem Fluss mehr vorkommen, verschwinden.
function pruneNodes(data) {
  const referenced = new Set();
  for (const f of data.sankey.flows) {
    if (f.from) referenced.add(f.from);
    if (f.to) referenced.add(f.to);
  }
  data.sankey.nodes = data.sankey.nodes.filter(n => referenced.has(n.id));
}

export function createFlowEditor({ rowHost, colorHost, listHost, store, requestChart }) {
  const data = () => store.data;

  // Ein geänderter Name kann Posten anlegen oder überflüssig machen. Die Zeilen
  // selbst dürfen dabei nicht neu gebaut werden, sonst verliert das Feld, in dem
  // gerade getippt wird, den Fokus.
  function nameChange() {
    pruneNodes(data());
    store.commit({ silent: true });
    renderNameList();
    renderColors();
    requestChart();
  }

  function rowsChanged() {
    pruneNodes(data());
    store.commit({ silent: true });
    renderAll();
    requestChart();
  }

  function valueChange() {
    store.commit({ silent: true });
    requestChart();
  }

  function renderNameList() {
    clear(listHost);
    for (const n of data().sankey.nodes) {
      listHost.appendChild(el('option', { value: n.name }));
    }
  }

  function renderRows() {
    clear(rowHost);
    const flows = data().sankey.flows;
    if (!flows.length) {
      rowHost.appendChild(el('p', { class: 'empty' }, 'Noch keine Flüsse.'));
      return;
    }

    const head = el('div', { class: 'row' });
    head.append(
      el('span', { class: 'stat-label' }, 'Von'),
      el('span', { class: 'stat-label' }, 'Nach'),
      el('span', { class: 'stat-label' }, 'Betrag'),
      el('span'),
    );
    rowHost.appendChild(head);

    for (const flow of flows) {
      const row = el('div', { class: 'row' });

      const from = el('input', {
        type: 'text', list: 'node-names', placeholder: 'Quelle',
        value: nodeName(data(), flow.from), spellcheck: 'false',
        'data-flow-from': flow.id,
      });
      const to = el('input', {
        type: 'text', list: 'node-names', placeholder: 'Ziel',
        value: nodeName(data(), flow.to), spellcheck: 'false',
      });
      const amount = el('input', {
        type: 'number', min: '0', step: '10', placeholder: '0',
        value: flow.amount || '',
      });
      const del = el('button', { class: 'icon-btn', type: 'button', title: 'Fluss löschen' }, '×');

      from.addEventListener('change', () => {
        flow.from = resolveNode(data(), from.value);
        from.value = nodeName(data(), flow.from);
        nameChange();
      });
      to.addEventListener('change', () => {
        flow.to = resolveNode(data(), to.value);
        to.value = nodeName(data(), flow.to);
        nameChange();
      });
      amount.addEventListener('input', () => {
        const v = Number(amount.value);
        amount.classList.toggle('is-invalid', amount.value !== '' && !(v >= 0));
        flow.amount = v >= 0 ? v : 0;
        valueChange();
      });
      del.addEventListener('click', () => {
        data().sankey.flows = data().sankey.flows.filter(f => f.id !== flow.id);
        rowsChanged();
      });

      row.append(from, to, amount, del);
      rowHost.appendChild(row);
    }
  }

  function renderColors() {
    clear(colorHost);
    const nodes = data().sankey.nodes;
    if (!nodes.length) {
      colorHost.appendChild(el('p', { class: 'empty' }, 'Farben erscheinen, sobald es Posten gibt.'));
      return;
    }
    for (const node of nodes) {
      const row = el('div', { class: 'row-color' });
      const picker = el('input', {
        type: 'color',
        value: isValidHex(node.color) ? node.color : currentColor(node.id),
        title: `Farbe für ${node.name}`,
      });
      const name = el('span', { class: 'name' }, node.name);
      const reset = el('button', { class: 'link-btn reset', type: 'button' }, 'auto');

      picker.addEventListener('input', () => {
        node.color = picker.value;
        valueChange();
      });
      reset.addEventListener('click', () => {
        node.color = null;
        store.commit({ silent: true });
        requestChart();
        picker.value = currentColor(node.id);
      });

      row.append(picker, name, isValidHex(node.color) ? reset : el('span'));
      colorHost.appendChild(row);
    }
  }

  // Die automatisch vergebene Farbe kommt aus dem letzten Layout.
  function currentColor(id) {
    return store.lastLayout?.nodes.find(n => n.id === id)?.color ?? '#2f6feb';
  }

  function renderAll() {
    renderNameList();
    renderRows();
    renderColors();
  }

  function addFlow() {
    const flow = { id: uid('f'), from: '', to: '', amount: 0, note: '' };
    data().sankey.flows.push(flow);
    store.commit({ silent: true });
    renderAll();
    requestChart();
    const input = rowHost.querySelector(`[data-flow-from="${flow.id}"]`);
    input?.scrollIntoView({ block: 'nearest' });
    input?.focus();
  }

  return { renderAll, addFlow };
}
