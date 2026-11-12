// v2.0.1 after-shots on the live beta: terrain up/down, jump mid-air per bike, phone wheelie + video.
import {launch,openPage,startRide,tel,reset,hold} from './qa-lib.mjs';import {mkdirSync,readdirSync,renameSync} from 'node:fs';import {join} from 'node:path';
const OUT=process.env.WK_SHOTS||'shots-201';mkdirSync(OUT,{recursive:true});const W=ms=>new Promise(r=>setTimeout(r,ms));const log=[];
const b=await launch();
const ONLYJ=process.env.CAP_JUMPS==='1';
for(const ride of ['bike_emoto','bike_bmx']){const tag=ride.replace('bike_','');const {ctx,p}=await openPage(b,{});await startRide(p,ride);
 await p.evaluate(()=>__WK_SCENE_VIEW__?.('chase'));await W(500);
 if(!ONLYJ){ // uphill
 await reset(p,{x:68,z:-30,yaw:0,vx:0});await hold(p,{throttle:1});for(let i=0;i<200;i++){const t=await tel(p);if(t.x>88)break;await W(40);}
 await p.screenshot({path:join(OUT,`terrain-uphill-${tag}.png`)});await hold(p,{throttle:0});
 // downhill
 await reset(p,{x:126,z:-30,yaw:0,vx:4});await hold(p,{throttle:.3});await W(1300);await p.screenshot({path:join(OUT,`terrain-downhill-${tag}.png`)});await hold(p,{throttle:0});}
 // jump: medium kicker at ~28 km/h (bmx 24)
 const kmh=tag==='bmx'?26:30;let shot=false;await reset(p,{x:40,z:14,yaw:0,vx:0});
 for(let i=0;i<600&&!shot;i++){const t=await tel(p);await hold(p,{throttle:t.speedKmh<kmh?1:0});if(t.ground&&!t.ground[0]&&!t.ground[1]&&t.x>60){await p.screenshot({path:join(OUT,`jump-midair-${tag}.png`)});shot=true;log.push({tag,jump:{x:t.x,y:t.y,kmh:t.speedKmh}});}await W(15);}
 if(!shot)log.push({tag,jump:'no air frame caught'});await hold(p,{throttle:0});await ctx.close();}
// phone: wheelie by thumb drag, recorded
{const vdir=join(OUT,'phone-video');const {ctx,p}=await openPage(b,{viewport:{width:844,height:390},mobile:true,video:vdir});await startRide(p,'bike_emoto');
 const cdp=await ctx.newCDPSession(p);const bb=await p.locator('[data-t=throttle]').first().boundingBox();const T={x:bb.x+bb.width/2,y:bb.y+bb.height/2};
 const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y])=>({id:1,x,y,radiusX:8,radiusY:8,force:1}))});
 await reset(p,{x:0,z:0,yaw:0,vx:0});await touch('touchStart',[[T.x,T.y]]);for(let i=0;i<80;i++){if((await tel(p)).speedKmh>12)break;await W(50);}
 let dy=0,shot=false,maxP=0;const t0=Date.now();
 while(Date.now()-t0<6000){const t=await tel(p);maxP=Math.max(maxP,t.pitchDeg);const want=Math.max(0,Math.min(90,45+(26-t.pitchDeg)*2.5));if(Math.abs(want-dy)>3){dy=want;await touch('touchMove',[[T.x,T.y+dy]]);}
  if(!shot&&t.pitchDeg>18){await p.screenshot({path:join(OUT,'phone-wheelie-emoto.png')});shot=true;}await W(30);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await W(1500);log.push({phoneWheelie:{shot,maxPitch:maxP}});
 await ctx.close();for(const f of readdirSync(vdir))if(f.endsWith('.webm'))renameSync(join(vdir,f),join(OUT,'phone-wheelie.webm'));}
await b.close();console.log(JSON.stringify(log));
