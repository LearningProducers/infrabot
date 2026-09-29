// calls_check.js: THE CALLS PILL (infrabot v0.14.0). A CALLS pill on the
// NETWORK bar over state.calls, one brief per company the founder dials:
// company, location, the number, the website, the hook, the support
// (citations, each with the exact words, the page, the day checked and a
// flag) and the follow-through name filled after the call.
//
// Runs the REAL callsList, normalizeCall, normalizeSupport, parseSupportLines,
// supportLinesText, citationVerified, supportHtml, telHref, telHtml, callKey,
// callStatusRank, setCallStatus, moveCallStatus, linkCallContact,
// renderCallCard, renderCallsView, importCalls, networkViewBar,
// setNetworkView, buildStateExport and the link helpers they read, extracted
// from infrabot.html by a brace walk (never a re-implementation), against a
// SYNTHETIC fixture: an invented company, invented people, a fictional 555
// number, hosts under the reserved .invalid domain. The real state file
// never enters this file: the repo is public.
//
// What it pins: the number renders as a tel: anchor through telHtml and
// telHtml never reads linkHref (which refuses tel:); anything that is not a
// phone number renders as escaped text; the website renders the exact anchor
// linkHtml renders; a citation is VERIFIED only with an http(s) page, a
// YYYY-MM-DD check date and no flag, and reads UNVERIFIED otherwise, never
// silently; the support box parses one citation per line in any token order
// and round-trips; the form's gate (company and hook) is the import's gate;
// the import dedupes on the website, moves status up the ladder only and
// never overwrites a hand-written field; the follow-through name links to
// the Network person of that name or creates an acquaintance carrying the
// channel, and never writes a MET AT entry; the CALLS pill counts queued and
// called briefs and never skipped ones; the export carries calls sorted by
// id under its own key; the merge, the ledger and the wiring name the key
// (source pins).
//
// Run from the repo root:   node tests/calls_check.js
//                     or:   jsc  tests/calls_check.js
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
  var toasts=[];
  g.toast=function(msg){toasts.push(String(msg));};
  var ge=eval;
  ['CALL_STATUSES','EVENT_STATUSES','EVENT_OUTCOMES','NETWORK_VIEWS','STATE_SCHEMA_VERSION','EDIT_WIDE_MODALS','networkView','eventsCityFilter','uid','esc'].forEach(function(n){ge(extractVar(html,n));});
  ['linkHref','linkHtml','callsList','eventsList','artifactsList','homeTzNow','normalizeSupport','normalizeCall',
   'parseSupportLines','supportLinesText','citationVerified','supportHtml','telHref','telHtml','callKey',
   'callStatusRank','setCallStatus','moveCallStatus','findContactByName','linkCallContact','renderCallCard',
   'renderCallsView','importCalls','supportRowsHtml','parseFollowThrough','followThroughText','personTier','normalizePerson','inMonthWindow','localYearMonth','acquaintanceMonth',
   'latestMetRoom','wallTimeToDate','eventStartMonth','eventCities','eventsShown','normalizeEvent','normalizeCost',
   'networkViewBar','setNetworkView','getCommBucket','_canonicalJson','buildStateExport'].forEach(function(n){ge(extractFn(html,n));});
  g.renderNetwork=function(){};

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,240)+']'));
    if(!ok)failures++;
  }
  var T='2026-09-29T12:00:00.000Z';
  var SITE='https://fixture-fastener.invalid/';
  var PAGE='https://jobs.fixture-fastener.invalid/roles/4';
  function brief(extra){
    return Object.assign({id:'call_fixture_1',company:'Fixture Fastener Works',location:'Placeholder, IL',phone:'(312) 555-0142',phoneNote:'',website:SITE,hook:'Their posting asks for faster writing.',
      support:[{quote:'Accelerate the writing.',url:PAGE,checked:'2026-09-29',unverified:false}],followName:'',followChannel:'',contactId:'',status:'queued',
      statusHistory:[{status:'queued',timestamp:T}],notes:'',createdAt:T,updatedAt:T},extra||{});
  }
  function fresh(){
    g.state={profile:{homeTz:'America/Chicago'},network:[],events:[],artifacts:[],comms:[],calls:[]};
    toasts.length=0;
  }

  // --- E: the enum and the pill -------------------------------------------
  check('E1 the status ladder is queued, called, skipped',JSON.stringify(CALL_STATUSES)==='["queued","called","skipped"]');
  check('E2 CALLS is the last pill on the NETWORK bar',NETWORK_VIEWS[NETWORK_VIEWS.length-1]==='calls'&&NETWORK_VIEWS.length===6);
  check('E3 the form select offers the three (source)',/<select id="cl-status"><option value="queued">QUEUED<\/option><option value="called">CALLED<\/option><option value="skipped">SKIPPED<\/option><\/select>/.test(html));

  // --- T: tap to dial ------------------------------------------------------
  check('T1 a formatted number dials its digits',telHref('(312) 555-0142')==='tel:3125550142');
  check('T2 a leading plus survives',telHref('+1 312 555 0142')==='tel:+13125550142');
  check('T3 seven digits is the floor, fifteen the ceiling',telHref('555-0142')==='tel:5550142'&&telHref('555-014')===null&&telHref('1234567890123456')===null);
  check('T4 words, a url and a script scheme are refused',telHref('call the desk')===null&&telHref('https://fixture-fastener.invalid/')===null&&telHref('javascript:alert(1)')===null&&telHref('')===null);
  check('T5 telHtml renders the anchor with the number as typed',telHtml('(312) 555-0142')==='<a class="url-link" href="tel:3125550142">(312) 555-0142</a>');
  check('T6 telHtml renders text, escaped, for anything else',telHtml('<b>ask</b>')==='&lt;b&gt;ask&lt;/b&gt;'&&telHtml('')==='');
  check('T7 telHtml and telHref never read linkHref (source)',extractFn(html,'telHtml').indexOf('linkHref')<0&&extractFn(html,'telHref').indexOf('linkHref')<0);
  check('T8 linkHref refuses tel: (the two helpers stay apart)',linkHref('tel:3125550142')===null&&linkHtml('tel:3125550142')==='tel:3125550142');

  // --- P: the support box --------------------------------------------------
  var p1=parseSupportLines('2026-09-29 '+PAGE+' "Accelerate the writing."');
  check('P1 date, page and words in one line',p1.length===1&&p1[0].checked==='2026-09-29'&&p1[0].url===PAGE&&p1[0].quote==='Accelerate the writing.'&&p1[0].unverified===false,JSON.stringify(p1));
  var p2=parseSupportLines('UNVERIFIED '+PAGE+' 2026-09-29 the words first');
  check('P2 a leading UNVERIFIED flags; tokens in any order',p2.length===1&&p2[0].unverified===true&&p2[0].checked==='2026-09-29'&&p2[0].url===PAGE&&p2[0].quote==='the words first',JSON.stringify(p2));
  var p3=parseSupportLines('just the words\n\n'+PAGE+'\n');
  check('P3 words alone, a page alone; a blank line stores nothing',p3.length===2&&p3[0].url===''&&p3[0].quote==='just the words'&&p3[1].url===PAGE&&p3[1].quote==='',JSON.stringify(p3));
  check('P4 UNVERIFIED inside the words is words, not the flag',parseSupportLines('the page is UNVERIFIED today')[0].unverified===false);
  var rt=supportLinesText(p1.concat(p2));
  check('P5 the text form round-trips through the parser',JSON.stringify(parseSupportLines(rt))===JSON.stringify(p1.concat(p2)),rt);
  check('P6 normalizeSupport drops an entry with neither words nor a page and types every field',JSON.stringify(normalizeSupport([{quote:'',url:''},{url:PAGE,checked:5,unverified:1}]))==='[{"quote":"","url":"'+PAGE+'","checked":"5","unverified":true}]');

  // --- V: verified or not --------------------------------------------------
  check('V1 a page, a date and no flag is VERIFIED',citationVerified({quote:'x',url:PAGE,checked:'2026-09-29',unverified:false})===true);
  check('V2 no page is UNVERIFIED',citationVerified({quote:'x',url:'',checked:'2026-09-29',unverified:false})===false);
  check('V3 no date is UNVERIFIED',citationVerified({quote:'x',url:PAGE,checked:'',unverified:false})===false&&citationVerified({quote:'x',url:PAGE,checked:'yesterday',unverified:false})===false);
  check('V4 the flag is UNVERIFIED whatever else it carries',citationVerified({quote:'x',url:PAGE,checked:'2026-09-29',unverified:true})===false);
  check('V5 a page the link helper refuses is UNVERIFIED',citationVerified({quote:'x',url:'ftp://fixture-fastener.invalid/x',checked:'2026-09-29',unverified:false})===false&&citationVerified({quote:'x',url:'javascript:alert(1)',checked:'2026-09-29',unverified:false})===false);
  var sh=supportHtml([{quote:'Accelerate the writing.',url:PAGE,checked:'2026-09-29',unverified:false},{quote:'no page here',url:'',checked:'2026-09-29',unverified:false},{quote:'flagged',url:PAGE,checked:'2026-09-29',unverified:true}]);
  check('V6 a verified citation renders the exact linkHtml anchor and CHECKED with its date',sh.indexOf(linkHtml(PAGE)+'<span class="cite-pill">CHECKED 2026-09-29</span>')>0,sh);
  check('V7 an unverified citation reads UNVERIFIED on the card, never silently',(sh.match(/cite-pill unverified">UNVERIFIED/g)||[]).length===2);
  check('V8 the words render escaped inside quotation marks',supportHtml([{quote:'<b>x</b>',url:PAGE,checked:'2026-09-29'}]).indexOf('&ldquo;&lt;b&gt;x&lt;/b&gt;&rdquo;')>0);
  check('V9 no citations, no section',supportHtml([])===''&&supportHtml(null)==='');

  // --- N: the record -------------------------------------------------------
  fresh();
  var n1=normalizeCall(brief());
  check('N1 a well-formed record passes through byte-identical',JSON.stringify(normalizeCall(JSON.parse(JSON.stringify(n1))))===JSON.stringify(n1));
  var n2=normalizeCall({company:'Fixture Fastener Works',hook:'h',support:'not a list',status:'CALLED',phone:7});
  check('N2 types are forced, the status lower-cased, an unknown status queued',n2.support.length===0&&n2.status==='called'&&n2.phone==='7'&&n2.statusHistory.length===1&&normalizeCall({status:'wat'}).status==='queued');
  check('N3 callKey is the website, trailing slash dropped, else the company',callKey({website:'HTTPS://Fixture-Fastener.invalid//',company:'x'})==='https://fixture-fastener.invalid'&&callKey({website:'',company:' Fixture Fastener Works '})==='company:fixture fastener works');
  var s1=brief();
  check('S1 setCallStatus appends and stamps; a no-change call appends nothing',setCallStatus(s1,'called',T)===true&&s1.status==='called'&&s1.statusHistory.length===2&&s1.updatedAt===T&&setCallStatus(s1,'called',T)===false&&setCallStatus(s1,'wat',T)===false);
  toasts.length=0;
  check('S2 moveCallStatus toasts the company and the status',moveCallStatus(brief(),'skipped',T)===true&&toasts[0]==='FIXTURE FASTENER WORKS · SKIPPED');
  check('S3 called and skipped share the top rank',callStatusRank('queued')===0&&callStatusRank('called')===1&&callStatusRank('skipped')===1&&callStatusRank('wat')===0);

  // --- L: the follow-through -----------------------------------------------
  fresh();
  state.network.push({id:'c_fixture_1',addedAt:'2026-09-01T00:00:00.000Z',lastTouchAt:null,touches:[],name:'Marisol Quintero',company:'',website:'',email:'',channel:'',city:'Chicago',tz:'America/Chicago',notes:'',tier:'contact'});
  var id1=linkCallContact(' marisol quintero ','(312) 555-0143','Placeholder, IL',T);
  check('L1 an existing person matches by name, case-insensitive and trimmed; the channel fills an empty one',id1==='c_fixture_1'&&state.network.length===1&&state.network[0].channel==='(312) 555-0143'&&state.network[0].updatedAt===T);
  var id1b=linkCallContact('Marisol Quintero','other',"Placeholder, IL",T);
  check('L2 a channel already set is never overwritten',id1b==='c_fixture_1'&&state.network[0].channel==='(312) 555-0143');
  var id2=linkCallContact('Ada Fixture','(312) 555-0144','Placeholder, IL',T);
  var made=state.network[1];
  check('L3 a name with no person creates an acquaintance carrying the channel and the location',state.network.length===2&&made.id===id2&&made.name==='Ada Fixture'&&made.channel==='(312) 555-0144'&&made.city==='Placeholder, IL'&&made.tier==='acquaintance'&&JSON.stringify(made.tierHistory)==='[{"tier":"acquaintance","timestamp":"'+T+'"}]'&&made.addedAt===T,JSON.stringify(made));
  check('L4 the new person carries the MET box shape and no MET AT entry',JSON.stringify(made.metAt)==='[]'&&made.company===''&&made.email===''&&made.notes===''&&made.website===''&&made.tz==='America/Chicago');
  check('L5 a blank name links nobody and creates nobody',linkCallContact('   ','x','y',T)===''&&state.network.length===2);
  check('L6 linkCallContact never writes metAt and never reads the events (source)',(function(){var src=extractFn(html,'linkCallContact');return src.indexOf('metAt:[]')>0&&src.indexOf('syncMetLinks')<0&&src.indexOf('eventsList')<0;})());

  // --- R: the card ---------------------------------------------------------
  fresh();
  var card=renderCallCard(normalizeCall(brief()));
  check('R1 the company is the card name and the status pill reads QUEUED',card.indexOf('<div class="card-name">Fixture Fastener Works</div>')>0&&card.indexOf('<span class="card-status queued">QUEUED</span>')>0);
  check('R2 the number is a tel: anchor in the sub line beside the location',card.indexOf('Placeholder, IL · <a class="url-link" href="tel:3125550142">(312) 555-0142</a>')>0,card);
  check('R3 the website renders the exact anchor linkHtml renders',card.indexOf('<div class="card-section-h">Website</div><div class="card-section-body cite-page">'+linkHtml(SITE)+'</div>')>0);
  check('R4 the hook sits where a room shows its reason',card.indexOf('<div class="card-section-h">Hook</div><div class="card-section-body">Their posting asks for faster writing.</div>')>0);
  check('R5 the support renders with its CHECKED pill',card.indexOf('CHECKED 2026-09-29')>0);
  check('R6 the follow-through reads blank until after the call',card.indexOf('<div class="card-section-h">Follow-through</div><div class="card-section-body call-mono">blank until after the call</div>')>0);
  check('R7 a queued card offers CALLED and SKIP; OPEN always',card.indexOf('data-act="called-call"')>0&&card.indexOf('data-act="skip-call"')>0&&card.indexOf('data-act="edit-call"')>0);
  var legacy=normalizeCall(brief({phoneNote:'a note from before v0.15.0'}));
  var pn=renderCallCard(legacy);
  check('R8 a legacy phoneNote key passes through untouched and renders nothing (its home is NOTES now)',legacy.phoneNote==='a note from before v0.15.0'&&pn.indexOf('a note from before')<0&&pn.indexOf('</a> <span class="cite-pill unverified">')<0,pn);
  check('R8b the card is a wide call card and the view lays one per row (source)',card.indexOf('<div class="card call-card">')===0&&extractFn(html,'renderCallsView').indexOf('<div class="card-grid calls-grid">')>0&&html.indexOf('.card-grid.calls-grid{grid-template-columns:1fr}')>0&&html.indexOf('.call-card .card-section-body{font-size:15px;line-height:1.6}')>0);
  state.network.push({id:'c_fixture_9',name:'Ada Fixture',channel:'(312) 555-0144'});
  var fc=renderCallCard(normalizeCall(brief({status:'called',contactId:'c_fixture_9',followName:'stale name',followChannel:'(312) 555-0144'})));
  check('R9 a called card names the linked person (the book, not the stale field) with their channel dialable, and offers no quick action',fc.indexOf('Ada Fixture · <a class="url-link" href="tel:3125550144">(312) 555-0144</a>')>0&&fc.indexOf('data-act="called-call"')<0&&fc.indexOf('data-act="skip-call"')<0,fc);
  check('R9b the support rows render through one helper the form preview reads too (source)',extractFn(html,'supportHtml').indexOf('supportRowsHtml(list)')>0&&extractFn(html,'refreshSupportPreview').indexOf('supportRowsHtml(parseSupportLines(')>0);
  check('R10 a card with nothing to dial says so',renderCallCard(normalizeCall({company:'X',hook:'h'})).indexOf('no location, no number')>0);
  check('R11 the card escapes its fields',renderCallCard(normalizeCall({company:'<b>X</b>',hook:'<i>h</i>',location:'<u>L</u>'})).indexOf('<b>')<0);

  // --- F: the one follow-through field ---------------------------------------
  check('F1 Name (channel) splits into the two record fields',JSON.stringify(parseFollowThrough('Ada Fixture ((312) 555-0144)'))==='{"name":"Ada Fixture","channel":"(312) 555-0144"}'&&JSON.stringify(parseFollowThrough('Ada Fixture (ada@fixture.example)'))==='{"name":"Ada Fixture","channel":"ada@fixture.example"}');
  check('F2 a bare name is the name and no channel; blank is blank',JSON.stringify(parseFollowThrough('  Ada Fixture '))==='{"name":"Ada Fixture","channel":""}'&&JSON.stringify(parseFollowThrough(''))==='{"name":"","channel":""}');
  check('F3 the text form round-trips, a channel with no name included',followThroughText('Ada Fixture','(312) 555-0144')==='Ada Fixture ((312) 555-0144)'&&followThroughText('Ada Fixture','')==='Ada Fixture'&&followThroughText('','(312) 555-0144')==='((312) 555-0144)'&&JSON.stringify(parseFollowThrough(followThroughText('','(312) 555-0144')))==='{"name":"","channel":"(312) 555-0144"}'&&JSON.stringify(parseFollowThrough(followThroughText('Ada Fixture','(312) 555-0144')))==='{"name":"Ada Fixture","channel":"(312) 555-0144"}');
  check('F4 the form carries one follow-through field and no phone-note field (source)',html.indexOf('id="cl-follow"')>0&&html.indexOf('cl-follow-name')<0&&html.indexOf('cl-phone-note')<0&&extractFn(html,'saveCall').indexOf("parseFollowThrough(g('cl-follow').value)")>0);
  check('F5 both textareas carry the EXPAND that opens the field edit; the comm body opens through the same path (source)',html.indexOf('data-fs-edit="cl-support"')>0&&html.indexOf('data-fs-edit="cl-notes"')>0&&html.indexOf("openFieldEdit(b.dataset.fsEdit,b.dataset.fsLabel,")>0&&extractFn(html,'openCommBodyEdit').indexOf("openFieldEdit('k-body','EDIT BODY',")>0&&extractFn(html,'renderFullscreenBodyCommEdit').indexOf('g(fsEditTargetId)')>0&&extractFn(html,'closeFullscreen').indexOf("fsEditTargetId='k-body';")>0);
  check('F6 the call form is on the size stepper list',EDIT_WIDE_MODALS.indexOf('modal-call')>=0);

  // --- G: the view and the pill ----------------------------------------------
  fresh();
  check('G1 no briefs: the empty state with its NEW CALL button',renderCallsView().indexOf('NO CALLS YET')>0&&renderCallsView().indexOf('data-open="call"')>0);
  state.calls=[brief({id:'a',status:'queued'}),brief({id:'b',status:'called',website:'https://b.invalid/'}),brief({id:'c',status:'skipped',website:'https://c.invalid/'})];
  var view=renderCallsView();
  check('G2 queued and called render grouped; skipped folds at the foot',view.indexOf('QUEUED · 1')>0&&view.indexOf('CALLED · 1')>0&&view.indexOf('SKIPPED · 1')>0&&view.indexOf('<details class="skip-fold">')>0);
  var bar=networkViewBar();
  check('G3 the CALLS pill counts queued and called, never skipped',/data-view="calls">CALLS<span class="triage-count">· 2<\/span>/.test(bar),bar);
  check('G4 the CALLS pill is the last on the bar',bar.lastIndexOf('data-view="calls"')>bar.lastIndexOf('data-view="attended"'));
  setNetworkView('calls');
  check('G5 setNetworkView accepts calls',networkView==='calls');
  setNetworkView('wat');
  check('G6 an unknown view is refused',networkView==='calls');
  state.calls=[brief({id:'c',status:'skipped'})];
  check('G7 only skipped briefs: the fold still renders under a named empty line',renderCallsView().indexOf('NO CALLS QUEUED')>0&&renderCallsView().indexOf('SKIPPED · 1')>0);

  // --- I: the import -------------------------------------------------------
  fresh();
  var r1=importCalls([brief(),{company:'',hook:'h'},{company:'No Hook Co'},null]);
  check('I1 a brief lands; no company, no hook and a non-object are refused and counted',r1.added===1&&r1.refused===3&&state.calls.length===1,JSON.stringify(r1));
  var r2=importCalls([brief({status:'called',notes:'from the import',phone:'(312) 555-0199'})]);
  check('I2 a match by website moves the status up and fills only empty fields',r2.updated===1&&state.calls[0].status==='called'&&state.calls[0].notes==='from the import'&&state.calls[0].phone==='(312) 555-0142',JSON.stringify(state.calls[0]));
  var r3=importCalls([brief({status:'queued',hook:'a different hook'})]);
  check('I3 a match never moves back down and never overwrites the hook',r3.skipped===1&&state.calls[0].status==='called'&&state.calls[0].hook==='Their posting asks for faster writing.');
  var r4=importCalls([brief({id:'call_fixture_1',website:'https://other.invalid/'})]);
  check('I4 a colliding id on a new website is re-minted',r4.added===1&&state.calls.length===2&&state.calls[1].id!=='call_fixture_1');
  check('I5 a support list fills only an empty one',(function(){fresh();importCalls([brief({support:[]})]);var r=importCalls([brief({support:[{quote:'later',url:PAGE,checked:'2026-09-29'}]})]);return r.updated===1&&state.calls[0].support.length===1&&state.calls[0].support[0].quote==='later';})());

  // --- X: the export and the seams -----------------------------------------
  fresh();
  state.comms=[];state.network=[];
  state.calls=[brief({id:'call_b',website:'https://b.invalid/'}),brief({id:'call_a'})];
  var exp=JSON.parse(buildStateExport());
  check('X1 the export carries calls under its own key, sorted by id, schemaVersion unmoved',Array.isArray(exp.calls)&&exp.calls.length===2&&exp.calls[0].id==='call_a'&&exp.calls[1].id==='call_b'&&exp.schemaVersion===STATE_SCHEMA_VERSION&&STATE_SCHEMA_VERSION===3);
  check('X2 the merge slices calls per record, normalizes them and ledgers their ids (source)',(function(){var m=extractFn(html,'mergeServerState');return m.indexOf("state.calls=take(mergeRecordSlice(callsList(),Array.isArray(file.calls)?file.calls:[],editingCallId,_syncedIds))")>0&&m.indexOf('state.calls.forEach(function(c){normalizeCall(c);});')>0&&m.indexOf('Array.isArray(file.calls)?file.calls:[]].forEach')>0;})());
  check('X3 the sync ledger and the additive import read the key (source)',extractFn(html,'allStateIds').indexOf('callsList()')>0&&extractFn(html,'additiveImportState').indexOf('importCalls(Array.isArray(payload.calls)?payload.calls:[])')>0);
  check('X4 freshState carries calls (source)',/calls:\[\],\n\s*insights:\[\]/.test(extractFn(html,'freshState')));
  check('X5 the wiring routes the three acts, the add button, the save, the delete, the phone link and the support preview (source)',["if(act==='edit-call')openCallModal(id);","if(act==='called-call')quickCallStatus(id,'called');","if(act==='skip-call')quickCallStatus(id,'skipped');","g('btn-add-call').addEventListener('click',()=>openCallModal());","g('btn-save-call').addEventListener('click',saveCall);","g('btn-delete-call').addEventListener('click',deleteCall);","g('cl-phone').addEventListener('input',()=>refreshPhoneLink('cl-phone'));","g('cl-support').addEventListener('input',refreshSupportPreview);","if(which==='call')openCallModal();"].every(function(s){return html.indexOf(s)>0;}));
  check('X6 the website field joins the link-line list and the NEW CALL button swaps with the view (source)',html.indexOf("['ev-url','ar-url','cl-website']")>0&&html.indexOf("g('btn-add-call').classList.toggle('hidden',networkView!=='calls');")>0&&html.indexOf('<button class="btn hidden" id="btn-add-call">+ NEW CALL</button>')>0);
  check('X7 the form gate is the import gate (source)',(function(){var s=extractFn(html,'saveCall');return s.indexOf('COMPANY REQUIRED')>0&&s.indexOf('NO HOOK, NO BRIEF')>0&&s.indexOf('linkCallContact(data.followName,data.followChannel,data.location,now)')>0;})());
  check('X8 the nine MET-pinned symbols are not read by the new block for a write (source)',(function(){var s=extractFn(html,'saveCall')+extractFn(html,'linkCallContact')+extractFn(html,'importCalls');return s.indexOf('linkMetNames')<0&&s.indexOf('syncMetLinks')<0&&s.indexOf('parseMetNames')<0;})());

  out('');
  out(failures===0?'ALL GREEN: '+checks+' checks':'FAILURES: '+failures+' of '+checks);
  if(failures){if(isNode)process.exit(1);throw new Error('calls_check: '+failures+' failure(s)');}
})();
