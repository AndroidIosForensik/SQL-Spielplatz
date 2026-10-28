// Live-SQL-Vorschau + animierte Ergebnis-Tabelle

// dbNames: nur bei genau einer geöffneten Datenbank – { on, set } schaltet „plauder.“ vor den Tabellen ein/aus
function SqlPreview({ blocks, show, dbNames }) {
  const parts = buildQueryParts(blocks);
  return (
    <div className="sqlprev" data-screen-label="SQL-Vorschau">
      <div className="panel-title">Dein SQL <span className="panel-sub">schreibt sich beim Bauen mit</span>
        {dbNames && (
          <label className="sqlprev-db" title="Bei nur einer geöffneten Datenbank findet SQLite die Tabellen auch ohne Datenbanknamen davor">
            <input type="checkbox" checked={dbNames.on} onChange={(e) => dbNames.set(e.target.checked)} />
            Datenbankname
          </label>
        )}
      </div>
      <pre className="sqlcode">
        {!parts && <span className="sql-empty">-- Wähle zuerst eine Tabelle (FROM)…</span>}
        {parts && parts.map((p, i) => (
          <div key={p.key + ':' + p.text} className="sql-line"
               dangerouslySetInnerHTML={{ __html: highlightSQL(show ? show(p.text) : p.text) + (i === parts.length - 1 ? ';' : '') }} />
        ))}
      </pre>
    </div>
  );
}

function SqlStatic({ sql }) {
  return (
    <pre className="sqlcode" >
      <div className="sql-line" dangerouslySetInnerHTML={{ __html: highlightSQL(sql) }} />
    </pre>
  );
}

const MAX_ROWS = 60;

/* ---------- Export ---------- */
function resultToCSV(result) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [result.columns.map(esc).join(';')]
    .concat(result.rows.map(r => r.map(esc).join(';')));
  return '\ufeff' + lines.join('\r\n');
}

