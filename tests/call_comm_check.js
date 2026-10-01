// call_comm_check.js: THE CALL ON THE COMMUNICATIONS TAB (infrabot v0.17.0).
// A completed call (status called) shows on the Communications tab as its own
// card in the PIPELINE view, outbound, channel PHONE, with its outcome, the
// follow-through and the day it was made, sorted among the email cards and
// counted in the pill; derived at render from the call record, written
// nowhere; the Network tab's calls untouched; OPEN opens the call brief.
//
// Runs the REAL calledAt, callCommItems, renderCallCommCard, normalizeCall,
// normalizeSupport, hookHtml and the link helpers extracted from infrabot.html
// by a brace walk (never a re-implementation) against SYNTHETIC call records:
// invented companies, people, numbers and ids under .invalid. The repo is
// public.
//
// Run from the repo root:   node tests/call_comm_check.js
//                     or:   jsc  tests/call_comm_check.js
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
  glob.state={comms:[],network:[],calls:[],profile:{homeTz:'America/Chicago'}};
  glob.saveState=function(){throw new Error('saveState must never run from a derived render');};
  var ge=eval;
  ['esc','URL_TOKEN_RE','CALL_STATUSES'].forEach(function(n){ge(extractVar(html,n));});
  ['linkHref','linkHtml','urlTokenParts','linkedTextHtml','hookHtml','homeTzNow','normalizeSupport','normalizeCall','callsList','calledAt','callCommItems','renderCallCommCard'].forEach(function(n){ge(extractFn(html,n));});

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,240)+']'));
    if(!ok)failures++;
  }

  var called={id:'id_fix_call1',company:'Fixture Fasteners',location:'Fixture City',phone:'(555) 010-0100',website:'https://fixture-fasteners.invalid/',hook:'OPERATOR. The one reason for the call.',support:[],followName:'Pat Fixture',followChannel:'(555) 010-0199',contactId:'',status:'called',notes:'Spoke with <Pat> & the desk; they asked for one page in writing.',createdAt:'2026-01-01T10:00:00.000Z',updatedAt:'2026-01-02T19:36:00.000Z',statusHistory:[{status:'queued',timestamp:'2026-01-01T10:00:00.000Z'},{status:'called',timestamp:'2026-01-02T19:36:00.000Z'}]};
  var queued={id:'id_fix_call2',company:'Queued Co',location:'',phone:'',website:'',hook:'A hook.',support:[],followName:'',followChannel:'',contactId:'',status:'queued',notes:'',createdAt:'2026-01-03T10:00:00.000Z',statusHistory:[{status:'queued',timestamp:'2026-01-03T10:00:00.000Z'}]};
  var skipped={id:'id_fix_call3',company:'Skipped Co',location:'',phone:'',website:'',hook:'A hook.',support:[],followName:'',followChannel:'',contactId:'',status:'skipped',notes:'',createdAt:'2026-01-03T10:00:00.000Z',statusHistory:[{status:'skipped',timestamp:'2026-01-04T10:00:00.000Z'}]};
  glob.state.calls=[queued,called,skipped];

  // --- D: derivation --------------------------------------------------------
  var items=callCommItems();
  check('D1 only the completed call becomes an item; queued and skipped stay off the tab', items.length===1&&items[0].kind==='call'&&items[0].c.id==='id_fix_call1', JSON.stringify(items.map(function(i){return i.c.id;})));
  check('D2 the item\'s instant is the call\'s called transition, not its creation', items[0].when==='2026-01-02T19:36:00.000Z', items[0].when);
  check('D3 a called record with no called transition falls back to its stamps', calledAt({status:'called',updatedAt:'2026-02-01T00:00:00.000Z',statusHistory:[]})==='2026-02-01T00:00:00.000Z', '');
  check('D4 the derivation reads the record and writes nothing (no saveState, no state.comms push)', (function(){var src=extractFn(html,'callCommItems')+extractFn(html,'renderCallCommCard')+extractFn(html,'calledAt');return src.indexOf('saveState')===-1&&src.indexOf('comms.push')===-1&&src.indexOf('state.comms')===-1;})(), '');

  // --- R: the card -----------------------------------------------------------
  var h=renderCallCommCard(normalizeCall(called));
  check('R1 the card names the company and reads OUT, PHONE, the number and the location in its sub line', h.indexOf('card-name">Fixture Fasteners<')!==-1&&h.indexOf('OUT →</span> · PHONE · (555) 010-0100 · FIXTURE CITY')!==-1, h.slice(0,400));
  check('R2 the status pill reads CALLED in the called style', h.indexOf('<span class="card-status called">CALLED</span>')!==-1, '');
  check('R3 the outcome is the call\'s notes, escaped, in its own section', h.indexOf('card-section-h">Outcome<')!==-1&&h.indexOf('Spoke with &lt;Pat&gt; &amp; the desk; they asked for one page in writing.')!==-1&&h.indexOf('<Pat>')===-1, h);
  check('R4 the hook renders through the one hook renderer', h.indexOf('card-section-h">Hook<')!==-1&&h.indexOf('OPERATOR. The one reason for the call.')!==-1, '');
  check('R5 the follow-through names the person and the channel', h.indexOf('card-section-h">Follow-through<')!==-1&&h.indexOf('Pat Fixture · (555) 010-0199')!==-1, '');
  check('R6 the day it was made renders as a local date', /card-section-h">Called<[\s\S]*?>2026-01-02</.test(h), h.slice(h.indexOf('Called')));
  check('R7 OPEN carries the call\'s own action and id, nothing else acts', h.indexOf('data-act="edit-call" data-id="id_fix_call1"')!==-1&&(h.match(/data-act=/g)||[]).length===1, '');
  var h2=renderCallCommCard(normalizeCall(Object.assign({},called,{notes:'',followName:'',followChannel:'',location:'',phone:''})));
  check('R8 a call with no notes says so, and empty fields render nothing', h2.indexOf('no notes on the call')!==-1&&h2.indexOf('Follow-through')===-1&&h2.indexOf('OUT →</span> · PHONE</div>')!==-1, h2.slice(0,300));

  // --- S: source pins ---------------------------------------------------------
  var rc=extractFn(html,'renderComms');
  check('S1 renderComms counts completed calls in the PIPELINE pill', rc.indexOf('const callItems=callCommItems();')!==-1&&rc.indexOf('counts.pipeline+=callItems.length;')!==-1, '');
  check('S2 the pipeline view interleaves call cards among the comms by date', rc.indexOf("if(view==='pipeline'){callItems.forEach(it=>items.push(it));")!==-1&&rc.indexOf("if(it.kind==='call'){html+=renderCallCommCard(it.c);return;}")!==-1, '');
  check('S3 the empty states account for a completed call', rc.indexOf("if(state.comms.length===0&&!callItems.length){")!==-1&&rc.indexOf("if(filtered.length===0&&!(view==='pipeline'&&callItems.length)){")!==-1, '');
  check('S4 the Communications tab dispatcher opens the call brief', /if\(act==='edit-comm'\)openCommModal\(id\);\s*if\(act==='edit-call'\)openCallModal\(id\);/.test(html), '');
  check('S5 the Network tab\'s call view and card are untouched by name', extractFn(html,'renderCallsView').indexOf('renderCallCommCard')===-1&&extractFn(html,'renderCallCard').indexOf('callCommItems')===-1, '');
  check('S6 no record is written: the month report and COPY ALL read comms only', extractFn(html,'downloadMonthReport').indexOf('callCommItems')===-1&&extractFn(html,'commPlainText').indexOf('call')===-1, '');
  check('S7 the council prompt\'s nameless salutation is Hi, alone and Hello, is gone', (function(){var s=html.indexOf('const COUNCIL_SYSTEM_BASE=`');var e=html.indexOf('`;',s);var p=html.slice(s,e);return p.indexOf('"Hi," alone')!==-1&&p.indexOf('Hello,')===-1;})(), '');

  out('call_comm_check: '+checks+' checks, '+failures+' failure(s)');
  if(failures){if(isNode)process.exit(1);throw new Error('call_comm_check FAILED');}
})();
