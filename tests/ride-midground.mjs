// Mid-ground park sits on the graffiti-wall cap, between the wall and the far city.
// The chain fence moves to the back of that terrace. Road, sky and painted city stay put.
import {launchBrowser,pageOptions} from './_browser.mjs';
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
  await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');
  await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
  await p.evaluate(()=>globalThis.__WK_EQUIP__?.('bike_trax_lime'));
  await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
  await p.waitForFunction(()=>globalThis.__WK_RIDE_STATE__?.().backdropLoaded&&globalThis.__WK_RIDE_SCENE__,null,{timeout:90000});
  await p.waitForTimeout(800);
  await p.getByRole('button',{name:'Pause ride',exact:true}).click();
  await p.waitForTimeout(200);
  const look=await p.evaluate(()=>{
    const {scene}=__WK_RIDE_SCENE__();
    const env=__WK_RIDE_STATE__().environment||{};
    const names=[];const items={};
    const worldPt=(o,i=0)=>{
      o.updateWorldMatrix(true,false);
      if(o.isInstancedMesh&&o.instanceMatrix){const arr=o.instanceMatrix.array,j=Math.min(i,Math.max(0,o.count-1))*16,x=arr[j+12],y=arr[j+13],z=arr[j+14],b=o.matrixWorld.elements;
        return {x:b[0]*x+b[4]*y+b[8]*z+b[12],y:b[1]*x+b[5]*y+b[9]*z+b[13],z:b[2]*x+b[6]*y+b[10]*z+b[14]}}
      if(o.geometry?.attributes?.position){const a=o.geometry.attributes.position,v={x:a.getX(i),y:a.getY(i),z:a.getZ(i)},e=o.matrixWorld.elements;return {x:e[0]*v.x+e[4]*v.y+e[8]*v.z+e[12],y:e[1]*v.x+e[5]*v.y+e[9]*v.z+e[13],z:e[2]*v.x+e[6]*v.y+e[10]*v.z+e[14]}}
      const e=o.matrixWorld.elements;return {x:e[12],y:e[13],z:e[14]};
    };
    scene.traverse(o=>{
      if(!o.name||!o.name.startsWith('environment:'))return;
      names.push(o.name);
      const w=worldPt(o);
      const rec=items[o.name]||(items[o.name]={count:0,z:[],y:[]});
      rec.count++;rec.z.push(+w.z.toFixed(3));rec.y.push(+w.y.toFixed(3));
    });
    const mid=names.includes('environment:midground');
    const deck=items['environment:midground-deck'];
    const wall=items['environment:graffiti-wall'];
    const fence=items['environment:chain-fence'];
    const sky=items['environment:skyline'];
    const mean=a=>a&&a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
    const fenceZ=mean(fence?.z),wallZ=mean(wall?.z),deckY=mean(deck?.y),wallY=mean(wall?.y);
    return {
      midground:mid&&env.midground===true,
      hasDeck:!!deck,
      hasCar:!!items['environment:midground-car'],
      hasBowl:!!items['environment:midground-bowl'],
      hasJump:!!items['environment:midground-jump'],
      fenceBehindWall:fenceZ!=null&&wallZ!=null&&fenceZ<wallZ-4,
      deckAboveRoad:deckY!=null&&deckY>1.2,
      skylineBehindFence:sky!=null&&mean(sky.z)<(fenceZ??0)-20,
      fenceZ,wallZ,deckY,
      sections:env.sections?.length
    };
  });
  assert(look.midground,name+' mid-ground group missing');
  assert(look.hasDeck,name+' mid-ground deck missing');
  assert(look.hasCar,name+' parked cars missing');
  assert(look.hasBowl,name+' skate bowl missing');
  assert(look.hasJump,name+' dirt jumps missing');
  assert(look.fenceBehindWall,name+' fence should sit at the back of the terrace '+JSON.stringify({fenceZ:look.fenceZ,wallZ:look.wallZ}));
  assert(look.deckAboveRoad,name+' deck should sit on the wall cap '+look.deckY);
  assert(look.skylineBehindFence,name+' city stays behind the fence');
  if(shots){
    await p.screenshot({path:shots+'/'+name+'-side.png'});
    await p.evaluate(()=>__WK_SCENE_VIEW__('chase'));
    await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraBlend===1);
    await p.waitForTimeout(200);
    await p.screenshot({path:shots+'/'+name+'-chase.png'});
    await p.evaluate(()=>__WK_SCENE_VIEW__('side'));
    await p.waitForFunction(()=>__WK_RIDE_STATE__().cameraBlend===0);
  }
  assert.deepEqual(errors,[]);
  results.push({name,...look});
  await p.close();
 }
 console.log(JSON.stringify({rideMidground:true,results}));
}finally{await browser.close()}
