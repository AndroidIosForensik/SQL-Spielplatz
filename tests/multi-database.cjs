// Uses the exact SQLite and Babel versions embedded in the offline app.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'SQL Spielplatz.html'), 'utf8');
const manifest = JSON.parse(html.match(/<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/)[1]);
const asset = id => {
  const entry = manifest[id], data = Buffer.from(entry.data, 'base64');
  return entry.compressed ? zlib.gunzipSync(data) : data;
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sql-spielplatz-test-'));
const runtime = (id, name) => {
  const file = path.join(tmp, name + '.cjs');
  fs.writeFileSync(file, asset(id));
  return require(file);
};

(async () => {
  try {
    const Babel = runtime('68440210-93a9-41e4-b986-25dcefa6f6eb', 'babel');
    const init = runtime('2f5b3051-9ec6-4680-87ab-f136e36db220', 'sql');
    const SQL = await init({ wasmBinary: asset('41b0ff5b-b2cd-499c-8279-ec231c127508') });
    const mapping = JSON.parse(fs.readFileSync(path.join(root, 'src/bundle-map.json')));
    const source = name => fs.readFileSync(path.join(root, 'src', name), 'utf8');
    for (const [name, id] of Object.entries(mapping)) {
      assert.equal(asset(id).toString(), source(name), name + ' must match the shipped bundle');
      Babel.transform(source(name), { presets: ['react'] });
    }
    const template = JSON.parse(html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
    assert.equal(template.split('id="workspace-styles"').length, 2, 'workspace stylesheet appears exactly once');
    assert.ok(template.includes(source('schema.css').replace(/\r\n/g, '\n')), 'stylesheet matches the shipped bundle');
    const ctx = vm.createContext({ window: {}, console });
    const run = code => vm.runInContext(code, ctx);
    run(source('sql-tools.js'));
    run(source('query-files.js'));
    run(source('app.jsx').split('function App()')[0]);
    run(source('modify.jsx').split('function emptyModify()')[0]);
    run(source('modify.jsx').match(/function viewDefinition[\s\S]*?\r?\n}\r?\n/)[0]);
    run(source('schema.jsx').split('function SchemaCanvas(')[0]);
    run(`var layoutTables = [
      {name:'b.z',database:'b',localName:'z',columns:Array(20).fill({}),w:420,h:450},
      {name:'a.b',database:'a',localName:'b',columns:Array(3).fill({})},
      {name:'a.a',database:'a',localName:'a',columns:Array(8).fill({}),w:320,h:600},
      {name:'b.a',database:'b',localName:'a',columns:Array(4).fill({})}
    ];`);
    for (const mode of ['database', 'grid', 'list']) {
      for (const width of [350, 800, 1400]) {
        ctx.layoutMode = mode; ctx.layoutWidth = width;
        run('var positions = arrangeTables(layoutTables, layoutMode, layoutWidth); var placed = layoutTables.map(t => ({...t, ...positions[t.name]}))');
        assert.equal(run('Object.keys(positions).length'), 4);
        assert.ok(run(`placed.every((a,i) => placed.slice(i+1).every(b =>
          a.x + tableWidth(a) <= b.x || b.x + tableWidth(b) <= a.x ||
          a.y + tableHeight(a) <= b.y || b.y + tableHeight(b) <= a.y))`), 'resized cards never overlap');
        assert.equal(run('JSON.stringify(positions)'), run('JSON.stringify(arrangeTables([...layoutTables].reverse(), layoutMode, layoutWidth))'), 'stable order regardless of import order');
        if (mode === 'database') assert.ok(run("positions['a.b'].y < positions['b.a'].y"));
        if (mode === 'list') assert.equal(run('new Set(placed.map(t => t.x)).size'), 1);
        run('var fit = fitTables(placed, 800, 550)');
        assert.ok(run('fit.zoom > 0 && fit.zoom <= 1'));
        assert.ok(run('Math.max(...placed.map(t => t.y + tableHeight(t))) * fit.zoom - fit.top <= 550'));
      }
    }
    run('var scrolledTable = {...layoutTables[0], x:28, y:64, h:180}');
    assert.ok(run("colDotPos(scrolledTable,19,'right').y <= scrolledTable.y+HEADER_H+columnAreaHeight(scrolledTable)"));
    assert.ok(run("colDotPos(scrolledTable,0,'left',200).y > scrolledTable.y+HEADER_H"));
    run(`var many = Array.from({length:12}, (_,i) => ({name:'db.t'+i,database:'db',localName:'t'+i,columns:Array(6).fill({})}));
      var balanced = arrangeForViewport(many,'grid',780,550);
      var tall = arrangeTables(many,'grid',780);`);
    assert.ok(run(`fitTables(many.map(t=>({...t,...balanced[t.name]})),780,550).zoom >
      fitTables(many.map(t=>({...t,...tall[t.name]})),780,550).zoom`), 'balanced grid makes better use of screen area');
    // Re-shown cards keep a free old spot; otherwise they move next to the others without overlaps.
    run(`var shown = [{name:'db.a',columns:Array(4).fill({}),x:28,y:28}, {name:'db.b',columns:Array(4).fill({}),x:324,y:28}];
      var back = [{name:'db.c',columns:Array(4).fill({}),x:700,y:28},
        {name:'db.d',columns:Array(6).fill({}),x:60,y:40}, {name:'db.e',columns:Array(6).fill({}),x:60,y:40}];
      var spots = placeTables(back, shown);
      var together = [...shown, ...back.map(t => ({...t, ...spots[t.name]}))];`);
    assert.equal(run("JSON.stringify(spots['db.c'])"), '{"x":700,"y":28}', 'a free old spot is kept');
    assert.equal(run("JSON.stringify(spots['db.d'])"), '{"x":28,"y":244}', 'an occupied spot moves to the nearest free one');
    assert.ok(run(`together.every((a,i) => together.slice(i+1).every(b =>
      a.x + tableWidth(a) <= b.x || b.x + tableWidth(b) <= a.x ||
      a.y + tableHeight(a) <= b.y || b.y + tableHeight(b) <= a.y))`), 're-shown cards never overlap');
    assert.ok(run('together.every(t => t.x >= 8 && t.y >= 8)'));
    // Viele auf einmal: Raster unter den vorhandenen Karten, ohne Überlappung
    run(`var bulk = Array.from({length:40}, (_,i) => ({name:'db.m'+i,columns:Array(5).fill({}),x:50,y:50}));
      var bulkSpots = placeTables(bulk, shown); var bulkAll = [...shown, ...bulk.map(t => ({...t, ...bulkSpots[t.name]}))];`);
    assert.ok(run(`bulkAll.every((a,i) => bulkAll.slice(i+1).every(b =>
      a.x + tableWidth(a) <= b.x || b.x + tableWidth(b) <= a.x ||
      a.y + tableHeight(a) <= b.y || b.y + tableHeight(b) <= a.y))`), 'bulk re-show never overlaps');
    const db = new SQL.Database(), a = new SQL.Database(), b = new SQL.Database();
    a.run("CREATE TABLE kunde(id INTEGER PRIMARY KEY, name TEXT); INSERT INTO kunde VALUES(1,'Ada'),(2,'Bea'); CREATE TABLE bestellung(id INTEGER, kunde_id REFERENCES kunde(id)); INSERT INTO bestellung VALUES(7,1);");
    b.run("CREATE TABLE kunde(id INTEGER PRIMARY KEY, name TEXT); INSERT INTO kunde VALUES(1,'Berlin'),(3,'Bonn');");
    db.run('ATTACH DATABASE ? AS eins', [a.filename]);
    db.run('ATTACH DATABASE ? AS zwei', [b.filename]);
    ctx.db = db;
    run('var sa = introspect(db, null, "eins"), sb = introspect(db, null, "zwei"); var schema = {tables: [...sa.tables, ...sb.tables]};');
    assert.equal(run('sa.relations'), undefined, 'foreign keys never become query lines on their own');
    assert.equal(run("sa.foreignKeys.map(r => r.from.table + '.' + r.from.col + '>' + r.to.table + '.' + r.to.col).join()"),
      'eins.bestellung.kunde_id>eins.kunde.id', 'declared foreign keys are offered as dotted suggestions');
    assert.equal(run("sameLink(sa.foreignKeys[0], {from: sa.foreignKeys[0].to, to: sa.foreignKeys[0].from})"), true);
    assert.equal(run('sb.tables[0].name'), 'zwei.kunde');
    run("var legacy = emptyBlocks(); legacy.table='bestellung'; legacy=requalifyColumns(legacy, schema)");
    assert.equal(run('legacy.table'), 'eins.bestellung');
    run(`var blocks = emptyBlocks(); blocks.table = 'eins.kunde'; blocks.active.join = true;
      blocks.joins = [{type:'INNER',leftTable:'eins.kunde',leftCol:'id',rightTable:'zwei.kunde',rightCol:'id'}];
      blocks.active.select = true; blocks.selectCols = [{col:'eins.kunde.name'}, {col:'zwei.kunde.name'}];
      blocks = requalifyColumns(blocks, schema);`);
    assert.deepEqual(db.exec(run('buildQuerySQL(blocks)'))[0].values, [['Ada', 'Berlin']]);
    for (const type of ['LEFT', 'RIGHT', 'FULL', 'CROSS']) {
      run(`blocks.joins[0].type = '${type}'`);
      assert.equal(db.exec(run('buildQuerySQL(blocks)'))[0].values.length, { LEFT: 2, RIGHT: 2, FULL: 3, CROSS: 4 }[type]);
    }
    run("blocks.joins[0].type='INNER'; blocks.active.order=true; blocks.orderBy=[{col:'zwei.kunde.name',dir:'ASC'}]");
    const generated = run('buildQuerySQL(blocks)');
    ctx.generated = generated;
    assert.equal(run('parseSQLToBlocks(generated, schema).error'), undefined);
    assert.deepEqual(db.exec(run('buildQuerySQL(parseSQLToBlocks(generated, schema).blocks)'))[0].values, [['Ada', 'Berlin']]);
    assert.equal(db.exec(run('buildStageCountSQLs(blocks).join'))[0].values[0][0], 1);
    run("blocks.active.where=true; blocks.wheres=[{col:'zwei.kunde.name',op:'=',val:'Berlin'}]");
    assert.equal(db.exec(run('buildQuerySQL(blocks)'))[0].values.length, 1);
    run("blocks.active.group=true; blocks.groupBy=['zwei.kunde.name']; blocks.aggs=[{fn:'COUNT',col:'*'}]");
    assert.deepEqual(db.exec(run('buildQuerySQL(blocks)'))[0].values, [['Berlin', 1]]);
    // SQL aliases and three-part column references both survive conversion.
    ctx.generated = 'SELECT a.name, b.name FROM eins.kunde a JOIN zwei.kunde b ON a.id=b.id';
    assert.deepEqual(db.exec(run('buildQuerySQL(parseSQLToBlocks(generated, schema).blocks)'))[0].values, [['Ada', 'Berlin']]);
    assert.ok(run("parseSQLToBlocks('SELECT * FROM kunde', schema).error"), 'ambiguous unqualified table is rejected');
    // Quoted identifiers with spaces, embedded quotes and dots.
    db.run('CREATE TABLE zwei."order details" ("key.id" INTEGER, "order" TEXT, "a""b" TEXT); INSERT INTO zwei."order details" VALUES(1,\'ok\',\'quoted\')');
    run('schema.tables = [...sa.tables, ...introspect(db, null, "zwei").tables]');
    ctx.generated = 'SELECT eins.kunde.name, zwei."order details"."order" FROM eins.kunde JOIN zwei."order details" ON eins.kunde.id = zwei."order details"."key.id"';
    assert.equal(run('parseSQLToBlocks(generated, schema).error'), undefined);
    assert.deepEqual(db.exec(run('buildQuerySQL(parseSQLToBlocks(generated, schema).blocks)'))[0].values, [['Ada', 'ok']]);
    // Messenger-Schema: Spalten wie from_me sind keine FROM-Klausel, jid kommt zweimal vor (Chat + Absender),
    // CASE bleibt Profi-Formel mit umgeschriebenen Aliasen.
    db.run(`CREATE TABLE zwei.jid(_id INTEGER PRIMARY KEY, raw_string TEXT); CREATE TABLE zwei.chat(_id INTEGER PRIMARY KEY, jid_row_id INTEGER);
      CREATE TABLE zwei.message(_id INTEGER PRIMARY KEY, chat_row_id INTEGER, from_me INTEGER, sender_jid_row_id INTEGER, text_data TEXT);
      INSERT INTO zwei.jid VALUES(1,'gruppe'),(2,'anna'),(3,'bob'); INSERT INTO zwei.chat VALUES(10,1),(11,3);
      INSERT INTO zwei.message VALUES(100,10,1,0,'hallo'),(101,10,0,2,'hi'),(102,11,0,0,'moin'),(103,0,0,0,'sys');`);
    run('schema.tables = [...sa.tables, ...introspect(db, null, "zwei").tables]');
    ctx.generated = `SELECT m._id, CASE WHEN m.from_me = 1 THEN 'ICH' WHEN m.sender_jid_row_id > 0 THEN sj.raw_string ELSE cj.raw_string END AS absender,
      cj.raw_string AS chat, m.text_data FROM zwei.message m JOIN zwei.chat c ON c._id = m.chat_row_id
      JOIN zwei.jid cj ON cj._id = c.jid_row_id LEFT JOIN zwei.jid sj ON sj._id = m.sender_jid_row_id WHERE m.chat_row_id > 0`;
    const expectedMessenger = db.exec(ctx.generated)[0].values;
    // Ohne hinterlegte Fremdschlüssel keine Vorschläge – nichts wird aus Spaltennamen wie chat_row_id vermutet
    assert.equal(run('JSON.stringify(Object.keys(introspect(db, null, "zwei")))'), '["tables","foreignKeys"]', 'no automatic relations or guesses');
    assert.equal(run('introspect(db, null, "zwei").foreignKeys.length'), 0);
    run('var messenger = parseSQLToBlocks(generated, schema)');
    assert.equal(run('messenger.error'), undefined);
    assert.equal(run("messenger.blocks.joins.map(j => j.rightAlias || '-').join()"), 'c,cj,sj', 'own aliases become role names');
    assert.equal(run('messenger.blocks.tableAlias'), 'm');
    ctx.messengerSQL = run('buildQuerySQL(requalifyColumns(messenger.blocks, schema))');
    assert.deepEqual(db.exec(ctx.messengerSQL)[0].values, expectedMessenger, 'self-join with CASE gives the original rows');
    assert.equal(run('buildQuerySQL(parseSQLToBlocks(messengerSQL, schema).blocks)'), ctx.messengerSQL, 'stable roundtrip without extra parentheses');
    assert.ok(run("availableColumns(messenger.blocks, schema).includes('sj.raw_string')"));
    assert.equal(run('messenger.notes.length'), 0, 'CASE is understood as a block, not a free formula');
    assert.equal(run("messenger.blocks.selectCols[1].kind + ':' + messenger.blocks.selectCols[1].cases.length"), 'case:2');
    // Rollen umbenennen: Spalten-Verweise (auch im CASE) ziehen mit
    ctx.renamedSQL = run('buildQuerySQL(requalifyColumns(renameRef(messenger.blocks, "sj", "absender"), schema))');
    assert.ok(ctx.renamedSQL.includes('zwei.jid AS absender') && !/\bsj\./.test(ctx.renamedSQL), 'rename reaches every reference');
    assert.deepEqual(db.exec(ctx.renamedSQL)[0].values, expectedMessenger);
    // Vergebene Namen sind tabu, auch der Kurzname einer Tabelle ohne eigenen Namen
    assert.equal(run("[refTaken(querySources(messenger.blocks), 'SJ'), refTaken(querySources(messenger.blocks), 'neu')].join()"), 'true,false');
    assert.equal(run("refTaken([{ref:'zwei.jid', table:'zwei.jid'}], 'jid')"), true);
    // Verbindung nachträglich ändern: der Name bleibt, und was an ihm hängt, zieht mit
    run(`var named = { ...emptyBlocks(), table: 'zwei.message', active: { ...emptyBlocks().active, join: true, select: true },
      joins: [{type:'INNER', leftTable:'zwei.message', leftCol:'chat_row_id', rightTable:'zwei.chat', rightCol:'_id', rightAlias:'unterhaltung'},
              {type:'LEFT', leftTable:'zwei.chat', leftRef:'unterhaltung', leftCol:'jid_row_id', rightTable:'zwei.jid', rightCol:'_id', rightAlias:'partner'}],
      selectCols: [{col:'unterhaltung._id'}, {col:'partner.raw_string'}] };
      var swapped = replaceJoin(named, 1, {type:'LEFT', leftTable:'zwei.chat', leftRef:'unterhaltung', leftCol:'jid_row_id', rightTable:'zwei.jid', rightCol:'_id', custom:true});`);
    assert.equal(run('swapped.joins[1].rightAlias'), 'partner', 'own role name survives a changed join');
    assert.ok(db.exec(run('buildQuerySQL(requalifyColumns(swapped, schema))')));
    run(`var retabled = replaceJoin(named, 0, {type:'INNER', leftTable:'zwei.message', leftCol:'_id', rightTable:'zwei.jid', rightCol:'_id', custom:true});`);
    assert.equal(run('retabled.joins[0].rightAlias + "|" + retabled.joins[1].leftTable + "|" + retabled.joins[1].leftRef'), 'unterhaltung|zwei.jid|unterhaltung',
      'following joins see the new table behind the same name');
    run(`var plain = { ...named, joins: [{ ...named.joins[0], rightAlias: undefined }, { ...named.joins[1], leftRef: undefined }], selectCols: [{col:'zwei.chat._id'}] };
      delete plain.joins[0].rightAlias; delete plain.joins[1].leftRef;
      var replacedPlain = replaceJoin(plain, 0, {type:'INNER', leftTable:'zwei.message', leftCol:'_id', rightTable:'zwei.jid', rightCol:'_id'});`);
    assert.equal(run("replacedPlain.joins[1].leftTable + '|' + (replacedPlain.joins[1].leftRef || '-') + '|' + replacedPlain.selectCols[0].col"), 'zwei.jid|jid_2|jid_2._id',
      'without a name the references move to the new table (jid is already joined, so it gets jid_2)');
    run(`var twice = { ...named, joins: [named.joins[0], {type:'LEFT', leftTable:'zwei.message', leftCol:'sender_jid_row_id', rightTable:'zwei.chat', rightCol:'_id', rightAlias:'chat_2'}] };`);
    assert.equal(run("replaceJoin(twice, 1, {type:'LEFT', leftTable:'zwei.message', leftCol:'sender_jid_row_id', rightTable:'zwei.jid', rightCol:'_id'}).joins[1].rightAlias || '-'"), '-',
      'a generated name like chat_2 is dropped when the table changes');
    // COALESCE mit mehreren Werten → „Erster Wert“, auch als Ergebnis im CASE
    ctx.generated = "SELECT COALESCE(sj.raw_string, cj.raw_string, 'unbekannt') AS wer, CASE WHEN m.text_data IS NULL THEN 'leer' ELSE COALESCE(sj.raw_string, cj.raw_string) END AS x FROM zwei.message m JOIN zwei.chat c ON c._id = m.chat_row_id JOIN zwei.jid cj ON cj._id = c.jid_row_id LEFT JOIN zwei.jid sj ON sj._id = m.sender_jid_row_id";
    const expectedFirst = db.exec(ctx.generated)[0].values;
    run('var firstParsed = parseSQLToBlocks(generated, schema)');
    assert.equal(run("firstParsed.blocks.selectCols.map(x => x.kind).join()"), 'first,case');
    assert.deepEqual(db.exec(run('buildQuerySQL(firstParsed.blocks)'))[0].values, expectedFirst);
    // ATTACH davor, UTC-Zeitstempel und feste Werte werden zu Bausteinen
    ctx.generated = "ATTACH DATABASE 'zwei.db' AS zwei;\nSELECT datetime(m._id / 1000, 'unixepoch') AS zeit, datetime(m._id, 'unixepoch') AS sek, 'WhatsApp' AS messenger FROM zwei.message AS m;";
    run('var attached = parseSQLToBlocks(generated, schema)');
    assert.equal(run('attached.error'), undefined);
    assert.equal(run("attached.blocks.selectCols.map(x => x.kind || x.fns.map(f => f.fn).join()).join()"), 'msdateutc,unixutc,value');
    // Apple-Zeit (iPhone: Sekunden ab 1.1.2001): kurze Formel, richtiger Wert und Rückweg SQL → Baustein
    assert.equal(run("fnExpr('appleutc', 'x')"), "datetime(x + 978307200, 'unixepoch')");
    for (const v of ['801647260', '801647260.5', "'801647260'"]) {
      assert.equal(db.exec('SELECT ' + run(`fnExpr('appleutc', ${JSON.stringify(v)})`))[0].values[0][0], '2026-05-28 07:47:40', 'Apple-Zeit ' + v);
    }
    // … Nanosekunden (iMessage) mit eigenem Baustein, auch als Text oder in e-Schreibweise
    assert.equal(run("fnExpr('applensutc', 'x')"), "datetime(x / 1e9 + 978307200, 'unixepoch')");
    for (const v of ['801647260000000000', "'801647260000000000'", '8.0164726e17']) {
      assert.equal(db.exec('SELECT ' + run(`fnExpr('applensutc', ${JSON.stringify(v)})`))[0].values[0][0], '2026-05-28 07:47:40', 'Apple-Nanosekunden ' + v);
    }
    assert.equal(db.exec('SELECT ' + run("fnExpr('appleutc', 'NULL')"))[0].values[0][0], null);
    ctx.appleSQL = `SELECT ${run("fnExpr('appledate', 'm._id')")} AS a, ${run("fnExpr('appleutc', 'upper(m.text_data)')")} AS b, ` +
      `${run("fnExpr('applensdate', 'm._id')")} AS c, ${run("fnExpr('applensutc', 'm._id')")} AS d FROM zwei.message m`;
    assert.equal(run("parseSQLToBlocks(appleSQL, schema).blocks.selectCols.map(x => x.fns.map(f => f.fn).join()).join('|')"),
      'appledate|upper,appleutc|applensdate|applensutc', 'Apple-Zeit (Sekunden und Nanosekunden) wird wieder zum Baustein');
    assert.equal(run("parseSQLToBlocks(\"SELECT datetime(m._id + 978307200, 'unixepoch', 'localtime') AS a, datetime(m._id+978307200,'unixepoch') AS b FROM zwei.message m\", schema).blocks.selectCols.map(x => x.fns.map(f => f.fn).join()).join()"),
      'appledate,appleutc', 'Apple-Zeit wird nicht als Unix-Zeit missverstanden');
    // Datenbanknamen ausblenden (nur eine Datenbank offen): Tabellen ohne „plauder.“, Text und Rollen bleiben
    assert.equal(run(`withoutDatabase("SELECT plauder.nutzer.name, 'plauder.nutzer' AS t FROM plauder.nutzer JOIN plauder.\\"my tab\\" AS plauder ON plauder.id = plauder.nutzer.id", 'plauder', ['nutzer', 'my tab'])`),
      `SELECT nutzer.name, 'plauder.nutzer' AS t FROM nutzer JOIN "my tab" AS plauder ON plauder.id = nutzer.id`);
    assert.equal(run("withoutDatabase('SELECT * FROM plauder.nutzer_alt', 'plauder', ['nutzer'])"), 'SELECT * FROM plauder.nutzer_alt');
    // Spaltensuche: alle Wörter, ohne Groß/klein; leere Suche passt immer
    assert.equal(run("['ZMESSAGEDATE','ZSENTDATE','ZTEXT'].filter(c => colMatches(c, 'date')).join()"), 'ZMESSAGEDATE,ZSENTDATE');
    assert.equal(run("['ZMESSAGEDATE','ZSENTDATE','ZTEXT'].filter(c => colMatches(c, 'z mess')).join()"), 'ZMESSAGEDATE');
    assert.equal(run("colMatches('ZTEXT', '  ')"), true);
    // CSV-Dateiname: „.csv“ genau einmal, verbotene Zeichen ersetzt, leer → Standard
    run(source('results.jsx').match(/function csvFileName[\s\S]*?\r?\n}\r?\n/)[0]);
    assert.equal(run("[csvFileName('whatsapp'), csvFileName('iphone.CSV'), csvFileName(' a/b:c? '), csvFileName('')].join('|')"),
      'whatsapp.csv|iphone.csv|a_b_c_.csv|abfrage-ergebnis.csv');
    assert.equal(run("buildQuerySQL(parseSQLToBlocks('SELECT m._id, NULL AS reaktion_auf_id FROM zwei.message m', schema).blocks).split('\\n')[0]"),
      'SELECT _id, NULL AS reaktion_auf_id', 'NULL AS … becomes an empty fixed value');
    assert.deepEqual(db.exec(run('buildQuerySQL(attached.blocks)'))[0].values, db.exec(ctx.generated.split(';')[1])[0].values);
    assert.match(run("parseSQLToBlocks(\"ATTACH 'wa.db' AS wa; SELECT * FROM zwei.message\", schema).error"), /„wa“ ist nicht geöffnet/);
    assert.equal(run("attachProblem(splitAttach(\"ATTACH 'C:/x/wa.db' AS wa; SELECT 1\").attaches, [{alias:'wa_2', name:'wa.db'}])"),
      '„wa.db“ ist unter dem Namen wa_2 geöffnet — schreibe in der Abfrage wa_2. statt wa.');
    // Linie im Diagramm aufgezogen → direkt ein JOIN (ohne FROM wird die Start-Tabelle gesetzt)
    run(`var relChat = {id:'r1', from:{table:'zwei.message', col:'chat_row_id'}, to:{table:'zwei.chat', col:'_id'}};
      var relJid = {id:'r2', from:{table:'zwei.jid', col:'_id'}, to:{table:'zwei.chat', col:'jid_row_id'}};
      var step1 = joinForRelation(emptyBlocks(), relChat, 'zwei.message');
      var step2 = joinForRelation(step1.blocks, relJid, 'zwei.jid');
      var again = joinForRelation(step2.blocks, relJid, 'zwei.jid');`);
    assert.equal(run('step1.blocks.table'), 'zwei.message');
    assert.equal(run('buildQuerySQL(step2.blocks)'), 'SELECT *\nFROM zwei.message\nINNER JOIN zwei.chat ON zwei.message.chat_row_id = zwei.chat._id\nINNER JOIN zwei.jid ON zwei.chat.jid_row_id = zwei.jid._id;');
    assert.equal(run('again.blocks === step2.blocks'), true, 'same line twice adds no second join');
    assert.match(run("joinForRelation(step2.blocks, {id:'r3', from:{table:'eins.kunde',col:'id'}, to:{table:'eins.bestellung',col:'kunde_id'}}, 'eins.kunde').message"), /Nicht verbunden/);
    assert.equal(run("joinForRelation(step2.blocks, {id:'r3', from:{table:'eins.kunde',col:'id'}, to:{table:'eins.bestellung',col:'kunde_id'}}, 'eins.kunde').ok"), false,
      'a line that cannot attach to the query is not kept');
    // Beide Tabellen schon in der Abfrage: die Zieltabelle kommt in einer weiteren Rolle dazu
    run("var relSender = {id:'r4', from:{table:'zwei.message', col:'sender_jid_row_id'}, to:{table:'zwei.jid', col:'_id'}}; var step3 = joinForRelation(step2.blocks, relSender, 'zwei.message');");
    assert.equal(run('step3.ok && step3.blocks.joins[2].rightAlias'), 'jid_2');
    assert.equal(db.exec(run('buildQuerySQL(step3.blocks)'))[0].values.length, 1, 'second role of jid joins (only one message has a sender)');
    // Rechts ↔ links: jede Verbindung bekommt ihre Linie, verwaiste selbst gezogene Linien verschwinden
    run(`var custom = { ...step2.blocks, joins: [...step2.blocks.joins, {type:'LEFT', custom:true, leftTable:'zwei.message', leftCol:'sender_jid_row_id', rightTable:'zwei.jid', rightCol:'_id', rightAlias:'absender'}] };
      var synced = syncJoinLines(custom, [relChat, relJid, {id:'old', from:{table:'zwei.chat',col:'_id'}, to:{table:'zwei.jid',col:'_id'}, auto:false}], n => 'neu' + n);`);
    assert.equal(run('synced.joins[2].relId'), 'neu0', 'a join chosen on the right gets its line');
    assert.equal(run("synced.relations.map(r => r.id).join()"), 'r1,r2,neu0', 'manual lines without a join are removed');
    assert.equal(run('syncJoinLines({ ...custom, joins: synced.joins }, synced.relations, n => "x" + n).relations'), null, 'stable once in sync');
    // Live-Vorschau der Join-Art: Zeilen je Art und Zeilen ohne Partner
    run(`var pv = emptyBlocks(); pv.table = 'zwei.message'; pv.active.join = true;
      pv.joins = [{type:'INNER', leftTable:'zwei.message', leftCol:'chat_row_id', rightTable:'zwei.chat', rightCol:'_id'}];
      var pvCount = t => db.exec(joinPreviewSQL(pv, 0, t, schema).countSQL)[0].values[0];`);
    assert.deepEqual(run('pvCount("INNER")'), [3, 0, 0]);
    assert.deepEqual(run('pvCount("LEFT")'), [4, 1, 0], 'LEFT keeps the message without chat');
    assert.equal(run("db.exec(joinPreviewSQL(pv, 0, 'LEFT', schema).sampleSQL)[0].values[0][2]"), null, 'rows without partner come first');
    // COALESCE mit zwei Spalten ist kein fester Ersatzwert
    ctx.generated = "SELECT COALESCE(sj.raw_string, cj.raw_string) AS wer FROM zwei.message m JOIN zwei.chat c ON c._id = m.chat_row_id JOIN zwei.jid cj ON cj._id = c.jid_row_id LEFT JOIN zwei.jid sj ON sj._id = m.sender_jid_row_id";
    assert.equal(run('parseSQLToBlocks(generated, schema).blocks.selectCols[0].kind'), 'first');
    assert.deepEqual(db.exec(run('buildQuerySQL(parseSQLToBlocks(generated, schema).blocks)'))[0].values, db.exec(ctx.generated)[0].values);
    const modify = run(`buildModifySQL({action:'UPDATE',table:'zwei.kunde',sets:[{col:'name',val:'Bremen'}],conds:[{col:'id',op:'=',val:1}]},schema)`);
    db.run(modify);
    assert.equal(db.exec('SELECT name FROM zwei.kunde WHERE id=1')[0].values[0][0], 'Bremen');
    assert.equal(db.exec('SELECT name FROM eins.kunde WHERE id=1')[0].values[0][0], 'Ada');
    db.run('DETACH DATABASE zwei'); b.close();
    assert.equal(db.exec('SELECT COUNT(*) FROM eins.kunde')[0].values[0][0], 2);
    assert.throws(() => db.exec('SELECT * FROM zwei.kunde'), /no such table/);
    db.run('DETACH DATABASE eins'); a.close(); db.close();

    // Ansichten (VIEW): Personenverzeichnis über zwei Datenbanken als TEMP VIEW, dann Nachrichten in Stufe 2
    const ws = new SQL.Database(), ms = new SQL.Database(), wa = new SQL.Database();
    ms.run(`CREATE TABLE jid(_id INTEGER PRIMARY KEY, raw_string TEXT); CREATE TABLE jid_map(lid_row_id INTEGER, jid_row_id INTEGER);
      CREATE TABLE chat(_id INTEGER PRIMARY KEY, jid_row_id INTEGER, subject TEXT);
      CREATE TABLE message(_id INTEGER PRIMARY KEY, chat_row_id INTEGER, from_me INTEGER, sender_jid_row_id INTEGER, timestamp INTEGER, text_data TEXT);
      CREATE TABLE message_media(message_row_id INTEGER, file_path TEXT);
      CREATE VIEW eigene_chats AS SELECT _id FROM chat;
      INSERT INTO jid VALUES(1,'g@g.us'),(2,'49111@s.whatsapp.net'),(3,'777@lid'),(4,'49222@s.whatsapp.net');
      INSERT INTO jid_map VALUES(3,4);
      INSERT INTO chat VALUES(10,1,'Familie'),(11,2,NULL);
      INSERT INTO message VALUES(100,10,1,0,1700000000000,'hallo'),(101,10,0,3,1700000001000,'hi'),(102,11,0,0,1700000002000,'moin'),(103,0,0,0,1700000003000,'sys');
      INSERT INTO message_media VALUES(101,'Media/bild.jpg');`);
    wa.run(`CREATE TABLE wa_contacts(jid TEXT, display_name TEXT, wa_name TEXT);
      INSERT INTO wa_contacts VALUES('49111@s.whatsapp.net','Anna',NULL),('49222@s.whatsapp.net',NULL,'Bob');`);
    ws.run('ATTACH DATABASE ? AS msgstore', [ms.filename]);
    ws.run('ATTACH DATABASE ? AS wa', [wa.filename]);
    ctx.ws = ws;
    run(`var wsTables = [...introspect(ws, null, 'msgstore').tables, ...introspect(ws, null, 'wa').tables]
      .map((t, i) => ({...t, x: 28 + (i % 3) * 300, y: 28 + Math.floor(i / 3) * 300}));
      var wsSchema = {tables: withWorkspaceObjects(ws, wsTables)};`);
    assert.equal(run("wsSchema.tables.find(t => t.name === 'msgstore.eigene_chats').view"), true, 'views inside a database file are read as views');
    assert.equal(run("wsSchema.tables.find(t => t.name === 'msgstore.chat').view"), undefined);
    ctx.stage1 = `CREATE TEMP VIEW personen AS
      SELECT jid._id AS person_id, COALESCE(telefon.raw_string, jid.raw_string) AS kennung,
             COALESCE(kontakt.display_name, kontakt.wa_name) AS name
      FROM jid
      LEFT JOIN jid_map ON jid_map.lid_row_id = jid._id
      LEFT JOIN jid AS telefon ON telefon._id = jid_map.jid_row_id
      LEFT JOIN wa.wa_contacts AS kontakt ON kontakt.jid = COALESCE(telefon.raw_string, jid.raw_string);`;
    assert.match(run('viewSelect(stage1)'), /^SELECT jid\._id/, 'a pasted CREATE VIEW is unwrapped to its SELECT');
    // JOIN … ON kontakt.jid = COALESCE(…): wird zur Verbindung mit Ersatz-Spalte („sonst …“)
    run('var coal = parseSQLToBlocks(viewSelect(stage1), wsSchema)');
    assert.equal(run('coal.error'), undefined);
    assert.equal(run('coal.notes.length'), 0, 'the COALESCE join is not skipped');
    assert.equal(run("JSON.stringify(coal.blocks.joins[2].leftAlt.map(a => a.ref + '.' + a.col))"), '["jid.raw_string"]');
    ctx.coalSQL = run('buildQuerySQL(requalifyColumns(coal.blocks, wsSchema))');
    assert.match(ctx.coalSQL, /LEFT JOIN wa\.wa_contacts AS kontakt ON COALESCE\(telefon\.raw_string, jid\.raw_string\) = kontakt\.jid/);
    assert.deepEqual(ws.exec(ctx.coalSQL)[0].values, ws.exec(run('viewSelect(stage1)'))[0].values, 'same rows as the pasted SQL');
    assert.equal(run('syncJoinLines(coal.blocks, [], n => "x" + n).joins.map(j => j.relId || "-").join()'), 'x0,x1,-', 'a COALESCE join draws no line');
    ctx.coalRenamed = run('buildQuerySQL(renameRef(coal.blocks, "jid", "person"))');
    assert.match(ctx.coalRenamed, /COALESCE\(telefon\.raw_string, person\.raw_string\)/, 'renaming a role reaches the fallback column');
    assert.equal(run("joinPreviewSQL(coal.blocks, 2, 'LEFT', wsSchema).cols[0].label"), 'erster Wert');
    assert.deepEqual(ws.exec(run("joinPreviewSQL(coal.blocks, 2, 'LEFT', wsSchema).countSQL"))[0].values[0].slice(0, 2), [4, 1]);
    assert.match(run("viewProblem({name:'jid', select: stage1}, wsSchema)"), /msgstore\.jid/, 'a view must not shadow a table name');
    const createView = run("buildViewSQL({name:'personen', select: stage1}, wsSchema)");
    assert.equal(createView.split('\n')[0], 'CREATE TEMP VIEW personen AS');
    ws.run(createView);
    run('wsSchema = {tables: withWorkspaceObjects(ws, wsSchema.tables)}');
    run("var personen = wsSchema.tables.find(t => t.name === 'temp.personen')");
    assert.equal(run('personen.view && personen.workspace && personen.localName'), 'personen');
    assert.equal(run("personen.columns.map(c => c.name).join()"), 'person_id,kennung,name');
    assert.match(run('viewDefinition(personen)'), /^SELECT jid\._id[\s\S]*COALESCE\(telefon\.raw_string, jid\.raw_string\)$/, 'stored definition can be loaded for editing');
    assert.ok(run(`wsSchema.tables.every((a,i) => wsSchema.tables.slice(i+1).every(b =>
      a.x + tableWidth(a) <= b.x || b.x + tableWidth(b) <= a.x || a.y + tableHeight(a) <= b.y || b.y + tableHeight(b) <= a.y))`),
      'the new view card does not cover a table');
    assert.deepEqual(ws.exec('SELECT kennung, name FROM temp.personen ORDER BY person_id')[0].values,
      [['g@g.us', null], ['49111@s.whatsapp.net', 'Anna'], ['49222@s.whatsapp.net', 'Bob'], ['49222@s.whatsapp.net', 'Bob']], 'LID resolves to phone number and name');
    // Ersetzen: gleicher Name → DROP + CREATE, die Karte bleibt an ihrem Platz
    run("personen = {...personen, x: 900, y: 700}; wsSchema.tables = wsSchema.tables.map(t => t.name === personen.name ? personen : t)");
    const replaceView = run("buildViewSQL({name:'personen', select: stage1}, wsSchema)");
    assert.match(replaceView, /^DROP VIEW temp\.personen;\nCREATE TEMP VIEW personen AS/);
    ws.run(replaceView);
    run('wsSchema = {tables: withWorkspaceObjects(ws, wsSchema.tables)}');
    assert.equal(run("JSON.stringify(wsSchema.tables.filter(t => t.name === 'temp.personen').map(t => [t.x, t.y]))"), '[[900,700]]');
    // Stufe 2: personen zweimal (Absender und Unterhaltung) – unqualifiziert, als Bausteine
    ctx.stage2 = `SELECT message._id AS nachricht_id,
        CASE WHEN message.from_me = 1 THEN 'Ich' ELSE COALESCE(absender.name, unterhaltung.name) END AS absender_name,
        COALESCE(chat.subject, unterhaltung.name) AS unterhaltungs_name, message.text_data AS nachrichteninhalt, message_media.file_path AS medienpfad
      FROM message
      JOIN chat ON chat._id = message.chat_row_id
      JOIN personen AS unterhaltung ON unterhaltung.person_id = chat.jid_row_id
      LEFT JOIN personen AS absender ON absender.person_id = message.sender_jid_row_id
      LEFT JOIN message_media ON message_media.message_row_id = message._id
      WHERE message.chat_row_id > 0 ORDER BY message.timestamp`;
    run('var s2 = parseSQLToBlocks(stage2, wsSchema)');
    assert.equal(run('s2.error'), undefined);
    assert.equal(run("s2.blocks.joins.filter(j => j.rightTable === 'temp.personen').map(j => j.rightAlias).join()"), 'unterhaltung,absender');
    assert.deepEqual(ws.exec(run('buildQuerySQL(s2.blocks)'))[0].values, ws.exec(ctx.stage2)[0].values);
    assert.deepEqual(ws.exec(ctx.stage2)[0].values.map(r => r[1]), ['Ich', 'Bob', 'Anna'], 'sender comes from the directory, chat name as fallback');
    // Dauerhafte Ansicht über zwei Datenbanken: angelegt, aber nicht lesbar → verständlicher Hinweis statt stiller Lücke
    ws.run('CREATE VIEW kaputt AS SELECT * FROM jid');
    assert.equal(run("brokenViews(ws).map(v => v.ns + '.' + v.name).join()"), 'main.kaputt');
    assert.equal(run("withWorkspaceObjects(ws, wsSchema.tables).some(t => t.localName === 'kaputt')"), false);
    ws.run('DROP VIEW main.kaputt');
    assert.equal(run('isSchemaChange("DROP VIEW temp.personen")') && !run(`isSchemaChange("UPDATE t SET note = 'create table'")`), true);
    // Datenbank geschlossen → Ansicht nicht lesbar → Karte verschwindet; wieder geöffnet → Karte kommt zurück
    ws.run('DETACH DATABASE wa');
    assert.equal(run("withWorkspaceObjects(ws, wsSchema.tables.filter(t => t.database !== 'wa')).some(t => t.name === 'temp.personen')"), false);
    ws.run('ATTACH DATABASE ? AS wa', [wa.filename]);
    assert.equal(run("withWorkspaceObjects(ws, wsSchema.tables).some(t => t.name === 'temp.personen')"), true);
    ws.run('DETACH DATABASE msgstore'); ws.run('DETACH DATABASE wa'); ms.close(); wa.close(); ws.close();
    console.log('PASS: bundle syntax, stable layouts, resized-card spacing, fit/scroll geometry, re-shown card placement, namespace isolation, foreign keys as dotted suggestions only, all JOIN types, stages, WHERE/GROUP/ORDER, SQL roundtrip, aliases + self-joins + CASE + ATTACH + UTC + Apple time units + fixed values, renaming roles and changing named joins, quoted names, targeted modifications, detach, views (TEMP VIEW over two databases, replace, two roles, broken views).');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
