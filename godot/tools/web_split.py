#!/usr/bin/env python3
"""Cloudflare Pages refuses files over 25 MiB, and Godot's index.wasm (~44 MB) and index.pck are bigger.
Split every file over 20 MiB into .partN chunks, write parts.json, and inject a tiny fetch shim into
index.html that stitches the parts back together in the browser (same bytes, same content type)."""
import json, os, sys

out = sys.argv[1] if len(sys.argv) > 1 else "build/godot-web"
LIMIT = 20 * 1024 * 1024
parts = {}
for name in sorted(os.listdir(out)):
    p = os.path.join(out, name)
    if not os.path.isfile(p) or os.path.getsize(p) <= LIMIT:
        continue
    with open(p, "rb") as f:
        i = 0
        while True:
            chunk = f.read(LIMIT)
            if not chunk:
                break
            with open(f"{p}.part{i}", "wb") as g:
                g.write(chunk)
            i += 1
    os.remove(p)
    parts[name] = i
    print(f"split {name} into {i} parts")
with open(os.path.join(out, "parts.json"), "w") as f:
    json.dump(parts, f)

SHIM = """<script>(function(){var parts=%s;var of=window.fetch.bind(window);
window.fetch=function(u,o){var s=typeof u==='string'?u:(u&&u.url)||'';var m=s.match(/([^\\/?#]+)(\\?[^#]*)?$/);var n=m&&parts[m[1]];
if(!n)return of(u,o);var base=s.replace(/(\\?[^#]*)?$/,'');var q=m[2]||'';var list=[];for(var i=0;i<n;i++)list.push(of(base+'.part'+i+q,o).then(function(r){if(!r.ok)throw new Error('part '+r.status);return r.arrayBuffer();}));
return Promise.all(list).then(function(bufs){var t=/\\.wasm$/.test(m[1])?'application/wasm':'application/octet-stream';var b=new Blob(bufs,{type:t});
return new Response(b,{status:200,headers:{'Content-Type':t,'Content-Length':String(b.size)}});});};})();</script>""" % json.dumps(parts)

idx = os.path.join(out, "index.html")
html = open(idx, encoding="utf-8").read()
if parts and "window.fetch=function" not in html:
    html = html.replace("<head>", "<head>" + SHIM, 1)
    open(idx, "w", encoding="utf-8").write(html)
    print("shim injected")
