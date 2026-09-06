// fs_size_check.js: the fullscreen text size (EDIT BODY included) persists
// across close and refresh (infrabot v0.5.7).
//
// Runs the REAL fsSizeStored and applyFsSize extracted from infrabot.html
// by a brace walk (never a re-implementation) against a fake localStorage
// and a fake DOM element, and pins: the one new key; a stored valid size is
// restored; an invalid or absent value falls back to LG; a storage that
// throws falls back to LG; applyFsSize writes the chosen size to the key;
// the boot declaration reads through fsSizeStored. No names, no network.
//
// Run from the repo root:   node tests/fs_size_check.js
//                     or:   jsc  tests/fs_size_check.js
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
  ge(extractConstLine(html,'FS_SIZES'));
  ge(extractConstLine(html,'FS_SIZE_LABELS'));
  ge(extractConstLine(html,'FS_SIZE_KEY'));
  ge(extractFn(html,'fsSizeStored'));
  ge(extractFn(html,'applyFsSize'));

  // Fakes: a localStorage map and the two elements applyFsSize touches.
  var store={};
  g.localStorage={getItem:function(k){return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null;},setItem:function(k,v){store[k]=String(v);}};
  var classes=[];
  var body={classList:{remove:function(c){classes=classes.filter(function(x){return x!==c;});},add:function(c){classes.push(c);}}};
  var label={textContent:''};
  g.g=function(id){return id==='fs-body'?body:label;};
  g.fsCurrentSize='lg';

  var failures=[];
  function expect(label,got,want){
    var ok=got===want;
    out((ok?'PASS ':'FAIL ')+label+': got '+JSON.stringify(got)+', want '+JSON.stringify(want));
    if(!ok)failures.push(label);
  }

  expect('one new key, in the app\'s own key family',g.FS_SIZE_KEY,'earthinfra_fs_size_v01');
  expect('nothing stored falls back to LG',g.fsSizeStored(),'lg');
  store[g.FS_SIZE_KEY]='xxl';
  expect('a stored size is restored',g.fsSizeStored(),'xxl');
  store[g.FS_SIZE_KEY]='huge';
  expect('a stored value outside the four sizes falls back to LG',g.fsSizeStored(),'lg');
  delete store[g.FS_SIZE_KEY];
  g.applyFsSize('xl');
  expect('applyFsSize writes the chosen size',store[g.FS_SIZE_KEY],'xl');
  expect('applyFsSize still styles the body',classes.join(','),'size-xl');
  expect('applyFsSize still sets the label',label.textContent,'XL');
  expect('the written size restores on the next read',g.fsSizeStored(),'xl');
  g.localStorage={getItem:function(){throw new Error('storage blocked');},setItem:function(){throw new Error('storage blocked');}};
  expect('a storage that throws falls back to LG',g.fsSizeStored(),'lg');
  var threw=false;try{g.applyFsSize('md');}catch(e){threw=true;}
  expect('a storage that throws never breaks applyFsSize',threw,false);
  expect('the boot declaration reads through fsSizeStored',html.indexOf('let fsCurrentSize=fsSizeStored();')>=0,true);

  if(failures.length){
    out('fs_size_check: FAIL ('+failures.length+' failure(s))');
    if(isNode)process.exit(1);
    throw new Error('fs_size_check FAILED: '+failures.join('; '));
  }
  out('fs_size_check: PASS ('+htmlPath+')');
})();
