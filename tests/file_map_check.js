// file_map_check.js: the FILE MAP banner's line ranges are computed from the
// file, never hand-kept (infrabot v0.6.0).
//
// The banner at the top of infrabot.html carries a table of contents: rows of
// the form `L  start– end  LABEL`, grouped under HEAD, CSS, HTML BODY and JS.
// Those numbers were maintained by hand and drifted on every ship (the SHELL
// row said 159 while the rule sat at 314). This check resolves every row's
// ANCHOR in the file by name and computes the range from it:
//
//   HEAD  the row runs from line 1 to the line before <style>.
//   CSS   the label's leading name is a column-0 comment `/* NAME` inside
//         <style>...</style>, or a bare selector at column 0 (":root").
//   HTML  the label's leading name is an element id (`id="name"`, the name
//         lowercased), an element class (`class="name"`), or a column-0
//         comment `<!-- NAME` inside the body, before <script>.
//   JS    the label's leading name is a top-level `function NAME(`, a
//         `const|let|var NAME`, or a `// ====== NAME` banner inside
//         <script>...</script>.
//
// A row's range starts at its anchor and ends the line before the next row's
// anchor in the same section (the last row ends at the section's end). Rows
// must anchor in ascending order. The check FAILS on any row whose printed
// range differs from the computed one, on any row whose anchor cannot be
// found, and on rows out of order; it prints the row and the two ranges.
// `--write` rewrites the numbers in place (labels and box width untouched)
// and then re-verifies. The label's leading name is the part before the
// first " — ", ": ", " (", ",", " +" or " ·"; a leading "*** " or "vN.N " is
// ignored.
//
// Run from the repo root:   node tests/file_map_check.js [--write] [path]
//                     or:   jsc  tests/file_map_check.js
// Exit 0 on pass (or after a --write); exit 1 (node) or an uncaught error
// (jsc) on any failure.

