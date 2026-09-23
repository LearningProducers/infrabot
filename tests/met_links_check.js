// met_links_check.js: THE MET LINKS (infrabot v0.11.0). The event form's MET
// box holds names; SAVE EVENT links each name to the Network contact of that
// name or creates one, the event carries the contact ids and each contact
// carries the events it was met at. One status act sits behind the form's
// select and the card's buttons.
//
// Runs the REAL parseMetNames, findContactByName, linkMetNames, syncMetLinks,
// metNamesText, metAtHtml, remapImportedMet, setEventStatus, moveEventStatus
// and their helpers extracted from infrabot.html by a brace walk (never a
// re-implementation) against SYNTHETIC records: invented names, invented
// rooms, invented ids. The real state file never enters this file: the repo
// is public.
//
// What it pins: names parse one per line or comma separated, trimmed, blank
// lines dropped, a duplicate (any case) collapsed to its first spelling; a
// name matches an existing contact case-insensitively and trimmed; a name
// with no contact creates one carrying the event's city and zone and
// nothing else; the event stores ids, never names; each linked contact's
// metAt lists the event id and title, in event-id order, and follows a
// title change; a name removed from the box unlinks and the contact
// survives; a dangling id renders no name and metAt is derived from the
// events alone, so two books holding the same records derive the same
// bytes and a second sync writes nothing; the import remap re-points an
// incoming met id onto the book's own card and drops an id no contact
// carries; one status act: the same function moves the status from the
// form's select and from the card's button, appends one history entry, and
// appends nothing on a no-change call; the source carries the form field,
// the autosave surface, the commit paths and the wiring (source pins).
//
// Run from the repo root:   node tests/met_links_check.js
//                     or:   jsc  tests/met_links_check.js
// Optional first argument: a path to a different infrabot.html to measure.
// Exit 0 on pass; exit 1 (node) or an uncaught error (jsc) on any failure.

