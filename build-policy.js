import {part,baseId} from './modular-catalogue.js';
// A frame's recommended power rating is distinct from hard mechanical/electrical fitment.
export function powerPolicy(before,next,{mode='simple',crazy=false}={}){
 const frame=part(next.frame),motor=part(next.motor),overrated=!!(frame?.maxW&&motor?.w>frame.maxW);
 const unchanged=baseId(before.frame)===baseId(next.frame)&&baseId(before.motor)===baseId(next.motor);
 const allowed=!overrated||unchanged||(mode==='simple'&&crazy);
 return {allowed,overrated,reason:allowed?'':'Above frame power rating · extra-crazy builds are available in Basic mode.'};
}
export function proposedBuild(build,id){const p=part(id);if(!p)return build;const next=p.completeBike?{}:{...build};if(p.slot==='kit')for(const c of p.kit||[]){const q=part(c);if(q)next[q.slot]=c}else next[p.slot]=id;
 if(p.slot==='frame')for(const [slot,value]of Object.entries(next))if(slot!=='frame'&&value&&globalThis.__WK_FIT__?.(next,value).status==='no')delete next[slot];return next;
}
