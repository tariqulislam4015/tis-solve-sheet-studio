/* ===================== Class 5 (Primary Scholarship) Solve Sheet engine ===================== */
const C5 = {
  MAINQ: /^[\s ]*([০-৯]{1,2}[\s ]*।|\d{1,2}[\s ]*\.(?!\d))/,
  ANS: /^[\s ]*([০-৯\d]+[\s ]*নং[\s ]*প্রশ্নের[\s ]*উত্তর|Answers?[\s ]+(?:to|of)[\s ]+(?:the[\s ]+)?question(?:[\s ]*no\.?)?[\s ]*\d+)[\s ]*[:：]?/i,
  MARK: /^[\s ]*(নম্বর[\s ]*ব[ণন]্টন|মান[\s ]*ব[ণন]্টন|Marks?[\s ]*Distribution)[\s ]*[:：]?/i,
  STOP: /^[\s ]*(\((?:ক|খ|গ|ঘ|ঙ|a|b|c|d|e)\)|[০-৯]{1,2}[\s ]*।|[০-৯\d]+[\s ]*নং|Answers?[\s ]+(?:to|of))/i,
};

function c5Meta(fileName, text) {
  const fn = fileName.replace(/\.docx$/i, '');
  let lang = /(^|[^A-Za-z])EV([^A-Za-z]|$)|English/i.test(fn) ? 'EV' : /(^|[^A-Za-z])BV([^A-Za-z]|$)|Bangla/i.test(fn) ? 'BV' : null;
  if (!lang) { const bn = (text.match(/[ঀ-৿]/g) || []).length, en = (text.match(/[A-Za-z]/g) || []).length; lang = bn > en ? 'BV' : 'EV'; }
  const sm = fn.match(/Set[\s_\-]*([A-J])(?![A-Za-z])/i) || text.match(/Set\s*Code\s*[:：]?\s*([A-J])\b/i) || text.match(/সেট\s*কোড\s*[:：]?\s*([A-J])\b/i);
  return { lang, set: sm ? sm[1].toUpperCase() : null };
}

async function parseC5(file, fileIdx) {
  const zip = await readZip(await file.arrayBuffer());
  const docXml = await zip.text('word/document.xml');
  if (!docXml) throw new Error('word/document.xml পাওয়া যায়নি');
  const doc = new DOMParser().parseFromString(docXml, 'application/xml');
  const rels = {};
  const relXml = await zip.text('word/_rels/document.xml.rels');
  if (relXml) for (const r of q(new DOMParser().parseFromString(relXml, 'application/xml'), NS.rel, 'Relationship')) rels[r.getAttribute('Id')] = { type: r.getAttribute('Type'), target: r.getAttribute('Target'), mode: r.getAttribute('TargetMode') };
  const ct = { def: {}, ovr: {} };
  const ctXml = await zip.text('[Content_Types].xml');
  if (ctXml) { const c = new DOMParser().parseFromString(ctXml, 'application/xml'); for (const d of q(c, NS.ct, 'Default')) ct.def[d.getAttribute('Extension').toLowerCase()] = d.getAttribute('ContentType'); for (const o of q(c, NS.ct, 'Override')) ct.ovr[o.getAttribute('PartName')] = o.getAttribute('ContentType'); }
  const body = doc.getElementsByTagNameNS(NS.w, 'body')[0];
  const items = [];
  (function collect(parent) { for (const c of kids(parent)) { if (isW(c, 'sdt')) { const sc = kids(c).find(k => isW(k, 'sdtContent')); if (sc) collect(sc); } else if (isW(c, 'p') || isW(c, 'tbl')) items.push(c); } })(body);
  const meta = c5Meta(file.name, plainText(body).slice(0, 4000));

  const clean = el => {
    for (const p of isW(el, 'p') ? [el] : q(el, NS.w, 'p')) {
      normalizePara(p);
      const pp = kids(p).find(k => isW(k, 'pPr'));
      if (pp) for (const k of kids(pp)) if (isW(k, 'sectPr') || isW(k, 'pageBreakBefore')) k.remove();
      for (const br of q(p, NS.w, 'br')) if (br.getAttributeNS(NS.w, 'type') === 'page') br.remove();
    }
  };
  let start = items.findIndex(el => isW(el, 'p') && C5.MAINQ.test(plainText(el)));
  if (start < 0) start = 0;
  const ops = []; const st = { answers: 0, marks: 0, removed: 0 };
  const isEmpty = el => isW(el, 'p') && !plainText(el).trim() && !hasDrawing(el) && !q(el, NS.m, 'oMath').length;
  for (let i = start; i < items.length; i++) {
    const el = items[i]; clean(el);
    if (isW(el, 'p')) {
      const t = plainText(el);
      if (C5.MARK.test(t)) {
        let j = i + 1;
        while (j < items.length) { const e = items[j]; const tt = plainText(e).trim(); if ((isW(e, 'p') && isEmpty(e)) || C5.STOP.test(tt) || C5.MARK.test(tt) || (C5.MAINQ.test(tt) && isW(e, 'p') && /^[\s ]*[০-৯]/.test(tt))) break; j++; }
        st.marks++; st.removed += j - i; i = j - 1; continue;
      }
      const am = runsText(el).match(C5.ANS) || t.match(C5.ANS);
      if (am) {
        st.answers++; ops.push({ banner: 'answer' });
        const rt = runsText(el); const m2 = rt.match(C5.ANS);
        if (m2) deleteRange(el, 0, m2[0].length);
        if (plainText(el).trim() || hasDrawing(el)) ops.push({ el });
        continue;
      }
    }
    ops.push({ el });
  }
  // drop trailing empties and collapse runs of 3+ empty paragraphs
  while (ops.length && ops[ops.length - 1].el && isEmpty(ops[ops.length - 1].el)) ops.pop();
  const ops2 = []; let emp = 0;
  for (const o of ops) { if (o.el && isEmpty(o.el)) { if (++emp > 1) continue; } else emp = 0; ops2.push(o); }
  return {
    kind: 'c5', file, fileIdx, zip, doc, rels, ct, meta, ops: ops2, stats: st,
    rootAttrs: [...doc.documentElement.attributes].map(a => [a.name, a.value]),
    styles: await zip.text('word/styles.xml'), numbering: await zip.text('word/numbering.xml'),
    fontTable: await zip.text('word/fontTable.xml'), theme: await zip.text('word/theme/theme1.xml'), settings: await zip.text('word/settings.xml'),
  };
}

