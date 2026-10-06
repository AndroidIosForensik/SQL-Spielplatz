// SQL Spielplatz — Haupt-App

const SQLJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/';

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tempo": 1,
  "linien": "Kurven",
  "konfetti": true
}/*EDITMODE-END*/;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function execResult(db, sql) {
  const res = db.exec(sql);
  if (!res.length) return { columns: [], rows: [] };
  return { columns: res[0].columns, rows: res[0].values };
}
function execScalar(db, sql) {
  try {
    const r = db.exec(sql);
    return r.length ? r[0].values[0][0] : 0;
  } catch (e) { return null; }
}

function friendlyError(e) {
  let m = String(e.message || e);
  if (/no such table: (.+)/.test(m)) return 'Die Tabelle „' + m.match(/no such table: (.+)/)[1] + '“ gibt es nicht.';
  if (/no such column: ([\w.]+)/.test(m)) return 'Die Spalte „' + m.match(/no such column: ([\w.]+)/)[1] + '“ gibt es nicht (mehr).';
  if (/ambiguous column name: ([\w.]+)/.test(m)) return 'Die Spalte „' + m.match(/ambiguous column name: ([\w.]+)/)[1] + '“ gibt es in mehreren Tabellen — SQL weiß nicht, welche gemeint ist.';
  if (/(?:table|view) (.+) already exists/.test(m)) return 'Es gibt schon eine Tabelle oder Ansicht „' + m.match(/(?:table|view) (.+) already exists/)[1] + '“ — anderen Namen wählen oder die alte zuerst mit DROP VIEW entfernen.';
  if (/cannot reference objects in database/.test(m)) return 'Eine Ansicht, die Tabellen aus geöffneten Datenbanken verwendet, bitte mit CREATE TEMP VIEW anlegen — SQLite erlaubt dauerhafte Ansichten nur innerhalb einer Datenbank.';
  if (/syntax error/.test(m)) return 'SQL-Syntaxfehler: ' + m;
  return m;
}

// Schema aus einer geöffneten DB lesen (Tabellen und Ansichten/VIEWs)
function introspect(db, layout, namespace) {
  const ns = aliasSQL(namespace);
  const tablesRes = db.exec(`SELECT name, sql, type FROM ${ns}.sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name`);
  // Virtuelle Tabellen (FTS-Suchindex etc.) überspringen — deren Module fehlen im Browser
  const rows = (tablesRes.length ? tablesRes[0].values : [])
    .filter(v => !/CREATE\s+VIRTUAL\s+TABLE/i.test(v[1] || ''));
  const views = new Map(rows.filter(v => v[2] === 'view').map(v => [v[0], v[1]]));
  const names = rows.map(v => v[0]);
  const tables = [];
  names.forEach((name, i) => {
    try {
      const info = db.exec(`PRAGMA ${ns}.table_info(${aliasSQL(name)})`);
      const columns = info.length ? info[0].values.map(r => ({
        name: r[1], type: (r[2] || '').toUpperCase(), pk: r[5] > 0
      })) : [];
      if (!columns.length) return;
      // table_info merkt sich die Spalten einer Ansicht – ob sie noch lesbar ist, zeigt erst eine Abfrage
      if (views.has(name)) db.exec(`SELECT * FROM ${ns}.${aliasSQL(name)} LIMIT 0`);
      const pos = (layout && layout[name]) || {
        x: 50 + (i % 3) * 300, y: 50 + Math.floor(i / 3) * 260
      };
      tables.push(views.has(name) ? { name, columns, x: pos.x, y: pos.y, view: true, sql: views.get(name) } : { name, columns, x: pos.x, y: pos.y });
    } catch (e) { /* Tabelle nicht lesbar (z.B. Ansicht auf eine geschlossene Datenbank) → überspringen */ }
  });
  // In der Datei hinterlegte Fremdschlüssel (REFERENCES …) – nur als Vorschlag, gepunktet im Diagramm.
  // Vermutungen aus Spaltennamen gibt es bewusst nicht.
  const foreignKeys = [];
  tables.filter(t => !t.view).forEach(({ name }) => {
    try {
      const fk = db.exec(`PRAGMA ${ns}.foreign_key_list(${aliasSQL(name)})`);
      if (fk.length) fk[0].values.forEach(r => {
        const refTable = r[2], from = r[3];
        let to = r[4];
        if (!to) {
          const rt = tables.find(t => t.name === refTable);
          const pk = rt && rt.columns.find(c => c.pk);
          to = pk ? pk.name : 'id';
        }
        if (tables.some(t => t.name === refTable)) {
          foreignKeys.push({ id: 'fk_' + name + '_' + from, from: { table: name, col: from }, to: { table: refTable, col: to } });
        }
      });
    } catch (e) { /* kein FK lesbar */ }
  });
  const qualified = name => ns + '.' + aliasSQL(name);
  return {
    tables: tables.map(t => ({ ...t, name: qualified(t.name), database: namespace, localName: t.name })),
    foreignKeys: foreignKeys.map(r => ({ ...r, id: namespace + '_' + r.id,
      from: { ...r.from, table: qualified(r.from.table) }, to: { ...r.to, table: qualified(r.to.table) } }))
  };
}
// Gleiche Spalten an beiden Enden (Richtung egal)?
function sameLink(a, b) {
  return (a.from.table === b.from.table && a.from.col === b.from.col && a.to.table === b.to.table && a.to.col === b.to.col) ||
    (a.from.table === b.to.table && a.from.col === b.to.col && a.to.table === b.from.table && a.to.col === b.from.col);
}

// Eigene Tabellen und Ansichten des Arbeitsbereichs (z.B. CREATE TEMP VIEW personen …) neu einlesen.
// Vorhandene Karten behalten Platz und Größe, neue kommen an die nächste freie Stelle oben links.
const WORKSPACE_NS = ['main', 'temp'];
function withWorkspaceObjects(db, tables) {
  const old = new Map(tables.map(t => [t.name, t]));
  const base = tables.filter(t => !t.workspace);
  const fresh = WORKSPACE_NS.flatMap(ns => {
    try { return introspect(db, null, ns).tables.map(t => ({ ...t, workspace: true })); } catch (e) { return []; }
  });
  const kept = fresh.filter(t => old.has(t.name)).map(t => {
    const o = old.get(t.name);
    return { ...t, x: o.x, y: o.y, w: o.w, h: o.h };
  });
  const added = fresh.filter(t => !old.has(t.name)).map(t => ({ ...t, x: 28, y: 28 }));
  const spots = added.length ? placeTables(added, [...base, ...kept]) : {};
  return [...base, ...kept, ...added.map(t => ({ ...t, ...spots[t.name] }))];
}

