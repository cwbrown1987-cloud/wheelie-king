/**
 * Room registry for the shared 3D world.
 * Each room declares bounds, camera anchor/limits, doors, asset loader, and lights.
 * Adding a room later (skate park, shop 3D, browser) is one module entry.
 */
import {workshopRoom} from './workshop-room3d.js';
import {garageRoom} from './garage-room3d.js';

/** @typedef {{id:string,label:string,preload?:boolean,stub?:boolean,offset:number[],bounds:{min:number[],max:number[]},camera:{anchor:number[],minDistance:number,maxDistance:number,maxPolarAngle:number},doors:Array<{id:string,target:string,from:string,stub?:boolean,position:number[]}>,load:(T:any,scene:any,renderer:any,ctx:any)=>any}} RoomDef */

/** @type {Record<string, RoomDef>} */
export const ROOMS = {
 workshop: {
  id: 'workshop',
  label: 'Workshop',
  preload: true,
  offset: [0, 0, 0],
  bounds: { min: [-6, 0, -5.5], max: [6, 4.5, 6.5] },
  camera: { anchor: [0, 0.9, 0], minDistance: 0.12, maxDistance: 4.2, maxPolarAngle: Math.PI * 0.53 },
  doors: [
   { id: 'workshop-to-garage', target: 'garage', from: 'workshop', position: [0, 1.5, 6.15] },
   { id: 'workshop-to-outside', target: 'outside', from: 'workshop', stub: true, position: [-5.95, 1.2, 4.2] },
  ],
  load(T, scene, renderer) {
   return workshopRoom(T, scene, renderer, { reflections: true, origin: [0, 0, 0] });
  },
 },
 garage: {
  id: 'garage',
  label: 'Garage',
  preload: false,
  offset: [0, 0, 10.8], // past workshop roller door (+Z)
  bounds: { min: [-6, 0, -4.5], max: [6, 4.5, 6.5] },
  camera: { anchor: [0, 1.0, 1], minDistance: 0.4, maxDistance: 8, maxPolarAngle: Math.PI * 0.55 },
  doors: [
   { id: 'garage-to-workshop', target: 'workshop', from: 'garage', position: [0, 1.5, -4.45] },
  ],
  load(T, scene, renderer, { offset } = {}) {
   const built = garageRoom(T, scene, renderer, { workshop: false, reflections: false, asSecondary: true, origin: offset || ROOMS.garage.offset });
   const doors = () => ROOMS.garage.doors;
   const prev = built.state;
   built.state = () => ({ ...prev(), id: 'garage', doors: doors() });
   built.doors = doors;
   return built;
  },
 },
 // Hooks only — future outdoor ride-out / skate park. Race tab still jumps straight into a race.
 outside: {
  id: 'outside',
  label: 'Outside',
  stub: true,
  preload: false,
  offset: [-18, 0, 4],
  bounds: { min: [-10, 0, -10], max: [10, 8, 10] },
  camera: { anchor: [0, 1.5, 0], minDistance: 1, maxDistance: 30, maxPolarAngle: Math.PI * 0.49 },
  doors: [
   { id: 'outside-to-workshop', target: 'workshop', from: 'outside', position: [8, 1.2, 0] },
   { id: 'outside-to-skatepark', target: 'skatepark', from: 'outside', stub: true, position: [0, 1.2, -8] },
  ],
  load() { return null; },
 },
 skatepark: {
  id: 'skatepark',
  label: 'Skate park',
  stub: true,
  preload: false,
  offset: [-18, 0, -20],
  bounds: { min: [-12, 0, -12], max: [12, 6, 12] },
  camera: { anchor: [0, 1.2, 0], minDistance: 1, maxDistance: 40, maxPolarAngle: Math.PI * 0.49 },
  doors: [{ id: 'skatepark-to-outside', target: 'outside', from: 'skatepark', stub: true, position: [0, 1.2, 10] }],
  load() { return null; },
 },
};

export function roomIds() { return Object.keys(ROOMS); }
export function getRoom(id) { return ROOMS[id] || null; }
export function doorLink(from, to) {
 for (const room of Object.values(ROOMS)) {
  const hit = room.doors?.find(d => d.from === from && d.target === to);
  if (hit) return hit;
 }
 return null;
}
export function listDoors() {
 return Object.values(ROOMS).flatMap(r => (r.doors || []).map(d => ({ ...d, room: r.id })));
}
