# V3 world, independent 3D bike and props-only Jolt — review guide

**Branch:** `feature/classic-arcade-assist-v3`  
**Base:** `claude/classic-playground`  
**Status:** experimental, opt-in. Existing beta and main remain untouched.

## Architecture

| System | Module | What owns the result |
|---|---|---|
| Classic custom motorcycle | `ride-physics.js`, `ride-freeroam.js` | Original pitch, 2D wheel contact and extended 3D heading |
| Arcade assist | `ride-arcade-assist.js` | State recognition, assistance tuning and landing prediction only |
| V3 custom motorcycle | `ride-bike3d.js` | Three-axis motorcycle movement, tyre/suspension contacts, inertia and rider balance |
| World V3 | `ride-v3-world.js` | Deterministic terrain height and streaming terrain meshes, procedural vegetation and biomes |
| Dynamic world props | `ride-props-jolt.js` | **Separate Jolt world**, crates/barrels and terrain heightfield. No Jolt motorcycle body/constraint |
| Rendering | `ride.js` / Three.js | Bike, rider IK, camera, weather and environment visuals |

Only one motorcycle solver is active at a time. Jolt's separate props simulation never integrates the bike body. Contact between bike and movable props uses a bounded impulse bridge, not a shared rigid-body contact manifold.

## How to open

Use a local staging build or a separate review deployment:

- Default (unchanged): the existing game, original custom bike and existing playground
- `?world=v3&physics=classic&physicslab=1`: older custom bike controller in new terrain
- `?world=v3&physics=v3&physicslab=1`: new independent 3D motorcycle with separate Jolt props
- `?physics=jolt` without V3 world: original Jolt MotorcycleTest comparison only

The Arcade Lab lets you change the custom bike engine (reloads the local page), choose Original / Balanced / Arcade / Custom assistance, and jump among **Mountain Forest**, **Lake Valley** and **Red Canyon**.

Recommended initial mobile graphics preset: **Low** or **Medium**.

## Terrain layout

One continuous height field and connected dirt trail. Forest: x below ~-320; valley: -320–540; red canyon: above 540. The trail winds in Z; the same height function is sampled by render meshes, motorcycle wheels and Jolt's streamed terrain patch. Trees and sandstone rocks are instanced meshes. Chunk radius is responsive to quality tier. No snow biome.

## Motorcycle dynamics — what is real vs approximate

The V3 solver independently integrates X/Z velocity, Y gravity, yaw, roll and pitch angular velocities and torques. Two sprung wheel contact probes sample the terrain. Garage bike mass, wheelbase, centre of mass, tyres, torque, power, suspension travel and gearing-independent top speed are inputs. Rider control and arcade assistance are bounded so the same bike keeps a distinct feel.

This is **not yet** a complete general-purpose six-degree-of-freedom collision solver:
- Wheel contact is a height-sampled suspension model, not volumetric tyre shape casts.
- Roll is an inertial angle controlled by a stabilising virtual rider; it is not free-falling unassisted at low speed.
- Chassis and vegetation collision need more rigorous swept-body tests before claiming simulation fidelity.
- Physical props are genuine Jolt dynamic rigid bodies, but bike-to-prop impulses are an approximate solver bridge.
- The prop heightfield is currently recreated around the player's position; far-away props are not persistent.

These limits are intentional to preserve playable handling and avoid making an unverified full physics rewrite the default.

## Validation commands

```bash
npm ci
npm run test:arcade
node tests/playground-classic.mjs
node tests/v3-physics.mjs
node scripts/make-beta.mjs
```

GitHub Actions `.github/workflows/arcade-physics-v3.yml` runs these checks and a Playwright test `tests/v3-world-browser.mjs` against a **localhost** preview with software graphics. The browser test requires a Chromium install. It checks that the game enters the V3 world, the independent motor runs, the props-only Jolt world initialises, and the Arcade Lab functions. It records screenshots in `test-results/`.

**Do not merge, deploy to production or replace current beta** until browser tests, mobile playtesting and owner approval.
