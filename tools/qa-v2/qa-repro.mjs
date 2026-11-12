// Targeted repros with full timelines for the defects found by qa-main.
import {launch,openPage,startRide,tel,reset,hold,rec,round,injectExtraCatalog} from './qa-lib.mjs';
import {writeFileSync,mkdirSync,readdirSync,renameSync} from 'node:fs';import {join} from 'node:path';
const OUT=process.env.WK_QA_OUT||'qa-out';mkdirSync(join(OUT,'shots'),{recursive:true});const W=ms=>new Promise(r=>setTimeout(r,ms));
const ONLY=(process.env.WK_QA_ONLY||'drop,rewind,donut,mono0,hud,carry,sample3d').split(',');
const R={};const save=()=>writeFileSync(join(OUT,'qa-repro.json'),JSON.stringify(round(R),null,1));
const slim=r=>r.filter((x,i)=>i%6===0).map(x=>({t:x.t,v:x.v,pitch:x.pitch,roll:x.roll,mode:x.mode,mono:x.trick?.wheelie,tog:x.trick?.toggles?.mono,thr:x.input?.throttle,crashed:x.crashed,ground:x.ground}));
const b=await launch();
async function crashLoop(p){await reset(p);await hold(p,{throttle:1});for(let i=0;i<100;i++){if((await tel(p)).speedKmh>10)break;await W(50);}
  await p.keyboard.press('Control');await hold(p,{throttle:1,lean:-1});for(let i=0;i<100;i++){if((await tel(p)).trick.crashed)break;await W(50);}await hold(p,{throttle:0,lean:0});
  const t=await tel(p);if(t.trick.toggles.mono)await p.keyboard.press('Control');await W(200);return (await tel(p)).trick;}
const ride=process.env.WK_QA_RIDE||'bike_emoto';
if(ONLY.some(x=>['drop','rewind','donut','mono0','hud'].includes(x))){
 const {ctx,p,log}=await openPage(b,{video:join(OUT,'video-repro')});await startRide(p,ride);
 if(ONLY.includes('drop')){const c=await crashLoop(p);await p.locator('[data-r=crash-replay]').click();await p.locator('[data-r=drop-in]').waitFor({timeout:5000});
   await p.screenshot({path:join(OUT,'shots','repro-replay-theatre.png')});
   await rec(p,true);await p.locator('[data-r=drop-in]').click();await W(3000);const r=await rec(p,false);
   R.dropIn={crash:c,lastDrop:await p.evaluate(()=>{const d=__WK_LAST_DROP__;return {meta:Object.keys(d.frame.meta||{}),joltMono:d.frame.meta?.jolt?.mono,joltV:d.frame.meta?.jolt?.v,restored:{x:d.restored.x,vx:d.restored.vx,pitch:d.restored.pitch,mono:d.restored.mono}}}),timeline:slim(r)};
   await p.screenshot({path:join(OUT,'shots','repro-after-dropin.png')});save();}
 if(ONLY.includes('rewind')){const c=await crashLoop(p);const btn=p.locator('[data-r=rewind]');await btn.waitFor({timeout:4000});const bb=await btn.boundingBox();
   await rec(p,true);await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await p.mouse.down();await W(1500);await p.mouse.up();await W(3000);const r=await rec(p,false);
   R.rewind={crash:c,timeline:slim(r)};save();}
 if(ONLY.includes('mono0')){await reset(p);await p.keyboard.press('Control');await rec(p,true);await W(3000);const r=await rec(p,false);await p.keyboard.press('Control');R.monoStandstill=slim(r);save();}
 if(ONLY.includes('donut')){R.donut=[];for(const kmh of [5,10]){await reset(p);await hold(p,{throttle:1});for(let i=0;i<100;i++){if((await tel(p)).speedKmh>kmh)break;await W(30);}
   await rec(p,true);await hold(p,{throttle:1,brake:1,steer:1,lean:1});await W(4000);await hold(p,{throttle:0,brake:0,steer:0,lean:0});const r=await rec(p,false);
   let tot=0;for(let i=1;i<r.length;i++){let d=r[i].yaw-r[i-1].yaw;d=((d+540)%360)-180;tot+=d;}R.donut.push({fromKmh:kmh,totalYaw:tot,modes:[...new Set(r.map(x=>x.mode))],end:slim(r).slice(-3)});}save();}
 if(ONLY.includes('hud')){await reset(p);await hold(p,{throttle:1});await W(6000);await hold(p,{throttle:0});const t=await tel(p);
   R.hud={x:t.x,z:t.z,texts:await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&/\bm\b/.test(e.textContent)&&e.offsetParent).map(e=>e.textContent.trim()).slice(0,10))};
   await p.screenshot({path:join(OUT,'shots','repro-hud-after-6s.png')});save();}
 R.log={errors:log.errors,failed:log.failed.filter(u=>!u.startsWith('blob:'))};await ctx.close();
 for(const f of readdirSync(join(OUT,'video-repro')))if(f.endsWith('.webm'))renameSync(join(OUT,'video-repro',f),join(OUT,'repro-emoto.webm'));}
