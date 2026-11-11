// v2.0 Playground rider (Quaternius UBC, CC0): IK poses from the bike's part attach points.
// Seated, stand (upright on the pegs), lean forward, one-hander (C), knee-knock (X), wheelie. Stills to WK_SHOT_DIR.
import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
import {launchBrowser,pageOptions} from './_browser.mjs';
const dir=process.env.WK_SHOT_DIR||'';if(dir)mkdirSync(dir,{recursive:true});
const browser=await launchBrowser();
const out={};
try{for(const bike of (process.env.WK_BIKES||'stock,bike_trax_lime').split(',')){
 const p=await browser.newPage(pageOptions({viewport:{width:1280,height:720},deviceScaleFactor:1,serviceWorkers:'block'}));
 const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await p.addInitScript(()=>localStorage.setItem('wk-level','arena'));
 await p.goto(process.env.WK_TEST_URL||'http://127.0.0.1:8931/');await p.waitForFunction(()=>document.querySelector('[data-wk-room-ready]'),null,{timeout:180000});
 if(bike!=='stock')await p.evaluate(b=>globalThis.__WK_EQUIP__?.(b),bike);
 await p.getByRole('button',{name:'⚑ Race',exact:true}).click();
 await p.waitForFunction(()=>{const t=globalThis.__WK_TELEMETRY__?.();return t&&t.ready&&t.rider?.loaded},null,{timeout:120000});
 await p.waitForTimeout(800);
 const st=()=>p.evaluate(()=>{const r=__WK_TELEMETRY__().rider;return {w:r.weights,pitch:+r.pitchDeg.toFixed(1),handErr:r.handErrM.map(v=>+v.toFixed(3)),footErr:r.footErrM.map(v=>+v.toFixed(3)),hipY:+r.hipWorld[1].toFixed(3)}});
 const shot=async n=>{if(dir)await p.screenshot({path:`${dir}/pose-${bike}-${n}.png`});out[bike+":"+n]=await st();if(n==="stand")out.attach=await p.evaluate(()=>({a:__WK_TELEMETRY__().rider.attach,leg:__WK_TELEMETRY__().rider.legLen,hip:__WK_TELEMETRY__().rider.hip,A:__WK_TELEMETRY__().attach}));};
 await shot('seated');
 await p.keyboard.press('Shift');await p.waitForTimeout(900);await shot('stand');await p.keyboard.press('Shift');await p.waitForTimeout(700);
 await p.keyboard.down('ArrowUp');await p.waitForTimeout(800);await shot('lean-forward');await p.keyboard.up('ArrowUp');
 await p.keyboard.down('c');await p.waitForTimeout(800);await shot('one-hand');await p.keyboard.up('c');
 await p.keyboard.down('x');await p.waitForTimeout(800);await shot('knee-knock');await p.keyboard.up('x');await p.waitForTimeout(500);
 await p.keyboard.down('w');await p.waitForTimeout(1200);await p.keyboard.press('Control');
 for(let i=0;i<30;i++){await p.waitForTimeout(80);const t=await p.evaluate(()=>__WK_TELEMETRY__());if(t.pitchDeg>12)break;}
 await p.keyboard.up('w');await shot('wheelie');
 out[bike+':errors']=errors;await p.close();
 const g=n=>out[bike+':'+n],ok=(n,e,hands=[0,1])=>{for(const i of hands)assert(g(n).handErr[i]<0.03,`${bike} ${n} hand ${i} off the grip by ${g(n).handErr[i]} m`);for(const i of [0,1])assert(g(n).footErr[i]<0.03,`${bike} ${n} foot ${i} off by ${g(n).footErr[i]} m`);assert(g(n).w[e]>0.85||e==='seated',`${bike} ${n} weight ${JSON.stringify(g(n).w)}`)};
 ok('seated','seated');ok('stand','stand');ok('lean-forward','lean');ok('one-hand','oneHand',[0]);ok('knee-knock','kneeKnock');ok('wheelie','wheelie');
 assert(g('stand').hipY>g('seated').hipY+0.15,`${bike} stand should lift the hips clear of the seat (${g('seated').hipY} -> ${g('stand').hipY})`);
 assert(g('one-hand').handErr[1]>0.3,'one-hander: right hand leaves the bar');
 assert.deepEqual(errors,[],bike+' page errors');}
 console.log(JSON.stringify(out));
}finally{await browser.close()}
