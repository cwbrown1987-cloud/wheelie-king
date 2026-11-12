# Third-party CC0 assets in this tree

Licence for every file listed here is **CC0 1.0**. Attribution is not required.

## ambientCG (https://docs.ambientcg.com/other/license)

| Asset | Path | Source | Use |
| --- | --- | --- | --- |
| Ground086 1K JPG (Color, NormalGL, Roughness, AmbientOcclusion) | `ambientcg/Ground086/` | https://ambientcg.com/view?id=Ground086 | Playground flat ground, world-space UVs |
| Grass004 (Color 1024, NormalGL 512, Roughness 256) | `ambientcg/Grass004/` | https://ambientcg.com/view?id=Grass004 | Playground splat ground: grass |
| Rock051 (same sizes) | `ambientcg/Rock051/` | https://ambientcg.com/view?id=Rock051 | Playground splat ground: steep rock |
| Ground109 (same sizes) | `ambientcg/Ground109/` | https://ambientcg.com/view?id=Ground109 | Playground splat ground: mud in dips |
| Gravel041 (same sizes) | `ambientcg/Gravel041/` | https://ambientcg.com/view?id=Gravel041 | Playground splat ground: road shoulders |

## Poly Haven (https://polyhaven.com/license)

| Asset | Path | Source | Authors | Use |
| --- | --- | --- | --- | --- |
| sunset_jhbcentral 1K HDR | `hdri/sunset_jhbcentral_1k.hdr` | https://polyhaven.com/a/sunset_jhbcentral | Dimitrios Savva (Photography), Greg Zaal (Processing) | Arena world-fixed HDRI sky (low-res for mobile) |
| kloofendal_48d_partly_cloudy_puresky 1K HDR + 4K/1K tone-mapped JPG | `hdri/kloofendal_48d_partly_cloudy_puresky_*` | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | Greg Zaal (Original), Jarod Guest (Sky edits) | Playground sky (HDR lights, 4K JPG background) |
| Rock 07 (1k glTF, simplified, 512 webp, quantized) | `polyhaven/rock_07.glb` | https://polyhaven.com/a/rock_07 | Jenelle van Heerden | Playground rideable rocks |
| Rock 09 (same processing) | `polyhaven/rock_09.glb` | https://polyhaven.com/a/rock_09 | Jenelle van Heerden | Playground rideable rocks |
| Namaqualand Boulder 04 (same processing) | `polyhaven/namaqualand_boulder_04.glb` | https://polyhaven.com/a/namaqualand_boulder_04 | Jenelle van Heerden | Playground solid boulders |
| Quiver Tree 01 (same processing, ~2.8k tris) | `polyhaven/quiver_tree_01.glb` | https://polyhaven.com/a/quiver_tree_01 | James Ray Cock, Dario Barresi (Photography), Rico Cilliers (Modeling) | Playground trees (collision posts) |
| Dead Tree Trunk (same processing) | `polyhaven/dead_tree_trunk.glb` | https://polyhaven.com/a/dead_tree_trunk | Rob Tuytel | Playground rideable logs |
| Tree Stump 01 (same processing) | `polyhaven/tree_stump_01.glb` | https://polyhaven.com/a/tree_stump_01 | Rob Tuytel | Playground solid stumps |

## Quaternius — Universal Base Characters (Standard, free)

- `assets/quaternius/ubc-superhero-male.glb` — `Superhero_Male_FullBody` (Godot - UE glTF) from the
  Universal Base Characters [Standard] kit by Quaternius (https://quaternius.com). Packed to GLB with
  textures resized to 512 px (gltf-transform). Used as the Playground rider (rider-ubc.js).
- Licence: CC0 1.0 Universal (Public Domain Dedication), https://creativecommons.org/publicdomain/zero/1.0/
  (from the kit's `License_Standard.txt`: "License: CC0 1.0 Universal (CC0 1.0) Public Domain Dedication ... Models by @Quaternius").

## Real-world map data (towns/korumburra)

| Data | Path | Source | Licence | Use |
| --- | --- | --- | --- | --- |
| Buildings, roads, paths, parks around Korumburra, Victoria (bbox 145.8146,-38.4397,145.8330,-38.4253) | `towns/korumburra/town.json`, `towns/korumburra/roofs.bin` | © OpenStreetMap contributors, https://www.openstreetmap.org/copyright | ODbL 1.0 (attribution shown on the in-game town sign) | Playground real town: building footprints/heights, road network |
| Elevation, 4 m resample of zoom-15 Terrarium tiles | `towns/korumburra/terrain.bin` | AWS Terrain Tiles (Tilezen/Mapzen), https://registry.opendata.aws/terrain-tiles/ (SRTM, GMTED, ETOPO1 and other public sources) | Open data, attribution | Playground real town ground |

## Kenney — Mini Skate (CC0)

| Asset | Path | Source | Use |
| --- | --- | --- | --- |
| Mini Skate 2.0 GLB pieces (half-pipe, ramp, steps, slope-smooth, rails, fence, benches, floor) + colormap | `kenney/mini-skate/` | https://kenney.nl/assets/mini-skate (License.txt included) | Playground skate park; `park.json` layout and `height.bin` collision baked by `tools/bake-skatepark.mjs` |

## Quaternius — Stylized Nature MegaKit (Standard, free)
- `assets/quaternius/nature/` — dead trees, desert rocks, dry grass, plants, pebbles, rock paths for the desert canyon bike track.
- License: CC0 1.0 (see `assets/quaternius/nature/License.txt`). Models by @Quaternius — https://quaternius.com
- Textures resized; grass recoloured to dry gold, Rock_Medium uses the kit's desert rock texture.

## Neon Canal level
- Sky: Poly Haven `qwantani_dusk_2_puresky` (CC0) — https://polyhaven.com/a/qwantani_dusk_2_puresky — background colour-graded purple/orange (`assets/hdri/neon_sunset_*`).
- Textures: ambientCG `Asphalt026C`, `Concrete034` (CC0) — https://ambientcg.com
- Graffiti, fence, windows, chevrons, signs and palms are generated in code (`ride-neon-world.js`).
