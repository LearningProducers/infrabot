// room_pills_check.js: THE ROOM PILLS (infrabot v0.12.0). The NETWORK bar
// reads CONTACTS, CANDIDATES, SELECTED, ATTENDED, each counting what its
// pill renders; SKIPPED is a folded group at the foot of CANDIDATES; the
// city filter narrows every events pill; ATTENDED shows the rooms whose
// event date falls in the current home-zone month through the one window
// the comms archive also reads; earlier rooms print in that month's report.
//
// Runs the REAL inMonthWindow, inArchiveWindow, archiveMonth, localYearMonth,
// eventStartMonth, byEventStart, roomsInMonth, eventCities, eventsShown,
// networkViewBar, setNetworkView and their helpers extracted from
// infrabot.html by a brace walk (never a re-implementation) against
// SYNTHETIC records: invented rooms, invented organizers, synthetic dates;
// the city names are real place names on invented rooms, no real event. The
// current month is read through the app's own localYearMonth, so the fixture
// places rooms relative to it and the check holds in any month. The real
// state file never enters this file: the repo is public.
//
// What it pins: the window renders the current month and a null month on
// either side, and refuses an earlier month; the comms archive window
// delegates to it (source and behavior); a room's month is its start read
// through the event's own zone into the home zone; roomsInMonth lists
// attended rooms by event date, sorted by start, never a candidate, never a
// selected room; the pill counts equal what each pill renders (candidates,
// selected, attended-this-month), the city filter narrows all of them, a
// filter naming a city no room carries clears itself; the legacy 'events'
// view resolves to candidates and an unknown view is refused; a room that
// leaves the ATTENDED pill keeps its status and its history (no move, no
// write); the report month set includes a room-only month, the month card
// counts rooms, the .txt carries a ROOMS section with the five named fields,
// and the scoreboard's rooms lane and the ROOMS THIS MONTH cell are
// untouched (source pins).
//
// Run from the repo root:   node tests/room_pills_check.js
//                     or:   jsc  tests/room_pills_check.js
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
  var rendered=0;
  g.renderNetwork=function(){rendered++;};
  var ge=eval;
  ['EVENT_STATUSES','EVENT_OUTCOMES','NETWORK_VIEWS','networkView','eventsCityFilter'].forEach(function(n){ge(extractVar(html,n));});
  ['eventsList','homeTzNow','normalizeCost','normalizeEvent','wallTimeToDate','localYearMonth','archiveMonth',
   'inMonthWindow','inArchiveWindow','eventStartMonth','byEventStart','roomsInMonth','eventCities','eventsShown',
   'personTier','acquaintanceMonth','networkViewBar','setNetworkView'].forEach(function(n){ge(extractFn(html,n));});

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,240)+']'));
    if(!ok)failures++;
  }

  // The current home-zone month, read through the app's own derivation, and
  // a month well before it, so the fixture holds whatever today's date is.
  g.state={profile:{homeTz:'America/Chicago'},network:[{id:'c_fx_1',name:'Ada Fixture'},{id:'c_fx_2',name:'Bram Placeholder'}],events:[]};
  var NOW=localYearMonth(Date.now());
  var y=parseInt(NOW.slice(0,4),10),m=parseInt(NOW.slice(5,7),10);
  var EARLIER=(m>2?y+'-'+String(m-2).padStart(2,'0'):(y-1)+'-'+String(m+10).padStart(2,'0'));
  function room(id,title,city,ym,status,extra){
    var day=ym+'-15';
    var hist=[{status:'candidate',timestamp:day+'T15:00:00.000Z'}];
    if(status!=='candidate')hist.push({status:status,timestamp:day+'T16:00:00.000Z'});
    return Object.assign({id:id,title:title,organizer:'Fixture Guild',venue:'Fixture Hall',city:city,tz:'America/Chicago',
      start:day+'T18:00',url:'',cost:'free',status:status,statusHistory:hist,whyThisRoom:'Synthetic reason.',met:[],outcome:'none',
      notes:'',createdAt:day+'T15:00:00.000Z',updatedAt:day+'T16:00:00.000Z'},extra||{});
  }
  function fresh(){
    state.events=[
      room('e_att_now','Fixture Hall Makers Night','Chicago',NOW,'attended',{met:['c_fx_1','c_fx_2'],outcome:'conversation'}),
      room('e_att_old','Placeholder Pier Demo Day','Chicago',EARLIER,'attended',{met:['c_fx_1'],outcome:'meeting'}),
      room('e_att_old_b','Sample Loft Open Studio','Milwaukee',EARLIER,'attended'),
      room('e_cand_a','Mock Foundry Meetup','Chicago',NOW,'candidate'),
      room('e_cand_b','Stub Harbor Salon','Milwaukee',NOW,'candidate'),
      room('e_sel','Dummy Depot Demo','Chicago',NOW,'selected'),
      room('e_skip','Prop Warehouse Mixer','Chicago',NOW,'skipped'),
      room('e_nodate','Fixture Loft Undated','Chicago',NOW,'attended',{start:''})
    ];
    g.networkView='contacts';g.eventsCityFilter='';rendered=0;
  }

  // --- W: the window -------------------------------------------------------
  check('W1 the current month renders',inMonthWindow(NOW)===true);
  check('W2 an earlier month does not',inMonthWindow(EARLIER)===false);
  check('W3 a null month renders (fail visible)',inMonthWindow(null)===true&&inMonthWindow(undefined)===true);
  check('W4 the comms archive window delegates (source)',/function inArchiveWindow\(c\)\{\s*return inMonthWindow\(archiveMonth\(c\)\);/.test(html));
  check('W5 the comms archive window behaves as before through the shared rule',
    inArchiveWindow({statusHistory:[{status:'sent',timestamp:'2026-01-05T17:00:00.000Z'},{status:'ghosted',timestamp:NOW+'-05T17:00:00.000Z'}]})===true
    &&inArchiveWindow({statusHistory:[{status:'sent',timestamp:'2026-01-05T17:00:00.000Z'},{status:'ghosted',timestamp:EARLIER+'-05T17:00:00.000Z'}]})===false
    &&inArchiveWindow({statusHistory:[]})===true);

  // --- M: a room's month ---------------------------------------------------
  fresh();
  check('M1 a room\'s month is its start in the home zone',eventStartMonth(state.events[0])===NOW&&eventStartMonth(state.events[1])===EARLIER);
  check('M2 a room with no start has no month, and the window renders it',eventStartMonth(state.events[7])===null&&inMonthWindow(eventStartMonth(state.events[7]))===true);
  check('M3 a late-night start in a zone east of home reads the home month at a month edge',(function(){
    var e={start:'2026-04-01T00:30',tz:'Europe/London'};
    return eventStartMonth(e)==='2026-03';
  })());
  var rooms=roomsInMonth(EARLIER);
  check('M4 roomsInMonth lists attended rooms by event date, sorted by start',rooms.length===2&&rooms[0].id==='e_att_old'&&rooms[1].id==='e_att_old_b',JSON.stringify(rooms.map(function(r){return r.id;})));
  check('M5 roomsInMonth never lists a candidate, a selected, a skipped or an undated room',roomsInMonth(NOW).every(function(r){return r.status==='attended';})&&roomsInMonth(NOW).length===1&&roomsInMonth(NOW)[0].id==='e_att_now',JSON.stringify(roomsInMonth(NOW).map(function(r){return r.id;})));
  check('M6 a room whose month is unknown lists in no month',roomsInMonth(NOW).concat(roomsInMonth(EARLIER)).every(function(r){return r.id!=='e_nodate';}));

  // --- P: the pills --------------------------------------------------------
  fresh();
  var bar=networkViewBar();
  function count(bar,v){var m=new RegExp('data-view="'+v+'">'+v.toUpperCase()+'<span class="triage-count">· (\\d+)</span>').exec(bar);return m?parseInt(m[1],10):null;}
  check('P1 four pills in one row, in order',/data-view="contacts"[\s\S]*data-view="candidates"[\s\S]*data-view="selected"[\s\S]*data-view="attended"/.test(bar)&&bar.indexOf('data-view="events"')<0&&bar.indexOf('data-view="skipped"')<0);
  check('P2 CONTACTS counts the contacts',count(bar,'contacts')===2);
  check('P3 CANDIDATES counts candidates only, never the skipped',count(bar,'candidates')===2);
  check('P4 SELECTED counts the selected',count(bar,'selected')===1);
  check('P5 ATTENDED counts this month\'s rooms and the undated one, not the earlier two',count(bar,'attended')===2,bar);
  g.eventsCityFilter='milwaukee';
  bar=networkViewBar();
  check('P6 the city filter narrows every events pill',count(bar,'candidates')===1&&count(bar,'selected')===0&&count(bar,'attended')===0&&count(bar,'contacts')===2,bar);
  g.eventsCityFilter='nowhere';
  bar=networkViewBar();
  check('P7 a filter naming a city no room carries clears itself',g.eventsCityFilter===''&&count(bar,'candidates')===2);
  check('P8 eventCities lists every city once, sorted',JSON.stringify(eventCities())==='["Chicago","Milwaukee"]');
  check('P9 the active pill is marked',(function(){g.networkView='attended';return /class="triage-btn active" data-view="attended"/.test(networkViewBar());})());

  // --- V: the views --------------------------------------------------------
  fresh();
  setNetworkView('events');
  check('V1 the legacy events view resolves to candidates and renders',g.networkView==='candidates'&&rendered===1);
  setNetworkView('hosted');
  check('V2 an unknown view is refused',g.networkView==='candidates'&&rendered===1);
  setNetworkView('attended');
  check('V3 a known view is taken',g.networkView==='attended'&&rendered===2);

  // --- N: no move, no write ------------------------------------------------
  fresh();
  var before=JSON.stringify(state.events);
  networkViewBar();roomsInMonth(NOW);roomsInMonth(EARLIER);eventsShown();
  check('N1 rendering the pills and the report list moves no status and writes no record',JSON.stringify(state.events)===before&&state.events[1].status==='attended'&&state.events[1].statusHistory.length===2);

  // --- S: source pins ------------------------------------------------------
  check('S1 renderEventsView folds SKIPPED under CANDIDATES in a details element',/networkView==='candidates'[\s\S]*?<details class="skip-fold"><summary[^>]*>SKIPPED · \$\{skipped\.length\}<\/summary>/.test(html));
  check('S2 renderEventsView\'s ATTENDED view filters through inMonthWindow(eventStartMonth(e)) and names the earlier rooms',html.indexOf("const thisMonth=att.filter(e=>inMonthWindow(eventStartMonth(e))).sort(byEventStart);")>0&&html.indexOf("EARLIER ROOM${earlier===1?'':'S'} · IN THEIR MONTH'S REPORT")>0);
  check('S3 every events pill reads eventsShown, the one city-filtered list',(html.match(/eventsShown\(\)/g)||[]).length>=2&&extractFn(html,'renderEventsView').indexOf('eventsShown()')>0&&extractFn(html,'networkViewBar').indexOf('eventsShown()')>0);
  check('S4 renderNetwork routes every events view to the events view (v0.13.0: the two people views aside)',html.indexOf("if(networkView!=='contacts'&&networkView!=='acquaintances'){body.innerHTML=viewBar+renderEventsView();return;}")>0);
  check('S5 the report month set includes a room-only month',extractFn(html,'renderReportsPanel').indexOf("if(e.status==='attended'){const ym=eventStartMonth(e);if(ym)monthSet.add(ym);}")>0);
  check('S6 the month card counts rooms through roomsInMonth',extractFn(html,'renderReportsPanel').indexOf('const rooms=roomsInMonth(ym).length;')>0&&extractFn(html,'renderReportsPanel').indexOf('${rooms}</span> rooms')>0);
  var dl=extractFn(html,'downloadMonthReport');
  check('S7 the .txt carries a ROOMS section with title, organizer, city, met count and outcome',dl.indexOf("lines.push('ROOMS ('+roomsThis.length+')');")>0&&dl.indexOf("'  Organizer: '")>0&&dl.indexOf("'  City:      '")>0&&dl.indexOf("'  Met:       '+e.met.length")>0&&dl.indexOf("'  Outcome:   '+String(e.outcome||'none').toUpperCase()")>0&&dl.indexOf("'Rooms attended: '+roomsThis.length")>0);
  check('S8 computeMonthStats is untouched (comms only, the month_stats harness extracts it bare)',extractFn(html,'computeMonthStats').indexOf('rooms')<0);
  check('S9 the scoreboard\'s rooms lane and the ROOMS THIS MONTH cell keep their transition-month keys',extractFn(html,'scoreboardCounts').indexOf('eventOutcomeMonth(e)===ym')>0&&extractFn(html,'eventMonthCounts').indexOf('localYearMonth(x.timestamp)!==ym')>0&&extractFn(html,'scoreboardCounts').indexOf('eventStartMonth')<0&&extractFn(html,'eventMonthCounts').indexOf('eventStartMonth')<0);
  check('S10 the add buttons follow the view',html.indexOf("g('btn-add-contact').classList.toggle('hidden',networkView!=='contacts');")>0&&html.indexOf("g('btn-add-event').classList.toggle('hidden',networkView==='contacts'||networkView==='acquaintances');")>0);
  check('S11 the README names the pills, the MET box and CHANNEL, and states a version it describes (any release; which one is the ship\'s call, not this pin\'s)',(function(){
    try{var r=readText(isNode?require('path').join(__dirname,'..','README.md'):'README.md');return /This README describes v\d+\.\d+\.\d+\./.test(r)&&r.indexOf('CANDIDATES,')>0&&r.indexOf('SELECTED and ATTENDED')>0&&r.indexOf('MET box')>0&&r.indexOf('CHANNEL')>0;}catch(e){return false;}
  })());

  out(checks+' checks, '+failures+' failure(s)');
  if(failures){if(isNode)process.exit(1);throw new Error('room_pills_check: '+failures+' failure(s)');}
})();
