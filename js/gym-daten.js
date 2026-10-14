// Startliste an Geräten und Übungen, zugeschnitten auf eine typische
// FitX-Fläche. Alles davon ist nur ein Vorschlag: umbenennen, löschen und
// eigenes anlegen geht überall, deshalb sind die ids schlicht und lesbar.

export const MUSKELGRUPPEN = [
  'Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps',
  'Beine', 'Gesäß', 'Bauch', 'Waden', 'Ganzkörper',
];

// Jede Gruppe bekommt einen eigenen Ton, damit man im Verlauf auf einen Blick
// sieht, ob eine Woche einseitig war.
export const MUSKEL_FARBEN = {
  'Brust': '#dc2626',
  'Rücken': '#2563eb',
  'Schultern': '#d97706',
  'Bizeps': '#7c3aed',
  'Trizeps': '#9333ea',
  'Beine': '#059669',
  'Gesäß': '#0d9488',
  'Bauch': '#ca8a04',
  'Waden': '#65a30d',
  'Ganzkörper': '#64748b',
};

export const SEED_GERAETE = [
  { id: 'g-brustpresse', name: 'Brustpresse' },
  { id: 'g-butterfly', name: 'Butterfly' },
  { id: 'g-schulterpresse', name: 'Schulterpresse' },
  { id: 'g-latzug', name: 'Latzug' },
  { id: 'g-rudermaschine', name: 'Rudermaschine' },
  { id: 'g-kabelturm', name: 'Kabelturm' },
  { id: 'g-beinpresse', name: 'Beinpresse' },
  { id: 'g-beinstrecker', name: 'Beinstrecker' },
  { id: 'g-beinbeuger', name: 'Beinbeuger' },
  { id: 'g-abduktoren', name: 'Abduktorenmaschine' },
  { id: 'g-wadenmaschine', name: 'Wadenmaschine' },
  { id: 'g-bauchmaschine', name: 'Bauchmaschine' },
  { id: 'g-ruecken', name: 'Rückenstrecker' },
  { id: 'g-dipmaschine', name: 'Dip- und Klimmzugmaschine' },
  { id: 'g-multipresse', name: 'Multipresse' },
  { id: 'g-hantelbank', name: 'Hantelbank' },
  { id: 'g-langhantel', name: 'Langhantel' },
  { id: 'g-kurzhantel', name: 'Kurzhanteln' },
  { id: 'g-hipthrust', name: 'Hip-Thrust-Maschine' },
];

