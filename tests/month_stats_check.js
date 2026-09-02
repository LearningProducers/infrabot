// month_stats_check.js: the REPORTS tab counts emails, not corrections
// (founder ruling 2026-09-02; infrabot v0.5.1).
//
// Runs the REAL computeMonthStats, sentRecord, standingArchiveEntries and
// localYearMonth extracted from infrabot.html (never a re-implementation)
// against a SYNTHETIC fixture: invented card names, invented ids, synthetic
// timestamps. The fixture reproduces the ghost/re-flip PATTERN the founder's
// book carried on 2026-09-02 (the went-quiet engine auto-ghosts a sent card,
// the founder re-flips it to sent), card for card by shape, name for nothing.
// The real state file, exports and dossier never enter this file: the repo
// is public.
//
// What it pins: August 2026 reports exactly 19 sent and September 2026
// exactly 0 sent. Under the v0.5.0 rule (every sent statusHistory entry is a
// send, every ghosted entry an archive) the same fixture reads 32 and 4,
// which is the defect this check exists to keep dead. It also pins the
// cancel rule (an auto-ghost undone by a re-flip is not an archive) and that
// the .txt download rides the same two helpers as the month card.
//
// Run from the repo root:   node tests/month_stats_check.js
//                     or:   jsc  tests/month_stats_check.js
// Optional first argument: a path to a different infrabot.html to measure.
// Exit 0 on pass; exit 1 (node) or an uncaught error (jsc) on any failure.

