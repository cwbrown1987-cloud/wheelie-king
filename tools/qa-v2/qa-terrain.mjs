// Uneven-terrain patch checks (both rides): hill climb, downhill braking, hold on slopes, bumps.
import {launch,openPage,startRide,tel,reset,hold,rec,round} from './qa-lib.mjs';import {assertChase} from './qa-lib.mjs';
import {writeFileSync,mkdirSync,readdirSync,renameSync} from 'node:fs';import {join} from 'node:path';
const OUT=process.env.WK_QA_OUT||'qa-out';const SH=join(OUT,'shots');mkdirSync(SH,{recursive:true});const W=ms=>new Promise(r=>setTimeout(r,ms));
const checks=[];const ck=(id,pass,ev)=>{checks.push({id,pass:!!pass,ev:round(ev)});console.log((pass?'PASS ':'FAIL ')+id,JSON.stringify(round(ev)).slice(0,600));};
const b=await launch();
for(const ride of (process.env.WK_QA_RIDES||'bike_bmx,bike_emoto').split(',')){const tag=ride.replace(/^bike_/,'')+'-terrain';
 const vdir=join(OUT,'video-'+tag);const {ctx,p,log}=await openPage(b,{video:vdir});await startRide(p,ride);
 // find the patch: sample the ride terrain height field
 const scan=await p.evaluate(()=>{const {ter}=__WK_RIDE_STATE__();const H=(x,z)=>ter.terrainHeight?ter.terrainHeight(x,z):ter.height?ter.height(x,z):0;const pts=[];
   for(let x=-200;x<=200;x+=2)for(let z=-200;z<=200;z+=2){const h=H(x,z);const sx=(H(x+1,z)-H(x-1,z))/2,sz=(H(x,z+1)-H(x,z-1))/2;pts.push([x,z,h,sx,sz]);}
   const rough=pts.filter(q=>Math.abs(q[2])>.05||Math.hypot(q[3],q[4])>.02);if(!rough.length)return null;
   const hi=rough.reduce((a,q)=>q[2]>a[2]?q:a),lo=rough.reduce((a,q)=>q[2]<a[2]?q:a),lane=rough.filter(q=>Math.abs(q[1]+30)<=8),steep=(lane.length?lane:rough).reduce((a,q)=>Math.hypot(q[3],q[4])>Math.hypot(a[3],a[4])?q:a);
   const side=rough.filter(q=>Math.abs(q[4])>.08&&Math.abs(q[3])<.03)[0]||null;
   const xs=rough.map(q=>q[0]),zs=rough.map(q=>q[1]);return {n:rough.length,bounds:[Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)],hi,lo,steep,side,H0:H(0,0)};});
 ck(tag+':terrain-patch-present',!!scan,scan);
 if(scan){const H=(x,z)=>p.evaluate(([x,z])=>{const {ter}=__WK_RIDE_STATE__();return ter.height(x,z)},[x,z]);
  const run=async(pose,inp,ms,stopWhen)=>{await reset(p,{...pose,y:undefined});await rec(p,true);await hold(p,inp);const t0=Date.now();while(Date.now()-t0<ms){if(stopWhen&&stopWhen(await tel(p)))break;await W(40);}await hold(p,{throttle:0,brake:0});const r=await rec(p,false);return r;};
  // hill climb: start 15 m before the high point on the uphill line (along x)
  const [hx,hz,hh]=scan.hi;const sx=hx-15;const h0=await H(sx,hz);
  let r=await run({x:sx,z:hz,yaw:0,vx:0},{throttle:1},8000,t=>t.x>hx+2||t.trick.crashed);
  ck(tag+':hill-climb',r.some(x=>x.x>=hx-1)&&!r.some(x=>x.crashed),{hillH:hh-h0,startX:sx,topX:hx,maxX:Math.max(...r.map(x=>x.x)),endKmh:r.at(-1).v*3.6,crashed:r.some(x=>x.crashed)});
  await p.screenshot({path:join(SH,tag+'-hill.png')});
  // downhill braking: from top roll down 2 s then full brake
  await reset(p,{x:hx+1,z:hz,yaw:0,vx:3});await hold(p,{throttle:.4});await W(1500);await hold(p,{throttle:0});
  await rec(p,true);await hold(p,{brake:1});await W(3500);await hold(p,{brake:0});r=await rec(p,false);
  const stop=r.find(x=>Math.abs(x.v)<.15);
  ck(tag+':downhill-braking',stop&&!r.some(x=>x.crashed)&&Math.min(...r.map(x=>x.pitch))>-25,{fromKmh:r[0].v*3.6,stopT:stop?.t,stopDist:stop?Math.hypot(stop.x-r[0].x,stop.z-r[0].z):null,minPitch:Math.min(...r.map(x=>x.pitch)),crashed:r.some(x=>x.crashed)});
  // holding still on slopes (uphill-facing on the steepest point, and a side slope), brake held 3 s
  for(const [name,pt] of [['steep-slope',scan.steep],['side-slope',scan.side]]){if(!pt){ck(`${tag}:hold-${name}`,false,{reason:'no such slope in patch'});continue;}
    await reset(p,{x:pt[0],z:pt[1],yaw:Math.atan2(pt[4],pt[3])||0,vx:0});await hold(p,{brake:1});await W(800);await rec(p,true);await W(3000);r=await rec(p,false);await hold(p,{brake:0});
    const drift=Math.hypot(r.at(-1).x-r[0].x,r.at(-1).z-r[0].z);
    ck(`${tag}:hold-${name}`,drift<.1&&!r.some(x=>x.crashed)&&Math.max(...r.map(x=>Math.abs(x.roll)))<25,{slopePct:Math.hypot(pt[3],pt[4])*100,drift,maxRoll:Math.max(...r.map(x=>Math.abs(x.roll))),crashed:r.some(x=>x.crashed)});}
  // bumps: cross the patch at 20 km/h along x through its middle
  const zc=(scan.bounds[2]+scan.bounds[3])/2,x0=scan.bounds[0]-12;
  await reset(p,{x:x0,z:zc,yaw:0,vx:0});await rec(p,true);await hold(p,{throttle:1});const t0=Date.now();
  while(Date.now()-t0<12000){const t=await tel(p);await hold(p,{throttle:t.speedKmh<20?1:0});if(t.x>scan.bounds[1]+3||t.trick.crashed)break;await W(30);}
  await hold(p,{throttle:0});r=await rec(p,false);
  const inPatch=r.filter(x=>x.x>=scan.bounds[0]&&x.x<=scan.bounds[1]);
  const ground=await p.evaluate(rows=>{const {ter}=__WK_RIDE_STATE__();return rows.map(x=>ter.height(x.x,x.z))},inPatch.map(x=>({x:x.x,z:x.z})));
  let vyMax=0;for(let i=1;i<inPatch.length;i++){const dt=Math.max(1e-3,inPatch[i].t-inPatch[i-1].t);vyMax=Math.max(vyMax,Math.abs(inPatch[i].y-inPatch[i-1].y)/dt);}
  const clearance=inPatch.map((x,i)=>x.y-ground[i]);const c0=r[0].y-(await H(x0,zc));
  const ev={frames:inPatch.length,airFrames:inPatch.filter(x=>x.ground&&!x.ground[0]&&!x.ground[1]).length,minClearanceVsStart:Math.min(...clearance)-c0,maxClearanceVsStart:Math.max(...clearance)-c0,maxVy:vyMax,maxPitch:Math.max(...inPatch.map(x=>Math.abs(x.pitch))),crashed:r.some(x=>x.crashed),exitKmh:r.at(-1).v*3.6};
  ck(tag+':bumps-absorbed',ev.frames>20&&ev.airFrames<6&&ev.minClearanceVsStart>-.15&&ev.maxClearanceVsStart<.25&&!ev.crashed,ev);
  await p.screenshot({path:join(SH,tag+'-bumps.png')});}
 // bump-turn (v2.0.3): weave and hold a turn through the rollers and moguls at 15/22/30 km/h, CHASE view
 for(const kmh of [15,22,30])for(const pat of ['weave','hold']){await reset(p,{x:5,z:-30,yaw:0,vx:kmh/3.6});await assertChase(p,'bump-turn');
   let maxRoll=0,crash=null,end=null;const t0=Date.now();
   while(Date.now()-t0<22000){const t=await tel(p);end=t;maxRoll=Math.max(maxRoll,Math.abs(t.rollDeg));if(t.trick.crashed){crash=t.trick.crashed;break;}if(t.x>165)break;
     const ts=(Date.now()-t0)/1000,st=t.x<18?0:pat==='weave'?0.45*Math.sin(ts*1.6):0.25*Math.sign(Math.sin(ts*0.5));
     await hold(p,{throttle:t.speedKmh<kmh?1:0.15,brake:t.speedKmh>kmh+4?0.3:0,steer:Math.max(-1,Math.min(1,st-(t.z+30)*0.08))});await W(30);}
   await hold(p,{throttle:0,brake:0,steer:0});
   ck(`${tag}:bump-turn-${pat}-${kmh}kmh`,!crash&&maxRoll<75,{crash,maxRoll,endX:end?.x,cam:'chase'});}
 ck(tag+':no-console-errors',log.errors.length===0,log.errors.slice(0,5));
 await ctx.close();for(const f of readdirSync(vdir))if(f.endsWith('.webm'))renameSync(join(vdir,f),join(OUT,tag+'.webm'));}
await b.close();writeFileSync(join(OUT,'qa-terrain.json'),JSON.stringify(checks,null,1));console.log(checks.filter(c=>c.pass).length+'/'+checks.length+' passed');
