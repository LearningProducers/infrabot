// catalog_resolve_check.js: council slots resolve from Groq's live catalog
// (infrabot v0.8.0).
//
// Runs the REAL catalogFilter, resolveSlots, modelLabel, modelVendor and
// modelBudget extracted from infrabot.html by a brace walk (never a
// re-implementation) against synthetic catalog records shaped like Groq's
// model list (id, active, context_window, max_completion_tokens, created).
// No key, no network: the catalog is a fixture.
//
// What it pins: the eligibility filter keeps chat models and drops speech,
// guard, agent and embedding ids; slot A resolves to its preferred id while
// live and to the newest gpt-oss otherwise; slot B resolves to the newest
// qwen; with no qwen and no other vendor slot B is null and never equals A;
// a slot whose family is gone borrows the newest id from another vendor
// than the other slot; labels derive from the id; budgets key on the vendor.
//
// Run from the repo root:   node tests/catalog_resolve_check.js
//                     or:   jsc  tests/catalog_resolve_check.js
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
  function extractConst(src,name){
    var start=src.indexOf('const '+name+'=');
    if(start<0)throw new Error('extract: const '+name+' not found in '+htmlPath);
    var end=src.indexOf('\n',start);
    if(src[src.indexOf('=',start)+1]==='{'){
      var i=src.indexOf('{',start),depth=0;
      for(;i<src.length;i++){
        var ch=src[i];
        if(ch==='{')depth++;
        else if(ch==='}'){depth--;if(depth===0){end=src.indexOf('\n',i);break;}}
      }
    }
    return src.slice(start,end);
  }
  var ge=eval;
  // A const evaluated indirectly stays inside that eval's scope, so the
  // extracted declarations are rebound onto the global object by name.
  var gl=(typeof globalThis!=='undefined')?globalThis:this;
  ['NO_VOICE_LABEL','VENDOR_BUDGET','CATALOG_EXCLUDE','CATALOG_MIN_CONTEXT','CATALOG_MIN_OUTPUT','SLOT_FAMILIES']
    .forEach(function(n){gl[n]=ge('('+extractConst(html,n).replace('const '+n+'=','').replace(/;\s*$/,'')+')');});
  ['modelLabel','modelVendor','modelBudget','catalogFilter','resolveSlots'].forEach(function(n){ge(extractFn(html,n));});

  var failures=[];
  function check(name,cond,detail){
    out((cond?'PASS ':'FAIL ')+name+(cond?'':'  '+(detail===undefined?'':JSON.stringify(detail))));
    if(!cond)failures.push(name);
  }
  function rec(id,created,ctx,maxout,active){
    return {id:id,active:active===undefined?true:active,context_window:ctx===undefined?131072:ctx,
            max_completion_tokens:maxout===undefined?16384:maxout,created:created};
  }
  // The thirteen-record shape of the live catalog on the day the check was written.
  var FULL=[
    rec('allam-2-7b',1737672203,4096,4096),
    rec('canopylabs/orpheus-arabic-saudi',1765926439,4000,50000),
    rec('canopylabs/orpheus-v1-english',1766186316,4000,50000),
    rec('groq/compound',1756949530),
    rec('groq/compound-mini',1756949707),
    rec('meta-llama/llama-prompt-guard-2-22m',1748632101,512,512),
    rec('meta-llama/llama-prompt-guard-2-86m',1748632165,512,512),
    rec('openai/gpt-oss-120b',1754408224,131072,65536),
    rec('openai/gpt-oss-20b',1754407957,131072,65536),
    rec('openai/gpt-oss-safeguard-20b',1761708789,131072,65536),
    rec('qwen/qwen3.8-27b',1786984846,131042,16384),
    rec('whisper-large-v3',1693721698,448,448),
    rec('whisper-large-v3-turbo',1728413088,448,448)
  ];
  var elig=catalogFilter(FULL).map(function(m){return m.id;});
  check('E1 eligibility keeps exactly the three chat models, newest first',
        elig.join(',')==='qwen/qwen3.8-27b,openai/gpt-oss-120b,openai/gpt-oss-20b',elig);
  check('E2 whisper, guard, compound, orpheus and safeguard are dropped',
        elig.every(function(id){return !/whisper|guard|compound|orpheus|safeguard/.test(id);}),elig);
  check('E3 an inactive record is dropped',
        catalogFilter([rec('qwen/qwen3.8-27b',1,undefined,undefined,false)]).length===0);
  check('E4 a small context window is dropped',
        catalogFilter([rec('vendor/small-chat-7b',1,8192,8192)]).length===0);

  var r=resolveSlots(catalogFilter(FULL));
  check('R1 full catalog: A is the preferred gpt-oss-120b',r.a==='openai/gpt-oss-120b',r);
  check('R2 full catalog: B is the newest qwen',r.b==='qwen/qwen3.8-27b',r);

  var noQwenOnlyOpenai=catalogFilter(FULL.filter(function(m){return !/^qwen\//.test(m.id);}));
  r=resolveSlots(noQwenOnlyOpenai);
  check('R3 no qwen, only openai left: B is null',r.b===null,r);
  check('R4 no qwen, only openai left: A keeps its preferred and B never equals A',r.a==='openai/gpt-oss-120b'&&r.b!==r.a,r);

  var noPreferred=catalogFilter(FULL.filter(function(m){return m.id!=='openai/gpt-oss-120b';}));
  r=resolveSlots(noPreferred);
  check('R5 preferred gone: A is the newest gpt-oss left',r.a==='openai/gpt-oss-20b',r);
  check('R6 preferred gone: B still the newest qwen',r.b==='qwen/qwen3.8-27b',r);

  var newerOss=catalogFilter(FULL.concat([rec('openai/gpt-oss-300b',1790000000)]).filter(function(m){return m.id!=='openai/gpt-oss-120b';}));
  r=resolveSlots(newerOss);
  check('R7 preferred gone, a newer gpt-oss present: A takes the newest by created',r.a==='openai/gpt-oss-300b',r);

  var newerQwen=catalogFilter(FULL.concat([rec('qwen/qwen3.9-32b',1790000001)]));
  r=resolveSlots(newerQwen);
  check('R8 a newer qwen appears: B moves to it',r.b==='qwen/qwen3.9-32b',r);

  var noQwenOtherVendor=catalogFilter(FULL.filter(function(m){return !/^qwen\//.test(m.id);}).concat([rec('mistral/mixtral-8x7b',1790000002)]));
  r=resolveSlots(noQwenOtherVendor);
  check('R9 no qwen, another vendor live: B borrows the newest id from a vendor other than A\'s',r.b==='mistral/mixtral-8x7b'&&modelVendor(r.b)!==modelVendor(r.a),r);

  var noOpenai=catalogFilter(FULL.filter(function(m){return !/^openai\//.test(m.id);}).concat([rec('mistral/mixtral-8x7b',1700000000)]));
  r=resolveSlots(noOpenai);
  check('R10 no openai: A borrows from a vendor other than B\'s, never qwen',r.a==='mistral/mixtral-8x7b'&&r.b==='qwen/qwen3.8-27b',r);

  r=resolveSlots(catalogFilter([rec('qwen/qwen3.8-27b',1786984846)]));
  check('R11 one qwen only: B holds it, A is null, the two never equal',r.b==='qwen/qwen3.8-27b'&&r.a===null,r);

  r=resolveSlots([]);
  check('R12 empty catalog: both null',r.a===null&&r.b===null,r);

  check('L1 qwen label',modelLabel('qwen/qwen3.8-27b')==='QWEN3.8 27B',modelLabel('qwen/qwen3.8-27b'));
  check('L2 gpt-oss label',modelLabel('openai/gpt-oss-120b')==='GPT-OSS 120B',modelLabel('openai/gpt-oss-120b'));
  check('L3 a bare id without a size keeps its spelling, uppercased',modelLabel('vendor/some-model')==='SOME-MODEL',modelLabel('vendor/some-model'));
  check('L4 a null slot reads NO SECOND VOICE',modelLabel(null)===NO_VOICE_LABEL&&modelLabel('')===NO_VOICE_LABEL);

  check('B1 openai budget row',modelBudget('openai/gpt-oss-120b').reasoningEffort==='low'&&modelBudget('openai/gpt-oss-120b').hardCap===8000);
  check('B2 qwen budget row is the measured 8,000 wall with effort none',modelBudget('qwen/qwen3.8-27b').hardCap===8000&&modelBudget('qwen/qwen3.8-27b').tpmCeiling===7700&&modelBudget('qwen/qwen3.8-27b').reasoningEffort==='none');
  check('B3 an unknown vendor gets the conservative default',modelBudget('mistral/mixtral-8x7b').hardCap===6000&&modelBudget('mistral/mixtral-8x7b').reasoningEffort===null);
  check('B4 a null id gets the default row',modelBudget(null).hardCap===6000);

  check('S1 the source carries no hand label map, no id-keyed budget, no boot heal maps',
        html.indexOf('const MODEL_LABELS=')<0&&html.indexOf('const MODEL_BUDGET=')<0
        &&html.indexOf('const PREVIEW_FALLBACK_MAP=')<0&&html.indexOf('const DEAD_MODEL_MAP=')<0
        &&html.indexOf('const RETIRED_MODEL_MAP=')<0);

  out('');
  out(failures.length?('FAIL: '+failures.length+' check(s) failed'):'ALL GREEN: catalog resolve check');
  if(failures.length){if(isNode)process.exit(1);throw new Error('catalog_resolve_check failed');}
})();
