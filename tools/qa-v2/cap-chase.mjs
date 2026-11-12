// v2.0.2 chase-view evidence on the live beta. Every still asserts the camera is CHASE first.
import {launch,openPage,startRide,tel,reset,hold,assertChase} from './qa-lib.mjs';import {mkdirSync,readdirSync,renameSync} from 'node:fs';import {join} from 'node:path';
const OUT=process.env.WK_SHOTS||'shots-chase';mkdirSync(OUT,{recursive:true});const W=ms=>new Promise(r=>setTimeout(r,ms));const log=[];
const shot=async(p,name,extra={})=>{const cam=await assertChase(p,name);const t=await tel(p);await p.screenshot({path:join(OUT,name+'.png')});log.push({name,cam,kmh:+t.speedKmh.toFixed(1),pitch:+t.pitchDeg.toFixed(1),roll:+t.rollDeg.toFixed(1),...extra});};
const b=await launch();
for(const ride of ['bike_emoto','bike_bmx']){const tag=ride.replace('bike_','');const {ctx,p}=await openPage(b,{});await startRide(p,ride);
 // steer + lean: 18 km/h then hold right
 await reset(p);await hold(p,{throttle:1});for(let i=0;i<150;i++){if((await tel(p)).speedKmh>18)break;await W(40);}
 await hold(p,{throttle:.5,steer:1});await W(1200);await shot(p,`steer-lean-${tag}`);await hold(p,{throttle:0,steer:0});
 // donut: brake + throttle, then steer (BMX from a roll)
 await reset(p,{x:0,z:0,yaw:0,vx:tag==='bmx'?6:0});await hold(p,{brake:1,throttle:1});await W(800);await hold(p,{brake:1,throttle:1,steer:1});await W(1800);await shot(p,`donut-${tag}`);await hold(p,{brake:0,throttle:0,steer:0});
 // terrain climb
 await reset(p,{x:68,z:-30,yaw:0,vx:0});await hold(p,{throttle:1});for(let i=0;i<200;i++){if((await tel(p)).x>88)break;await W(40);}await shot(p,`terrain-climb-${tag}`);await hold(p,{throttle:0});
 // jump: medium kicker
 {const kmh=tag==='bmx'?26:30;let got=false;await reset(p,{x:40,z:14,yaw:0,vx:0});
  for(let i=0;i<600&&!got;i++){const t=await tel(p);await hold(p,{throttle:t.speedKmh<kmh?1:0});if(t.ground&&!t.ground[0]&&!t.ground[1]&&t.x>60){await shot(p,`jump-air-${tag}`,{y:+t.y.toFixed(2)});got=true;}await W(15);}
  if(!got)log.push({name:`jump-air-${tag}`,err:'no air frame'});await hold(p,{throttle:0});}
 // wheelie: throttle + lean back, feathered on pitch
 {await reset(p);await hold(p,{throttle:1});for(let i=0;i<120;i++){if((await tel(p)).speedKmh>12)break;await W(40);}let got=false;const t0=Date.now();
  while(Date.now()-t0<5000&&!got){const t=await tel(p);await hold(p,{throttle:Math.max(.2,Math.min(1,.6+(28-t.pitchDeg)*.03)),lean:t.pitchDeg<26?-1:-.3});if(t.pitchDeg>18){await W(250);await shot(p,`wheelie-${tag}`);got=true;}await W(30);}
  if(!got)log.push({name:`wheelie-${tag}`,err:'no wheelie'});await hold(p,{throttle:0,lean:0});}
 await ctx.close();}
// phone clip: brake + throttle burnout, then steer -> donut, in chase
{const vdir=join(OUT,'phone-video');const {ctx,p}=await openPage(b,{viewport:{width:844,height:390},mobile:true,video:vdir});await startRide(p,'bike_emoto');
 const cdp=await ctx.newCDPSession(p);const c=async s=>{const bb=await p.locator(s).first().boundingBox();return [bb.x+bb.width/2,bb.y+bb.height/2]};
 const T=await c('[data-t=throttle]'),B=await c('[data-t=brake]'),R=await c('[data-t=steerRight]:visible');
 const pts={};const send=type=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:Object.entries(pts).map(([id,[x,y]])=>({id:+id,x,y,radiusX:8,radiusY:8,force:1}))});
 await reset(p);const t0=Date.now();log.push({phoneClipStartS:0});
 pts[2]=B;await send('touchStart');await W(300);pts[1]=T;await send('touchStart');await W(2000);await shot(p,'phone-burnout-emoto');
 pts[3]=R;await send('touchStart');let yaw=0,prev=(await tel(p)).yawDeg,mr=0,cr=null;
 for(let i=0;i<120;i++){const t=await tel(p);let d=t.yawDeg-prev;d=((d+540)%360)-180;yaw+=d;prev=t.yawDeg;mr=Math.max(mr,Math.abs(t.rollDeg));if(t.trick.crashed){cr=t.trick.crashed;break;}if(i===60)await shot(p,'phone-donut-emoto');await W(40);}
 for(const k of Object.keys(pts))delete pts[k];await send('touchEnd');await W(800);log.push({phoneDonut:{yawDeg:Math.round(yaw),maxRoll:Math.round(mr),crash:cr,actionS:((Date.now()-t0)/1000).toFixed(1)}});
 await ctx.close();for(const f of readdirSync(vdir))if(f.endsWith('.webm'))renameSync(join(vdir,f),join(OUT,'phone-burnout-donut-full.webm'));}
await b.close();console.log(JSON.stringify(log));
