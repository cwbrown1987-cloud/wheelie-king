// Monotone cubic rounding: smooth joins without overshooting peaks/valleys.
export function roundedProfile(control,spacing=.2){
 const n=control.length,d=control.slice(1).map((p,i)=>(p[1]-control[i][1])/(p[0]-control[i][0])),m=control.map((_,i)=>!i||i===n-1||d[i-1]*d[i]<=0?0:2/(1/d[i-1]+1/d[i]));
 function segment(x){let lo=0,hi=n-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(control[mid][0]<=x)lo=mid;else hi=mid}return lo}
 function sample(x,derivative=false){if(x<=control[0][0])return derivative?0:control[0][1];if(x>=control[n-1][0])return derivative?0:control[n-1][1];const i=segment(x),[x0,y0]=control[i],[x1,y1]=control[i+1],w=x1-x0,t=(x-x0)/w,t2=t*t,t3=t2*t;
  return derivative?((6*t2-6*t)*y0+(3*t2-4*t+1)*w*m[i]+(-6*t2+6*t)*y1+(3*t2-2*t)*w*m[i+1])/w:(2*t3-3*t2+1)*y0+(t3-2*t2+t)*w*m[i]+(-2*t3+3*t2)*y1+(t3-t2)*w*m[i+1];
 }
 const pts=[];for(let i=0;i<n-1;i++){const count=Math.ceil((control[i+1][0]-control[i][0])/spacing);for(let j=0;j<count;j++){const x=control[i][0]+(control[i+1][0]-control[i][0])*j/count;pts.push([x,sample(x)])}}pts.push([...control[n-1]]);
 return {pts,h:x=>sample(x),slope:x=>Math.atan(sample(x,true))};
}
