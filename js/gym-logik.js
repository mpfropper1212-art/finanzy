// Die Rechenregeln hinter dem Trainingslogger - bewusst ohne DOM, damit sie
// für sich prüfbar bleiben.

const zahl = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Gewichte kommen in 1,25er-Schritten vor; zwei Nachkommastellen reichen und
// vermeiden 42.50000000000001 nach dem Addieren.
export const runde = v => Math.round(zahl(v) * 100) / 100;

export function volumen(saetze) {
  return runde((saetze ?? []).reduce((s, x) => s + zahl(x.wdh) * zahl(x.gewicht), 0));
}

// Ein Satz zählt erst, wenn überhaupt etwas drinsteht - leere Zeilen, die der
// Nutzer noch nicht ausgefüllt hat, dürfen keine Statistik verfälschen.
export const istGefuellt = s => zahl(s.wdh) > 0;

export function saetzeVon(workout, uebungId) {
  return (workout?.saetze ?? []).filter(s => s.uebungId === uebungId);
}

// Das jüngste Training vor `ausserId`, in dem diese Übung vorkam.
export function letztesMal(workouts, uebungId, ausserId = null) {
  const kandidaten = (workouts ?? [])
    .filter(w => w.id !== ausserId && saetzeVon(w, uebungId).some(istGefuellt))
    .sort((a, b) => b.datum.localeCompare(a.datum));
  const w = kandidaten[0];
  if (!w) return null;
  return { workout: w, saetze: saetzeVon(w, uebungId).filter(istGefuellt) };
}

export function arbeitsgewicht(saetze) {
  const gefuellt = (saetze ?? []).filter(istGefuellt);
  if (!gefuellt.length) return null;
  return Math.max(...gefuellt.map(s => zahl(s.gewicht)));
}

/**
 * Progressive Overload, bewusst zurückhaltend: erst wenn im letzten Training
 * JEDER Satz die Zielwiederholungen erreicht hat, kommt die nächste Stufe.
 * Ein einzelner starker Satz reicht nicht - das wäre der häufigste Weg, sich
 * zu früh hochzuschrauben und dann drei Wochen festzustecken.
 *
 * Gibt immer einen Vorschlag für den nächsten Satz zurück, auch wenn er
 * lautet "gleiches Gewicht nochmal".
 */
export function vorschlag(uebung, letzte) {
  const ziel = Math.max(1, zahl(uebung?.zielWdh) || 10);
  const stufe = Math.max(0, zahl(uebung?.steigerung));

  if (!letzte || !letzte.saetze.length) {
    return {
      gewicht: null, wdh: ziel, steigt: false, neu: true,
      text: `Noch nie geloggt. Fang mit einem Gewicht an, das du ${ziel}× sauber schaffst.`,
    };
  }

  const saetze = letzte.saetze;
  const top = arbeitsgewicht(saetze);
  // Nur die Sätze auf dem schwersten Gewicht entscheiden. Aufwärmsätze mit
  // weniger Gewicht sollen die Steigerung nicht blockieren.
  const arbeitssaetze = saetze.filter(s => zahl(s.gewicht) === top);
  const geschafft = arbeitssaetze.filter(s => zahl(s.wdh) >= ziel).length;
  const alleGeschafft = geschafft === arbeitssaetze.length;

  if (alleGeschafft && stufe > 0) {
    return {
      gewicht: runde(top + stufe),
      wdh: ziel,
      steigt: true,
      neu: false,
      text: `Letztes Mal alle ${arbeitssaetze.length} Sätze mit ${ziel} Wiederholungen – `
        + `probier ${formatGewicht(runde(top + stufe))} kg.`,
    };
  }

  if (alleGeschafft && stufe === 0) {
    // Körpergewichtsübungen haben keine Gewichtsstufe - dort wächst die
    // Wiederholungszahl statt der Scheiben.
    return {
      gewicht: top,
      wdh: ziel + 1,
      steigt: true,
      neu: false,
      text: `Alle Sätze geschafft – häng eine Wiederholung dran (${ziel + 1}).`,
    };
  }

  const fehlend = arbeitssaetze.length - geschafft;
  return {
    gewicht: top,
    wdh: ziel,
    steigt: false,
    neu: false,
    text: `Letztes Mal ${geschafft} von ${arbeitssaetze.length} Sätzen auf ${ziel} Wiederholungen. `
      + `Bleib bei ${formatGewicht(top)} kg, bis ${fehlend === 1 ? 'auch der letzte' : 'alle'} sitzt.`,
  };
}

