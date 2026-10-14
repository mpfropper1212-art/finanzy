// Trainingslogger: Sätze erfassen, das letzte Mal direkt daneben sehen und
// einen Vorschlag fürs nächste Gewicht bekommen.

import { el, clear, uid, isoDatum } from './util.js';
import { MUSKELGRUPPEN, MUSKEL_FARBEN } from './gym-daten.js';
import {
  auswerten, letztesMal, vorschlag, saetzeVon, saetzeText, workoutStats,
  bestleistung, formatGewicht, istGefuellt, runde, fortschritt,
} from './gym-logik.js';

const zahl = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

const datumLang = iso => new Date(iso).toLocaleDateString('de-DE', {
  weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
});
const datumKurz = iso => new Date(iso).toLocaleDateString('de-DE', {
  day: '2-digit', month: '2-digit',
});

const heute = () => isoDatum();

export function createWorkout(vorlage = {}) {
  return { id: uid('w'), datum: heute(), notiz: '', saetze: [], ...vorlage };
}

export function createUebung(vorlage = {}) {
  return {
    id: uid('u'), name: 'Neue Übung', geraetId: null, muskel: null,
    zielWdh: 10, steigerung: 2.5, saetzeZiel: 3, pause: 90, ...vorlage,
  };
}

function kachel(label, wert, hint) {
  const box = el('div', { class: 'kpi' });
  box.append(el('span', { class: 'kpi-label' }, label), el('strong', { class: 'kpi-value' }, wert));
  if (hint) box.appendChild(el('span', { class: 'kpi-hint' }, hint));
  return box;
}

function muskelChip(muskel) {
  if (!muskel) return null;
  const farbe = MUSKEL_FARBEN[muskel] ?? '#64748b';
  return el('span', {
    class: 'muskel-chip',
    style: `--muskel: ${farbe}`,
  }, muskel);
}

const kg = v => `${formatGewicht(v)} kg`;

