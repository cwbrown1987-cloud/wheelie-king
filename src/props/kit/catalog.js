// Props a player can place in a room. Each entry is just a kit type + params (+ how it
// mounts), so adding a placeable is one line here once the part exists in the registry.
export const PLACEABLES = [
 { id: 'red-chest', name: 'Red tool chest', type: 'toolChest', mount: 'floor', params: { width: .9, height: .9, depth: .55 } },
 { id: 'blue-chest', name: 'Blue tool chest', type: 'toolChest', mount: 'floor', params: { width: .8, height: .85, depth: .5, skin: { body: '#1f5fd1', handle: 'brushed' } } },
 { id: 'black-chest', name: 'Black + gold chest', type: 'toolChest', mount: 'floor', params: { width: .7, height: .75, depth: .48, drawers: [.1, .1, .1, .2], skin: { body: { preset: 'paint', color: '#17181d', clearcoat: 1 }, drawer: '#17181d', handle: { preset: 'paint', color: '#d9a51f', metalness: .8 } } } },
 { id: 'trolley', name: 'Tool trolley', type: 'trolley', mount: 'floor', params: { skin: { tray: '#c0262f' } } },
 { id: 'steel-shelf', name: 'Steel shelving', type: 'shelving', mount: 'floor', params: { width: 1.2, height: 1.9, depth: .42, style: 'steel', levels: [.1, .55, 1.0, 1.45, 1.86], seed: 51 } },
 { id: 'yellow-rack', name: 'Yellow racking', type: 'shelving', mount: 'floor', params: { width: 1.3, height: 2.0, depth: .45, levels: [.1, .5, .9, 1.3, 1.7], seed: 61 } },
 { id: 'workbench', name: 'Workbench + vice', type: 'workbench', mount: 'floor', params: { width: 1.8, depth: .7 } },
 { id: 'hard-case', name: 'Hard tool case', type: 'hardCase', mount: 'floor', params: {} },
 { id: 'carton', name: 'Parts carton', type: 'carton', mount: 'floor', params: { width: .45, height: .35, depth: .4 } },
 { id: 'tool-wall', name: 'Tool wall', type: 'toolWall', mount: 'wall', y: 1.3, params: { width: 1.2, height: .7 } },
 { id: 'wall-screen', name: 'Blueprint screen', type: 'screen', mount: 'wall', y: 1.45, params: { width: 1.0, height: .65 } },
 { id: 'neon-purple', name: 'Purple neon tube', type: 'neonTube', mount: 'wall', y: 2.3, params: { length: 1.2, color: '#b04cff' } },
 { id: 'neon-cyan', name: 'Cyan neon tube', type: 'neonTube', mount: 'wall', y: 2.3, params: { length: 1.2, color: '#4fd8ff' } },
];
export const placeable = id => PLACEABLES.find(p => p.id === id) || null;
