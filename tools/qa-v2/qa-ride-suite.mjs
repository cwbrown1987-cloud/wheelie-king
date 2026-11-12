// Ride feel + tricks + rewind/drop-in suite. Runs on one open Playground ride page.
import {rec,reset,hold,tel,D,round} from './qa-lib.mjs';
const W=ms=>new Promise(r=>setTimeout(r,ms));
const max=(a,f)=>a.reduce((m,x)=>Math.max(m,f(x)),-Infinity), min=(a,f)=>a.reduce((m,x)=>Math.min(m,f(x)),Infinity);
const mean=(a,f)=>a.length?a.reduce((s,x)=>s+f(x),0)/a.length:NaN;
async function drive(p,patch,ms){await hold(p,patch);await W(ms);}
async function rows(p,fn){await rec(p,true);await fn();return rec(p,false);}
async function toSpeed(p,kmh,ms=12000){const t0=Date.now();await hold(p,{throttle:1,brake:0});
  while(Date.now()-t0<ms){const t=await tel(p);if(t.speedKmh>=kmh)break;await W(50);} await hold(p,{throttle:0});}
// keep a speed with a throttle P-controller while doing fn-provided extra input
async function cruise(p,kmh,ms,extra={}){const t0=Date.now();while(Date.now()-t0<ms){const t=await tel(p);
  await hold(p,{...extra,throttle:Math.max(0,Math.min(1,(kmh-t.speedKmh)*0.15+0.15))});await W(33);}}
const wheelR=async p=>p.evaluate(()=>__WK_RIDE_STATE__().P.R||.33);
async function setToggle(p,name,on){ // keyboard is the real input path: Ctrl=wheelie, G=stand (v2.0.1; wheelie is throttle + lean back, Ctrl is a no-op)
  const st=await tel(p);const cur=name==='mono'?st.trick.toggles.mono:st.trick.toggles.stand;
  if(!!cur!==!!on)await p.keyboard.press(name==='mono'?'Control':'g');await W(150);}

