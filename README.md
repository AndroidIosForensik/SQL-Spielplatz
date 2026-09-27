# SQL Spielplatz

Eine verspielte Lernumgebung für SQL — als **eine einzige HTML-Datei**, die offline im Browser läuft. Kein Server, keine Installation, keine Datenübertragung: Doppelklick auf `SQL Spielplatz.html` genügt.

## Was drin ist

- **Geführt in drei Schritten** — **1 Start-Tabelle** (durchsuchbare Liste mit Zeilenzahlen oder Doppelklick auf eine Karte), **2 Verbinden** (Linie im Diagramm ziehen oder „+ Tabelle verbinden“, jede Tabelle mit optionalem Rollen-Namen wie `absender`), **3 Spalten** (Ergebnis-Spalten als geordnete Liste, darunter bei Bedarf Filtern, Gruppieren, Sortieren, Begrenzen). Jeder Schritt sagt, was jetzt zu tun ist; ist er erledigt, geht es von selbst weiter, erledigte Schritte tragen einen Haken. Das SQL schreibt sich live mit.
- **Ausführungs-Reihenfolge sichtbar** — beim Ausführen zeigt eine Leiste, in welcher Reihenfolge SQL wirklich arbeitet (erst FROM, zuletzt LIMIT) und wie viele Zeilen nach jeder Stufe übrig bleiben.
- **Verbinden ohne Linien** — gibt es keine passende Beziehung (z. B. `wa_contacts.jid = jid.raw_string` über zwei Datenbanken), wählt man in Schritt 2 „Tabelle und Spalten selbst wählen“. Automatisch eingezeichnet werden nur Fremdschlüssel, die in der Datenbank selbst hinterlegt sind. Vermutete Beziehungen aus Spaltennamen wie `chat_row_id` oder `sender_jid_row_id` (WhatsApp-Stil) zeichnet erst der Knopf **✨ Beziehungen vorschlagen** über dem Diagramm ein.
- **Wenn–dann, Erster Wert, Fester Wert** — CASE und COALESCE lassen sich zusammenklicken: pro Fall „wenn Spalte = Wert → Ergebnis“ plus „sonst“, bzw. eine sortierbare Liste „nimm den ersten vorhandenen Wert“ (z. B. Adressbuch-Name, WhatsApp-Name, sonst Nummer). Ein fester Wert wie `'WhatsApp' AS messenger` steht in jeder Zeile gleich.
- **Schema-Diagramm** — Tabellen als Karten zum Verschieben, Beziehungen als Linien; Spalten lassen sich von dort direkt in die Bausteine ziehen.
- **Spalten finden** — jede Tabellenkarte hat unten ein Suchfeld: Treffer werden hervorgehoben, der Rest abgeblendet, die Karte scrollt zum Treffer (Enter springt weiter, Esc leert). In der Daten-Vorschau (▤, die ersten 100 Zeilen) blendet das Suchfeld alle anderen Spalten aus. Mehrere Wörter grenzen weiter ein.
- **Join-Arten mit Live-Vorschau** — INNER, LEFT, RIGHT, FULL OUTER und CROSS. Wer die Join-Art ändert, sieht sofort die Zeilenzahl jeder Art, die Änderung gegenüber vorher (z. B. „INNER → LEFT: 3 → 4 Zeilen“), wie viele Zeilen ohne Partner wegfallen oder mit NULL bleiben, und Beispielzeilen, in denen die Zeilen ohne Partner gelb markiert oben stehen. Über „▸ Vorschau“ lässt sie sich auch ohne Wechsel öffnen. Unter jeder Verbindung steht außerdem, wie viele Zeilen danach noch übrig sind (z. B. „4 → 2 Zeilen — 2 ohne Partner fallen weg“). Wirft ein INNER JOIN Zeilen weg, gibt es direkt den Knopf **Auf LEFT umstellen**; bleiben am Ende 0 Zeilen, nennt der Hinweis oben die betroffenen Verbindungen. Typisch bei WhatsApp: Gruppen stehen nicht im Adressbuch (`wa_contacts`), und `sender_jid_row_id` ist nur in Gruppen gefüllt – beides braucht LEFT.
- **Spalten umbenennen (AS)** — eigene Ergebnis-Namen für Spalten, Funktionen und Rechenfunktionen; Leerzeichen und Umlaute erlaubt.
- **Funktionen pro Spalte** — über **fx** an jeder Spalte: Text, Zahl, Datum und Profi-Funktionen (u. a. Millisekunden-, Unix- und Apple-Zeitstempel lesbar machen, wahlweise in Ortszeit oder UTC; Apple-Zeit zählt wie in iPhone-Datenbanken ab dem 1.1.2001), verkettbar und mit Vorschau auf echten Daten.
- **Geführte Aufgaben** — je ein Aufgabensatz pro Beispiel-Datenbank, geprüft am Ergebnis, nicht am Wortlaut.
- **SQL in beide Richtungen** — selbst geschriebenes SQL lässt sich in Bausteine umwandeln und umgekehrt; Abfragen kann man speichern und wieder laden.
- **Aliase und doppelte Tabellen** — Tabellen-Aliase (`FROM message m`) werden beim Umwandeln verstanden. Kommt eine Tabelle mehrfach vor (z. B. `jid` als Chat und als Absender), behält jede Rolle ihren Alias; in Schritt 2 wird eine Tabelle dafür „noch einmal“ angeboten, der Rollen-Name lässt sich jederzeit ändern. Eigene Aliase (`FROM message AS nachricht`) werden beim Umwandeln zu Rollen-Namen. `ATTACH DATABASE 'wa.db' AS wa;` vor der Abfrage ist erlaubt, sofern `wa.db` geöffnet ist – im SQL-Editor wie beim Umwandeln. Einfache CASE- und COALESCE-Ausdrücke werden zu Wenn–dann bzw. Erster Wert; nur was darüber hinausgeht, bleibt freie Formel, Aliase darin werden passend umgeschrieben.
- **Ansichten (VIEW)** — eine Abfrage unter einem Namen speichern und danach wie eine Tabelle verwenden. Ansichten erscheinen als **blaue Karten** im Diagramm (Ansichten aus geöffneten Dateien ebenso). Details unten.
- **Eigene Daten** — SQLite-Dateien (.db/.sqlite) sowie Excel/CSV lassen sich öffnen; alles bleibt im Browser.
- **CSV-Export mit eigenem Namen** — neben **⤓ CSV** steht der Dateiname (z. B. `whatsapp`, „.csv“ kommt von selbst dazu); der zuletzt benutzte Name bleibt gemerkt. Exportiert werden immer alle Ergebniszeilen.
- **Mehrere Datenbanken gleichzeitig** — bis zu 10 Dateien/Beispiele bleiben gemeinsam geöffnet. Tabellen aus verschiedenen Datenbanken lassen sich im Diagramm verbinden und mit JOIN abfragen; gleiche Datei- und Tabellennamen werden eindeutig unterschieden.

