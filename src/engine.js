/* ===================== TIS Solve Sheet Studio — conversion engine ===================== */
const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  m: 'http://schemas.openxmlformats.org/officeDocument/2006/math',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  v: 'urn:schemas-microsoft-com:vml',
  o: 'urn:schemas-microsoft-com:office:office',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
  ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
};
const RT = {
  img: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  hdr: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
  ftr: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
};

/* ---------------- ZIP (read + write) using native streams ---------------- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function streamThrough(u8, ts) { const s = new Blob([u8]).stream().pipeThrough(ts); return new Uint8Array(await new Response(s).arrayBuffer()); }
const inflateRaw = u8 => streamThrough(u8, new DecompressionStream('deflate-raw'));
const deflateRaw = u8 => streamThrough(u8, new CompressionStream('deflate-raw'));
const enc = new TextEncoder(), dec = new TextDecoder('utf-8');

async function readZip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('এটা বৈধ .docx (zip) ফাইল নয়');
  const cnt = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const files = new Map();
  for (let k = 0; k < cnt; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true);
    const ds = off + 30 + lnl + lxl;
    files.set(name, { method, raw: u8.subarray(ds, ds + csize) });
    p += 46 + nl + xl + cl;
  }
  return {
    has: n => files.has(n),
    names: () => [...files.keys()],
    async bytes(n) { const f = files.get(n); if (!f) return null; if (f._d) return f._d; f._d = f.method === 0 ? f.raw : await inflateRaw(f.raw); return f._d; },
    async text(n) { const b = await this.bytes(n); return b ? dec.decode(b) : null; },
  };
}

async function writeZip(entries /* [{name, data:Uint8Array|string}] */) {
  const parts = [], central = []; let offset = 0;
  for (const e of entries) {
    const data = typeof e.data === 'string' ? enc.encode(e.data) : e.data;
    const nameB = enc.encode(e.name), crc = crc32(data);
    let comp = data, method = 0;
    try { const d = await deflateRaw(data); if (d.length < data.length) { comp = d; method = 8; } } catch (_) { }
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x5A21, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, comp.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nameB.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), nameB, comp);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true);
    ch.setUint16(12, 0, true); ch.setUint16(14, 0x5A21, true); ch.setUint32(16, crc, true); ch.setUint32(20, comp.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, nameB.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nameB);
    offset += 30 + nameB.length + comp.length;
  }
  const cdSize = central.reduce((s, a) => s + a.length, 0);
  const eo = new DataView(new ArrayBuffer(22));
  eo.setUint32(0, 0x06054b50, true); eo.setUint16(8, entries.length, true); eo.setUint16(10, entries.length, true);
  eo.setUint32(12, cdSize, true); eo.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(eo.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/* ---------------- small XML helpers ---------------- */
const isEl = (n, ns, l) => n && n.nodeType === 1 && n.namespaceURI === ns && n.localName === l;
const isW = (n, l) => isEl(n, NS.w, l);
const kids = el => Array.from(el.childNodes).filter(n => n.nodeType === 1);
const q = (el, ns, l) => Array.from(el.getElementsByTagNameNS(ns, l));
const xesc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mk = (doc, l, attrs = {}) => { const e = doc.createElementNS(NS.w, 'w:' + l); for (const k in attrs) e.setAttributeNS(NS.w, 'w:' + k, attrs[k]); return e; };

function plainText(el) { // all visible text incl. math
  let s = '';
  (function walk(n) {
    for (const c of n.childNodes) {
      if (c.nodeType !== 1) continue;
      if ((isW(c, 't') || isEl(c, NS.m, 't'))) s += c.textContent;
      else if (isW(c, 'tab')) s += '\t';
      else if (isW(c, 'pPr') || isW(c, 'rPr') || isW(c, 'delText')) continue;
      else walk(c);
    }
  })(el);
  return s;
}
const hasDrawing = el => q(el, NS.w, 'drawing').length + q(el, NS.w, 'pict').length + q(el, NS.w, 'object').length > 0;

/* unwrap wrappers so every paragraph has a flat list of runs / math / hyperlinks */
function normalizePara(p) {
  for (const n of [...q(p, NS.w, 'proofErr'), ...q(p, NS.w, 'bookmarkStart'), ...q(p, NS.w, 'bookmarkEnd'), ...q(p, NS.w, 'del'),
  ...q(p, NS.w, 'commentRangeStart'), ...q(p, NS.w, 'commentRangeEnd'), ...q(p, NS.w, 'permStart'), ...q(p, NS.w, 'permEnd'),
  ...q(p, NS.w, 'lastRenderedPageBreak')]) n.remove();
  for (const n of [...q(p, NS.w, 'commentReference'), ...q(p, NS.w, 'footnoteReference'), ...q(p, NS.w, 'endnoteReference')]) { const r = n.parentNode; r && isW(r, 'r') ? r.remove() : n.remove(); }
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of kids(p)) {
      if (isW(c, 'smartTag') || isW(c, 'ins') || isW(c, 'customXml') || isW(c, 'moveTo') || (isW(c, 'sdt'))) {
        const inner = isW(c, 'sdt') ? (kids(c).find(k => isW(k, 'sdtContent')) || c) : c;
        for (const k of kids(inner)) { if (isW(k, 'smartTagPr') || isW(k, 'customXmlPr') || isW(k, 'sdtPr') || isW(k, 'sdtEndPr')) continue; p.insertBefore(k, c); }
        c.remove(); changed = true;
      }
    }
  }
  for (const a of [...p.attributes]) if (/^w14:|^w:rsid/.test(a.name)) p.removeAttributeNode(a);
}

