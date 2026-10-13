// Gruppenkasse: gemeinsame Ausgaben einer Reise oder WG und am Ende die
// Frage, wer wem wie viel zurückzahlt - mit möglichst wenigen Zahlungen.

import { el, clear, money, uid } from './util.js';

export function createGruppe(name = 'Neue Gruppe') {
  const ich = { id: uid('p'), name: 'Ich' };
  return {
    id: uid('gr'),
    name,
    ichId: ich.id,
    personen: [ich],
    ausgaben: [],
  };
}

export function createAusgabe(gruppe, vorlage = {}) {
  return {
    id: uid('a'),
    titel: '',
    betrag: 0,
    zahlerId: gruppe.ichId ?? gruppe.personen[0]?.id ?? '',
    beteiligte: gruppe.personen.map(p => p.id),
    datum: new Date().toISOString().slice(0, 10),
    ...vorlage,
  };
}

// Wer hat gezahlt, wer hat verbraucht, und was bleibt als Saldo.
export function salden(gruppe) {
  const gezahlt = new Map(gruppe.personen.map(p => [p.id, 0]));
  const anteil = new Map(gruppe.personen.map(p => [p.id, 0]));

  for (const a of gruppe.ausgaben) {
    const betrag = Number(a.betrag) || 0;
    const teilnehmer = (a.beteiligte ?? []).filter(id => gezahlt.has(id));
    if (!betrag || !teilnehmer.length) continue;

    if (gezahlt.has(a.zahlerId)) gezahlt.set(a.zahlerId, gezahlt.get(a.zahlerId) + betrag);
    const proKopf = betrag / teilnehmer.length;
    for (const id of teilnehmer) anteil.set(id, anteil.get(id) + proKopf);
  }

  return gruppe.personen.map(p => ({
    ...p,
    gezahlt: gezahlt.get(p.id),
    anteil: anteil.get(p.id),
    saldo: gezahlt.get(p.id) - anteil.get(p.id),
  }));
}

// Immer den größten Schuldner gegen den größten Gläubiger stellen. Das
// erzeugt die kleinstmögliche Zahl an Überweisungen für diese Salden.
export function ausgleich(liste) {
  const schuldner = liste
    .filter(s => s.saldo < -0.005)
    .map(s => ({ name: s.name, id: s.id, rest: -s.saldo }))
    .sort((a, b) => b.rest - a.rest);
  const glaeubiger = liste
    .filter(s => s.saldo > 0.005)
    .map(s => ({ name: s.name, id: s.id, rest: s.saldo }))
    .sort((a, b) => b.rest - a.rest);

  const zahlungen = [];
  let i = 0;
  let j = 0;
  while (i < schuldner.length && j < glaeubiger.length) {
    const betrag = Math.min(schuldner[i].rest, glaeubiger[j].rest);
    if (betrag > 0.005) {
      zahlungen.push({
        vonId: schuldner[i].id,
        anId: glaeubiger[j].id,
        von: schuldner[i].name,
        an: glaeubiger[j].name,
        betrag: Math.round(betrag * 100) / 100,
      });
    }
    schuldner[i].rest -= betrag;
    glaeubiger[j].rest -= betrag;
    if (schuldner[i].rest <= 0.005) i++;
    if (glaeubiger[j].rest <= 0.005) j++;
  }
  return zahlungen;
}

const datumKurz = iso => (iso
  ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '–');

