// state_merge_check.js: the state-file merge keeps the newer record, per
// record, never the whole file (infrabot v0.7.0).
//
// Runs the REAL recordTouch and mergeRecordSlice extracted from
// infrabot.html (never a re-implementation) against SYNTHETIC records:
// invented ids, invented titles, synthetic timestamps. The real state file,
// exports and dossier never enter this file: the repo is public.
//
// What it pins. THE OUTAGE: a comm, an event and an artifact edited in the
// browser while the server was down (the local copy stamped later than the
// file's) come out of the merge byte-identical to the local edits, and the
// merge reports a sync owed. THE FLIP: a card the external close flipped in
// the file (a later statusHistory entry and updatedAt) comes out as the
// file's copy. THE TIE: identical stamps go to the file, nothing owed. A
// tab-only record rides along (owed); a file-only record lands; the record
// open under edit keeps the tab's copy even when older; records with no
// stamp at all go to the file; the file's computed `section` never lands;
// the file's order holds with tab-only records appended; a statusHistory
// entry later than updatedAt counts as the touch; a malformed stamp reads 0.
// Under the v0.6.0 rule (the file wins every record not under edit) the
// outage case loses all three edits, which is the defect this check keeps
// dead (measured live 2026-09-17 in a real browser before the rule moved).
//
// --merge LOCAL.json FILE.json: prints the merged comms, network, events
// and artifacts as JSON (the harness seam tests/detach_check.py drives for
// its outage round trip through the real server); no checks run.
//
// Run from the repo root:   node tests/state_merge_check.js
//                     or:   jsc  tests/state_merge_check.js
// Optional first argument: a path to a different infrabot.html to measure.
// Exit 0 on pass; exit 1 (node) or an uncaught error (jsc) on any failure.

