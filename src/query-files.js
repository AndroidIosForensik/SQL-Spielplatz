// Abfragen exportieren/importieren + handgeschriebenes SQL in Bausteine umwandeln

/* ---------- kleine Parser-Helfer ---------- */

// Teilt einen String an einem Trennzeichen, aber nur auf oberster Ebene
// (nicht innerhalb von Klammern oder '...'-Strings)
function splitTopLevel(str, sep) {
  const out = [];
  let depth = 0, inStr = false, cur = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      cur += c;
      if (c === "'") { if (str[i + 1] === "'") { cur += str[++i]; } else { inStr = false; } }
      continue;
    }
    if (c === "'") { inStr = true; cur += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (depth === 0 && str.substr(i, sep.length).toUpperCase() === sep.toUpperCase() &&
        (sep.length === 1 || (/\W/.test(str[i - 1] || ' ') && /\W/.test(str[i + sep.length] || ' ')))) {
      out.push(cur); cur = ''; i += sep.length - 1; continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

// Normalisiert Whitespace außerhalb von String-Literalen (Leerzeichen um ( ) , weg)
function normExpr(s) {
  const lits = [];
  let x = String(s).replace(/'(?:[^']|'')*'/g, m => { lits.push(m); return '\u0001' + (lits.length - 1) + '\u0001'; });
  x = x.replace(/\s+/g, ' ').replace(/\s*([(),])\s*/g, '$1').trim();
  x = x.replace(/\u0001(\d+)\u0001/g, (m, i) => lits[Number(i)]);
  return x;
}

// Ist der Ausdruck ein Funktionsaufruf NAME(...)? → {name, args:[]}
function parseCall(expr) {
  const m = /^([A-Za-z_][\w]*)\s*\(([\s\S]*)\)$/.exec(expr.trim());
  if (!m) return null;
  // sicherstellen, dass die schließende Klammer wirklich die letzte ist (Balance)
  let depth = 0, inStr = false;
  const body = expr.trim();
  const open = body.indexOf('(');
  for (let i = open; i < body.length; i++) {
    const c = body[i];
    if (inStr) { if (c === "'") { if (body[i + 1] === "'") i++; else inStr = false; } continue; }
    if (c === "'") inStr = true;
    else if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0 && i !== body.length - 1) return null; }
  }
  return { name: m[1].toUpperCase(), args: splitTopLevel(m[2], ',').map(s => s.trim()) };
}

// „(a + b)“ → „a + b“: die Bausteine setzen um freie Formeln ohnehin Klammern
function unwrapParens(s) {
  s = s.trim();
  while (s[0] === '(' && s[s.length - 1] === ')') {
    let depth = 0, inStr = false, closesAtEnd = true;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inStr) { if (c === "'") { if (s[i + 1] === "'") i++; else inStr = false; } continue; }
      if (c === "'") inStr = true;
      else if (c === '(') depth++;
      else if (c === ')' && --depth === 0 && i !== s.length - 1) { closesAtEnd = false; break; }
    }
    if (!closesAtEnd) break;
    s = s.slice(1, -1).trim();
  }
  return s;
}