var IS_NODE=typeof process!=='undefined'&&process.versions&&process.versions.node;
var SCRIPT_ARGS=IS_NODE?process.argv.slice(2):(typeof arguments!=='undefined'?Array.prototype.slice.call(arguments):[]);
(function(){
  var isNode=IS_NODE;
  var args=SCRIPT_ARGS;
  var readText=isNode?function(p){return require('fs').readFileSync(p,'utf8');}:readFile;
  var htmlPath=args[0]||(isNode?require('path').join(__dirname,'..','infrabot.html'):'infrabot.html');
  var out=isNode?function(s){console.log(s);}:print;
  var html=readText(htmlPath);

  function extractFn(src,name){
    var start=src.indexOf('function '+name+'(');
    if(start<0)throw new Error('extract: function '+name+' not found in '+htmlPath);
    var i=src.indexOf('{',start),depth=0;
    for(;i<src.length;i++){
      var ch=src[i];
      if(ch==='{')depth++;
      else if(ch==='}'){depth--;if(depth===0)return src.slice(start,i+1);}
    }
    throw new Error('extract: unbalanced braces in '+name);
  }
  function extractVar(src,name){
    var m=new RegExp('(?:var|const|let)\\s+'+name+'\\s*=').exec(src);
    if(!m)throw new Error('extract: constant '+name+' not found in '+htmlPath);
    var end=src.indexOf(';\n',m.index);
    if(end<0)throw new Error('extract: unterminated constant '+name);
    var line=src.slice(m.index,end+1);
    return line.replace(/^(var|const|let)\s+/,'var ');
  }

  var g=(typeof globalThis!=='undefined')?globalThis:this;
  var toasts=[];
  g.toast=function(msg){toasts.push(String(msg));};
  g.esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
  var ge=eval;
  ['EVENT_STATUSES','EVENT_OUTCOMES','uid'].forEach(function(n){ge(extractVar(html,n));});
  ['eventsList','homeTzNow','normalizeCost','normalizeEvent','eventStatusRank','setEventStatus',
   'moveEventStatus','parseMetNames','findContactByName','linkMetNames','syncMetLinks',
   'metNamesText','metAtHtml','remapImportedMet'].forEach(function(n){ge(extractFn(html,n));});

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,240)+']'));
    if(!ok)failures++;
  }
  function fresh(){
    g.state={
      profile:{homeTz:'America/Chicago'},
      network:[
        {id:'c_fixture_1',addedAt:'2026-09-01T00:00:00.000Z',lastTouchAt:null,touches:[],name:'Marisol Quintero',company:'Fixture Foundry',website:'',email:'',city:'Chicago',tz:'America/Chicago',notes:''}
      ],
      events:[
        {id:'e_fixture_b',title:'Fixture Hall Makers Night',organizer:'Fixture Hall',venue:'Fixture Hall',city:'Chicago',tz:'America/Chicago',start:'2026-10-02T18:00',url:'',cost:'free',status:'selected',statusHistory:[{status:'candidate',timestamp:'2026-09-01T00:00:00.000Z'},{status:'selected',timestamp:'2026-09-02T00:00:00.000Z'}],whyThisRoom:'Synthetic reason.',met:[],outcome:'none',notes:'',createdAt:'2026-09-01T00:00:00.000Z',updatedAt:'2026-09-02T00:00:00.000Z'},
        {id:'e_fixture_a',title:'Placeholder Pier Demo Day',organizer:'Placeholder Pier',venue:'Placeholder Pier',city:'Chicago',tz:'America/Chicago',start:'2026-10-09T09:00',url:'',cost:'free',status:'candidate',statusHistory:[{status:'candidate',timestamp:'2026-09-01T00:00:00.000Z'}],whyThisRoom:'Synthetic reason.',met:[],outcome:'none',notes:'',createdAt:'2026-09-01T00:00:00.000Z',updatedAt:'2026-09-01T00:00:00.000Z'}
      ]
    };
    toasts.length=0;
  }
  var T='2026-09-22T12:00:00.000Z';

  // --- P: the parser ------------------------------------------------------
  check('P1 one per line',JSON.stringify(parseMetNames('Ada Fixture\nBram Placeholder'))==='["Ada Fixture","Bram Placeholder"]');
  check('P2 comma separated',JSON.stringify(parseMetNames('Ada Fixture, Bram Placeholder'))==='["Ada Fixture","Bram Placeholder"]');
  check('P3 mixed, trimmed, blanks dropped',JSON.stringify(parseMetNames('  Ada Fixture ,\n\n Bram Placeholder\n,\n'))==='["Ada Fixture","Bram Placeholder"]');
  check('P4 duplicates collapse to the first spelling',JSON.stringify(parseMetNames('Ada Fixture\nada fixture\nADA FIXTURE'))==='["Ada Fixture"]');
  check('P5 empty box parses to nothing',parseMetNames('').length===0&&parseMetNames(null).length===0);

  // --- L: linking ---------------------------------------------------------
  fresh();
  var ev=state.events[0];
  var ids=linkMetNames(parseMetNames('  marisol quintero \nAda Fixture'),ev,T);
  check('L1 an existing contact matches by name, case-insensitive and trimmed',ids[0]==='c_fixture_1',JSON.stringify(ids));
  check('L2 a name with no contact creates one',state.network.length===2&&state.network[1].name==='Ada Fixture');
  var made=state.network[1];
  check('L3 the new contact carries the event city and zone and nothing else',made.city==='Chicago'&&made.tz==='America/Chicago'&&made.company===''&&made.email===''&&made.channel===''&&made.notes===''&&made.website==='',JSON.stringify(made));
  check('L4 the new contact has an id, addedAt and updatedAt at the save stamp',typeof made.id==='string'&&made.id.length>0&&made.addedAt===T&&made.updatedAt===T);
  check('L5 the event gets ids, never names',ids.length===2&&ids[1]===made.id&&ids.every(function(x){return x.indexOf(' ')<0;}));
  ev.met=ids;
  var changed=syncMetLinks(T);
  check('L6 syncMetLinks writes metAt on both linked contacts and reports a change',changed===true&&JSON.stringify(state.network[0].metAt)==='[{"eventId":"e_fixture_b","title":"Fixture Hall Makers Night"}]'&&JSON.stringify(made.metAt)==='[{"eventId":"e_fixture_b","title":"Fixture Hall Makers Night"}]',JSON.stringify(state.network));
  check('L7 a second sync on the same state writes nothing',syncMetLinks(T)===false);
  check('L8 the box shows the linked names, event order, one per line',metNamesText(ev)==='Marisol Quintero\nAda Fixture');
  // a second event links the same person: metAt lists both, in event-id order
  state.events[1].met=['c_fixture_1'];
  syncMetLinks(T);
  check('L9 metAt lists every event, in event-id order',JSON.stringify(state.network[0].metAt)==='[{"eventId":"e_fixture_a","title":"Placeholder Pier Demo Day"},{"eventId":"e_fixture_b","title":"Fixture Hall Makers Night"}]',JSON.stringify(state.network[0].metAt));
  ev.title='Fixture Hall Makers Night (renamed)';
  syncMetLinks(T);
  check('L10 metAt follows a title change',state.network[0].metAt[1].title==='Fixture Hall Makers Night (renamed)');
  // unlink: the name removed from the box
  ev.met=linkMetNames(parseMetNames('Ada Fixture'),ev,T);
  syncMetLinks(T);
  check('L11 a name removed unlinks: the event drops the id',JSON.stringify(ev.met)===JSON.stringify([made.id]));
  check('L12 the unlinked contact survives, its metAt for this event gone',state.network.length===2&&state.network[0].name==='Marisol Quintero'&&JSON.stringify(state.network[0].metAt)==='[{"eventId":"e_fixture_a","title":"Placeholder Pier Demo Day"}]');
  check('L13 a contact with no links keeps no metAt key when it never had one',(function(){fresh();state.network[0].name='Nobody Linked';var r=syncMetLinks(T);return r===false&&!('metAt' in state.network[0]);})());
  // dangling id
  fresh();
  ev=state.events[0];ev.met=['c_gone_fixture','c_fixture_1'];
  check('L14 a dangling id renders no name',metNamesText(ev)==='Marisol Quintero');
  check('L15 metAtHtml renders nothing for a contact with no links, and escapes titles',metAtHtml({})===''&&metAtHtml({metAt:[{eventId:'x',title:'<b>Room</b>'}]}).indexOf('&lt;b&gt;Room&lt;/b&gt;')>0);

  // --- D: determinism -----------------------------------------------------
  fresh();
  state.events[0].met=['c_fixture_1'];state.events[1].met=['c_fixture_1'];
  syncMetLinks(T);var bytes1=JSON.stringify(state.network[0].metAt);
  fresh();
  state.events.reverse();
  state.events[0].met=['c_fixture_1'];state.events[1].met=['c_fixture_1'];
  syncMetLinks(T);var bytes2=JSON.stringify(state.network[0].metAt);
  check('D1 metAt bytes do not depend on the events list order',bytes1===bytes2,bytes1+' vs '+bytes2);

  // --- R: the import remap ------------------------------------------------
  var remapped=remapImportedMet([
    {id:'e_in_1',met:['c_in_dup','c_in_new','c_in_nobody','c_in_dup']},
    {id:'e_in_2'},
    null
  ],{c_in_dup:'c_fixture_1',c_in_new:'c_in_new'});
  check('R1 an incoming id the book holds under another id is re-pointed',remapped[0].met[0]==='c_fixture_1');
  check('R2 an incoming id added as its own card keeps its id',remapped[0].met[1]==='c_in_new');
  check('R3 an id no contact carries is dropped, and a duplicate collapses',remapped[0].met.length===2,JSON.stringify(remapped[0].met));
  check('R4 a record with no met, or no record, passes through untouched',remapped[1].met===undefined&&remapped[2]===null);
  check('R5 the remap never mutates the incoming record',(function(){var raw={id:'e',met:['a']};remapImportedMet([raw],{a:'b'});return raw.met[0]==='a';})());

  // --- S: one status act --------------------------------------------------
  fresh();
  ev=state.events[1];
  var moved=moveEventStatus(ev,'selected',T);
  check('S1 the act moves the status and appends one history entry',moved===true&&ev.status==='selected'&&ev.statusHistory.length===2&&ev.statusHistory[1].status==='selected'&&ev.statusHistory[1].timestamp===T);
  check('S2 the act toasts the title and the status',toasts.length===1&&toasts[0]==='PLACEHOLDER PIER DEMO DAY · SELECTED',JSON.stringify(toasts));
  var again=moveEventStatus(ev,'selected',T);
  check('S3 a no-change call appends nothing and toasts nothing',again===false&&ev.statusHistory.length===2&&toasts.length===1);
  check('S4 an unknown status is refused',moveEventStatus(ev,'hosted',T)===false&&ev.status==='selected');
  check('S5 the form path and the card path call the one act (source)',
    /function saveEvent\([\s\S]*?moved=moveEventStatus\(e,status,now\)/.test(html)&&/function quickEventStatus\([\s\S]*?if\(!moveEventStatus\(e,status\)\)return;/.test(html));
  check('S6 setEventStatus has three sites: its definition, the act, the import ladder (source)',(html.match(/setEventStatus\(/g)||[]).length===3,String((html.match(/setEventStatus\(/g)||[]).length));
  check('S7 the select note names the pick and the save (source)',html.indexOf("'MOVES TO '+pick.toUpperCase()+' ON SAVE EVENT'")>0&&html.indexOf("g('ev-status').addEventListener('change',eventStatusNote)")>0);

  // --- F: the form and the record (source pins) ------------------------------
  check('F1 the MET field is a textarea, no checkbox',/<textarea id="ev-met"/.test(html)&&html.indexOf("querySelectorAll('input[type=checkbox]:checked')")<0);
  check('F2 the form reads the box back through metNamesText and saves through linkMetNames',html.indexOf("g('ev-met').value=metNamesText(v);")>0&&(html.match(/linkMetNames\(parseMetNames\(g\('ev-met'\)\.value\),e,now\)/g)||[]).length===2);
  check('F3 the contact form carries the CHANNEL field on every path',/<input type="text" id="c-channel"/.test(html)&&html.indexOf("'c-email','c-channel','c-city'")>0&&html.indexOf("rec.channel=(vals['c-channel']||'').trim();")>0&&html.indexOf("channel:(vals['c-channel']||'').trim()")>0&&html.indexOf("channel:g('c-channel').value.trim()")>0);
  check('F4 the contact card renders the channel and the met-at line',html.indexOf("${c.channel?' · '+esc(c.channel):''}")>0&&html.indexOf('${rowClock}${metAt}')>0);
  check('F5 the import re-points met ids before importEvents reads them',html.indexOf('importEvents(remapImportedMet(')>0);
  check('F6 the merge re-derives metAt and owes the file a sync on a change',html.indexOf('if(syncMetLinks(new Date().toISOString()))owed=true;')>0);
  check('F7 deleting a contact scrubs its id from every event',html.indexOf("e.met=e.met.filter(id=>id!==editingContactId)")>0);
  check('F8 deleting an event re-derives metAt',/state\.events=eventsList\(\)\.filter\(x=>x\.id!==editingEventId\);\n\s*syncMetLinks\(/.test(html));
  check('F9 schemaVersion stays 3: record-level fields only',html.indexOf('const STATE_SCHEMA_VERSION=3;')>0);
  check('F10 importEvents itself is untouched by name: the feed runner extracts it',html.indexOf('function importEvents(incoming){')>0&&extractFn(html,'importEvents').indexOf('syncMetLinks')<0&&extractFn(html,'importEvents').indexOf('remapImportedMet')<0);

  out(checks+' checks, '+failures+' failure(s)');
  if(failures){if(isNode)process.exit(1);throw new Error('met_links_check: '+failures+' failure(s)');}
})();
