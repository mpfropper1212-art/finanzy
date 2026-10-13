// Gerichte: Startdatenbank plus Gerichte, die Nutzer anlegen und die für alle
// sichtbar sind. Gespeichert wird pro Konto nur, was jemand gemerkt hat.

import * as cloud from './cloud.js';
import { SEED_GERICHTE, ART_LABELS, ART_FARBEN, TEMPERATUR_LABELS } from './gerichte-daten.js';
import { leseRezept } from './gerichte-text.js';
import { el, clear, money } from './util.js';
import { tellerSvg } from './gerichte-bild.js';

const SORTIERUNGEN = {
  proteinProEuro: { label: 'Eiweiß pro Euro', wert: g => (g.preis > 0 ? g.protein / g.preis : 0), absteigend: true },
  protein: { label: 'Eiweiß', wert: g => g.protein, absteigend: true },
  preis: { label: 'Preis', wert: g => g.preis, absteigend: false },
  zeit: { label: 'Zeit', wert: g => g.zeit, absteigend: false },
  aufwand: { label: 'Aufwand', wert: g => g.aufwand + g.abwasch, absteigend: false },
};

const leererEntwurf = () => ({
  name: '', art: 'vegetarisch', beschreibung: '', zutaten: '', schritte: '',
  kcal: '', protein: '', kh: '', fett: '', preis: '',
  zeit: '', aufwand: 2, abwasch: 2, temperatur: 'warm',
});

const alsListe = wert => (Array.isArray(wert)
  ? wert.filter(Boolean)
  : String(wert ?? '').split('\n').map(z => z.trim()).filter(Boolean));

// Eigene Gerichte kommen als Datenbankzeilen, Startgerichte als Konstanten -
// hier auf eine gemeinsame Form bringen.
function normalisiere(row) {
  return {
    id: row.id,
    name: row.name ?? '',
    art: ART_LABELS[row.art] ? row.art : 'vegetarisch',
    temperatur: TEMPERATUR_LABELS[row.temperatur] ? row.temperatur : 'warm',
    beschreibung: row.beschreibung ?? '',
    zutaten: alsListe(row.zutaten),
    schritte: alsListe(row.schritte),
    kcal: Number(row.kcal) || 0,
    protein: Number(row.protein) || 0,
    kh: Number(row.kh) || 0,
    fett: Number(row.fett) || 0,
    preis: Number(row.preis) || 0,
    zeit: Number(row.zeit) || 0,
    aufwand: Math.min(5, Math.max(1, Number(row.aufwand) || 1)),
    abwasch: Math.min(5, Math.max(1, Number(row.abwasch) || 1)),
    autor: row.autor ?? null,
    autorName: row.autor_name ?? null,
    quelle: 'geteilt',
  };
}

function skala(wert, titel) {
  const box = el('span', { class: 'skala', title: `${titel}: ${wert} von 5` });
  for (let i = 1; i <= 5; i++) {
    box.appendChild(el('span', { class: 'skala-punkt' + (i <= wert ? ' is-voll' : '') }));
  }
  return box;
}

