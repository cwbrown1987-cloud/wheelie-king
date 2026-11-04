import { spawnSync } from 'node:child_process';
import {stageRuntime,root} from './package.mjs';
import {verifyLive} from './verify-deploy.mjs';

const pack=stageRuntime();
console.log(`Prepared ${pack.files.length} runtime files (${pack.cache})`);
if (!process.argv.includes('--stage-only')) {
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
    '--yes', 'wrangler@4.157.0', 'pages', 'deploy', 'dist',
    '--project-name', 'wheelie-king', '--branch', 'main', '--commit-dirty=true',
  ], {
    cwd: root, stdio: 'inherit', shell: process.platform === 'win32',
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: '7f9b89a42182a51327a119efb6cf949e' },
  });
  if (result.error) throw result.error;
  if(result.status!==0)process.exit(result.status??1);
  await verifyLive(pack);
}
