// Schema-Canvas: Tabellen-Karten, Drag, animierte Beziehungslinien

const TABLE_W = 260;
const HEADER_H = 40;
const ROW_H = 27;
const FOOTER_H = 28;
const MIN_TABLE_W = 220;
const MIN_TABLE_H = 122;
const LAYOUTS = [
  { key: 'database', label: 'Nach Datenbank' },
  { key: 'grid', label: 'Raster A–Z' },
  { key: 'list', label: 'Liste A–Z' }
];

function tableWidth(t) { return t.w || TABLE_W; }
function tableHeight(t) {
  return t.h || Math.max(MIN_TABLE_H, HEADER_H + Math.min(10, t.columns.length) * ROW_H + FOOTER_H + 4);
}
function columnAreaHeight(t) { return tableHeight(t) - HEADER_H - FOOTER_H - 4; }

// Stable row order and actual card dimensions: no masonry jumps or overlaps.
function arrangeTables(tables, mode = 'database', viewportWidth = 800) {
  const compare = (a, b) => String(a).localeCompare(String(b), 'de', { numeric: true, sensitivity: 'base' });
  const ordered = [...tables].sort((a, b) =>
    (mode === 'database' ? compare(a.database || '', b.database || '') : 0) ||
    compare(a.localName || a.name, b.localName || b.name) || compare(a.name, b.name));
  const positions = {}, gap = 36, margin = 28;
  const widest = Math.max(260, ...ordered.map(tableWidth));
  const columns = mode === 'list' ? 1 : Math.max(1, Math.min(6, Math.floor((viewportWidth - margin * 2 + gap) / (widest + gap))));
  let y = margin;
  const groups = [];
  for (const t of ordered) {
    const key = mode === 'database' ? (t.database || 'Datenbank') : '';
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) { group = { key, tables: [] }; groups.push(group); }
    group.tables.push(t);
  }
  for (const group of groups) {
    if (mode === 'database') y += 36;
    for (let i = 0; i < group.tables.length; i += columns) {
      const row = group.tables.slice(i, i + columns);
      row.forEach((t, column) => { positions[t.name] = { x: margin + column * (widest + gap), y }; });
      y += Math.max(...row.map(tableHeight)) + gap;
    }
    if (mode === 'database') y += 18;
  }
  return positions;
}

function fitTables(tables, width, height) {
  if (!tables.length) return { zoom: 1, left: 0, top: 0 };
  const left = Math.min(...tables.map(t => t.x));
  const top = Math.max(0, Math.min(...tables.map(t => t.y)) - 36);
  const right = Math.max(...tables.map(t => t.x + tableWidth(t)));
  const bottom = Math.max(...tables.map(t => t.y + tableHeight(t)));
  const zoom = Math.max(0.05, Math.min(1, (width - 48) / (right - left), (height - 64) / (bottom - top)));
  return { zoom, left: Math.max(0, left * zoom - 24), top: Math.max(0, top * zoom - 24) };
}

// Wieder eingeblendete Karten: alter Platz, falls frei – sonst die nächste freie Stelle
// neben einer sichtbaren Karte. Die übrigen Karten bleiben, wo sie sind.
function placeTables(tables, obstacles) {
  const gap = 36, margin = 28;
  const placed = [...obstacles], positions = {};
  const fits = (p, t, space) => placed.every(o =>
    p.x + tableWidth(t) + space <= o.x || o.x + tableWidth(o) + space <= p.x ||
    p.y + tableHeight(t) + space <= o.y || o.y + tableHeight(o) + space <= p.y);
  if (tables.length > 12) {
    // Viele auf einmal (z.B. „Alle auswählen“): als Raster unter die vorhandenen Karten, statt jede einzeln einzupassen
    const top = Math.max(0, ...obstacles.map(o => o.y + tableHeight(o) + gap));
    const grid = arrangeTables(tables, 'grid', Math.max(800, ...obstacles.map(o => o.x + tableWidth(o) + margin)));
    tables.forEach(t => { positions[t.name] = { x: grid[t.name].x, y: grid[t.name].y + top }; });
    return positions;
  }
  for (const t of tables) {
    let spot = { x: t.x, y: t.y };
    if (!fits(spot, t, 0)) {
      const bottom = Math.max(margin - gap, ...placed.map(o => o.y + tableHeight(o)));
      const candidates = [{ x: margin, y: margin }, { x: margin, y: bottom + gap }];
      placed.forEach(o => candidates.push(
        { x: o.x + tableWidth(o) + gap, y: o.y }, { x: o.x, y: o.y + tableHeight(o) + gap },
        { x: o.x - tableWidth(t) - gap, y: o.y }, { x: o.x, y: o.y - tableHeight(t) - gap }));
      const distance = p => Math.hypot(p.x - t.x, p.y - t.y);
      spot = candidates.filter(p => p.x >= 8 && p.y >= 8 && fits(p, t, gap))
        .reduce((best, p) => distance(p) < distance(best) ? p : best);
    }
    positions[t.name] = spot;
    placed.push({ ...t, ...spot });
  }
  return positions;
}

