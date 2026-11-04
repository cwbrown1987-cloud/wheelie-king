import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
// Publish only game runtime assets; never upload attachments, chat logs or tests.
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
const files = readdirSync(root).filter(name => name.endsWith('.js'));
for (const name of [...files, 'index.html', 'manifest.webmanifest', '_headers', '.nojekyll', 'vendor', 'stickers', 'icons']) {
  cpSync(join(root, name), join(dist, name), { recursive: true });
}
const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
const shell = JSON.parse(sw.match(/const SHELL = (\[.*?\]);/s)[1]);
for (const asset of shell) {
  if (!existsSync(join(dist, asset))) throw new Error(`Missing precache asset: ${asset}`);
}
console.log(`Prepared ${sw.match(/const CACHE = "([^"]+)"/)[1]} in dist/`);
if (!process.argv.includes('--stage-only')) {
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
    '--yes', 'wrangler@4.157.0', 'pages', 'deploy', 'dist',
    '--project-name', 'wheelie-king', '--branch', 'main', '--commit-dirty=true',
  ], {
    cwd: root, stdio: 'inherit', shell: process.platform === 'win32',
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: '7f9b89a42182a51327a119efb6cf949e' },
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
