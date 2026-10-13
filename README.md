# Finanzy

Acht Werkzeuge rund um den eigenen Alltag, als statische Web-App ohne Build-Schritt und ohne Abhängigkeiten. Eine Startseite führt in die Bereiche und zeigt je eine Kennzahl:

- **Geldfluss** – ein Sankey-Diagramm im Finanzfluss-Stil: alle Einnahmequellen laufen in einen Einnahmen-Knoten und von dort in Ausgabenkategorien und deren Unterposten.
- **Konten** – das eigene Kontomodell: Konten als frei verschiebbare Knoten mit Kontostand, Bank und Notiz, verbunden durch Pfeile mit Beträgen.
- **Immobilien** – ein Renditerechner für Kapitalanlagen: Kaufnebenkosten, Annuitätendarlehen, Mietrenditen, Cashflow vor und nach Steuern. Beliebig viele Objekte nebeneinander.
- **Gerichte** – eine Sammlung günstiger, eiweißreicher Gerichte mit Nährwerten, Preis je Portion, Kochzeit sowie Skalen für Kochaufwand und Abwasch. Gerichte lassen sich merken und selbst anlegen; selbst angelegte sind für alle Nutzer sichtbar.
- **Wochenplan** – Essen für die Woche einteilen; die Einkaufsliste entsteht daraus, mit zusammengerechneten Mengen je Portionenzahl.
- **Schulden** – wer dir was schuldet und was du schuldest, erfasst über einen ganzen Satz statt über ein Formular.
- **Gruppenkasse** – gemeinsame Ausgaben einer Reise oder WG, mit Ausgleichsrechnung am Ende.
- **Tanken** – eine Tanktabelle: je Füllung Datum, Liter, Preis und Tachostand; Verbrauch, Preis je Liter und Kosten je Kilometer ergeben sich daraus.

Alles wird direkt in der Oberfläche eingetippt. Hinter einem Login mit E-Mail und Passwort liegen die Daten in einem eigenen Konto, sodass auf jedem Gerät dieselben Zahlen stehen.

## Loslegen

Die App besteht nur aus HTML, CSS und JavaScript (ES-Module). Ein Server wird trotzdem gebraucht, weil Browser ES-Module nicht über `file://` laden:

```bash
python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen, ein Profil anlegen und loslegen.

## Auf GitHub Pages veröffentlichen

Es braucht keinen Actions-Workflow – die Dateien liegen im Repo-Root und können direkt ausgeliefert werden:

1. Repository auf GitHub pushen.
2. Im Repo auf **Settings → Pages** gehen.
3. Unter *Build and deployment* als Source **Deploy from a branch** wählen, Branch `main` und Ordner `/ (root)`.
4. Nach ein bis zwei Minuten ist die App unter `https://<benutzername>.github.io/<repo>/` erreichbar.

Pages liefert über HTTPS aus, was Supabase für die Anmeldung voraussetzt.

## Bedienung

**Geldfluss.** Rechts stehen zwei Abschnitte: oben **Einnahmen**, darunter **Ausgaben** – jeweils nur Bezeichnung und Betrag, kein Von/Nach. Jede Ausgabenkategorie lässt sich über „+ Unterposten“ weiter aufschlüsseln, zum Beispiel *Wohnen 950 €* in Miete, Strom, Internet und Nebenkosten. Eine Kategorie zu löschen entfernt ihre Unterposten gleich mit.

Stimmen die Unterposten nicht mit ihrer Kategorie überein, steht der Rest direkt darunter (*„120 € noch nicht aufgeteilt“*). Unter dem Diagramm erscheinen dieselben Hinweise für den gesamten Fluss, etwa *„Einnahmen: 2.800 € rein, 2.600 € raus → 200 € nicht zugeordnet“*. Beides sind Warnungen, keine Sperren – unvollständige Zwischenstände sind erlaubt.

Über dem Diagramm schaltet **€ / % / beides** um, wie die Zahlen an den Posten stehen. Bezugsgröße für die Prozente ist die Summe aller Einnahmequellen – der Einnahmen-Knoten ist also immer 100 %.

Farben vergibt die App automatisch: der Einnahmen-Knoten bleibt neutral, jede Ausgabenkategorie bekommt eine eigene Farbe und ihre Unterposten einen helleren Ton davon. Jede Farbe lässt sich unter „Farben“ überschreiben und mit „auto“ wieder freigeben.

