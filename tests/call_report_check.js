// call_report_check.js: CALLS IN THE MONTH REPORT (infrabot v0.18.0).
// A completed call (status called) is a figure in its month's report: the
// month card shows "n calls", the downloaded .txt carries a Calls line in
// SUMMARY and a CALLS section (company, location, the day, the outcome when
// the record carries one, the follow-through when one was given). The card
// and the file read one list, callsInMonth, keyed by the called instant the
// Communications tab's phone card derives from, so a call is counted once.
//
// Runs the REAL callsInMonth, computeMonthStats, renderReportsPanel and
// downloadMonthReport (with the call-record helpers they read) extracted
// from infrabot.html by a brace walk, never a re-implementation, against
// SYNTHETIC call records: invented companies, people and ids under
// .invalid, synthetic months. The browser download seam (Blob, URL, the
// anchor) is stubbed so the .txt bytes are captured instead of saved. The
// repo is public.
//
// Run from the repo root:   node tests/call_report_check.js
//                     or:   jsc  tests/call_report_check.js
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

  var glob=(typeof globalThis!=='undefined')?globalThis:this;
  // ---- THE FIXTURE ------------------------------------------------------
  // Five synthetic call records. stamp: noon in America/Chicago on day
  // 5+3k of the month, far from every month boundary in UTC and local time.
  function stamp(ym,k){return ym+'-'+String(5+3*k).padStart(2,'0')+'T17:00:00.000Z';}
  function call(id,company,status,ym,extra){
    var rec={id:id,company:company,location:'Fixture City, FX',phone:'(000) 000-0000',website:'https://'+id+'.invalid/',hook:'fixture hook',
      support:[],notes:'',followName:'',followChannel:'',contactId:'',status:status,createdAt:stamp(ym,0),
      statusHistory:[{status:'queued',timestamp:stamp(ym,0)}]};
    if(status!=='queued')rec.statusHistory.push({status:status,timestamp:stamp(ym,1)});
    Object.keys(extra||{}).forEach(function(k){rec[k]=extra[k];});
    return rec;
  }
  var calls=[
    call('fx-call-a','Granite Fork Marine','called','2026-03',{notes:'reached the desk\nasked for a follow-up in April',followName:'Fixture Follow',followChannel:'left a message'}),
    call('fx-call-b','Blue Heron Dredging','called','2026-04',{contactId:'fx-person-1',followChannel:'connected'}),
    call('fx-call-c','Copperline Rail','queued','2026-03'),
    call('fx-call-d','Sable Ridge Water','skipped','2026-03'),
    call('fx-call-e','Tidewater Piling','called','2026-03')
  ];
  // the re-called record: a second called entry; the LAST called instant is the one counted, once
  calls[4].statusHistory.push({status:'called',timestamp:stamp('2026-03',2)});
  var frozen=JSON.stringify(calls);

  glob.state={comms:[],network:[{id:'fx-person-1',name:'Fixture Person',tier:'acquaintance',channel:'phone'}],events:[],calls:calls,profile:{homeTz:'America/Chicago',name:'Fixture Founder',company:'Fixture Co'}};
  glob.saveState=function(){throw new Error('saveState must never run from a report render');};
  // stubs for the parts of the page the report builder touches and this check does not measure
  glob.eventsList=function(){return glob.state.events;};
  glob.normalizeEvent=function(e){return e;};
  glob.byEventStart=function(){return 0;};
  glob.eventStartMonth=function(){return null;};
  glob.personTier=function(){return 'contact';};
  glob.acquaintanceMonth=function(){return null;};
  glob.latestMetRoom=function(){return null;};
  glob.expandAppLink=function(s){return s;};
  glob.normalizeSources=function(){return [];};
  glob.sourceLineText=function(s){return String(s);};
  glob.localTimestamp=function(){return 'fixture clock';};
  glob.getCommBucket=function(){return 'draft';};
  glob.toast=function(){};
  var captured=null;
  glob.Blob=function(parts){this.text=parts.join('');};
  glob.URL={createObjectURL:function(b){captured=b.text;return 'blob:fixture';},revokeObjectURL:function(){}};
  glob.document={createElement:function(){return {click:function(){}};},body:{appendChild:function(){},removeChild:function(){}}};

  var ge=eval;
  ['esc','CALL_STATUSES','APP_VERSION'].forEach(function(n){ge(extractVar(html,n));});
  ['localYearMonth','callsList','normalizeSupport','normalizeCall','calledAt','callCommItems','callsInMonth',
   'sentRecord','standingArchiveEntries','computeMonthStats','roomsInMonth','metInMonth','renderReportsPanel','downloadMonthReport'].forEach(function(n){ge(extractFn(html,n));});

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,240)+']'));
    if(!ok)failures++;
  }

  // THE DERIVATION
  var mar=glob.callsInMonth('2026-03'),apr=glob.callsInMonth('2026-04'),may=glob.callsInMonth('2026-05');
  check('March holds the two completed calls, queued and skipped stay out',mar.length===2&&mar.map(function(it){return it.c.id;}).join(',')==='fx-call-a,fx-call-e',mar.map(function(it){return it.c.id;}));
  check('April holds its one completed call',apr.length===1&&apr[0].c.id==='fx-call-b',apr.length);
  check('a month with no call is empty',may.length===0,may.length);
  check('a re-called record is counted once, by its last called instant',mar.filter(function(it){return it.c.id==='fx-call-e';}).length===1&&mar[1].when===stamp('2026-03',2),mar[1]&&mar[1].when);
  check('the report instant is the phone card instant (calledAt)',mar[0].when===glob.calledAt(calls[0])&&apr[0].when===glob.calledAt(calls[1]),mar[0].when);
  check('the month list is oldest first',mar[0].c.id==='fx-call-a'&&mar[1].c.id==='fx-call-e');

  // THE MONTH CARD
  var ms=glob.computeMonthStats(2026,3),as=glob.computeMonthStats(2026,4),ys=glob.computeMonthStats(2026,5);
  check('computeMonthStats.calls equals callsInMonth, March',ms.calls===2&&ms.calls===mar.length,JSON.stringify(ms));
  check('computeMonthStats.calls equals callsInMonth, April and May',as.calls===1&&ys.calls===0,JSON.stringify([as,ys]));
  check('the email figures are untouched by call records',ms.drafted===0&&ms.sent===0&&ms.replied===0&&ms.archived===0,JSON.stringify(ms));
  var panel=glob.renderReportsPanel();
  check('a month with only a call is a report month',panel.indexOf('March 2026')>=0&&panel.indexOf('April 2026')>=0,panel.slice(0,200));
  check('the month card shows the calls figure',panel.indexOf('<span class="stat-n">2</span> calls')>=0&&panel.indexOf('<span class="stat-n">1</span> calls')>=0,panel.slice(0,400));
  check('the intro names calls made',panel.indexOf('calls made')>=0);

  // THE .TXT
  captured=null; glob.downloadMonthReport('2026-03'); var marTxt=captured;
  check('March .txt carries Calls: 2 in SUMMARY',marTxt!==null&&marTxt.indexOf('\nCalls: 2\n')>=0,marTxt&&marTxt.slice(0,300));
  check('March .txt carries a CALLS (2) section with both companies',marTxt.indexOf('\nCALLS (2)\n')>=0&&marTxt.indexOf('[1] Granite Fork Marine')>=0&&marTxt.indexOf('[2] Tidewater Piling')>=0,marTxt.slice(marTxt.indexOf('CALLS'),marTxt.indexOf('CALLS')+300));
  check('the outcome prints when the record carries one, indented across lines',marTxt.indexOf('  Outcome:   reached the desk\n             asked for a follow-up in April')>=0,marTxt.slice(marTxt.indexOf('CALLS'),marTxt.indexOf('CALLS')+400));
  check('the outcome line is absent when the record carries none (one Outcome line for two calls)',(marTxt.match(/\n  Outcome:/g)||[]).length===1,(marTxt.match(/\n  Outcome:/g)||[]).length);
  check('the follow-through prints the given name with its channel',marTxt.indexOf('  Follow-through: Fixture Follow (left a message)')>=0);
  check('the called day prints as a local date-time',marTxt.indexOf('  Called on: 2026-03-08 12:00')>=0,marTxt.slice(marTxt.indexOf('Called on'),marTxt.indexOf('Called on')+40));
  check('the location prints',marTxt.indexOf('  Location:  Fixture City, FX')>=0);
  captured=null; glob.downloadMonthReport('2026-04'); var aprTxt=captured;
  check('April .txt: Calls: 1, CALLS (1), the follow-through named through the linked person',aprTxt.indexOf('\nCalls: 1\n')>=0&&aprTxt.indexOf('\nCALLS (1)\n')>=0&&aprTxt.indexOf('  Follow-through: Fixture Person (connected)')>=0&&aprTxt.indexOf('Outcome:')<0,aprTxt.slice(aprTxt.indexOf('CALLS'),aprTxt.indexOf('CALLS')+300));
  captured=null; glob.downloadMonthReport('2026-05'); var mayTxt=captured;
  check('a month with no call prints Calls: 0 and CALLS (0) (none)',mayTxt.indexOf('\nCalls: 0\n')>=0&&mayTxt.indexOf('\nCALLS (0)\n(none)\n')>=0,mayTxt.slice(0,400));
  check('the CALLS section sits between ARCHIVED and ROOMS',marTxt.indexOf('ARCHIVED (')<marTxt.indexOf('CALLS (')&&marTxt.indexOf('CALLS (')<marTxt.indexOf('ROOMS ('));

  // ONE LIST, NOTHING WRITTEN
  var dl=extractFn(html,'downloadMonthReport'),rp=extractFn(html,'renderReportsPanel'),cm=extractFn(html,'computeMonthStats');
  check('downloadMonthReport reads callsInMonth',dl.indexOf('callsInMonth(')>=0);
  check('computeMonthStats reads callsInMonth',cm.indexOf('callsInMonth(')>=0);
  check('renderReportsPanel prints stats.calls and enumerates call months from callCommItems',rp.indexOf('stats.calls')>=0&&rp.indexOf('callCommItems()')>=0);
  check('no call record was written by the renders',JSON.stringify(glob.state.calls)===frozen);

  out('call_report_check: '+checks+' checks, '+failures+' failure(s) ('+htmlPath+')');
  if(failures){if(isNode)process.exit(1);throw new Error('call_report_check FAILED');}
})();
