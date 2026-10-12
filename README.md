# Finanz-Sankey & Kontomodell

Zwei Ansichten für die eigenen Finanzen, als statische Web-App ohne Build-Schritt und ohne Abhängigkeiten:

- **Geldfluss** – ein Sankey-Diagramm im Finanzfluss-Stil: Einnahmen fließen über Steuern und Abgaben zum Netto und von dort in Ausgabenkategorien, Unterkategorien und Sparen.
- **Konten** – das eigene Kontomodell: Konten als frei verschiebbare Knoten mit Kontostand, verbunden durch Pfeile mit Beträgen.

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

**Geldfluss.** Rechts in der Tabelle „Von“, „Nach“ und den Betrag eintragen. Namen werden frei eingetippt – steht dort noch kein Posten mit dem Namen, wird er automatisch angelegt; bestehende Namen schlägt das Feld beim Tippen vor. Ein Posten, der in keinem Fluss mehr vorkommt, verschwindet von selbst.

Unter dem Diagramm erscheinen Hinweise, wenn bei einem Posten Zu- und Abfluss nicht zusammenpassen, zum Beispiel *„Netto: 2.300 € rein, 2.450 € raus → 150 € mehr verteilt als vorhanden“*. Das ist eine Warnung, keine Sperre – unvollständige Zwischenstände sind erlaubt.

Farben vergibt die App automatisch: Posten, die sich weiter aufteilen, bekommen eine eigene Farbe, Unterposten einen helleren Ton ihres Oberpostens. Jede Farbe lässt sich unter „Farben“ überschreiben und mit „auto“ wieder freigeben.

**Konten.** Konten lassen sich mit der Maus frei anordnen; die Positionen werden mitgespeichert. Für eine Umbuchung auf **Verbinden** klicken, dann Quell- und Zielkonto anklicken und rechts den Betrag eintragen. Kredite werden mit negativem Stand erfasst und gehen so korrekt ins Nettovermögen ein.

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
js/sankey-editor.js   Flusstabelle und Farbzuweisung
js/accounts.js        Kontengraph (Ziehen, Verbinden) und dessen Editor
js/export.js          SVG-, PNG- und JSON-Download
js/util.js            Formatierung, Farbhilfen, DOM-Helfer
```

Das Sankey-Layout ist selbst implementiert: Spalten über den längsten Pfad, Kreislauferkennung, Skalierung an der vollsten Spalte und Kreuzungsreduktion über Schwerpunkte der Nachbarspalte.