// Ansichten, die angelegt wurden, sich aber nicht lesen lassen (z.B. CREATE VIEW ohne TEMP über zwei Datenbanken)
function brokenViews(db) {
  return WORKSPACE_NS.flatMap(ns => {
    let names = [];
    try { const r = db.exec(`SELECT name FROM ${ns}.sqlite_master WHERE type='view'`); names = r.length ? r[0].values.map(v => v[0]) : []; }
    catch (e) { return []; }
    return names.flatMap(name => {
      try { db.exec(`SELECT * FROM ${ns}.${aliasSQL(name)} LIMIT 0`); return []; }
      catch (e) { return [{ name, ns, error: friendlyError(e) }]; }
    });
  });
}

function isSchemaChange(sql) {
  return /\b(CREATE|DROP|ALTER)\s/i.test(String(sql || '').replace(/'(?:[^']|'')*'/g, "''"));
}

// Interne/leere Tabellen anfangs ausblenden (Suchindex-Tabellen etc.)
function defaultHiddenTables(tables, counts) {
  const hid = new Set();
  tables.forEach(t => {
    const n = t.localName || t.name;
    if (/_fts/i.test(n) || /(_config|_docsize|_idx|_data|_content|_segments|_segdir|_stat)$/i.test(n)) hid.add(t.name);
    else if (!counts[t.name]) hid.add(t.name);
  });
  if (hid.size >= tables.length) hid.clear();
  return hid;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const speed = t.tempo || 1;

  // Hell / Dunkel
  const [theme, setTheme] = React.useState(() => localStorage.getItem('sqlsp_theme') || 'hell');
  React.useEffect(() => {
    if (theme === 'dunkel') document.body.setAttribute('data-theme', 'dark');
    else document.body.removeAttribute('data-theme');
    localStorage.setItem('sqlsp_theme', theme);
  }, [theme]);

  const [SQLMod, setSQLMod] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [databases, setDatabases] = React.useState([]);
  const databaseRef = React.useRef([]);
  const dbRef = React.useRef(null);
  const [loadingFiles, setLoadingFiles] = React.useState(false);
  const loadingRef = React.useRef(false);
  const dbName = databases.map(d => d.name).join(' + ');
  const [isSample, setIsSample] = React.useState(true); // hat diese DB ein Aufgaben-Set?
  const [chSetKey, setChSetKey] = React.useState('plauder'); // welches Aufgaben-Set?
  const [schema, setSchema] = React.useState({ tables: [] });
  const [relations, setRelations] = React.useState([]);
  const relationsRef = React.useRef([]);
  relationsRef.current = relations;
  // Fremdschlüssel aus den Dateien: gepunktete Vorschläge; ✕ blendet einen für diese Sitzung aus
  const [foreignKeys, setForeignKeys] = React.useState([]);
  const [dismissedFks, setDismissedFks] = React.useState(new Set());
  const [counts, setCounts] = React.useState({});
  const [hidden, setHidden] = React.useState(new Set());
  // Selbst gewähltes Aus-/Einblenden bleibt auch nach Neuladen erhalten: {tabelle: true = ausgeblendet}
  const hiddenChoice = React.useRef((() => {
    try { return JSON.parse(localStorage.getItem('sqlsp_hidden')) || {}; } catch (e) { return {}; }
  })());
  const [dataVersion, setDataVersion] = React.useState(0);

  const [blocks, setBlocksRaw] = React.useState(emptyBlocks);
  const schemaRef = React.useRef(schema);
  schemaRef.current = schema;
  // Jede Block-Änderung re-qualifiziert die Spalten zur aktuellen Tabellen-Menge
  const setBlocks = React.useCallback((upd) => {
    setBlocksRaw(prev => {
      const next = typeof upd === 'function' ? upd(prev) : upd;
      return requalifyColumns(next, schemaRef.current);
    });
  }, []);
  const [tab, setTab] = React.useState('build'); // build | modify
  const [viewDraft, setViewDraft] = React.useState(null); // {select, stamp}: Abfrage → „Daten ändern“ als Ansicht
  const [sqlMode, setSqlMode] = React.useState(false);
  const [customSQL, setCustomSQL] = React.useState('');

  const [running, setRunning] = React.useState(false);
  const [runStage, setRunStage] = React.useState(null);
  const [stageCounts, setStageCounts] = React.useState({});
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [notice, setNotice] = React.useState(null);
  const [runId, setRunId] = React.useState(0);
  const [flashTable, setFlashTable] = React.useState(null);
  const [loadErr, setLoadErr] = React.useState(null);
  const [previews, setPreviews] = React.useState([]); // [{table, columns, rows, total, stamp, x, y, z}]
  const zCounter = React.useRef(30);

  // Aufgaben
  const [chIdx, setChIdx] = React.useState(0);
  const [chSolved, setChSolved] = React.useState(new Set());
  const [chStatus, setChStatus] = React.useState(null);
  const [chVisible, setChVisible] = React.useState(true);
  const [chHint, setChHint] = React.useState(false);

  const distinctCache = React.useRef({});
  const fileRef = React.useRef(null);
  const queryFileRef = React.useRef(null);

  // Breite der rechten Spalte (ziehbar, wird gemerkt)
  const [rightW, setRightW] = React.useState(() => {
    const v = Number(localStorage.getItem('sqlsp_rightW'));
    return v >= 320 ? v : null;
  });
  const startResize = (e) => {
    e.preventDefault();
    const move = (ev) => {
      const w = Math.min(Math.max(320, window.innerWidth - ev.clientX), Math.max(360, window.innerWidth - 320));
      setRightW(w);
      localStorage.setItem('sqlsp_rightW', String(Math.round(w)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('resizing');
    };
    document.body.classList.add('resizing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // sql.js laden
  React.useEffect(() => {
    initSqlJs({ locateFile: f => (window.__resources && window.__resources.sqlWasm) ? window.__resources.sqlWasm : SQLJS_CDN + f })
      .then(setSQLMod)
      .catch(e => setLoadErr('Die SQL-Engine konnte nicht geladen werden: ' + e.message));
  }, []);

  const refreshCounts = (theDb, theSchema) => {
    const c = {};
    theSchema.tables.forEach(tb => { c[tb.name] = execScalar(theDb, `SELECT COUNT(*) FROM ${tb.name}`); });
    setCounts(c);
  };

  const syncWorkspace = (sources, addedSchema) => {
    databaseRef.current = sources;
    setDatabases(sources);
    const tables = addedSchema.tables;
    schemaRef.current = { tables };
    setSchema({ tables });
    setRelations(addedSchema.relations);
    refreshCounts(dbRef.current, { tables });
    distinctCache.current = {};
    setDataVersion(v => v + 1);
    const sample = sources.length === 1 && sources[0].sample;
    setIsSample(!!sample);
    setChSetKey(sample || null);
    setChVisible(!!sample);
    setChIdx(0); setChSolved(new Set()); setChStatus(null); setChHint(false);
  };

  const adoptDb = (source, name, sample, layout) => {
    const workspace = dbRef.current || new SQLMod.Database();
    dbRef.current = workspace;
    const sources = databaseRef.current;
    if (sources.length >= 10) throw new Error('Maximal 10 Datenbanken gleichzeitig. Schließe zuerst eine Datenbank.');
    const base = (sample ? (name === window.ORG_DB_NAME ? 'organisation' : 'plauder') : name).replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'datenbank';
    const stem = /^[a-z_]/.test(base) && !ALIAS_RESERVED.test(base) && !['main', 'temp'].includes(base) ? base : 'db_' + base;
    let alias = stem, suffix = 2;
    while (sources.some(d => d.alias === alias)) alias = stem + '_' + suffix++;
    workspace.run('ATTACH DATABASE ? AS ' + aliasSQL(alias), [source.filename]);
    let s;
    try { s = introspect(workspace, layout, alias); }
    catch (e) { workspace.run('DETACH DATABASE ' + aliasSQL(alias)); throw e; }
    const c = {};
    s.tables.forEach(tb => { c[tb.name] = execScalar(workspace, `SELECT COUNT(*) FROM ${tb.name}`); });
    const hid = sample ? new Set() : defaultHiddenTables(s.tables, c);
    s.tables.forEach(tb => {
      const choice = hiddenChoice.current[tb.name];
      if (choice === true) hid.add(tb.name);
      else if (choice === false) hid.delete(tb.name);
    });
    const oldTables = schemaRef.current.tables;
    // Keep the source handle alive: its virtual file backs ATTACH until DETACH.
    const next = [...sources, { alias, name, source, sample: sample ? (name === window.ORG_DB_NAME ? 'orga' : 'plauder') : null }];
    window.__db = workspace;
    setDb(workspace);
    setHidden(h => new Set([...h, ...hid]));
    // Eigene Ansichten, die auf diese Datenbank warten, werden jetzt wieder lesbar
    syncWorkspace(next, { tables: withWorkspaceObjects(workspace, [...oldTables, ...s.tables]), relations: relationsRef.current });
    setForeignKeys(fks => [...fks, ...s.foreignKeys]);
    setLoadErr(null);
    if (sources.length) setNotice('✓ „' + name + '“ als ' + alias + ' hinzugefügt. Tabellen über ihre Spaltenpunkte verbinden und im JOIN-Baustein auswählen.');
  };

  const closeDatabase = (alias) => {
    if (running || loadingRef.current) return;
    const entry = databaseRef.current.find(d => d.alias === alias);
    if (!entry) return;
    try {
      dbRef.current.run('DETACH DATABASE ' + aliasSQL(alias));
      entry.source.close();
      // Eigene Ansichten auf diese Datenbank lassen sich nicht mehr lesen → ihre Karten verschwinden mit
      const tables = withWorkspaceObjects(dbRef.current, schemaRef.current.tables.filter(t => t.database !== alias));
      const removed = new Set(schemaRef.current.tables.filter(t => !tables.some(x => x.name === t.name)).map(t => t.name));
      const keptRelations = relationsRef.current.filter(r => !removed.has(r.from.table) && !removed.has(r.to.table));
      relationsRef.current = keptRelations;
      syncWorkspace(databaseRef.current.filter(d => d !== entry), { tables, relations: keptRelations });
      setHidden(h => new Set([...h].filter(n => !removed.has(n))));
      setForeignKeys(fks => fks.filter(r => !removed.has(r.from.table) && !removed.has(r.to.table)));
      setPreviews(ps => ps.filter(p => !removed.has(p.table)));
      const affected = [blocks.table, ...blocks.joins.flatMap(j => [j.leftTable, j.rightTable])].some(t => removed.has(t));
      if (affected) setBlocksRaw(emptyBlocks());
      setResult(null); setError(null); setStageCounts({});
      setNotice('„' + entry.name + '“ geschlossen.' + (affected ? ' Die betroffene Baustein-Abfrage wurde zurückgesetzt.' : '') + ' Die Originaldatei bleibt unverändert.');
    } catch (e) { setLoadErr('Datenbank konnte nicht geschlossen werden: ' + e.message); }
  };

  // Nach CREATE/DROP: eigene Tabellen und Ansichten neu einlesen und im Diagramm nachziehen
  const refreshWorkspace = () => {
    const d = dbRef.current;
    const before = schemaRef.current.tables;
    const tables = withWorkspaceObjects(d, before);
    const names = new Set(tables.map(tb => tb.name));
    const removed = new Set(before.filter(tb => !names.has(tb.name)).map(tb => tb.name));
    const added = tables.filter(tb => !before.some(b => b.name === tb.name));
    schemaRef.current = { tables };
    setSchema({ tables });
    refreshCounts(d, { tables });
    // Neu angelegt heißt: sichtbar – auch wenn eine gleichnamige Ansicht früher ausgeblendet war
    added.forEach(tb => { delete hiddenChoice.current[tb.name]; });
    if (removed.size) {
      relationsRef.current = relationsRef.current.filter(r => !removed.has(r.from.table) && !removed.has(r.to.table));
      setRelations(relationsRef.current);
      setPreviews(ps => ps.filter(p => !removed.has(p.table)));
      setBlocksRaw(b => [b.table, ...b.joins.flatMap(j => [j.leftTable, j.rightTable])].some(n => removed.has(n)) ? emptyBlocks() : b);
      removed.forEach(n => { delete hiddenChoice.current[n]; });
    }
    try { localStorage.setItem('sqlsp_hidden', JSON.stringify(hiddenChoice.current)); } catch (e) {}
    setHidden(h => new Set([...h].filter(n => names.has(n) && !added.some(tb => tb.name === n))));
    const broken = brokenViews(d);
    return { added, removed: before.filter(tb => removed.has(tb.name)), broken };
  };
  const schemaChangeText = ({ added, removed, broken }, name) => {
    const label = tb => '„' + (tb.localName || tb.name) + '“';
    const parts = [];
    const views = added.filter(tb => tb.view), tables = added.filter(tb => !tb.view);
    if (views.length) parts.push('✓ Ansicht ' + views.map(label).join(', ') + ' angelegt – sie steht als blaue Karte im Diagramm und lässt sich in „Abfragen“ wie eine Tabelle verwenden.');
    if (tables.length) parts.push('✓ Tabelle ' + tables.map(label).join(', ') + ' angelegt.');
    if (removed.length && !added.length) parts.push('✓ ' + removed.map(label).join(', ') + ' entfernt.');
    const replaced = !added.length && !removed.length && schemaRef.current.tables.find(tb => tb.name === name && tb.view);
    if (replaced) parts.push('✓ Ansicht ' + label(replaced) + ' aktualisiert.');
    if (!parts.length) parts.push('✓ Ausgeführt.');
    if (broken.length) return { error: 'Die Ansicht „' + broken[0].name + '“ lässt sich nicht lesen: ' + broken[0].error +
      (broken[0].ns === 'main' ? ' Tipp: Ansichten über geöffnete Datenbanken mit CREATE TEMP VIEW anlegen (und mit DROP VIEW ' + aliasSQL(broken[0].name) + '; die kaputte entfernen).' : '') };
    return { text: parts.join(' ') };
  };

  const loadSample = () => {
    if (!SQLMod || running || loadingRef.current) return;
    let source;
    try {
      source = new SQLMod.Database();
      source.run(window.SAMPLE_DB_SQL);
      adoptDb(source, window.SAMPLE_DB_NAME, true, window.SAMPLE_LAYOUT);
    } catch (e) { if (source) source.close(); setLoadErr(e.message); }
  };

  React.useEffect(() => { if (SQLMod && !dbRef.current) loadSample(); }, [SQLMod]);

  const loadOrg = () => {
    if (!SQLMod || running || loadingRef.current) return;
    let source;
    try {
      source = window.buildOrgDb(SQLMod);
      adoptDb(source, window.ORG_DB_NAME, true, window.ORG_LAYOUT);
    } catch (e) { if (source) source.close(); setLoadErr(e.message); }
  };

  const EXCEL_EXT = ['xlsx', 'xls', 'csv', 'ods'];
  const openFiles = async (files) => {
    if (loadingRef.current || running) return;
    loadingRef.current = true; setLoadingFiles(true); setLoadErr(null);
    const failures = [];
    for (const file of files) {
      let source;
      try {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const buf = await file.arrayBuffer();
        source = EXCEL_EXT.includes(ext)
          ? buildDbFromWorkbook(SQLMod, XLSX.read(buf, { cellDates: true }))
          : new SQLMod.Database(new Uint8Array(buf));
        source.exec('SELECT name FROM sqlite_master LIMIT 1');
        adoptDb(source, file.name, false, null);
      } catch (e) {
        if (source) source.close();
        failures.push('„' + file.name + '“: ' + (e.message || e));
      }
    }
    setLoadErr(failures.length ? 'Nicht geöffnet: ' + failures.join(' · ') : null);
    loadingRef.current = false; setLoadingFiles(false);
  };

  const getDistinct = React.useCallback((col, expr, tblOverride) => {
    if (!db || !col) return [];
    const key = dataVersion + '|' + (expr || col) + '|' + (tblOverride || blocks.table || '');
    if (distinctCache.current[key]) return distinctCache.current[key];
    let table, c;
    const parts = tblOverride ? [aliasSQL(col)] : splitIdent(col); c = parts.pop(); table = parts.length ? sourceTable(blocks, parts.join('.')) : (tblOverride || blocks.table);
    if (!table) return [];
    if (!tblOverride && parts.length && parts.join('.') !== table) table += ' AS ' + parts.join('.');
    try {
      const sel = expr || c;
      const r = db.exec(`SELECT DISTINCT ${sel} FROM ${table} WHERE ${sel} IS NOT NULL ORDER BY 1 LIMIT 200`);
      const vals = r.length ? r[0].values.map(v => v[0]).filter(v => v !== null) : [];
      distinctCache.current[key] = vals;
      return vals;
    } catch (e) { return []; }
  }, [db, blocks, dataVersion]);

  // Kleine Probe-Abfragen für Vorschauen im Bau-Bereich (z.B. Join-Arten vergleichen), zwischengespeichert
  const previewCache = React.useRef({});
  const runPreview = React.useCallback((sql) => {
    const key = dataVersion + '|' + sql;
    if (!previewCache.current[key]) {
      try { previewCache.current[key] = execResult(db, sql); }
      catch (e) { previewCache.current[key] = { error: friendlyError(e) }; }
    }
    return previewCache.current[key];
  }, [db, dataVersion]);

  /* ---------- Daten-Vorschau (mehrere Fenster) ---------- */
  // Zeilen je Vorschaufenster; der Rest der Tabelle ist per Abfrage erreichbar
  const PREVIEW_ROWS = 100;
  const fetchPreviewData = (d, name) => {
    const res = execResult(d, `SELECT * FROM ${name} LIMIT ${PREVIEW_ROWS}`);
    const total = execScalar(d, `SELECT COUNT(*) FROM ${name}`);
    return { columns: res.columns, rows: res.rows, total, stamp: Date.now() };
  };

  const openPreview = React.useCallback((name, theDb) => {
    const d = theDb || db;
    if (!d) return;
    try {
      const data = fetchPreviewData(d, name);
      setPreviews(ps => {
        const z = ++zCounter.current;
        const ex = ps.find(p => p.table === name);
        if (ex) return ps.map(p => p.table === name ? { ...p, ...data, z } : p);
        // gestaffelte Startposition unten links
        const host = document.querySelector('.left');
        const baseY = host ? Math.max(60, host.clientHeight - 360) : 200;
        const n = ps.length;
        return [...ps, { table: name, ...data, x: 14 + (n % 5) * 38, y: Math.max(6, baseY - (n % 5) * 38), z }];
      });
    } catch (e) { /* Tabelle existiert nicht (mehr) */ }
  }, [db]);

  const closePreview = (name) => setPreviews(ps => ps.filter(p => p.table !== name));
  const movePreview = (name, x, y) => setPreviews(ps => ps.map(p => p.table === name ? { ...p, x, y } : p));
  const focusPreview = (name) => setPreviews(ps => {
    const me = ps.find(p => p.table === name);
    if (!me || me.z === zCounter.current) return ps;
    const z = ++zCounter.current;
    return ps.map(p => p.table === name ? { ...p, z } : p);
  });

  // Nach Datenänderungen alle offenen Vorschau-Fenster aktualisieren
  React.useEffect(() => {
    if (!db) return;
    setPreviews(ps => ps.map(p => {
      try { return { ...p, ...fetchPreviewData(db, p.table) }; }
      catch (e) { return null; }
    }).filter(Boolean));
  }, [dataVersion]);

  // Live-Vorschau für den Funktions-Assistenten: 3 echte Werte vorher/nachher
  const fnPreview = React.useCallback((col, expr, preferNull) => {
    if (!db || !col || !expr) return [];
    let table, c;
    const parts = splitIdent(col); c = parts.pop(); table = parts.length ? sourceTable(blocks, parts.join('.')) : blocks.table;
    if (!table) return [];
    // Spalten mit Alias (sj.raw_string) brauchen den Alias auch im FROM
    if (parts.length && parts.join('.') !== table) table += ' AS ' + parts.join('.');
    try {
      // Bei NULL-Funktionen (COALESCE/IFNULL) NULL-Werte bevorzugen, sonst ausblenden
      const order = preferNull ? `ORDER BY (${col} IS NULL) DESC` : `WHERE ${col} IS NOT NULL`;
      const r = db.exec(`SELECT DISTINCT ${col}, ${expr} FROM ${table} ${order} LIMIT 3`);
      return r.length ? r[0].values : [];
    } catch (e) { return []; }
  }, [db, blocks, dataVersion]);

  /* ---------- Abfrage ausführen, Stufe für Stufe animiert ---------- */
  const runQuery = async () => {
    const sql = buildQuerySQL(blocks);
    if (!sql || running || loadingRef.current) return;
    setRunning(true); setError(null); setNotice(null); setResult(null);
    setStageCounts({}); setChStatus(null);

    const countSQLs = buildStageCountSQLs(blocks);
    const stages = PIPELINE_ORDER.filter(k => k === 'from' || blocks.active[k]);
    const dwell = 620 / speed;

    try {
      let lastCount = null;
      for (const st of stages) {
        setRunStage(st);
        let c = null;
        if (countSQLs[st] != null) c = execScalar(db, countSQLs[st]);
        else if (st === 'limit' && blocks.limit && lastCount != null) c = Math.min(blocks.limit, lastCount);
        else if (st === 'order') c = lastCount;
        if (c != null) { setStageCounts(s => ({ ...s, [st]: c })); lastCount = c; }
        await sleep(dwell);
      }
      const res = execResult(db, sql);
      if (blocks.active.select || blocks.active.group) {
        setStageCounts(s => ({ ...s, select: res.rows.length }));
      }
      setResult(res);
      setRunId(i => i + 1);
      checkChallenge(res);
    } catch (e) {
      setError(friendlyError(e));
    }
    setRunStage(null);
    setRunning(false);
  };

  // Aufgabe prüfen (Bausteine UND selbst geschriebenes SQL zählen!)
  const checkChallenge = (res) => {
    if (!chSetKey || !chVisible) return;
    const list = CHALLENGE_SETS[chSetKey];
    const ch = list && list[chIdx];
    if (!ch || chSolved.has(ch.id)) return;
    // Hauptlösung oder eine der akzeptierten Alternativen?
    const variants = [ch.sql, ...(ch.alt || [])];
    const ok = variants.some(sql => {
      try { return resultsMatch(res, execResult(db, sql), ch.ordered); }
      catch (e) { return false; }
    });
    if (ok) {
      setChSolved(prev => new Set([...prev, ch.id]));
      setChStatus('ok');
      if (t.konfetti) confetti();
    } else {
      setChStatus('fail');
    }
  };

  /* ---------- Abfragen speichern / laden / aus SQL übernehmen ---------- */
  const exportCurrentQuery = () => {
    const b = sqlMode ? null : blocks;
    if (!b || !b.table) { setNotice(null); setError('Baue zuerst eine Abfrage (mindestens eine Tabelle wählen).'); return; }
    downloadQuery(b, dbName);
    setError(null);
    setNotice('✓ Abfrage als Datei gespeichert — du kannst sie später wieder laden.');
  };

  const importQueryFile = async (file) => {
    try {
      const text = await file.text();
      const res = parseQueryFile(text);
      if (res.error) { setError(res.error); return; }
      const importedBlocks = requalifyColumns(res.blocks, schema);
      setBlocks(importedBlocks);
      setSqlMode(false); setTab('build');
      setResult(null); setStageCounts({}); setError(null);
      const missing = queryTables(importedBlocks).filter(t => !schema.tables.some(x => x.name === t));
      if (missing.length) {
        setNotice('Abfrage geladen — aber die Tabelle „' + missing[0] + '“ gibt es in dieser Datenbank nicht. Passt sie zur geladenen DB?');
      } else {
        setNotice('✓ Abfrage geladen.' + (res.datenbank && res.datenbank !== dbName ? ' (ursprünglich für „' + res.datenbank + '“)' : ''));
      }
    } catch (e) {
      setError('Datei konnte nicht gelesen werden: ' + e.message);
    }
  };

  const convertSqlToBlocks = () => {
    const res = parseSQLToBlocks(customSQL, schema);
    if (res.error) { setNotice(null); setError(res.error); return; }
    setBlocks(res.blocks);
    setSqlMode(false);
    setResult(null); setStageCounts({}); setError(null);
    setNotice('✓ In Bausteine umgewandelt!' + (res.notes && res.notes.length ? ' (' + res.notes.join(', ') + ')' : ' Prüfe die Bausteine und führe sie aus.'));
  };

  /* ---------- Selbst geschriebenes SQL ausführen ---------- */
  const runCustom = () => {
    if (!customSQL.trim() || running || loadingRef.current) return;
    setRunning(true); setError(null); setNotice(null); setResult(null);
    setStageCounts({}); setChStatus(null);
    try {
      // ATTACH 'wa.db' AS wa: im Browser ist die Datei schon über „+ Datenbanken öffnen“ verbunden
      const { attaches, rest } = splitAttach(customSQL);
      const attachError = attaches.length ? attachProblem(attaches, databaseRef.current) : null;
      if (attachError || (attaches.length && !rest.length)) {
        setError(attachError || 'Hier steht nur ATTACH — es fehlt die Abfrage.');
        setRunning(false);
        return;
      }
      const sql = attaches.length ? rest.join(';\n') : customSQL;
      const isQuery = /^\s*(select|with|pragma|explain)/i.test(sql);
      if (isQuery) {
        const r = db.exec(sql);
        const last = r.length
          ? { columns: r[r.length - 1].columns, rows: r[r.length - 1].values }
          : { columns: [], rows: [] };
        setResult(last);
        setRunId(i => i + 1);
        checkChallenge(last);
        if (attaches.length) setNotice('ATTACH übersprungen — ' + attaches.map(a => a.name).join(', ') + ' ist bereits geöffnet.');
      } else {
        db.run(sql);
        const n = db.getRowsModified();
        distinctCache.current = {};
        setDataVersion(v => v + 1);
        if (isSchemaChange(sql)) {
          const msg = schemaChangeText(refreshWorkspace());
          if (msg.error) setError(msg.error); else setNotice(msg.text);
        } else {
          refreshCounts(db, schema);
          setNotice('✓ Ausgeführt — ' + n + ' Zeile' + (n === 1 ? '' : 'n') + ' betroffen.');
        }
      }
    } catch (e) {
      setError(friendlyError(e));
    }
    setRunning(false);
  };

  /* ---------- Daten ändern ---------- */
  const executeModify = (sql, table) => {
    if (running || loadingRef.current) return { error: 'Bitte warte, bis der aktuelle Vorgang beendet ist.' };
    try {
      db.run(sql);
      const n = db.getRowsModified();
      distinctCache.current = {};
      setDataVersion(v => v + 1);
      if (isSchemaChange(sql)) {
        const change = refreshWorkspace();
        const shown = change.added[0] || schemaRef.current.tables.find(tb => tb.name === table);
        if (shown) { setFlashTable(shown.name); setTimeout(() => setFlashTable(null), 1200); }
        return schemaChangeText(change, table);
      }
      refreshCounts(db, schema);
      setFlashTable(table);
      setTimeout(() => setFlashTable(null), 1200);
      return { text: '✓ ' + n + ' Zeile' + (n === 1 ? '' : 'n') + ' betroffen — der Zähler an der Tabelle hat sich aktualisiert!' };
    } catch (e) {
      return { error: friendlyError(e) };
    }
  };

  /* ---------- Beziehungen ---------- */
  const addRelation = (from, to) => {
    const dup = relations.find(r =>
      (r.from.table === from.table && r.from.col === from.col && r.to.table === to.table && r.to.col === to.col) ||
      (r.from.table === to.table && r.from.col === to.col && r.to.table === from.table && r.to.col === from.col));
    const rel = dup || { id: 'rel_' + Date.now(), from, to };
    // Die aufgezogene Linie wird direkt zum JOIN – lässt sie sich nicht an die Abfrage hängen,
    // bleibt sie auch nicht stehen (Linien und Verbindungen bleiben deckungsgleich).
    const res = joinForRelation(blocks, rel, from.table);
    if (res.ok && !dup) setRelations(rs => [...rs, rel]);
    if (res.blocks !== blocks) { setBlocks(res.blocks); setSqlMode(false); setTab('build'); }
    if (res.message) { setError(null); setNotice(res.message); }
    return res.ok && !dup ? rel.id : null;
  };
  // Rechts ↔ links: jede Verbindung im Bau-Bereich hat ihre Linie, selbst gezogene Linien nur mit Verbindung
  React.useEffect(() => {
    const res = syncJoinLines(blocks, relations, n => 'rel_' + Date.now() + '_' + n);
    if (res.relations) setRelations(res.relations);
    if (res.joins) setBlocksRaw(b => (b === blocks ? { ...b, joins: res.joins } : b));
  }, [blocks, relations]);
  // Gepunkteten Vorschlag (Fremdschlüssel) anklicken → wird zur Verbindung, wie eine selbst gezogene Linie
  const pickForeignKey = (fk) => addRelation(fk.from, fk.to);
  const dismissForeignKey = (id) => setDismissedFks(d => new Set([...d, id]));
  const removeRelation = (id) => {
    setRelations(rs => rs.filter(r => r.id !== id));
    setBlocks(b => ({ ...b, joins: b.joins.filter(j => j.relId !== id) }));
  };
  const moveTable = (name, x, y) => {
    setSchema(s => ({ ...s, tables: s.tables.map(tb => tb.name === name ? { ...tb, x, y } : tb) }));
  };
  const resizeTable = (name, size) => {
    setSchema(s => ({ ...s, tables: s.tables.map(tb => tb.name === name ? { ...tb, ...size } : tb) }));
  };

  const activeTables = queryTables(blocks);
  const runningJoinIds = runStage === 'join' ? blocks.joins.map(j => j.relId).filter(Boolean) : null;
  const canRun = !!buildQuerySQL(blocks);
  // Was „Als Ansicht speichern“ übernimmt: das SELECT aus dem Editor bzw. aus den Bausteinen
  const viewSource = sqlMode ? viewSelect(customSQL) : buildQuerySQL(blocks);

  // Sichtbare Teilmenge für Canvas + Baustein-Dropdowns; Tabellen der aktuellen Abfrage
  // bleiben in den Bausteinen erhalten, auch wenn ihre Karte ausgeblendet ist.
  const visTables = schema.tables.filter(tb => !hidden.has(tb.name));
  const visSchema = { tables: visTables };
  const visRelations = relations.filter(r => !hidden.has(r.from.table) && !hidden.has(r.to.table));
  const visForeignKeys = foreignKeys.filter(fk => !dismissedFks.has(fk.id) && !hidden.has(fk.from.table) && !hidden.has(fk.to.table) &&
    !relations.some(r => sameLink(r, fk)));
  const usable = name => !hidden.has(name) || activeTables.includes(name);
  const blockSchema = { tables: schema.tables.filter(tb => usable(tb.name)) };
  // Schritt 2 bietet auch die Fremdschlüssel als Beziehung an
  const blockRelations = [...relations, ...foreignKeys.filter(fk => !dismissedFks.has(fk.id) && !relations.some(r => sameLink(r, fk)))]
    .filter(r => usable(r.from.table) && usable(r.to.table));
  const relayout = (positions) => {
    setSchema(s => ({ ...s, tables: s.tables.map(tb => positions[tb.name] ? { ...tb, ...positions[tb.name] } : tb) }));
  };
  // Ausblenden lässt die übrigen Karten stehen; zurückgeholte Tabellen kommen an ihren
  // alten Platz oder, falls der inzwischen belegt ist, an die nächste freie Stelle.
  const setManyHidden = (names, hide) => {
    const back = hide ? [] : schema.tables.filter(tb => hidden.has(tb.name) && names.includes(tb.name));
    if (back.length) relayout(placeTables(back, visTables));
    names.forEach(n => { hiddenChoice.current[n] = hide; });
    try { localStorage.setItem('sqlsp_hidden', JSON.stringify(hiddenChoice.current)); } catch (e) {}
    setHidden(h => {
      const nh = new Set(h);
      names.forEach(n => hide ? nh.add(n) : nh.delete(n));
      return nh;
    });
  };
  const toggleHidden = (name) => setManyHidden([name], !hidden.has(name));

  if (loadErr && !db) {
    return <div className="boot"><div className="boot-card">⚠ {loadErr}</div></div>;
  }
  if (!db) {
    return (
      <div className="boot">
        <div className="boot-card">
          <div className="boot-logo">SQL<span>Spielplatz</span></div>
          <div className="boot-spin"></div>
          <div>SQL-Engine wird geladen…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar" data-screen-label="Kopfzeile">
        <div className="logo">SQL<span>Spielplatz</span></div>
        <div className="db-info">
          <span className="db-dot"></span>
          <span className="db-name">{databases.length} Datenbank{databases.length === 1 ? '' : 'en'} geöffnet</span>
          <span className="db-meta">{visTables.length}{hidden.size ? '/' + schema.tables.length : ''} Tabellen</span>
        </div>
        <div className="top-actions">
          <button className="topbtn topbtn-theme" onClick={() => setTheme(theme === 'dunkel' ? 'hell' : 'dunkel')}
                  title={theme === 'dunkel' ? 'Zum hellen Design wechseln' : 'Zum dunklen Design wechseln'}>
            {theme === 'dunkel' ? '☀' : '☾'}
          </button>
          <button className="topbtn" disabled={running || loadingFiles} onClick={loadSample} title="Die Messenger-Beispieldatenbank hinzufügen">
            Beispiel: Plauder
          </button>
          <button className="topbtn" disabled={running || loadingFiles} onClick={loadOrg} title="Große Beispiel-Firma: 8 Tabellen, ~50.000 Datensätze — mit eigenem Tutorial">
            Beispiel: Organisation
          </button>
          <button className="topbtn topbtn-primary" disabled={running || loadingFiles} onClick={() => fileRef.current.click()}
                  title="Eigene Datei öffnen: SQLite (.db/.sqlite) oder Excel (.xlsx/.csv) — alles bleibt im Browser">
            {loadingFiles ? 'Wird geöffnet…' : '+ Datenbanken öffnen'}
          </button>
          <input ref={fileRef} type="file" multiple accept=".sqlite,.sqlite3,.db,.db3,.xlsx,.xls,.csv,.ods" style={{ display: 'none' }}
                 onChange={(e) => { const files = Array.from(e.target.files); if (files.length) openFiles(files); e.target.value = ''; }} />
        </div>
        <div className="tabs">
          <button className={'tab' + (tab === 'build' ? ' tab-on' : '')} onClick={() => setTab('build')}>Abfragen</button>
          <button className={'tab' + (tab === 'modify' ? ' tab-on' : '')} onClick={() => setTab('modify')}>Daten ändern</button>
        </div>
      </header>

      <div className="database-bar" style={{ padding: '8px 18px', borderBottom: '2px solid var(--line)', background: 'var(--card)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', maxHeight: 120, overflowY: 'auto', flexShrink: 0 }}>
        {databases.map(d => <span key={d.alias} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 8, padding: '3px 8px', fontSize: 12 }}>
          <span title={d.name}><b>{d.alias}</b> · {d.name}</span>
          <button className="bmini" disabled={running || loadingFiles} onClick={() => closeDatabase(d.alias)}
            aria-label={d.name + ' (' + d.alias + ') schließen'} title="Datenbank aus dem Arbeitsbereich schließen">×</button>
        </span>)}
        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{databases.length ? 'Spaltenpunkte verbinden → JOIN hinzufügen. SQL: datenbank.tabelle' : 'Öffne Dateien oder füge eine Beispiel-Datenbank hinzu.'}</span>
      </div>
      {loadErr && <div className="toast-err" role="alert">{loadErr}<button onClick={() => setLoadErr(null)} aria-label="Meldung schließen">×</button></div>}

      <main className="main">
        <section className="left">
          <SchemaCanvas
            schema={visSchema} relations={visRelations} counts={counts}
            activeTables={activeTables}
            lineStyle={t.linien === 'Gerade' ? 'ortho' : 'curve'}
            onMoveTable={moveTable} onAddRelation={addRelation}
            onRemoveRelation={removeRelation}
            suggestions={visForeignKeys} onPickSuggestion={pickForeignKey} onDismissSuggestion={dismissForeignKey}
            queryRelIds={(blocks.active.join ? blocks.joins : []).map(j => j.relId).filter(Boolean)}
            onPickTable={(name) => { setBlocks({ ...emptyBlocks(), table: name }); setTab('build'); }}
            onPreview={openPreview} onResizeTable={resizeTable} onRelayout={relayout}
            onSetHidden={setManyHidden} layoutKey={schema.tables.filter(tb => !tb.workspace).map(tb => tb.name).join('\0')}
            flashTable={flashTable} runningJoin={runningJoinIds}
            tableControls={arrange => <TablesPanel tables={schema.tables} counts={counts} hidden={hidden}
              onToggle={toggleHidden} onSetMany={setManyHidden} onShowAll={() => setManyHidden([...hidden], false)} onRelayout={arrange} />}
          >
          {previews.map(p => (
            <TablePreviewWindow key={p.table} p={p} onClose={closePreview}
                                onMove={movePreview} onFocus={focusPreview} />
          ))}
          <div className="canvas-legend">
            Freie Fläche ziehen: Ansicht verschieben · Strg+Mausrad: Zoom
          </div>
          {chSetKey && (
            <ChallengeCard challenges={CHALLENGE_SETS[chSetKey]}
                           idx={chIdx} setIdx={(i) => { setChIdx(i); setChStatus(null); }}
                           solved={chSolved} status={chStatus}
                           visible={chVisible} setVisible={setChVisible}
                           showHint={chHint} setShowHint={setChHint} />
          )}
          </SchemaCanvas>
        </section>

        <div className="resizer" title="Ziehen, um den Bau-Bereich breiter zu machen"
             onPointerDown={startResize} onDoubleClick={() => { setRightW(null); localStorage.removeItem('sqlsp_rightW'); }}>
          <span className="resizer-grip"></span>
        </div>

        <aside className="right" data-screen-label="Bau-Bereich" style={rightW ? { width: rightW } : null}>
          {tab === 'build' ? (
            <React.Fragment>
              <div className="qtools">
                <button className="qtool" onClick={exportCurrentQuery}
                        title="Die aktuelle Abfrage (alle Bausteine) als Datei speichern">⤓ Abfrage speichern</button>
                <button className="qtool" onClick={() => queryFileRef.current.click()}
                        title="Eine gespeicherte Abfrage-Datei laden">⤒ Abfrage laden</button>
                <button className="qtool qtool-view" disabled={!viewSource}
                        onClick={() => { setViewDraft({ select: viewSource, stamp: Date.now() }); setTab('modify'); }}
                        title={viewSource ? 'Diese Abfrage unter einem Namen als Ansicht (VIEW) speichern – sie erscheint als blaue Karte und lässt sich wie eine Tabelle verwenden'
                                          : 'Baue zuerst eine Abfrage – sie lässt sich dann als Ansicht (VIEW) speichern'}>⊞ Als Ansicht speichern</button>
                <input ref={queryFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
                       onChange={(e) => { if (e.target.files[0]) importQueryFile(e.target.files[0]); e.target.value = ''; }} />
              </div>
              <div className="modeswitch">
                <button className={'modeswitch-btn' + (!sqlMode ? ' modeswitch-on' : '')}
                        onClick={() => setSqlMode(false)}>Bausteine</button>
                <button className={'modeswitch-btn' + (sqlMode ? ' modeswitch-on' : '')}
                        onClick={() => setSqlMode(true)}>SQL schreiben</button>
              </div>
              {sqlMode ? (
                <SqlEditor value={customSQL} onChange={setCustomSQL} onRun={runCustom}
                           hasBlocks={canRun} onToBlocks={convertSqlToBlocks}
                           onFromBlocks={() => setCustomSQL(buildQuerySQL(blocks) || '')} />
              ) : (
                <React.Fragment>
                  <QueryBuilder blocks={blocks} setBlocks={setBlocks} schema={blockSchema} relations={blockRelations} counts={counts} runPreview={runPreview}
                                runStage={runStage} stageCounts={stageCounts} getDistinct={getDistinct} fnPreview={fnPreview} />
                  <SqlPreview blocks={blocks} />
                </React.Fragment>
              )}
              <button className={'runbtn' + (running ? ' runbtn-busy' : '')}
                      disabled={running || loadingFiles || (sqlMode ? !customSQL.trim() : !canRun)}
                      onClick={sqlMode ? runCustom : runQuery}>
                {running ? 'Läuft…' : '▶ Ausführen'}
              </button>
              <ResultsPanel result={result} error={error} running={running} notice={notice} runId={runId} />
            </React.Fragment>
          ) : (
            <ModifyPanel schema={schema} hidden={hidden} onExecute={executeModify} getDistinct={getDistinct}
                         viewDraft={viewDraft} querySQL={buildQuerySQL(blocks)} editorSQL={customSQL} />
          )}
        </aside>
      </main>

      <TweaksPanel>
        <TweakSection label="Animation" />
        <TweakSlider label="Tempo" value={t.tempo} min={0.25} max={3} step={0.25}
                     onChange={(v) => setTweak('tempo', v)} />
        <TweakToggle label="Konfetti" value={t.konfetti} onChange={(v) => setTweak('konfetti', v)} />
        <TweakSection label="Beziehungen" />
        <TweakRadio label="Linien" value={t.linien} options={['Kurven', 'Gerade']}
                    onChange={(v) => setTweak('linien', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
