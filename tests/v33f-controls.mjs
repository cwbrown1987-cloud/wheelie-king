// v33f: Playground controls. Side view is camera-only, snappy launch, brake-to-reverse, standstill hold.
// WK_MEASURE=1 prints numbers without asserting (used for the before/after comparison).
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';

const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const MEASURE=process.env.WK_MEASURE==='1';
const shotDir=process.env.WK_SHOT_DIR||'';
const ok=(c,m)=>{if(MEASURE){if(!c)console.log('WOULD FAIL:',m);}else assert(c,m);};
const browser=await launchBrowser();
const ctxOpts=pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'});
if(shotDir){mkdirSync(shotDir,{recursive:true});ctxOpts.recordVideo={dir:shotDir,size:{width:844,height:390}};}
const ctx=await browser.newContext(ctxOpts);
const p=await ctx.newPage();
const errors=[];p.on('pageerror',e=>errors.push(String(e.message||e)));
await p.goto(base.replace(/\/?$/,'/')+'?track=playground&physics=jolt',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_emoto'));
await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.physicsReady&&__WK_RIDE_STATE__().physics==='jolt'&&__WK_RIDE_STATE__().backdropLoaded,null,{timeout:90000});
await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
await p.waitForTimeout(800);

const hold=(patch)=>p.evaluate(patch=>__WK_RIDE_HOLD__({clearKeys:true,...patch}),patch);
const reset=async(pose)=>{await hold({throttle:0,brake:0,steer:0});await p.evaluate(pose=>__WK_JOLT_RESET__(pose),pose);await p.waitForTimeout(700);};
const sample=()=>p.evaluate(()=>{const st=__WK_RIDE_STATE__(),s=st.s;const b=st.jolt?.body||null;return {x:s.x,y:s.y,z:s.z||0,yaw:s.yaw||0,vx:s.vx||0,crashed:!!s.crashed,view:st.cameraView,trackLock:st.trackLock??null,camX:st.cameraX,steer:s.steer||0};});
// Sample every animation frame inside the page for `ms`, returning the trace.
const trace=(ms)=>p.evaluate(ms=>new Promise(res=>{const out=[],t0=performance.now();const f=()=>{const s=__WK_RIDE_STATE__().s;out.push({t:performance.now()-t0,x:s.x,z:s.z||0,yaw:s.yaw||0,vx:s.vx||0});if(performance.now()-t0<ms)requestAnimationFrame(f);else res(out);};requestAnimationFrame(f);}),ms);
const res={};

