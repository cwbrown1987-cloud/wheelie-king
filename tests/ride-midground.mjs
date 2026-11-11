// Mid-ground is a painted parallax strip between the wall cap and the painted city.
import {launchBrowser,pageOptions,withLegacy} from './_browser.mjs';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

const shots=process.env.WK_MIDGROUND_SHOTS;
if(shots)mkdirSync(shots,{recursive:true});
const browser=await launchBrowser();
try{
 const results=[];
 for(const [name,vp] of [['desktop',{width:1280,height:720}],['phone',{width:844,height:390,hasTouch:true,isMobile:true}]]){
  const p=await browser.newPage(pageOptions({viewport:{width:vp.width,height:vp.height},hasTouch:!!vp.hasTouch,isMobile:!!vp.isMobile,deviceScaleFactor:1,serviceWorkers:'block'}));
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{localStorage.setItem('wk-level','trials')});
  await p.goto(withLegacy(process.env.WK_TEST_URL||'http://127.0.0.1:8931/'));
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded&&globalThis.__WK_RIDE_SCENE__,null,{timeout:90000});
  await p.waitForFunction(()=>{
    const {scene}=__WK_RIDE_SCENE__();
    let strip=null;scene.traverse(o=>{if(o.name==='environment:midground-strip')strip=o});
    return !!(strip?.material?.map);
  },null,{timeout:20000});
  await p.waitForTimeout(400);
  const look=await p.evaluate(()=>{
    const {scene}=__WK_RIDE_SCENE__();
    const env=__WK_RIDE_STATE__().environment||{};
    let strip=null,wall=null,sky=0;
    const names=[];
    scene.traverse(o=>{
      if(!o.name||!o.name.startsWith('environment:'))return;
      names.push(o.name);
      if(o.name==='environment:midground-strip')strip=o;
      if(o.name==='environment:graffiti-wall')wall=o;
    });
    if(strip)strip.updateWorldMatrix(true,false);
    if(wall)wall.updateWorldMatrix(true,false);
    const stripZ=strip?.matrixWorld.elements[14]??null;
    const wallZ=wall?.matrixWorld.elements[14]??null;
    const tex=strip?.material?.map;
    return {
      midground:env.midground===true && names.includes('environment:midground'),
      hasStrip:!!strip && !!tex,
      stripVisible:!!strip?.visible && (strip?.material?.opacity??0)>.5,
      hasCar:names.includes('environment:midground-car'),
      hasBowl:names.includes('environment:midground-bowl'),
      hasJump:names.includes('environment:midground-jump'),
      stripBehindWall:stripZ!=null&&wallZ!=null&&stripZ<wallZ-1,
      cityKept:env.far===true,
      texSize:tex?{w:tex.image?.width||0,h:tex.image?.height||0}:null,
      stripZ,wallZ,opacity:strip?.material?.opacity??null
    };
  });
  if(shots){
    await p.screenshot({path:shots+'/'+name+'-side.png'});
    await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
    await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraBlend===1);
    await p.waitForTimeout(200);
    await p.screenshot({path:shots+'/'+name+'-chase.png'});
    await p.evaluate(()=>__WK_SCENE_VIEW__('side'));
    await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraBlend===0);
  }
  assert(look.midground,name+' mid-ground group missing '+JSON.stringify(look));
  assert(look.hasStrip,name+' painted mid-ground strip missing '+JSON.stringify(look));
  assert(look.stripVisible,name+' painted mid-ground should show in side view '+JSON.stringify(look));
  assert(!look.hasCar,name+' procedural cars should be gone '+JSON.stringify(look));
  assert(!look.hasBowl,name+' procedural bowls should be gone '+JSON.stringify(look));
  assert(!look.hasJump,name+' procedural dirt mounds should be gone '+JSON.stringify(look));
  assert(look.stripBehindWall,name+' strip should sit behind the wall '+JSON.stringify(look));
  assert(look.cityKept,name+' painted city layer should stay '+JSON.stringify(look));
  assert.deepEqual(errors,[]);
  results.push({name,...look});
  await p.close();
 }
 console.log(JSON.stringify({rideMidground:true,results}));
}finally{await browser.close()}
