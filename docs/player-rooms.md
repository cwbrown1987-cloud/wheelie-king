# Player rooms - current implementation

Garage, Workshop and Character now render a physical world-space room using garage-room3d.js. Walls, ceiling, lamps, cabinets, shelves, plants, floor and rides share one camera. Workshop has dark brick, an original tool board and bench; Garage has light brick and neon industrial accents. The 3D canvas fills the screen behind the existing glass menus. Shop retains its separate static shop image and existing layout.

Selection leaves the camera stationary and reveals Edit. Edited objects drag freely without grid rounding; floor-projected arrows rotate continuously and the upper handle raises/lowers. Empty-space drags orbit the camera. Handles project using actual canvas bounds, including stage scaling. Layout changes autosave. Display removal hides a ride without deleting ownership; Ride options separately provides persistent rename and confirmed deletion. Furniture remains independent. Existing saves and placements are retained.

gear-catalogue.js separates styles and themes; gear-models.js supplies product and worn models. Character shows starter/purchased gear. Preview does not grant ownership; purchases use the existing wallet. The shared rider-spec.js defines estimated game-art dimensions and mounts. Detailed sculpted clothing remains future work.

Room assets are original procedural geometry/textures. Ivy leaves and pegboard holes are instanced. Environment-lit concrete is the default; optional planar reflections are disabled, including on touch devices. Garage shadows update after object/outfit edits rather than every idle frame. Room disposal releases owned geometry, materials, textures and environment targets, restores prior scene state and removes the room group. Checks found constant geometry/texture counts over four create/dispose cycles; physical device FPS remains unverified.

The optional Reflector helper is Three.js r160 (MIT), matching the bundled renderer. Source: https://github.com/mrdoob/three.js/blob/r160/examples/jsm/objects/Reflector.js . Only its import points to local three.module.js. Licence: vendor/LICENSE-three.txt.

Validation: npm run check -- rooms covers camera parallax and fixed transforms, full-screen canvas, resource disposal, workshop previews/stickers/stats, touch dragging/rotation/lift, purchases/wardrobe, saved-ride management, mobile layouts and Race entry. Screenshots: wk-shots/world-room/ and existing player/workshop QA folders.

Next: owned Workshop inventory and simulated stores; starter BMX + scooter; level-5 motorcycle unlock and one-time first eligible race reward. Preserve saves, infinite-money development mode and upgrade headroom. Earlier inventory/store work is stashed and must be reviewed before reuse. See ROADMAP.md.