/* ---- character-level operations on the top-level runs of a paragraph ---- */
function runLen(r) { if (!isW(r, 'r')) return 0; let L = 0; for (const c of kids(r)) { if (isW(c, 't')) L += c.textContent.length; else if (isW(c, 'tab')) L += 1; } return L; }
function runsText(p) { let s = ''; for (const c of kids(p)) if (isW(c, 'r')) for (const k of kids(c)) { if (isW(k, 't')) s += k.textContent; else if (isW(k, 'tab')) s += '\t'; } return s; }
function sliceRun(r, from, to) {
  const c = r.cloneNode(true); let pos = 0, content = 0;
  for (const k of kids(c)) {
    if (isW(k, 'rPr')) continue;
    if (isW(k, 't')) {
      const t = k.textContent, a = Math.max(from, pos), b = Math.min(to, pos + t.length);
      if (b > a) { k.textContent = t.slice(a - pos, b - pos); k.setAttribute('xml:space', 'preserve'); content++; } else k.remove();
      pos += t.length;
    } else if (isW(k, 'tab')) { if (pos >= from && pos < to) content++; else k.remove(); pos += 1; }
    else { if (pos >= from && (pos < to || (to === pos && from === pos))) content++; else k.remove(); }
  }
  return content ? c : null;
}
function splitPara(p, pos) { // ensures a node boundary at pos; returns node that starts at pos (or null = end)
  let start = 0;
  for (const n of kids(p)) {
    if (isW(n, 'pPr')) continue;
    if (start === pos) return n;
    const L = runLen(n);
    if (L && pos < start + L) {
      const left = sliceRun(n, 0, pos - start), right = sliceRun(n, pos - start, L);
      if (left) p.insertBefore(left, n);
      if (right) p.insertBefore(right, n);
      n.remove(); return right;
    }
    start += L;
  }
  return null;
}
function deleteRange(p, from, to) {
  if (to <= from) return;
  const b = splitPara(p, to); const a = splitPara(p, from);
  let n = a;
  while (n && n !== b) { const nx = n.nextSibling; if (n.nodeType === 1 && isW(n, 'r')) n.remove(); n = nx; }
}
function stripLeading(p, re) { const m = runsText(p).match(re); if (m && m.index === 0 && m[0].length) deleteRange(p, 0, m[0].length); }
function trimTrailing(p) { const t = runsText(p); const m = /[\s ]+$/.exec(t); if (m) deleteRange(p, m.index, t.length); }
function contentNodes(p) { return kids(p).filter(n => !isW(n, 'pPr')); }

/* ---- pPr editing honouring schema order ---- */
const PPR_ORDER = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr', 'suppressLineNumbers', 'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku', 'wordWrap', 'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'];
function getPPr(p) { let pp = kids(p).find(k => isW(k, 'pPr')); if (!pp) { pp = mk(p.ownerDocument, 'pPr'); p.insertBefore(pp, p.firstChild); } return pp; }
function setPPrChild(pp, el) {
  const name = el.localName; const old = kids(pp).find(k => isW(k, name)); if (old) old.remove();
  const idx = PPR_ORDER.indexOf(name);
  const after = kids(pp).find(k => PPR_ORDER.indexOf(k.localName) > idx);
  pp.insertBefore(el, after || null);
}
function setIndent(p, left, hanging) {
  const pp = getPPr(p); const doc = p.ownerDocument;
  const old = kids(pp).find(k => isW(k, 'ind'));
  let L = left;
  if (old) { const ol = parseInt(old.getAttributeNS(NS.w, 'left') || old.getAttributeNS(NS.w, 'start') || '0', 10); if (ol > L && hanging == null) L = Math.min(ol, left + 1440); }
  const ind = mk(doc, 'ind', { left: String(L) });
  if (hanging) ind.setAttributeNS(NS.w, 'w:hanging', String(hanging));
  else if (old && old.getAttributeNS(NS.w, 'hanging') && L > left) ind.setAttributeNS(NS.w, 'w:hanging', old.getAttributeNS(NS.w, 'hanging'));
  setPPrChild(pp, ind);
}
function setTabs(p, tabs) { const doc = p.ownerDocument; const t = mk(doc, 'tabs'); for (const [val, pos] of tabs) t.appendChild(mk(doc, 'tab', { val, pos: String(pos) })); setPPrChild(getPPr(p), t); }

/* ---------------- source document parsing ---------------- */
const OPT_START = /^[\s ]*([√✓✔][\s ]*)?\(([a-eA-E])\)/;
const SET_RE = /^\s*(?:MCQ\s*[:\-]?\s*)?Set\s*[-:–]?\s*([A-H])\s*$/i;
const WRITTEN_RE = /(wjwLZ|লিখিত|m„Rbkxj|সৃজনশীল|^\s*Written\b|^\s*CQ\b|^\s*Creative\s+Question)/i;
const QNUM_RE = /^[\s ]*(\d{1,3})[\s ]*[.)।](?!\d)/;

