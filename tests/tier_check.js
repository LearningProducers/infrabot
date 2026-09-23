// tier_check.js: THE TIER (infrabot v0.13.0). Every person carries a tier,
// ACQUAINTANCE or CONTACT (CUSTOMER reserved in the enum, never rendered,
// never selectable); a person from a MET box is an acquaintance, every
// existing person a contact on migration; one tier act appends one
// transition; the ACQUAINTANCES pill runs through the shared month window;
// the gold mark is the CONTACT mark.
//
// Runs the REAL PERSON_TIERS, RENDERED_TIERS, personTier, normalizePerson,
// setPersonTier, acquaintanceMonth, latestMetRoom, metInMonth,
// linkMetNames, networkViewBar and their helpers extracted from
// infrabot.html by a brace walk (never a re-implementation) against
// SYNTHETIC people and rooms: invented names, invented organizers,
// synthetic dates; the city names are real place names on invented rooms,
// no real person, no real event. The current month is read through the
// app's own localYearMonth, so the fixture holds in any month. The real
// state file never enters this file: the repo is public.
//
// What it pins: the enum holds three values and the UI renders two; a
// person with no tier reads as a contact and migrates to one seeded from
// addedAt, never the clock; a customer record renders as a contact and
// keeps its stored tier; a person born from the MET box is an acquaintance
// with one seeded transition; the tier act appends one transition with the
// given stamp, appends nothing on a no-change call, refuses customer and an
// unknown tier, and moves updatedAt; a downgrade deletes no field; an
// acquaintance's month is the latest dated met-at room's, else the last
// downgrade's, else null (rendered); the ACQUAINTANCES pill counts the
// acquaintances in the window and CONTACTS counts every contact, neither
// following the city filter; metInMonth lists the month's acquaintances by
// name with the latest room; the export carries the fields untouched; the
// source pins (the contact mark on every contact card and no acquaintance
// card, the buttons, the form's select and layout, the import and merge
// normalization, the load migration, the report's MET section, the
// scoreboard and rooms counters untouched).
//
// Run from the repo root:   node tests/tier_check.js
//                     or:   jsc  tests/tier_check.js
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
  var ge=eval;
  ['EVENT_STATUSES','EVENT_OUTCOMES','NETWORK_VIEWS','PERSON_TIERS','RENDERED_TIERS','networkView','eventsCityFilter','uid'].forEach(function(n){ge(extractVar(html,n));});
  ['eventsList','homeTzNow','normalizeCost','normalizeEvent','wallTimeToDate','localYearMonth','inMonthWindow',
   'eventStartMonth','byEventStart','eventCities','eventsShown','findContactByName','linkMetNames',
   'personTier','normalizePerson','setPersonTier','acquaintanceMonth','latestMetRoom','metInMonth','networkViewBar'].forEach(function(n){ge(extractFn(html,n));});

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,240)+']'));
    if(!ok)failures++;
  }
  var T='2026-09-23T12:00:00.000Z';
  g.state={profile:{homeTz:'America/Chicago'},network:[],events:[]};
  var NOW=localYearMonth(Date.now());
  var y=parseInt(NOW.slice(0,4),10),m=parseInt(NOW.slice(5,7),10);
  var EARLIER=(m>2?y+'-'+String(m-2).padStart(2,'0'):(y-1)+'-'+String(m+10).padStart(2,'0'));
  function room(id,title,ym,start){return {id:id,title:title,organizer:'Fixture Guild',venue:'Fixture Hall',city:'Chicago',tz:'America/Chicago',start:start===undefined?ym+'-15T18:00':start,url:'',cost:'free',status:'attended',statusHistory:[{status:'attended',timestamp:ym+'-15T16:00:00.000Z'}],whyThisRoom:'Synthetic reason.',met:[],outcome:'none',notes:'',createdAt:ym+'-15T15:00:00.000Z',updatedAt:ym+'-15T16:00:00.000Z'};}
  function person(id,name,extra){return Object.assign({id:id,addedAt:'2026-08-01T15:00:00.000Z',lastTouchAt:null,touches:[],name:name,company:'',website:'',email:'',channel:'',city:'Chicago',tz:'America/Chicago',notes:''},extra||{});}

  // --- E: the enum ---------------------------------------------------------
  check('E1 the enum holds acquaintance, contact and the reserved customer',JSON.stringify(PERSON_TIERS)==='["acquaintance","contact","customer"]');
  check('E2 the UI renders two',JSON.stringify(RENDERED_TIERS)==='["acquaintance","contact"]');
  check('E3 the form select offers two and never customer (source)',/<select id="c-tier"><option value="contact">CONTACT<\/option><option value="acquaintance">ACQUAINTANCE<\/option><\/select>/.test(html)&&html.indexOf('value="customer"')<0);

  // --- N: reading and migrating -------------------------------------------
  check('N1 a person with no tier reads as a contact',personTier(person('p1','Ada Fixture'))==='contact'&&personTier({})==='contact');
  var mig=normalizePerson(person('p2','Bram Placeholder'));
  check('N2 migration writes contact, seeded from addedAt, never the clock',mig.tier==='contact'&&JSON.stringify(mig.tierHistory)==='[{"tier":"contact","timestamp":"2026-08-01T15:00:00.000Z"}]');
  check('N3 migration is idempotent',JSON.stringify(normalizePerson(mig).tierHistory)===JSON.stringify(mig.tierHistory)&&mig.tier==='contact');
  var cust=normalizePerson(person('p3','Cato Sample',{tier:'customer'}));
  check('N4 a customer record keeps its stored tier and renders as a contact',cust.tier==='customer'&&personTier(cust)==='contact');
  check('N5 an unknown tier value migrates to contact',normalizePerson(person('p4','Dora Stub',{tier:'vip'})).tier==='contact');
  check('N6 an acquaintance with a history is left as it is',(function(){var a=normalizePerson(person('p5','Eli Mock',{tier:'acquaintance',tierHistory:[{tier:'acquaintance',timestamp:T}]}));return a.tier==='acquaintance'&&a.tierHistory.length===1;})());

  // --- B: born from the MET box --------------------------------------------
  state.network=[];state.events=[room('e1','Fixture Hall Makers Night',NOW)];
  var ids=linkMetNames(['Fay Prop'],state.events[0],T);
  var born=state.network[0];
  check('B1 a person from the MET box is an acquaintance with one seeded transition',ids.length===1&&born.tier==='acquaintance'&&JSON.stringify(born.tierHistory)==='[{"tier":"acquaintance","timestamp":"'+T+'"}]');
  check('B2 the form-born person is a contact (source)',html.indexOf("tier:'contact',tierHistory:[{tier:'contact',timestamp:nowISO}]")>0&&html.indexOf("tier:'contact',tierHistory:[{tier:'contact',timestamp:born}]")>0);

  // --- A: the one tier act -------------------------------------------------
  var p=normalizePerson(person('p6','Gus Dummy',{company:'Fixture Foundry',email:'',notes:'kept'}));
  var moved=setPersonTier(p,'acquaintance',T);
  check('A1 a downgrade appends one transition with the given stamp and moves updatedAt',moved===true&&p.tier==='acquaintance'&&p.tierHistory.length===2&&p.tierHistory[1].tier==='acquaintance'&&p.tierHistory[1].timestamp===T&&p.updatedAt===T);
  check('A2 a downgrade deletes no field',p.company==='Fixture Foundry'&&p.notes==='kept'&&p.city==='Chicago');
  check('A3 a no-change call appends nothing',setPersonTier(p,'acquaintance',T)===false&&p.tierHistory.length===2);
  check('A4 customer and an unknown tier are refused',setPersonTier(p,'customer',T)===false&&setPersonTier(p,'vip',T)===false&&p.tier==='acquaintance'&&p.tierHistory.length===2);
  check('A5 an upgrade appends one more transition',setPersonTier(p,'contact','2026-09-24T12:00:00.000Z')===true&&p.tier==='contact'&&p.tierHistory.length===3);
  check('A6 the act is called by the card buttons and the form select alone (source)',(html.match(/setPersonTier\(/g)||[]).length===3&&html.indexOf("if(act==='upgrade-person')changePersonTier(id,'contact');")>0&&html.indexOf("if(act==='downgrade-person')changePersonTier(id,'acquaintance');")>0);

  // --- M: an acquaintance's month ----------------------------------------
  state.events=[room('e_old','Placeholder Pier Demo Day',EARLIER),room('e_now','Fixture Hall Makers Night',NOW),room('e_undated','Fixture Loft Undated',NOW,'')];
  var q=normalizePerson(person('p7','Hal Fixture',{tier:'acquaintance',tierHistory:[{tier:'acquaintance',timestamp:EARLIER+'-20T15:00:00.000Z'}],metAt:[{eventId:'e_old',title:'Placeholder Pier Demo Day'},{eventId:'e_now',title:'Fixture Hall Makers Night'},{eventId:'e_undated',title:'Fixture Loft Undated'}]}));
  check('M1 the month is the latest DATED met-at room\'s, undated rooms ignored',acquaintanceMonth(q)===NOW&&latestMetRoom(q).id==='e_now');
  q.metAt=[{eventId:'e_old',title:'Placeholder Pier Demo Day'}];
  check('M2 an earlier room puts the person in the earlier month',acquaintanceMonth(q)===EARLIER);
  q.metAt=[];
  check('M3 with no met-at, the month is the last downgrade\'s',acquaintanceMonth(q)===EARLIER);
  q.tierHistory=[{tier:'contact',timestamp:T}];
  check('M4 with neither, the month is null and the window renders it',acquaintanceMonth(q)===null&&inMonthWindow(acquaintanceMonth(q))===true);
  q.metAt=[{eventId:'e_gone',title:'A deleted room'}];
  check('M5 a met-at whose room is gone is ignored',acquaintanceMonth(q)===null);

  // --- P: the pills --------------------------------------------------------
  state.network=[
    normalizePerson(person('c1','Ada Fixture')),
    normalizePerson(person('c2','Bram Placeholder',{tier:'contact'})),
    normalizePerson(person('a1','Fay Prop',{tier:'acquaintance',tierHistory:[{tier:'acquaintance',timestamp:T}],metAt:[{eventId:'e_now',title:'Fixture Hall Makers Night'}]})),
    normalizePerson(person('a2','Hal Fixture',{tier:'acquaintance',tierHistory:[{tier:'acquaintance',timestamp:T}],metAt:[{eventId:'e_old',title:'Placeholder Pier Demo Day'}]})),
    normalizePerson(person('a3','Ivo Mock',{tier:'acquaintance',tierHistory:[{tier:'acquaintance',timestamp:EARLIER+'-03T15:00:00.000Z'}]})),
    normalizePerson(person('x1','Jun Sample',{tier:'customer'}))
  ];
  g.networkView='contacts';g.eventsCityFilter='';
  var bar=networkViewBar();
  function count(bar,v){var mm=new RegExp('data-view="'+v+'">'+v.toUpperCase()+'<span class="triage-count">· (\\d+)</span>').exec(bar);return mm?parseInt(mm[1],10):null;}
  check('P1 five pills in order',/data-view="contacts"[\s\S]*data-view="acquaintances"[\s\S]*data-view="candidates"[\s\S]*data-view="selected"[\s\S]*data-view="attended"/.test(bar));
  check('P2 CONTACTS counts every contact, the customer record among them, never an acquaintance',count(bar,'contacts')===3,bar);
  check('P3 ACQUAINTANCES counts the acquaintances in the window',count(bar,'acquaintances')===1,bar);
  g.eventsCityFilter='nowhere';
  check('P4 the people pills do not follow the city filter',count(networkViewBar(),'contacts')===3);
  g.eventsCityFilter='';
  check('P5 metInMonth lists the month\'s acquaintances by name with the latest room',(function(){var e=metInMonth(EARLIER);return e.length===2&&e[0].id==='a2'&&e[1].id==='a3'&&latestMetRoom(e[0]).title==='Placeholder Pier Demo Day'&&latestMetRoom(e[1])===null;})());
  check('P6 metInMonth never lists a contact',metInMonth(NOW).length===1&&metInMonth(NOW)[0].id==='a1');

  // --- X: the export shape -------------------------------------------------
  check('X1 the export carries the fields untouched and the version stays 3 (source)',html.indexOf('const STATE_SCHEMA_VERSION=3;')>0&&extractFn(html,'buildStateExport').indexOf('tier')<0);

  // --- S: source pins ------------------------------------------------------
  var card=extractFn(html,'renderPersonCard');
  check('S1 the gold star and border render on every contact card',card.indexOf('<div class="card card-converted"><div class="card-h"><div><div class="card-name"><span class="conv-star" title="Contact">★</span>')>0);
  check('S2 no acquaintance card renders either',(function(){var acq=card.slice(card.indexOf("if(tier==='acquaintance')"),card.indexOf('// v0.2.6'));return acq.indexOf('card-converted')<0&&acq.indexOf('conv-star')<0;})());
  check('S3 an acquaintance card shows name, channel, MET AT, notes with OPEN and UPGRADE and no COUNCIL',(function(){var acq=card.slice(card.indexOf("if(tier==='acquaintance')"),card.indexOf('// v0.2.6'));return acq.indexOf('data-act="upgrade-person"')>0&&acq.indexOf('data-act="edit-contact"')>0&&acq.indexOf('council-contact')<0&&acq.indexOf('${metAt}')>0&&acq.indexOf('Notes')>0&&acq.indexOf('esc(c.channel)')>0&&acq.indexOf('c.company')<0;})());
  check('S4 a contact card carries COUNCIL and DOWNGRADE',card.indexOf('data-act="council-contact"')>0&&card.indexOf('data-act="downgrade-person"')>0);
  check('S5 the email-keyed condition is gone from the contact card and stays on the comm card',card.indexOf('isConnected')<0&&extractFn(html,'renderComms').indexOf('isConverted')>0);
  check('S6 the form follows the tier: hidden fields keep their values',extractFn(html,'applyTierLayout').indexOf("['c-f-company','c-f-website','c-f-email','c-f-cityrow','c-f-tier'].forEach(id=>g(id).classList.toggle('hidden',acq));")>0&&extractFn(html,'autosaveApplyFields').indexOf("rec.company=(vals['c-company']||'').trim();")>0);
  check('S7 the tier select is not an autosave field',html.indexOf("fields:['c-name','c-company','c-website','c-email','c-channel','c-city','c-tz','c-notes'],")>0);
  check('S8 the load migration, the import and the merge normalize every person',extractFn(html,'loadState').indexOf('s.network.forEach(c=>{normalizePerson(c);});')>0&&extractFn(html,'additiveImportState').indexOf('normalizePerson(rec);')>0&&extractFn(html,'mergeServerState').indexOf('state.network.forEach(function(c){normalizePerson(c);});')>0);
  var dl=extractFn(html,'downloadMonthReport');
  check('S9 the report carries a MET section with name, channel, room and a SUMMARY line',dl.indexOf("lines.push('MET ('+metThis.length+')');")>0&&dl.indexOf("'  Channel:   '+(c.channel||'-')")>0&&dl.indexOf("'  Room:      '")>0&&dl.indexOf("'People met: '+metThis.length")>0&&extractFn(html,'renderReportsPanel').indexOf('${met}</span> met')>0);
  check('S10 the scoreboard and the rooms counters are untouched',extractFn(html,'scoreboardCounts').indexOf('tier')<0&&extractFn(html,'eventMonthCounts').indexOf('tier')<0&&extractFn(html,'roomsInMonth').indexOf('tier')<0);
  check('S11 the ACQUAINTANCES view runs through the shared window and names the earlier ones',extractFn(html,'renderAcquaintancesView').indexOf('inMonthWindow(acquaintanceMonth(c))')>0&&extractFn(html,'renderAcquaintancesView').indexOf("MET EARLIER · IN THEIR MONTH'S REPORT")>0);
  check('S12 the contacts view renders contacts only',extractFn(html,'renderNetwork').indexOf("const contacts=state.network.filter(c=>personTier(c)==='contact');")>0);

  out(checks+' checks, '+failures+' failure(s)');
  if(failures){if(isNode)process.exit(1);throw new Error('tier_check: '+failures+' failure(s)');}
})();
