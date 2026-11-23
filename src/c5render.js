/* ===================== DOCX → paged HTML (for preview + Save as PDF) ===================== */
const TW2PX = 96 / 1440, EMU2PX = 96 / 914400;
const BN_RE = /[ঀ-৿।॥]/;
const MATHML = 'http://www.w3.org/1998/Math/MathML';

/* ---------- OMML → MathML ---------- */
function ommlToMathml(node, rFontFn) {
  const mk = (tag, ...ch) => { const e = document.createElementNS(MATHML, tag); for (const c of ch) if (c) e.appendChild(c); return e; };
  const txt = (tag, t, st) => { const e = mk(tag); e.textContent = t; if (st) e.setAttribute('style', st); return e; };
  const mkids = el => kids(el).filter(k => !/Pr$/.test(k.localName));
  const val = (el, name) => { const p = el && kids(el).find(k => k.localName === name); return p ? (p.getAttributeNS(NS.m, 'val') ?? p.getAttribute('m:val')) : null; };
  const prOf = el => kids(el).find(k => /Pr$/.test(k.localName));
  const sub = (el, name) => kids(el).find(k => k.localName === name && k.namespaceURI === NS.m);
  const row = el => { const r = mk('mrow'); if (el) for (const c of mkids(el)) { const x = conv(c); if (x) r.appendChild(x); } return r; };
  const OPS = '+-−×÷=≠<>≤≥±∓∴∵⇒⇔→←↔∠°%/|:;,!∑∏∫∞≈≡∝∈∉⊂⊃∪∩∧∨¬()[]{}⟨⟩.\'′″';
  function runTokens(r) {
    const rpr = kids(r).find(k => k.localName === 'rPr' && k.namespaceURI === NS.m);
    const nor = rpr && (kids(rpr).some(k => k.localName === 'nor') || val(rpr, 'sty') === 'p');
    const wrpr = kids(r).find(k => isW(k, 'rPr'));
    const font = wrpr ? rFontFn(wrpr) : null;
    let s = ''; for (const t of kids(r)) if (t.localName === 't') s += t.textContent;
    const out = [];
    const re = /([0-9০-৯]+(?:[.,][0-9০-৯]+)*)|([ঀ-৿।॥]+(?:\s+[ঀ-৿।॥]+)*)|(\s+)|([A-Za-z])|(.)/gu;
    let m;
    while ((m = re.exec(s))) {
      const st = font && (m[1] || m[2]) && /[০-৯ঀ-৿]/.test(m[0]) ? `font-family:'${font}','SolaimanLipi','Nirmala UI',serif` : '';
      if (m[1]) out.push(txt('mn', m[1], st));
      else if (m[2]) out.push(txt('mtext', m[2], st));
      else if (m[3]) out.push(txt('mtext', ' '.repeat(Math.min(m[3].length, 3))));
      else if (m[4]) { const e = txt('mi', m[4]); if (nor) e.setAttribute('mathvariant', 'normal'); out.push(e); }
      else if (OPS.includes(m[5]) || /[←-⋿]/.test(m[5])) out.push(txt('mo', m[5]));
      else out.push(txt('mi', m[5]));
    }
    if (out.length === 1) return out[0];
    const r2 = mk('mrow'); out.forEach(o => r2.appendChild(o)); return r2;
  }
  function conv(el) {
    if (el.namespaceURI === NS.w) {
      if (isW(el, 'r')) { const t = plainText(el); return t ? txt('mtext', t) : null; }
      return null;
    }
    switch (el.localName) {
      case 'r': return runTokens(el);
      case 'e': case 'num': case 'den': case 'sub': case 'sup': case 'deg': case 'fName': case 'lim': case 'oMath': return row(el);
      case 'f': {
        const type = val(prOf(el), 'type');
        const n = row(sub(el, 'num')), d = row(sub(el, 'den'));
        if (type === 'lin') return mk('mrow', n, txt('mo', '/'), d);
        const f = mk('mfrac', n, d); if (type === 'noBar') f.setAttribute('linethickness', '0'); if (type === 'skw') f.setAttribute('bevelled', 'true'); return f;
      }
      case 'sSup': return mk('msup', row(sub(el, 'e')), row(sub(el, 'sup')));
      case 'sSub': return mk('msub', row(sub(el, 'e')), row(sub(el, 'sub')));
      case 'sSubSup': return mk('msubsup', row(sub(el, 'e')), row(sub(el, 'sub')), row(sub(el, 'sup')));
      case 'sPre': { const mm = mk('mmultiscripts', row(sub(el, 'e')), mk('mprescripts'), row(sub(el, 'sub')), row(sub(el, 'sup'))); return mm; }
      case 'rad': {
        const hide = val(prOf(el), 'degHide'); const dg = sub(el, 'deg');
        if (hide === '1' || hide === 'on' || hide === 'true' || !dg || !mkids(dg).length) return mk('msqrt', row(sub(el, 'e')));
        return mk('mroot', row(sub(el, 'e')), row(dg));
      }
      case 'd': {
        const pr = prOf(el); const g = (n, d) => { const v = val(pr, n); return v === null ? d : v; };
        const beg = g('begChr', '('), end = g('endChr', ')'), sep = g('sepChr', '|');
        const r = mk('mrow'); if (beg) r.appendChild(txt('mo', beg));
        const es = kids(el).filter(k => k.localName === 'e');
        es.forEach((e, i) => { if (i) r.appendChild(txt('mo', sep)); r.appendChild(row(e)); });
        if (end) r.appendChild(txt('mo', end)); return r;
      }
      case 'nary': {
        const pr = prOf(el); const chr = val(pr, 'chr') || '∫'; const loc = val(pr, 'limLoc');
        const subH = ['1', 'on', 'true'].includes(val(pr, 'subHide')), supH = ['1', 'on', 'true'].includes(val(pr, 'supHide'));
        const op = txt('mo', chr); op.setAttribute('largeop', 'true');
        const s = row(sub(el, 'sub')), p = row(sub(el, 'sup'));
        const under = loc === 'undOvr' || (loc == null && chr !== '∫');
        let base;
        if (subH && supH) base = op; else if (subH) base = mk(under ? 'mover' : 'msup', op, p); else if (supH) base = mk(under ? 'munder' : 'msub', op, s); else base = mk(under ? 'munderover' : 'msubsup', op, s, p);
        return mk('mrow', base, row(sub(el, 'e')));
      }
      case 'func': return mk('mrow', row(sub(el, 'fName')), txt('mo', '⁡'), row(sub(el, 'e')));
      case 'limLow': return mk('munder', row(sub(el, 'e')), row(sub(el, 'lim')));
      case 'limUpp': return mk('mover', row(sub(el, 'e')), row(sub(el, 'lim')));
      case 'acc': { const o = mk('mover', row(sub(el, 'e')), txt('mo', val(prOf(el), 'chr') || '̂')); o.setAttribute('accent', 'true'); return o; }
      case 'bar': { const top = val(prOf(el), 'pos') !== 'bot'; return mk(top ? 'mover' : 'munder', row(sub(el, 'e')), txt('mo', top ? '¯' : '_')); }
      case 'groupChr': { const pr = prOf(el); const top = val(pr, 'pos') === 'top'; return mk(top ? 'mover' : 'munder', row(sub(el, 'e')), txt('mo', val(pr, 'chr') || '⏟')); }
      case 'box': return row(sub(el, 'e'));
      case 'borderBox': { const e = mk('menclose', row(sub(el, 'e'))); e.setAttribute('notation', 'box'); return e; }
      case 'phant': { const show = val(prOf(el), 'show'); const r = row(sub(el, 'e')); return show === '0' || show === 'off' ? mk('mphantom', r) : r; }
      case 'eqArr': { const t = mk('mtable'); for (const e of kids(el).filter(k => k.localName === 'e')) t.appendChild(mk('mtr', mk('mtd', row(e)))); return t; }
      case 'm': { const t = mk('mtable'); for (const mr of kids(el).filter(k => k.localName === 'mr')) { const tr = mk('mtr'); for (const e of kids(mr).filter(k => k.localName === 'e')) tr.appendChild(mk('mtd', row(e))); t.appendChild(tr); } return t; }
      default: { const r = mk('mrow'); for (const c of mkids(el)) { const x = conv(c); if (x) r.appendChild(x); } return r; }
    }
  }
  const math = document.createElementNS(MATHML, 'math');
  math.appendChild(row(node));
  return math;
}

