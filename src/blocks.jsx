// SQL-Bausteine: Palette, Pipeline und Editoren

function CountUp({ value }) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    let raf, start;
    const from = 0, to = value;
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / 600);
      setN(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Sicherheitsnetz: falls rAF gedrosselt wird, Endwert hart setzen
    const tmo = setTimeout(() => setN(value), 750);
    return () => { cancelAnimationFrame(raf); clearTimeout(tmo); };
  }, [value]);
  return <span>{n}</span>;
}

/* ---------- Funktions-Unterbausteine ---------- */

// Funktions-Assistent: Funktionen verketten, Parameter, Live-Vorschau auf echten Daten
function FnPicker({ fns, col, onChange, fnPreview }) {
  const [open, setOpen] = React.useState(false);
  const active = normFns(fns);
  const [draft, setDraft] = React.useState(active);
  React.useEffect(() => { if (open) setDraft(normFns(fns)); }, [open]);

  const addStep = (k) => setDraft(d => [...d, { fn: k, arg: FN_DEFS[k].arg ? String(FN_DEFS[k].arg.def) : '' }]);
  const updStep = (i, patch) => setDraft(d => d.map((s, x) => x === i ? { ...s, ...patch } : s));
  const delStep = (i) => setDraft(d => d.filter((_, x) => x !== i));

  const last = draft.length ? FN_DEFS[draft[draft.length - 1].fn] : null;
  const preferNull = draft.some(s => s.fn === 'coalesce' || s.fn === 'ifnull');
  const samples = (open && draft.length && col && fnPreview)
    ? fnPreview(col, chainExpr(col, draft), preferNull) : [];

  const btnLabel = active.length === 0 ? 'fx' : active.map(s => FN_DEFS[s.fn].label).join(' › ');
  const btnColor = active.length ? FN_CATS[FN_DEFS[active[active.length - 1].fn].cat].color : null;

  return (
    <span className="fnwrap">
      <button type="button" className={'bsel bsel-fn' + (active.length ? ' bsel-fn-on' : '')}
              style={btnColor ? { '--bc': btnColor } : null}
              title={active.length ? active.map(s => FN_DEFS[s.fn].label).join(', dann ') + ' — klicken zum Bearbeiten'
                                   : 'Funktion(en) anwenden — öffnet den Assistenten'}
              onClick={() => setOpen(!open)}>
        {btnLabel}
      </button>
      {open && (
        <React.Fragment>
          <div className="fnpop-backdrop" onClick={() => setOpen(false)}></div>
          <div className="fnpop" data-screen-label="Funktions-Assistent">
            <div className="fnpop-head">
              <span className="fnpop-title">Funktionen</span>
              {col ? <span className="fnpop-col">{col}</span>
                   : <span className="fnpop-col fnpop-col-warn">Tipp: erst die Spalte wählen</span>}
              <button className="bmini" title="Schließen" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="fnpop-cats">
              {Object.values(FN_CATS).map(c => (
                <div className="fnpop-cat" key={c.key}>
                  <span className="fnrow-label" style={{ color: c.color }}>{c.label}</span>
                  <div className="fnpop-chips">
                    {Object.values(FN_DEFS).filter(f => f.cat === c.key).map(f => (
                      <button key={f.key} type="button"
                              className={'fnpop-chip' + (draft.some(s => s.fn === f.key) ? ' fnpop-chip-on' : '')}
                              style={{ '--bc': c.color }}
                              title={f.name + ' — ' + f.desc + ' (Klick fügt zur Kette hinzu)'}
                              onClick={() => addStep(f.key)}>{f.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {draft.length > 0 && (
              <div className="fnpop-detail">
                <div className="fnchain">
                  <span className="fnchain-col">{col || 'spalte'}</span>
                  {draft.map((s, i) => {
                    const def = FN_DEFS[s.fn];
                    return (
                      <span className="fnchain-step" key={i} style={{ '--bc': FN_CATS[def.cat].color }}>
                        <span className="fnchain-arrow">→</span>
                        <span className="fnchain-label">{def.label}</span>
                        {def.arg && (
                          <input className="binp binp-fnarg fnchain-arg" type={def.arg.type === 'number' ? 'number' : 'text'}
                                 value={s.arg} placeholder={def.arg.label} title={def.arg.label}
                                 onChange={(e) => updStep(i, { arg: e.target.value })} />
                        )}
                        <button className="fnchain-x" title="Diesen Schritt entfernen" onClick={() => delStep(i)}>✕</button>
                      </span>
                    );
                  })}
                </div>
                {last && <div className="fnpop-desc"><b>{last.name}.</b> {last.desc}</div>}
                <div className="fnpop-sql" dangerouslySetInnerHTML={{ __html: highlightSQL(chainExpr(col || 'spalte', draft)) }}></div>
                {col && samples.length > 0 && (
                  <div className="fnpop-prev">
                    <div className="fnpop-prevhead">Vorschau mit deinen Daten:</div>
                    {samples.map((s, i) => (
                      <div className="fnpop-prevrow" key={i}>
                        <span className="fnpop-in">{s[0] === null ? 'NULL' : String(s[0])}</span>
                        <span className="fnpop-arrow">→</span>
                        <span className="fnpop-out">{s[1] === null ? 'NULL' : String(s[1])}</span>
                      </div>
                    ))}
                  </div>
                )}
                {col && samples.length === 0 && <div className="bhint">Keine Beispieldaten für diese Spalte gefunden.</div>}
              </div>
            )}
            {draft.length === 0 && (
              <div className="bhint" style={{ marginTop: 8 }}>Klicke Funktionen an, um sie zu verketten — z.B. erst MS→DATUM, dann TT.MM.JJJJ.</div>
            )}
            <div className="fnpop-actions">
              {active.length > 0 && (
                <button type="button" className="ch-btn fnpop-del"
                        onClick={() => { onChange({ fns: [] }); setOpen(false); }}>Alle entfernen</button>
              )}
              <button type="button" className="ch-btn ch-btn-next"
                      onClick={() => { onChange({ fns: draft }); setOpen(false); }}>Übernehmen</button>
            </div>
          </div>
        </React.Fragment>
      )}
    </span>
  );
}

// Drag&Drop-Helfer: macht ein Element zum Drop-Ziel für Funktions-Chips
// Feld zum Umbenennen einer Ergebnis-Spalte (SQL: AS).
// Leer lassen = der Name, der ohnehin herauskäme (steht als Platzhalter drin).
function AliasInput({ value, auto, onChange }) {
  return (
    <React.Fragment>
      <span className="blbl as-kw" title="AS benennt die Spalte im Ergebnis um — der Name in der Kopfzeile der Tabelle.">AS</span>
      <input className="binp binp-alias" value={value || ''} spellCheck="false"
             placeholder={auto || 'Name…'}
             title="Wie soll die Spalte im Ergebnis heißen? Leer lassen = Originalname. Leerzeichen und Umlaute sind erlaubt."
             onChange={(e) => onChange(e.target.value)} />
    </React.Fragment>
  );
}

// Zeigt ein ORDER BY, das auf den alten Ergebnis-Namen zeigte, auf den neuen um
function renameInOrder(b, oldName, newName) {
  if (!oldName || oldName === newName) return b;
  return { ...b, orderBy: b.orderBy.map(o => (o.col === oldName ? { ...o, col: newName } : o)) };
}

function fnDropProps(apply) {
  return {
    onDragOver: (e) => {
      if ([...e.dataTransfer.types].includes('text/fn')) { e.preventDefault(); e.stopPropagation(); }
    },
    onDrop: (e) => {
      const k = e.dataTransfer.getData('text/fn');
      if (k && FN_DEFS[k]) {
        e.preventDefault(); e.stopPropagation();
        apply(k, FN_DEFS[k].arg ? String(FN_DEFS[k].arg.def) : '');
      }
    }
  };
}

/* ---------- Editoren ---------- */

// Anzeige ohne Datenbank-Präfix: „plauder.nutzer.name“ → „nutzer.name“ (der Wert bleibt vollständig)
function shortCol(c) {
  const parts = splitIdent(c || '');
  return parts.length > 2 ? parts.slice(-2).map(unquoteIdent).join('.') : String(c || '');
}

function ColSelect({ value, onChange, cols, allowStar, placeholder }) {
  // Spalten aus dem Diagramm können direkt hierher gezogen werden
  const dropProps = {
    onDragOver: (e) => {
      if ([...e.dataTransfer.types].includes('text/col')) { e.preventDefault(); e.stopPropagation(); }
    },
    onDrop: (e) => {
      const d = e.dataTransfer.getData('text/col');
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      try {
        const { table, col } = JSON.parse(d);
        const qual = table + '.' + aliasSQL(col);
        const v = cols.includes(qual) ? qual : (cols.includes(aliasSQL(col)) ? aliasSQL(col) : null);
        if (v) onChange(v);
      } catch (err) { /* ignorieren */ }
    }
  };
  return (
    <select className="bsel" value={value || ''} onChange={(e) => onChange(e.target.value)} {...dropProps}>
      <option value="" disabled>{placeholder || 'Spalte…'}</option>
      {allowStar && <option value="*">* (alle)</option>}
      {cols.map(c => <option key={c} value={c}>{shortCol(c)}</option>)}
    </select>
  );
}

// Kombi-Feld: frei tippbar UND zeigt beim Klick alle Spaltenwerte als Dropdown.
// Ganz oben steht immer die eigene (frei getippte) Eingabe.
function ComboValue({ value, onChange, options, placeholder, list }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const [hi, setHi] = React.useState(-1);
  const wrapRef = React.useRef(null);
  const inpRef = React.useRef(null);

  const opts = list || options || [];
  const q = value == null ? '' : String(value);
  const filtered = q ? opts.filter(o => String(o).toLowerCase().includes(q.toLowerCase())) : opts;
  const exact = opts.some(o => String(o) === q);

  const place = () => {
    const el = inpRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 160) });
  };
  const openPop = () => { place(); setOpen(true); setHi(-1); };
  const close = () => { setOpen(false); setHi(-1); };

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target) &&
        !(e.target.closest && e.target.closest('.combo-pop'))) close(); };
    const onScroll = (e) => { if (e.target.closest && e.target.closest('.combo-pop')) return; close(); };
    document.addEventListener('pointerdown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const pick = (v) => { onChange(v); close(); if (inpRef.current) inpRef.current.focus(); };

  const onKey = (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) openPop(); else setHi(h => Math.min(filtered.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(-1, h - 1)); }
    else if (e.key === 'Enter') { if (open && hi >= 0 && filtered[hi] != null) { e.preventDefault(); pick(String(filtered[hi])); } }
  };

  return (
    <span className="combo" ref={wrapRef}>
      <input ref={inpRef} className="binp combo-inp" value={q} placeholder={placeholder || 'Wert'}
             onChange={(e) => { onChange(e.target.value); if (!open) openPop(); else place(); }}
             onFocus={openPop} onClick={openPop} onKeyDown={onKey} autoComplete="off" />
      <button type="button" className="combo-caret" tabIndex={-1} title="Werte aus der Spalte zeigen"
              onClick={() => { if (open) { close(); } else { if (inpRef.current) inpRef.current.focus(); openPop(); } }}>▾</button>
      {open && pos && (
        <div className="combo-pop" style={{ left: pos.left, top: pos.top, width: pos.width }}>
          <div className={'combo-free' + (hi === -1 ? ' combo-hi' : '')} onMouseEnter={() => setHi(-1)}
               onClick={() => close()}>
            {q ? <span>✎ eigener Wert: <b>{q}</b></span> : <span className="combo-dim">✎ frei tippen … oder unten wählen</span>}
          </div>
          {filtered.length > 0 && <div className="combo-sep">{q ? 'passende Werte' : 'alle Werte in der Spalte'}</div>}
          <div className="combo-list">
            {filtered.map((o, x) => (
              <div key={x} className={'combo-opt' + (x === hi ? ' combo-hi' : '') + (String(o) === q && exact ? ' combo-sel' : '')}
                   onMouseEnter={() => setHi(x)} onClick={() => pick(String(o))}>{String(o)}</div>
            ))}
            {filtered.length === 0 && opts.length > 0 && <div className="combo-none">kein Wert enthält „{q}“</div>}
            {opts.length === 0 && <div className="combo-none">keine Werte gefunden</div>}
          </div>
        </div>
      )}
    </span>
  );
}

function WhereEditor({ blocks, setBlocks, cols, getDistinct, fnPreview }) {
  const upd = (i, patch) => setBlocks(b => {
    const wheres = b.wheres.map((w, x) => x === i ? { ...w, ...patch } : w);
    return { ...b, wheres };
  });
  return (
    <div className="bstack">
      {blocks.wheres.map((w, i) => w.raw !== undefined ? (
        <div className="brow" key={i}>
          {i > 0 && (
            <select className="bsel bsel-conj" value={w.conj || 'AND'}
                    onChange={(e) => upd(i, { conj: e.target.value })}>
              <option>AND</option><option>OR</option>
            </select>
          )}
          <input className="binp binp-expr" value={w.raw} spellCheck="false"
                 placeholder="Profi: beliebige Bedingung, z.B. text != '' OR LENGTH(text) > 20"
                 onChange={(e) => upd(i, { raw: e.target.value })} />
          <button className="bmini" onClick={() => setBlocks(b => ({ ...b, wheres: b.wheres.filter((_, x) => x !== i) }))}>✕</button>
        </div>
      ) : (
        <div className="brow" key={i} {...fnDropProps((k, a) => upd(i, { fns: [...normFns(w.fns), { fn: k, arg: a }] }))}>
          {i > 0 && (
            <select className="bsel bsel-conj" value={w.conj || 'AND'}
                    onChange={(e) => upd(i, { conj: e.target.value })}>
              <option>AND</option><option>OR</option>
            </select>
          )}
          <FnPicker fns={w.fns} col={w.col} fnPreview={fnPreview} onChange={(p) => upd(i, { fns: p.fns })} />
          <ColSelect value={w.col} cols={cols} onChange={(v) => upd(i, { col: v })} />
          <select className="bsel bsel-op" value={w.op} onChange={(e) => upd(i, { op: e.target.value })}>
            {OPERATORS.map(o => <option key={o.v} value={o.v} title={o.t}>{o.v}</option>)}
          </select>
          <ComboValue value={w.val} placeholder="Wert"
                      options={w.col ? getDistinct(w.col, normFns(w.fns).length ? chainExpr(w.col, w.fns) : null) : []}
                      onChange={(v) => upd(i, { val: v })} />
          <button className="bmini" onClick={() => setBlocks(b => ({ ...b, wheres: b.wheres.filter((_, x) => x !== i) }))}>✕</button>
        </div>
      ))}
      <div className="brow">
        <button className="badd" onClick={() => setBlocks(b => ({ ...b, wheres: [...b.wheres, { col: '', op: '=', val: '', conj: 'AND', fns: [] }] }))}>
          + Bedingung
        </button>
        <button className="badd" title="Freie SQL-Bedingung — hier geht alles: CASE, Unterabfragen, ||, …"
                onClick={() => setBlocks(b => ({ ...b, wheres: [...b.wheres, { raw: '', conj: 'AND' }] }))}>
          + Profi-Bedingung
        </button>
      </div>
    </div>
  );
}

function GroupEditor({ blocks, setBlocks, cols, fnPreview }) {
  const updAgg = (i, patch) => setBlocks(b => {
    const aggs = b.aggs.map((a, x) => x === i ? { ...a, ...patch } : a);
    return { ...b, aggs };
  });
  return (
    <div className="bstack">
      <div className="brow" {...fnDropProps((k, a) => setBlocks(b => ({ ...b, groupFns: [...normFns(b.groupFns), { fn: k, arg: a }] })))}>
        <span className="blbl">Gruppieren nach</span>
        <FnPicker fns={blocks.groupFns} col={blocks.groupBy[0]} fnPreview={fnPreview}
                  onChange={(p) => setBlocks(b => ({ ...b, groupFns: p.fns }))} />
        <ColSelect value={blocks.groupBy[0]} cols={cols}
                   onChange={(v) => setBlocks(b => ({ ...b, groupBy: [v] }))} />
        {blocks.groupBy[0] && (
          <AliasInput value={(blocks.groupAliases || [])[0]}
                      auto={groupColAlias(blocks, blocks.groupBy[0])}
                      onChange={(v) => setBlocks(b => {
                        const old = groupDisplayAlias(b, b.groupBy[0], 0);
                        const aliases = [...(b.groupAliases || [])];
                        aliases[0] = v;
                        const nb = { ...b, groupAliases: aliases };
                        return renameInOrder(nb, old, groupDisplayAlias(nb, nb.groupBy[0], 0));
                      })} />
        )}
      </div>
      {blocks.groupBy[0] && (normFns(blocks.groupFns).length > 0 || ((blocks.groupAliases || [])[0] || '').trim()) && (
        <div className="bhint">→ gruppiert nach <b>{groupDisplayAlias(blocks, blocks.groupBy[0], 0)}</b></div>
      )}
      {blocks.aggs.map((a, i) => (
        <div className="brow" key={i}>
          <select className="bsel" value={a.fn} onChange={(e) => updAgg(i, { fn: e.target.value })}>
            {AGG_FNS.map(f => <option key={f.v} value={f.v}>{f.t}</option>)}
          </select>
          <ColSelect value={a.col} cols={cols} allowStar={a.fn === 'COUNT'}
                     onChange={(v) => updAgg(i, { col: v })} />
          {a.col && (
            <AliasInput value={a.alias} auto={aggAlias(a.fn, a.col)}
                        onChange={(v) => setBlocks(b => {
                          const old = aggDisplayAlias(b.aggs[i]);
                          const aggs = b.aggs.map((x, y) => (y === i ? { ...x, alias: v } : x));
                          return renameInOrder({ ...b, aggs }, old, aggDisplayAlias(aggs[i]));
                        })} />
          )}
          <button className="bmini" onClick={() => setBlocks(b => ({ ...b, aggs: b.aggs.filter((_, x) => x !== i) }))}>✕</button>
        </div>
      ))}
      <button className="badd" onClick={() => setBlocks(b => ({ ...b, aggs: [...b.aggs, { fn: 'COUNT', col: '*' }] }))}>
        + Rechenfunktion
      </button>
    </div>
  );
}

function OrderEditor({ blocks, setBlocks, cols, fnPreview }) {
  const grouped = blocks.active.group;
  const extra = grouped ? blocks.aggs.filter(a => a.col).map(aggDisplayAlias) : [];
  const groupCols = grouped
    ? blocks.groupBy.map((c, i) => (c ? groupDisplayAlias(blocks, c, i) : null)).filter(Boolean)
    : [];
  const allCols = [...(grouped ? groupCols : cols), ...extra];
  const o = blocks.orderBy[0] || { col: '', dir: 'ASC', fns: [] };
  return (
    <div className="brow" {...fnDropProps((k, a) => setBlocks(b => ({ ...b, orderBy: [{ ...o, fns: [...normFns(o.fns), { fn: k, arg: a }] }] })))}>
      {!grouped && <FnPicker fns={o.fns} col={o.col} fnPreview={fnPreview}
                             onChange={(p) => setBlocks(b => ({ ...b, orderBy: [{ ...o, fns: p.fns }] }))} />}
      <ColSelect value={o.col} cols={allCols}
                 onChange={(v) => setBlocks(b => ({ ...b, orderBy: [{ ...o, col: v }] }))} />
      <div className="seg">
        {['ASC', 'DESC'].map(d => (
          <button key={d} className={'seg-btn' + (o.dir === d ? ' seg-on' : '')}
                  title={d === 'ASC' ? 'aufsteigend (A→Z, 1→9)' : 'absteigend (Z→A, 9→1)'}
                  onClick={() => setBlocks(b => ({ ...b, orderBy: [{ ...o, dir: d }] }))}>
            {d === 'ASC' ? '↑ ASC' : '↓ DESC'}
          </button>
        ))}
      </div>
    </div>
  );
}

function LimitEditor({ blocks, setBlocks }) {
  return (
    <div className="brow">
      <span className="blbl">nur die ersten</span>
      <input className="binp binp-num" type="number" min="1" value={blocks.limit || ''}
             onChange={(e) => setBlocks(b => ({ ...b, limit: Number(e.target.value) || null }))} />
      <span className="blbl">Zeilen</span>
    </div>
  );
}

// Spalten filtern und nach Tabelle bündeln (bei nur einer Tabelle bleibt eine Gruppe ohne Kopf)
function colGroups(cols, suche) {
  const t = String(suche || '').trim().toLowerCase();
  const groups = [];
  cols.forEach(c => {
    if (t && !c.toLowerCase().includes(t)) return;
    const parts = splitIdent(c);
    const tab = parts.length > 1 ? parts.slice(0, -1).join('.') : '';
    let g = groups.find(x => x.table === tab);
    if (!g) { g = { table: tab, cols: [] }; groups.push(g); }
    g.cols.push(c);
  });
  return groups;
}

// Pure Helper: Baustein in den Blocks-State aufnehmen (mit sinnvollen Startwerten)
function activateBlock(b, key) {
  const nb = { ...b, active: { ...b.active, [key]: true } };
  if (key === 'where' && b.wheres.length === 0) nb.wheres = [{ col: '', op: '=', val: '', conj: 'AND', fns: [] }];
  if (key === 'join' && b.joins.length === 0) nb.joins = [{ type: 'INNER' }];
  if (key === 'group' && b.aggs.length === 0) nb.aggs = [{ fn: 'COUNT', col: '*' }];
  if (key === 'order' && b.orderBy.length === 0) nb.orderBy = [{ col: '', dir: 'ASC', fns: [] }];
  return nb;
}

/* ---------- Zweistufiger Bau-Bereich: 1 Tabellen, 2 Ergebnis ---------- */

// Kandidaten für einen JOIN: Beziehungen von einer Tabelle der Abfrage zu einer weiteren. Ist die andere
// Tabelle schon dabei (jid als Chat UND als Absender), kommt sie ein zweites Mal unter eigener Rolle dazu.
function joinOptions(blocks, relations) {
  const sources = querySources(blocks);
  const sameJoin = (j, l, r) =>
    (j.leftTable === l.table && j.leftCol === l.col && j.rightTable === r.table && j.rightCol === r.col) ||
    (j.leftTable === r.table && j.leftCol === r.col && j.rightTable === l.table && j.rightCol === l.col);
  const options = [];
  relations.forEach(r => {
    [[r.from, r.to], [r.to, r.from]].forEach(([l, rr]) => {
      if (blocks.joins.some(j => j.relId === r.id || sameJoin(j, l, rr))) return;
      sources.filter(s => s.table === l.table).forEach(s => {
        const rightAlias = sources.some(x => x.table === rr.table) ? freeRef(sources, rr.table) : undefined;
        if (rightAlias && l.table === rr.table && l.col === rr.col) return;
        options.push({ rel: r, left: { ...l, ref: s.ref }, right: { ...rr, ref: rightAlias || rr.table }, rightAlias });
      });
    });
  });
  return options;
}

// Kurz und immer aktuell (auch nach dem Umbenennen einer Rolle): „reaktionen ⟶ Schreiber (nutzer)“
function shortRef(ref, table) { return ref === table ? localName(table) : ref + ' (' + localName(table) + ')'; }
function joinLabel(j) {
  const head = shortRef(joinLeftRef(j), j.leftTable) + ' ⟶ ' + shortRef(joinRightRef(j), j.rightTable);
  const alt = joinLeftAlt(j);
  const left = alt.length ? 'erster Wert aus ' + [j.leftCol, ...alt.map(a => a.ref + '.' + a.col)].join(', ') : j.leftCol;
  return j.type === 'CROSS' && !j.leftCol ? head + ' (ohne Bedingung)' : head + '  (' + left + ' = ' + j.rightCol + ')';
}
function joinShort(j) {
  const L = localName(joinLeftRef(j)), R = localName(joinRightRef(j));
  return { INNER: 'nur Zeilen mit Partner', LEFT: 'alle aus ' + L + ' bleiben', RIGHT: 'alle aus ' + R + ' bleiben',
           FULL: 'alle aus beiden bleiben', CROSS: 'jede Zeile mit jeder' }[joinType(j).v];
}

// Eingabe für den Rollen-Namen einer Tabelle (SQL: AS). Übernommen wird beim Verlassen oder Enter.
// Umbenennen zieht überall mit: Spalten, Filter, Sortierung und Verbindungen, die an dieser Rolle hängen.
function RoleInput({ blocks, setBlocks, table, current }) {
  const [draft, setDraft] = React.useState(current === table ? '' : current);
  const [clash, setClash] = React.useState(null);
  React.useEffect(() => { setDraft(current === table ? '' : current); }, [current, table]);
  const others = querySources(blocks).filter(s => s.ref !== current);
  // Kommt die Tabelle mehrfach vor, darf nur eine davon ohne eigenen Namen bleiben
  const needed = current !== table && others.some(s => s.table === table);
  const commit = () => {
    const wanted = cleanRef(draft) || table;
    const taken = wanted !== current && refTaken(others, wanted);
    const next = taken ? current : wanted;
    setClash(taken ? wanted : null);
    setDraft(next === table ? '' : next);
    if (next !== current) setBlocks(b => renameRef(b, current, next));
  };
  return (
    <span className="role">
      <span className="blbl">als</span>
      <input className="binp role-inp" value={draft} spellCheck="false"
             placeholder={needed ? 'Name nötig' : localName(table)}
             title="Rolle dieser Tabelle in der Abfrage (SQL: AS) — z.B. „absender“. Unter diesem Namen stehen ihre Spalten in Schritt 3. Jederzeit änderbar: alle Verweise ziehen mit."
             onChange={(e) => { setDraft(e.target.value); setClash(null); }} onBlur={commit}
             onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      {clash && <span className="bhint role-clash" role="alert">„{clash}“ ist in dieser Abfrage schon vergeben</span>}
    </span>
  );
}

function StepHead({ kw, title, count, onRemove, children }) {
  return (
    <div className="qsec-head">
      <span className="qkw" style={{ '--bc': BLOCK_DEFS[kw].color }}>{BLOCK_DEFS[kw].label}</span>
      <span className="qsec-title">{title}</span>
      {children}
      {count != null && <span className="pcount" style={{ '--bc': BLOCK_DEFS[kw].color }}><CountUp value={count} /> Zeilen</span>}
      {onRemove && <button className="bmini" title="Entfernen" onClick={onRemove}>✕</button>}
    </div>
  );
}

// Verbindung ohne Beziehung aus dem Diagramm: Tabelle wählen, dann „wo linke Spalte = rechte Spalte“
// (z.B. wa_contacts über jid = chatpartner.raw_string – über zwei Datenbanken hinweg).
// Links lassen sich Ersatz-Spalten anhängen: „sonst …“ wird zu COALESCE(links, sonst, …) = rechts.
function CustomJoin({ blocks, setBlocks, schema, j, i }) {
  const before = querySources({ ...blocks, joins: blocks.joins.slice(0, i) });
  const leftOpts = before.flatMap(s => {
    const t = schema.tables.find(x => x.name === s.table);
    return t ? t.columns.map(c => ({ key: s.ref + '|' + c.name, ref: s.ref, table: s.table, col: c.name })) : [];
  });
  const rightT = schema.tables.find(x => x.name === j.rightTable);
  const update = (patch) => setBlocks(b => {
    const nj = { ...b.joins[i], ...patch, custom: true };
    delete nj.relId; delete nj.label;
    if (patch.rightTable !== undefined) {
      const t = schema.tables.find(x => x.name === patch.rightTable);
      if (!t || !t.columns.some(c => c.name === nj.rightCol)) delete nj.rightCol;
    }
    if (nj.leftAlt && !nj.leftAlt.length) delete nj.leftAlt;
    // Ein vergebener Rollen-Name bleibt, alle Verweise darauf ziehen mit
    return replaceJoin(b, i, nj);
  });
  const leftKey = j.leftTable && j.leftCol ? joinLeftRef(j) + '|' + j.leftCol : '';
  const alts = j.leftAlt || [];
  const setAlt = (k, key) => { const o = leftOpts.find(x => x.key === key);
    update({ leftAlt: alts.map((a, y) => y === k ? { ref: o.ref, table: o.table, col: o.col } : a) }); };
  const leftOptions = leftOpts.map(o => <option key={o.key} value={o.key}>{shortRef(o.ref, o.table)}.{o.col}</option>);
  return (
    <React.Fragment>
      <div className="brow jrow-custom">
        <span className="blbl jlbl">Tabelle</span>
        <select className="bsel jrel" value={j.rightTable || ''} onChange={(e) => update({ rightTable: e.target.value })}>
          <option value="" disabled>wählen…</option>
          {schema.tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
      </div>
      {j.type !== 'CROSS' && (
        <div className="brow jrow-custom">
          <span className="blbl jlbl">wo</span>
          <select className="bsel jcol" value={leftKey}
                  onChange={(e) => { const o = leftOpts.find(x => x.key === e.target.value); update({ leftTable: o.table, leftRef: o.ref, leftCol: o.col }); }}>
            <option value="" disabled>Spalte…</option>
            {leftOptions}
          </select>
          <span className="blbl">=</span>
          <select className="bsel jcol" value={j.rightCol || ''} disabled={!rightT}
                  onChange={(e) => update({ rightCol: e.target.value })}>
            <option value="" disabled>{rightT ? 'Spalte…' : 'erst Tabelle wählen'}</option>
            {rightT && rightT.columns.map(c => <option key={c.name} value={c.name}>{shortRef(joinRightRef(j), j.rightTable)}.{c.name}</option>)}
          </select>
        </div>
      )}
      {j.type !== 'CROSS' && alts.map((a, k) => (
        <div className="brow jrow-custom" key={k}>
          <span className="blbl jlbl" title="Ist die Spalte darüber leer (NULL), zählt diese — SQL: COALESCE(…)">sonst</span>
          <select className="bsel jcol" value={a.ref && a.col ? a.ref + '|' + a.col : ''} onChange={(e) => setAlt(k, e.target.value)}>
            <option value="" disabled>Spalte…</option>
            {leftOptions}
          </select>
          <button className="bmini" title="Ersatz-Spalte entfernen"
                  onClick={() => update({ leftAlt: alts.filter((_, y) => y !== k) })}>✕</button>
        </div>
      ))}
      {j.type !== 'CROSS' && j.leftCol && (
        <div className="brow jrow-custom">
          <button className="badd" onClick={() => update({ leftAlt: [...alts, {}] })}
                  title="Ist die linke Spalte leer (NULL), wird stattdessen eine andere verglichen — SQL: COALESCE(a, b) = …">
            + sonst andere Spalte (COALESCE)
          </button>
          {alts.length > 0 && <span className="bhint">links zählt der erste Wert, der nicht leer ist</span>}
        </div>
      )}
    </React.Fragment>
  );
}

// Führt durch den aktuellen Schritt: was jetzt zu tun ist, und wie es weitergeht
function StepGuide({ n, children }) {
  return (
    <div className="qguide" role="note">
      <span className="qguide-n">Schritt {n} von 3</span>
      <span className="qguide-t">{children}</span>
    </div>
  );
}

// Schritt 1: Start-Tabelle – durchsuchbare Liste statt langem Auswahlfeld
function StartStep({ blocks, setBlocks, schema, counts, stageCounts, onNext }) {
  const [search, setSearch] = React.useState('');
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = schema.tables.filter(t => terms.every(w => t.name.toLowerCase().includes(w)));
  const choose = (name) => {
    if (name !== blocks.table) setBlocks(() => ({ ...emptyBlocks(), table: name }));
    onNext();
  };
  return (
    <div className="qstep">
      <StepGuide n={1}>
        Mit welcher Tabelle beginnt deine Abfrage? Wähle die Tabelle, um die sich alles dreht — z.B. die Nachrichten.
        Geht auch per Doppelklick auf den Namen einer Karte im Diagramm.
      </StepGuide>
      <div className="qsec">
        <StepHead kw="from" title="Start-Tabelle" count={stageCounts.from} />
        {blocks.table && (
          <div className="brow qchosen">
            <span className="qchosen-name">✓ {blocks.table}</span>
            <RoleInput blocks={blocks} setBlocks={setBlocks} table={blocks.table} current={blocks.tableAlias || blocks.table} />
          </div>
        )}
        <div className="collist-head">
          <input className="binp collist-search" value={search} spellCheck="false"
                 placeholder={'Tabelle suchen… (' + schema.tables.length + ')'}
                 onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="bmini" title="Suche leeren" onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className="collist qstart-list">
          {list.map(t => (
            <button key={t.name} className={'colrow colpick' + (t.name === blocks.table ? ' colrow-on' : '')}
                    onClick={() => choose(t.name)} title="Als Start-Tabelle wählen">
              <span className="colrow-name">{t.name}</span>
              <span className="qstart-count">{counts[t.name] == null ? '' : counts[t.name] + ' Z.'}</span>
            </button>
          ))}
          {list.length === 0 && <div className="bhint">Keine Tabelle enthält „{search}“.</div>}
        </div>
        <div className="bhint">Hier stehen die eingeblendeten Tabellen — weitere holst du über ▦ Tabellen über dem Diagramm.</div>
      </div>
      {blocks.table && <button className="qnext" onClick={onNext}>Weiter: Tabellen verbinden →</button>}
    </div>
  );
}

// Live-Vorschau einer Verbindung: Zeilen je Join-Art, Änderung gegenüber vorher, Beispielzeilen
// (Zeilen ohne Partner zuerst – genau die entscheiden sich zwischen INNER, LEFT, RIGHT und FULL)
// Was mit Zeilen ohne Partner passiert – bei INNER: wie viele wegfallen (aus LEFT/RIGHT abgeleitet)
function partnerNote(type, stats, L, R) {
  const z = n => n + ' Zeile' + (n === 1 ? '' : 'n');
  const by = t => stats.find(s => s.t === t) || {};
  const lostLeft = by('LEFT').noRight || 0, lostRight = by('RIGHT').noLeft || 0;
  if (type === 'INNER') {
    if (!lostLeft && !lostRight) return 'Jede Zeile hat einen Partner — hier ändert eine andere Join-Art nichts.';
    return 'INNER lässt weg: ' + [lostLeft ? z(lostLeft) + ' aus ' + L : '', lostRight ? z(lostRight) + ' aus ' + R : '']
      .filter(Boolean).join(' und ') + ' — ihnen fehlt der Partner.';
  }
  const cur = by(type);
  const parts = [cur.noRight ? z(cur.noRight) + ' aus ' + L + ' ohne Partner in ' + R : '',
                 cur.noLeft ? z(cur.noLeft) + ' aus ' + R + ' ohne Partner in ' + L : ''].filter(Boolean);
  return parts.length ? parts.join(', ') + ' — dort steht NULL (gelb markiert).' : 'Jede Zeile hat einen Partner.';
}

function JoinPreview({ blocks, i, schema, runPreview, before, onType }) {
  const j = blocks.joins[i];
  const type = j.type || 'INNER';
  const stats = JOIN_TYPES.map(t => {
    const q = joinPreviewSQL(blocks, i, t.v, schema);
    const r = q && runPreview(q.countSQL);
    const v = r && r.rows && r.rows[0];
    return { t: t.v, desc: t.desc, n: v ? v[0] : null, noRight: v ? v[1] : 0, noLeft: v ? v[2] : 0 };
  });
  const cur = stats.find(s => s.t === type), prev = before && stats.find(s => s.t === before);
  const q = joinPreviewSQL(blocks, i, type, schema);
  const sample = q && runPreview(q.sampleSQL);
  const L = localName(joinLeftRef(j)), R = localName(joinRightRef(j));
  const diff = prev && cur && prev.n != null && cur.n != null ? cur.n - prev.n : null;
  const lk = q ? q.cols.findIndex(c => c.key === 'left') : -1, rk = q ? q.cols.findIndex(c => c.key === 'right') : -1;
  return (
    <div className="jprev" aria-live="polite">
      <div className="jprev-types">
        {stats.map(s => (
          <button key={s.t} className={'jprev-type' + (s.t === type ? ' on' : '')} title={s.desc} onClick={() => onType(s.t)}>
            <b>{s.t}</b><span>{s.n == null ? '–' : s.n + ' Z.'}</span>
          </button>
        ))}
      </div>
      {prev && diff !== null && (
        <div className={'jprev-delta' + (diff > 0 ? ' up' : diff < 0 ? ' down' : '')}>
          {before} → {type}: {prev.n} → {cur.n} Zeilen
          {diff === 0 ? ' — gleich viele (hier hat jede Zeile einen Partner)' : diff > 0 ? ' (+' + diff + ')' : ' (' + diff + ')'}
        </div>
      )}
      {cur && cur.n != null && type !== 'CROSS' && (
        <div className="bhint">{partnerNote(type, stats, L, R)}</div>
      )}
      {sample && sample.error && <div className="res-error">{sample.error}</div>}
      {sample && sample.columns && (
        <div className="jprev-wrap">
          <table className="jprev-table">
            <thead><tr>{q.cols.map((c, k) => <th key={k} className={'jprev-' + c.side}>{c.label}</th>)}</tr></thead>
            <tbody>
              {sample.rows.map((row, x) => {
                const miss = rk >= 0 && row[rk] === null ? 'jprev-noright' : lk >= 0 && row[lk] === null ? 'jprev-noleft' : '';
                return (
                  <tr key={x} className={miss} title={miss === 'jprev-noright' ? 'ohne Partner in ' + R : miss ? 'ohne Partner in ' + L : ''}>
                    {row.map((v, k) => <td key={k} className={v === null ? 'jprev-null' : ''}>{v === null ? 'NULL' : String(v)}</td>)}
                  </tr>
                );
              })}
              {sample.rows.length === 0 && <tr><td colSpan={q.cols.length}>keine Zeilen</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <div className="bhint jprev-foot">Stand nach diesem JOIN, noch ohne Filter. Ein Klick auf eine Join-Art probiert sie aus.</div>
    </div>
  );
}

// Schritt 2: weitere Tabellen verbinden
function JoinsStep({ blocks, setBlocks, schema, relations, runPreview, counts, stageCounts, onNext }) {
  const options = joinOptions(blocks, relations);
  // Zeilen-Verlauf: wie viele Zeilen bleiben nach jeder Verbindung? Zeigt sofort, wo ein INNER JOIN
  // Zeilen ohne Partner wegwirft (z.B. Gruppen ohne Adressbuch-Eintrag) – und was LEFT stattdessen ergäbe.
  const rowsAfter = (i, type) => {
    const q = runPreview && joinPreviewSQL(blocks, i, type, schema);
    const r = q && runPreview(q.countSQL);
    return r && r.rows ? r.rows[0][0] : null;
  };
  const flow = blocks.joins.map((j, i) => (joinComplete(j) ? rowsAfter(i, j.type || 'INNER') : null));
  const startRows = counts && counts[blocks.table] != null ? counts[blocks.table] : null;
  const rowsBefore = (i) => { for (let k = i - 1; k >= 0; k--) if (flow[k] != null) return flow[k]; return startRows; };
  const lastRows = [...flow].reverse().find(n => n != null);
  // Verbindungen, bei denen INNER/RIGHT Zeilen ohne Partner wegwirft (1-basiert, für den Hinweis)
  const lossy = blocks.joins.map((j, i) => (flow[i] != null && rowsBefore(i) != null && flow[i] < rowsBefore(i) &&
    ['INNER', 'RIGHT'].includes(j.type || 'INNER') ? i + 1 : null)).filter(Boolean);
  const listNr = ns => ns.length === 1 ? String(ns[0]) : ns.slice(0, -1).join(', ') + ' und ' + ns[ns.length - 1];
  // Offene Vorschauen je Verbindung: { [i]: { before: Join-Art vor der letzten Änderung } }
  const [peek, setPeek] = React.useState({});
  const setType = (i, type) => {
    const old = blocks.joins[i].type || 'INNER';
    if (type === old) return;
    setPeek(p => ({ ...p, [i]: { before: old } }));
    setBlocks(b => ({ ...b, joins: b.joins.map((x, y) => y === i ? { ...x, type } : x) }));
  };
  const togglePeek = (i) => setPeek(p => { const n = { ...p }; if (n[i]) delete n[i]; else n[i] = { before: null }; return n; });
  // Eine andere Beziehung wählen: ein vergebener Rollen-Name bleibt, alle Verweise darauf ziehen mit
  const setJoin = (i, o) => setBlocks(b => replaceJoin(b, i, {
    ...(b.joins[i] && b.joins[i].type ? { type: b.joins[i].type } : {}),
    relId: o.rel.id,
    leftTable: o.left.table, leftCol: o.left.col,
    rightTable: o.right.table, rightCol: o.right.col,
    leftRef: o.left.ref,
    label: `${refLabel(o.left.ref, o.left.table)} ⟶ ${refLabel(o.right.ref, o.right.table)}  (${o.left.col} = ${o.right.col})`
  }));
  const removeJoin = (i) => {
    setPeek({});
    setBlocks(b => {
      const joins = b.joins.filter((_, x) => x !== i);
      return { ...b, joins, active: { ...b.active, join: joins.length > 0 } };
    });
  };
  // Ohne passende Beziehung im Diagramm startet die neue Verbindung gleich mit „selbst wählen“
  const addJoin = () => setBlocks(b => ({ ...b, active: { ...b.active, join: true },
    joins: [...b.joins, { type: 'INNER', ...(options.length ? {} : { custom: true }) }] }));
  const pickJoin = (i, value) => value === '__custom'
    ? setBlocks(b => ({ ...b, joins: b.joins.map((x, y) => y === i ? { ...x, custom: true } : x) }))
    : setJoin(i, options[Number(value)]);
  const joined = blocks.active.join ? blocks.joins.filter(joinComplete).length : 0;

  return (
    <div className="qstep">
      <StepGuide n={2}>
        {joined === 0
          ? <React.Fragment>Brauchst du Infos aus weiteren Tabellen (z.B. Namen zu Nummern)? Ziehe im Diagramm eine <b>Linie</b> vom
              Punkt einer Spalte zu einer passenden Spalte einer anderen Tabelle — daraus wird sofort die Verbindung. Oder unten
              „+ Tabelle verbinden“. Reicht die Start-Tabelle, geht es direkt weiter.</React.Fragment>
          : lastRows === 0 && lossy.length
          ? <React.Fragment><b>⚠ Nach den Verbindungen bleiben 0 Zeilen.</b> Bei Verbindung {listNr(lossy)} wirft INNER die Zeilen weg,
              denen der Partner fehlt (z.B. Gruppen ohne Adressbuch-Eintrag oder Einzelchats ohne Absender). Stell diese
              Verbindungen auf <b>LEFT</b> — der Knopf steht jeweils direkt darunter.</React.Fragment>
          : <React.Fragment>{joined} {joined === 1 ? 'Tabelle' : 'Tabellen'} verbunden. Weitere Linien ziehen oder unten ergänzen —
              <b> LEFT</b> behält auch Zeilen ohne Partner (z.B. Nachrichten ohne Kontakt-Eintrag). Dann weiter zu den Spalten.</React.Fragment>}
      </StepGuide>
      <div className="qsec">
        <StepHead kw="join" title="Verbundene Tabellen" count={blocks.joins.length ? stageCounts.join : null} />
        <div className="brow qchosen">
          <span className="qchosen-name">Start: {shortRef(blocks.tableAlias || blocks.table, blocks.table)}</span>
        </div>
        {blocks.joins.map((j, i) => (
          <div className="jrow" key={i}>
            <div className="brow">
              <select className="bsel jtype" value={j.type || 'INNER'} title={joinExplain(j)}
                      onChange={(e) => setType(i, e.target.value)}>
                {JOIN_TYPES.map(t => <option key={t.v} value={t.v}>{t.v}</option>)}
              </select>
              {j.custom ? (
                <span className="jcustom-title">Tabelle und Spalten selbst gewählt</span>
              ) : (
                <select className="bsel jrel" value={j.rightTable ? '__set' : ''}
                        onChange={(e) => pickJoin(i, e.target.value)}>
                  {j.rightTable ? <option value="__set">{joinLabel(j)}</option>
                           : <option value="" disabled>Beziehung wählen…</option>}
                  {options.map((o, oi) => (
                    <option key={oi} value={oi}>
                      {shortRef(o.left.ref, o.left.table)} ⟶ {localName(o.right.table)}{o.rightAlias ? ' noch einmal' : ''}  ({o.left.col} = {o.right.col})
                    </option>
                  ))}
                  <option value="__custom">✎ Tabelle und Spalten selbst wählen…</option>
                </select>
              )}
              <button className="bmini" title="Verbindung entfernen" onClick={() => removeJoin(i)}>✕</button>
            </div>
            {j.custom && <CustomJoin blocks={blocks} setBlocks={setBlocks} schema={schema} j={j} i={i} />}
            {j.rightTable && (
              <div className="brow jrow-sub">
                <RoleInput blocks={blocks} setBlocks={setBlocks} table={j.rightTable} current={joinRightRef(j)} />
                <span className="bhint jrow-hint" title={joinExplain(j)}>{joinShort(j)}</span>
                {runPreview && joinComplete(j) && (
                  <button className={'jprev-toggle' + (peek[i] ? ' on' : '')} onClick={() => togglePeek(i)}
                          title="Zeigt, wie viele Zeilen jede Join-Art ergibt und welche Zeilen keinen Partner haben">
                    {peek[i] ? '▾' : '▸'} Vorschau
                  </button>
                )}
              </div>
            )}
            {flow[i] != null && rowsBefore(i) != null && (() => {
              const before = rowsBefore(i), n = flow[i], type = j.type || 'INNER';
              const lost = type === 'INNER' || type === 'RIGHT' ? before - n : 0;
              const left = lost > 0 ? rowsAfter(i, 'LEFT') : null;
              return (
                <div className={'jflow' + (n === 0 && before > 0 ? ' jflow-zero' : lost > 0 ? ' jflow-drop' : '')}>
                  <span>{before} → <b>{n} {n === 1 ? 'Zeile' : 'Zeilen'}</b>
                    {lost > 0 ? ' — ' + lost + ' ohne Partner fallen weg' : n > before ? ' — mehrere Partner je Zeile' : ''}</span>
                  {lost > 0 && left != null && (
                    <button className="jflow-fix" onClick={() => setType(i, 'LEFT')}
                            title="LEFT behält auch die Zeilen ohne Partner – dort stehen dann NULL-Werte">
                      Auf LEFT umstellen ({left} Zeilen)
                    </button>
                  )}
                </div>
              );
            })()}
            {peek[i] && joinComplete(j) && runPreview && (
              <JoinPreview blocks={blocks} i={i} schema={schema} runPreview={runPreview}
                           before={peek[i].before} onType={(type) => setType(i, type)} />
            )}
          </div>
        ))}
        <button className="badd" onClick={addJoin}>+ Tabelle verbinden</button>
      </div>
      <button className="qnext" onClick={onNext}>{joined ? 'Weiter: Spalten auswählen →' : 'Ohne Verbindung weiter: Spalten auswählen →'}</button>
    </div>
  );
}


/* ---------- Operanden: Spalte, fester Wert oder „erster vorhandener Wert“ ---------- */

function OperandInput({ value, onChange, cols, allowFirst }) {
  const mode = !value ? 'col' : value.first ? 'first' : value.col !== undefined ? 'col' : 'val';
  const setMode = (m) => onChange(m === 'col' ? { col: '' } : m === 'val' ? { val: '' } : { first: [{ col: '' }, { col: '' }] });
  return (
    <span className={'opnd' + (mode === 'first' ? ' opnd-first' : '')}>
      <select className="bsel opnd-mode" value={mode} onChange={(e) => setMode(e.target.value)}
              title="Spalte, fester Text/Zahl oder der erste vorhandene Wert aus mehreren">
        <option value="col">Spalte</option>
        <option value="val">Text/Zahl</option>
        {allowFirst && <option value="first">erster Wert aus…</option>}
      </select>
      {mode === 'col' && <ColSelect value={value && value.col} cols={cols} onChange={(v) => onChange({ col: v })} />}
      {mode === 'val' && <input className="binp" value={value.val} placeholder="z.B. ICH"
                                onChange={(e) => onChange({ val: e.target.value })} />}
      {mode === 'first' && <FirstList items={value.first} cols={cols} onChange={(first) => onChange({ first })} />}
    </span>
  );
}

function FirstList({ items, cols, onChange }) {
  const set = (i, v) => onChange(items.map((x, y) => y === i ? v : x));
  const move = (i, d) => { const n = [...items]; [n[i], n[i + d]] = [n[i + d], n[i]]; onChange(n); };
  return (
    <div className="firstlist">
      {items.map((o, i) => (
        <div className="brow" key={i}>
          <span className="first-n">{i + 1}.</span>
          <OperandInput value={o} cols={cols} onChange={(v) => set(i, v)} />
          <button className="bmini" title="nach oben" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
          <button className="bmini" title="entfernen" onClick={() => onChange(items.filter((_, y) => y !== i))}>✕</button>
        </div>
      ))}
      <button className="badd" onClick={() => onChange([...items, { col: '' }])}>+ weiterer Wert</button>
    </div>
  );
}

function CaseEditor({ item, onChange, cols, getDistinct }) {
  const setCase = (i, patch) => onChange({ ...item, cases: item.cases.map((c, y) => y === i ? { ...c, ...patch } : c) });
  return (
    <div className="bstack">
      {item.cases.map((c, i) => (
        <div className="case-row" key={i}>
          <div className="brow">
            <span className="case-kw">{i === 0 ? 'wenn' : 'sonst wenn'}</span>
            <ColSelect value={c.cond.col} cols={cols} onChange={(v) => setCase(i, { cond: { ...c.cond, col: v } })} />
            <select className="bsel bsel-op" value={c.cond.op}
                    onChange={(e) => setCase(i, { cond: { ...c.cond, op: e.target.value } })}>
              {CASE_OPERATORS.map(o => <option key={o.v} value={o.v} title={o.t}>{/NULL$/.test(o.v) ? o.t : o.v}</option>)}
            </select>
            {!/NULL$/.test(c.cond.op) && (
              <ComboValue value={c.cond.val} placeholder="Wert"
                          options={c.cond.col ? getDistinct(c.cond.col, normFns(c.cond.fns).length ? chainExpr(c.cond.col, c.cond.fns) : null) : []}
                          onChange={(v) => setCase(i, { cond: { ...c.cond, val: v } })} />
            )}
            {item.cases.length > 1 && (
              <button className="bmini" title="Fall entfernen"
                      onClick={() => onChange({ ...item, cases: item.cases.filter((_, y) => y !== i) })}>✕</button>
            )}
          </div>
          <div className="brow case-then">
            <span className="case-kw">dann</span>
            <OperandInput value={c.then} cols={cols} allowFirst onChange={(v) => setCase(i, { then: v })} />
          </div>
        </div>
      ))}
      <button className="badd" onClick={() => onChange({ ...item, cases: [...item.cases, { cond: { col: '', op: '=', val: '' }, then: { val: '' } }] })}>
        + weiterer Fall
      </button>
      <div className="brow case-then">
        <span className="case-kw">sonst</span>
        {item.else ? (
          <React.Fragment>
            <OperandInput value={item.else} cols={cols} allowFirst onChange={(v) => onChange({ ...item, else: v })} />
            <button className="bmini" title="kein Sonst-Wert (NULL)" onClick={() => onChange({ ...item, else: null })}>✕</button>
          </React.Fragment>
        ) : (
          <button className="badd" onClick={() => onChange({ ...item, else: { col: '' } })}>+ Sonst-Wert (sonst leer)</button>
        )}
      </div>
    </div>
  );
}

/* ---------- Schritt 2: Ergebnis-Spalten + weitere Schritte ---------- */

function ColumnPicker({ cols, items, onAdd, onClose }) {
  const [suche, setSuche] = React.useState('');
  const groups = colGroups(cols, suche);
  return (
    <div className="qpicker">
      <div className="collist-head">
        <input className="binp collist-search" value={suche} spellCheck="false" autoFocus
               placeholder={'Spalte suchen… (' + cols.length + ')'} onChange={(e) => setSuche(e.target.value)} />
        <button className="bmini" title="Schließen" onClick={onClose}>✕</button>
      </div>
      <div className="collist">
        {groups.map(g => (
          <React.Fragment key={g.table || '_'}>
            {g.table && <div className="collist-group">{localName(g.table)}</div>}
            {g.cols.map(c => {
              const on = items.some(it => it.col === c);
              return (
                <button key={c} className={'colrow colpick' + (on ? ' colrow-on' : '')} onClick={() => onAdd(c)}
                        title={on ? 'Schon im Ergebnis — Klick fügt sie noch einmal hinzu' : 'Ins Ergebnis übernehmen'}>
                  <span className="colpick-plus">{on ? '✓' : '+'}</span>
                  <span className="colrow-name">{g.table ? c.slice(g.table.length + 1) : c}</span>
                </button>
              );
            })}
          </React.Fragment>
        ))}
        {cols.length > 0 && groups.length === 0 && <div className="bhint">Keine Spalte passt zu „{suche}“.</div>}
      </div>
    </div>
  );
}

function ResultItem({ it, idx, count, cols, setItem, remove, move, fnPreview, getDistinct, dnd, dropMark, dragging }) {
  const kindLabel = it.kind === 'case' ? 'Wenn–dann' : it.kind === 'first' ? 'Erster Wert'
    : it.kind === 'value' ? 'Fester Wert' : it.expr !== undefined ? 'Formel' : null;
  return (
    <div className={'ritem' + (kindLabel ? ' ritem-calc' : '') + (dropMark ? ' ritem-drop-' + dropMark : '') + (dragging ? ' ritem-dragging' : '')}
         onDragOver={dnd.over} onDrop={dnd.drop}>
      <div className="brow ritem-head">
        <span className="ritem-grip" draggable="true" onDragStart={dnd.start} onDragEnd={dnd.end}
              title="Ziehen, um die Spalte an eine andere Stelle zu verschieben">⠿</span>
        <span className="ritem-n">{idx + 1}</span>
        {kindLabel ? <span className="ritem-kind">{kindLabel}</span> : <span className="blbl selcol" title={it.col}>{shortCol(it.col)}</span>}
        {it.kind === 'value' && <input className="binp ritem-value" value={it.val} placeholder="leer = NULL, z.B. WhatsApp"
                                       title="Steht in jeder Zeile gleich — z.B. die Quelle, wenn du später mehrere Messenger zusammenführst"
                                       onChange={(e) => setItem({ val: e.target.value })} />}
        {!kindLabel && <FnPicker fns={it.fns} col={it.col} fnPreview={fnPreview} onChange={(p) => setItem({ fns: p.fns })} />}
        <AliasInput value={it.alias} auto={autoSelectAlias(it)} onChange={(v) => setItem({ alias: v })} />
        <span className="ritem-ctl">
          <button className="bmini" title="nach oben" disabled={idx === 0} onClick={() => move(-1)}>▲</button>
          <button className="bmini" title="nach unten" disabled={idx === count - 1} onClick={() => move(1)}>▼</button>
          <button className="bmini" title="aus dem Ergebnis entfernen" onClick={remove}>✕</button>
        </span>
      </div>
      {it.kind === 'case' && <CaseEditor item={it} cols={cols} getDistinct={getDistinct} onChange={(n) => setItem(n)} />}
      {it.kind === 'first' && (
        <div className="bstack">
          <div className="bhint">Nimmt den ersten Wert, der nicht leer (NULL) ist — z.B. erst Adressbuch-Name, dann WhatsApp-Name, sonst die Nummer.</div>
          <FirstList items={it.items} cols={cols} onChange={(items) => setItem({ items })} />
        </div>
      )}
      {it.expr !== undefined && !it.kind && (
        <textarea className="binp binp-expr qformula" value={it.expr} spellCheck="false" rows={3}
                  placeholder="Freier SQL-Ausdruck, z.B. vorname || ' ' || nachname"
                  onChange={(e) => setItem({ expr: e.target.value })} />
      )}
    </div>
  );
}

const MORE_STEPS = [
  { key: 'where', title: 'Filtern' },
  { key: 'group', title: 'Gruppieren' },
  { key: 'order', title: 'Sortieren' },
  { key: 'limit', title: 'Begrenzen' }
];

function ResultStep({ blocks, setBlocks, cols, stageCounts, getDistinct, fnPreview }) {
  const [picking, setPicking] = React.useState(false);
  const items = blocks.selectCols;
  const addItem = (it) => setBlocks(b => ({ ...b, active: { ...b.active, select: true }, selectCols: [...b.selectCols, it] }));
  const setItem = (idx, patch) => setBlocks(b => {
    const old = resultAliases({ ...b, aggs: [], groupBy: [], selectCols: [b.selectCols[idx]] })[0];
    const selectCols = b.selectCols.map((x, y) => y === idx ? { ...x, ...patch } : x);
    const now = resultAliases({ ...b, aggs: [], groupBy: [], selectCols: [selectCols[idx]] })[0];
    return renameInOrder({ ...b, selectCols }, old, now);
  });
  const move = (idx, d) => setBlocks(b => {
    const n = [...b.selectCols]; [n[idx], n[idx + d]] = [n[idx + d], n[idx]];
    return { ...b, selectCols: n };
  });
  // Drag & Drop am Griff ⠿: to = Einfügestelle (0 … Anzahl), die Linie zeigt, wo die Spalte landet
  const [drag, setDrag] = React.useState(null); // { from, to }
  const moveTo = (from, to) => setBlocks(b => {
    const n = [...b.selectCols];
    const [it] = n.splice(from, 1);
    n.splice(to > from ? to - 1 : to, 0, it);
    return { ...b, selectCols: n };
  });
  const isItemDrag = (e) => [...e.dataTransfer.types].includes('text/ritem');
  const dndFor = (idx) => ({
    start: (e) => {
      e.dataTransfer.setData('text/ritem', String(idx));
      e.dataTransfer.effectAllowed = 'move';
      const card = e.currentTarget.closest('.ritem');
      if (card) e.dataTransfer.setDragImage(card, 16, 16);
      setDrag({ from: idx, to: null });
    },
    over: (e) => {
      if (!isItemDrag(e)) return;
      e.preventDefault(); e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      const r = e.currentTarget.getBoundingClientRect();
      const to = idx + (e.clientY > r.top + r.height / 2 ? 1 : 0);
      setDrag(d => (d && d.to !== to ? { ...d, to } : d));
    },
    drop: (e) => {
      if (!isItemDrag(e)) return;
      e.preventDefault(); e.stopPropagation();
      const from = drag ? drag.from : Number(e.dataTransfer.getData('text/ritem'));
      const to = drag && drag.to != null ? drag.to : idx;
      if (to !== from && to !== from + 1) moveTo(from, to);
      setDrag(null);
    },
    end: () => setDrag(null)
  });
  // Markierung nur, wenn sich die Reihenfolge wirklich ändert
  const dropMark = (idx) => {
    if (!drag || drag.to == null || drag.to === drag.from || drag.to === drag.from + 1) return null;
    if (drag.to === idx) return 'before';
    return drag.to === items.length && idx === items.length - 1 ? 'after' : null;
  };
  const removeStep = (key) => setBlocks(b => {
    const nb = { ...b, active: { ...b.active, [key]: false } };
    if (key === 'where') nb.wheres = [];
    if (key === 'group') { nb.groupBy = []; nb.aggs = []; nb.groupFns = []; nb.groupAliases = []; }
    if (key === 'order') nb.orderBy = [];
    return nb;
  });
  const editors = {
    where: <WhereEditor blocks={blocks} setBlocks={setBlocks} cols={cols} getDistinct={getDistinct} fnPreview={fnPreview} />,
    group: <GroupEditor blocks={blocks} setBlocks={setBlocks} cols={cols} fnPreview={fnPreview} />,
    order: <OrderEditor blocks={blocks} setBlocks={setBlocks} cols={cols} fnPreview={fnPreview} />,
    limit: <LimitEditor blocks={blocks} setBlocks={setBlocks} />
  };
  const colDrop = {
    onDragOver: (e) => { if ([...e.dataTransfer.types].includes('text/col')) { e.preventDefault(); e.stopPropagation(); } },
    onDrop: (e) => {
      const d = e.dataTransfer.getData('text/col');
      if (!d || blocks.active.group) return;
      e.preventDefault(); e.stopPropagation();
      try {
        const { table, col } = JSON.parse(d);
        const ref = querySources(blocks).find(s => s.table === table);
        const qual = (ref ? ref.ref : table) + '.' + aliasSQL(col);
        const v = cols.includes(qual) ? qual : (cols.includes(aliasSQL(col)) ? aliasSQL(col) : null);
        if (v) addItem({ col: v, fns: [] });
      } catch (err) { /* ignorieren */ }
    }
  };

  return (
    <div className="qstep">
      <div className="qsec" {...colDrop}>
        <StepHead kw="select" title="Ergebnis-Spalten" count={stageCounts.select}>
          {!blocks.active.group && (
            <label className="distinct-row qdistinct" title="SELECT DISTINCT: jede Ergebnis-Zeile erscheint nur einmal — Duplikate werden ausgeblendet.">
              <input type="checkbox" checked={!!blocks.distinct}
                     onChange={(e) => setBlocks(b => ({ ...b, distinct: e.target.checked }))} />
              <span className="distinct-kw">DISTINCT</span>
            </label>
          )}
        </StepHead>
        {blocks.active.group ? (
          <div className="bhint">Beim Gruppieren bestimmen Gruppierung und Rechenfunktionen die Spalten — siehe „Gruppieren“ unten.</div>
        ) : (
          <React.Fragment>
            {items.length === 0 && <div className="bhint">Noch keine Spalte gewählt — dann kommen alle Spalten (*). Spalten lassen sich auch aus dem Diagramm hierher ziehen.</div>}
            {items.map((it, idx) => (
              <ResultItem key={idx} it={it} idx={idx} count={items.length} cols={cols}
                          fnPreview={fnPreview} getDistinct={getDistinct}
                          dnd={dndFor(idx)} dropMark={dropMark(idx)} dragging={!!drag && drag.from === idx}
                          setItem={(patch) => setItem(idx, patch)} move={(d) => move(idx, d)}
                          remove={() => setBlocks(b => ({ ...b, selectCols: b.selectCols.filter((_, y) => y !== idx) }))} />
            ))}
            {picking && <ColumnPicker cols={cols} items={items} onClose={() => setPicking(false)}
                                      onAdd={(c) => addItem({ col: c, fns: [] })} />}
            <div className="brow qadd">
              <button className="badd" onClick={() => setPicking(!picking)}>+ Spalte</button>
              <button className="badd" title="CASE WHEN … THEN … ELSE … END — Werte je nach Bedingung"
                      onClick={() => addItem({ kind: 'case', cases: [{ cond: { col: '', op: '=', val: '' }, then: { val: '' } }], else: null })}>+ Wenn–dann</button>
              <button className="badd" title="COALESCE — der erste Wert, der nicht leer ist"
                      onClick={() => addItem({ kind: 'first', items: [{ col: '' }, { col: '' }] })}>+ Erster Wert</button>
              <button className="badd" title="Ein fester Text oder eine Zahl in jeder Zeile, z.B. 'WhatsApp' AS messenger"
                      onClick={() => addItem({ kind: 'value', val: '' })}>+ Fester Wert</button>
              <button className="badd" title="Freier SQL-Ausdruck für alles andere (Profi)"
                      onClick={() => addItem({ expr: '', alias: 'formel' + (items.filter(x => x.expr !== undefined && !x.kind).length + 1) })}>+ Formel</button>
              {items.length > 0 && (
                <button className="collist-star" title="Auswahl leeren = alle Spalten (SELECT *)"
                        onClick={() => setBlocks(b => ({ ...b, selectCols: [] }))}>* alle</button>
              )}
            </div>
          </React.Fragment>
        )}
      </div>

      {MORE_STEPS.filter(s => blocks.active[s.key]).map(s => (
        <div className="qsec" key={s.key}>
          <StepHead kw={s.key} title={s.title} count={stageCounts[s.key]} onRemove={() => removeStep(s.key)} />
          {editors[s.key]}
        </div>
      ))}
      {MORE_STEPS.some(s => !blocks.active[s.key]) && (
        <div className="brow qmore">
          <span className="blbl">Außerdem:</span>
          {MORE_STEPS.filter(s => !blocks.active[s.key]).map(s => (
            <button key={s.key} className="qmore-btn" style={{ '--bc': BLOCK_DEFS[s.key].color }}
                    title={BLOCK_DEFS[s.key].desc} onClick={() => setBlocks(b => activateBlock(b, s.key))}>
              + {s.title} <span>{BLOCK_DEFS[s.key].label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Beim Ausführen: welche Stufe läuft gerade, wie viele Zeilen bleiben übrig?
function StageStrip({ blocks, runStage, stageCounts }) {
  const stages = PIPELINE_ORDER.filter(k => k === 'from' || blocks.active[k]);
  if (!runStage && !Object.keys(stageCounts).length) return null;
  return (
    <div className="qstages" title="So arbeitet SQL die Abfrage ab — in dieser Reihenfolge">
      {stages.map((k, i) => (
        <React.Fragment key={k}>
          {i > 0 && <span className="qstage-arrow">→</span>}
          <span className={'qstage' + (runStage === k ? ' qstage-run' : '')} style={{ '--bc': BLOCK_DEFS[k].color }}>
            {BLOCK_DEFS[k].label}{stageCounts[k] != null && <b> {stageCounts[k]}</b>}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

const BUILD_STEPS = [
  { key: 'start', title: 'Start-Tabelle' },
  { key: 'joins', title: 'Verbinden' },
  { key: 'result', title: 'Spalten' }
];

function QueryBuilder({ blocks, setBlocks, schema, relations, counts, runPreview, runStage, stageCounts, getDistinct, fnPreview }) {
  const joins = blocks.active.join ? blocks.joins.filter(joinComplete).length : 0;
  const shaped = blocks.selectCols.length > 0 || MORE_STEPS.some(s => blocks.active[s.key]);
  const [step, setStep] = React.useState(!blocks.table ? 'start' : shaped ? 'result' : 'joins');
  // Geführt: Ist ein Schritt erledigt, geht es von selbst weiter – auch wenn im Diagramm gewählt oder verbunden wird.
  // Eine aus SQL umgewandelte (fertige) Abfrage landet direkt bei den Spalten.
  const seen = React.useRef({ table: blocks.table, joins });
  React.useEffect(() => {
    const before = seen.current;
    seen.current = { table: blocks.table, joins };
    if (!blocks.table) { setStep('start'); return; }
    if (blocks.table !== before.table) setStep(shaped ? 'result' : 'joins');
    else if (joins > before.joins) setStep(s => (s === 'start' ? 'joins' : s));
  }, [blocks.table, joins]);

  const cols = availableColumns(blocks, schema);
  const current = blocks.table ? step : 'start';
  const nItems = blocks.selectCols.length;
  const extras = MORE_STEPS.filter(s => blocks.active[s.key]).map(s => s.title);
  const sums = {
    start: blocks.table ? localName(blocks.table) : 'noch wählen',
    joins: !blocks.table ? '—' : joins ? '+ ' + joins + (joins === 1 ? ' Tabelle' : ' Tabellen') : 'keine',
    result: !blocks.table ? '—' : blocks.active.group ? 'gruppiert'
      : (nItems ? nItems + (nItems === 1 ? ' Spalte' : ' Spalten') : 'alle Spalten') + (extras.length ? ' · ' + extras.join(', ') : '')
  };
  const done = { start: !!blocks.table, joins: !!blocks.table && (joins > 0 || current === 'result'), result: nItems > 0 || blocks.active.group };
  return (
    <div className="qbuilder" data-screen-label="Abfrage-Bauplatz">
      <div className="qtabs" role="tablist">
        {BUILD_STEPS.map((s, i) => (
          <button key={s.key} role="tab" aria-selected={current === s.key}
                  className={'qtab' + (current === s.key ? ' qtab-on' : '') + (done[s.key] ? ' qtab-done' : '')}
                  disabled={i > 0 && !blocks.table} title={i > 0 && !blocks.table ? 'Wähle zuerst eine Start-Tabelle' : ''}
                  onClick={() => setStep(s.key)}>
            <span className="qtab-n">{done[s.key] && current !== s.key ? '✓' : i + 1}</span>
            <span className="qtab-t">{s.title}</span>
            <span className="qtab-sum">{sums[s.key]}</span>
          </button>
        ))}
      </div>
      <StageStrip blocks={blocks} runStage={runStage} stageCounts={stageCounts} />
      {current === 'start' && <StartStep blocks={blocks} setBlocks={setBlocks} schema={schema} counts={counts || {}}
                                         stageCounts={stageCounts} onNext={() => setStep('joins')} />}
      {current === 'joins' && <JoinsStep blocks={blocks} setBlocks={setBlocks} schema={schema} relations={relations} runPreview={runPreview} counts={counts || {}}
                                         stageCounts={stageCounts} onNext={() => setStep('result')} />}
      {current === 'result' && (
        <React.Fragment>
          <StepGuide n={3}>
            Welche Spalten willst du sehen? „+ Spalte“ holt sie aus allen verbundenen Tabellen; die Reihenfolge änderst du durch
            Ziehen am Griff ⠿. Werte zusammenführen: „Wenn–dann“ und „Erster Wert“. Filtern und Sortieren findest du unten bei
            „Außerdem“ — dann ▶ Ausführen.
          </StepGuide>
          <ResultStep blocks={blocks} setBlocks={setBlocks} cols={cols} stageCounts={stageCounts}
                      getDistinct={getDistinct} fnPreview={fnPreview} />
        </React.Fragment>
      )}
    </div>
  );
}


Object.assign(window, { CountUp, QueryBuilder, activateBlock, FnPicker, fnDropProps, ComboValue });
