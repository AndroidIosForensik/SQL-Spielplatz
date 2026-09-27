// Daten ändern: INSERT / UPDATE / DELETE

const MOD_DEFS = [
  { v: 'INSERT', t: 'Einfügen', color: '#2F9E6E', desc: 'Fügt eine neue Zeile in eine Tabelle ein.' },
  { v: 'UPDATE', t: 'Ändern',   color: '#F5B82E', desc: 'Ändert Werte in bestehenden Zeilen.' },
  { v: 'DELETE', t: 'Löschen',  color: '#E14B4B', desc: 'Löscht Zeilen aus einer Tabelle. Vorsicht!' },
  { v: 'VIEW',   t: 'Ansicht',  color: '#2563EB', desc: 'Speichert eine Abfrage unter einem Namen. Sie erscheint als blaue Karte und lässt sich wie eine Tabelle verwenden.' }
];

// Aus eingefügtem Text die eine SELECT-Abfrage holen: ATTACH davor, Semikolon am Ende und
// ein umschließendes CREATE VIEW name AS … fallen weg. Mehrere Anweisungen → null.
function viewSelect(text) {
  const { rest } = splitAttach(text);
  if (rest.length !== 1) return null;
  const create = parseCreateView(rest[0]);
  const body = create ? create.select : rest[0];
  return /^\s*(select|with|values)\b/i.test(body) ? body.trim() : null;
}
function parseCreateView(stmt) {
  const m = /^\s*CREATE\s+(?:TEMP\s+|TEMPORARY\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"(?:[^"]|"")*"|`[^`]*`|\[[^\]]*\]|[\w$]+)(?:\s*\.\s*(?:"(?:[^"]|"")*"|`[^`]*`|\[[^\]]*\]|[\w$]+))?)\s+AS\s+([\s\S]+)$/i.exec(stmt);
  return m ? { name: unquoteIdent(splitIdent(m[1].replace(/\s+/g, '')).pop()), select: m[2].replace(/;\s*$/, '').trim() } : null;
}

// Eigene Ansicht: immer TEMP – sie gilt, solange die Seite offen ist, und darf Tabellen aus allen
// geöffneten Datenbanken verwenden. Gibt es sie schon, wird sie ersetzt.
function viewProblem(v, schema) {
  const name = String(v.name || '').trim();
  if (!name) return 'Gib der Ansicht einen Namen, z.B. personen.';
  const clash = schema.tables.find(t => !(t.view && t.database === 'temp') && (t.localName || t.name).toLowerCase() === name.toLowerCase());
  if (clash) return 'Den Namen „' + name + '“ trägt schon ' + (clash.view ? 'die Ansicht ' : 'die Tabelle ') + clash.name +
    ' — nimm einen anderen, sonst ist er in Abfragen nicht mehr eindeutig.';
  if (!viewSelect(v.select)) return 'Die Ansicht braucht genau eine SELECT-Abfrage.';
  return null;
}
function buildViewSQL(v, schema) {
  if (viewProblem(v, schema)) return null;
  const name = aliasSQL(String(v.name).trim());
  const exists = schema.tables.some(t => t.view && t.database === 'temp' && t.localName.toLowerCase() === String(v.name).trim().toLowerCase());
  return (exists ? 'DROP VIEW temp.' + name + ';\n' : '') + 'CREATE TEMP VIEW ' + name + ' AS\n' + viewSelect(v.select) + ';';
}

function buildModifySQL(m, schema) {
  const t = schema.tables.find(x => x.name === m.table);
  if (!t) return null;
  if (m.action === 'INSERT') {
    const entries = t.columns
      .filter(c => !(c.pk && /INT/i.test(c.type)))
      .map(c => ({ col: c.name, val: m.vals[c.name] }))
      .filter(e => e.val !== undefined && e.val !== '');
    if (!entries.length) return null;
    return 'INSERT INTO ' + m.table + ' (' + entries.map(e => aliasSQL(e.col)).join(', ') + ')\nVALUES (' +
           entries.map(e => quoteVal(e.val, '=')).join(', ') + ');';
  }
  const condTxt = m.conds.filter(c => c.col && c.val !== '')
    .map((c, i) => (i ? 'AND ' : '') + aliasSQL(c.col) + ' ' + c.op + ' ' + quoteVal(c.val, c.op)).join(' ');
  if (m.action === 'UPDATE') {
    const sets = m.sets.filter(s => s.col && s.val !== '');
    if (!sets.length) return null;
    return 'UPDATE ' + m.table + '\nSET ' + sets.map(s => aliasSQL(s.col) + ' = ' + quoteVal(s.val, '=')).join(', ') +
           (condTxt ? '\nWHERE ' + condTxt : '') + ';';
  }
  if (m.action === 'DELETE') {
    return 'DELETE FROM ' + m.table + (condTxt ? '\nWHERE ' + condTxt : '') + ';';
  }
  return null;
}

function emptyModify() {
  return { action: 'INSERT', table: null, vals: {}, sets: [{ col: '', op: '=', val: '' }], conds: [{ col: '', op: '=', val: '' }], name: '', select: '' };
}

function ViewEditor({ m, setM, schema, querySQL, editorSQL, onExecute, setMsg }) {
  const views = schema.tables.filter(t => t.view && t.database === 'temp');
  const problem = (m.name || m.select) ? viewProblem(m, schema) : null;
  const sql = buildViewSQL(m, schema);
  const replacing = sql && /^DROP VIEW/.test(sql);
  const editorSelect = viewSelect(editorSQL);
  const setSelect = (text) => {
    // Ganzes CREATE VIEW eingefügt? → Name und Abfrage getrennt übernehmen
    const { rest } = splitAttach(text);
    const create = rest.length === 1 && parseCreateView(rest[0]);
    setM(create ? { ...m, name: create.name, select: create.select } : { ...m, select: text });
    setMsg(null);
  };
  return (
    <div style={{ marginTop: 10 }}>
      <div className="bhint">
        Eine Ansicht (VIEW) ist eine gespeicherte Abfrage, die sich wie eine Tabelle benutzen lässt – z.B. ein
        Personenverzeichnis, in dem jede Nachricht zweimal nachschaut. Sie ist <b>TEMP</b>: gilt, solange die Seite
        offen ist, darf Tabellen aus allen geöffneten Datenbanken verwenden und verändert keine Datei.
      </div>
      <div className="brow" style={{ marginTop: 10 }}>
        <span className="blbl">Name</span>
        <input className="binp" value={m.name} placeholder="z.B. personen" spellCheck="false"
               onChange={(e) => { setM({ ...m, name: e.target.value }); setMsg(null); }} />
      </div>
      <div className="mod-sub">Abfrage (SELECT)</div>
      <textarea className="sqled-ta view-ta" value={m.select} spellCheck="false"
                placeholder={'SELECT jid._id AS person_id, …\nFROM jid\nLEFT JOIN …'}
                onChange={(e) => setSelect(e.target.value)} />
      <div className="sqled-row">
        <button className="qtool" disabled={!querySQL} onClick={() => setSelect(querySQL)}
                title="Die Abfrage aus den Bausteinen (Reiter „Abfragen“) übernehmen">⬚ Aus den Bausteinen</button>
        <button className="qtool" disabled={!editorSelect} onClick={() => setSelect(editorSelect)}
                title="Die Abfrage aus „SQL schreiben“ übernehmen">✎ Aus dem SQL-Editor</button>
      </div>
      {problem && <div className="bhint view-problem">⚠ {problem}</div>}
      {sql && (
        <div style={{ marginTop: 10 }}>
          <SqlStatic sql={sql} />
          <button className="runbtn runbtn-view" style={{ marginTop: 8 }} onClick={() => setMsg(onExecute(sql, 'temp.' + aliasSQL(m.name.trim())))}>
            {replacing ? 'Ansicht ersetzen' : 'Ansicht anlegen'}
          </button>
        </div>
      )}
      {views.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="mod-sub">Eigene Ansichten</div>
          <div className="bstack">
            {views.map(v => (
              <div className="brow" key={v.name}>
                <span className="view-tag">VIEW</span>
                <span className="blbl view-name" title={v.name}>{v.localName}</span>
                <span className="bhint" style={{ margin: 0 }}>{v.columns.length} Spalten</span>
                <button className="bmini" title="Name und Abfrage zum Bearbeiten laden"
                        onClick={() => { setM({ ...m, name: v.localName, select: viewDefinition(v) || m.select }); setMsg(null); }}>✎</button>
                <button className="bmini" title={'Ansicht löschen (DROP VIEW ' + v.name + ')'}
                        aria-label={'Ansicht löschen: ' + v.localName}
                        onClick={() => setMsg(onExecute('DROP VIEW ' + v.name + ';', v.name))}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
// Die gespeicherte Abfrage einer Ansicht (aus sqlite_temp_master, beim Einlesen mitgenommen)
function viewDefinition(v) {
  const create = v.sql && parseCreateView(v.sql);
  return create ? create.select : null;
}

function CondRows({ items, onChange, cols, getDistinct, addLabel, table }) {
  const upd = (i, patch) => onChange(items.map((c, x) => x === i ? { ...c, ...patch } : c));
  return (
    <div className="bstack">
      {items.map((c, i) => (
        <div className="brow" key={i}>
          <select className="bsel" value={c.col || ''} onChange={(e) => upd(i, { col: e.target.value })}>
            <option value="" disabled>Spalte…</option>
            {cols.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          {c.op !== undefined && (
            <select className="bsel bsel-op" value={c.op} onChange={(e) => upd(i, { op: e.target.value })}>
              {OPERATORS.filter(o => o.v !== 'LIKE').map(o => <option key={o.v} value={o.v}>{o.v}</option>)}
            </select>
          )}
          {c.op === undefined && <span className="blbl">=</span>}
          <ComboValue value={c.val} placeholder="Wert"
                      options={c.col && getDistinct ? getDistinct(c.col, null, table) : []}
                      onChange={(v) => upd(i, { val: v })} />
          {items.length > 1 && (
            <button className="bmini" onClick={() => onChange(items.filter((_, x) => x !== i))}>✕</button>
          )}
        </div>
      ))}
      <button className="badd" onClick={() => onChange([...items, { col: '', op: '=', val: '' }])}>+ {addLabel}</button>
    </div>
  );
}

function ModifyPanel({ schema, hidden, onExecute, getDistinct, viewDraft, querySQL, editorSQL }) {
  const [m, setM] = React.useState(emptyModify);
  const [msg, setMsg] = React.useState(null);
  // „Als Ansicht speichern“ im Reiter Abfragen: Abfrage übernehmen, Name bleibt frei
  React.useEffect(() => {
    if (viewDraft) { setM({ ...emptyModify(), action: 'VIEW', select: viewDraft.select }); setMsg(null); }
  }, [viewDraft && viewDraft.stamp]);
  const isView = m.action === 'VIEW';

  const t = schema.tables.find(x => x.name === m.table);
  const cols = t ? t.columns.map(c => c.name) : [];
  const sql = isView ? null : buildModifySQL(m, schema);
  const def = MOD_DEFS.find(d => d.v === m.action);
  const noWhere = (m.action !== 'INSERT') && !m.conds.some(c => c.col && c.val !== '');

  const run = () => {
    if (!sql) return;
    const res = onExecute(sql, m.table);
    setMsg(res);
  };

  return (
    <div className="modify" data-screen-label="Daten ändern">
      <div className="panel-title">Daten ändern <span className="panel-sub">wirkt nur auf die Kopie im Browser</span></div>

      <div className="mod-actions">
        {MOD_DEFS.map(d => (
          <button key={d.v}
                  className={'mod-chip' + (m.action === d.v ? ' mod-on' : '')}
                  style={{ '--bc': d.color }}
                  title={d.desc}
                  onClick={() => { setM({ ...emptyModify(), action: d.v, table: m.table, name: m.name, select: m.select }); setMsg(null); }}>
            <span className="chip-label">{d.v}</span>
            <span className="chip-name">{d.t}</span>
          </button>
        ))}
      </div>

      {isView && <ViewEditor m={m} setM={setM} schema={schema} querySQL={querySQL} editorSQL={editorSQL}
                             onExecute={onExecute} setMsg={setMsg} />}

      {!isView && <div className="brow" style={{ marginTop: 10 }}>
        <span className="blbl">Tabelle</span>
        <select className="bsel bsel-big" value={m.table || ''}
                onChange={(e) => { setM({ ...m, table: e.target.value, vals: {} }); setMsg(null); }}>
          <option value="" disabled>Tabelle wählen…</option>
          {/* Ausgeblendete Tabellen fehlen in der Auswahl – außer der gerade gewählten */}
          {/* Ansichten lassen sich nicht direkt ändern – ihre Daten kommen aus den Tabellen dahinter */}
          {schema.tables.filter(x => !x.view && (!hidden || !hidden.has(x.name) || x.name === m.table))
            .map(x => <option key={x.name} value={x.name}>{x.name}</option>)}
        </select>
      </div>}

      {t && m.action === 'INSERT' && (
        <div className="bstack" style={{ marginTop: 8 }}>
          {t.columns.map(c => (
            <div className="brow" key={c.name}>
              <span className="blbl blbl-w">{c.name}</span>
              {c.pk && /INT/i.test(c.type)
                ? <span className="bhint" style={{ margin: 0 }}>wird automatisch vergeben</span>
                : <ComboValue value={m.vals[c.name] || ''} placeholder={c.type || 'Wert'}
                              options={getDistinct ? getDistinct(c.name, null, m.table) : []}
                              onChange={(v) => setM({ ...m, vals: { ...m.vals, [c.name]: v } })} />}
            </div>
          ))}
        </div>
      )}

      {t && m.action === 'UPDATE' && (
        <div style={{ marginTop: 8 }}>
          <div className="mod-sub">Neue Werte (SET)</div>
          <CondRows items={m.sets.map(s => ({ col: s.col, val: s.val }))} cols={cols} addLabel="Wert setzen"
                    getDistinct={getDistinct} table={m.table}
                    onChange={(items) => setM({ ...m, sets: items.map(i2 => ({ col: i2.col, val: i2.val })) })} />
          <div className="mod-sub">Welche Zeilen? (WHERE)</div>
          <CondRows items={m.conds} cols={cols} getDistinct={getDistinct} addLabel="Bedingung" table={m.table}
                    onChange={(items) => setM({ ...m, conds: items })} />
        </div>
      )}

      {t && m.action === 'DELETE' && (
        <div style={{ marginTop: 8 }}>
          <div className="mod-sub">Welche Zeilen löschen? (WHERE)</div>
          <CondRows items={m.conds} cols={cols} getDistinct={getDistinct} addLabel="Bedingung" table={m.table}
                    onChange={(items) => setM({ ...m, conds: items })} />
        </div>
      )}

      {sql && (
        <div style={{ marginTop: 10 }}>
          {noWhere && (
            <div className="res-error" style={{ marginBottom: 8 }}>
              ⚠ Ohne WHERE trifft das ALLE Zeilen der Tabelle!
            </div>
          )}
          <SqlStatic sql={sql} />
          <button className="runbtn" style={{ marginTop: 8 }} onClick={run}>
            {def.t} ausführen
          </button>
        </div>
      )}

      {msg && <div className={msg.error ? 'res-error' : 'res-notice'} style={{ marginTop: 8 }}>{msg.error || msg.text}</div>}
    </div>
  );
}

Object.assign(window, { ModifyPanel, buildModifySQL, buildViewSQL, viewSelect });