// Eingegebener Name → gültiger Dateiname; „.csv“ wird ergänzt, verbotene Zeichen ersetzt
function csvFileName(name) {
  const n = String(name || '').trim().replace(/\.csv$/i, '').replace(/[\\/:*?"<>|]+/g, '_').trim();
  return (n || 'abfrage-ergebnis') + '.csv';
}

function downloadCSV(result, name) {
  const blob = new Blob([resultToCSV(result)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = csvFileName(name);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function resultToTSV(result) {
  const esc = (v) => v === null || v === undefined ? '' : String(v).replace(/[\t\n\r]/g, ' ');
  return [result.columns.map(esc).join('\t')]
    .concat(result.rows.map(r => r.map(esc).join('\t'))).join('\n');
}

function ResultsPanel({ result, error, running, notice, runId }) {
  const [copied, setCopied] = React.useState(false);
  // Dateiname für den CSV-Export; der zuletzt benutzte bleibt im Browser gemerkt
  const [fileName, setFileName] = React.useState(() => {
    try { return localStorage.getItem('sqlsp_csvname') || 'abfrage-ergebnis'; } catch (e) { return 'abfrage-ergebnis'; }
  });
  const changeFileName = (v) => {
    setFileName(v);
    try { localStorage.setItem('sqlsp_csvname', v); } catch (e) {}
  };
  const canExport = result && !error && result.rows.length > 0;
  const copy = () => {
    navigator.clipboard.writeText(resultToTSV(result)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <div className="results" data-screen-label="Ergebnis">
      <div className="panel-title">
        Ergebnis
        {result && !error && (
          <span className="panel-sub">
            {result.rows.length} Zeile{result.rows.length === 1 ? '' : 'n'}
            {result.rows.length > MAX_ROWS ? ` (erste ${MAX_ROWS} angezeigt)` : ''}
          </span>
        )}
        {canExport && (
          <span className="res-export">
            <label className="res-filename" title="Dateiname für den CSV-Export">
              <input className="binp" value={fileName} spellCheck="false" aria-label="Dateiname für den CSV-Export"
                     placeholder="abfrage-ergebnis"
                     onChange={e => changeFileName(e.target.value)}
                     onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') downloadCSV(result, fileName); }} />
              <span>.csv</span>
            </label>
            <button className="ch-btn" onClick={() => downloadCSV(result, fileName)}
                    title={'Alle Ergebnis-Zeilen als „' + csvFileName(fileName) + '“ herunterladen (öffnet sich in Excel)'}>⤓ CSV</button>
            <button className="ch-btn" onClick={copy}
                    title="Als Tabelle in die Zwischenablage — direkt in Excel einfügbar">{copied ? '✓ Kopiert!' : '⧉ Kopieren'}</button>
          </span>
        )}
      </div>

      {error && <div className="res-error">⚠ {error}</div>}
      {notice && !error && <div className="res-notice">{notice}</div>}

      {!result && !error && !notice && (
        <div className="res-empty">
          {running ? 'Die Daten fließen durch deine Bausteine…' : 'Baue eine Abfrage und drücke „Ausführen“.'}
        </div>
      )}

      {result && !error && (
        <div className="res-scroll" key={runId}
             style={{ height: result.rows.length > 8 ? 320 : 'auto', resize: result.rows.length > 8 ? 'vertical' : 'none' }}>
          <table className="res-table">
            <thead>
              <tr>{result.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {result.rows.slice(0, MAX_ROWS).map((r, ri) => (
                <tr key={ri} className="res-row" style={{ animationDelay: (Math.min(ri, 25) * 45) + 'ms' }}>
                  {r.map((v, ci) => (
                    <td key={ci}>{v === null ? <span className="res-null">NULL</span> : String(v)}</td>
                  ))}
                </tr>
              ))}
              {result.rows.length === 0 && (
                <tr><td className="res-none" colSpan={result.columns.length}>Keine Zeile hat es bis hierher geschafft 🤷</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Daten-Vorschau einer Tabelle — frei verschiebbares Fenster, mehrere gleichzeitig möglich
function TablePreviewWindow({ p, onClose, onMove, onFocus }) {
  const dragRef = React.useRef(null);
  // Spaltensuche: zeigt nur die Spalten, deren Name alle Suchwörter enthält
  const [q, setQ] = React.useState('');
  const shown = p.columns.map((c, i) => i).filter(i => !q.trim() || colMatches(p.columns[i], q));

  const down = (e) => {
    if (e.target.closest('button, input')) return;
    e.preventDefault();
    onFocus(p.table);
    const card = e.currentTarget.closest('.tprev');
    const r = card.getBoundingClientRect();
    const pr = card.offsetParent.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, px: pr.left, py: pr.top, pw: pr.width, ph: pr.height };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };
  const move = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const x = Math.max(6, Math.min(d.pw - 120, e.clientX - d.px - d.dx));
    const y = Math.max(6, Math.min(d.ph - 44, e.clientY - d.py - d.dy));
    onMove(p.table, x, y);
  };
  const up = () => { dragRef.current = null; };

  return (
    <div className="tprev" style={{ left: p.x, top: p.y, zIndex: p.z }}
         onPointerDown={() => onFocus(p.table)} data-screen-label="Daten-Vorschau">
      <div className="tprev-head" onPointerDown={down} onPointerMove={move}
           onPointerUp={up} onPointerCancel={up} title="Zum Verschieben ziehen">
        <span className="ch-grip">☰</span>
        <span className="tprev-glyph">▤</span>
        <span className="tprev-name">{p.table}</span>
        <span className="panel-sub">
          {p.total} Zeile{p.total === 1 ? '' : 'n'}
          {p.total > p.rows.length ? ` · erste ${p.rows.length}` : ''}
          {q.trim() ? ` · ${shown.length} von ${p.columns.length} Spalten` : ''}
        </span>
        <input className="binp tprev-search" value={q} spellCheck="false"
               placeholder={'Spalte suchen… (' + p.columns.length + ')'}
               aria-label={'Spalte suchen in ' + p.table} title="Esc: Suche leeren"
               onChange={e => setQ(e.target.value)}
               onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') setQ(''); }} />
        <button className="bmini" title="Schließen" onClick={() => onClose(p.table)}>✕</button>
      </div>
      <div className="res-scroll tprev-scroll" key={p.stamp}>
        <table className="res-table">
          <thead>
            <tr>{shown.map(i => <th key={i}>{p.columns[i]}</th>)}</tr>
          </thead>
          <tbody>
            {shown.length > 0 && p.rows.map((r, ri) => (
              <tr key={ri} className="res-row" style={{ animationDelay: (Math.min(ri, 15) * 40) + 'ms' }}>
                {shown.map(ci => (
                  <td key={ci}>{r[ci] === null ? <span className="res-null">NULL</span> : String(r[ci])}</td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td className="res-none">Keine Spalte passt zu „{q.trim()}“.</td></tr>
            )}
            {shown.length > 0 && p.rows.length === 0 && (
              <tr><td className="res-none" colSpan={Math.max(1, p.columns.length)}>Diese Tabelle ist leer.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Freier SQL-Editor — für alle, die selbst tippen wollen
function SqlEditor({ value, onChange, onRun, onFromBlocks, onToBlocks, hasBlocks }) {
  return (
    <div className="sqled" data-screen-label="SQL-Editor">
      <div className="panel-title">SQL selbst schreiben <span className="panel-sub">echte Engine — alles ist erlaubt</span></div>
      <textarea className="sqled-ta" spellCheck="false"
                value={value}
                placeholder={'SELECT name, stadt\nFROM nutzer\nWHERE stadt = \'Berlin\';'}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun(); } }} />
      <div className="sqled-row">
        <button className="ch-btn sqled-tb" onClick={onToBlocks} disabled={!value.trim()}
                title="Das getippte SELECT in die Bausteine übernehmen">☰ In Bausteine umwandeln</button>
        {hasBlocks && (
          <button className="ch-btn" onClick={onFromBlocks} title="Das aktuell gebaute Baustein-SQL in den Editor kopieren">
            ⤓ Aus Bausteinen übernehmen
          </button>
        )}
      </div>
      <div className="sqled-row">
        <span className="bhint">Strg+Enter führt aus · SELECT wird umgewandelt, was nicht passt wird zur Profi-Formel · auch INSERT/UPDATE/DELETE möglich</span>
      </div>
    </div>
  );
}

Object.assign(window, { SqlPreview, SqlStatic, ResultsPanel, TablePreviewWindow, SqlEditor, downloadCSV, csvFileName, MAX_ROWS });
