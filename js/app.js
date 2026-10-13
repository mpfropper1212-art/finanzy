// Bootstrap: Login, Tabs, Datenmenü, Chart-Aktualisierung.

import * as vault from './vault.js';
import * as cloud from './cloud.js';
import { Store, createDefaultData, migrate } from './store.js';
import { computeLayout, renderSankey } from './sankey.js';
import { createFlowEditor } from './sankey-editor.js';
import { createAccountsView, createAccountsEditor, netWorth, monthlyTransferSum } from './accounts.js';
import { createImmobilienView } from './immobilien.js';
import { createGerichteView } from './gerichte.js';
import { createTankenView } from './tanken.js';
import { createDashboard } from './dashboard.js';
import { wortmarke, faviconDataUri } from './logo.js';
import * as dl from './export.js';
import { el, clear, money } from './util.js';

const $ = sel => document.querySelector(sel);

const store = new Store();
let flowEditor = null;
let accountsView = null;
let accountsEditor = null;
let immoView = null;
let gerichteView = null;
let tankenView = null;
let dashboard = null;
let activeTab = 'start';
let mode = 'login';

/* ----------------------------- Login ----------------------------- */

const loginForm = $('#login-form');
const fUser = $('#f-user');
const fPass = $('#f-pass');
const fPass2 = $('#f-pass2');
const loginMsg = $('#login-msg');
const submitBtn = $('#login-submit');

function showMsg(text, kind = 'is-error') {
  loginMsg.textContent = text;
  loginMsg.className = `msg ${kind}`;
  loginMsg.hidden = false;
}

function hideMsg() {
  loginMsg.hidden = true;
}

function setMode(next) {
  mode = next;
  hideMsg();
  for (const btn of document.querySelectorAll('.seg-btn')) {
    btn.classList.toggle('is-active', btn.dataset.mode === next);
  }
  $('#f-pass2-wrap').hidden = next !== 'register';
  fPass2.required = next === 'register';
  fPass.autocomplete = next === 'register' ? 'new-password' : 'current-password';
  submitBtn.textContent = next === 'register' ? 'Konto anlegen' : 'Anmelden';
}

for (const btn of document.querySelectorAll('.seg-btn')) {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
}

async function startSession() {
  let data = await cloud.loadData();

  // Ein liegengebliebener lokaler Stand ist neuer als das, was der Server hat,
  // wenn beim letzten Mal das Hochladen scheiterte.
  const backup = cloud.readBackup();
  if (backup && !data) data = backup;

  if (!data) {
    data = createDefaultData();
    await cloud.saveData(data);
  }
  enterApp(migrate(data));
}

