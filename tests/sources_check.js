// sources_check.js: THE SOURCES (infrabot v0.16.0). A communication record
// carries sources, one row per factual claim its hook makes: the claim, the
// page it sits on, the page section. The discovery trail box and card
// section are gone; the stored trail string stays and is written by nothing;
// a record with no sources field seeds its rows from the urls its trail and
// sourceUrl carry.
//
// Runs the REAL helpers extracted from infrabot.html by a brace walk (never a
// re-implementation): normalizeSources, parseSourceLines, sourceLineText,
// sourceLinesText, sourcesBlockText, sourcesRowsHtml, sourcesHtml,
// normalizeComm, the link helpers they read, and the dossier parser with the
// additive import, against SYNTHETIC fixtures: invented hosts under the
// reserved .invalid domain, invented names, no real record. The repo is
// public.
//
// What it pins: the line grammar and its round trip; the migration (trail
// urls and sourceUrl become rows once, stamps untouched, a present field
// kept, the trail string kept); the card section (rows with each page the
// one anchor, NO PAGE and UNSOURCED HOOK pills, nothing when the record has
// neither hook nor rows); the dossier parser's Sources: lines and its Source
// URL fallback; the council block text; and the source pins on the form,
// the autosave surface, the commit path, COPY ALL, the fullscreen meta row,
// the three normalize seams, and the absence of every trail surface.
//
// Run from the repo root:   node tests/sources_check.js
//                     or:   jsc  tests/sources_check.js
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

  var glob=(typeof globalThis!=='undefined')?globalThis:this;
  glob.state={comms:[],network:[]};
  glob.saveState=function(){};
  glob.renderComms=function(){};
  glob.renderOverview=function(){};
  glob.renderMapPins=function(){};
  glob.autoArchiveStaleComms=function(){return [];};
  var ge=eval;
  ['esc','URL_TOKEN_RE','CW_APP_URL','DOSSIER_KNOWN_LABELS','DOSSIER_EMAIL_RE','uid'].forEach(function(n){ge(extractVar(html,n));});
  ['linkHref','linkHtml','urlTokenParts','linkedTextHtml','textUrls','expandAppLink','hookHtml',
   'normalizeSources','parseSourceLines','sourceLineText','sourceLinesText','sourcesBlockText','sourcesRowsHtml','sourcesHtml','normalizeComm',
   '_dEscapeRe','_dSplitBlocks','_dIsProspect','_dField','_dFields','_dLooksLikeLabel','_dGrabBody','_dExtractEmail','_dExtractUrl','_dIsNonDraft','_dTargetName','_dHeaderCity',
   'parseDossierText','additiveImportComms'].forEach(function(n){ge(extractFn(html,n));});

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,240)+']'));
    if(!ok)failures++;
  }
  var U1='https://fixture.invalid/about/team';
  var U2='https://second.invalid/news?id=7';
  var A1=linkHtml(U1),A2=linkHtml(U2);

  // --- G: the line grammar ----------------------------------------------------
  var g1=parseSourceLines('three offices in two countries '+U1+' About us\nguides published this spring '+U2);
  check('G1 a line parses to claim, page and section in order', g1.length===2&&g1[0].claim==='three offices in two countries'&&g1[0].url===U1&&g1[0].section==='About us'&&g1[1].claim==='guides published this spring'&&g1[1].url===U2&&g1[1].section==='', JSON.stringify(g1));
  check('G2 a line with only a page is a row with an empty claim', JSON.stringify(parseSourceLines(U1))===JSON.stringify([{claim:'',url:U1,section:'',sentence:''}]), JSON.stringify(parseSourceLines(U1)));
  check('G3 a line with only words is a row with no page', JSON.stringify(parseSourceLines('a claim with no page'))===JSON.stringify([{claim:'a claim with no page',url:'',section:'',sentence:''}]), '');
  check('G4 blank lines parse to nothing', parseSourceLines('\n  \n').length===0&&parseSourceLines('').length===0&&parseSourceLines(null).length===0, '');
  check('G5 sentence punctuation after the page stays off the url', parseSourceLines('claim '+U1+'.')[0].url===U1, parseSourceLines('claim '+U1+'.')[0].url);
  check('G6 a second url on a line is section text, never a second page', parseSourceLines('c '+U1+' '+U2)[0].section===U2&&parseSourceLines('c '+U1+' '+U2).length===1, '');
  var rt=sourceLinesText(g1);
  check('G7 the text form round-trips through the parser byte for byte', rt==='three offices in two countries '+U1+' About us\nguides published this spring '+U2&&JSON.stringify(parseSourceLines(rt))===JSON.stringify(normalizeSources(g1)), rt);
  check('G8 normalizeSources drops empty rows and non-objects and trims', JSON.stringify(normalizeSources([null,{},{claim:' x ',url:'',section:' s ',sentence:''},{url:U1}]))===JSON.stringify([{claim:'x',url:'',section:'s',sentence:''},{claim:'',url:U1,section:'',sentence:''}]), '');
  check('G9 the block text lists one row per line, or (none)', sourcesBlockText([])==='(none)'&&sourcesBlockText(g1)==='\n- three offices in two countries '+U1+' About us\n- guides published this spring '+U2, sourcesBlockText(g1));

  // --- M: the migration -------------------------------------------------------
  var m1={id:'id_fix_1',trail:'Source: '+U1+'\nArchetype: a founder\nFit thesis: fits.',sourceUrl:U1,updatedAt:'2026-01-02T00:00:00.000Z',createdAt:'2026-01-01T00:00:00.000Z'};
  normalizeComm(m1);
  check('M1 a record with no sources field takes one row per url its trail carries, the sourceUrl deduped', JSON.stringify(m1.sources)===JSON.stringify([{claim:'',url:U1,section:'',sentence:''}]), JSON.stringify(m1.sources));
  check('M2 the trail string stays byte for byte and the stamps are untouched', m1.trail==='Source: '+U1+'\nArchetype: a founder\nFit thesis: fits.'&&m1.updatedAt==='2026-01-02T00:00:00.000Z'&&m1.createdAt==='2026-01-01T00:00:00.000Z', m1.trail);
  var m2={id:'id_fix_2',trail:'podcast to social to website',sourceUrl:''};
  normalizeComm(m2);
  check('M3 a prose trail with no url seeds no rows and keeps its text', m2.sources.length===0&&m2.trail==='podcast to social to website', JSON.stringify(m2));
  var m3={id:'id_fix_3',trail:'Source: '+U1,sourceUrl:U2};
  normalizeComm(m3);
  check('M4 a different sourceUrl is a second row after the trail\'s', JSON.stringify(m3.sources)===JSON.stringify([{claim:'',url:U1,section:'',sentence:''},{claim:'',url:U2,section:'',sentence:''}]), JSON.stringify(m3.sources));
  var m4={id:'id_fix_4',trail:'Source: '+U1,sources:[{claim:'kept',url:U2,section:'x',sentence:''}]};
  normalizeComm(m4);
  check('M5 a record that already carries sources keeps them and takes nothing from the trail', JSON.stringify(m4.sources)===JSON.stringify([{claim:'kept',url:U2,section:'x',sentence:''}]), JSON.stringify(m4.sources));
  var m5={id:'id_fix_5'};
  normalizeComm(m5);
  check('M6 a record with neither field gets an empty trail string and an empty sources array', m5.trail===''&&Array.isArray(m5.sources)&&m5.sources.length===0, JSON.stringify(m5));
  var m6={id:'id_fix_6',trail:'Source: '+U1};
  normalizeComm(m6);var once=JSON.stringify(m6);normalizeComm(m6);
  check('M7 normalizeComm is idempotent', JSON.stringify(m6)===once, '');
  check('M8 normalizeComm never stamps updatedAt', !('updatedAt' in m6), JSON.stringify(m6));

  // --- R: the card section ----------------------------------------------------
  var r1=sourcesRowsHtml([{claim:'three offices',url:U1,section:'About',sentence:''},{claim:'no page yet',url:'',section:'',sentence:''}]);
  check('R1 a row renders its claim, its page as the one anchor, and its section', r1.indexOf('<div>three offices</div>')!==-1&&r1.indexOf(A1)!==-1&&r1.indexOf('>About</span>')!==-1, r1);
  check('R2 a row with no page shows the NO PAGE pill', r1.indexOf('<span class="cite-pill unverified">NO PAGE</span>')!==-1, r1);
  var r3=sourcesRowsHtml([{claim:'<b>x</b> & "q"',url:U1,section:'<i>s</i>',sentence:''}]);
  check('R3 claim and section text stay escaped', r3.indexOf('<b>')===-1&&r3.indexOf('&lt;b&gt;x&lt;/b&gt; &amp; &quot;q&quot;')!==-1&&r3.indexOf('&lt;i&gt;s&lt;/i&gt;')!==-1, r3);
  var s1=sourcesHtml([{claim:'c',url:U1,section:'',sentence:''}],'');
  check('R4 rows render the Sources section even with no hook', s1.indexOf('card-section-h">Sources<')!==-1&&s1.indexOf(A1)!==-1, s1);
  var s2=sourcesHtml([],'JOB POSTING. A hook with no row.');
  check('R5 a hook with no row renders the UNSOURCED HOOK pill in the Sources section', s2.indexOf('card-section-h">Sources<')!==-1&&s2.indexOf('UNSOURCED HOOK')!==-1, s2);
  check('R6 no hook and no rows renders nothing', sourcesHtml([],'')===''&&sourcesHtml(null,null)===''&&sourcesHtml([],'   ')==='', sourcesHtml([],'   '));
  check('R7 the anchor is byte-identical to the hook\'s and the event card\'s', sourcesRowsHtml([{claim:'',url:U1,section:'',sentence:''}]).indexOf(A1)!==-1&&hookHtml(U1).indexOf(A1)!==-1, '');
  var own=['sourcesRowsHtml','sourcesHtml','normalizeSources','parseSourceLines','normalizeComm','sourceLinesText','sourcesBlockText'].map(function(n){return extractFn(html,n);}).join('\n');
  check('R8 none of the sources helpers writes an anchor of its own, calls a model, or reads the stored state', own.indexOf('<a ')===-1&&own.indexOf('callGroq')===-1&&own.indexOf('fetch(')===-1&&own.indexOf('state.')===-1&&own.indexOf('saveState')===-1, '');

  // --- D: the dossier parser --------------------------------------------------
  var BLOCKS=[
    'PROSPECT 1 · Fixture City',
    'Company: Fixture Freight',
    'Target: Alex Fixture (Founder)',
    'Email: alex@fixture-freight.invalid',
    'Source URL: https://fixture-freight.invalid/contact',
    'Website: https://fixture-freight.invalid/',
    'Archetype: Founder-led fixture forwarder',
    'Fit thesis: A synthetic firm for the harness.',
    'Hook: OPERATOR. Three offices in two countries; hand them one page tested first.',
    'Sources: three offices in two countries https://fixture-freight.invalid/about Offices',
    'Sources: hiring a docs writer https://fixture-freight.invalid/careers Careers',
    'Addressing: NAMELESS, three offices in two countries and a generic inbox',
    'ResearchStatus: DRAFT',
    'Quarter: Q3-2026',
    'Subject: A fixture door',
    'Body:',
    'Hi,',
    '',
    'A fixture body. Run one through it:',
    '',
    '[CW_APP_LINK]',
    '',
    'PROSPECT 2 · Fixture City',
    'Company: Fallback Co',
    'Target: Robin Fallback (Owner)',
    'Email: robin@fallback.invalid',
    'Source URL: https://fallback.invalid/about',
    'Website: https://fallback.invalid/',
    'Hook: OPERATOR. A hook with no Sources: lines.',
    'ResearchStatus: DRAFT',
    'Quarter: Q3-2026',
    'Subject: A second door',
    'Body:',
    'Robin, a second fixture body.',
    '',
    'PROSPECT 3 · Fixture City',
    'Company: Under Body Co',
    'Target: Sam Under (Owner)',
    'Email: sam@under-body.invalid',
    'Source URL: https://under-body.invalid/about',
    'Website: https://under-body.invalid/',
    'Hook: OPERATOR. A hook whose Sources: line sits under the body.',
    'ResearchStatus: DRAFT',
    'Quarter: Q3-2026',
    'Subject: A third door',
    'Body:',
    'Sam, a third fixture body.',
    'Sources: a label typed under the body https://under-body.invalid/x Footer',
    ''
  ].join('\n');
  var res=parseDossierText(BLOCKS);
  var c1=res.cards[0],c2=res.cards[1],c3=res.cards[2];
  check('D1 three fixture blocks parse to three cards', res.cards.length===3&&res.scratched.length===0, res.cards.length+' '+JSON.stringify(res.scratched));
  check('D2 the block\'s Sources: lines are the card\'s rows, in order, claim page section', JSON.stringify(c1.sources)===JSON.stringify([{claim:'three offices in two countries',url:'https://fixture-freight.invalid/about',section:'Offices',sentence:''},{claim:'hiring a docs writer',url:'https://fixture-freight.invalid/careers',section:'Careers',sentence:''}]), JSON.stringify(c1.sources));
  check('D3 the minted trail is empty: nothing writes the trail from this version on', c1.trail===''&&c2.trail===''&&c3.trail==='', JSON.stringify([c1.trail,c2.trail,c3.trail]));
  check('D4 a block with no Sources: line carries its Source URL as the one row', JSON.stringify(c2.sources)===JSON.stringify([{claim:'',url:'https://fallback.invalid/about',section:'',sentence:''}]), JSON.stringify(c2.sources));
  check('D5 sources is a known label, so the body grab stops at a Sources: line typed under the body, and that line is still a source row', c3.body==='Sam, a third fixture body.'&&DOSSIER_KNOWN_LABELS.indexOf('sources')!==-1&&JSON.stringify(c3.sources)===JSON.stringify([{claim:'a label typed under the body',url:'https://under-body.invalid/x',section:'Footer',sentence:''}]), JSON.stringify([c3.body,c3.sources]));
  check('D6 the body keeps its shape: salutation line, blank, body, blank, the link alone', /^Hi,\n\nA fixture body\. Run one through it:\n\nhttps:\/\//.test(c1.body), JSON.stringify(c1.body));
  check('D7 the hook rides as its own field beside the rows', c1.hook==='OPERATOR. Three offices in two countries; hand them one page tested first.', c1.hook);
  glob.state.comms=[{id:'id_fix_present',title:'Fallback Co · Robin Fallback',target:'robin@fallback.invalid',trail:'kept',hook:'the founder typed this',sources:[{claim:'kept',url:'https://kept.invalid/a',section:'',sentence:''}],body:'kept body',status:'draft'}];
  var r=additiveImportComms(res);
  check('D8 the import adds the two new cards and skips the present one', r.added===2&&r.skipped===1, JSON.stringify(r));
  var minted=glob.state.comms.filter(function(c){return c.target==='alex@fixture-freight.invalid';})[0];
  check('D9 the minted record carries sources in the app\'s shape and an empty trail', minted&&JSON.stringify(minted.sources)===JSON.stringify(c1.sources)&&minted.trail===''&&/^id_/.test(minted.id||''), JSON.stringify(minted&&minted.sources));
  var kept=glob.state.comms[0];
  check('D10 a card already present keeps its own sources and trail', JSON.stringify(kept.sources)===JSON.stringify([{claim:'kept',url:'https://kept.invalid/a',section:'',sentence:''}])&&kept.trail==='kept', JSON.stringify(kept.sources));

  // --- S: source pins -----------------------------------------------------------
  check('S1 the form carries k-sources with its link line and no k-trail', /id="k-sources"[^>]*><\/textarea><div class="field-link" id="k-sources-link"><\/div>/.test(html)&&html.indexOf('id="k-trail"')===-1&&html.indexOf('Discovery trail (optional)')===-1, '');
  check('S2 the autosave surface watches k-sources and not k-trail', /fields:\[[^\]]*'k-hook','k-sources','k-subject'[^\]]*\]/.test(html)&&!/fields:\[[^\]]*'k-trail'/.test(html), '');
  check('S3 autosaveApplyFields writes rec.sources from the lines and never the trail', /rec\.sources=parseSourceLines\(vals\['k-sources'\]\);/.test(extractFn(html,'autosaveApplyFields'))&&extractFn(html,'autosaveApplyFields').indexOf('rec.trail')===-1, '');
  check('S4 autosavePromote carries sources and an empty trail', /trail:'',/.test(extractFn(html,'autosavePromote'))&&/sources:parseSourceLines\(vals\['k-sources'\]\),/.test(extractFn(html,'autosavePromote')), '');
  var cc=extractFn(html,'commitCommRecord');
  check('S5 commitCommRecord commits sources, counts them as content, and compares them by text in the no-op guard', cc.indexOf("sources:parseSourceLines(g('k-sources').value),")!==-1&&cc.indexOf('||data.sources.length||')!==-1&&cc.indexOf("f==='sources'?sourceLinesText(base[f])===sourceLinesText(data[f]):base[f]===data[f]")!==-1&&cc.indexOf('k-trail')===-1, '');
  var om=extractFn(html,'openCommModal');
  check('S6 openCommModal fills and clears k-sources', om.indexOf("g('k-sources').value=sourceLinesText(k.sources);")!==-1&&om.indexOf("'k-hook','k-sources','k-subject'")!==-1&&om.indexOf('k-trail')===-1, '');
  var rc=extractFn(html,'renderComms');
  check('S7 the card renders the sources under the hook and no trail section', rc.indexOf('${hookHtml(k.hook)}${sourcesHtml(k.sources,k.hook)}')!==-1&&rc.indexOf('Discovery trail')===-1&&rc.indexOf('k.trail')===-1, '');
  check('S8 COPY ALL prints the Source lines under the Hook line', /if\(k\.hook\)lines\.push\('Hook: '\+k\.hook\);\s*normalizeSources\(k\.sources\)\.forEach\(s=>lines\.push\('Source: '\+sourceLineText\(s\)\)\);/.test(extractFn(html,'commPlainText')), '');
  var dm=extractFn(html,'downloadMonthReport');
  check('S9 the month report prints Source lines and no Trail line', dm.indexOf("out.push('  Source:    '+sourceLineText(s))")!==-1&&dm.indexOf('Trail:')===-1, '');
  check('S10 the fullscreen meta row carries the SOURCES count after HOOK and no TRAIL', /HOOK: \$\{esc\(k\.hook\)\}<\/span>`\);\s*const srcN=normalizeSources\(k\.sources\)\.length;/.test(html)&&html.indexOf('TRAIL: ${esc(k.trail)}')===-1, '');
  check('S11 the council block carries the Hook and the Sources rows in both sites and no Discovery trail line', (html.match(/Sources \(one row per claim about the target, hook or body: the claim, the page, where on the page; after \|\| the body sentence the row supports\): \$\{sourcesBlockText\(k\.sources\)\}/g)||[]).length===2&&html.indexOf('Discovery trail:')===-1, '');
  check('S12 normalizeComm runs at load, at import and at the server merge, and a file copy that lacked the field owes the file a sync', /s\.comms\.forEach\(c=>\{normalizeComm\(c\);\}\);/.test(extractFn(html,'loadState'))&&extractFn(html,'additiveImportState').indexOf('normalizeComm(rec);')!==-1&&extractFn(html,'mergeServerState').indexOf('normalizeComm(c);')!==-1&&extractFn(html,'mergeServerState').indexOf('if(!Array.isArray(c.sources))owed=true;')!==-1, '');
  check('S13 the trail renderer, its fold control and its styles are gone', html.indexOf('trailHtml')===-1&&html.indexOf('trail-toggle')===-1&&html.indexOf('.trail-rest')===-1, '');
  check('S14 COMM_TEXT_LINK_FIELDS names the hook, the sources and the body', html.indexOf("const COMM_TEXT_LINK_FIELDS=['k-hook','k-sources','k-body'];")!==-1, '');
  check('S15 no code path generates a source row from a model', !/sources[^\n]{0,80}(callGroq|fireSlot)/.test(html)&&!/(callGroq|fireSlot)[^\n]{0,80}sources/.test(html), '');

  out('sources_check: '+checks+' checks, '+failures+' failure(s)');
  if(failures){if(isNode)process.exit(1);throw new Error('sources_check FAILED');}
})();