function stripQuotes(s) {
  s = s.trim();
  if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'") {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

// Regex aus einer Funktions-Vorlage: das erste {c} fängt die Spalte, jedes weitere muss dieselbe sein.
// Leerzeichen sind optional – normExpr entfernt sie neben Klammern, und die Spalte kann auf „)“ enden.
function tplRegex(key) {
  let first = true;
  const body = normExpr(FN_DEFS[key].tpl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*')
    .replace(/\\\{c\\\}/g, () => (first ? (first = false, '([\\s\\S]+?)') : '\\1'));
  return new RegExp('^' + body + '$', 'i');
}

/* ---------- SQL-Ausdruck → Funktions-Kette ---------- */
// canon(expr) → kanonischer Spaltenname (wie availableColumns) oder null
// Gibt {base, fns:[{fn,arg}...]} zurück (innerste Funktion zuerst), oder null
function decomposeExpr(expr, canon) {
  let e = normExpr(expr);

  // Spezialformen (per Regex auf normalisiertem Text)
  const special = [
    // Apple-Zeit vor den Unix-Formen prüfen, sonst hielte UNIX→UTC „x + 978307200“ für die Spalte.
    // Zuerst die heutige Form mit Einheiten-Erkennung, dann die ältere „x + 978307200“.
    { re: tplRegex('appledate'), fn: 'appledate' },
    { re: tplRegex('appleutc'), fn: 'appleutc' },
    { re: /^datetime\(([\s\S]+?)\s*\+\s*978307200,'unixepoch','localtime'\)$/i, fn: 'appledate' },
    { re: /^datetime\(([\s\S]+?)\s*\+\s*978307200,'unixepoch'\)$/i, fn: 'appleutc' },
    { re: /^datetime\(substr\(([\s\S]+),1,10\),'unixepoch','localtime'\)$/i, fn: 'unixdate' },
    { re: /^datetime\(([\s\S]+?)\s*\/\s*1000,'unixepoch','localtime'\)$/i, fn: 'msdate' },
    { re: /^datetime\(([\s\S]+?)\s*\/\s*1000,'unixepoch'\)$/i, fn: 'msdateutc' },
    { re: /^datetime\(([\s\S]+),'unixepoch'\)$/i, fn: 'unixutc' },
    { re: /^CAST\(julianday\('now'\)-julianday\(([\s\S]+)\) AS INTEGER\)$/i, fn: 'daysago' },
    { re: /^CAST\(([\s\S]+) AS INTEGER\)$/i, fn: 'castint' },
    { re: /^strftime\('%Y',([\s\S]+)\)$/i, fn: 'year' },
    { re: /^strftime\('%m',([\s\S]+)\)$/i, fn: 'month' },
    { re: /^strftime\('%H',([\s\S]+)\)$/i, fn: 'hour' },
    { re: /^strftime\('%H:%M:%S',([\s\S]+)\)$/i, fn: 'uhrzeit' },
    { re: /^strftime\('%d\.%m\.%Y',([\s\S]+)\)$/i, fn: 'datede' }
  ];
  for (const sp of special) {
    const m = sp.re.exec(e);
    if (m) {
      const inner = decomposeExpr(m[1], canon);
      if (inner) return { base: inner.base, fns: [...inner.fns, { fn: sp.fn, arg: '' }] };
      return null;
    }
  }

  const call = parseCall(e);
  if (call) {
    const oneArg = { UPPER: 'upper', LOWER: 'lower', TRIM: 'trim', LENGTH: 'length', ABS: 'abs', TYPEOF: 'typeof', DATE: 'dateonly' };
    if (oneArg[call.name] && call.args.length === 1) {
      const inner = decomposeExpr(call.args[0], canon);
      if (inner) return { base: inner.base, fns: [...inner.fns, { fn: oneArg[call.name], arg: '' }] };
      return null;
    }
    if (call.name === 'ROUND' && call.args.length === 2) {
      const inner = decomposeExpr(call.args[0], canon);
      if (inner) return { base: inner.base, fns: [...inner.fns, { fn: 'round', arg: call.args[1] }] };
      return null;
    }
    if (call.name === 'SUBSTR' && call.args.length === 3 && call.args[1] === '1') {
      const inner = decomposeExpr(call.args[0], canon);
      if (inner) return { base: inner.base, fns: [...inner.fns, { fn: 'substr', arg: call.args[2] }] };
      return null;
    }
    // nur mit festem Ersatzwert – COALESCE(a.x, b.y) mit zwei Spalten wird zu „Erster Wert“
    if ((call.name === 'COALESCE' || call.name === 'IFNULL') && call.args.length === 2 &&
        /^('(?:[^']|'')*'|-?\d+(\.\d+)?)$/.test(call.args[1].trim())) {
      const inner = decomposeExpr(call.args[0], canon);
      if (inner) return { base: inner.base, fns: [...inner.fns, { fn: call.name.toLowerCase(), arg: stripQuotes(call.args[1]) }] };
      return null;
    }
  }

  // Keine (weitere) Funktion → das hier ist die Basis-Spalte
  const cc = canon(e);
  if (cc) return { base: cc, fns: [] };
  return null;
}

/* ---------- handgeschriebenes SQL → Bausteine ---------- */

// Zerlegt ein Skript in Anweisungen und trennt ATTACH ab: Im Browser werden Datenbanken über
// „+ Datenbanken öffnen“ verbunden – ATTACH 'wa.db' AS wa entspricht der geöffneten Datei wa.db.
function splitAttach(sqlRaw) {
  const sql = String(sqlRaw || '').replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const attaches = [], rest = [];
  splitTopLevel(sql, ';').map(x => x.trim()).filter(Boolean).forEach(stmt => {
    const m = /^ATTACH\s+(?:DATABASE\s+)?([\s\S]+?)\s+AS\s+["`\[]?(\w+)["`\]]?$/i.exec(stmt);
    if (m) attaches.push({ file: stripQuotes(m[1]), name: m[2] });
    else rest.push(stmt);
  });
  return { attaches, rest };
}

// Fehlt eine per ATTACH genannte Datenbank im Arbeitsbereich? → verständliche Meldung, sonst null
function attachProblem(attaches, databases) {
  for (const a of attaches) {
    if (databases.some(d => d.alias.toLowerCase() === a.name.toLowerCase())) continue;
    const file = a.file.split(/[\\/]/).pop();
    const same = databases.find(d => String(d.name || '').toLowerCase() === file.toLowerCase());
    return same
      ? '„' + file + '“ ist unter dem Namen ' + same.alias + ' geöffnet — schreibe in der Abfrage ' + same.alias + '. statt ' + a.name + '.'
      : 'Die Datenbank „' + a.name + '“ ist nicht geöffnet. Öffne „' + file + '“ über „+ Datenbanken öffnen“ — sie heißt dann ' + a.name + ', wenn der Dateiname passt.';
  }
  return null;
}

function parseSQLToBlocksCore(sqlRaw, schema) {
  const { attaches, rest } = splitAttach(sqlRaw);
  if (!rest.length) return { error: attaches.length ? 'Hier steht nur ATTACH — es fehlt die SELECT-Abfrage.' : 'Bitte zuerst SQL eingeben.' };
  if (rest.length > 1) return { error: 'Bitte nur eine SELECT-Abfrage umwandeln (ATTACH davor ist erlaubt).' };
  let sql = rest[0];
  const missingDb = attaches.find(a => !schema.tables.some(t => String(t.database || '').toLowerCase() === a.name.toLowerCase()));
  if (missingDb) return { error: 'Die Datenbank „' + missingDb.name + '“ ist nicht geöffnet. Öffne „' +
    missingDb.file.split(/[\\/]/).pop() + '“ über „+ Datenbanken öffnen“ und wandle dann erneut um.' };
  if (!/^select\b/i.test(sql)) return { error: 'Nur SELECT-Abfragen lassen sich in Bausteine umwandeln. INSERT/UPDATE/DELETE bitte im Reiter „Daten ändern“.' };
  if (/\bUNION\b|\bWITH\b/i.test(sql)) return { error: 'UNION/CTE sind zu komplex für Bausteine — nutze dafür den SQL-Editor.' };

  // Klauseln finden (Schlüsselwörter auf oberster Ebene)
  const markers = [];
  const kws = ['ORDER BY', 'GROUP BY', 'LEFT OUTER JOIN', 'LEFT JOIN', 'RIGHT OUTER JOIN', 'RIGHT JOIN',
               'FULL OUTER JOIN', 'FULL JOIN', 'INNER JOIN', 'CROSS JOIN', 'JOIN',
               'SELECT', 'FROM', 'WHERE', 'HAVING', 'LIMIT'];
  let depth = 0, inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (inStr) { if (c === "'") { if (sql[i + 1] === "'") i++; else inStr = false; } continue; }
    if (c === "'") { inStr = true; continue; }
    if (c === '(') { depth++; continue; }
    if (c === ')') { depth--; continue; }
    if (depth !== 0) continue;
    for (const kw of kws) {
      // Nur ganze Wörter: „m.from_me“ oder „selected“ sind keine Klauseln
      if (sql.substr(i, kw.length).toUpperCase() === kw &&
          !/[\w.]/.test(sql[i - 1] || '') && !/[\w.]/.test(sql[i + kw.length] || '')) {
        markers.push({ kw, start: i, end: i + kw.length });
        i += kw.length - 1;
        break;
      }
    }
  }
  const clause = (name) => {
    for (let k = 0; k < markers.length; k++) {
      if (markers[k].kw === name || (name === 'JOIN' && /JOIN$/.test(markers[k].kw))) {
        const next = markers[k + 1] ? markers[k + 1].start : sql.length;
        return sql.slice(markers[k].end, next).trim();
      }
    }
    return null;
  };
  const allClauses = (pred) => markers.map((m, k) => ({
    kw: m.kw, body: sql.slice(m.end, markers[k + 1] ? markers[k + 1].start : sql.length).trim()
  })).filter(pred);

  const selBody = clause('SELECT');
  const fromBody = clause('FROM');
  if (!fromBody) return { error: 'Keine FROM-Tabelle gefunden.' };
  if (/^\(|\bselect\b/i.test(fromBody)) return { error: 'Unterabfragen im FROM sind zu komplex für Bausteine — nutze den SQL-Editor.' };

  const normalizedName = n => splitIdent(n).map(p => unquoteIdent(p).toLowerCase()).join('.');
  const schemaTable = (n) => {
    const exact = schema.tables.find(t => normalizedName(t.name) === normalizedName(n));
    if (exact) return exact;
    const matches = schema.tables.filter(t => normalizedName(splitIdent(t.name).slice(-1).join('')) === normalizedName(n));
    return matches.length === 1 ? matches[0] : null;
  };
  const tableHasCol = (t, c) => { const st = schemaTable(t); return st && st.columns.some(col => col.name.toLowerCase() === String(c).toLowerCase()); };
  const realName = (n) => { const st = schemaTable(n); return st ? st.name : n; };

  // Tabellen-Vorkommen in FROM und JOIN, jeweils mit Alias (FROM message m, JOIN jid cj …)
  const splitSource = (text) => {
    const toks = text.trim().split(/\s+/);
    const alias = toks.length >= 3 && /^as$/i.test(toks[1]) ? toks[2]
      : (toks.length === 2 && !/^as$/i.test(toks[1]) ? toks[1] : null);
    return { raw: toks[0], alias };
  };
  const fromParts = splitTopLevel(fromBody, ',').map(splitSource);
  const joinClauses = allClauses(x => /JOIN$/.test(x.kw)).map(j => {
    const onIdx = j.body.search(/\bON\b/i);
    return { kw: j.kw, source: splitSource(onIdx < 0 ? j.body : j.body.slice(0, onIdx)),
             on: onIdx < 0 ? null : j.body.slice(onIdx + 2).trim() };
  });
  if (!schemaTable(fromParts[0].raw)) return { error: 'Die Tabelle „' + fromParts[0].raw + '“ gibt es in dieser Datenbank nicht.' };

  // Jedes Vorkommen bekommt einen Namen (ref), unter dem seine Spalten in den Bausteinen stehen:
  // den Tabellennamen – oder, wenn die Tabelle mehrfach vorkommt, den Alias (jid als cj und sj).
  const occurrences = [...fromParts, ...joinClauses.map(j => j.source)].filter(o => schemaTable(o.raw));
  const count = {};
  occurrences.forEach(o => { o.table = realName(o.raw); count[o.table] = (count[o.table] || 0) + 1; });
  const aliasMap = {}, refTable = {};
  occurrences.forEach(o => {
    // Eigene Aliase (FROM message AS nachricht) werden zu Rollen-Namen; doppelte Tabellen brauchen einen
    let ref = o.table;
    const given = o.alias && unquoteIdent(o.alias);
    const usable = given && /^[A-Za-z_]\w*$/.test(given) && !ALIAS_RESERVED.test(given);
    if (usable || count[o.table] > 1) {
      let base = usable ? given : unquoteIdent(splitIdent(o.table).pop()).replace(/\W+/g, '_');
      if (!/^[A-Za-z_]/.test(base) || ALIAS_RESERVED.test(base)) base = 't_' + base;
      ref = base;
      for (let n = 2; refTable[ref]; n++) ref = base + '_' + n;
    }
    o.ref = ref; refTable[ref] = o.table;
    if (o.alias) aliasMap[unquoteIdent(o.alias).toLowerCase()] = ref;
  });
  occurrences.forEach(o => {
    // auch der Tabellenname selbst (mit/ohne Datenbank) zeigt auf das erste Vorkommen
    [normalizedName(o.table), normalizedName(splitIdent(o.table).slice(-1).join('')), normalizedName(o.raw)]
      .forEach(k => { if (!(k in aliasMap)) aliasMap[k] = o.ref; });
  });
  const refOf = (name) => aliasMap[normalizedName(name)] || null;
  const tableOfRef = (ref) => refTable[ref] || realName(ref);
  const fromRef = fromParts[0].ref, fromTable = fromParts[0].table;

  function resolveQualified(raw) {
    raw = raw.trim();
    const parts = splitIdent(raw);
    if (parts.length < 2) return null;
    const c = unquoteIdent(parts.pop()), ref = refOf(parts.join('.'));
    if (!ref || !tableHasCol(tableOfRef(ref), c)) return null;
    const st = schemaTable(tableOfRef(ref));
    return { ref, table: st.name, col: st.columns.find(col => col.name.toLowerCase() === c.toLowerCase()).name };
  }
  const joinFrom = (left, right, type) => ({
    ...(type ? { type } : {}),
    leftTable: left.table, leftCol: left.col, rightTable: right.table, rightCol: right.col,
    ...(left.ref !== left.table ? { leftRef: left.ref } : {}),
    ...(right.ref !== right.table ? { rightAlias: right.ref } : {}),
    label: `${refLabel(left.ref, left.table)} ⟶ ${refLabel(right.ref, right.table)} (${left.col} = ${right.col})`
  });

  const joins = [];
  let skippedJoins = 0;
  const typeFromKw = (kw) => {
    const u = String(kw).toUpperCase();
    if (u.indexOf('LEFT') === 0) return 'LEFT';
    if (u.indexOf('RIGHT') === 0) return 'RIGHT';
    if (u.indexOf('FULL') === 0) return 'FULL';
    if (u.indexOf('CROSS') === 0) return 'CROSS';
    return 'INNER';
  };

  // explizite JOIN ... ON ...
  for (const j of joinClauses) {
    const src = j.source;
    if (!src.ref) { skippedJoins++; continue; }
    if (!j.on) {
      // CROSS JOIN (oder JOIN ohne Bedingung): nur die Tabelle, kein ON
      joins.push({ type: 'CROSS', leftTable: fromTable, rightTable: src.table,
        ...(src.ref !== src.table ? { rightAlias: src.ref } : {}),
        label: refLabel(fromRef, fromTable) + ' ⟶ ' + refLabel(src.ref, src.table) + ' (ohne Bedingung)' });
      continue;
    }
    const eq = splitTopLevel(j.on, '=');
    // Eine Seite darf COALESCE(a.x, b.y, …) sein: a.x wird die Spalte, der Rest Ersatz-Spalten (leftAlt)
    const firstOf = (raw) => {
      const call = parseCall(normExpr(unwrapParens(raw)));
      if (!call || !['COALESCE', 'IFNULL'].includes(call.name) || call.args.length < 2) return null;
      const cols = call.args.map(resolveQualified);
      return cols.every(Boolean) && cols.every(c => c.ref !== src.ref) ? cols : null;
    };
    const alt = eq.length === 2 && (firstOf(eq[0]) || firstOf(eq[1]));
    if (alt) {
      const other = resolveQualified(firstOf(eq[0]) ? eq[1] : eq[0]);
      if (!other || other.ref !== src.ref) { skippedJoins++; continue; }
      const { label, ...base } = joinFrom(alt[0], other, typeFromKw(j.kw));
      joins.push({ ...base, custom: true,
        leftAlt: alt.slice(1).map(c => ({ ref: c.ref, table: c.table, col: c.col })) });
      continue;
    }
    const L = eq.length === 2 && resolveQualified(eq[0]), R = eq.length === 2 && resolveQualified(eq[1]);
    if (!L || !R) { skippedJoins++; continue; }
    // Rechts steht die Tabelle, die dieser JOIN dazuholt; links die, die schon in der Abfrage ist
    const right = R.ref === src.ref ? R : L;
    joins.push(joinFrom(right === R ? L : R, right, typeFromKw(j.kw)));
  }

  // WHERE-Bedingungen aufspalten (mit Konnektoren)
  let whereConds = [];
  const whereBody = clause('WHERE');
  if (whereBody) {
    const parts = [whereBody];
    // an top-level AND/OR splitten, Konnektoren merken
    const segs = []; const seps = [];
    let buf = '', d = 0, st = false;
    for (let i = 0; i < whereBody.length; i++) {
      const c = whereBody[i];
      if (st) { buf += c; if (c === "'") { if (whereBody[i + 1] === "'") buf += whereBody[++i]; else st = false; } continue; }
      if (c === "'") { st = true; buf += c; continue; }
      if (c === '(') d++; if (c === ')') d--;
      const up3 = whereBody.substr(i, 5).toUpperCase();
      if (d === 0 && /\s/.test(whereBody[i - 1] || '') && up3.startsWith(' AND ') === false) { /* noop */ }
      if (d === 0 && (whereBody.substr(i, 5).toUpperCase() === ' AND ' || whereBody.substr(i, 4).toUpperCase() === ' OR ')) {
        const isAnd = whereBody.substr(i, 5).toUpperCase() === ' AND ';
        segs.push(buf); seps.push(isAnd ? 'AND' : 'OR');
        i += isAnd ? 4 : 3; buf = ''; continue;
      }
      buf += c;
    }
    segs.push(buf);
    whereConds = segs.map((s, k) => ({ text: s.trim(), conj: k === 0 ? 'AND' : seps[k - 1] }));
  }

  // Komma-Joins: Gleichheits-Bedingungen, die zwei Tabellen verbinden → Joins
  if (fromParts.length > 1) {
    whereConds = whereConds.filter(cond => {
      const eq = splitTopLevel(cond.text, '=');
      if (eq.length === 2) {
        const L = resolveQualified(eq[0]); const R = resolveQualified(eq[1]);
        if (L && R && L.ref !== R.ref) {
          joins.push(joinFrom(L, R));
          return false;
        }
      }
      return true;
    });
  }

  // Tabellen im Spiel (unter ihrem ref) + Qualifizierungs-Stil
  const tablesPlay = [];
  [fromRef, ...fromParts.slice(1).map(o => o.ref), ...joins.map(joinLeftRef), ...joins.map(joinRightRef)]
    .forEach(r => { if (r && !tablesPlay.includes(r)) tablesPlay.push(r); });
  const multi = tablesPlay.length > 1;

  // Spalte zu kanonischer Form (wie availableColumns sie liefert)
  function canonCol(raw) {
    raw = String(raw).trim();
    let ref, col = unquoteIdent(raw);
    const parts = splitIdent(raw);
    if (parts.length > 1) {
      col = unquoteIdent(parts.pop()); ref = refOf(parts.join('.'));
      if (!ref || !tableHasCol(tableOfRef(ref), col)) return null;
    } else {
      ref = tablesPlay.find(r => tableHasCol(tableOfRef(r), col));
      if (!ref) return null;
    }
    const st = schemaTable(tableOfRef(ref));
    const realCol = st.columns.find(c => c.name.toLowerCase() === col.toLowerCase()).name;
    return multi ? ref + '.' + aliasSQL(realCol) : aliasSQL(realCol);
  }

  // Freie Formeln/Bedingungen (CASE …) behalten ihren Text – Aliase wie m.from_me
  // werden dabei auf die Namen umgeschrieben, die auch die Bausteine verwenden.
  const rewriteRefs = (text) => String(text).replace(/'(?:[^']|'')*'|([A-Za-z_]\w*)\.(?=[A-Za-z_"`\[])/g,
    (m, name, off, all) => {
      if (!name || (off > 0 && /[\w.]/.test(all[off - 1]))) return m;
      const ref = aliasMap[name.toLowerCase()];
      return ref ? ref + '.' : m;
    });

  // Operand für „Wenn–dann“ / „Erster Wert“: fester Wert, Spalte oder COALESCE(…)
  const parseOperand = (raw, allowFirst) => {
    const t = unwrapParens(raw);
    if (/^'(?:[^']|'')*'$/.test(t)) return { val: stripQuotes(t) };
    if (/^-?\d+(\.\d+)?$/.test(t)) return { val: t };
    const cc = canonCol(t);
    if (cc) return { col: cc };
    const call = allowFirst && parseCall(normExpr(t));
    if (call && (call.name === 'COALESCE' || call.name === 'IFNULL') && call.args.length >= 2) {
      const items = call.args.map(a => parseOperand(a, false));
      if (items.every(Boolean)) return { first: items };
    }
    return null;
  };
  // Oberste WHEN/THEN/ELSE-Schlüsselwörter finden (nicht in Klammern oder Strings)
  const caseTokens = (body) => {
    const out = []; let depth = 0, inStr = false, start = 0, kw = null;
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (inStr) { if (c === "'") { if (body[i + 1] === "'") i++; else inStr = false; } continue; }
      if (c === "'") { inStr = true; continue; }
      if (c === '(') { depth++; continue; }
      if (c === ')') { depth--; continue; }
      if (depth || /[\w.]/.test(body[i - 1] || '')) continue;
      const m = /^(WHEN|THEN|ELSE|CASE|END)(?![\w.])/i.exec(body.slice(i));
      if (!m) continue;
      if (/^(CASE|END)$/i.test(m[1])) return null; // verschachteltes CASE → Profi-Formel
      if (kw) out.push({ kw, text: body.slice(start, i).trim() });
      kw = m[1].toUpperCase(); start = i + m[1].length; i = start - 1;
    }
    if (kw) out.push({ kw, text: body.slice(start).trim() });
    return out;
  };
  const parseCase = (expr) => {
    const m = /^CASE\s+([\s\S]+)\s+END$/i.exec(unwrapParens(expr));
    if (!m) return null;
    const toks = caseTokens(m[1]);
    if (!toks || !toks.length || toks[0].kw !== 'WHEN') return null;
    const item = { kind: 'case', cases: [], else: null };
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      if (t.kw === 'WHEN') {
        if (!toks[k + 1] || toks[k + 1].kw !== 'THEN') return null;
        let cond;
        const isNull = /^([\s\S]+?)\s+IS\s+(NOT\s+)?NULL$/i.exec(t.text);
        if (isNull) {
          const dec = decomposeExpr(isNull[1], canonCol);
          if (!dec) return null;
          cond = { col: dec.base, fns: dec.fns, op: isNull[2] ? 'IS NOT NULL' : 'IS NULL', val: '' };
        } else {
          const w = parseCondition(t.text, 'AND', canonCol, decomposeExpr);
          if (w.raw !== undefined) return null;
          cond = { col: w.col, fns: w.fns, op: w.op, val: w.val };
        }
        const then = parseOperand(toks[++k].text, true);
        if (!then) return null;
        item.cases.push({ cond, then });
      } else if (t.kw === 'ELSE' && k === toks.length - 1) {
        if (!/^NULL$/i.test(t.text)) { item.else = parseOperand(t.text, true); if (!item.else) return null; }
      } else return null;
    }
    return item;
  };
  const parseFirst = (expr) => {
    const o = parseOperand(expr, true);
    return o && o.first ? { kind: 'first', items: o.first } : null;
  };

  const blocks = emptyBlocks();
  blocks.table = fromTable;
  if (fromRef !== fromTable) blocks.tableAlias = fromRef;
  if (joins.length) { blocks.active.join = true; blocks.joins = joins; }

  // DISTINCT + SELECT-Spalten
  let sel = (selBody || '*').trim();
  if (/^distinct\b/i.test(sel)) { blocks.distinct = true; sel = sel.replace(/^distinct\b/i, '').trim(); }

  const aggsFound = [];
  const groupCols = [];
  let groupFns = [];
  const selectCols = [];
  let usedStar = false;
  let unsupported = 0;

  // "Mit Leerzeichen", in Backticks oder [in Klammern] geschriebene Namen behalten ihren Text
  const unquoteAlias = (raw) => {
    const t = String(raw).trim();
    const q = t[0], e = t[t.length - 1];
    if (t.length >= 2 && q === e && (q === '"' || q === '\u0060')) {
      return t.slice(1, -1).split(q + q).join(q);
    }
    if (t.length >= 2 && q === '[' && e === ']') return t.slice(1, -1);
    return t.replace(/[^\w]/g, '');
  };

  const splitOffAlias = (item) => {
    // letztes ' AS ' auf oberster Ebene finden (nicht in Klammern/Strings)
    let depth = 0, inStr = false, pos = -1;
    for (let i = 0; i < item.length - 3; i++) {
      const c = item[i];
      if (inStr) { if (c === "'") { if (item[i + 1] === "'") i++; else inStr = false; } continue; }
      if (c === "'") { inStr = true; continue; }
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (depth === 0 && /\s/.test(c) && item.substr(i + 1, 2).toUpperCase() === 'AS' && /\s/.test(item[i + 3] || '')) pos = i;
    }
    if (pos >= 0) return { expr: item.slice(0, pos).trim(), alias: unquoteAlias(item.slice(pos + 4)) };
    return { expr: item.trim(), alias: null };
  };

  if (sel === '*') {
    usedStar = true;
  } else {
    splitTopLevel(sel, ',').forEach(rawItem => {
      const { expr, alias } = splitOffAlias(rawItem.trim());
      const call = parseCall(normExpr(expr));
      if (call && ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(call.name) && call.args.length === 1) {
        const a = call.args[0].trim();
        const acol = a === '*' ? '*' : (canonCol(a) || rewriteRefs(a));
        const agg = { fn: call.name, col: acol };
        if (alias && alias !== aggAlias(call.name, acol)) agg.alias = alias;
        aggsFound.push(agg);
        return;
      }
      const dec = decomposeExpr(expr, canonCol);
      if (dec) {
        const it = { col: dec.base, fns: dec.fns };
        if (alias && alias !== autoSelectAlias(it)) it.alias = alias;
        selectCols.push(it);
        return;
      }
      // 'WhatsApp' AS messenger → fester Wert; NULL AS spalte → leerer fester Wert
      if (/^NULL$/i.test(unwrapParens(expr))) {
        selectCols.push({ kind: 'value', val: '', ...(alias ? { alias } : {}) });
        return;
      }
      const lit = parseOperand(expr, false);
      if (lit && lit.val !== undefined) {
        selectCols.push({ kind: 'value', val: lit.val, ...(alias ? { alias } : {}) });
        return;
      }
      // CASE → „Wenn–dann“, COALESCE mit mehreren Werten → „Erster Wert“
      const calc = parseCase(expr) || parseFirst(expr);
      if (calc) {
        if (alias && alias !== autoSelectAlias(calc)) calc.alias = alias;
        selectCols.push(calc);
        return;
      }
      // nicht zerlegbar → Profi-Formel
      selectCols.push({ expr: rewriteRefs(unwrapParens(expr)), alias: alias || ('formel' + (selectCols.length + 1)) });
      unsupported++;
    });
  }

  // GROUP BY
  const groupBody = clause('GROUP BY');
  if (groupBody) {
    splitTopLevel(groupBody, ',').forEach(g => {
      const dec = decomposeExpr(g.trim(), canonCol);
      if (dec) { groupCols.push(dec.base); if (dec.fns.length && !groupFns.length) groupFns = dec.fns; }
      else { const cc = canonCol(g.trim()); if (cc) groupCols.push(cc); }
    });
  }

  if (aggsFound.length || groupCols.length) {
    blocks.active.group = true;
    blocks.aggs = aggsFound.length ? aggsFound : [];
    blocks.groupBy = groupCols;
    blocks.groupFns = groupFns;
    blocks.groupAliases = groupCols.map(c => {
      const hit = selectCols.find(x => x.col === c && x.alias);
      return hit ? hit.alias : '';
    });
  } else if (!usedStar && selectCols.length) {
    blocks.active.select = true;
    blocks.selectCols = selectCols;
  }

  // WHERE in Bausteine
  if (whereConds.length) {
    blocks.active.where = true;
    blocks.wheres = whereConds.map(cond => {
      const w = parseCondition(cond.text, cond.conj, canonCol, decomposeExpr);
      return w.raw !== undefined ? { ...w, raw: rewriteRefs(unwrapParens(w.raw)) } : w;
    });
  }

  // Alle Namen, die die Abfrage im Ergebnis vergibt (für ORDER BY nach Alias)
  const resultNames = resultAliases(blocks);

  // ORDER BY
  const orderBody = clause('ORDER BY');
  if (orderBody) {
    const os = [];
    splitTopLevel(orderBody, ',').forEach(o => {
      let txt = o.trim(); let dir = 'ASC';
      const m = /\s+(ASC|DESC)$/i.exec(txt);
      if (m) { dir = m[1].toUpperCase(); txt = txt.slice(0, m.index).trim(); }
      // ORDER BY darf auch auf einen im SELECT vergebenen Namen zeigen
      const named = unquoteAlias(txt);
      if (named && resultNames.includes(named)) { os.push({ col: named, dir, fns: [] }); return; }
      const dec = decomposeExpr(txt, canonCol);
      if (dec) os.push({ col: dec.base, dir, fns: dec.fns });
      else { const cc = canonCol(txt); if (cc) os.push({ col: cc, dir, fns: [] }); }
    });
    if (os.length) { blocks.active.order = true; blocks.orderBy = os; }
  }

  // LIMIT
  const limitBody = clause('LIMIT');
  if (limitBody) {
    const n = parseInt(limitBody, 10);
    if (n > 0) { blocks.active.limit = true; blocks.limit = n; }
  }

  // Warnungen sammeln
  const notes = [];
  if (unsupported) notes.push(unsupported + (unsupported === 1 ? ' Ausdruck' : ' Ausdrücke') + ' als Profi-Formel übernommen');
  const rawConds = blocks.wheres.filter(w => w.raw !== undefined).length;
  if (rawConds) notes.push(rawConds + ' Bedingung' + (rawConds === 1 ? '' : 'en') + ' als Profi-Bedingung übernommen');
  if (attaches.length) notes.push('ATTACH: ' + attaches.map(a => a.name).join(', ') + ' ist bereits geöffnet');
  if (skippedJoins) notes.push(skippedJoins + ' JOIN' + (skippedJoins === 1 ? '' : 's') + ' nicht übernommen — Bausteine verstehen nur ON a.spalte = b.spalte (links auch COALESCE(a.x, b.y))');

  return { blocks, notes };
}

