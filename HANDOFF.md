# Wheelie King: Outback — Handoff for Codex
Owner: Chris (Korumburra VIC, AEDT). This is a private game for him and his son, aimed at teens and adults.

## Where things are
- Live app (PWA): https://wheelie-king.pages.dev (Cloudflare Pages project `wheelie-king`, deployed with wrangler)
- Repo: https://github.com/cwbrown1987-cloud/wheelie-king (public). main is at commit 7120540, which has the full app sync, with the stickers in assets/stickers/pack1 and pack2.
- GitHub Pages is NOT enabled yet. In Settings > Pages, set the branch to main and the folder to root. It will then be at https://cwbrown1987-cloud.github.io/wheelie-king/
- Source on the bot's computer: /workspace/wheelie-king-app/
- Stickers: /workspace/stickers/pack1/ and /workspace/stickers/pack2/ (the latest 5, each in a different style)

## Tech
- three.js with a procedurally built bike, OrbitControls and PBR materials. The pixel ratio is capped at 2.
- The modular part registry gives each part a builder(), mount anchors, weight, stats and plain-language effects. The centre of gravity is calculated from part weights and world positions, and it changes the balance point.
- Stickers are applied with DecalGeometry, wrap the frame and can be resized. Custom photo stickers get automatic background removal, crop and a die-cut border, with adjustments.
- PWA: manifest, service worker (cache wk-v3), relative ./ paths and .nojekyll.
- Content ratings are all, teen and adult18. 18+ stickers stay hidden until the PIN is entered in Settings. Only a SHA-256 hash of the PIN is stored, the PIN can be changed, and locking or unlocking also applies to stickers already on bikes.

## In progress / next
1. UI rebuild DONE (4 Nov, cache wk-v4): full screen, collapsible panels with Back buttons, stickers page, 3D part sheet with View on Bike, and mount snapping with centre-of-gravity updates. Still to do: test on real phones, add a rear rack part (HAS_RACK), save mount positions, and remove the window.__wkFit test helper. Original asks:
   - fill the full screen (no letterboxing)
   - side menus that collapse, with each category opening a full side panel that has a Back button
   - stickers on their own full page with a Back button
   - a "View on bike" preview on part sheets, without buying
   - small parts that snap between several realistic mount points, with the centre of gravity updating
2. Stickers: aim for a huge mix of styles. Chris's glossy drippy style is the base for only SOME of them. Themes are e-bike, e-moto, BMX, MTB, kick scooter and e-scooter, with Aussie themes first, then US, UK, NZ and Euro. The mix runs from clean young-teen stickers to crude adult ones.
   - Rules: any character with alcohol, smoking, weed or weapons must be clearly adult. No copies of real logos (brand names in plain text are fine).
3. Gameplay, part 1: a 2.5D side-view ride in a basic untextured 3D world. The physics covers pitch, gravity and centre of gravity, and looping a wheelie too far throws you off.
4. Gameplay, later: a full 3D street with side, first-person and chase cameras, a speed gauge, scrape damage, and part wear and breakage with repair or replace.
