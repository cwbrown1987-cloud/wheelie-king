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
| Hoodie (hood down) | `hoodie.glb` (meshes: body, hood, strings) | `hoodie-uv-template.png` | -0.72, 0.84, 0.72, 1.62 | 1.30 / 0.70 / 0.34 | 2654 / 4554 | chest 0.004, 1.335 · back 0, 1.215 · pocket 0, 1.0 | Slim-relaxed: 1.2 cm off chest/back/waist (no belly or back bulge), 1.9 cm looser sleeves, small drape at the ribbed hem; hood lies on the upper back (darker inner face), drawstrings. |
| Hood up | `hood_up.glb` | none (solid colour) | — | 0.31 / 0.38 / 0.25 | 1222 / 2000 | — | Worn with the hoodie instead of its hood mesh: shell 4-5.5 cm off the skull, open face. |
| Crewneck jumper | `jumper.glb` | `jumper-uv-template.png` | -0.72, 0.84, 0.72, 1.62 | 1.30 / 0.70 / 0.31 | 2071 / 3542 | chest 0, 1.33 · back 0, 1.36 | Slim: 1.1 cm off the torso, 1.5 cm sleeves, ribbed hem, cuffs and crew collar. |
| T-shirt | `tshirt.glb` | `tshirt-uv-template.png` | -0.46, 0.86, 0.46, 1.62 | 0.80 / 0.68 / 0.31 | 1601 / 2752 | chest 0, 1.33 · back 0, 1.36 | Slim regular: 0.9 cm off the torso, 1.4 cm short sleeves to mid upper arm, crew neck. |
| Joggers | `joggers.glb` | `joggers-uv-template.png` | -0.30, 0.09, 0.30, 1.08 | 0.41 / 0.92 / 0.28 | 1382 / 2382 | thigh 0.13, 0.64 (wearer's left) | Close at hips and thighs (1.1 cm), loosening below the knee (to 2.5 cm), extra fabric gathering onto a 1.2 cm ribbed ankle cuff over the trainer collar. |
| Shorts | `shorts.glb` | `shorts-uv-template.png` | -0.30, 0.45, 0.30, 1.08 | 0.41 / 0.50 / 0.27 | 848 / 1418 | thigh 0.14, 0.66 | 1.3 cm at the hips, slight flare (to 2.1 cm) at the open hem just above the knee. |
| Trainers | `trainers.glb` | `trainers-uv-template.png` | z -0.15..0.215, y -0.025..0.145 | 0.38 / 0.17 / 0.31 | 941 / 1652 | — | Chunky low-top sneaker: ~2.4 cm cupsole (outsole + midsole bands in the texture), wide rounded toe box, laces, heel tab. |

Rib bands painted by the game (so a plain texture still looks sewn): hem rib 2 cm below to 5.8 cm above `hemY` (hoodie/jumper 0.875,
tee 0.90), cuff rib 7 cm in from `cuffX` (hoodie/jumper 0.668), jogger ankle rib 7 cm above `ankleY` (0.098).
These numbers (and the anchors) are also stored in each mesh's glTF `extras.wkClothing`, with `covers`: the body vertices the
garment hides so skin never pokes through.

## Body-agnostic: refitting to another body

The garments are split into three layers so a new rider body (e.g. a female rider, or a different male model) only needs a re-bake:

1. **Garment specs** (`tools/clothes-lab/garment-bake.js` `BASES` + the per-base `thick`/`opening`/`drape` rules): fit is
   defined as offsets from the body surface and openings by height/arm-reach, not as fixed vertex positions.
2. **Fitted meshes** (`assets/clothing/base/*.glb`): baked per body. Run `bakeBases(THREE, bodySkinnedMesh)` (via
   `tools/clothes-lab/bake.html` / `node tools/clothes-lab/bake.mjs`) against any body skinned to the UE-style UBC skeleton
   (bone names are matched by name at runtime). For a second body, bake into a sibling folder
   (e.g. `assets/clothing/base-female/`) and point `BASE_URL` per body; the hem/cuff/anchor heights in `BASES` may need tuning.
3. **Items** (`clothing-catalogue.js`): base name + look (colours, marks at named anchors, or a texture painted on the UV
   template) + price. Items never reference a body, so the same catalogue works on every body.

## Making a new item

```js
// clothing-catalogue.js
{ id: 'my_tee', group: 'my_tee', name: 'My Tee', base: 'tshirt', price: 150, rarity: 'Rare',
  look: { base: '#ffffff', marks: [{ text: 'MY BRAND', font: '900 1px Impact, sans-serif', color: '#111', at: 'chest', width: 0.22 }] } }
// or paint a PNG on tshirt-uv-template.png and use: look: { texture: './assets/clothing/textures/my_tee.png' }
```

Items with the same `group` show as colour swatches of one product in the store. Flutter (hem, hood, strings) is a
per-vertex `_FLAP` attribute (0 = still, 1 = most movement) scaled by speed in the shader.