/* ---------- minimal EMF → canvas renderer ---------- */
function emfToDataUrl(u8) {
  try {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (dv.getUint32(0, true) !== 1) return null;
    const bL = dv.getInt32(8, true), bT = dv.getInt32(12, true), bR = dv.getInt32(16, true), bB = dv.getInt32(20, true);
    const W = Math.max(1, bR - bL + 1), H = Math.max(1, bB - bT + 1);
    const SC = Math.min(3, 2400 / Math.max(W, H));
    const cv = document.createElement('canvas'); cv.width = Math.ceil(W * SC); cv.height = Math.ceil(H * SC);
    const ctx = cv.getContext('2d');
    let wOrg = [0, 0], wExt = [1, 1], vOrg = [0, 0], vExt = [1, 1], mapMode = 1, world = [1, 0, 0, 1, 0, 0];
    const objs = {}; let pen = { style: 0, color: '#000', width: 1 }, brush = { style: 0, color: '#fff' }, font = { h: 12, face: 'Arial', weight: 400, italic: 0 };
    let textColor = '#000', textAlign = 0, inPath = false, cur = [0, 0], fillRule = 'evenodd';
    const stack = [];
    const col = v => `rgb(${v & 255},${(v >> 8) & 255},${(v >> 16) & 255})`;
    const tx = (x, y) => {
      const X = world[0] * x + world[2] * y + world[4], Y = world[1] * x + world[3] * y + world[5];
      let dx = X, dy = Y;
      if (mapMode !== 1) { dx = (X - wOrg[0]) * vExt[0] / wExt[0] + vOrg[0]; dy = (Y - wOrg[1]) * vExt[1] / wExt[1] + vOrg[1]; }
      return [(dx - bL) * SC, (dy - bT) * SC];
    };
    const scaleLen = l => { let s = Math.hypot(world[0], world[1]); if (mapMode !== 1) s *= Math.abs(vExt[0] / wExt[0]); return Math.max(SC * 0.6, l * s * SC); };
    const stockObj = i => ({ 0: { b: { style: 0, color: '#fff' } }, 1: { b: { style: 0, color: '#c0c0c0' } }, 2: { b: { style: 0, color: '#808080' } }, 3: { b: { style: 0, color: '#404040' } }, 4: { b: { style: 0, color: '#000' } }, 5: { b: { style: 1 } }, 6: { p: { style: 0, color: '#fff', width: 1 } }, 7: { p: { style: 0, color: '#000', width: 1 } }, 8: { p: { style: 5 } } })[i] || {};
    const applyPen = () => { ctx.strokeStyle = pen.color; ctx.lineWidth = scaleLen(pen.width || 1); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; };
    const doFill = () => brush.style !== 1;
    const doStroke = () => pen.style !== 5;
    const pts16 = (off, n) => { const a = []; for (let i = 0; i < n; i++) a.push(tx(dv.getInt16(off + i * 4, true), dv.getInt16(off + i * 4 + 2, true))); return a; };
    const pts32 = (off, n) => { const a = []; for (let i = 0; i < n; i++) a.push(tx(dv.getInt32(off + i * 8, true), dv.getInt32(off + i * 8 + 4, true))); return a; };
    const begin = () => { if (!inPath) ctx.beginPath(); };
    const finish = (closed, fill) => { if (inPath) return; if (closed) ctx.closePath(); if (fill && doFill()) { ctx.fillStyle = brush.color; ctx.fill(fillRule); } if (doStroke()) { applyPen(); ctx.stroke(); } };
    let off = 0;
    while (off + 8 <= u8.length) {
      const type = dv.getUint32(off, true), size = dv.getUint32(off + 4, true); if (size < 8) break;
      const o = off + 8;
      switch (type) {
        case 9: wExt = [dv.getInt32(o, true), dv.getInt32(o + 4, true)]; break;
        case 10: wOrg = [dv.getInt32(o, true), dv.getInt32(o + 4, true)]; break;
        case 11: vExt = [dv.getInt32(o, true), dv.getInt32(o + 4, true)]; break;
        case 12: vOrg = [dv.getInt32(o, true), dv.getInt32(o + 4, true)]; break;
        case 17: mapMode = dv.getUint32(o, true); break;
        case 19: fillRule = dv.getUint32(o, true) === 2 ? 'nonzero' : 'evenodd'; break;
        case 22: textAlign = dv.getUint32(o, true); break;
        case 24: textColor = col(dv.getUint32(o, true)); break;
        case 27: cur = [dv.getInt32(o, true), dv.getInt32(o + 4, true)]; { const p = tx(...cur); begin(); ctx.moveTo(p[0], p[1]); } break;
        case 54: { const x = dv.getInt32(o, true), y = dv.getInt32(o + 4, true); const p0 = tx(...cur), p = tx(x, y); if (!inPath) { ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); } ctx.lineTo(p[0], p[1]); cur = [x, y]; if (!inPath && doStroke()) { applyPen(); ctx.stroke(); } } break;
        case 33: stack.push({ wOrg, wExt, vOrg, vExt, mapMode, world: [...world], pen, brush, font, textColor, textAlign }); break;
        case 34: { const s = stack.pop(); if (s) ({ wOrg, wExt, vOrg, vExt, mapMode, pen, brush, font, textColor, textAlign } = s, world = s.world); } break;
        case 35: world = [0, 4, 8, 12, 16, 20].map(i => dv.getFloat32(o + i, true)); break;
        case 36: { const m = [0, 4, 8, 12, 16, 20].map(i => dv.getFloat32(o + i, true)); const mode = dv.getUint32(o + 24, true);
          if (mode === 1) world = [1, 0, 0, 1, 0, 0];
          else if (mode === 2) world = [m[0] * world[0] + m[1] * world[2], m[0] * world[1] + m[1] * world[3], m[2] * world[0] + m[3] * world[2], m[2] * world[1] + m[3] * world[3], m[4] * world[0] + m[5] * world[2] + world[4], m[4] * world[1] + m[5] * world[3] + world[5]];
          else if (mode === 3) world = [world[0] * m[0] + world[1] * m[2], world[0] * m[1] + world[1] * m[3], world[2] * m[0] + world[3] * m[2], world[2] * m[1] + world[3] * m[3], world[4] * m[0] + world[5] * m[2] + m[4], world[4] * m[1] + world[5] * m[3] + m[5]];
          else if (mode === 4) world = m; } break;
        case 37: { const h = dv.getUint32(o, true); const ob = h & 0x80000000 ? stockObj(h & 0x7fffffff) : objs[h]; if (ob) { if (ob.p) pen = ob.p; if (ob.b) brush = ob.b; if (ob.f) font = ob.f; } } break;
        case 38: { const ih = dv.getUint32(o, true); objs[ih] = { p: { style: dv.getUint32(o + 4, true) & 0xff, width: dv.getInt32(o + 8, true), color: col(dv.getUint32(o + 16, true)) } }; } break;
        case 95: { const ih = dv.getUint32(o, true); objs[ih] = { p: { style: dv.getUint32(o + 20, true) & 0xff, width: dv.getUint32(o + 24, true), color: col(dv.getUint32(o + 32, true)) } }; } break;
        case 39: { const ih = dv.getUint32(o, true); objs[ih] = { b: { style: dv.getUint32(o + 4, true), color: col(dv.getUint32(o + 8, true)) } }; } break;
        case 82: { const ih = dv.getUint32(o, true); const h = dv.getInt32(o + 4, true); const wt = dv.getInt32(o + 20, true); const it = u8[o + 24];
          let face = ''; for (let i = 0; i < 32; i++) { const c = dv.getUint16(o + 32 + i * 2, true); if (!c) break; face += String.fromCharCode(c); } objs[ih] = { f: { h: Math.abs(h), face: face || 'Arial', weight: wt, italic: it } }; } break;
        case 40: delete objs[dv.getUint32(o, true)]; break;
        case 59: inPath = true; ctx.beginPath(); break;
        case 60: inPath = false; break;
        case 61: ctx.closePath(); break;
        case 62: if (doFill()) { ctx.fillStyle = brush.color; ctx.fill(fillRule); } break;
        case 63: if (doFill()) { ctx.fillStyle = brush.color; ctx.fill(fillRule); } if (doStroke()) { applyPen(); ctx.stroke(); } break;
        case 64: if (doStroke()) { applyPen(); ctx.stroke(); } break;
        case 42: case 43: { const l = dv.getInt32(o, true), t = dv.getInt32(o + 4, true), r = dv.getInt32(o + 8, true), b = dv.getInt32(o + 12, true); const a = tx(l, t), c = tx(r, b);
          begin(); if (type === 43) ctx.rect(a[0], a[1], c[0] - a[0], c[1] - a[1]); else ctx.ellipse((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, Math.abs(c[0] - a[0]) / 2, Math.abs(c[1] - a[1]) / 2, 0, 0, Math.PI * 2); finish(false, true); } break;
        case 85: case 88: case 86: case 87: case 89: case 2: case 3: case 4: case 5: case 6: {
          const is16 = type >= 85; const n = dv.getUint32(o + 16, true); const P = is16 ? pts16(o + 20, n) : pts32(o + 20, n);
          const bez = type === 85 || type === 88 || type === 2 || type === 5; const to = type === 88 || type === 89 || type === 5 || type === 6;
          let i = 0;
          if (to) { if (!inPath) { ctx.beginPath(); const c = tx(...cur); ctx.moveTo(c[0], c[1]); } }
          else { begin(); ctx.moveTo(P[0][0], P[0][1]); i = 1; }
          if (bez) for (; i + 2 < P.length + (to ? 0 : 0); i += 3) ctx.bezierCurveTo(P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], P[i + 2][0], P[i + 2][1]);
          else for (; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
          if (to && n) { const lo = is16 ? o + 20 + (n - 1) * 4 : o + 20 + (n - 1) * 8; cur = is16 ? [dv.getInt16(lo, true), dv.getInt16(lo + 2, true)] : [dv.getInt32(lo, true), dv.getInt32(lo + 4, true)]; }
          if (!to) finish(type === 86 || type === 3, type === 86 || type === 3); else if (!inPath && doStroke()) { applyPen(); ctx.stroke(); }
        } break;
        case 90: case 91: case 7: case 8: {
          const is16 = type >= 90; const np = dv.getUint32(o + 16, true); const cnt = dv.getUint32(o + 20, true);
          const counts = []; for (let i = 0; i < np; i++) counts.push(dv.getUint32(o + 24 + i * 4, true));
          const P = is16 ? pts16(o + 24 + np * 4, cnt) : pts32(o + 24 + np * 4, cnt);
          begin(); let k = 0; for (const c of counts) { ctx.moveTo(P[k][0], P[k][1]); for (let i = 1; i < c; i++) ctx.lineTo(P[k + i][0], P[k + i][1]); if (type === 91 || type === 8) ctx.closePath(); k += c; }
          finish(false, type === 91 || type === 8);
        } break;
        case 84: {
          const rx = dv.getInt32(o + 28, true), ry = dv.getInt32(o + 32, true), nCh = dv.getUint32(o + 36, true), offS = dv.getUint32(o + 40, true);
          let s = ''; for (let i = 0; i < nCh; i++) s += String.fromCharCode(dv.getUint16(off + offS + i * 2, true));
          const p = tx(rx, ry); const fh = scaleLen(font.h || 12);
          ctx.font = `${font.italic ? 'italic ' : ''}${font.weight >= 600 ? 'bold ' : ''}${fh}px '${font.face}', 'SolaimanLipi', 'Nirmala UI', sans-serif`;
          ctx.fillStyle = textColor;
          ctx.textAlign = (textAlign & 6) === 6 ? 'center' : (textAlign & 2) ? 'right' : 'left';
          ctx.textBaseline = (textAlign & 24) === 24 ? 'alphabetic' : (textAlign & 8) ? 'bottom' : 'top';
          ctx.fillText(s, p[0], p[1]);
        } break;
        case 81: { // STRETCHDIBITS
          try {
            const xD = dv.getInt32(o + 16, true), yD = dv.getInt32(o + 20, true), offBmi = dv.getUint32(o + 40, true), offBits = dv.getUint32(o + 48, true), cxD = dv.getInt32(o + 64, true), cyD = dv.getInt32(o + 68, true);
            const bw = dv.getInt32(off + offBmi + 4, true), bh = dv.getInt32(off + offBmi + 8, true), bpp = dv.getUint16(off + offBmi + 14, true);
            if (bpp === 24 || bpp === 32) {
              const id = ctx.createImageData(bw, Math.abs(bh)); const stride = Math.ceil(bw * bpp / 32) * 4;
              for (let y = 0; y < Math.abs(bh); y++) for (let x = 0; x < bw; x++) { const sy = bh > 0 ? Math.abs(bh) - 1 - y : y; const si = off + offBits + sy * stride + x * (bpp / 8); const di = (y * bw + x) * 4; id.data[di] = u8[si + 2]; id.data[di + 1] = u8[si + 1]; id.data[di + 2] = u8[si]; id.data[di + 3] = 255; }
              const tmp = document.createElement('canvas'); tmp.width = bw; tmp.height = Math.abs(bh); tmp.getContext('2d').putImageData(id, 0, 0);
              const a = tx(xD, yD), c = tx(xD + cxD, yD + cyD); ctx.drawImage(tmp, a[0], a[1], c[0] - a[0], c[1] - a[1]);
            }
          } catch (_) { }
        } break;
        case 14: off = u8.length; continue;
      }
      off += size;
    }
    return cv.toDataURL('image/png');
  } catch (e) { console.warn('EMF render failed', e); return null; }
}

