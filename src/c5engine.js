/* ===================== Class 5 (Primary Scholarship) Solve Sheet engine ===================== */
// marks-distribution label: Unicode or Bijoy (SutonnyMJ) spelling, optionally after a bracket / bullet
const C5_MARK_SRC = '(?:(?:নম্বর|নাম্বার|নম্বরের|মান|মার্কস?)[\\s  \\-]*(?:ব[ণন]্টন|বিভাজন|বিন্যাস)|(?:(?:Marks?|Marking|Numbers?|Scores?|Points?)[\\s  \\-]*(?:Distributions?|Allocations?|Break[\\s\\-]?downs?|Schemes?|Divisions?|Splits?)|Distribution[\\s  ]*of[\\s  ]*(?:the[\\s  ]*)?(?:Marks?|Numbers?|Scores?|Points?)|(?:Marking|Scoring)[\\s  ]*(?:Guide|Rubric|Criteria)|Rubrics?)(?=[\\s  ]*(?:[:：\\-–—=(\\[]|$))|b¤\\^?i\\s*e[ÈY]&?U?b|bv¤\\^?vi\\s*e[ÈY]&?U?b|gvb\\s*e[ÈY]&?U?b)';
const C5 = {
  MAINQ: /^[\s ]*([০-৯]{1,2}[\s ]*।|\d{1,2}[\s ]*\.(?!\d))/,
  ANS: /^[\s ]*([০-৯\d]+[\s ]*নং[\s ]*প্রশ্নের[\s ]*উত্তর|Answers?[\s ]+(?:to|of)[\s ]+(?:the[\s ]+)?question(?:[\s ]*no\.?)?[\s ]*\(?\d+\)?)[\s ]*[:：]?/i,
  MARK: new RegExp('^[\\s  \\t\\[\\(\\{【*•∙·◦▪■□◆◇❖►▶➤⇒→\\-–—#]*(?:' + C5_MARK_SRC + '|Marks?[\\s  ]*[:：]|নম্বর[\\s  ]*[:：ঃ])', 'i'),
  MARK_IN: new RegExp(C5_MARK_SRC, 'i'),
  MARKWORD: /নম্বর|নাম্বার|মার্ক|\bmarks?\b|\bpoints?\b|b¤\^?i/i,
  NOTE: /^[\s ]*[\[(][\s ]*(?:বি[\s .]*[ঃ:.]?[\s ]*দ্র[\s .]*[ঃ:.]|N\.?\s*B\.?[\s ]*[:：])/i,
  STOP: /^[\s ]*(\((?:ক|খ|গ|ঘ|ঙ|চ|ছ|জ|ঝ|ঞ|a|b|c|d|e|f|g|h|i|j)\)|[০-৯]{1,2}[\s ]*।|[০-৯\d]+[\s ]*নং|Answers?[\s ]+(?:to|of)|উত্তর[\s ]*[:：ঃ]|Answers?[\s ]*[:：])/i,
  // '(ক) নং প্রশ্নের উত্তর:' / 'Answer to question no. (a):' — the label '(ক)' is kept in front of the answer
  SUBANS: /^[\s ]*(\([ক-ঞa-j]\))[\s ]*নং[\s ]*প্রশ্নের[\s ]*উত্তর[\s ]*[:：ঃ]?|^[\s ]*Answers?[\s ]+(?:to|of)[\s ]+(?:the[\s ]+)?question[\s ]*(?:no\.?)?[\s ]*(\([a-j]\))[\s ]*[:：]?/i,
  BAREANS: /^[\s ]*(উত্তর|Answers?)[\s ]*[:：ঃ][\s ]*$/i,
  HEAD: /^[\s ]*(সংক্ষিপ্ত[\s -]*উত্তর[\s ]*প্রশ্ন|সৃজনশীল[\s ]*প্রশ্ন|বহুনির্বাচনি[\s ]*প্রশ্ন|Short[\s ]*Answer[\s ]*Questions?|Creative[\s ]*Questions?).{0,30}$/i,
  NUM: /^([০-৯\d]{1,2}[\s ]*[।.)])([\s \t]*)/,
};
const c5ZW = /[​-‍⁠﻿­]/g;
const c5n = s => s.replace(c5ZW, '');
const c5Digit = s => parseInt(String(s).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)), 10);
const c5Bn = s => String(s).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
// strip zero-width chars but remember where every kept char came from
function c5NormMap(s) { let n = ''; const map = []; for (let i = 0; i < s.length; i++) { if (/[​-‍⁠﻿­]/.test(s[i])) continue; map.push(i); n += s[i]; } map.push(s.length); return { n, map }; }

function c5Meta(fileName, text) {
  const fn = fileName.replace(/\.docx$/i, '');
  let lang = /(^|[^A-Za-z])EV([^A-Za-z]|$)|English/i.test(fn) ? 'EV' : /(^|[^A-Za-z])BV([^A-Za-z]|$)|Bangla/i.test(fn) ? 'BV' : null;
  if (!lang) { const bn = (text.match(/[ঀ-৿]/g) || []).length, en = (text.match(/[A-Za-z]/g) || []).length; lang = bn > en ? 'BV' : 'EV'; }
  const sm = fn.match(/Set[\s_\-]*([A-J])(?![A-Za-z])/i) || text.match(/Set\s*Code\s*[:：]?\s*([A-J])\b/i) || text.match(/সেট\s*কোড\s*[:：]?\s*([A-J])\b/i);
  return { lang, set: sm ? sm[1].toUpperCase() : null };
}

