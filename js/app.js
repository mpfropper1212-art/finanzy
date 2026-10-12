// Bootstrap: Login, Tabs, Datenmenü, Chart-Aktualisierung.

import * as vault from './vault.js';
import { Store, createDefaultData, migrate } from './store.js';
import { computeLayout, renderSankey } from './sankey.js';
import { createFlowEditor } from './sankey-editor.js';
import { createAccountsView, createAccountsEditor, netWorth, monthlyTransferSum } from './accounts.js';
import * as dl from './export.js';
import { el, clear, money } from './util.js';

const $ = sel => document.querySelector(sel);

const store = new Store();
let flowEditor = null;
let accountsView = null;
let accountsEditor = null;
let activeTab = 'flow';
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
  submitBtn.textContent = next === 'register' ? 'Profil anlegen' : 'Anmelden';
}

function renderProfiles() {
  const list = vault.listProfiles();
  const wrap = $('#profile-list-wrap');
  wrap.hidden = list.length === 0;
  const host = $('#profile-list');
  clear(host);
  for (const id of list) {
    const chip = el('button', { type: 'button' }, id);
    chip.addEventListener('click', () => {
      setMode('login');
      fUser.value = id;
      fPass.focus();
    });
    host.appendChild(chip);
  }
}

for (const btn of document.querySelectorAll('.seg-btn')) {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
}

