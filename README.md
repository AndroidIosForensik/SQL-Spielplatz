# SQL Spielplatz

Werkzeug zum Ansehen und Abfragen von SQLite-Datenbanken, Excel- und CSV-Dateien im Browser. Gedacht zum Lernen von SQL und zum Auswerten von App-Datenbanken, etwa aus WhatsApp oder iPhone-Apps.

Die Tabellen werden als Diagramm angezeigt. Abfragen lassen sich in drei Schritten zusammenklicken, das zugehörige SQL wird dabei angezeigt. SQL kann auch direkt eingegeben werden.

Die Anwendung ist eine einzelne HTML-Datei (`SQL Spielplatz.html`). Sie braucht keine Installation und keinen Server und funktioniert ohne Internetverbindung. Alle Daten bleiben im Browser, geöffnete Dateien werden nicht verändert.

## Erste Schritte

1. `SQL Spielplatz.html` im Browser öffnen. Die Beispiel-Datenbank „Plauder“ (ein kleines Messenger-Backup) ist bereits geladen.
2. Über „+ Datenbanken öffnen“ eigene Dateien hinzufügen (`.db`, `.sqlite`, `.xlsx`, `.csv` usw.). Es können bis zu 10 Dateien gleichzeitig geöffnet sein.
3. Rechts die Abfrage in drei Schritten aufbauen und „▶ Ausführen“ klicken.
4. Das Ergebnis bei Bedarf mit „⤓ CSV“ exportieren.

## Funktionen

### Abfragen in drei Schritten

| Schritt | Inhalt |
|---|---|
| 1 Start-Tabelle | Die Haupttabelle der Abfrage, z. B. die Nachrichten. Auswahl über eine Suchliste oder per Doppelklick auf eine Karte im Diagramm. |
| 2 Verbinden | Weitere Tabellen anhängen, z. B. zu jeder Nachricht den Kontakt. |
| 3 Spalten | Spalten für das Ergebnis auswählen, bei Bedarf filtern, gruppieren, sortieren und begrenzen. |

Jeder Schritt zeigt einen kurzen Hinweis, was zu tun ist.

### Tabellen verbinden

- Im Diagramm eine Linie vom Punkt einer Spalte zu einer passenden Spalte einer anderen Tabelle ziehen (z. B. `nachrichten.kontakt_id` zu `nutzer.id`). Daraus wird eine Verbindung (JOIN).
- Sind in der Datenbank Fremdschlüssel hinterlegt, werden sie als gepunktete Linien angezeigt. Ein Klick übernimmt die Verbindung, ✕ blendet den Vorschlag aus. Ohne hinterlegte Fremdschlüssel gibt es keine Vorschläge, aus Spaltennamen wird nichts abgeleitet.
- In Schritt 2 lassen sich Tabelle und Spalten auch direkt auswählen („Tabelle und Spalten selbst wählen“), auch über zwei Datenbanken hinweg. Ist die linke Spalte leer, kann eine Ersatzspalte angegeben werden (COALESCE).
- Wird eine Tabelle mehrfach gebraucht, etwa Kontakte einmal für den Chatpartner und einmal für den Absender, bekommt jede Verwendung einen eigenen Namen (Alias). Namen können jederzeit geändert werden, alle Verweise darauf werden angepasst.
- Unter jeder Verbindung steht, wie viele Zeilen danach übrig sind. Fallen bei INNER Zeilen ohne Partner weg, lässt sich die Verbindung mit einem Klick auf LEFT umstellen. Die Vorschau zeigt alle Join-Arten (INNER, LEFT, RIGHT, FULL, CROSS) mit Zeilenzahlen und Beispielzeilen.

### Ergebnis-Spalten

- Spalten über „+ Spalte“ hinzufügen oder aus dem Diagramm hineinziehen. Die Reihenfolge lässt sich am Griff ⠿ per Drag & Drop oder mit ▲▼ ändern.
- Jede Spalte kann im Ergebnis einen eigenen Namen bekommen (AS), auch mit Leerzeichen und Umlauten.
- „Wenn–dann“ erzeugt einen CASE-Ausdruck, z. B.: wenn `from_me` = 1, dann „ICH“, sonst der Name.
- „Erster Wert“ nimmt den ersten nicht leeren Wert aus einer Liste (COALESCE), z. B. Adressbuch-Name, dann WhatsApp-Name, dann Telefonnummer.
- „Fester Wert“ schreibt denselben Text in jede Zeile, z. B. `WhatsApp`, um später Ergebnisse mehrerer Apps zusammenzuführen.
- Filtern, Gruppieren, Sortieren und Begrenzen stehen in Schritt 3 unter „Außerdem“. Beim Filtern werden die vorhandenen Werte der Spalte zur Auswahl angeboten.

### Funktionen für Spalten (fx)

Über „fx“ an einer Spalte lassen sich Text-, Zahl- und Datumsfunktionen anwenden und hintereinander ausführen. Eine Vorschau zeigt das Ergebnis an echten Werten. Für Zeitstempel gibt es:

