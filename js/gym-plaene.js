// Fertige Trainingspläne als Vorschlag. Jeder Plan besteht aus Einheiten, die
// reihum drankommen - die App merkt sich, welche als Nächstes fällig ist.
//
// Die Übungs-ids zeigen auf die Startliste in gym-daten.js. Hat jemand eine
// davon gelöscht, wird sie beim Befüllen still übersprungen; der Plan bleibt
// benutzbar, statt mit einem Fehler auszusteigen.

export const PLAENE = [
  {
    id: 'ganzkoerper',
    name: 'Ganzkörper',
    takt: '3× pro Woche',
    fuer: 'Einstieg und Wiedereinstieg',
    text: 'Zwei Einheiten im Wechsel, jede trainiert den ganzen Körper. '
      + 'Am wenigsten anfällig dafür, dass eine Muskelgruppe liegen bleibt, '
      + 'wenn eine Woche mal ausfällt.',
    einheiten: [
      {
        name: 'Einheit A',
        uebungen: ['u-beinpresse', 'u-brustpresse', 'u-latzug-breit',
          'u-schulterpresse', 'u-beinbeuger', 'u-bauchmaschine'],
      },
      {
        name: 'Einheit B',
        uebungen: ['u-kniebeuge', 'u-rudermaschine', 'u-schraegbank',
          'u-beinstrecker', 'u-seitheben', 'u-rueckenstrecker'],
      },
    ],
  },
  {
    id: 'ober-unter',
    name: 'Oberkörper / Unterkörper',
    takt: '4× pro Woche',
    fuer: 'wenn drei Einheiten zu wenig werden',
    text: 'Zweiertakt: zweimal Oberkörper, zweimal Beine. Jede Muskelgruppe '
      + 'kommt zweimal pro Woche dran, ohne dass eine Einheit zu lang wird.',
    einheiten: [
      {
        name: 'Oberkörper',
        uebungen: ['u-brustpresse', 'u-latzug-breit', 'u-schulterpresse',
          'u-rudern-kabel', 'u-curls-lh', 'u-trizepsdruecken'],
      },
      {
        name: 'Unterkörper',
        uebungen: ['u-beinpresse', 'u-beinbeuger', 'u-beinstrecker',
          'u-hipthrust', 'u-wadenheben', 'u-bauchmaschine'],
      },
    ],
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Beine',
    takt: '3× bis 6× pro Woche',
    fuer: 'wenn du schon ein Jahr dabei bist',
    text: 'Drücken, Ziehen, Beine. Der klassische Dreiersplit - viel Volumen '
      + 'je Muskelgruppe, dafür brauchst du verlässlich drei Termine die Woche.',
    einheiten: [
      {
        name: 'Push',
        uebungen: ['u-brustpresse', 'u-schulterpresse', 'u-schraegbank',
          'u-seitheben', 'u-trizepsdruecken', 'u-dips'],
      },
      {
        name: 'Pull',
        uebungen: ['u-latzug-breit', 'u-rudermaschine', 'u-ueberzug',
          'u-facepull', 'u-curls-lh', 'u-hammercurls'],
      },
      {
        name: 'Beine',
        uebungen: ['u-kniebeuge', 'u-beinpresse', 'u-beinbeuger',
          'u-beinstrecker', 'u-wadenheben', 'u-beinheben'],
      },
    ],
  },
];

export const PLAN_IDS = PLAENE.map(p => p.id);

export const planZu = id => PLAENE.find(p => p.id === id) ?? null;

// Die Einheit, die als Nächstes dran ist - und ein Wrap-around, falls die
// gespeicherte Position aus einem Plan mit mehr Einheiten stammt.
export function einheitZu(plan, position) {
  if (!plan || !plan.einheiten.length) return null;
  const i = ((Number(position) || 0) % plan.einheiten.length + plan.einheiten.length)
    % plan.einheiten.length;
  return { ...plan.einheiten[i], index: i };
}