// 1. Launch: 0 -> 20 km/h on the flat opening straight, full throttle.
const launches=[];
for(let i=0;i<2;i++){
  await reset({x:-26,z:0,yaw:0,vx:0,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
  await hold({throttle:1,brake:0,steer:0});
  const tr=await trace(2000);
  await hold({throttle:0,brake:0,steer:0});
  const hit=tr.find(r=>r.vx>=20/3.6);
  const at1=tr.find(r=>r.t>=1000);
  launches.push({t20:hit?+(hit.t/1000).toFixed(2):null,v1s:at1?+(at1.vx*3.6).toFixed(1):null,vmax:+(Math.max(...tr.map(r=>r.vx))*3.6).toFixed(1)});
}
res.launch=launches;
const t20=Math.min(...launches.map(l=>l.t20??99));
res.t20=t20;
ok(t20<1.6,'0-20 km/h should be under 1.6 s, got '+t20);

// 2. Standstill holds with no input.
await reset({x:-26,z:0,yaw:0,vx:0,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
const a0=await sample();
await p.waitForTimeout(2500);
const a1=await sample();
res.standstill=+Math.hypot(a1.x-a0.x,a1.z-a0.z).toFixed(3);
ok(res.standstill<0.25,'standstill should hold, drifted '+res.standstill);

// 3. No reverse without brake: roll at 3 m/s, let go, never go backwards.
await reset({x:-26,z:0,yaw:0,vx:3,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
const coast=await trace(3500);
res.coastMinVx=+Math.min(...coast.map(r=>r.vx)).toFixed(2);
ok(res.coastMinVx>-0.15,'bike must not roll backwards on its own, min vx '+res.coastMinVx);

// 4. Brake at standstill -> slow reverse; release -> stops, no runaway.
await reset({x:-26,z:0,yaw:0,vx:0,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
await hold({throttle:0,brake:1,steer:0});
const rev=await trace(2500);
await hold({throttle:0,brake:0,steer:0});
res.reverseMinVx=+Math.min(...rev.map(r=>r.vx)).toFixed(2);
const after=await trace(2000);
res.reverseAfterRelease=+after[after.length-1].vx.toFixed(2);
ok(res.reverseMinVx<-0.4&&res.reverseMinVx>-3.5,'brake held at standstill should reverse slowly, min vx '+res.reverseMinVx);
ok(Math.abs(res.reverseAfterRelease)<0.4,'reverse must stop when brake is released, vx '+res.reverseAfterRelease);

// 5. Steering at 8 m/s: responsive, no jitter (bar angle should not flip sign frame to frame).
await reset({x:-26,z:0,yaw:0,vx:8,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
await hold({throttle:0.5,brake:0,steer:0.6});
const st=await trace(1200);
await hold({throttle:0,brake:0,steer:0});
const dyaw=st.slice(1).map((r,i)=>{let d=r.yaw-st[i].yaw;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d/Math.max(1e-3,(r.t-st[i].t)/1000);});
let flips=0;for(let i=2;i<dyaw.length;i++){const a=dyaw[i]-dyaw[i-1],b=dyaw[i-1]-dyaw[i-2];if(a*b<0&&Math.abs(a)>0.6&&Math.abs(b)>0.6)flips++;}
res.steer={yawTurned:+(st[st.length-1].yaw-st[0].yaw).toFixed(2),jitterFlips:flips};
ok(Math.abs(res.steer.yawTurned)>0.35,'steering should turn the bike, yaw '+res.steer.yawTurned);
ok(flips<=6,'steering jitter flips '+flips);

// 6. Donut on the grass, switch to side view mid-donut: camera only.
const spot=await p.evaluate(()=>{const tr=__WK_RIDE_STATE__().ter.track;for(const [x,z] of [[-10,-22],[0,-24],[-20,-25],[10,25],[-5,22],[35,-15]]){const n=tr.nearest(x,z);if(n.dist>9)return {x,z,dist:n.dist};}return null;});
res.spot=spot;
await reset({x:spot.x,z:spot.z,yaw:0,vx:0,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
await hold({throttle:1,brake:1,steer:1});
await p.waitForTimeout(1800);
if(shotDir)await p.screenshot({path:shotDir+'/donut-chase.png'});
const pre=await trace(150);
await p.evaluate(()=>__WK_SCENE_VIEW__('side'));
const post=await trace(150);
const pA=pre[pre.length-1],pB=post[0];
res.switchJump=+Math.hypot(pB.x-pA.x,pB.z-pA.z).toFixed(3);
res.switchDv=+Math.abs(pB.vx-pA.vx).toFixed(3);
const cont=await trace(1800);
const far=Math.max(...cont.map(r=>Math.hypot(r.x-pA.x,r.z-pA.z)));
res.donutDriftAfterSwitch=+far.toFixed(2);
res.trackLock=(await sample()).trackLock;
await p.waitForTimeout(500);
if(shotDir)await p.screenshot({path:shotDir+'/donut-side.png'});
await hold({throttle:0,brake:0,steer:0});
const settle=await trace(2000);
// Ignore the first 0.6 s while the spin unwinds; after that there must be no backwards glide.
res.sideMinVx=+Math.min(...settle.filter(r=>r.t>600).map(r=>r.vx)).toFixed(2);
// s.vx is speed along the heading, so a spinning bike reads negative while it unwinds.
// The old bug was a sustained glide, so measure distance travelled after the spin settles.
const late=settle.filter(r=>r.t>600);res.sideGlide=+late.slice(1).reduce((d,r,i)=>d+Math.hypot(r.x-late[i].x,r.z-late[i].z),0).toFixed(2);
// Backwards glide = distance covered while moving tail-first (the v33e bug slid ~20 m).
res.sideBackGlide=+late.slice(1).reduce((d,r,i)=>d+(r.vx<-0.3?Math.hypot(r.x-late[i].x,r.z-late[i].z):0),0).toFixed(2);
res.sideEndVx=+settle[settle.length-1].vx.toFixed(2);
const endS=settle[settle.length-1];
res.distToTrackAfter=+(await p.evaluate(([x,z])=>__WK_RIDE_STATE__().ter.track.nearest(x,z).dist,[endS.x,endS.z])).toFixed(2);
ok(res.switchJump<0.5,'camera switch must not move the bike, jumped '+res.switchJump);
ok(res.switchDv<0.6,'camera switch must not change speed, dv '+res.switchDv);
ok(res.donutDriftAfterSwitch<4,'donut should keep spinning in place after switch, drift '+res.donutDriftAfterSwitch);
ok(res.distToTrackAfter>6,'bike must stay on the grass, not snap to the track, dist '+res.distToTrackAfter);
ok(res.sideBackGlide<1.0,'no backwards glide after the donut in side view, '+res.sideBackGlide+' m tail-first (min vx '+res.sideMinVx+')');
ok(res.sideGlide<6,'no roll-away after the donut, travelled '+res.sideGlide+' m');
ok(res.sideEndVx>-0.4&&res.sideEndVx<3,'no roll-away (either way) once the donut is released, vx '+res.sideEndVx);
ok(res.trackLock==null,'no rail lock in Playground');

// 7. Side-view riding still looks right: camera on the bike's right.
await reset({x:-26,z:0,yaw:0,vx:8,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
await hold({throttle:0.6,brake:0,steer:0});
await p.waitForTimeout(1200);
if(shotDir)await p.screenshot({path:shotDir+'/side.png'});
await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
await reset({x:-26,z:0,yaw:0,vx:8,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
await hold({throttle:0.6,brake:0,steer:0.3});
await p.waitForTimeout(1400);
if(shotDir)await p.screenshot({path:shotDir+'/chase.png'});
await hold({throttle:0,brake:0,steer:0});

console.log('v33f',JSON.stringify(res));
if(shotDir)writeFileSync(shotDir+'/v33f-results.json',JSON.stringify(res,null,2));
ok(errors.length===0,'page errors: '+errors.join(' | '));
const vid=p.video();
await ctx.close();
if(vid&&shotDir)console.log('video',await vid.path());
await browser.close();
console.log(MEASURE?'v33f-controls measured':'v33f-controls ok');