- MS→DATUM: Millisekunden seit 1970 (Android, WhatsApp, Signal)
- UNIX→DATUM: Sekunden seit 1970
- APPLE→DATUM: Zeit ab 1.1.2001 (iOS). Sekunden, Millisekunden, Mikrosekunden und Nanosekunden werden an der Größe der Zahl erkannt.

Jeweils in Ortszeit oder in UTC.

### Suchen und Vorschau

- Jede Tabellenkarte hat ein Suchfeld für Spaltennamen. Treffer werden hervorgehoben, Enter springt zum nächsten.
- ▤ an der Karte zeigt die ersten 100 Zeilen einer Tabelle. Das Suchfeld dort blendet nicht passende Spalten aus.

### Export und Speichern

- „⤓ CSV“ exportiert alle Ergebniszeilen. Der Dateiname kann daneben eingetragen werden und wird gespeichert.
- „⤓ Abfrage speichern“ und „⤒ Abfrage laden“ sichern eine Abfrage als Datei.

### SQL

- Unter den Bausteinen steht das erzeugte SQL.
- Beim Ausführen zeigt eine Leiste die Reihenfolge, in der SQL die Abfrage abarbeitet (FROM zuerst, LIMIT zuletzt), und die Zeilenzahl nach jeder Stufe.
- Unter „SQL schreiben“ kann SQL direkt eingegeben werden. „☰ In Bausteine umwandeln“ übernimmt ein SELECT in die Bausteine, einschließlich Aliasen, CASE und COALESCE.
- Zu beiden Beispiel-Datenbanken gibt es Übungsaufgaben. Geprüft wird das Ergebnis, nicht der Wortlaut des SQL.

## Beispiel: WhatsApp-Nachrichten mit Kontaktnamen

Das folgende Beispiel wurde an einem Abbild eines Google Pixel 10 (WhatsApp-Stand 2026) geprüft.

1. `msgstore.db` und `wa.db` öffnen. In der App heißen sie dann `msgstore` und `wa`.
2. Schritt 1: `message` als Start-Tabelle wählen.
3. Schritt 2: Die Verbindungen in dieser Reihenfolge anlegen, jeweils über „+ Tabelle verbinden“ und „Tabelle und Spalten selbst wählen“:

   | Tabelle | Bedingung | Art | Name |
   |---|---|---|---|
   | `chat` | `message.chat_row_id = chat._id` | INNER | |
   | `jid` | `chat.jid_row_id = jid._id` | INNER | `chatpartner` |
   | `jid_map` | `chatpartner._id = jid_map.lid_row_id` | LEFT | |
   | `jid` | `jid_map.jid_row_id = jid._id` | LEFT | `nummer` |
   | `wa_contacts` | `nummer.raw_string`, ersatzweise `chatpartner.raw_string`, `= wa_contacts.jid` | LEFT | `kontakt` |

   Neuere WhatsApp-Versionen speichern Chatpartner unter einer LID (`…@lid`), das Adressbuch `wa_contacts` aber unter der Telefonnummer (`…@s.whatsapp.net`). `jid_map` ordnet beide einander zu. Die Ersatzspalte bei der letzten Verbindung wird mit „+ sonst andere Spalte (COALESCE)“ hinzugefügt, damit auch Chats gefunden werden, die direkt unter der Nummer gespeichert sind. Im Testabbild hatten damit 46 von 49 Nachrichten einen Kontaktnamen, ohne `jid_map` 19.

   Die Verbindungen ab `jid_map` müssen LEFT sein, weil Gruppen und unbekannte Nummern nicht im Adressbuch stehen. Mit INNER würden diese Nachrichten fehlen.
4. Schritt 3: Spalten auswählen und benennen, z. B.
   - `message.timestamp` mit fx → MS→DATUM als `Zeit`
   - „+ Erster Wert“ aus `kontakt.display_name`, `kontakt.wa_name`, `chatpartner.raw_string` als `Chat mit`
   - `message.text_data` als `Text`
5. Ausführen und als CSV exportieren.

Der Absender in Gruppen wird auf die gleiche Weise ermittelt: `jid` ein weiteres Mal über `message.sender_jid_row_id = jid._id` verbinden (LEFT, Name `absender`), danach wieder `jid_map` und `wa_contacts`.

WhatsApp- und iOS-Datenbanken enthalten in der Regel keine Fremdschlüssel (im Pixel-10-Abbild 0 von 314 Tabellen). Dort erscheinen daher keine gepunkteten Linien.

## Diagramm

| Darstellung | Bedeutung |
|---|---|
| durchgezogene Linie | Verbindung, die in der Abfrage verwendet wird. ✕ entfernt sie. |
| gepunktete Linie | Fremdschlüssel aus der Datei. Klick übernimmt ihn, ✕ blendet ihn für die Sitzung aus. |
| blaue Karte | Ansicht (VIEW) |

