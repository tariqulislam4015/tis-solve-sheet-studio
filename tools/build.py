#!/usr/bin/env python3
"""Build the single-file app: src/ -> index.html (works offline & on GitHub Pages)."""
import base64, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'
rd = lambda n: (src / n).read_text(encoding='utf8')
def data_url(p):
    b = p.read_bytes()
    mime = 'image/jpeg' if p.suffix.lower() in ('.jpg', '.jpeg') else 'image/png'
    return f'data:{mime};base64,' + base64.b64encode(b).decode()
tpl = json.dumps(json.loads(rd('template.json')), ensure_ascii=False).replace('</', '<\\/')
c5 = src / 'assets' / 'c5'
c5_assets = {
    'cover_front_BV': data_url(c5 / 'cover_front_BV.jpg'), 'cover_back_BV': data_url(c5 / 'cover_back_BV.jpg'),
    'cover_front_EV': data_url(c5 / 'cover_front_EV.jpg'), 'cover_back_EV': data_url(c5 / 'cover_back_EV.jpg'),
    'footer_BV': data_url(c5 / 'footer_orig_BV.png'), 'footer_EV': data_url(c5 / 'footer_orig_EV.png'),
    'footer_logo': data_url(c5 / 'footer_logo.png'),
}
for pre in ('c8', 'cd'):  # Class 8, Cadet
    for lang in ('BV', 'EV'):
        c5_assets[f'{pre}_cover_front_{lang}'] = data_url(c5 / f'{pre}_cover_front_{lang}.jpg')
        c5_assets[f'{pre}_cover_back_{lang}'] = data_url(c5 / f'{pre}_cover_back_{lang}.jpg')
        c5_assets[f'{pre}_footer_{lang}'] = data_url(c5 / f'{pre}_footer_orig_{lang}.png')
html = (rd('index.src.html')
        .replace('/*__ENGINE__*/', rd('engine.js'))
        .replace('/*__C5ENGINE__*/', rd('c5engine.js'))
        .replace('/*__C5RENDER__*/', rd('c5render.js'))
        .replace('/*__C5ASSETS__*/', 'window.C5_ASSETS = ' + json.dumps(c5_assets) + ';')
        .replace('/*__C5UI__*/', rd('c5ui.js'))
        .replace('/*__TPL__*/null', tpl)
        .replace('__PHOTO__', data_url(src / 'assets' / 'photo.jpg'))
        .replace('__LOGO__', data_url(src / 'assets' / 'logo.jpg')))
(root / 'index.html').write_text(html, encoding='utf8')
print(f'index.html built ({len(html)/1024:.0f} KB)')
