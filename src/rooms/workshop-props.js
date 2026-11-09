// Modelled props for the workshop, built from the reusable kit (src/props/kit).
// Positions follow where each item stands in Chris's art so the default camera reads
// like his picture, but every prop is real geometry + PBR (no photo cut-outs).
export const FRONT_LAYOUT = [
 // back wall run of red chests (art: two low chests + tall chest at right)
 { type: 'toolChest', at: [1.075, 0, -3.14], params: { width: .89, height: .95, depth: .58, casterRadius: .034, drawers: [.06, .06, .06, .06, .09, .09, .13] } },
 { type: 'toolChest', at: [2.02, 0, -3.14], params: { width: .96, height: .95, depth: .58, casterRadius: .034, drawers: [.06, .06, .06, .09, .09, .13, .13], sideHandles: false } },
 { type: 'toolChest', at: [3.0, 0, -2.66], params: { width: .92, height: 1.38, depth: .64, casterRadius: .036, drawers: [.05, .05, .05, .05, .07, .07, .07, .1, .1, .14] } },
 // things on the chests
 { type: 'hardCase', at: [1.66, 1.07, -3.26], params: { width: .34, height: .14, depth: .26 } },
 { type: 'hardCase', at: [2.02, 1.07, -3.3], params: { width: .3, height: .12, depth: .24, skin: { body: '#2a63c9' } } },
 { type: 'sprayCan', at: [2.22, 1.07, -3.3], params: { height: .2, skin: { body: '#c0262f' } } },
 { type: 'sprayCan', at: [2.3, 1.07, -3.34], params: { height: .19, skin: { body: '#e0b324' } } },
 { type: 'can', at: [2.44, 1.07, -3.3], params: { radius: .05, height: .14, skin: { label: '#8a96a6' } } },
 { type: 'can', at: [1.2, 1.07, -3.3], params: { radius: .06, height: .12, skin: { label: '#15181e' } } },
 { type: 'hardCase', at: [2.85, 1.5, -2.8], params: { width: .3, height: .12, depth: .24, skin: { body: '#a42470' } } },
 // tool wall
 { type: 'toolWall', at: [.65, 1.45, -4.49], params: { width: 3.0, height: 1.1 } },
 { type: 'screen', at: [3.3, 1.82, -4.49], params: { width: 1.55, height: 1.36 } },
 { type: 'shopLight', at: [-.76, 2.82, -4.05], params: { length: .9, drop: .55 } },
 { type: 'shopLight', at: [1.25, 2.95, -4.05], params: { length: 1.0, drop: .45 } },
 // centre black steel shelving against the back wall
 { type: 'shelving', at: [-1.54, 0, -4.07], params: { width: 1.26, height: 2.3, depth: .42, style: 'steel', levels: [.12, .66, 1.14, 1.64, 2.24], seed: 3 } },
 // yellow racking along the angled wall (two bays)
 { type: 'shelving', at: [-4.14, 0, -2.48], rotY: 1.094, params: { width: 1.26, height: 2.3, depth: .45, levels: [.12, .6, 1.08, 1.56, 2.04], seed: 11 } },
 { type: 'shelving', at: [-3.63, 0, -3.52], rotY: 1.094, params: { width: .92, height: 2.3, depth: .45, levels: [.12, .6, 1.08, 1.56, 2.04], seed: 23 } },
 // generator corner -> cartons for now
 { type: 'carton', at: [3.85, 0, -3.3], params: { width: .4, height: .38, depth: .42 } },
 { type: 'carton', at: [3.85, .38, -3.34], params: { width: .34, height: .26, depth: .36 } },
 { type: 'trolley', at: [4.4, 0, -2.6], rotY: -.5, params: { width: .7, height: .85, depth: .42, skin: { tray: '#2a63c9' } } },
];

export function workshopProps(kit, layout = FRONT_LAYOUT) {
 const g = kit.compose({ parts: layout }, 'workshop:props');
 return g;
}