// zielWdh: ab wie vielen sauberen Wiederholungen je Satz die App das nächste
// Gewicht vorschlägt. steigerung: die kleinste sinnvolle Stufe an diesem
// Gerät - am Kabelturm sind das selten mehr als 1,25 kg, an der Beinpresse 5.
export const SEED_UEBUNGEN = [
  { id: 'u-brustpresse', name: 'Brustpresse', geraetId: 'g-brustpresse', muskel: 'Brust', zielWdh: 10, steigerung: 2.5 },
  { id: 'u-butterfly', name: 'Butterfly', geraetId: 'g-butterfly', muskel: 'Brust', zielWdh: 12, steigerung: 2.5 },
  { id: 'u-bankdruecken', name: 'Bankdrücken', geraetId: 'g-langhantel', muskel: 'Brust', zielWdh: 8, steigerung: 2.5 },
  { id: 'u-schraegbank', name: 'Schrägbankdrücken Kurzhantel', geraetId: 'g-kurzhantel', muskel: 'Brust', zielWdh: 10, steigerung: 2 },

  { id: 'u-latzug-breit', name: 'Latzug breit', geraetId: 'g-latzug', muskel: 'Rücken', zielWdh: 10, steigerung: 2.5 },
  { id: 'u-latzug-eng', name: 'Latzug eng im Untergriff', geraetId: 'g-latzug', muskel: 'Rücken', zielWdh: 10, steigerung: 2.5 },
  { id: 'u-rudern-kabel', name: 'Rudern am Kabel', geraetId: 'g-kabelturm', muskel: 'Rücken', zielWdh: 10, steigerung: 2.5 },
  { id: 'u-rudermaschine', name: 'Rudern an der Maschine', geraetId: 'g-rudermaschine', muskel: 'Rücken', zielWdh: 10, steigerung: 2.5 },
  { id: 'u-klimmzug', name: 'Klimmzüge unterstützt', geraetId: 'g-dipmaschine', muskel: 'Rücken', zielWdh: 8, steigerung: 2.5 },
  { id: 'u-ueberzug', name: 'Überzüge am Kabelturm', geraetId: 'g-kabelturm', muskel: 'Rücken', zielWdh: 12, steigerung: 1.25 },
  { id: 'u-rueckenstrecker', name: 'Rückenstrecken', geraetId: 'g-ruecken', muskel: 'Rücken', zielWdh: 15, steigerung: 2.5 },
  { id: 'u-kreuzheben', name: 'Kreuzheben', geraetId: 'g-langhantel', muskel: 'Rücken', zielWdh: 6, steigerung: 5 },

  { id: 'u-schulterpresse', name: 'Schulterpresse', geraetId: 'g-schulterpresse', muskel: 'Schultern', zielWdh: 10, steigerung: 2.5 },
  { id: 'u-seitheben', name: 'Seitheben Kurzhantel', geraetId: 'g-kurzhantel', muskel: 'Schultern', zielWdh: 12, steigerung: 1 },
  { id: 'u-seitheben-kabel', name: 'Seitheben am Kabel', geraetId: 'g-kabelturm', muskel: 'Schultern', zielWdh: 12, steigerung: 1.25 },
  { id: 'u-facepull', name: 'Face Pulls', geraetId: 'g-kabelturm', muskel: 'Schultern', zielWdh: 15, steigerung: 1.25 },

  { id: 'u-curls-lh', name: 'Bizepscurls Langhantel', geraetId: 'g-langhantel', muskel: 'Bizeps', zielWdh: 10, steigerung: 2.5 },
  { id: 'u-hammercurls', name: 'Hammercurls', geraetId: 'g-kurzhantel', muskel: 'Bizeps', zielWdh: 12, steigerung: 2 },
  { id: 'u-curls-kabel', name: 'Bizepscurls am Kabelturm', geraetId: 'g-kabelturm', muskel: 'Bizeps', zielWdh: 12, steigerung: 1.25 },

  { id: 'u-trizepsdruecken', name: 'Trizepsdrücken am Kabel', geraetId: 'g-kabelturm', muskel: 'Trizeps', zielWdh: 12, steigerung: 1.25 },
  { id: 'u-dips', name: 'Dips unterstützt', geraetId: 'g-dipmaschine', muskel: 'Trizeps', zielWdh: 10, steigerung: 2.5 },
  { id: 'u-frenchpress', name: 'French Press', geraetId: 'g-langhantel', muskel: 'Trizeps', zielWdh: 10, steigerung: 2.5 },

  { id: 'u-beinpresse', name: 'Beinpresse', geraetId: 'g-beinpresse', muskel: 'Beine', zielWdh: 10, steigerung: 5 },
  { id: 'u-beinstrecker', name: 'Beinstrecker', geraetId: 'g-beinstrecker', muskel: 'Beine', zielWdh: 12, steigerung: 2.5 },
  { id: 'u-beinbeuger', name: 'Beinbeuger', geraetId: 'g-beinbeuger', muskel: 'Beine', zielWdh: 12, steigerung: 2.5 },
  { id: 'u-kniebeuge', name: 'Kniebeuge in der Multipresse', geraetId: 'g-multipresse', muskel: 'Beine', zielWdh: 8, steigerung: 5 },
  { id: 'u-ausfallschritt', name: 'Ausfallschritte Kurzhantel', geraetId: 'g-kurzhantel', muskel: 'Beine', zielWdh: 10, steigerung: 2 },

  { id: 'u-hipthrust', name: 'Hip Thrust', geraetId: 'g-hipthrust', muskel: 'Gesäß', zielWdh: 10, steigerung: 5 },
  { id: 'u-abduktoren', name: 'Abduktoren', geraetId: 'g-abduktoren', muskel: 'Gesäß', zielWdh: 15, steigerung: 2.5 },

  { id: 'u-wadenheben', name: 'Wadenheben', geraetId: 'g-wadenmaschine', muskel: 'Waden', zielWdh: 15, steigerung: 5 },

  { id: 'u-bauchmaschine', name: 'Bauchmaschine', geraetId: 'g-bauchmaschine', muskel: 'Bauch', zielWdh: 15, steigerung: 2.5 },
  { id: 'u-beinheben', name: 'Beinheben hängend', geraetId: 'g-dipmaschine', muskel: 'Bauch', zielWdh: 12, steigerung: 0 },
];


// Frische Kopien der Startliste. Die Vorgaben für Satzzahl und Pause stehen
// nur hier, damit sie nicht an zwei Stellen auseinanderlaufen.
export const geraeteVorlage = () => SEED_GERAETE.map(g => ({ ...g }));
export const uebungenVorlage = () => SEED_UEBUNGEN.map(u => ({ saetzeZiel: 3, pause: 90, ...u }));
