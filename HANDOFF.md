# Wheelie King: Outback — Handoff for Codex

> **Full transcript:** read `wheelie-king-CHAT-HISTORY.md` for the complete Chris ↔ Odd Job Bot conversation. This file is the short design/tech summary. Next work: gameplay to 2.5D, then full 3D.
Owner: Chris (Korumburra VIC, AEDT). This is a private game for him and his son, aimed at teens and adults.

## Where things are
- Live app (PWA): https://wheelie-king.pages.dev (Cloudflare Pages project `wheelie-king`, deployed with wrangler)
- Repo: https://github.com/cwbrown1987-cloud/wheelie-king (public). main is at commit fba9d424 (wk-v4 UI), with the stickers in assets/stickers/pack1 and pack2.
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

## Full design brief (everything agreed with Chris)
### Bike and garage
- The bike is the main focus, and detail is key. It should be highly detailed, rotatable and zoomable in the 3D garage.
- Everything is modular, so new parts drop straight in. Every part needs its spec AND its intended effects, plus a real weight and a mount point. Weight and centre of gravity matter.
- Parts list: a mix of real e-bike, e-moto, BMX and MTB parts and original ones, each with stats and plain-language effects.
- Part sheets show a 3D part model and a "View on bike" preview that works before buying.
- Small parts snap to several realistic mount points.
- UI: side menus collapse, each category opens a full side panel with a Back button, and stickers have their own full page with a Back button. The app fills the full screen on phones.
- It's an installable PWA for Android and iOS.

### Stickers and vinyls
- A huge range. They're resizable and wrap the frame, and you can choose the position and the side.
- Upload your own photo to make a sticker. It automatically removes the background, crops and adds a die-cut border, and you can adjust it if needed.
- Themes: e-bike, e-moto, BMX, MTB, kick scooter and e-scooter culture (scooters may become rides later). Aussie culture comes first, e.g. "C U in the NT", eshays, Aussie animals and crude Aussie humour. There are also US sets (big there), plus UK, NZ and Euro.
- Ratings: clean young-teen, teen and crude adult. Crude language is fine.
- 18+ lock: very adult stickers are hidden behind an 18+ PIN in Settings. Chris will give you the PIN; only its hash is stored in the code. Uploaded stickers get ratings too.
- Styles: a BIG MIX. Chris's own glossy airbrushed stickers (Aussie animals in sunnies, chunky drippy lettering, thick white die-cut borders) are the base for only SOME of them. Others should be comic panels, retro badges, race number plates, punk stamps, kawaii, and so on, with varied lettering, text placement and shapes.
- Brands: use the plain brand name in brand colours, no copied logos or copied real sticker designs.
- Content lines I held: any character with beer, darts, cigarettes, weed, bongs or knives must look clearly adult. Teen characters get try-hard jokes only.
- Chris's favourite so far is "Faster Than Ya Mum's Mobility Scooter" (the wombat).
- Files:
  - /workspace/stickers/pack1 and pack2 (both also in assets/stickers in the repo)
  - older text sheets (Chris thought these were weak) are in /workspace/stickers/sheet-*.png
  - earlier generated stickers, e.g. the mobility scooter wombat and the 18+ eshay and "Baked Not Fried" ones, are in Odd Job Bot's assets store

### Gameplay vision
- Reference: Chris's screenshot of a 3D street, a rider in a blue helmet on an orange dirt bike, a chase cam and a speed gauge. Ask Chris for the image.
- Stage 1: 2.5D. A side-on camera on a simple untextured 3D world ("flat but with depth": plain shapes and colours, not 2D). The detail goes into the bike.
- Physics: weight, centre of gravity, gravity and pitch. Looping a wheelie too far throws you off.
- Damage: fenders and parts scraping the road show visible damage. Parts wear, scratch, crack and break, then get repaired or replaced.
- Stage 2: full 3D free-roam with switchable side, first-person and third-person chase cameras.

### Links
- Live: https://wheelie-king.pages.dev
- GitHub Pages: https://cwbrown1987-cloud.github.io/wheelie-king/
- Garage preview Page (2D, it can't load three.js): https://cursor.com/canvas/store-3c0c76ee-a94a-40c6-b880-99298dfc214d/a47f8930-ad97-4ae5-9e18-e5301977a222
