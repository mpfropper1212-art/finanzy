// PDF verkleinern, ohne den Text anzufassen.
//
// Die Idee: In den meisten zu großen PDFs stecken Fotos oder Scans als
// JPEG-Datenströme (im PDF "DCTDecode"). Die werden herausgelöst, über ein
// Canvas kleiner neu kodiert und wieder eingesetzt. Text, Schriften und
// Vektorgrafik bleiben dabei unberührt - anders als bei Werkzeugen, die
// jede Seite zu einem Bild rendern und dabei die Textauswahl verlieren.
//
// Danach wird die Datei komplett neu geschrieben, inklusive frischer
// Querverweistabelle. Das ist aufwendiger, als nur Bytes zu tauschen, aber
// es ist die einzige Art, am Ende eine in sich stimmige Datei zu haben.

const roh = new TextDecoder('latin1');

// latin1 bildet jedes Byte auf genau ein Zeichen ab - Zeichen-Index und
// Byte-Position sind dadurch identisch. Das ist die Grundlage dafür, dass
// Textsuche und Byte-Arbeit sich hier mischen lassen.
const alsText = bytes => roh.decode(bytes);

const alsBytes = text => {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
};

export function groesse(bytes) {
  const kb = bytes.length / 1024;
  if (kb < 1000) return `${Math.round(kb)} kB`;
  return `${(kb / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
}

/* --------------------------- Datei zerlegen --------------------------- */

function zahlAus(dict, name) {
  const m = dict.match(new RegExp(`/${name}\\s+(\\d+)`));
  return m ? Number(m[1]) : null;
}

// Alle "N G obj ... endobj" im Rohtext. Objekte in Objektströmen stecken
// hier noch nicht drin, die werden danach ausgepackt.
function objekteFinden(text) {
  const liste = [];
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index;
    const inhaltAb = m.index + m[0].length;
    const ende = text.indexOf('endobj', inhaltAb);
    if (ende === -1) continue;
    liste.push({
      nummer: Number(m[1]),
      gen: Number(m[2]),
      start,
      inhaltAb,
      inhaltBis: ende,
      inhalt: text.slice(inhaltAb, ende),
    });
    re.lastIndex = ende;
  }
  return liste;
}

// Wörterbuch und Datenstrom eines Objekts trennen.
function stromTrennen(inhalt) {
  const i = inhalt.indexOf('stream');
  if (i === -1) return { dict: inhalt, stromVon: null, stromBis: null };

  let von = i + 'stream'.length;
  if (inhalt[von] === '\r') von += 1;
  if (inhalt[von] === '\n') von += 1;

  const dict = inhalt.slice(0, i);
  const laenge = zahlAus(dict, 'Length');
  let bis = laenge !== null ? von + laenge : -1;

  // Steht die Länge als Verweis auf ein anderes Objekt, oder passt sie
  // nicht, hilft nur die Endmarke.
  if (bis < 0 || bis > inhalt.length || !/^\s*endstream/.test(inhalt.slice(bis))) {
    bis = inhalt.lastIndexOf('endstream');
    while (bis > von && (inhalt[bis - 1] === '\n' || inhalt[bis - 1] === '\r')) bis -= 1;
  }
  return { dict, stromVon: von, stromBis: bis };
}

async function entpacken(bytes) {
  const strom = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(strom).arrayBuffer());
}

async function packen(bytes) {
  const strom = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(strom).arrayBuffer());
}

/**
 * Objektströme auspacken: PDF 1.5 und neuer stopft viele kleine Objekte
 * zusammengepackt in ein einziges. Die werden hier wieder zu normalen
 * Objekten gemacht - danach genügt eine einfache Querverweistabelle, und
 * die lässt sich verlässlich neu schreiben.
 */
async function objektstroemeAuspacken(objekte, bytes) {
  const extra = [];
  const bleibt = [];

  for (const o of objekte) {
    const { dict, stromVon, stromBis } = stromTrennen(o.inhalt);
    if (!/\/Type\s*\/ObjStm/.test(dict) || stromVon === null) {
      bleibt.push(o);
      continue;
    }
    try {
      const daten = bytes.slice(o.inhaltAb + stromVon, o.inhaltAb + stromBis);
      const klar = alsText(await entpacken(daten));
      const anzahl = zahlAus(dict, 'N');
      const ersteDaten = zahlAus(dict, 'First');
      if (anzahl === null || ersteDaten === null) { bleibt.push(o); continue; }

      const kopf = klar.slice(0, ersteDaten).trim().split(/\s+/).map(Number);
      for (let i = 0; i < anzahl; i++) {
        const nummer = kopf[i * 2];
        const von = ersteDaten + kopf[i * 2 + 1];
        const bis = i + 1 < anzahl ? ersteDaten + kopf[i * 2 + 3] : klar.length;
        if (!Number.isFinite(nummer) || !Number.isFinite(von)) continue;
        extra.push({ nummer, gen: 0, inhalt: klar.slice(von, bis), ausObjStm: true });
      }
      // Der Objektstrom selbst wird nicht übernommen, sein Inhalt steht nun
      // einzeln da.
    } catch {
      bleibt.push(o);
    }
  }
  return [...bleibt, ...extra];
}

/* ---------------------------- Bilder finden ---------------------------- */

export function bilderFinden(objekte) {
  const treffer = [];
  for (const o of objekte) {
    if (o.ausObjStm) continue;            // Bilddaten liegen nie im Objektstrom
    const { dict, stromVon, stromBis } = stromTrennen(o.inhalt);
    if (stromVon === null) continue;
    if (!/\/Subtype\s*\/Image/.test(dict)) continue;
    // Nur reine JPEG-Ströme. Alles andere (PNG-artig, JPEG2000, Faxformat)
    // müsste erst dekodiert werden und wird deshalb in Ruhe gelassen.
    if (!/\/Filter\s*\/DCTDecode[^a-zA-Z]/.test(dict) && !/\/Filter\s*\[\s*\/DCTDecode\s*\]/.test(dict)) continue;
    if (/\/SMask\s/.test(dict) && /\/Filter\s*\[/.test(dict)) continue;

    treffer.push({
      objekt: o,
      dict,
      stromVon,
      stromBis,
      breite: zahlAus(dict, 'Width'),
      hoehe: zahlAus(dict, 'Height'),
      bytes: stromBis - stromVon,
    });
  }
  return treffer;
}

/* -------------------------- Bild neu kodieren -------------------------- */

export async function bildNeuKodieren(jpegBytes, { qualitaet = 0.6, maxKante = 1600 } = {}) {
  const bild = await createImageBitmap(new Blob([jpegBytes], { type: 'image/jpeg' }));
  const faktor = Math.min(1, maxKante / Math.max(bild.width, bild.height));
  const b = Math.max(1, Math.round(bild.width * faktor));
  const h = Math.max(1, Math.round(bild.height * faktor));

  const leinwand = new OffscreenCanvas(b, h);
  const ctx = leinwand.getContext('2d');
  ctx.drawImage(bild, 0, 0, b, h);
  bild.close();

  const blob = await leinwand.convertToBlob({ type: 'image/jpeg', quality: qualitaet });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), breite: b, hoehe: h };
}

/* --------------------------- Datei aufbauen --------------------------- */

function trailerFinden(text, objekte) {
  const ausTrailer = [...text.matchAll(/trailer\s*<<([\s\S]*?)>>/g)].pop();
  if (ausTrailer) {
    const root = ausTrailer[1].match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
    if (root) return { root: `${root[1]} ${root[2]} R`, info: ausTrailer[1].match(/\/Info\s+(\d+\s+\d+\s+R)/)?.[1] ?? null };
  }
  // Neuere Dateien führen den Katalog im Querverweis-Strom.
  for (const o of objekte) {
    if (/\/Type\s*\/XRef/.test(o.inhalt)) {
      const root = o.inhalt.match(/\/Root\s+(\d+\s+\d+\s+R)/);
      if (root) return { root: root[1], info: o.inhalt.match(/\/Info\s+(\d+\s+\d+\s+R)/)?.[1] ?? null };
    }
  }
  for (const o of objekte) {
    if (/\/Type\s*\/Catalog/.test(o.inhalt)) return { root: `${o.nummer} ${o.gen} R`, info: null };
  }
  return null;
}

/**
 * Alles neu schreiben: Objekte der Reihe nach, dann eine frische
 * Querverweistabelle mit den tatsächlichen Positionen.
 */
function dateiSchreiben(objekte, trailer, originalBytes, ersetzungen) {
  const teile = [];
  let laenge = 0;
  const schreibe = stueck => {
    const b = typeof stueck === 'string' ? alsBytes(stueck) : stueck;
    teile.push(b);
    laenge += b.length;
    return b.length;
  };

  schreibe('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');

  const hoechste = objekte.reduce((m, o) => Math.max(m, o.nummer), 0);
  const positionen = new Map();

  for (const o of objekte) {
    if (positionen.has(o.nummer)) continue;   // doppelte Nummern: erste gewinnt
    positionen.set(o.nummer, laenge);
    schreibe(`${o.nummer} 0 obj`);

    const ersatz = ersetzungen.get(o);
    if (ersatz) {
      schreibe(ersatz.dict);
      schreibe('stream\n');
      schreibe(ersatz.bytes);
      schreibe('\nendstream');
    } else if (o.ausObjStm) {
      schreibe(o.inhalt);
    } else {
      // Unverändert: die Originalbytes übernehmen, damit Datenströme
      // Byte für Byte erhalten bleiben.
      schreibe(originalBytes.slice(o.inhaltAb, o.inhaltBis));
    }
    schreibe('endobj\n');
  }

  const xrefAb = laenge;
  const zeilen = ['xref', `0 ${hoechste + 1}`, '0000000000 65535 f '];
  for (let n = 1; n <= hoechste; n++) {
    zeilen.push(positionen.has(n)
      ? `${String(positionen.get(n)).padStart(10, '0')} 00000 n `
      : '0000000000 65535 f ');
  }
  schreibe(`${zeilen.join('\n')}\n`);
  schreibe(`trailer\n<< /Size ${hoechste + 1} /Root ${trailer.root}`
    + `${trailer.info ? ` /Info ${trailer.info}` : ''} >>\nstartxref\n${xrefAb}\n%%EOF\n`);

  const alles = new Uint8Array(laenge);
  let p = 0;
  for (const t of teile) { alles.set(t, p); p += t.length; }
  return alles;
}

/**
 * Nachprüfen, dass jeder Eintrag der Tabelle wirklich auf sein Objekt zeigt.
 * Schlägt das fehl, wird die Datei verworfen statt ausgeliefert - ein
 * kaputtes PDF ist schlimmer als ein großes.
 */
export function pruefen(bytes) {
  const text = alsText(bytes);
  const ab = text.lastIndexOf('startxref');
  if (ab === -1) return { ok: false, grund: 'Keine Querverweistabelle geschrieben.' };
  const start = Number(text.slice(ab + 9).trim().split(/\s/)[0]);
  if (!Number.isFinite(start) || text.slice(start, start + 4) !== 'xref') {
    return { ok: false, grund: 'Die Tabelle liegt nicht an der angegebenen Stelle.' };
  }

  const kopf = text.slice(start + 4).match(/\s*(\d+)\s+(\d+)\s/);
  if (!kopf) return { ok: false, grund: 'Tabellenkopf unlesbar.' };

  const anzahl = Number(kopf[2]);
  let p = start + 4 + kopf[0].length;
  let geprueft = 0;
  for (let n = 0; n < anzahl; n++, p += 20) {
    const zeile = text.slice(p, p + 20);
    if (zeile[17] === 'f') continue;
    const pos = Number(zeile.slice(0, 10));
    const soll = new RegExp(`^${n}\\s+\\d+\\s+obj`);
    if (!soll.test(text.slice(pos, pos + 32))) {
      return { ok: false, grund: `Objekt ${n} steht nicht an der erwarteten Stelle.` };
    }
    geprueft += 1;
  }
  return { ok: true, geprueft };
}

/* ------------------------------ Ablauf ------------------------------ */

/**
 * Eine PDF-Datei verkleinern.
 * `melde` wird mit dem Fortschritt gerufen, damit die Oberfläche bei großen
 * Dateien nicht einfach stillsteht.
 */
export async function komprimieren(bytes, optionen = {}, melde = () => {}) {
  const { qualitaet = 0.6, maxKante = 1600 } = optionen;
  const text = alsText(bytes);

  if (!text.startsWith('%PDF-')) {
    return { ok: false, grund: 'Das ist keine PDF-Datei.' };
  }
  if (/\/Encrypt\s/.test(text)) {
    return { ok: false, grund: 'Die Datei ist verschlüsselt oder passwortgeschützt – daran rühre ich nicht.' };
  }

  melde({ schritt: 'Datei wird gelesen' });
  let objekte = objekteFinden(text);
  if (!objekte.length) return { ok: false, grund: 'In der Datei sind keine Objekte zu finden.' };

  objekte = await objektstroemeAuspacken(objekte, bytes);

  const trailer = trailerFinden(text, objekte);
  if (!trailer) return { ok: false, grund: 'Der Einstiegspunkt der Datei ist nicht auffindbar.' };

  const bilder = bilderFinden(objekte);
  melde({ schritt: `${bilder.length} Bilder gefunden`, gesamt: bilder.length, fertig: 0 });

  const ersetzungen = new Map();
  let gespart = 0;
  let neuKodiert = 0;

  for (const [i, bild] of bilder.entries()) {
    melde({ schritt: `Bild ${i + 1} von ${bilder.length}`, gesamt: bilder.length, fertig: i });
    try {
      const alt = bytes.slice(bild.objekt.inhaltAb + bild.stromVon, bild.objekt.inhaltAb + bild.stromBis);
      const neu = await bildNeuKodieren(alt, { qualitaet, maxKante });
      // Nur übernehmen, wenn es wirklich kleiner wird. Bei schon stark
      // gestauchten Bildern macht eine zweite Runde sie sonst größer.
      if (neu.bytes.length >= alt.length) continue;

      let dict = bild.dict
        .replace(/\/Width\s+\d+/, `/Width ${neu.breite}`)
        .replace(/\/Height\s+\d+/, `/Height ${neu.hoehe}`)
        .replace(/\/Length\s+\d+/, `/Length ${neu.bytes.length}`);
      if (!/\/Length\s+\d+/.test(dict)) dict = dict.replace(/>>\s*$/, ` /Length ${neu.bytes.length} >>`);

      ersetzungen.set(bild.objekt, { dict, bytes: neu.bytes });
      gespart += alt.length - neu.bytes.length;
      neuKodiert += 1;
    } catch {
      // Ein Bild, das der Browser nicht dekodieren kann, bleibt wie es ist.
    }
  }

  melde({ schritt: 'Datei wird neu geschrieben' });
  const neu = dateiSchreiben(objekte, trailer, bytes, ersetzungen);

  const probe = pruefen(neu);
  if (!probe.ok) return { ok: false, grund: `Ergebnis verworfen: ${probe.grund}` };

  return {
    ok: true,
    bytes: neu,
    vorher: bytes.length,
    nachher: neu.length,
    bilder: bilder.length,
    neuKodiert,
    gespart,
    geprueft: probe.geprueft,
  };
}
