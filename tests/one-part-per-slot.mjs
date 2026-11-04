import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const URL_ = process.argv[2] || "http://localhost:8931/", OUT = "test-results/slots" + (process.argv[3]||"") + "-";
mkdirSync("test-results", { recursive: true });
const b = await chromium.launch({ channel: process.env.WK_BROWSER || "chrome", args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({ viewport: { width: 900, height: 420 }, deviceScaleFactor: 1.5, hasTouch: true, serviceWorkers: "block" });
const p = await ctx.newPage(); p.setDefaultTimeout(30000); const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", m => /wk (hook|frame|spokes|detail|cond)/.test(m.text()) && errs.push(m.text()));
await p.goto(URL_ + "?v=" + Date.now()); await p.waitForFunction(() => globalThis.__WK_VIEW__, null, { timeout: 40000 });
await p.evaluate(() => { __WK_VIEW__.controls.autoRotate = false; });
// open a category so the card renderer runs and exposes the equip fn
await p.click('[data-cat="bars"]', { force: true }); await p.waitForFunction(() => globalThis.__WK_EQUIP__, null, { timeout: 10000 });
const slots = ["shock","bars","grips","seat","rims","cranks","chain","fender_f","fender_r","bash","lights","suspension","tyres","brakes","frame","motor","battery","controller","throttle","sprocket_f","sprocket_r","wing","rear_frame"];
const added = new Set(["shock","fender_f","fender_r","bash","lights","wing","rear_frame"]);
let fails = 0, skipped = 0;
for (const slot of slots) {
  const ids = await p.evaluate((s) => __WK_CAT__().items.filter(i => i.slot === s).map(i => i.id), slot);
  for (const id of ids) {
    const fitStatus = await p.evaluate((id) => __WK_FIT__(__WK_BUILD__, id).status, id); if (fitStatus === "no") { skipped++; continue; }
    await p.evaluate((id) => __WK_EQUIP__(id), id); await p.waitForTimeout(250);
    const r = await p.evaluate(([slot, id, isAdded]) => { const v = __WK_VIEW__; let root; v.scene.traverse(o => { if (!root && o.name === "wk:frame") root = o.parent; });
      const groups = root.children.filter(c => c.name === "wk:part:" + slot).length, same = root.children.filter(c => c.name === "wk:" + slot).length;
      let roots = 0; v.scene.traverse(o => { if (o.children?.some?.(c => c.name === "wk:frame")) roots++; });
      let spF = 0, spR = 0, chains = 0; root.traverse(o => { if (["sprocketF", "mid:chainring", "motoMid:sprocket"].includes(o.name)) spF++; if (o.name === "sprocketR") spR++; if (o.name === "wk:model:chain") chains++; });
      return { equipped: __WK_BUILD__?.[slot] === id, groups, same, roots, isAdded, spF, spR, chains }; }, [slot, id, added.has(slot)]);
    const ok = r.roots === 1 && r.spF === 1 && r.spR === 1 && r.chains === 1 && (r.isAdded ? r.groups === 1 : r.groups === 0 && r.same <= 1);
    if (!ok || !r.equipped) { fails++; console.log("FAIL", slot, id, JSON.stringify(r)); }
  }
  console.log("slot", slot, ids.length, "options ok");
}
console.log("one-mesh-per-slot test fails:", fails, "skipped (won't fit this frame):", skipped, "errors:", errs.slice(0,3));
// showcase build
for (const id of ["moto","mmid8k","moto72","thumb","dnm","shk_moto230","bar_moto","grip_lock","seat_moto","rim_gold","chain_gold","ff_neon","fr_mx","bash_skid","light_moto"]) { await p.evaluate((id) => __WK_EQUIP__(id), id); await p.waitForTimeout(200); }
await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find(e => /BACK/.test(e.textContent)); b && b.click(); });
const view = (t, c) => p.evaluate(([t, c]) => { const v = __WK_VIEW__; v.controls.target.set(...t); v.camera.position.set(...c); v.controls.update(); }, [t, c]);
await view([0.15, 0.45, 0], [0.5, 0.75, 2.0]); await p.waitForTimeout(800); await p.screenshot({ path: OUT + "1-full-moto-build.png" });
await view([0.15, 0.45, 0], [-0.9, 0.7, 1.6]); await p.waitForTimeout(800); await p.screenshot({ path: OUT + "2-rear-three-quarter.png" });
for (const id of ["bmx","bbs02","hl48","rigid","shk_coil150","bar_riser","grip_moto","seat_slim","rim_alloy","crank_alloy","chain_std","ff_low","fr_short","bash_alu","light_led"]) { await p.evaluate((id) => __WK_EQUIP__(id), id); await p.waitForTimeout(200); }
await view([0.15, 0.45, 0], [0.5, 0.75, 2.0]); await p.waitForTimeout(800); await p.screenshot({ path: OUT + "3-bmx-light-build.png" });
await p.click('[data-cat="fender_r"]', { force: true }); await p.waitForTimeout(600); await p.screenshot({ path: OUT + "4-fender-category.png" });
console.log("money", (await p.evaluate(() => document.body.innerText)).includes("∞"));
await b.close();
if (fails || errs.length) process.exitCode = 1;