**Konten.** Konten lassen sich mit der Maus frei anordnen; die Positionen werden mitgespeichert. Neben Name, Art und Kontostand gibt es optional eine **Bank** (erscheint in der Kopfzeile des Knotens, z. B. `GIROKONTO · DKB`) und eine **Info** für eine kurze Notiz wie „Gehalt & Lastschriften“ – Konten ohne Notiz bleiben kompakt. Der vollständige Text steht im Tooltip, falls er auf dem Knoten gekürzt wird.

Die **Farbe** eines Kontos steht im Farbfeld links neben Bank und Info. Ohne eigene Wahl richtet sie sich nach der Kontoart; ein Doppelklick auf das Feld gibt sie wieder frei.

Für eine Umbuchung auf **Verbinden** klicken, dann Quell- und Zielkonto anklicken und rechts den Betrag eintragen. Kredite werden mit negativem Stand erfasst und gehen so korrekt ins Nettovermögen ein.

Die **Beschriftung einer Umbuchung lässt sich frei verschieben**, wenn sie auf einer Linie liegt oder eine andere überdeckt. Weiter entfernte Beschriftungen bekommen eine gestrichelte Linie zu ihrem Pfeil. „Anordnen“ setzt Konten und Beschriftungen wieder auf die Standardpositionen.

**Immobilien.** Oben die angelegten Objekte als Reiter, daneben *+ Immobilie*, *Duplizieren* und *Löschen* – Duplizieren eignet sich, um zwei Finanzierungsvarianten desselben Objekts zu vergleichen. Rechts die Eingaben in fünf Blöcken (Objekt, Kaufpreis und Nebenkosten, Finanzierung, Miete und Bewirtschaftung, Steuer).

Zwei Felder füllen sich von selbst und lassen sich trotzdem überschreiben: Die Wahl des **Bundeslands** setzt die Grunderwerbsteuer, das **Baujahr** den AfA-Satz (2,5 % vor 1925, 2 % bis 2022, 3 % ab 2023).

Berechnet werden Bruttomietrendite (Jahresmiete ÷ Kaufpreis), Nettomietrendite (nach Bewirtschaftung, auf die Gesamtinvestition), Kaufpreisfaktor, Cashflow vor und nach Steuern sowie die Eigenkapitalrendite. Das Darlehen wird als Annuitätendarlehen monatsgenau durchgerechnet; darunter zeigt eine Kurve die Restschuld bis zum Ende der Zinsbindung.

Die Zahlen sind eine Überschlagsrechnung, keine Steuerberatung. Vereinfacht gilt: gezeigt ist jeweils das erste Jahr, die Instandhaltungsrücklage wirkt steuerlich eigentlich erst beim tatsächlichen Ausgeben, und das Mietausfallwagnis mindert den Cashflow, ist aber keine Werbungskostenposition.

**Gerichte.** Die Startdatenbank enthält 48 einfache Gerichte, ausgewählt nach viel Eiweiß für wenig Geld. Jedes bringt Zutatenliste und Schritt-für-Schritt-Anleitung mit, aufklappbar über „Zutaten und Zubereitung". Oben wird gefiltert (Suche, vegan / vegetarisch / mit Fleisch und Fisch, Höchstpreis, Höchstzeit, Mindest-Eiweiß) und sortiert – voreingestellt nach **Eiweiß je Euro**, der Kennzahl, um die es hier geht. Ein Filter auf „Vegetarisch" zeigt vegane Gerichte mit an.

Das Herz merkt ein Gericht; „Nur gemerkte" blendet auf die eigene Auswahl ein. Die gemerkten Gerichte hängen am Konto und sind auf jedem Gerät dieselben.

Die Teller-Abbildungen sind **gezeichnet, keine Fotos**: Fotos müssten gehostet und lizenziert werden, und ein beliebiges Bild wäre irreführender als gar keins. Die Anordnung leitet sich aus dem Namen ab, dasselbe Gericht sieht also immer gleich aus.

Rechts lassen sich eigene Gerichte anlegen. **Diese sind für alle Nutzer der Seite sichtbar** – ein eigenes Gericht kann nur sein Urheber wieder löschen. Die Startgerichte stehen im Code (`js/gerichte-daten.js`) und lassen sich dort erweitern; nur selbst angelegte liegen in der Datenbank.