/* ---------------- drawing XML helpers ---------------- */
let C5_DOCPR = 50000;
function c5Inline(rid, cx, cy, name) {
  return `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${++C5_DOCPR}" name="${name}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="${NS.pic}"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${name}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
}
function c5Anchor(rid, cx, cy, x, y, name, behind = true) {
  return `<w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${behind ? 251650000 : 251660000}" behindDoc="${behind ? 1 : 0}" locked="1" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>${x}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>${y}</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${++C5_DOCPR}" name="${name}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="${NS.pic}"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${name}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing>`;
}
const EMU_IN = 914400;
const c5Fonts = lang => lang === 'BV' ? { f: 'SolaimanLipi', b: true } : { f: 'Arial', b: true };
function c5RunXml(text, o = {}) {
  const f = o.font || 'Times New Roman';
  return `<w:r><w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${o.csFont || f}"/>${o.b ? '<w:b/><w:bCs/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}<w:sz w:val="${o.sz || 20}"/><w:szCs w:val="${o.szCs || o.sz || 20}"/></w:rPr><w:t xml:space="preserve">${xesc(text)}</w:t></w:r>`;
}
const C5_PAGE = { w: 12240, h: 15840, top: 1440, bottom: 1250, left: 720, right: 720, header: 720, footer: 560 };