// Eine WHERE-Bedingung parsen → {col,op,val,conj,fns} oder {raw,conj}
function parseCondition(text, conj, canon, decompose) {
  const raw = { raw: text.trim(), conj };
  // Operator auf oberster Ebene finden
  const ops2 = ['>=', '<=', '<>', '!='];
  let opInfo = null;
  let depth = 0, inStr = false;
  for (let i = 0; i < text.length && !opInfo; i++) {
    const c = text[i];
    if (inStr) { if (c === "'") { if (text[i + 1] === "'") i++; else inStr = false; } continue; }
    if (c === "'") { inStr = true; continue; }
    if (c === '(') { depth++; continue; }
    if (c === ')') { depth--; continue; }
    if (depth !== 0) continue;
    const two = text.substr(i, 2);
    if (ops2.includes(two)) { opInfo = { op: two, idx: i, len: 2 }; break; }
    if (text.substr(i, 6).toUpperCase() === ' LIKE ') { opInfo = { op: 'LIKE', idx: i, len: 6, word: true }; break; }
    if (c === '=' || c === '>' || c === '<') { opInfo = { op: c, idx: i, len: 1 }; break; }
  }
  if (!opInfo) return raw;

  const left = text.slice(0, opInfo.idx).trim();
  let right = text.slice(opInfo.idx + opInfo.len).trim();
  const dec = decompose(left, canon);
  if (!dec) return raw;

  let op = opInfo.op === '<>' ? '!=' : opInfo.op;
  let val;
  if (op === 'LIKE') {
    let s = stripQuotes(right);
    s = s.replace(/^%/, '').replace(/%$/, '');
    val = s;
  } else {
    const trimmed = right.trim();
    if (/^'(?:[^']|'')*'$/.test(trimmed)) val = stripQuotes(trimmed);
    else if (/^-?\d+(\.\d+)?$/.test(trimmed)) val = trimmed;
    else return raw; // Vergleich mit Spalte/Unterabfrage → Profi-Bedingung
  }
  return { col: dec.base, op, val, conj, fns: dec.fns };
}

