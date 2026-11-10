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
    const names=[];
    const worldVerts=o=>{
      const out=[];
      if(!o?.geometry?.attributes?.position)return out;
      o.updateWorldMatrix(true,false);
      const a=o.geometry.attributes.position,e=o.matrixWorld.elements;
      for(let i=0;i<a.count;i++){
        const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
        out.push({lx:x,ly:y,lz:z,x:e[0]*x+e[4]*y+e[8]*z+e[12],y:e[1]*x+e[5]*y+e[9]*z+e[13],z:e[2]*x+e[6]*y+e[10]*z+e[14]});
      }
      return out;
    };
    const mean=a=>a&&a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
    let deckV=[],wallV=[],fenceV=[],skyZ=[];
    const has={car:false,bowl:false,jump:false,mid:false,deck:false};
    scene.traverse(o=>{
      if(!o.name||!o.name.startsWith('environment:'))return;
      names.push(o.name);
      if(o.name==='environment:midground')has.mid=true;
      if(o.name==='environment:midground-deck'){has.deck=true;deckV=deckV.concat(worldVerts(o))}
      if(o.name==='environment:graffiti-wall')wallV=wallV.concat(worldVerts(o));
      if(o.name==='environment:chain-fence')fenceV=fenceV.concat(worldVerts(o));
      if(o.name==='environment:skyline'&&o.isInstancedMesh&&o.instanceMatrix){
        o.updateWorldMatrix(true,false);
        const arr=o.instanceMatrix.array,b=o.matrixWorld.elements;
        for(let i=0;i<o.count;i++){const j=i*16,x=arr[j+12],y=arr[j+13],z=arr[j+14];skyZ.push(b[2]*x+b[6]*y+b[10]*z+b[14])}
      }
      if(o.name==='environment:midground-car')has.car=true;
      if(o.name==='environment:midground-bowl')has.bowl=true;
      if(o.name==='environment:midground-jump')has.jump=true;
    });
    const wallZ=mean(wallV.map(v=>v.z)),fenceZ=mean(fenceV.map(v=>v.z));
    const wallTopY=mean(wallV.filter((_,i)=>i%2===1).map(v=>v.y));
    const deckY=mean(deckV.map(v=>v.y));
    const deckZMin=deckV.length?Math.min(...deckV.map(v=>v.z)):null;
    const deckZMax=deckV.length?Math.max(...deckV.map(v=>v.z)):null;
    return {
      midground:has.mid&&env.midground===true,
      hasDeck:has.deck&&deckV.length>8,
      hasCar:has.car,
      hasBowl:has.bowl,
      hasJump:has.jump,
      fenceBehindWall:fenceZ!=null&&wallZ!=null&&fenceZ<wallZ-4,
      deckOnWallCap:deckY!=null&&wallTopY!=null&&Math.abs(deckY-wallTopY)<.25,
      deckBehindWall:deckZMax!=null&&wallZ!=null&&deckZMax<wallZ+0.1,
      skylineBehindFence:skyZ.length&&fenceZ!=null&&mean(skyZ)<fenceZ-20,
      fenceZ,wallZ,deckY,wallTopY,deckZMin,deckZMax,deckVerts:deckV.length,
      sample:deckV[0]||null,
      sections:env.sections?.length
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
  assert(look.hasDeck,name+' mid-ground deck missing '+JSON.stringify(look));
  assert(look.hasCar,name+' parked cars missing '+JSON.stringify(look));
  assert(look.hasBowl,name+' skate bowl missing '+JSON.stringify(look));
  assert(look.hasJump,name+' dirt jumps missing '+JSON.stringify(look));
  assert(look.fenceBehindWall,name+' fence should sit at the back of the terrace '+JSON.stringify(look));
  assert(look.deckOnWallCap,name+' deck should sit on the wall cap '+JSON.stringify(look));
  assert(look.deckBehindWall,name+' deck should sit behind the wall '+JSON.stringify(look));
  assert(look.skylineBehindFence,name+' city stays behind the fence '+JSON.stringify(look));
    assert.deepEqual(errors,[]);
  results.push({name,...look});
  await p.close();
 }
 console.log(JSON.stringify({rideMidground:true,results}));
}finally{await browser.close()}