function detectMeta(fileName, headerText) {
  const fn = fileName.replace(/\.docx$/i, '');
  const s = fn + ' ' + (headerText || '');
  const meta = {};
  meta.prog = /\bEAP\b|Engineering/i.test(s) ? 'EAP' : /\bMAP\b|Medical/i.test(s) ? 'MAP' : /\bVAP\b|Varsity|University/i.test(s) ? 'VAP' : /\bHSC\b/i.test(s) ? 'HSC' : (fn.match(/^([A-Z]{2,4})[_\- ]/) || [])[1] || 'EAP';
  meta.year = (s.match(/20\d\d/) || [])[0] || String(new Date().getFullYear());
  const CODE_RE = /(?:^|[^A-Za-z0-9])(Bio|ICT|W|P|C|M|B|E)[-_ ]?(\d{1,2})(?![\d])/gi;
  const pick = str => { const all = [...String(str).matchAll(CODE_RE)]; return all.find(x => /[-_]/.test(x[0].slice(1))) || all[0]; };
  const cm = pick(fn) || pick(headerText || '');
  if (cm) { let L = cm[1]; L = /^bio$/i.test(L) ? 'Bio' : /^ict$/i.test(L) ? 'ICT' : L.toUpperCase(); meta.code = L + '-' + cm[2].padStart(2, '0'); meta.letter = L; meta.num = parseInt(cm[2], 10); }
  else { meta.code = 'W-01'; meta.letter = 'W'; meta.num = 1; }
  meta.kind = /Weekly/i.test(fn) ? 'Weekly' : /Daily/i.test(fn) ? 'Daily' : meta.letter === 'W' ? 'Weekly' : meta.letter && meta.letter !== 'W' && cm ? 'Daily' : /Weekly/i.test(s) ? 'Weekly' : 'Daily';
  meta.type = /Written|\bCQ\b/i.test(fn) ? 'written' : /MCQ/i.test(fn) ? 'mcq' : 'mixed';
  const u = fn.match(/Unique\s*Set[-_ ]?(\d+)/i); meta.unique = u ? parseInt(u[1], 10) : null;
  meta.ver = /English|E\.V\b|\bEV\b/i.test(fn) ? 'E.V' : 'B.V';
  return meta;
}

