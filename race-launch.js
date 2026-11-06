// Race owns a viewport portal, independent of workshop transforms/frosted panels.
export function launchRace(placeholder,options){
 const host=document.createElement('div');host.dataset.ride='portal';host.style.cssText='position:fixed;inset:0;z-index:10000;background:#101722;overflow:hidden';document.body.append(host);delete document.body.dataset.wkRacePending;
 let closed=false,stop=null,failing=false,lowDetail=localStorage.getItem('wk-race-low-detail')==='1'||matchMedia('(pointer:coarse)').matches;
 function clear(){host.removeEventListener('webglcontextlost',lost,true);window.removeEventListener('error',error);const old=stop;stop=null;old?.();}
 function screen(title,description,retry=false){host.replaceChildren();const box=document.createElement('section');box.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:22px;max-width:460px;background:#16283de8;border:1px solid #89bdd7;border-radius:15px;color:#edf7ff;font:16px system-ui;text-align:center';const h=document.createElement('h2'),p=document.createElement('p');h.textContent=title;p.textContent=description;box.append(h,p);if(retry){const b=document.createElement('button');b.textContent='Retry — compatibility graphics';b.onclick=()=>{lowDetail=true;localStorage.setItem('wk-race-low-detail','1');start()};box.append(b)}const back=document.createElement('button');back.textContent='Back to Workshop';back.onclick=()=>options.onClose?.();box.append(back);for(const b of box.querySelectorAll('button'))b.style.cssText='margin:6px;padding:10px;border-radius:7px;border:1px solid #8ac8d9;background:#224b56;color:white;cursor:pointer';host.append(box)}
 function fail(e){if(closed||failing)return;failing=true;clear();console.warn('Race launch:',e);screen('Race could not start',e?.message||String(e),true)}
 function lost(e){e.preventDefault();fail(new Error('The graphics context was reset. Retry with compatibility graphics.'))}
 function error(e){if(/ride|rider|crash|three\.module|WebGL/i.test((e.filename||'')+' '+e.message))fail(e.error||new Error(e.message))}
 async function start(){failing=false;clear();screen('Loading race…','Preparing your bike and track.');try{const m=await import('./ride.js');if(closed)return;host.replaceChildren();stop=m.mountRide(host,{...options,lowDetail});host.addEventListener('webglcontextlost',lost,true);window.addEventListener('error',error)}catch(e){fail(e)}}
 start();return()=>{closed=true;clear();host.remove()};
}
globalThis.__WK_LAUNCH_RACE__=launchRace;