/* ---------- style resolution ---------- */
class DocxModel {
  static async open(blob) {
    const z = await readZip(await blob.arrayBuffer());
    const M = new DocxModel(); M.zip = z;
    const P = s => new DOMParser().parseFromString(s, 'application/xml');
    M.doc = P(await z.text('word/document.xml'));
    M.stylesDoc = P(await z.text('word/styles.xml') || '<w:styles xmlns:w="' + NS.w + '"/>');
    const th = await z.text('word/theme/theme1.xml');
    M.themeFonts = { minor: 'Calibri', major: 'Calibri Light' };
    if (th) { const mn = th.match(/<a:minorFont>\s*<a:latin typeface="([^"]*)"/), mj = th.match(/<a:majorFont>\s*<a:latin typeface="([^"]*)"/); if (mn) M.themeFonts.minor = mn[1]; if (mj) M.themeFonts.major = mj[1]; }
    const nx = await z.text('word/numbering.xml'); M.numDoc = nx ? P(nx) : null;
    M.rels = {};
    const rx = await z.text('word/_rels/document.xml.rels');
    if (rx) for (const r of q(P(rx), NS.rel, 'Relationship')) M.rels[r.getAttribute('Id')] = r.getAttribute('Target');
    M.styles = {}; M.defP = null; M.defT = null;
    for (const s of q(M.stylesDoc, NS.w, 'style')) { const id = s.getAttributeNS(NS.w, 'styleId'); M.styles[id] = s; if (s.getAttributeNS(NS.w, 'default') === '1') { const t = s.getAttributeNS(NS.w, 'type'); if (t === 'paragraph') M.defP = id; if (t === 'table') M.defT = id; } }
    const dd = q(M.stylesDoc, NS.w, 'docDefaults')[0];
    M.docR = dd ? M.readR(q(dd, NS.w, 'rPr')[0]) : {};
    M.docP = dd ? M.readP(q(dd, NS.w, 'pPr')[0]) : {};
    M.media = {}; M.cacheP = {}; M.cacheR = {};
    return M;
  }
  async mediaUrl(rid) {
    if (this.media[rid] !== undefined) return this.media[rid];
    const t = this.rels[rid]; if (!t) return (this.media[rid] = null);
    const path = t.startsWith('/') ? t.slice(1) : 'word/' + t;
    const b = await this.zip.bytes(path); if (!b) return (this.media[rid] = null);
    const ext = path.split('.').pop().toLowerCase();
    if (ext === 'emf') return (this.media[rid] = emfToDataUrl(b));
    if (ext === 'wmf') return (this.media[rid] = null);
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml' }[ext] || 'application/octet-stream';
    return (this.media[rid] = URL.createObjectURL(new Blob([b], { type: mime })));
  }
  onOff(el) { if (!el) return undefined; const v = el.getAttributeNS(NS.w, 'val'); return !(v === '0' || v === 'false' || v === 'off' || v === 'none'); }
  readR(rpr) {
    const r = {}; if (!rpr) return r;
    for (const k of kids(rpr)) {
      const n = k.localName, v = k.getAttributeNS(NS.w, 'val');
      if (n === 'rFonts') {
        const f = a => k.getAttributeNS(NS.w, a);
        const th = a => { const t = f(a + 'Theme'); return t ? (/minor/.test(t) ? this.themeFonts?.minor : this.themeFonts?.major) : null; };
        if (f('ascii') || th('ascii')) r.fA = f('ascii') || th('ascii');
        if (f('hAnsi') || th('hAnsi')) r.fH = f('hAnsi') || th('hAnsi');
        if (f('cs') || th('cs')) r.fC = f('cs') || th('cs');
      }
      else if (n === 'sz') r.sz = +v; else if (n === 'szCs') r.szCs = +v;
      else if (n === 'b') r.b = this.onOff(k); else if (n === 'bCs') r.bCs = this.onOff(k);
      else if (n === 'i') r.i = this.onOff(k); else if (n === 'iCs') r.iCs = this.onOff(k);
      else if (n === 'u') r.u = v && v !== 'none'; else if (n === 'strike') r.strike = this.onOff(k);
      else if (n === 'color') r.color = v; else if (n === 'highlight') r.hl = v;
      else if (n === 'vertAlign') r.va = v; else if (n === 'caps') r.caps = this.onOff(k); else if (n === 'vanish') r.hidden = this.onOff(k);
      else if (n === 'shd') { const f = k.getAttributeNS(NS.w, 'fill'); if (f && f !== 'auto') r.shd = f; }
      else if (n === 'position') r.pos = +v; else if (n === 'rStyle') r.rStyle = v;
    }
    return r;
  }
  readP(ppr) {
    const p = {}; if (!ppr) return p;
    for (const k of kids(ppr)) {
      const n = k.localName, a = x => k.getAttributeNS(NS.w, x);
      if (n === 'jc') p.jc = a('val');
      else if (n === 'ind') { if (a('left') || a('start')) p.left = +(a('left') || a('start')); if (a('right') || a('end')) p.right = +(a('right') || a('end')); if (a('hanging')) { p.hanging = +a('hanging'); p.firstLine = 0; } if (a('firstLine')) { p.firstLine = +a('firstLine'); p.hanging = 0; } }
      else if (n === 'spacing') { if (a('before')) p.before = +a('before'); if (a('after')) p.after = +a('after'); if (a('line')) { p.line = +a('line'); p.lineRule = a('lineRule') || 'auto'; } if (a('beforeAutospacing') === '1') p.before = 280; if (a('afterAutospacing') === '1') p.after = 280; }
      else if (n === 'tabs') p.tabs = kids(k).map(t => ({ val: t.getAttributeNS(NS.w, 'val'), pos: +t.getAttributeNS(NS.w, 'pos') }));
      else if (n === 'keepNext') p.keepNext = this.onOff(k);
      else if (n === 'shd') { const f = a('fill'); if (f && f !== 'auto') p.shd = f; }
      else if (n === 'pStyle') p.pStyle = a('val');
      else if (n === 'numPr') { const il = kids(k).find(x => isW(x, 'ilvl')), id = kids(k).find(x => isW(x, 'numId')); p.num = { ilvl: il ? +il.getAttributeNS(NS.w, 'val') : 0, id: id ? id.getAttributeNS(NS.w, 'val') : null }; }
      else if (n === 'rPr') p.markR = this.readR(k);
      else if (n === 'pBdr') p.bdr = true;
    }
    return p;
  }
  mergeP(a, b) { const o = { ...a, ...b }; if (a.tabs || b.tabs) { const m = new Map(); for (const t of (a.tabs || [])) m.set(t.pos, t); for (const t of (b.tabs || [])) { if (t.val === 'clear') m.delete(t.pos); else m.set(t.pos, t); } o.tabs = [...m.values()].filter(t => t.val !== 'clear').sort((x, y) => x.pos - y.pos); } return o; }
  styleChain(id, kind) {
    const key = kind + ':' + id; const cache = kind === 'p' ? this.cacheP : this.cacheR; if (cache[key]) return cache[key];
    const s = this.styles[id]; if (!s) return (cache[key] = { p: {}, r: {} });
    const based = kids(s).find(k => isW(k, 'basedOn'));
    const parent = based ? this.styleChain(based.getAttributeNS(NS.w, 'val'), kind) : { p: {}, r: {} };
    const res = { p: this.mergeP(parent.p, this.readP(kids(s).find(k => isW(k, 'pPr')))), r: { ...parent.r, ...this.readR(kids(s).find(k => isW(k, 'rPr'))) } };
    return (cache[key] = res);
  }
  paraProps(p) {
    const direct = this.readP(kids(p).find(k => isW(k, 'pPr')));
    const sid = direct.pStyle || this.defP; const st = sid ? this.styleChain(sid, 'p') : { p: {}, r: {} };
    const pp = this.mergeP(this.mergeP(this.docP, st.p), direct);
    return { pp, baseR: { ...this.docR, ...st.r } };
  }
  runProps(baseR, rpr) { const d = this.readR(rpr); const rs = d.rStyle ? this.styleChain(d.rStyle, 'r').r : {}; return { ...baseR, ...rs, ...d }; }
  numText(num) {
    if (!this.numDoc || !num || !num.id) return null;
    const n = q(this.numDoc, NS.w, 'num').find(x => x.getAttributeNS(NS.w, 'numId') === num.id); if (!n) return null;
    const aid = kids(n).find(k => isW(k, 'abstractNumId'))?.getAttributeNS(NS.w, 'val');
    const an = q(this.numDoc, NS.w, 'abstractNum').find(x => x.getAttributeNS(NS.w, 'abstractNumId') === aid); if (!an) return null;
    const lvl = kids(an).find(k => isW(k, 'lvl') && +k.getAttributeNS(NS.w, 'ilvl') === num.ilvl); if (!lvl) return null;
    const fmt = kids(lvl).find(k => isW(k, 'numFmt'))?.getAttributeNS(NS.w, 'val'); const txtT = kids(lvl).find(k => isW(k, 'lvlText'))?.getAttributeNS(NS.w, 'val') || '';
    this.counters = this.counters || {}; const key = num.id + ':' + num.ilvl; this.counters[key] = (this.counters[key] || 0) + 1;
    const c = this.counters[key];
    const BN = s => String(s).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
    const v = fmt === 'bullet' ? '•' : fmt === 'lowerLetter' ? String.fromCharCode(96 + c) : fmt === 'upperLetter' ? String.fromCharCode(64 + c) : fmt === 'lowerRoman' ? ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'][c - 1] : fmt === 'upperRoman' ? ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][c - 1] : fmt === 'bengali' || fmt === 'hindiNumbers' ? BN(c) : String(c);
    const ind = kids(lvl).find(k => isW(k, 'pPr')); const li = ind ? this.readP(ind) : {};
    return { text: fmt === 'bullet' ? (txtT && txtT.length === 1 && txtT.charCodeAt(0) > 0xF000 ? '•' : txtT || '•') : txtT.replace(/%\d/g, v), ind: li };
  }
}

