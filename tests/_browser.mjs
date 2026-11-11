import {chromium} from 'playwright';

/** Shared Playwright launch for Wheelie King tests.
 *  Default: SwiftShader (software GL) for CI/box.
 *  WK_GPU=1: real GPU (D3D11 on Windows, ANGLE/GL elsewhere) + headless "new".
 *  WK_BROWSER overrides channel (default chrome).
 *  WK_FAST=1: prefer deviceScaleFactor 1 when a page omits it (lower render cost).
 */
export function getLaunchOptions({extraArgs = [], forceGpu = false} = {}) {
  const gpu = forceGpu || process.env.WK_GPU === '1' || process.env.WK_GPU === 'true';
  const args = gpu
    ? [
        ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : ['--use-gl=angle']),
        '--ignore-gpu-blocklist',
        ...extraArgs,
      ]
    : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...extraArgs];
  const opts = {
    channel: process.env.WK_BROWSER || 'chrome',
    args,
  };
  if (gpu) opts.headless = true;
  return opts;
}

// v2.0 beta opens straight into the Playground (autostart.js). Tests start in the Garage as before;
// tests/autostart.mjs removes this flag to check the real default boot.
const NO_AUTOSTART = () => { try { if (sessionStorage.getItem('wk-autostart') == null) sessionStorage.setItem('wk-autostart', 'off'); } catch {} };
export async function launchBrowser(opts) {
  const browser = await chromium.launch(getLaunchOptions(opts));
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (o) => { const c = await newContext(o); await c.addInitScript(NO_AUTOSTART); return c; };
  browser.newPage = async (o) => { const c = await browser.newContext(o); const p = await c.newPage(); p.on('close', () => c.close().catch(() => {})); return p; };
  return browser;
}

/** Merge page options; under WK_FAST=1 set deviceScaleFactor to 1 when unset. */
export function pageOptions(opts = {}) {
  if (process.env.WK_FAST !== '1' && process.env.WK_FAST !== 'true') return opts;
  const out = {...opts};
  if (out.deviceScaleFactor == null) out.deviceScaleFactor = 1;
  return out;
}

export function isGpu() {
  return process.env.WK_GPU === '1' || process.env.WK_GPU === 'true';
}

export function isFast() {
  return process.env.WK_FAST === '1' || process.env.WK_FAST === 'true';
}

/** Chris's classic side-scroller (Trials/Endless) is dev-only in v2.0: reachable via ?legacy=1. */
export function withLegacy(url, mode = '1') {
  const u = new URL(url);
  u.searchParams.set('legacy', mode);
  return u.toString();
}
