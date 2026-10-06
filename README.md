# SQL Spielplatz

**Datenbanken verstehen und auswerten – ohne SQL auswendig zu können.**

Der SQL Spielplatz öffnet SQLite-Datenbanken (z. B. aus Handy-Backups wie WhatsApp oder iPhone-Apps), Excel- und CSV-Dateien und zeigt sie als übersichtliches Diagramm. Abfragen klickst du in drei Schritten zusammen – das passende SQL schreibt sich dabei live mit. So lernst du SQL nebenbei, und wer es schon kann, schreibt es einfach selbst.

- **Eine einzige Datei:** Doppelklick auf `SQL Spielplatz.html` – fertig. Keine Installation, kein Server, kein Konto.
- **Läuft offline:** Alles passiert in deinem Browser. Keine Daten verlassen den Rechner.
- **Originaldateien bleiben unangetastet:** Geöffnete Datenbanken werden nie überschrieben.

---

## Loslegen in einer Minute

1. `SQL Spielplatz.html` im Browser öffnen. Die Beispiel-Datenbank „Plauder“ (ein kleines Messenger-Backup) ist schon geladen.
2. Oben auf **+ Datenbanken öffnen** klicken, um eigene Dateien dazuzunehmen (`.db`, `.sqlite`, `.xlsx`, `.csv` …). Bis zu 10 Dateien können gleichzeitig offen sein.
3. Rechts in drei Schritten die Abfrage bauen und auf **▶ Ausführen** klicken.
4. Ergebnis ansehen und bei Bedarf mit **⤓ CSV** exportieren.

---

## Was du damit machen kannst

### Abfragen zusammenklicken – in drei Schritten

| Schritt | Was du tust |
|---|---|
| **1 Start-Tabelle** | Die Tabelle wählen, um die sich alles dreht – z. B. die Nachrichten. Per Suchliste oder Doppelklick auf eine Karte im Diagramm. |
| **2 Verbinden** | Weitere Tabellen dazuholen – z. B. zu jeder Nachricht den Namen des Absenders. |
| **3 Spalten** | Festlegen, was im Ergebnis stehen soll. Dazu bei Bedarf filtern, gruppieren, sortieren und begrenzen. |

Jeder Schritt erklärt, was jetzt zu tun ist. Ist er erledigt, geht es von selbst weiter.

### Tabellen verbinden – ohne JOIN-Syntax

- **Linie ziehen:** Im Diagramm vom Punkt einer Spalte zu einer passenden Spalte einer anderen Tabelle ziehen (z. B. `nachrichten.kontakt_id` → `nutzer.id`). Daraus wird sofort eine Verbindung.
- **Vorschläge aus der Datei:** Hat der Hersteller der Datenbank festgelegt, wie Tabellen zusammenhängen (Fremdschlüssel), siehst du das als **gepunktete Linie**. Ein Klick übernimmt sie, ✕ blendet sie aus.
- **Selbst wählen:** Fehlt eine Linie, wählst du in Schritt 2 „Tabelle und Spalten selbst wählen“ – das geht auch über zwei Datenbanken hinweg.
- **Eigene Namen (Rollen):** Braucht man eine Tabelle doppelt – etwa Kontakte einmal als *Chatpartner* und einmal als *Absender* –, bekommt jede Verwendung einen eigenen Namen. Namen lassen sich jederzeit ändern. Alles, was daran hängt, wird automatisch mitgeändert.
- **Was passiert mit Zeilen ohne Partner?** Unter jeder Verbindung steht, wie viele Zeilen übrig bleiben. Fallen Zeilen weg, genügt ein Klick auf **Auf LEFT umstellen**. Die Vorschau zeigt alle Join-Arten (INNER, LEFT, RIGHT, FULL, CROSS) mit Zeilenzahlen und Beispielzeilen nebeneinander.

### Das Ergebnis gestalten