/* ---------- render body to blocks ---------- */
class DocxRenderer {
  constructor(model) { this.M = model; }
  font(r, bn) { const f = bn ? (r.fC || r.fA) : (r.fA || r.fH); return bn ? `'${f || 'SolaimanLipi'}','SolaimanLipi','Nirmala UI','Hind Siliguri','Vrinda',serif` : `'${f || 'Times New Roman'}','Times New Roman',serif`; }
  spanStyle(r, bn) {
    const sz = (bn ? (r.szCs || r.sz) : r.sz) || 22; const b = bn ? (r.bCs ?? r.b) : r.b; const i = bn ? (r.iCs ?? r.i) : r.i;
    let s = `font-family:${this.font(r, bn)};font-size:${sz / 2}pt;`;
    if (b) s += 'font-weight:bold;'; if (i) s += 'font-style:italic;';
    const deco = [r.u && 'underline', r.strike && 'line-through'].filter(Boolean).join(' '); if (deco) s += `text-decoration:${deco};`;
    if (r.color && r.color !== 'auto') s += `color:#${r.color};`;
    const HL = { yellow: '#ff0', green: '#0f0', cyan: '#0ff', magenta: '#f0f', blue: '#00f', red: '#f00', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000', white: '#fff', darkYellow: '#808000' };
    if (r.hl && HL[r.hl]) s += `background:${HL[r.hl]};`; else if (r.shd) s += `background:#${r.shd};`;
    if (r.va === 'superscript') s += 'vertical-align:super;font-size:' + (sz / 2 * 0.65) + 'pt;'; else if (r.va === 'subscript') s += 'vertical-align:sub;font-size:' + (sz / 2 * 0.65) + 'pt;';
    if (r.caps) s += 'text-transform:uppercase;';
    if (r.pos) s += `position:relative;top:${-r.pos / 2}pt;`;
    return s;
  }
  textSpans(text, r, out) {
    const parts = text.split(/([ঀ-৿।॥]+(?:[\s ]+[ঀ-৿।॥]+)*)/);
    for (const part of parts) { if (!part) continue; const sp = document.createElement('span'); sp.setAttribute('style', this.spanStyle(r, BN_RE.test(part))); sp.textContent = part; out.push(sp); }
  }
  async drawingEl(d) {
    const blip = q(d, NS.a, 'blip')[0];
    const ext = q(d, NS.wp, 'extent')[0];
    const w = ext ? +ext.getAttribute('cx') * EMU2PX : 100, h = ext ? +ext.getAttribute('cy') * EMU2PX : 100;
    if (blip) {
      const rid = blip.getAttributeNS(NS.r, 'embed'); const url = rid && await this.M.mediaUrl(rid);
      const img = document.createElement('img'); if (url) img.src = url; img.style.cssText = `width:${w}px;height:${h}px;vertical-align:${q(d, NS.wp, 'anchor').length ? 'top' : 'baseline'}`;
      if (!url) { img.alt = '[ছবি]'; img.style.outline = '1px dashed #aaa'; }
      return img;
    }
    // shape with text box
    const txbx = q(d, 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape', 'txbx')[0];
    if (txbx) { const div = document.createElement('div'); div.style.cssText = `display:inline-block;width:${w}px;min-height:${h}px;border:1px solid #333;vertical-align:top;padding:2px`; for (const p of q(txbx, NS.w, 'p')) for (const b of await this.para(p)) div.appendChild(b); return div; }
    const sp = document.createElement('span'); sp.style.cssText = `display:inline-block;width:${w}px;height:${h}px`; return sp;
  }
  async vmlEl(pict) {
    const im = q(pict, NS.v, 'imagedata')[0]; const shape = q(pict, NS.v, 'shape')[0];
    const st = shape ? shape.getAttribute('style') || '' : '';
    const w = (st.match(/width:([\d.]+)pt/) || [])[1], h = (st.match(/height:([\d.]+)pt/) || [])[1];
    if (im) { const rid = im.getAttributeNS(NS.r, 'id'); const url = rid && await this.M.mediaUrl(rid); const img = document.createElement('img'); if (url) img.src = url; img.style.cssText = `${w ? `width:${w}pt;` : ''}${h ? `height:${h}pt;` : ''}vertical-align:middle`; return img; }
    return null;
  }
  async inline(node, baseR, out) {
    let skipTabs = false; // Word lays out tabs that follow an equation ending in a manual break with no width
    for (const c of kids(node)) {
      if (skipTabs) { if (isW(c, 'r') && kids(c).every(k => isW(k, 'tab') || isW(k, 'rPr'))) { this.textSpans(' ', baseR, out); continue; } skipTabs = false; }
      if (isEl(c, NS.m, 'oMath') && q(c, NS.w, 'br').length) skipTabs = true;
      if (isW(c, 'r')) {
        const r = this.M.runProps(baseR, kids(c).find(k => isW(k, 'rPr')));
        if (r.hidden) continue;
        for (const k of kids(c)) {
          if (isW(k, 't')) this.textSpans(k.textContent, r, out);
          else if (isW(k, 'tab')) { const t = document.createElement('span'); t.className = 'tab'; t.style.fontSize = ((r.sz || 22) / 2) + 'pt'; out.push(t); }
          else if (isW(k, 'br') || isW(k, 'cr')) out.push(document.createElement('br'));
          else if (isW(k, 'sym')) { const ch = parseInt(k.getAttributeNS(NS.w, 'char'), 16); const s = document.createElement('span'); s.style.fontFamily = `'${k.getAttributeNS(NS.w, 'font')}',Symbol`; s.textContent = String.fromCharCode(ch >= 0xF000 ? ch - 0xF000 : ch); out.push(s); }
          else if (isW(k, 'drawing')) out.push(await this.drawingEl(k));
          else if (isW(k, 'pict') || isW(k, 'object')) { const v = await this.vmlEl(k); if (v) out.push(v); }
          else if (k.localName === 'AlternateContent') { const ch = kids(k).find(x => x.localName === 'Choice'); const fb = kids(k).find(x => x.localName === 'Fallback'); const dr = ch && q(ch, NS.w, 'drawing')[0]; if (dr && q(dr, NS.a, 'blip').length) out.push(await this.drawingEl(dr)); else if (fb && q(fb, NS.v, 'imagedata').length) { const v = await this.vmlEl(fb); if (v) out.push(v); } else if (dr) out.push(await this.drawingEl(dr)); }
          else if (isW(k, 'noBreakHyphen')) this.textSpans('-', r, out);
        }
      } else if (isEl(c, NS.m, 'oMath')) { const m = ommlToMathml(c, rp => { const r = this.M.readR(rp); return r.fC || r.fA; }); m.style.fontSize = ((baseR.sz || 22) / 2) + 'pt'; out.push(m); }
      else if (isEl(c, NS.m, 'oMathPara')) { for (const om of q(c, NS.m, 'oMath')) { const m = ommlToMathml(om, rp => { const r = this.M.readR(rp); return r.fC || r.fA; }); m.setAttribute('display', 'block'); m.style.fontSize = ((baseR.sz || 22) / 2) + 'pt'; out.push(m); } }
      else if (isW(c, 'hyperlink') || isW(c, 'fldSimple') || isW(c, 'smartTag') || isW(c, 'ins') || isW(c, 'sdtContent')) await this.inline(c, baseR, out);
      else if (isW(c, 'sdt')) { const sc = kids(c).find(k => isW(k, 'sdtContent')); if (sc) await this.inline(sc, baseR, out); }
    }
  }
  /* returns an array of block divs (a paragraph is split at line breaks so it can flow over pages) */
  async para(p) {
    const { pp, baseR } = this.M.paraProps(p);
    const markR = { ...baseR, ...(pp.markR || {}) };
    let left = pp.left || 0, hanging = pp.hanging || 0, firstLine = pp.firstLine || 0;
    let numSpan = null;
    if (pp.num) { const nt = this.M.numText(pp.num); if (nt) { if (nt.ind.left != null && pp.left == null) left = nt.ind.left; if (nt.ind.hanging != null && pp.hanging == null) hanging = nt.ind.hanging; numSpan = nt.text; } }
    const out = [];
    if (numSpan) { this.textSpans(numSpan, markR, out); const t = document.createElement('span'); t.className = 'tab'; out.push(t); }
    await this.inline(p, baseR, out);
    // split at <br>
    const lines = [[]]; for (const n of out) { if (n.tagName === 'BR') lines.push([]); else lines[lines.length - 1].push(n); }
    const tabs = (pp.tabs || []).map(t => ({ val: t.val, pos: t.pos * TW2PX }));
    if (hanging) tabs.push({ val: 'left', pos: left * TW2PX, implicit: true });
    tabs.sort((a, b) => a.pos - b.pos);
    const lineH = pp.lineRule === 'exact' ? `${pp.line / 20}pt` : pp.lineRule === 'atLeast' ? `max(${pp.line / 20}pt, 1.2em)` : String(((pp.line || 240) / 240) * 1.22);
    const fs = ((markR.szCs || markR.sz || 22) / 2);
    const blocks = [];
    lines.forEach((ln, i) => {
      const d = document.createElement('div'); d.className = 'p';
      const isFirst = i === 0, isLast = i === lines.length - 1;
      d.style.cssText = `padding-left:${left * TW2PX}px;padding-right:${Math.max(0, pp.right || 0) * TW2PX}px;text-indent:${isFirst ? ((firstLine - hanging) * TW2PX) : 0}px;padding-top:${isFirst ? (pp.before || 0) / 20 : 0}pt;padding-bottom:${isLast ? (pp.after || 0) / 20 : 0}pt;line-height:${lineH};font-size:${fs}pt;text-align:${({ both: 'justify', center: 'center', right: 'right', end: 'right', distribute: 'justify' })[pp.jc] || 'left'};${pp.shd ? `background:#${pp.shd};` : ''}`;
      d.dataset.tabs = JSON.stringify(tabs);
      if (!ln.length) d.innerHTML = '&#8203;'; else ln.forEach(n => d.appendChild(n));
      if (pp.keepNext) d.dataset.keep = '1';
      blocks.push(d);
    });
    return blocks;
  }
  async table(tbl) {
    const t = document.createElement('table'); t.className = 'tbl';
    const tblPr = kids(tbl).find(k => isW(k, 'tblPr'));
    const sid = tblPr && kids(tblPr).find(k => isW(k, 'tblStyle'))?.getAttributeNS(NS.w, 'val');
    const sty = sid && this.M.styles[sid];
    const bAny = el => el && q(el, NS.w, 'tblBorders').some(b => kids(b).some(x => !['nil', 'none'].includes(x.getAttributeNS(NS.w, 'val'))));
    const borders = bAny(tblPr) || bAny(sty);
    const grid = q(tbl, NS.w, 'gridCol').map(g => +g.getAttributeNS(NS.w, 'w') * TW2PX);
    const jc = tblPr && kids(tblPr).find(k => isW(k, 'jc'))?.getAttributeNS(NS.w, 'val');
    t.style.cssText = `border-collapse:collapse;${jc === 'center' ? 'margin:0 auto;' : ''}`;
    const rows = kids(tbl).filter(k => isW(k, 'tr'));
    const vm = []; // track vertical merges
    for (const [ri, tr] of rows.entries()) {
      const r = document.createElement('tr'); let col = 0;
      for (const tc of kids(tr).filter(k => isW(k, 'tc'))) {
        const tcPr = kids(tc).find(k => isW(k, 'tcPr'));
        const span = +(tcPr && kids(tcPr).find(k => isW(k, 'gridSpan'))?.getAttributeNS(NS.w, 'val') || 1);
        const vmEl = tcPr && kids(tcPr).find(k => isW(k, 'vMerge'));
        if (vmEl && vmEl.getAttributeNS(NS.w, 'val') !== 'restart') { const top = vm[col]; if (top) top.rowSpan++; col += span; continue; }
        const td = document.createElement('td'); if (span > 1) td.colSpan = span;
        if (vmEl) vm[col] = td; else vm[col] = null;
        const w = grid.slice(col, col + span).reduce((a, b) => a + b, 0); if (w) td.style.width = w + 'px';
        td.style.cssText += `padding:1px 6px;vertical-align:${tcPr && kids(tcPr).find(k => isW(k, 'vAlign'))?.getAttributeNS(NS.w, 'val') === 'center' ? 'middle' : 'top'};${borders ? 'border:1px solid #000;' : ''}`;
        const shd = tcPr && kids(tcPr).find(k => isW(k, 'shd'))?.getAttributeNS(NS.w, 'fill'); if (shd && shd !== 'auto') td.style.background = '#' + shd;
        for (const c of kids(tc)) { if (isW(c, 'p')) for (const b of await this.para(c)) td.appendChild(b); else if (isW(c, 'tbl')) td.appendChild(await this.table(c)); }
        r.appendChild(td); col += span;
      }
      t.appendChild(r);
    }
    const wrap = document.createElement('div'); wrap.className = 'p'; wrap.appendChild(t); return wrap;
  }
}

/* lay out tab stops inside a block that is already in the DOM */
function layoutTabs(block) {
  const tabsEls = block.querySelectorAll(':scope > .tab');
  if (!tabsEls.length) return;
  const stops = JSON.parse(block.dataset.tabs || '[]');
  const def = 720 * TW2PX;
  const base = block.getBoundingClientRect().left;
  for (const t of tabsEls) {
    t.style.display = 'inline-block'; t.style.width = '0px';
    const x = t.getBoundingClientRect().left - base;
    let stop = stops.find(s => s.pos > x + 1 && s.val !== 'clear' && s.val !== 'bar');
    if (!stop) stop = { val: 'left', pos: (Math.floor(x / def) + 1) * def };
    let w = stop.pos - x;
    if (stop.val === 'right' || stop.val === 'center' || stop.val === 'end') {
      let segW = 0; let n = t.nextSibling;
      while (n && !(n.classList && n.classList.contains('tab'))) { if (n.getBoundingClientRect) segW += n.getBoundingClientRect().width; n = n.nextSibling; }
      w = stop.val === 'center' ? stop.pos - segW / 2 - x : stop.pos - segW - x;
    }
    t.style.width = Math.max(2, w) + 'px';
  }
}

/* build print-ready pages */
async function renderC5Pages(blob, opt) {
  const M = await DocxModel.open(blob);
  const R = new DocxRenderer(M);
  const body = M.doc.getElementsByTagNameNS(NS.w, 'body')[0];
  const root = opt.root; root.innerHTML = '';
  const P = C5_PAGE; const pageW = P.w * TW2PX, pageH = P.h * TW2PX, cw = (P.w - P.left - P.right) * TW2PX, ch = (P.h - P.top - P.bottom) * TW2PX;
  const measure = document.createElement('div'); measure.className = 'c5body'; measure.style.cssText = `position:absolute;left:-20000px;top:0;width:${cw}px`;
  document.body.appendChild(measure);
  const blocks = [];
  for (const el of kids(body)) {
    if (isW(el, 'p')) {
      const names = q(el, NS.wp, 'docPr').map(d => d.getAttribute('name'));
      if (names.includes('TIS-C5-CoverFront') || names.includes('TIS-C5-CoverBack')) { blocks.push({ cover: names.includes('TIS-C5-CoverFront') ? 'front' : 'back' }); continue; }
      const pp = kids(el).find(k => isW(k, 'pPr')); if (pp && kids(pp).some(k => isW(k, 'sectPr')) && !plainText(el).trim()) continue;
      for (const b of await R.para(el)) { measure.appendChild(b); blocks.push({ el: b }); }
    } else if (isW(el, 'tbl')) { const t = await R.table(el); measure.appendChild(t); blocks.push({ el: t }); }
  }
  // images must be loaded before measuring
  await Promise.all([...measure.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  for (const b of blocks) if (b.el) { layoutTabs(b.el); b.el.querySelectorAll('.p').forEach(layoutTabs); }
  for (const b of blocks) if (b.el) b.h = b.el.getBoundingClientRect().height;
  // paginate
  const pages = []; let cur = null, used = 0, pageNo = 0;
  const newPage = (kind) => {
    const pg = document.createElement('div'); pg.className = 'c5page'; pg.style.cssText = `width:${pageW}px;height:${pageH}px`;
    if (kind === 'content') {
      pageNo++;
      pg.innerHTML = `<img class="hbg" src="${opt.headerUrl}" style="top:${0.5 * 96}px"><div class="htxt ${opt.lang}" style="top:${0.5 * 96}px;height:${opt.headerH}px"><span class="l" style="font-size:${(opt.S.hSzL || 24) / 2}pt">${esc(opt.S.hLeft)}</span><span class="r" style="font-size:${(opt.S.hSzR || 24) / 2}pt">${esc(opt.S.hRight)}</span></div>
        <img class="fbg" src="${opt.footerUrl}" style="top:${10.24 * 96}px"><div class="ftxt ${opt.lang} ${opt.S.footerMode}" style="top:${10.24 * 96}px;height:${opt.footerH}px">${opt.S.footerMode === 'custom' ? `<span class="l">${esc(opt.S.fLeft)}</span><span class="r">${esc(opt.S.fRight)}</span>` : ''}<span class="n">${opt.lang === 'BV' ? bnDigits(pageNo) : pageNo}</span></div>`;
      const bd = document.createElement('div'); bd.className = 'c5body'; bd.style.cssText = `left:${P.left * TW2PX}px;top:${P.top * TW2PX}px;width:${cw}px`; pg.appendChild(bd); pg._body = bd;
    }
    root.appendChild(pg); pages.push(pg); return pg;
  };
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.cover) { const pg = newPage('cover'); const src = b.cover === 'front' ? opt.coverFrontUrl : opt.coverBackUrl; if (src) pg.innerHTML = `<img src="${src}" style="width:100%;height:100%;display:block">`; cur = null; continue; }
    let need = b.h;
    if (b.el.dataset.keep && blocks[i + 1] && blocks[i + 1].el) need += Math.min(blocks[i + 1].h, ch / 3);
    if (!cur || (used + need > ch && used > 0)) { cur = newPage('content'); used = 0; }
    cur._body.appendChild(b.el); used += b.h;
  }
  measure.remove();
  return { pages: pages.length };
}
const bnDigits = s => String(s).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
