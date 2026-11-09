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
  if (gpu) opts.headless = 'new';
  return opts;
}

export function launchBrowser(opts) {
  return chromium.launch(getLaunchOptions(opts));
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
