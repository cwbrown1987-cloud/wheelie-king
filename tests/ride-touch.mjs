import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:680},hasTouch:true,serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('wk-builder-mode','advanced'));await page.goto('http://127.0.0.1:8931/');await page.waitForFunction(()=>globalThis.__WK_VIEW__);
 await page.locator('[data-cat="bars"]').click();await page.waitForFunction(()=>globalThis.__WK_EQUIP__);await page.evaluate(()=>__WK_EQUIP__('bike_trax_lime'));
 await page.locator('[data-catpanel="1"]').getByRole('button',{name:/BACK/}).click();await page.getByRole('button',{name:'Test ride',exact:true}).click();await page.waitForFunction(()=>globalThis.__WK_RIDE_STATE__);
 const gas=await page.locator('[data-t="throttle"]').boundingBox(),lean=await page.locator('[data-t="leanBack"]').boundingBox();
 const cdp=await page.context().newCDPSession(page),points=[{id:11,x:gas.x+gas.width/2,y:gas.y+gas.height/2},{id:22,x:lean.x+lean.width*.15,y:lean.y+lean.height/2}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await page.waitForFunction(()=>__WK_RIDE_STATE__().inp.throttle===1&&__WK_RIDE_STATE__().inp.lean>.5);
 await page.waitForTimeout(900);
 assert.equal(await page.evaluate(()=>getSelection().toString()),'');
 const blocked=await page.evaluate(()=>{const el=document.querySelector('[data-t="throttle"]');return ['selectstart','contextmenu','gesturestart','touchmove'].every(type=>!el.dispatchEvent(new Event(type,{bubbles:true,cancelable:true})))&&getComputedStyle(el).userSelect==='none'&&getComputedStyle(el).touchAction==='none'});assert(blocked);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[points[1]]});
  await page.waitForFunction(()=>__WK_RIDE_STATE__().inp.throttle===1&&__WK_RIDE_STATE__().inp.lean===0);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>__WK_RIDE_STATE__().inp.throttle===0);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});await page.waitForFunction(()=>__WK_RIDE_STATE__().inp.throttle===1);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForFunction(()=>__WK_RIDE_STATE__().inp.throttle===0);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 await page.locator('[data-r="back"]').tap();await page.waitForFunction(()=>!document.querySelector('[data-wk-ride-surface]'));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({twoFingerGasAndLean:true,noSelection:true,noContextMenu:true,independentRelease:true,blurReleases:true,cleanup:true,errors}));
}finally{await browser.close();}
