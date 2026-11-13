// Lists shipped files nothing in the game uses (v2.1-57), so old models, textures, scripts and placeholders don't
// pile up again. `node tools/find-unused.mjs` prints them; `--check` exits 1 if there are any (run by
// scripts/check.mjs static, so CI fails when something unused is added). Keep a file on purpose by listing it in
// tools/keep-files.txt.
// Used = reachable from index.html / the service-worker shell through static or dynamic imports, or named (by path
// or bare file name) in a reachable script, page, JSON, glTF or CSS file. Tests and tools do not count.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, basename, extname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const SHIPPED = ['assets', 'src', 'stickers', 'icons'];
const all = new Set();
const walk = d => { for (const e of readdirSync(join(root, d), { withFileTypes: true })) { const p = posix.join(d, e.name); if (e.isDirectory()) walk(p); else all.add(p); } };
for (const d of SHIPPED) if (existsSync(join(root, d))) walk(d);
for (const e of readdirSync(root, { withFileTypes: true })) if (e.isFile() && /\.js$/.test(e.name)) all.add(e.name);
const keep = new Set(existsSync(join(root, 'tools/keep-files.txt')) ? readFileSync(join(root, 'tools/keep-files.txt'), 'utf8').split('\n').map(s => s.replace(/#.*/, '').trim()).filter(Boolean) : []);
// 1. scripts reachable by import
const read = f => { try { return readFileSync(join(root, f), 'utf8'); } catch { return ''; } };
const used = new Set(), queue = [];
const add = f => { f = posix.normalize(f).replace(/^\.\//, ''); if (!used.has(f) && existsSync(join(root, f)) && statSync(join(root, f)).isFile()) { used.add(f); queue.push(f); } };
const html = read('index.html');
for (const m of html.matchAll(/(?:src|href)=["']\.?\/?([^"'?#]+)["']/g)) add(m[1]);
const sw = read('sw.js'); add('sw.js'); add('index.html'); add('manifest.webmanifest'); add('ride-preload.json');
for (const m of (sw.match(/const SHELL = (\[.*?\]);/s)?.[1] || '').matchAll(/"\.\/([^"]+)"/g)) add(m[1]);
const texts = [];
while (queue.length) { const f = queue.shift(), ext = extname(f); if (!/\.(js|mjs|html|json|gltf|css|webmanifest)$/.test(ext)) continue; const src = read(f); texts.push(src);
  if (/\.(js|mjs)$/.test(ext)) for (const m of src.matchAll(/(?:import|export)\s[^'"`]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)|import\s+['"](\.[^'"]+)['"]/g)) add(posix.join(dirname(f), m[1] || m[2] || m[3]));
  if (ext === '.gltf') { try { const g = JSON.parse(src); for (const x of [...(g.buffers || []), ...(g.images || [])]) if (x.uri && !x.uri.startsWith('data:')) add(posix.join(dirname(f), decodeURIComponent(x.uri))); } catch {} }
  if (ext === '.json') for (const m of src.matchAll(/"((?:assets|src|stickers|icons)\/[^"]+)"/g)) add(m[1]); }
// 2. assets named in any reachable text (path or bare name, with or without extension)
let blob = texts.join('\n');
let grew = true; while (grew) { grew = false;
  for (const f of all) { if (used.has(f)) continue; const b = basename(f), stem = b.slice(0, b.length - extname(b).length);
    const hit = blob.includes(f) || blob.includes(b) || (stem.length > 3 && new RegExp(`['"\`/:]${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:['"\`.]|$)`, 'm').test(blob));
    if (hit) { add(f); grew = true; while (queue.length) { const q = queue.shift(); if (/\.(js|json|gltf|css)$/.test(q)) { const src = read(q); texts.push(src); if (extname(q) === '.gltf') { try { const g = JSON.parse(src); for (const x of [...(g.buffers || []), ...(g.images || [])]) if (x.uri && !x.uri.startsWith('data:')) add(posix.join(dirname(q), decodeURIComponent(x.uri))); } catch {} } } } } }
  blob = texts.join('\n'); }
const unused = [...all].filter(f => !used.has(f) && !keep.has(f) && !/(^|\/)(LICENSE|LICENSES|README|.*License)[^/]*$/i.test(f)).sort();
let bytes = 0; for (const f of unused) bytes += statSync(join(root, f)).size;
if (process.argv.includes('--json')) console.log(JSON.stringify(unused)); else { for (const f of unused) console.log(f); console.log(`${unused.length} unused files, ${(bytes / 1e6).toFixed(1)} MB`); }
if (process.argv.includes('--check') && unused.length) { console.error('Unused shipped files (delete them or list them in tools/keep-files.txt):\n' + unused.join('\n')); process.exit(1); }
