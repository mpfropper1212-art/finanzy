// Editor für den Geldfluss: Einnahmen oben, Ausgaben darunter, Unterposten
// eingerückt. Alles hängt am Einnahmen-Knoten, deshalb braucht es kein Von/Nach.

import { uid, HUB_ID } from './store.js';
import { el, clear, isValidHex, money } from './util.js';

function nodeById(data, id) {
  return data.sankey.nodes.find(n => n.id === id);
}

function ensureHub(data) {
  if (!nodeById(data, HUB_ID)) {
    data.sankey.nodes.push({ id: HUB_ID, name: 'Einnahmen', color: null });
  }
}

const incomeFlows = data => data.sankey.flows.filter(f => f.to === HUB_ID);
const expenseFlows = data => data.sankey.flows.filter(f => f.from === HUB_ID);
const childFlows = (data, id) => data.sankey.flows.filter(f => f.from === id);

// Der Einnahmen-Knoten bleibt immer stehen, auch wenn gerade nichts an ihm hängt.
function pruneNodes(data) {
  const referenced = new Set([HUB_ID]);
  for (const f of data.sankey.flows) {
    if (f.from) referenced.add(f.from);
    if (f.to) referenced.add(f.to);
  }
  data.sankey.nodes = data.sankey.nodes.filter(n => referenced.has(n.id));
}

// Eine Ausgabe mitsamt ihrer Unterposten entfernen.
function removeBranch(data, nodeId) {
  const doomed = new Set([nodeId]);
  for (;;) {
    const before = doomed.size;
    for (const f of data.sankey.flows) {
      if (doomed.has(f.from)) doomed.add(f.to);
    }
    if (doomed.size === before) break;
  }
  data.sankey.flows = data.sankey.flows.filter(f => !doomed.has(f.to));
  pruneNodes(data);
}