loginForm.addEventListener('submit', async ev => {
  ev.preventDefault();
  hideMsg();

  const userId = vault.normalizeUserId(fUser.value);
  const password = fPass.value;
  if (!userId) return showMsg('Bitte eine Benutzer-ID eingeben.');
  if (!password) return showMsg('Bitte ein Passwort eingeben.');

  if (mode === 'register') {
    if (password.length < 6) {
      return showMsg('Das Passwort sollte mindestens 6 Zeichen haben – es verschlüsselt deine Daten.');
    }
    if (password !== fPass2.value) return showMsg('Die beiden Passwörter sind nicht gleich.');
    if (vault.profileExists(userId)) {
      return showMsg('Dieses Profil gibt es in diesem Browser schon. Wechsle zu „Anmelden“.');
    }
  }

  submitBtn.disabled = true;
  const label = submitBtn.textContent;
  submitBtn.textContent = mode === 'register' ? 'Lege an …' : 'Entsperre …';

  try {
    if (mode === 'register') {
      const data = createDefaultData();
      const session = await vault.createProfile(userId, password, data);
      enterApp(session, data);
    } else {
      const { session, data } = await vault.unlock(userId, password);
      enterApp(session, migrate(data));
    }
  } catch (err) {
    showMsg(err instanceof vault.WrongPasswordError
      ? 'Passwort falsch.'
      : err.message || 'Das hat nicht funktioniert.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = label;
  }
});

$('#btn-import-login').addEventListener('click', () => pickFile(async file => {
  try {
    const rec = await dl.readJsonFile(file);
    const id = vault.importRecord(rec);
    renderProfiles();
    setMode('login');
    fUser.value = id;
    fPass.value = '';
    fPass.focus();
    showMsg(`Tresor „${id}" importiert. Jetzt mit dem zugehörigen Passwort anmelden.`, 'is-info');
  } catch (err) {
    showMsg(err.message);
  }
}));

/* ----------------------------- App ----------------------------- */

function enterApp(session, data) {
  store.attach(session, data);
  store.onStatus(onSaveStatus);

  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  fPass.value = '';
  fPass2.value = '';

  flowEditor = createFlowEditor({
    rowHost: $('#flow-rows'),
    colorHost: $('#color-rows'),
    listHost: $('#node-names'),
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

  $('#sankey-title').value = data.sankey.title;
  $('#sankey-height').value = data.sankey.height;

  flowEditor.renderAll();
  accountsEditor.renderAll();
  refreshFlowChart();
  setTab('flow');
}

function leaveApp() {
  store.detach();
  flowEditor = accountsEditor = accountsView = null;
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
  $('#accounts-host').replaceChildren();
  $('#sankey-host').replaceChildren();
  renderProfiles();
  setMode('login');
  fPass.focus();
}

function onSaveStatus(state, err) {
  const node = $('#save-state');
  if (state === 'dirty') node.textContent = 'Speichere …';
  else if (state === 'saved') node.textContent = 'Gespeichert';
  else node.textContent = err?.message ? 'Fehler beim Speichern' : '';
}

function setTab(tab) {
  activeTab = tab;
  for (const btn of document.querySelectorAll('.tab')) {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
  }
  $('#panel-flow').hidden = tab !== 'flow';
  $('#panel-accounts').hidden = tab !== 'accounts';
  if (tab === 'flow') refreshFlowChart();
  else refreshAccounts();
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
  if (layout.unusedCount > 0) {
    host.appendChild(el('p', { class: 'note note-info' },
      `${layout.unusedCount} Posten ohne Betrag werden nicht gezeichnet.`));
  }
}

$('#btn-add-flow').addEventListener('click', () => flowEditor?.addFlow());

$('#sankey-title').addEventListener('input', ev => {
  if (!store.data) return;
  store.data.sankey.title = ev.target.value;
  store.commit({ silent: true });
});

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
  $('#stat-networth').textContent = money(netWorth(store.data.accounts));
  $('#stat-transfers').textContent = money(Math.round(monthlyTransferSum(store.data.accounts) * 100) / 100);
}

$('#btn-add-account').addEventListener('click', () => accountsEditor?.addAccount());
$('#btn-add-transfer').addEventListener('click', () => accountsEditor?.addTransfer());
$('#btn-connect').addEventListener('click', () => {
  accountsView?.toggleConnectMode();
  refreshAccounts();
});
$('#btn-tidy').addEventListener('click', () => {
  accountsView?.tidy();
  refreshAccounts();
});

for (const btn of document.querySelectorAll('.tab')) {
  btn.addEventListener('click', () => setTab(btn.dataset.tab));
}

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
  return activeTab === 'flow'
    ? $('#sankey-host svg')
    : $('#accounts-host svg');
}

function activeName() {
  return activeTab === 'flow'
    ? store.data.sankey.title || 'geldfluss'
    : 'kontomodell';
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
    } else if (act === 'export-vault') {
      await store.flushNow();
      dl.downloadJson(vault.exportRecord(store.session.userId),
        dl.slugFilename(`tresor-${store.session.userId}`, 'json'));
    } else if (act === 'export-json') {
      dl.downloadJson(store.data, dl.slugFilename(`${activeName()}-rohdaten`, 'json'));
    } else if (act === 'import-vault') {
      pickFile(async file => {
        const rec = await dl.readJsonFile(file);
        const id = vault.normalizeUserId(rec?.userId);
        if (id !== store.session.userId) {
          window.alert(`Diese Datei gehört zum Profil „${id}". Melde dich ab und importiere sie auf dem Login-Bildschirm.`);
          return;
        }
        if (!window.confirm('Die aktuellen Daten dieses Profils werden durch die Datei ersetzt. Fortfahren?')) return;
        vault.importRecord(rec, { overwrite: true });
        window.alert('Tresor ersetzt. Bitte neu anmelden.');
        leaveApp();
      });
    } else if (act === 'reset') {
      if (!window.confirm('Alle Posten, Konten und Umbuchungen dieses Profils auf die Startwerte zurücksetzen?')) return;
      store.data = createDefaultData();
      store.commit({ silent: true });
      $('#sankey-title').value = store.data.sankey.title;
      $('#sankey-height').value = store.data.sankey.height;
      flowEditor.renderAll();
      accountsEditor.renderAll();
      refreshFlowChart();
      refreshAccounts();
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

if (!window.crypto?.subtle) {
  showMsg('Dieser Browser bietet keine WebCrypto-API – die App braucht https oder localhost.');
  submitBtn.disabled = true;
} else {
  renderProfiles();
  setMode('login');
  fUser.focus();
}
