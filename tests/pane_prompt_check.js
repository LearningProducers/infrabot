// pane_prompt_check.js: the council pane stops grading the signature and
// keeps the link closer (infrabot v0.5.5).
//
// Reads the REAL COUNCIL_SYSTEM_BASE out of infrabot.html (the template
// literal between its backticks; never a copy) and pins what the prompt
// must and must not say: the signature is appended at send and is never a
// failure or a flag; no line requires, formats, or grades a signature; the
// default closer is the Combat Writing link as its own paragraph and a cold
// send never has it removed; the retired "drop the URL" wording is gone.
// It also PRINTS the prompt's size in chars and in the app's own estimator
// (chars / 4, the figure callGroq budgets against), so the cost of a prompt
// change is measured by this check and restated nowhere.
//
// Run from the repo root:   node tests/pane_prompt_check.js
//                     or:   jsc  tests/pane_prompt_check.js
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

  var open='const COUNCIL_SYSTEM_BASE=`';
  var s=html.indexOf(open);
  if(s<0)throw new Error('extract: COUNCIL_SYSTEM_BASE not found in '+htmlPath);
  s+=open.length;
  var e=html.indexOf('`;',s);
  var prompt=html.slice(s,e);
  out('COUNCIL_SYSTEM_BASE: '+prompt.length+' chars, ~'+Math.ceil(prompt.length/4)+' tokens by the app estimator (chars/4)');

  var failures=[];
  function expect(label,got,want){
    var ok=got===want;
    out((ok?'PASS ':'FAIL ')+label+': got '+JSON.stringify(got)+', want '+JSON.stringify(want));
    if(!ok)failures.push(label);
  }
  function has(str){return prompt.indexOf(str)>=0;}
  function count(re){var m=prompt.match(re);return m?m.length:0;}

  expect('the signature is appended at send, said in the gate',has('the founder\'s Gmail signature is appended at send'),true);
  expect('a missing sign-off is never a failure and never a flag',has('a missing sign-off is never a failure and never a flag'),true);
  expect('a rewrite stops after the closer, no signature (order dominance)',has('greeting through the closer; no signature, it is appended at send'),true);
  expect('the rewrite example carries no signature',has('greeting through the closer, body only, no signature'),true);
  expect('feedback rewrites carry no signature',has('produce the rewrite body, no signature, stop'),true);
  expect('no line formats a signature',has('Signature exactly'),false);
  expect('no line grades a signature',has('Signature correct'),false);
  expect('the DRAFT posture no longer lists the signature',has('CTA, signature, register'),false);
  expect('no line ends the email on the signature',count(/end on the signature/g),0);
  expect('no line stops after the signature',has('stop after the signature'),false);
  expect('the email shape ends on the link directive',has('the link directive as its own paragraph. No signature (appended at send)'),true);
  expect('the default closer is the link directive',has('1. **The link directive.**'),true);
  expect('a cold send never has the link removed',has('never tell the founder to remove that link'),true);
  expect('the forbidden-CTA fix ends on the link directive',has('delete the CTA line, end on the link directive'),true);
  expect('the retired "drop the URL" wording is gone',has('drop the URL'),false);
  expect('the retired "drop the asset" shape name is gone from the gate',has('no-CTA-drop-the-asset'),false);
  expect('no signature block is the flaw named in gate item 4',has('4. **Clean mechanics.** No em dash. No signature block in the draft'),true);

  if(failures.length){
    out('pane_prompt_check: FAIL ('+failures.length+' failure(s))');
    if(isNode)process.exit(1);
    throw new Error('pane_prompt_check FAILED: '+failures.join('; '));
  }
  out('pane_prompt_check: PASS ('+htmlPath+')');
})();
