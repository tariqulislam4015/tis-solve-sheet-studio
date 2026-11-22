#!/usr/bin/env python3
"""Re-create src/template.json from a reference Solution Book .docx.

Usage:  python tools/extract_template.py "EAP-2026 Solution Book, Week-12 (B.V).docx"

Takes the exam-title box, the set banner, styles, fonts, theme and the original
footer (image + page number) from the reference book. Requires: lxml
"""
import base64, json, pathlib, re, sys, zipfile
from lxml import etree

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
ref = zipfile.ZipFile(sys.argv[1])
rd = lambda n: ref.read(n).decode('utf8')
doc = rd('word/document.xml')
root_open = re.search(r'<w:document[^>]*>', doc).group(0)
body = list(etree.fromstring(ref.read('word/document.xml')).find(W + 'body'))

def ser(el):
    s = etree.tostring(el).decode()
    s = re.sub(r' xmlns:\w+="[^"]+"', '', s)
    s = re.sub(r' o:gfxdata="[^"]*"', '', s)
    s = re.sub(r' w14:(paraId|textId)="[^"]*"', '', s)
    s = re.sub(r' w:rsid\w*="[^"]*"', '', s)
    return re.sub(r'<w:proofErr[^>]*/>', '', s)

def set_placeholder(s, ph):
    def one_para(m):
        p = m.group(0)
        runs = re.findall(r'<w:r>.*?</w:r>', p)
        new = re.sub(r'<w:t[^>]*>.*?</w:t>', '<w:t xml:space="preserve">' + ph + '</w:t>', runs[0])
        p2 = re.sub(r'(<w:r>.*?</w:r>)+', lambda _: new, p, count=1)
        i = p2.find(new) + len(new)
        return p2[:i] + re.sub(r'<w:r>.*?</w:r>', '', p2[i:])
    return re.sub(r'<w:txbxContent>.*?</w:txbxContent>',
                  lambda m: re.sub(r'<w:p><w:pPr><w:jc w:val="center"/>.*?</w:p>', one_para, m.group(0)), s)

# first two text-box paragraphs of the book: exam title and "MCQ : Set-A" banner
boxes = [e for e in body if e.findall('.//{http://schemas.microsoft.com/office/word/2010/wordprocessingShape}txbx')]
title, banner = (set_placeholder(ser(boxes[0]), '{{TEXT}}'), set_placeholder(ser(boxes[1]), '{{TEXT}}'))
assert title.count('{{TEXT}}') == 2 and banner.count('{{TEXT}}') == 2

rels = rd('word/_rels/footer1.xml.rels')
media = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(media/[^"]+)"', rels) + [(b, a) for a, b in re.findall(r'Target="(media/[^"]+)"[^>]*Id="(rId\d+)"', rels)])
png = next(v for v in media.values() if v.endswith('.png'))
svg = next((v for v in media.values() if v.endswith('.svg')), None)
styles = rd('word/styles.xml')
tpl = dict(root=root_open, title=title, banner=banner, styles=styles,
           fontTable=rd('word/fontTable.xml'), theme=rd('word/theme/theme1.xml'),
           styleIds=re.findall(r'w:styleId="([^"]+)"', styles),
           footerXml=rd('word/footer1.xml'),
           footerRels=rels.replace(png, 'media/image3.png').replace(svg or '#none#', 'media/image4.svg'),
           footerPng=base64.b64encode(ref.read('word/' + png)).decode(),
           footerSvg=base64.b64encode(ref.read('word/' + svg)).decode() if svg else '')
out = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'template.json'
out.write_text(json.dumps(tpl, ensure_ascii=False), encoding='utf8')
print('wrote', out)
