// Material slots per part (the keys accepted by params.skin). Assemblies forward a
// subset to their parts, e.g. toolChest.skin.handle -> drawer.handleSkin.metal.
export const SLOTS = {
 caster: ['wheel', 'hub', 'fork', 'plate', 'brake'], handle: ['metal', 'grip'], drawer: ['front', 'inset'],
 chestBody: ['body', 'top', 'recess', 'trim', 'bumper', 'kick'], shelfUnit: ['frame', 'beam', 'board', 'foot'],
 bin: ['body', 'fill'], carton: ['body'], can: ['body', 'label'], sprayCan: ['body', 'cap', 'top'], bottle: ['body', 'cap'], hardCase: ['body', 'trim', 'latch'],
 pegboard: ['board', 'frame'], wrench: ['metal'], screwdriver: ['grip', 'band', 'shaft'], hammer: ['head', 'grip', 'shaft'], pliers: ['metal', 'grip'], socketRail: ['rail', 'socket'],
 benchTop: ['top', 'edge'], vice: ['body', 'jaw', 'screw'], shopLight: ['housing', 'diffuser', 'chain'], neonTube: ['tube', 'clip'], screen: ['bezel', 'glass'], contactShadow: [],
 toolChest: ['body', 'drawer', 'handle', 'top', 'recess', 'trim', 'bumper', 'kick'], topChest: ['body', 'drawer', 'handle', 'top', 'trim'], trolley: ['frame', 'tray'],
 shelving: ['frame', 'beam', 'board', 'foot'], workbench: ['cabinet', 'top', 'leg', 'shelf'], toolWall: ['board', 'frame'],
};
