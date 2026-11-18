// Auto: Stammdaten, Kostenliste und Wartungsplan.

import { el, clear, money } from './util.js';
import { KATEGORIEN, KATEGORIE_IDS, RHYTHMEN, RHYTHMUS_IDS } from './auto-daten.js';
import {
  auswerten, laufendAuswerten, createKosten, createWartung, createLaufend,
  WARTUNG_STATUS, runde,
} from './auto-logik.js';
import { auswerten as tankAuswerten } from './tanken.js';

const zahl = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

const kurz = iso => (iso
  ? new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  : '–');
const lang = iso => (iso
  ? new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '–');
const km = v => (Number.isFinite(Number(v)) ? `${Math.round(Number(v)).toLocaleString('de-DE')} km` : '–');

function kachel(label, wert, hint) {
  const box = el('div', { class: 'kpi' });
  box.append(el('span', { class: 'kpi-label' }, label), el('strong', { class: 'kpi-value' }, wert));
  if (hint) box.appendChild(el('span', { class: 'kpi-hint' }, hint));
  return box;
}

export function createAutoView({ kpiHost, wartungHost, kostenHost, seiteHost, store }) {
  const auto = () => store.data.auto;
  const tank = () => store.data.tanken?.eintraege ?? [];

  // Ob die Monatskosten aufgeklappt sind. Reine Anzeige, gehört nicht in
  // die gespeicherten Daten.
  let offen = false;

  function aenderung() {
    store.commit({ silent: true });
    renderAll();
  }

  /* ------------------------------ Kopf ------------------------------ */

  function renderKpis(a) {
    clear(kpiHost);

    const kopf = el('div', { class: 'auto-kopf' });
    kopf.append(
      el('h2', {}, auto().name || 'Mein Auto'),
      el('span', { class: 'auto-hsn' },
        `HSN ${auto().hsn || '–'} · TSN ${auto().tsn || '–'}`),
    );
    kpiHost.appendChild(kopf);

    const k = a.kosten;
    const box = el('div', { class: 'kpis' });
    box.append(
      kachel('Kilometerstand', km(a.km),
        auto().kmQuelle === 'tanken' ? 'aus den Tankfüllungen' : 'von Hand gepflegt'),
      kachel('Selbst gefahren', km(k.gefahren),
        `seit ${km(auto().startKm)} beim Kauf`),
      kachel('Kosten gesamt', money(k.gesamt),
        auto().kaufpreisMitrechnen === false
          ? `ohne Kaufpreis gerechnet: ${money(k.laufend)}`
          : `davon ${money(k.anschaffung)} Anschaffung`),
      kachel('Kosten je km', k.proKm === null ? '–' : `${runde(k.proKm).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`,
        auto().kaufpreisMitrechnen === false ? 'ohne Kaufpreis' : 'mit Kaufpreis'),
      kachel('Bisher je Monat', k.proMonat === null ? '–' : money(Math.round(k.proMonat)),
        k.monate ? `Schnitt über ${Math.round(k.monate)} Monate` : 'noch zu kurz'),
    );

    // Die Monatskosten sind die eine Zahl, bei der man wissen will, woraus
    // sie besteht - deshalb aufklappbar statt nur angezeigt.
    const laufendKachel = el('button', {
      type: 'button',
      class: 'kpi kpi-klappe' + (offen ? ' ist-offen' : ''),
      'aria-expanded': String(offen),
    });
    laufendKachel.append(
      el('span', { class: 'kpi-label' }, 'Läuft je Monat'),
      el('strong', { class: 'kpi-value' }, money(Math.round(a.laufend.gesamtProMonat))),
      el('span', { class: 'kpi-hint' },
        offen ? 'Zum Zuklappen tippen' : 'Antippen: woraus sich das zusammensetzt'),
      el('span', { class: 'kpi-pfeil' }, offen ? '▴' : '▾'),
    );
    laufendKachel.addEventListener('click', () => { offen = !offen; renderAll(); });
    box.appendChild(laufendKachel);

    if (a.wartung.faellig.length) {
      box.appendChild(kachel('Wartung fällig', String(a.wartung.faellig.length),
        a.wartung.faellig.map(x => x.teil).join(', ')));
    }
    kpiHost.appendChild(box);
    if (offen) kpiHost.appendChild(aufschluesselung(a));
  }

  /* ----------------------------- Wartung ----------------------------- */

  function renderWartung(a) {
    clear(wartungHost);
    wartungHost.appendChild(el('div', { class: 'immo-chart-head' }, 'Wartungsplan'));

    if (!a.wartung.liste.length) {
      wartungHost.appendChild(el('p', { class: 'empty' },
        'Noch keine Wartungsposition. Rechts eintragen, was wann gemacht wurde.'));
      return;
    }

    const offene = a.wartung.liste.filter(w => w.vorschlag).length;
    if (offene) {
      wartungHost.appendChild(el('p', { class: 'feld-hinweis' },
        `${offene === 1 ? 'Eine Position hat' : `${offene} Positionen haben`} noch kein Intervall. `
        + 'Die Vorschläge sind übliche VW-Werte zum Übernehmen und danach frei änderbar – '
        + 'verbindlich ist dein Serviceplan, nicht diese Liste.'));
    }

    const liste = el('div', { class: 'wartung-liste' });
    for (const w of a.wartung.liste) {
      const meta = WARTUNG_STATUS[w.status];
      const zeile = el('div', {
        class: `wartung-zeile ist-${w.status}`,
        style: `--status: ${meta.farbe}`,
      });

      const links = el('div', { class: 'wartung-links' });
      links.append(
        el('strong', {}, w.teil),
        el('span', { class: 'wartung-zuletzt' },
          w.km || w.datum
            ? `zuletzt ${[w.km ? km(w.km) : null, w.datum ? lang(w.datum) : null].filter(Boolean).join(' · ')}`
            : 'noch nie erfasst'),
      );
      zeile.appendChild(links);

      const rechts = el('div', { class: 'wartung-rechts' });
      rechts.appendChild(el('span', { class: 'wartung-marke' }, meta.label));

      if (w.faelligKm !== null || w.faelligAm) {
        const teile = [];
        if (w.faelligKm !== null) {
          teile.push(w.restKm > 0
            ? `noch ${km(w.restKm)} (bei ${km(w.faelligKm)})`
            : `${km(Math.abs(w.restKm))} überfällig`);
        }
        if (w.faelligAm) {
          teile.push(w.restTage > 0
            ? `${lang(w.faelligAm)} (in ${w.restTage} Tagen)`
            : `seit ${lang(w.faelligAm)} überfällig`);
        }
        rechts.appendChild(el('span', { class: 'wartung-faellig' }, teile.join(' · ')));
      } else if (w.vorschlag) {
        const teile = [];
        if (w.vorschlag.km) teile.push(`alle ${km(w.vorschlag.km)}`);
        // "alle 1 Jahre" ist kein Deutsch.
        if (w.vorschlag.jahre) {
          teile.push(w.vorschlag.jahre === 1 ? 'jährlich' : `alle ${w.vorschlag.jahre} Jahre`);
        }
        const knopf = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' },
          `Vorschlag: ${teile.join(' oder ')}`);
        knopf.title = w.vorschlag.hinweis;
        knopf.addEventListener('click', () => {
          const ziel = auto().wartung.find(x => x.id === w.id);
          if (!ziel) return;
          ziel.intervallKm = w.vorschlag.km;
          ziel.intervallJahre = w.vorschlag.jahre;
          aenderung();
        });
        rechts.appendChild(knopf);
      } else {
        rechts.appendChild(el('span', { class: 'wartung-faellig' }, 'kein Intervall hinterlegt'));
      }
      zeile.appendChild(rechts);

      if (w.vorschlag) {
        zeile.appendChild(el('p', { class: 'wartung-hinweis' }, w.vorschlag.hinweis));
      }

      liste.appendChild(zeile);
    }
    wartungHost.appendChild(liste);
  }

  /* ----------------------- Monatskosten aufklappen ----------------------- */

  const SPRIT_FARBE = '#d97706';

  function aufschluesselung(a) {
    const l = a.laufend;
    const box = el('section', { class: 'auf' });

    const kopf = el('div', { class: 'auf-kopf' });
    kopf.append(
      el('h3', {}, 'Woraus sich das zusammensetzt'),
      el('strong', { class: 'auf-summe' }, `${money(l.gesamtProMonat)} / Monat`),
    );
    box.appendChild(kopf);

    // Anteilsbalken: zeigt vor dem Lesen schon, was am schwersten wiegt.
    const anteile = [
      ...l.posten.map(x => ({
        id: x.id, label: x.art, wert: x.proMonat,
        farbe: KATEGORIEN[x.kategorie]?.farbe ?? KATEGORIEN.fix.farbe,
      })),
      ...(l.sprit !== null && l.sprit > 0
        ? [{ id: 'sprit', label: 'Sprit', wert: l.sprit, farbe: SPRIT_FARBE }]
        : []),
    ].filter(x => x.wert > 0);

    if (anteile.length) {
      const balken = el('div', { class: 'auf-balken' });
      for (const x of anteile) {
        balken.appendChild(el('span', {
          class: 'auf-anteil',
          style: `width: ${(x.wert / l.gesamtProMonat) * 100}%; background: ${x.farbe}`,
          title: `${x.label}: ${money(x.wert)} je Monat`,
        }));
      }
      box.appendChild(balken);
    }

    const liste = el('div', { class: 'auf-liste' });

    // Alle Beträge, die sich live mitändern sollen, hier merken - so lässt
    // sich beim Tippen rechnen, ohne die Liste neu zu bauen und damit den
    // Fokus aus dem Feld zu werfen.
    const anzeigen = [];
    const neuRechnen = () => {
      const frisch = laufendAuswerten(auto(), l.sprit);
      for (const { id, knoten } of anzeigen) {
        const posten = frisch.posten.find(x => x.id === id);
        if (posten) knoten.textContent = money(posten.proMonat);
      }
      kopf.querySelector('.auf-summe').textContent = `${money(frisch.gesamtProMonat)} / Monat`;
      jahr.textContent = `${money(Math.round(frisch.gesamtProMonat * 12))} im Jahr`;
      // Die Kachel darüber zeigt dieselbe Zahl - sie muss mitlaufen, sonst
      // stehen zwei verschiedene Summen übereinander.
      const kachelWert = kpiHost.querySelector('.kpi-klappe .kpi-value');
      if (kachelWert) kachelWert.textContent = money(Math.round(frisch.gesamtProMonat));
    };

    for (const p2 of l.posten) {
      const original = auto().laufend.find(x => x.id === p2.id);
      const farbe = KATEGORIEN[p2.kategorie]?.farbe ?? KATEGORIEN.fix.farbe;
      const zeile = el('div', { class: 'auf-zeile', style: `--farbe: ${farbe}` });

      zeile.appendChild(el('span', { class: 'auf-punkt' }));

      const name = el('input', {
        type: 'text', value: p2.art, class: 'auf-name', 'aria-label': 'Bezeichnung',
      });
      name.addEventListener('input', () => { original.art = name.value; store.commit({ silent: true }); });
      name.addEventListener('change', aenderung);
      zeile.appendChild(name);

      const betrag = el('input', {
        type: 'number', min: '0', step: '0.01', value: p2.betrag || '',
        class: 'auf-betrag', 'aria-label': 'Betrag',
      });
      betrag.addEventListener('input', () => {
        original.betrag = runde(betrag.value);
        store.commit({ silent: true });
        neuRechnen();
      });
      betrag.addEventListener('change', aenderung);
      zeile.append(betrag, el('span', { class: 'auf-einheit' }, '€'));

      const rhythmus = el('select', { class: 'auf-rhythmus', 'aria-label': 'Rhythmus' });
      for (const id of RHYTHMUS_IDS) {
        const opt = el('option', { value: id }, RHYTHMEN[id].label);
        if (p2.rhythmus === id) opt.selected = true;
        rhythmus.appendChild(opt);
      }
      rhythmus.addEventListener('change', () => { original.rhythmus = rhythmus.value; aenderung(); });
      zeile.appendChild(rhythmus);

      const kategorie = el('select', { class: 'auf-kategorie', 'aria-label': 'Kategorie' });
      for (const id of KATEGORIE_IDS) {
        const opt = el('option', { value: id }, KATEGORIEN[id].label);
        if (p2.kategorie === id) opt.selected = true;
        kategorie.appendChild(opt);
      }
      kategorie.addEventListener('change', () => { original.kategorie = kategorie.value; aenderung(); });
      zeile.appendChild(kategorie);

      const proMonat = el('strong', { class: 'auf-monat' }, money(p2.proMonat));
      anzeigen.push({ id: p2.id, knoten: proMonat });
      zeile.appendChild(proMonat);

      const weg = el('button', { class: 'icon-btn', type: 'button', title: 'Posten entfernen' }, '×');
      weg.addEventListener('click', () => {
        auto().laufend = auto().laufend.filter(x => x.id !== p2.id);
        aenderung();
      });
      zeile.appendChild(weg);

      liste.appendChild(zeile);
    }

    // Sprit kommt aus dem Tanken-Tab und wird hier nur ausgewiesen.
    if (l.sprit !== null) {
      const zeile = el('div', { class: 'auf-zeile ist-geerbt', style: `--farbe: ${SPRIT_FARBE}` });
      zeile.append(
        el('span', { class: 'auf-punkt' }),
        el('span', { class: 'auf-name auf-name-fest' }, 'Sprit'),
        el('span', { class: 'auf-quelle' }, 'Schnitt aus dem Tanken-Tab'),
        el('strong', { class: 'auf-monat' }, money(l.sprit)),
      );
      liste.appendChild(zeile);
    }

    box.appendChild(liste);

    const fuss = el('div', { class: 'auf-fuss' });
    const neuKnopf = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, '+ Posten');
    neuKnopf.addEventListener('click', () => { auto().laufend.push(createLaufend()); aenderung(); });
    const jahr = el('span', { class: 'auf-jahr' },
      `${money(Math.round(l.gesamtProMonat * 12))} im Jahr`);
    fuss.append(neuKnopf, jahr);
    box.appendChild(fuss);

    box.appendChild(el('p', { class: 'feld-hinweis' },
      'Wird die Versicherung günstiger, trag den neuen Betrag einfach hier ein – '
      + 'die Summe rechnet beim Tippen mit. Diese Posten zählen nicht in die '
      + 'Gesamtkosten unten, sonst stünde die Versicherung doppelt drin.'));

    return box;
  }

  /* ------------------------------ Kosten ------------------------------ */

  function renderKosten(a) {
    clear(kostenHost);
    kostenHost.appendChild(el('div', { class: 'immo-chart-head' }, 'Einzelausgaben'));

    const k = a.kosten;
    if (!k.liste.length) {
      kostenHost.appendChild(el('p', { class: 'empty' }, 'Noch keine Ausgabe erfasst.'));
      return;
    }

    // Verteilung als ein Balken - zeigt auf einen Blick, wo das Geld
    // hingegangen ist, ohne eine eigene Grafik zu brauchen.
    const balken = el('div', { class: 'auto-verteilung' });
    for (const kat of k.proKategorie) {
      balken.appendChild(el('span', {
        class: 'auto-anteil',
        style: `width: ${(kat.betrag / k.gesamt) * 100}%; background: ${kat.farbe}`,
        title: `${kat.label}: ${money(kat.betrag)}`,
      }));
    }
    kostenHost.appendChild(balken);

    const legende = el('div', { class: 'auto-legende' });
    for (const kat of k.proKategorie) {
      const e = el('span', { class: 'auto-legende-eintrag', style: `--farbe: ${kat.farbe}` });
      e.append(
        el('span', { class: 'auto-punkt' }),
        el('span', {}, kat.label),
        el('strong', {}, money(kat.betrag)),
      );
      legende.appendChild(e);
    }
    kostenHost.appendChild(legende);

    const tabelle = el('table', { class: 'tank-tabelle' });
    const kopf = el('tr');
    for (const [t, c] of [['Datum', ''], ['Art der Kosten', ''], ['Kategorie', ''], ['Betrag', 'num'], ['', '']]) {
      kopf.appendChild(el('th', { class: c }, t));
    }
    const thead = el('thead');
    thead.appendChild(kopf);
    tabelle.appendChild(thead);

    const body = el('tbody');
    for (const p of k.liste) {
      const tr = el('tr');

      const feld = (attrs, wert, uebernehmen) => {
        const td = el('td', { class: attrs.class ?? '' });
        const input = el('input', { ...attrs, class: 'tabellen-feld', value: wert });
        input.addEventListener('input', () => { uebernehmen(input.value); store.commit({ silent: true }); });
        input.addEventListener('change', () => { uebernehmen(input.value); aenderung(); });
        td.appendChild(input);
        return td;
      };

      tr.appendChild(feld({ type: 'date', 'aria-label': 'Datum' }, p.datum ?? '',
        v => { p.datum = v; }));
      tr.appendChild(feld({ type: 'text', 'aria-label': 'Art der Kosten' }, p.art ?? '',
        v => { p.art = v; }));

      const katZelle = el('td');
      const wahl = el('select', { class: 'tabellen-feld', 'aria-label': 'Kategorie' });
      for (const id of KATEGORIE_IDS) {
        const opt = el('option', { value: id }, KATEGORIEN[id].label);
        if (p.kategorie === id) opt.selected = true;
        wahl.appendChild(opt);
      }
      wahl.addEventListener('change', () => { p.kategorie = wahl.value; aenderung(); });
      katZelle.appendChild(wahl);
      tr.appendChild(katZelle);

      tr.appendChild(feld({ type: 'number', min: '0', step: '0.01', class: 'num', 'aria-label': 'Betrag' },
        p.betrag || '', v => { p.betrag = runde(v); }));

      const weg = el('td');
      const x = el('button', { class: 'icon-btn', type: 'button', title: 'Eintrag löschen' }, '×');
      x.addEventListener('click', () => {
        auto().kosten = auto().kosten.filter(q => q.id !== p.id);
        aenderung();
      });
      weg.appendChild(x);
      tr.appendChild(weg);
      body.appendChild(tr);
    }
    tabelle.appendChild(body);

    const fuss = el('tfoot');
    const summe = el('tr');
    summe.append(
      el('th', {}, 'Summe'),
      el('th', {}, ''),
      el('th', {}, `${k.liste.length} Posten`),
      el('th', { class: 'num' }, money(k.gesamt)),
      el('th', {}, ''),
    );
    fuss.appendChild(summe);
    tabelle.appendChild(fuss);
    kostenHost.appendChild(tabelle);

    const neu = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, '+ Ausgabe');
    neu.addEventListener('click', () => { auto().kosten.push(createKosten()); aenderung(); });
    kostenHost.appendChild(neu);
  }

  /* ------------------------------ Seite ------------------------------ */

  function feld(host, label, attrs, onChange, einheit) {
    const row = el('label', { class: 'feld' });
    row.appendChild(el('span', { class: 'feld-label' }, label));
    const input = el('input', attrs);
    input.addEventListener('change', () => onChange(input.value));
    const wrap = el('div', { class: 'feld-input' });
    wrap.appendChild(input);
    if (einheit) wrap.appendChild(el('span', { class: 'feld-einheit' }, einheit));
    row.appendChild(wrap);
    host.appendChild(row);
    return input;
  }

  function renderSeite(a) {
    clear(seiteHost);

    seiteHost.appendChild(el('div', { class: 'editor-head' }, 'Fahrzeug'));

    const name = el('input', { type: 'text', value: auto().name, 'aria-label': 'Name' });
    name.addEventListener('input', () => { auto().name = name.value; store.commit({ silent: true }); });
    name.addEventListener('change', aenderung);
    const nameRow = el('label', { class: 'feld feld-breit' });
    nameRow.append(el('span', { class: 'feld-label' }, 'Fahrzeug'), name);
    seiteHost.appendChild(nameRow);

    const paar = el('div', { class: 'auto-paar' });
    for (const [key, label] of [['hsn', 'HSN'], ['tsn', 'TSN']]) {
      const f = el('label', { class: 'feld' });
      f.appendChild(el('span', { class: 'feld-label' }, label));
      const i = el('input', { type: 'text', value: auto()[key] ?? '' });
      i.addEventListener('input', () => { auto()[key] = i.value; store.commit({ silent: true }); });
      i.addEventListener('change', aenderung);
      f.appendChild(i);
      paar.appendChild(f);
    }
    seiteHost.appendChild(paar);

    feld(seiteHost, 'Stand beim Kauf',
      { type: 'number', min: '0', step: '1', value: auto().startKm || '' },
      v => { auto().startKm = Math.round(zahl(v)); aenderung(); }, 'km');

    const quelle = el('label', { class: 'feld feld-breit projekt-schalter' });
    const haken = el('input', { type: 'checkbox' });
    haken.checked = auto().kmQuelle === 'tanken';
    haken.addEventListener('change', () => {
      auto().kmQuelle = haken.checked ? 'tanken' : 'manuell';
      aenderung();
    });
    quelle.append(haken, el('span', {}, 'Kilometerstand aus den Tankfüllungen holen'));
    seiteHost.appendChild(quelle);

    if (auto().kmQuelle === 'tanken') {
      seiteHost.appendChild(el('p', { class: 'feld-hinweis' },
        tank().length
          ? `Höchster Tachostand im Tanken-Tab: ${km(a.km)}.`
          : 'Noch keine Tankfüllung erfasst – solange gilt der Wert von Hand.'));
    } else {
      feld(seiteHost, 'Aktueller Stand',
        { type: 'number', min: '0', step: '1', value: auto().aktuellKm || '' },
        v => { auto().aktuellKm = Math.round(zahl(v)); aenderung(); }, 'km');
    }

    const kauf = el('label', { class: 'feld feld-breit projekt-schalter' });
    const kaufHaken = el('input', { type: 'checkbox' });
    kaufHaken.checked = auto().kaufpreisMitrechnen !== false;
    kaufHaken.addEventListener('change', () => {
      auto().kaufpreisMitrechnen = kaufHaken.checked;
      aenderung();
    });
    kauf.append(kaufHaken, el('span', {}, 'Anschaffung in den Kosten je km mitrechnen'));
    seiteHost.appendChild(kauf);

    /* --- Wartung pflegen --- */

    const kopf = el('div', { class: 'editor-head editor-head-sep' });
    kopf.appendChild(el('h2', {}, 'Wartung'));
    const neu = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, '+ Position');
    neu.addEventListener('click', () => { auto().wartung.push(createWartung()); aenderung(); });
    kopf.appendChild(neu);
    seiteHost.appendChild(kopf);

    const liste = el('div', { class: 'rows' });
    for (const w of auto().wartung) liste.appendChild(wartungZeile(w));
    seiteHost.appendChild(liste);
  }

  function wartungZeile(w) {
    const box = el('div', { class: 'row row-wartung' });

    const teil = el('input', { type: 'text', value: w.teil, class: 'wartung-name', 'aria-label': 'Teil' });
    teil.addEventListener('input', () => { w.teil = teil.value; store.commit({ silent: true }); });
    teil.addEventListener('change', aenderung);

    const weg = el('button', { class: 'link-btn wartung-weg', type: 'button', title: 'Löschen' }, '✕');
    weg.addEventListener('click', () => {
      auto().wartung = auto().wartung.filter(x => x.id !== w.id);
      aenderung();
    });
    box.append(teil, weg);

    const mini = (label, attrs, einheit, onChange) => {
      const f = el('label', { class: 'gym-mini' });
      f.appendChild(el('span', {}, label));
      const i = el('input', attrs);
      i.addEventListener('change', () => onChange(i.value));
      f.append(i, el('span', {}, einheit));
      box.appendChild(f);
    };

    mini('Bei', { type: 'number', min: '0', step: '1', value: w.km ?? '', title: 'Kilometerstand bei der letzten Ausführung' },
      'km', v => { w.km = v === '' ? null : Math.round(zahl(v)); aenderung(); });

    const datumFeld = el('label', { class: 'gym-mini' });
    datumFeld.appendChild(el('span', {}, 'Am'));
    const datum = el('input', { type: 'date', value: w.datum ?? '', title: 'Datum der letzten Ausführung' });
    datum.addEventListener('change', () => { w.datum = datum.value || null; aenderung(); });
    datumFeld.appendChild(datum);
    box.appendChild(datumFeld);

    mini('Alle', { type: 'number', min: '0', step: '1000', value: w.intervallKm ?? '', title: 'Intervall in Kilometern; leer lassen, wenn keins bekannt ist' },
      'km', v => { w.intervallKm = v === '' ? null : Math.round(zahl(v)); aenderung(); });

    mini('Alle', { type: 'number', min: '0', step: '1', max: '20', value: w.intervallJahre ?? '', title: 'Intervall in Jahren' },
      'Jahre', v => { w.intervallJahre = v === '' ? null : Math.round(zahl(v)); aenderung(); });

    return box;
  }

  function renderAll() {
    // Die Spritkosten stehen schon im Tanken-Tab - von dort geholt, statt
    // sie ein zweites Mal pflegen zu lassen.
    const tankWerte = tankAuswerten(tank(), { fixkosten: {} });
    const a = auswerten(auto(), tank(), tankWerte.spritProMonat);
    renderKpis(a);
    renderWartung(a);
    renderKosten(a);
    renderSeite(a);
  }

  return { renderAll };
}
