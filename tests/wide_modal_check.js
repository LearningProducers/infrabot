// wide_modal_check.js: THE WIDE BACKDROP (infrabot v0.23.1). A call card
// expands into the wide edit form: a .modal-bg.wide-bg holding a
// .modal.modal-wide. At v0.23.0 that backdrop was the small modals' 78%
// black, so the page behind showed through around the form and below the
// fold while the backdrop scrolled, and the page kept its own scroll under
// it. From v0.23.1 the wide backdrop is opaque and showModal locks body
// scroll while a wide modal is shown, hideModal restoring it once none is,
// the way the fullscreen viewer already does. Small modals (.modal-bg
// without .wide-bg) keep their translucent backdrop and touch body scroll
// not at all: they are a dialog over a page the person should still see.
//
// Runs the REAL showModal and hideModal extracted from infrabot.html by a
// brace walk (never a re-implementation) against a SYNTHETIC document: a
// few invented elements with a classList, a body with a style, and a
// querySelector that answers only the one question hideModal asks. No
// browser, no fixture data, no real record.
//
// What it pins: the CSS (the .modal-bg.wide-bg rule carries an opaque
// background; the .modal-bg rule keeps its translucent one); the lock (a
// wide modal shown sets body overflow hidden, hidden restores it; a small
// modal leaves it alone both ways; a small modal closed over a wide one
// leaves the lock in place, and the wide one's close lifts it); the source
// (every wide-bg modal in the page, the four forms, opens through showModal
// and closes through hideModal; nothing else adds show to a modal-bg); and
// the four version sites.
//
// Run from the repo root:   node tests/wide_modal_check.js
//                     or:   jsc  tests/wide_modal_check.js
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
  // A column-0 CSS rule by its exact selector: the text between its braces.
  function cssRule(selector){
    var re=new RegExp('^'+selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{([^}]*)\\}','m');
    var m=re.exec(html);
    return m?m[1]:null;
  }

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS':'FAIL')+'  '+name+(ok||detail===undefined?'':'  ['+detail+']'));
    if(!ok)failures++;
  }

  // --- the synthetic document ------------------------------------------------
  function El(id,classes){
    this.id=id;this._c=classes.slice();var self=this;
    this.classList={
      add:function(c){if(self._c.indexOf(c)<0)self._c.push(c);},
      remove:function(c){self._c=self._c.filter(function(x){return x!==c;});},
      contains:function(c){return self._c.indexOf(c)>=0;}
    };
  }
  var els={};
  function el(id,classes){els[id]=new El(id,classes);return els[id];}
  var wideA=el('modal-call',['modal-bg','wide-bg']);
  var wideB=el('modal-event',['modal-bg','wide-bg']);
  var small=el('modal-contact',['modal-bg']);
  var glob=(typeof globalThis!=='undefined')?globalThis:this;
  glob.document={
    body:{style:{overflow:''}},
    getElementById:function(id){return els[id]||null;},
    querySelector:function(sel){
      if(sel!=='.modal-bg.wide-bg.show')throw new Error('unexpected selector '+sel);
      for(var k in els){var e=els[k];if(e.classList.contains('modal-bg')&&e.classList.contains('wide-bg')&&e.classList.contains('show'))return e;}
      return null;
    }
  };
  glob.g=function(id){return glob.document.getElementById(id);};
  var ge=eval;
  ge(extractFn(html,'showModal'));
  ge(extractFn(html,'hideModal'));
  var showModal=glob.showModal,hideModal=glob.hideModal;
  var body=glob.document.body;

  // --- C: the CSS --------------------------------------------------------------
  var wideRule=cssRule('.modal-bg.wide-bg');
  check('C1 a column-0 .modal-bg.wide-bg rule exists',wideRule!==null);
  check('C2 it carries an opaque background (#000 or var(--bg); never rgba, never transparent)',!!wideRule&&/(^|;)background:(#000|#000000|var\(--bg\))(;|$)/.test(wideRule)&&wideRule.indexOf('rgba')<0&&wideRule.indexOf('transparent')<0,wideRule);
  var baseRule=cssRule('.modal-bg');
  check('C3 the small backdrop keeps its translucent 78% black',!!baseRule&&baseRule.indexOf('background:rgba(0,0,0,.78)')>=0,baseRule);
  check('C4 the wide rule sits after the base rule, so it wins at equal and higher specificity',html.indexOf('\n.modal-bg{')<html.indexOf('\n.modal-bg.wide-bg{'));
  check('C5 the wide rule is not inside the min-width media query: opaque at every width',(function(){var i=html.indexOf('\n.modal-bg.wide-bg{');var before=html.slice(0,i);var open=before.lastIndexOf('@media');if(open<0)return true;var closeDepth=0,j=before.indexOf('{',open);for(var k=j;k<before.length;k++){if(before[k]==='{')closeDepth++;else if(before[k]==='}'){closeDepth--;if(closeDepth===0)return true;}}return false;})());

  // --- L: the lock -------------------------------------------------------------
  body.style.overflow='';
  showModal('modal-call');
  check('L1 a wide modal shown adds show',wideA.classList.contains('show'));
  check('L2 and locks body scroll',body.style.overflow==='hidden',body.style.overflow);
  hideModal('modal-call');
  check('L3 hidden, it drops show',!wideA.classList.contains('show'));
  check('L4 and restores body scroll',body.style.overflow==='',JSON.stringify(body.style.overflow));

  showModal('modal-contact');
  check('L5 a small modal shown adds show and leaves body scroll alone',small.classList.contains('show')&&body.style.overflow==='',body.style.overflow);
  hideModal('modal-contact');
  check('L6 a small modal hidden drops show and leaves body scroll alone',!small.classList.contains('show')&&body.style.overflow==='',body.style.overflow);

  showModal('modal-call');
  showModal('modal-contact');
  hideModal('modal-contact');
  check('L7 a small modal closed over a wide one leaves the lock in place',body.style.overflow==='hidden'&&wideA.classList.contains('show'),body.style.overflow);
  hideModal('modal-call');
  check('L8 and the wide one closing lifts it',body.style.overflow==='',JSON.stringify(body.style.overflow));

  showModal('modal-call');
  showModal('modal-event');
  hideModal('modal-call');
  check('L9 with two wide modals shown, the first closing keeps the lock for the second',body.style.overflow==='hidden',body.style.overflow);
  hideModal('modal-event');
  check('L10 the last wide modal closing lifts it',body.style.overflow==='',JSON.stringify(body.style.overflow));

  body.style.overflow='';
  hideModal('modal-contact');
  check('L11 hiding an already-hidden small modal never writes body overflow',body.style.overflow==='');
  check('L12 showModal and hideModal name the wide class and body overflow (source)',(function(){var s=extractFn(html,'showModal'),h=extractFn(html,'hideModal');return s.indexOf("classList.contains('wide-bg')")>0&&s.indexOf("document.body.style.overflow='hidden'")>0&&h.indexOf("classList.contains('wide-bg')")>0&&h.indexOf("document.body.style.overflow=''")>0&&h.indexOf("querySelector('.modal-bg.wide-bg.show')")>0;})());

  // --- S: the source -----------------------------------------------------------
  var wideIds=[];var re=/<div class="modal-bg wide-bg" id="([^"]+)">/g,m;
  while((m=re.exec(html)))wideIds.push(m[1]);
  check('S1 the page carries four wide-bg modals: event, call, artifact, comm',wideIds.join(',')==='modal-event,modal-call,modal-artifact,modal-comm',wideIds.join(','));
  check('S2 each opens through showModal and closes through hideModal',wideIds.every(function(id){return html.indexOf("showModal('"+id+"')")>0&&html.indexOf("hideModal('"+id+"')")>0;}));
  check('S3 nothing else adds show to a modal element: the only classList.add(\'show\') calls are showModal, the toast, the overlay, the drawer backdrop and the dirty dot',(function(){var n=(html.match(/classList\.add\('show'\)/g)||[]).length;var named=['function toast(','function showModal(',"g('fs-overlay').classList.add('show')","g('drawer-backdrop').classList.add('show')","if(dot)dot.classList.add('show')"];return n===7&&named.every(function(t){return html.indexOf(t)>0;});})(),String((html.match(/classList\.add\('show'\)/g)||[]).length));
  check('S4 the fullscreen viewer keeps its own lock and release, untouched',extractFn(html,'openFullscreen').indexOf("document.body.style.overflow='hidden'")>0&&extractFn(html,'closeFullscreen').indexOf("document.body.style.overflow=''")>0);

  // --- V: the version ----------------------------------------------------------
  check('V1 the four version sites read v0.23.1',html.indexOf("const APP_VERSION='infrabot-v0.23.1';")>0&&html.indexOf('<span class="version-pill" title="INFRABOT build">v0.23.1</span>')>0&&html.indexOf('INFRABOT v0.23.1 · LPI ·')>0&&/║  v0\.23\.1 \(THE WIDE BACKDROP\)/.test(html));

  out('');
  out('wide_modal_check: '+(failures?'FAIL':'PASS')+' ('+(checks-failures)+'/'+checks+' checks)');
  if(isNode)process.exit(failures?1:0);
  else if(failures)throw new Error('wide_modal_check failed');
})();