/* ---------- Export / Import als Datei ---------- */

function exportQueryObject(blocks, dbName) {
  return {
    app: 'SQL Spielplatz', kind: 'query', version: 1,
    erstellt: new Date().toISOString(),
    datenbank: dbName || null,
    sql: (typeof buildQuerySQL === 'function' ? buildQuerySQL(blocks) : null),
    blocks
  };
}

function downloadQuery(blocks, dbName) {
  const obj = exportQueryObject(blocks, dbName);
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  a.href = url; a.download = 'abfrage-' + stamp + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Liest eine importierte Datei (Text) → { blocks } oder { error }
function parseQueryFile(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return { error: 'Die Datei ist kein gültiges JSON.' }; }
  if (!obj || obj.kind !== 'query' || !obj.blocks) return { error: 'Das ist keine gespeicherte Abfrage von SQL Spielplatz.' };
  // auf vollständige Block-Form bringen (fehlende Felder ergänzen)
  const b = Object.assign(emptyBlocks(), obj.blocks);
  b.active = Object.assign({ join: false, where: false, group: false, order: false, limit: false, select: false }, obj.blocks.active || {});
  return { blocks: b, datenbank: obj.datenbank || null };
}

Object.assign(window, {
  parseSQLToBlocks, decomposeExpr, splitTopLevel, normExpr, splitAttach, attachProblem,
  exportQueryObject, downloadQuery, parseQueryFile
});

