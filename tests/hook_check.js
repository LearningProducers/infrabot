// hook_check.js: THE HOOK LINE (infrabot v0.9.0). A comm record carries hook,
// one line shown under the discovery trail on the card: why this person
// would care and what the founder is handing them.
//
// Runs the REAL dossier parser and additive import extracted from
// infrabot.html by a brace walk (parseDossierText, additiveImportComms and
// their helpers, the same symbols the external ingest extracts), plus the
// real hookHtml, trailHtml and esc, against a SYNTHETIC fixture: invented
// companies, people, addresses and ids. The real state file never enters
// this file: the repo is public.
//
// What it pins: a block's Hook: line lands on the minted card as its own
// field and never inside the trail; a block with no Hook: line mints an
// empty hook; a Hook: line placed after the body is a known label, so the
// body grab stops at it and the body stays clean; the import writes the
// field on a new record and never touches a card already present; the card
// section renders only when the record carries a hook, escaped; the trail
// fold is unchanged; and the form, the autosave surface, the commit path,
// COPY ALL and the fullscreen meta row all carry the field (source pins).
// Nothing in the page generates a hook: no pin here calls a model, because
// no code path does.
//
// Run from the repo root:   node tests/hook_check.js
//                     or:   jsc  tests/hook_check.js
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
  // A one-statement `var|const|let NAME=...;` line, loaded as a var so an
  // indirect eval makes it global.
  function extractVar(src,name){
    var m=new RegExp('(?:var|const|let)\\s+'+name+'\\s*=').exec(src);
    if(!m)throw new Error('extract: constant '+name+' not found in '+htmlPath);
    var end=src.indexOf(';\n',m.index);
    if(end<0)throw new Error('extract: unterminated constant '+name);
    var line=src.slice(m.index,end+1);
    return line.replace(/^(var|const|let)\s+/,'var ');
  }

  var g=(typeof globalThis!=='undefined')?globalThis:this;
  g.state={comms:[],network:[]};
  g.saveState=function(){};
  g.renderComms=function(){};
  g.renderOverview=function(){};
  g.renderMapPins=function(){};
  g.autoArchiveStaleComms=function(){return [];};
  var ge=eval;
  ['DOSSIER_KNOWN_LABELS','DOSSIER_EMAIL_RE','uid','CW_APP_URL','esc'].forEach(function(n){ge(extractVar(html,n));});
  ['_dEscapeRe','_dSplitBlocks','_dIsProspect','_dField','_dLooksLikeLabel','_dGrabBody',
   '_dExtractEmail','_dExtractUrl','_dIsNonDraft','_dTargetName','_dHeaderCity',
   'parseDossierText','additiveImportComms','expandAppLink','hookHtml','trailHtml'].forEach(function(n){ge(extractFn(html,n));});

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,200)+']'));
    if(!ok)failures++;
  }

  // --- the fixture: three synthetic blocks ---------------------------------
  var BLOCKS=[
    'PROSPECT 1 · Fixture City',
    'Company: Fixture Freight',
    'Target: Alex Fixture (Founder)',
    'Email: alex@fixture-freight.invalid',
    'Source URL: https://fixture-freight.invalid/contact',
    'Website: https://fixture-freight.invalid/',
    'Archetype: Founder-led fixture forwarder',
    'Fit thesis: A synthetic firm for the harness.',
    'Hook: JOB POSTING. Paying for a technical writer; hand them one page tested first.',
    'ResearchStatus: DRAFT',
    'Quarter: Q3-2026',
    'Subject: A fixture door',
    'Body:',
    'Alex, a fixture body. Run one through it: [CW_APP_LINK]',
    '',
    'PROSPECT 2 · Fixture City',
    'Company: No Hook Co',
    'Target: Sam Nohook (Owner)',
    'Email: sam@no-hook.invalid',
    'Source URL: https://no-hook.invalid/about',
    'Website: https://no-hook.invalid/',
    'Archetype: A block without a hook',
    'Fit thesis: The empty-hook fixture.',
    'ResearchStatus: DRAFT',
    'Quarter: Q3-2026',
    'Subject: A second door',
    'Body:',
    'Sam, a second fixture body. Put one through it: [CW_APP_LINK]',
    '',
    'PROSPECT 3 · Fixture City',
    'Company: After Body Co',
    'Target: Robin After (Owner)',
    'Email: robin@after-body.invalid',
    'Source URL: https://after-body.invalid/about',
    'Website: https://after-body.invalid/',
    'Archetype: A hook line placed after the body',
    'Fit thesis: The label-seam fixture.',
    'ResearchStatus: DRAFT',
    'Quarter: Q3-2026',
    'Subject: A third door',
    'Body:',
    'Robin, a third fixture body.',
    'Second line of the body.',
    'Hook: OPERATOR. A hook typed under the body; the grab stops here.',
    ''
  ].join('\n');

  // --- P: the parser -------------------------------------------------------
  check('P4 hook is a known dossier label', DOSSIER_KNOWN_LABELS.indexOf('hook')!==-1, DOSSIER_KNOWN_LABELS.join(','));
  var res=parseDossierText(BLOCKS);
  var cards=res.cards||[];
  check('P0 three fixture blocks parse to three cards', cards.length===3&&res.scratched.length===0, cards.length+' cards, '+JSON.stringify(res.scratched));
  var c1=cards[0]||{},c2=cards[1]||{},c3=cards[2]||{};
  check('P1 the Hook: line lands on the card as hook', c1.hook==='JOB POSTING. Paying for a technical writer; hand them one page tested first.', c1.hook);
  check('P1 the hook never rides inside the trail', (c1.trail||'').indexOf('Hook')===-1&&(c1.trail||'').indexOf('JOB POSTING')===-1, c1.trail);
  check('P1 the body is intact beside a hook', /^Alex, a fixture body\. Run one through it:\n\nhttps:\/\//.test(c1.body||''), c1.body);
  check('P2 a block with no Hook: line mints an empty hook, the key present', ('hook' in c2)&&c2.hook==='', JSON.stringify(c2.hook));
  check('P3 a Hook: line after the body still parses', c3.hook==='OPERATOR. A hook typed under the body; the grab stops here.', c3.hook);
  check('P3 the body grab stops at the Hook: label', c3.body==='Robin, a third fixture body.\nSecond line of the body.', JSON.stringify(c3.body));

  // --- I: the import -------------------------------------------------------
  var old='2026-01-01T00:00:00.000Z';
  g.state.comms=[{id:'id_fix_present',title:'After Body Co · Robin After',status:'draft',
                  target:'robin@after-body.invalid',trail:'kept',hook:'the founder typed this',
                  body:'the founder edited this body',sentDate:'',createdAt:old,history:[],
                  statusHistory:[{status:'draft',timestamp:old}]}];
  var r=additiveImportComms(res);
  check('I0 import adds the two new cards and skips the present one', r.added===2&&r.skipped===1, JSON.stringify(r));
  var minted=g.state.comms.filter(function(c){return c.id!=='id_fix_present';});
  var m1=minted.filter(function(c){return c.target==='alex@fixture-freight.invalid';})[0]||{};
  var m2=minted.filter(function(c){return c.target==='sam@no-hook.invalid';})[0]||{};
  check('I1 the minted record carries hook in the app\'s shape', m1.hook===c1.hook&&('hook' in m2)&&m2.hook===''&&/^id_/.test(m1.id||''), JSON.stringify([m1.hook,m2.hook]));
  var kept=g.state.comms.filter(function(c){return c.id==='id_fix_present';})[0];
  check('I2 a card already present keeps its own hook and body', kept.hook==='the founder typed this'&&kept.body==='the founder edited this body'&&kept.trail==='kept', JSON.stringify(kept));

  // --- H: the card section -------------------------------------------------
  check('H1 no hook renders no section', hookHtml('')===''&&hookHtml(undefined)===''&&hookHtml(null)==='', hookHtml(''));
  check('H4 a whitespace-only hook renders no section', hookHtml('   \n ')==='', hookHtml('   \n '));
  var h=hookHtml('JOB POSTING. Hand them one page.');
  check('H2 a hook renders the Hook section with its text', h.indexOf('card-section-h">Hook<')!==-1&&h.indexOf('JOB POSTING. Hand them one page.')!==-1&&h.indexOf('card-section')===h.lastIndexOf('<div class="card-section">')+12, h);
  var hx=hookHtml('a <b>bold</b> & "quoted" hook');
  check('H3 the hook text is escaped', hx.indexOf('<b>')===-1&&hx.indexOf('&lt;b&gt;')!==-1&&hx.indexOf('&amp;')!==-1&&hx.indexOf('&quot;')!==-1, hx);
  check('H5 the section carries no model call and no button', h.indexOf('<button')===-1&&h.indexOf('data-act')===-1, h);

  // --- T: the trail fold is unchanged --------------------------------------
  var t=trailHtml('Source: https://fixture.invalid/a\nArchetype: two lines');
  check('T1 a two-line trail still folds with a MORE control', t.indexOf('trail-toggle')!==-1&&t.indexOf('>MORE<')!==-1&&t.indexOf('trail-rest hidden')!==-1, t);
  check('T2 a one-sentence trail still renders plain', trailHtml('One line.')==='One line.', trailHtml('One line.'));

  // --- S: the surfaces, pinned on the source -------------------------------
  var rc=extractFn(html,'renderComms');
  var iTrail=rc.indexOf('trailHtml(k.trail)'),iHook=rc.indexOf('hookHtml(k.hook)'),iBody=rc.indexOf('card-section-h">Body<');
  check('S3 the card calls hookHtml after the trail and before the body', iTrail>=0&&iHook>iTrail&&iBody>iHook, [iTrail,iHook,iBody].join(','));
  check('S2 the form carries the k-hook field under the trail', /id="k-trail"[\s\S]{0,400}id="k-hook"/.test(html), '');
  check('S1 the autosave surface watches k-hook', /fields:\[[^\]]*'k-trail','k-hook','k-subject'[^\]]*\]/.test(html), '');
  check('S6 autosaveApplyFields writes rec.hook', /rec\.trail=\(vals\['k-trail'\]\|\|''\)\.trim\(\);\s*rec\.hook=\(vals\['k-hook'\]\|\|''\)\.trim\(\);/.test(html), '');
  check('S7 autosavePromote carries hook', /hook:\(vals\['k-hook'\]\|\|''\)\.trim\(\),/.test(extractFn(html,'autosavePromote')), '');
  var cc=extractFn(html,'commitCommRecord');
  check('S5 commitCommRecord commits hook and counts it as content', cc.indexOf("hook:g('k-hook').value.trim(),")!==-1&&cc.indexOf('||data.hook||')!==-1, '');
  var om=extractFn(html,'openCommModal');
  check('S8 openCommModal fills and clears k-hook', om.indexOf("g('k-hook').value=k.hook||'';")!==-1&&om.indexOf("'k-trail','k-hook','k-subject'")!==-1, '');
  var cpt=extractFn(html,'commPlainText');
  check('S4 COPY ALL (commPlainText) prints the Hook line under the subject, before the body', /if\(k\.subject\)lines\.push\('Subject: '\+k\.subject\);\s*if\(k\.hook\)lines\.push\('Hook: '\+k\.hook\);\s*lines\.push\(''\);/.test(cpt), cpt.slice(-260));
  check('S4 the monthly report block carries no Hook line (a pre-send field, the report untouched)', extractFn(html,'downloadMonthReport').indexOf('.hook')===-1, '');
  check('S9 the fullscreen meta row carries HOOK after TRAIL', /TRAIL: \$\{esc\(k\.trail\)\}<\/span>`\);\s*if\(k\.hook\)metaRows\.push\(`<span[^`]*HOOK: \$\{esc\(k\.hook\)\}/.test(html), '');
  check('S10 no code path generates a hook (no model call names the field)', !/hook[^\n]{0,80}(callGroq|fireSlot|fetch\()/.test(html)&&!/(callGroq|fireSlot)[^\n]{0,80}\.hook/.test(html), '');

  out('\n'+checks+' checks, '+failures+' failure(s)');
  if(failures){if(isNode)process.exit(1);throw new Error(failures+' failure(s)');}
})();