function c5HeaderXml(S, rid, cy) {
  const F = c5Fonts(S.lang);
  const o = { font: F.f, csFont: F.f, b: true };
  const zl = S.hSzL || (S.lang === 'BV' ? 24 : 20), zr = S.hSzR || (S.lang === 'BV' ? 24 : 20);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}"><w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="10190"/></w:tabs><w:spacing w:before="${S.lang === 'BV' ? 100 : 120}" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="430" w:right="-200"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr>${c5Anchor(rid, 7772400, cy, 0, Math.round(0.5 * EMU_IN), 'TIS-C5-HeaderBand')}</w:r>${c5RunXml(S.hLeft, { ...o, sz: zl, szCs: zl, color: 'FFFFFF' })}<w:r><w:tab/></w:r>${c5RunXml(S.hRight, { ...o, sz: zr, szCs: zr, color: '1A1A1A' })}</w:p></w:hdr>`;
}
function c5FooterXml(S, rid, cy) {
  const F = c5Fonts(S.lang);
  const pg = `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${c5RunXml('1', { font: 'Times New Roman', csFont: 'SolaimanLipi', sz: 20 }).replace('<w:r>', '<w:r>')}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
  const custom = S.footerMode === 'custom';
  const body = custom
    ? `${c5RunXml(S.fLeft, { font: F.f, csFont: 'SolaimanLipi', b: true, sz: 18, color: 'FFFFFF' })}<w:r><w:tab/></w:r>${pg}<w:r><w:tab/></w:r>${c5RunXml(S.fRight, { font: 'SolaimanLipi', csFont: 'SolaimanLipi', b: true, sz: 18, szCs: 20, color: '1A1A1A' })}`
    : `<w:r><w:tab/></w:r>${pg}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}"><w:p><w:pPr><w:tabs><w:tab w:val="center" w:pos="5400"/><w:tab w:val="right" w:pos="10190"/></w:tabs><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="${custom ? 520 : 0}"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr>${c5Anchor(rid, 7772400, cy, 0, Math.round(10.24 * EMU_IN), 'TIS-C5-FooterBand')}</w:r>${body}</w:p></w:ftr>`;
}
const c5EmptyHF = (tag) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${tag} xmlns:w="${NS.w}"><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p></w:${tag}>`;

/* ---------------- styles / numbering merge ---------------- */
function c5MergeStyles(sources) {
  let base = sources[0].styles;
  const ids = new Set([...base.matchAll(/w:styleId="([^"]+)"/g)].map(m => m[1]));
  let extra = '';
  for (const s of sources.slice(1)) {
    if (!s.styles) continue;
    const sd = new DOMParser().parseFromString(s.styles, 'application/xml');
    for (const st of q(sd, NS.w, 'style')) { const id = st.getAttributeNS(NS.w, 'styleId'); if (!ids.has(id)) { ids.add(id); extra += new XMLSerializer().serializeToString(st).replace(/ xmlns:\w+="[^"]*"/g, ''); } }
  }
  if (extra) base = base.replace('</w:styles>', extra + '</w:styles>');
  return { xml: base, ids };
}
function c5MergeNumbering(sources, B) {
  const abs = [], nums = []; let nextAbs = 1, nextNum = 1; B.numMap = {};
  let rootOpen = null;
  for (const s of sources) {
    if (!s.numbering) continue;
    if (!rootOpen) rootOpen = (s.numbering.match(/<w:numbering[^>]*>/) || [])[0];
    const nd = new DOMParser().parseFromString(s.numbering, 'application/xml');
    const absMap = {};
    for (const a of q(nd, NS.w, 'abstractNum')) { const old = a.getAttributeNS(NS.w, 'abstractNumId'); const nid = nextAbs++; absMap[old] = nid; a.setAttributeNS(NS.w, 'w:abstractNumId', String(nid)); abs.push(a); }
    for (const n of q(nd, NS.w, 'num')) {
      const old = n.getAttributeNS(NS.w, 'numId'); const nid = nextNum++;
      n.setAttributeNS(NS.w, 'w:numId', String(nid));
      const an = kids(n).find(k => isW(k, 'abstractNumId')); if (an) an.setAttributeNS(NS.w, 'w:val', String(absMap[an.getAttributeNS(NS.w, 'val')] ?? an.getAttributeNS(NS.w, 'val')));
      B.numMap[s.fileIdx + ':' + old] = String(nid); nums.push(n);
    }
  }
  if (!rootOpen) return null;
  const ser = el => new XMLSerializer().serializeToString(el).replace(/ xmlns(:\w+)?="[^"]*"/g, '');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${rootOpen}${abs.map(ser).join('')}${nums.map(ser).join('')}</w:numbering>`;
}

