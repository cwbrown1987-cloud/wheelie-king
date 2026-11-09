// Branded boot: update check + workshop warm-up. Settings "Check for update" stays as manual fallback.
import { pickLoadingTip } from './loading-tips.js';

const RELOAD_GUARD = 'wk-boot-reloaded';
const HARD_MAX_MS = 3000;

function shortBuild(id) {
  const s = String(id || '');
  const m = s.match(/racefix\d+|wk-[\w.-]+$/);
  return m ? m[0] : (s.slice(-24) || 'unknown');
}

async function remoteCacheName() {
  const res = await fetch(`sw.js?wkcb=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('offline');
  const text = await res.text();
  return (text.match(/const\s+CACHE\s*=\s*["']([^"']+)["']/) || [])[1];
}

async function localCacheName() {
  try {
    const keys = await caches.keys();
    return keys.find(k => /wk-/i.test(k)) || keys[0] || '';
  } catch {
    return '';
  }
}

async function activateUpdate(remote) {
  if (sessionStorage.getItem(RELOAD_GUARD) === remote) return false;
  const regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
  await Promise.all(regs.map(async r => {
    try { await r.update(); } catch {}
    try { await r.unregister(); } catch {}
  }));
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch {}
  // localStorage / IndexedDB saves untouched
  sessionStorage.setItem(RELOAD_GUARD, remote);
  const u = new URL(location.href);
  u.searchParams.set('wkcb', String(Date.now()));
  location.replace(u.href);
  return true;
}

export function mountBootLoader() {
  let root = document.getElementById('wk-boot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'wk-boot';
    root.innerHTML = `
      <div class="wk-boot-card" role="status" aria-live="polite" aria-label="Loading Wheelie King">
        <img class="wk-boot-logo" src="./icons/icon-512.png" width="96" height="96" alt="Wheelie King">
        <strong class="wk-boot-title">WHEELIE KING</strong>
        <span class="wk-boot-sub" data-boot-msg>Starting workshop…</span>
        <div class="wk-boot-bar"><i data-boot-bar></i></div>
        <span class="wk-boot-tip" data-boot-tip></span>
      </div>`;
    document.body.append(root);
  }
  if (!root.querySelector('[data-boot-tip]')) {
    const tip = document.createElement('span');
    tip.className = 'wk-boot-tip';
    tip.dataset.bootTip = '';
    root.querySelector('.wk-boot-card')?.append(tip);
  }
  const msg = root.querySelector('[data-boot-msg]');
  const bar = root.querySelector('[data-boot-bar]');
  const tipEl = root.querySelector('[data-boot-tip]');
  let tipTimer = 0;
  const rotateTip = () => {
    if (tipEl) tipEl.textContent = pickLoadingTip();
  };
  rotateTip();
  tipTimer = setInterval(rotateTip, 2800);
  const set = (pct, text) => {
    if (msg && text) msg.textContent = text;
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  };
  return {
    set,
    async hide() {
      clearInterval(tipTimer);
      root.classList.add('is-done');
      await new Promise(r => setTimeout(r, 220));
      root.remove();
    },
  };
}

export async function runBootSequence({ warmWorkshop, lazyLoad } = {}) {
  const ui = mountBootLoader();
  const t0 = performance.now();
  let finished = false;
  const hardCap = new Promise(resolve => {
    setTimeout(() => resolve('timeout'), HARD_MAX_MS);
  });

  const work = (async () => {
    ui.set(8, 'Checking for updates…');
    try {
      const remote = await remoteCacheName();
      const local = await localCacheName();
      const guarded = sessionStorage.getItem(RELOAD_GUARD);
      if (remote && local && shortBuild(remote) !== shortBuild(local) && guarded !== remote) {
        ui.set(16, `Updating to ${shortBuild(remote)}…`);
        if (await activateUpdate(remote)) return { reloaded: true };
      } else if (guarded && remote && guarded === remote) {
        sessionStorage.removeItem(RELOAD_GUARD);
      }
    } catch {
      ui.set(16, 'Offline — using cached build');
    }

    ui.set(28, 'Loading workshop…');
    if (typeof warmWorkshop === 'function') {
      await warmWorkshop(p => ui.set(28 + Math.max(0, Math.min(1, p)) * 62, 'Warming workshop…'));
    }
    ui.set(100, 'Ready');
    return { reloaded: false };
  })();

  const result = await Promise.race([
    work.then(r => ({ kind: 'done', r })),
    hardCap.then(() => ({ kind: 'timeout' })),
  ]);

  if (result.kind === 'timeout') {
    ui.set(100, 'Ready');
  } else if (result.r?.reloaded) {
    return { reloaded: true, ms: performance.now() - t0 };
  }

  // Never pad — hide as soon as ready (or at hard max).
  finished = true;
  await ui.hide();
  Promise.resolve().then(() => lazyLoad?.()).catch(() => {});
  return { reloaded: false, ms: performance.now() - t0, timedOut: result.kind === 'timeout' };
}

globalThis.__WK_BOOT__ = { runBootSequence, mountBootLoader };
