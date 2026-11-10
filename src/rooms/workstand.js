// Workshop bike on a proper repair workstand: after every workshop bike rebuild (app.js calls
// __WK_BUILD_HOOK__ with the new bike root), the low display post ('wk:stand') is hidden, a kit
// workstand (src/props/kit/parts-stand.js) is added inside that group, and the bike is raised 18 cm
// so the clamp holds the seat post. Only the main workshop view is changed: part previews and other
// renders are put back on the next frame. The workstand lives inside 'wk:stand', so every place that
// already hides the display post (rides, stickers, tricks) hides the workstand too.
import * as T from '../../vendor/three.module.js';
import { createKit } from '../props/kit/index.js';

export const STAND_LIFT = .18, STAND_BASE_Y = .04, STAND_BEHIND = .42;
let kit = null;

export function mountWorkstand(root) {
 const post = root.children.find(c => c.name === 'wk:stand');
 if (!post || Math.abs(root.position.y - STAND_BASE_Y) > 1e-6 || root.rotation.y || root.rotation.z) return null; // fresh build at the display height only
 for (const old of post.children.filter(c => c.name === 'wk:workstand')) old.removeFromParent(); // a rebuild that kept the post group
 kit ||= createKit(T);
 const A = root.userData.wkAnchors; let cx, cy;
 if (A?.seatTop) { cx = A.seatTop[0]; cy = A.seatTop[1] + .05; } // on the seat post, just above the seat tube
 else { root.updateMatrixWorld(true); const b = new T.Box3().setFromObject(post); cx = (b.min.x + b.max.x) / 2 - root.position.x; cy = b.max.y - root.position.y + .02; } // no seat post: under the bottom bracket
 const hidden = post.children.filter(c => c.visible); for (const c of hidden) c.visible = false;
 root.position.y += STAND_LIFT;
 const ground = -root.position.y, stand = kit.build('workstand', { clampHeight: cy - ground, reach: STAND_BEHIND });
 stand.name = 'wk:workstand'; stand.position.set(cx, ground, -STAND_BEHIND); post.add(stand);
 const undo = () => { stand.removeFromParent(); for (const c of hidden) c.visible = true; root.position.y -= STAND_LIFT; delete root.userData.wkWorkstand; };
 root.userData.wkWorkstand = { lift: STAND_LIFT, clamp: [cx, cy, 0], undo };
 return root.userData.wkWorkstand;
}

const mainScene = () => globalThis.__WK_VIEW__?.scene || null;
function onBuilt(root) {
 const m = mountWorkstand(root); if (!m) return;
 // keep it only on the main workshop bike (the root is added to its scene right after the hook)
 requestAnimationFrame(() => { let s = root; while (s.parent) s = s.parent; const main = mainScene(); if (main && s !== main && root.userData.wkWorkstand === m) m.undo(); });
}
function wrap() {
 const h = globalThis.__WK_BUILD_HOOK__; if (!h) return false; if (h.wkWorkstand) return true;
 const w = (root, info, T3) => { const out = h(root, info, T3); try { onBuilt(root); } catch (e) { console.warn('wk workstand', e); } return out; };
 w.wkWorkstand = true; globalThis.__WK_BUILD_HOOK__ = w; return true;
}
if (!wrap()) { const iv = setInterval(() => { if (wrap()) clearInterval(iv); }, 50); }
globalThis.__WK_WORKSTAND__ = { lift: STAND_LIFT, state() { const v = globalThis.__WK_VIEW__; let root = null; v?.scene?.traverse(o => { if (!root && o.userData?.wkWorkstand) root = o; }); if (!root) return { mounted: false }; root.updateMatrixWorld(true); const b = new T.Box3(), st = root.getObjectByName('wk:workstand'); root.traverse(o => { if (o.isMesh && o.visible && !st?.getObjectById(o.id) && o !== st) { let p = o, vis = true; while (p) { if (!p.visible) vis = false; p = p.parent; } if (vis) b.expandByObject(o); } }); return { mounted: true, rootY: root.position.y, standVisible: !!st?.visible, bikeMinY: b.min.y, clamp: root.userData.wkWorkstand.clamp, parts: st ? st.children.map(c => c.userData.kit?.type).filter(Boolean) : [] }; } };
