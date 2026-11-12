import {launch,openPage,startRide,tel,reset} from './qa-lib.mjs';const W=ms=>new Promise(r=>setTimeout(r,ms));
const b=await launch();const {ctx,p}=await openPage(b,{viewport:{width:844,height:390},mobile:true});await startRide(p,'bike_emoto');
const cdp=await ctx.newCDPSession(p);const c=async s=>{const bb=await p.locator(s).first().boundingBox();return bb?[bb.x+bb.width/2,bb.y+bb.height/2]:null};
const tap=async([x,y])=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:7,x,y}]});await W(80);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
await reset(p);const out=[];
await tap(await c('[data-r=tricks]'));await W(300);const S=await c('.ride-tricks [data-t=stand]');out.push({S,hit:await p.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e?.outerHTML.slice(0,120)},S)});
await tap(S);for(const ms of [50,400,1200]){await W(ms);const t=await tel(p);out.push({ms,tog:t.trick.toggles,standing:t.trick.standing,open:await p.evaluate(()=>__WK_RIDE_STATE__().tricksOpen)});}
console.log(JSON.stringify(out));await b.close();
