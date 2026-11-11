// Position-based articulated bodies. Metres/seconds; no DOM or rendering dependency.
const length=v=>Math.hypot(...v),sub=(a,b)=>a.map((x,i)=>x-b[i]);
export function constrainedBody(joints,links,{velocity=[0,0,0],angular=0,origin=[0,0,0],ground=()=>0,eject=false,constrain=null}={}){
 const points=Object.fromEntries(Object.entries(joints).map(([key,p])=>{const r=p.position,rel=sub(r,origin);return [key,{position:[...r],velocity:[velocity[0]-angular*rel[1]+(eject?.55:0),velocity[1]+angular*rel[0]+(eject?.7:0),velocity[2]+(eject?.35:0)],radius:p.radius??.05,inv:1/(p.mass||1)}]}));
 const bones=links.map(([a,b,radius=0,min,max])=>({a,b,radius,length:length(sub(points[a].position,points[b].position)),min,max}));
 const neighbours=new Set(bones.flatMap(b=>[b.a+':'+b.b,b.b+':'+b.a])),names=Object.keys(points);let sleeping=false,quiet=0,contacts=0,impacts=[];
 function movePair(a,b,target){const v=sub(b.position,a.position),d=length(v);if(d<1e-9)return;const error=(d-target)/d,total=a.inv+b.inv;for(let k=0;k<3;k++){a.position[k]+=v[k]*error*a.inv/total;b.position[k]-=v[k]*error*b.inv/total}}
 function contact(p){const floor=ground(p.position[0],p.position[2])+p.radius;let hit=false;if(p.position[1]<floor){p.position[1]=floor;hit=true}if(constrain&&constrain(p))hit=true;return hit}
 return {points,step(dt){impacts=[];if(sleeping||dt<=0)return;const n=Math.ceil(Math.min(.05,dt)*180),h=Math.min(.05,dt)/n;
  for(let s=0;s<n;s++){
   const previous={},incoming={},touch=new Set();contacts=0;
   for(const [key,p]of Object.entries(points)){previous[key]=[...p.position];p.velocity[1]-=9.8*h;incoming[key]=[...p.velocity];for(let k=0;k<3;k++)p.position[k]+=p.velocity[k]*h;}
   for(let iteration=0;iteration<14;iteration++){
    for(const b of bones){const a=points[b.a],c=points[b.b],d=length(sub(c.position,a.position));movePair(a,c,b.min!=null?Math.max(b.min,Math.min(b.max,d)):b.length)}
    if(eject)for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){const a=points[names[i]],b=points[names[j]];if(!neighbours.has(names[i]+':'+names[j])&&length(sub(a.position,b.position))<a.radius+b.radius)movePair(a,b,a.radius+b.radius)}
    for(const [key,p]of Object.entries(points))if(contact(p))touch.add(key);
    for(const b of bones)if(b.radius){const a=points[b.a],c=points[b.b];for(const t of [.25,.5,.75]){const x=a.position[0]*(1-t)+c.position[0]*t,z=a.position[2]*(1-t)+c.position[2]*t,y=a.position[1]*(1-t)+c.position[1]*t,depth=ground(x,z)+b.radius-y;if(depth>0){const den=(1-t)**2*a.inv+t*t*c.inv;a.position[1]+=depth*(1-t)*a.inv/den;c.position[1]+=depth*t*c.inv/den;touch.add(b.a);touch.add(b.b)}}}
   }
   for(const [key,p]of Object.entries(points)){
    if(contact(p))touch.add(key);p.velocity=p.position.map((x,i)=>(x-previous[key][i])/h*Math.exp(-.55*h));
    if(touch.has(key)){contacts++;const down=incoming[key][1];const speed=Math.hypot(p.velocity[0],p.velocity[2]),friction=Math.max(0,1-.7*(9.8*h+Math.max(0,-down))/Math.max(.001,speed));p.velocity[0]*=friction;p.velocity[2]*=friction;if(down<0)p.velocity[1]=Math.min(1.2,Math.max(0,-down*.09));if(down< -3.5)impacts.push({point:[...p.position],speed:-down});}
    const speed=length(p.velocity);if(speed>28)p.velocity=p.velocity.map(v=>v*28/speed);
   }
  }
  const energy=Object.values(points).reduce((sum,p)=>sum+length(p.velocity)**2,0);quiet=energy<.05&&contacts>1?quiet+dt:0;if(quiet>.8){sleeping=true;for(const p of Object.values(points))p.velocity=[0,0,0]}
 },relax(){for(let i=0;i<6;i++){for(const b of bones){const a=points[b.a],c=points[b.b],d=length(sub(c.position,a.position));movePair(a,c,b.min!=null?Math.max(b.min,Math.min(b.max,d)):b.length)}for(const p of Object.values(points))contact(p)}},collide(other){for(const a of Object.values(points))for(const b of Object.values(other.points)){const delta=sub(b.position,a.position),d=length(delta),target=a.radius+b.radius;if(d>1e-8&&d<target){const normal=delta.map(v=>v/d),relative=normal.reduce((s,n,i)=>s+n*(b.velocity[i]-a.velocity[i]),0);movePair(a,b,target);if(relative<0){const impulse=-relative*1.05/(a.inv+b.inv);for(let i=0;i<3;i++){a.velocity[i]-=normal[i]*impulse*a.inv;b.velocity[i]+=normal[i]*impulse*b.inv}}sleeping=false;quiet=0;other.wake();}}},wake(){sleeping=false;quiet=0},state(){return {sleeping,contacts,energy:Object.values(points).reduce((sum,p)=>sum+length(p.velocity)**2,0),impacts:impacts.slice(0,6),positions:Object.fromEntries(Object.entries(points).map(([k,p])=>[k,[...p.position]]))}},center(){const ps=Object.values(points);return [0,1,2].map(i=>ps.reduce((s,p)=>s+p.position[i],0)/ps.length)}};
}
export function riderConstraints(joints){
 const links=[['pelvis','chest',.10],['chest','head',.045],['pelvis','head',0,.43,.75]];
 for(const side of ['L','R']){links.push(['chest','shoulder'+side],['pelvis','shoulder'+side],['pelvis','hip'+side],['chest','hip'+side],['shoulder'+side,'elbow'+side,.045],['elbow'+side,'hand'+side,.035],['hip'+side,'knee'+side,.055],['knee'+side,'foot'+side,.04]);for(const [a,b,c]of [['shoulder','elbow','hand'],['hip','knee','foot']]){const total=length(sub(joints[a+side].position,joints[b+side].position))+length(sub(joints[b+side].position,joints[c+side].position));links.push([a+side,c+side,0,total*.18,total*.995])}}
 links.push(['shoulderL','shoulderR'],['hipL','hipR'],['shoulderL','hipR'],['shoulderR','hipL']);return links;
}
