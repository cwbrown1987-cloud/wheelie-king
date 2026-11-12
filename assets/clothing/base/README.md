# Rider clothing base garments

Reusable garment models for the Playground rider (Quaternius Universal Base Character, `assets/quaternius/ubc-superhero-male.glb`).
A new design is a new texture or a new data entry in `clothing-catalogue.js`; you never need a new model.

Every GLB here is a skinned mesh bound to the rider's own 65-bone UE-style skeleton (same bone names and bind pose), so it
follows every IK pose on the bike. They were baked from the rider's body by `tools/clothes-lab/bake.html`
(`node tools/clothes-lab/bake.mjs` with the static server on port 8931; method in `tools/clothes-lab/garment-bake.js`).
CC0 like the body they come from.

## Coordinates

T-pose, metres, Y up, the rider faces **+Z**, **+X is the rider's LEFT**. Rider height 1.81 m in the file (the game
scales the rider to 1.74 m; clothes scale with him).

## UV layout (all bases)

Planar projection of the garment surface. UV origin bottom-left (three.js), so in the PNG:

* **Top half = FRONT**, as seen from the front (the rider's left is on the right of the image).
* **Bottom half = BACK**, as seen from behind (the rider's left is on the left of the image).
* Sleeves sit at the outer ends of each half (labelled on the template), legs on joggers/shorts likewise.
* Trainers: **top half = outer side**, **bottom half = inner side**, heel on the left, toe on the right; both feet share it.

`u = (x - box.minX) / (box.maxX - box.minX)` (front; mirrored for the back), `v = 0.5 + 0.5 * (y - box.minY) / (box.maxY - box.minY)`
(front; `0.5 *` for the back). Trainers use `z` (heel to toe) instead of `x`. The `uvBox` below is `[minX, minY, maxX, maxY]`.

Paint at 1024 or 2048 square. Keep important art away from the side edges of each half (that is where front meets back).
The fabric is double-sided; the inside uses the same texture slightly darkened by the vertex colour.

| Base | File | Template | uvBox (m) | Size (m, x / y / z) | Verts / tris | Anchors (x, y in m) | Fit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Hoodie (hood down) | `hoodie.glb` (meshes: body, hood, strings) | `hoodie-uv-template.png` | -0.72, 0.84, 0.72, 1.62 | 1.30 / 0.70 / 0.34 | 2654 / 4554 | chest 0.004, 1.335 · back 0, 1.215 · pocket 0, 1.0 | Relaxed pullover: 2.4 cm off the chest, 3 cm blouse above a ribbed hem at hip height, long sleeves, ribbed cuffs, kangaroo pocket painted on. |
| Hood up | `hood_up.glb` | none (solid colour) | — | 0.31 / 0.38 / 0.25 | 1222 / 2000 | — | Worn with the hoodie instead of its hood mesh: shell 4-5.5 cm off the skull, open face. |
| Crewneck jumper | `jumper.glb` | `jumper-uv-template.png` | -0.72, 0.84, 0.72, 1.62 | 1.30 / 0.70 / 0.31 | 2071 / 3542 | chest 0, 1.33 · back 0, 1.36 | 2 cm off the chest, light blouse above a ribbed hem, long sleeves, ribbed crew collar. |
| T-shirt | `tshirt.glb` | `tshirt-uv-template.png` | -0.46, 0.86, 0.46, 1.62 | 0.80 / 0.68 / 0.31 | 1601 / 2752 | chest 0, 1.33 · back 0, 1.36 | Regular fit: 1.3 cm off the body, hem at the top of the hips, short sleeves to mid upper arm, crew neck. |
| Joggers | `joggers.glb` | `joggers-uv-template.png` | -0.30, 0.09, 0.30, 1.08 | 0.41 / 0.92 / 0.28 | 1382 / 2382 | thigh 0.13, 0.64 (wearer's left) | 2.2-2.8 cm off the leg, tapering to a 1.1 cm ribbed ankle cuff that sits over the trainer collar. |
| Shorts | `shorts.glb` | `shorts-uv-template.png` | -0.30, 0.45, 0.30, 1.08 | 0.41 / 0.50 / 0.27 | 848 / 1418 | thigh 0.14, 0.66 | Loose (2.6 cm) to just above the knee, open hem. |
| Trainers | `trainers.glb` | `trainers-uv-template.png` | z -0.15..0.215, y -0.025..0.145 | 0.38 / 0.17 / 0.31 | 941 / 1652 | — | Low-top: 1.8 cm cushioned sole, rounded toe box, collar just above the ankle bone. |

Rib bands painted by the game (so a plain texture still looks sewn): hem rib 2 cm below to 5.8 cm above `hemY` (hoodie/jumper 0.875,
tee 0.90), cuff rib 7 cm in from `cuffX` (hoodie/jumper 0.668), jogger ankle rib 7 cm above `ankleY` (0.098).
These numbers (and the anchors) are also stored in each mesh's glTF `extras.wkClothing`, with `covers`: the body vertices the
garment hides so skin never pokes through.

## Making a new item

```js
// clothing-catalogue.js
{ id: 'my_tee', group: 'my_tee', name: 'My Tee', base: 'tshirt', price: 150, rarity: 'Rare',
  look: { base: '#ffffff', marks: [{ text: 'MY BRAND', font: '900 1px Impact, sans-serif', color: '#111', at: 'chest', width: 0.22 }] } }
// or paint a PNG on tshirt-uv-template.png and use: look: { texture: './assets/clothing/textures/my_tee.png' }
```

Items with the same `group` show as colour swatches of one product in the store. Flutter (hem, hood, strings) is a
per-vertex `_FLAP` attribute (0 = still, 1 = most movement) scaled by speed in the shader.
