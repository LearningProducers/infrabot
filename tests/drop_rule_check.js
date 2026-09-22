// drop_rule_check.js: THE DROP RULE (infrabot v0.10.0). A record the server
// file no longer carries is dropped from the tab when its id is on the sync
// ledger; a record this tab created since its last sync is not on the ledger
// and rides along.
//
// Runs the REAL recordTouch, mergeRecordSlice, allStateIds, loadSyncedIds and
// saveSyncedIds extracted from infrabot.html by a brace walk (never a
// re-implementation) against SYNTHETIC records and a fake localStorage:
// invented ids, invented titles, synthetic stamps. The real state file never
// enters this file: the repo is public.
//
// THE LINE, proven both ways at the merge: a local record absent from the
// file whose id IS on the ledger is dropped and no sync is owed for it; a
// local record absent from the file whose id is NOT on the ledger rides
// along and a sync is owed. Also pinned: no ledger at all (the v0.7.0 shape,
// every caller that passes none) keeps every tab-only record; the record
// open under edit survives even when the file let it go; records the file
// carries merge exactly as before (newer wins, tie to the file, section never
// lands); the rule is slice-agnostic (an event and an artifact drop the same
// way); the ledger round-trips through localStorage as ids only and reads
// null when absent or unreadable; the source seeds the ledger from every id
// a tab holds when none is stored, rewrites it from the file's ids after a
// merge and from the tab's ids after an accepted POST, clears it on wipe,
// and re-arms the boot export after the first merge.
//
// Run from the repo root:   node tests/drop_rule_check.js
//                     or:   jsc  tests/drop_rule_check.js
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
    var end=src.indexOf(';',start);
    return 'var '+src.slice(start+6,end+1);
  }

  // A fake localStorage and the globals the helpers read.
  var store={};
  var fakeLS={getItem:function(k){return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null;},
              setItem:function(k,v){store[k]=String(v);},removeItem:function(k){delete store[k];}};
  var g=(typeof globalThis!=='undefined')?globalThis:this;
  g.localStorage=fakeLS;
  g.state={comms:[],network:[],events:[],artifacts:[]};
  g.eventsList=function(){return g.state.events;};
  g.artifactsList=function(){return g.state.artifacts;};
  g._syncedIds=null;
  var ge=eval;
  ge(extractConstLine(html,'SYNCED_IDS_KEY'));
  ['recordTouch','mergeRecordSlice','allStateIds','loadSyncedIds','saveSyncedIds'].forEach(function(n){ge(extractFn(html,n));});

  var failures=0,checks=0;
  function check(name,ok,detail){
    checks++;
    out((ok?'PASS  ':'FAIL  ')+name+(ok?'':'  ['+String(detail||'').slice(0,220)+']'));
    if(!ok)failures++;
  }
  function rec(id,title,stamp){return {id:id,title:title,status:'draft',updatedAt:stamp,createdAt:stamp,history:[],statusHistory:[{status:'draft',timestamp:stamp}]};}
  var T1='2026-01-01T00:00:00.000Z',T2='2026-01-02T00:00:00.000Z';

  // --- D: the line at the merge, both ways ------------------------------
  var fileRecs=[rec('id_fx_keep','Kept Co',T1)];
  var local=[rec('id_fx_keep','Kept Co',T1),rec('id_fx_gone','Gone Co',T1),rec('id_fx_new','New Co',T2)];
  var ledger={id_fx_keep:true,id_fx_gone:true};
  var r=mergeRecordSlice(local,fileRecs,null,ledger);
  var ids=r.records.map(function(x){return x.id;});
  check('D1 a record the file no longer carries, on the ledger, is DROPPED', ids.indexOf('id_fx_gone')===-1, ids.join(','));
  check('D1 the drop is reported by id', JSON.stringify(r.dropped)==='["id_fx_gone"]', JSON.stringify(r.dropped));
  check('D2 a record created since the last sync (not on the ledger) RIDES ALONG', ids.indexOf('id_fx_new')!==-1&&ids[ids.length-1]==='id_fx_new', ids.join(','));
  check('D2 the ride-along owes a sync; the drop alone would not', r.localWon===true, String(r.localWon));
  var r2=mergeRecordSlice([rec('id_fx_keep','Kept Co',T1),rec('id_fx_gone','Gone Co',T1)],fileRecs,null,ledger);
  check('D1 a merge that only drops owes no sync', r2.localWon===false&&r2.records.length===1&&r2.dropped.length===1, JSON.stringify(r2));
  var r3=mergeRecordSlice(local,fileRecs,null,undefined);
  check('D3 no ledger passed (the v0.7.0 shape): every tab-only record rides along, none dropped', r3.records.length===3&&r3.dropped.length===0&&r3.localWon===true, JSON.stringify(r3.records.map(function(x){return x.id;})));
  var r4=mergeRecordSlice(local,fileRecs,'id_fx_gone',ledger);
  check('D4 the record open under edit survives even when the file let it go', r4.records.map(function(x){return x.id;}).indexOf('id_fx_gone')!==-1&&r4.dropped.length===0, JSON.stringify(r4.records.map(function(x){return x.id;})));
  var fileNewer=[Object.assign(rec('id_fx_keep','Kept Co',T2),{section:'drafts'})];
  var r5=mergeRecordSlice([rec('id_fx_keep','Kept Co',T1)],fileNewer,null,ledger);
  check('D5 records the file carries merge as before: the newer file copy wins and section never lands', r5.records[0].updatedAt===T2&&!('section' in r5.records[0])&&r5.localWon===false, JSON.stringify(r5.records[0]));
  var r5b=mergeRecordSlice([rec('id_fx_keep','Kept Co',T2)],[rec('id_fx_keep','Kept Co',T1)],null,ledger);
  check('D5 the newer tab copy still wins and owes a sync', r5b.records[0].updatedAt===T2&&r5b.localWon===true, JSON.stringify(r5b.records[0]));
  var ev=function(id,stamp){return {id:id,title:'Room',status:'candidate',updatedAt:stamp,createdAt:stamp};};
  var ar=function(id,stamp){return {id:id,title:'Piece',status:'made',updated:stamp,created:stamp};};
  var r6=mergeRecordSlice([ev('id_ev_gone',T1),ev('id_ev_new',T2)],[],null,{id_ev_gone:true});
  var r7=mergeRecordSlice([ar('id_ar_gone',T1),ar('id_ar_new',T2)],[],null,{id_ar_gone:true});
  check('D6 slice-agnostic: an event on the ledger drops and a new one rides', r6.dropped.join()==='id_ev_gone'&&r6.records.length===1&&r6.records[0].id==='id_ev_new', JSON.stringify(r6));
  check('D6 slice-agnostic: an artifact on the ledger drops and a new one rides', r7.dropped.join()==='id_ar_gone'&&r7.records.length===1&&r7.records[0].id==='id_ar_new', JSON.stringify(r7));
  // The founder's shape: a tab holding records the file dropped, with a ledger seeded from everything it holds.
  var tabRecs=[rec('id_fx_keep','Kept Co',T1),rec('id_fx_dup1','Dup One',T1),rec('id_fx_dup2','Dup Two',T1)];
  g.state={comms:tabRecs,network:[],events:[ev('id_ev_smoke',T1)],artifacts:[ar('id_ar_smoke',T1)]};
  var seeded=allStateIds();
  var r8=mergeRecordSlice(tabRecs,fileRecs,null,seeded);
  var r8e=mergeRecordSlice(g.state.events,[],null,seeded);
  var r8a=mergeRecordSlice(g.state.artifacts,[],null,seeded);
  check('D7 a pre-ledger tab seeded from what it holds: every record the file dropped goes, nothing owed', r8.records.length===1&&r8.dropped.length===2&&r8.localWon===false&&r8e.dropped.length===1&&r8a.dropped.length===1&&r8e.records.length===0&&r8a.records.length===0, JSON.stringify([r8.dropped,r8e.dropped,r8a.dropped]));

  // --- L: the ledger through localStorage -----------------------------------
  store={};
  check('L1 no stored ledger reads null', loadSyncedIds()===null, String(loadSyncedIds()));
  saveSyncedIds({id_a:true,id_b:true});
  check('L2 the ledger stores ids only, under the key', store[SYNCED_IDS_KEY]==='["id_a","id_b"]'&&g._syncedIds.id_a===true, store[SYNCED_IDS_KEY]);
  var back=loadSyncedIds();
  check('L3 the ledger round-trips', back&&back.id_a===true&&back.id_b===true&&Object.keys(back).length===2, JSON.stringify(back));
  store[SYNCED_IDS_KEY]='not json';
  check('L4 an unreadable ledger reads null (the boot seeds a fresh one)', loadSyncedIds()===null, String(loadSyncedIds()));
  check('L5 allStateIds covers all four slices', seeded.id_fx_keep===true&&seeded.id_ev_smoke===true&&seeded.id_ar_smoke===true&&Object.keys(seeded).length===5, JSON.stringify(seeded));

  // --- S: the source pins ---------------------------------------------------
  var init=extractFn(html,'initStateSync');
  check('S1 the boot loads the ledger and seeds it from what the tab holds when none is stored', init.indexOf('_syncedIds=loadSyncedIds();if(_syncedIds===null)saveSyncedIds(allStateIds());')!==-1&&init.indexOf('_syncedIds')<init.indexOf('fetch(STATE_ENDPOINT_PATH'), '');
  check('S2 the boot export re-arms after the first merge', /mergeServerState\(f\);scheduleAutoExport\(\);/.test(init), '');
  var msv=extractFn(html,'mergeServerState');
  check('S3 every slice merges with the ledger', (msv.match(/,_syncedIds\)\)/g)||[]).length===4, String((msv.match(/,_syncedIds\)\)/g)||[]).length));
  check('S4 after a merge the ledger is the file\'s ids', msv.indexOf('saveSyncedIds(fileIds)')!==-1&&msv.indexOf('var fileIds={}')!==-1, '');
  check('S5 a merge that dropped records says so once', /if\(dropped\.length\)toast\(dropped\.length\+' RECORD'/.test(msv), '');
  var sync=extractFn(html,'syncStateToServer');
  check('S6 after an accepted POST the ledger is this tab\'s ids', sync.indexOf('_stateRev=j.rev;saveSyncedIds(allStateIds());')!==-1, '');
  var wipe=extractFn(html,'wipeAll');
  check('S7 wipe clears the ledger', wipe.indexOf('localStorage.removeItem(SYNCED_IDS_KEY);_syncedIds=null;')!==-1, '');
  check('S8 the ledger key is its own data anchor', SYNCED_IDS_KEY==='earthinfra_synced_ids_v01', SYNCED_IDS_KEY);

  out('\n'+checks+' checks, '+failures+' failure(s)');
  if(failures){if(isNode)process.exit(1);throw new Error(failures+' failure(s)');}
})();