/* ---------------- marks distribution (নম্বর বণ্টন) removal ----------------
   Works on any list of blocks (body or a table cell): a label paragraph / table / text box removes itself and the
   lines that belong to it — also across blank lines and '(ক) … ১ নম্বর' style lines — up to the next answer or question. */
function c5StripMarks(list, st, ctx) {
  // tables: cell texts joined with spaces so 'Step | Marks' does not read as 'StepMarks'
  const txt = el => c5n(isW(el, 'tbl') ? q(el, NS.w, 'p').map(plainText).join(' ') : plainText(el)).trim();
  const isEmpty = el => isW(el, 'p') && !txt(el) && !hasDrawing(el) && !q(el, NS.m, 'oMath').length;
  const marky = t => C5.MARKWORD.test(t) || (/জন্য|\bfor\b/i.test(t) && /[০-৯\d½¼¾][\s ]*(?:নম্বর|marks?)?[\s )\]।.]*$/i.test(t) && t.length < 110);
  const isMainQ = (el, t) => { if (!isW(el, 'p')) return false; const m = t.match(C5.MAINQ); if (!m) return false; return /^[\s ]*[০-৯]/.test(t) || c5Digit(m[1]) === ctx.lastMain + 1; };
  // a short line that ends in a number ('সঠিক উত্তর — ১', '(ক) অংশ ২ নম্বর')
  const markLine = t => marky(t) || (t.length < 70 && /[০-৯\d½¼¾][\s ]*(?:নম্বর|marks?)?[\s )\]।.]*$/i.test(t));
  // a full answer sentence / equation that follows the marks block without a blank line
  // typical first words of a marks line ('For correct formula …', 'Writing the formula …', 'সঠিক উত্তর …')
  const markStart = t => /^[\s ]*(?:[-•*▪◦]|\(?[a-hক-ঙ]\)|\(?[ivx]+\)|for\b|correct|writing|formula|step|using|finding|drawing|calculat|proper|right|identif|explain|mention|সঠিক|সূত্র|ধাপ|মান[\s ]*বসা|লেখার|নির্ণয়|ব্যাখ্যা|চিত্র[\s ]*অঙ্কন)/i.test(t) && t.length < 100;
  const answerish = (el, t) => !markLine(t) && !markStart(t) && (t.length > 120 || q(el, NS.m, 'oMath').length > 0 || /[।.?!:][\s ]*$/.test(t));
  // an answer line that only carries marks inside it ('… = 38 [2 marks]', '… (Marks distribution: …)') is kept; its marks part is cut later
  const withInline = t => { let r = t; const m = C5.MARK_IN.exec(r); if (m && m.index > 0) r = r.slice(0, m.index); r = r.replace(/[\[(（【][^\[\]()（）【】]{0,40}?(?:নম্বর|নাম্বার|\bmarks?\b)[^\[\]()（）【】]{0,20}[\])）】]/gi, ''); return r !== t && r.replace(/[\s ()\[\]:：\-–—]/g, '').length > 12; };
  const ender = (el, t) => (isW(el, 'p') && withInline(t)) || C5.SUBANS.test(t) || C5.ANS.test(t) || C5.BAREANS.test(t) || C5.HEAD.test(t) || C5.MARK.test(t) || isMainQ(el, t)
    || (C5.STOP.test(t) && !markLine(t)) || (isW(el, 'tbl') && !marky(t)) || (hasDrawing(el) && !marky(t)) || (isW(el, 'p') && answerish(el, t));
  const out = [];
  // text boxes that hold a marks distribution go first, so their text never decides about the paragraph around them
  for (const el of list) for (const tb of q(el, NS.w, 'txbxContent')) {
    if (!tb.parentNode || !C5.MARK.test(c5n(plainText(tb)).trim())) continue;
    let r = tb; while (r && !(isW(r, 'r') && r.parentNode)) r = r.parentNode;
    if (r && el.contains(r)) { r.remove(); st.marks++; }
  }
  for (let i = 0; i < list.length; i++) {
    const el = list[i];
    const t = txt(el);
    if (C5.MARK.test(t)) {
      let j = i + 1;
      while (j < list.length) {
        const e = list[j];
        if (isEmpty(e)) { let k = j; while (k < list.length && isEmpty(list[k])) k++; const tk = k < list.length ? txt(list[k]) : ''; if (k < list.length && marky(tk) && !ender(list[k], tk)) { j = k; continue; } break; }
        if (ender(e, txt(e))) break;
        j++;
      }
      st.marks++; st.removed += j - i; i = j - 1; continue;
    }
    if (isW(el, 'p') && C5.NOTE.test(t) && /[\])][\s ।.]*$/.test(t)) { st.removed++; continue; } // [বি.দ্রঃ …]
    // zone tracking (for bracketed '[২ নম্বর]' removal inside answers)
    if (isW(el, 'p')) {
      const mq = t.match(C5.MAINQ); if (mq && c5Digit(mq[1]) === ctx.lastMain + 1) { ctx.lastMain++; ctx.zone = 'q'; }
      if (C5.SUBANS.test(t) || C5.ANS.test(t) || C5.BAREANS.test(t)) ctx.zone = 'a';
    }
    if (isW(el, 'tbl')) {
      for (const tr of kids(el).filter(k => isW(k, 'tr'))) for (const tc of kids(tr).filter(k => isW(k, 'tc'))) {
        const blocks = kids(tc).filter(k => isW(k, 'p') || isW(k, 'tbl'));
        const keep = new Set(c5StripMarks(blocks, st, { ...ctx }));
        for (const b of blocks) if (!keep.has(b)) b.remove();
        if (!kids(tc).some(k => isW(k, 'p'))) tc.appendChild(mk(tc.ownerDocument, 'p'));
      }
    } else if (isW(el, 'p') && !c5StripInline(el, st, ctx)) { st.removed++; continue; }
    out.push(el);
  }
  return out;
}
/* inline marks inside an otherwise normal paragraph; returns false when nothing is left of it */
function c5StripInline(p, st, ctx) {
  const had = plainText(p).trim() || hasDrawing(p) || q(p, NS.m, 'oMath').length;
  for (let guard = 0; guard < 6; guard++) {
    const rt = runsText(p); const { n, map } = c5NormMap(rt);
    let a = -1, b = -1;
    const m = C5.MARK_IN.exec(n);
    if (m && m.index > 0) {
      a = m.index; let k = a - 1; while (k >= 0 && /[\s \t*•\-–—:]/.test(n[k])) k--;
      const open = k >= 0 && '[({【'.includes(n[k]) ? n[k] : null;
      if (open) { a = k; const close = { '[': ']', '(': ')', '{': '}', '【': '】' }[open]; const c = n.indexOf(close, m.index); b = c >= 0 ? c + 1 : n.length; }
      else b = n.length;
      while (a > 0 && /[\s \t]/.test(n[a - 1])) a--;
    } else if (ctx.zone === 'a') {
      const bm = /[\s ]*[\[(（【][\s ]*[^\[\]()（）【】]{0,30}?(?:নম্বর|নাম্বার|\bmarks?\b)[\s ]*[\])）】]/i.exec(n);
      if (bm) { a = bm.index; b = bm.index + bm[0].length; }
    }
    if (a < 0) { const nm = /[\s ]*[\[(][\s ]*(?:বি[\s .]*[ঃ:.]?[\s ]*দ্র[\s .]*[ঃ:.])[^\])]*[\])]/.exec(n); if (nm) { a = nm.index; b = nm.index + nm[0].length; } }
    if (a < 0) break;
    deleteRange(p, map[a], map[b]); st.marks++;
  }
  return !had || !!(plainText(p).trim() || hasDrawing(p) || q(p, NS.m, 'oMath').length);
}

