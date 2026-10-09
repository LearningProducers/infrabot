// overview_chart_check.js: the OVERVIEW tab's month-by-month chart
// (infrabot v0.20.0).
//
// Runs the REAL overviewChartSvg, monthFigures, activityMonths, monthRange
// and the helpers they read (computeMonthStats, roomsInMonth, metInMonth and
// their chain) extracted from infrabot.html, never a re-implementation,
// against a SYNTHETIC state: invented cards across three months, where one
// kind of outreach (replied) is absent in month one and present in month
// two, and one kind (archived) never occurs. The real state file, exports
// and dossier never enter this file: the repo is public.
//
// What it pins: one series per category in OVERVIEW_SERIES order; a point
// per month in every series, the count equal to the month count; exactly
// one NEW marker on the category that appeared, and it sits on its first
// month with a count; a category that never occurs carries no NEW marker;
// the figures on the points are monthFigures' figures (computeMonthStats
// for the five comm counts, so the chart and the month card agree by
// construction); and the SVG carries no http, https, fetch or <script src.
//
// Run from the repo root:   node tests/overview_chart_check.js
//                     or:   jsc  tests/overview_chart_check.js
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
    return src.slice(m.index,end+1).replace(/^(var|const|let)\s+/,'var ');
  }

  var failures=[];
  function expect(label,got,want){
    var ok=got===want;
    out((ok?'PASS ':'FAIL ')+label+': got '+JSON.stringify(got)+', want '+JSON.stringify(want));
    if(!ok)failures.push(label);
  }

  // ---- THE FIXTURE ------------------------------------------------------
  // Three synthetic months, 2026-03 to 2026-05, home zone America/Chicago.
  // Replied is ABSENT in March and PRESENT in April (the appearing kind);
  // archived never occurs; drafted and sent run from March. No rooms, no
  // calls, nobody met: those series are flat at zero and pin the
  // all-zero shape.
  function stamp(ym,k){return ym+'-'+String(5+3*k).padStart(2,'0')+'T17:00:00.000Z';}
  var NAMES=['Ashgrove Dredging','Bramble Rail','Cinder Harbor','Dunmore Piling','Elmcrest Water','Fallow Locks','Garnet Culvert','Hollow Transit'];
  var ROWS=[
    ['draft','2026-03',null,[['draft','2026-03']]],
    ['sent','2026-03','2026-03-10',[['draft','2026-03'],['sent','2026-03']]],
    ['sent','2026-03','2026-03-14',[['draft','2026-03'],['sent','2026-03']]],
    ['replied','2026-04','2026-04-06',[['draft','2026-04'],['sent','2026-04'],['replied','2026-04']]],
    ['sent','2026-04','2026-04-11',[['draft','2026-04'],['sent','2026-04']]],
    ['replied','2026-05','2026-05-03',[['draft','2026-05'],['sent','2026-05'],['replied','2026-05']]],
    ['draft','2026-05',null,[['draft','2026-05']]],
    ['draft','2026-05',null,[['draft','2026-05']]]
  ];
  var comms=ROWS.map(function(r,idx){
    var hist=r[3].map(function(e,k){return {status:e[0],timestamp:stamp(e[1],k)};});
    return {id:'fixture-'+idx,title:NAMES[idx],person:'Fixture Person '+idx,company:NAMES[idx],target:'Fixture Target',
      city:'Fixture City',status:r[0],createdAt:stamp(r[1],0),sentDate:r[2],statusHistory:hist,history:[],body:'fixture body '+idx};
  });
  var g=(typeof globalThis!=='undefined')?globalThis:this;
  g.state={comms:comms,network:[],events:[],calls:[],profile:{homeTz:'America/Chicago'}};
  g.document=undefined;

  var ge=eval;
  ['esc','CALL_STATUSES','EVENT_STATUSES','EVENT_OUTCOMES','OVERVIEW_SERIES','MONTH_SHORT','MONTH_LONG'].forEach(function(n){ge(extractVar(html,n));});
  ['localYearMonth','sentRecord','standingArchiveEntries','callsList','normalizeSupport','normalizeCall','calledAt','callCommItems','callsInMonth',
   'computeMonthStats','eventsList','homeTzNow','normalizeCost','normalizeEvent','wallTimeToDate','eventStartMonth','byEventStart','roomsInMonth',
   'personTier','acquaintanceMonth','metInMonth','monthFigures','activityMonths','monthRange','monthLabelLong','monthLabelShort','overviewChartSvg'
  ].forEach(function(n){ge(extractFn(html,n));});

  // ---- monthRange and activityMonths ------------------------------------
  expect('activityMonths lists the three fixture months in order',g.activityMonths().join(' '),'2026-03 2026-04 2026-05');
  expect('monthRange is inclusive and crosses a year',g.monthRange('2025-11','2026-02').join(' '),'2025-11 2025-12 2026-01 2026-02');
  expect('monthRange is empty when last precedes first',g.monthRange('2026-05','2026-03').length,0);
  expect('monthRange is empty on a non-month',g.monthRange('soon','2026-03').length,0);

  // ---- the figures ride computeMonthStats ---------------------------------
  var fig=g.monthFigures('2026-04'),ms=g.computeMonthStats(2026,4);
  expect('monthFigures.drafted is computeMonthStats.drafted',fig.drafted,ms.drafted);
  expect('monthFigures.sent is computeMonthStats.sent',fig.sent,ms.sent);
  expect('monthFigures.replied is computeMonthStats.replied',fig.replied,ms.replied);
  expect('monthFigures.archived is computeMonthStats.archived',fig.archived,ms.archived);
  expect('monthFigures.calls is computeMonthStats.calls',fig.calls,ms.calls);
  expect('monthFigures.rooms is roomsInMonth',fig.rooms,g.roomsInMonth('2026-04').length);
  expect('monthFigures.met is metInMonth',fig.met,g.metInMonth('2026-04').length);
  expect('the fixture has no reply in March',g.monthFigures('2026-03').replied,0);
  expect('the fixture has one reply in April',g.monthFigures('2026-04').replied,1);

  // ---- the chart ---------------------------------------------------------
  var svg=g.overviewChartSvg('2026-05');
  var lineCount=svg.split('\n').length;
  out('overviewChartSvg: '+svg.length+' chars, '+lineCount+' lines, 3 months');
  function count(re){var m=svg.match(re);return m?m.length:0;}
  var series=[];var re=/<g class="ov-series" data-key="([a-z]+)"/g,m;while((m=re.exec(svg)))series.push(m[1]);
  expect('one series per category, in OVERVIEW_SERIES order',series.join(' '),g.OVERVIEW_SERIES.map(function(s){return s.key;}).join(' '));
  expect('seven series',series.length,7);
  expect('one polyline per series',count(/<polyline class="ov-line"/g),7);
  // Points per series: split the SVG on the series groups and count points inside each.
  var chunks=svg.split('<g class="ov-series"').slice(1);
  var perSeries=chunks.map(function(c){return (c.match(/<g class="ov-pt/g)||[]).length;});
  expect('every series carries one point per month (3 months)',perSeries.join(' '),'3 3 3 3 3 3 3');
  expect('every polyline carries one vertex per month',chunks.every(function(c){var p=/points="([^"]*)"/.exec(c);return p&&p[1].trim().split(/\s+/).length===3;}),true);
  // NEW markers.
  var repliedChunk=chunks[series.indexOf('replied')];
  expect('exactly one NEW marker on the category that appeared (replied)',(repliedChunk.match(/<g class="ov-pt ov-new"/g)||[]).length,1);
  expect('the NEW marker sits on April, the first month with a reply',/<g class="ov-pt ov-new"[^>]*data-month="April 2026"/.test(repliedChunk),true);
  expect('the NEW point carries the word NEW',repliedChunk.indexOf('>NEW</text>')>0,true);
  expect('the NEW marker is a distinct shape (a rect rotated 45, not the circle dot)',/<rect class="ov-mark"[^>]*transform="rotate\(45 /.test(repliedChunk),true);
  expect('the March replied point is a plain dot, no NEW',/data-month="March 2026"[^>]*>\n<title>[^<]*<\/title>\n<circle class="ov-hit"[^>]*\/>\n<circle class="ov-dot"/.test(repliedChunk),true);
  var archivedChunk=chunks[series.indexOf('archived')];
  expect('a category that never occurs carries no NEW marker',(archivedChunk.match(/<g class="ov-pt ov-new"/g)||[]).length,0);
  var newTotal=count(/<g class="ov-pt ov-new"/g);
  var kindsWithAny=g.OVERVIEW_SERIES.filter(function(s){return ['2026-03','2026-04','2026-05'].some(function(ym){return g.monthFigures(ym)[s.key]>0;});}).length;
  expect('NEW markers equal the kinds that ever occur, one each',newTotal,kindsWithAny);
  // The figures on the points are the month figures.
  function pointValue(chunk,month){var r=new RegExp('data-month="'+month+'" data-value="(\\d+)"');var x=r.exec(chunk);return x?+x[1]:null;}
  expect('the sent point for March is computeMonthStats sent',pointValue(chunks[series.indexOf('sent')],'March 2026'),g.computeMonthStats(2026,3).sent);
  expect('the drafted point for May is computeMonthStats drafted',pointValue(chunks[series.indexOf('drafted')],'May 2026'),g.computeMonthStats(2026,5).drafted);
  expect('every point carries a title with its month and number (hover)',count(/<title>[A-Z]+ · [A-Z][a-z]+ 2026 · \d+/g),21);
  expect('every point is focusable (tap and keyboard)',count(/<g class="ov-pt[^"]*" tabindex="0"/g),21);
  // Shape and safety.
  expect('the SVG names no http',/http/i.test(svg),false);
  expect('the SVG names no https',/https/i.test(svg),false);
  expect('the SVG names no fetch',/fetch/i.test(svg),false);
  expect('the SVG carries no script',/<script/i.test(svg),false);
  expect('the SVG carries no src attribute',/\ssrc=/i.test(svg),false);
  expect('the SVG carries no xlink or href',/href/i.test(svg),false);
  expect('every color is a theme token, never a literal',/#[0-9a-f]{3,8}\b/i.test(svg),false);
  expect('the SVG opens and closes once',count(/<svg /g)===1&&count(/<\/svg>/g)===1,true);
  expect('an empty state draws nothing',(function(){var keep=g.state;g.state={comms:[],network:[],events:[],calls:[],profile:{homeTz:'America/Chicago'}};var r=g.overviewChartSvg('2026-05');g.state=keep;return r;})(),'');
  expect('a one-month state draws one point per series',(function(){var keep=g.state;g.state={comms:[comms[0]],network:[],events:[],calls:[],profile:{homeTz:'America/Chicago'}};var r=g.overviewChartSvg('2026-03');g.state=keep;return (r.match(/<g class="ov-pt/g)||[]).length;})(),7);
  expect('the range runs to the current month even past the last activity',(function(){var r=g.overviewChartSvg('2026-07');return (r.match(/<g class="ov-pt/g)||[]).length;})(),35);

  // The overview renders the chart through overviewChartSvg and the month card still reads the same three helpers.
  var ro=extractFn(html,'renderOverview'),rp=extractFn(html,'renderReportsPanel');
  expect('renderOverview draws the chart with overviewChartSvg',ro.indexOf('overviewChartSvg(')>0,true);
  expect('the ROOMS counter is monthFigures, the chart\'s last ROOMS point',ro.indexOf('monthFigures(nowYm).rooms')>0,true);
  expect('the month card reads computeMonthStats, roomsInMonth and metInMonth',rp.indexOf('computeMonthStats(')>0&&rp.indexOf('roomsInMonth(ym)')>0&&rp.indexOf('metInMonth(ym)')>0,true);
  expect('the OPENED THIS MONTH section is gone from the HTML',html.indexOf('// OPENED THIS MONTH')<0&&html.indexOf('id="scoreboard"')<0,true);
  expect('the scoreboard renderer is gone',html.indexOf('function renderScoreboard(')<0,true);
  expect('the set-up pitch is gone',html.indexOf('SET UP YOUR PROFILE')<0,true);
  expect('the YOU block names what each field drives',ro.indexOf("'drives the map pin'")>0&&ro.indexOf("'drives the clocks'")>0&&ro.indexOf("'read by the crew'")>0,true);

  if(failures.length){
    out('overview_chart_check: FAIL ('+failures.length+' failure(s))');
    if(isNode)process.exit(1);
    throw new Error('overview_chart_check FAILED: '+failures.join('; '));
  }
  out('overview_chart_check: PASS ('+htmlPath+')');
})();