export function createGymView({ kpiHost, aktivHost, verlaufHost, seiteHost, store }) {
  const gym = () => store.data.gym;

  // Welche Übungen im Verlauf aufgeklappt sind - reine Anzeige, gehört
  // nicht in die gespeicherten Daten.
  const offen = new Set();

  // Geführter Modus: einen Satz nach dem anderen, mit Pausenuhr.
  let gefuehrt = true;
  let pauseBis = null;
  let uhr = null;

  function uhrStoppen() {
    if (uhr) clearInterval(uhr);
    uhr = null;
  }

  function aenderung() {
    store.commit({ silent: true });
    renderAll();
  }

  const uebungZu = id => gym().uebungen.find(u => u.id === id) ?? null;
  const geraetZu = id => gym().geraete.find(g => g.id === id) ?? null;

  /* ------------------------------ Kopf ------------------------------ */

  function renderKpis(a) {
    clear(kpiHost);
    const box = el('div', { class: 'kpis' });

    const stats = a.aktiv ? workoutStats(a.aktiv, gym().uebungen) : null;

    box.append(
      kachel('Trainings', String(a.anzahl),
        a.proMonat ? `${a.proMonat} in den letzten 4 Wochen` : 'noch keins abgeschlossen'),
      kachel('Letztes Training',
        a.letztes ? datumKurz(a.letztes.datum) : '–',
        a.letztesVolumen === null
          ? 'noch nichts geloggt'
          : `${formatGewicht(a.letztesVolumen)} kg bewegt`),
      kachel('Gegenüber davor',
        a.trend === null ? '–' : `${a.trend >= 0 ? '+' : '−'}${formatGewicht(Math.abs(a.trend))} kg`,
        a.trend === null ? 'ab dem zweiten Training' : a.trend >= 0 ? 'mehr Volumen' : 'weniger Volumen'),
    );

    if (stats) {
      box.appendChild(kachel('Heute', `${stats.saetze} Sätze`,
        `${stats.uebungen} Übungen · ${formatGewicht(stats.volumen)} kg`));
    }

    kpiHost.appendChild(box);
  }

  /* -------------------------- Laufendes Training -------------------------- */

  function renderAktiv(a) {
    clear(aktivHost);

    if (!a.aktiv) {
      const leer = el('div', { class: 'gym-start' });
      leer.appendChild(el('h2', {}, 'Kein Training offen'));
      leer.appendChild(el('p', { class: 'dash-karte-text' },
        a.letztes
          ? `Zuletzt am ${datumLang(a.letztes.datum)}. Beim Starten siehst du zu jeder Übung, `
            + 'was du damals geschafft hast.'
          : 'Starte dein erstes Training – ab dem zweiten vergleicht die App automatisch.'));

      const knopf = el('button', { class: 'btn btn-primary', type: 'button' }, 'Training starten');
      knopf.addEventListener('click', () => {
        const w = createWorkout();
        gym().workouts.push(w);
        gym().aktivId = w.id;
        aenderung();
      });
      leer.appendChild(knopf);
      aktivHost.appendChild(leer);
      return;
    }

    const w = a.aktiv;
    const kopf = el('div', { class: 'gym-kopf' });
    kopf.appendChild(el('h2', {}, `Training am ${datumLang(w.datum)}`));

    const rechts = el('div', { class: 'gym-kopf-knoepfe' });
    const beenden = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, 'Training beenden');
    beenden.addEventListener('click', () => {
      // Halb ausgefüllte Zeilen würden den Verlauf verfälschen.
      w.saetze = w.saetze.filter(istGefuellt);
      gym().aktivId = null;
      if (!w.saetze.length) gym().workouts = gym().workouts.filter(x => x.id !== w.id);
      aenderung();
    });
    const verwerfen = el('button', { class: 'link-btn', type: 'button' }, 'Verwerfen');
    verwerfen.addEventListener('click', () => {
      if (w.saetze.some(istGefuellt)
        && !window.confirm('Das laufende Training samt aller Sätze löschen?')) return;
      gym().workouts = gym().workouts.filter(x => x.id !== w.id);
      gym().aktivId = null;
      aenderung();
    });
    const modus = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' },
      gefuehrt ? 'Alle Übungen zeigen' : 'Geführt trainieren');
    modus.addEventListener('click', () => {
      gefuehrt = !gefuehrt;
      pauseBis = null;
      uhrStoppen();
      renderAll();
    });
    rechts.append(modus, beenden, verwerfen);
    kopf.appendChild(rechts);
    aktivHost.appendChild(kopf);

    const fort = fortschritt(w, gym().uebungen);
    aktivHost.appendChild(fortschrittsBalken(fort));

    if (gefuehrt && fort.aktuell) {
      aktivHost.appendChild(gefuehrteKarte(w, fort));
      aktivHost.appendChild(restListe(fort));
      aktivHost.appendChild(uebungHinzufuegen(w));
      return;
    }
    if (gefuehrt && fort.durch) {
      aktivHost.appendChild(el('p', { class: 'gym-durch' },
        `Alle ${fort.gesamt} Sätze erledigt. Unten kannst du noch etwas anhängen `
        + 'oder das Training beenden.'));
    }

    const ids = [...new Set(w.saetze.map(s => s.uebungId))].filter(uebungZu);
    ids.forEach((id, i) => aktivHost.appendChild(uebungsBlock(w, uebungZu(id), i + 1)));

    if (!ids.length) {
      aktivHost.appendChild(el('p', { class: 'empty' },
        'Noch keine Übung im Training. Such dir unten eine aus.'));
    }

    aktivHost.appendChild(uebungHinzufuegen(w));
  }


  /* ------------------------ Geführter Modus ------------------------ */

  function fortschrittsBalken(fort) {
    const box = el('div', { class: 'gym-fortschritt' });
    const zeile = el('div', { class: 'gym-fortschritt-text' });
    zeile.append(
      el('span', {}, fort.gesamt
        ? `${fort.fertig} von ${fort.gesamt} Sätzen`
        : 'Noch keine Übung im Training'),
      el('strong', {}, `${fort.prozent} %`),
    );
    const schiene = el('div', { class: 'gym-schiene' });
    schiene.appendChild(el('div', { class: 'gym-schiene-fuellung', style: `width: ${fort.prozent}%` }));
    box.append(zeile, schiene);
    return box;
  }

  // Ein Zahlenfeld mit Minus und Plus daneben. Im Studio will man keine
  // Tastatur aufrufen müssen, um von 45 auf 47,5 zu kommen.
  function stepper(wert, schritt, min, onAenderung, einheit) {
    const box = el('div', { class: 'gym-stepper' });
    const feld = el('input', {
      type: 'number', value: wert, step: String(schritt), min: String(min),
      inputmode: 'decimal', class: 'gym-stepper-feld',
    });
    const setze = v => {
      const neu = Math.max(min, runde(v));
      feld.value = neu;
      onAenderung(neu);
    };
    const minus = el('button', { class: 'gym-stepper-knopf', type: 'button', 'aria-label': 'weniger' }, '−');
    minus.addEventListener('click', () => setze(zahl(feld.value) - schritt));
    const plus = el('button', { class: 'gym-stepper-knopf', type: 'button', 'aria-label': 'mehr' }, '+');
    plus.addEventListener('click', () => setze(zahl(feld.value) + schritt));
    feld.addEventListener('input', () => onAenderung(zahl(feld.value)));

    box.append(minus, feld, plus);
    const wrap = el('div', { class: 'gym-stepper-wrap' });
    wrap.append(box, el('span', { class: 'gym-stepper-einheit' }, einheit));
    return wrap;
  }

  function gefuehrteKarte(w, fort) {
    const a = fort.aktuell;
    const u = a.uebung;
    const farbe = MUSKEL_FARBEN[u.muskel] ?? '#64748b';
    const box = el('section', { class: 'gym-fuehrung', style: `--muskel: ${farbe}` });

    const letzte = letztesMal(gym().workouts, u.id, w.id);
    const v = vorschlag(u, letzte);

    // Beim ersten Satz zählt der Vorschlag, danach das, was eben lag.
    const vorheriger = [...saetzeVon(w, u.id)].reverse().find(istGefuellt);
    const startGewicht = zahl(a.satz.gewicht) || zahl(vorheriger?.gewicht) || zahl(v.gewicht) || 0;
    const startWdh = zahl(a.satz.wdh) || v.wdh || u.zielWdh;
    let gewicht = startGewicht;
    let wdh = startWdh;

    const kopf = el('div', { class: 'gym-fuehrung-kopf' });
    kopf.append(
      el('span', { class: 'gym-fuehrung-zaehler' },
        `Übung ${a.uebungNr} von ${a.uebungGesamt}`),
      el('h2', {}, u.name),
    );
    const unter = el('div', { class: 'gym-uebung-unter' });
    if (u.muskel) unter.appendChild(muskelChip(u.muskel));
    const geraet = geraetZu(u.geraetId);
    if (geraet) unter.appendChild(el('span', { class: 'gym-geraet' }, geraet.name));
    if (unter.childNodes.length) kopf.appendChild(unter);
    box.appendChild(kopf);

    box.appendChild(el('div', { class: 'gym-satz-marke' },
      `Satz ${a.satzNr} von ${a.satzGesamt}`));

    const zielZeile = el('div', { class: 'gym-ziel' });
    zielZeile.append(
      el('span', { class: 'gym-ziel-label' }, 'Vorgabe'),
      el('strong', {}, `${formatGewicht(startGewicht)} kg × ${startWdh}`),
    );
    if (letzte) {
      zielZeile.appendChild(el('span', { class: 'gym-ziel-letzte' },
        `letztes Mal ${saetzeText(letzte.saetze)}`));
    }
    box.appendChild(zielZeile);

    const felder = el('div', { class: 'gym-felder' });
    const spalteG = el('label', { class: 'gym-feld' });
    spalteG.appendChild(el('span', { class: 'gym-feld-label' }, 'Gewicht'));
    spalteG.appendChild(stepper(startGewicht, Math.max(0.5, u.steigerung || 2.5), 0,
      v2 => { gewicht = v2; }, 'kg'));
    const spalteW = el('label', { class: 'gym-feld' });
    spalteW.appendChild(el('span', { class: 'gym-feld-label' }, 'Wiederholungen'));
    spalteW.appendChild(stepper(startWdh, 1, 0, v2 => { wdh = v2; }, 'Wdh.'));
    felder.append(spalteG, spalteW);
    box.appendChild(felder);

    const knoepfe = el('div', { class: 'gym-fuehrung-knoepfe' });
    const fertig = el('button', { class: 'btn btn-primary gym-grossknopf', type: 'button' }, 'Satz geschafft');
    fertig.addEventListener('click', () => {
      if (wdh <= 0) {
        window.alert('Trag erst ein, wie viele Wiederholungen du geschafft hast.');
        return;
      }
      a.satz.gewicht = gewicht;
      a.satz.wdh = wdh;
      // Pause nur, wenn noch etwas kommt.
      const rest = fortschritt(w, gym().uebungen);
      pauseBis = rest.aktuell && u.pause > 0 ? Date.now() + u.pause * 1000 : null;
      aenderung();
    });
    knoepfe.appendChild(fertig);

    const weg = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Satz streichen');
    weg.addEventListener('click', () => {
      w.saetze = w.saetze.filter(x => x.id !== a.satz.id);
      aenderung();
    });
    knoepfe.appendChild(weg);
    box.appendChild(knoepfe);

    if (pauseBis) box.appendChild(pausenUhr(u));

    return box;
  }

  function pausenUhr(u) {
    const box = el('div', { class: 'gym-pause' });
    const text = el('strong', { class: 'gym-pause-zeit' });
    const schiene = el('div', { class: 'gym-schiene' });
    const fuellung = el('div', { class: 'gym-schiene-fuellung' });
    schiene.appendChild(fuellung);

    const gesamt = Math.max(1, u.pause || 90);
    const zeichne = () => {
      const rest = Math.max(0, Math.ceil((pauseBis - Date.now()) / 1000));
      text.textContent = `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`;
      fuellung.style.width = `${Math.min(100, ((gesamt - rest) / gesamt) * 100)}%`;
      if (rest <= 0) {
        uhrStoppen();
        pauseBis = null;
        box.classList.add('ist-vorbei');
        text.textContent = 'Pause vorbei';
      }
    };

    uhrStoppen();
    zeichne();
    uhr = setInterval(zeichne, 250);

    const kopf = el('div', { class: 'gym-pause-kopf' });
    const ueberspringen = el('button', { class: 'link-btn', type: 'button' }, 'Pause überspringen');
    ueberspringen.addEventListener('click', () => {
      uhrStoppen();
      pauseBis = null;
      renderAll();
    });
    kopf.append(el('span', {}, 'Pause'), text, ueberspringen);

    box.append(kopf, schiene);
    return box;
  }

  // Was noch kommt - knapp, damit die große Karte die Aufmerksamkeit behält.
  function restListe(fort) {
    const box = el('div', { class: 'gym-rest' });
    for (const block of fort.bloecke) {
      const zeile = el('div', {
        class: 'gym-rest-zeile'
          + (block.fertig === block.gesamt ? ' ist-fertig' : '')
          + (block.uebung.id === fort.aktuell?.uebung.id ? ' ist-dran' : ''),
        style: `--muskel: ${MUSKEL_FARBEN[block.uebung.muskel] ?? '#64748b'}`,
      });
      zeile.append(
        el('span', { class: 'gym-rest-punkt' }),
        el('span', { class: 'gym-rest-name' }, block.uebung.name),
        el('span', { class: 'gym-rest-zahl' }, `${block.fertig}/${block.gesamt}`),
      );
      box.appendChild(zeile);
    }
    return box;
  }

  function uebungHinzufuegen(w) {
    const zeile = el('div', { class: 'gym-hinzu' });
    const auswahl = el('select', { class: 'slot-wahl' });
    auswahl.appendChild(el('option', { value: '' }, '– Übung hinzufügen –'));

    // Nach Muskelgruppe gruppiert, sonst ist die Liste nicht zu überblicken.
    const nachMuskel = new Map();
    for (const u of gym().uebungen) {
      const m = u.muskel || 'Ohne Zuordnung';
      if (!nachMuskel.has(m)) nachMuskel.set(m, []);
      nachMuskel.get(m).push(u);
    }
    for (const [muskel, liste] of nachMuskel) {
      const gruppe = el('optgroup', { label: muskel });
      for (const u of [...liste].sort((x, y) => x.name.localeCompare(y.name, 'de'))) {
        gruppe.appendChild(el('option', { value: u.id }, u.name));
      }
      auswahl.appendChild(gruppe);
    }

    auswahl.addEventListener('change', () => {
      if (!auswahl.value) return;
      const u = uebungZu(auswahl.value);
      const v = vorschlag(u, letztesMal(gym().workouts, u.id, w.id));
      // Gleich alle geplanten Sätze anlegen - die geführte Ansicht braucht
      // sie, und im Zweifel löscht man einen schneller, als man ihn anlegt.
      for (let i = 0; i < Math.max(1, u.saetzeZiel ?? 3); i++) {
        w.saetze.push({
          id: uid('s'), uebungId: u.id,
          wdh: '', gewicht: v.gewicht === null ? '' : v.gewicht,
        });
      }
      aenderung();
    });

    zeile.appendChild(auswahl);
    return zeile;
  }

  function uebungsBlock(w, u, nummer) {
    // Die Muskelfarbe trägt den ganzen Block, nicht nur das Chip - die Kante
    // links ist das, woran man beim Scrollen Anfang und Ende erkennt.
    const farbe = MUSKEL_FARBEN[u.muskel] ?? '#64748b';
    const box = el('section', { class: 'gym-uebung', style: `--muskel: ${farbe}` });

    const kopf = el('div', { class: 'gym-uebung-kopf' });
    kopf.appendChild(el('span', { class: 'gym-nummer' }, String(nummer)));

    const titel = el('div', { class: 'gym-uebung-titel' });
    titel.appendChild(el('h3', {}, u.name));
    const unten = el('div', { class: 'gym-uebung-unter' });
    if (u.muskel) unten.appendChild(muskelChip(u.muskel));
    const geraet = geraetZu(u.geraetId);
    if (geraet) unten.appendChild(el('span', { class: 'gym-geraet' }, geraet.name));
    if (unten.childNodes.length) titel.appendChild(unten);
    kopf.appendChild(titel);

    const raus = el('button', { class: 'link-btn', type: 'button', title: 'Übung aus dem Training nehmen' }, '✕');
    raus.addEventListener('click', () => {
      w.saetze = w.saetze.filter(s => s.uebungId !== u.id);
      aenderung();
    });
    kopf.appendChild(raus);
    box.appendChild(kopf);

    // Alles unterhalb des Kopfes liegt in einem eigenen Körper, damit der
    // Kopf farblich abgesetzt werden kann.
    const koerper = el('div', { class: 'gym-uebung-koerper' });
    box.appendChild(koerper);

    const letzte = letztesMal(gym().workouts, u.id, w.id);
    const v = vorschlag(u, letzte);

    const vergleich = el('div', { class: 'gym-vergleich' });
    vergleich.appendChild(el('span', { class: 'gym-vergleich-label' }, 'Letztes Mal'));
    vergleich.appendChild(el('span', { class: 'gym-vergleich-wert' },
      letzte ? `${saetzeText(letzte.saetze)} · ${datumKurz(letzte.workout.datum)}` : 'noch nie geloggt'));
    const best = bestleistung(gym().workouts.filter(x => x.id !== w.id), u.id);
    if (best) {
      vergleich.appendChild(el('span', { class: 'gym-vergleich-best' },
        `Bestwert ${kg(best.gewicht)} × ${best.wdh}`));
    }
    koerper.appendChild(vergleich);

    const hinweis = el('div', { class: 'gym-vorschlag' + (v.steigt ? ' ist-steigerung' : '') });
    hinweis.appendChild(el('span', {}, v.text));
    if (!v.neu) {
      const uebernehmen = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Übernehmen');
      uebernehmen.addEventListener('click', () => {
        // Auf alle noch leeren Sätze anwenden; ausgefüllte bleiben, wie sie sind.
        const eigene = saetzeVon(w, u.id);
        const leere = eigene.filter(s => !istGefuellt(s));
        const ziele = leere.length ? leere : [neuerSatz(w, u, v)];
        for (const s of ziele) {
          s.gewicht = v.gewicht ?? '';
          s.wdh = v.wdh;
        }
        aenderung();
      });
      hinweis.appendChild(uebernehmen);
    }
    koerper.appendChild(hinweis);

    const tabelle = el('div', { class: 'gym-saetze' });
    const kopfZeile = el('div', { class: 'gym-satz gym-satz-kopf' });
    kopfZeile.append(
      el('span', {}, 'Satz'),
      el('span', {}, 'Wdh.'),
      el('span', {}, 'Gewicht'),
      el('span', {}, ''),
      el('span', {}, ''),
    );
    tabelle.appendChild(kopfZeile);

    const eigene = saetzeVon(w, u.id);
    eigene.forEach((s, i) => {
      const zeile = el('div', { class: 'gym-satz' });
      zeile.appendChild(el('span', { class: 'gym-satz-nr' }, String(i + 1)));

      const wdh = el('input', {
        type: 'number', min: '0', step: '1', inputmode: 'numeric',
        value: s.wdh, 'aria-label': `Wiederholungen Satz ${i + 1}`,
      });
      wdh.addEventListener('input', () => { s.wdh = wdh.value; store.commit({ silent: true }); });
      // Erst beim Verlassen neu zeichnen, sonst springt der Fokus beim Tippen.
      wdh.addEventListener('change', aenderung);
      zeile.appendChild(wdh);

      const gewicht = el('input', {
        type: 'number', min: '0', step: '0.25', inputmode: 'decimal',
        value: s.gewicht, 'aria-label': `Gewicht Satz ${i + 1}`,
      });
      gewicht.addEventListener('input', () => { s.gewicht = gewicht.value; store.commit({ silent: true }); });
      gewicht.addEventListener('change', aenderung);
      zeile.appendChild(gewicht);

      // Der Satz von letztem Mal an derselben Stelle - der direkte Vergleich,
      // ohne nachschlagen zu müssen.
      const davor = letzte?.saetze[i] ?? null;
      zeile.appendChild(el('span', { class: 'gym-satz-davor' },
        davor ? `${zahl(davor.wdh)} × ${kg(davor.gewicht)}` : ''));

      const weg = el('button', { class: 'link-btn', type: 'button', title: 'Satz löschen' }, '✕');
      weg.addEventListener('click', () => {
        w.saetze = w.saetze.filter(x => x.id !== s.id);
        aenderung();
      });
      zeile.appendChild(weg);
      tabelle.appendChild(zeile);
    });

    koerper.appendChild(tabelle);

    const plus = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, '+ Satz');
    plus.addEventListener('click', () => { neuerSatz(w, u, v); aenderung(); });
    koerper.appendChild(plus);

    return box;
  }

  // Ein neuer Satz übernimmt den vorherigen Satz derselben Übung, sonst den
  // Vorschlag - so tippt man im Normalfall gar nichts.
  function neuerSatz(w, u, v) {
    const eigene = saetzeVon(w, u.id);
    const letzterEigener = [...eigene].reverse().find(istGefuellt);
    const satz = {
      id: uid('s'),
      uebungId: u.id,
      wdh: letzterEigener ? letzterEigener.wdh : v.wdh,
      gewicht: letzterEigener ? letzterEigener.gewicht : (v.gewicht ?? ''),
    };
    w.saetze.push(satz);
    return satz;
  }

  /* ----------------------------- Verlauf ----------------------------- */

  function renderVerlauf(a) {
    clear(verlaufHost);
    verlaufHost.appendChild(el('div', { class: 'immo-chart-head' }, 'Vergangene Trainings'));

    if (!a.fertige.length) {
      verlaufHost.appendChild(el('p', { class: 'empty' },
        'Hier stehen deine abgeschlossenen Trainings, sobald du eins beendet hast.'));
      return;
    }

    for (const w of a.fertige.slice(0, 30)) {
      const stats = workoutStats(w, gym().uebungen);
      const block = el('details', { class: 'gym-verlauf-eintrag' });
      if (offen.has(w.id)) block.open = true;
      block.addEventListener('toggle', () => {
        if (block.open) offen.add(w.id);
        else offen.delete(w.id);
      });

      const zusammen = el('summary');
      zusammen.append(
        el('strong', {}, datumLang(w.datum)),
        el('span', { class: 'gym-verlauf-zahl' },
          `${stats.uebungen} Übungen · ${stats.saetze} Sätze · ${formatGewicht(stats.volumen)} kg`),
      );
      block.appendChild(zusammen);

      const muskeln = el('div', { class: 'gym-muskeln' });
      for (const m of stats.proMuskel) {
        const chip = muskelChip(m.muskel === 'Ohne Zuordnung' ? null : m.muskel);
        muskeln.appendChild(chip ?? el('span', { class: 'gym-geraet' }, m.muskel));
      }
      block.appendChild(muskeln);

      const ids = [...new Set(w.saetze.filter(istGefuellt).map(s => s.uebungId))];
      for (const id of ids) {
        const u = uebungZu(id);
        const zeile = el('div', { class: 'gym-verlauf-zeile' });
        zeile.append(
          el('span', { class: 'gym-verlauf-name' }, u ? u.name : 'Gelöschte Übung'),
          el('span', { class: 'gym-verlauf-saetze' }, saetzeText(saetzeVon(w, id))),
        );
        block.appendChild(zeile);
      }

      if (w.notiz) block.appendChild(el('p', { class: 'feld-hinweis' }, w.notiz));

      const weg = el('button', { class: 'link-btn', type: 'button' }, 'Training löschen');
      weg.addEventListener('click', () => {
        if (!window.confirm(`Training vom ${datumLang(w.datum)} löschen?`)) return;
        gym().workouts = gym().workouts.filter(x => x.id !== w.id);
        aenderung();
      });
      block.appendChild(weg);

      verlaufHost.appendChild(block);
    }
  }

  /* --------------------- Übungen und Geräte pflegen --------------------- */

  function renderSeite() {
    clear(seiteHost);

    const kopf = el('div', { class: 'editor-head' });
    kopf.appendChild(el('h2', {}, 'Übungen'));
    const neu = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, '+ Übung');
    neu.addEventListener('click', () => {
      gym().uebungen.push(createUebung());
      aenderung();
      seiteHost.querySelector('.rows input')?.focus();
    });
    kopf.appendChild(neu);
    seiteHost.appendChild(kopf);

    const liste = el('div', { class: 'rows' });
    const sortiert = [...gym().uebungen].sort((a, b) =>
      (a.muskel ?? 'zzz').localeCompare(b.muskel ?? 'zzz', 'de') || a.name.localeCompare(b.name, 'de'));
    for (const u of sortiert) liste.appendChild(uebungZeile(u));
    seiteHost.appendChild(liste);

    const kopf2 = el('div', { class: 'editor-head editor-head-sep' });
    kopf2.appendChild(el('h2', {}, 'Geräte'));
    const neuG = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, '+ Gerät');
    neuG.addEventListener('click', () => {
      gym().geraete.push({ id: uid('g'), name: 'Neues Gerät' });
      aenderung();
    });
    kopf2.appendChild(neuG);
    seiteHost.appendChild(kopf2);

    const listeG = el('div', { class: 'rows' });
    for (const g of [...gym().geraete].sort((a, b) => a.name.localeCompare(b.name, 'de'))) {
      listeG.appendChild(geraetZeile(g));
    }
    seiteHost.appendChild(listeG);
  }

  function uebungZeile(u) {
    const box = el('div', { class: 'row row-gym' });

    const weg = el('button', {
      class: 'link-btn gym-weg', type: 'button', title: 'Übung löschen',
    }, '✕');
    weg.addEventListener('click', () => {
      // Geloggte Sätze hängen an der Übung. Sie stillschweigend mitzulöschen
      // wäre der unangenehmste denkbare Datenverlust.
      const benutzt = gym().workouts.reduce(
        (s, w) => s + saetzeVon(w, u.id).filter(istGefuellt).length, 0);
      if (benutzt) {
        window.alert(
          `„${u.name}" steckt in ${benutzt} geloggten Sätzen und lässt sich deshalb nicht löschen. `
          + 'Du kannst sie aber umbenennen.');
        return;
      }
      gym().uebungen = gym().uebungen.filter(x => x.id !== u.id);
      aenderung();
    });

    const name = el('input', {
      type: 'text', value: u.name, class: 'gym-name', 'aria-label': 'Name der Übung',
    });
    name.addEventListener('input', () => { u.name = name.value; store.commit({ silent: true }); });
    name.addEventListener('change', aenderung);
    box.append(name, weg);

    const geraet = el('select', { 'aria-label': 'Gerät' });
    geraet.appendChild(el('option', { value: '' }, 'ohne Gerät'));
    for (const g of [...gym().geraete].sort((a, b) => a.name.localeCompare(b.name, 'de'))) {
      const opt = el('option', { value: g.id }, g.name);
      if (u.geraetId === g.id) opt.selected = true;
      geraet.appendChild(opt);
    }
    geraet.addEventListener('change', () => { u.geraetId = geraet.value || null; aenderung(); });
    box.appendChild(geraet);

    const muskel = el('select', { 'aria-label': 'Muskelgruppe' });
    muskel.appendChild(el('option', { value: '' }, 'ohne Gruppe'));
    for (const m of MUSKELGRUPPEN) {
      const opt = el('option', { value: m }, m);
      if (u.muskel === m) opt.selected = true;
      muskel.appendChild(opt);
    }
    muskel.addEventListener('change', () => { u.muskel = muskel.value || null; aenderung(); });
    box.appendChild(muskel);

    const mini = (label, attrs, einheit, onChange) => {
      const feld = el('label', { class: 'gym-mini' });
      feld.appendChild(el('span', {}, label));
      const input = el('input', attrs);
      input.addEventListener('change', () => onChange(input.value));
      feld.append(input, el('span', {}, einheit));
      box.appendChild(feld);
    };

    mini('Ziel', {
      type: 'number', min: '1', max: '50', step: '1', value: u.zielWdh,
      title: 'Ab so vielen Wiederholungen je Satz wird gesteigert',
    }, 'Wdh.', v => { u.zielWdh = Math.max(1, zahl(v) || 10); aenderung(); });

    mini('Stufe', {
      type: 'number', min: '0', max: '20', step: '0.25', value: u.steigerung,
      title: 'Kleinste Gewichtsstufe an diesem Gerät; 0 heißt ohne Zusatzgewicht',
    }, 'kg', v => { u.steigerung = Math.max(0, runde(v)); aenderung(); });

    mini('Sätze', {
      type: 'number', min: '1', max: '10', step: '1', value: u.saetzeZiel ?? 3,
      title: 'So viele Sätze legt die App beim Hinzufügen an',
    }, 'je Übung', v => { u.saetzeZiel = Math.min(10, Math.max(1, zahl(v) || 3)); aenderung(); });

    mini('Pause', {
      type: 'number', min: '0', max: '600', step: '15', value: u.pause ?? 90,
      title: 'Pausenuhr nach jedem Satz; 0 schaltet sie ab',
    }, 'Sek.', v => { u.pause = Math.min(600, Math.max(0, zahl(v))); aenderung(); });

    return box;
  }

  function geraetZeile(g) {
    const box = el('div', { class: 'row row-geraet' });
    const name = el('input', { type: 'text', value: g.name, 'aria-label': 'Name des Geräts' });
    name.addEventListener('input', () => { g.name = name.value; store.commit({ silent: true }); });
    name.addEventListener('change', aenderung);
    box.appendChild(name);

    const anzahl = gym().uebungen.filter(u => u.geraetId === g.id).length;
    box.appendChild(el('span', { class: 'gym-geraet-zahl' },
      anzahl === 1 ? '1 Übung' : `${anzahl} Übungen`));

    const weg = el('button', { class: 'link-btn', type: 'button', title: 'Gerät löschen' }, '✕');
    weg.addEventListener('click', () => {
      // Die Übungen bleiben, sie verlieren nur die Gerätezuordnung.
      for (const u of gym().uebungen) if (u.geraetId === g.id) u.geraetId = null;
      gym().geraete = gym().geraete.filter(x => x.id !== g.id);
      aenderung();
    });
    box.appendChild(weg);
    return box;
  }

  function renderAll() {
    uhrStoppen();
    const a = auswerten(gym());
    renderKpis(a);
    renderAktiv(a);
    renderVerlauf(a);
    renderSeite();
  }

  return { renderAll };
}