- Anordnung: „Nach Datenbank“, „Raster A–Z“ oder „Liste A–Z“. „⛶ Alles einpassen“ zoomt auf alle sichtbaren Tabellen.
- Eine freie Fläche ziehen verschiebt die Ansicht, Strg+Mausrad zoomt. Karten werden am Kopf verschoben und am Griff ⤡ in der Größe geändert, ↺ stellt die Standardgröße wieder her.
- Das durchgestrichene Auge blendet eine Tabelle aus. Über „▦ Tabellen“ werden Tabellen wieder eingeblendet (mit Suchfeld und „Alle auswählen“). Die Auswahl bleibt nach dem Neuladen erhalten.

## Ansichten (VIEW)

Eine Ansicht ist eine gespeicherte Abfrage, die danach wie eine Tabelle verwendet werden kann. Das ist nützlich, wenn eine Abfrage in zwei Stufen aufgeteilt werden soll.

1. Eine Abfrage aufbauen, z. B. ein Personenverzeichnis aus `jid` und `wa_contacts`, und „⊞ Als Ansicht speichern“ klicken. Einen Namen vergeben, etwa `personen`.
2. `personen` erscheint als blaue Karte und kann wie eine Tabelle verbunden werden, z. B. einmal als `chatpartner` und einmal als `absender`.

Ansichten werden als `TEMP VIEW` angelegt. Sie bestehen, solange die Seite geöffnet ist, können Tabellen aus mehreren Datenbanken verwenden und ändern keine Datei. Unter „Daten ändern“ → „Eigene Ansichten“ lassen sie sich bearbeiten (✎) oder löschen (✕).

## Häufige Fragen

**Werden die geöffneten Dateien verändert?**
Nein. Änderungen, z. B. über „Daten ändern“, betreffen nur die Kopie im Browser.

**Warum gibt es keine gepunkteten Linien?**
Die Datenbank enthält keine Fremdschlüssel. Bei App-Datenbanken ist das üblich. Die Tabellen müssen dann per Linie oder in Schritt 2 verbunden werden.

**Nach dem Verbinden gibt es 0 Zeilen.**
Eine INNER-Verbindung entfernt Zeilen ohne Partner. Der Hinweis in Schritt 2 nennt die betroffene Verbindung, „Auf LEFT umstellen“ behält die Zeilen.

**Das Datum liegt 1970 oder weit in der Zukunft.**
Vermutlich passt die Zeitfunktion nicht. Android verwendet meist Millisekunden (MS→DATUM), iOS zählt ab 2001 (APPLE→DATUM).

**Was ist mit SQL im Editor erlaubt?**
Alles, was SQLite unterstützt, auch `PRAGMA`, `INSERT`, `UPDATE` und `CREATE TEMP VIEW`. Tabellen werden als `datenbank.tabelle` angesprochen, z. B. `plauder.nachrichten`. Ein vorangestelltes `ATTACH DATABASE 'wa.db' AS wa;` ist erlaubt, wenn `wa.db` geöffnet ist.

**Neben der Datenbank liegen Dateien mit `-wal` und `-shm`.**
Die `-wal`-Datei kann Änderungen enthalten, die noch nicht in die `.db` geschrieben wurden. Der Spielplatz liest nur die `.db`. Vorher daher an einer Kopie aller drei Dateien die Änderungen übernehmen, z. B. mit `sqlite3 msgstore.db "PRAGMA wal_checkpoint(TRUNCATE);"`, und dann die `.db` der Kopie öffnen. Die Originaldateien nicht direkt öffnen.

**Welche Dateitypen werden unterstützt?**
SQLite (`.db`, `.sqlite`, `.sqlite3`, `.db3`), Excel (`.xlsx`, `.xls`, `.ods`) und CSV. Bei gleichen Datei- oder Tabellennamen wird `_2`, `_3` usw. angehängt.

## Entwicklung

`SQL Spielplatz.html` ist ein Bundle aus React und SQLite (sql.js, WebAssembly). Skripte, Schriften und das WASM-Modul sind gzip-komprimiert und Base64-kodiert in der Datei enthalten, deshalb funktioniert sie offline und der Quelltext ist darin nicht direkt lesbar.

- Der Quelltext liegt in `src/`.
- `python scripts/build.py` baut ihn in `SQL Spielplatz.html` ein. Für die Nutzung reicht die HTML-Datei.
- Mehrere Datenbanken werden per SQLite `ATTACH` in einem gemeinsamen Arbeitsbereich verbunden.
- `node tests/multi-database.cjs` führt die Tests mit den eingebetteten SQLite- und Babel-Versionen aus, ohne Paketinstallation. Getestet werden Layouts und Kartengrößen, Zoom und Scrollen, JOIN-Arten, Namenskonflikte, Fremdschlüssel als Vorschlag, die Umwandlung zwischen SQL und Bausteinen (Aliase, mehrfach verwendete Tabellen, CASE, Apple-Zeit in allen Einheiten), das Umbenennen von Aliasen und das nachträgliche Ändern von Verbindungen, Sonderzeichen, Datenänderungen, das Schließen einzelner Datenbanken und Ansichten.