export function createGerichteView({ listHost, filterHost, formHost, statusHost, store, planer }) {
  const seed = SEED_GERICHTE.map(g => ({ ...g, autor: null, autorName: null, quelle: 'start' }));
  let geteilt = [];
  let entwurf = leererEntwurf();
  let filter = { suche: '', art: 'alle', maxPreis: '', maxZeit: '', minProtein: '', nurFavoriten: false, nurEigene: false, nurKalt: false };
  let sortierung = 'proteinProEuro';

  const favoriten = () => store.data.gerichte.favoriten;
  const istFavorit = id => favoriten().includes(id);

  function alleGerichte() {
    return [...seed, ...geteilt];
  }

  async function ladeGeteilte() {
    try {
      geteilt = (await cloud.loadGerichte()).map(normalisiere);
      melde('');
    } catch (err) {
      geteilt = [];
      melde(err.message?.includes('Datentabelle')
        ? 'Die Tabelle für geteilte Gerichte fehlt im Supabase-Projekt. Die Startgerichte funktionieren trotzdem.'
        : `Geteilte Gerichte konnten nicht geladen werden: ${err.message}`, 'err');
    }
    renderListe();
  }

  function melde(text, art = 'info') {
    clear(statusHost);
    if (!text) return;
    statusHost.appendChild(el('p', { class: `note note-${art}` }, text));
  }

  /* ------------------------------ Filter ------------------------------ */

  function gefiltert() {
    const suche = filter.suche.trim().toLowerCase();
    const liste = alleGerichte().filter(g => {
      if (suche && !`${g.name} ${g.beschreibung}`.toLowerCase().includes(suche)) return false;
      // Wer vegetarisch filtert, will vegane Gerichte mitsehen.
      if (filter.art === 'vegan' && g.art !== 'vegan') return false;
      if (filter.art === 'vegetarisch' && g.art !== 'vegan' && g.art !== 'vegetarisch') return false;
      if (filter.art === 'fleisch' && g.art !== 'fleisch' && g.art !== 'fisch') return false;
      if (filter.maxPreis !== '' && g.preis > Number(filter.maxPreis)) return false;
      if (filter.maxZeit !== '' && g.zeit > Number(filter.maxZeit)) return false;
      if (filter.minProtein !== '' && g.protein < Number(filter.minProtein)) return false;
      if (filter.nurKalt && (g.temperatur ?? 'warm') === 'warm') return false;
      if (filter.nurFavoriten && !istFavorit(g.id)) return false;
      if (filter.nurEigene && g.autor !== cloud.currentUser()?.id) return false;
      return true;
    });

    const s = SORTIERUNGEN[sortierung];
    return liste.sort((a, b) => (s.absteigend ? s.wert(b) - s.wert(a) : s.wert(a) - s.wert(b)));
  }

  function renderFilter() {
    clear(filterHost);

    const suche = el('input', { type: 'search', placeholder: 'Suchen …', value: filter.suche, class: 'filter-suche' });
    suche.addEventListener('input', () => { filter.suche = suche.value; renderListe(); });
    filterHost.appendChild(suche);

    const arten = el('div', { class: 'filter-arten' });
    for (const [wert, label] of [['alle', 'Alle'], ['vegan', 'Vegan'], ['vegetarisch', 'Vegetarisch'], ['fleisch', 'Mit Fleisch/Fisch']]) {
      const btn = el('button', { type: 'button', class: 'pill' + (filter.art === wert ? ' is-active' : '') }, label);
      btn.addEventListener('click', () => { filter.art = wert; renderFilter(); renderListe(); });
      arten.appendChild(btn);
    }
    filterHost.appendChild(arten);

    const zahlen = el('div', { class: 'filter-zahlen' });
    for (const [key, label, einheit] of [
      ['maxPreis', 'max. Preis', '€'], ['maxZeit', 'max. Zeit', 'Min'], ['minProtein', 'min. Eiweiß', 'g'],
    ]) {
      const wrap = el('label', { class: 'filter-zahl' });
      const input = el('input', { type: 'number', min: '0', step: key === 'maxPreis' ? '0.5' : '5', value: filter[key], placeholder: '–' });
      input.addEventListener('input', () => { filter[key] = input.value; renderListe(); });
      wrap.append(el('span', {}, label), input, el('span', { class: 'filter-einheit' }, einheit));
      zahlen.appendChild(wrap);
    }
    filterHost.appendChild(zahlen);

    const schalter = el('div', { class: 'filter-arten' });
    for (const [key, label] of [['nurFavoriten', 'Nur gemerkte'], ['nurEigene', 'Nur meine'], ['nurKalt', 'Kalt essbar']]) {
      const btn = el('button', { type: 'button', class: 'pill' + (filter[key] ? ' is-active' : '') }, label);
      btn.addEventListener('click', () => { filter[key] = !filter[key]; renderFilter(); renderListe(); });
      schalter.appendChild(btn);
    }
    const sortSelect = el('select', { class: 'filter-sort', 'aria-label': 'Sortierung' });
    for (const [key, s] of Object.entries(SORTIERUNGEN)) {
      const opt = el('option', { value: key }, `Sortieren: ${s.label}`);
      if (key === sortierung) opt.selected = true;
      sortSelect.appendChild(opt);
    }
    sortSelect.addEventListener('change', () => { sortierung = sortSelect.value; renderListe(); });
    schalter.appendChild(sortSelect);
    filterHost.appendChild(schalter);
  }

  /* ------------------------------- Liste ------------------------------- */

  function renderListe() {
    clear(listHost);
    const liste = gefiltert();

    listHost.appendChild(el('p', { class: 'listen-kopf' },
      `${liste.length} von ${alleGerichte().length} Gerichten`));

    if (!liste.length) {
      listHost.appendChild(el('p', { class: 'empty' }, 'Keine Treffer. Filter lockern oder rechts ein Gericht anlegen.'));
      return;
    }

    for (const g of liste) listHost.appendChild(karte(g));
  }

  function karte(g) {
    const box = el('article', { class: 'gericht' });
    const haupt = el('div', { class: 'gericht-haupt' });

    const bild = el('div', { class: 'gericht-bild' });
    bild.appendChild(tellerSvg(g));
    haupt.appendChild(bild);

    const inhalt = el('div', { class: 'gericht-inhalt' });

    const kopf = el('div', { class: 'gericht-kopf' });
    const titel = el('div', { class: 'gericht-titel' });
    titel.append(
      el('h3', {}, g.name),
      el('span', { class: 'gericht-art', style: `--art: ${ART_FARBEN[g.art]}` }, ART_LABELS[g.art]),
    );
    const t = g.temperatur ?? 'warm';
    titel.appendChild(el('span', { class: `temp temp-${t}`, title: TEMPERATUR_LABELS[t] },
      t === 'kalt' ? 'kalt essbar' : t === 'beides' ? 'warm oder kalt' : 'warm machen'));

    if (g.quelle === 'geteilt') {
      titel.appendChild(el('span', { class: 'gericht-quelle' },
        g.autor === cloud.currentUser()?.id ? 'von dir' : 'von einem anderen Nutzer'));
    }

    const herz = el('button', {
      type: 'button',
      class: 'herz' + (istFavorit(g.id) ? ' is-an' : ''),
      title: istFavorit(g.id) ? 'Aus den gemerkten entfernen' : 'Merken',
      'aria-pressed': String(istFavorit(g.id)),
    }, istFavorit(g.id) ? '♥' : '♡');
    herz.addEventListener('click', () => {
      const liste = favoriten();
      const i = liste.indexOf(g.id);
      if (i >= 0) liste.splice(i, 1);
      else liste.push(g.id);
      store.commit({ silent: true });
      renderListe();
    });

    kopf.append(titel, herz);
    inhalt.appendChild(kopf);

    if (g.beschreibung) inhalt.appendChild(el('p', { class: 'gericht-text' }, g.beschreibung));

    const werte = el('div', { class: 'gericht-werte' });
    werte.append(
      wert(money(g.preis), 'pro Portion'),
      wert(`${g.protein} g`, 'Eiweiß', true),
      wert(`${g.kcal}`, 'kcal'),
      wert(`${g.kh} g`, 'Kohlenhydrate'),
      wert(`${g.fett} g`, 'Fett'),
      wert(g.preis > 0 ? `${(g.protein / g.preis).toFixed(0)} g` : '–', 'Eiweiß je €', true),
    );
    inhalt.appendChild(werte);

    const fuss = el('div', { class: 'gericht-fuss' });
    fuss.append(
      el('span', {}, `${g.zeit} Min`),
      beschriftet('Aufwand', skala(g.aufwand, 'Kochaufwand')),
      beschriftet('Abwasch', skala(g.abwasch, 'Abwasch')),
    );
    if (planer) {
      const planen = el('button', { class: 'link-btn plan-knopf', type: 'button' }, '+ Wochenplan');
      planen.addEventListener('click', () => planWaehler(box, g, planen));
      fuss.appendChild(planen);
    }

    if (g.autor && g.autor === cloud.currentUser()?.id) {
      const del = el('button', { type: 'button', class: 'link-btn gericht-loeschen' }, 'löschen');
      del.addEventListener('click', () => entferneGericht(g));
      fuss.appendChild(del);
    }
    inhalt.appendChild(fuss);
    haupt.appendChild(inhalt);
    box.appendChild(haupt);

    const zutaten = g.zutaten ?? [];
    const schritte = g.schritte ?? [];
    if (zutaten.length || schritte.length) {
      const rezept = el('details', { class: 'rezept' });
      rezept.appendChild(el('summary', {}, 'Zutaten und Zubereitung'));
      const koerper = el('div', { class: 'rezept-koerper' });

      if (zutaten.length) {
        const spalte = el('div');
        spalte.appendChild(el('h4', {}, 'Zutaten'));
        const liste = el('ul', { class: 'zutaten' });
        for (const z of zutaten) liste.appendChild(el('li', {}, z));
        spalte.appendChild(liste);
        koerper.appendChild(spalte);
      }
      if (schritte.length) {
        const spalte = el('div');
        spalte.appendChild(el('h4', {}, 'Zubereitung'));
        const liste = el('ol', { class: 'schritte' });
        for (const z of schritte) liste.appendChild(el('li', {}, z));
        spalte.appendChild(liste);
        koerper.appendChild(spalte);
      }
      rezept.appendChild(koerper);
      box.appendChild(rezept);
    }

    return box;
  }

  // Kleine Auswahl direkt an der Karte: Tag, Mahlzeit, Portionen.
  function planWaehler(karte, gericht, knopf) {
    const vorhanden = karte.querySelector('.plan-waehler');
    if (vorhanden) { vorhanden.remove(); return; }
    document.querySelectorAll('.plan-waehler').forEach(n => n.remove());

    const box = el('div', { class: 'plan-waehler' });
    const woche = planer.wocheninfo();

    const tagWahl = el('select');
    for (const t of woche) {
      tagWahl.appendChild(el('option', { value: String(t.tag) }, `${t.name} ${t.datum}`));
    }
    const mahlWahl = el('select');
    for (const [wertKey, label] of [['mittag', 'Mittag'], ['abend', 'Abend']]) {
      mahlWahl.appendChild(el('option', { value: wertKey }, label));
    }
    const portionen = el('input', { type: 'number', min: '1', max: '20', value: '1', title: 'Portionen' });

    // Zeigen, was dort schon steht - sonst überschreibt man es ungewollt.
    const belegt = el('span', { class: 'plan-belegt' });
    const zeigeBelegung = () => {
      const t = woche[Number(tagWahl.value)];
      const da = t?.belegt[mahlWahl.value];
      belegt.textContent = da ? `dort steht: ${da}` : 'noch frei';
    };
    tagWahl.addEventListener('change', zeigeBelegung);
    mahlWahl.addEventListener('change', zeigeBelegung);
    zeigeBelegung();

    const ok = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, 'Einplanen');
    ok.addEventListener('click', () => {
      planer.einplanen(gericht.id, Number(tagWahl.value), mahlWahl.value, Number(portionen.value) || 1);
      box.remove();
      knopf.textContent = '✓ eingeplant';
      setTimeout(() => { knopf.textContent = '+ Wochenplan'; }, 2200);
    });

    box.append(tagWahl, mahlWahl, portionen, el('span', { class: 'plan-einheit' }, 'Port.'), ok, belegt);
    karte.appendChild(box);
    tagWahl.focus();
  }

  function wert(zahl, label, hervor = false) {
    const box = el('div', { class: 'gw' + (hervor ? ' gw-stark' : '') });
    box.append(el('strong', {}, zahl), el('span', {}, label));
    return box;
  }

  function beschriftet(label, knoten) {
    const box = el('span', { class: 'gericht-skala' });
    box.append(el('span', {}, label), knoten);
    return box;
  }

  async function entferneGericht(g) {
    if (!window.confirm(`„${g.name}" löschen? Das Gericht verschwindet auch für alle anderen.`)) return;
    try {
      await cloud.deleteGericht(g.id);
      geteilt = geteilt.filter(x => x.id !== g.id);
      renderListe();
      melde('Gericht gelöscht.');
    } catch (err) {
      melde(`Löschen fehlgeschlagen: ${err.message}`, 'err');
    }
  }

  /* ----------------------------- Formular ----------------------------- */

  function renderFormular() {
    clear(formHost);

    const feld = (key, label, attrs = {}) => {
      const row = el('label', { class: 'feld' });
      row.appendChild(el('span', { class: 'feld-label' }, label));
      const input = el('input', { value: entwurf[key] ?? '', ...attrs });
      input.addEventListener('input', () => { entwurf[key] = input.value; });
      const wrap = el('div', { class: 'feld-input' });
      wrap.appendChild(input);
      if (attrs['data-einheit']) wrap.appendChild(el('span', { class: 'feld-einheit' }, attrs['data-einheit']));
      row.appendChild(wrap);
      formHost.appendChild(row);
      return input;
    };

    const nameRow = el('label', { class: 'feld feld-breit' });
    nameRow.appendChild(el('span', { class: 'feld-label' }, 'Name'));
    const name = el('input', { type: 'text', value: entwurf.name, placeholder: 'z. B. Linsen-Dal' });
    name.addEventListener('input', () => { entwurf.name = name.value; });
    nameRow.appendChild(name);
    formHost.appendChild(nameRow);

    const artRow = el('label', { class: 'feld' });
    artRow.appendChild(el('span', { class: 'feld-label' }, 'Art'));
    const art = el('select');
    for (const [wertKey, label] of Object.entries(ART_LABELS)) {
      const opt = el('option', { value: wertKey }, label);
      if (entwurf.art === wertKey) opt.selected = true;
      art.appendChild(opt);
    }
    art.addEventListener('change', () => { entwurf.art = art.value; });
    const artWrap = el('div', { class: 'feld-input' });
    artWrap.appendChild(art);
    artRow.appendChild(artWrap);
    formHost.appendChild(artRow);

    const tempRow = el('label', { class: 'feld' });
    tempRow.appendChild(el('span', { class: 'feld-label' }, 'Temperatur'));
    const temp = el('select');
    for (const [wertKey, label] of Object.entries(TEMPERATUR_LABELS)) {
      const opt = el('option', { value: wertKey }, label);
      if (entwurf.temperatur === wertKey) opt.selected = true;
      temp.appendChild(opt);
    }
    temp.addEventListener('change', () => { entwurf.temperatur = temp.value; });
    const tempWrap = el('div', { class: 'feld-input' });
    tempWrap.appendChild(temp);
    tempRow.appendChild(tempWrap);
    formHost.appendChild(tempRow);

    feld('preis', 'Preis je Portion', { type: 'number', min: '0', step: '0.1', 'data-einheit': '€' });
    feld('kcal', 'Kalorien', { type: 'number', min: '0', step: '10', 'data-einheit': 'kcal' });
    feld('protein', 'Eiweiß', { type: 'number', min: '0', step: '1', 'data-einheit': 'g' });
    feld('kh', 'Kohlenhydrate', { type: 'number', min: '0', step: '1', 'data-einheit': 'g' });
    feld('fett', 'Fett', { type: 'number', min: '0', step: '1', 'data-einheit': 'g' });
    feld('zeit', 'Zubereitungszeit', { type: 'number', min: '0', step: '5', 'data-einheit': 'Min' });

    for (const [key, label] of [['aufwand', 'Kochaufwand'], ['abwasch', 'Abwasch']]) {
      const row = el('label', { class: 'feld' });
      row.appendChild(el('span', { class: 'feld-label' }, label));
      const input = el('input', { type: 'range', min: '1', max: '5', step: '1', value: entwurf[key] });
      const anzeige = el('span', { class: 'feld-einheit' }, `${entwurf[key]} / 5`);
      input.addEventListener('input', () => {
        entwurf[key] = Number(input.value);
        anzeige.textContent = `${entwurf[key]} / 5`;
      });
      const wrap = el('div', { class: 'feld-input' });
      wrap.append(input, anzeige);
      row.appendChild(wrap);
      formHost.appendChild(row);
    }

    const textfeld = (key, label, platzhalter, zeilen) => {
      const row = el('label', { class: 'feld feld-breit' });
      row.appendChild(el('span', { class: 'feld-label' }, label));
      const feld = el('textarea', { rows: String(zeilen), placeholder: platzhalter });
      feld.value = entwurf[key];
      feld.addEventListener('input', () => { entwurf[key] = feld.value; });
      row.appendChild(feld);
      formHost.appendChild(row);
    };

    textfeld('beschreibung', 'Kurzbeschreibung', 'Ein Satz, warum sich das Gericht lohnt.', 2);
    textfeld('zutaten', 'Zutaten (eine je Zeile)', '250 g Magerquark\n50 g Haferflocken\n1 Banane', 4);
    textfeld('schritte', 'Zubereitung (ein Schritt je Zeile)', 'Quark cremig rühren.\nHaferflocken unterrühren.', 4);

    const hinweis = el('p', { class: 'feld-hinweis' },
      'Dein Gericht erscheint für alle Nutzer dieser Seite.');
    formHost.appendChild(hinweis);

    const einfuegenKopf = el('details', { class: 'rezept-einfuegen' });
    einfuegenKopf.appendChild(el('summary', {}, 'Rezept als Text einfügen'));
    einfuegenKopf.appendChild(el('p', { class: 'feld-hinweis' },
      'Rezepttext hier einfügen – Name, Zutaten und Schritte werden erkannt und oben '
      + 'eingetragen. Bei einem Screenshot: auf dem iPhone lange auf den Text im Bild '
      + 'tippen, kopieren, hier einfügen.'));
    const rohfeld = el('textarea', { rows: '5', placeholder: 'Zutaten\n250 g Magerquark\n…\n\nZubereitung\n1. …' });
    einfuegenKopf.appendChild(rohfeld);
    const lesen = el('button', { class: 'btn btn-block', type: 'button' }, 'Übernehmen');
    lesen.addEventListener('click', () => {
      const r = leseRezept(rohfeld.value);
      if (!r.erfolg) {
        melde('Aus dem Text konnte ich nichts herauslesen.', 'err');
        return;
      }
      if (r.name) entwurf.name = r.name;
      if (r.zutaten.length) entwurf.zutaten = r.zutaten.join('\n');
      if (r.schritte.length) entwurf.schritte = r.schritte.join('\n');
      renderFormular();
      melde(`Übernommen: ${r.zutaten.length} Zutaten, ${r.schritte.length} Schritte. `
        + 'Nährwerte und Preis musst du noch ergänzen.');
    });
    einfuegenKopf.appendChild(lesen);
    formHost.appendChild(einfuegenKopf);

    const senden = el('button', { class: 'btn btn-primary btn-block', type: 'button' }, 'Gericht veröffentlichen');
    senden.addEventListener('click', () => speichere(senden));
    formHost.appendChild(senden);
  }

  async function speichere(knopf) {
    if (!entwurf.name.trim()) {
      melde('Das Gericht braucht einen Namen.', 'err');
      return;
    }
    knopf.disabled = true;
    const label = knopf.textContent;
    knopf.textContent = 'Speichere …';
    try {
      const zahl = v => (v === '' || v === null ? 0 : Number(v) || 0);
      const neu = await cloud.createGericht({
        name: entwurf.name.trim(),
        art: entwurf.art,
        beschreibung: entwurf.beschreibung.trim(),
        temperatur: entwurf.temperatur,
        zutaten: alsListe(entwurf.zutaten),
        schritte: alsListe(entwurf.schritte),
        kcal: Math.round(zahl(entwurf.kcal)),
        protein: Math.round(zahl(entwurf.protein)),
        kh: Math.round(zahl(entwurf.kh)),
        fett: Math.round(zahl(entwurf.fett)),
        preis: zahl(entwurf.preis),
        zeit: Math.round(zahl(entwurf.zeit)),
        aufwand: Number(entwurf.aufwand),
        abwasch: Number(entwurf.abwasch),
        autor_name: cloud.currentUser()?.email?.split('@')[0] ?? null,
      });
      if (neu) geteilt = [normalisiere(neu), ...geteilt];
      entwurf = leererEntwurf();
      renderFormular();
      renderListe();
      melde('Gericht veröffentlicht. Es steht jetzt allen zur Verfügung.');
    } catch (err) {
      melde(`Speichern fehlgeschlagen: ${err.message}`, 'err');
    } finally {
      knopf.disabled = false;
      knopf.textContent = label;
    }
  }

  function renderAll() {
    renderFilter();
    renderFormular();
    renderListe();
  }

  return { renderAll, ladeGeteilte, alleGerichte };
}
