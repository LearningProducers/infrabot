// call_stages_check.js: CALL DISPOSITIONS (infrabot v0.22.0; lpi-ops issue
// #522, the founder's review of v0.21.0 on 2026-10-16). Five pipeline
// stages on the CALLS pill, every dial a dated line carrying exactly one
// disposition from a fixed list of seven, one place for the follow-through
// name.
//
// Runs the REAL normalizeAttempts, lastAttempt, legacyDialAt, callDialed,
// callStage, normalizeCall, attemptWall, parseAttemptLines,
// attemptLinesText, attemptsHtml, logAttempt, closeCall, reopenCall,
// setCallStatus, resolveFollowThrough, linkCallContact, findContactByName,
// renderCallCard, renderCallsView, networkViewBar, callStageStrip,
// importCalls, calledAt, callCommItems, callAttemptItems, callsInMonth and
// buildStateExport, extracted from infrabot.html by a brace walk (never a
// re-implementation), against a SYNTHETIC fixture: invented companies and
// people, fictional 555 numbers, hosts under the reserved .invalid domain.
// The real state file never enters this file: the repo is public.
//
// What it pins: the five stages and the seven dispositions, exactly; the
// stage is READ from the record by one rule and never typed (no status
// select on the form); a line with a disposition outside the seven is
// dropped by the normalizer and refused by the form's parser, named; the
// form's lines parse in the home zone and round-trip; a dial from the
// card appends one line stamped to the minute and moves the close mark (a
// terminal disposition sets it, any other clears it); CLOSE and REOPEN;
// the view renders the stages as sections in order with CLOSED folded;
// the pill counts the open briefs and carries all five counts; the
// follow-through field is the one place for the name (the linked person
// is renamed to it, or the person of the new name is linked instead, a
// blank unlinks and deletes nobody); a brief from before v0.22.0 migrates
// on every path (skipped reads closed at its skip instant, called reads
// attempted on its recorded dial, the history untouched); the import
// takes every line it lacks and never reads a stage back; the month
// report counts dials; the Comms tab shows dialed open briefs only; the
// export carries the lines and the mark; the wiring routes the three
// acts.
//
// Run from the repo root:   node tests/call_stages_check.js
// Optional first argument: a path to a different infrabot.html to measure.
// Exit 0 on pass; exit 1 on any failure.

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

  var g=(typeof globalThis!=='undefined')?globalThis:this;
  var toasts=[];
  g.toast=function(msg){toasts.push(String(msg));};
  g.renderNetwork=function(){};
  g.saveState=function(){g.saved=(g.saved||0)+1;};
  var ge=eval;
  ['HOST_NAME_FLOOR','CALL_STATUSES','CALL_STAGE_LABELS','CALL_DISPOSITIONS','CALL_TERMINAL','EVENT_STATUSES','EVENT_OUTCOMES','NETWORK_VIEWS','STATE_SCHEMA_VERSION','networkView','eventsCityFilter','uid','esc'].forEach(function(n){ge(extractVar(html,n));});
  ['linkHref','linkHtml','callsList','eventsList','eventsVisible','blockedHostsList','hostBlocked','hostMatches','eventHosts','normHostName','normalizeCoHosts','artifactsList','homeTzNow',
   'normalizeSupport','normalizeAttempts','lastAttempt','legacyDialAt','callDialed','callStage','normalizeCall','attemptWall','parseAttemptLines','attemptLinesText','attemptsHtml',
   'logAttempt','closeCall','reopenCall','callStatusRank','setCallStatus','moveCallStatus','findContactByName','linkCallContact','resolveFollowThrough',
   'parseSupportLines','supportLinesText','citationVerified','supportHtml','supportRowsHtml','telHref','telHtml','callKey','callNotesHtml','renderCallCard','renderCallsView',
   'quickLogAttempt','quickCloseCall','quickReopenCall','importCalls','calledAt','callCommItems','callAttemptItems','callsInMonth','localYearMonth','wallTimeToDate',
   'personTier','normalizePerson','inMonthWindow','acquaintanceMonth','latestMetRoom','eventStartMonth','eventCities','eventsShown','normalizeEvent','normalizeCost',
   'callStageStrip','networkViewBar','_canonicalJson','buildStateExport'].forEach(function(n){ge(extractFn(html,n));});

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,260)+']'));
    if(!ok)failures++;
  }
  var T='2026-10-21T15:00:00.000Z';
  var SITE='https://fixture-fastener.invalid/';
  function brief(extra){
    return Object.assign({id:'call_fixture_1',company:'Fixture Fastener Works',location:'Placeholder, IL',phone:'(312) 555-0142',website:SITE,hook:'Their posting asks for faster writing.',
      support:[],attempts:[],closedAt:'',followName:'',followChannel:'',contactId:'',status:'queued',statusHistory:[{status:'queued',timestamp:T}],notes:'',createdAt:T,updatedAt:T},extra||{});
  }
  function line(at,d,note){return {at:at,disposition:d,note:note||''};}
  function fresh(){
    g.state={profile:{homeTz:'America/Chicago'},network:[],events:[],artifacts:[],comms:[],calls:[],blockedHosts:[]};
    toasts.length=0;g.saved=0;
  }

  // --- E: the lists ----------------------------------------------------------
  check('E1 five stages in pipeline order',JSON.stringify(CALL_STATUSES)==='["queued","attempted","connected","followup","closed"]');
  check('E2 seven dispositions, exactly, the founder\'s words',JSON.stringify(CALL_DISPOSITIONS)==='["no answer","voicemail left","gatekeeper","connected","callback booked","not interested","wrong number"]');
  check('E3 two of them are terminal',JSON.stringify(CALL_TERMINAL)==='["not interested","wrong number"]'&&CALL_TERMINAL.every(function(d){return CALL_DISPOSITIONS.indexOf(d)>=0;}));
  check('E4 every stage has a label and FOLLOW-UP is spelled with the hyphen',CALL_STATUSES.every(function(s){return typeof CALL_STAGE_LABELS[s]==='string';})&&CALL_STAGE_LABELS.followup==='FOLLOW-UP');
  check('E5 no status select on the form; the stage line, the attempts box and the close mark instead (source)',html.indexOf('id="cl-status"')<0&&html.indexOf('<div id="cl-stage"')>0&&html.indexOf('<textarea id="cl-attempts"')>0&&html.indexOf('<input type="checkbox" id="cl-closed">')>0&&html.indexOf('data-fs-edit="cl-attempts"')>0);

  // --- A: the lines ----------------------------------------------------------
  var a1=normalizeAttempts([line(T,'No Answer','  x '),{at:T,disposition:'left a message'},{at:'yesterday',disposition:'connected'},null,line('2026-10-20T15:00:00.000Z','gatekeeper'),line(T,'no answer','x')]);
  check('A1 the normalizer keeps a line with a known disposition and a readable instant, lower-cases and trims, sorts oldest first, keeps an exact double once, drops the rest',JSON.stringify(a1)==='[{"at":"2026-10-20T15:00:00.000Z","disposition":"gatekeeper","note":""},{"at":"2026-10-21T15:00:00.000Z","disposition":"no answer","note":"x"}]',JSON.stringify(a1));
  check('A2 nothing outside the seven is accepted',normalizeAttempts([line(T,'busy'),line(T,'callback'),line(T,'')]).length===0);
  check('A3 a well-formed list passes through byte-identical',JSON.stringify(normalizeAttempts(a1))===JSON.stringify(a1));
  fresh();
  var p1=parseAttemptLines('2026-10-21 14:05 voicemail left asked for the publisher\n\n2026-10-20 gatekeeper: Ada at the desk\nconnected, one page in writing\nCALLBACK BOOKED Friday 10am',T);
  check('A4 the form parses a date with a time in the home zone, a date alone at noon, a line with no date at the save instant, the note after the disposition',p1.bad.length===0&&p1.attempts.length===4
    &&JSON.stringify(p1.attempts.map(function(a){return [a.at,a.disposition,a.note];}))===JSON.stringify([['2026-10-20T17:00:00.000Z','gatekeeper','Ada at the desk'],['2026-10-21T15:00:00.000Z','connected','one page in writing'],['2026-10-21T15:00:00.000Z','callback booked','Friday 10am'],['2026-10-21T19:05:00.000Z','voicemail left','asked for the publisher']]),JSON.stringify(p1));
  var p2=parseAttemptLines('2026-10-21 14:05 busy, try later\nno answer\n2026-13-45 connected',T);
  check('A5 a line with none of the seven, or an unreadable date, is reported by its text and never guessed',p2.bad.length===2&&p2.bad[0]==='2026-10-21 14:05 busy, try later'&&p2.bad[1]==='2026-13-45 connected'&&p2.attempts.length===1&&p2.attempts[0].disposition==='no answer',JSON.stringify(p2));
  check('A6 the wall time prints to the minute in the home zone',attemptWall('2026-10-21T19:05:00.000Z')==='2026-10-21 14:05');
  var rt=attemptLinesText(p1.attempts);
  check('A7 the text form round-trips through the parser',JSON.stringify(parseAttemptLines(rt,T).attempts)===JSON.stringify(p1.attempts)&&rt.split('\n')[0]==='2026-10-20 12:00 gatekeeper Ada at the desk',rt);
  check('A8 a disposition that is a prefix of a longer phrase never swallows it (connected vs a note starting with a word)',parseAttemptLines('connected call back booked',T).attempts[0].note==='call back booked'&&parseAttemptLines('callback booked',T).attempts[0].disposition==='callback booked');

  // --- S: the stage ----------------------------------------------------------
  fresh();
  function stage(extra){return callStage(normalizeCall(brief(extra)));}
  check('S1 no dial on the record: QUEUED, a follow-through name alone does not move it',stage()==='queued'&&stage({followName:'Ada Fixture'})==='queued');
  check('S2 a line that did not reach anyone: ATTEMPTED',stage({attempts:[line(T,'no answer')]})==='attempted'&&stage({attempts:[line(T,'voicemail left')]})==='attempted'&&stage({attempts:[line(T,'gatekeeper')]})==='attempted');
  check('S3 the last line connected and no next act named: CONNECTED',stage({attempts:[line('2026-10-20T15:00:00.000Z','no answer'),line(T,'connected')]})==='connected');
  check('S4 a next act named: FOLLOW-UP (a callback booked on the last line, or a follow-through person after any dial)',stage({attempts:[line(T,'callback booked')]})==='followup'&&stage({attempts:[line(T,'gatekeeper')],followName:'Ada Fixture'})==='followup'&&stage({attempts:[line(T,'connected')],contactId:'c_1'})==='followup');
  check('S5 the close mark wins over everything',stage({attempts:[line(T,'connected')],contactId:'c_1',closedAt:T})==='closed'&&stage({closedAt:T})==='closed');
  check('S6 the last line decides, not the loudest',stage({attempts:[line('2026-10-20T15:00:00.000Z','connected'),line(T,'no answer')]})==='attempted');
  check('S7 a terminal disposition on the record alone does not close it: the close mark does, which the act sets (the rule has one close field)',stage({attempts:[line(T,'not interested')]})==='attempted');
  var nc=normalizeCall(brief({status:'wat',attempts:[line(T,'connected')]}));
  check('S8 normalizeCall writes the stage onto the record from the rule; a typed status is overwritten',nc.status==='connected');

  // --- L: the acts -----------------------------------------------------------
  fresh();
  var c1=normalizeCall(brief());
  check('L1 logAttempt refuses a word outside the seven and writes nothing',logAttempt(c1,'busy')===false&&c1.attempts.length===0&&c1.status==='queued');
  var when='2026-10-21T15:07:00.000Z';
  check('L2 a dial appends one line at the instant given and moves the stage onto the history',logAttempt(c1,'No Answer','',when)===true&&c1.attempts.length===1&&c1.attempts[0].disposition==='no answer'&&c1.attempts[0].at===when&&c1.status==='attempted'&&c1.statusHistory[c1.statusHistory.length-1].status==='attempted'&&c1.updatedAt===when);
  check('L3 a terminal disposition sets the close mark at the line\'s instant',logAttempt(c1,'not interested','',T)===true&&c1.closedAt===T&&c1.status==='closed');
  check('L4 a later dial clears the mark and the stage reads from the new line',logAttempt(c1,'connected','they called back','2026-10-22T15:00:00.000Z')===true&&c1.closedAt===''&&c1.status==='connected'&&c1.attempts.length===3);
  check('L5 CLOSE sets the mark by hand; a second CLOSE is a no-op; REOPEN clears it and the stage reads again',closeCall(c1,'2026-10-23T15:00:00.000Z')===true&&c1.status==='closed'&&closeCall(c1)===false&&reopenCall(c1,'2026-10-24T15:00:00.000Z')===true&&c1.closedAt===''&&c1.status==='connected'&&reopenCall(c1)===false);
  var c2=normalizeCall(brief());
  logAttempt(c2,'voicemail left');
  check('L6 a dial with no instant given is stamped now, to the minute',/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(c2.attempts[0].at)&&Math.abs(Date.parse(c2.attempts[0].at)-Date.now())<120000,c2.attempts[0].at);
  fresh();
  state.calls=[brief()];
  quickLogAttempt('call_fixture_1','gatekeeper');
  check('L7 the card\'s LOG act writes the line, toasts the company, the disposition and the stage, saves and repaints',state.calls[0].attempts.length===1&&state.calls[0].status==='attempted'&&toasts[0]==='FIXTURE FASTENER WORKS · GATEKEEPER · ATTEMPTED'&&g.saved===1);
  quickLogAttempt('call_fixture_1','busy');
  check('L8 the LOG act with a word outside the seven writes nothing and saves nothing',state.calls[0].attempts.length===1&&g.saved===1);
  quickCloseCall('call_fixture_1');quickReopenCall('call_fixture_1');
  check('L9 CLOSE and REOPEN from the card',toasts[1]==='FIXTURE FASTENER WORKS · CLOSED'&&toasts[2]==='FIXTURE FASTENER WORKS · REOPENED · ATTEMPTED'&&state.calls[0].closedAt===''&&g.saved===3);

  // --- R: the card and the view ---------------------------------------------
  fresh();
  var rc=renderCallCard(normalizeCall(brief({attempts:[line('2026-10-21T19:05:00.000Z','voicemail left','asked for the publisher'),line('2026-10-20T17:00:00.000Z','no answer')]})));
  check('R1 the card lists the lines oldest first, the wall time, the disposition, the note',rc.indexOf('<div class="attempt-line"><span class="attempt-when">2026-10-20 12:00</span><span class="attempt-disp">no answer</span></div><div class="attempt-line"><span class="attempt-when">2026-10-21 14:05</span><span class="attempt-disp">voicemail left</span><span>asked for the publisher</span></div>')>0,rc);
  check('R2 the pill reads the stage label',rc.indexOf('<span class="card-status attempted">ATTEMPTED</span>')>0);
  check('R3 a brief with no dial says so on the card',renderCallCard(normalizeCall(brief())).indexOf('no dial yet')>0);
  var legacy=normalizeCall(brief({status:'called',statusHistory:[{status:'queued',timestamp:'2026-10-07T15:00:00.000Z'},{status:'called',timestamp:'2026-10-07T18:30:00.000Z'}]}));
  var rl=renderCallCard(legacy);
  check('R4 a brief from before v0.22.0 reads ATTEMPTED on its recorded dial, the outcome named as not logged, the history untouched',legacy.status==='attempted'&&legacy.attempts.length===0&&legacy.statusHistory.length===2&&legacy.statusHistory[1].status==='called'&&rl.indexOf('<span class="attempt-when">2026-10-07 13:30</span><span class="attempt-disp attempt-legacy">dialed, outcome not logged</span>')>0,rl);
  var skipped=normalizeCall(brief({status:'skipped',statusHistory:[{status:'queued',timestamp:'2026-10-07T15:00:00.000Z'},{status:'skipped',timestamp:'2026-10-08T15:00:00.000Z'}]}));
  delete skipped.attempts;delete skipped.closedAt;skipped.status='skipped';normalizeCall(skipped);
  check('R5 a skipped brief from before v0.22.0 reads CLOSED at its skip instant, on any path (the normalizer is the migration)',skipped.status==='closed'&&skipped.closedAt==='2026-10-08T15:00:00.000Z'&&skipped.statusHistory[1].status==='skipped');
  var closedCard=renderCallCard(normalizeCall(brief({closedAt:T})));
  check('R6 a closed card offers REOPEN and OPEN only',closedCard.indexOf('data-act="reopen-call"')>0&&closedCard.indexOf('data-act="log-call"')<0&&closedCard.indexOf('data-act="close-call"')<0&&closedCard.indexOf('<span class="card-status closed">CLOSED</span>')>0);
  check('R7 the card escapes a note',renderCallCard(normalizeCall(brief({attempts:[line(T,'connected','<b>x</b>')]}))).indexOf('<span>&lt;b&gt;x&lt;/b&gt;</span>')>0);
  fresh();
  state.calls=[brief({id:'q'}),brief({id:'a',website:'https://a.invalid/',attempts:[line(T,'no answer')]}),brief({id:'c',website:'https://c.invalid/',attempts:[line(T,'connected')]}),
    brief({id:'f',website:'https://f.invalid/',attempts:[line(T,'callback booked')]}),brief({id:'x',website:'https://x.invalid/',closedAt:T}),brief({id:'x2',website:'https://x2.invalid/',closedAt:T})];
  var view=renderCallsView();
  var order=['QUEUED · 1','ATTEMPTED · 1','CONNECTED · 1','FOLLOW-UP · 1','CLOSED · 2'].map(function(h){return view.indexOf(h);});
  check('R8 the view renders the five stages as sections in pipeline order, each with its count, CLOSED folded at the foot',order.every(function(i){return i>0;})&&order[0]<order[1]&&order[1]<order[2]&&order[2]<order[3]&&order[3]<order[4]&&view.indexOf('<details class="skip-fold"><summary')>0&&view.indexOf('<details')<order[4],view.slice(0,300));
  var bar=networkViewBar();
  check('R9 the pill counts the four open briefs and carries all five counts in order with their names on the title',/data-view="calls">CALLS<span class="triage-count">· 4<\/span><span class="stage-counts" title="QUEUED 1 · ATTEMPTED 1 · CONNECTED 1 · FOLLOW-UP 1 · CLOSED 2">1·1·1·1·2<\/span>/.test(bar),bar);
  state.calls=[brief({id:'x',closedAt:T})];
  check('R10 only closed briefs: a named empty line over the fold',renderCallsView().indexOf('NO OPEN CALLS')>0&&renderCallsView().indexOf('CLOSED · 1')>0&&/CALLS<span class="triage-count">· 0<\/span>/.test(networkViewBar()));

  // --- F: one place for the name --------------------------------------------
  fresh();
  state.network.push({id:'p_1',name:'Julie Fixture',channel:'',city:'',tier:'acquaintance',metAt:[]});
  var f1=resolveFollowThrough('','julie fixture','(312) 555-0150','Placeholder, IL',T);
  check('F1 a typed name links the person of that name and fills an empty channel',f1.contactId==='p_1'&&f1.followName==='Julie Fixture'&&f1.renamed===false&&state.network[0].channel==='(312) 555-0150'&&state.network.length===1);
  var f2=resolveFollowThrough('p_1','Julie Fixtura','','',T);
  check('F2 a changed spelling on a linked brief RENAMES the linked person (the field is the source; nobody new is made)',f2.contactId==='p_1'&&f2.followName==='Julie Fixtura'&&f2.renamed===true&&state.network[0].name==='Julie Fixtura'&&state.network[0].updatedAt===T&&state.network.length===1);
  state.network.push({id:'p_2',name:'Ada Fixture',channel:'ada@fixture.invalid',city:'',tier:'contact',metAt:[]});
  var f3=resolveFollowThrough('p_1','Ada Fixture','(312) 555-0199','',T);
  check('F3 a changed name that already names a person RELINKS to that person; the old person keeps their name and the set channel is never overwritten',f3.contactId==='p_2'&&f3.followName==='Ada Fixture'&&f3.renamed===false&&state.network[0].name==='Julie Fixtura'&&state.network[1].channel==='ada@fixture.invalid');
  var f4=resolveFollowThrough('p_2','','','',T);
  check('F4 a blank field unlinks and deletes nobody',f4.contactId===''&&f4.followName===''&&state.network.length===2);
  var f5=resolveFollowThrough('','New Fixture Person','(312) 555-0160','Placeholder, IL',T);
  check('F5 a name nobody carries creates the acquaintance through linkCallContact',state.network.length===3&&state.network[2].id===f5.contactId&&state.network[2].name==='New Fixture Person'&&state.network[2].tier==='acquaintance'&&f5.followName==='New Fixture Person');
  check('F6 the form writes the resolved name onto the record and the card reads the person (source)',(function(){var s=extractFn(html,'saveCall');var r=extractFn(html,'renderCallCard');return s.indexOf('data.contactId=who.contactId;data.followName=who.followName;')>0&&s.indexOf("if(who.renamed)toast('PERSON RENAMED: '")>0&&r.indexOf('const followName=person?person.name:c.followName;')>0;})());

  // --- I: the import, the seams, the report -----------------------------------
  fresh();
  importCalls([brief({attempts:[line(T,'no answer')]})]);
  var r1=importCalls([brief({attempts:[line(T,'no answer'),line('2026-10-22T15:00:00.000Z','connected')],closedAt:'',status:'queued'})]);
  check('I1 the import takes the line it lacks and keeps the one it has; the stage reads from the merged record',r1.updated===1&&state.calls[0].attempts.length===2&&state.calls[0].status==='connected');
  var r2=importCalls([brief({status:'queued'})]);
  check('I2 an incoming record with fewer lines changes nothing: no stage reads back',r2.skipped===1&&state.calls[0].attempts.length===2&&state.calls[0].status==='connected');
  var r3=importCalls([brief({closedAt:'2026-10-23T15:00:00.000Z'})]);
  check('I3 a close mark fills only an empty one',r3.updated===1&&state.calls[0].closedAt==='2026-10-23T15:00:00.000Z'&&state.calls[0].status==='closed'&&importCalls([brief({closedAt:'2026-10-24T15:00:00.000Z'})]).skipped===1&&state.calls[0].closedAt==='2026-10-23T15:00:00.000Z');
  check('I4 the import never reads callStatusRank (no ladder; the record decides) (source)',extractFn(html,'importCalls').indexOf('callStatusRank')<0&&extractFn(html,'importCalls').indexOf('callStage(local)')>0);
  fresh();
  state.calls=[brief({id:'a',attempts:[line('2026-10-02T15:00:00.000Z','no answer'),line('2026-10-21T15:00:00.000Z','connected')]}),brief({id:'b',website:'https://b.invalid/',attempts:[line('2026-10-05T15:00:00.000Z','not interested')],closedAt:'2026-10-05T15:00:00.000Z'}),brief({id:'q',website:'https://q.invalid/'})];
  var oct=callsInMonth('2026-10');
  check('I5 a call made is a dial: three lines in October are three calls, a closed brief\'s dial among them, oldest first',oct.length===3&&oct.map(function(it){return it.c.id+':'+it.attempt.disposition;}).join(',')==='a:no answer,b:not interested,a:connected');
  var items=callCommItems();
  check('I6 the Comms tab shows the dialed open brief at its last dial; the closed one and the queued one stay off',items.length===1&&items[0].c.id==='a'&&items[0].when==='2026-10-21T15:00:00.000Z'&&calledAt(state.calls[0])==='2026-10-21T15:00:00.000Z');
  var exp=JSON.parse(buildStateExport());
  check('I7 the export carries the lines and the mark on each brief',exp.calls.length===3&&JSON.stringify(exp.calls[0].attempts)===JSON.stringify(state.calls[0].attempts)&&exp.calls[1].closedAt==='2026-10-05T15:00:00.000Z'&&exp.schemaVersion===STATE_SCHEMA_VERSION);
  check('I8 the book migrates at load and the wiring routes the three acts (source)',extractFn(html,'loadState').indexOf('if(Array.isArray(s.calls))s.calls.forEach(c=>normalizeCall(c));')>0
    &&["if(act==='log-call'){const sel=g('network-body').querySelector('select[data-log-for=\"'+id+'\"]');quickLogAttempt(id,sel?sel.value:'');}","if(act==='close-call')quickCloseCall(id);","if(act==='reopen-call')quickReopenCall(id);","g('cl-attempts').addEventListener('input',refreshStagePreview);","g('cl-closed').addEventListener('change',refreshStagePreview);","g('cl-follow').addEventListener('input',refreshStagePreview);"].every(function(s){return html.indexOf(s)>0;})
    &&html.indexOf('quickCallStatus')<0&&html.indexOf("'called-call'")<0&&html.indexOf("'skip-call'")<0);
  check('I9 the nine MET-pinned symbols are not read by the new block for a write (source)',(function(){var s=['logAttempt','closeCall','reopenCall','resolveFollowThrough','parseAttemptLines','importCalls'].map(function(n){return extractFn(html,n);}).join('');return s.indexOf('linkMetNames')<0&&s.indexOf('syncMetLinks')<0&&s.indexOf('parseMetNames')<0;})());

  out('');
  out(failures===0?'ALL GREEN: '+checks+' checks':'FAILURES: '+failures+' of '+checks);
  if(failures){if(isNode)process.exit(1);throw new Error('call_stages_check: '+failures+' failure(s)');}
})();