- **Spalten auswählen und anordnen:** per „+ Spalte“ oder direkt aus dem Diagramm hineinziehen. Die Reihenfolge änderst du durch **Ziehen am Griff ⠿** oder mit ▲▼.
- **Umbenennen:** Jede Spalte kann einen eigenen Namen im Ergebnis bekommen (auch mit Leerzeichen und Umlauten).
- **Wenn–dann:** z. B. „wenn *gesendet_von_mir* = 1, dann ‚ICH‘, sonst der Name“.
- **Erster vorhandener Wert:** z. B. Adressbuch-Name, sonst WhatsApp-Name, sonst Telefonnummer.
- **Fester Wert:** z. B. `WhatsApp` in jeder Zeile, damit sich Ergebnisse mehrerer Messenger später zusammenführen lassen.
- **Filtern, Gruppieren, Sortieren, Begrenzen:** unter „Außerdem“ in Schritt 3. Beim Filtern schlägt das Wertefeld die vorhandenen Werte der Spalte vor.

### Zeitstempel und Werte lesbar machen

Über **fx** an jeder Spalte gibt es Funktionen für Text, Zahlen und Datum. Sie lassen sich verketten und zeigen gleich eine Vorschau mit echten Daten. Besonders praktisch bei Handy-Datenbanken:

- **Millisekunden-Zeitstempel** (Android, Signal, WhatsApp) → lesbares Datum
- **Unix-Zeit** (Sekunden seit 1970) → lesbares Datum
- **Apple-Zeit** (iPhone-Datenbanken, Zählung ab 1.1.2001) → lesbares Datum. Sekunden, Milli-, Mikro- und Nanosekunden werden automatisch erkannt, also auch die langen Zahlen mit vielen Nullen am Ende.
- jeweils wahlweise in **Ortszeit** oder **UTC** (üblich in Forensik-Berichten)

### Daten finden

- **Spaltensuche** in jeder Tabellenkarte: Treffer werden hervorgehoben, Enter springt zum nächsten.
- **Daten-Vorschau** (▤ an der Karte): die ersten 100 Zeilen einer Tabelle. Das Suchfeld blendet dort alle anderen Spalten aus.

### Ergebnisse weitergeben

- **⤓ CSV** exportiert immer alle Ergebniszeilen. Den Dateinamen trägst du daneben ein, er wird gemerkt.
- **⤓ Abfrage speichern / ⤒ Abfrage laden:** eine gebaute Abfrage als Datei sichern und später wieder öffnen.

### SQL lernen

- Das SQL zu deinen Bausteinen steht immer sichtbar darunter.
- Beim Ausführen zeigt eine Leiste, **in welcher Reihenfolge SQL wirklich arbeitet** (erst FROM, zuletzt LIMIT) und wie viele Zeilen nach jeder Stufe übrig sind.
- Unter **SQL schreiben** tippst du selbst. Mit **☰ In Bausteine umwandeln** wird ein SELECT wieder zu Bausteinen – auch mit Aliasen, CASE und COALESCE.
- **Geführte Aufgaben** zu beiden Beispiel-Datenbanken. Geprüft wird das Ergebnis, nicht der genaue Wortlaut.

---

## Beispiel: WhatsApp-Nachrichten mit Namen

So entsteht aus einer Android-`msgstore.db` eine lesbare Nachrichtenliste mit Namen (geprüft an einem Pixel-10-Abbild, WhatsApp-Stand 2026):