/* ---------------- main build ---------------- */
async function buildC5({ sources, sets, S, img }) {
  // sources: parsed c5 sources in order; sets: [{src, label}] ; img: {headerBg, footerBg, title, ribbons:[], answer, coverFront, coverBack}
  if (!sets.length) throw new Error('কোনো ফাইল নেই');
  const uniq = [...new Set(sets.map(s => s.src))];
  const first = uniq[0];
  const rootOpen = '<w:document ' + first.rootAttrs.map(([n, v]) => `${n}="${xesc(v)}"`).join(' ') + '>';
  const merged = c5MergeStyles(uniq);
  const B = new Builder({ root: rootOpen, styleIds: [...merged.ids] }, Object.assign({ colTwips: 10800 + 360 }, S));
  B.S.maxImgEmu = 10800 * 635; B.keepHighlight = false; B.missing = [];
  uniq.forEach(s => B.addNs(s));
  for (const p of ['wp', 'a', 'pic', 'r']) if (!B.ns[p]) B.ns[p] = NS[p];
  const numberingXml = c5MergeNumbering(uniq, B);
  if (!numberingXml) B.numMap = null;

  const addImg = (pngObj, name) => { const path = `word/media/${name}.${pngObj.ext || 'png'}`; B.files.set(path, pngObj.bytes); if (pngObj.ext === 'jpg' || pngObj.ext === 'jpeg') B.ctDef.jpg = 'image/jpeg'; return B.addRel(RT.img, path.replace(/^word\//, '')); };
  const sizeW = (o, wIn) => [Math.round(wIn * EMU_IN), Math.round(wIn * EMU_IN * o.h / o.w)];
  const centerP = (inner, after = 120, before = 0) => `<w:p><w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="${after}" w:line="240" w:lineRule="auto"/><w:ind w:left="0" w:right="0" w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr>${inner}</w:r></w:p>`;

  // header/footer
  const hRid = 'rId1', fRid = 'rId2', h2Rid = 'rId3', f2Rid = 'rId4';
  const P = C5_PAGE;
  const sectProps = (hdr, ftr, type, pgStart) => `<w:sectPr><w:headerReference w:type="default" r:id="${hdr}"/><w:footerReference w:type="default" r:id="${ftr}"/><w:type w:val="${type}"/><w:pgSz w:w="${P.w}" w:h="${P.h}" w:code="1"/><w:pgMar w:top="${P.top}" w:right="${P.right}" w:bottom="${P.bottom}" w:left="${P.left}" w:header="${P.header}" w:footer="${P.footer}" w:gutter="0"/>${pgStart ? '<w:pgNumType w:start="1"/>' : ''}<w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
  const sectPara = props => `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr>${props}</w:pPr></w:p>`;
  const body = [];

  // front cover
  if (img.coverFront) {
    const rid = addImg(img.coverFront, 'c5_cover_front');
    body.push(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr>${c5Anchor(rid, 7772400, 10058400, 0, 0, 'TIS-C5-CoverFront')}</w:r></w:p>`);
    body.push(sectPara(sectProps(h2Rid, f2Rid, 'nextPage', false)));
  }
  // title block
  if (img.title) { const rid = addImg(img.title, 'c5_title'); const [cx, cy] = sizeW(img.title, 7.3); body.push(centerP(c5Inline(rid, cx, cy, 'TIS-C5-Title'), 60)); }
  const ansRid = img.answer ? addImg(img.answer, 'c5_answer') : null;
  const [acx, acy] = img.answer ? sizeW(img.answer, img.answerWidthIn || 1.15) : [0, 0];
  let total = 0;
  for (let k = 0; k < sets.length; k++) {
    const { src } = sets[k];
    const rb = img.ribbons[k];
    if (rb) { const rid = addImg(rb, 'c5_ribbon_' + k); const [cx, cy] = sizeW(rb, 1.35); body.push(centerP(c5Inline(rid, cx, cy, 'TIS-C5-Ribbon'), 120, k ? 160 : 40)); }
    for (const op of src.ops) {
      if (op.banner) { if (ansRid) body.push(centerP(c5Inline(ansRid, acx, acy, 'TIS-C5-Answer'), 80, 80)); total++; continue; }
      const c = op.el.cloneNode(true);
      await B.fixNode(src, c);
      body.push(B.ser(c));
    }
  }
  const contentProps = sectProps(hRid, fRid, 'nextPage', true);
  if (img.coverBack) {
    body.push(sectPara(contentProps));
    const rid = addImg(img.coverBack, 'c5_cover_back');
    body.push(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr>${c5Anchor(rid, 7772400, 10058400, 0, 0, 'TIS-C5-CoverBack')}</w:r></w:p>`);
  }
  const finalProps = img.coverBack ? sectProps(h2Rid, f2Rid, 'nextPage', false) : contentProps;

  let root = rootOpen.replace(/ xmlns:\w+="[^"]*"/g, '').replace(/ mc:Ignorable="[^"]*"/, '');
  const ign = [...B.ignorable].filter(p => B.ns[p]).join(' ');
  root = root.replace('<w:document', '<w:document' + Object.entries(B.ns).map(([p, u]) => ` xmlns:${p}="${u}"`).join('') + (ign ? ` mc:Ignorable="${ign}"` : ''));
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${root}<w:body>${body.join('')}${finalProps}</w:body></w:document>`;

  B.files.set('word/media/c5_header.png', img.headerBg.bytes);
  B.files.set('word/media/c5_footer.png', img.footerBg.bytes);
  const hcy = Math.round(7772400 * img.headerBg.h / img.headerBg.w), fcy = Math.round(7772400 * img.footerBg.h / img.footerBg.w);
  const defTab = ((first.settings || '').match(/<w:defaultTabStop w:val="(\d+)"/) || [, '720'])[1];
  const files = [];
  const ovr = (p, t) => `<Override PartName="${p}" ContentType="application/vnd.openxmlformats-officedocument.${t}"/>`;
  files.push({ name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${NS.ct}">${Object.entries(B.ctDef).map(([e, t]) => `<Default Extension="${e}" ContentType="${t}"/>`).join('')}${ovr('/word/document.xml', 'wordprocessingml.document.main+xml')}${ovr('/word/styles.xml', 'wordprocessingml.styles+xml')}${ovr('/word/settings.xml', 'wordprocessingml.settings+xml')}${first.fontTable ? ovr('/word/fontTable.xml', 'wordprocessingml.fontTable+xml') : ''}${first.theme ? ovr('/word/theme/theme1.xml', 'theme+xml') : ''}${numberingXml ? ovr('/word/numbering.xml', 'wordprocessingml.numbering+xml') : ''}${ovr('/word/header1.xml', 'wordprocessingml.header+xml')}${ovr('/word/footer1.xml', 'wordprocessingml.footer+xml')}${ovr('/word/header2.xml', 'wordprocessingml.header+xml')}${ovr('/word/footer2.xml', 'wordprocessingml.footer+xml')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${ovr('/docProps/app.xml', 'extended-properties+xml')}${Object.entries(B.ctOvr).map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join('')}</Types>` });
  files.push({ name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` });
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  files.push({ name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xesc(S.hRight || 'Solve Sheet')}</dc:title><dc:creator>TIS Solve Sheet Studio</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` });
  files.push({ name: 'docProps/app.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>TIS Solve Sheet Studio</Application></Properties>` });
  files.push({ name: 'word/document.xml', data: docXml });
  files.push({ name: 'word/styles.xml', data: merged.xml });
  if (first.fontTable) files.push({ name: 'word/fontTable.xml', data: first.fontTable });
  if (first.theme) files.push({ name: 'word/theme/theme1.xml', data: first.theme });
  if (numberingXml) files.push({ name: 'word/numbering.xml', data: numberingXml });
  files.push({ name: 'word/settings.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${NS.w}" xmlns:m="${NS.m}"><w:zoom w:percent="100"/><w:defaultTabStop w:val="${defTab}"/><w:characterSpacingControl w:val="doNotCompress"/><m:mathPr><m:mathFont m:val="Cambria Math"/><m:brkBin m:val="before"/><m:brkBinSub m:val="--"/><m:smallFrac m:val="0"/><m:dispDef/><m:lMargin m:val="0"/><m:rMargin m:val="0"/><m:defJc m:val="centerGroup"/><m:wrapIndent m:val="1440"/><m:intLim m:val="subSup"/><m:naryLim m:val="undOvr"/></m:mathPr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>` });
  files.push({ name: 'word/header1.xml', data: c5HeaderXml(S, 'rIdH', hcy) });
  files.push({ name: 'word/footer1.xml', data: c5FooterXml(S, 'rIdF', fcy) });
  files.push({ name: 'word/header2.xml', data: c5EmptyHF('hdr') });
  files.push({ name: 'word/footer2.xml', data: c5EmptyHF('ftr') });
  files.push({ name: 'word/_rels/header1.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}"><Relationship Id="rIdH" Type="${RT.img}" Target="media/c5_header.png"/></Relationships>` });
  files.push({ name: 'word/_rels/footer1.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}"><Relationship Id="rIdF" Type="${RT.img}" Target="media/c5_footer.png"/></Relationships>` });
  const R = (id, t, tg) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${t}" Target="${tg}"/>`;
  const rels = [R(hRid, 'header', 'header1.xml'), R(fRid, 'footer', 'footer1.xml'), R(h2Rid, 'header', 'header2.xml'), R(f2Rid, 'footer', 'footer2.xml'), R('rId5', 'styles', 'styles.xml'), R('rId6', 'settings', 'settings.xml'),
  first.fontTable ? R('rId7', 'fontTable', 'fontTable.xml') : '', first.theme ? R('rId8', 'theme', 'theme/theme1.xml') : '', numberingXml ? R('rId9', 'numbering', 'numbering.xml') : '',
  ...B.rels.map(r => `<Relationship Id="${r.id}" Type="${r.type}" Target="${xesc(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`)];
  files.push({ name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}">${rels.join('')}</Relationships>` });
  for (const [n, d] of B.files) files.push({ name: n, data: d });
  const blob = await writeZip(files);
  return { blob, answers: total, warnings: B.warn, files };
}
