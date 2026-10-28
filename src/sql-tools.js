// SQL-Werkzeuge: Baustein-Definitionen, SQL-Erzeugung, Syntax-Highlighting

const BLOCK_DEFS = {
  from: {
    key: 'from', label: 'FROM', name: 'Tabelle', color: '#F5B82E',
    desc: 'Aus welcher Tabelle kommen die Daten? Jede Abfrage beginnt hier.'
  },
  join: {
    key: 'join', label: 'JOIN', name: 'Verbinden', color: '#8B5CF6',
    desc: 'Verknüpft zwei Tabellen über eine Beziehung — z.B. jede Nachricht mit ihrem Absender.'
  },
  where: {
    key: 'where', label: 'WHERE', name: 'Filtern', color: '#F2762E',
    desc: 'Lässt nur Zeilen durch, die eine Bedingung erfüllen. Der Türsteher der Abfrage.'
  },
  group: {
    key: 'group', label: 'GROUP BY', name: 'Gruppieren', color: '#2F9E6E',
    desc: 'Fasst Zeilen zu Gruppen zusammen und zählt, summiert oder mittelt sie (COUNT, SUM, AVG…).'
  },
  order: {
    key: 'order', label: 'ORDER BY', name: 'Sortieren', color: '#E0529C',
    desc: 'Sortiert das Ergebnis — aufsteigend (ASC) oder absteigend (DESC).'
  },
  limit: {
    key: 'limit', label: 'LIMIT', name: 'Begrenzen', color: '#1FA8A0',
    desc: 'Zeigt nur die ersten N Zeilen. Praktisch für „Top 5“-Fragen.'
  },
  select: {
    key: 'select', label: 'SELECT', name: 'Spalten wählen', color: '#3B82F6',
    desc: 'Welche Spalten sollen im Ergebnis stehen? Ohne Auswahl: alle (*). SQL schreibt SELECT zuerst — ausgeführt wird es fast zuletzt!'
  }
};

// Reihenfolge im Bau-Bereich = logische Ausführungs-Reihenfolge (lehrreich!)
const PIPELINE_ORDER = ['from', 'join', 'where', 'group', 'select', 'order', 'limit'];

const OPERATORS = [
  { v: '=',    t: 'ist gleich' },
  { v: '!=',   t: 'ist nicht' },
  { v: '>',    t: 'größer als' },
  { v: '<',    t: 'kleiner als' },
  { v: '>=',   t: 'mindestens' },
  { v: '<=',   t: 'höchstens' },
  { v: 'LIKE', t: 'enthält (LIKE)' }
];

/* ---------- Join-Arten: was passiert mit Zeilen ohne Partner? ---------- */
const JOIN_TYPES = [
  { v: 'INNER', kw: 'INNER JOIN', t: 'INNER — nur mit Partner',
    desc: 'Nur Zeilen, die auf beiden Seiten einen Partner haben. Wer keinen findet, fliegt raus. (JOIN allein bedeutet dasselbe.)' },
  { v: 'LEFT', kw: 'LEFT JOIN', t: 'LEFT — alle von links',
    desc: 'Alle Zeilen der linken Tabelle bleiben erhalten. Fehlt rechts ein Partner, stehen dort NULL-Werte.' },
  { v: 'RIGHT', kw: 'RIGHT JOIN', t: 'RIGHT — alle von rechts',
    desc: 'Spiegelbild von LEFT: alle Zeilen der angehängten Tabelle bleiben, links wird notfalls mit NULL aufgefüllt.' },
  { v: 'FULL', kw: 'FULL OUTER JOIN', t: 'FULL — alle von beiden',
    desc: 'Alles aus beiden Tabellen. Was keinen Partner hat, bekommt auf der anderen Seite NULL.' },
  { v: 'CROSS', kw: 'CROSS JOIN', t: 'CROSS — jede mit jeder',
    desc: 'Jede Zeile mit jeder kombiniert, ganz ohne Bedingung — aus 10 und 50 Zeilen werden 500. Wächst also schnell!' }
];

function joinType(j) {
  const d = JOIN_TYPES.find(x => x.v === (j && j.type));
  return d || JOIN_TYPES[0];
}
// Fertig ausgefüllt? CROSS braucht keine Spalten, die anderen schon
function joinComplete(j) {
  if (!j || !j.rightTable) return false;
  if (j.type === 'CROSS') return true;
  return !!(j.leftTable && j.leftCol && j.rightCol);
}
// Bleiben Zeilen ohne Partner erhalten? Pro Seite beantwortet — daraus
// entstehen sowohl die Erklärung als auch die zwei Tabellen-Schilder im Baustein.
function joinKeeps(j) {
  const v = joinType(j).v;
  return { links: v === 'LEFT' || v === 'FULL' || v === 'CROSS',
           rechts: v === 'RIGHT' || v === 'FULL' || v === 'CROSS' };
}

// Unter diesem Namen stehen die Spalten einer Join-Seite in der Abfrage: der Alias,
// wenn dieselbe Tabelle mehrfach vorkommt (jid als Chat und jid als Absender), sonst der Tabellenname
function joinLeftRef(j) { return j.leftRef || j.leftTable; }
function joinRightRef(j) { return j.rightAlias || j.rightTable; }
// Für Beschriftungen: „u (nutzer)“ statt nur „u“
function refLabel(ref, table) {
  return ref && ref !== table ? ref + ' (' + unquoteIdent(splitIdent(table).pop()) + ')' : ref;
}

// Erklärung mit den echten Tabellennamen — „links/rechts“ allein hilft niemandem
function joinExplain(j) {
  const d = joinType(j);
  const L = j && j.leftTable && joinLeftRef(j), R = j && j.rightTable && joinRightRef(j);
  if (!L || !R) return d.desc;
  if (d.v === 'LEFT') return 'Alle Zeilen aus ' + L + ' bleiben erhalten — auch die ohne passende ' + R +
    '; dort stehen dann NULL-Werte. Andersherum (alle ' + R + ') wäre RIGHT.';
  if (d.v === 'RIGHT') return 'Alle Zeilen aus ' + R + ' bleiben erhalten — auch die ohne passende ' + L +
    '; dort stehen dann NULL-Werte. Andersherum (alle ' + L + ') wäre LEFT.';
  if (d.v === 'FULL') return 'Alle Zeilen aus ' + L + ' und alle aus ' + R +
    '. Wo der Partner fehlt, füllt SQL die andere Seite mit NULL.';
  if (d.v === 'CROSS') return 'Jede Zeile aus ' + L + ' wird mit jeder aus ' + R +
    ' kombiniert — ohne Bedingung, deshalb ohne ON. Die Zeilenzahl multipliziert sich!';
  return 'Nur Zeilen, die in ' + L + ' und in ' + R + ' einen Partner haben. Alles ohne Gegenstück fällt weg.';
}