// Choose a balanced grid for the available screen, instead of shrinking a tall strip.
function arrangeForViewport(tables, mode, width, height) {
  if (mode === 'list' || !tables.length) return arrangeTables(tables, mode, width);
  const widest = Math.max(260, ...tables.map(tableWidth));
  let best, score = -1;
  for (let columns = 1; columns <= Math.min(6, tables.length); columns++) {
    const positions = arrangeTables(tables, mode, 56 + columns * (widest + 36) - 36);
    const placed = tables.map(t => ({ ...t, ...positions[t.name] }));
    const fit = fitTables(placed, width, height);
    if (fit.zoom > score) { best = positions; score = fit.zoom; }
  }
  return best;
}

// Datentyp → Symbol (SQLite-Typ-Affinität, großzügig gematcht)
function typeIcon(type) {
  const t = String(type || '').toUpperCase();
  if (!t) return { icon: '?', cls: 'ty-none', label: 'Kein Typ angegeben (SQLite erlaubt das)' };
  if (/INT/.test(t)) return { icon: '#', cls: 'ty-int', label: t + ' — ganze Zahl' };
  if (/REAL|FLOA|DOUB|DEC|NUM/.test(t)) return { icon: '#.#', cls: 'ty-real', label: t + ' — Kommazahl' };
  if (/DATE|TIME/.test(t)) return { icon: '📅', cls: 'ty-date', label: t + ' — Datum/Zeit (als Text/Zahl gespeichert)' };
  if (/BOOL/.test(t)) return { icon: '✓✗', cls: 'ty-bool', label: t + ' — Wahrheitswert (0/1)' };
  if (/BLOB|BINARY/.test(t)) return { icon: '■', cls: 'ty-blob', label: t + ' — Binärdaten (z.B. Bild, Datei)' };
  if (/CHAR|TEXT|CLOB/.test(t)) return { icon: 'Aa', cls: 'ty-text', label: t + ' — Text' };
  return { icon: '?', cls: 'ty-none', label: t };
}

function colDotPos(table, colIndex, side, scrollTop = 0) {
  return {
    x: table.x + (side === 'right' ? tableWidth(table) : 0),
    y: table.y + 2 + HEADER_H + Math.max(6, Math.min(columnAreaHeight(table) - 6, colIndex * ROW_H + ROW_H / 2 - scrollTop))
  };
}

function relEndpoints(rel, tables, scrollOffsets) {
  const tFrom = tables.find(t => t.name === rel.from.table);
  const tTo = tables.find(t => t.name === rel.to.table);
  if (!tFrom || !tTo) return null;
  let iFrom = tFrom.columns.findIndex(c => c.name === rel.from.col);
  let iTo = tTo.columns.findIndex(c => c.name === rel.to.col);
  if (iFrom < 0 || iTo < 0) return null;
  // Offscreen columns connect to the edge of their card's scrollable body.
  // jeweils die zugewandte Seite wählen
  const fromRight = tFrom.x + tableWidth(tFrom) / 2 <= tTo.x + tableWidth(tTo) / 2;
  const a = colDotPos(tFrom, iFrom, fromRight ? 'right' : 'left', scrollOffsets?.[tFrom.name] || 0);
  const b = colDotPos(tTo, iTo, fromRight ? 'left' : 'right', scrollOffsets?.[tTo.name] || 0);
  return { a, b };
}

// Compatibility helper for callers of the original layout function.
function packLayout(tables) {
  return arrangeTables(tables);
}