1. **+ Datenbanken öffnen** → `msgstore.db` und `wa.db` (das Adressbuch). Sie heißen in der App dann `msgstore` und `wa`.
2. **Schritt 1:** `message` als Start-Tabelle wählen.
3. **Schritt 2** – die Verbindungen der Reihe nach, jeweils über „+ Tabelle verbinden“ → „Tabelle und Spalten selbst wählen“:

   | Tabelle | Verbindung | Art | Name (Rolle) |
   |---|---|---|---|
   | `chat` | `message.chat_row_id = chat._id` | INNER | – |
   | `jid` | `chat.jid_row_id = jid._id` | INNER | `chatpartner` |
   | `jid_map` | `chatpartner._id = jid_map.lid_row_id` | LEFT | – |
   | `jid` | `jid_map.jid_row_id = jid._id` | LEFT | `nummer` |
   | `wa_contacts` | `nummer.raw_string` **sonst** `chatpartner.raw_string` `= wa_contacts.jid` | LEFT | `kontakt` |

   Warum der Umweg über `jid_map`? Neuere WhatsApp-Versionen führen Chatpartner unter einer anonymen Kennung (`…@lid`), das Adressbuch kennt aber nur Telefonnummern (`…@s.whatsapp.net`). `jid_map` übersetzt die eine in die andere. Das „sonst“ fügst du bei der letzten Verbindung mit **+ sonst andere Spalte (COALESCE)** hinzu – so passen auch Chats, die schon unter der Nummer laufen. Im Testabbild fanden so 46 von 49 Nachrichten einen Namen, ohne `jid_map` nur 19.

   **LEFT** ist wichtig: Gruppen und unbekannte Nummern stehen nicht im Adressbuch – mit INNER würden diese Nachrichten wegfallen.
4. **Schritt 3:** Spalten wählen, benennen und per Drag & Drop anordnen, z. B.
   - `message.timestamp` mit **fx → MS→DATUM** → `Zeit`
   - **+ Erster Wert:** `kontakt.display_name`, sonst `kontakt.wa_name`, sonst `chatpartner.raw_string` → `Chat mit`
   - `message.text_data` → `Text`
5. **▶ Ausführen** und als CSV exportieren.

Den Absender in Gruppen bekommst du genauso: `jid` noch einmal über `message.sender_jid_row_id = jid._id` (LEFT, Rolle `absender`), dann wieder `jid_map` und `wa_contacts` dahinter.

> WhatsApp- und iPhone-Datenbanken enthalten **keine** hinterlegten Fremdschlüssel (im Pixel-10-Abbild: 0 in 314 Tabellen). Deshalb erscheinen dort keine gepunkteten Vorschläge – die Verbindungen legst du selbst an. Geraten wird bewusst nichts.

---

## Das Diagramm

| Linie | Bedeutung |
|---|---|
| **durchgezogen** | Diese Verbindung steckt in deiner Abfrage. ✕ auf der Linie entfernt sie. |
| **gepunktet** | Vorschlag aus der Datei (Fremdschlüssel). Klick = übernehmen, ✕ = für diese Sitzung ausblenden. |
| **blaue Karte** | Eine Ansicht (VIEW) statt einer Tabelle. |

- **Anordnen:** „Nach Datenbank“, „Raster A–Z“ oder „Liste A–Z“. **⛶ Alles einpassen** zoomt auf alle sichtbaren Tabellen.
- **Bewegen:** Freie Fläche ziehen verschiebt die Ansicht, Strg+Mausrad zoomt. Karten lassen sich am Kopf verschieben und am Griff **⤡** in der Größe ändern (↺ setzt zurück).
- **Ausblenden:** Das durchgestrichene Auge an der Karte blendet eine Tabelle aus (mit Rückgängig). Über **▦ Tabellen** holst du sie zurück – mit Suchfeld und „Alle auswählen“ wie beim Excel-Filter. Die Auswahl bleibt auch nach dem Neuladen erhalten.

---

## Ansichten (VIEW): komplizierte Abfragen in zwei Stufen

Wenn eine Abfrage zu groß wird, hilft eine Ansicht – eine gespeicherte Abfrage, die du danach wie eine Tabelle verwendest.

1. **Stufe 1:** Eine Abfrage bauen, z. B. ein Personenverzeichnis aus `jid` und `wa_contacts`, und auf **⊞ Als Ansicht speichern** klicken. Einen Namen vergeben, etwa `personen`.
2. **Stufe 2:** `personen` erscheint als blaue Karte und lässt sich wie jede Tabelle verbinden – z. B. einmal als `chatpartner` und einmal als `absender`.

