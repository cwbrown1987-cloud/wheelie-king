// Catalog identity is independent of geometry identity: colour variants retain their interfaces.
import {TRAX_PARTS,TRAX_STOCK} from './trax-bike.js';
export const PALETTE=[['black','Black','#20262b'],['white','White','#ebeeee'],['red','Red','#c82535'],['blue','Blue','#287bc4'],['lime','Lime','#c9e62c'],['chrome','Chrome','#bfc8d0']];
export const MODULAR_PARTS=[
 {id:'stem_quill',slot:'stem',name:'22.2mm BMX Quill Stem',interface:'quill',clamp:22.2,kg:.35,price:160,color:'#87949f',note:'Quill bicycle steerer, 22.2mm BMX bar clamp.'},
 {id:'stem_trax',slot:'stem',name:'TRAX 25.4mm Quill Stem',interface:'quill',clamp:25.4,kg:.35,price:160,color:'#87949f',note:'TRAX-style tall quill and 25.4mm bar clamp; photo-derived dimensions.'},
 {id:'stem_threadless',slot:'stem',name:'31.8mm Threadless MTB Stem',interface:'threadless',clamp:31.8,kg:.18,price:240,color:'#252c31',note:'Threadless bicycle steerer and 31.8mm riser-bar clamp.'},
 {id:'stem_moto',slot:'stem',name:'28.6mm Moto Bar Mounts',interface:'moto',clamp:28.6,kg:.3,price:280,color:'#343b40',note:'Bolts to the moto triple clamp; takes 28.6mm moto bars.'},
 {id:'post_254',slot:'seatpost',name:'25.4mm Seatpost',diameter:25.4,kg:.28,price:100,color:'#3b4145',note:'25.4mm bicycle seat tube.'},
 {id:'post_bmx',slot:'seatpost',name:'25.4mm Pivotal BMX Post',diameter:25.4,saddleMount:'pivotal',kg:.25,price:120,color:'#3b4145',note:'25.4mm seat tube with a pivotal BMX saddle mount.'},
 {id:'post_272',slot:'seatpost',name:'27.2mm Seatpost',diameter:27.2,kg:.27,price:140,color:'#3b4145',note:'27.2mm bicycle seat tube.'},
 {id:'post_316',slot:'seatpost',name:'31.6mm Seatpost',diameter:31.6,kg:.29,price:180,color:'#3b4145',note:'31.6mm bicycle seat tube.'},
 {id:'post_309',slot:'seatpost',name:'30.9mm Seatpost',diameter:30.9,kg:.29,price:180,color:'#3b4145',note:'30.9mm fat-bike seat tube.'},
 {id:'pedal_flat',slot:'pedals',name:'9/16 Flat Pedals',thread:'9/16',kg:.35,price:120,color:'#252a2e',note:'Matched pair for bicycle crank arms; replaces pedal platforms only.'},
 {id:'pedal_pins',slot:'pedals',name:'9/16 Pinned Pedals',thread:'9/16',kg:.4,price:250,color:'#343a3e',note:'Matched grippy platforms for bicycle crank arms.'},
 {id:'peg_moto',slot:'pedals',name:'Moto Footpegs',pegs:true,kg:.65,price:240,color:'#3c454b',note:'Fixed pegs for a moto frame with peg mounting bosses; no pedal crank assembly.'},
 {id:'headset_straight',slot:'headset',name:'Straight Bicycle Headset',interface:'straight',kg:.12,price:100,color:'#282f33',note:'Straight bicycle head tube and steerer.'},
 {id:'headset_tapered',slot:'headset',name:'Tapered Bicycle Headset',interface:'tapered',kg:.14,price:180,color:'#282f33',note:'Tapered bicycle head tube; reducer adapter still required for straight forks.'},
 {id:'headset_moto',slot:'headset',name:'Moto Steering Bearings',interface:'triple',kg:.22,price:260,color:'#282f33',note:'Moto steering head and triple-clamp assembly.'},
 ...[['110','BMX'],['135qr','QR MTB'],['148ta','Boost MTB'],['197','Fat Bike'],['moto','Moto']].map(([drop,label])=>({id:'hubs_'+drop,slot:'hubs',name:label+' Hub Pair',drop,kg:drop==='moto'?1.2:.55,price:drop==='moto'?650:280,color:'#686f73',note:label+' dropout interface. A hub motor replaces its driven hub; the other hub remains.'})),
 {id:'rear_mtb_fs',slot:'rear_frame',family:'mtb_fs',name:'Trail MTB Rear Triangle',kg:1.1,price:550,color:'#c44228',note:'Only the Trail MTB main-frame pivot and metric shock linkage.'},
 {id:'rear_moto',slot:'rear_frame',family:'moto',name:'Moto Tubular Swingarm',kg:2.8,price:950,color:'#303a40',note:'Only the Ute-Tough moto pivot, axle and 230mm shock interface.'},
 {id:'rear_emoto',slot:'rear_frame',family:'emoto',name:'Enduro Box Swingarm',kg:2.8,price:1100,color:'#303a40',note:'Only the Enduro E-Moto main-frame pivot and shock interface.'},
 {id:'panels_emoto',slot:'body_panels',family:'emoto',name:'Enduro Battery Covers',kg:1,price:650,color:'#252d33',note:'Removable side covers and battery lid for the Enduro chassis.'},
 {id:'plate_moto',slot:'number_plate',families:['moto','emoto'],name:'Moto Number Plate',kg:.15,price:120,color:'#eceeee',note:'Fork-mounted number plate for moto triple-clamp bikes.'},
 {id:'seat_rail',slot:'seat',name:'Trail Rail Saddle',saddleMount:'rails',sx:1,kg:.4,price:220,color:'#252b30',note:'Standard saddle rails for a rail-clamp bicycle seatpost.'},
 {id:'fork_rigid275',slot:'suspension',name:'27.5 Rigid MTB Fork',travel:0,damp:0,kg:1.2,price:350,color:'#343b40',wheels:['27.5'],steerer:'straight',note:'Rigid 27.5-inch bicycle fork; straight threadless steerer.'},
 {id:'fork_fat',slot:'suspension',name:'26x4 Fat Rigid Fork',travel:0,damp:0,kg:1.4,price:450,color:'#343b40',wheels:['26f'],steerer:'tapered',note:'Wide clearance for 26x4 fat tyres; tapered bicycle steerer.'},
 ...[['275','27.5'],['29','29'],['fat','26f']].map(([id,size])=>({id:'rim_'+id,slot:'rims',name:(size==='26f'?'26-inch Fat':size+'-inch')+' Alloy Rim Pair',size,kg:size==='26f'?2.2:1.7,price:500,color:'#8b979f',note:'Matched rim size and width for '+size+' tyres; hubs and tyres sold separately.'})),
];
let lookup=new Map(),variants=new Map();
export const part=id=>lookup.get(id)||TRAX_PARTS.find(p=>p.id===id)||MODULAR_PARTS.find(p=>p.id===id);
export const baseId=id=>part(id)?.variantOf||id;
export function canonicalBuild(build={}) {const b={...build};for(const [slot,id] of Object.entries(b))if(typeof id==='string')b[slot]=baseId(id);return b;}
const common={bars:'bar_riser',grips:'grip_std',seat:'seat_bmx',cranks:'crank_steel',pedals:'pedal_flat',chain:'chain_std',sprocket_f:'spf_25',sprocket_r:'spr_9',rims:'rim_steel'};
export const STOCK_BUILDS={
 bmx:{...common,frame:'bmx',bars:'bar_bmx',tyres:'kenda',suspension:'rigid',brakes:'rim',stem:'stem_quill',seatpost:'post_bmx',headset:'headset_straight',hubs:'hubs_110'},
 rbmx:{...common,frame:'rbmx',bars:'bar_bmx',tyres:'kenda',suspension:'rigid',brakes:'rim',stem:'stem_quill',seatpost:'post_bmx',headset:'headset_straight',hubs:'hubs_110'},
 trax_lime:{...TRAX_STOCK,frame:'trax_lime',stem:'stem_trax',seatpost:'post_254',pedals:'pedal_flat',headset:'headset_straight',hubs:'hubs_135qr'},
 mtb_rigid:{...common,frame:'mtb_rigid',tyres:'trail275',suspension:'fork_rigid275',brakes:'rim',stem:'stem_threadless',seatpost:'post_272',headset:'headset_straight',hubs:'hubs_135qr',rims:'rim_275'},
 mtb_ht:{...common,frame:'mtb_ht',tyres:'xc29',suspension:'pike',brakes:'zee',stem:'stem_threadless',seatpost:'post_316',headset:'headset_tapered',hubs:'hubs_148ta',rims:'rim_29'},
 mtb_fs:{...common,frame:'mtb_fs',tyres:'trail275',suspension:'pike',brakes:'zee',stem:'stem_threadless',seatpost:'post_316',headset:'headset_tapered',hubs:'hubs_148ta',rims:'rim_275',rear_frame:'rear_mtb_fs',shock:'shk_coil150'},
 fat:{...common,frame:'fat',tyres:'fat26',suspension:'fork_fat',brakes:'zee',stem:'stem_threadless',seatpost:'post_309',headset:'headset_tapered',hubs:'hubs_197',rims:'rim_fat'},
};
for(const frame of ['mtb_rigid','mtb_ht','mtb_fs','fat'])STOCK_BUILDS[frame].seat='seat_rail';
for(const frame of ['moto','emoto'])STOCK_BUILDS[frame]={frame,motor:'mmid8k',battery:'moto72',controller:'sab',throttle:'thumb',suspension:'dnm',brakes:'zee',shock:'shk_moto230',rear_frame:'rear_'+frame,bars:'bar_moto',stem:'stem_moto',headset:'headset_moto',grips:'grip_std',seat:'seat_moto',pedals:'peg_moto',tyres:'moto19',rims:'rim_moto',hubs:'hubs_moto',chain:'chain_428',sprocket_f:'spf_428_14',sprocket_r:'spr_428_48',...(frame==='emoto'?{body_panels:'panels_emoto',number_plate:'plate_moto',lights:'light_moto'}:{})};

