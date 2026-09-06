// comm_search_check.js: the COMM SEARCH box (infrabot v0.5.2, founder ask
// 2026-09-05: type a name, see if we ever touched them).
//
// Runs the REAL commSearchMatches, commSearchStatus, commSearchTab and
// commSearchDate extracted from infrabot.html by a brace walk (never a
// re-implementation), with the real getCommBucket, sentRecord,
// localYearMonth, archiveMonth, inArchiveWindow and the STATUS_DISPLAY map
// beside them, against a SYNTHETIC fixture: invented company names, people,
// addresses, ids and timestamps. The founder's state file never enters this
// file: the repo is public.
//
// What it pins: a query matches on company, contact name, email and title,
// case-insensitive, every typed word required, empty query matching nothing,
// most recently touched first; the status word is the card's own label plus
// a send date only where the record carries one (a sent card with no date
// says so in words); the tab label is DRAFTS, PIPELINE, ARCHIVE for this
// month's archive, or REPORTS with the month for an earlier archive.
//
// Run from the repo root:   node tests/comm_search_check.js
//                     or:   jsc  tests/comm_search_check.js
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
  // A one-line const from the app, loaded as a var so an indirect eval makes
  // it global (a const inside eval code is scoped to that eval).
  function extractConstLine(src,name){
    var start=src.indexOf('const '+name+'=');
    if(start<0)throw new Error('extract: const '+name+' not found in '+htmlPath);
    var end=src.indexOf('\n',start);
    return 'var '+src.slice(start+6,end);
  }

  var g=(typeof globalThis!=='undefined')?globalThis:this;
  g.state={comms:[],network:[],profile:{homeTz:'America/Chicago'}};
  var ge=eval;
  ge(extractConstLine(html,'STATUS_DISPLAY'));
  ge(extractConstLine(html,'statusDisplay'));
  ['localYearMonth','getCommBucket','archiveMonth','inArchiveWindow','sentRecord',
   'commSearchDate','commSearchMatches','commSearchStatus','commSearchTab'].forEach(function(n){ge(extractFn(html,n));});

  // ---- THE FIXTURE ------------------------------------------------------
  // noon in America/Chicago on the given day, an unambiguous local date.
  function at(ymd){return ymd+'T17:00:00.000Z';}
  var nowIso=new Date().toISOString();
  var cards=[
    {id:'fx-01',title:'Granite Fork Marine / Ada Fixture',person:'Ada Fixture',company:'Granite Fork Marine',target:'ada@granitefork.example',city:'Duluth',
      status:'draft',sentDate:'',createdAt:at('2026-09-03'),updatedAt:at('2026-09-03'),statusHistory:[{status:'draft',timestamp:at('2026-09-03')}]},
    {id:'fx-02',title:'Blue Heron Dredging',person:'Bo Fixture',company:'Blue Heron Dredging',target:'bo@blueheron.example',city:'Mobile',
      status:'sent',sentDate:'2026-08-11',createdAt:at('2026-08-01'),updatedAt:at('2026-08-11'),statusHistory:[{status:'draft',timestamp:at('2026-08-01')},{status:'sent',timestamp:at('2026-08-11')}]},
    {id:'fx-03',title:'Copperline Rail',person:'Cy Fixture',company:'Copperline Rail',target:'cy@copperline.example',city:'Omaha',
      status:'sent',sentDate:'',createdAt:at('2026-08-01'),updatedAt:at('2026-08-05'),statusHistory:[{status:'draft',timestamp:at('2026-08-01')},{status:'sent',timestamp:at('2026-08-05')}]},
    {id:'fx-04',title:'Sable Ridge Water',person:'Di Fixture',company:'Sable Ridge Water',target:'di@sableridge.example',city:'Boise',
      status:'sent',sentDate:'',createdAt:at('2026-08-01'),updatedAt:at('2026-08-02'),statusHistory:[]},
    {id:'fx-05',title:'Tidewater Piling',person:'Eve Fixture',company:'Tidewater Piling',target:'eve@tidewater.example',city:'Norfolk',
      status:'replied',sentDate:'2026-08-11',createdAt:at('2026-08-01'),updatedAt:at('2026-08-14'),statusHistory:[{status:'sent',timestamp:at('2026-08-11')},{status:'replied',timestamp:at('2026-08-14')}]},
    {id:'fx-06',title:'Northlake Terminal',person:'Fay Fixture',company:'Northlake Terminal',target:'fay@northlake.example',city:'Duluth',
      status:'ghosted',sentDate:'',createdAt:at('2026-07-01'),updatedAt:at('2026-07-13'),statusHistory:[{status:'sent',timestamp:at('2026-07-08')},{status:'ghosted',timestamp:at('2026-07-13'),auto:true}]},
    {id:'fx-07',title:'Harrow Bridge Works',person:'Gus Fixture',company:'Harrow Bridge Works',target:'gus@harrowbridge.example',city:'Tulsa',
      status:'dead',sentDate:'2026-08-20',createdAt:at('2026-08-15'),updatedAt:nowIso,statusHistory:[{status:'sent',timestamp:at('2026-08-20')},{status:'dead',timestamp:nowIso}]},
    {id:'fx-08',title:'Foxglove Tunnels',person:'Hal Fixture',company:'Foxglove Tunnels',target:'hal@foxglove.example',city:'Reno',
      status:'scheduled',sentDate:'2026-09-20',createdAt:at('2026-09-04'),updatedAt:at('2026-09-04'),statusHistory:[{status:'scheduled',timestamp:at('2026-09-04')}]},
    {id:'fx-09',title:'Granite Fork Marine follow-up',person:'',company:'',target:'',city:'',
      status:'draft',sentDate:'',createdAt:at('2026-09-05'),updatedAt:at('2026-09-05'),statusHistory:[{status:'draft',timestamp:at('2026-09-05')}]}
  ];
  g.state.comms=cards;

  var failures=[];
  function expect(label,got,want){
    var ok=got===want;
    out((ok?'PASS ':'FAIL ')+label+': got '+JSON.stringify(got)+', want '+JSON.stringify(want));
    if(!ok)failures.push(label);
  }
  function ids(list){return list.map(function(k){return k.id;}).join(',');}

  // Matching.
  expect('empty query matches nothing',g.commSearchMatches('',cards).length,0);
  expect('whitespace query matches nothing',g.commSearchMatches('   ',cards).length,0);
  expect('company match, case-insensitive, newest first',ids(g.commSearchMatches('GRANITE',cards)),'fx-09,fx-01');
  expect('title alone matches (a hand-logged card with no company field)',ids(g.commSearchMatches('follow-up',cards)),'fx-09');
  expect('contact name matches',ids(g.commSearchMatches('eve fixture',cards)),'fx-05');
  expect('email matches',ids(g.commSearchMatches('cy@copperline',cards)),'fx-03');
  expect('every typed word required, across fields',ids(g.commSearchMatches('fork ada',cards)),'fx-01');
  expect('a word absent everywhere is no record',g.commSearchMatches('zzqx',cards).length,0);
  expect('no city match (city is not a search field)',g.commSearchMatches('duluth',cards).length,0);
  expect('null comms list is no record, not a throw',g.commSearchMatches('granite',null).length,0);

  // Status words.
  expect('draft reads DRAFT',g.commSearchStatus(cards[0]),'DRAFT');
  expect('sent with sentDate reads SENT plus the bare date',g.commSearchStatus(cards[1]),'SENT 2026-08-11');
  expect('sent with no sentDate falls back to the first sent entry, as a local date',g.commSearchStatus(cards[2]),'SENT 2026-08-05');
  expect('sent with no date anywhere says so in words',g.commSearchStatus(cards[3]),'SENT, DATE NOT ON RECORD');
  expect('replied carries the send date',g.commSearchStatus(cards[4]),'REPLIED (SENT 2026-08-11)');
  expect('ghosted reads WENT QUIET with the send date',g.commSearchStatus(cards[5]),'WENT QUIET (SENT 2026-07-08)');
  expect('dead reads CLOSED with the send date',g.commSearchStatus(cards[6]),'CLOSED (SENT 2026-08-20)');
  expect('scheduled reads its planned date, never as a send',g.commSearchStatus(cards[7]),'SCHEDULED FOR 2026-09-20');

  // Tab labels.
  expect('draft lives in DRAFTS',g.commSearchTab(cards[0]),'DRAFTS');
  expect('sent lives in PIPELINE',g.commSearchTab(cards[1]),'PIPELINE');
  expect('replied lives in PIPELINE',g.commSearchTab(cards[4]),'PIPELINE');
  expect('scheduled lives in PIPELINE',g.commSearchTab(cards[7]),'PIPELINE');
  expect('an earlier month\'s archive lives under REPORTS, month named',g.commSearchTab(cards[5]),'REPORTS (2026-07)');
  expect('this month\'s archive lives in ARCHIVE',g.commSearchTab(cards[6]),'ARCHIVE');

  // Dates.
  expect('a bare date prints as itself',g.commSearchDate('2026-08-11'),'2026-08-11');
  expect('an instant prints as its local calendar date',g.commSearchDate('2026-08-11T17:00:00.000Z'),'2026-08-11');
  expect('a late-evening UTC instant is still the local day',g.commSearchDate('2026-08-12T03:30:00.000Z'),'2026-08-11');
  expect('garbage prints nothing',g.commSearchDate('not a date'),'');

  // The render path rides these helpers and the card-open path.
  var rc=extractFn(html,'renderCommSearch');
  expect('renderCommSearch reads commSearchMatches',rc.indexOf('commSearchMatches(')>=0,true);
  expect('renderCommSearch reads commSearchStatus and commSearchTab',rc.indexOf('commSearchStatus(')>=0&&rc.indexOf('commSearchTab(')>=0,true);
  expect('renderCommSearch says NO RECORD on zero matches',rc.indexOf('NO RECORD')>=0,true);
  expect('a result row opens the card through openCommModal',html.indexOf("g('comm-search-results').addEventListener('click'")>=0&&html.indexOf('openCommModal(row.dataset.id)')>=0,true);
  expect('renderComms re-runs the search on every render',extractFn(html,'renderComms').indexOf('renderCommSearch();')>=0,true);

  if(failures.length){
    out('comm_search_check: FAIL ('+failures.length+' failure(s))');
    if(isNode)process.exit(1);
    throw new Error('comm_search_check FAILED: '+failures.join('; '));
  }
  out('comm_search_check: PASS ('+htmlPath+')');
})();