export function createFlowEditor({ incomeHost, expenseHost, colorHost, store, requestChart }) {
  const data = () => store.data;

  function valueChange() {
    store.commit({ silent: true });
    refreshTotals();
    requestChart();
  }

  // Summen und Aufteilungs-Hinweise hängen an Beträgen, die im Feld geändert
  // werden - sie werden im Text nachgezogen, statt die Zeilen neu zu bauen.
  function refreshTotals() {
    const sum = flows => flows.reduce((s, f) => s + Number(f.amount), 0);
    incomeHost.querySelector('[data-sum]')?.replaceChildren(`Summe ${money(sum(incomeFlows(data())))}`);
    expenseHost.querySelector('[data-sum]')?.replaceChildren(`Summe ${money(sum(expenseFlows(data())))}`);

    for (const flow of expenseFlows(data())) {
      const hint = expenseHost.querySelector(`[data-hint-for="${flow.to}"]`);
      if (!hint) continue;
      const subs = childFlows(data(), flow.to);
      const diff = Number(flow.amount) - sum(subs);
      const text = !subs.length || Math.abs(diff) <= 0.005 ? ''
        : diff > 0
          ? `${money(diff)} noch nicht aufgeteilt`
          : `${money(-diff)} mehr aufgeteilt als die Kategorie hergibt`;
      hint.textContent = text;
      hint.hidden = !text;
    }
  }

  function structureChange(focusId) {
    pruneNodes(data());
    store.commit({ silent: true });
    renderAll();
    requestChart();
    if (focusId) {
      const input = document.querySelector(`[data-name-for="${focusId}"]`);
      input?.scrollIntoView({ block: 'nearest' });
      input?.focus();
      input?.select();
    }
  }

  // Name und Betrag sind in jeder Zeile gleich aufgebaut - nur die Einrückung
  // und der Platzhalter unterscheiden Einnahme, Ausgabe und Unterposten.
  function entryRow(flow, { placeholder, sub = false }) {
    // Bei Einnahmen zeigt der Fluss auf den Einnahmen-Knoten, sonst von ihm weg.
    const node = nodeById(data(), flow.to === HUB_ID ? flow.from : flow.to);
    const row = el('div', { class: 'row row-entry' + (sub ? ' row-sub' : '') });

    const name = el('input', {
      type: 'text', value: node.name, placeholder,
      'data-name-for': node.id,
    });
    const amount = el('input', {
      type: 'number', min: '0', step: '10', value: flow.amount || '', placeholder: '0',
    });
    const del = el('button', { class: 'icon-btn', type: 'button', title: 'Entfernen' }, '×');

    name.addEventListener('input', () => {
      node.name = name.value;
      syncColorName(node.id, name.value);
      valueChange();
    });
    amount.addEventListener('input', () => {
      amount.classList.toggle('is-invalid', amount.value !== '' && !(Number(amount.value) >= 0));
      flow.amount = Math.max(0, Number(amount.value) || 0);
      valueChange();
    });
    del.addEventListener('click', () => {
      removeBranch(data(), node.id);
      structureChange();
    });

    row.append(name, amount, del);
    return row;
  }

  function syncColorName(id, value) {
    const label = colorHost.querySelector(`[data-color-name="${id}"]`);
    if (label) label.textContent = value;
  }

  function renderIncome() {
    clear(incomeHost);
    const flows = incomeFlows(data());
    if (!flows.length) {
      incomeHost.appendChild(el('p', { class: 'empty' }, 'Noch keine Einnahmen.'));
      return;
    }
    for (const flow of flows) {
      incomeHost.appendChild(entryRow(flow, { placeholder: 'z. B. Gehalt' }));
    }
    incomeHost.appendChild(el('p', { class: 'sum', 'data-sum': '' }));
  }

  function renderExpenses() {
    clear(expenseHost);
    const flows = expenseFlows(data());
    if (!flows.length) {
      expenseHost.appendChild(el('p', { class: 'empty' }, 'Noch keine Ausgaben.'));
      return;
    }

    for (const flow of flows) {
      const group = el('div', { class: 'cat' });
      group.appendChild(entryRow(flow, { placeholder: 'z. B. Wohnen' }));

      const subs = childFlows(data(), flow.to);
      for (const sub of subs) {
        group.appendChild(entryRow(sub, { placeholder: 'z. B. Miete', sub: true }));
      }

      const add = el('button', { class: 'sub-add', type: 'button' }, '+ Unterposten');
      add.addEventListener('click', () => addEntry(flow.to, 'Neuer Unterposten'));
      group.appendChild(add);

      // Unterposten, die zusammen nicht die Kategorie ergeben, fallen sonst erst
      // unten am Diagramm auf. Den Text setzt refreshTotals.
      group.appendChild(el('p', { class: 'cat-hint', 'data-hint-for': flow.to, hidden: true }));
      expenseHost.appendChild(group);
    }

    expenseHost.appendChild(el('p', { class: 'sum', 'data-sum': '' }));
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
      const name = el('span', { class: 'name', 'data-color-name': node.id }, node.name);
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
        reset.remove();
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
    ensureHub(data());
    renderIncome();
    renderExpenses();
    renderColors();
    refreshTotals();
  }

  function addEntry(parentId, name) {
    const node = { id: uid('n'), name, color: null };
    data().sankey.nodes.push(node);
    data().sankey.flows.push({ id: uid('f'), from: parentId, to: node.id, amount: 0, note: '' });
    structureChange(node.id);
  }

  function addIncome() {
    const node = { id: uid('n'), name: 'Neue Einnahme', color: null };
    data().sankey.nodes.push(node);
    data().sankey.flows.push({ id: uid('f'), from: node.id, to: HUB_ID, amount: 0, note: '' });
    structureChange(node.id);
  }

  return {
    renderAll,
    addIncome,
    addExpense: () => addEntry(HUB_ID, 'Neue Ausgabe'),
  };
}