/* ---------------- hanging indent after the question number ----------------
   '১।<tab>প্রশ্ন…' keeps the gap the source had after the number; wrapped lines and every following line of that
   question (sentences, (ক)(খ), equations) start at that same distance — only the numbers stay at the margin. */
const C5_CTX = (typeof document !== 'undefined') ? document.createElement('canvas').getContext('2d') : null;
function c5Defaults(stylesXml) {
  const d = { fA: 'Times New Roman', fC: 'SolaimanLipi', sz: 22, szCs: 22 };
  const dd = (stylesXml || '').match(/<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/); const x = dd ? dd[0] : '';
  const g = re => (x.match(re) || [])[1];
  d.fA = g(/w:ascii="([^"]+)"/) || d.fA; d.fC = g(/w:cs="([^"]+)"/) || d.fC;
  d.sz = +(g(/<w:sz w:val="(\d+)"/) || d.sz); d.szCs = +(g(/<w:szCs w:val="(\d+)"/) || d.sz);
  return d;
}
function c5RunFont(r, D) {
  const rp = r && kids(r).find(k => isW(k, 'rPr')); const f = { ...D, b: false };
  if (rp) for (const k of kids(rp)) {
    const v = k.getAttributeNS(NS.w, 'val');
    if (isW(k, 'rFonts')) { const a = k.getAttributeNS(NS.w, 'ascii'), c = k.getAttributeNS(NS.w, 'cs'); if (a) f.fA = a; if (c) f.fC = c; }
    else if (isW(k, 'sz')) f.sz = +v; else if (isW(k, 'szCs')) f.szCs = +v;
    else if (isW(k, 'b') || isW(k, 'bCs')) f.b = !(v === '0' || v === 'false');
  }
  return f;
}
function c5Width(text, f) { // twips
  if (!C5_CTX) return text.length * (f.sz || 22) * 5;
  let w = 0;
  for (const part of text.split(/([ঀ-৿।॥]+)/)) {
    if (!part) continue; const bn = /[ঀ-৿।॥]/.test(part);
    C5_CTX.font = `${f.b ? 'bold ' : ''}${(bn ? f.szCs : f.sz) / 2}pt '${bn ? f.fC : f.fA}', ${bn ? "'SolaimanLipi','Nirmala UI','Vrinda','Noto Sans Bengali'," : "'Times New Roman',"} serif`;
    w += C5_CTX.measureText(part).width * 15;
  }
  return w;
}
function c5Ind(p) {
  const pp = kids(p).find(k => isW(k, 'pPr')); const ind = pp && kids(pp).find(k => isW(k, 'ind'));
  const g = a => ind ? +(ind.getAttributeNS(NS.w, a) || 0) : 0;
  return { left: g('left') || g('start'), right: ind ? (ind.getAttributeNS(NS.w, 'right') || ind.getAttributeNS(NS.w, 'end')) : null, hanging: g('hanging'), firstLine: g('firstLine') };
}
function c5SetInd(p, left, hanging, right, firstLine) {
  const ind = mk(p.ownerDocument, 'ind', { left: String(Math.max(0, Math.round(left))) });
  if (right != null && right !== '') ind.setAttributeNS(NS.w, 'w:right', String(right));
  if (hanging) ind.setAttributeNS(NS.w, 'w:hanging', String(Math.round(hanging)));
  else if (firstLine) ind.setAttributeNS(NS.w, 'w:firstLine', String(Math.round(firstLine)));
  setPPrChild(getPPr(p), ind);
}
function c5Tabs(p) { const pp = kids(p).find(k => isW(k, 'pPr')); const t = pp && kids(pp).find(k => isW(k, 'tabs')); return t ? kids(t).filter(k => isW(k, 'tab')) : []; }
// text of the leading run sequence only (stops at math / hyperlinks so indices match runsText)
function c5LeadText(p) { let s = ''; for (const c of kids(p)) { if (isW(c, 'pPr')) continue; if (!isW(c, 'r')) break; for (const k of kids(c)) { if (isW(k, 't')) s += k.textContent; else if (isW(k, 'tab')) s += '\t'; } } return s; }
function c5StripLead(p) {
  for (const c of kids(p)) {
    if (isW(c, 'pPr')) continue;
    if (!isW(c, 'r')) return;
    for (const k of kids(c)) {
      if (isW(k, 'rPr')) continue;
      if (isW(k, 'tab')) { k.remove(); continue; }
      if (isW(k, 't')) { const s = k.textContent.replace(/^[\s ]+/, ''); if (s) { k.textContent = s; k.setAttribute('xml:space', 'preserve'); return; } k.remove(); continue; }
      return; // picture, symbol, break …
    }
    if (!kids(c).some(k => !isW(k, 'rPr'))) c.remove();
  }
}
const c5HasNum = p => { const pp = kids(p).find(k => isW(k, 'pPr')); return !!(pp && kids(pp).some(k => isW(k, 'numPr'))); };
/* measure the source gap after the number: returns T (twips from the number to the text) */
function c5MeasureHead(p, ctx) {
  const lt = c5LeadText(p); const lead = lt.match(/^[\s \t]*/)[0];
  const m = lt.slice(lead.length).match(C5.NUM); if (!m) return null;
  const I = c5Ind(p); const f = c5RunFont(kids(p).find(k => isW(k, 'r')), ctx.D);
  const sp = c5Width(' ', f) || 60, def = ctx.defTab || 720;
  // only left stops count for the gap after the number (right / centre stops are the marks column)
  const stops = c5Tabs(p).filter(t => ['left', 'start', null, ''].includes(t.getAttributeNS(NS.w, 'val'))).map(t => +t.getAttributeNS(NS.w, 'pos')).filter(v => v < 2880).sort((a, b) => a - b);
  const next = x => { const s = stops.find(v => v > x + 1); if (s != null) return s; if (I.hanging && I.left > x + 1) return I.left; return (Math.floor(x / def) + 1) * def; };
  let x = I.left - I.hanging + I.firstLine;
  for (const ch of lead) x = ch === '\t' ? next(x) : x + sp;
  const start = x; x += c5Width(m[1], f); const numW = x - start;
  for (const ch of m[2]) x = ch === '\t' ? next(x) : x + sp;
  if (!m[2]) x += sp;
  let T = Math.max(x - start, numW + 60);
  T = Math.min(Math.ceil(T / 10) * 10, 1440);
  return { T, numLen: lead.length + m[1].length, gapLen: m[2].length, lead: lead.length };
}
/* number at the margin, one tab, hanging indent T */
function c5HangHead(p, T, info) {
  const I = c5Ind(p);
  const at0 = info.numLen - info.lead; // length of the number itself
  if (info.gapLen) deleteRange(p, info.numLen, info.numLen + info.gapLen);
  if (info.lead) deleteRange(p, 0, info.lead);
  const at = splitPara(p, at0);
  const prev = at ? at.previousSibling : kids(p).filter(k => isW(k, 'r')).pop();
  const r = mk(p.ownerDocument, 'r'); const rp = prev && isW(prev, 'r') && kids(prev).find(k => isW(k, 'rPr')); if (rp) r.appendChild(rp.cloneNode(true)); r.appendChild(mk(p.ownerDocument, 'tab'));
  p.insertBefore(r, at || null);
  for (const t of c5Tabs(p)) if (+t.getAttributeNS(NS.w, 'pos') <= T && t.getAttributeNS(NS.w, 'val') !== 'clear') t.remove();
  c5SetInd(p, T, T, I.right);
}
/* prefix an answer paragraph with its question number the same way */
function c5HangPrefix(p, prefix, T) {
  c5StripLead(p);
  const d = p.ownerDocument; const ref = kids(p).find(k => isW(k, 'r'));
  const rp = ref && kids(ref).find(k => isW(k, 'rPr'));
  const first = kids(p).find(k => !isW(k, 'pPr')) || null;
  const r1 = mk(d, 'r'); if (rp) r1.appendChild(rp.cloneNode(true)); const t = mk(d, 't'); t.setAttribute('xml:space', 'preserve'); t.textContent = prefix; r1.appendChild(t);
  const r2 = mk(d, 'r'); if (rp) r2.appendChild(rp.cloneNode(true)); r2.appendChild(mk(d, 'tab'));
  p.insertBefore(r1, first); p.insertBefore(r2, first);
  const I = c5Ind(p);
  for (const tb of c5Tabs(p)) if (+tb.getAttributeNS(NS.w, 'pos') <= T && tb.getAttributeNS(NS.w, 'val') !== 'clear') tb.remove();
  c5SetInd(p, T, T, I.right);
}
/* every other line of the question / answer starts at T (keeps its own extra indent) */
function c5HangFollower(p, T) {
  if (!isW(p, 'p') || c5HasNum(p)) return;
  const t = plainText(p).trim();
  if (!t && !hasDrawing(p) && !q(p, NS.m, 'oMath').length) return;
  if (/^[\[(]?[০-৯\d\s+½.]{1,4}[\])]?$/.test(t)) return; // a lone marks number pushed to the right by tabs
  c5StripLead(p);
  const I = c5Ind(p);
  let L = Math.max(T, I.left);
  if (I.hanging && L - I.hanging < T) L = T + I.hanging;
  c5SetInd(p, L, I.hanging, I.right, I.hanging ? 0 : Math.max(0, I.firstLine));
}
/* fit tab stops laid out for the source page width into the target width (right tabs go to the right edge) */
function c5FitTabs(node, srcW, targetW) {
  const f = Math.min(1, targetW / srcW);
  for (const t of q(node, NS.w, 'tab')) {
    if (!t.parentNode || !isW(t.parentNode, 'tabs')) continue;
    const v = t.getAttributeNS(NS.w, 'val'); if (v === 'clear' || v === 'bar') continue;
    const pos = +t.getAttributeNS(NS.w, 'pos'); if (!(pos > 1100)) continue;
    if (v === 'right' || v === 'end' || pos >= srcW * 0.88) { t.setAttributeNS(NS.w, 'w:pos', String(targetW)); t.setAttributeNS(NS.w, 'w:val', 'right'); }
    else if (f < 1) t.setAttributeNS(NS.w, 'w:pos', String(Math.round(pos * f)));
  }
  if (f < 1) for (const ind of q(node, NS.w, 'ind')) for (const a of ['left', 'right', 'start', 'end']) { const v = +ind.getAttributeNS(NS.w, a); if (v > 1440) ind.setAttributeNS(NS.w, 'w:' + a, String(Math.round(v * f))); }
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
  // source text width (the tab stops of the source are laid out for it)
  let srcW = 10800;
  { const sp = q(body, NS.w, 'sectPr').pop(); const sz = sp && kids(sp).find(k => isW(k, 'pgSz')), mg = sp && kids(sp).find(k => isW(k, 'pgMar'));
    if (sz && mg) { const w = +sz.getAttributeNS(NS.w, 'w'), l = +mg.getAttributeNS(NS.w, 'left') || +mg.getAttributeNS(NS.w, 'start') || 0, r = +mg.getAttributeNS(NS.w, 'right') || +mg.getAttributeNS(NS.w, 'end') || 0; if (w > 2000 && w - l - r > 2000) srcW = w - l - r; } }
  const items = [];
  (function collect(parent) { for (const c of kids(parent)) { if (isW(c, 'sdt')) { const sc = kids(c).find(k => isW(k, 'sdtContent')); if (sc) collect(sc); } else if (isW(c, 'p') || isW(c, 'tbl')) items.push(c); } })(body);
  const meta = c5Meta(file.name, plainText(body).slice(0, 4000));
  const stylesXml = await zip.text('word/styles.xml'), settingsXml = await zip.text('word/settings.xml');
  const hctx = { D: c5Defaults(stylesXml), defTab: +(((settingsXml || '').match(/<w:defaultTabStop w:val="(\d+)"/) || [])[1] || 720) };

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
  const work = items.slice(start); work.forEach(clean);
  const list = c5StripMarks(work, st, { lastMain: 0, zone: 'q' });

  let needBanner = false, pendingLabel = null, lastMain = 0, zone = 'q', curMain = '', pendingMain = null, pendingNum = 0, curNum = 0;
  const tMap = {}; let qT = null, ansT = null;
  const fmtMain = n => { const d = (curMain.match(/[০-৯\d]+/) || ['1'])[0]; const bn = /[০-৯]/.test(d) || (!curMain && meta.lang === 'BV'); let s = String(n); if (d.length === 2 && /^[০0]/.test(d)) s = s.padStart(2, '0'); const term = curMain.replace(/^[০-৯\d\s ]+/, '') || (bn ? '।' : '.'); return (bn ? c5Bn(s) : s) + term; };
  const enterAnswers = (num) => { if (num) { if (num !== pendingNum || zone !== 'a') { pendingMain = fmtMain(num); pendingNum = num; } } else if (zone !== 'a') { pendingMain = curMain; pendingNum = curNum; } zone = 'a'; qT = null; };
  const pushEl = el => {
    const o = { el, zone };
    if (zone === 'a') {
      if (pendingMain && isW(el, 'p') && (plainText(el).trim() || hasDrawing(el))) {
        o.mainPrefix = pendingMain; pendingMain = null;
        ansT = tMap[pendingNum] || Math.ceil((c5Width(o.mainPrefix, c5RunFont(kids(el).find(k => isW(k, 'r')), hctx.D)) + 120) / 10) * 10;
        o.hangT = ansT;
      } else if (ansT && isW(el, 'p')) o.hangF = ansT;
    } else if (qT && isW(el, 'p')) c5HangFollower(el, qT);
    ops.push(o);
  };
  const applyLabel = p => {
    const r = mk(p.ownerDocument, 'r');
    const rp = pendingLabel.ref && kids(pendingLabel.ref).find(k => isW(k, 'rPr'));
    if (rp) r.appendChild(rp.cloneNode(true));
    const t = mk(p.ownerDocument, 't'); t.setAttribute('xml:space', 'preserve'); t.textContent = pendingLabel.text; r.appendChild(t);
    const first = kids(p).find(k => !isW(k, 'pPr')); p.insertBefore(r, first || null);
    pendingLabel = null;
  };
  const isEmpty = el => isW(el, 'p') && !plainText(el).trim() && !hasDrawing(el) && !q(el, NS.m, 'oMath').length;
  for (let i = 0; i < list.length; i++) {
    const el = list[i];
    if (isW(el, 'p')) {
      const t = plainText(el);
      if (C5.HEAD.test(t.trim())) { st.removed++; continue; }
      {
        const mq = t.match(C5.MAINQ);
        if (mq) { const n = c5Digit(mq[1]); if (n === lastMain + 1) {
          needBanner = true; lastMain = n; zone = 'q'; curMain = mq[0].trim(); curNum = n; pendingMain = null; ansT = null;
          const info = c5HasNum(el) ? null : c5MeasureHead(el, hctx);
          if (info) { qT = info.T; tMap[n] = info.T; c5HangHead(el, info.T, info); ops.push({ el, zone }); continue; }
          qT = null;
        } }
      }
      const sm = runsText(el).match(C5.SUBANS);
      if (sm) {
        if (needBanner) { ops.push({ banner: 'answer' }); st.answers++; needBanner = false; }
        enterAnswers();
        pendingLabel = { text: (sm[1] || sm[2]) + ' ', ref: kids(el).find(k => isW(k, 'r')) };
        deleteRange(el, 0, sm[0].length); c5StripLead(el);
        if (plainText(el).trim() || hasDrawing(el)) { applyLabel(el); pushEl(el); }
        continue;
      }
      if (C5.BAREANS.test(t)) { ops.push({ banner: 'answer' }); st.answers++; needBanner = false; enterAnswers(); continue; }
      const am = runsText(el).match(C5.ANS) || t.match(C5.ANS);
      if (am) { needBanner = false;
        st.answers++; ops.push({ banner: 'answer' });
        const dn = am[0].match(/[০-৯\d]+/); enterAnswers(dn ? c5Digit(dn[0]) : 0);
        const rt = runsText(el); const m2 = rt.match(C5.ANS);
        if (m2) deleteRange(el, 0, m2[0].length);
        if (plainText(el).trim() || hasDrawing(el)) pushEl(el);
        continue;
      }
    }
    if (pendingLabel && isW(el, 'p') && (plainText(el).trim() || hasDrawing(el))) applyLabel(el);
    pushEl(el);
  }
  // drop trailing empties and collapse runs of 3+ empty paragraphs
  while (ops.length && ops[ops.length - 1].el && isEmpty(ops[ops.length - 1].el)) ops.pop();
  const ops2 = []; let emp = 0;
  for (const o of ops) { if (o.el && isEmpty(o.el)) { if (++emp > 1) continue; } else emp = 0; ops2.push(o); }
  return {
    kind: 'c5', file, fileIdx, zip, doc, rels, ct, meta, ops: ops2, stats: st, srcW,
    rootAttrs: [...doc.documentElement.attributes].map(a => [a.name, a.value]),
    styles: stylesXml, numbering: await zip.text('word/numbering.xml'),
    fontTable: await zip.text('word/fontTable.xml'), theme: await zip.text('word/theme/theme1.xml'), settings: settingsXml,
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
// Letter, top/bottom 0.8", left/right 0.5". The header/footer bands sit inside the 0.8" margins (bandY / footY in inches).
const C5_PAGE = { w: 12240, h: 15840, top: 1152, bottom: 1152, left: 720, right: 720, header: 504, footer: 474, bandY: 0.35, footY: 10.30 };

function c5HeaderXml(S, rid, cy) {
  const F = c5Fonts(S.lang);
  const o = { font: F.f, csFont: F.f, b: true };
  const zl = S.hSzL || (S.lang === 'BV' ? 24 : 20), zr = S.hSzR || (S.lang === 'BV' ? 24 : 20);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}"><w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="10190"/></w:tabs><w:spacing w:before="${S.lang === 'BV' ? 100 : 120}" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="430" w:right="-200"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr>${c5Anchor(rid, 7772400, cy, 0, Math.round(C5_PAGE.bandY * EMU_IN), 'TIS-C5-HeaderBand')}</w:r>${c5RunXml(S.hLeft, { ...o, sz: zl, szCs: zl, color: 'FFFFFF' })}<w:r><w:tab/></w:r>${c5RunXml(S.hRight, { ...o, sz: zr, szCs: zr, color: '1A1A1A' })}</w:p></w:hdr>`;
}
function c5FooterXml(S, rid, cy) {
  const F = c5Fonts(S.lang);
  const pg = `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${c5RunXml('1', { font: 'Times New Roman', csFont: 'SolaimanLipi', sz: 20 }).replace('<w:r>', '<w:r>')}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
  const custom = S.footerMode === 'custom';
  const body = custom
    ? `${c5RunXml(S.fLeft, { font: F.f, csFont: 'SolaimanLipi', b: true, sz: 18, color: 'FFFFFF' })}<w:r><w:tab/></w:r>${pg}<w:r><w:tab/></w:r>${c5RunXml(S.fRight, { font: 'SolaimanLipi', csFont: 'SolaimanLipi', b: true, sz: 18, szCs: 20, color: '1A1A1A' })}`
    : `<w:r><w:tab/></w:r>${pg}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}"><w:p><w:pPr><w:tabs><w:tab w:val="center" w:pos="5400"/><w:tab w:val="right" w:pos="10190"/></w:tabs><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="${custom ? 520 : 0}"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr>${c5Anchor(rid, 7772400, cy, 0, Math.round(C5_PAGE.footY * EMU_IN), 'TIS-C5-FooterBand')}</w:r>${body}</w:p></w:ftr>`;
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


/* ---------------- Class 8 MCQ: question + options in a cell, circled answer in a grey strip ---------------- */
const C8_MCQ = { col: 5184, strip: 380, content: 5184 - 380 };
function c8EnsureSpacing(p) {
  const pp = getPPr(p);
  if (!kids(pp).some(k => isW(k, 'spacing'))) setPPrChild(pp, mk(p.ownerDocument, 'spacing', { after: '0', line: '252', lineRule: 'auto' }));
}
async function emitC8Mcq(B, src, part, qn, S) {
  const doc = src.doc; const clone = el => el.cloneNode(true);
  let pre = qn.els, opts = [], post = [];
  if (qn.opts && qn.opts.length) { pre = qn.els.slice(0, qn.optRange[0]); post = qn.els.slice(qn.optRange[1] + 1); opts = qn.opts; }
  const letter = part.answers[qn.num] || qn.auto;
  if (!letter) B.missing.push(`Set-${part.label || ''} প্রশ্ন ${String(qn.num).padStart(2, '0')}`);
  const out1 = [], out2 = [];
  let firstQ = true;
  for (const el of pre) {
    const p = clone(el);
    if (isW(p, 'p')) {
      const t = runsText(p); const am = /\[\s*Ans[^\]]*\]/i.exec(t); if (am) deleteRange(p, am.index, am.index + am[0].length);
      const isQ = firstQ && QNUM_RE.test(runsText(p));
      if (isQ) { setIndent(p, 360, 360); firstQ = false; const pp = getPPr(p); setPPrChild(pp, mk(doc, 'keepNext')); } else setIndent(p, 360, null);
      c8EnsureSpacing(p);
    }
    await B.fixNode(src, p); out1.push(B.ser(p));
  }
  if (opts.length) {
    const disp = opts.map(o => { const p = clone(o.para); stripLeading(p, /^[\s ]*[√✓✔][\s ]*/); stripLeading(p, /^[\s ]+/); trimTrailing(p); const len = plainText(p).length; return { p, len, draw: hasDrawing(p) }; });
    const lines = [];
    if (disp.length <= 4 && disp.every(d => d.len <= 10 && !d.draw)) lines.push({ items: disp, stops: [360, 1480, 2600, 3720] });
    else for (let i = 0; i < disp.length;) { if (i + 1 < disp.length && disp[i].len <= 24 && disp[i + 1].len <= 24 && !disp[i].draw && !disp[i + 1].draw) { lines.push({ items: [disp[i], disp[i + 1]], stops: [360, 2600] }); i += 2; } else { lines.push({ items: [disp[i]], stops: [360] }); i++; } }
    for (const ln of lines) {
      const p = mk(doc, 'p'); const pp = mk(doc, 'pPr'); p.appendChild(pp);
      setPPrChild(pp, mk(doc, 'keepLines'));
      setTabs(p, ln.stops.map(x => ['left', x]));
      setPPrChild(pp, mk(doc, 'spacing', { after: '0', line: '252', lineRule: 'auto' }));
      setIndent(p, 360, 360);
      for (const d of ln.items) { const r = mk(doc, 'r'); r.appendChild(mk(doc, 'tab')); p.appendChild(r); for (const n of contentNodes(d.p)) p.appendChild(n); }
      await B.fixNode(src, p); out1.push(B.ser(p));
    }
  }
  if (S.keepSolve !== false) for (const el of post) {
    const p = clone(el);
    if (isW(p, 'p')) { setIndent(p, 360, null); c8EnsureSpacing(p); }
    await B.fixNode(src, p); out2.push(B.ser(p));
  }
  const glyph = letter ? String.fromCharCode(0x24D0 + letter.charCodeAt(0) - 97) : '';
  const ensureP = arr => { if (!arr.length || /<\/w:tbl>$/.test(arr[arr.length - 1])) arr.push('<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>'); return arr.join(''); };
  const W1 = C8_MCQ.content, W2 = C8_MCQ.strip;
  const strip = (inner, v) => `<w:tc><w:tcPr><w:tcW w:w="${W2}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/><w:vAlign w:val="${v}"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="20" w:line="240" w:lineRule="auto"/><w:ind w:left="0" w:right="0"/><w:jc w:val="center"/></w:pPr>${inner}</w:p></w:tc>`;
  const letterRun = glyph ? `<w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol" w:cs="Segoe UI Symbol"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${glyph}</w:t></w:r>` : '';
  const cell = (x) => `<w:tc><w:tcPr><w:tcW w:w="${W1}" w:type="dxa"/></w:tcPr>${x}</w:tc>`;
  const none = 'w:val="none" w:sz="0" w:space="0" w:color="auto"';
  let xml = `<w:tbl><w:tblPr><w:tblW w:w="${W1 + W2}" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/><w:tblBorders><w:top ${none}/><w:left ${none}/><w:bottom ${none}/><w:right ${none}/><w:insideH ${none}/><w:insideV ${none}/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="20" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="20" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr><w:tblGrid><w:gridCol w:w="${W1}"/><w:gridCol w:w="${W2}"/></w:tblGrid>`;
  xml += `<w:tr>${cell(ensureP(out1))}${strip(letterRun, 'bottom')}</w:tr>`;
  if (out2.length) xml += `<w:tr>${cell(ensureP(out2))}${strip('', 'top')}</w:tr>`;
  return xml + '</w:tbl>';
}

