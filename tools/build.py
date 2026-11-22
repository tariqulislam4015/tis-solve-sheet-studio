#!/usr/bin/env python3
"""Build the single-file app: src/ -> index.html (works offline & on GitHub Pages)."""
import base64, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'
html = (src / 'index.src.html').read_text(encoding='utf8')
engine = (src / 'engine.js').read_text(encoding='utf8')
tpl = json.dumps(json.loads((src / 'template.json').read_text(encoding='utf8')), ensure_ascii=False).replace('</', '<\\/')
b64 = lambda p: 'data:image/jpeg;base64,' + base64.b64encode((src / 'assets' / p).read_bytes()).decode()
html = (html.replace('/*__ENGINE__*/', engine)
            .replace('/*__TPL__*/null', tpl)
            .replace('__PHOTO__', b64('photo.jpg'))
            .replace('__LOGO__', b64('logo.jpg')))
(root / 'index.html').write_text(html, encoding='utf8')
print(f'index.html built ({len(html)/1024:.0f} KB)')