function relPath(a, b, style) {
  if (style === 'ortho') {
    const mx = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} L ${mx} ${a.y} L ${mx} ${b.y} L ${b.x} ${b.y}`;
  }
  const dx = Math.max(50, Math.abs(b.x - a.x) * 0.45);
  const h1 = a.x <= b.x ? a.x + dx : a.x - dx;
  const h2 = a.x <= b.x ? b.x - dx : b.x + dx;
  return `M ${a.x} ${a.y} C ${h1} ${a.y}, ${h2} ${b.y}, ${b.x} ${b.y}`;
}

function SchemaCanvas({
  schema, relations, counts, activeTables, lineStyle,
  onMoveTable, onAddRelation, onRemoveRelation, queryRelIds, suggestions, onPickSuggestion, onDismissSuggestion, onPickTable, onPreview, onResizeTable, onRelayout,
  onSetHidden, layoutKey, flashTable, runningJoin, tableControls, children
}) {
  const ref = React.useRef(null);
  const [drag, setDrag] = React.useState(null);       // {table, dx, dy}
  const [resize, setResize] = React.useState(null);   // {table}
  const [link, setLink] = React.useState(null);       // {from:{table,col,idx}, x, y, target}
  const [newRelId, setNewRelId] = React.useState(null);
  const [scrollOffsets, setScrollOffsets] = React.useState({});
  // Spaltensuche je Karte: {table: {q, pos}}. Treffer werden markiert, nicht
  // ausgeblendet – die Beziehungslinien rechnen mit der Position in der vollen Liste.
  const [colSearch, setColSearch] = React.useState({});
  const columnLists = React.useRef({});
  const searchHits = (t) => {
    const q = colSearch[t.name]?.q || '';
    return q.trim() ? t.columns.map((c, i) => colMatches(c.name, q) ? i : -1).filter(i => i >= 0) : [];
  };
  const showColumn = (t, i) => {
    const el = columnLists.current[t.name];
    if (el) el.scrollTop = Math.max(0, i * ROW_H - (el.clientHeight - ROW_H) / 2);
  };
  const searchColumns = (t, q) => {
    setColSearch(prev => ({ ...prev, [t.name]: { q, pos: 0 } }));
    const first = q.trim() ? t.columns.findIndex(c => colMatches(c.name, q)) : -1;
    if (first >= 0) showColumn(t, first);
  };
  const nextColumn = (t, step) => {
    const hits = searchHits(t);
    if (!hits.length) return;
    const pos = ((colSearch[t.name]?.pos || 0) + step + hits.length) % hits.length;
    setColSearch(prev => ({ ...prev, [t.name]: { ...prev[t.name], pos } }));
    showColumn(t, hits[pos]);
  };
  const [hiddenNote, setHiddenNote] = React.useState(null); // {name, label} der zuletzt ausgeblendeten Karte
  const [notePaused, setNotePaused] = React.useState(false);
  const [layoutMode, setLayoutMode] = React.useState(() => {
    const saved = localStorage.getItem('sqlsp_layout');
    return LAYOUTS.some(l => l.key === saved) ? saved : 'database';
  });
  const [viewport, setViewport] = React.useState({ width: 800, height: 600 });
  const [zoom, setZoom] = React.useState(1);
  const zoomRef = React.useRef(1);
  zoomRef.current = zoom;
  const panRef = React.useRef(null);

  const applyLayout = (mode = layoutMode) => {
    const el = ref.current;
    if (!el) return;
    setLayoutMode(mode);
    localStorage.setItem('sqlsp_layout', mode);
    const positions = arrangeForViewport(schema.tables, mode, el.clientWidth, el.clientHeight);
    onRelayout(positions);
    const placed = schema.tables.map(t => ({ ...t, ...positions[t.name] }));
    const fit = mode === 'list' ? { zoom: 1, left: 0, top: 0 } : fitTables(placed, el.clientWidth, el.clientHeight);
    setZoom(fit.zoom);
    requestAnimationFrame(() => { el.scrollLeft = fit.left; el.scrollTop = fit.top; });
  };
  // Automatisch neu anordnen nur, wenn Datenbanken dazukommen oder gehen;
  // Aus- und Einblenden lässt die übrigen Karten an ihrem Platz.
  const visibleKey = schema.tables.map(t => t.name).join('\0');
  React.useEffect(() => { applyLayout(); setHiddenNote(null); }, [layoutKey ?? visibleKey]);
  React.useEffect(() => {
    // Wieder eingeblendete Karten starten oben in der Spaltenliste – die Linien auch.
    const names = new Set(schema.tables.map(t => t.name));
    setScrollOffsets(prev => Object.keys(prev).every(n => names.has(n)) ? prev
      : Object.fromEntries(Object.entries(prev).filter(([n]) => names.has(n))));
  }, [visibleKey]);
  React.useEffect(() => {
    if (!hiddenNote || notePaused) return;
    const timer = setTimeout(() => setHiddenNote(null), 6000);
    return () => clearTimeout(timer);
  }, [hiddenNote, notePaused]);
  const undoRef = React.useRef(null);
  // Per Tastatur ausgeblendet: der Fokus landet auf „Rückgängig“ statt im Nichts.
  React.useEffect(() => {
    if (hiddenNote && hiddenNote.focus && undoRef.current) undoRef.current.focus();
  }, [hiddenNote]);
  const hideTable = (t, byKeyboard) => {
    onSetHidden([t.name], true);
    setHiddenNote({ name: t.name, label: t.localName || t.name, focus: byKeyboard });
    setNotePaused(false);
  };
  React.useEffect(() => {
    const el = ref.current;
    const observer = new ResizeObserver(() => setViewport({ width: el.clientWidth, height: el.clientHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const fitAll = () => {
    const el = ref.current;
    const fit = fitTables(schema.tables, el.clientWidth, el.clientHeight);
    setZoom(fit.zoom);
    requestAnimationFrame(() => { el.scrollLeft = fit.left; el.scrollTop = fit.top; });
  };

  const toLocal = (e) => {
    const r = ref.current.getBoundingClientRect();
    const z = zoomRef.current;
    return {
      x: (e.clientX - r.left + ref.current.scrollLeft) / z,
      y: (e.clientY - r.top + ref.current.scrollTop) / z
    };
  };

  // --- Zoom (Buttons + Strg/Ctrl + Mausrad, um den Mauspunkt herum) ---
  const zoomTo = (nz, anchor) => {
    nz = Math.min(2, Math.max(0.05, nz));
    const el = ref.current;
    const z = zoomRef.current;
    const ax = anchor ? anchor.x : el.clientWidth / 2;
    const ay = anchor ? anchor.y : el.clientHeight / 2;
    const cx = (el.scrollLeft + ax) / z;
    const cy = (el.scrollTop + ay) / z;
    setZoom(nz);
    requestAnimationFrame(() => {
      el.scrollLeft = cx * nz - ax;
      el.scrollTop = cy * nz - ay;
    });
  };

  React.useEffect(() => {
    const el = ref.current;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomTo(zoomRef.current * (e.deltaY < 0 ? 1.12 : 0.89),
             { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // --- Verschieben der Ansicht mit gedrückter rechter (oder mittlerer) Maustaste ---
  const panDown = (e) => {
    const background = e.target.closest('.canvas-inner, .canvas-zoomwrap, .canvas-scroll') && !e.target.closest('.tcard, .rel');
    if (e.button !== 2 && e.button !== 1 && !(e.button === 0 && background)) return;
    e.preventDefault();
    panRef.current = { x: e.clientX, y: e.clientY, l: ref.current.scrollLeft, t: ref.current.scrollTop };
    try { ref.current.setPointerCapture(e.pointerId); } catch (err) {}
    ref.current.classList.add('canvas-panning');
  };
  const panMove = (e) => {
    const p = panRef.current;
    if (!p) return;
    ref.current.scrollLeft = p.l - (e.clientX - p.x);
    ref.current.scrollTop = p.t - (e.clientY - p.y);
  };
  const panUp = () => {
    panRef.current = null;
    if (ref.current) ref.current.classList.remove('canvas-panning');
  };

  // --- Tabelle verschieben ---
  const startTableDrag = (e, t) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const p = toLocal(e);
    setDrag({ table: t.name, dx: p.x - t.x, dy: p.y - t.y });
  };

  React.useEffect(() => {
    if (!drag && !link && !resize) return;
    const move = (e) => {
      const p = toLocal(e);
      if (drag) {
        onMoveTable(drag.table, Math.max(8, p.x - drag.dx), Math.max(8, p.y - drag.dy));
      } else if (resize) {
        const tb = schema.tables.find(x => x.name === resize.table);
        if (tb) onResizeTable(resize.table, {
          w: Math.min(720, Math.max(MIN_TABLE_W, resize.w + p.x - resize.x)),
          h: Math.min(900, Math.max(MIN_TABLE_H, resize.h + p.y - resize.y))
        });
      } else if (link) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const dot = el && el.closest ? el.closest('[data-dot-table]') : null;
        const target = dot && dot.dataset.dotTable !== link.from.table
          ? { table: dot.dataset.dotTable, col: dot.dataset.dotCol }
          : null;
        setLink(l => ({ ...l, x: p.x, y: p.y, target }));
      }
    };
    const up = (e) => {
      if (link) {
        if (link.target) {
          const id = onAddRelation(link.from, link.target);
          if (id) { setNewRelId(id); setTimeout(() => setNewRelId(null), 900); }
        }
        setLink(null);
      }
      setDrag(null);
      setResize(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [drag, link, resize]);

  const startLink = (e, t, c, idx) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const p = toLocal(e);
    setLink({ from: { table: t.name, col: c.name, idx }, x: p.x, y: p.y, target: null });
  };

  // Rubber-Band-Pfad während des Ziehens
  let linkPath = null;
  if (link) {
    const t = schema.tables.find(x => x.name === link.from.table);
    const side = link.x >= t.x + tableWidth(t) / 2 ? 'right' : 'left';
    const a = colDotPos(t, link.from.idx, side, scrollOffsets[t.name] || 0);
    linkPath = relPath(a, { x: link.x, y: link.y }, 'curve');
  }

  const canvasW = Math.max(viewport.width / zoom, ...schema.tables.map(t => t.x + tableWidth(t) + 28));
  const canvasH = Math.max(viewport.height / zoom, ...schema.tables.map(t => t.y + tableHeight(t) + 28));

  return (
    <div className="schema-workspace">
      <div className="schema-toolbar" aria-label="Tabellen anordnen">
        <div className="layout-options" role="group" aria-label="Anordnung">
          {LAYOUTS.map(l => <button key={l.key} className={'layout-btn' + (layoutMode === l.key ? ' layout-selected' : '')}
            aria-pressed={layoutMode === l.key} onClick={() => applyLayout(l.key)}>{l.label}</button>)}
        </div>
        <button className="layout-btn fit-btn" onClick={fitAll} title="Alle sichtbaren Tabellen gemeinsam anzeigen">⛶ Alles einpassen</button>
        {tableControls && tableControls(() => applyLayout())}
      </div>
      <div className="schema-stage">
      <div className="canvas-scroll" ref={ref} data-screen-label="Schema-Canvas"
           onPointerDown={panDown} onPointerMove={panMove}
           onPointerUp={panUp} onPointerCancel={panUp}
           onContextMenu={(e) => e.preventDefault()}>
        <div className="canvas-zoomwrap" style={{ width: canvasW * zoom, height: canvasH * zoom }}>
          <div className="canvas-inner" style={{ width: canvasW, height: canvasH, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
        <svg className="rel-layer" width={canvasW} height={canvasH}>
          {/* Fremdschlüssel aus der Datei: gepunktet, nur ein Vorschlag – Klick übernimmt ihn als Verbindung */}
          {(suggestions || []).map(rel => {
            const ep = relEndpoints(rel, schema.tables, scrollOffsets);
            if (!ep) return null;
            const d = relPath(ep.a, ep.b, lineStyle);
            const mid = { x: (ep.a.x + ep.b.x) / 2, y: (ep.a.y + ep.b.y) / 2 };
            const end = e => unquoteIdent(splitIdent(e.table).pop()) + '.' + e.col;
            return (
              <g key={rel.id} className="rel rel-offer rel-fk">
                <path className="rel-hit" d={d} onClick={() => onPickSuggestion && onPickSuggestion(rel)}>
                  <title>{'In der Datei hinterlegt: ' + end(rel.from) + ' → ' + end(rel.to) + ' — Klicken übernimmt die Verbindung in die Abfrage'}</title>
                </path>
                <path className="rel-line" d={d} />
                <circle cx={ep.a.x} cy={ep.a.y} r="4" className="rel-end" />
                <circle cx={ep.b.x} cy={ep.b.y} r="4" className="rel-end" />
                <g className="rel-del" transform={`translate(${mid.x},${mid.y})`}
                   onClick={() => onDismissSuggestion && onDismissSuggestion(rel.id)}>
                  <title>Vorschlag ausblenden</title>
                  <circle r="11" />
                  <line x1="-4" y1="-4" x2="4" y2="4" />
                  <line x1="4" y1="-4" x2="-4" y2="4" />
                </g>
              </g>
            );
          })}
          {relations.map(rel => {
            const ep = relEndpoints(rel, schema.tables, scrollOffsets);
            if (!ep) return null;
            const d = relPath(ep.a, ep.b, lineStyle);
            const mid = { x: (ep.a.x + ep.b.x) / 2, y: (ep.a.y + ep.b.y) / 2 };
            const hot = runningJoin && runningJoin.includes(rel.id);
            const inQuery = (queryRelIds || []).includes(rel.id);
            return (
              <g key={rel.id} className={'rel' + (rel.id === newRelId ? ' rel-new' : '') + (hot ? ' rel-hot' : '') +
                                         (inQuery ? ' rel-query' : ' rel-offer')}>
                <path className="rel-hit" d={d}>
                  <title>Diese Verbindung steckt in der Abfrage (Schritt 2) — ✕ entfernt sie</title>
                </path>
                <path className="rel-line" d={d} />
                <path className="rel-flow" d={d} />
                <circle cx={ep.a.x} cy={ep.a.y} r="5" className="rel-end" />
                <circle cx={ep.b.x} cy={ep.b.y} r="5" className="rel-end" />
                <g className="rel-del" transform={`translate(${mid.x},${mid.y})`}
                   onClick={() => onRemoveRelation(rel.id)}>
                  <circle r="11" />
                  <line x1="-4" y1="-4" x2="4" y2="4" />
                  <line x1="4" y1="-4" x2="-4" y2="4" />
                </g>
              </g>
            );
          })}
          {linkPath && <path className="link-drag" d={linkPath} />}
        </svg>

        {layoutMode === 'database' && [...new Set(schema.tables.map(t => t.database))].map(database => {
          const group = schema.tables.filter(t => t.database === database);
          return <div key={database || 'db'} className="database-heading" style={{ left: Math.min(...group.map(t => t.x)), top: Math.min(...group.map(t => t.y)) - 34 }}>
            <span>▤ {database === 'temp' ? 'temp · eigene Ansichten' : database || 'Datenbank'}</span>
            <small>{group.length} {group.every(t => t.view) ? (group.length === 1 ? 'Ansicht' : 'Ansichten') : 'Tabellen'}</small>
          </div>;
        })}
        {schema.tables.map(t => {
          const inQuery = activeTables.includes(t.name);
          const q = colSearch[t.name]?.q || '';
          const hits = searchHits(t);
          const current = hits.length ? hits[(colSearch[t.name]?.pos || 0) % hits.length] : -1;
          return (
            <div key={t.name}
                 className={'tcard' + (t.view ? ' tcard-view' : '') + (inQuery ? ' tcard-active' : '') + (flashTable === t.name ? ' tcard-flash' : '')}
                 style={{ left: t.x, top: t.y, width: tableWidth(t), height: tableHeight(t) }}>
              <div className="tcard-head" onPointerDown={(e) => startTableDrag(e, t)}
                   title={(t.view ? 'Ansicht (VIEW): eine gespeicherte Abfrage, nutzbar wie eine Tabelle. ' : '') + 'Ziehen zum Verschieben — Doppelklick wählt die Tabelle als FROM'}>
                <span className="tcard-grip">⠿</span>
                <span className="tcard-name" title={t.name} onDoubleClick={() => onPickTable(t.name)}>
                  <span>{t.localName || t.name}</span><small>{t.database}{t.view ? ' · VIEW' : ''}</small>
                </span>
                <button className="tcard-eye" title="Daten ansehen"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onPreview(t.name); }}>▤</button>
                <span className="tcard-count" title="Daten ansehen"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); onPreview(t.name); }}>{counts[t.name] ?? '–'} Z.</span>
                {onSetHidden && (
                  <button className="tcard-hide" title="Tabelle ausblenden – über „Tabellen“ wieder einblenden"
                          aria-label={'Tabelle ausblenden: ' + (t.localName || t.name)}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); hideTable(t, e.detail === 0); }}>
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path d="M1.5 8s2.4-4.5 6.5-4.5 6.5 4.5 6.5 4.5-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" />
                      <circle cx="8" cy="8" r="2" />
                      <path d="M2.5 2.5l11 11" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="tcard-columns" ref={el => { if (el) columnLists.current[t.name] = el; }} onScroll={e => {
                const top = e.currentTarget.scrollTop;
                setScrollOffsets(prev => ({ ...prev, [t.name]: top }));
              }} aria-label={'Spalten von ' + t.name} tabIndex={0}>
              {t.columns.map((c, i) => {
                const isLinkSrc = link && link.from.table === t.name && link.from.col === c.name;
                const isLinkTarget = link && link.target && link.target.table === t.name && link.target.col === c.name;
                return (
                  <div key={c.name} className={'tcol' + (isLinkTarget ? ' tcol-target' : '') + (isLinkSrc ? ' tcol-src' : '') +
                                               (q.trim() ? (hits.includes(i) ? ' tcol-hit' : ' tcol-dim') : '') +
                                               (i === current ? ' tcol-current' : '')}>
                    <span className="tcol-dot tcol-dot-l" data-dot-table={t.name} data-dot-col={c.name}
                          onPointerDown={(e) => startLink(e, t, c, i)} />
                    <span className="tcol-name" draggable="true"
                          title="In ein Spalten-Feld rechts ziehen"
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData('text/col', JSON.stringify({ table: t.name, col: c.name }));
                            e.dataTransfer.setData('text/plain', t.name + '.' + c.name);
                          }}>{c.pk ? '🔑 ' : ''}{c.name}</span>
                    <span className={'tcol-type ' + typeIcon(c.type).cls} title={typeIcon(c.type).label}>{typeIcon(c.type).icon}</span>
                    <span className="tcol-dot tcol-dot-r" data-dot-table={t.name} data-dot-col={c.name}
                          onPointerDown={(e) => startLink(e, t, c, i)} />
                  </div>
                );
              })}
              </div>
              <div className="tcard-footer">
                <input className="tcard-search" value={q} spellCheck="false"
                       placeholder={'Spalte suchen… (' + t.columns.length + ')'}
                       aria-label={'Spalte suchen in ' + (t.localName || t.name)}
                       title="Enter: nächster Treffer · Umschalt+Enter: vorheriger · Esc: leeren"
                       onPointerDown={e => e.stopPropagation()}
                       onChange={e => searchColumns(t, e.target.value)}
                       onKeyDown={e => {
                         e.stopPropagation();
                         if (e.key === 'Enter') { e.preventDefault(); nextColumn(t, e.shiftKey ? -1 : 1); }
                         if (e.key === 'Escape') searchColumns(t, '');
                       }} />
                {q.trim() && <span className={'tcard-hits' + (hits.length ? '' : ' tcard-hits-none')}>
                  {hits.length ? ((colSearch[t.name]?.pos || 0) % hits.length + 1) + '/' + hits.length : '0'}
                </span>}
                <button className="tcard-reset" onClick={() => onResizeTable(t.name, { w: undefined, h: undefined })}
                  title="Standardgröße wiederherstellen" aria-label={'Größe zurücksetzen: ' + t.name}>↺</button>
                <button className="tcard-resize" title="Breite und Höhe ziehen · Pfeiltasten ändern die Größe · Doppelklick setzt zurück"
                  aria-label={'Größe ändern: ' + t.name}
                  onDoubleClick={() => onResizeTable(t.name, { w: undefined, h: undefined })}
                  onKeyDown={e => {
                    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
                    e.preventDefault();
                    const step = e.shiftKey ? 40 : 10;
                    onResizeTable(t.name, {
                      w: Math.max(MIN_TABLE_W, Math.min(720, tableWidth(t) + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0))),
                      h: Math.max(MIN_TABLE_H, Math.min(900, tableHeight(t) + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0)))
                    });
                  }}
                  onPointerDown={e => {
                    if (e.button !== 0) return;
                    e.preventDefault(); e.stopPropagation();
                    const p = toLocal(e);
                    setResize({ table: t.name, x: p.x, y: p.y, w: tableWidth(t), h: tableHeight(t) });
                  }}>⤡</button>
              </div>
            </div>
          );
        })}
          </div>
        </div>
      </div>

      {link && (
        <div className="link-hint">
          {link.target
            ? <span>Loslassen verbindet <b>{link.from.table}.{link.from.col}</b> ↔ <b>{link.target.table}.{link.target.col}</b></span>
            : <span>Ziehe auf eine Spalte einer anderen Tabelle…</span>}
        </div>
      )}

      <div className="hidden-note-region" role="status" aria-live="polite">
        {hiddenNote && (
          <div className="hidden-note"
               onPointerEnter={() => setNotePaused(true)} onPointerLeave={() => setNotePaused(false)}
               onFocus={() => setNotePaused(true)} onBlur={() => setNotePaused(false)}>
            <span className="hidden-note-text"><b>„{hiddenNote.label}“</b> ausgeblendet – über ▦ Tabellen wieder einblenden</span>
            <button ref={undoRef} className="hidden-note-undo"
                    onClick={() => { onSetHidden([hiddenNote.name], false); setHiddenNote(null); }}>Rückgängig</button>
          </div>
        )}
      </div>

      <div className="zoomctl" data-screen-label="Zoom">
        <button className="zoomctl-btn" title="Rauszoomen" onClick={() => zoomTo(zoom / 1.2)}>−</button>
        <button className="zoomctl-val" title="Zoom zurücksetzen" onClick={() => zoomTo(1)}>{Math.round(zoom * 100)}%</button>
        <button className="zoomctl-btn" title="Reinzoomen" onClick={() => zoomTo(zoom * 1.2)}>+</button>
        {onRelayout && (
          <button className="zoomctl-btn zoomctl-layout" title="Tabellen automatisch anordnen (ohne Überschneidungen)"
                  onClick={() => applyLayout()}>⊞</button>
        )}
      </div>
      {children}
      </div>
    </div>
  );
}

// Panel zum Ein-/Ausblenden von Tabellen (bei großen DBs)
function TablesPanel({ tables, counts, hidden, onToggle, onShowAll, onRelayout, onSetMany }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const visible = tables.length - hidden.size;
  const emptyNames = tables.filter(t => !counts[t.name]).map(t => t.name);
  const allEmptyHidden = emptyNames.length > 0 && emptyNames.every(n => hidden.has(n));
  // Wie der Excel-Filter: Suche schränkt die Liste ein, „Alle auswählen“ wirkt nur auf die Treffer
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = tables.filter(t => terms.every(w => t.name.toLowerCase().includes(w)));
  const shownOn = shown.filter(t => !hidden.has(t.name)).length;
  const allRef = React.useRef(null);
  React.useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = shownOn > 0 && shownOn < shown.length;
  });
  return (
    <div className="tpanel" data-screen-label="Tabellen-Auswahl">
      <button className={'topbtn tpanel-btn' + (open ? ' tpanel-btn-on' : '')} onClick={() => setOpen(!open)}>
        ▦ Tabellen <span className="tpanel-num">{visible}/{tables.length}</span>
      </button>
      {open && (
        <div className="tpanel-pop">
          <div className="tpanel-head">
            <span>Auf dem Canvas zeigen</span>
            <button className="ch-btn" onClick={onRelayout} title="Sichtbare Tabellen automatisch anordnen">Neu anordnen</button>
          </div>
          {emptyNames.length > 0 && (
            <label className="tpanel-item tpanel-emptytoggle">
              <input type="checkbox" checked={allEmptyHidden}
                     onChange={(e) => onSetMany(emptyNames, e.target.checked)} />
              <span className="tpanel-name">Leere Tabellen ausblenden</span>
              <span className="tpanel-count">{emptyNames.length}</span>
            </label>
          )}
          <div className="tpanel-search">
            <input className="binp" type="search" value={search} spellCheck="false" autoFocus
                   placeholder={'Tabellen suchen… (' + tables.length + ')'}
                   onChange={(e) => setSearch(e.target.value)} />
            {search && <button className="bmini" title="Suche leeren" onClick={() => setSearch('')}>✕</button>}
          </div>
          <label className="tpanel-item tpanel-all-row">
            <input ref={allRef} type="checkbox" checked={shown.length > 0 && shownOn === shown.length}
                   disabled={!shown.length}
                   onChange={() => onSetMany(shown.map(t => t.name), shownOn === shown.length)} />
            <span className="tpanel-name">{terms.length ? 'Alle Treffer auswählen' : 'Alle auswählen'}</span>
            <span className="tpanel-count">{shownOn}/{shown.length}</span>
          </label>
          <div className="tpanel-list">
            {shown.length === 0 && <div className="bhint">Keine Tabelle enthält „{search}“.</div>}
            {shown.map(t => (
              <label key={t.name} className="tpanel-item">
                <input type="checkbox" checked={!hidden.has(t.name)} onChange={() => onToggle(t.name)} />
                <span className="tpanel-name">{t.name}</span>
                {t.view && <span className="view-tag">VIEW</span>}
                <span className="tpanel-count">{counts[t.name] ?? ''}</span>
              </label>
            ))}
          </div>
          {hidden.size > 0 && (
            <button className="badd tpanel-all" onClick={onShowAll}>Alle {tables.length} anzeigen</button>
          )}
          <div className="tpanel-foot">Leere und interne Tabellen (z.B. Suchindex) werden anfangs ausgeblendet.</div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { SchemaCanvas, TablesPanel, packLayout, placeTables, TABLE_W, HEADER_H, ROW_H });
