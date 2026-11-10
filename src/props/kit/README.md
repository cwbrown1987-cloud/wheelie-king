# Workshop prop kit

Modelled, reusable, reskinnable props for the 3D rooms. No photo cut-outs: every prop is
geometry + PBR materials + small procedural maps. Chris's art only lives on the room walls
(`src/rooms/workshop-shell.js`).

| File | What it holds |
|---|---|
| `index.js` | `createKit(THREE)` – the registry: `register`, `build`, `compose`, `bake`, `slots`, `registerSkin`, `bounds`/`solidBounds` |
| `parts.js` / `parts-room.js` | Small parts (caster, handle, drawer, bin, tools…) and room parts (door, roller door, pipe, beam, fuse box, vine) |
| `assemblies.js` | Bigger props built *from* parts (toolChest, trolley, shelving, workbench, toolWall…) |
| `slots.js` | Material slot names each type accepts in `params.skin` |
| `materials.js` | Presets (`paint`, `chrome`, `rubber`…) and cached material specs |
| `textures.js` / `geometry.js` | Procedural textures and cached geometry |
| `catalog.js` | What players can place (`PLACEABLES`) |
| `bake.js` | Merges a room of props into ~15 draw calls |

Conventions: origin at the bottom-centre of the prop, front faces **+Z**, metres.

## Reskin a part

Every type has named material slots (`kit.slots('toolChest')` →
`['body','drawer','handle',…]`). Pass `skin` to override any of them:

```js
kit.build('toolChest', { skin: { body: '#1f5fd1' } });                    // new colour, same preset
kit.build('toolChest', { skin: { handle: 'brushed' } });                  // another preset
kit.build('toolChest', { skin: { body: { preset: 'paint', color: '#17181d', roughness: .5 } } });
kit.build('carton',    { skin: { body: { preset: 'cardboard', mapUrl: 'assets/workshop/my-box.jpg', repeat: [1, 1] } } });
kit.build('toolChest', { skin: { body: myThreeMaterial } });              // used as-is
```

Texture slots: `mapUrl`, `normalUrl`, `roughnessUrl`, `repeat` (paths are relative to the
site root). Reusable named skins:

```js
kit.registerSkin('gold-chest', { body: '#c9a23a', trim: 'chrome' });
kit.build('toolChest', { skin: 'gold-chest' });
```

Assemblies forward skins to their parts, e.g. `trolley` takes `casterSkin: { wheel: '#222' }`,
so the same caster model is reused (and reskinned) on any trolley or chest.

## Add a part

1. Write a factory in `parts.js`/`parts-room.js` (or a new file you register from `index.js`):

   ```js
   kit.register('stool', (p = {}) => {
     const { h = .6, skin = {} } = p, g = new kit.T.Group();
     const seat = kit.mat('rubber', skin.seat), leg = kit.mat('chrome', skin.leg); // (default preset, override)
     // build meshes from kit.geo.* (cached) and add them to g
     return g;
   }, { category: 'furniture' });
   ```

2. Add its slots to `slots.js`: `stool: ['seat', 'leg']`.
3. Compose it into bigger things with data instead of code:
   `kit.compose({ parts: [{ type: 'stool', at: [0, 0, .4], rotY: .3 }] })`.
4. To make it **placeable** by players, add one line to `catalog.js`:
   `{ id: 'stool', name: 'Shop stool', type: 'stool', mount: 'floor', params: {} }`
   (`mount: 'wall'` + `y` for wall items). Collision boxes come from the mesh bounds
   automatically (`solidBounds`, which ignores contact shadows).
5. Add any new file under `src/` or `assets/workshop/` to `SHELL` in `sw.js` and bump `CACHE`.

## Keep it cheap

- Re-use `kit.geo.*` and presets; untextured opaque materials all merge into one draw call
  in `bake` (colour, roughness, metalness, emissive become vertex attributes).
- Textured or transparent materials cost one draw call per distinct material, so share
  textures rather than cloning them.
- The workshop target is 15–25 draw calls for props (`state().propDrawCalls`, tested in
  `tests/workshop-kit.mjs`).
