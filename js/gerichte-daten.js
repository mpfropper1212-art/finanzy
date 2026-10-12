// Startdatenbank: einfache, günstige Gerichte mit viel Eiweiß.
// Alle Angaben pro Portion. Preise nach Supermarkt-Grundpreisen 2026
// (Haferflocken 500 g ~0,69 €, Magerquark 500 g ~0,99 €, rote Linsen 500 g
// ~0,99 €, Eier ~0,25 €/Stück, Hähnchenbrust ~8 €/kg) und daher Richtwerte.
//
// aufwand und abwasch: 1 = fast nichts, 5 = viel. zeit in Minuten.

export const SEED_GERICHTE = [
  {
    id: 'seed-quark-hafer', name: 'Magerquark mit Haferflocken und Banane', art: 'vegetarisch',
    kcal: 380, protein: 37, kh: 60, fett: 5, preis: 0.90, zeit: 3, aufwand: 1, abwasch: 1,
    beschreibung: '250 g Magerquark, 50 g Haferflocken, eine Banane, etwas Zimt. Alles verrühren, fertig. Unschlagbar beim Eiweiß pro Euro.',
  },
  {
    id: 'seed-harzer-brot', name: 'Harzer Käse auf Vollkornbrot', art: 'vegetarisch',
    kcal: 330, protein: 36, kh: 32, fett: 4, preis: 1.10, zeit: 5, aufwand: 1, abwasch: 1,
    beschreibung: 'Zwei Rollen Harzer, zwei Scheiben Vollkornbrot, Senf und Zwiebeln. Der mit Abstand günstigste Eiweißträger im Kühlregal.',
  },
  {
    id: 'seed-linsen-dal', name: 'Rote-Linsen-Dal mit Reis', art: 'vegan',
    kcal: 600, protein: 30, kh: 105, fett: 5, preis: 0.80, zeit: 25, aufwand: 2, abwasch: 2,
    beschreibung: '100 g rote Linsen mit Zwiebel, Tomatenmark, Kurkuma und Kreuzkümmel weich kochen, dazu Reis. Ein Topf, kaum Arbeit.',
  },
  {
    id: 'seed-huehnchen-reis', name: 'Hähnchenbrust mit Reis und Brokkoli', art: 'fleisch',
    kcal: 490, protein: 45, kh: 58, fett: 7, preis: 2.20, zeit: 25, aufwand: 2, abwasch: 3,
    beschreibung: 'Der Klassiker: 150 g Hähnchenbrust in der Pfanne, Reis und Brokkoli dazu. Lässt sich gut für mehrere Tage vorkochen.',
  },
  {
    id: 'seed-ruehrei-brot', name: 'Rührei mit Vollkornbrot', art: 'vegetarisch',
    kcal: 450, protein: 26, kh: 32, fett: 24, preis: 1.20, zeit: 10, aufwand: 1, abwasch: 2,
    beschreibung: 'Drei Eier, zwei Scheiben Vollkornbrot. Funktioniert zu jeder Tageszeit und braucht nur eine Pfanne.',
  },
  {
    id: 'seed-thunfisch-nudeln', name: 'Thunfischnudeln mit Tomatensauce', art: 'fisch',
    kcal: 620, protein: 45, kh: 92, fett: 8, preis: 1.95, zeit: 15, aufwand: 1, abwasch: 2,
    beschreibung: '125 g Nudeln, eine Dose Thunfisch im eigenen Saft, passierte Tomaten. Eiweißreich und in einer Viertelstunde fertig.',
  },
  {
    id: 'seed-kichererbsen-curry', name: 'Kichererbsen-Curry mit Reis', art: 'vegan',
    kcal: 700, protein: 24, kh: 86, fett: 28, preis: 2.00, zeit: 20, aufwand: 2, abwasch: 2,
    beschreibung: 'Dose Kichererbsen, halbe Dose Kokosmilch, Currypaste, Reis. Sättigt lange und schmeckt am nächsten Tag besser.',
  },
  {
    id: 'seed-skyr-beeren', name: 'Skyr mit Beeren und Nüssen', art: 'vegetarisch',
    kcal: 320, protein: 33, kh: 24, fett: 10, preis: 1.60, zeit: 3, aufwand: 1, abwasch: 1,
    beschreibung: '250 g Skyr, eine Handvoll TK-Beeren, 15 g Walnüsse. Kein Herd, keine Pfanne.',
  },
  {
    id: 'seed-chili-sin-carne', name: 'Chili sin Carne', art: 'vegan',
    kcal: 520, protein: 27, kh: 72, fett: 10, preis: 1.50, zeit: 30, aufwand: 2, abwasch: 2,
    beschreibung: 'Kidneybohnen, Mais, gehackte Tomaten, Paprika, Sojaschnetzel. Große Menge auf einmal kochen lohnt sich besonders.',
  },
  {
    id: 'seed-chili-con-carne', name: 'Chili con Carne', art: 'fleisch',
    kcal: 580, protein: 38, kh: 58, fett: 20, preis: 2.40, zeit: 35, aufwand: 2, abwasch: 2,
    beschreibung: '250 g Hackfleisch auf vier Portionen, Kidneybohnen, Mais, Tomaten. Ein Topf, große Menge, friert gut ein.',
  },
  {
    id: 'seed-tofu-pfanne', name: 'Tofu-Gemüse-Pfanne mit Reis', art: 'vegan',
    kcal: 540, protein: 30, kh: 62, fett: 18, preis: 2.10, zeit: 20, aufwand: 2, abwasch: 2,
    beschreibung: '200 g Räuchertofu, TK-Gemüsemischung, Sojasauce, Reis. Tofu vorher gut anbraten, dann wird er fest.',
  },
  {
    id: 'seed-porridge-protein', name: 'Porridge mit Proteinpulver', art: 'vegetarisch',
    kcal: 420, protein: 35, kh: 52, fett: 8, preis: 1.10, zeit: 7, aufwand: 1, abwasch: 1,
    beschreibung: '60 g Haferflocken in Milch aufkochen, nach dem Abkühlen einen Messlöffel Proteinpulver einrühren. Vorher einrühren lässt es klumpen.',
  },
  {
    id: 'seed-linsenbolognese', name: 'Nudeln mit Linsenbolognese', art: 'vegan',
    kcal: 610, protein: 28, kh: 100, fett: 8, preis: 1.30, zeit: 30, aufwand: 2, abwasch: 2,
    beschreibung: 'Braune Linsen statt Hackfleisch, mit Karotte, Sellerie und passierten Tomaten. Sättigt wie das Original.',
  },
  {
    id: 'seed-huettenkaese-kartoffel', name: 'Ofenkartoffel mit Hüttenkäse', art: 'vegetarisch',
    kcal: 400, protein: 26, kh: 52, fett: 8, preis: 1.20, zeit: 50, aufwand: 1, abwasch: 1,
    beschreibung: 'Kartoffel in den Ofen, 200 g Hüttenkäse mit Schnittlauch darüber. Lange Wartezeit, aber fast keine Arbeit.',
  },
  {
    id: 'seed-couscous-kichererbsen', name: 'Couscous-Salat mit Kichererbsen', art: 'vegan',
    kcal: 520, protein: 20, kh: 84, fett: 10, preis: 1.40, zeit: 12, aufwand: 1, abwasch: 1,
    beschreibung: 'Couscous nur mit heißem Wasser quellen lassen, Kichererbsen, Gurke, Tomate, Zitrone dazu. Kein Kochen nötig.',
  },
  {
    id: 'seed-bauernfruehstueck', name: 'Bauernfrühstück mit Kartoffeln und Ei', art: 'vegetarisch',
    kcal: 530, protein: 24, kh: 48, fett: 26, preis: 1.30, zeit: 25, aufwand: 2, abwasch: 2,
    beschreibung: 'Gekochte Kartoffeln vom Vortag anbraten, drei Eier darüber. Gute Resteverwertung.',
  },
  {
    id: 'seed-putengeschnetzeltes', name: 'Putengeschnetzeltes mit Vollkornnudeln', art: 'fleisch',
    kcal: 600, protein: 50, kh: 70, fett: 10, preis: 2.60, zeit: 25, aufwand: 2, abwasch: 3,
    beschreibung: '150 g Putenbrust, Champignons, etwas Sahne oder Frischkäse, Vollkornnudeln. Höchster Eiweißgehalt im Feld.',
  },
  {
    id: 'seed-bohnen-quesadilla', name: 'Bohnen-Quesadilla', art: 'vegetarisch',
    kcal: 560, protein: 27, kh: 62, fett: 22, preis: 1.70, zeit: 15, aufwand: 2, abwasch: 2,
    beschreibung: 'Schwarze Bohnen zerdrücken, mit Käse zwischen zwei Tortillas in der Pfanne backen. Sehr sättigend.',
  },
  {
    id: 'seed-erbsensuppe', name: 'Erbsensuppe mit Würstchen', art: 'fleisch',
    kcal: 480, protein: 30, kh: 52, fett: 16, preis: 1.40, zeit: 45, aufwand: 2, abwasch: 1,
    beschreibung: 'Getrocknete Schälerbsen mit Suppengrün weich kochen, ein Würstchen klein geschnitten dazu. Ein Topf, große Menge.',
  },
  {
    id: 'seed-protein-pancakes', name: 'Haferflocken-Protein-Pancakes', art: 'vegetarisch',
    kcal: 450, protein: 34, kh: 50, fett: 11, preis: 1.30, zeit: 15, aufwand: 2, abwasch: 2,
    beschreibung: '50 g Haferflocken, zwei Eier, 150 g Quark zu einem Teig mixen und als kleine Pfannkuchen backen.',
  },
  {
    id: 'seed-lachs-kartoffeln', name: 'Ofenlachs mit Kartoffeln und Gemüse', art: 'fisch',
    kcal: 620, protein: 40, kh: 48, fett: 28, preis: 4.20, zeit: 35, aufwand: 2, abwasch: 2,
    beschreibung: 'Alles zusammen auf ein Blech in den Ofen. Teuerstes Gericht hier, dafür fast keine Arbeit und nur ein Blech abzuwaschen.',
  },
  {
    id: 'seed-hack-reispfanne', name: 'Hackfleisch-Reispfanne mit Paprika', art: 'fleisch',
    kcal: 640, protein: 40, kh: 66, fett: 20, preis: 2.30, zeit: 25, aufwand: 2, abwasch: 2,
    beschreibung: '125 g Hackfleisch, Paprika, Zwiebel, gekochter Reis, alles in einer Pfanne. Klassisches Mealprep-Gericht.',
  },
  {
    id: 'seed-omelett-spinat', name: 'Omelett mit Spinat und Käse', art: 'vegetarisch',
    kcal: 420, protein: 32, kh: 6, fett: 30, preis: 1.50, zeit: 12, aufwand: 2, abwasch: 2,
    beschreibung: 'Drei Eier, TK-Blattspinat, 30 g geriebener Käse. Sehr wenig Kohlenhydrate, viel Eiweiß.',
  },
  {
    id: 'seed-sojaschnetzel-gulasch', name: 'Sojaschnetzel-Gulasch', art: 'vegan',
    kcal: 480, protein: 42, kh: 50, fett: 9, preis: 1.60, zeit: 30, aufwand: 2, abwasch: 2,
    beschreibung: 'Sojaschnetzel in Gemüsebrühe quellen lassen, mit Paprika, Zwiebeln und Tomatenmark schmoren. Mehr Eiweiß als die meisten Fleischgerichte.',
  },
  {
    id: 'seed-reis-bohnen-ei', name: 'Reis mit schwarzen Bohnen und Spiegelei', art: 'vegetarisch',
    kcal: 580, protein: 26, kh: 88, fett: 13, preis: 1.10, zeit: 20, aufwand: 1, abwasch: 2,
    beschreibung: 'Reis, eine Dose schwarze Bohnen, zwei Spiegeleier obendrauf. Billig, sättigend und in 20 Minuten fertig.',
  },
  {
    id: 'seed-makkaroni-thunfischquark', name: 'Makkaroni mit Thunfisch-Quark-Sauce', art: 'fisch',
    kcal: 650, protein: 52, kh: 90, fett: 9, preis: 2.10, zeit: 15, aufwand: 1, abwasch: 2,
    beschreibung: 'Nudeln kochen, Magerquark mit etwas Nudelwasser glattrühren, Thunfisch unterheben. Sehr hoher Eiweißgehalt.',
  },
  {
    id: 'seed-spinat-dal', name: 'Spinat-Dal mit Fladenbrot', art: 'vegan',
    kcal: 540, protein: 26, kh: 78, fett: 11, preis: 1.50, zeit: 25, aufwand: 2, abwasch: 2,
    beschreibung: 'Rote Linsen mit TK-Spinat, Knoblauch und Ingwer, dazu Fladenbrot. Ein Topf.',
  },
  {
    id: 'seed-joghurt-bowl', name: 'Joghurt-Bowl mit Haferflocken und Apfel', art: 'vegetarisch',
    kcal: 390, protein: 24, kh: 54, fett: 8, preis: 1.00, zeit: 4, aufwand: 1, abwasch: 1,
    beschreibung: '200 g griechischer Joghurt, 40 g Haferflocken, ein geraspelter Apfel. Abends ansetzen, morgens essen.',
  },
  {
    id: 'seed-linsensalat-feta', name: 'Linsensalat mit Feta', art: 'vegetarisch',
    kcal: 460, protein: 26, kh: 46, fett: 18, preis: 1.80, zeit: 20, aufwand: 2, abwasch: 2,
    beschreibung: 'Belugalinsen kochen, abkühlen lassen, mit Gurke, Tomate, roter Zwiebel und 50 g Feta mischen. Hält sich zwei Tage im Kühlschrank.',
  },
  {
    id: 'seed-haehnchen-wrap', name: 'Hähnchen-Wrap mit Joghurtsauce', art: 'fleisch',
    kcal: 520, protein: 42, kh: 48, fett: 16, preis: 2.40, zeit: 15, aufwand: 2, abwasch: 2,
    beschreibung: '120 g Hähnchen anbraten, mit Salat, Tomate und Joghurt-Knoblauch-Sauce in einen Wrap. Gut zum Mitnehmen.',
  },
];

export const ART_LABELS = {
  vegan: 'vegan',
  vegetarisch: 'vegetarisch',
  fisch: 'mit Fisch',
  fleisch: 'mit Fleisch',
};

export const ART_FARBEN = {
  vegan: '#16a34a',
  vegetarisch: '#65a30d',
  fisch: '#0891b2',
  fleisch: '#dc2626',
};