// Protect quoted table/column names (including spaces, dots and SQL keywords)
// from the clause scanner. String literals remain untouched.
function parseSQLToBlocks(sqlRaw, schema) {
  const byName = new Map(), replacements = new Map();
  let index = 0;
  const mask = raw => {
    const value = unquoteIdent(raw), key = value.toLowerCase();
    if (!byName.has(key)) {
      let token;
      do { token = '__sqlsp_identifier_' + index++; } while (String(sqlRaw).includes(token));
      byName.set(key, token); replacements.set(token, value);
    }
    return byName.get(key);
  };
  const sql = String(sqlRaw || '').replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\]/g,
    raw => raw.startsWith("'") ? raw : mask(raw));
  if (!replacements.size) return parseSQLToBlocksCore(sqlRaw, schema);
  const mapped = { tables: schema.tables.map(t => ({ ...t,
    name: splitIdent(t.name).map(p => byName.get(unquoteIdent(p).toLowerCase()) || p).join('.'),
    columns: t.columns.map(c => ({ ...c, name: byName.get(c.name.toLowerCase()) || c.name }))
  })) };
  const result = parseSQLToBlocksCore(sql, mapped);
  const restore = (value, key) => {
    if (typeof value === 'string') {
      if (['val', 'arg'].includes(key)) return value;
      for (const [token, name] of replacements) {
        value = value.split(token).join(['leftCol', 'rightCol', 'alias'].includes(key) ? name : aliasSQL(name));
      }
      return value;
    }
    if (Array.isArray(value)) return value.map(v => restore(v, key));
    // Ersatz-Spalten eines JOINs ({ref, table, col}) sind wie leftCol nackte Spaltennamen
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restore(v, key === 'leftAlt' && k === 'col' ? 'leftCol' : k)]));
    return value;
  };
  return restore(result);
}