// 42.5 -> "42,5", 40 -> "40" - deutsche Schreibweise ohne unnötige Nullen.
export function formatGewicht(v) {
  if (v === null || !Number.isFinite(Number(v))) return '–';
  return Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

// "3 × 10 @ 40 kg" wenn alle Sätze gleich sind, sonst jeden Satz einzeln.
export function saetzeText(saetze) {
  const gefuellt = (saetze ?? []).filter(istGefuellt);
  if (!gefuellt.length) return '–';

  const gleich = gefuellt.every(s =>
    zahl(s.wdh) === zahl(gefuellt[0].wdh) && zahl(s.gewicht) === zahl(gefuellt[0].gewicht));
  if (gleich) {
    return `${gefuellt.length} × ${zahl(gefuellt[0].wdh)} @ ${formatGewicht(gefuellt[0].gewicht)} kg`;
  }
  return gefuellt
    .map(s => `${zahl(s.wdh)} @ ${formatGewicht(s.gewicht)}`)
    .join(' · ') + ' kg';
}

// Kennzahlen eines einzelnen Trainings.
export function workoutStats(workout, uebungen) {
  const nachId = new Map((uebungen ?? []).map(u => [u.id, u]));
  const gefuellt = (workout?.saetze ?? []).filter(istGefuellt);
  const uebungIds = [...new Set(gefuellt.map(s => s.uebungId))];

  const proMuskel = new Map();
  for (const s of gefuellt) {
    const m = nachId.get(s.uebungId)?.muskel || 'Ohne Zuordnung';
    proMuskel.set(m, runde((proMuskel.get(m) ?? 0) + zahl(s.wdh) * zahl(s.gewicht)));
  }

  return {
    saetze: gefuellt.length,
    uebungen: uebungIds.length,
    volumen: volumen(gefuellt),
    wiederholungen: gefuellt.reduce((s, x) => s + zahl(x.wdh), 0),
    proMuskel: [...proMuskel.entries()]
      .map(([muskel, wert]) => ({ muskel, wert }))
      .sort((a, b) => b.wert - a.wert),
  };
}

// Überblick über alle abgeschlossenen Trainings.
export function auswerten(gym) {
  const workouts = [...(gym?.workouts ?? [])].sort((a, b) => b.datum.localeCompare(a.datum));
  const fertige = workouts.filter(w => w.id !== gym?.aktivId);
  const aktiv = workouts.find(w => w.id === gym?.aktivId) ?? null;

  const grenze = new Date();
  grenze.setDate(grenze.getDate() - 28);
  const iso = grenze.toISOString().slice(0, 10);
  const letzte4Wochen = fertige.filter(w => w.datum >= iso);

  const letztes = fertige[0] ?? null;
  const vorletztes = fertige[1] ?? null;
  const uebungen = gym?.uebungen ?? [];

  return {
    workouts,
    fertige,
    aktiv,
    anzahl: fertige.length,
    proMonat: letzte4Wochen.length,
    letztes,
    letztesVolumen: letztes ? workoutStats(letztes, uebungen).volumen : null,
    trend: letztes && vorletztes
      ? runde(workoutStats(letztes, uebungen).volumen - workoutStats(vorletztes, uebungen).volumen)
      : null,
    gesamtVolumen: runde(fertige.reduce((s, w) => s + workoutStats(w, uebungen).volumen, 0)),
  };
}

/**
 * Bestleistung je Übung: das höchste Arbeitsgewicht und wann es stand.
 * Dient im Verlauf als Antwort auf "war das jetzt viel oder wenig".
 */
export function bestleistung(workouts, uebungId) {
  let beste = null;
  for (const w of workouts ?? []) {
    for (const s of saetzeVon(w, uebungId).filter(istGefuellt)) {
      if (!beste || zahl(s.gewicht) > beste.gewicht
        || (zahl(s.gewicht) === beste.gewicht && zahl(s.wdh) > beste.wdh)) {
        beste = { gewicht: zahl(s.gewicht), wdh: zahl(s.wdh), datum: w.datum };
      }
    }
  }
  return beste;
}
