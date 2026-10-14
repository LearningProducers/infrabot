// block_host_check.js: BLOCK HOST, THE BLOCK LIST, THE TWO FURTHER KEYS
// (infrabot v0.21.0). A host the founder blocked from a room card is absolute
// and permanent: nothing of theirs reaches him on any surface. The block list
// is a record list on the state (name, the platform's organizer id, the
// instant), carried by the export, kept across both full-replace imports and
// the server merge, and left only by the founder's hand in SETTINGS. Import
// dedupes on eventKey, then the platform key (Meetup's event id, Eventbrite's
// id, Luma's slug with lu.ma folded), then title, start minute and venue head,
// and folds the other listing's host in as a co-host.
//
// Runs the REAL helpers extracted from infrabot.html by a brace walk (never a
// re-implementation) against SYNTHETIC fixtures: invented hosts, invented
// rooms, hosts under the reserved .invalid domain and made-up platform ids.
// The real state file never enters this file: the repo is public.
//
// What it pins: the match (id, equal name, whole name inside a longer name,
// a spelling case change, the five-character floor, never a substring inside
// a word, co-hosts); the press (confirm once, the rows, open rooms skipped,
// attended kept, hidden from every surface, the contacts met there kept);
// the import refusal and its count; the three keys and the co-host fold; the
// export carrying the list and the full-replace union; the merge slice and
// the ledger; UNBLOCK as the one way off; the card's frame and its button;
// the source pins on every surface.
//
// Run from the repo root:   node tests/block_host_check.js
//                     or:   jsc  tests/block_host_check.js
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
  var toasts=[],confirms=[],confirmAnswer=true,rendered={network:0,overview:0,blocked:0},saves=0;
  g.toast=function(m){toasts.push(String(m));};
  g.confirm=function(m){confirms.push(String(m));return confirmAnswer;};
  g.renderNetwork=function(){rendered.network++;};
  g.renderOverview=function(){rendered.overview++;};
  g.saveState=function(){saves++;return true;};
  g.esc=function(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');};
  g.linkHtml=function(u){return '<a>'+g.esc(u)+'</a>';};
  g.fmtEventWhen=function(){return 'WHEN';}; // the clock line is the clocks' own, pinned elsewhere
  var dom={};
  g.g=function(id){return dom[id]||null;};
  g.localStorage={getItem:function(){return null;},setItem:function(){},removeItem:function(){}};
  var ge=eval;
  ['EVENT_STATUSES','EVENT_OUTCOMES','NETWORK_VIEWS','networkView','eventsCityFilter','HOST_NAME_FLOOR','STATE_SCHEMA_VERSION','uid'].forEach(function(n){ge(extractVar(html,n));});
  ['eventsList','homeTzNow','normalizeCost','normalizeEvent','eventStatusRank','setEventStatus','eventKey','eventPlatformKey','venueHead','eventMatchKey',
   'blockedHostsList','normHostName','hostMatches','eventHosts','hostBlocked','eventsVisible','normalizeCoHosts','addCoHosts','unionBlockedHosts',
   'addBlockedHost','applyBlockToEvents','blockHost','unblockHost','renderBlockedHosts','importEvents','wallTimeToDate','localYearMonth','eventStartMonth',
   'byEventStart','roomsInMonth','eventCities','eventsShown','eventPassed','fmtCost','renderEventCard','recordTouch','mergeRecordSlice',
   'allStateIds','callsList','artifactsList','_canonicalJson','getCommBucket','buildStateExport','personTier','acquaintanceMonth','latestMetRoom','metAtHtml'
  ].forEach(function(n){ge(extractFn(html,n));});

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,240)+']'));
    if(!ok)failures++;
  }
  var T0='2026-03-10T15:00:00.000Z';
  function room(id,title,host,extra){
    return Object.assign({id:id,title:title,organizer:host,organizerId:'',coHosts:[],venue:'Fixture Hall, 1 Sample St',city:'Chicago',tz:'America/Chicago',
      start:'2026-03-20T18:00',url:'https://rooms.invalid/'+id,cost:'free',status:'candidate',statusHistory:[{status:'candidate',timestamp:T0}],
      whyThisRoom:'Synthetic reason.',met:[],outcome:'none',notes:'',createdAt:T0,updatedAt:T0},extra||{});
  }
  function fresh(){
    g.state={profile:{homeTz:'America/Chicago'},network:[{id:'c_fx_1',name:'Ada Fixture',metAt:[{eventId:'e_att',title:'Placeholder Pier Demo Day'}]}],
      comms:[],artifacts:[],calls:[],events:[
        room('e_a','Mock Foundry Meetup','Fixture Guild',{organizerId:'meetup:group:111'}),
        room('e_b','Stub Harbor Salon','Fixture Guild (Chapter Two) with Sample Partners'),
        room('e_sel','Dummy Depot Demo','Fixture Guild',{status:'selected',statusHistory:[{status:'candidate',timestamp:T0},{status:'selected',timestamp:T0}]}),
        room('e_att','Placeholder Pier Demo Day','Fixture Guild',{status:'attended',statusHistory:[{status:'candidate',timestamp:T0},{status:'attended',timestamp:T0}],met:['c_fx_1'],outcome:'conversation'}),
        room('e_co','Prop Warehouse Mixer','Other Collective',{coHosts:[{name:'Fixture Guild',organizerId:''}]}),
        room('e_other','Sample Loft Open Studio','Other Collective',{organizerId:'eventbrite:o:222'}),
        room('e_short','Guild Night','Guild')
      ],blockedHosts:[]};
    toasts=[];confirms=[];confirmAnswer=true;rendered={network:0,overview:0,blocked:0};saves=0;
    dom={'blocked-hosts':{innerHTML:''}};
  }
  g.renderBlockedHosts=renderBlockedHosts;

  // --- M: the match --------------------------------------------------------
  fresh();
  check('M1 the platform id matches whatever the name reads',hostMatches({name:'Old Name',organizerId:'meetup:group:111'},'Renamed Guild','meetup:group:111'));
  check('M2 two different ids never match on the id leg',!hostMatches({name:'Alpha Fixture Co',organizerId:'eventbrite:o:1'},'Beta Placeholder Co','eventbrite:o:2'));
  check('M3 the normalized full name matches, case and spacing aside',hostMatches({name:'Fixture  Guild'},'fixture guild','')&&hostMatches({name:'Fixture Guild'},'FIXTURE GUILD','x'));
  check('M4 curly quotes read straight',hostMatches({name:"Sample’s Collective"},"Sample's Collective",''));
  check('M5 the whole name standing inside a longer name matches (a co-host suffix, a chapter)',hostMatches({name:'Fixture Guild'},'Fixture Guild (Chapter Two) with Sample Partners','')&&hostMatches({name:'Sample Partners'},'Fixture Guild with Sample Partners',''));
  check('M6 a name inside a word never matches',!hostMatches({name:'Fixture Guild'},'Fixture Guilders Union',''));
  check('M7 a name under the floor matches only when equal; a name at the floor matches whole',!hostMatches({name:'Gild'},'Fixture Gild','')&&hostMatches({name:'Gild'},'gild','')&&hostMatches({name:'Guild'},'Fixture Guild',''));
  check('M8 an empty block never matches',!hostMatches({name:'',organizerId:''},'Fixture Guild','')&&!hostMatches({name:''},'',''));
  check('M9 a co-host is a host of the room',hostBlocked(room('x','T','Other Collective',{coHosts:[{name:'Fixture Guild'}]}))===false&&(function(){state.blockedHosts=[{id:'b1',name:'Fixture Guild',organizerId:'',blockedAt:T0}];var r=hostBlocked(room('x','T','Other Collective',{coHosts:[{name:'Fixture Guild'}]}));state.blockedHosts=[];return r;})());

  // --- P: the press --------------------------------------------------------
  fresh();
  var ok=blockHost('e_a');
  check('P1 the press asks once and returns true',ok===true&&confirms.length===1&&/BLOCK Fixture Guild\?/.test(confirms[0])&&/SETTINGS/.test(confirms[0]),confirms.join('|'));
  check('P2 one row on the list, the name and the platform id and the instant',blockedHostsList().length===1&&blockedHostsList()[0].name==='Fixture Guild'&&blockedHostsList()[0].organizerId==='meetup:group:111'&&/^\d{4}-\d{2}-\d{2}T/.test(blockedHostsList()[0].blockedAt)&&/^id_/.test(blockedHostsList()[0].id),JSON.stringify(blockedHostsList()));
  var byId={};state.events.forEach(function(e){byId[e.id]=e;});
  check('P3 the open rooms of that host are skipped through the one transition (the candidate, the chapter listing, the selected, the co-hosted)',byId.e_a.status==='skipped'&&byId.e_b.status==='skipped'&&byId.e_sel.status==='skipped'&&byId.e_co.status==='skipped'&&byId.e_a.statusHistory.length===2&&byId.e_a.statusHistory[1].status==='skipped');
  check('P4 the attended room keeps its state and its history',byId.e_att.status==='attended'&&byId.e_att.statusHistory.length===2);
  check('P5 the other host\'s room and the short-named room are untouched',byId.e_other.status==='candidate'&&byId.e_short.status==='candidate');
  check('P6 the press saves, re-renders and says what it did',saves===1&&rendered.network===1&&rendered.overview===1&&/BLOCKED · FIXTURE GUILD · 4 ROOMS SKIPPED/.test(toasts[0]),toasts.join('|'));
  var vis=eventsVisible().map(function(e){return e.id;});
  check('P7 every room of the blocked host leaves the visible list, the attended one too; the others stay',vis.join(',')==='e_other,e_short',vis.join(','));
  check('P8 the record keeps every room',eventsList().length===7);
  check('P9 the pills, the cities and the month read the visible list only',eventsShown().length===2&&eventCities().join()==='Chicago'&&roomsInMonth('2026-03').length===0);
  check('P10 the contact met there stays, with no title of the blocked room on any surface',state.network.length===1&&metAtHtml(state.network[0])===''&&latestMetRoom(state.network[0])===null&&acquaintanceMonth(state.network[0])===null);
  fresh();
  blockHost('e_a');var again=blockHost('e_b');
  check('P11 a second press on a host already on the list adds no row',again===true&&blockedHostsList().length===1);
  fresh();confirmAnswer=false;
  check('P12 a declined confirm changes nothing',blockHost('e_a')===false&&blockedHostsList().length===0&&state.events[0].status==='candidate'&&saves===0);
  fresh();
  check('P13 a room with no host named refuses the press and says so',blockHost(state.events.push(room('e_none','Nameless Night',''))&&'e_none')===false&&/NO HOST NAMED/.test(toasts[0]));

  // --- I: the import -------------------------------------------------------
  fresh();
  state.blockedHosts=[{id:'b1',name:'Fixture Guild',organizerId:'meetup:group:111',blockedAt:T0}];
  var r=importEvents([
    room('i1','Fresh Fixture Night','Renamed Guild',{organizerId:'meetup:group:111',url:'https://rooms.invalid/i1'}),
    room('i2','Another Night','Fixture Guild',{url:'https://rooms.invalid/i2'}),
    room('i3','Side Night','Other Collective',{coHosts:[{name:'fixture guild'}],url:'https://rooms.invalid/i3'}),
    room('i4','Clean Night','Clean Placeholder Co',{url:'https://rooms.invalid/i4'})
  ]);
  check('I1 a blocked host is refused at import by id, by name and as a co-host, counted, never stored',r.blocked===3&&r.added===1&&r.refused===0&&eventsList().length===8&&!eventsList().some(function(e){return e.id==='i1'||e.id==='i2'||e.id==='i3';}),JSON.stringify(r));
  fresh();
  var r2=importEvents([room('k1','Twin Room','Alpha Fixture Co',{url:'https://www.meetup.com/old-slug/events/316000001/',venue:'Aon Center'}),
                       room('k2','Twin Room','Alpha Fixture Co (formerly Alpha)',{url:'https://www.meetup.com/new-slug/events/316000001/',venue:'Aon Center, 200 E Sample St, Chicago, IL'})]);
  var twin=eventsList().filter(function(e){return e.title==='Twin Room';});
  check('K1 one Meetup event id under two slugs is one card; the first link stays',r2.added===1&&(r2.skipped===1||r2.updated===1)&&twin.length===1&&twin[0].url==='https://www.meetup.com/old-slug/events/316000001/',JSON.stringify(r2));
  check('K1 the second listing\'s host is the same host, so no co-host is added',twin[0].coHosts.length===0,JSON.stringify(twin[0].coHosts));
  fresh();
  var r3=importEvents([room('k3','Builder Lab','Group One',{url:'https://rooms.invalid/k3',venue:'311 North Green Street'}),
                       room('k4','Builder Lab','Group Two',{url:'https://rooms.invalid/k4',venue:'311 North Green Street, 311 N Green St, Chicago, IL 60607'})]);
  var lab=eventsList().filter(function(e){return e.title==='Builder Lab';});
  check('K2 same title, start minute and venue head under two links is one card with the other group as co-host',r3.added===1&&r3.updated===1&&lab.length===1&&lab[0].url==='https://rooms.invalid/k3'&&lab[0].coHosts.length===1&&lab[0].coHosts[0].name==='Group Two',JSON.stringify(lab[0]&&lab[0].coHosts));
  fresh();
  var r4=importEvents([room('k5','Builder Lab','Group One',{url:'https://rooms.invalid/k5',venue:'311 North Green Street'}),
                       room('k6','Builder Lab','Group Three',{url:'https://rooms.invalid/k6',venue:'800 W Fulton Market'})]);
  check('K3 the same title and start at a different venue stays its own card',r4.added===2);
  check('K4 the platform key folds lu.ma into luma.com and reads the three ids',eventPlatformKey({url:'https://lu.ma/play-6wlq',start:'2026-03-20T18:00'})===eventPlatformKey({url:'https://luma.com/play-6wlq/',start:'2026-03-20T18:00'})&&eventPlatformKey({url:'https://www.meetup.com/x/events/316000001/',start:'2026-03-20T18:00'})==='meetup:316000001|2026-03-20'&&eventPlatformKey({url:'https://www.eventbrite.com/e/some-room-tickets-2002609710553',start:'2026-03-20T18:00'})==='eventbrite:2002609710553|2026-03-20'&&eventPlatformKey({url:'',start:'2026-03-20T18:00'})==='');
  check('K5 the match key is empty without a title, a start or a venue',eventMatchKey({title:'T',start:'',venue:'V'})===''&&eventMatchKey({title:'',start:'2026-03-20T18:00',venue:'V'})===''&&eventMatchKey({title:'T',start:'2026-03-20T18:00',venue:''})===''&&eventMatchKey({title:'T',start:'2026-03-20T18:00',venue:'Aon Center, 200 E'})==='t|2026-03-20T18:00|aon center');
  check('K6 a same-key import still moves status up only and fills nothing written',(function(){fresh();state.events=[room('x1','Twin','Alpha Fixture Co',{url:'https://www.meetup.com/a/events/316000002/',status:'selected',notes:'hand'})];var rr=importEvents([room('x2','Twin','Alpha Fixture Co',{url:'https://www.meetup.com/b/events/316000002/',status:'candidate',notes:'machine'})]);return rr.skipped===1&&state.events.length===1&&state.events[0].status==='selected'&&state.events[0].notes==='hand';})());

  // --- E: the export and the two full-replace doors --------------------------
  fresh();
  state.blockedHosts=[{id:'id_b2',name:'Zed Fixture',organizerId:'',blockedAt:T0},{id:'id_b1',name:'Fixture Guild',organizerId:'meetup:group:111',blockedAt:T0}];
  var exp=JSON.parse(buildStateExport());
  check('E1 the export carries the block list, sorted by id, every field',Array.isArray(exp.blockedHosts)&&exp.blockedHosts.length===2&&exp.blockedHosts[0].id==='id_b1'&&exp.blockedHosts[1].name==='Zed Fixture'&&exp.schemaVersion===3,JSON.stringify(exp.blockedHosts));
  var u=unionBlockedHosts([{id:'id_b1',name:'Fixture Guild',organizerId:'',blockedAt:'2026-03-12T00:00:00.000Z'}],[{id:'id_b9',name:'fixture guild',organizerId:'meetup:group:111',blockedAt:'2026-03-11T00:00:00.000Z'},{id:'id_b3',name:'Third Placeholder',organizerId:'',blockedAt:T0},{name:'',organizerId:''}]);
  check('E2 two lists union to one row per host, the id learned and the earlier instant kept, an empty row dropped',u.length===2&&u[0].id==='id_b1'&&u[0].organizerId==='meetup:group:111'&&u[0].blockedAt==='2026-03-11T00:00:00.000Z'&&u[1].name==='Third Placeholder',JSON.stringify(u));
  check('E3 the full-replace doors union the prior list with the file\'s and apply it (source)',(function(){var ij=extractFn(html,'importJson'),sl=extractFn(html,'snapshotLoad');return ij.indexOf('const priorBlocks=blockedHostsList().slice();')>0&&ij.indexOf('state.blockedHosts=unionBlockedHosts(priorBlocks,parsed.blockedHosts);applyBlockToEvents();')>0&&sl.indexOf('const priorBlocks=blockedHostsList().slice();')>0&&sl.indexOf('state.blockedHosts=unionBlockedHosts(priorBlocks,parsed.blockedHosts);applyBlockToEvents();')>0;})());
  check('E4 the additive import unions the file\'s blocks before reading its rooms and counts both (source)',(function(){var a=extractFn(html,'additiveImportState');return a.indexOf('state.blockedHosts=unionBlockedHosts(blockedHostsList(),payload.blockedHosts);')>0&&a.indexOf('state.blockedHosts=unionBlockedHosts')<a.indexOf('var ev=importEvents(')&&a.indexOf('blockedEvents:ev.blocked,blockedHostsAdded:blocksAdded')>0;})());
  check('E5 the import toast names the two counts (source)',html.indexOf("' REFUSED: BLOCKED HOST'")>0&&html.indexOf("' BLOCKED FROM THE FILE'")>0);
  check('E6 the fresh book and the load migration carry the list (source)',extractFn(html,'freshState').indexOf('blockedHosts:[],')>0&&extractFn(html,'loadState').indexOf('if(!Array.isArray(s.blockedHosts))s.blockedHosts=[];')>0);

  // --- S: the merge slice and the ledger ---------------------------------------
  var rowA={id:'id_b1',name:'Fixture Guild',organizerId:'',blockedAt:T0},rowB={id:'id_b2',name:'Zed Fixture',organizerId:'',blockedAt:T0};
  var m1=mergeRecordSlice([rowA,rowB],[rowA],null,{id_b1:true,id_b2:true});
  check('S1 a block the file let go (the founder\'s hand in another tab) leaves by the drop rule',m1.records.length===1&&m1.dropped.join()==='id_b2');
  var m2=mergeRecordSlice([rowA,rowB],[rowA],null,{id_b1:true});
  check('S2 a block this tab added since its last sync rides along and owes the sync',m2.records.length===2&&m2.localWon===true);
  var m3=mergeRecordSlice([rowA],[rowA,rowB],null,{id_b1:true});
  check('S3 a block the file carries lands in the tab',m3.records.length===2&&m3.records[1].id==='id_b2');
  fresh();state.blockedHosts=[rowA];
  check('S4 the ledger covers the block list',allStateIds().id_b1===true);
  check('S5 the server merge takes the block slice and ledgers its ids (source)',(function(){var msv=extractFn(html,'mergeServerState');return msv.indexOf("state.blockedHosts=take(mergeRecordSlice(blockedHostsList(),Array.isArray(file.blockedHosts)?file.blockedHosts:[],null,_syncedIds));")>0&&msv.indexOf('Array.isArray(file.blockedHosts)?file.blockedHosts:[]].forEach(')>0&&msv.indexOf('renderBlockedHosts();')>0;})());

  // --- U: the one way off ------------------------------------------------------
  fresh();
  blockHost('e_a');var bid=blockedHostsList()[0].id;toasts=[];
  var un=unblockHost(bid);
  check('U1 UNBLOCK asks once, removes the row and the rooms show again',un===true&&confirms.length===2&&blockedHostsList().length===0&&eventsVisible().length===7&&/UNBLOCKED · FIXTURE GUILD/.test(toasts[0]),toasts.join('|'));
  check('U2 the rooms the block skipped stay skipped (the fold holds them)',state.events[0].status==='skipped');
  check('U3 an unknown id does nothing',unblockHost('id_nope')===false&&confirms.length===2);
  fresh();state.blockedHosts=[rowB,rowA];
  renderBlockedHosts();
  var box=dom['blocked-hosts'].innerHTML;
  check('U4 the drawer lists every block by name with its date and an UNBLOCK control, sorted by name',box.indexOf('Fixture Guild')>0&&box.indexOf('Fixture Guild')<box.indexOf('Zed Fixture')&&(box.match(/data-act="unblock-host"/g)||[]).length===2&&box.indexOf('since 2026-03-10')>0,box);
  fresh();renderBlockedHosts();
  check('U5 an empty list says so',/No host blocked/.test(dom['blocked-hosts'].innerHTML));
  check('U6 the drawer carries the block and the one listener, and only unblockHost removes a row (source)',html.indexOf('<div class="drawer-block-h">BLOCKED HOSTS</div>')>0&&html.indexOf('<div id="blocked-hosts"></div>')>0&&html.indexOf("g('blocked-hosts').addEventListener('click'")>0&&(html.match(/state\.blockedHosts=list\.filter\(x=>x\.id!==id\);/g)||[]).length===1&&extractFn(html,'openDrawer').indexOf('renderBlockedHosts();')>0);

  // --- C: the card ---------------------------------------------------------
  fresh();
  var card=renderEventCard(normalizeEvent(room('e_c','Card Room','Fixture Guild',{coHosts:[{name:'Sample Partners'}],notes:'a note'})));
  check('C1 the card sits in the call card\'s frame with BLOCK HOST beside SKIP',card.indexOf('<div class="card call-card">')===0&&card.indexOf('data-act="block-host" data-id="e_c">BLOCK HOST</button>')>0&&card.indexOf('data-act="skip-event"')>0&&card.indexOf('data-act="skip-event"')<card.indexOf('data-act="block-host"'));
  check('C2 the co-hosts read on the host line',card.indexOf('Fixture Guild with Sample Partners · Fixture Hall, 1 Sample St · CHICAGO')>0);
  check('C3 the mono sections read at the call card\'s sizes, no inline size',card.indexOf('card-section-body cite-page')>0&&card.indexOf('card-section-body call-mono')>0&&card.indexOf('font-size:11px')<0&&card.indexOf('font-size:12px')<0);
  var att=renderEventCard(normalizeEvent(room('e_d','Attended Room','Fixture Guild',{status:'attended'})));
  check('C4 an attended room carries BLOCK HOST too',att.indexOf('data-act="block-host"')>0&&att.indexOf('data-act="skip-event"')<0);
  check('C5 the events grid is the one-across grid and the dispatcher routes the press (source)',extractFn(html,'renderEventsView').indexOf('<div class="card-grid calls-grid">${list.map(renderEventCard)')>0&&html.indexOf("if(act==='block-host')blockHost(id);")>0);
  check('C6 the record normalizes organizerId and coHosts',(function(){var e=normalizeEvent({title:'x',coHosts:['Dup Co',{name:' Dup Co '},{name:'',organizerId:'eventbrite:o:9'}]});return e.organizerId===''&&e.coHosts.length===2&&e.coHosts[0].name==='Dup Co'&&e.coHosts[1].organizerId==='eventbrite:o:9';})());
  check('C7 every room surface reads eventsVisible, and the two met-at readers hide a blocked room\'s title (source)',['roomsInMonth','eventCities','eventsShown','eventMonthCounts','activityMonths','scoreboardCounts','renderReportsPanel','acquaintanceMonth','latestMetRoom'].every(function(n){return extractFn(html,n).indexOf('eventsVisible()')>0;})&&['metAtHtml','applyTierLayout'].every(function(n){return extractFn(html,n).indexOf('eventsList().filter(hostBlocked)')>0;}));
  check('C8 the four version sites read v0.21.0',(html.match(/v0\.21\.0/g)||[]).length>=4&&html.indexOf("const APP_VERSION='infrabot-v0.21.0';")>0&&html.indexOf('INFRABOT v0.21.0 · LPI')>0&&html.indexOf('title="INFRABOT build">v0.21.0<')>0);

  out(checks+' checks, '+failures+' failure(s)');
  if(failures){if(isNode)process.exit(1);throw new Error('block_host_check: '+failures+' failure(s)');}
})();
