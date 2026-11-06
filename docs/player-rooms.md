# Garage, shop and rider foundation

The Garage displays the actual saved build list from My Builds. Saves and display layouts persist locally in separate versioned records. Selecting a ride focuses the camera; OrbitControls supplies orbit, pan and zoom. Arrange supports move, rotation, snapping, owned display stands, Done and Cancel. Display placement is a room editor, not a vehicle physics simulation.

Shop is a separate room with the existing top navigation. Its clothing categories remain visible through category and item-detail screens; Back follows shop history. Prices are in-game coins. Buying grants ownership; equipping verifies ownership. Character customisation shows starter gear and purchased items. Try-on previews do not grant or equip an unowned item. The developer infinite-money switch remains enabled; the normal currency path deducts once and rejects insufficient funds.

Gear geometry styles and colour themes are independent in `gear-catalogue.js`. `gear-models.js` provides four helmet shells, glove and shoe models, garment placeholder previews, backpacks and display furniture. Product art is deliberately quick procedural placeholder art for this setup phase. Worn helmets, gloves and shoes reuse the product models; garment cuts/materials adapt the articulated rider. Add a theme to existing styles instead of duplicating geometry.

`rider-spec.js` records the stylized adult reference dimensions and mount names. The reference is the supplied lime full-face helmet, blue hoodie, dark trousers, red gloves and trainers. Dimensions are game-art estimates, not measurements of the pictured person. Gear mounts are reused in standing, bike/scooter riding, stunts, ragdolls and recovery. A detailed sculpted/skinned character remains future art work.

The game icon is rendered from Jaxon's in-game lime TRAX bike using `scripts/render-app-icon.mjs`. It exports regular, maskable and Apple icon sizes; the manifest's image revision prompts clients to refresh the image.

Validation: `tests/player-rooms.mjs` covers persistence, focus, arrange/cancel, shop history, unowned try-on, purchases, wardrobe, real currency failure/success and Race equipment. Existing builder, ride and vehicle checks cover compatibility and the shared renderer/rig. Real-device performance still needs user testing.

## Next requested batch

After the current rooms/rider work, clean up Workshop inventory and add the simulated vehicle shops:

- New profiles receive a basic BMX and a basic scooter.
- Workshop lists basic cheap starter components plus owned rides and purchased parts. Purchase opens the in-game stores.
- A specialist bike/scooter/e-bike/moto web store sells complete models. Other simulated marketplaces can follow; no external checkout or real-money purchases.
- Motorbikes unlock at level 5; the first eligible race awards a basic motorbike once.
- Purchased and prize builds are sensible stock builds, never automatically maxed out. Every stock/prize model needs compatible upgrade and mod paths, until the player deliberately reaches the top build.
- Keep this progression distinct from the current developer infinite-money mode and preserve existing saves during migration.

## Independent garage placements

The garage room is physical geometry (`garage-room3d.js`) sharing the ride camera. Regular selection focuses the camera without changing any object transform. In Arrange, Move/Rotate edit the selected ride or prop; Camera temporarily returns to orbit controls. Direction and height buttons allow precise placement. Owned item designs can have multiple separately placed instances. Done saves, Cancel restores; Remove item removes only the selected prop. Legacy per-ride stand selections migrate into independent objects in the layout `$items` array. Camera focus/orbit invariance and multiple-instance reload persistence are covered by the player-room check.
