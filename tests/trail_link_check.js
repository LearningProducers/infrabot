// trail_link_check.js: a url inside a communication card's discovery trail
// renders as a link through the one link helper (infrabot v0.13.3).
//
// Runs the REAL esc, linkHref, linkHtml, URL_TOKEN_RE, urlTokenParts,
// linkedTextHtml (named trailTextHtml through v0.15.0) and trailHtml
// extracted from infrabot.html by a brace walk (never a re-implementation)
// against SYNTHETIC trails: invented hosts under the reserved .invalid
// domain, no real record. The repo is public.
//
// What it pins: the url on a trail's Source line renders as the exact anchor
// linkHtml renders for the event card's Verify line (same class, new tab,
// rel noopener noreferrer, the url itself the text); punctuation right after
// a url stays outside the anchor; a url inside the folded remainder is a
// link too; a trail with no url renders byte-identical to the v0.13.2 shape;
// text around a url stays escaped; a non-http scheme never links; the comm
// card and the event card share one helper and trailHtml writes no anchor
// of its own.
//
// Run from the repo root:   node tests/trail_link_check.js
//                     or:   jsc  tests/trail_link_check.js
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

  var ge=eval;
  ge(extractVar(html,'esc'));
  ge(extractVar(html,'URL_TOKEN_RE'));
  ['linkHref','linkHtml','urlTokenParts','linkedTextHtml','trailHtml'].forEach(function(n){ge(extractFn(html,n));});

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,240)+']'));
    if(!ok)failures++;
  }

  var URL1='https://fixture.invalid/source/a';
  var A1=linkHtml(URL1);
  var MORE='<button type="button" class="trail-toggle" data-act="trail-toggle" aria-expanded="false">MORE</button><div class="trail-rest hidden">';

  // --- L: the link is the event card's link -------------------------------
  var t1=trailHtml('Source: '+URL1);
  check('L1 a one-line Source trail renders the url as the exact anchor linkHtml renders', t1==='Source: '+A1, t1);
  check('L2 the anchor carries the url-link class, a new tab and rel noopener noreferrer, the url as its text',
    A1.indexOf('class="url-link"')!==-1&&A1.indexOf('target="_blank"')!==-1&&A1.indexOf('rel="noopener noreferrer"')!==-1&&A1.indexOf('href="'+linkHref(URL1)+'"')!==-1&&A1.indexOf('>'+URL1+'</a>')!==-1, A1);
  var t3=trailHtml('Source: '+URL1+'.\nArchetype: two lines');
  check('L3 a period right after the url stays outside the anchor and the fold still lands', t3==='Source: '+A1+'.'+MORE+'Archetype: two lines</div>', t3);
  var t4=trailHtml('One sentence first.\nSee '+URL1+' for the rest');
  check('L4 a url inside the folded remainder is a link too', t4==='One sentence first.'+MORE+'See '+A1+' for the rest</div>', t4);
  var t5=trailHtml('(see '+URL1+')');
  check('L5 a closing paren after the url stays outside the anchor', t5==='(see '+A1+')', t5);
  var up='HTTPS://Fixture.invalid/A';
  var t6=trailHtml('Source: '+up);
  check('L6 an upper-case scheme still links, the stored text kept as typed', t6==='Source: '+linkHtml(up)&&t6.indexOf('>'+up+'</a>')!==-1, t6);
  var two='First '+URL1+' then https://second.invalid/b';
  var t7=trailHtml(two);
  check('L7 two urls on one line are two anchors with the text between them escaped', t7==='First '+A1+' then '+linkHtml('https://second.invalid/b'), t7);

  // --- N: no url, nothing moves --------------------------------------------
  check('N1 a one-sentence trail with no url renders plain, byte-identical to before', trailHtml('One line.')==='One line.', trailHtml('One line.'));
  var n2=trailHtml('Line one\nLine two');
  check('N2 a two-line trail with no url keeps the v0.13.2 fold shape byte-identical', n2==='Line one'+MORE+'Line two</div>', n2);
  check('N3 an empty trail renders nothing', trailHtml('')===''&&trailHtml(null)===''&&trailHtml('   ')==='', trailHtml('   '));
  var n4=trailHtml('a <b>bold</b> & "quoted" trail with '+URL1+' <i>after</i>');
  check('N4 the text around a url stays escaped', n4.indexOf('<b>')===-1&&n4.indexOf('&lt;b&gt;')!==-1&&n4.indexOf('&amp;')!==-1&&n4.indexOf('&quot;')!==-1&&n4.indexOf('&lt;i&gt;')!==-1&&n4.indexOf(A1)!==-1, n4);
  check('N5 a bare host with no scheme stays text (the trail links only what carries http or https)', trailHtml('Source: fixture.invalid/a')==='Source: fixture.invalid/a', trailHtml('Source: fixture.invalid/a'));

  // --- R: refused schemes and broken tokens ----------------------------------
  var r1=trailHtml('Source: javascript:alert(1)');
  check('R1 a javascript: scheme never links', r1.indexOf('<a ')===-1&&r1==='Source: javascript:alert(1)', r1);
  var r2=trailHtml('Source: ftp://fixture.invalid/a');
  check('R2 an ftp: scheme never links', r2.indexOf('<a ')===-1, r2);
  var r3=trailHtml('Source: https://fixture.invalid/a"onmouseover="x');
  check('R3 a quote ends the url token and the rest is escaped text', r3.indexOf('onmouseover="x')===-1&&r3.indexOf('&quot;onmouseover=&quot;x')!==-1&&r3.indexOf(linkHtml('https://fixture.invalid/a'))!==-1, r3);
  var r4=trailHtml('Source: https://<script>');
  check('R4 an angle bracket ends the token and a url with no host renders as escaped text', r4.indexOf('<a ')===-1&&r4.indexOf('<script>')===-1, r4);

  // --- S: one helper, pinned on the source -----------------------------------
  check('S1 exactly one linkHtml definition in the file', (html.match(/function linkHtml\(/g)||[]).length===1, '');
  check('S2 the event card renders its Verify url through linkHtml', extractFn(html,'renderEventCard').indexOf('linkHtml(e.url)')!==-1, '');
  check('S3 the comm card renders its trail through trailHtml', extractFn(html,'renderComms').indexOf('trailHtml(k.trail)')!==-1, '');
  var th=extractFn(html,'trailHtml'),tt=extractFn(html,'linkedTextHtml');
  check('S4 trailHtml and linkedTextHtml write no anchor of their own; the link is linkHtml or nothing', th.indexOf('<a ')===-1&&tt.indexOf('<a ')===-1&&tt.indexOf('linkHtml(')!==-1&&th.indexOf('linkedTextHtml(head)')!==-1&&th.indexOf('linkedTextHtml(rest)')!==-1, '');
  check('S5 the MORE control is still the element right before the folded remainder (the toggle reads nextElementSibling)', th.indexOf('</button><div class="trail-rest hidden">')!==-1, '');

  out('\n'+checks+' checks, '+failures+' failure(s)');
  if(failures){if(isNode)process.exit(1);throw new Error(failures+' failure(s)');}
})();
