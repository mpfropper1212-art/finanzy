// Oberfläche zum PDF-Verkleinern. Die Datei bleibt im Browser - sie wird
// nirgendwo hochgeladen, also funktioniert das auch mit Unterlagen, die
// niemanden sonst etwas angehen.

import { el, clear } from './util.js';
import { komprimieren, groesse } from './pdf-logik.js';

export const STUFEN = {
  stark: { label: 'Stark', qualitaet: 0.4, maxKante: 1200, text: 'Fürs Verschicken per Mail' },
  mittel: { label: 'Mittel', qualitaet: 0.6, maxKante: 1600, text: 'Guter Mittelweg' },
  schonend: { label: 'Schonend', qualitaet: 0.8, maxKante: 2400, text: 'Wenn es noch gut aussehen muss' },
};

export function createPdfView({ host, store }) {
  const daten = () => store.data.pdf;

  let datei = null;
  let bytes = null;
  let ergebnis = null;
  let laeuft = false;
  let fortschritt = null;
  let fehler = '';

  function neuZeichnen() {
    clear(host);
    host.appendChild(kopfBereich());
    host.appendChild(einstellungen());
    if (fehler) host.appendChild(el('p', { class: 'msg is-error' }, fehler));
    if (laeuft) host.appendChild(laeuftBereich());
    else if (ergebnis) host.appendChild(ergebnisBereich());
    host.appendChild(hinweise());
  }

  /* ----------------------------- Auswahl ----------------------------- */

  function dateiNehmen(f) {
    fehler = '';
    ergebnis = null;
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') {
      fehler = 'Das sieht nicht nach einer PDF-Datei aus.';
      datei = null;
      neuZeichnen();
      return;
    }
    datei = f;
    bytes = null;
    neuZeichnen();
  }

  function kopfBereich() {
    const box = el('section', { class: 'pdf-ablage' + (datei ? ' hat-datei' : '') });

    const auswahl = el('input', { type: 'file', accept: 'application/pdf,.pdf', hidden: true });
    auswahl.addEventListener('change', () => dateiNehmen(auswahl.files?.[0] ?? null));
    box.appendChild(auswahl);

    if (datei) {
      box.appendChild(el('strong', { class: 'pdf-name' }, datei.name));
      box.appendChild(el('span', { class: 'pdf-groesse' }, groesse({ length: datei.size })));

      const zeile = el('div', { class: 'pdf-knoepfe' });
      const los = el('button', {
        class: 'btn btn-primary', type: 'button', disabled: laeuft,
      }, laeuft ? 'Läuft …' : 'Verkleinern');
      los.addEventListener('click', starten);
      const andere = el('button', { class: 'link-btn', type: 'button' }, 'Andere Datei');
      andere.addEventListener('click', () => auswahl.click());
      zeile.append(los, andere);
      box.appendChild(zeile);
    } else {
      box.appendChild(el('p', { class: 'pdf-ablage-text' },
        'PDF hierher ziehen oder auswählen. Die Datei bleibt auf deinem Gerät.'));
      const knopf = el('button', { class: 'btn btn-primary', type: 'button' }, 'PDF auswählen');
      knopf.addEventListener('click', () => auswahl.click());
      box.appendChild(knopf);
    }

    for (const typ of ['dragenter', 'dragover']) {
      box.addEventListener(typ, ev => { ev.preventDefault(); box.classList.add('ist-bereit'); });
    }
    box.addEventListener('dragleave', () => box.classList.remove('ist-bereit'));
    box.addEventListener('drop', ev => {
      ev.preventDefault();
      box.classList.remove('ist-bereit');
      dateiNehmen(ev.dataTransfer?.files?.[0] ?? null);
    });

    return box;
  }

  /* --------------------------- Einstellungen --------------------------- */

  function einstellungen() {
    const box = el('section', { class: 'pdf-stufen' });
    box.appendChild(el('span', { class: 'feld-label' }, 'Wie stark?'));
    const reihe = el('div', { class: 'pdf-stufen-reihe' });

    for (const [key, s] of Object.entries(STUFEN)) {
      const b = el('button', {
        type: 'button',
        class: 'pdf-stufe' + (daten().stufe === key ? ' is-active' : ''),
      });
      b.append(el('strong', {}, s.label), el('span', {}, s.text));
      b.addEventListener('click', () => {
        daten().stufe = key;
        store.commit({ silent: true });
        neuZeichnen();
      });
      reihe.appendChild(b);
    }
    box.appendChild(reihe);
    return box;
  }

  /* ------------------------------ Ablauf ------------------------------ */

  async function starten() {
    if (laeuft || !datei) return;
    laeuft = true;
    fehler = '';
    ergebnis = null;
    fortschritt = { schritt: 'Datei wird gelesen' };
    neuZeichnen();

    try {
      if (!bytes) bytes = new Uint8Array(await datei.arrayBuffer());
      const s = STUFEN[daten().stufe] ?? STUFEN.mittel;

      const r = await komprimieren(bytes, { qualitaet: s.qualitaet, maxKante: s.maxKante }, p => {
        fortschritt = p;
        // Nur den Fortschrittsteil neu zeichnen, damit die Auswahl nicht
        // bei jedem Bild unter dem Finger wegspringt.
        const anzeige = host.querySelector('.pdf-lauf');
        if (anzeige) anzeige.replaceWith(laeuftBereich());
      });

      if (!r.ok) fehler = r.grund;
      else ergebnis = r;
    } catch (e) {
      fehler = `Beim Verkleinern ist etwas schiefgegangen: ${e.message}`;
    } finally {
      laeuft = false;
      fortschritt = null;
      neuZeichnen();
    }
  }

  function laeuftBereich() {
    const box = el('section', { class: 'pdf-lauf' });
    box.appendChild(el('span', {}, fortschritt?.schritt ?? 'Arbeitet …'));
    const schiene = el('div', { class: 'gym-schiene' });
    const anteil = fortschritt?.gesamt
      ? Math.round((fortschritt.fertig / fortschritt.gesamt) * 100)
      : null;
    schiene.appendChild(el('div', {
      class: 'gym-schiene-fuellung' + (anteil === null ? ' ist-unbestimmt' : ''),
      style: `width: ${anteil === null ? 100 : anteil}%`,
    }));
    box.appendChild(schiene);
    return box;
  }

  /* ----------------------------- Ergebnis ----------------------------- */

  function ergebnisBereich() {
    const r = ergebnis;
    const anteil = Math.round((1 - r.nachher / r.vorher) * 100);
    const box = el('section', { class: 'pdf-ergebnis' + (anteil > 0 ? '' : ' ist-mager') });

    const zahlen = el('div', { class: 'pdf-vergleich' });
    zahlen.append(
      el('span', { class: 'pdf-vorher' }, groesse({ length: r.vorher })),
      el('span', { class: 'pdf-pfeil' }, '→'),
      el('strong', { class: 'pdf-nachher' }, groesse({ length: r.nachher })),
      el('span', { class: 'pdf-anteil' },
        anteil > 0 ? `${anteil} % kleiner` : 'nichts zu holen'),
    );
    box.appendChild(zahlen);

    box.appendChild(el('p', { class: 'pdf-bericht' },
      r.bilder === 0
        ? 'In dieser Datei stecken keine JPEG-Bilder – da lässt sich auf diesem '
          + 'Weg nichts einsparen. Reine Text-PDFs sind meist schon klein.'
        : `${r.neuKodiert} von ${r.bilder} Bildern neu kodiert. `
          + `${r.geprueft} Objekte geprüft, die Datei ist in sich stimmig.`));

    if (anteil > 0) {
      const name = datei.name.replace(/\.pdf$/i, '') + '-klein.pdf';
      const url = URL.createObjectURL(new Blob([r.bytes], { type: 'application/pdf' }));
      const a = el('a', { class: 'btn btn-primary', href: url, download: name }, 'Herunterladen');
      box.appendChild(a);
      box.appendChild(el('span', { class: 'pdf-dateiname' }, name));
    }

    return box;
  }

  function hinweise() {
    const box = el('details', { class: 'pdf-hinweise' });
    box.appendChild(el('summary', {}, 'Was dabei passiert'));
    for (const z of [
      'Die Datei wird nirgendwo hochgeladen. Alles läuft in deinem Browser.',
      'Verkleinert werden die eingebetteten Fotos und Scans, indem sie kleiner '
        + 'und etwas gröber neu gespeichert werden. Text, Schriften und Striche '
        + 'bleiben unverändert und weiterhin auswählbar.',
      'Reine Text-PDFs werden dadurch nicht kleiner – dort steckt der Platz nicht in Bildern.',
      'Passwortgeschützte Dateien werden abgelehnt.',
      'Zum Schluss prüft die App das Ergebnis Objekt für Objekt. Stimmt etwas '
        + 'nicht, bekommst du keine Datei, sondern eine Meldung – ein kaputtes '
        + 'PDF wäre schlimmer als ein großes.',
    ]) box.appendChild(el('p', {}, z));
    return box;
  }

  return { renderAll: neuZeichnen };
}