Ansichten gelten, solange die Seite offen ist, dürfen Tabellen aus mehreren Datenbanken verwenden und verändern keine Datei. Unter **Daten ändern → Eigene Ansichten** kannst du sie bearbeiten (✎) oder löschen (✕).

---

## Häufige Fragen

**Werden meine Dateien verändert?**
Nein. Änderungen (z. B. über „Daten ändern“) wirken nur auf die Kopie im Browser. Die Originaldatei bleibt, wie sie ist.

**Warum sehe ich keine gepunkteten Linien?**
Die Datenbank enthält keine hinterlegten Fremdschlüssel – bei Handy-Datenbanken ist das der Normalfall. Verbinde die Tabellen per Linie oder in Schritt 2.

**Nach dem Verbinden habe ich 0 Zeilen.**
Eine INNER-Verbindung wirft Zeilen ohne Partner weg. Der Hinweis in Schritt 2 nennt die betroffene Verbindung. Mit **Auf LEFT umstellen** bleiben sie erhalten.

**Das Datum ist ein seltsames Jahr (1970 oder weit in der Zukunft).**
Wahrscheinlich die falsche Zeit-Funktion: Android nutzt meist Millisekunden (**MS→DATUM**), iPhones zählen ab 2001 (**APPLE→DATUM**).

**Kann ich SQL direkt eingeben?**
Ja, unter **SQL schreiben**. Erlaubt ist alles, was SQLite kann – auch `PRAGMA`, `INSERT`, `UPDATE` und `CREATE TEMP VIEW`. Tabellen sprichst du dort als `datenbank.tabelle` an, z. B. `plauder.nachrichten`. Ein `ATTACH DATABASE 'wa.db' AS wa;` davor ist erlaubt, wenn `wa.db` geöffnet ist.

**Neben der Datenbank liegen Dateien mit `-wal` und `-shm`. Brauche ich die?**
Möglicherweise ja: In der `-wal`-Datei können die neuesten Änderungen stehen, die noch nicht in die `.db` übernommen sind. Der Spielplatz öffnet nur die `.db`. Arbeite deshalb vorher an einer **Kopie** alle drei Dateien zusammen ein, z. B. mit `sqlite3 msgstore.db "PRAGMA wal_checkpoint(TRUNCATE);"` im Ordner der Kopie, und öffne danach diese `.db`. Die Originaldateien dabei nie selbst öffnen.

**Welche Dateien kann ich öffnen?**
SQLite (`.db`, `.sqlite`, `.sqlite3`, `.db3`), Excel (`.xlsx`, `.xls`, `.ods`) und CSV. Bei gleichen Datei- oder Tabellennamen hängt die App automatisch `_2`, `_3` … an.

---

## Für Entwickler

Die HTML-Datei ist ein Bundle: React und SQLite (sql.js, WebAssembly) laufen komplett im Browser. Skripte, Schriften und das WASM-Modul stecken gzip-komprimiert und Base64-kodiert in der Datei. Deshalb funktioniert sie offline, und deshalb ist der Quelltext darin nicht direkt lesbar.

- Der lesbare Quelltext liegt in `src/`.
- Nach Änderungen baut `python scripts/build.py` ihn wieder in `SQL Spielplatz.html` ein. Zum Benutzen und Weitergeben genügt allein die HTML-Datei.
- Mehrere Datenbanken werden per SQLite `ATTACH` in einem gemeinsamen Arbeitsbereich verbunden.
- `node tests/multi-database.cjs` testet mit den eingebetteten SQLite- und Babel-Versionen, ohne Paketinstallation. Geprüft werden: Layouts und Kartengrößen, Zoom und Scrollen, alle JOIN-Arten, Namenskonflikte, Fremdschlüssel nur als Vorschlag, SQL ↔ Bausteine (Aliase, doppelte Tabellen, CASE, Apple-Zeit in allen Einheiten), Umbenennen von Rollen und nachträglich geänderte Verbindungen, Sonderzeichen, Datenänderungen, das Schließen einzelner Datenbanken und Ansichten.
