// text_link_check.js: THE TEXT LINKS (infrabot v0.15.1). Every url in a
// communication's hook, sources and body opens from the form and
// from the card, through the one link helper.
//
// Runs the REAL esc, linkHref, linkHtml, URL_TOKEN_RE, urlTokenParts,
// linkedTextHtml, textUrls, textLinksHtml, hookHtml, sourcesRowsHtml,
// expandAppLink, commBodyPreviewHtml and refreshTextLinks extracted from
// infrabot.html by a brace walk (never a re-implementation) against
// SYNTHETIC text: invented hosts under the reserved .invalid domain, no real
// record. The repo is public.
//
// What it pins: one tokenizer (URL_TOKEN_RE, urlTokenParts) behind the hook,
// the sources and the body; the hook section, the source rows and the body
// preview render a url as the one anchor linkHtml renders (new tab, rel noopener
// noreferrer, the url as its text) and stay escaped text otherwise; the body
// preview keeps its 280-character cut and carries a url the cut would split
// whole, the ellipsis outside every anchor; the form's link line under each
// of the three fields lists the urls the field carries and clears with them;
// the wiring (input listeners, the refresh on open, the fullscreen editor's
// real input event) is present in the source; no helper here writes an
// anchor of its own and none reads or writes the stored record.
//
// Run from the repo root:   node tests/text_link_check.js
//                     or:   jsc  tests/text_link_check.js
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

  // A fake element table behind g(): the form fields and their link lines.
  var glob=(typeof globalThis!=='undefined')?globalThis:this;
  var els={};
  function el(id){if(!els[id])els[id]={id:id,value:'',innerHTML:''};return els[id];}
  glob.g=function(id){return els[id]||null;};

  var ge=eval;
  ['esc','CW_APP_URL','URL_TOKEN_RE','BODY_PREVIEW_CHARS','COMM_TEXT_LINK_FIELDS'].forEach(function(n){ge(extractVar(html,n));});
  ['linkHref','linkHtml','urlTokenParts','linkedTextHtml','textUrls','textLinksHtml','hookHtml','sourcesRowsHtml','normalizeSources','expandAppLink','commBodyPreviewHtml','refreshTextLinks'].forEach(function(n){ge(extractFn(html,n));});

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,240)+']'));
    if(!ok)failures++;
  }

  var U1='https://fixture.invalid/source/a';
  var U2='https://second.invalid/b?q=1';
  var A1=linkHtml(U1),A2=linkHtml(U2);

  // --- U: one tokenizer ------------------------------------------------------
  var u1=textUrls('Source: '+U1+'. Then '+U2+') and done');
  check('U1 textUrls lists every url in reading order with sentence punctuation left off', u1.length===2&&u1[0]===U1&&u1[1]===U2, JSON.stringify(u1));
  check('U2 a text with no url lists nothing', textUrls('One line.').length===0&&textUrls('').length===0&&textUrls(null).length===0, JSON.stringify(textUrls('One line.')));
  check('U3 a bare host with no scheme is not a url token', textUrls('Source: fixture.invalid/a').length===0, JSON.stringify(textUrls('Source: fixture.invalid/a')));
  var u4=textUrls('javascript:alert(1) ftp://fixture.invalid/x');
  check('U4 a javascript: or ftp: token is never listed', u4.length===0, JSON.stringify(u4));
  check('U5 urlTokenParts splits the trailing punctuation from the url and nothing else', JSON.stringify(urlTokenParts(U1+').'))===JSON.stringify([U1,').'])&&JSON.stringify(urlTokenParts(U1))===JSON.stringify([U1,'']), JSON.stringify(urlTokenParts(U1+').')));
  check('U6 URL_TOKEN_RE is the one url spelling: linkedTextHtml, textUrls and commBodyPreviewHtml read it and carry no url regex of their own',
    /split\(URL_TOKEN_RE\)/.test(extractFn(html,'linkedTextHtml'))&&/split\(URL_TOKEN_RE\)/.test(extractFn(html,'textUrls'))&&/URL_TOKEN_RE\.source/.test(extractFn(html,'commBodyPreviewHtml'))&&!/https\?:/.test(extractFn(html,'linkedTextHtml')+extractFn(html,'textUrls')+extractFn(html,'commBodyPreviewHtml')), '');

  // --- T: the text renderer is the one rule (the trail's, through v0.15.2) -----
  var t1=linkedTextHtml('Source: '+U1);
  check('T1 linkedTextHtml renders a url as the exact anchor linkHtml renders', t1==='Source: '+A1, t1);
  check('T2 a source row renders its page through the same anchor, byte for byte', sourcesRowsHtml([{claim:'c',url:U1,section:''}]).indexOf(A1)!==-1, sourcesRowsHtml([{claim:'c',url:U1,section:''}]));
  var t3=linkedTextHtml('a <b>bold</b> & "quoted" line with '+U1+'. <i>after</i>');
  check('T3 the text around a url stays escaped and the period stays outside the anchor', t3==='a &lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot; line with '+A1+'. &lt;i&gt;after&lt;/i&gt;', t3);
  check('T4 the anchor carries the url-link class, a new tab and rel noopener noreferrer, the url as its text', A1.indexOf('class="url-link"')!==-1&&A1.indexOf('target="_blank"')!==-1&&A1.indexOf('rel="noopener noreferrer"')!==-1&&A1.indexOf('>'+U1+'</a>')!==-1, A1);

  // --- H: the hook on the card -------------------------------------------------
  var h1=hookHtml('Job posting at '+U1+', they pay for a writer.');
  check('H1 a url in the hook renders as the one anchor inside the Hook section', h1.indexOf('card-section-h">Hook<')!==-1&&h1.indexOf('Job posting at '+A1+', they pay for a writer.')!==-1, h1);
  var h2=hookHtml('JOB POSTING. Hand them one page.');
  check('H2 a hook with no url renders no anchor and its text escaped, the v0.9.0 shape', h2.indexOf('<a ')===-1&&h2.indexOf('>JOB POSTING. Hand them one page.</div>')!==-1, h2);
  var h3=hookHtml('<b>x</b> '+U1);
  check('H3 markup in a hook stays escaped beside a linked url', h3.indexOf('<b>')===-1&&h3.indexOf('&lt;b&gt;x&lt;/b&gt; '+A1)!==-1, h3);
  check('H4 an empty hook still renders no section', hookHtml('')===''&&hookHtml('  ')===''&&hookHtml(null)==='', hookHtml('  '));

  // --- B: the body preview on the card ----------------------------------------
  var b1=commBodyPreviewHtml('Hi. See '+U1+' for the page.\nBest.');
  check('B1 a short body renders whole, its url an anchor, no ellipsis', b1==='Hi. See '+A1+' for the page.\nBest.', b1);
  var filler='';while(filler.length<400)filler+='word ';
  var b2=commBodyPreviewHtml(filler);
  check('B2 a long body with no url is cut at 280 characters with an ellipsis, escaped', b2===esc(filler.slice(0,280))+'...'&&BODY_PREVIEW_CHARS===280, b2.slice(-30));
  var pre='';while(pre.length<270)pre+='x ';
  pre=pre.slice(0,270);
  var body3=pre+U1+' and more text after the address that the cut leaves out';
  var b3=commBodyPreviewHtml(body3);
  check('B3 a url the 280-character cut would split is carried whole and linked, the ellipsis after the anchor', b3===esc(pre)+A1+'...', b3.slice(250));
  var body4=pre+'plain words here '+U1;
  var b4=commBodyPreviewHtml(body4);
  check('B4 a url that starts after the cut is not carried', b4.indexOf('<a ')===-1&&b4===esc(body4.slice(0,280))+'...', b4.slice(250));
  var body5='Open '+U1+' first. '+filler;
  var b5=commBodyPreviewHtml(body5);
  check('B5 a url before the cut links and the cut stays at 280', b5===linkedTextHtml(body5.slice(0,280))+'...'&&b5.indexOf(A1)===5, b5.slice(0,120));
  var body6=pre+U1+' then '+U2;
  var b6=commBodyPreviewHtml(body6);
  check('B6 the cut moves once, to the end of the split url; a second url after it stays out', b6.indexOf(A1)!==-1&&b6.indexOf(A2)===-1&&b6.indexOf('second.invalid')===-1, b6.slice(250));
  var b7=commBodyPreviewHtml('Try it. [CW_APP_LINK]');
  check('B7 the link token expands and the expanded address links', b7==='Try it.\n\n'+linkHtml(CW_APP_URL), b7);
  var b8=commBodyPreviewHtml('a <b>bold</b> body & '+U1+'"onmouseover="x');
  check('B8 markup in a body stays escaped and a quote ends the url token', b8.indexOf('<b>')===-1&&b8.indexOf('&lt;b&gt;')!==-1&&b8.indexOf('onmouseover="x')===-1&&b8.indexOf(A1)!==-1, b8);

  // --- F: the form's link lines --------------------------------------------------
  check('F1 COMM_TEXT_LINK_FIELDS names the hook, the sources and the body', JSON.stringify(COMM_TEXT_LINK_FIELDS)===JSON.stringify(['k-hook','k-sources','k-body']), JSON.stringify(COMM_TEXT_LINK_FIELDS));
  check('F2 the form carries a link line right after each of the three textareas', /id="k-sources"[^>]*><\/textarea><div class="field-link" id="k-sources-link"><\/div>/.test(html)&&/id="k-hook"[^>]*><\/textarea><div class="field-link" id="k-hook-link"><\/div>/.test(html)&&/id="k-body"[^>]*><\/textarea>\s*<div class="field-link" id="k-body-link"><\/div>/.test(html), '');
  el('k-sources').value='a claim '+U1+' About\nanother '+U2;el('k-sources-link');
  refreshTextLinks('k-sources');
  check('F3 the link line lists every url the field carries, each the one anchor', el('k-sources-link').innerHTML===A1+' · '+A2, el('k-sources-link').innerHTML);
  el('k-hook').value='no address here';el('k-hook-link').innerHTML='stale';
  refreshTextLinks('k-hook');
  check('F4 a field with no url clears its line', el('k-hook-link').innerHTML==='', el('k-hook-link').innerHTML);
  el('k-body').value='Body with '+U1;el('k-body-link');
  refreshTextLinks('k-body');
  check('F5 the body\'s line follows the body', el('k-body-link').innerHTML===A1, el('k-body-link').innerHTML);
  check('F6 a field with no link line is a no-op', (function(){el('k-title').value=U1;refreshTextLinks('k-title');return !els['k-title-link'];})(), '');
  check('F7 wireEvents refreshes each line on input', html.indexOf("COMM_TEXT_LINK_FIELDS.forEach(id=>g(id).addEventListener('input',()=>refreshTextLinks(id)));")!==-1, '');
  check('F8 openCommModal refreshes the three lines on open, before the modal shows', /COMM_TEXT_LINK_FIELDS\.forEach\(id=>refreshTextLinks\(id\)\);[\s\S]{0,120}showModal\('modal-comm'\)/.test(extractFn(html,'openCommModal')), '');
  check('F9 the fullscreen editor syncs through a real input event on its target, so the body\'s line follows typing there', extractFn(html,'renderFullscreenBodyCommEdit').indexOf("kbody.dispatchEvent(new Event('input',{bubbles:true}))")!==-1, '');
  check('F10 refreshTextLinks reads the field through textLinksHtml and nothing else', /el\.innerHTML=textLinksHtml\(g\(inputId\)\.value\);/.test(extractFn(html,'refreshTextLinks')), '');

  // --- S: one helper, pinned on the source ---------------------------------------
  check('S1 exactly one linkHtml definition in the file', (html.match(/function linkHtml\(/g)||[]).length===1, '');
  var own=['linkedTextHtml','textUrls','textLinksHtml','hookHtml','commBodyPreviewHtml','sourcesRowsHtml','refreshTextLinks'].map(function(n){return extractFn(html,n);}).join('\n');
  check('S2 none of the text helpers writes an anchor of its own', own.indexOf('<a ')===-1, '');
  check('S3 none of the text helpers reads or writes the stored record', own.indexOf('state.')===-1&&own.indexOf('saveState')===-1, '');
  var rc=extractFn(html,'renderComms');
  check('S4 the comm card renders the hook, the sources and the body preview through the three helpers', rc.indexOf('sourcesHtml(k.sources,k.hook)')!==-1&&rc.indexOf('trailHtml')===-1&&rc.indexOf('hookHtml(k.hook)')!==-1&&rc.indexOf('commBodyPreviewHtml(k.body)')!==-1&&rc.indexOf('expandAppLink(k.body)')===-1, '');
  check('S5 the source anchor, the hook anchor and the body anchor for one url are byte-identical', sourcesRowsHtml([{claim:'',url:U1,section:''}]).indexOf(A1)!==-1&&hookHtml(U1).indexOf(A1)!==-1&&commBodyPreviewHtml(U1)===A1, '');
  check('S6 the old helper names are gone', html.indexOf('trailTextHtml')===-1&&html.indexOf('trailHtml')===-1, '');
  check('S7 the event card still renders its Verify url through linkHtml', extractFn(html,'renderEventCard').indexOf('linkHtml(e.url)')!==-1, '');

  out('\n'+checks+' checks, '+failures+' failure(s)');
  if(failures){if(isNode)process.exit(1);throw new Error(failures+' failure(s)');}
})();
