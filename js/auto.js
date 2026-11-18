// Auto: Stammdaten, Kostenliste und Wartungsplan.

import { el, clear, money } from './util.js';
import { KATEGORIEN, KATEGORIE_IDS, RHYTHMEN, RHYTHMUS_IDS,
  ADAC_PAUSCHALEN } from './auto-daten.js';
import {
  auswerten, laufendAuswerten, vollkosten, createKosten, createWartung,
  createLaufend, createKmStand, WARTUNG_STATUS, runde,
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
      kachel('Kilometer je Monat',
        a.verlauf.proMonat === null ? '–' : km(Math.round(a.verlauf.proMonat)),
        a.verlauf.proJahr === null
          ? 'zwei Ablesungen nötig'
          : `${km(a.verlauf.proJahr)} im Jahr`),
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
      el('span', { class: 'kpi-label' }, 'Kostet im Monat'),
      el('strong', { class: 'kpi-value' }, money(Math.round(a.voll.gesamt))),
      el('span', { class: 'kpi-hint' },
        a.voll.fehlt.includes('restwert')
          ? 'Ohne Wertverlust – antippen und ergänzen'
          : (offen ? 'Zum Zuklappen tippen' : 'Antippen: woraus sich das zusammensetzt')),
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

  function aufschluesselung(a) {
    const v = a.voll;
    const box = el('section', { class: 'auf' });

    const kopf = el('div', { class: 'auf-kopf' });
    kopf.append(
      el('h3', {}, 'Was dein Auto im Monat kostet'),
      el('strong', { class: 'auf-summe' }, `${money(v.gesamt)} / Monat`),
    );
    box.appendChild(kopf);

    if (v.bloecke.length) {
      const balken = el('div', { class: 'auf-balken' });
      for (const b of v.bloecke) {
        balken.appendChild(el('span', {
          class: 'auf-anteil',
          style: `width: ${(b.wert / v.gesamt) * 100}%; background: ${b.farbe}`,
          title: `${b.label}: ${money(b.wert)} je Monat`,
        }));
      }
      box.appendChild(balken);
    }

    // Fehlt der Restwert, fehlt meist der größte Posten überhaupt.
    if (v.fehlt.includes('restwert')) {
      box.appendChild(el('p', { class: 'auf-warnung' },
        'Der Wertverlust fehlt noch. Schätz unten, was dein Auto heute noch wert '
        + 'wäre – bei den meisten Autos ist das der größte Einzelposten.'));
    }

    const liste = el('div', { class: 'auf-bloecke' });
    for (const b of v.bloecke) {
      const zeile = el('div', { class: 'auf-block', style: `--farbe: ${b.farbe}` });
      zeile.append(
        el('span', { class: 'auf-punkt' }),
        el('span', { class: 'auf-block-name' }, b.label),
        el('span', { class: 'auf-block-anteil' }, `${Math.round((b.wert / v.gesamt) * 100)} %`),
        el('strong', { class: 'auf-monat' }, money(b.wert)),
      );
      liste.appendChild(zeile);
    }
    box.appendChild(liste);

    box.appendChild(el('div', { class: 'auf-jahr-zeile' },
      `Macht ${money(Math.round(v.proJahr))} im Jahr`));

    box.appendChild(stellschrauben(a));
    box.appendChild(festePosten(a));

    box.appendChild(el('p', { class: 'feld-hinweis' },
      'Die Kostenarten folgen der ADAC-Autokostenberechnung (Grundlagen 10/2026). '
      + 'Wertverlust und Werkstattrücklage rechnet die App aber aus deinen eigenen '
      + 'Zahlen – die ADAC-Werte gelten für Neuwagen über fünf Jahre.'));

    return box;
  }

  /* --------------------------- Stellschrauben --------------------------- */

  function stellschrauben(a) {
    const v = a.voll;
    const vk = () => auto().vollkosten;
    const box = el('details', { class: 'auf-regler' });
    box.open = true;
    box.appendChild(el('summary', {}, 'Woraus die geschätzten Posten kommen'));

    /* Wertverlust */
    const wert = el('div', { class: 'auf-regler-zeile' });
    wert.appendChild(el('span', { class: 'auf-regler-name' }, 'Was wäre es heute noch wert?'));
    const restwert = el('input', {
      type: 'number', min: '0', step: '50', class: 'auf-betrag',
      value: v.restwert ?? '', placeholder: 'schätzen',
      'aria-label': 'Geschätzter heutiger Wert',
    });
    restwert.addEventListener('change', () => {
      vk().restwert = restwert.value === '' ? null : runde(restwert.value);
      aenderung();
    });
    wert.append(restwert, el('span', { class: 'auf-einheit' }, '€'));
    wert.appendChild(el('span', { class: 'auf-regler-folge' },
      v.wertverlust === null
        ? `Kaufpreis war ${money(v.kaufpreis)}`
        : `${money(v.verlustGesamt)} Verlust in ${Math.round(v.monate)} Monaten`));
    box.appendChild(wert);

    /* Werkstattrücklage */
    const werk = el('div', { class: 'auf-regler-zeile' });
    werk.appendChild(el('span', { class: 'auf-regler-name' }, 'Werkstattrücklage'));
    const quelle = el('select', { class: 'auf-rhythmus', 'aria-label': 'Grundlage' });
    for (const [id, label] of [['historie', 'aus deiner Historie'], ['manuell', 'selbst festlegen']]) {
      const opt = el('option', { value: id }, label);
      if (vk().werkstattQuelle === id) opt.selected = true;
      quelle.appendChild(opt);
    }
    quelle.addEventListener('change', () => { vk().werkstattQuelle = quelle.value; aenderung(); });
    werk.appendChild(quelle);

    if (vk().werkstattQuelle === 'manuell') {
      const betrag = el('input', {
        type: 'number', min: '0', step: '5', class: 'auf-betrag',
        value: vk().werkstattProMonat || '', 'aria-label': 'Rücklage je Monat',
      });
      betrag.addEventListener('change', () => {
        vk().werkstattProMonat = runde(betrag.value);
        aenderung();
      });
      werk.append(betrag, el('span', { class: 'auf-einheit' }, '€'));
    } else {
      werk.appendChild(el('span', { class: 'auf-regler-folge' },
        v.werkstattVorschlag === null
          ? 'noch zu wenig Historie'
          : `${money(v.werkstattHistorie)} für Wartung und Reparatur bisher`));
    }
    box.appendChild(werk);

    /* Pauschalen */
    const pausch = el('label', { class: 'auf-regler-zeile auf-regler-haken' });
    const haken = el('input', { type: 'checkbox' });
    haken.checked = vk().pauschalenAn !== false;
    haken.addEventListener('change', () => { vk().pauschalenAn = haken.checked; aenderung(); });
    pausch.append(haken, el('span', { class: 'auf-regler-name' },
      'Pauschalen für Pflege und Kleinkram'));
    pausch.appendChild(el('span', { class: 'auf-regler-folge' },
      `${money(ADAC_PAUSCHALEN.allgemein.proJahr)} ${ADAC_PAUSCHALEN.allgemein.text}, `
      + `${money(ADAC_PAUSCHALEN.pflege.proJahr)} ${ADAC_PAUSCHALEN.pflege.text} – je Jahr, nach ADAC`));
    box.appendChild(pausch);

    /* Zinsen */
    const zins = el('div', { class: 'auf-regler-zeile' });
    zins.appendChild(el('span', { class: 'auf-regler-name' }, 'Entgangene Zinsen'));
    const satz = el('input', {
      type: 'number', min: '0', max: '20', step: '0.5', class: 'auf-betrag',
      value: vk().zinssatz || '', placeholder: '0',
      'aria-label': 'Zinssatz in Prozent',
    });
    satz.addEventListener('change', () => { vk().zinssatz = runde(satz.value); aenderung(); });
    zins.append(satz, el('span', { class: 'auf-einheit' }, '%'));
    zins.appendChild(el('span', { class: 'auf-regler-folge' },
      'Der ADAC lässt das weg, empfiehlt es aber, wenn das Geld aus Erspartem kam. 0 schaltet es ab.'));
    box.appendChild(zins);

    return box;
  }

  /* ------------------------- Feste laufende Posten ------------------------- */

  function festePosten(a) {
    const l = a.laufend;
    const box = el('details', { class: 'auf-regler' });
    box.appendChild(el('summary', {},
      `Versicherung, Steuer & Co. im Einzelnen (${money(l.proMonat)} je Monat)`));

    const anzeigen = [];
    const neuRechnen = () => {
      const frisch = laufendAuswerten(auto(), l.sprit);
      for (const { id, knoten } of anzeigen) {
        const posten = frisch.posten.find(x => x.id === id);
        if (posten) knoten.textContent = money(posten.proMonat);
      }
      box.querySelector('summary').textContent =
        `Versicherung, Steuer & Co. im Einzelnen (${money(frisch.proMonat)} je Monat)`;

      // Kachel und Gesamtsumme haengen mit dran - sonst stehen drei
      // verschiedene Zahlen auf einer Seite.
      const neuVoll = vollkosten(auto(), { spritProMonat: l.sprit, monate: a.kosten.monate });
      const summe = kpiHost.querySelector('.auf-summe');
      if (summe) summe.textContent = `${money(neuVoll.gesamt)} / Monat`;
      const jahr = kpiHost.querySelector('.auf-jahr-zeile');
      if (jahr) jahr.textContent = `Macht ${money(Math.round(neuVoll.proJahr))} im Jahr`;
      const kachelWert = kpiHost.querySelector('.kpi-klappe .kpi-value');
      if (kachelWert) kachelWert.textContent = money(Math.round(neuVoll.gesamt));
    };

    for (const p2 of l.posten) {
      const original = auto().laufend.find(x => x.id === p2.id);
      const farbe = KATEGORIEN[p2.kategorie]?.farbe ?? KATEGORIEN.fix.farbe;
      const zeile = el('div', { class: 'auf-zeile', style: `--farbe: ${farbe}` });

      zeile.appendChild(el('span', { class: 'auf-punkt' }));

      const name = el('input', { type: 'text', value: p2.art, class: 'auf-name', 'aria-label': 'Bezeichnung' });
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

      const proMonat = el('strong', { class: 'auf-monat' }, money(p2.proMonat));
      anzeigen.push({ id: p2.id, knoten: proMonat });
      zeile.appendChild(proMonat);

      const weg = el('button', { class: 'icon-btn', type: 'button', title: 'Posten entfernen' }, '×');
      weg.addEventListener('click', () => {
        auto().laufend = auto().laufend.filter(x => x.id !== p2.id);
        aenderung();
      });
      zeile.appendChild(weg);

      box.appendChild(zeile);
    }

    const neuKnopf = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, '+ Posten');
    neuKnopf.addEventListener('click', () => { auto().laufend.push(createLaufend()); aenderung(); });
    box.appendChild(neuKnopf);

    return box;
  }

  /* --------------------------- Kilometerstände --------------------------- */

  function renderKm(a) {
    const v = a.verlauf;
    const box = el('section', { class: 'kmlog' });
    box.appendChild(el('div', { class: 'immo-chart-head' }, 'Kilometerstände'));

    if (!v.liste.length) {
      box.appendChild(el('p', { class: 'empty' },
        'Noch keine Ablesung. Rechts eintragen – Tachostände aus dem Tanken-Tab '
        + 'zählen automatisch mit.'));
      return box;
    }

    box.appendChild(el('p', { class: 'feld-hinweis' },
      v.proMonat === null
        ? 'Ab der zweiten Ablesung rechnet die App, wie viel du im Monat fährst.'
        : `${km(Math.round(v.proMonat))} im Monat über ${v.gesamtTage} Tage. `
          + (v.letzteProMonat !== null && Math.abs(v.letzteProMonat - v.proMonat) > 20
            ? `Im letzten Jahr waren es ${km(Math.round(v.letzteProMonat))}.`
            : '')));

    const liste = el('div', { class: 'kmlog-liste' });
    // Neueste zuerst - danach schaut man.
    for (const p2 of [...v.liste].reverse().slice(0, 14)) {
      const zeile = el('div', { class: 'kmlog-zeile' + (p2.quelle === 'eigen' ? ' ist-eigen' : '') });
      const abschnitt = v.abschnitte.find(x => x.datum === p2.datum);
      zeile.append(
        el('span', { class: 'kmlog-datum' }, lang(p2.datum)),
        el('strong', { class: 'kmlog-km' }, km(p2.km)),
        el('span', { class: 'kmlog-delta' },
          abschnitt ? `+${km(abschnitt.strecke)} in ${abschnitt.tage} Tagen` : 'erste Ablesung'),
        el('span', { class: 'kmlog-quelle' },
          p2.quelle === 'eigen' ? 'abgelesen' : 'getankt'),
      );
      liste.appendChild(zeile);
    }
    box.appendChild(liste);

    if (v.liste.length > 14) {
      box.appendChild(el('p', { class: 'feld-hinweis' },
        `${v.liste.length - 14} ältere Ablesungen nicht gezeigt.`));
    }
    return box;
  }

  /* ------------------------------ Kosten ------------------------------ */

  function renderKosten(a) {
    clear(kostenHost);
    kostenHost.appendChild(renderKm(a));
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

    /* --- Kilometerstände --- */

    const kmKopf = el('div', { class: 'editor-head editor-head-sep' });
    kmKopf.appendChild(el('h2', {}, 'Kilometerstände'));
    const kmNeu = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, '+ Ablesung');
    kmNeu.addEventListener('click', () => {
      // Mit dem letzten bekannten Stand vorbelegen - man tippt dann nur die
      // Differenz, statt die ganze Zahl neu zu schreiben.
      auto().kmStaende.push(createKmStand({ km: a.verlauf.hoechster ?? auto().aktuellKm ?? 0 }));
      aenderung();
    });
    kmKopf.appendChild(kmNeu);
    seiteHost.appendChild(kmKopf);

    const kmListe = el('div', { class: 'rows' });
    for (const st of [...auto().kmStaende].sort((x, y) => y.datum.localeCompare(x.datum))) {
      kmListe.appendChild(kmZeile(st));
    }
    if (!auto().kmStaende.length) {
      kmListe.appendChild(el('p', { class: 'feld-hinweis' },
        'Tachostände aus dem Tanken-Tab zählen schon mit. Hier trägst du '
        + 'Ablesungen ein, die nicht an einer Tankfüllung hängen.'));
    }
    seiteHost.appendChild(kmListe);

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

  function kmZeile(st) {
    const box = el('div', { class: 'row row-km' });

    const datum = el('input', { type: 'date', value: st.datum, 'aria-label': 'Datum' });
    datum.addEventListener('change', () => { st.datum = datum.value || st.datum; aenderung(); });

    const stand = el('input', {
      type: 'number', min: '0', step: '1', value: st.km || '', 'aria-label': 'Kilometerstand',
    });
    stand.addEventListener('change', () => { st.km = Math.max(0, Math.round(zahl(stand.value))); aenderung(); });

    const weg = el('button', { class: 'link-btn', type: 'button', title: 'Löschen' }, '✕');
    weg.addEventListener('click', () => {
      auto().kmStaende = auto().kmStaende.filter(x => x.id !== st.id);
      aenderung();
    });

    box.append(datum, stand, el('span', { class: 'auf-einheit' }, 'km'), weg);
    return box;
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
