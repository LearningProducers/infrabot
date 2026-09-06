// groq_reason_check.js: a Groq 429 shows Groq's own reason (infrabot v0.5.4).
//
// Runs the REAL groqRetryAfterSec and groqRateLimitReason extracted from
// infrabot.html by a brace walk (never a re-implementation) against
// synthetic 429 bodies shaped like Groq's (an invented organization id, an
// invented cap). No key, no network, no names: the repo is public.
//
// What it pins: the pane text carries Groq's message verbatim with only the
// organization id masked; the wait is read from the retry-after header first
// and from the message's "try again in" clause otherwise, in s, ms and m;
// no wait reads null; the text says what the page did about the wait and
// that the window is per Groq organization; and callGroq's 429 branch rides
// groqRateLimitReason with the retired guess gone from the thrown string.
//
// Run from the repo root:   node tests/groq_reason_check.js
//                     or:   jsc  tests/groq_reason_check.js
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
  var g=(typeof globalThis!=='undefined')?globalThis:this;
  var ge=eval;
  ['groqRetryAfterSec','groqRateLimitReason'].forEach(function(n){ge(extractFn(html,n));});

  var failures=[];
  function expect(label,got,want){
    var ok=got===want;
    out((ok?'PASS ':'FAIL ')+label+': got '+JSON.stringify(got)+', want '+JSON.stringify(want));
    if(!ok)failures.push(label);
  }
  function headers(map){return {headers:{get:function(k){return Object.prototype.hasOwnProperty.call(map,k)?map[k]:null;}}};}

  // Synthetic Groq-shaped 429 body: invented org id, invented figures.
  var msg='Rate limit reached for model `fixture-model` in organization `org_fixture0000abc` service tier `on_demand` on tokens per minute (TPM): Limit 6000, Used 5400, Requested 900. Please try again in 3.5s. Need more tokens? Upgrade.';
  var body=JSON.stringify({error:{message:msg,type:'tokens',code:'rate_limit_exceeded'}});

  // The wait.
  expect('wait from the retry-after header first',g.groqRetryAfterSec(headers({'retry-after':'12'}),body),12);
  expect('wait from the message when no header (a browser page reads none)',g.groqRetryAfterSec(headers({}),body),3.5);
  expect('wait in ms',g.groqRetryAfterSec(headers({}),'{"error":{"message":"Please try again in 850ms."}}'),0.85);
  expect('wait in minutes',g.groqRetryAfterSec(headers({}),'{"error":{"message":"Please try again in 2m."}}'),120);
  expect('no wait anywhere reads null',g.groqRetryAfterSec(headers({}),'{"error":{"message":"Rate limit reached."}}'),null);
  expect('empty body reads null',g.groqRetryAfterSec(headers({}),''),null);

  // The reason text.
  var r=g.groqRateLimitReason(body,4);
  expect('Groq\'s message rides verbatim (the limit clause)',r.indexOf('on tokens per minute (TPM): Limit 6000, Used 5400, Requested 900. Please try again in 3.5s.')>=0,true);
  expect('the org id is masked',r.indexOf('org_fixture0000abc')<0&&r.indexOf('org_[masked]')>=0,true);
  expect('the type rides',r.indexOf('[type: tokens]')>=0,true);
  expect('the wait taken is stated',r.indexOf('Waited 4s as Groq asked and re-fired once; still limited.')>=0,true);
  expect('the shared-organization sentence rides',r.indexOf('per organization, not per key')>=0,true);
  var r0=g.groqRateLimitReason(body,null);
  expect('no wait taken is stated as such',r0.indexOf('nothing was retried')>=0,true);
  var rraw=g.groqRateLimitReason('not json at all',null);
  expect('a non-JSON body rides as text',rraw.indexOf('"not json at all"')>=0,true);
  var rempty=g.groqRateLimitReason('',null);
  expect('an empty body says so',rempty.indexOf('(no message in the body)')>=0,true);
  expect('the retired guess is gone from the reason',r.indexOf('rapid re-fires')<0&&r.indexOf('Wait ~60s')<0,true);

  // The fire path rides the helpers.
  var cg=extractFn(html,'callGroq');
  expect('callGroq honors the wait through groqRetryAfterSec',cg.indexOf('groqRetryAfterSec(')>=0,true);
  expect('callGroq\'s 429 branch throws groqRateLimitReason',cg.indexOf('throw new Error(groqRateLimitReason(')>=0,true);
  expect('the retired guess is gone from every thrown string',cg.indexOf("throw new Error('Groq rate limit (429)")<0,true);

  if(failures.length){
    out('groq_reason_check: FAIL ('+failures.length+' failure(s))');
    if(isNode)process.exit(1);
    throw new Error('groq_reason_check FAILED: '+failures.join('; '));
  }
  out('groq_reason_check: PASS ('+htmlPath+')');
})();
