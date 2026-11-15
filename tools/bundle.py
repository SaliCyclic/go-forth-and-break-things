#!/usr/bin/env python3
"""Bundle game/ into one self-contained HTML file (inlined JS + data-URI assets)."""
import sys, os, re, json, base64
G, OUT = sys.argv[1], sys.argv[2]
order = ['font', 'audio', 'data', 'ui', 'game', 'main']
js = []
names = {}
for m in order:
    src = open(f'{G}/src/{m}.js').read()
    src = re.sub(r"import\s*\{[^}]*\}\s*from\s*'[^']*';\s*", '', src, flags=re.S)
    src = re.sub(r'^export ', '', src, flags=re.M)
    for n in re.findall(r'^(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)', src, flags=re.M):
        if n in names: raise SystemExit(f'top-level name clash: {n} in {m} and {names[n]}')
        names[n] = m
    js.append(f'// ---- {m}.js ----\n' + src)
assets = {}
for root, _, files in os.walk(f'{G}/assets'):
    for f in files:
        p = os.path.join(root, f); rel = os.path.relpath(p, G).replace(os.sep, '/')
        if f.endswith('.png'): assets[rel] = 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
manifest = json.load(open(f'{G}/assets/manifest.json'))
html = open(f'{G}/index.html').read()
bundle = 'window.__BUNDLE = ' + json.dumps({'manifest': manifest, 'files': assets}) + ';\n'
code = '(function(){\n' + '\n'.join(js) + '\n})();'
html = html.replace('<script type="module" src="src/main.js"></script>', '<script>\n' + bundle + '</script>\n<script>\n' + code + '\n</script>')
os.makedirs(os.path.dirname(OUT), exist_ok=True); open(OUT, 'w').write(html)
print(OUT, round(len(html) / 1024), 'KB')
