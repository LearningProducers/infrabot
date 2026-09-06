// month_stats_check.js: the REPORTS tab counts emails, not corrections
// (infrabot v0.5.1).
//
// Runs the REAL computeMonthStats, sentRecord, standingArchiveEntries and
// localYearMonth extracted from infrabot.html (never a re-implementation)
// against a SYNTHETIC fixture: invented card names, invented ids, synthetic
// months and timestamps, sixteen cards written to exercise every shape the
// derivation has to handle (a sent card ghosted by the went-quiet engine and
// re-flipped by an external writer, a ghost never re-flipped, ghosted then
// closed, a send dated by sentDate in a later month than its first sent
// entry, a card with no date at all). The fixture is not a copy of any real
// book and its counts are its own. The real state file, exports and dossier
// never enter this file: the repo is public.
//
// What it pins: March 2026 reports exactly 7 sent and April 2026 exactly 4.
// Under the v0.5.0 rule (every sent statusHistory entry is a send, every
// ghosted entry an archive) the same fixture reads 9 and 6, which is the
// defect this check exists to keep dead. It also pins the cancel rule (an
// auto-ghost undone by a re-flip is not an archive) and that the .txt
// download rides the same two helpers as the month card.
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
  // synthetic (see stamp). Sixteen invented cards, one per shape the
  // derivation handles. Local month = America/Chicago, the profile default.
  var A=true;
  var ROWS=[
    ['draft','2026-03',null,[['draft','2026-03']]],
    ['draft','2026-04',null,[['draft','2026-04']]],
    ['sent','2026-03','2026-03-10',[['draft','2026-03'],['sent','2026-03']]],
    ['sent','2026-03','2026-03-12',[['draft','2026-03'],['sent','2026-03'],['ghosted','2026-03',A],['sent','2026-03']]],
    ['sent','2026-03',null,[['sent','2026-03']]],
    ['sent','2026-03','2026-04-02',[['draft','2026-03'],['sent','2026-04'],['ghosted','2026-04',A],['sent','2026-04']]],
    ['replied','2026-03','2026-03-15',[['sent','2026-03'],['replied','2026-03']]],
    ['replied','2026-04','2026-04-05',[['sent','2026-04'],['replied','2026-04']]],
    ['ghosted','2026-03','2026-03-20',[['sent','2026-03'],['ghosted','2026-04',A]]],
    ['dead','2026-02','2026-02-20',[['sent','2026-02'],['ghosted','2026-03'],['dead','2026-04']]],
    ['ghosted','2026-03',null,[['sent','2026-03'],['ghosted','2026-03',A],['sent','2026-03'],['ghosted','2026-03',A]]],
    ['sent','2026-04','2026-04-11',[['draft','2026-04'],['sent','2026-04']]],
    ['sent','2026-04','2026-04-11',[['draft','2026-04'],['sent','2026-04'],['ghosted','2026-04',A],['sent','2026-04']]],
    ['dead','2026-04',null,[['draft','2026-04'],['dead','2026-04']]],
    ['sent','2026-03','2026-03-30',[['draft','2026-03'],['sent','2026-03']]],
    ['draft','2026-03',null,[['draft','2026-03']]]
  ];
  var NAMES=['Granite Fork Marine','Blue Heron Dredging','Copperline Rail','Sable Ridge Water','Tidewater Piling','Northlake Terminal',
    'Harrow Bridge Works','Foxglove Tunnels','Ironwood Ports','Kestrel Grid Co','Lantern Bay Locks','Meridian Culvert',
    'Oakhaven Transit','Pinecrest Utilities','Quarry Hill Paving','Riverbend Aggregates'];
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

  var mar=g.computeMonthStats(2026,3),apr=g.computeMonthStats(2026,4),feb=g.computeMonthStats(2026,2);
  out('fixture: '+comms.length+' cards; 2026-03 '+JSON.stringify(mar)+'; 2026-04 '+JSON.stringify(apr)+'; 2026-02 '+JSON.stringify(feb));
  expect('March 2026 sent counts emails once per card',mar.sent,7);
  expect('April 2026 sent counts no re-flip as a send',apr.sent,4);
  expect('February 2026 sent counts the one dated send',feb.sent,1);
  expect('March 2026 archived keeps the ghost before a close and the ghost that stands after a re-flip',mar.archived,2);
  expect('April 2026 archived cancels every auto-ghost a re-flip undid',apr.archived,3);
  expect('drafted untouched (createdAt), March',mar.drafted,10);
  expect('drafted untouched (createdAt), April',apr.drafted,5);
  expect('replied counts the reply in its month, March',mar.replied,1);
  expect('replied counts the reply in its month, April',apr.replied,1);

  // The cancel rule at card level.
  var reflipped=comms[3];       // sent, ghosted, sent
  var ghostedThenDead=comms[9]; // sent (Feb), ghosted (Mar), dead (Apr)
  var reghosted=comms[10];      // sent, ghosted, sent, ghosted: one ghost stands
  expect('a ghost/re-flip pair leaves zero standing archives',g.standingArchiveEntries(reflipped).length,0);
  expect('ghosted then dead, never re-flipped, keeps both entries',g.standingArchiveEntries(ghostedThenDead).length,2);
  expect('a re-flip then a second ghost leaves exactly one standing archive',g.standingArchiveEntries(reghosted).length,1);
  expect('sentRecord dates a card by sentDate first',(g.sentRecord(comms[5])||{}).ym,'2026-04');
  expect('sentRecord falls back to the first sent entry',(g.sentRecord(comms[4])||{}).ym,'2026-03');
  expect('sentRecord is null with no sentDate and no sent entry',g.sentRecord(comms[0]),null);

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
    expect('fmtDate prints a bare sentDate as itself',g.fmtDateWrap('2026-03-11'),'2026-03-11');
    expect('fmtDate prints an instant as a local date-time',g.fmtDateWrap('2026-03-11T17:00:00.000Z').indexOf('2026-03-11 12:00')===0,true);
  }

  if(failures.length){
    out('month_stats_check: FAIL ('+failures.length+' failure(s))');
    if(isNode)process.exit(1);
    throw new Error('month_stats_check FAILED: '+failures.join('; '));
  }
  out('month_stats_check: PASS ('+htmlPath+')');
})();