var IS_NODE=typeof process!=='undefined'&&process.versions&&process.versions.node;
var SCRIPT_ARGS=IS_NODE?process.argv.slice(2):(typeof arguments!=='undefined'?Array.prototype.slice.call(arguments):[]);
(function(){
  var isNode=IS_NODE;
  var args=SCRIPT_ARGS.filter(function(a){return a!=='--write';});
  var write=SCRIPT_ARGS.indexOf('--write')>=0;
  var readText=isNode?function(p){return require('fs').readFileSync(p,'utf8');}:readFile;
  var htmlPath=args[0]||(isNode?require('path').join(__dirname,'..','infrabot.html'):'infrabot.html');
  var out=isNode?function(s){console.log(s);}:print;
  var html=readText(htmlPath);
  var lines=html.split('\n');
  var WIDTH=80;

  function lineOf(pred,from,to){for(var i=from;i<=to;i++){if(pred(lines[i-1]))return i;}return 0;}
  var bannerEnd=lineOf(function(l){return l==='-->';},1,lines.length);
  var styleOpen=lineOf(function(l){return l==='<style>';},1,lines.length);
  var styleClose=lineOf(function(l){return l==='</style>';},styleOpen,lines.length);
  var bodyOpen=lineOf(function(l){return l.indexOf('<body')===0;},styleClose,lines.length);
  var scriptOpen=lineOf(function(l){return l==='<script>';},bodyOpen,lines.length);
  var scriptClose=lineOf(function(l){return l==='</script>';},scriptOpen,lines.length);
  if(!(bannerEnd&&styleOpen&&styleClose&&bodyOpen&&scriptOpen&&scriptClose))throw new Error('file_map_check: structural markers not found ('+[bannerEnd,styleOpen,styleClose,bodyOpen,scriptOpen,scriptClose].join(',')+')');

  var SECTIONS={
    HEAD:{from:1,to:styleOpen-1},
    CSS:{from:styleOpen+1,to:styleClose-1},
    HTML:{from:bodyOpen,to:scriptOpen-1},
    JS:{from:scriptOpen+1,to:scriptClose-1}
  };
  var ROW=/^║  L\s+(\d+)[–-]\s*(\d+)\s+(.*?)\s*║$/;
  var HEADER=/^║\s+── (HEAD|CSS|HTML BODY|JS) ─/;

  function keyOf(label){
    var k=label.replace(/^\*\*\*\s*/,'').replace(/^v\d+(\.\d+)*\s+/,'');
    k=k.split(' — ')[0].split(': ')[0].split(' (')[0].split(',')[0].split(' +')[0].split(' ·')[0];
    return k.replace(/\s*\*\*\*\s*$/,'').trim();
  }
  function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function findIn(sec,pred){var r=SECTIONS[sec];return lineOf(pred,r.from,r.to);}
  function anchor(sec,label){
    var key=keyOf(label);
    if(sec==='HEAD')return 1;
    if(sec==='CSS'){
      var re=new RegExp('^/\\* '+esc(key)+'(\\s|\\*|:|$)');
      var c=findIn('CSS',function(l){return re.test(l);});
      if(c)return c;
      // a bare selector at column 0 (":root", ".card", "#app") names a rule block
      if(/^[:.#]/.test(key)){var selRe=new RegExp('^'+esc(key)+'(\\s|\\{|,|$)');return findIn('CSS',function(l){return selRe.test(l);});}
      return 0;
    }
    if(sec==='HTML'){
      var id=key.toLowerCase().replace(/\s+/g,'-');
      var idRe=new RegExp('id="'+esc(id)+'"');
      var n=findIn('HTML',function(l){return idRe.test(l);});
      if(n)return n;
      var clsRe=new RegExp('^\\s*<\\w+ class="'+esc(id)+'"');
      n=findIn('HTML',function(l){return clsRe.test(l);});
      if(n)return n;
      var cRe=new RegExp('^\\s*<!-- '+esc(key)+'(\\s|:|$)');
      return findIn('HTML',function(l){return cRe.test(l);});
    }
    var first=key.split(/\s+/)[0];
    var fnRe=new RegExp('^(async\\s+)?function\\s+'+esc(first)+'\\s*\\(');
    var n2=findIn('JS',function(l){return fnRe.test(l);});
    if(n2)return n2;
    var declRe=new RegExp('^(const|let|var)\\s+'+esc(first)+'\\b');
    n2=findIn('JS',function(l){return declRe.test(l);});
    if(n2)return n2;
    var banRe=new RegExp('^// =+\\s*'+esc(key)+'(\\s|=|$)');
    n2=findIn('JS',function(l){return banRe.test(l);});
    if(n2)return n2;
    var cmRe=new RegExp('^// '+esc(key)+'(\\s|:|$)');
    return findIn('JS',function(l){return cmRe.test(l);});
  }

  var rows=[],sec=null;
  for(var i=1;i<=bannerEnd;i++){
    var l=lines[i-1];
    var h=HEADER.exec(l);
    if(h){sec=h[1]==='HTML BODY'?'HTML':h[1];continue;}
    var m=ROW.exec(l);
    if(m&&sec)rows.push({line:i,sec:sec,start:+m[1],end:+m[2],label:m[3]});
  }
  if(!rows.length)throw new Error('file_map_check: no L-range rows found in the banner');

  var failures=[];
  rows.forEach(function(r){r.anchor=anchor(r.sec,r.label);if(!r.anchor)failures.push('UNANCHORED  '+r.sec+'  "'+r.label+'" (key "'+keyOf(r.label)+'")');});
  var bySec={};
  rows.forEach(function(r){(bySec[r.sec]=bySec[r.sec]||[]).push(r);});
  Object.keys(bySec).forEach(function(s){
    var list=bySec[s];
    for(var j=0;j<list.length;j++){
      var r=list[j];if(!r.anchor)continue;
      var next=null;for(var k=j+1;k<list.length;k++){if(list[k].anchor){next=list[k];break;}}
      if(next&&next.anchor<=r.anchor)failures.push('OUT OF ORDER  '+s+'  "'+r.label+'" ('+r.anchor+') is not above "'+next.label+'" ('+next.anchor+')');
      r.cStart=r.anchor;r.cEnd=next?next.anchor-1:SECTIONS[s].to;
    }
  });
  rows.forEach(function(r){
    if(!r.anchor||r.cStart===undefined)return;
    if(r.start!==r.cStart||r.end!==r.cEnd)failures.push('STALE  '+r.sec+'  "'+r.label+'"  printed '+r.start+'-'+r.end+'  computed '+r.cStart+'-'+r.cEnd);
  });

  function pad(n,w){var s=String(n);while(s.length<w)s=' '+s;return s;}
  function render(r){
    var head='║  L '+pad(r.cStart,5)+'– '+pad(r.cEnd,4)+'  '+r.label;
    while(head.length<WIDTH-1)head+=' ';
    return head+'║';
  }

  if(write){
    var un=failures.filter(function(f){return f.indexOf('UNANCHORED')===0||f.indexOf('OUT OF ORDER')===0;});
    if(un.length){un.forEach(out);out('file_map_check: cannot write with '+un.length+' unresolved row(s)');if(isNode)process.exitCode=1;return;}
    rows.forEach(function(r){lines[r.line-1]=render(r);});
    require('fs').writeFileSync(htmlPath,lines.join('\n'));
    out('file_map_check: wrote '+rows.length+' row(s); re-verify by running without --write');
    return;
  }
  var stale=failures.filter(function(f){return f.indexOf('STALE')===0;}).length;
  out('file_map_check: '+rows.length+' rows, '+(rows.length-failures.length>=0?rows.length-stale:0)+' current, '+stale+' stale, '+(failures.length-stale)+' unresolved');
  failures.forEach(function(f){out('  FAIL '+f);});
  if(failures.length){if(isNode)process.exitCode=1;else throw new Error('file_map_check: '+failures.length+' failure(s)');}
})();