/* ---------------- main build ---------------- */
async function buildC5({ sources, sets, S, img }) {
  // sources: parsed c5 sources in order; sets: [{src, label}] ; img: {headerBg, footerBg, title, ribbons:[], answer, coverFront, coverBack}
  if (!sets.length) throw new Error('কোনো ফাইল নেই');
  const uniq = [...new Set([...sets.filter(s => s.kind !== 'mcq'), ...sets.filter(s => s.kind === 'mcq')].map(s => s.src))]; // written sources first: their styles are the base
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
  const sectProps = (hdr, ftr, type, pgStart, cols = 1) => `<w:sectPr><w:headerReference w:type="default" r:id="${hdr}"/><w:footerReference w:type="default" r:id="${ftr}"/><w:type w:val="${type}"/><w:pgSz w:w="${P.w}" w:h="${P.h}" w:code="1"/><w:pgMar w:top="${P.top}" w:right="${P.right}" w:bottom="${P.bottom}" w:left="${P.left}" w:header="${P.header}" w:footer="${P.footer}" w:gutter="0"/>${pgStart ? '<w:pgNumType w:start="1"/>' : ''}${cols === 2 ? '<w:cols w:num="2" w:sep="1" w:space="432"/>' : '<w:cols w:space="720"/>'}<w:docGrid w:linePitch="360"/></w:sectPr>`;
  const sectPara = props => `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr>${props}</w:pPr></w:p>`;
  const body = [];

  // front cover
  if (img.coverFront) {
    const rid = addImg(img.coverFront, 'c5_cover_front');
    body.push(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr>${c5Anchor(rid, 7772400, 10058400, 0, 0, 'TIS-C5-CoverFront')}</w:r></w:p>`);
    body.push(sectPara(sectProps(h2Rid, f2Rid, 'nextPage', false)));
  }
  // content sections: 1 column for title / banners / written, 2 columns for MCQ
  let curCols = 1, curType = img.coverFront ? 'nextPage' : 'continuous', firstContent = true;
  const setCols = n => { if (n === curCols) return; body.push(sectPara(sectProps(hRid, fRid, curType, firstContent, curCols))); firstContent = false; curType = 'continuous'; curCols = n; };
  if (img.title) { const rid = addImg(img.title, 'c5_title'); const [cx, cy] = sizeW(img.title, 7.3); body.push(centerP(c5Inline(rid, cx, cy, 'TIS-C5-Title'), 60)); }
  const ansRid = img.answer ? addImg(img.answer, 'c5_answer') : null;
  const [acx, acy] = img.answer ? sizeW(img.answer, img.answerWidthIn || 1.15) : [0, 0];
  let total = 0, mcqTotal = 0, mcqAnswered = 0;
  for (let k = 0; k < sets.length; k++) {
    const set = sets[k]; const { src } = set;
    const rb = img.ribbons[k];
    setCols(1);
    if (rb) { const rid = addImg(rb, 'c5_ribbon_' + k); const [cx, cy] = sizeW(rb, 1.35); body.push(centerP(c5Inline(rid, cx, cy, 'TIS-C5-Ribbon'), 120, k ? 160 : 40)); }
    if (set.kind === 'mcq') {
      setCols(2);
      B.S.maxImgEmu = (C8_MCQ.content - 420) * 635;
      for (const part of src.parts.filter(p => p.kind === 'mcq')) for (const qn of part.questions) {
        const xml = await emitC8Mcq(B, src, part, qn, S);
        body.push(xml); mcqTotal++; if (part.answers[qn.num] || qn.auto) mcqAnswered++;
      }
      B.S.maxImgEmu = 10800 * 635;
      continue;
    }
    if (set.kind === 'cadet') {
      // all questions (2 columns) → one answer banner → all answers (2 columns), each answer group opened with its question number
      const emit = async (op) => {
        const c = op.el.cloneNode(true);
        // each answer group opens with its question number; the rest of the group keeps the same hanging distance
        if (op.mainPrefix && isW(c, 'p')) c5HangPrefix(c, op.mainPrefix, op.hangT);
        else if (op.hangF) c5HangFollower(c, op.hangF);
        // source tab stops are laid out for the source page width: fit them into one column
        c5FitTabs(c, src.srcW || 10800, C8_MCQ.col);
        await B.fixNode(src, c); body.push(B.ser(c));
      };
      const oldImg = B.S.maxImgEmu, oldCol = B.S.colTwips;
      B.S.maxImgEmu = (C8_MCQ.col - 200) * 635; B.S.colTwips = C8_MCQ.col;
      setCols(2); for (const op of src.ops) if (!op.banner && op.zone !== 'a') await emit(op);
      setCols(1); if (ansRid) body.push(centerP(c5Inline(ansRid, acx, acy, 'TIS-C5-Answer'), 80, 120)); total++;
      setCols(2); for (const op of src.ops) if (!op.banner && op.zone === 'a') await emit(op);
      B.S.maxImgEmu = oldImg; B.S.colTwips = oldCol;
      continue;
    }
    for (const op of src.ops) {
      if (op.banner) { if (ansRid) body.push(centerP(c5Inline(ansRid, acx, acy, 'TIS-C5-Answer'), 80, 80)); total++; continue; }
      const c = op.el.cloneNode(true);
      c5FitTabs(c, src.srcW || 10800, P.w - P.left - P.right);
      await B.fixNode(src, c);
      body.push(B.ser(c));
    }
  }
  const contentProps = sectProps(hRid, fRid, curType, firstContent, curCols);
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
  return { blob, answers: total, mcqTotal, mcqAnswered, missing: B.missing, warnings: B.warn, files };
}