// Script arguments are read at the top level: under jsc the global
// `arguments` holds what follows `--`, and inside a function it would be
// that function's own (empty) arguments instead.
var IS_NODE=typeof process!=='undefined'&&process.versions&&process.versions.node;
var SCRIPT_ARGS=IS_NODE?process.argv.slice(2):(typeof arguments!=='undefined'?Array.prototype.slice.call(arguments):[]);
(function(){
  var isNode=IS_NODE;
  var args=SCRIPT_ARGS;
  var readText=isNode?function(p){return require('fs').readFileSync(p,'utf8');}:readFile;
  var htmlPath=args[0]||(isNode?require('path').join(__dirname,'..','infrabot.html'):'infrabot.html');
  var out=isNode?function(s){console.log(s);}:print;
  var html=readText(htmlPath);

  // Extract a top-level function by name with a brace walk. The four
  // functions this check needs carry no unbalanced brace inside a string
  // or regex, so the walk is exact; a miss throws rather than guessing.
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

  // ---- THE FIXTURE ------------------------------------------------------
  // One row per card: [currentStatus, createdYM, sentDate|null, history],
  // history entries [status, YM, auto]. Months only; every day and hour is
  // synthetic (see stamp). Shape census of the 2026-09-02 book, names
  // invented. Local month = America/Chicago, the profile default.
  var A=true;
  var ROWS=[
    ['ghosted','2026-05',null,[['draft','2026-05'],['sent','2026-07'],['ghosted','2026-07',A]]],
    ['dead','2026-05','2026-05-20',[['draft','2026-05'],['scheduled','2026-05'],['sent','2026-05'],['ghosted','2026-06',A],['dead','2026-07']]],
    ['dead','2026-05',null,[['sent','2026-05'],['replied','2026-05'],['dead','2026-05']]],
    ['dead','2026-05',null,[['sent','2026-05'],['ghosted','2026-07'],['dead','2026-07']]],
    ['replied','2026-05',null,[['draft','2026-05'],['sent','2026-05'],['replied','2026-05']]],
    ['dead','2026-06',null,[['draft','2026-06'],['sent','2026-06'],['ghosted','2026-07',A],['dead','2026-07']]],
    ['ghosted','2026-07',null,[['draft','2026-07'],['scheduled','2026-07'],['sent','2026-07'],['ghosted','2026-07',A]]],
    ['sent','2026-07','2026-08-06',[['draft','2026-07'],['sent','2026-08'],['ghosted','2026-08',A],['sent','2026-08']]],
    ['sent','2026-07','2026-08-11',[['draft','2026-07'],['sent','2026-08'],['ghosted','2026-08',A],['sent','2026-08']]],
    ['sent','2026-07','2026-08-11',[['draft','2026-07'],['sent','2026-08'],['ghosted','2026-08',A],['sent','2026-08']]],
    ['ghosted','2026-07',null,[['draft','2026-07'],['sent','2026-07'],['ghosted','2026-07',A]]],
    ['sent','2026-07','2026-08-03',[['draft','2026-07'],['sent','2026-08'],['ghosted','2026-08',A],['sent','2026-08'],['ghosted','2026-08',A],['sent','2026-08']]],
    ['ghosted','2026-07',null,[['draft','2026-07'],['scheduled','2026-07'],['sent','2026-07'],['ghosted','2026-07',A]]],
    ['ghosted','2026-07',null,[['draft','2026-07'],['sent','2026-07'],['ghosted','2026-07',A]]],
    ['ghosted','2026-07',null,[['draft','2026-07'],['scheduled','2026-07'],['sent','2026-07'],['ghosted','2026-07',A]]],
    ['sent','2026-07','2026-08-10',[['draft','2026-07'],['sent','2026-08'],['ghosted','2026-08',A],['sent','2026-08']]],
    ['sent','2026-07','2026-08-06',[['draft','2026-07'],['sent','2026-08'],['ghosted','2026-08',A],['sent','2026-08']]],
    ['ghosted','2026-07',null,[['draft','2026-07'],['sent','2026-08'],['ghosted','2026-08',A]]],
    ['sent','2026-07','2026-08-11',[['draft','2026-07'],['sent','2026-08'],['ghosted','2026-08',A],['sent','2026-08']]],
    ['sent','2026-07','2026-08-11',[['draft','2026-07'],['sent','2026-08'],['ghosted','2026-08',A],['sent','2026-08']]],
    ['sent','2026-07','2026-08-11',[['draft','2026-07'],['sent','2026-08'],['ghosted','2026-08',A],['sent','2026-08']]],
    ['sent','2026-08','2026-08-16',[['draft','2026-08'],['sent','2026-08'],['ghosted','2026-08',A],['sent','2026-08']]],
    ['sent','2026-08','2026-08-16',[['draft','2026-08'],['sent','2026-08'],['ghosted','2026-08',A],['sent','2026-08']]],
    ['sent','2026-08','2026-08-16',[['draft','2026-08'],['sent','2026-08'],['ghosted','2026-08',A],['sent','2026-08']]],
    ['sent','2026-08','2026-08-22',[['draft','2026-08'],['sent','2026-08'],['ghosted','2026-09',A],['sent','2026-09']]],
    ['sent','2026-08','2026-08-24',[['draft','2026-08'],['sent','2026-08'],['ghosted','2026-09',A],['sent','2026-09']]],
    ['sent','2026-08','2026-08-23',[['draft','2026-08'],['sent','2026-08'],['ghosted','2026-09',A],['sent','2026-09']]],
    ['sent','2026-08','2026-08-28',[['draft','2026-08'],['sent','2026-08']]],
    ['sent','2026-08','2026-08-23',[['draft','2026-08'],['sent','2026-08'],['ghosted','2026-09',A],['sent','2026-09']]],
    ['sent','2026-08','2026-08-28',[['draft','2026-08'],['sent','2026-08']]],
    ['draft','2026-09',null,[['draft','2026-09']]],
    ['draft','2026-09',null,[['draft','2026-09']]],
    ['draft','2026-09',null,[['draft','2026-09']]],
    ['draft','2026-09',null,[['draft','2026-09']]],
    ['draft','2026-09',null,[['draft','2026-09']]],
    ['draft','2026-09',null,[['draft','2026-09']]]
  ];
  var NAMES=['Granite Fork Marine','Blue Heron Dredging','Copperline Rail','Sable Ridge Water','Tidewater Piling','Northlake Terminal',
    'Harrow Bridge Works','Foxglove Tunnels','Ironwood Ports','Kestrel Grid Co','Lantern Bay Locks','Meridian Culvert',
    'Oakhaven Transit','Pinecrest Utilities','Quarry Hill Paving','Riverbend Aggregates','Saltmarsh Energy','Timberline Airfield',
    'Umber Valley Dams','Violet Creek Sewer','Wrenfield Cranes','Yardarm Shipyards','Zephyr Windworks','Anvil Point Steel',
    'Bramble Road Builders','Cinder Lake Power','Driftwood Harbor','Elm Hollow Concrete','Fennel Street Signals','Glasswater Pipelines',
    'Hollowmere Draft One','Hollowmere Draft Two','Hollowmere Draft Three','Hollowmere Draft Four','Hollowmere Draft Five','Hollowmere Draft Six'];
  // stamp: a UTC instant that is noon in America/Chicago on day 5+3k of the
  // month, so every synthetic timestamp sits far from a month boundary in
  // both UTC and local time and the month is unambiguous.
  function stamp(ym,k){return ym+'-'+String(5+3*k).padStart(2,'0')+'T17:00:00.000Z';}
  var comms=ROWS.map(function(r,idx){
    var hist=r[3].map(function(e,k){var o={status:e[0],timestamp:stamp(e[1],k)};if(e[2])o.auto=true;return o;});
    return {id:'fixture-'+String(idx).padStart(2,'0'),title:NAMES[idx],person:'Fixture Person '+idx,company:NAMES[idx],
      target:'Fixture Target',city:'Fixture City',status:r[0],createdAt:stamp(r[1],0),sentDate:r[2],
      statusHistory:hist,history:[],body:'fixture body '+idx};
  });
  var g=(typeof globalThis!=='undefined')?globalThis:this;
  g.state={comms:comms,network:[],profile:{homeTz:'America/Chicago'}};

  var failures=[];
  function expect(label,got,want){
    var ok=got===want;
    out((ok?'PASS ':'FAIL ')+label+': got '+got+', want '+want);
    if(!ok)failures.push(label);
  }

  // Load the real functions into the global scope (indirect eval). The two
  // v0.5.1 helpers may be absent from an older infrabot.html: that is a
  // named FAIL, and a stub stands in so the count assertions still run and
  // show what the old rule reports.
  var ge=eval;
  ['localYearMonth','computeMonthStats'].forEach(function(n){ge(extractFn(html,n));});
  ['sentRecord','standingArchiveEntries'].forEach(function(n){
    if(html.indexOf('function '+n+'(')>=0){ge(extractFn(html,n));}
    else{expect('infrabot.html defines '+n,false,true);ge('function '+n+'(c){return n==="sentRecord"?null:[];}'.replace('n===','"'+n+'"==='));}
  });

  var aug=g.computeMonthStats(2026,8),sep=g.computeMonthStats(2026,9);
  out('fixture: '+comms.length+' cards; 2026-08 '+JSON.stringify(aug)+'; 2026-09 '+JSON.stringify(sep));
  expect('August 2026 sent counts emails once per card',aug.sent,19);
  expect('September 2026 sent counts no re-flip as a send',sep.sent,0);
  expect('August 2026 archived keeps only the ghost never re-flipped',aug.archived,1);
  expect('September 2026 archived cancels every auto-ghost a re-flip undid',sep.archived,0);
  expect('drafted untouched (createdAt), August',aug.drafted,9);
  expect('drafted untouched (createdAt), September',sep.drafted,6);

  // The cancel rule at card level.
  var reflipped=comms[11];   // sent, ghosted, sent, ghosted, sent
  var ghostedThenDead=comms[1]; // sent, ghosted (June), dead (July)
  expect('a ghost/re-flip pair leaves zero standing archives',g.standingArchiveEntries(reflipped).length,0);
  expect('ghosted then dead, never re-flipped, keeps both entries',g.standingArchiveEntries(ghostedThenDead).length,2);
  expect('sentRecord dates a card by sentDate first',g.sentRecord(comms[24]).ym,'2026-08');
  expect('sentRecord falls back to the first sent entry',g.sentRecord(comms[0]).ym,'2026-07');
  expect('sentRecord is null with no sentDate and no sent entry',g.sentRecord(comms[30]),null);

  // The .txt download rides the same helpers as the month card.
  var dl=extractFn(html,'downloadMonthReport');
  expect('downloadMonthReport reads sentRecord',dl.indexOf('sentRecord(')>=0,true);
  expect('downloadMonthReport reads standingArchiveEntries',dl.indexOf('standingArchiveEntries(')>=0,true);

  // The .txt prints a bare sentDate as the date it was bucketed by (v0.4.2
  // law: a bare YYYY-MM-DD is a local calendar date; new Date on it is UTC
  // midnight, one day early in America/Chicago). fmtDate is a const arrow
  // local to downloadMonthReport, extracted here by the same brace walk.
  var fd=dl.indexOf('const fmtDate=');
  if(fd<0){expect('downloadMonthReport defines fmtDate',false,true);}
  else{
    var fdSrc=extractFn('function fmtDateWrap()'+dl.slice(dl.indexOf('{',fd)),'fmtDateWrap');
    ge('function fmtDateWrap(ts)'+fdSrc.slice(fdSrc.indexOf('{')));
    expect('fmtDate prints a bare sentDate as itself',g.fmtDateWrap('2026-08-11'),'2026-08-11');
    expect('fmtDate prints an instant as a local date-time',g.fmtDateWrap('2026-08-11T17:00:00.000Z').indexOf('2026-08-11 12:00')===0,true);
  }

  if(failures.length){
    out('month_stats_check: FAIL ('+failures.length+' failure(s))');
    if(isNode)process.exit(1);
    throw new Error('month_stats_check FAILED: '+failures.join('; '));
  }
  out('month_stats_check: PASS ('+htmlPath+')');
})();