Mitgeliefert sind zwei Beispiel-Datenbanken: ein Messenger-Backup („Plauder") und eine größere Firmen-Datenbank mit 8 Tabellen und rund 50.000 Datensätzen.

## Datenbanken gemeinsam verwenden

1. **+ Datenbanken öffnen** anklicken und eine oder mehrere SQLite-, Excel- oder CSV-Dateien auswählen. Weitere Dateien werden hinzugefügt; vorhandene Abfragen bleiben erhalten. Auch die Beispiel-Buttons fügen Datenbanken hinzu.
2. Oben stehen die geöffneten Dateien mit ihrem SQL-Namen, beispielsweise `kunden` und `bestellungen`. Tabellen heißen entsprechend `kunden.kunde` und `bestellungen.auftrag`. Bei gleichen Dateinamen wird automatisch `_2`, `_3` usw. ergänzt.
3. Die Punkte neben passenden Spalten von einer Tabellenkarte zur anderen ziehen, etwa von `kunde.id` zu `auftrag.kunde_id`. Die Linie wird sofort zum JOIN in der Abfrage: Ist noch keine Start-Tabelle gewählt, wird die Tabelle, an der die Linie beginnt, zur Start-Tabelle (FROM). Join-Art und Rollen-Name lassen sich danach in Schritt **2 Verbinden** anpassen.

Diagramm und Schritt **2 Verbinden** zeigen immer dasselbe:

- **Linie ziehen** → sofort eine Verbindung. Ist noch keine Start-Tabelle gewählt, wird die Tabelle am Linienanfang zur Start-Tabelle. Sind beide Tabellen schon in der Abfrage, kommt die Zieltabelle in einer weiteren Rolle dazu (z. B. `jid` noch einmal als `jid_2` für den Absender). Eine Linie, die an keine Tabelle der Abfrage anschließt, bleibt nicht stehen – ein Hinweis erklärt, warum.
- **Verbindung rechts anlegen** (auch „Tabelle und Spalten selbst wählen“ oder per SQL-Umwandlung) → die passende Linie erscheint im Diagramm; werden die Spalten geändert, zieht die Linie mit.
- **Löschen** wirkt auf beiden Seiten: ✕ auf der Linie entfernt die Verbindung, ✕ an der Verbindung entfernt die selbst gezogene Linie.
- Linien, die zur Abfrage gehören, sind kräftig; blasse Linien sind nur Angebote (Fremdschlüssel aus der Datei oder Vorschläge). Ein Klick auf eine blasse Linie übernimmt sie als Verbindung. Mit **⊞** lassen sich die Tabellen neu anordnen.

Alternativ direkt im SQL-Editor:

```sql
SELECT kunden.kunde.name, bestellungen.auftrag.betrag
FROM kunden.kunde
JOIN bestellungen.auftrag
  ON kunden.kunde.id = bestellungen.auftrag.kunde_id;
```

Mit **×** neben einer Datenbank wird nur diese geschlossen. Eine Baustein-Abfrage, die sie verwendet, wird dabei zurückgesetzt. Das Schließen verwirft ihre Änderungen im Browser; die Originaldateien werden nie überschrieben. Beziehungen und geöffnete Datenbanken gelten für die aktuelle Sitzung. Aufgaben werden angezeigt, wenn genau eine Beispiel-Datenbank geöffnet ist.

## Ansichten (VIEW): in zwei Stufen denken

Manche Tabellen braucht eine Abfrage in mehreren Rollen – bei WhatsApp etwa `jid` und `wa_contacts` einmal für den Chatpartner und einmal für den Absender. Übersichtlicher wird das mit einer Ansicht:

1. **Stufe 1 – Personenverzeichnis anlegen.** Im Reiter **Daten ändern** den Baustein **VIEW** wählen, einen Namen wie `personen` eintragen und die Abfrage dazu (aus `jid`, `jid_map`, `wa_contacts`). Die Abfrage lässt sich auch **aus den Bausteinen** oder **aus dem SQL-Editor** übernehmen, oder man klickt in **Abfragen** auf **⊞ Als Ansicht speichern**. Wer ein komplettes `CREATE TEMP VIEW personen AS SELECT …` einfügt, bekommt Name und Abfrage automatisch getrennt. Alternativ führt man die Anweisung direkt unter **SQL schreiben** aus.
2. **Stufe 2 – Nachrichten.** Die Ansicht steht jetzt als blaue Karte im Diagramm (Gruppe „temp · eigene Ansichten“) und in allen Bausteinen wie eine Tabelle zur Verfügung. Jede Nachricht schaut darin zweimal nach: `JOIN personen AS unterhaltung …` und `LEFT JOIN personen AS absender …` – per Linie, in Schritt 2 oder per SQL-Umwandlung.

Ansichten werden immer als `TEMP VIEW` angelegt: Sie gelten, solange die Seite offen ist, dürfen Tabellen aus allen geöffneten Datenbanken verwenden und verändern keine Datei. (Eine dauerhafte `CREATE VIEW` über zwei Datenbanken lässt SQLite nicht zu – die App sagt dann, dass `TEMP` fehlt.) Gibt es den Namen schon, wird die Ansicht ersetzt; ihre Karte bleibt dabei an ihrem Platz. Unter **Eigene Ansichten** lässt sich jede Ansicht zum Bearbeiten laden (✎) oder löschen (✕). Ein Name, den schon eine Tabelle trägt, wird abgelehnt, damit Abfragen eindeutig bleiben. Wird eine Datenbank geschlossen, auf die eine Ansicht zugreift, verschwindet ihre Karte; nach dem erneuten Öffnen ist sie wieder da. Ansichten lassen sich nicht mit INSERT/UPDATE/DELETE ändern und fehlen deshalb dort in der Tabellenauswahl.

## Übersicht und Kartengrößen

Die Leiste über dem Diagramm bleibt immer erreichbar:

- **Nach Datenbank:** Tabellen werden je Datenbank zusammengefasst und alphabetisch angeordnet.
- **Raster A–Z:** Alle Tabellen stehen in einem festen alphabetischen Raster, unabhängig von ihrer Datenbank.
- **Liste A–Z:** Eine alphabetische Spalte bei 100 % Zoom; praktisch zum Lesen und vertikalen Scrollen.
- **Alles einpassen:** Zoomt auf alle sichtbaren Tabellen. Die Raster-Layouts wählen auch beim Hinzufügen von Datenbanken eine zur Bildschirmfläche passende Anordnung. Der gewählte Layoutmodus wird im Browser gemerkt.

Am sichtbaren **⤡-Griff unten rechts** jeder Tabellenkarte lassen sich **Breite und Höhe** ziehen, auch bei verändertem Zoom. Mit fokussiertem Griff funktionieren die Pfeiltasten ebenfalls (mit Umschalt in größeren Schritten). **↺** oder ein Doppelklick auf den Griff stellt die Standardgröße wieder her. Lange Spaltenlisten scrollen innerhalb der Karte; Beziehungslinien folgen mit. Ein Layout-Klick berücksichtigt die veränderten Kartengrößen und ordnet sie ohne Überschneidungen neu an.

Zum Verschieben der Ansicht eine **freie Fläche mit der linken Maustaste ziehen**; rechte/mittlere Maustaste und Strg+Mausrad funktionieren weiterhin. Karten lassen sich am Kopf frei verschieben und mit dem **durchgestrichenen Auge** im Kartenkopf direkt ausblenden; die übrigen Karten bleiben dabei, wo sie sind, und ein kurzer Hinweis bietet **Rückgängig** an. Über **Tabellen** werden Tabellen aus- und wieder eingeblendet – wie beim Excel-Filter mit Suchfeld (mehrere Wörter grenzen weiter ein) und **Alle auswählen**, das nur auf die aktuellen Treffer wirkt. Einzeln zurückgeholte Tabellen kehren an ihren alten Platz zurück oder, falls der inzwischen belegt ist, an die nächste freie Stelle daneben. Ausgeblendete Tabellen bleiben ausgeblendet, bis man sie über dieses Menü zurückholt, auch beim Wechsel der Anordnung und nach dem Neuladen (die Auswahl wird im Browser gemerkt). Tabellen, die die aktuelle Abfrage verwendet, bleiben in den Bausteinen verfügbar, auch wenn ihre Karte ausgeblendet ist.

## Technik

Die Datei ist ein Bundle: React und SQLite (sql.js, WebAssembly) laufen komplett im Browser. Alle Bestandteile — Skripte, Schriften und das WASM-Modul — stecken gzip-komprimiert und Base64-kodiert in einem Manifest innerhalb der HTML-Datei und werden beim Öffnen zu Blob-URLs entpackt. Deshalb ist der Quelltext in der Datei nicht direkt lesbar, und deshalb funktioniert sie auch ohne Internet.

Die bearbeiteten Anwendungsmodule liegen lesbar in `src/`. Nach Änderungen baut `python scripts/build.py` sie wieder in die HTML-Datei ein. Zum Benutzen oder Weitergeben genügt weiterhin allein die HTML-Datei. Zusätzliche Datenbanken werden über SQLite `ATTACH` in einem gemeinsamen Arbeitsbereich verbunden.

`node tests/multi-database.cjs` prüft die eingebetteten Versionen von SQLite/Babel ohne Paketinstallation: Layoutreihenfolge, Abstände bei veränderten Kartengrößen, Platzierung wieder eingeblendeter Karten, Zoom-/Scroll-Geometrie, JOIN-Arten, Namenskonflikte, SQL/Baustein-Konvertierung (inkl. Aliasen, doppelt verwendeter Tabellen und CASE), Sonderzeichen, gezielte Datenänderungen, das Abhängen einzelner Datenbanken sowie Ansichten (TEMP VIEW über zwei Datenbanken, Ersetzen, zwei Rollen, nicht lesbare Ansichten).