if(ONLY.includes('carry')){
 const {ctx:c0,p:p0}=await openPage(b,{});const base=await p0.evaluate(()=>JSON.parse(JSON.stringify(__WK_CATALOG_ITEMS__.find(x=>x.id==='emoto'))));
 const tyre=await p0.evaluate(()=>JSON.parse(JSON.stringify(__WK_CATALOG_ITEMS__.find(x=>x.id==='moto19'))));await c0.close();
 const F={...base,id:'emoto__qacarry',name:'QA Carry-Over Frame',hidden:false,price:0,kg:(base.kg||10)+6,ride:{...(base.ride||{}),torque:25,frontTravel:.15,rearTravel:.17}};delete F.variantOf;
 const T={...tyre,id:'qa_carry_tyre',name:'QA Super Grip Tyre',hidden:false,grip:1.45,price:0};delete T.variantOf;
 const {ctx,p,log}=await openPage(b,{init:pg=>injectExtraCatalog(pg,[F,T])});
 await p.evaluate(()=>__WK_EQUIP__('bike_emoto'));await W(500);await p.evaluate(()=>__WK_EQUIP__('emoto__qacarry'));await W(500);await p.evaluate(()=>__WK_EQUIP__('qa_carry_tyre'));await W(500);
 const build=await p.evaluate(()=>({...globalThis.__WK_BUILD__}));R.carry={build,fixture:{frame:F.id,ride:F.ride,tyreGrip:T.grip}};save();
 await p.screenshot({path:join(OUT,'shots','carry-workshop.png')});
 try{await startRide(p,null);const t=await tel(p);R.carry.profile=t.profile;R.carry.friction=await p.evaluate(()=>__WK_RIDE_STATE__().rideProfile?.friction);R.carry.ok=true;
   await p.screenshot({path:join(OUT,'shots','carry-ride.png')});}
 catch(e){R.carry.ok=false;R.carry.err=String(e).slice(0,300);R.carry.state=await p.evaluate(()=>({ride:!!globalThis.__WK_RIDE_STATE__,st:globalThis.__WK_RIDE_STATE__?.()?.physicsReady,body:document.body.innerText.slice(0,400)}));await p.screenshot({path:join(OUT,'shots','carry-stuck.png')});}
 R.carry.log={errors:log.errors.slice(0,10)};save();await ctx.close();}
if(ONLY.includes('sample3d')){const {ctx,p,log}=await openPage(b,{level:null,track:'sample3d',viewport:{width:844,height:390},mobile:true});
 await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
 await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.backdropLoaded,null,{timeout:90000});await W(800);
 await p.keyboard.down('w');await W(2500);const v=await p.evaluate(()=>__WK_RIDE_STATE__().s.vx);await p.keyboard.up('w');
 R.sample3d={vx:v,errors:log.errors};await p.screenshot({path:join(OUT,'shots','sample3d.png')});save();await ctx.close();}
await b.close();save();console.log(JSON.stringify(round(R)).slice(0,3000));
