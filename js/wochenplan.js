// Wochenplan fürs Essen und die Einkaufsliste, die sich daraus ergibt.

import { el, clear, money, uid, isoDatum } from './util.js';
import { einkaufsliste, mengeText } from './gerichte-text.js';
import { TEMPERATUR_LABELS } from './gerichte-daten.js';
import { montagVon } from './store.js';

const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const MAHLZEITEN = [['mittag', 'Mittag'], ['abend', 'Abend']];

const datumVon = (start, tag) => {
  const d = new Date(start);
  d.setDate(d.getDate() + tag);
  return d;
};

const kurz = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

export function createWochenplanView({ planHost, listeHost, store, alleGerichte }) {
  const plan = () => store.data.wochenplan;

  function aenderung() {
    store.commit({ silent: true });
    renderAll();
  }

  const gerichtZu = id => alleGerichte().find(g => g.id === id) ?? null;

  const eintragFuer = (tag, mahlzeit) =>
    plan().eintraege.find(e => e.tag === tag && e.mahlzeit === mahlzeit) ?? null;

  function setzeGericht(tag, mahlzeit, gerichtId) {
    const vorhanden = eintragFuer(tag, mahlzeit);
    if (!gerichtId) {
      plan().eintraege = plan().eintraege.filter(e => e !== vorhanden);
    } else if (vorhanden) {
      vorhanden.gerichtId = gerichtId;
    } else {
      plan().eintraege.push({ id: uid('w'), tag, mahlzeit, gerichtId, portionen: 1 });
    }
    aenderung();
  }

  /* ------------------------------ Plan ------------------------------ */

  function renderPlan() {
    clear(planHost);

    const kopf = el('div', { class: 'woche-kopf' });
    const zurueck = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, '‹ Woche');
    const vor = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Woche ›');
    const heute = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Heute');

    const verschieben = tage => {
      const d = new Date(plan().start);
      d.setDate(d.getDate() + tage);
      plan().start = isoDatum(d);
      aenderung();
    };
    zurueck.addEventListener('click', () => verschieben(-7));
    vor.addEventListener('click', () => verschieben(7));
    heute.addEventListener('click', () => { plan().start = montagVon(new Date()); aenderung(); });

    const bis = datumVon(plan().start, 6);
    kopf.append(
      zurueck,
      el('strong', { class: 'woche-spanne' },
        `${kurz(new Date(plan().start))} – ${kurz(bis)}`),
      vor,
      heute,
    );
    planHost.appendChild(kopf);

    const heuteIso = isoDatum();
    const gitter = el('div', { class: 'woche-gitter' });

    for (let tag = 0; tag < 7; tag++) {
      const datum = datumVon(plan().start, tag);
      const istHeute = isoDatum(datum) === heuteIso;
      const spalte = el('div', { class: 'woche-tag' + (istHeute ? ' ist-heute' : '') });

      const tagKopf = el('div', { class: 'tag-kopf' });
      tagKopf.append(el('b', {}, TAGE[tag]), el('span', {}, kurz(datum)));
      spalte.appendChild(tagKopf);

      for (const [schluessel, label] of MAHLZEITEN) {
        spalte.appendChild(slot(tag, schluessel, label));
      }
      gitter.appendChild(spalte);
    }
    planHost.appendChild(gitter);
  }

  function slot(tag, mahlzeit, label) {
    const box = el('div', { class: 'slot' });
    box.appendChild(el('span', { class: 'slot-label' }, label));

    const eintrag = eintragFuer(tag, mahlzeit);
    const gericht = eintrag ? gerichtZu(eintrag.gerichtId) : null;

    const auswahl = el('select', { class: 'slot-wahl' });
    auswahl.appendChild(el('option', { value: '' }, '– nichts –'));
    for (const g of alleGerichte()) {
      const opt = el('option', { value: g.id }, g.name);
      if (eintrag?.gerichtId === g.id) opt.selected = true;
      auswahl.appendChild(opt);
    }
    auswahl.addEventListener('change', () => setzeGericht(tag, mahlzeit, auswahl.value));
    box.appendChild(auswahl);

    if (eintrag && gericht) {
      const zeile = el('div', { class: 'slot-zeile' });

      const portionen = el('input', {
        type: 'number', min: '1', max: '20', step: '1',
        value: eintrag.portionen, class: 'slot-portionen',
        title: 'Portionen',
      });
      portionen.addEventListener('input', () => {
        eintrag.portionen = Math.max(1, Number(portionen.value) || 1);
        store.commit({ silent: true });
        renderListe();
      });
      zeile.append(portionen, el('span', { class: 'slot-einheit' }, 'Port.'));
      zeile.appendChild(el('span', { class: 'slot-preis' },
        money(Math.round(gericht.preis * eintrag.portionen * 100) / 100)));

      // Beim Mittagessen entscheidet die Temperatur, ob es ins Büro taugt.
      const t = gericht.temperatur ?? 'warm';
      zeile.appendChild(el('span', { class: `temp temp-${t}`, title: TEMPERATUR_LABELS[t] },
        t === 'kalt' ? 'kalt ok' : t === 'beides' ? 'warm/kalt' : 'warm'));

      box.appendChild(zeile);
    }
    return box;
  }

  /* -------------------------- Einkaufsliste -------------------------- */

  function posten() {
    return plan().eintraege
      .map(e => ({ eintrag: e, gericht: gerichtZu(e.gerichtId) }))
      .filter(x => x.gericht);
  }

  function renderListe() {
    clear(listeHost);
    const alle = posten();

    const kopf = el('div', { class: 'editor-head' });
    kopf.appendChild(el('h2', {}, 'Einkaufsliste'));
    if (alle.length) {
      const leeren = el('button', { class: 'link-btn', type: 'button' }, 'Haken zurücksetzen');
      leeren.addEventListener('click', () => { plan().abgehakt = []; aenderung(); });
      kopf.appendChild(leeren);
    }
    listeHost.appendChild(kopf);

    if (!alle.length) {
      listeHost.appendChild(el('p', { class: 'empty' },
        'Trag links Gerichte ein, dann steht hier, was du einkaufen musst.'));
      return;
    }

    const portionen = alle.reduce((s, x) => s + x.eintrag.portionen, 0);
    const preis = alle.reduce((s, x) => s + x.gericht.preis * x.eintrag.portionen, 0);
    const protein = alle.reduce((s, x) => s + x.gericht.protein * x.eintrag.portionen, 0);

    const summe = el('div', { class: 'liste-summe' });
    summe.append(
      el('span', {}, `${portionen} Portionen`),
      el('strong', {}, money(Math.round(preis * 100) / 100)),
      el('span', {}, `${Math.round(protein)} g Eiweiß`),
    );
    listeHost.appendChild(summe);

    // Was kostet welches Gericht - die Einzelpreise hinter der Gesamtsumme.
    const aufstellung = el('details', { class: 'kosten-aufstellung' });
    aufstellung.appendChild(el('summary', {}, 'Was kostet was'));
    const nachPreis = [...alle].sort(
      (a, b) => b.gericht.preis * b.eintrag.portionen - a.gericht.preis * a.eintrag.portionen,
    );
    for (const x of nachPreis) {
      const zeile = el('div', { class: 'kosten-zeile' });
      zeile.append(
        el('span', { class: 'kosten-name' }, x.gericht.name),
        el('span', { class: 'kosten-anzahl' }, `${x.eintrag.portionen}×`),
        el('span', { class: 'kosten-wert' },
          money(Math.round(x.gericht.preis * x.eintrag.portionen * 100) / 100)),
      );
      aufstellung.appendChild(zeile);
    }
    listeHost.appendChild(aufstellung);

    const liste = einkaufsliste(alle.map(x => ({
      zutaten: x.gericht.zutaten,
      faktor: x.eintrag.portionen,
    })));

    const box = el('div', { class: 'einkauf' });
    for (const eintrag of liste) {
      const schluessel = `${eintrag.name.toLowerCase()}|${eintrag.einheit}`;
      const ab = plan().abgehakt.includes(schluessel);

      const zeile = el('label', { class: 'einkauf-zeile' + (ab ? ' ist-ab' : '') });
      const haken = el('input', { type: 'checkbox' });
      haken.checked = ab;
      haken.addEventListener('change', () => {
        if (haken.checked) plan().abgehakt.push(schluessel);
        else plan().abgehakt = plan().abgehakt.filter(x => x !== schluessel);
        aenderung();
      });

      zeile.append(
        haken,
        el('span', { class: 'einkauf-menge' }, mengeText(eintrag)),
        el('span', { class: 'einkauf-name' }, eintrag.name),
      );
      box.appendChild(zeile);
    }
    listeHost.appendChild(box);

    // Was warm gemacht werden muss, ist beim Mitnehmen die entscheidende Frage.
    const mittags = alle.filter(x => x.eintrag.mahlzeit === 'mittag');
    const warm = mittags.filter(x => (x.gericht.temperatur ?? 'warm') === 'warm');
    if (mittags.length) {
      listeHost.appendChild(el('p', { class: 'feld-hinweis' },
        warm.length
          ? `${warm.length} von ${mittags.length} Mittagessen musst du warm machen: `
            + `${warm.map(x => x.gericht.name).join(', ')}.`
          : 'Alle Mittagessen lassen sich kalt essen – keine Mikrowelle nötig.'));
    }
  }

  function renderAll() {
    renderPlan();
    renderListe();
  }

  // Von der Gerichteliste aus einplanen.
  function einplanen(gerichtId, tag, mahlzeit, portionen = 1) {
    const vorhanden = eintragFuer(tag, mahlzeit);
    if (vorhanden) {
      vorhanden.gerichtId = gerichtId;
      vorhanden.portionen = Math.max(1, portionen);
    } else {
      plan().eintraege.push({
        id: uid('w'), tag, mahlzeit, gerichtId, portionen: Math.max(1, portionen),
      });
    }
    store.commit({ silent: true });
    renderAll();
  }

  // Tage samt Datum und was dort schon steht - für die Auswahl auf der Karte.
  function wocheninfo() {
    return TAGE.map((name, tag) => ({
      tag,
      name,
      datum: kurz(datumVon(plan().start, tag)),
      belegt: Object.fromEntries(MAHLZEITEN.map(([schluessel]) => {
        const e = eintragFuer(tag, schluessel);
        return [schluessel, e ? gerichtZu(e.gerichtId)?.name ?? '' : ''];
      })),
    }));
  }

  return { renderAll, einplanen, wocheninfo };
}
