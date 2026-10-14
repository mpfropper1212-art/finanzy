// Schulden: wer schuldet mir was, und was schulde ich.
// Erfassen geht per Satz - getippt oder diktiert.

import { el, clear, money, uid, isoDatum } from './util.js';
import { leseSatz } from './schulden-text.js';

export function createSchuld(vorlage = {}) {
  return {
    id: uid('s'),
    person: '',
    betrag: 0,
    richtung: 'bekomme',
    grund: '',
    datum: isoDatum(),
    erledigt: false,
    ...vorlage,
  };
}

const datumKurz = iso => (iso
  ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '–');

export function auswerten(eintraege) {
  const offen = eintraege.filter(e => !e.erledigt);
  const summe = richtung => offen
    .filter(e => e.richtung === richtung)
    .reduce((s, e) => s + (Number(e.betrag) || 0), 0);

  const personen = new Map();
  for (const e of offen) {
    const name = e.person || 'Ohne Namen';
    if (!personen.has(name)) personen.set(name, { name, saldo: 0, posten: [] });
    const p = personen.get(name);
    p.saldo += (e.richtung === 'bekomme' ? 1 : -1) * (Number(e.betrag) || 0);
    p.posten.push(e);
  }

  return {
    bekomme: summe('bekomme'),
    schulde: summe('schulde'),
    saldo: summe('bekomme') - summe('schulde'),
    offen,
    erledigt: eintraege.filter(e => e.erledigt),
    // Wer am meisten offen hat, steht oben.
    personen: [...personen.values()].sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo)),
  };
}

const ERKENNER = window.SpeechRecognition || window.webkitSpeechRecognition;