export function prepareCatalogue(items) {
 const all=[...items,...MODULAR_PARTS];lookup=new Map(all.map(p=>[p.id,p]));variants=new Map();
 for(const p of all) {
  if(p.slot==='motor'&&p.w)p.name=`${p.w/1000} kW · ${p.name.replace(/\b(\d+)W\b/gi,(_,n)=>(Number(n)/1000)+' kW')}`;
  if(p.slot==='bars')p.clamp=({bar_bmx:22.2,trax_bars:25.4,bar_riser:31.8,bar_moto:28.6})[p.id]||31.8;
  if(p.slot==='rims')p.size=p.size||(p.id==='rim_moto'?'moto':'20');
  if(p.slot==='seatpost')p.saddleMount=p.saddleMount||'rails';
  if(p.slot==='seat')p.saddleMount=p.id==='seat_bmx'?'pivotal':p.id==='seat_moto'?'bench':'rails';
  if(p.slot==='rear_frame'&&p.id.startsWith('trax_'))p.family='trax_lime';
  if(p.id==='maxxisdh')p.size='26';
  if(p.id==='rigid'){p.travel=0;p.wheels=['20'];p.steerer='straight';}
  if(p.id==='trax_fork'){p.wheels=['20'];p.steerer='straight';}
  if(p.id==='suntour'){p.wheels=['27.5','29'];p.steerer='straight';}
  if(p.id==='pike'){p.wheels=['27.5','29'];p.steerer='tapered';p.frontAxle='110ta';}
  if(['dnm','fox40','corro'].includes(p.id)){p.wheels=['27.5','29','moto'];p.steerer='tapered';p.frontAxle='moto';}
  if(p.slot==='motor'&&p.kind==='rear')p.drop=p.fat?'197':p.w>=5000?'moto':'135qr';
  // A main frame is a welded assembly. Complete bikes are explicit kits below.
  if(p.slot==='frame'){delete p.stock;p.price=Math.max(300,p.price||0);if(p.id==='mtb_fs')p.kg=2;if(p.id==='moto')p.kg=6.7;if(p.id==='emoto')p.kg=6;}
  if(['sticker','kit'].includes(p.slot)||p.slot.startsWith('adp_'))continue;
  p.price=Math.max(p.price||0,({shock:350,suspension:300,seat:120,bars:120,rims:250,cranks:180,chain:80,sprocket_f:90,sprocket_r:70,rear_frame:450})[p.slot]||100);
  const list=[p];
  for(const [key,label,color] of PALETTE.filter(c=>p.slot!=='tyres'||c[0]!=='chrome')){const v={...p,id:p.id+'__'+key,variantOf:p.id,finish:key,name:p.name+' — '+label+(p.slot==='tyres'?' Sidewalls':''),color,price:Math.round(p.price*(key==='chrome'?1.18:1)),hidden:true};if(p.slot==='frame')v.fc=parseInt(color.slice(1),16);lookup.set(v.id,v);list.push(v);}
  variants.set(p.id,list);
 }
 for(const [frame,build] of Object.entries(STOCK_BUILDS)) {
  const f=lookup.get(frame),kit={id:'bike_'+frame,slot:'kit',completeBike:true,name:(f?.name||frame).replace(/Frame$/,'')+' Complete Bike',real:false,kit:Object.values(build),kg:0,price:Object.values(build).reduce((n,id)=>n+(lookup.get(id)?.price||0),0),note:'Complete compatible stock build. Every included component is also sold separately.'};
  all.push(kit);lookup.set(kit.id,kit);
 }
 globalThis.__WK_CATALOG_ITEMS__=[...lookup.values()];return all;
}
globalThis.__WK_PREPARE_CATALOGUE__=prepareCatalogue;
globalThis.__WK_PART__=part;
globalThis.__WK_BASE_ID__=baseId;
globalThis.__WK_CANONICAL_BUILD__=canonicalBuild;
globalThis.__WK_VARIANTS__=id=>variants.get(baseId(id))||[];
globalThis.__WK_STOCK_BUILD__=frame=>({...STOCK_BUILDS[baseId(frame)||'bmx']});