// Beschriftung im Auswahlfeld — sobald die Beziehung steht, mit Tabellennamen
function joinTypeLabel(d, j) {
  const L = j && j.leftTable && joinLeftRef(j), R = j && j.rightTable && joinRightRef(j);
  if (!L || !R) return d.t;
  if (d.v === 'LEFT') return 'LEFT — alle ' + L;
  if (d.v === 'RIGHT') return 'RIGHT — alle ' + R;
  return d.t;
}

// Ersatz-Spalten der linken Seite ({ref, table, col}): Ist die erste Spalte leer (NULL), zählt die nächste –
// z.B. Kontakt über die Telefonnummer, sonst über die jid: COALESCE(telefon.raw_string, jid.raw_string)
function joinLeftAlt(j) { return ((j && j.leftAlt) || []).filter(a => a.ref && a.col); }
function joinLeftExpr(j) {
  const parts = [joinLeftRef(j) + '.' + aliasSQL(j.leftCol), ...joinLeftAlt(j).map(a => a.ref + '.' + aliasSQL(a.col))];
  return parts.length === 1 ? parts[0] : 'COALESCE(' + parts.join(', ') + ')';
}
function joinSQL(j) {
  const kw = joinType(j).kw;
  const right = j.rightTable + (j.rightAlias ? ' AS ' + j.rightAlias : '');
  if (j.type === 'CROSS') return kw + ' ' + right;
  return kw + ' ' + right + ' ON ' + joinLeftExpr(j) + ' = ' + joinRightRef(j) + '.' + aliasSQL(j.rightCol);
}
function fromSQL(blocks) {
  return blocks.table + (blocks.tableAlias ? ' AS ' + blocks.tableAlias : '');
}

const AGG_FNS = [
  { v: 'COUNT', t: 'COUNT — zählen' },
  { v: 'SUM',   t: 'SUM — summieren' },
  { v: 'AVG',   t: 'AVG — Durchschnitt' },
  { v: 'MIN',   t: 'MIN — kleinster Wert' },
  { v: 'MAX',   t: 'MAX — größter Wert' }
];

/* ---------- Funktions-Unterbausteine ---------- */
const FN_CATS = {
  text:  { key: 'text',  label: 'Text',  color: '#3B82F6' },
  zahl:  { key: 'zahl',  label: 'Zahl',  color: '#1FA8A0' },
  datum: { key: 'datum', label: 'Datum', color: '#E0529C' },
  profi: { key: 'profi', label: 'Profi', color: '#8B5CF6' }
};

// ret: 'text' | 'num' — wichtig fürs richtige Quoten von Vergleichswerten
const FN_DEFS = {
  upper:   { key: 'upper', label: 'UPPER', name: 'GROSSBUCHSTABEN', cat: 'text', ret: 'text', tpl: 'UPPER({c})',
             desc: 'Wandelt Text in GROSSBUCHSTABEN um.' },
  lower:   { key: 'lower', label: 'LOWER', name: 'kleinbuchstaben', cat: 'text', ret: 'text', tpl: 'LOWER({c})',
             desc: 'Wandelt Text in kleinbuchstaben um.' },
  length:  { key: 'length', label: 'LENGTH', name: 'Textlänge', cat: 'text', ret: 'num', tpl: 'LENGTH({c})',
             desc: 'Zählt die Zeichen — aus „Lina“ wird 4.' },
  trim:    { key: 'trim', label: 'TRIM', name: 'Leerzeichen weg', cat: 'text', ret: 'text', tpl: 'TRIM({c})',
             desc: 'Entfernt Leerzeichen am Anfang und Ende.' },
  substr:  { key: 'substr', label: 'SUBSTR', name: 'Textanfang', cat: 'text', ret: 'text', tpl: 'SUBSTR({c}, 1, {a})',
             arg: { type: 'number', def: 5, label: 'Zeichen' },
             desc: 'Schneidet die ersten N Zeichen heraus.' },
  round:   { key: 'round', label: 'ROUND', name: 'Runden', cat: 'zahl', ret: 'num', tpl: 'ROUND({c}, {a})',
             arg: { type: 'number', def: 0, label: 'Stellen' },
             desc: 'Rundet auf N Nachkommastellen.' },
  abs:     { key: 'abs', label: 'ABS', name: 'ohne Vorzeichen', cat: 'zahl', ret: 'num', tpl: 'ABS({c})',
             desc: 'Macht negative Zahlen positiv: aus -5 wird 5.' },
  castint: { key: 'castint', label: 'CAST', name: 'in ganze Zahl', cat: 'zahl', ret: 'num', tpl: 'CAST({c} AS INTEGER)',
             desc: 'Wandelt den Wert in eine ganze Zahl um — schneidet Nachkommastellen ab.' },
  dateonly:{ key: 'dateonly', label: 'DATE', name: 'nur Datum', cat: 'datum', ret: 'text', tpl: 'date({c})',
             desc: 'Schneidet die Uhrzeit ab: aus „2026-05-30 08:00“ wird „2026-05-30“.' },
  year:    { key: 'year', label: 'JAHR', name: 'Jahr', cat: 'datum', ret: 'text', tpl: "strftime('%Y', {c})",
             desc: 'Holt das Jahr aus einem Datum — z.B. „2026“.' },
  month:   { key: 'month', label: 'MONAT', name: 'Monat', cat: 'datum', ret: 'text', tpl: "strftime('%m', {c})",
             desc: 'Holt den Monat (01–12) aus einem Datum.' },
  hour:    { key: 'hour', label: 'STUNDE', name: 'Stunde', cat: 'datum', ret: 'text', tpl: "strftime('%H', {c})",
             desc: 'Holt die Stunde (00–23) aus einem Zeitstempel.' },
  msdate:  { key: 'msdate', label: 'MS→DATUM', name: 'Zeitstempel lesbar', cat: 'datum', ret: 'text', tpl: "datetime({c}/1000, 'unixepoch', 'localtime')",
             desc: 'Handy-Datenbanken (Signal, WhatsApp …) speichern Zeiten als Millisekunden-Zahl — das macht sie lesbar, in lokaler Zeit.' },
  msdateutc:{ key: 'msdateutc', label: 'MS→UTC', name: 'Zeitstempel lesbar (UTC)', cat: 'datum', ret: 'text', tpl: "datetime({c}/1000, 'unixepoch')",
             desc: 'Wie MS→DATUM, aber in UTC statt Ortszeit — so steht die Zeit in der Datenbank; üblich in Forensik-Berichten.' },
  unixdate:{ key: 'unixdate', label: 'UNIX→DATUM', name: 'Unix-Zeit lesbar', cat: 'datum', ret: 'text', tpl: "datetime(substr({c}, 1, 10), 'unixepoch', 'localtime')",
             desc: 'Wandelt Unix-Zeitstempel (Sekunden, auch aus längeren Werten) in lokales Datum + Uhrzeit — wie bei Telegram-Backups.' },
  unixutc: { key: 'unixutc', label: 'UNIX→UTC', name: 'Unix-Sekunden lesbar (UTC)', cat: 'datum', ret: 'text', tpl: "datetime({c}, 'unixepoch')",
             desc: 'Unix-Zeitstempel in Sekunden als Datum + Uhrzeit in UTC.' },
  appledate:{ key: 'appledate', label: 'APPLE→DATUM', name: 'Apple-Zeit lesbar', cat: 'datum', ret: 'text', tpl: "datetime({c} + 978307200, 'unixepoch', 'localtime')",
             desc: 'iPhone-Datenbanken (z. B. WhatsApp ChatStorage.sqlite) zählen Sekunden ab dem 1.1.2001 statt 1970. +978307200 Sekunden rückt den Nullpunkt auf 1970 — danach wie Unix-Zeit, in lokaler Zeit. Für lange Zahlen mit vielen Nullen (iMessage) APPLE-NS→DATUM nehmen.' },
  appleutc:{ key: 'appleutc', label: 'APPLE→UTC', name: 'Apple-Zeit lesbar (UTC)', cat: 'datum', ret: 'text', tpl: "datetime({c} + 978307200, 'unixepoch')",
             desc: 'Wie APPLE→DATUM (Sekunden ab 1.1.2001), aber in UTC statt Ortszeit — üblich in Forensik-Berichten.' },
  applensdate:{ key: 'applensdate', label: 'APPLE-NS→DATUM', name: 'Apple-Nanosekunden lesbar', cat: 'datum', ret: 'text', tpl: "datetime({c} / 1e9 + 978307200, 'unixepoch', 'localtime')",
             desc: 'Für Apple-Zeit in Nanosekunden ab dem 1.1.2001 — lange Zahlen wie 801647260000000000, z. B. iMessage sms.db. / 1e9 macht Sekunden daraus, dann wie APPLE→DATUM. In lokaler Zeit.' },
  applensutc:{ key: 'applensutc', label: 'APPLE-NS→UTC', name: 'Apple-Nanosekunden lesbar (UTC)', cat: 'datum', ret: 'text', tpl: "datetime({c} / 1e9 + 978307200, 'unixepoch')",
             desc: 'Wie APPLE-NS→DATUM (Nanosekunden ab 1.1.2001), aber in UTC statt Ortszeit.' },
  datede:  { key: 'datede', label: 'TT.MM.JJJJ', name: 'deutsches Datum', cat: 'datum', ret: 'text', tpl: "strftime('%d.%m.%Y', {c})",
             desc: 'Formatiert ein Datum deutsch: aus 2026-05-30 wird 30.05.2026.' },
  uhrzeit: { key: 'uhrzeit', label: 'HH:MM:SS', name: 'Uhrzeit', cat: 'datum', ret: 'text', tpl: "strftime('%H:%M:%S', {c})",
             desc: 'Holt nur die Uhrzeit aus einem Datum: 08:30:00.' },
  daysago: { key: 'daysago', label: 'TAGE SEIT', name: 'Alter in Tagen', cat: 'profi', ret: 'num', tpl: "CAST(julianday('now') - julianday({c}) AS INTEGER)",
             desc: 'Wie viele Tage liegt das Datum zurück?' },
  coalesce:{ key: 'coalesce', label: 'COALESCE', name: 'erster Nicht-NULL-Wert', cat: 'profi', ret: 'text', tpl: 'COALESCE({c}, {a})',
             arg: { type: 'text', def: '?', label: 'Ersatz' },
             desc: 'Gibt den ersten Wert aus der Liste zurück, der nicht NULL ist. Hier: erst die Spalte — ist sie NULL, dann dein Ersatzwert.' },
  ifnull:  { key: 'ifnull', label: 'IFNULL', name: 'NULL-Ersatz (2 Werte)', cat: 'profi', ret: 'text', tpl: 'IFNULL({c}, {a})',
             arg: { type: 'text', def: '', label: 'Ersatz' },
             desc: 'Wie COALESCE mit genau zwei Werten: die Spalte, sonst der Ersatz.' },
  typeof:  { key: 'typeof', label: 'TYPEOF', name: 'Datentyp zeigen', cat: 'profi', ret: 'text', tpl: 'TYPEOF({c})',
             desc: 'Verrät, was wirklich gespeichert ist: text, integer, real …' }
};