export function createSchuldenView({ kopfHost, eingabeHost, listeHost, store }) {
  const eintraege = () => store.data.schulden.eintraege;
  let satz = '';
  let hoert = false;
  let erkennung = null;

  function aenderung() {
    store.commit({ silent: true });
    renderAll();
  }

  /* ------------------------------ Kopf ------------------------------ */

  function renderKopf(a) {
    clear(kopfHost);
    const box = el('div', { class: 'schuld-kopf' });

    const posten = (label, wert, klasse) => {
      const p = el('div', { class: `schuld-posten ${klasse}` });
      p.append(el('span', { class: 'schuld-label' }, label), el('strong', {}, money(Math.round(wert * 100) / 100)));
      return p;
    };

    box.append(
      posten('Dir schulden', a.bekomme, 'ist-plus'),
      posten('Du schuldest', a.schulde, 'ist-minus'),
      posten(a.saldo < 0 ? 'Macht unterm Strich minus' : 'Macht unterm Strich plus',
        Math.abs(a.saldo), a.saldo < 0 ? 'ist-minus' : 'ist-plus'),
    );
    kopfHost.appendChild(box);
  }

  /* ---------------------------- Eingabe ---------------------------- */

  function renderEingabe() {
    clear(eingabeHost);

    const zeile = el('div', { class: 'satz-zeile' });
    const feld = el('input', {
      type: 'text',
      class: 'satz-feld',
      placeholder: 'z. B. „Max schuldet mir 20 Euro fürs Kino“',
      value: satz,
    });
    feld.addEventListener('input', () => { satz = feld.value; zeigeVorschau(); });
    feld.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); uebernehmen(); }
    });
    zeile.appendChild(feld);

    if (ERKENNER) {
      const mikro = el('button', {
        type: 'button',
        class: 'mikro' + (hoert ? ' hoert' : ''),
        title: hoert ? 'Aufnahme beenden' : 'Sprechen',
        'aria-label': hoert ? 'Aufnahme beenden' : 'Sprechen',
      }, hoert ? '■' : '●');
      mikro.addEventListener('click', () => (hoert ? stoppen() : starten(feld)));
      zeile.appendChild(mikro);
    }

    const knopf = el('button', { class: 'btn btn-primary', type: 'button' }, 'Eintragen');
    knopf.addEventListener('click', uebernehmen);
    zeile.appendChild(knopf);

    eingabeHost.appendChild(zeile);

    if (!ERKENNER) {
      eingabeHost.appendChild(el('p', { class: 'feld-hinweis' },
        'Dieser Browser kann nicht zuhören. Auf dem Handy geht es trotzdem: '
        + 'ins Feld tippen und das Mikrofon deiner Tastatur benutzen.'));
    }

    eingabeHost.appendChild(el('div', { class: 'vorschau', id: 'schuld-vorschau' }));
    zeigeVorschau();
  }

  function zeigeVorschau() {
    const host = document.querySelector('#schuld-vorschau');
    if (!host) return;
    clear(host);
    if (!satz.trim()) {
      host.appendChild(el('p', { class: 'feld-hinweis' },
        'Erkannt werden Name, Betrag, Richtung, Grund und „gestern“ oder ein Datum. '
        + 'Ohne Hinweis im Satz wird angenommen, dass die Person dir schuldet.'));
      return;
    }

    const g = leseSatz(satz);
    if (!g.erfolg) {
      host.appendChild(el('p', { class: 'msg is-error' },
        `Dazu fehlt mir noch: ${g.fehlt.join(' und ')}. Beispiel: „Max schuldet mir 20 Euro fürs Kino“.`));
      return;
    }

    const karte = el('div', { class: 'vorschau-karte' });
    karte.appendChild(el('span', { class: 'vorschau-text' },
      g.richtung === 'bekomme'
        ? `${g.person} schuldet dir ${money(g.betrag)}`
        : `Du schuldest ${g.person} ${money(g.betrag)}`));

    const zusatz = [g.grund, datumKurz(g.datum)].filter(Boolean).join(' · ');
    karte.appendChild(el('span', { class: 'vorschau-zusatz' }, zusatz));

    if (!g.richtungSicher) {
      karte.appendChild(el('span', { class: 'vorschau-unsicher' },
        'Richtung geraten – nach dem Eintragen umschaltbar'));
    }
    host.appendChild(karte);
  }

  function uebernehmen() {
    const g = leseSatz(satz);
    if (!g.erfolg) return;
    eintraege().push(createSchuld({
      person: g.person,
      betrag: g.betrag,
      richtung: g.richtung,
      grund: g.grund,
      datum: g.datum,
    }));
    satz = '';
    aenderung();
  }

  /* ---------------------------- Diktat ---------------------------- */

  function starten(feld) {
    if (!ERKENNER) return;
    erkennung = new ERKENNER();
    erkennung.lang = 'de-DE';
    erkennung.interimResults = true;
    erkennung.continuous = false;

    erkennung.onresult = ev => {
      // Zwischenergebnisse direkt anzeigen, damit man beim Sprechen mitliest.
      satz = [...ev.results].map(r => r[0].transcript).join(' ').trim();
      feld.value = satz;
      zeigeVorschau();
    };
    erkennung.onerror = ev => {
      hoert = false;
      renderEingabe();
      const host = document.querySelector('#schuld-vorschau');
      host?.prepend(el('p', { class: 'msg is-error' },
        ev.error === 'not-allowed'
          ? 'Das Mikrofon ist für diese Seite gesperrt. In den Browser-Einstellungen freigeben.'
          : 'Die Spracherkennung hat abgebrochen. Tippen geht immer.'));
    };
    erkennung.onend = () => {
      hoert = false;
      renderEingabe();
      document.querySelector('.satz-feld')?.focus();
    };

    hoert = true;
    renderEingabe();
    try {
      erkennung.start();
    } catch {
      hoert = false;
      renderEingabe();
    }
  }

  function stoppen() {
    erkennung?.stop();
    hoert = false;
  }

  /* ----------------------------- Liste ----------------------------- */

  function renderListe(a) {
    clear(listeHost);

    if (!a.offen.length) {
      listeHost.appendChild(el('p', { class: 'empty' },
        a.erledigt.length
          ? 'Nichts mehr offen. Erledigtes steht unten.'
          : 'Noch nichts eingetragen – oben einen Satz eingeben.'));
    }

    for (const p of a.personen) {
      const block = el('section', { class: 'person' });

      const kopf = el('div', { class: 'person-kopf' });
      kopf.append(
        el('h3', {}, p.name),
        el('strong', { class: p.saldo < 0 ? 'ist-minus' : 'ist-plus' },
          p.saldo < 0
            ? `du schuldest ${money(Math.abs(p.saldo))}`
            : `bekommst ${money(p.saldo)}`),
      );
      block.appendChild(kopf);

      for (const e of p.posten.sort((x, y) => String(y.datum).localeCompare(String(x.datum)))) {
        block.appendChild(postenZeile(e));
      }
      listeHost.appendChild(block);
    }

    if (a.erledigt.length) {
      const box = el('details', { class: 'erledigt' });
      box.appendChild(el('summary', {}, `Erledigt (${a.erledigt.length})`));
      for (const e of a.erledigt) box.appendChild(postenZeile(e));
      listeHost.appendChild(box);
    }
  }

  function postenZeile(e) {
    const zeile = el('div', { class: 'posten' + (e.erledigt ? ' ist-erledigt' : '') });

    const links = el('div', { class: 'posten-text' });
    links.appendChild(el('span', { class: 'posten-grund' }, e.grund || 'Ohne Angabe'));
    links.appendChild(el('span', { class: 'posten-datum' }, datumKurz(e.datum)));
    zeile.appendChild(links);

    zeile.appendChild(el('span', {
      class: 'posten-betrag ' + (e.richtung === 'bekomme' ? 'ist-plus' : 'ist-minus'),
    }, `${e.richtung === 'bekomme' ? '+' : '−'} ${money(e.betrag)}`));

    const dreh = el('button', {
      class: 'link-btn posten-knopf', type: 'button',
      title: 'Richtung umdrehen',
    }, '⇅');
    dreh.addEventListener('click', () => {
      e.richtung = e.richtung === 'bekomme' ? 'schulde' : 'bekomme';
      aenderung();
    });

    const haken = el('button', {
      class: 'link-btn posten-knopf', type: 'button',
    }, e.erledigt ? 'zurückholen' : 'erledigt');
    haken.addEventListener('click', () => {
      e.erledigt = !e.erledigt;
      aenderung();
    });

    const weg = el('button', { class: 'icon-btn', type: 'button', title: 'Löschen' }, '×');
    weg.addEventListener('click', () => {
      store.data.schulden.eintraege = eintraege().filter(x => x.id !== e.id);
      aenderung();
    });

    const aktionen = el('div', { class: 'posten-aktionen' });
    aktionen.append(dreh, haken, weg);
    zeile.appendChild(aktionen);
    return zeile;
  }

  function renderAll() {
    const a = auswerten(eintraege());
    renderKopf(a);
    renderEingabe();
    renderListe(a);
  }

  return { renderAll };
}
