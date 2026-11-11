// v33e: Playground surfaces are a single layer each. Textures, look, FPS, quick A–D.
import {launchBrowser,pageOptions} from './_browser.mjs';
import assert from 'node:assert/strict';

const base=process.env.WK_TEST_URL||'http://127.0.0.1:8931/';
const browser=await launchBrowser();
const p=await browser.newPage(pageOptions({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'}));
const errors=[];p.on('pageerror',e=>errors.push(String(e.message||e)));
await p.goto(base.replace(/\/?$/,'/')+'?track=arena&physics=jolt',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_emoto'));
await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.()?.physicsReady&&__WK_RIDE_STATE__().physics==='jolt'&&__WK_RIDE_STATE__().backdropLoaded,null,{timeout:90000});

const look=await p.evaluate(()=>{
  const st=__WK_RIDE_STATE__();
  const names=[];
  const layers=[];
  const scene=__WK_RIDE_SCENE__?.()?.scene;
  scene?.traverse(o=>{
    if(!o.name)return;
    if(/^(environment:|wk:world-sky|wk:environment)/.test(o.name)) names.push(o.name);
    if(o.isMesh&&/arena-floor|arena-track|track-dash|track-edge|runway|jump-shadow|jump-edge|jump:|skyline|building:|world-sky/.test(o.name)){
      const mat=o.material||{};
      layers.push({
        name:o.name, type:o.type,
        color:mat.color?('#'+mat.color.getHexString()):null,
        map:mat.map?.image?.src||mat.map?.source?.data?.src||(mat.map?'tex':null),
        vertexColors:!!mat.vertexColors,
        y:o.position?.y
      });
    }
  });
  const lights=[];
  let hemi=0,ambient=0,fill=0,dir=0;
  scene?.traverse(o=>{
    if(o.isHemisphereLight){hemi++;lights.push({type:'hemi',intensity:o.intensity,color:'#'+o.color.getHexString()});}
    else if(o.isAmbientLight){ambient++;lights.push({type:'ambient',intensity:o.intensity});}
    else if(o.isPointLight||o.isSpotLight||o.isRectAreaLight){fill++;lights.push({type:o.type,intensity:o.intensity});}
    else if(o.isDirectionalLight){dir++;lights.push({type:'dir',name:o.name,color:'#'+o.color.getHexString(),intensity:o.intensity,castShadow:!!o.castShadow});}
  });
  const R=__WK_RIDE_SCENE__?.()?.renderer;
  const lighting={
    hemi,ambient,fill,dir,lights,
    toneMapping:R?.toneMapping, exposure:R?.toneMappingExposure,
    output:R?.outputColorSpace, hasEnv:!!scene?.environment, hasBg:!!scene?.background?.isTexture
  };
  return {
    env:st.environment, sky:st.quality?.sky, fps:st.quality?.fps,
    lighting,
    names, layers,
    hasDash:names.some(n=>n.includes('track-dash')),
    hasEdge:names.some(n=>n.includes('track-edge')),
    hasRunway:names.some(n=>n.includes('runway')||n.includes('environment:arrow')),
    hasJumpBody:names.some(n=>/^environment:jump:/.test(n)),
    hasJumpShadow:names.some(n=>n.includes('jump-shadow')||n.includes('jump-edge')),
    hasBuilding:names.some(n=>n.includes('environment:building:')),
    hasSkyline:names.some(n=>n.includes('environment:skyline')),
    hasFloor:names.includes('environment:arena-floor'),
    hasTrack:names.includes('environment:arena-track'),
    hasGradientSky:!!scene?.getObjectByName&&false
  };
});
console.log('look',JSON.stringify({
  env:{trackTex:look.env.trackTex,patchTex:look.env.patchTex,dirtTex:look.env.dirtTex,grassTex:look.env.grassTex,skyline:look.env.skyline,buildings:look.env.buildings,overlays:look.env.overlays,uvWorld:look.env.uvWorld},
  sky:look.sky,fps:look.fps,lighting:look.lighting,
  flags:{hasDash:look.hasDash,hasEdge:look.hasEdge,hasRunway:look.hasRunway,hasJumpBody:look.hasJumpBody,hasJumpShadow:look.hasJumpShadow,hasBuilding:look.hasBuilding,hasSkyline:look.hasSkyline,hasFloor:look.hasFloor,hasTrack:look.hasTrack},
  track:look.layers.filter(l=>l.name.includes('arena-track')),
  floor:look.layers.filter(l=>l.name.includes('arena-floor'))
}));

assert.equal(look.env.trackTex,'Road008A');
assert.equal(look.env.patchTex,'Road008C');
assert.equal(look.env.dirtTex,'Ground086');
assert.equal(look.env.grassTex,'grass_ground');
assert.equal(look.sky,'hdri-sunset_jhbcentral');
assert.equal(look.lighting.hemi,0,'sky-fill must drop once the HDRI env is in');
assert.equal(look.hasFloor,true);
assert.equal(look.hasTrack,true);
assert.equal(look.hasDash,false,'old dash overlay must go');
assert.equal(look.hasEdge,false,'old yellow edge overlay must go');
assert.equal(look.hasRunway,false,'coloured runway tints must go');
assert.equal(look.hasJumpBody,false,'second jump dirt mesh must go');
assert.equal(look.hasJumpShadow,false,'jump shadow/edge planes must go');
assert.equal(look.hasBuilding,false,'old city-block skyline must go');
assert.equal(look.hasSkyline,false,'v33f: black box skyline removed, the HDRI is the skyline');
assert.equal(look.env.skyline||0,0);
assert.equal(look.env.buildings,0);
const track=look.layers.find(l=>l.name==='environment:arena-track');
assert(track,'track mesh');
assert.equal(track.color,'#ffffff','no material colour tint on the road, got '+track.color);

assert.equal(look.lighting.hemi,0,'Playground must not keep the old hemisphere light');
assert.equal(look.lighting.ambient,0,'Playground must not keep an ambient light');
assert.equal(look.lighting.fill,0,'Playground must not keep fill/point/spot lights');
assert.equal(look.lighting.dir,1,'Playground should have exactly one directional sun');
assert.equal(look.lighting.hasEnv,true,'PMREM environment from the HDRI');
assert.equal(look.lighting.toneMapping,4,'ACESFilmicToneMapping (Three enum 4), got '+look.lighting.toneMapping);
assert(look.lighting.exposure>0.5&&look.lighting.exposure<=1.2,'exposure should keep the road dark, got '+look.lighting.exposure);

const fps=[];
for(let i=0;i<8;i++){
  await p.waitForTimeout(200);
  fps.push((await p.evaluate(()=>__WK_RIDE_STATE__().quality?.fps))||0);
}
const fpsOk=fps.filter(v=>v>0);
const fpsMid=fpsOk.sort((a,b)=>a-b)[fpsOk.length>>1]||0;
console.log('fps',JSON.stringify({fps,fpsMid}));
assert(fpsMid>40||fpsOk.every(v=>v===0),'FPS should stay comfortable, mid='+fpsMid+' samples='+JSON.stringify(fps));

// quick A–D
const hold=(patch)=>p.evaluate(patch=>__WK_RIDE_HOLD__({clearKeys:true,...patch}),patch);
const reset=(pose)=>p.evaluate(pose=>__WK_JOLT_RESET__(pose),pose);
const sample=()=>p.evaluate(()=>{const st=__WK_RIDE_STATE__();const s=st.s;return {x:s.x,y:s.y,vx:s.vx,crashed:!!s.crashed,apiAir:!!(st.jolt&&st.jolt.air),air:s.air,ground:s.ground,handovers:st.jolt?.handovers};});
await hold({throttle:0,brake:0,steer:0});
await reset({x:70,z:0,yaw:0,vx:15.5,vy:0,pitch:0,w:0,air:0,crashed:null,ground:[true,true]});
const cruise=async()=>{
  await p.evaluate(()=>{
    const vx=__WK_RIDE_STATE__().s.vx||0;
    let throttle=0.28, brake=0;
    if(vx<14.2) throttle=0.7;
    else if(vx<15.1) throttle=0.4;
    else if(vx>16.4) brake=0.25;
    else if(vx>15.9) throttle=0.1;
    __WK_RIDE_HOLD__({throttle,brake,steer:0});
  });
};
let peakY=0,past=false,landed=false;
for(let i=0;i<90;i++){
  await cruise();
  const s=await sample();
  peakY=Math.max(peakY,s.y);
  if(s.x>118) past=true;
  if(past&&s.x>122&&!s.apiAir&&(s.ground&&(s.ground[0]||s.ground[1]))) landed=true;
  if(s.crashed) break;
  if(landed&&s.x>128) break;
  await p.waitForTimeout(80);
}
const d=await sample();
console.log('AD',JSON.stringify({peakY,past,landed,x:d.x,vx:d.vx,crashed:d.crashed,handovers:d.handovers}));
assert(!d.crashed,'A-D: must not crash');
assert(past||d.x>118,'A-D: should reach the lip, x='+d.x);
assert(errors.length===0,'page errors: '+errors.join(' | '));
await browser.close();
console.log('v33e-cleanup ok');