async function parseSource(file, fileIdx, opt = {}) {
  const zip = await readZip(await file.arrayBuffer());
  const docXml = await zip.text('word/document.xml');
  if (!docXml) throw new Error('word/document.xml পাওয়া যায়নি');
  const doc = new DOMParser().parseFromString(docXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('document.xml পড়া যায়নি');
  // header text (for year/program detection)
  let headerText = '';
  for (const n of zip.names()) if (/^word\/header\d*\.xml$/.test(n)) headerText += ' ' + plainText(new DOMParser().parseFromString(await zip.text(n), 'application/xml').documentElement);
  const meta = detectMeta(file.name, headerText);
  // rels
  const rels = {};
  const relXml = await zip.text('word/_rels/document.xml.rels');
  if (relXml) for (const r of q(new DOMParser().parseFromString(relXml, 'application/xml'), NS.rel, 'Relationship')) rels[r.getAttribute('Id')] = { type: r.getAttribute('Type'), target: r.getAttribute('Target'), mode: r.getAttribute('TargetMode') };
  const ctXml = await zip.text('[Content_Types].xml');
  const ct = { def: {}, ovr: {} };
  if (ctXml) { const c = new DOMParser().parseFromString(ctXml, 'application/xml'); for (const d of q(c, NS.ct, 'Default')) ct.def[d.getAttribute('Extension').toLowerCase()] = d.getAttribute('ContentType'); for (const o of q(c, NS.ct, 'Override')) ct.ovr[o.getAttribute('PartName')] = o.getAttribute('ContentType'); }

  const body = doc.getElementsByTagNameNS(NS.w, 'body')[0];
  // flatten body: unwrap sdt blocks
  const items = [];
  (function collect(parent) { for (const c of kids(parent)) { if (isW(c, 'sdt')) { const sc = kids(c).find(k => isW(k, 'sdtContent')); if (sc) collect(sc); } else if (isW(c, 'p') || isW(c, 'tbl')) items.push(c); } })(body);

  const parts = []; let cur = null; let mode = (meta.type === 'written' || opt.forceWritten) ? 'written' : 'mcq';
  let setIdx = 0, prevNum = 0, writtenCount = 0;
  const newPart = (kind, set, explicit) => { cur = { id: `f${fileIdx}p${parts.length}`, fileIdx, fileName: file.name, kind, set, explicitSet: explicit, questions: [], enabled: true, answers: {} }; parts.push(cur); prevNum = 0; };
  const curQ = () => cur && cur.questions[cur.questions.length - 1];

  for (const el of items) {
    if (isW(el, 'p')) {
      normalizePara(el);
      const pp = kids(el).find(k => isW(k, 'pPr'));
      if (pp) for (const k of kids(pp)) if (isW(k, 'sectPr')) k.remove();
      const txt = plainText(el); const tt = txt.trim();
      const empty = !tt && !hasDrawing(el) && !q(el, NS.m, 'oMath').length;
      // markers
      const sm = tt.length < 30 && tt.match(SET_RE);
      if (sm) {
        const L = sm[1].toUpperCase();
        if (mode === 'written') newPart('written', L, true);
        else newPart('mcq', L, true);
        continue;
      }
      if (tt.length && tt.length < 45 && WRITTEN_RE.test(tt) && !QNUM_RE.test(tt)) { mode = 'written'; writtenCount++; newPart('written', null, false); continue; }
      const nm = runsText(el).match(QNUM_RE) || txt.match(QNUM_RE);
      if (nm) {
        const n = parseInt(nm[1], 10);
        const seq = n === prevNum + 1 || (n === 1) || String(prevNum + 1).endsWith(String(n)) || (n === prevNum + 2 && tt.length > 30) || prevNum === 0;
        if (seq) {
          if (!cur) newPart(mode, mode === 'mcq' ? 'A' : null, false);
          const logical = (n !== prevNum + 1 && n !== 1 && String(prevNum + 1).endsWith(String(n))) ? prevNum + 1 : n;
          cur.questions.push({ num: logical, els: [el] }); prevNum = logical; continue;
        }
      }
      if (empty && !curQ()) continue;
      if (!cur) newPart(mode, mode === 'mcq' ? 'A' : null, false);
      const cq = curQ();
      if (cq) cq.els.push(el); else (cur.pre || (cur.pre = [])).push(el);
    } else if (isW(el, 'tbl')) {
      if (!cur) newPart(mode, mode === 'mcq' ? 'A' : null, false);
      const cq = curQ(); if (cq) cq.els.push(el); else (cur.pre || (cur.pre = [])).push(el);
    }
  }
  // drop empty parts, auto-assign letters
  const finalParts = parts.filter(p => p.questions.length);
  for (const p of finalParts) if (p.kind === 'mcq') analyzePart(p);
  return { file, fileIdx, zip, doc, rels, ct, meta, parts: finalParts, rootAttrs: [...doc.documentElement.attributes].map(a => [a.name, a.value]) };
}

/* ---- MCQ analysis: options, correct answer ---- */
function splitOptions(p) {
  const pc = p.cloneNode(true);
  const t = runsText(pc);
  const re = /([√✓✔][\s ]*)?\(([a-eA-E])\)/g; let m; const pos = []; let expect = null;
  while ((m = re.exec(t))) {
    const L = m[2].toLowerCase();
    if (m.index !== 0 && !/[\s \t]/.test(t[m.index - 1]) && t.slice(0, m.index).trim()) continue;
    if (expect && L.charCodeAt(0) <= expect.charCodeAt(0)) continue;
    pos.push({ i: m.index, letter: L, tick: !!m[1] }); expect = L;
  }
  if (!pos.length || t.slice(0, pos[0].i).trim()) return null;
  const out = [];
  for (let k = pos.length - 1; k >= 0; k--) {
    const para = pc.ownerDocument.createElementNS(NS.w, 'w:p');
    if (k === 0) { out.unshift({ ...pos[k], para: pc }); break; }
    let b = splitPara(pc, pos[k].i);
    while (b) { const nx = b.nextSibling; para.appendChild(b); b = nx; }
    const ppr = kids(pc).find(x => isW(x, 'pPr')); if (ppr) para.insertBefore(ppr.cloneNode(true), para.firstChild);
    out.unshift({ ...pos[k], para });
  }
  return out;
}
function isHighlighted(para) {
  const r = kids(para).find(k => isW(k, 'r')); if (!r) return false;
  const rpr = kids(r).find(k => isW(k, 'rPr')); if (!rpr) return false;
  const h = kids(rpr).find(k => isW(k, 'highlight')); if (h && h.getAttributeNS(NS.w, 'val') !== 'none') return true;
  const s = kids(rpr).find(k => isW(k, 'shd')); return !!(s && s.getAttributeNS(NS.w, 'fill') && !/^(auto|FFFFFF)$/i.test(s.getAttributeNS(NS.w, 'fill')));
}
function analyzePart(part) {
  for (const qn of part.questions) {
    const opts = []; let first = -1, last = -1;
    qn.els.forEach((el, i) => {
      if (!isW(el, 'p')) return;
      if (first >= 0 && last < i - 1) return; // options must be contiguous
      if (OPT_START.test(runsText(el))) { const s = splitOptions(el); if (s) { if (first < 0) first = i; last = i; opts.push(...s); } }
    });
    qn.opts = opts; qn.optRange = [first, last];
    let correct = opts.filter(o => o.tick);
    if (!correct.length) { const h = opts.filter(o => isHighlighted(o.para)); if (h.length === 1) correct = h; }
    qn.auto = correct.length ? correct[0].letter : null;
    qn.preview = opts.map(o => ({ letter: o.letter, text: plainText(o.para).replace(/^[\s√✓✔]*\([a-e]\)\s*/i, '').trim() }));
  }
}

/* ---------------- output building ---------------- */
class Builder {
  constructor(tpl, settings) {
    this.tpl = tpl; this.S = settings;
    this.files = new Map(); this.rels = []; this.relN = 10; this.mediaN = 0; this.docPr = 100; this.spid = 3000;
    this.ctDef = { rels: 'application/vnd.openxmlformats-package.relationships+xml', xml: 'application/xml', png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg' };
    this.ctOvr = {}; this.relCache = new Map(); this.ns = {}; this.warn = [];
    this.styleIds = new Set(tpl.styleIds);
    for (const m of tpl.root.matchAll(/xmlns:(\w+)="([^"]*)"/g)) this.ns[m[1]] = m[2];
    this.ignorable = new Set((tpl.root.match(/mc:Ignorable="([^"]*)"/) || [, ''])[1].split(/\s+/).filter(Boolean));
  }
  addNs(src) { for (const [n, v] of src.rootAttrs) { const m = n.match(/^xmlns:(\w+)$/); if (m && !this.ns[m[1]]) this.ns[m[1]] = v; if (n === 'mc:Ignorable') v.split(/\s+/).forEach(x => x && this.ignorable.add(x)); } }
  addRel(type, target, external) { const id = 'rId' + (++this.relN); this.rels.push({ id, type, target, external }); return id; }

  async copyRel(src, rid) {
    const key = src.fileIdx + ':' + rid; if (this.relCache.has(key)) return this.relCache.get(key);
    const r = src.rels[rid]; if (!r) return rid;
    let nid;
    if (r.mode === 'External') nid = this.addRel(r.type, r.target, true);
    else {
      const srcPath = r.target.startsWith('/') ? r.target.slice(1) : 'word/' + r.target.replace(/^\.\//, '');
      const newPath = await this.copyPart(src, srcPath);
      nid = newPath ? this.addRel(r.type, newPath.replace(/^word\//, '')) : rid;
    }
    this.relCache.set(key, nid); return nid;
  }
  async copyPart(src, srcPath) {
    const ck = 'part:' + src.fileIdx + ':' + srcPath; if (this.relCache.has(ck)) return this.relCache.get(ck);
    const data = await src.zip.bytes(srcPath); if (!data) { this.warn.push('ফাইল পাওয়া যায়নি: ' + srcPath); return null; }
    const dir = srcPath.replace(/[^/]+$/, ''), base = srcPath.split('/').pop();
    const ext = (base.split('.').pop() || '').toLowerCase();
    const newPath = dir + 's' + src.fileIdx + '_' + (++this.mediaN) + '_' + base;
    this.relCache.set(ck, newPath);
    // nested rels (charts, diagrams…)
    const relPath = dir + '_rels/' + base + '.rels';
    if (src.zip.has(relPath)) {
      const rx = new DOMParser().parseFromString(await src.zip.text(relPath), 'application/xml');
      for (const r of q(rx, NS.rel, 'Relationship')) {
        if (r.getAttribute('TargetMode') === 'External') continue;
        const t = r.getAttribute('Target'); const abs = resolvePath(dir, t);
        const np = await this.copyPart(src, abs); if (np) r.setAttribute('Target', relativePath(dir, np));
      }
      this.files.set(dir + '_rels/' + newPath.split('/').pop() + '.rels', new XMLSerializer().serializeToString(rx));
    }
    this.files.set(newPath, data);
    const ovr = src.ct.ovr['/' + srcPath];
    if (ovr) this.ctOvr['/' + newPath] = ovr; else if (!this.ctDef[ext]) this.ctDef[ext] = src.ct.def[ext] || guessCT(ext);
    return newPath;
  }

  /* walk a cloned node: remap r:* attrs, fix ids, scale pictures */
  async fixNode(src, node) {
    const all = [node, ...node.getElementsByTagName('*')];
    for (const el of all) {
      for (const a of [...el.attributes]) {
        if (a.namespaceURI === NS.r) a.value = await this.copyRel(src, a.value);
        else if (a.name === 'w14:paraId' || a.name === 'w14:textId' || a.name === 'wp14:anchorId' || a.name === 'wp14:editId' || a.name === 'w14:anchorId' || a.name === 'o:gfxdata') el.removeAttributeNode(a);
        else if (/^w:rsid/.test(a.name)) el.removeAttributeNode(a);
      }
      if (isEl(el, NS.wp, 'docPr')) el.setAttribute('id', String(++this.docPr));
      if (el.namespaceURI === NS.v && el.getAttributeNS(NS.o, 'spid')) el.setAttributeNS(NS.o, 'o:spid', '_x0000_s' + (++this.spid));
      if ((isW(el, 'pStyle') || isW(el, 'rStyle') || isW(el, 'tblStyle')) && !this.styleIds.has(el.getAttributeNS(NS.w, 'val'))) el.remove();
      if (isW(el, 'numPr')) { if (this.numMap) { const id = kids(el).find(k => isW(k, 'numId')); const nv = id && this.numMap[src.fileIdx + ':' + id.getAttributeNS(NS.w, 'val')]; if (nv) id.setAttributeNS(NS.w, 'w:val', nv); else el.remove(); } else el.remove(); }
      if (isW(el, 'framePr')) el.remove();
      if (isW(el, 'highlight') && !this.keepHighlight) el.remove();
    }
    this.scale(node);
  }
  scale(node) {
    const MAXW = this.S.maxImgEmu;
    for (const ex of q(node, NS.wp, 'extent')) {
      const cx = +ex.getAttribute('cx'), cy = +ex.getAttribute('cy'); if (!(cx > MAXW)) continue;
      const f = MAXW / cx; ex.setAttribute('cx', Math.round(cx * f)); ex.setAttribute('cy', Math.round(cy * f));
      const holder = ex.parentNode;
      const gd = q(holder, NS.a, 'graphicData')[0];
      if (gd) {
        // scale the top-level shape transform (picture, group or shape)
        const top = kids(gd)[0];
        const sp = top && kids(top).find(k => /spPr$|grpSpPr$/.test(k.localName));
        const xfrm = sp && kids(sp).find(k => k.localName === 'xfrm');
        const e2 = xfrm && kids(xfrm).find(k => k.localName === 'ext');
        if (e2) { e2.setAttribute('cx', Math.round(+e2.getAttribute('cx') * f)); e2.setAttribute('cy', Math.round(+e2.getAttribute('cy') * f)); }
      }
    }
    const MAXPT = MAXW / 12700;
    for (const el of node.getElementsByTagName('*')) {
      if (el.namespaceURI !== NS.v || !el.getAttribute('style')) continue;
      const st = el.getAttribute('style'); const wm = st.match(/width:([\d.]+)pt/), hm = st.match(/height:([\d.]+)pt/);
      if (wm && +wm[1] > MAXPT && !q(el, NS.v, 'textbox').length) { const f = MAXPT / +wm[1]; let s2 = st.replace(/width:[\d.]+pt/, 'width:' + (+wm[1] * f).toFixed(2) + 'pt'); if (hm) s2 = s2.replace(/height:[\d.]+pt/, 'height:' + (+hm[1] * f).toFixed(2) + 'pt'); el.setAttribute('style', s2); }
    }
    for (const tbl of [node, ...q(node, NS.w, 'tbl')].filter(t => isW(t, 'tbl'))) {
      const cols = q(tbl, NS.w, 'gridCol'); const tot = cols.reduce((s, c) => s + (+c.getAttributeNS(NS.w, 'w') || 0), 0);
      const max = this.S.colTwips - 360;
      if (tot > max) { const f = max / tot; cols.forEach(c => c.setAttributeNS(NS.w, 'w:w', Math.floor(+c.getAttributeNS(NS.w, 'w') * f)));
        for (const tc of q(tbl, NS.w, 'tcW')) if (tc.getAttributeNS(NS.w, 'type') === 'dxa') tc.setAttributeNS(NS.w, 'w:w', Math.floor(+tc.getAttributeNS(NS.w, 'w') * f));
        for (const tw of q(tbl, NS.w, 'tblW')) { tw.setAttributeNS(NS.w, 'w:type', 'auto'); tw.setAttributeNS(NS.w, 'w:w', '0'); }
        for (const ti of q(tbl, NS.w, 'tblInd')) ti.setAttributeNS(NS.w, 'w:w', '0'); }
    }
  }
  ser(node) {
    let s = new XMLSerializer().serializeToString(node);
    s = s.replace(/ xmlns:(\w+)="([^"]*)"/g, (all, p, u) => (this.ns[p] === u ? '' : (this.ns[p] ? all : (this.ns[p] = u, ''))));
    return s;
  }
  tplBox(xml, text) {
    return xml.split('{{TEXT}}').join(xesc(text))
      .replace(/wp:docPr id="\d+"/g, () => `wp:docPr id="${++this.docPr}"`)
      .replace(/o:spid="[^"]*"/g, () => `o:spid="_x0000_s${++this.spid}"`)
      .replace(/ (?:wp14:anchorId|wp14:editId|w14:anchorId)="[^"]*"/g, '');
  }
}
function resolvePath(dir, t) { if (t.startsWith('/')) return t.slice(1); const parts = (dir + t).split('/'); const out = []; for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.' && p !== '') out.push(p); } return out.join('/'); }
function relativePath(fromDir, to) { const a = fromDir.split('/').filter(Boolean), b = to.split('/'); let i = 0; while (i < a.length && a[i] === b[i]) i++; return '../'.repeat(a.length - i) + b.slice(i).join('/'); }
function guessCT(ext) { return ({ gif: 'image/gif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', emf: 'image/x-emf', wmf: 'image/x-wmf', svg: 'image/svg+xml', bin: 'application/vnd.openxmlformats-officedocument.oleObject', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', wdp: 'image/vnd.ms-photo' })[ext] || 'application/octet-stream'; }

/* ---- transform one question into output paragraphs (XML strings) ---- */
async function emitQuestion(B, src, part, qn, isMcq) {
  const S = B.S; const out = [];
  const doc = src.doc;
  const clone = el => el.cloneNode(true);
  const tabRun = () => { const r = mk(doc, 'r'); const rp = mk(doc, 'rPr'); rp.appendChild(mk(doc, 'sz', { val: '20' })); rp.appendChild(mk(doc, 'szCs', { val: '20' })); r.appendChild(rp); r.appendChild(mk(doc, 'tab')); return r; };
  const textRun = (t, refRun) => { const r = mk(doc, 'r'); const rp = refRun && kids(refRun).find(k => isW(k, 'rPr')); if (rp) r.appendChild(rp.cloneNode(true)); const tt = mk(doc, 't'); tt.setAttribute('xml:space', 'preserve'); tt.textContent = t; r.appendChild(tt); return r; };
  const fmt = (p, first) => { if (!isW(p, 'p')) return; if (first) { setIndent(p, 360, 360); setTabs(p, [['right', 5184]]); } else setIndent(p, 360, null); };

  let pre = qn.els, opts = [], post = [];
  if (isMcq && qn.opts && qn.opts.length) { pre = qn.els.slice(0, qn.optRange[0]); post = qn.els.slice(qn.optRange[1] + 1); opts = qn.opts; }
  else if (isMcq) { pre = qn.els; }
  const preC = pre.map(clone);

  if (isMcq) {
    const letter = part.answers[qn.num] || qn.auto;
    const opt = opts.find(o => o.letter === letter);
    if (opt) {
      const ans = clone(opt.para); stripLeading(ans, /^[\s ]*([√✓✔][\s ]*)?\([a-eA-E]\)[\s ]*/); trimTrailing(ans);
      const ansNodes = contentNodes(ans);
      // find [Ans: ] slot
      let done = false;
      for (let i = preC.length - 1; i >= 0 && !done; i--) {
        const p = preC[i]; if (!isW(p, 'p')) continue;
        const t = runsText(p); const am = /\[\s*Ans\s*[:：]?/i.exec(t) || /\bAns\s*[:：]/i.exec(t); if (!am) continue;
        const close = t.indexOf(']', am.index);
        const start = am.index + am[0].length;
        if (close >= 0) { deleteRange(p, start, close); const at = splitPara(p, start); const sp = textRun(' ', at && isW(at, 'r') ? at : null); p.insertBefore(sp, at); for (const n of ansNodes) p.insertBefore(n, at); done = true; }
        else { const ref = kids(p).filter(k => isW(k, 'r')).pop(); p.appendChild(textRun(' ', ref)); ansNodes.forEach(n => p.appendChild(n)); p.appendChild(textRun(']', ref)); done = true; }
      }
      if (!done) { const p = preC.filter(x => isW(x, 'p')).pop(); if (p) { const ref = kids(p).find(k => isW(k, 'r')); p.appendChild(textRun(' [Ans: ', ref)); ansNodes.forEach(n => p.appendChild(n)); p.appendChild(textRun(']', ref)); } }
    } else B.missing.push(`${part.label} — প্রশ্ন ${String(qn.num).padStart(2, '0')}`);
  }
  // emit pre
  let first = true;
  for (const p of preC) { fmt(p, first && isW(p, 'p') && QNUM_RE.test(runsText(p))); if (first && isW(p, 'p') && QNUM_RE.test(runsText(p))) first = false; await B.fixNode(src, p); out.push(B.ser(p)); }
  // options
  const KEEP_RE = /(KvbwUB|†Kv‡bvwUB|Kv‡bvwUB|Dfq|me¸‡jv|mevB|Dc‡ii me|কোনটিই|কোনোটিই|কোনটি নয়|উভয়|সবগুলো|সবকটি|উপরের সব|\bnone\b|\bneither\b|\bboth\b|all of the|\b[a-e]\s*(?:I|&|ও|Ges|and|,)\s*[a-e]\b)/i;
  const showOpts = S.optionsMode === 'grid' || S.optionsMode === 'list' || (S.optionsMode === 'smart' && opts.some(o => KEEP_RE.test(plainText(o.para).replace(/^[\s√✓✔]*\([a-e]\)/i, ''))));
  if (opts.length && showOpts) {
    const disp = opts.map(o => { const p = clone(o.para); stripLeading(p, /^[\s ]*[√✓✔][\s ]*/); stripLeading(p, /^[\s ]+/); trimTrailing(p); return { p, short: plainText(p).length <= 26 && !hasDrawing(p) }; });
    const lines = [];
    if (S.optionsMode !== 'list') { for (let i = 0; i < disp.length;) { if (i + 1 < disp.length && disp[i].short && disp[i + 1].short) { lines.push([disp[i], disp[i + 1]]); i += 2; } else { lines.push([disp[i]]); i++; } } }
    else disp.forEach(d => lines.push([d]));
    for (const ln of lines) {
      const p = mk(doc, 'p'); const pp = mk(doc, 'pPr'); p.appendChild(pp);
      setPPrChild(pp, mk(doc, 'keepLines'));
      setTabs(p, [['left', 2700], ['right', 5184]]);
      const sp = mk(doc, 'spacing', { line: '288', lineRule: 'auto' }); setPPrChild(pp, sp);
      setIndent(p, 360, 360);
      ln.forEach((d) => { p.appendChild(tabRun()); for (const n of contentNodes(d.p)) p.appendChild(n); });
      await B.fixNode(src, p); out.push(B.ser(p));
    }
  }
  if (S.keepSolve) for (const el of post) { const p = clone(el); fmt(p, false); await B.fixNode(src, p); out.push(B.ser(p)); }
  return out;
}

/* ---------------- header/footer XML ---------------- */
function headerXml(rid, cx, cy) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}"><w:p><w:pPr><w:pStyle w:val="Header"/><w:ind w:left="-720" w:right="-720"/><w:jc w:val="left"/><w:rPr><w:sz w:val="4"/></w:rPr></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="90001" name="TIS Header"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="${NS.pic}"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="header.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p></w:hdr>`;
}
/* ---------------- main build ---------------- */
async function buildBook({ tpl, sources, blocks, settings, headerPng }) {
  const S = Object.assign({ optionsMode: 'smart', keepSolve: true, newPagePerExam: false, colTwips: 5184 }, settings);
  S.maxImgEmu = (S.colTwips - 360) * 635;
  const B = new Builder(tpl, S); B.missing = [];
  sources.forEach(s => B.addNs(s));
  const hdrRid = 'rId1', ftrRid = 'rId2';
  const sect = (cols, first, newPage) => `<w:sectPr><w:headerReference w:type="default" r:id="${hdrRid}"/><w:footerReference w:type="default" r:id="${ftrRid}"/><w:type w:val="${newPage ? 'nextPage' : 'continuous'}"/><w:pgSz w:w="12240" w:h="15840" w:code="1"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="288" w:footer="720" w:gutter="0"/><w:cols ${cols === 2 ? 'w:num="2" ' : ''}w:sep="1" w:space="432"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
  const sectPara = (cols, newPage) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/><w:rPr><w:sz w:val="4"/><w:szCs w:val="4"/></w:rPr>${sect(cols, false, newPage)}</w:pPr></w:p>`;
  const emptyP = (sz = 14) => `<w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:sz w:val="${sz}"/></w:rPr></w:pPr></w:p>`;
  const body = []; let secIdx = 0; let pendingNewPage = false; let inContent = false;

  const openHeading = (title, banner) => {
    if (inContent) body.push(sectPara(2, false));
    let x = '';
    if (title) x += B.tplBox(tpl.title, title) + emptyP(10);
    x += B.tplBox(tpl.banner, banner) + emptyP(10);
    body.push(x);
    body.push(sectPara(1, pendingNewPage && secIdx > 0)); secIdx++; pendingNewPage = false; inContent = true;
  };

  let total = 0, answered = 0;
  for (const blk of blocks) {
    const parts = blk.parts.filter(p => p.enabled && p.questions.length);
    if (!parts.length) continue;
    pendingNewPage = S.newPagePerExam;
    const mcq = parts.filter(p => p.kind === 'mcq'), wr = parts.filter(p => p.kind === 'written');
    const groups = blk.kind === 'Weekly' ? [[blk.titleMcq, mcq], [blk.titleWritten, wr]] : [[blk.titleMain, [...mcq, ...wr]]];
    for (const [title, list] of groups) {
      let t = title;
      for (const part of list) {
        const src = sources[part.fileIdx];
        openHeading(t, part.banner); t = null;
        part.label = `${blk.code} ${part.banner}`;
        for (const qn of part.questions) {
          const xs = await emitQuestion(B, src, part, qn, part.kind === 'mcq');
          body.push(...xs);
          if (part.kind === 'mcq') { total++; if (part.answers[qn.num] || qn.auto) answered++; }
        }
      }
    }
  }
  if (!body.length) throw new Error('কোনো প্রশ্ন নির্বাচিত নেই');

  // root with merged namespaces
  let root = tpl.root.replace(/ xmlns:\w+="[^"]*"/g, '').replace(/ mc:Ignorable="[^"]*"/, '');
  const nsAttrs = Object.entries(B.ns).map(([p, u]) => ` xmlns:${p}="${u}"`).join('');
  const ign = [...B.ignorable].filter(p => B.ns[p]).join(' ');
  root = root.replace('<w:document', '<w:document' + nsAttrs + (ign ? ` mc:Ignorable="${ign}"` : ''));
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${root}<w:body>${body.join('')}${sect(2)}</w:body></w:document>`;

  // header / footer media
  B.files.set('word/media/tis_header.png', headerPng.bytes);
  const b64 = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
  B.files.set('word/media/image3.png', b64(tpl.footerPng));
  B.files.set('word/media/image4.svg', b64(tpl.footerSvg));
  B.ctDef.svg = 'image/svg+xml';
  const HW = 7772400;
  const hcy = Math.round(HW * headerPng.h / headerPng.w);
  const files = [];
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${NS.ct}">${Object.entries(B.ctDef).map(([e, t]) => `<Default Extension="${e}" ContentType="${t}"/>`).join('')}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/><Override PartName="/word/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${Object.entries(B.ctOvr).map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join('')}</Types>`;
  files.push({ name: '[Content_Types].xml', data: ct });
  files.push({ name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` });
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  files.push({ name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xesc(S.docTitle || 'Solution Book')}</dc:title><dc:creator>${xesc(S.author || 'TIS Academy')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` });
  files.push({ name: 'docProps/app.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>TIS Solve Sheet Studio</Application></Properties>` });
  files.push({ name: 'word/document.xml', data: docXml });
  files.push({ name: 'word/styles.xml', data: tpl.styles });
  files.push({ name: 'word/fontTable.xml', data: tpl.fontTable });
  files.push({ name: 'word/theme/theme1.xml', data: tpl.theme });
  files.push({ name: 'word/settings.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${NS.w}" xmlns:m="${NS.m}"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><m:mathPr><m:mathFont m:val="Cambria Math"/><m:brkBin m:val="before"/><m:brkBinSub m:val="--"/><m:smallFrac m:val="0"/><m:dispDef/><m:lMargin m:val="0"/><m:rMargin m:val="0"/><m:defJc m:val="centerGroup"/><m:wrapIndent m:val="1440"/><m:intLim m:val="subSup"/><m:naryLim m:val="undOvr"/></m:mathPr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>` });
  files.push({ name: 'word/header1.xml', data: headerXml('rIdH', HW, hcy) });
  files.push({ name: 'word/footer1.xml', data: tpl.footerXml });
  files.push({ name: 'word/_rels/header1.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}"><Relationship Id="rIdH" Type="${RT.img}" Target="media/tis_header.png"/></Relationships>` });
  files.push({ name: 'word/_rels/footer1.xml.rels', data: tpl.footerRels });
  const rels = [`<Relationship Id="rId1" Type="${RT.hdr}" Target="header1.xml"/>`, `<Relationship Id="rId2" Type="${RT.ftr}" Target="footer1.xml"/>`,
  `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
  `<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>`,
  `<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>`,
  `<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>`,
  ...B.rels.map(r => `<Relationship Id="${r.id}" Type="${r.type}" Target="${xesc(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`)];
  files.push({ name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS.rel}">${rels.join('')}</Relationships>` });
  for (const [n, d] of B.files) files.push({ name: n, data: d });
  const blob = await writeZip(files);
  return { blob, total, answered, missing: B.missing, warnings: B.warn };
}

if (typeof module !== 'undefined') module.exports = { readZip, writeZip, parseSource, buildBook, detectMeta };