loginForm.addEventListener('submit', async ev => {
  ev.preventDefault();
  hideMsg();

  const email = fUser.value.trim();
  const password = fPass.value;
  if (!email) return showMsg('Bitte eine E-Mail-Adresse eingeben.');
  if (!password) return showMsg('Bitte ein Passwort eingeben.');
  if (mode === 'register') {
    if (password.length < 6) return showMsg('Das Passwort muss mindestens 6 Zeichen haben.');
    if (password !== fPass2.value) return showMsg('Die beiden Passwörter sind nicht gleich.');
  }

  submitBtn.disabled = true;
  const label = submitBtn.textContent;
  submitBtn.textContent = mode === 'register' ? 'Lege an …' : 'Melde an …';

  try {
    if (mode === 'register') await cloud.signUp(email, password);
    else await cloud.signIn(email, password);
    await startSession();
  } catch (err) {
    showMsg(err.message || 'Das hat nicht funktioniert.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = label;
  }
});

$('#btn-forgot').addEventListener('click', async () => {
  const email = fUser.value.trim();
  if (!email) {
    fUser.focus();
    return showMsg('Bitte zuerst deine E-Mail-Adresse eintragen.');
  }
  try {
    await cloud.requestPasswordReset(email);
    showMsg(`Wenn es ein Konto zu ${email} gibt, ist eine E-Mail zum Zurücksetzen unterwegs.`, 'is-info');
  } catch (err) {
    showMsg(err.message);
  }
});

/* ----------------------------- App ----------------------------- */

function enterApp(data) {
  store.attach(data);
  store.onStatus(onSaveStatus);

  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  fPass.value = '';
  fPass2.value = '';
  renderMigrateBar();

  flowEditor = createFlowEditor({
    incomeHost: $('#income-rows'),
    expenseHost: $('#expense-rows'),
    colorHost: $('#color-rows'),
    store,
    requestChart: refreshFlowChart,
  });

  accountsEditor = createAccountsEditor({
    accountHost: $('#account-rows'),
    transferHost: $('#transfer-rows'),
    store,
    requestChart: refreshAccounts,
  });

  accountsView = createAccountsView({
    host: $('#accounts-host'),
    store,
    requestEditor: opts => {
      accountsEditor.renderAll(opts);
      refreshAccounts();
    },
  });

  immoView = createImmobilienView({
    listHost: $('#immo-list'),
    formHost: $('#immo-form'),
    resultHost: $('#immo-result'),
    chartHost: $('#immo-chart'),
    store,
  });

  gerichteView = createGerichteView({
    listHost: $('#gerichte-liste'),
    filterHost: $('#gerichte-filter'),
    formHost: $('#gerichte-form'),
    statusHost: $('#gerichte-status'),
    store,
  });
  gerichteView.ladeGeteilte();

  tankenView = createTankenView({
    kpiHost: $('#tank-kpis'),
    chartHost: $('#tank-chart'),
    tabelleHost: $('#tank-tabelle'),
    formHost: $('#tank-form'),
    fixHost: $('#tank-fix'),
    importHost: $('#tank-import'),
    store,
  });

  dashboard = createDashboard({
    host: $('#panel-start'),
    store,
    onOeffne: setTab,
  });

  $('#sankey-title').value = data.sankey.title;
  $('#sankey-height').value = data.sankey.height;
  markiereAnzeige();

  flowEditor.renderAll();
  accountsEditor.renderAll();
  refreshFlowChart();
  setTab('start');
}

function leaveApp() {
  store.detach();
  cloud.signOut();
  flowEditor = accountsEditor = accountsView = immoView = gerichteView = tankenView = dashboard = null;
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
  $('#accounts-host').replaceChildren();
  $('#sankey-host').replaceChildren();
  setMode('login');
  fUser.focus();
}

function onSaveStatus(state, err) {
  const node = $('#save-state');
  if (state === 'dirty') {
    node.textContent = 'Speichere …';
    node.title = '';
  } else if (state === 'saved') {
    node.textContent = 'Gespeichert';
    node.title = '';
  } else {
    node.textContent = err instanceof cloud.OfflineError ? 'Offline' : 'Nicht gespeichert';
    node.title = err?.message ?? '';
    if (err instanceof cloud.AuthError) {
      window.alert(`${err.message}\n\nDein letzter Stand bleibt in diesem Browser erhalten und wird nach dem Anmelden hochgeladen.`);
      leaveApp();
    }
  }
}

/* ------------- Übernahme aus der lokalen Version ------------- */

function renderMigrateBar() {
  const bar = $('#migrate-bar');
  const profiles = vault.listProfiles();
  if (!profiles.length) {
    bar.hidden = true;
    return;
  }
  const select = $('#migrate-profile');
  clear(select);
  for (const id of profiles) select.appendChild(el('option', { value: id }, id));
  bar.hidden = false;
}

$('#migrate-form').addEventListener('submit', async ev => {
  ev.preventDefault();
  const msg = $('#migrate-msg');
  const userId = $('#migrate-profile').value;
  const password = $('#migrate-pass').value;
  msg.hidden = true;

  try {
    const { data } = await vault.unlock(userId, password);
    if (!window.confirm('Die übernommenen Daten ersetzen den aktuellen Stand in deinem Konto. Fortfahren?')) return;
    store.data = migrate(data);
    store.commit({ silent: true });
    await store.flushNow();
    vault.removeProfile(userId);
    $('#migrate-pass').value = '';
    rebuildAll();
    renderMigrateBar();
  } catch (err) {
    msg.textContent = err instanceof vault.WrongPasswordError
      ? 'Passwort falsch.'
      : err.message || 'Das hat nicht funktioniert.';
    msg.className = 'msg is-error';
    msg.hidden = false;
  }
});

$('#migrate-dismiss').addEventListener('click', () => {
  if (!window.confirm('Die lokalen Daten dieses Browsers werden gelöscht. Fortfahren?')) return;
  for (const id of vault.listProfiles()) vault.removeProfile(id);
  renderMigrateBar();
});

function rebuildAll() {
  $('#sankey-title').value = store.data.sankey.title;
  $('#sankey-height').value = store.data.sankey.height;
  markiereAnzeige();
  flowEditor.renderAll();
  accountsEditor.renderAll();
  immoView.renderAll();
  gerichteView.renderAll();
  tankenView.renderAll();
  dashboard.renderAll();
  refreshFlowChart();
  refreshAccounts();
}

function setTab(tab) {
  activeTab = tab;
  for (const btn of document.querySelectorAll('.tab')) {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
  }
  $('#panel-flow').hidden = tab !== 'flow';
  $('#panel-accounts').hidden = tab !== 'accounts';
  $('#panel-immo').hidden = tab !== 'immo';
  $('#panel-gerichte').hidden = tab !== 'gerichte';
  $('#panel-tanken').hidden = tab !== 'tanken';
  $('#panel-start').hidden = tab !== 'start';
  if (tab === 'flow') refreshFlowChart();
  else if (tab === 'accounts') refreshAccounts();
  else if (tab === 'immo') immoView?.renderAll();
  else if (tab === 'gerichte') gerichteView?.renderAll();
  else if (tab === 'tanken') tankenView?.renderAll();
  else dashboard?.renderAll();
}

/* ------------------------- Geldfluss ------------------------- */

function refreshFlowChart() {
  if (!store.data) return;
  const host = $('#sankey-host');
  const width = Math.max(560, host.clientWidth - 2);
  const layout = computeLayout(store.data.sankey, { width, height: store.data.sankey.height });
  store.lastLayout = layout;
  renderSankey(host, store.data.sankey, layout);
  renderFlowNotes(layout);
}

function renderFlowNotes(layout) {
  const host = $('#sankey-notes');
  clear(host);

  if (layout.error?.kind === 'cycle') {
    host.appendChild(el('p', { class: 'note note-err' },
      `Diese Posten bilden einen Kreislauf: ${layout.error.names.join(', ')}. `
      + 'Ein Sankey kann nur in eine Richtung fließen – einen der Flüsse umdrehen oder löschen.'));
  }
  if (layout.error?.kind === 'too-tall') {
    host.appendChild(el('p', { class: 'note note-err' },
      `Eine Spalte enthält ${layout.error.count} Posten – dafür ist die Diagrammhöhe zu klein. `
      + 'Höhe oben erhöhen oder Posten zusammenfassen.'));
  }

  const shown = layout.warnings.slice(0, 6);
  for (const w of shown) {
    const diff = Math.abs(w.diff);
    const verb = w.diff > 0 ? 'nicht zugeordnet' : 'mehr verteilt als vorhanden';
    host.appendChild(el('p', { class: 'note note-warn' },
      `${w.node}: ${money(w.inSum)} rein, ${money(w.outSum)} raus → ${money(diff)} ${verb}.`));
  }
  if (layout.warnings.length > shown.length) {
    host.appendChild(el('p', { class: 'note note-warn' },
      `… und ${layout.warnings.length - shown.length} weitere Posten stimmen nicht überein.`));
  }
  const ohneBetrag = layout.unused ?? [];
  if (ohneBetrag.length) {
    const namen = ohneBetrag.slice(0, 5).join(', ')
      + (ohneBetrag.length > 5 ? ` und ${ohneBetrag.length - 5} weitere` : '');
    host.appendChild(el('p', { class: 'note note-info' },
      `Noch ohne Betrag und deshalb nicht im Diagramm: ${namen}.`));
  }
}

$('#btn-add-income').addEventListener('click', () => flowEditor?.addIncome());
$('#btn-add-expense').addEventListener('click', () => flowEditor?.addExpense());

$('#sankey-title').addEventListener('input', ev => {
  if (!store.data) return;
  store.data.sankey.title = ev.target.value;
  store.commit({ silent: true });
});

$('#sankey-anzeige').addEventListener('click', ev => {
  const wahl = ev.target.dataset?.anzeige;
  if (!wahl || !store.data) return;
  store.data.sankey.anzeige = wahl;
  store.commit({ silent: true });
  markiereAnzeige();
  refreshFlowChart();
});

function markiereAnzeige() {
  for (const btn of document.querySelectorAll('#sankey-anzeige .seg-btn')) {
    btn.classList.toggle('is-active', btn.dataset.anzeige === store.data?.sankey.anzeige);
  }
}

$('#sankey-height').addEventListener('input', ev => {
  if (!store.data) return;
  store.data.sankey.height = Number(ev.target.value);
  store.commit({ silent: true });
  refreshFlowChart();
});

/* -------------------------- Konten -------------------------- */

function refreshAccounts() {
  if (!store.data || !accountsView) return;
  accountsView.draw();
  accountsView.renderNotes($('#accounts-notes'));
  $('#btn-edge-style').textContent =
    accountsView.edgeStyle() === 'knick' ? 'Pfeile: abgeknickt' : 'Pfeile: gebogen';
  $('#stat-networth').textContent = money(netWorth(store.data.accounts));
  $('#stat-transfers').textContent = money(Math.round(monthlyTransferSum(store.data.accounts) * 100) / 100);
}

$('#btn-add-account').addEventListener('click', () => accountsEditor?.addAccount());
$('#btn-add-transfer').addEventListener('click', () => accountsEditor?.addTransfer());
$('#btn-connect').addEventListener('click', () => {
  accountsView?.toggleConnectMode();
  refreshAccounts();
});
$('#btn-edge-style').addEventListener('click', () => {
  accountsView?.toggleEdgeStyle();
  refreshAccounts();
});
$('#btn-tidy').addEventListener('click', () => {
  accountsView?.tidy();
  refreshAccounts();
});

for (const btn of document.querySelectorAll('.tab')) {
  btn.addEventListener('click', () => setTab(btn.dataset.tab));
}

/* ------------------------- Immobilien ------------------------- */

$('#btn-immo-add').addEventListener('click', () => immoView?.hinzufuegen());
$('#btn-immo-copy').addEventListener('click', () => immoView?.duplizieren());
$('#btn-immo-del').addEventListener('click', () => immoView?.entfernen());

/* --------------------------- Menü --------------------------- */

const menuPop = $('#menu-pop');
const menuBtn = $('#btn-menu');

function closeMenu() {
  menuPop.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
}

menuBtn.addEventListener('click', ev => {
  ev.stopPropagation();
  menuPop.hidden = !menuPop.hidden;
  menuBtn.setAttribute('aria-expanded', String(!menuPop.hidden));
});
document.addEventListener('click', ev => {
  if (!menuPop.hidden && !menuPop.contains(ev.target)) closeMenu();
});

function activeSvg() {
  if (activeTab === 'flow') return $('#sankey-host svg');
  if (activeTab === 'accounts') return $('#accounts-host svg');
  if (activeTab === 'tanken') return $('#tank-chart svg');
  return $('#immo-chart svg');
}

function activeName() {
  if (activeTab === 'flow') return store.data.sankey.title || 'geldfluss';
  if (activeTab === 'accounts') return 'kontomodell';
  if (activeTab === 'tanken') return 'verbrauch';
  return `${immoView?.aktiv()?.name || 'immobilie'}-restschuld`;
}

menuPop.addEventListener('click', async ev => {
  const act = ev.target.dataset?.act;
  if (!act) return;
  closeMenu();

  try {
    if (act === 'export-svg') {
      const node = activeSvg();
      if (!node) return;
      dl.downloadSvg(node, dl.slugFilename(activeName(), 'svg'));
    } else if (act === 'export-png') {
      const node = activeSvg();
      if (!node) return;
      await dl.downloadPng(node, dl.slugFilename(activeName(), 'png'));
    } else if (act === 'export-json') {
      dl.downloadJson(store.data, dl.slugFilename('finanzy-sicherung', 'json'));
    } else if (act === 'import-json') {
      pickFile(async file => {
        const raw = await dl.readJsonFile(file);
        if (!raw?.sankey || !raw?.accounts) {
          window.alert('Das ist keine Sicherungsdatei dieser App.');
          return;
        }
        if (!window.confirm('Die Sicherung ersetzt deinen aktuellen Stand. Fortfahren?')) return;
        store.data = migrate(raw);
        store.commit({ silent: true });
        rebuildAll();
      });
    } else if (act === 'reset') {
      if (!window.confirm('Alle Posten, Konten und Umbuchungen auf die Startwerte zurücksetzen?')) return;
      store.data = createDefaultData();
      store.commit({ silent: true });
      rebuildAll();
    }
  } catch (err) {
    window.alert(err.message || 'Das hat nicht funktioniert.');
  }
});

$('#btn-logout').addEventListener('click', async () => {
  await store.flushNow();
  leaveApp();
});

/* --------------------------- Datei-Auswahl --------------------------- */

const fileInput = $('#file-input');
let fileHandler = null;

function pickFile(handler) {
  fileHandler = handler;
  fileInput.value = '';
  fileInput.click();
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  const handler = fileHandler;
  fileHandler = null;
  if (!file || !handler) return;
  try {
    await handler(file);
  } catch (err) {
    window.alert(err.message || 'Die Datei konnte nicht verarbeitet werden.');
  }
});

/* --------------------------- Sonstiges --------------------------- */

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!store.data) return;
    if (activeTab === 'flow') refreshFlowChart();
    else refreshAccounts();
  }, 150);
});

// Letzte Änderungen noch wegschreiben, wenn der Tab in den Hintergrund geht.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') store.flushNow();
});
window.addEventListener('beforeunload', () => { store.flushNow(); });

$('#favicon').href = faviconDataUri();
$('#login-marke').appendChild(wortmarke({ size: 56 }));
$('#btn-brand').appendChild(wortmarke({ size: 24 }));
$('#btn-brand').addEventListener('click', () => setTab('start'));

setMode('login');

// Eine gespeicherte Sitzung überspringt den Login-Bildschirm.
if (cloud.restoreSession()) {
  submitBtn.disabled = true;
  showMsg('Lade deine Daten …', 'is-info');
  startSession()
    .then(hideMsg)
    .catch(err => {
      showMsg(err instanceof cloud.OfflineError
        ? 'Keine Verbindung zum Server. Bitte später erneut versuchen.'
        : err.message);
      fUser.value = cloud.currentUser()?.email ?? '';
    })
    .finally(() => { submitBtn.disabled = false; });
} else {
  fUser.focus();
}
