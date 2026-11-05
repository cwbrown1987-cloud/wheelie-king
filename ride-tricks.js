// Visual stunt transforms are restored before each mechanical update.
// The 2D contact model remains stable while parts animate around the steerer.
export function makeStuntRig(T,bike,A,motorKind){
 const fixed=new Set(['wk:cockpit','wk:suspension','wk:brakes','wk:tyres','wk:part:stem','wk:part:headset','wk:part:number_plate','wk:part:lights','wk:throttle','wk:stand']);
 const tail=bike.children.filter(o=>!fixed.has(o.name)&&!(o.name==='wk:motor'&&motorKind==='front'));
 const bars=bike.children.filter(o=>['wk:cockpit','wk:suspension','wk:part:stem','wk:throttle','wk:part:number_plate'].includes(o.name)||o.name==='wk:motor'&&motorKind==='front');
 for(const group of bike.children.filter(o=>o.name==='wk:tyres'))for(const wheel of group.children)if(wheel.userData.wkWheel)(Math.abs(wheel.position.x-A.frontAxle[0])<.1?bars:tail).push(wheel);
 bike.updateWorldMatrix(true,true);
 for(const o of bike.getObjectByName('wk:brakes')?.children||[]){const p=bike.worldToLocal(new T.Box3().setFromObject(o).getCenter(new T.Vector3()));(Math.abs(p.x-A.frontAxle[0])<Math.abs(p.x-A.rearAxle[0])?bars:tail).push(o);}
 const center=new T.Vector3(...A.headTop,0),axis=A.headBottom?new T.Vector3(A.headTop[0]-A.headBottom[0],A.headTop[1]-A.headBottom[1],0).normalize():new T.Vector3(0,1,0);let saved=[],state={name:'',angle:0,parts:0};
 return {
  restore(){for(const {o,matrix,auto}of saved){o.matrix.copy(matrix);o.matrixAutoUpdate=auto;o.matrixWorldNeedsUpdate=true}saved=[];state={name:'',angle:0,parts:0}},
  pose(stunt){if(!stunt||!['tailwhip','barspin'].includes(stunt.name))return;bike.updateWorldMatrix(true,true);const t=Math.max(0,Math.min(1,stunt.elapsed/stunt.duration)),rotation=new T.Matrix4().makeTranslation(...center.toArray()).multiply(new T.Matrix4().makeRotationAxis(axis,Math.PI*2*t*t*(3-2*t))).multiply(new T.Matrix4().makeTranslation(-center.x,-center.y,-center.z)),inverseBike=bike.matrixWorld.clone().invert();
   for(const o of stunt.name==='tailwhip'?tail:bars){if(o.matrixAutoUpdate)o.updateMatrix();saved.push({o,matrix:o.matrix.clone(),auto:o.matrixAutoUpdate});const parent=inverseBike.clone().multiply(o.parent.matrixWorld);o.matrix.premultiply(parent.clone().invert().multiply(rotation).multiply(parent));o.matrixAutoUpdate=false;o.matrixWorldNeedsUpdate=true;}state={name:stunt.name,angle:Math.PI*2*t*t*(3-2*t),parts:saved.length};
  },
  state:()=>state,
 };
}
