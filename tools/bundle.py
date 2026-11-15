#!/usr/bin/env python3
"""Bundle game/ into one self-contained HTML file (inlined JS + data-URI assets)."""
import sys, os, re, json, base64
G, OUT = sys.argv[1], sys.argv[2]
order = ['font', 'audio', 'data', 'ui', 'game', 'camp', 'main']
js = []
names = {}
for m in order:
    src = open(f'{G}/src/{m}.js').read()
    src = re.sub(r"import\s*\{[^}]*\}\s*from\s*'[^']*';\s*", '', src, flags=re.S)
    src = re.sub(r'(^|;\s*)export\s+(?=(?:const|let|function|class|async)\b)', r'\1', src, flags=re.M)
    if re.search(r'\bexport\b\s+(?:const|let|function|class|default|\{)', src): raise SystemExit(f'unhandled export in {m}.js')
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
# syntax-check the bundled script (the module sources can be fine while the concatenation is not)
import shutil, subprocess, tempfile
if shutil.which('node'):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as tf: tf.write(code)
    r = subprocess.run(['node', '--check', tf.name], capture_output=True, text=True); os.unlink(tf.name)
    if r.returncode: raise SystemExit('bundled script has a syntax error:\n' + r.stderr[:2000])
os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True); open(OUT, 'w').write(html)
print(OUT, round(len(html) / 1024), 'KB')