function fnExpr(key, col, arg) {
  const d = FN_DEFS[key];
  if (!d) return col;
  let e = d.tpl.split('{c}').join(col);
  if (d.arg) {
    let a = (arg === '' || arg === null || arg === undefined) ? d.arg.def : arg;
    a = d.arg.type === 'number' ? String(Number(a) || 0) : "'" + String(a).replace(/'/g, "''") + "'";
    e = e.split('{a}').join(a);
  }
  return e;
}

function fnAlias(key, col) {
  const d = FN_DEFS[key];
  if (!d) return col;
  const base = String(col).split('.').pop().replace(/\W+/g, '_');
  const fl = d.label.toLowerCase().replace(/\W+/g, '_').replace(/^_+|_+$/g, '');
  return fl + '_' + base;
}

/* ---------- Funktions-Ketten: mehrere Funktionen auf einer Spalte ---------- */
// Normalisiert: akzeptiert Array [{fn,arg},...] oder Alt-Format {fn,arg} oder nichts
function normFns(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x.filter(s => s && s.fn);
  return x.fn ? [x] : [];
}
// Verschachtelt von innen nach außen: [substr, upper] → UPPER(SUBSTR(col, 1, 5))
function chainExpr(col, fns) {
  let e = col;
  normFns(fns).forEach(s => { e = fnExpr(s.fn, e, s.arg); });
  return e;
}
function chainAlias(fns, col) {
  const list = normFns(fns);
  if (!list.length) return col;
  const base = String(col).split('.').pop().replace(/\W+/g, '_');
  const labels = list.map(s => FN_DEFS[s.fn].label.toLowerCase().replace(/\W+/g, '_').replace(/^_+|_+$/g, ''));
  return labels.reverse().join('_') + '_' + base;
}
// Rückgabetyp = Typ der äußersten Funktion
function chainRet(fns) {
  const list = normFns(fns);
  return list.length ? FN_DEFS[list[list.length - 1].fn].ret : null;
}

function emptyBlocks() {
  return {
    table: null,
    distinct: false,      // SELECT DISTINCT — doppelte Ergebnis-Zeilen ausblenden
    active: { join: false, where: false, group: false, order: false, limit: false, select: false },
    joins: [],            // {leftTable,leftCol,rightTable,rightCol}
    wheres: [],           // {col,op,val,conj}
    groupBy: [],          // [col]
    groupFns: [],         // Funktions-Kette auf der Gruppier-Spalte [{fn,arg},...]
    groupAliases: [],     // eigener Ergebnis-Name je Gruppier-Spalte (parallel zu groupBy)
    aggs: [],             // {fn,col,alias}
    orderBy: [],          // {col,dir,fns}
    limit: 5,
    selectCols: []        // [] => * ; sonst [{col, fns, alias}] oder {expr, alias}
  };
}

function isNum(v) {
  return v !== '' && v !== null && !isNaN(Number(v));
}
function quoteVal(v, op) {
  if (op === 'LIKE') return "'%" + String(v).replace(/'/g, "''") + "%'";
  if (isNum(v)) return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

// Quellen der Abfrage (FROM + Joins): ref = Name, mit dem Spalten angesprochen werden
// (Alias oder Tabellenname), table = echte Tabelle
function querySources(blocks) {
  const out = [];
  const add = (table, ref) => { if (table && !out.some(s => s.ref === ref)) out.push({ ref, table }); };
  add(blocks.table, blocks.tableAlias || blocks.table);
  if (blocks.active.join) {
    blocks.joins.forEach(j => { add(j.leftTable, joinLeftRef(j)); add(j.rightTable, joinRightRef(j)); });
  }
  return out;
}
// Namen, unter denen die Tabellen der Abfrage angesprochen werden (FROM + Joins)
function tablesInQuery(blocks) {
  return querySources(blocks).map(s => s.ref);
}
// Die echten Tabellen dahinter – jede nur einmal (für Canvas, Ein-/Ausblenden …)
function queryTables(blocks) {
  return [...new Set(querySources(blocks).map(s => s.table))];
}
function sourceTable(blocks, ref) {
  const hit = querySources(blocks).find(s => s.ref === ref);
  return hit ? hit.table : ref;
}

// Verfügbare Spalten, qualifiziert wenn mehrere Tabellen im Spiel sind
function availableColumns(blocks, schema) {
  const sources = querySources(blocks);
  const multi = sources.length > 1;
  const cols = [];
  sources.forEach(s => {
    const t = schema.tables.find(x => x.name === s.table);
    if (!t) return;
    t.columns.forEach(c => cols.push(multi ? s.ref + '.' + aliasSQL(c.name) : aliasSQL(c.name)));
  });
  return cols;
}

// Sorgt dafür, dass gespeicherte Spalten zur aktuellen Tabellen-Menge passen:
// bei einer Tabelle unqualifiziert (name), bei mehreren qualifiziert (kunde.name).
// Alle Namen, die die Abfrage im Ergebnis selbst vergibt (COUNT(*) AS anzahl, eigene AS-Namen …)
function resultAliases(blocks) {
  return [
    ...(blocks.aggs || []).filter(a => a.col).map(aggDisplayAlias),
    ...(blocks.groupBy || []).map((c, i) => groupDisplayAlias(blocks, c, i)),
    ...(blocks.selectCols || []).map(it => {
      const u = userAlias(it);
      if (u) return u;
      // Auto-Name einer Funktions-Spalte (upper_name) zählt auch als eigener Ergebnis-Name
      if (it.kind) return autoSelectAlias(it);
      return (it.expr === undefined && normFns(it.fns).length) ? chainAlias(it.fns, it.col) : '';
    })
  ].filter(Boolean);
}

function requalifyColumns(blocks, schema) {
  if (!schema || !schema.tables || !schema.tables.length || !blocks.table) return blocks;
  const resolveTable = name => {
    if (!name || schema.tables.some(t => t.name === name)) return name;
    const matches = schema.tables.filter(t => t.localName === unquoteIdent(name));
    return matches.length === 1 ? matches[0].name : name;
  };
  blocks = { ...blocks, table: resolveTable(blocks.table), joins: blocks.joins.map(j => ({
    ...j, leftTable: resolveTable(j.leftTable), rightTable: resolveTable(j.rightTable),
    ...(j.leftAlt ? { leftAlt: j.leftAlt.map(a => ({ ...a, table: resolveTable(a.table), ref: a.ref === a.table ? resolveTable(a.ref) : a.ref })) } : {})
  })) };
  const tabs = tablesInQuery(blocks);
  const multi = tabs.length > 1;
  const tbl = (ref) => schema.tables.find(t => t.name === sourceTable(blocks, ref));
  const has = (t, c) => { const st = tbl(t); return st && st.columns.some(x => x.name === c); };
  const canon = (col) => {
    if (!col || col === '*') return col;
    let t = null, c = col;
    const parts = splitIdent(col);
    c = unquoteIdent(parts.pop());
    if (parts.length) t = tabs.includes(parts.join('.')) ? parts.join('.') : resolveTable(parts.join('.'));
    let owner = (t && tabs.includes(t) && has(t, c)) ? t : null;
    if (!owner) owner = tabs.find(tt => has(tt, c)) || t || tabs[0];
    return multi ? owner + '.' + aliasSQL(c) : aliasSQL(c);
  };
  const b = { ...blocks };
  const canonOperand = o => !o ? o : o.first ? { ...o, first: o.first.map(canonOperand) }
    : o.col ? { ...o, col: canon(o.col) } : o;
  b.selectCols = blocks.selectCols.map(it =>
    it.kind === 'case' ? { ...it, else: canonOperand(it.else), cases: it.cases.map(c => ({
      ...c, cond: { ...c.cond, col: c.cond.col ? canon(c.cond.col) : c.cond.col }, then: canonOperand(c.then) })) }
    : it.kind === 'first' ? { ...it, items: it.items.map(canonOperand) }
    : it.kind || it.expr !== undefined ? it : { ...it, col: canon(it.col) });
  b.wheres = blocks.wheres.map(w => w.raw !== undefined ? w : { ...w, col: canon(w.col) });
  b.groupBy = blocks.groupBy.map(canon);
  const aliases = resultAliases(blocks);
  b.orderBy = blocks.orderBy.map(o => (aliases.includes(o.col) ? o : { ...o, col: canon(o.col) }));
  b.aggs = blocks.aggs.map(a => ({ ...a, col: a.col === '*' ? '*' : canon(a.col) }));
  return b;
}

/* ---------- Eigene Namen für Ergebnis-Spalten (AS) ---------- */
// Reservierte Wörter: als Spaltenname nur in Anführungszeichen brauchbar
const ALIAS_RESERVED = /^(select|distinct|from|join|on|where|group|order|by|having|limit|as|and|or|not|null|in|is|like|between|exists|case|when|then|else|end|union|insert|update|delete|set|values|into|asc|desc|count|sum|avg|min|max)$/i;

// Schreibt einen Namen SQL-sicher: einfache Namen bleiben nackt,
// alles mit Leerzeichen, Umlauten oder Sonderzeichen kommt in "Anführungszeichen".
// Spaltensuche in Tabellenkarten und Vorschau: jedes Wort muss im Namen vorkommen
function colMatches(name, query) {
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const n = String(name).toLowerCase();
  return terms.every(w => n.includes(w));
}

function aliasSQL(name) {
  const s = String(name == null ? '' : name).trim();
  if (!s) return '""';
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s) && !ALIAS_RESERVED.test(s)) return s;
  return '"' + s.replace(/"/g, '""') + '"';
}

// Wie aliasSQL, lässt aber qualifizierte Spalten (tabelle.spalte) unangetastet
function splitIdent(name) {
  return String(name).match(/"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\]|[^.]+/g) || [];
}
function unquoteIdent(name) {
  const s = String(name).trim();
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).replace(/""/g, '"');
  if (s.startsWith('`') && s.endsWith('`')) return s.slice(1, -1).replace(/``/g, '`');
  if (s.startsWith('[') && s.endsWith(']')) return s.slice(1, -1);
  return s;
}
function quoteIdent(name) {
  const s = String(name == null ? '' : name).trim();
  if (!s || s === '*') return s;
  if (splitIdent(s).length > 1) return splitIdent(s).map(p => aliasSQL(unquoteIdent(p))).join('.');
  if (s.startsWith('"')) return s;
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s) && !ALIAS_RESERVED.test(s)) return s;
  return '"' + s.replace(/"/g, '""') + '"';
}

// Eigener Name gesetzt? (leere Eingabe zählt als "nicht gesetzt")
function userAlias(x) {
  const a = x && x.alias;
  return (a === null || a === undefined) ? '' : String(a).trim();
}

// Name, den eine Ergebnis-Spalte ohne eigenen Namen bekäme — für Platzhalter im Editor
function autoSelectAlias(it) {
  if (!it) return '';
  if (it.kind === 'case') return 'wenn_dann';
  if (it.kind === 'first') return 'erster_wert';
  if (it.kind === 'value') return 'wert';
  if (it.expr !== undefined) return 'formel';
  const fns = normFns(it.fns);
  return fns.length ? chainAlias(fns, it.col) : String(it.col || '').split('.').pop();
}

function aggAlias(fn, col) {
  const base = col === '*' ? 'anzahl' : fn.toLowerCase() + '_' + col.replace(/\./g, '_');
  return fn === 'COUNT' && col === '*' ? 'anzahl' : base;
}
function aggExpr(a) {
  const named = userAlias(a);
  return a.fn + '(' + a.col + ') AS ' + (named ? aliasSQL(named) : aggAlias(a.fn, a.col));
}

// So heißt die Rechenspalte im Ergebnis (z.B. fürs ORDER BY nach dem Gruppieren)
function aggDisplayAlias(a) {
  return userAlias(a) || aggAlias(a.fn, a.col);
}
// dito für die Gruppier-Spalte an Position i
function groupDisplayAlias(blocks, col, i) {
  const named = ((blocks.groupAliases || [])[i] || '').trim();
  return named || groupColAlias(blocks, col);
}

/* ---------- Berechnete Ergebnis-Spalten: „Wenn–dann“ (CASE) und „Erster Wert“ (COALESCE) ---------- */
// Operand = {col} | {val} | {first: [{col}|{val}, …]} — Spalte, fester Wert oder der erste vorhandene Wert
const CASE_OPERATORS = [...OPERATORS, { v: 'IS NULL', t: 'ist leer' }, { v: 'IS NOT NULL', t: 'ist nicht leer' }];

function operandReady(o) {
  if (!o) return false;
  if (o.first) return o.first.some(operandReady);
  return o.col !== undefined ? !!o.col : o.val !== undefined;
}
function operandSQL(o) {
  if (!operandReady(o)) return 'NULL';
  if (o.first) {
    const parts = o.first.filter(operandReady).map(operandSQL);
    return parts.length === 1 ? parts[0] : 'COALESCE(' + parts.join(', ') + ')';
  }
  if (o.col !== undefined) return o.col;
  const v = String(o.val);
  return isNum(v) ? v : "'" + v.replace(/'/g, "''") + "'";
}
function caseCondReady(c) {
  return !!(c && c.col && (/NULL$/.test(c.op) || (c.val !== undefined && c.val !== '')));
}
function caseCondSQL(c) {
  if (/NULL$/.test(c.op)) return chainExpr(c.col, c.fns) + ' ' + c.op;
  return condSQL({ col: c.col, op: c.op, val: c.val, fns: c.fns || [] });
}
function caseSQL(it) {
  const whens = it.cases.filter(c => caseCondReady(c.cond))
    .map(c => 'WHEN ' + caseCondSQL(c.cond) + ' THEN ' + operandSQL(c.then));
  if (!whens.length) return 'NULL';
  return 'CASE ' + whens.join(' ') + (operandReady(it.else) ? ' ELSE ' + operandSQL(it.else) : '') + ' END';
}
function selectItemReady(it) {
  if (it.kind === 'case') return it.cases.some(c => caseCondReady(c.cond));
  if (it.kind === 'first') return it.items.some(operandReady);
  if (it.kind === 'value') return true; // leer = NULL
  return it.expr !== undefined ? !!it.expr.trim() : !!it.col;
}

// Vorschau einer Join-Art: dieselbe Abfrage bis zu diesem JOIN, nur dessen Art wechselt.
// countSQL liefert [Zeilen, ohne Partner rechts, ohne Partner links]; sampleSQL zeigt die Zeilen
// ohne Partner zuerst, damit der Unterschied zwischen INNER, LEFT, RIGHT und FULL sofort sichtbar ist.
function joinPreviewSQL(blocks, i, type, schema) {
  const j = blocks.joins[i];
  if (!blocks.table || !j || !j.rightTable || (type !== 'CROSS' && !(j.leftTable && j.leftCol && j.rightCol))) return null;
  const table = name => schema.tables.find(t => t.name === name);
  const L = joinLeftRef(j) || blocks.tableAlias || blocks.table, R = joinRightRef(j);
  const lt = table(j.leftTable || blocks.table), rt = table(j.rightTable);
  if (!lt || !rt) return null;
  const lk = j.leftCol || lt.columns[0].name, rk = j.rightCol || rt.columns[0].name;
  const label = (t, key) => { const c = t.columns.find(c => c.name !== key && !c.pk && /CHAR|TEXT|CLOB/.test(c.type || '')); return c && c.name; };
  // Mit Ersatz-Spalten ist der linke Schlüssel der ganze COALESCE(…)-Ausdruck
  const alt = type !== 'CROSS' && joinLeftAlt(j).length > 0;
  const lkey = alt ? joinLeftExpr(j) : L + '.' + aliasSQL(lk), rkey = R + '.' + aliasSQL(rk);
  const cols = [{ ref: L, col: lk, key: 'left', ...(alt ? { expr: lkey, label: 'erster Wert' } : {}) },
    { ref: L, col: alt ? null : label(lt, lk) }, { ref: R, col: rk, key: 'right' }, { ref: R, col: label(rt, rk) }]
    .filter(c => c.col);
  const ref = c => c.expr || c.ref + '.' + aliasSQL(c.col);
  const earlier = blocks.joins.slice(0, i).filter(joinComplete).map(x => ' ' + joinSQL(x)).join('');
  const from = ' FROM ' + fromSQL(blocks) + earlier + ' ' + joinSQL({ ...j, type });
  return {
    countSQL: 'SELECT COUNT(*), COALESCE(SUM(' + rkey + ' IS NULL), 0), COALESCE(SUM(' + lkey + ' IS NULL), 0)' + from,
    sampleSQL: 'SELECT ' + cols.map((c, k) => ref(c) + ' AS c' + k).join(', ') + from +
      ' ORDER BY (' + rkey + ' IS NULL) DESC, (' + lkey + ' IS NULL) DESC LIMIT 6',
    cols: cols.map(c => ({ label: c.label || String(c.ref).split('.').pop() + '.' + c.col, side: c.ref === L ? 'left' : 'right', key: c.key }))
  };
}

// Linie im Diagramm aufgezogen → gleich als JOIN in die Abfrage. Ohne FROM wird die Tabelle,
// an der die Linie beginnt, zur Start-Tabelle. Gibt { blocks, message } zurück (blocks unverändert,
// wenn sich kein sinnvoller JOIN ergibt – message erklärt dann, warum).
function joinForRelation(blocks, rel, startTable) {
  const short = t => unquoteIdent(splitIdent(t).pop());
  let b = blocks.table ? blocks : { ...emptyBlocks(), table: startTable };
  const sources = querySources(b);
  if (b.active.join && b.joins.some(j => j.relId === rel.id)) {
    return { blocks, ok: true, message: 'Diese Verbindung steckt schon in der Abfrage.' };
  }
  const inQuery = t => sources.some(s => s.table === t);
  if (!inQuery(rel.from.table) && !inQuery(rel.to.table)) {
    return { blocks, ok: false, message: 'Nicht verbunden: weder ' + short(rel.from.table) + ' noch ' + short(rel.to.table) +
      ' steckt in der Abfrage (Start: ' + short(b.table) + '). Verbinde zuerst eine der beiden mit der Abfrage.' };
  }
  // Links steht die Seite, die schon in der Abfrage ist – sind es beide, die Seite, an der die Linie beginnt.
  // Dann kommt die andere Tabelle in einer weiteren Rolle dazu (z.B. jid als Chat und noch einmal als Absender).
  const both = inQuery(rel.from.table) && inQuery(rel.to.table);
  const left = both ? (rel.to.table === startTable && rel.from.table !== startTable ? rel.to : rel.from)
    : inQuery(rel.from.table) ? rel.from : rel.to;
  const right = left === rel.from ? rel.to : rel.from;
  let rightAlias;
  if (both) {
    let base = short(right.table).replace(/\W+/g, '_');
    if (!/^[A-Za-z_]/.test(base) || ALIAS_RESERVED.test(base)) base = 't_' + base;
    let n = 2;
    while (sources.some(s => s.ref === base + '_' + n)) n++;
    rightAlias = base + '_' + n;
  }
  const src = sources.find(s => s.table === left.table);
  const join = { type: 'INNER', relId: rel.id, leftTable: left.table, leftCol: left.col, rightTable: right.table, rightCol: right.col,
    ...(src.ref !== src.table ? { leftRef: src.ref } : {}), ...(rightAlias ? { rightAlias } : {}) };
  const several = sources.filter(s => s.table === left.table).length > 1;
  b = { ...b, active: { ...b.active, join: true }, joins: [...(b.active.join ? b.joins.filter(j => j.rightTable) : []), join] };
  return { blocks: b, ok: true, message: '✓ JOIN hinzugefügt: ' + src.ref.split('.').pop() + '.' + left.col + ' = ' +
    (rightAlias || short(right.table)) + '.' + right.col +
    (rightAlias ? ' (' + short(right.table) + ' noch einmal, als ' + rightAlias + ')' : '') +
    (blocks.table ? '' : ' (Start-Tabelle: ' + short(b.table) + ')') +
    (several ? ' — verbunden über ' + src.ref + ', bei Bedarf in Schritt 2 „Verbinden“ ändern.' : '') };
}

// Rechts ↔ links abgleichen: Jede fertige Verbindung im Bau-Bereich bekommt ihre Linie im Diagramm
// (vorhandene Linie mit denselben Spalten oder eine neue), und Linien bleiben nur, solange eine
// Verbindung sie nutzt. Gibt { joins, relations } zurück – unverändert, wenn alles passt.
function syncJoinLines(blocks, relations, newId) {
  const joins = blocks.active.join ? blocks.joins : [];
  const same = (r, j) =>
    (r.from.table === j.leftTable && r.from.col === j.leftCol && r.to.table === j.rightTable && r.to.col === j.rightCol) ||
    (r.to.table === j.leftTable && r.to.col === j.leftCol && r.from.table === j.rightTable && r.from.col === j.rightCol);
  let rels = relations, n = 0;
  const nextJoins = joins.map(j => {
    if (!j.rightTable || !j.leftTable || !j.leftCol || !j.rightCol) return j.relId && !joinComplete(j) ? { ...j, relId: undefined } : j;
    // Mit Ersatz-Spalten (COALESCE) verbindet keine einzelne Spalte – dafür gibt es keine Linie
    if (joinLeftAlt(j).length) return j.relId ? { ...j, relId: undefined } : j;
    const cur = j.relId && rels.find(r => r.id === j.relId);
    if (cur && same(cur, j)) return j;
    let r = rels.find(x => same(x, j));
    if (!r) {
      r = { id: newId(n++), from: { table: j.leftTable, col: j.leftCol }, to: { table: j.rightTable, col: j.rightCol } };
      rels = [...rels, r];
    }
    return { ...j, relId: r.id };
  });
  const used = new Set(nextJoins.map(j => j.relId).filter(Boolean));
  const kept = rels.filter(r => used.has(r.id));
  const joinsChanged = nextJoins.some((j, k) => j !== joins[k]);
  return { joins: joinsChanged ? nextJoins : null, relations: kept.length !== relations.length || rels !== relations ? kept : null };
}

// Rolle umbenennen (Alias einer Tabelle): alle Spalten-Verweise ziehen mit
function renameRef(blocks, from, to) {
  if (!from || !to || from === to) return blocks;
  const col = c => (typeof c === 'string' && c.startsWith(from + '.')) ? to + c.slice(from.length) : c;
  const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const text = t => String(t).replace(new RegExp("'(?:[^']|'')*'|(^|[^\\w.])" + esc + '\\.', 'g'),
    (m, pre) => pre === undefined ? m : pre + to + '.');
  const operand = o => !o ? o : o.first ? { ...o, first: o.first.map(operand) } : o.col ? { ...o, col: col(o.col) } : o;
  const item = it => it.kind === 'case'
    ? { ...it, else: operand(it.else), cases: it.cases.map(c => ({ ...c, cond: { ...c.cond, col: col(c.cond.col) }, then: operand(c.then) })) }
    : it.kind === 'first' ? { ...it, items: it.items.map(operand) }
    : it.kind ? it
    : it.expr !== undefined ? { ...it, expr: text(it.expr) } : { ...it, col: col(it.col) };
  const side = (ref, table) => { const r = ref === from ? to : ref; return r === table ? undefined : r; };
  const b = {
    ...blocks,
    tableAlias: blocks.table ? side(blocks.tableAlias || blocks.table, blocks.table) : blocks.tableAlias,
    joins: blocks.joins.map(j => {
      const nj = { ...j, leftRef: side(joinLeftRef(j), j.leftTable), rightAlias: side(joinRightRef(j), j.rightTable) };
      if (j.leftAlt) nj.leftAlt = j.leftAlt.map(a => a.ref === from ? { ...a, ref: to } : a);
      if (!nj.leftRef) delete nj.leftRef;
      if (!nj.rightAlias) delete nj.rightAlias;
      return nj;
    }),
    selectCols: blocks.selectCols.map(item),
    wheres: blocks.wheres.map(w => w.raw !== undefined ? { ...w, raw: text(w.raw) } : { ...w, col: col(w.col) }),
    groupBy: blocks.groupBy.map(col),
    aggs: blocks.aggs.map(a => ({ ...a, col: col(a.col) })),
    orderBy: blocks.orderBy.map(o => ({ ...o, col: col(o.col) }))
  };
  if (!b.tableAlias) delete b.tableAlias;
  return b;
}

// Rollen-Namen: nur Buchstaben, Ziffern, _ (Umlaute werden umgeschrieben), eindeutig in der Abfrage
function cleanRef(raw) {
  let s = String(raw || '').trim().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss').replace(/\W+/g, '_');
  if (s && (!/^[A-Za-z_]/.test(s) || ALIAS_RESERVED.test(s))) s = 't_' + s;
  return s;
}
function localName(table) { return unquoteIdent(splitIdent(table || '').pop() || ''); }
function freeRef(sources, table) {
  const base = cleanRef(localName(table)) || 'tabelle';
  let n = 2;
  while (sources.some(s => s.ref === base + '_' + n)) n++;
  return base + '_' + n;
}
// Ist der Name in der Abfrage schon vergeben – als Rolle, als Tabelle oder als Kurzname einer Tabelle ohne Rolle?
function refTaken(sources, name) {
  const n = String(name).toLowerCase();
  return sources.some(s => s.ref.toLowerCase() === n || s.table.toLowerCase() === n ||
    (s.ref === s.table && localName(s.table).toLowerCase() === n));
}

// Verbindung i nachträglich ändern (andere Beziehung, Tabelle oder Spalten): Ein selbst vergebener
// Rollen-Name bleibt erhalten, und alles, was diese Rolle verwendet – Spalten, Filter, Sortierung und
// Verbindungen, die an ihr hängen – zieht mit. So entstehen keine Verweise ins Leere.
function replaceJoin(blocks, i, nj) {
  const old = blocks.joins[i] || {};
  const oldRef = old.rightTable ? joinRightRef(old) : null;
  // Spätere Verbindungen nennen die alte Rolle noch auf ihrer linken Seite – die zählt nicht als belegt
  const others = querySources({ ...blocks, joins: blocks.joins.filter((_, y) => y !== i) }).filter(s => s.ref !== oldRef);
  nj = { ...nj };
  delete nj.rightAlias;
  if (nj.rightTable) {
    const given = old.rightTable && old.rightAlias;
    // „nutzer_2“ & Co. hat die App selbst vergeben – bei einer anderen Tabelle passt so ein Name nicht mehr
    const generated = given && new RegExp('^' + cleanRef(localName(old.rightTable)) + '_\\d+$').test(given);
    if (given && (nj.rightTable === old.rightTable || !generated) && !refTaken(others, given)) nj.rightAlias = given;
    else if (others.some(s => s.table === nj.rightTable || s.ref === nj.rightTable)) nj.rightAlias = freeRef(others, nj.rightTable);
  }
  if (!nj.leftRef || nj.leftRef === nj.leftTable) delete nj.leftRef;
  let b = { ...blocks, active: { ...blocks.active, join: true }, joins: blocks.joins.map((x, y) => y === i ? nj : x) };
  const newRef = nj.rightTable ? joinRightRef(nj) : null;
  if (oldRef && newRef && oldRef !== newRef) b = renameRef(b, oldRef, newRef);
  // Hängen spätere Verbindungen an dieser Rolle, steht dort jetzt die neue Tabelle
  if (newRef && old.rightTable && nj.rightTable !== old.rightTable) {
    const retable = (ref, table) => ref === newRef ? nj.rightTable : table;
    b.joins = b.joins.map((x, y) => {
      if (y <= i) return x;
      const nx = { ...x, leftTable: retable(joinLeftRef(x), x.leftTable) };
      if (nx.leftRef === nx.leftTable) delete nx.leftRef;
      if (x.leftAlt) nx.leftAlt = x.leftAlt.map(a => ({ ...a, table: retable(a.ref, a.table) }));
      return nx;
    });
  }
  return b;
}

// Eine WHERE-Bedingung als SQL (inkl. optionaler Funktion auf der Spalte)
function condSQL(w) {
  if (w.raw !== undefined) return '(' + w.raw.trim() + ')';
  const fns = normFns(w.fns);
  const colExpr = chainExpr(w.col, fns);
  const forceText = chainRet(fns) === 'text';
  const val = (forceText && w.op !== 'LIKE')
    ? "'" + String(w.val).replace(/'/g, "''") + "'"
    : quoteVal(w.val, w.op);
  return colExpr + ' ' + w.op + ' ' + val;
}

function buildWhereTxt(blocks) {
  if (!blocks.active.where) return '';
  const conds = blocks.wheres.filter(w =>
    w.raw !== undefined ? w.raw.trim() : (w.col && w.val !== ''));
  if (!conds.length) return '';
  return 'WHERE ' + conds.map((w, i) => (i ? (w.conj || 'AND') + ' ' : '') + condSQL(w)).join(' ');
}

function groupColExpr(blocks, col) {
  return chainExpr(col, blocks.groupFns);
}
function groupColAlias(blocks, col) {
  return chainAlias(blocks.groupFns, col);
}

// Erzeugt das vollständige SQL als Liste von Klausel-Zeilen
function buildQueryParts(blocks) {
  if (!blocks.table) return null;
  const grouped = blocks.active.group && (blocks.groupBy.length || blocks.aggs.length);

  let selectList;
  if (grouped) {
    const hasGfn = normFns(blocks.groupFns).length > 0;
    const gparts = blocks.groupBy.map((c, i) => {
      const named = ((blocks.groupAliases || [])[i] || '').trim();
      if (named) return groupColExpr(blocks, c) + ' AS ' + aliasSQL(named);
      return hasGfn ? groupColExpr(blocks, c) + ' AS ' + groupColAlias(blocks, c) : c;
    });
    const parts = [...gparts, ...blocks.aggs.filter(a => a.col).map(aggExpr)];
    selectList = parts.length ? parts.join(', ') : '*';
  } else if (blocks.active.select && blocks.selectCols.length) {
    selectList = blocks.selectCols
      .filter(selectItemReady)
      .map(it => {
        if (it.kind) return (it.kind === 'case' ? caseSQL(it) : it.kind === 'value' ? (it.val === '' || it.val == null ? 'NULL' : operandSQL({ val: it.val })) : operandSQL({ first: it.items })) +
          ' AS ' + aliasSQL(userAlias(it) || autoSelectAlias(it));
        if (it.expr !== undefined) {
          return '(' + it.expr.trim() + ') AS ' + aliasSQL(userAlias(it) || 'formel');
        }
        const fns = normFns(it.fns);
        const named = userAlias(it);
        if (named) return chainExpr(it.col, fns) + ' AS ' + aliasSQL(named);
        return fns.length ? chainExpr(it.col, fns) + ' AS ' + chainAlias(fns, it.col) : it.col;
      })
      .join(', ') || '*';
  } else {
    selectList = '*';
  }

  const parts = [];
  const distinct = blocks.distinct && !grouped ? 'DISTINCT ' : '';
  parts.push({ key: 'select', text: 'SELECT ' + distinct + selectList });
  parts.push({ key: 'from', text: 'FROM ' + fromSQL(blocks) });

  if (blocks.active.join) {
    blocks.joins.forEach(j => {
      if (joinComplete(j)) parts.push({ key: 'join', text: joinSQL(j) });
    });
  }

  if (blocks.active.where) {
    const whereTxt = buildWhereTxt(blocks);
    if (whereTxt) parts.push({ key: 'where', text: whereTxt });
  }

  if (grouped && blocks.groupBy.length) {
    parts.push({ key: 'group', text: 'GROUP BY ' + blocks.groupBy.map(c => groupColExpr(blocks, c)).join(', ') });
  }

  if (blocks.active.order) {
    const os = blocks.orderBy.filter(o => o.col);
    if (os.length) {
      parts.push({ key: 'order', text: 'ORDER BY ' + os.map(o =>
        chainExpr(quoteIdent(o.col), o.fns) + ' ' + o.dir).join(', ') });
    }
  }

  if (blocks.active.limit && blocks.limit) {
    parts.push({ key: 'limit', text: 'LIMIT ' + blocks.limit });
  }

  return parts;
}

function buildQuerySQL(blocks) {
  const parts = buildQueryParts(blocks);
  if (!parts) return null;
  return parts.map(p => p.text).join('\n') + ';';
}

// Ist nur eine Datenbank geöffnet, findet SQLite ihre Tabellen auch ohne Datenbanknamen:
// „plauder.nutzer.name“ → „nutzer.name“. Text in '…' und Rollen-Namen bleiben unangetastet.
function withoutDatabase(sql, ns, tableNames) {
  if (!sql || !ns || !tableNames.length) return sql;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const names = tableNames.map(n => esc(aliasSQL(n))).sort((a, b) => b.length - a.length).join('|');
  const re = new RegExp("'(?:[^']|'')*'|(^|[^\\w.\"])" + esc(aliasSQL(ns)) + '\\.(?=(?:' + names + ')(?![\\w"]))', 'g');
  return sql.replace(re, (m, pre) => (pre === undefined ? m : pre));
}

// Zwischenstände für die Lauf-Animation: wie viele Zeilen nach jeder Stufe?
function buildStageCountSQLs(blocks) {
  if (!blocks.table) return {};
  const out = {};
  const joinTxt = blocks.active.join
    ? blocks.joins.filter(joinComplete).map(j => ' ' + joinSQL(j)).join('')
    : '';
  const conds = blocks.active.where ? blocks.wheres.filter(w => w.col && w.val !== '') : [];
  const whereClause = buildWhereTxt(blocks);
  const whereTxt = whereClause ? ' ' + whereClause : '';

  out.from = 'SELECT COUNT(*) AS c FROM ' + fromSQL(blocks);
  if (joinTxt) out.join = 'SELECT COUNT(*) AS c FROM ' + fromSQL(blocks) + joinTxt;
  if (whereTxt) out.where = 'SELECT COUNT(*) AS c FROM ' + fromSQL(blocks) + joinTxt + whereTxt;
  if (blocks.active.group && blocks.groupBy.length) {
    out.group = 'SELECT COUNT(*) AS c FROM (SELECT 1 FROM ' + fromSQL(blocks) + joinTxt + whereTxt +
                ' GROUP BY ' + blocks.groupBy.map(c => groupColExpr(blocks, c)).join(', ') + ')';
  }
  return out;
}

// --- Syntax-Highlighting (gibt HTML-String zurück) ---
const SQL_KEYWORDS = '\\b(SELECT|DISTINCT|FROM|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|CROSS|ON|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|AND|OR|NOT|AS|ASC|DESC|LIKE|IN|IS|NULL|COUNT|SUM|AVG|MIN|MAX|INSERT INTO|INSERT|VALUES|UPDATE|SET|DELETE|UPPER|LOWER|LENGTH|TRIM|SUBSTR|ROUND|ABS|CAST|INTEGER|COALESCE|IFNULL|TYPEOF|CASE|WHEN|THEN|ELSE|END|EXISTS|BETWEEN|DISTINCT|UNION)\\b';

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightSQL(sql) {
  let s = escapeHtml(sql).replace(/\u0001/g, '');
  const strings = [];
  s = s.replace(/'(?:[^']|'')*'/g, m => {
    strings.push(m);
    // Platzhalter ohne nackte Ziffern (S0S statt 0), damit das Zahlen-Highlighting ihn nicht zerstört
    return '\u0001S' + (strings.length - 1) + 'S\u0001';
  });
  s = s.replace(new RegExp(SQL_KEYWORDS, 'g'), '<span class="sql-kw">$1</span>');
  s = s.replace(/\b(strftime|julianday|datetime|date|time)(\s*\()/g, '<span class="sql-fn">$1</span>$2');
  s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="sql-num">$1</span>');
  s = s.replace(/\u0001S(\d+)S\u0001/g, (m, i) => '<span class="sql-str">' + strings[Number(i)] + '</span>');
  return s;
}

Object.assign(window, {
  BLOCK_DEFS, PIPELINE_ORDER, OPERATORS, AGG_FNS, FN_CATS, FN_DEFS,
  JOIN_TYPES, joinType, joinComplete, joinSQL, joinLeftAlt, joinLeftExpr, joinLeftRef, joinRightRef, refLabel, fromSQL, querySources, queryTables, sourceTable, joinKeeps, joinExplain, joinTypeLabel,
  CASE_OPERATORS, operandReady, operandSQL, caseSQL, selectItemReady, renameRef, cleanRef, localName, freeRef, refTaken, replaceJoin, joinForRelation, syncJoinLines, joinPreviewSQL,
  emptyBlocks, quoteVal, isNum, tablesInQuery, availableColumns, requalifyColumns,
  aggAlias, aggExpr, aggDisplayAlias, groupDisplayAlias,
  colMatches, aliasSQL, quoteIdent, userAlias, autoSelectAlias, resultAliases, fnExpr, fnAlias, normFns, chainExpr, chainAlias, chainRet,
  condSQL, buildWhereTxt, groupColExpr, groupColAlias,
  buildQueryParts, buildQuerySQL, withoutDatabase, buildStageCountSQLs,
  highlightSQL, escapeHtml
});
