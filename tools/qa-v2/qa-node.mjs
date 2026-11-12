// Deterministic Jolt checks (no browser): rewind determinism + part-data carry-over.
// WK_SRC=<game source dir> node qa-node.mjs [qa-report.json with captured ride profiles]
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const SRC=process.env.WK_SRC||'/workspace/wheelie-king-repo';
const {createJoltRide}=await import(pathToFileURL(SRC+'/ride-jolt.js'));
const {deriveRideProfile}=await import(pathToFileURL(SRC+'/ride-profile.js'));
const rep=process.argv[2]&&existsSync(process.argv[2])?JSON.parse(readFileSync(process.argv[2],'utf8')):null;
const dt=1/60,D=180/Math.PI;const checks=[];const ck=(id,pass,ev)=>{checks.push({id,pass:!!pass,ev});console.log((pass?'PASS ':'FAIL ')+id,JSON.stringify(ev).slice(0,500));};
const profiles={};
if(rep)for(const [k,v] of Object.entries(rep.metrics||{}))if(k.startsWith('profile-')&&v)profiles[k.slice(8)]=v;
if(!Object.keys(profiles).length)profiles.sample={mass:137,comBack:.37,comH:.95,front:{travel:.18,damping:.55},rear:{travel:.23},engine:{torque:250,power:6000,topSpeed:80/3.6,driveAxle:'rear'}};
for(const [name,pr] of Object.entries(profiles)){
  const profile={wheelbase:1.3,wheelR:.33,friction:1,brakeTorque:1,...pr};
  const P={R:profile.wheelR||.33,wb:profile.wheelbase||1.3,comBack:profile.comBack,comH:profile.comH};
  const mk=async()=>{const j=createJoltRide({P,profile});await j.start();const s={x:0,z:0,yaw:0,vx:0,events:[]};j.adopt(s);return {j,s}};
  const script=i=>i<120?{throttle:.8}:i<200?{throttle:.5,steer:.7,lean:.7}:i<260?{throttle:1,brake:1,steer:1}:{throttle:.4,mono:true};
  // reference run
  const A=await mk();const traceA=[];let snap=null;
  for(let i=0;i<360;i++){A.j.step(A.s,P,script(i),dt);if(i===180)snap=A.j.snapshot();if(i>180)traceA.push({x:A.s.x,z:A.s.z,vx:A.s.vx,pitch:A.s.pitch,roll:A.s.joltRoll,yaw:A.s.yaw});}
  // rewind run: diverge, restore, replay identical inputs
  const B=await mk();for(let i=0;i<=180;i++)B.j.step(B.s,P,script(i),dt);
  for(let i=0;i<100;i++)B.j.step(B.s,P,{throttle:1,mono:true,steer:-1},dt);
  B.j.restore(snap,B.s);let err=0,errPitch=0,errYaw=0,first=null,e05=null,e1=null;
  for(let i=181;i<360;i++){B.j.step(B.s,P,script(i),dt);const a=traceA[i-181];const e=Math.hypot(B.s.x-a.x,B.s.z-a.z);
    if(first==null)first={pos:e,vx:Math.abs(B.s.vx-a.vx),roll:Math.abs((B.s.joltRoll-a.roll)*D)};err=Math.max(err,e);errPitch=Math.max(errPitch,Math.abs((B.s.pitch-a.pitch)*D));{let dy=((B.s.yaw-a.yaw)*D)%360;dy=Math.abs(((dy+540)%360)-180);errYaw=Math.max(errYaw,dy);}if(i===211)e05={pos:err,yaw:errYaw};if(i===241)e1={pos:err,yaw:errYaw};}
  ck(`node:${name}:rewind-first-frame-matches`,first.pos<.02&&first.vx<.05&&first.roll<1,first);
  ck(`node:${name}:rewind-replay-deterministic-3s`,e1.pos<.1&&err<.5&&errPitch<3&&errYaw<5,{at0_5s:e05,at1s:e1,maxPosErr3s:err,maxPitchErrDeg:errPitch,maxYawErrDeg:errYaw});
  A.j.dispose?.();B.j.dispose?.();
}
// carry-over at data level: a new frame + new tyre + cosmetic sticker, no code.
{const CAT=[{id:'qa_new_frame',slot:'frame',kg:6,ride:{wheelbase:1.2}},{id:'qa_tyre_a',slot:'tyres',grip:1,kg:1.5},{id:'qa_tyre_b',slot:'tyres',grip:1.3,kg:1.5},
  {id:'qa_sticker',slot:'sticker',kg:0},{id:'qa_battery_big',slot:'battery',kg:8,ride:{power:500}},{id:'qa_battery_small',slot:'battery',kg:3}];
  const find=id=>CAT.find(p=>p.id===id);const base={torque:100,power:750,vmax:9,comBack:.42,comH:.9,R:.3};const anchors={rearAxle:[-.5,.3],frontAxle:[.7,.3],wheelR:.3,bb:[0,.32],seatTop:[-.2,.8],headTop:[.5,.9]};
  const d=b=>deriveRideProfile({build:b,find,anchors,base});const b0={frame:'qa_new_frame',tyres:'qa_tyre_a',battery:'qa_battery_small'};
  const p0=d(b0),pT=d({...b0,tyres:'qa_tyre_b'}),pS=d({...b0,sticker:'qa_sticker'}),pB=d({...b0,battery:'qa_battery_big'});
  ck('node:parts:tyre-changes-grip',pT.friction>p0.friction&&Math.abs(pT.mass-p0.mass)<1e-9,{f0:p0.friction,f1:pT.friction});
  ck('node:parts:cosmetic-no-physics',pS.mass===p0.mass&&pS.comBack===p0.comBack&&pS.friction===p0.friction&&JSON.stringify(pS.engine)===JSON.stringify(p0.engine),{p0:[p0.mass,p0.comBack],pS:[pS.mass,pS.comBack]});
  ck('node:parts:battery-mass-com-power',pB.mass>p0.mass+4&&pB.comH!==p0.comH&&pB.engine.power>p0.engine.power,{mass:[p0.mass,pB.mass],comH:[p0.comH,pB.comH],power:[p0.engine.power,pB.engine.power]});
  ck('node:parts:new-frame-wheelbase',Math.abs(p0.wheelbase-1.2)<1e-9,{wb:p0.wheelbase});
  // the swapped profiles must actually drive differently in Jolt
  const runOf=async pr=>{const P={R:pr.wheelR,wb:pr.wheelbase,comBack:pr.comBack,comH:pr.comH};const j=createJoltRide({P,profile:pr});await j.start();const s={x:0,z:0,yaw:0,vx:0,events:[]};j.adopt(s);for(let i=0;i<180;i++)j.step(s,P,{throttle:1},dt);const v=s.vx;j.dispose?.();return v;};
  const v0=await runOf(p0),vB=await runOf(pB);ck('node:parts:power-part-changes-ride',Math.abs(vB-v0)>.2,{v0,vBigBattery:vB});}
writeFileSync(process.env.WK_QA_NODE_OUT||'qa-node.json',JSON.stringify(checks,null,1));
console.log(`${checks.filter(c=>c.pass).length}/${checks.length} passed`);
