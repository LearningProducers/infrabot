// call_card_check.js: THE CALL CARD, ORGANIZED FOR THE DIAL (infrabot
// v0.23.0). A call card is read in the minute before a phone call, so it
// reads in the order a call runs: THE DOOR (who picks up, what to ask for),
// WHY NOW (the hook), THE CASE (the support lines, each of which may end
// " => " + the one sentence argued back), THE ASK (what a win is), then
// ATTEMPTS, FOLLOW-THROUGH, NOTES.
//
// Runs the REAL normalizeSupport, parseSupportLines, supportLinesText,
// citationVerified, supportRowsHtml, supportHtml, normalizeCall,
// renderCallCard and importCalls, extracted from infrabot.html by a brace
// walk (never a re-implementation), against a SYNTHETIC fixture: an
// invented landscaping crew, example.com pages, a fictional 555 number.
// The real state file never enters this file: the repo is public.
//
// What it pins: a line parses with and without " => "; a quote that itself
// carries " => " splits on the LAST one; the text form round-trips a line
// byte-exact; the answer row renders under the page row and nowhere when
// there is no answer; CHECKED is decided without the answer, with and
// without one; the card's seven sections stand in the dial's order; THE
// DOOR and THE ASK render when present and render nothing when absent; a
// record from before v0.23.0 normalizes to empty door, ask and answers and
// renders byte-identical to a record that carries them empty; the form
// carries the fields in the same order under the named headings; the
// import fills an empty door or ask and never overwrites one; the four
// version sites read v0.23.0.
//
// Run from the repo root:   node tests/call_card_check.js
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
   'parseSupportLines','supportLinesText','citationVerified','supportHtml','supportRowsHtml','telHref','telHtml','callKey','callNotesHtml','renderCallCard',
   'importCalls','localYearMonth','wallTimeToDate','personTier','normalizePerson','inMonthWindow','acquaintanceMonth','latestMetRoom','eventStartMonth','normalizeEvent','normalizeCost'].forEach(function(n){ge(extractFn(html,n));});

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,300)+']'));
    if(!ok)failures++;
  }
  var T='2026-11-03T15:00:00.000Z';
  var PAGE='https://example.com/services';
  var QUOTE='We only hire crews with a 4-season portfolio.';
  var ANSWER='Our crew has run four seasons on the Example Plaza grounds.';
  var DOOR='front desk; ask for whoever handles vendor contracts';
  var ASK='a 20-minute walk of the property next week';
  var LINE='2026-10-28 '+PAGE+' "'+QUOTE+'"';
  var LINE_A=LINE+' => '+ANSWER;
  function cite(extra){return Object.assign({quote:QUOTE,url:PAGE,checked:'2026-10-28',unverified:false,answer:''},extra||{});}
  function brief(extra){
    return Object.assign({id:'call_fixture_1',company:'Example Grounds Crew',location:'Placeholder, IL',phone:'(312) 555-0142',website:'https://example.com/',
      door:DOOR,hook:'Their services page says they take new grounds contracts in the fall.',ask:ASK,
      support:[cite({answer:ANSWER})],attempts:[],closedAt:'',followName:'',followChannel:'',contactId:'',status:'queued',statusHistory:[{status:'queued',timestamp:T}],notes:'',createdAt:T,updatedAt:T},extra||{});
  }
  function fresh(){
    g.state={profile:{homeTz:'America/Chicago'},network:[],events:[],artifacts:[],comms:[],calls:[],blockedHosts:[]};
    toasts.length=0;g.saved=0;
  }
  function order(h,heads){
    var idx=heads.map(function(t){return h.indexOf('<div class="card-section-h">'+t+'</div>');});
    for(var i=0;i<idx.length;i++){if(idx[i]<0)return 'missing '+heads[i];if(i&&idx[i]<idx[i-1])return heads[i]+' before '+heads[i-1];}
    return '';
  }

  // --- P: the parse ----------------------------------------------------------
  var p1=parseSupportLines(LINE);
  check('P1 a line with no " => " parses as before and carries an empty answer',p1.length===1&&p1[0].checked==='2026-10-28'&&p1[0].url===PAGE&&p1[0].quote===QUOTE&&p1[0].unverified===false&&p1[0].answer==='',JSON.stringify(p1));
  var p2=parseSupportLines(LINE_A);
  check('P2 a line ending " => " + a sentence carries that sentence as the answer, the left half unchanged',p2.length===1&&p2[0].checked==='2026-10-28'&&p2[0].url===PAGE&&p2[0].quote===QUOTE&&p2[0].unverified===false&&p2[0].answer===ANSWER,JSON.stringify(p2));
  var p3=parseSupportLines('2026-10-28 '+PAGE+' "if the bid => the walk, then the contract" => We bid Monday.');
  check('P3 a quote that itself carries " => " splits on the LAST one; the arrow stays in the words',p3.length===1&&p3[0].quote==='if the bid => the walk, then the contract'&&p3[0].answer==='We bid Monday.'&&p3[0].url===PAGE,JSON.stringify(p3));
  var p4=parseSupportLines(LINE+' =>    spaced out   ');
  check('P4 the answer is trimmed',p4.length===1&&p4[0].answer==='spaced out',JSON.stringify(p4));
  var p5=parseSupportLines('UNVERIFIED '+PAGE+' 2026-10-28 the words first => a reply');
  check('P5 the flag, the tokens in any order and the answer ride one line together',p5.length===1&&p5[0].unverified===true&&p5[0].checked==='2026-10-28'&&p5[0].url===PAGE&&p5[0].quote==='the words first'&&p5[0].answer==='a reply',JSON.stringify(p5));
  var p6=parseSupportLines(' => an answer with nothing cited\n'+LINE+' => \n\n');
  check('P6 an answer with neither words nor a page stores nothing; a trailing " => " with nothing after it is an empty answer',p6.length===1&&p6[0].quote===QUOTE&&p6[0].answer==='',JSON.stringify(p6));
  var p7=parseSupportLines(LINE+' =>x');
  check('P7 "=>" without the spaces around it is words, not the split',p7.length===1&&p7[0].answer===''&&p7[0].quote.indexOf('=>x')>0&&p7[0].url===PAGE,JSON.stringify(p7));

  // --- T: the text form ------------------------------------------------------
  check('T1 the text form of a parsed line with an answer is the line, byte-exact',supportLinesText(parseSupportLines(LINE_A))===LINE_A,supportLinesText(parseSupportLines(LINE_A)));
  check('T2 and of a line with no answer, byte-exact, no trailing arrow',supportLinesText(parseSupportLines(LINE))===LINE,supportLinesText(parseSupportLines(LINE)));
  var multi=LINE_A+'\nUNVERIFIED 2026-10-27 https://example.com/team "two names on the team page" => We asked for both.\n'+LINE;
  check('T3 three lines, two with answers, round-trip byte-exact',supportLinesText(parseSupportLines(multi))===multi,supportLinesText(parseSupportLines(multi)));
  check('T4 parse, text, parse is a fixed point',JSON.stringify(parseSupportLines(supportLinesText(parseSupportLines(multi))))===JSON.stringify(parseSupportLines(multi)));

  // --- N: the normalizer -----------------------------------------------------
  var n1=normalizeSupport([{quote:QUOTE,url:PAGE,checked:'2026-10-28'},{quote:QUOTE,url:PAGE,checked:'2026-10-28',answer:'  trimmed  '},{url:PAGE,answer:7}]);
  check('N1 normalizeSupport carries answer as a trimmed string, empty by default',JSON.stringify(n1.map(function(s){return s.answer;}))==='["","trimmed","7"]',JSON.stringify(n1));
  check('N2 a well-formed citation with an answer passes through byte-identical',JSON.stringify(normalizeSupport([cite({answer:ANSWER})]))===JSON.stringify([cite({answer:ANSWER})]));
  check('N3 the five keys, in a fixed order',Object.keys(normalizeSupport([cite()])[0]).join(',')==='quote,url,checked,unverified,answer');

  // --- C: CHECKED is decided without the answer ------------------------------
  check('C1 a dated, paged, unflagged citation is verified with an answer and without one',citationVerified(cite())===true&&citationVerified(cite({answer:ANSWER}))===true);
  check('C2 a flagged citation stays unverified with an answer written',citationVerified(cite({unverified:true}))===false&&citationVerified(cite({unverified:true,answer:ANSWER}))===false);
  check('C3 no check date, no page: unverified, answer or not',citationVerified(cite({checked:'',answer:ANSWER}))===false&&citationVerified(cite({url:'',answer:ANSWER}))===false);
  check('C4 citationVerified never reads the answer (source)',extractFn(html,'citationVerified').indexOf('answer')<0);
  var hA=supportRowsHtml([cite({answer:ANSWER})]),hN=supportRowsHtml([cite()]);
  check('C5 the CHECKED pill renders the same with and without an answer',hA.indexOf('<span class="cite-pill">CHECKED 2026-10-28</span>')>0&&hN.indexOf('<span class="cite-pill">CHECKED 2026-10-28</span>')>0&&hA.indexOf('unverified')<0&&hN.indexOf('unverified')<0);
  check('C6 the UNVERIFIED pill renders the same with an answer',supportRowsHtml([cite({unverified:true,answer:ANSWER})]).indexOf('<span class="cite-pill unverified">UNVERIFIED</span>')>0);

  // --- H: the answer row -----------------------------------------------------
  var pageRow='<div class="cite-page">'+linkHtml(PAGE)+'<span class="cite-pill">CHECKED 2026-10-28</span></div>';
  check('H1 the answer row sits under the page row, class cite-answer, the text prefixed "=> "',hA.indexOf(pageRow+'<div class="cite-answer">=&gt; '+esc(ANSWER)+'</div></div>')>0,hA);
  check('H2 no answer, no row',hN.indexOf('cite-answer')<0&&hN.indexOf(pageRow+'</div>')>0,hN);
  check('H3 the answer is escaped',supportRowsHtml([cite({answer:'<b>x</b> & "y"'})]).indexOf('<div class="cite-answer">=&gt; &lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;</div>')>0);
  check('H4 the row is accent colored and monospace, in the card and in the form preview (source)',/\.cite-answer\{[^\n]*var\(--mono\)[^\n]*var\(--cyan\)[^\n]*\}/.test(html)&&html.indexOf('.support-preview .cite-answer{')>0);
  check('H5 the live preview under the box renders the same rows (source)',extractFn(html,'refreshSupportPreview').indexOf('supportRowsHtml(parseSupportLines(')>0&&extractFn(html,'supportHtml').indexOf('supportRowsHtml(list)')>0);
  check('H6 the case section carries the heading THE CASE',supportHtml([cite()]).indexOf('<div class="card-section-h">The case</div>')===('<div class="card-section">').length&&supportHtml([])==='');

  // --- R: the card, in the order a call runs ----------------------------------
  fresh();
  var full=normalizeCall(brief({attempts:[{at:T,disposition:'gatekeeper',note:'the desk took a message'}],notes:'ask about the fall schedule'}));
  var card=renderCallCard(full);
  check('R1 the seven sections stand in the dial\'s order: THE DOOR, WHY NOW, THE CASE, THE ASK, ATTEMPTS, FOLLOW-THROUGH, NOTES',order(card,['The door','Why now','The case','The ask','Attempts','Follow-through','Notes'])==='',order(card,['The door','Why now','The case','The ask','Attempts','Follow-through','Notes']));
  check('R2 THE DOOR renders the door text in the mono body',card.indexOf('<div class="card-section-h">The door</div><div class="card-section-body call-mono">'+esc(DOOR)+'</div>')>0,card);
  check('R3 WHY NOW renders the hook; the Hook heading is gone',card.indexOf('<div class="card-section-h">Why now</div><div class="card-section-body">'+esc(full.hook)+'</div>')>0&&card.indexOf('<div class="card-section-h">Hook</div>')<0);
  check('R4 THE ASK renders the ask text',card.indexOf('<div class="card-section-h">The ask</div><div class="card-section-body">'+esc(ASK)+'</div>')>0);
  check('R5 the answer row renders on the card under its citation',card.indexOf('<div class="cite-answer">=&gt; '+esc(ANSWER)+'</div>')>0);
  check('R6 the website sits between WHY NOW and THE CASE',order(card,['Why now','Website','The case'])==='');
  var noDoor=renderCallCard(normalizeCall(brief({door:''})));
  check('R7 an empty DOOR renders nothing, the rest in order',noDoor.indexOf('The door')<0&&order(noDoor,['Why now','The case','The ask','Attempts','Follow-through'])==='');
  var noAsk=renderCallCard(normalizeCall(brief({ask:''})));
  check('R8 an empty ASK renders nothing, the rest in order',noAsk.indexOf('The ask')<0&&order(noAsk,['The door','Why now','The case','Attempts','Follow-through'])==='');
  check('R9 DOOR and ASK are escaped',(function(){var h=renderCallCard(normalizeCall(brief({door:'<b>d</b>',ask:'<i>a</i>'})));return h.indexOf('<b>d')<0&&h.indexOf('<i>a')<0&&h.indexOf('&lt;b&gt;d&lt;/b&gt;')>0&&h.indexOf('&lt;i&gt;a&lt;/i&gt;')>0;})());
  check('R10 the card template reads door, why, site, the case, ask, attempts, follow, notes (source)',extractFn(html,'renderCallCard').indexOf('${door}${why}${site}${supportHtml(c.support)}${ask}${attempts}${follow}${notes}')>0);

  // --- L: the record from before ---------------------------------------------
  fresh();
  var legacyRaw={id:'call_legacy_1',company:'Example Grounds Crew',location:'Placeholder, IL',phone:'(312) 555-0142',website:'https://example.com/',hook:'Their services page says they take new grounds contracts in the fall.',
    support:[{quote:QUOTE,url:PAGE,checked:'2026-10-28',unverified:false}],attempts:[],closedAt:'',followName:'',followChannel:'',contactId:'',status:'queued',statusHistory:[{status:'queued',timestamp:T}],notes:'',createdAt:T,updatedAt:T};
  var legacy=normalizeCall(JSON.parse(JSON.stringify(legacyRaw)));
  check('L1 a record with no door, ask or answer normalizes to empty strings, nothing else moved',legacy.door===''&&legacy.ask===''&&legacy.support[0].answer===''&&legacy.status==='queued'&&legacy.hook===legacyRaw.hook&&legacy.support[0].quote===QUOTE&&legacy.statusHistory.length===1);
  var explicit=normalizeCall(Object.assign(JSON.parse(JSON.stringify(legacyRaw)),{door:'',ask:'',support:[cite()]}));
  var legacyCard=renderCallCard(legacy);
  check('L2 it renders byte-identical to a record carrying the three empty',legacyCard===renderCallCard(explicit));
  check('L3 its card shows no DOOR, no ASK, no answer row; WHY NOW, THE CASE, the CHECKED pill, ATTEMPTS, FOLLOW-THROUGH in order',legacyCard.indexOf('The door')<0&&legacyCard.indexOf('The ask')<0&&legacyCard.indexOf('cite-answer')<0&&legacyCard.indexOf('CHECKED 2026-10-28')>0&&order(legacyCard,['Why now','Website','The case','Attempts','Follow-through'])==='');
  check('L4 a well-formed v0.23.0 record passes through normalizeCall byte-identical',(function(){var b=normalizeCall(brief());return JSON.stringify(normalizeCall(JSON.parse(JSON.stringify(b))))===JSON.stringify(b);})());
  check('L5 normalizeCall types door and ask (source)',extractFn(html,'normalizeCall').indexOf("['company','location','phone','website','door','hook','ask','followName','followChannel','contactId','notes','closedAt']")>0&&normalizeCall({company:'x',hook:'h',door:5,ask:null}).door==='5'&&normalizeCall({company:'x',hook:'h',door:5,ask:null}).ask==='');

  // --- F: the form -----------------------------------------------------------
  var form=html.slice(html.indexOf('<div class="modal-bg wide-bg" id="modal-call">'),html.indexOf('id="btn-save-call"'));
  var ids=['id="cl-door"','id="cl-hook"','id="cl-support"','id="cl-ask"','id="cl-attempts"','id="cl-follow"','id="cl-notes"'].map(function(t){return form.indexOf(t);});
  check('F1 the form carries THE DOOR, WHY NOW, THE CASE, THE ASK, ATTEMPTS, FOLLOW-THROUGH, NOTES in that order',ids.every(function(i){return i>0;})&&ids.every(function(i,k){return !k||i>ids[k-1];}),JSON.stringify(ids));
  check('F2 the headings on the form',form.indexOf('<label>The door</label>')>0&&form.indexOf('<label>Why now *</label>')>0&&form.indexOf('<label>THE CASE (ONE CITATION PER LINE; "=>" YOUR ANSWER)</label>')>0&&form.indexOf('<label>The ask</label>')>0&&form.indexOf('<label>Attempts (one dated line per dial)</label>')>0&&form.indexOf('<label>Follow-through</label>')>0&&form.indexOf('<label>Notes</label>')>0&&form.indexOf('<label>Hook *</label>')<0);
  check('F3 the box keeps its id, its EXPAND and its live preview; the placeholder shows the arrow on an example.com page',form.indexOf('data-fs-edit="cl-support"')>0&&form.indexOf('<div class="support-preview" id="cl-support-preview"></div>')>0&&/<textarea id="cl-support" placeholder="[^"]*https:\/\/example\.com\/page[^"]*=&gt; your one sentence back|<textarea id="cl-support" placeholder="[^"]*https:\/\/example\.com\/page[^"]*=> your one sentence back/.test(form));
  check('F4 the modal fills and reads the two fields (source)',(function(){var o=extractFn(html,'openCallModal'),sv=extractFn(html,'saveCall');return o.indexOf("g('cl-door').value=v.door;")>0&&o.indexOf("g('cl-ask').value=v.ask;")>0&&o.indexOf("door:'',hook:'',ask:'',")>0&&sv.indexOf("door:g('cl-door').value.trim(),hook:hook,ask:g('cl-ask').value.trim(),")>0;})());

  // --- I: the import ----------------------------------------------------------
  fresh();
  importCalls([brief({door:'',ask:''})]);
  var r1=importCalls([brief()]);
  check('I1 the import fills an empty door and ask from a later copy of the brief',r1.updated===1&&state.calls[0].door===DOOR&&state.calls[0].ask===ASK,JSON.stringify(r1));
  var r2=importCalls([brief({door:'a side gate',ask:'another ask'})]);
  check('I2 and never overwrites one already written',r2.skipped===1&&state.calls[0].door===DOOR&&state.calls[0].ask===ASK,JSON.stringify(r2));

  // --- V: the version ---------------------------------------------------------
  check('V1 the four version sites read v0.23.1',html.indexOf("const APP_VERSION='infrabot-v0.23.1';")>0&&html.indexOf('<span class="version-pill" title="INFRABOT build">v0.23.1</span>')>0&&html.indexOf('INFRABOT v0.23.1 · LPI ·')>0&&/║  v0\.23\.1 \(THE WIDE BACKDROP\)/.test(html));

  out('');
  out('call_card_check: '+(failures?'FAIL':'PASS')+' ('+(checks-failures)+'/'+checks+' checks)');
  if(isNode)process.exit(failures?1:0);
  else if(failures)throw new Error('call_card_check failed');
})();
