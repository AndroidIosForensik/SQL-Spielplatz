# SQL Spielplatz

Eine verspielte Lernumgebung für SQL — als **eine einzige HTML-Datei**, die offline im Browser läuft. Kein Server, keine Installation, keine Datenübertragung: Doppelklick auf `SQL Spielplatz.html` genügt.

## Was drin ist

- **Bausteine statt Tippen** — FROM, JOIN, WHERE, GROUP BY, SELECT, ORDER BY und LIMIT werden zusammengeklickt; das SQL schreibt sich daneben live mit.
- **Bausteine in der Ausführungs-Reihenfolge** — der Bau-Bereich ist bewusst so sortiert, wie SQL wirklich arbeitet (erst FROM, zuletzt LIMIT), nicht wie man es schreibt.
- **Schema-Diagramm** — Tabellen als Karten zum Verschieben, Beziehungen als Linien; Spalten lassen sich von dort direkt in die Bausteine ziehen.
- **Join-Arten** — INNER, LEFT, RIGHT, FULL OUTER und CROSS, jeweils mit Klartext-Erklärung und zwei Schildern, die zeigen, welche Tabelle vollständig erhalten bleibt.
- **Spalten umbenennen (AS)** — eigene Ergebnis-Namen für Spalten, Funktionen und Rechenfunktionen; Leerzeichen und Umlaute erlaubt.
- **Funktionen zum Ziehen** — Text, Zahl, Datum und Profi-Funktionen (u. a. Millisekunden- und Unix-Zeitstempel lesbar machen) werden auf eine Spalte gezogen und lassen sich verketten.
- **Geführte Aufgaben** — je ein Aufgabensatz pro Beispiel-Datenbank, geprüft am Ergebnis, nicht am Wortlaut.
- **SQL in beide Richtungen** — selbst geschriebenes SQL lässt sich in Bausteine umwandeln und umgekehrt; Abfragen kann man speichern und wieder laden.
- **Eigene Daten** — SQLite-Dateien (.db/.sqlite) sowie Excel/CSV lassen sich öffnen; alles bleibt im Browser.

Mitgeliefert sind zwei Beispiel-Datenbanken: ein Messenger-Backup („Plauder") und eine größere Firmen-Datenbank mit 8 Tabellen und rund 50.000 Datensätzen.

## Technik

Die Datei ist ein Bundle: React und SQLite (sql.js, WebAssembly) laufen komplett im Browser. Alle Bestandteile — Skripte, Schriften und das WASM-Modul — stecken gzip-komprimiert und Base64-kodiert in einem Manifest innerhalb der HTML-Datei und werden beim Öffnen zu Blob-URLs entpackt. Deshalb ist der Quelltext in der Datei nicht direkt lesbar, und deshalb funktioniert sie auch ohne Internet.
