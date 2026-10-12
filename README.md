# Finanz-Sankey & Kontomodell

Zwei Ansichten für die eigenen Finanzen, als statische Web-App ohne Build-Schritt und ohne Abhängigkeiten:

- **Geldfluss** – ein Sankey-Diagramm im Finanzfluss-Stil: alle Einnahmequellen laufen in einen Einnahmen-Knoten und von dort in Ausgabenkategorien und deren Unterposten.
- **Konten** – das eigene Kontomodell: Konten als frei verschiebbare Knoten mit Kontostand, Bank und Notiz, verbunden durch Pfeile mit Beträgen.

Alles wird direkt in der Oberfläche eingetippt und verschlüsselt im Browser gespeichert.

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

Pages liefert über HTTPS aus – das ist wichtig, weil die Verschlüsselung die WebCrypto-API braucht, die nur auf `https` und `localhost` verfügbar ist.

## Bedienung

**Geldfluss.** Rechts stehen zwei Abschnitte: oben **Einnahmen**, darunter **Ausgaben** – jeweils nur Bezeichnung und Betrag, kein Von/Nach. Jede Ausgabenkategorie lässt sich über „+ Unterposten“ weiter aufschlüsseln, zum Beispiel *Wohnen 950 €* in Miete, Strom, Internet und Nebenkosten. Eine Kategorie zu löschen entfernt ihre Unterposten gleich mit.

Stimmen die Unterposten nicht mit ihrer Kategorie überein, steht der Rest direkt darunter (*„120 € noch nicht aufgeteilt“*). Unter dem Diagramm erscheinen dieselben Hinweise für den gesamten Fluss, etwa *„Einnahmen: 2.800 € rein, 2.600 € raus → 200 € nicht zugeordnet“*. Beides sind Warnungen, keine Sperren – unvollständige Zwischenstände sind erlaubt.

Farben vergibt die App automatisch: der Einnahmen-Knoten bleibt neutral, jede Ausgabenkategorie bekommt eine eigene Farbe und ihre Unterposten einen helleren Ton davon. Jede Farbe lässt sich unter „Farben“ überschreiben und mit „auto“ wieder freigeben.

**Konten.** Konten lassen sich mit der Maus frei anordnen; die Positionen werden mitgespeichert. Neben Name, Art und Kontostand gibt es optional eine **Bank** (erscheint in der Kopfzeile des Knotens, z. B. `GIROKONTO · DKB`) und eine **Info** für eine kurze Notiz wie „Gehalt & Lastschriften“ – Konten ohne Notiz bleiben kompakt. Der vollständige Text steht im Tooltip, falls er auf dem Knoten gekürzt wird.

Für eine Umbuchung auf **Verbinden** klicken, dann Quell- und Zielkonto anklicken und rechts den Betrag eintragen. Kredite werden mit negativem Stand erfasst und gehen so korrekt ins Nettovermögen ein.

**Daten-Menü.** Diagramm als SVG oder PNG exportieren, die Rohdaten als JSON sichern, den verschlüsselten Tresor exportieren und importieren, oder alles auf die Startwerte zurücksetzen.

## Wie die Daten gespeichert werden

Die Daten liegen ausschließlich im `localStorage` des jeweiligen Browsers. Beim Anlegen eines Profils wird aus dem Passwort per PBKDF2-SHA-256 (250.000 Runden) ein AES-GCM-256-Schlüssel abgeleitet, mit dem der Datensatz verschlüsselt wird. Jeder Speichervorgang verwendet einen neuen Initialisierungsvektor. Der Schlüssel selbst wird nie gespeichert, sondern existiert nur, solange die Sitzung offen ist.

Was das heißt:

- **Kein Server sieht die Daten.** Es gibt keinen Server – GitHub Pages liefert nur die statischen Dateien aus.
- **Ein vergessenes Passwort kann niemand zurücksetzen.** Dann sind die Daten weg.
- **Es ist kein vollwertiges Benutzerkonto.** Geschützt ist der gespeicherte Datensatz. Wer Zugriff auf die entsperrte Sitzung oder den laufenden Browser hat, sieht die Daten.
- **Kein Sync zwischen Geräten.** Dafür den Tresor exportieren und auf dem anderen Gerät über den Login-Bildschirm importieren. Das Passwort bleibt dasselbe.
- Verschiedene Browser und Profile auf demselben Rechner teilen den Speicher nicht.

## Aufbau

```
index.html            Login-Maske und App-Shell
css/style.css         Design-Tokens, Light/Dark über prefers-color-scheme
js/app.js             Bootstrap, Tabs, Datenmenü, Export-Aktionen
js/vault.js           PBKDF2 + AES-GCM, Profile anlegen/entsperren/speichern
js/store.js           Zustand, Startdaten, Migration, gebündeltes Speichern
js/sankey.js          Sankey-Layout und SVG-Rendering
js/sankey-editor.js   Einnahmen/Ausgaben-Editor und Farbzuweisung
js/accounts.js        Kontengraph (Ziehen, Verbinden) und dessen Editor
js/export.js          SVG-, PNG- und JSON-Download
js/util.js            Formatierung, Farbhilfen, DOM-Helfer
```

Das Sankey-Layout ist selbst implementiert: Spalten über den längsten Pfad, Kreislauferkennung, Skalierung an der vollsten Spalte und Kreuzungsreduktion über Schwerpunkte der Nachbarspalte.

Intern sind beide Ansichten Graphen aus Knoten und Flüssen. Der Geldfluss-Editor ist nur eine Sicht darauf: Einnahmen sind Flüsse *in* den Knoten `einnahmen`, Ausgaben Flüsse *aus* ihm heraus, Unterposten Flüsse aus einer Kategorie. Deshalb kommt er ohne Von/Nach-Spalten aus.
