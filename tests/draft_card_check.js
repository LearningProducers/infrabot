// draft_card_check.js: ONE DRAFT AT A TIME, THE CLAIM SOURCES (infrabot
// v0.19.0). The DRAFTS view shows one card in the call card's frame with a
// previous and next step and the whole body. A source row covers a claim the
// hook or the body makes about the target: the claim, the page, where on the
// page, and for a body claim the sentence it supports, written after two
// pipes on the row's line. The card shows each such row under its sentence.
//
// Runs the REAL helpers extracted from infrabot.html by a brace walk (never a
// re-implementation) against SYNTHETIC fixtures: invented companies, invented
// people, hosts under the reserved .invalid domain. The repo is public.
//
// What it pins: the line grammar with the sentence and its round trip; the
// placement of a row under its sentence (whitespace-tolerant, the closing
// punctuation carried, order by position, a lost sentence listed and marked);
// the one-card view (one card, the frame, the step buttons and their ends,
// the whole body, the subject, the hook's own rows); the cursor (it follows
// the id through a re-sort and keeps its place when the card leaves); and the
// source pins in renderComms, the dispatcher, the form, and the council text.
//
// Run from the repo root:   node tests/draft_card_check.js
//                     or:   jsc  tests/draft_card_check.js
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
  glob.state={comms:[],network:[],calls:[],commsView:'drafts'};
  glob.saveState=function(){throw new Error('saveState must never run from the drafts view');};
  var rendered=0;
  glob.networkMatch=function(){return null;};
  glob.goldFor=function(){return false;};
  glob.cityToTz=function(){return '';};
  glob.statusDisplay=function(s){return String(s).toUpperCase();};
  glob.getCommBucket=function(c){return c.status==='draft'?'drafts':(c.status==='sent'?'pipeline':'archive');};
  var ge=eval;
  ['esc','URL_TOKEN_RE'].forEach(function(n){ge(extractVar(html,n));});
  ge('var draftCursorId=null,draftCursorIdx=0;');
  ['linkHref','linkHtml','urlTokenParts','linkedTextHtml','hookHtml','_dEscapeRe','normalizeSources','parseSourceLines','sourceLineText','sourceLinesText','sourcesBlockText','sourcesRowsHtml','sourcesHtml','draftsSorted','draftCursorAt','stepDraft','claimPlacements','claimSourceHtml','draftBodyHtml','looseSourcesHtml','renderDraftOne'].forEach(function(n){ge(extractFn(html,n));});
  glob.renderComms=function(){rendered++;};

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,260)+']'));
    if(!ok)failures++;
  }
  function count(h,needle){return h.split(needle).length-1;}

  var U1='https://fixture-freight.invalid/news/second-depot';
  var U2='https://fixture-freight.invalid/about/team';
  var S1='Your second depot opened in March.';
  var S2='Pat Fixture runs the docs desk';
  var BODY='Pat,\n\n'+S1+' '+S2+'.  That is two\nreaders for every notice.\n\nCombat Writing reads a page the way a hostile reader would.\n\nhttps://app.fixture.invalid/start';

  // --- G: the line grammar ---------------------------------------------------
  var line='second depot opened March 2026 '+U1+' third paragraph under the intro || '+S1;
  var g1=parseSourceLines(line);
  check('G1 a line reads claim, page, place on the page, and after two pipes the body sentence', JSON.stringify(g1)===JSON.stringify([{claim:'second depot opened March 2026',url:U1,section:'third paragraph under the intro',sentence:S1}]), JSON.stringify(g1));
  check('G2 the row writes back as the same line', sourceLineText(g1[0])===line&&sourceLinesText(g1)===line, sourceLineText(g1[0]));
  check('G3 a line with no pipes is a hook row, sentence empty, and writes back with no pipes', (function(){var r=parseSourceLines('hiring a docs writer '+U2+' final paragraph');return r[0].sentence===''&&r[0].section==='final paragraph'&&sourceLineText(r[0]).indexOf('||')===-1;})(), '');
  check('G4 a url inside the sentence is never read as the page', (function(){var r=parseSourceLines('a claim '+U1+' the footer || See https://other.invalid/x for it.');return r[0].url===U1&&r[0].sentence==='See https://other.invalid/x for it.';})(), '');
  check('G5 normalizeSources keeps a sentence, trims it, and gives every row the key', JSON.stringify(normalizeSources([{claim:'c',url:U1,section:'s',sentence:'  A sentence.  '},{claim:'d',url:'',section:''}]))===JSON.stringify([{claim:'c',url:U1,section:'s',sentence:'A sentence.'},{claim:'d',url:'',section:'',sentence:''}]), '');
  check('G6 the council block carries the sentence after the pipes', sourcesBlockText(g1)==='\n- '+line, sourcesBlockText(g1));

  // --- P: placement ------------------------------------------------------------
  var rows=[
    {claim:'Pat Fixture leads documentation',url:U2,section:'second card in the Leadership row',sentence:S2},
    {claim:'second depot opened March 2026',url:U1,section:'third paragraph under the intro',sentence:S1},
    {claim:'hiring a docs writer',url:U2,section:'final paragraph',sentence:''},
    {claim:'a claim the body dropped',url:U1,section:'first paragraph',sentence:'This sentence left the body.'}
  ];
  var pl=claimPlacements(BODY,rows);
  check('P1 rows with a sentence in the body are placed in body order, whatever the record order', pl.placed.length===2&&pl.placed[0].s.sentence===S1&&pl.placed[1].s.sentence===S2, JSON.stringify(pl.placed.map(function(p){return p.s.claim;})));
  check('P2 a placement ends after the sentence and its closing punctuation', BODY.slice(0,pl.placed[0].end).slice(-S1.length)===S1&&BODY.slice(0,pl.placed[1].end).slice(-(S2.length+1))===S2+'.', '');
  var frag=claimPlacements('Pat,\n\nPat Fixture runs the docs desk, which means two\nreaders for every notice. A second sentence.\n\nA link line',[{claim:'c',url:U1,section:'s',sentence:'Pat Fixture runs the docs desk'}]);
  check('P2b a row quoting part of a sentence sits under the whole sentence, across a wrapped line, never mid-sentence', frag.placed.length===1&&'Pat,\n\nPat Fixture runs the docs desk, which means two\nreaders for every notice. A second sentence.\n\nA link line'.slice(0,frag.placed[0].end).slice(-25)==='readers for every notice.', String(frag.placed[0]&&frag.placed[0].end));
  var open2=claimPlacements('A line with no closing mark\n\nNext paragraph.',[{claim:'c',url:U1,section:'s',sentence:'A line with'}]);
  check('P2c a sentence with no closing mark runs to the end of its paragraph, never into the next', open2.placed[0].end==='A line with no closing mark'.length, String(open2.placed[0].end));
  check('P3 a row whose sentence the body lacks is loose; a hook row is neither placed nor loose', pl.loose.length===1&&pl.loose[0].claim==='a claim the body dropped', JSON.stringify(pl.loose));
  check('P4 a sentence wrapped across a line break in the body still places', claimPlacements('That is two\nreaders for every notice.',[{claim:'c',url:U1,section:'s',sentence:'That is two readers for every notice.'}]).placed.length===1, '');
  check('P5 regex characters in a sentence are literal', claimPlacements('Costs fell (a lot) in Q1 [sic].',[{claim:'c',url:U1,section:'s',sentence:'Costs fell (a lot) in Q1 [sic].'}]).placed.length===1&&claimPlacements('Costs fell XaXlotX',[{claim:'c',url:U1,section:'s',sentence:'Costs fell (a lot)'}]).placed.length===0, '');
  var bh=draftBodyHtml(BODY,rows);
  var i1=bh.indexOf('Your second depot opened in March.'),b1=bh.indexOf('second depot opened March 2026'),i2=bh.indexOf('Pat Fixture runs the docs desk.'),b2=bh.indexOf('Pat Fixture leads documentation');
  check('P6 the body renders whole with each row directly under its sentence', i1!==-1&&b1>i1&&i2>b1&&b2>i2&&bh.indexOf('Combat Writing reads a page')>b2, [i1,b1,i2,b2].join(','));
  check('P7 a placed row shows the claim, the page as the one anchor, and the place on the page', count(bh,'class="claim-src"')===2&&count(bh,'href="'+U1+'"')===1&&bh.indexOf('<div class="claim-loc">third paragraph under the intro</div>')!==-1&&bh.indexOf('second card in the Leadership row')!==-1, bh.slice(0,400));
  check('P8 every body character outside the rows survives: the link line is still an anchor and no text is dropped', count(bh,'href="https://app.fixture.invalid/start"')===1&&bh.indexOf('That is two\nreaders for every notice.')!==-1&&bh.indexOf('Pat,\n\n')===0, '');
  check('P9 body text is escaped', draftBodyHtml('A <b> & c.',[]).indexOf('A &lt;b&gt; &amp; c.')===0, draftBodyHtml('A <b> & c.',[]));
  var ch=claimSourceHtml({claim:'c',url:'',section:'',sentence:'x'});
  check('P10 a row with no page reads NO PAGE and one with no place reads NO LOCATION', ch.indexOf('NO PAGE')!==-1&&ch.indexOf('NO LOCATION')!==-1&&ch.indexOf('<a ')===-1, ch);
  var lh=looseSourcesHtml(BODY,rows);
  check('P11 the loose row is listed under the body with its sentence quoted and the NOT IN BODY mark', lh.indexOf('Sources whose sentence is not in the body')!==-1&&lh.indexOf('&ldquo;This sentence left the body.&rdquo;')!==-1&&lh.indexOf('NOT IN BODY')!==-1&&count(lh,'class="claim-src"')===1, lh.slice(0,300));
  check('P12 no loose rows, no section', looseSourcesHtml(BODY,rows.slice(0,3))==='', '');

  // --- V: the one-card view ---------------------------------------------------
  function draft(id,title,stamp,extra){
    return Object.assign({id:id,title:title,direction:'outbound',channel:'email',target:'desk@'+id+'.invalid',city:'',hook:'OPERATOR. A hook for '+title+'.',sources:[],subject:'A subject for '+title,body:'A body for '+title+'.',status:'draft',sentDate:'',createdAt:stamp,updatedAt:stamp},extra||{});
  }
  var A=draft('id_fix_a','Fixture Freight · Pat Fixture','2026-01-03T10:00:00.000Z',{sources:rows,body:BODY});
  var B=draft('id_fix_b','Sample Adjusters · Sam Sample','2026-01-02T10:00:00.000Z');
  var C=draft('id_fix_c','Invented Press · Ira Invented','2026-01-01T10:00:00.000Z');
  var SENT=draft('id_fix_s','Sent Co · Sal Sent','2026-01-04T10:00:00.000Z',{status:'sent'});
  glob.state.comms=[C,SENT,A,B];
  var list=draftsSorted();
  check('V1 the drafts list is the draft cards only, newest first', list.map(function(k){return k.id;}).join()==='id_fix_a,id_fix_b,id_fix_c', list.map(function(k){return k.id;}).join());
  var h=renderDraftOne(list);
  check('V2 one card, in the call card\'s frame, the pane\'s one column', count(h,'<div class="card call-card draft-one')===1&&count(h,'class="card-name"')===1&&h.indexOf('<div class="card-grid calls-grid">')!==-1, '');
  check('V3 the position reads DRAFT 1 OF 3, PREVIOUS is disabled at the first card and NEXT is live', h.indexOf('DRAFT 1 OF 3')!==-1&&/data-act="draft-prev" disabled>/.test(h)&&/data-act="draft-next">/.test(h), h.slice(0,300));
  check('V4 the whole body is on the card: no preview cut, no height clamp', h.indexOf('https://app.fixture.invalid/start')!==-1&&h.indexOf('max-height')===-1&&h.indexOf('class="card-section-body draft-body"')!==-1, '');
  check('V5 the subject has its own section', h.indexOf('card-section-h">Subject<')!==-1&&h.indexOf('A subject for Fixture Freight')!==-1, '');
  check('V6 the hook section lists the hook\'s own rows; rows with a sentence sit under the body', (function(){var hs=h.slice(h.indexOf('card-section-h">Sources<'),h.indexOf('card-section-h">Subject<'));return hs.indexOf('hiring a docs writer')!==-1&&hs.indexOf('second depot opened March 2026')===-1;})(), '');
  check('V7 OPEN, COPY ALL and COUNCIL carry the card\'s id through the existing actions', h.indexOf('data-act="edit-comm" data-id="id_fix_a"')!==-1&&h.indexOf('data-act="copy-comm" data-id="id_fix_a"')!==-1&&h.indexOf('data-act="council-comm" data-id="id_fix_a"')!==-1, '');
  var hb=renderDraftOne([B]);
  check('V8 a lone draft with a hook and no rows reads DRAFT 1 OF 1, both steps disabled, UNSOURCED HOOK', hb.indexOf('DRAFT 1 OF 1')!==-1&&/draft-prev" disabled>/.test(hb)&&/draft-next" disabled>/.test(hb)&&hb.indexOf('UNSOURCED HOOK')!==-1, hb.slice(0,300));
  var onlyBody=draft('id_fix_d','Body Rows Only · Bo Body','2026-01-01T09:00:00.000Z',{sources:[rows[1]],body:BODY});
  check('V9 a card whose every row has a sentence shows no UNSOURCED HOOK mark', renderDraftOne([onlyBody]).indexOf('UNSOURCED HOOK')===-1, '');

  check('V10 a draft holding a date shows it in a Sent section, as the grid card does; one without shows none', renderDraftOne([draft('id_fix_e','Dated \u00b7 Dee Dated','2026-01-01T08:00:00.000Z',{sentDate:'2026-02-03'})]).indexOf('card-section-h">Sent</div><div class="card-section-body call-mono">2026-02-03<')!==-1&&h.indexOf('card-section-h">Sent<')===-1, '');

  // --- C: the cursor ------------------------------------------------------------
  ge('draftCursorId=null;draftCursorIdx=0;');
  stepDraft(1);
  var h2=renderDraftOne(draftsSorted());
  check('C1 NEXT moves to the second draft and re-renders once', rendered===1&&h2.indexOf('DRAFT 2 OF 3')!==-1&&h2.indexOf('Sample Adjusters')!==-1, h2.slice(0,200));
  stepDraft(1);stepDraft(1);
  var h3=renderDraftOne(draftsSorted());
  check('C2 NEXT stops at the last draft, where NEXT is disabled and PREVIOUS is live', h3.indexOf('DRAFT 3 OF 3')!==-1&&/draft-next" disabled>/.test(h3)&&/data-act="draft-prev">/.test(h3), '');
  stepDraft(-1);
  B.updatedAt='2026-01-09T10:00:00.000Z';
  var h4=renderDraftOne(draftsSorted());
  check('C3 the cursor follows the card through a re-sort: the edited draft is still the one shown, now first', h4.indexOf('Sample Adjusters')!==-1&&h4.indexOf('DRAFT 1 OF 3')!==-1, h4.slice(0,200));
  stepDraft(1);
  A.status='sent';
  var cur=renderDraftOne(draftsSorted());
  check('C4 when the shown card leaves the list the view keeps its position and shows the card now there', cur.indexOf('DRAFT 2 OF 2')!==-1&&cur.indexOf('Invented Press')!==-1, cur.slice(0,200));
  glob.state.comms=[];
  rendered=0;stepDraft(1);
  check('C5 a step with no drafts does nothing', rendered===0, '');

  // --- S: source pins -------------------------------------------------------------
  var rc=extractFn(html,'renderComms');
  check('S1 renderComms hands the DRAFTS view to the one-card renderer before the grid is built', rc.indexOf("if(view==='drafts'){")!==-1&&rc.indexOf('body.innerHTML=triageBar+renderDraftOne(sorted);')!==-1&&rc.indexOf('renderDraftOne(sorted)')<rc.indexOf("let html=triageBar+'<div class=\"card-grid\">';"), '');
  check('S1b a card under edit is the card shown, and an import resets the view to its newest card', rc.indexOf('if(editingCommId&&sorted.findIndex(k=>k.id===editingCommId)>=0)draftCursorId=editingCommId;')!==-1&&html.indexOf("state.commsView='drafts';draftCursorId=null;draftCursorIdx=0;renderComms();")!==-1, '');
  check('S1c the IMPORT DRAFTS button path resets the view too, when cards were added', extractFn(html,'importDraftsFile').indexOf('if(r.added>0){draftCursorId=null;draftCursorIdx=0;renderComms();}')!==-1&&extractFn(html,'additiveImportComms').indexOf('draftCursor')===-1, '');
  check('S2 the PIPELINE and ARCHIVE views keep the grid and its body preview', rc.indexOf('commBodyPreviewHtml(k.body)')!==-1&&rc.indexOf("items.forEach(it=>{")!==-1, '');
  check('S3 the dispatcher steps the view on draft-prev and draft-next', html.indexOf("if(act==='draft-prev'||act==='draft-next'){stepDraft(act==='draft-next'?1:-1);return;}")!==-1, '');
  check('S4 nothing in the view writes a record', ['draftsSorted','draftCursorAt','stepDraft','claimPlacements','claimSourceHtml','draftBodyHtml','looseSourcesHtml','renderDraftOne'].every(function(n){return extractFn(html,n).indexOf('saveState')===-1;}), '');
  check('S5 the form\'s Sources label teaches the place on the page and the pipes', html.indexOf('where on the page to the paragraph; for a body claim add || and the body sentence it supports')!==-1, '');
  check('S6 the Network tab\'s call view is untouched by name', extractFn(html,'renderCallsView').indexOf('draft')===-1&&extractFn(html,'renderCallCard').indexOf('draft')===-1, '');
  check('S7 the stored key for the place on the page is still section', extractFn(html,'normalizeSources').indexOf('section:String(s.section==null')!==-1&&extractFn(html,'normalizeSources').indexOf('location')===-1, '');

  out('draft_card_check: '+checks+' checks, '+failures+' failure(s)');
  if(failures){if(isNode)process.exit(1);throw new Error('draft_card_check FAILED');}
})();
