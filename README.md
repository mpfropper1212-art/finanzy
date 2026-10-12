# Finanz-Sankey & Kontomodell

Zwei Ansichten für die eigenen Finanzen, als statische Web-App ohne Build-Schritt und ohne Abhängigkeiten:

- **Geldfluss** – ein Sankey-Diagramm im Finanzfluss-Stil: alle Einnahmequellen laufen in einen Einnahmen-Knoten und von dort in Ausgabenkategorien und deren Unterposten.
- **Konten** – das eigene Kontomodell: Konten als frei verschiebbare Knoten mit Kontostand, Bank und Notiz, verbunden durch Pfeile mit Beträgen.

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

Farben vergibt die App automatisch: der Einnahmen-Knoten bleibt neutral, jede Ausgabenkategorie bekommt eine eigene Farbe und ihre Unterposten einen helleren Ton davon. Jede Farbe lässt sich unter „Farben“ überschreiben und mit „auto“ wieder freigeben.

**Konten.** Konten lassen sich mit der Maus frei anordnen; die Positionen werden mitgespeichert. Neben Name, Art und Kontostand gibt es optional eine **Bank** (erscheint in der Kopfzeile des Knotens, z. B. `GIROKONTO · DKB`) und eine **Info** für eine kurze Notiz wie „Gehalt & Lastschriften“ – Konten ohne Notiz bleiben kompakt. Der vollständige Text steht im Tooltip, falls er auf dem Knoten gekürzt wird.

Für eine Umbuchung auf **Verbinden** klicken, dann Quell- und Zielkonto anklicken und rechts den Betrag eintragen. Kredite werden mit negativem Stand erfasst und gehen so korrekt ins Nettovermögen ein.

**Daten-Menü.** Diagramm als SVG oder PNG exportieren, eine Sicherung als JSON herunterladen und wieder einspielen, oder alles auf die Startwerte zurücksetzen.

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

– unter *Authentication → Email* die Bestätigungsmail abschalten und `BASE` sowie `KEY` oben in `js/cloud.js` eintragen.

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
js/export.js          SVG-, PNG- und JSON-Download
js/util.js            Formatierung, Farbhilfen, DOM-Helfer
```

Das Sankey-Layout ist selbst implementiert: Spalten über den längsten Pfad, Kreislauferkennung, Skalierung an der vollsten Spalte und Kreuzungsreduktion über Schwerpunkte der Nachbarspalte.

Intern sind beide Ansichten Graphen aus Knoten und Flüssen. Der Geldfluss-Editor ist nur eine Sicht darauf: Einnahmen sind Flüsse *in* den Knoten `einnahmen`, Ausgaben Flüsse *aus* ihm heraus, Unterposten Flüsse aus einer Kategorie. Deshalb kommt er ohne Von/Nach-Spalten aus.
