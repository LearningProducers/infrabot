// app_link_check.js: the [CW_APP_LINK] token renders as the live Combat
// Writing URL (infrabot v0.5.6).
//
// Runs the REAL expandAppLink extracted from infrabot.html by a brace walk
// (never a re-implementation) against synthetic bodies, and pins that every
// place a card body is shown, copied, edited, spoken, handed to the council
// or its transcript, printed in a month report, or minted from a dossier
// rides it. No names: the repo is public.
//
// Run from the repo root:   node tests/app_link_check.js
//                     or:   jsc  tests/app_link_check.js
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
  function extractConstLine(src,name){
    var start=src.indexOf('const '+name+'=');
    if(start<0)throw new Error('extract: const '+name+' not found in '+htmlPath);
    return 'var '+src.slice(start+6,src.indexOf('\n',start));
  }
  var g=(typeof globalThis!=='undefined')?globalThis:this;
  var ge=eval;
  ge(extractConstLine(html,'CW_APP_URL'));
  ge(extractFn(html,'expandAppLink'));
  var URL='https://combatwriting.learningproducers.com';

  var failures=[];
  function expect(label,got,want){
    var ok=got===want;
    out((ok?'PASS ':'FAIL ')+label+': got '+JSON.stringify(got)+', want '+JSON.stringify(want));
    if(!ok)failures.push(label);
  }

  expect('the URL constant is the live site',g.CW_APP_URL,URL);
  expect('a token ending a prose line lands as its own paragraph',g.expandAppLink('Run one report through it: [CW_APP_LINK]'),'Run one report through it:\n\n'+URL);
  expect('a token on its own line is replaced in place',g.expandAppLink('Try it.\n\n[CW_APP_LINK]'),'Try it.\n\n'+URL);
  expect('text after the token on the same line stays as written',g.expandAppLink('See [CW_APP_LINK] for the tool.'),'See\n\n'+URL+' for the tool.');
  expect('two tokens both expand',g.expandAppLink('[CW_APP_LINK]\n\nAgain: [CW_APP_LINK]'),URL+'\n\nAgain:\n\n'+URL);
  expect('a body without the token is returned as is',g.expandAppLink('Plain body, no token.'),'Plain body, no token.');
  expect('an empty body reads empty',g.expandAppLink(''),'');
  expect('a null body reads empty',g.expandAppLink(null),'');
  expect('the token never survives expansion',g.expandAppLink('a [CW_APP_LINK] b [CW_APP_LINK]').indexOf('[CW_APP_LINK]'),-1);

  // Every body surface rides the helper.
  expect('COPY ALL text rides it',extractFn(html,'commPlainText').indexOf('expandAppLink(')>=0,true);
  expect('the fullscreen view rides it',extractFn(html,'renderFullscreenBodyComm').indexOf('expandAppLink(')>=0,true);
  expect('the card preview rides it',extractFn(html,'renderComms').indexOf('expandAppLink(')>=0,true);
  expect('the editor shows the expanded body',extractFn(html,'openCommModal').indexOf("g('k-body').value=expandAppLink(")>=0,true);
  expect('the council context rides it (both sites)',(html.match(/<begin_body>\n\$\{expandAppLink\(k\.body\)\|\|'\(empty\)'\}/g)||[]).length,2);
  expect('the dossier mint rides it',extractFn(html,'_dGrabBody').indexOf('return expandAppLink(')>=0,true);
  expect('the council transcript rides it',extractFn(html,'councilTranscriptText').indexOf('lines.push(expandAppLink(k.body))')>=0,true);
  expect('the month report rides it',extractFn(html,'downloadMonthReport').indexOf('expandAppLink(c.body).split(')>=0,true);
  expect('LISTEN speaks the expanded body',html.indexOf("ttsSpeak(expandAppLink(k.body),g('fs-tts'))")>=0,true);

  if(failures.length){
    out('app_link_check: FAIL ('+failures.length+' failure(s))');
    if(isNode)process.exit(1);
    throw new Error('app_link_check FAILED: '+failures.join('; '));
  }
  out('app_link_check: PASS ('+htmlPath+')');
})();
