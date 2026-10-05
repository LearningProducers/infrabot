// pane_prompt_check.js: the council pane stops grading the signature and
// keeps the link closer (infrabot v0.5.5); since v0.10.1 it also pins THE
// READINESS ANSWER and the closer written as settled law; since v0.15.2 the
// readiness answer is a verdict (YES or NO alone on line one, decided by the
// doctrine, no deferral to any other judge) and a claim about the target is
// "unverifiable from here", never "fabricated".
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
  expect('the email shape ends on the link directive with nothing after it',has('the link directive as its own paragraph, nothing after it. No sign-off, no signature (appended at send)'),true);
  expect('the default closer is the link directive',has('1. **The link directive.**'),true);
  expect('a cold send never has the link removed',has('never tell the founder to remove that link'),true);
  expect('the forbidden-CTA fix ends on the link directive',has('delete the CTA line, end on the link directive'),true);
  expect('the retired "drop the URL" wording is gone',has('drop the URL'),false);
  expect('the retired "drop the asset" shape name is gone from the gate',has('no-CTA-drop-the-asset'),false);
  expect('no signature block is never the weakest line (the readiness answer)',has('No signature block in the draft: the founder\'s Gmail signature is appended at send'),true);
  // v0.10.1 THE READINESS ANSWER, reshaped v0.15.2 THE READINESS VERDICT: the seat
  // is the judge, YES or NO alone on line one, no deferral; the closer stays settled law.
  expect('the ready-to-send gate is gone',has('READY-TO-SEND GATE'),false);
  expect('no line asks for the "Ready. Send it." verdict',has('say **"Ready. Send it."**'),false);
  expect('the readiness answer section exists',has('## THE READINESS ANSWER'),true);
  expect('a readiness question gets a verdict and the seat is the judge',has('A readiness question gets a VERDICT, and you are the judge'),true);
  expect('line one is exactly YES or exactly NO, alone',has('line one of your answer is exactly YES or exactly NO, that one word alone on the line'),true);
  expect('the seat never defers the verdict to another judge',has('You never defer the verdict to any other judge, pass, or gate'),true);
  expect('the retired "never answered with a verdict" rule is gone',has('A readiness question is NEVER answered with a verdict'),false);
  expect('the retired gauntlet closing line is gone',count(/The gauntlet judges readiness\./g),0);
  expect('the word gauntlet is gone from the prompt',has('gauntlet'),false);
  expect('a target claim is never called fabricated',has('You never call such a claim fabricated, invented, misread, or false'),true);
  expect('the words for a target claim are unverifiable from here',has('the words are "unverifiable from here" and nothing stronger'),true);
  expect('the fabrication ban faces the founder side only, never a target claim',has('A claim the draft makes about the TARGET (their page or bio, their work, what they want) is never under it'),true);
  expect('the OVERDUE line agrees with the readiness verdict (line two under it)',has('If OVERDUE, say so on line one (on a readiness question, line two, under the verdict).'),true);
  expect('a target claim is never counted toward NO',has('never count it toward NO or warn that it might be wrong'),true);
  expect('a directive line with the link under it is the ruled closer, never the bare-directive shape',has('A directive line with the link on the line below it is shape #1, never this one'),true);
  // v0.16.0 THE SOURCES: addressing, the hook's sources, the email shape.
  expect('the nameless salutation is Hi, alone, Hello, gone from the prompt',has('"Hello,"'),false);
  expect('the addressing rule names the generic-inbox, multi-location case',has('the draft opens with "Hi," alone and names no person'),true);
  expect('a single location or a personal address is addressed by name',has('When the company is one location, or the Target is a person\'s own address, the salutation names that person'),true);
  expect('a nameless opener is never a missing salutation, a NO only at a personal address or a single location',has('A nameless opener is never a missing salutation, and it is a NO only when the Target is a person\'s own address or the record shows one location'),true);
  expect('a hook claim with no source row is a NO',has('A hook claim with no row is a NO on its own, named as the missing row'),true);
  // v0.19.0 THE CLAIM SOURCES: a body sentence about the target needs a row.
  expect('a body sentence about the target with no row is a NO, quoted',has('with no row behind it is a NO on its own: quote the sentence and say it carries no source row'),true);
  expect('an inference from the sector is a claim',has('An inference from what companies like theirs usually do is such a claim'),true);
  expect('a row with no page or no place on the page is a NO',has('A row with no page, or no place on the page, is a NO, named'),true);
  expect('the NO is for the missing row, never for falsity',has('never that it is false, which you cannot know, only that no row carries it'),true);
  expect('a sentence about the product or the founder needs no row',has('A sentence about Combat Writing or the founder needs no row'),true);
  expect('a rewrite cuts an unsourced claim rather than keeping it',has('state nothing about the target that no row carries; cut the sentence rather than keep the claim'),true);
  expect('the old hook-only sentence is gone',has("the body's own claims about the target stay unverifiable from here, as above"),false);
  expect('the email shape is spelled line by line',has('the salutation line (the name with a comma, or "Hi," alone under Addressing), one blank line, the body of 3 sentences, one blank line, the link directive as its own paragraph, nothing after it'),true);
  expect('no sign-off, and a missing sign-off is never a flag',has('No sign-off, no signature (appended at send), no phone, no tagline, no second CTA; a missing sign-off is never a flag.'),true);
  expect('the fabrication ban binds what the seat writes, not what the founder verified',has('The FABRICATION BAN above binds what YOU write, never what he verified'),true);
  expect('the closer is settled law, never re-decided',has('SETTLED LAW, never re-decided'),true);
  expect('a directive line plus the link is the closer, not solicitation',has('It is not solicitation, not an ask, not a floating link'),true);
  expect('the seat never re-rules the closer',has('You never propose removing, softening, or re-ruling the closer'),true);
  expect('the closer is never a reason for NO',has('a directive-plus-link closer is never named and never re-opened'),true);
  expect('polish never turns a YES into a NO',has('polish never turns a YES into a NO'),true);
  expect('same body, same answer',has('**Same body, same answer.**'),true);
  expect('same body, same verdict',has('the verdict is the same and the lines named are the same lines'),true);
  expect('question handling routes readiness to the verdict, never a deferral',has('THE READINESS ANSWER: YES or NO alone on line one, then the reasons in plain words against this doctrine. Never a deferral to another judge.'),true);
  expect('critique format admits the bare verdict on line one',has('on a readiness question that line is the bare YES or NO of THE READINESS ANSWER'),true);

  if(failures.length){
    out('pane_prompt_check: FAIL ('+failures.length+' failure(s))');
    if(isNode)process.exit(1);
    throw new Error('pane_prompt_check FAILED: '+failures.join('; '));
  }
  out('pane_prompt_check: PASS ('+htmlPath+')');
})();