**Wochenplan.** Sieben Tage mit je einem Platz für Mittag und Abend, dazu die Zahl der Portionen. Rechts entsteht daraus die **Einkaufsliste**: Mengen werden über alle Gerichte und Portionen zusammengerechnet (`250 g Magerquark` dreimal eingeplant werden zu `750 g`), alphabetisch sortiert und zum Abhaken. Zeilen ohne Zahl wie „Salz, Pfeffer" werden gezählt statt addiert.

Jedes Gericht trägt zusätzlich, ob es **warm gemacht werden muss, kalt essbar ist oder beides geht**. Beim Mittagessen steht darum unter der Einkaufsliste, welche Gerichte eine Mikrowelle brauchen – ein Linsensalat geht kalt, eine Bolognese nicht. Im Gerichte-Bereich lässt sich danach filtern.

**Rezept einfügen.** Im Formular unter „Rezept als Text einfügen" lässt sich ein ganzes Rezept hineinkopieren; Name, Zutaten und Schritte werden erkannt und oben eingetragen. Überschriften wie „Zutaten" und „Zubereitung" trennen die Abschnitte, nummerierte Zeilen gelten als Schritte, Zeilen mit Mengenangabe als Zutaten. Nährwerte und Preis bleiben Handarbeit.

Aus einem **Screenshot** geht es über den Umweg des Telefons: auf dem iPhone lange auf den Text im Bild tippen, kopieren, einfügen. Die App selbst liest keine Bilder – dafür bräuchte sie Texterkennung samt Sprachmodell.

**Schulden.** Erfasst wird über einen Satz: *„Max schuldet mir 20 Euro fürs Kino"*. Daraus liest die App Name, Betrag, Richtung, Grund und Datum und zeigt das Ergebnis zur Kontrolle an, bevor es eingetragen wird. Auf dem Handy kann der Satz diktiert werden – entweder über den Aufnahmeknopf oder über das Mikrofon der eigenen Tastatur.

Dahinter steckt **kein Sprachmodell, sondern ein Regelwerk** (`js/schulden-text.js`). Ein Modell bräuchte einen Schlüssel im Browser, der in einem öffentlichen Repo für jeden lesbar wäre; für den engen Satzbau reichen Regeln, und sie laufen ohne Netz, ohne Kosten und ohne dass ein Satz das Gerät verlässt. Erkannt werden unter anderem „schuldet mir", „ich schulde", „hat mir geliehen", „für X bezahlt", „gestern" sowie Beträge mit Komma und Tausenderpunkt.

Fehlt etwas, sagt die Vorschau welches Feld. Ist die Richtung nur geraten, wird das dazugeschrieben und lässt sich in der Liste mit einem Klick umdrehen. Posten werden nach Person gruppiert, erledigte wandern in einen eigenen Abschnitt statt gelöscht zu werden.

**Gruppenkasse.** Für eine Reise oder WG: Personen anlegen, Ausgaben eintragen mit *wer hat gezahlt* und *wer war beteiligt*. Geteilt wird zu gleichen Teilen unter den Beteiligten – wer beim Abendessen nicht dabei war, wird abgewählt und zahlt nichts mit.

Daraus ergibt sich je Person, was sie gezahlt hat und was ihr Anteil war. Der **Ausgleich** rechnet daraus die wenigsten nötigen Zahlungen aus: Er stellt immer den größten Schuldner dem größten Gläubiger gegenüber, wodurch bei drei Personen zwei Überweisungen genügen statt sechs.

Eine Person ist als „ich" markiert; die Kopfzeile sagt dann direkt, ob du am Ende Geld bekommst oder zahlen musst.

**Tanken.** Pro Tankfüllung werden nur vier Dinge eingetragen: Datum, getankte Liter, bezahlter Betrag und Tachostand. Die gefahrenen Kilometer sind die Differenz zum vorherigen Tachostand, daraus folgen Verbrauch (l/100 km), Preis je Liter und Kosten je Kilometer. Sortiert wird nach Tachostand, nicht nach Datum – so stimmt die Reihenfolge auch, wenn eine Quittung später nachgetragen wird.

Unter dem Eingabeformular steht **Aus Tabelle übernehmen**: Zeilen aus Excel oder Numbers einfügen, auf *Auswerten* klicken, fertig. Die Spalten erkennt die App selbst – den Tachostand an der Größenordnung, die Literspalte daran, dass Betrag ÷ Liter einen realistischen Spritpreis ergibt. Die Zuordnung wird zum Prüfen angezeigt und lässt sich korrigieren. Überflüssige Spalten und Kopfzeilen stören nicht, und bereits vorhandene Tachostände werden übersprungen, sodass zweimaliges Einfügen keine Doppelten anlegt.

