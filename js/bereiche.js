// Eine einzige Liste aller Bereiche. Reiterzeile, Menü, Startkacheln und das
// Umschalten der Panels lesen alle hier - sonst vergisst man beim nächsten
// neuen Tab garantiert eine der vier Stellen.

export const GRUPPEN = ['Geld', 'Alltag', 'Gesundheit'];

export const BEREICHE = [
  {
    tab: 'flow', panel: 'panel-flow', symbol: 'flow', kennzahl: 'flow', gruppe: 'Geld',
    titel: 'Geldfluss',
    text: 'Wohin dein Geld jeden Monat fließt, als Sankey-Diagramm.',
  },
  {
    tab: 'accounts', panel: 'panel-accounts', symbol: 'konten', kennzahl: 'konten', gruppe: 'Geld',
    titel: 'Konten',
    text: 'Deine Konten, ihre Stände und die Umbuchungen dazwischen.',
  },
  {
    tab: 'immo', panel: 'panel-immo', symbol: 'immobilien', kennzahl: 'immobilien', gruppe: 'Geld',
    titel: 'Immobilien',
    text: 'Rendite, Finanzierung und Cashflow einer Kapitalanlage.',
  },
  {
    tab: 'schulden', panel: 'panel-schulden', symbol: 'schulden', kennzahl: 'schulden', gruppe: 'Geld',
    titel: 'Schulden',
    text: 'Wer dir was schuldet und was du schuldest – per Satz erfasst.',
  },
  {
    tab: 'gruppen', panel: 'panel-gruppen', symbol: 'gruppen', kennzahl: 'gruppen', gruppe: 'Geld',
    titel: 'Gruppenkasse',
    text: 'Gemeinsame Ausgaben einer Reise – und wer am Ende wem was zahlt.',
  },

  {
    tab: 'gerichte', panel: 'panel-gerichte', symbol: 'gerichte', kennzahl: 'gerichte', gruppe: 'Alltag',
    titel: 'Gerichte',
    text: 'Günstig und eiweißreich kochen, mit Preis und Aufwand je Portion.',
  },
  {
    tab: 'woche', panel: 'panel-woche', symbol: 'woche', kennzahl: 'woche', gruppe: 'Alltag',
    titel: 'Wochenplan',
    text: 'Essen für die Woche planen – die Einkaufsliste entsteht daraus.',
  },
  {
    tab: 'tanken', panel: 'panel-tanken', symbol: 'tanken', kennzahl: 'tanken', gruppe: 'Alltag',
    titel: 'Tanken',
    text: 'Verbrauch und Spritkosten über alle Tankfüllungen.',
  },
  {
    tab: 'strom', panel: 'panel-strom', symbol: 'strom', kennzahl: 'strom', gruppe: 'Alltag',
    titel: 'Strom',
    text: 'Zählerstände eintragen – Verbrauch und Monatskosten ergeben sich daraus.',
  },

  {
    tab: 'gym', panel: 'panel-gym', symbol: 'gym', kennzahl: 'gym', gruppe: 'Gesundheit',
    titel: 'Training',
    text: 'Sätze loggen, das letzte Mal daneben sehen und das nächste Gewicht vorgeschlagen bekommen.',
  },
];

export const BEREICH_IDS = BEREICHE.map(b => b.tab);

export const bereichZu = tab => BEREICHE.find(b => b.tab === tab) ?? null;

// Was auf der Startseite stehen kann. Die Kacheln sind ein Block, die
// Reihenfolge der Blöcke bestimmt der Nutzer.
export const WIDGETS = [
  { id: 'habits', titel: 'Gewohnheiten', text: 'Kleine tägliche Haken mit Serie.' },
  { id: 'karten', titel: 'Bereichskacheln', text: 'Die Bereiche mit ihrer wichtigsten Zahl.' },
  { id: 'nachrichten', titel: 'Finanznachrichten', text: 'Schlagzeilen des Tages.' },
];

export const WIDGET_IDS = WIDGETS.map(w => w.id);

// Startzustand: vier Kacheln und drei Reiter reichen, der Rest steckt im Menü.
export const START_VORGABE = {
  widgets: ['habits', 'karten', 'nachrichten'],
  karten: ['flow', 'accounts', 'woche', 'gym'],
  favoriten: ['flow', 'accounts', 'gerichte'],
  muenze: true,
};
