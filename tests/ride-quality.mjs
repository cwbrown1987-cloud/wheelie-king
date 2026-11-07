import assert from 'node:assert/strict';
import {pickTier,createQualityMonitor,TIERS,ORDER} from '../ride-quality.js';
const store=(o={})=>({m:new Map(Object.entries(o)),getItem(k){return this.m.has(k)?this.m.get(k):null},setItem(k,v){this.m.set(k,String(v))},removeItem(k){this.m.delete(k)}});
assert.deepEqual(pickTier(store(),true),{name:'low',manual:false});
assert.deepEqual(pickTier(store(),false),{name:'high',manual:false});
assert.deepEqual(pickTier(store({'wk-quality':'medium'}),true),{name:'medium',manual:false});
assert.deepEqual(pickTier(store({'wk-race-low-detail':'1','wk-quality':'high'}),false),{name:'low',manual:true});
assert.deepEqual(pickTier(store({'wk-quality':'bogus'}),false).name,'high');
assert.equal(pickTier({getItem(){throw Error('blocked')}},false).name,'high','storage errors are safe');
for(const n of ORDER)assert.ok(TIERS[n].maxPR>0);
const run=(m,dt,secs)=>{const acts=[];for(let t=0;t<secs;t+=dt){const a=m.sample(dt);if(a)acts.push(a)}return acts};
// slow device on high: downgrades and remembers a lower tier
{const s=store(),m=createQualityMonitor({name:'high',storage:s});const a=run(m,1/25,6);assert.equal(a[0].type,'down');assert.equal(s.getItem('wk-quality'),'medium');}
// keeps stepping down while still slow, but not forever
{const s=store(),m=createQualityMonitor({name:'high',storage:s});const a=run(m,1/20,60);assert.ok(a.filter(x=>x.type==='down').length<=3);assert.equal(s.getItem('wk-quality'),'low');}
// smooth device on low: needs two smooth rides before upgrading
{const s=store();let a=run(createQualityMonitor({name:'low',storage:s}),1/60,8);assert.equal(a[0].type,'smooth');assert.equal(s.getItem('wk-quality'),null);
 a=run(createQualityMonitor({name:'low',storage:s}),1/60,8);assert.equal(a[0].type,'up-next-ride');assert.equal(s.getItem('wk-quality'),'medium');}
// manual low-detail never changes the stored tier
{const s=store(),m=createQualityMonitor({name:'low',manual:true,storage:s});run(m,1/60,8);run(createQualityMonitor({name:'low',manual:true,storage:s}),1/60,8);assert.equal(s.getItem('wk-quality'),null);}
// hitches (tab switch) are ignored
{const s=store(),m=createQualityMonitor({name:'high',storage:s});for(let i=0;i<5;i++)m.sample(2);assert.equal(run(m,1/60,8)[0].type,'ok');}
console.log('ride-quality: ok');

// Late individual spikes must not be treated as complete three-second windows.
{const s=store(),m=createQualityMonitor({name:'low',storage:s});run(m,1/60,11);assert.equal(m.sample(.1),null);assert.equal(m.state().downgrades,0);}
// A later slow window cancels an upgrade queued by an earlier smooth window.
{const s=store({'wk-quality-good':'1'}),m=createQualityMonitor({name:'low',storage:s});run(m,1/60,5);assert.equal(s.getItem('wk-quality'),'medium');run(m,1/20,4);assert.equal(s.getItem('wk-quality'),'low');}