async function unstick(p){const st=await p.evaluate(()=>({paused:__WK_RIDE_STATE__().paused,rev:!!document.querySelector('[data-r=theatre-rew]')?.offsetParent}));if(st.paused||st.rev)console.log('WARN: ride paused/review open before scenario',JSON.stringify(st));}
// Deliberate loop-out: ride at the large kicker, yank full lean back at the lip -> over-rotate -> LOOPED OUT.
async function loopOffLip(p){await reset(p,{x:70,z:14,yaw:0,vx:0});return rows(p,async()=>{await hold(p,{throttle:1,lean:0});const t0=Date.now();while(Date.now()-t0<7000){const t=await tel(p);if(t.trick.crashed)break;if(t.x>80)await hold(p,{throttle:1,lean:-1});await W(33);}});}
export async function rideSuite(p,{tag,shots,shot}){
  const M={},C=[];const check=(id,pass,ev)=>{C.push({id:tag+':'+id,pass:!!pass,ev:round(ev)});console.log((pass?'PASS ':'FAIL ')+tag+':'+id,JSON.stringify(round(ev)).slice(0,600));};
  const R=await wheelR(p);
  // 0. keyboard mapping
  {await reset(p);const m={};
    for(const [k,f] of [['w',t=>t.input.throttle],['s',t=>t.input.brake],['d',t=>t.input.lean||t.input.steer],['a',t=>t.input.lean||t.input.steer]]){
      await p.keyboard.down(k);await W(120);m[k]=f(await tel(p));await p.keyboard.up(k);await W(80);}
    check('keys-map',m.w===1&&m.s===1&&m.d!==0&&m.a!==0&&Math.sign(m.d)!==Math.sign(m.a),m);}
  // 1. rest
  {await reset(p);const r=await rows(p,()=>W(2000));const c0=r[0]?.comp;
    M.rest={yRange:max(r,x=>x.y)-min(r,x=>x.y),drift:Math.hypot(r.at(-1).x-r[0].x,r.at(-1).z-r[0].z),comp:r.at(-1).comp,maxV:max(r,x=>Math.abs(x.v))};
    check('rest-still',M.rest.yRange<.02&&M.rest.drift<.05&&M.rest.maxV<.05,M.rest);
    check('suspension-telemetry',Array.isArray(M.rest.comp)&&M.rest.comp.length===2,M.rest.comp);
    if(shot)await p.screenshot({path:`${shots}/${tag}-rest.png`});}
  // 2. launch
  {await reset(p);const r=await rows(p,()=>drive(p,{throttle:1},5000));await hold(p,{throttle:0});
    const t0=r.find(x=>x.input?.throttle>0)?.t??0;const moved=r.find(x=>x.t>t0&&x.v>.1);const t20=r.find(x=>x.v*3.6>=20);
    const sl=r.filter(x=>x.t>t0+.3&&x.slip);const rest=r[0]?.comp||[0,0];
    M.launch={latencyS:moved?moved.t-t0:null,t0_20:t20?t20.t-t0:null,v5Kmh:r.at(-1).v*3.6,peakRearSlip:max(sl,x=>x.slip[0]),meanRearSlip:mean(sl.filter(x=>x.t<t0+2),x=>x.slip[0]),
      maxPitch:max(r,x=>x.pitch),squatComp:max(r,x=>x.comp?.[0]??0)-(rest[0]??0),visSquat:max(r,x=>Math.abs(x.squat||0)),crashed:r.some(x=>x.crashed)};
    check('throttle-immediate',M.launch.latencyS!=null&&M.launch.latencyS<.2,M.launch);
    check('no-launch-wheelspin-runaway',M.launch.peakRearSlip<.6&&M.launch.meanRearSlip<.3,M.launch);
    check('launch-squat-visible',Math.abs(M.launch.squatComp)>.005||M.launch.visSquat>.005,M.launch);
    check('launch-no-crash',!M.launch.crashed&&M.launch.maxPitch<25,M.launch);}
  // 3. progressive throttle
  {const v={};for(const th of [.25,.5,1]){await reset(p);await drive(p,{throttle:th},1500);v[th]=(await tel(p)).speedKmh;await hold(p,{throttle:0});}
    M.progressiveThrottle=v;check('throttle-progressive',v[.25]<v[.5]&&v[.5]<v[1]&&v[.25]/v[1]<.75&&v[.25]>0.3,v);}
  // 4. brakes
  for(const b of [1,.35]){await reset(p);await toSpeed(p,25,8000);await W(200);const r=await rows(p,()=>drive(p,{throttle:0,brake:b},4000));await hold(p,{brake:0});
    const v0=r[0].v,stop=r.find(x=>x.v<.15)||r.at(-1);const lock=r.filter(x=>x.v>2&&Math.abs(x.om?.[1]*R)<.2*x.v);
    const rest=M.rest.comp||[0,0];
    const o={fromKmh:v0*3.6,stopT:stop.t,stopDist:Math.hypot(stop.x-r[0].x,stop.z-r[0].z),decelG:(v0-stop.v)/Math.max(.01,stop.t)/9.81,frontLockFrames:lock.length,frontLockS:lock.length/60,
      diveComp:max(r,x=>x.comp?.[1]??0)-(rest[1]??0),visDive:max(r,x=>Math.abs(x.dive||0)),minPitch:min(r,x=>x.pitch),maxRoll:max(r,x=>Math.abs(x.roll)),crashed:r.some(x=>x.crashed),reverse:min(r,x=>x.v)};
    M['brake'+b]=o;}
  check('front-brake-no-instant-lock',M.brake1.frontLockS<.15,M.brake1);
  check('brake-dive-visible',Math.abs(M.brake1.diveComp)>.005||M.brake1.visDive>.005,M.brake1);
  check('brake-strong-stable',M.brake1.decelG>.45&&M.brake1.decelG<1.3&&!M.brake1.crashed&&M.brake1.maxRoll<8,M.brake1);
  check('brake-progressive',M['brake0.35'].decelG<.8*M.brake1.decelG,{full:M.brake1.decelG,light:M['brake0.35'].decelG});
  // 5. lean / steer response at 20 km/h
  {await reset(p);await toSpeed(p,20);const r=await rows(p,()=>cruise(p,20,2500,{steer:1,lean:1}));
    await hold(p,{steer:0,lean:0});const r2=await rows(p,()=>cruise(p,20,2500));await hold(p,{throttle:0});
    const ss=mean(r.slice(-30),x=>Math.abs(x.roll));const t90=r.find(x=>Math.abs(x.roll)>=.9*ss);
    const vk=mean(r.slice(-30),x=>x.v);M.lean={speedKmh:vk*3.6,turnRadius:vk/Math.max(1e-3,mean(r.slice(-30),x=>Math.abs(x.yawRate))),physLeanDeg:Math.atan(vk*mean(r.slice(-30),x=>Math.abs(x.yawRate))/9.81)*180/Math.PI,steadyRollDeg:ss,t90:t90?t90.t:null,yawRate:mean(r.slice(-30),x=>Math.abs(x.yawRate)),recoverRollDeg:Math.abs(r2.at(-1).roll),crashed:r.some(x=>x.crashed)||r2.some(x=>x.crashed)};
    check('lean-responsive',M.lean.t90!=null&&M.lean.t90<.8&&M.lean.steadyRollDeg>8,M.lean);
    check('lean-matches-turn',Math.abs(M.lean.steadyRollDeg-M.lean.physLeanDeg)<Math.max(6,.35*M.lean.physLeanDeg),M.lean);
    check('reaches-20kmh-for-lean-test',M.lean.speedKmh>17,M.lean);
    check('lean-recovers',M.lean.recoverRollDeg<4&&!M.lean.crashed,M.lean);}
  // 6. wheelie feathering at balance point (best of 3 targets)
  {let best=null;for(const [target,leanBack] of [[30,0],[40,0],[50,0],[35,1],[45,1]]){await reset(p);await toSpeed(p,12,6000);await setToggle(p,'mono',true);
      const r=await rows(p,async()=>{const t0=Date.now();while(Date.now()-t0<6000){const t=await tel(p);if(t.trick.crashed)break;
        await hold(p,{throttle:Math.max(0,Math.min(1,.45+(target-t.pitchDeg)*.04)),brake:t.pitchDeg>target+15?.6:0,lean:leanBack&&t.pitchDeg<target-5?-1:0});await W(33);}});
      await hold(p,{throttle:0,brake:0,lean:0});await setToggle(p,'mono',false);
      let run=0,bestRun=0,prev=null;for(const x of r){const up=x.pitch>12&&x.pitch<80&&!x.crashed;run=up&&prev!=null?run+(x.t-prev):0;bestRun=Math.max(bestRun,run);prev=x.t;}
      const o={target,leanBack,heldS:bestRun,pitchStd:Math.sqrt(mean(r.filter(x=>x.pitch>12),x=>(x.pitch-target)**2)),maxPitch:max(r,x=>x.pitch),crashed:r.some(x=>x.crashed),monoFlag:r.some(x=>x.trick?.wheelie),startKmh:r[0]?.v*3.6};
      (M.wheelieTries=M.wheelieTries||[]).push(o);if(!best||o.heldS>best.heldS)best=o;if(best.heldS>=3&&!best.crashed)break;}
    M.wheelie=best;check('wheelie-feather-balance',best.heldS>=3&&!best.crashed&&best.monoFlag,best);
    if(shot){await reset(p);await toSpeed(p,12);await setToggle(p,'mono',true);await drive(p,{throttle:.8,lean:-1},900);await p.screenshot({path:`${shots}/${tag}-wheelie.png`});await hold(p,{throttle:0});await setToggle(p,'mono',false);}}
  // 7. loop-out -> 8. rewind
  {const r=await loopOffLip(p);
    await hold(p,{throttle:0,lean:0});const t=await tel(p);
    M.loopOut={maxPitch:max(r,x=>x.pitch),crashed:!!t.trick.crashed,crash:t.trick.crashed};
    check('loop-out',M.loopOut.crash==='LOOPED OUT'||(M.loopOut.maxPitch>75&&M.loopOut.crashed),M.loopOut);
    if(shot)await p.screenshot({path:`${shots}/${tag}-loopout.png`});
    if(t.trick.crashed){const btn=p.locator('[data-r=rewind]');const vis=await btn.waitFor({state:'visible',timeout:4000}).then(()=>true,()=>false);
      let ev={rewindButtonVisible:vis};
      if(vis){const b=await btn.boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();
        const during=await rows(p,()=>W(1500));await p.mouse.up();await W(50);
        const after=await tel(p);const js=await p.evaluate(()=>{const st=__WK_RIDE_STATE__();const j=st.jolt;return {sx:st.s.x,sy:st.s.y,body:j?.body||j?.pos||null,rewinding:st.rewinding}});
        const r2=await rows(p,()=>W(3000));let mdv=0;for(let i=1;i<r2.length;i++)mdv=Math.max(mdv,Math.abs(r2[i].v-r2[i-1].v));
        ev={...ev,reversed:during.length>5&&Math.abs(during.at(-1).x-during[0].x)>.2,afterRelease:{pitch:after.pitchDeg,roll:after.rollDeg,v:after.speedMs,crashed:after.trick.crashed},
          resume:{maxDvPerFrame:mdv,maxV:max(r2,x=>Math.abs(x.v)),vStart:r2[0]?.v,maxPitch:max(r2,x=>Math.abs(x.pitch)),maxRoll:max(r2,x=>Math.abs(x.roll)),crashed:r2.some(x=>x.crashed),moved:Math.hypot(r2.at(-1).x-r2[0].x,r2.at(-1).z-r2[0].z)},joltVsState:js};}
      M.rewind=ev;
      check('rewind-restores-and-resumes',ev.rewindButtonVisible&&ev.reversed&&!ev.afterRelease?.crashed&&Math.abs(ev.afterRelease.pitch)<30&&ev.resume.maxDvPerFrame<.4&&ev.resume.maxV<=Math.abs(ev.resume.vStart)+1&&!ev.resume.crashed&&ev.resume.maxRoll<20,ev);
    } else check('rewind-restores-and-resumes',false,{reason:'could not produce a crash to rewind from'});
    await setToggle(p,'mono',false);}
  // 9. drop-in from the replay after a crash
  {await loopOffLip(p);await hold(p,{throttle:0,lean:0});
    const crashed=!!(await tel(p)).trick.crashed;let ev={crashed};
    if(crashed){const rb=p.locator('[data-r=crash-replay]').first();
      const has=await rb.waitFor({state:'visible',timeout:4000}).then(()=>true,()=>false);ev.replayButton=has;
      if(has){await rb.click();await W(1200);const di=p.locator('[data-r=drop-in]').first();ev.dropButton=await di.waitFor({state:'visible',timeout:5000}).then(()=>true,()=>false);if(shot)await p.screenshot({path:`${shots}/${tag}-replay-theatre.png`});
        if(ev.dropButton){await di.click();const r0=await rows(p,()=>W(3000));const k=r0.findIndex(x=>!x.crashed);const r=k<0?r0:r0.slice(k);const t=await tel(p);
          ev.after={applyLatencyS:k<0?null:r0[k].t,crashed:t.trick.crashed,pitch:t.pitchDeg,roll:t.rollDeg,maxPitch:max(r,x=>Math.abs(x.pitch)),maxRoll:max(r,x=>Math.abs(x.roll)),maxV:max(r,x=>Math.abs(x.v)),bothWheels:t.ground,
            lastDrop:await p.evaluate(()=>{const d=globalThis.__WK_LAST_DROP__;return d?{hasJolt:!!d.frame?.meta?.jolt,x:d.restored.x,pitch:d.restored.pitch}:null})};}}}
    M.dropIn=ev;check('drop-in-upright',ev.after&&!ev.after.crashed&&Math.abs(ev.after.pitch)<10&&ev.after.maxRoll<20&&ev.after.lastDrop?.hasJolt&&ev.after.bothWheels?.every(Boolean),ev);
    M.dropIn.pausedAfter=await p.evaluate(()=>__WK_RIDE_STATE__().paused);if(M.dropIn.pausedAfter)check('drop-in-resumes-unpaused',false,{paused:true});}
  // 10. burnout
  {await reset(p);const r=await rows(p,()=>drive(p,{throttle:1,brake:1},2500));await hold(p,{throttle:0,brake:0});
    if(shot){}const bf=r.filter(x=>x.trick?.burnout||x.mode==='burnout').length/Math.max(1,r.length);
    M.burnout={burnoutFrac:bf,disp:Math.hypot(r.at(-1).x-r[0].x,r.at(-1).z-r[0].z),rearOmega:max(r,x=>Math.abs(x.om?.[0]||0)),smoke:max(r,x=>x.smoke||0),crashed:r.some(x=>x.crashed),maxYawChange:Math.abs(r.at(-1).yaw-r[0].yaw)};
    check('burnout',bf>.8&&M.burnout.disp<1.5&&M.burnout.rearOmega>15&&M.burnout.smoke>0&&!M.burnout.crashed,M.burnout);
    if(shot){await reset(p);await hold(p,{throttle:1,brake:1});await W(1500);await p.screenshot({path:`${shots}/${tag}-burnout.png`});await hold(p,{throttle:0,brake:0});}}
  // 11. drift while moving
  {await reset(p);await toSpeed(p,25);const r=await rows(p,()=>drive(p,{throttle:1,brake:1,steer:1,lean:1},2000));await hold(p,{throttle:0,brake:0,steer:0,lean:0});
    const ang=[];for(let i=5;i<r.length;i++){const dx=r[i].x-r[i-5].x,dz=r[i].z-r[i-5].z;if(Math.hypot(dx,dz)<.05)continue;
      const hv=Math.atan2(dz,dx)*D;let d=Math.abs(((hv-r[i].yaw)%360+540)%360-180);d=Math.min(d,Math.abs(180-d));ang.push(d);}
    const after=await rows(p,()=>W(2000));
    M.drift={driftFrac:r.filter(x=>x.trick?.drift||x.mode==='drift').length/Math.max(1,r.length),maxSlipAngleDeg:ang.length?Math.max(...ang):null,meanSlipAngleDeg:ang.length?ang.reduce((a,b)=>a+b)/ang.length:null,
      yawChangeDeg:Math.abs(r.at(-1).yaw-r[0].yaw),crashed:r.some(x=>x.crashed)||after.some(x=>x.crashed),endRoll:Math.abs(after.at(-1).roll)};
    check('drift',M.drift.driftFrac>.6&&M.drift.maxSlipAngleDeg>12&&!M.drift.crashed,M.drift);}
  // 12. donut (from standstill, and from a slow roll)
  {M.donut=[];for(const kmh of [0,6]){await reset(p);if(kmh)await toSpeed(p,kmh,4000);const r=await rows(p,()=>drive(p,{throttle:1,brake:1,steer:1,lean:1},5000));await hold(p,{throttle:0,brake:0,steer:0,lean:0});
    let tot=0;for(let i=1;i<r.length;i++){let d=r[i].yaw-r[i-1].yaw;d=((d+540)%360)-180;tot+=d;}
    const cx=mean(r,x=>x.x),cz=mean(r,x=>x.z);
    M.donut.push({fromKmh:kmh,totalYawDeg:Math.abs(tot),radius:max(r,x=>Math.hypot(x.x-cx,x.z-cz)),crashed:r.some(x=>x.crashed),mode:[...new Set(r.map(x=>x.mode))]});}
    const ok=M.donut.find(d=>d.totalYawDeg>300&&d.radius<4&&!d.crashed);check('donut',!!ok,M.donut);
    if(shot)await p.screenshot({path:`${shots}/${tag}-donut.png`});}
  // 13. stand
  {await reset(p);const before=await p.evaluate(()=>JSON.stringify(__WK_RIDE_STATE__().rider||{}));await setToggle(p,'stand',true);await W(500);
    const t=await tel(p);const after=await p.evaluate(()=>JSON.stringify(__WK_RIDE_STATE__().rider||{}));
    if(shot)await p.screenshot({path:`${shots}/${tag}-stand.png`});
    await cruise(p,15,1500);const t2=await tel(p);await hold(p,{throttle:0});await setToggle(p,'stand',false);await W(300);const t3=await tel(p);
    M.stand={standing:t.trick.standing,riderPoseChanged:before!==after,rideOnPegs:t2.trick.standing&&!t2.trick.crashed,off:!t3.trick.standing,driverStand:t.driver?.stand};
    check('stand-on-pegs',M.stand.standing&&M.stand.riderPoseChanged&&M.stand.rideOnPegs&&M.stand.off,M.stand);}
  // 14. HUD distance
  {await reset(p);const read=()=>p.evaluate(()=>[...document.querySelectorAll('[data-wk-ride-surface] *, .ride-hud *')].filter(e=>e.children.length===0&&/\d/.test(e.textContent)&&e.offsetParent).map(e=>({c:e.className||e.dataset?.r||e.tagName,t:e.textContent.trim()})));
    const a=await read();await toSpeed(p,25,4000);await cruise(p,25,2000);const b=await read();await hold(p,{throttle:0});
    const num=s=>{const m=s.match(/(\d+(?:\.\d+)?)\s*(k?m)\b/i);return m?+m[1]*(m[2].toLowerCase()==='km'?1000:1):null};
    const cand=b.map((x,i)=>({...x,before:a.find(y=>y.c===x.c)?.t})).filter(x=>num(x.t)!=null);
    const inc=cand.filter(x=>x.before!=null&&num(x.t)>num(x.before));
    M.hudDistance={candidates:cand.slice(0,6),increasing:inc.slice(0,3)};check('hud-distance-increments',inc.length>0,M.hudDistance);}
  return {metrics:M,checks:C};
}