export function createGruppenView({ kopfHost, listeHost, seiteHost, store }) {
  const alle = () => store.data.gruppen.items;
  const aktiv = () => alle().find(g => g.id === store.data.gruppen.activeId) ?? alle()[0] ?? null;
  let entwurf = null;

  function aenderung() {
    store.commit({ silent: true });
    renderAll();
  }

  const nameVon = (gruppe, id) => gruppe.personen.find(p => p.id === id)?.name ?? '?';

  /* ------------------------- Kopf und Ausgleich ------------------------- */

  function renderKopf() {
    clear(kopfHost);

    const leiste = el('div', { class: 'gruppen-leiste' });
    for (const g of alle()) {
      const chip = el('button', {
        type: 'button',
        class: 'obj-chip' + (g.id === aktiv()?.id ? ' is-active' : ''),
      }, g.name || 'Ohne Namen');
      chip.addEventListener('click', () => {
        store.data.gruppen.activeId = g.id;
        aenderung();
      });
      leiste.appendChild(chip);
    }
    const neu = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, '+ Gruppe');
    neu.addEventListener('click', () => {
      const g = createGruppe(`Gruppe ${alle().length + 1}`);
      alle().push(g);
      store.data.gruppen.activeId = g.id;
      aenderung();
    });
    leiste.appendChild(neu);
    kopfHost.appendChild(leiste);

    const gruppe = aktiv();
    if (!gruppe) {
      kopfHost.appendChild(el('p', { class: 'empty' }, 'Lege eine Gruppe an, zum Beispiel „Mallorca".'));
      return;
    }

    const titel = el('input', { class: 'title-input', type: 'text', value: gruppe.name, placeholder: 'Name der Gruppe' });
    titel.addEventListener('input', () => {
      gruppe.name = titel.value;
      store.commit({ silent: true });
      for (const chip of leiste.querySelectorAll('.obj-chip.is-active')) chip.textContent = titel.value;
    });
    kopfHost.appendChild(titel);

    const liste = salden(gruppe);
    const gesamt = gruppe.ausgaben.reduce((s, a) => s + (Number(a.betrag) || 0), 0);
    const ich = liste.find(p => p.id === gruppe.ichId);

    const zahlen = el('div', { class: 'gruppe-zahlen' });
    const posten = (label, wert, klasse = '') => {
      const box = el('div', { class: `gruppe-posten ${klasse}` });
      box.append(el('span', { class: 'schuld-label' }, label), el('strong', {}, wert));
      return box;
    };
    zahlen.append(
      posten('Ausgaben gesamt', money(Math.round(gesamt * 100) / 100)),
      posten('Pro Person im Schnitt',
        money(Math.round((gesamt / Math.max(1, gruppe.personen.length)) * 100) / 100)),
    );
    if (ich) {
      zahlen.appendChild(posten(
        ich.saldo < 0 ? 'Du musst zahlen' : 'Du bekommst zurück',
        money(Math.round(Math.abs(ich.saldo) * 100) / 100),
        ich.saldo < -0.005 ? 'ist-minus' : 'ist-plus',
      ));
    }
    kopfHost.appendChild(zahlen);

    // Salden je Person als Balken: links zu wenig gezahlt, rechts zu viel.
    const tabelle = el('div', { class: 'salden' });
    const groesster = Math.max(1, ...liste.map(p => Math.abs(p.saldo)));
    for (const p of liste) {
      const zeile = el('div', { class: 'saldo-zeile' });
      zeile.append(
        el('span', { class: 'saldo-name' }, p.name + (p.id === gruppe.ichId ? ' (du)' : '')),
        el('span', { class: 'saldo-detail' },
          `${money(Math.round(p.gezahlt * 100) / 100)} gezahlt · Anteil ${money(Math.round(p.anteil * 100) / 100)}`),
      );
      const balken = el('span', { class: 'saldo-balken' });
      const fuellung = el('span', {
        class: 'saldo-fuellung' + (p.saldo < 0 ? ' ist-minus' : ' ist-plus'),
        style: `width:${(Math.abs(p.saldo) / groesster) * 50}%;${p.saldo < 0 ? 'right:50%' : 'left:50%'}`,
      });
      balken.appendChild(fuellung);
      zeile.appendChild(balken);
      zeile.appendChild(el('span', {
        class: 'saldo-wert ' + (p.saldo < -0.005 ? 'ist-minus' : p.saldo > 0.005 ? 'ist-plus' : ''),
      }, Math.abs(p.saldo) < 0.005 ? 'ausgeglichen' : money(Math.round(p.saldo * 100) / 100)));
      tabelle.appendChild(zeile);
    }
    kopfHost.appendChild(tabelle);

    const zahlungen = ausgleich(liste);
    const ausgleichBox = el('div', { class: 'ausgleich' });
    ausgleichBox.appendChild(el('h3', {}, 'So wird ausgeglichen'));
    if (!zahlungen.length) {
      ausgleichBox.appendChild(el('p', { class: 'feld-hinweis' },
        gruppe.ausgaben.length ? 'Alles ausgeglichen.' : 'Noch keine Ausgaben eingetragen.'));
    } else {
      for (const z of zahlungen) {
        const zeile = el('div', { class: 'ausgleich-zeile' });
        zeile.append(
          el('span', {}, z.von),
          el('span', { class: 'ausgleich-pfeil' }, '→'),
          el('span', {}, z.an),
          el('strong', {}, money(z.betrag)),
        );
        ausgleichBox.appendChild(zeile);
      }
      ausgleichBox.appendChild(el('p', { class: 'feld-hinweis' },
        `${zahlungen.length} ${zahlungen.length === 1 ? 'Zahlung' : 'Zahlungen'} genügen, `
        + 'um alle auszugleichen.'));
    }
    kopfHost.appendChild(ausgleichBox);
  }

  /* --------------------------- Ausgabenliste --------------------------- */

  function renderListe() {
    clear(listeHost);
    const gruppe = aktiv();
    if (!gruppe) return;

    listeHost.appendChild(el('h3', { class: 'dash-ueberschrift' }, 'Ausgaben'));

    if (!gruppe.ausgaben.length) {
      listeHost.appendChild(el('p', { class: 'empty' }, 'Noch nichts eingetragen – rechts die erste Ausgabe erfassen.'));
      return;
    }

    const sortiert = [...gruppe.ausgaben].sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
    for (const a of sortiert) {
      const zeile = el('div', { class: 'posten' });
      const teilnehmer = (a.beteiligte ?? []).filter(id => gruppe.personen.some(p => p.id === id));

      const text = el('div', { class: 'posten-text' });
      text.appendChild(el('span', { class: 'posten-grund' }, a.titel || 'Ohne Titel'));
      text.appendChild(el('span', { class: 'posten-datum' },
        `${nameVon(gruppe, a.zahlerId)} hat gezahlt · ${teilnehmer.length} von ${gruppe.personen.length} beteiligt · ${datumKurz(a.datum)}`));
      zeile.appendChild(text);

      zeile.appendChild(el('span', { class: 'posten-betrag' }, money(Number(a.betrag) || 0)));

      const bearbeiten = el('button', { class: 'link-btn posten-knopf', type: 'button' }, 'ändern');
      bearbeiten.addEventListener('click', () => { entwurf = { ...a, beteiligte: [...teilnehmer] }; renderSeite(); });

      const weg = el('button', { class: 'icon-btn', type: 'button', title: 'Löschen' }, '×');
      weg.addEventListener('click', () => {
        gruppe.ausgaben = gruppe.ausgaben.filter(x => x.id !== a.id);
        aenderung();
      });

      const aktionen = el('div', { class: 'posten-aktionen' });
      aktionen.append(bearbeiten, weg);
      zeile.appendChild(aktionen);
      listeHost.appendChild(zeile);
    }
  }

  /* ----------------------- Personen und Formular ----------------------- */

  function renderSeite() {
    clear(seiteHost);
    const gruppe = aktiv();
    if (!gruppe) return;

    const kopf = el('div', { class: 'editor-head' });
    kopf.appendChild(el('h2', {}, 'Wer ist dabei'));
    const neu = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, '+ Person');
    neu.addEventListener('click', () => {
      gruppe.personen.push({ id: uid('p'), name: `Person ${gruppe.personen.length + 1}` });
      aenderung();
    });
    kopf.append(neu);
    seiteHost.appendChild(kopf);

    for (const p of gruppe.personen) {
      const zeile = el('div', { class: 'row' , style: 'grid-template-columns: 1fr auto 26px' });
      const name = el('input', { type: 'text', value: p.name });
      name.addEventListener('input', () => { p.name = name.value; store.commit({ silent: true }); });
      name.addEventListener('change', () => renderAll());

      const ichKnopf = el('button', {
        type: 'button',
        class: 'tag' + (gruppe.ichId === p.id ? ' is-an' : ''),
        title: 'Das bin ich',
      }, 'ich');
      ichKnopf.addEventListener('click', () => { gruppe.ichId = p.id; aenderung(); });

      const weg = el('button', { class: 'icon-btn', type: 'button', title: 'Entfernen' }, '×');
      weg.addEventListener('click', () => {
        if (gruppe.personen.length <= 1) return;
        gruppe.personen = gruppe.personen.filter(x => x.id !== p.id);
        // Ausgaben nicht verlieren, nur die Beteiligung bereinigen.
        for (const a of gruppe.ausgaben) {
          a.beteiligte = (a.beteiligte ?? []).filter(id => id !== p.id);
          if (a.zahlerId === p.id) a.zahlerId = gruppe.personen[0].id;
        }
        if (gruppe.ichId === p.id) gruppe.ichId = gruppe.personen[0].id;
        aenderung();
      });

      zeile.append(name, ichKnopf, weg);
      seiteHost.appendChild(zeile);
    }

    if (!entwurf) entwurf = createAusgabe(gruppe);
    const e = entwurf;
    const istAenderung = gruppe.ausgaben.some(a => a.id === e.id);

    const ausgabenKopf = el('div', { class: 'editor-head editor-head-sep' });
    ausgabenKopf.appendChild(el('h2', {}, istAenderung ? 'Ausgabe ändern' : 'Neue Ausgabe'));
    seiteHost.appendChild(ausgabenKopf);

    const feld = (label, input) => {
      const row = el('label', { class: 'feld' });
      row.appendChild(el('span', { class: 'feld-label' }, label));
      const wrap = el('div', { class: 'feld-input' });
      wrap.appendChild(input);
      row.appendChild(wrap);
      seiteHost.appendChild(row);
    };

    const titel = el('input', { type: 'text', value: e.titel, placeholder: 'z. B. Hotel, Tanken, Einkauf' });
    titel.addEventListener('input', () => { e.titel = titel.value; });
    feld('Wofür', titel);

    const betrag = el('input', { type: 'number', min: '0', step: '0.01', value: e.betrag || '' });
    betrag.addEventListener('input', () => { e.betrag = Math.max(0, Number(betrag.value) || 0); });
    feld('Betrag', betrag);

    const zahler = el('select');
    for (const p of gruppe.personen) {
      const opt = el('option', { value: p.id }, p.name);
      if (p.id === e.zahlerId) opt.selected = true;
      zahler.appendChild(opt);
    }
    zahler.addEventListener('change', () => { e.zahlerId = zahler.value; });
    feld('Bezahlt von', zahler);

    const datum = el('input', { type: 'date', value: e.datum });
    datum.addEventListener('input', () => { e.datum = datum.value; });
    feld('Datum', datum);

    const beteiligtBox = el('div', { class: 'feld feld-breit' });
    beteiligtBox.appendChild(el('span', { class: 'feld-label' }, 'Geteilt durch'));
    const chips = el('div', { class: 'tag-chips' });
    for (const p of gruppe.personen) {
      const an = e.beteiligte.includes(p.id);
      const chip = el('button', { type: 'button', class: 'tag' + (an ? ' is-an' : '') }, p.name);
      chip.addEventListener('click', () => {
        e.beteiligte = an ? e.beteiligte.filter(id => id !== p.id) : [...e.beteiligte, p.id];
        renderSeite();
      });
      chips.appendChild(chip);
    }
    beteiligtBox.appendChild(chips);
    seiteHost.appendChild(beteiligtBox);

    if (e.betrag > 0 && e.beteiligte.length) {
      seiteHost.appendChild(el('p', { class: 'feld-hinweis' },
        `${money(Math.round((e.betrag / e.beteiligte.length) * 100) / 100)} pro Person.`));
    }

    const fehler = el('p', { class: 'msg is-error', hidden: true });
    seiteHost.appendChild(fehler);

    const speichern = el('button', { class: 'btn btn-primary btn-block', type: 'button' },
      istAenderung ? 'Änderung speichern' : 'Ausgabe eintragen');
    speichern.addEventListener('click', () => {
      if (!(e.betrag > 0)) { fehler.textContent = 'Bitte einen Betrag eintragen.'; fehler.hidden = false; return; }
      if (!e.beteiligte.length) { fehler.textContent = 'Mindestens eine Person muss beteiligt sein.'; fehler.hidden = false; return; }

      const vorhanden = gruppe.ausgaben.find(a => a.id === e.id);
      if (vorhanden) Object.assign(vorhanden, e);
      else gruppe.ausgaben.push({ ...e });
      entwurf = null;
      aenderung();
    });
    seiteHost.appendChild(speichern);

    if (istAenderung) {
      const abbrechen = el('button', { class: 'btn btn-block', type: 'button' }, 'Abbrechen');
      abbrechen.addEventListener('click', () => { entwurf = null; renderSeite(); });
      seiteHost.appendChild(abbrechen);
    }
  }

  function renderAll() {
    if (!alle().length) {
      const g = createGruppe('Urlaub');
      alle().push(g);
      store.data.gruppen.activeId = g.id;
    }
    entwurf = entwurf && aktiv()?.personen.some(p => p.id === entwurf.zahlerId) ? entwurf : null;
    renderKopf();
    renderListe();
    renderSeite();
  }

  return { renderAll };
}
