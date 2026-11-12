// Playground ground material (v2.1-10): one MeshStandardMaterial that blends five CC0 ambientCG
// textures by a per-vertex `splat` weight, in world space (no UVs needed, nothing stretches on slopes).
//   splat.x grass (Grass004)   splat.y dirt road (Ground054)   splat.z rock (Rock051)
//   splat.w mud (Ground109)    leftover weight = gravel (Gravel041)
// Each layer is sampled at two scales and mixed by a low-frequency noise so the tiling doesn't show,
// and grass breaks up into worn dirt patches on its own.
const SETS={
  grass:{id:'Grass004',scale:3.2},dirt:{id:'Ground054',file:'Ground054_1K-JPG',scale:3},rock:{id:'Rock051',scale:5},
  mud:{id:'Ground109',scale:3},gravel:{id:'Gravel041',scale:2.5},
};
export const GROUND_TEXTURES=Object.values(SETS).flatMap(s=>['Color'].map(k=>`./assets/ambientcg/${s.id}/${s.file||s.id}_${k}.jpg`));
export function makeSplatMaterial(T,{lowDetail=false}={}){
  const texs=[];
  const load=(id,kind,srgb,file=id)=>{const t=new T.TextureLoader().load(`./assets/ambientcg/${id}/${file}_${kind}.jpg`);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(srgb)t.colorSpace=T.SRGBColorSpace;texs.push(t);return t;};
  const keys=Object.keys(SETS),uniforms={};
  for(const k of keys){uniforms['c_'+k]={value:load(SETS[k].id,'Color',true,SETS[k].file||SETS[k].id)};uniforms['s_'+k]={value:1/SETS[k].scale};}
  // v2.1-21: every layer has its own normal map (blended by the same weights) and its own roughness, so
  // gravel, rock and mud catch the light differently instead of one flat sheet. Low detail: one shared normal.
  const normal=load('Grass004','NormalGL',false);
  const nmap=lowDetail?{}:Object.fromEntries(keys.filter(k=>k!=='grass').map(k=>[k,load(SETS[k].id,'NormalGL',false,SETS[k].file||SETS[k].id)]));
  const mat=new T.MeshStandardMaterial({color:0xffffff,roughness:.95,metalness:0});
  mat.name='wk:splat-ground';
  mat.customProgramCacheKey=()=>'wk-splat-'+(lowDetail?1:0);
  mat.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,uniforms);
    sh.uniforms.n_detail={value:normal};for(const [k,t] of Object.entries(nmap))sh.uniforms['n_'+k]={value:t};
    sh.vertexShader=sh.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec4 splat;\nvarying vec4 vSplat;\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvSplat=splat;\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;');
    const decl=keys.map(k=>`uniform sampler2D c_${k};uniform float s_${k};`).join('\n');
    sh.fragmentShader=sh.fragmentShader
      .replace('#include <common>',`#include <common>
varying vec4 vSplat;varying vec3 vWP;${decl}\nuniform sampler2D n_detail;${Object.keys(nmap).map(k=>`uniform sampler2D n_${k};`).join('')}\nvec4 wkW;float wkG;
float wkH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float wkN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(wkH(i),wkH(i+vec2(1,0)),f.x),mix(wkH(i+vec2(0,1)),wkH(i+vec2(1,1)),f.x),f.y);}
vec3 wkTex(sampler2D t,float s,vec2 p,float m){return mix(texture2D(t,p*s).rgb,texture2D(t,p*s*.27+.31).rgb,m);}`)
      .replace('#include <map_fragment>',`
vec2 wp=vWP.xz;float n1=wkN(wp*.045),n2=wkN(wp*.21+7.);float m=smoothstep(.25,.75,n1);
vec4 w=max(vSplat,0.);
// worn patches: some grass turns to dirt/mud on its own
float wear=smoothstep(.62,.8,n1*.7+n2*.3)*w.x;w.x-=wear;w.y+=wear*.7;w.w+=wear*.3;
float g=max(0.,1.-(w.x+w.y+w.z+w.w));
// grass: two-tone colour drift over tens of metres (lush / dry), so big fields aren't one flat green
float lush=wkN(wp*.012+3.)*.6+n1*.4;vec3 gTint=mix(vec3(.92,.9,.72),vec3(.82,1.02,.86),lush);
vec3 col=wkTex(c_grass,s_grass,wp,m)*w.x*gTint*(.88+.24*n2)+wkTex(c_dirt,s_dirt,wp,m)*w.y*vec3(.8,.74,.66)+wkTex(c_rock,s_rock,wp+vWP.y*.5,m)*w.z*.72+wkTex(c_mud,s_mud,wp,m)*w.w*.85+wkTex(c_gravel,s_gravel,wp,m)*g;
diffuseColor.rgb*=col;wkW=w;wkG=g;`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=clamp(wkW.x*.96+wkW.y*.9+wkW.z*.72+wkW.w*.48+wkG*.86,.35,1.);`);
    const nl=k=>nmap[k]?`(texture2D(n_${k},vWP.xz*s_${k}).xyz*2.-1.)`:`(texture2D(n_detail,vWP.xz*s_grass).xyz*2.-1.)`;
    sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
{vec3 dn=(texture2D(n_detail,vWP.xz*s_grass).xyz*2.-1.)*wkW.x+${nl('dirt')}*wkW.y+${nl('rock')}*wkW.z+${nl('mud')}*wkW.w+${nl('gravel')}*wkG;
 normal=normalize(normal+(viewMatrix*vec4(dn.x,0.,-dn.y,0.)).xyz*${lowDetail?'.3':'.7'});}`);
  };
  return {material:mat,dispose(){texs.forEach(t=>t.dispose());mat.dispose();}};
}
// Constant splat weights for a geometry with no painting (the flat floor).
export function fillSplat(T,geo,w){const n=geo.attributes.position.count,a=new Float32Array(n*4);for(let i=0;i<n;i++)a.set(w,i*4);geo.setAttribute('splat',new T.BufferAttribute(a,4));return geo;}