Jede Tankfüllung lässt sich **markieren** – Urlaub, Autobahn, Stadt, Anhänger und so weiter, eigene Begriffe gehen auch. In der Tabelle öffnet ein Klick auf die Spalte *Markierung* die Auswahl für diese Zeile. Über den Kennzahlen stehen die vorhandenen Markierungen als Schalter: abgewählt fällt die Füllung mitsamt ihren Kilometern aus der Rechnung, sodass eine Urlaubsfahrt den Alltagsverbrauch nicht verzerrt. Weicht eine Markierung deutlich ab, steht der Vergleich darunter (*„Mit Urlaub 8,74 l, sonst 6,08 l"*), und in der Kurve sind markierte Füllungen als Ringe zu erkennen.

Über den Kennzahlen lässt sich der **Zeitraum** umschalten: alle Daten, 12 Monate, 3 Monate oder ein eigener – entweder als Anzahl Monate zurück von heute oder als feste Spanne von/bis. Der Zeitraum gilt für alles: Kennzahlen, Kurve und Tabelle zeigen dann nur noch, was hineinfällt. Rechts unter **Feste Kosten** kommen Versicherung, Kfz-Steuer, Wartung und Sonstiges als Jahresbeträge hinein; die App rechnet sie auf Monat und Kilometer herunter. Damit zeigen die Kacheln nicht nur den Sprit, sondern was das Auto insgesamt kostet – je Monat, je Jahr und je gefahrenem Kilometer.

Die erste Füllung liefert nur den Startpunkt und hat deshalb keinen Verbrauchswert; sie zählt auch nicht in den Gesamtverbrauch hinein. Ein neuer Tachostand muss über dem letzten liegen, sonst wird der Eintrag abgelehnt. Oben stehen die Gesamtwerte, darunter zeigt eine Kurve den Verbrauch je Füllung gegen den Schnitt.

**Daten-Menü.** Diagramm als SVG oder PNG exportieren, eine Sicherung als JSON herunterladen und wieder einspielen, oder alles auf die Startwerte zurücksetzen.

## Zeichen und Startseite

Das Zeichen ist ein **F**, dessen beide Querbalken keine Striche sind, sondern Bänder, die aus dem Stamm austreten und nach außen dünner werden – dieselbe Verjüngung wie bei einem Sankey-Band, das sich weiter aufteilt. Es trägt damit den Namen und den Vorgang, um den sich die App dreht.

Für Browser-Tab und Home-Bildschirm gibt es dieselbe Form im abgerundeten Quadrat (`blockSvg`). Das ist kein zweites Logo, sondern nötig, weil ein freistehendes Zeichen auf einem bunten Hintergrundbild untergeht. Beides steht in `js/logo.js`; Kopfzeile, Startseite, Login und Favicon greifen auf dieselben Pfade zu.

Die **Startseite** beantwortet zuerst „wie steht der Monat" und dann „wo will ich hin": oben Einnahmen, Ausgaben und was übrig bleibt, dazu ein Balken, wie viel der Einnahmen die Ausgaben auffressen, und ein Satz zur Sparquote. Darunter die fünf Bereiche als Kacheln mit je einer Kennzahl.

## Nachrichten auf der Startseite

Oben rechts auf der Startseite liegt eine **Münze für schnelle Entscheidungen** – antippen, sie dreht sich und fällt auf Kopf oder Zahl. Kopf ist ein Piñata-Lama, Zahl das Finanzy-Zeichen. Das Lama ist selbst gezeichnet und keine Nachbildung einer geschützten Spielfigur.

Unter den Bereichskacheln stehen sechs Wirtschaftsmeldungen von tagesschau und Spiegel, verlinkt auf den jeweiligen Artikel.

Der Abruf passiert **nicht im Browser**: Beide Feeds senden keine CORS-Header, eine Seite auf `github.io` dürfte sie gar nicht laden. Stattdessen holt sie der Ablauf `.github/workflows/nachrichten.yml` einmal täglich um 05:17 UTC, `scripts/nachrichten.py` schreibt daraus `daten/nachrichten.json`, und der Ablauf committet die Datei nur, wenn sich etwas geändert hat. Die App lädt sie dann von ihrer eigenen Adresse – kein fremder Dienst zur Laufzeit, kein Schlüssel, keine Kosten.

Das Skript braucht nur die Python-Standardbibliothek und lässt sich jederzeit von Hand ausführen:

```bash
python3 scripts/nachrichten.py
```

**Nebenwirkung:** Der Ablauf legt täglich einen Commit an. Vor dem nächsten eigenen Push muss also in GitHub Desktop erst **Fetch origin** und **Pull** gedrückt werden, sonst lehnt GitHub den Push ab.

## Hell und dunkel

Oben rechts schaltet ein Knopf zwischen **Folgt dem Gerät**, **Immer hell** und **Immer dunkel** um. Die Wahl liegt im `localStorage` und damit beim Gerät, nicht beim Konto – auf dem Handy darf dunkel sein, während der Rechner hell bleibt.

Ein kleines Skript im `<head>` setzt die Einstellung vor dem ersten Zeichnen, sonst blitzt beim Laden kurz das helle Design auf. Im Stylesheet stehen die dunklen Farbwerte zweimal: einmal unter `prefers-color-scheme` mit `:root:not([data-theme="light"])`, damit die Geräteeinstellung greift, und einmal unter `:root[data-theme="dark"]` für die Wahl von Hand.

## Auf dem Handy

Die App ist für beide Größen gebaut. Unter 760 px Breite:

- Die Reiterleiste rückt in eine eigene, seitlich scrollbare Zeile – sonst wären die hinteren Bereiche nicht erreichbar.
- Eingabezeilen brechen um, statt sich zusammenzuquetschen; Spaltenköpfe verschwinden, weil sie ohne feste Spalten nichts mehr ausrichten.
- Alle Felder haben mindestens 16 px Schriftgröße, sonst zoomt iOS beim Antippen hinein.
- Kennzahlen stehen zweispaltig, Knöpfe sind mindestens 38 px hoch.
- Konten und Beschriftungen im Kontomodell haben `touch-action: none`, damit das Ziehen nicht die Seite mitscrollt.

Breite Inhalte – Sankey, Kontenfläche, Tanktabelle – scrollen innerhalb ihres Rahmens; die Seite selbst läuft nie seitlich über.

## Konto und Datenablage

Anmeldung und Speicherung laufen über [Supabase](https://supabase.com) (Projekt `finanzy`, Region Frankfurt). Die App spricht dessen REST- und Auth-Schnittstelle direkt per `fetch` an – kein SDK, damit es beim build-freien Aufbau bleibt.

Jede Person hat genau eine Zeile in der Tabelle `finanzen`, in der der gesamte Datenstand als JSON liegt. Row Level Security sorgt dafür, dass jeder Zugriff auf `auth.uid() = user_id` beschränkt ist – fremde Zeilen sind nicht lesbar, auch nicht mit dem öffentlichen Schlüssel.

Was das heißt:

- **Auf jedem Gerät dieselben Zahlen.** Seite aufrufen, anmelden, fertig. Die Sitzung bleibt erhalten, ein erneuter Login ist erst nötig, wenn man sich abmeldet.
- **Passwort vergessen funktioniert** über „Passwort vergessen?" auf dem Login-Bildschirm.
- **Die Daten liegen unverschlüsselt in der Datenbank**, geschützt durch die Zugriffsregeln und TLS. Der Betreiber der Datenbank könnte technisch hineinsehen. Das war der bewusste Tausch gegen einen funktionierenden Passwort-Reset.
- Der im Code stehende `sb_publishable_…`-Schlüssel ist **zur Veröffentlichung gedacht**. Er identifiziert das Projekt, er autorisiert nichts – das tun die Zugriffsregeln. Der `service_role`-Schlüssel darf dagegen niemals in den Code.
- Scheitert ein Speichervorgang (kein Netz), bleibt der letzte Stand unter `finanzsankey.backup.<id>` im Browser liegen und wird beim nächsten erfolgreichen Speichern wieder entfernt.

### Einrichtung eines eigenen Supabase-Projekts

Falls das Backend neu aufgesetzt werden muss: Projekt anlegen, im SQL-Editor ausführen –

```sql
create table if not exists public.finanzen (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.finanzen enable row level security;
grant select, insert, update, delete on public.finanzen to authenticated;
create policy "Eigene Daten lesen"   on public.finanzen for select using (auth.uid() = user_id);
create policy "Eigene Daten anlegen" on public.finanzen for insert with check (auth.uid() = user_id);
create policy "Eigene Daten aendern" on public.finanzen for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Für die geteilten Gerichte zusätzlich:

```sql
create table if not exists public.gerichte (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references auth.users on delete cascade,
  autor_name text,
  name text not null check (char_length(name) between 1 and 120),
  beschreibung text check (beschreibung is null or char_length(beschreibung) <= 1000),
  art text not null default 'vegetarisch' check (art in ('vegan','vegetarisch','fisch','fleisch')),
  zutaten text[] not null default '{}' check (array_length(zutaten, 1) is null or array_length(zutaten, 1) <= 40),
  schritte text[] not null default '{}' check (array_length(schritte, 1) is null or array_length(schritte, 1) <= 40),
  kcal int not null default 0 check (kcal between 0 and 5000),
  protein int not null default 0 check (protein between 0 and 500),
  kh int not null default 0 check (kh between 0 and 1000),
  fett int not null default 0 check (fett between 0 and 500),
  preis numeric(6,2) not null default 0 check (preis between 0 and 999),
  zeit int not null default 0 check (zeit between 0 and 1440),
  aufwand int not null default 1 check (aufwand between 1 and 5),
  abwasch int not null default 1 check (abwasch between 1 and 5),
  created_at timestamptz not null default now()
);
alter table public.gerichte enable row level security;
grant select, insert, update, delete on public.gerichte to authenticated;
create policy "Gerichte lesen"   on public.gerichte for select to authenticated using (true);
create policy "Gericht anlegen"  on public.gerichte for insert to authenticated with check (auth.uid() = autor);
create policy "Eigenes aendern"  on public.gerichte for update to authenticated using (auth.uid() = autor) with check (auth.uid() = autor);
create policy "Eigenes loeschen" on public.gerichte for delete to authenticated using (auth.uid() = autor);
```

Anders als bei `finanzen` darf hier jeder jede Zeile **lesen** – das ist der Zweck der geteilten Sammlung. Ändern und löschen kann weiterhin nur, wem die Zeile gehört. Die CHECK-Bedingungen begrenzen, was eine fremde Eingabe anrichten kann.

Zum Schluss unter *Authentication → Email* die Bestätigungsmail abschalten und `BASE` sowie `KEY` oben in `js/cloud.js` eintragen.

## Aufbau

```
index.html            Login-Maske und App-Shell
css/style.css         Design-Tokens, Light/Dark über prefers-color-scheme
js/app.js             Bootstrap, Tabs, Datenmenü, Export-Aktionen
js/cloud.js           Supabase: Anmeldung, Token-Erneuerung, Laden/Speichern
js/vault.js           Lesezugriff auf den alten lokalen Tresor (nur Übernahme)
js/store.js           Zustand, Startdaten, Migration, gebündeltes Speichern
js/sankey.js          Sankey-Layout und SVG-Rendering
js/sankey-editor.js   Einnahmen/Ausgaben-Editor und Farbzuweisung
js/accounts.js        Kontengraph (Ziehen, Verbinden) und dessen Editor
js/immobilien.js      Immobilienrechner: Berechnung, Kennzahlen, Tilgungskurve
js/gerichte.js        Gerichte: Filter, Karten, Merken, Formular
js/gerichte-daten.js  Startdatenbank der Gerichte
js/tanken.js          Tanktabelle: Auswertung, Verbrauchskurve, Eingabe
js/dashboard.js       Startseite mit den Bereichskacheln
js/logo.js            Wortmarke, Bereichssymbole und Favicon als Inline-SVG
js/export.js          SVG-, PNG- und JSON-Download
js/util.js            Formatierung, Farbhilfen, DOM-Helfer
```

Das Sankey-Layout ist selbst implementiert: Spalten über den längsten Pfad, Kreislauferkennung, Skalierung an der vollsten Spalte und Kreuzungsreduktion über Schwerpunkte der Nachbarspalte.

Intern sind beide Ansichten Graphen aus Knoten und Flüssen. Der Geldfluss-Editor ist nur eine Sicht darauf: Einnahmen sind Flüsse *in* den Knoten `einnahmen`, Ausgaben Flüsse *aus* ihm heraus, Unterposten Flüsse aus einer Kategorie. Deshalb kommt er ohne Von/Nach-Spalten aus.