var IS_NODE=typeof process!=='undefined'&&process.versions&&process.versions.node;
var SCRIPT_ARGS=IS_NODE?process.argv.slice(2):(typeof arguments!=='undefined'?Array.prototype.slice.call(arguments):[]);
(function(){
  var isNode=IS_NODE;
  var args=SCRIPT_ARGS.slice();
  var mergeAt=args.indexOf('--merge');
  var mergeFiles=mergeAt>=0?args.splice(mergeAt,3).slice(1):null;
  var readText=isNode?function(p){return require('fs').readFileSync(p,'utf8');}:readFile;
  var htmlPath=args[0]||(isNode?require('path').join(__dirname,'..','infrabot.html'):'infrabot.html');
  var out=isNode?function(s){console.log(s);}:print;
  var html=readText(htmlPath);

  // Extract a top-level function by name with a brace walk. Neither
  // function carries an unbalanced brace inside a string or regex, so the
  // walk is exact; a miss throws rather than guessing.
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
  var fns=new Function(extractFn(html,'recordTouch')+'\n'+extractFn(html,'mergeRecordSlice')+'\nreturn {recordTouch:recordTouch,mergeRecordSlice:mergeRecordSlice};')();
  var recordTouch=fns.recordTouch,mergeRecordSlice=fns.mergeRecordSlice;

  if(mergeFiles){
    var local=JSON.parse(readText(mergeFiles[0])),file=JSON.parse(readText(mergeFiles[1]));
    var merged={};
    ['comms','network','events','artifacts'].forEach(function(k){
      merged[k]=mergeRecordSlice(local[k]||[],file[k]||[],null).records;
    });
    out(JSON.stringify(merged));
    return;
  }

  // ---- THE FIXTURE ------------------------------------------------------
  var T=function(h,m){return '2026-04-01T'+(h<10?'0':'')+h+':'+(m<10?'0':'')+m+':00.000Z';};
  var mk=function(o){return JSON.parse(JSON.stringify(o));};
  var stampKey={comms:'updatedAt',network:'updatedAt',events:'updatedAt',artifacts:'updated'};
  var failures=[];
  function check(name,ok,detail){
    out((ok?'PASS ':'FAIL ')+name+(ok?'':'  '+(detail||'')));
    if(!ok)failures.push(name);
  }
  var same=function(a,b){return JSON.stringify(a)===JSON.stringify(b);};

  // THE OUTAGE: three records edited locally after the file's copy.
  var fileComm={id:'c1',title:'Fixture comm',body:'body before',status:'draft',createdAt:T(9,0),updatedAt:T(9,0),statusHistory:[{status:'draft',timestamp:T(9,0)}],section:'drafts'};
  var localComm=mk(fileComm);delete localComm.section;localComm.body='body EDITED DURING THE OUTAGE';localComm.updatedAt=T(10,30);
  var fileEvent={id:'e1',title:'Fixture event',whyThisRoom:'why before',status:'candidate',createdAt:T(9,0),updatedAt:T(9,0),statusHistory:[{status:'candidate',timestamp:T(9,0)}]};
  var localEvent=mk(fileEvent);localEvent.whyThisRoom='why EDITED DURING THE OUTAGE';localEvent.updatedAt=T(10,31);
  var fileArt={id:'a1',title:'Fixture artifact',whyItEarned:'earned before',status:'planned',created:T(9,0),updated:T(9,0),statusHistory:[{status:'planned',timestamp:T(9,0)}]};
  var localArt=mk(fileArt);localArt.whyItEarned='earned EDITED DURING THE OUTAGE';localArt.updated=T(10,32);
  var r=mergeRecordSlice([localComm],[fileComm],null);
  check('outage: the comm edited while down survives byte-identical',same(r.records[0],localComm),JSON.stringify(r.records[0]));
  check('outage: the comm merge reports a sync owed',r.localWon===true);
  r=mergeRecordSlice([localEvent],[fileEvent],null);
  check('outage: the event edited while down survives byte-identical',same(r.records[0],localEvent));
  r=mergeRecordSlice([localArt],[fileArt],null);
  check('outage: the artifact edited while down survives byte-identical (the artifact stamp is `updated`)',same(r.records[0],localArt));

  // THE FLIP: the file's copy is newer (the external close's shape: a sent
  // entry appended and updatedAt stamped at the write).
  var localCard={id:'c2',title:'Fixture card',status:'draft',createdAt:T(8,0),updatedAt:T(8,0),statusHistory:[{status:'draft',timestamp:T(8,0)}]};
  var fileCard=mk(localCard);fileCard.status='sent';fileCard.sentDate='2026-04-01';fileCard.updatedAt=T(11,0);fileCard.statusHistory.push({status:'sent',timestamp:T(11,0)});fileCard.section='pipeline';
  r=mergeRecordSlice([localCard],[fileCard],null);
  var expectFile=mk(fileCard);delete expectFile.section;
  check('flip: the file\'s newer copy wins',same(r.records[0],expectFile));
  check('flip: nothing owed',r.localWon===false);
  check('flip: the file\'s computed section never lands',!('section' in r.records[0]));

  // THE TIE: identical stamps, the file wins (identical copies anyway).
  var tieL={id:'c3',title:'Tie',status:'draft',createdAt:T(7,0),updatedAt:T(7,0),statusHistory:[{status:'draft',timestamp:T(7,0)}]};
  var tieF=mk(tieL);tieF.title='Tie (file spelling)';
  r=mergeRecordSlice([tieL],[tieF],null);
  check('tie: equal stamps go to the file',r.records[0].title==='Tie (file spelling)');
  check('tie: nothing owed',r.localWon===false);

  // TAB-ONLY and FILE-ONLY records, and the order.
  var onlyLocal={id:'c4',title:'Made during the outage',status:'draft',createdAt:T(10,40),updatedAt:T(10,40),statusHistory:[]};
  var onlyFile={id:'c5',title:'Landed by the close',status:'sent',createdAt:T(6,0),updatedAt:T(6,0),statusHistory:[]};
  r=mergeRecordSlice([onlyLocal,localComm],[onlyFile,fileComm],null);
  check('tab-only record rides along, appended after the file\'s order',r.records.map(function(x){return x.id;}).join(',')==='c5,c1,c4');
  check('tab-only record: a sync is owed',r.localWon===true);
  check('file-only record lands',same(r.records[0],onlyFile));

  // UNDER EDIT: the tab's copy stays even when the file's is newer.
  r=mergeRecordSlice([localCard],[fileCard],'c2');
  check('under edit: the tab\'s live copy stays even when the file\'s is newer',same(r.records[0],localCard));
  check('under edit: not counted as a local win',r.localWon===false);

  // NO STAMPS: neither side asserts an instant; the file wins.
  r=mergeRecordSlice([{id:'n1',title:'local'}],[{id:'n1',title:'file'}],null);
  check('no stamps on either side: the file wins',r.records[0].title==='file'&&r.localWon===false);

  // recordTouch itself.
  check('recordTouch: a statusHistory entry later than updatedAt is the touch',recordTouch({updatedAt:T(9,0),statusHistory:[{status:'sent',timestamp:T(12,0)}]})===Date.parse(T(12,0)));
  check('recordTouch: the artifact `updated` stamp counts',recordTouch({updated:T(9,5)})===Date.parse(T(9,5)));
  check('recordTouch: a malformed stamp reads 0',recordTouch({updatedAt:'not a date',statusHistory:[{timestamp:'nope'}]})===0);
  check('recordTouch: no stamps read 0',recordTouch({id:'x'})===0);

  out('\nstate_merge_check: '+(failures.length?failures.length+' failure(s)':'PASS')+' ('+htmlPath+')');
  if(failures.length){if(isNode)process.exitCode=1;else throw new Error('state_merge_check: '+failures.length+' failure(s)');}
})();
