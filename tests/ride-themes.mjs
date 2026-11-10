import assert from 'node:assert/strict';
import {THEMES,deriveTheme,getTheme} from '../ride-themes.js';
const sp=THEMES.skatepark;
// The default theme must keep the exact look the ride had before themes existed.
assert.equal(sp.background,'#55516d');assert.deepEqual(sp.fog,{color:'#7a6c88',near:28,far:150});
assert.deepEqual(sp.hemi,{sky:'#d3d4ff',ground:'#725d89',intensity:1.8});assert.deepEqual(sp.sun,{color:'#ffd7c6',intensity:2.4});
assert.deepEqual(sp.sky,{low:[.98,.6,.3],high:[.25,.45,.85]});assert.equal(sp.sunDisc,'#fff3b0');
assert.deepEqual(sp.backdrop,{image:'./icons/neon-skatepark-background.webp',widthFactor:.3,height:.6,offsetY:.4,sway:.08});
assert.deepEqual(sp.environment.palette,{paving:'#393a50',wall:'#ddd0ce',concrete:'#8a8492',barrels:['#7d4250','#3b5f76'],neon:'#8df3ff',neonGlow:'#32d4ff'});
// deriveTheme: deep merge, arrays replaced, base untouched
const before=JSON.stringify(sp),d=deriveTheme(sp,{fog:{far:60},environment:{palette:{barrels:['#111111','#222222']}}});
assert.equal(d.fog.far,60);assert.equal(d.fog.near,28);assert.deepEqual(d.environment.palette.barrels,['#111111','#222222']);assert.equal(d.environment.palette.paving,'#393a50');
assert.equal(JSON.stringify(sp),before,'base theme not mutated');
// every theme has every field the ride reads
const need=['background','fog.color','fog.near','fog.far','hemi.sky','hemi.ground','hemi.intensity','sun.color','sun.intensity','sky.low','sky.high','sunDisc','backdrop.image','backdrop.widthFactor','backdrop.height','backdrop.offsetY','backdrop.sway','environment.artSource','environment.palette.paving','environment.palette.barrels'];
for(const [name,t] of Object.entries(THEMES))for(const k of need)assert.ok(k.split('.').reduce((o,p)=>o?.[p],t)!==undefined,name+' missing '+k);
assert.equal(getTheme('nope'),sp);assert.equal(getTheme('skatepark-night'),THEMES['skatepark-night']);
console.log('ride-themes: ok');
