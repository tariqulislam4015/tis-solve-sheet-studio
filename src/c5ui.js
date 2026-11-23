/* ===================== Class 5 partition — UI ===================== */
(() => {
  const A = window.C5_ASSETS || {};
  const LS = 'tis.c5.settings.v1';
  const DEF = {
    BV: { hLeft: 'প্রাথমিক বৃত্তি প্রশ্নব্যাংক ও মডেল টেস্ট-২০২৬', hRight: 'সলভ শীট: ফাইনাল মডেল টেস্ট-গণিত', b1: 'প্রাথমিক', b2: 'বৃত্তি পরীক্ষা', b3: '২০২৬', title: 'সলভ শীট: ফাইনাল মডেল টেস্ট-গণিত', ribTop: 'Written', ans: 'নমুনা উত্তর', footerMode: 'original', fLeft: 'উদ্ভাস একাডেমিক এন্ড এডমিশন কেয়ার', fRight: 'পরিবর্তনের প্রত্যয়ে নিরন্তর পথচলা...', coverF: 'default', coverB: 'default', out: 'PEC_FMT_Math_BV.docx' },
    EV: { hLeft: 'Primary Scholarship Question Bank & Model Test-2026', hRight: 'Solve Sheet: Final Model Test-Math', b1: 'Primary', b2: 'Scholarship', b3: 'Exam-2026', title: 'Solve Sheet: Final Model Test-Math', ribTop: 'Written', ans: 'Sample Answer', footerMode: 'original', fLeft: 'UDVASH Academic & Admission Care', fRight: 'পরিবর্তনের প্রত্যয়ে নিরন্তর পথচলা...', coverF: 'default', coverB: 'default', out: 'PEC_FMT_Math_EV.docx' },
  };
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (_) { }
  const st = {
    BV: { files: Array(10).fill(null), S: { ...DEF.BV, ...(saved.BV || {}) }, custom: {} },
    EV: { files: Array(10).fill(null), S: { ...DEF.EV, ...(saved.EV || {}) }, custom: {} },
  };
  let fileSeq = 1000;
  const save = () => { try { localStorage.setItem(LS, JSON.stringify({ BV: st.BV.S, EV: st.EV.S })); } catch (_) { } };
  const $ = s => document.querySelector(s);
  document.body.appendChild(document.querySelector('#c5print')); // must be a direct child of <body> for printing
  const clog = (m, c) => { const d = document.createElement('div'); if (c) d.className = c; d.textContent = m; $('#c5log').prepend(d); };

  /* ---------- mode switch ---------- */
  document.querySelectorAll('.mode').forEach(b => b.onclick = () => {
    document.querySelectorAll('.mode').forEach(x => x.classList.toggle('on', x === b));
    $('#modeEAP').hidden = b.dataset.mode !== 'eap'; $('#modeC5').hidden = b.dataset.mode !== 'c5';
    if (b.dataset.mode === 'c5') drawPreviews();
  });

  /* ---------- files ---------- */
  async function addFiles(list, forceLang, slot) {
    for (const f of list) {
      if (!/\.docx$/i.test(f.name)) { clog(`⚠ ${f.name} — শুধু .docx`, 'bad'); continue; }
      try {
        const src = await parseC5(f, ++fileSeq);
        const lang = forceLang || src.meta.lang;
        const g = st[lang];
        let i = slot != null && !g.files[slot] ? slot : g.files.findIndex(x => !x);
        if (i < 0) { clog(`⚠ ${lang} গ্রুপে ১০টির বেশি ফাইল রাখা যায় না`, 'bad'); continue; }
        src.label = src.meta.set || String.fromCharCode(65 + i);
        g.files[i] = src; slot = null;
        clog(`✓ ${lang} ফাইল ${i + 1}: ${f.name} — Set-${src.label}, ${src.stats.answers} টি উত্তর অংশ, নম্বর বণ্টন বাদ ${src.stats.marks} জায়গায়`, 'ok');
        if (!src.stats.answers) clog(`⚠ ${f.name} — "নং প্রশ্নের উত্তর" / "Answers to question" খুঁজে পাওয়া যায়নি`, 'bad');
      } catch (e) { console.error(e); clog(`✗ ${f.name} — ${e.message}`, 'bad'); }
    }
    renderGroups();
  }
  const drop = $('#c5drop'), inp = $('#c5In');
  ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', ev => addFiles([...ev.dataTransfer.files]));
  inp.addEventListener('change', () => { const l = [...inp.files]; inp.value = ''; addFiles(l); });

  function renderGroups() {
    for (const lang of ['BV', 'EV']) {
      const g = st[lang], box = $('#grp' + lang);
      const n = g.files.filter(Boolean).length;
      box.innerHTML = `<div class="c5h">${lang === 'BV' ? '📗 BV গ্রুপ (বাংলা)' : '📘 EV গ্রুপ (English)'} <span class="tag ${n ? 'g' : ''}">${n}/10 ফাইল</span></div>`;
      g.files.forEach((src, i) => {
        const d = document.createElement('div');
        if (src) {
          d.className = 'slot5 full';
          d.innerHTML = `<span class="no">${i + 1}</span><div><div class="fn">${esc(src.file.name)}</div><div class="st">${src.stats.answers} টি উত্তর অংশ · নম্বর বণ্টন বাদ ${src.stats.marks} টি</div></div>
            <div class="ctl"><span style="font-size:11px;color:var(--mut)">Set-</span><input class="setl" value="${esc(src.label)}" maxlength="3" title="Set লেবেল">
            <button class="btn sm" data-a="up" ${i === 0 ? 'disabled' : ''}>▲</button><button class="btn sm" data-a="dn" ${i === 9 ? 'disabled' : ''}>▼</button><button class="btn sm" data-a="rm">✕</button></div>`;
          d.querySelector('.setl').oninput = e => { src.label = e.target.value.trim() || String.fromCharCode(65 + i); };
          d.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
            const a = b.dataset.a; if (a === 'rm') g.files[i] = null;
            else { const j = a === 'up' ? i - 1 : i + 1; [g.files[i], g.files[j]] = [g.files[j], g.files[i]]; }
            renderGroups();
          });
        } else {
          d.className = 'slot5 empty';
          d.innerHTML = `<span class="no">${i + 1}</span><div>+ ${lang} ফাইল ${i + 1} দিন</div><span></span>`;
          const pick = () => { const x = document.createElement('input'); x.type = 'file'; x.accept = '.docx'; x.onchange = () => x.files[0] && addFiles([x.files[0]], lang, i); x.click(); };
          d.onclick = pick;
          d.ondragover = ev => { ev.preventDefault(); d.classList.add('over'); };
          d.ondragleave = () => d.classList.remove('over');
          d.ondrop = ev => { ev.preventDefault(); d.classList.remove('over'); addFiles([...ev.dataTransfer.files], lang, i); };
        }
        box.appendChild(d);
      });
    }
  }

  /* ---------- settings panels ---------- */
  function renderSettings() {
    for (const lang of ['BV', 'EV']) {
      const S = st[lang].S, box = $('#set' + lang);
      const F = (k, label) => `<label class="f">${label}<input data-k="${k}" value="${esc(S[k])}"></label>`;
      box.innerHTML = `<div class="c5h">${lang === 'BV' ? '📗 BV সেটিং' : '📘 EV Settings'}<button class="btn sm" data-reset style="margin-left:auto">↺ ডিফল্ট</button></div>
        <div class="sub">Header</div><div class="grid2">${F('hLeft', 'বাম পাশের লেখা')}${F('hRight', 'ডান পাশের লেখা')}</div>
        <div class="sub">Title ব্লক</div><div class="grid2">${F('b1', 'গোল ব্যাজ — লাইন ১')}${F('b2', 'গোল ব্যাজ — লাইন ২')}${F('b3', 'গোল ব্যাজ — লাইন ৩')}${F('title', 'শিরোনাম')}${F('ribTop', 'Set ব্যানারের উপরের লেখা')}${F('ans', 'উত্তরের ব্যানার')}</div>
        <div class="pv"><canvas data-pv="title"></canvas><div class="row"><canvas data-pv="ribbon"></canvas><canvas data-pv="answer"></canvas></div></div>
        <div class="sub">Footer</div>
        <div class="grid2"><label class="f">Footer ধরন<select data-k="footerMode"><option value="original">নমুনার মতো (মূল footer)</option><option value="custom">নিজের লেখা / লোগো</option></select></label>
          <label class="f">লোগো (Custom footer)<input type="file" accept="image/*" data-file="logo"></label>
          ${F('fLeft', 'Footer বাম পাশের লেখা')}${F('fRight', 'Footer ডান পাশের লেখা')}</div>
        <div class="pv"><canvas data-pv="header"></canvas><canvas data-pv="footer"></canvas></div>
        <div class="sub">Cover পেজ</div>
        <div class="grid2"><label class="f">সামনের Cover<select data-k="coverF"><option value="default">নমুনার Cover</option><option value="custom">নিজের ছবি</option><option value="none">Cover ছাড়া</option></select></label>
          <label class="f">পেছনের Cover<select data-k="coverB"><option value="default">নমুনার Cover</option><option value="custom">নিজের ছবি</option><option value="none">Cover ছাড়া</option></select></label>
          <label class="f">সামনের Cover ছবি (JPG/PNG)<input type="file" accept="image/*" data-file="coverF"></label>
          <label class="f">পেছনের Cover ছবি (JPG/PNG)<input type="file" accept="image/*" data-file="coverB"></label></div>
        <div class="covers"><img data-cv="coverF" alt=""><img data-cv="coverB" alt=""></div>
        <div class="sub">Output</div>${F('out', 'ফাইলের নাম')}`;
      box.querySelectorAll('select[data-k]').forEach(s => s.value = S[s.dataset.k]);
      box.querySelectorAll('[data-k]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { S[el.dataset.k] = el.value; save(); drawPreviews(lang); }));
      box.querySelectorAll('[data-file]').forEach(el => el.onchange = async () => {
        const f = el.files[0]; if (!f) return; const k = el.dataset.file;
        const url = URL.createObjectURL(f); const im = await loadImg(url);
        st[lang].custom[k] = { url, img: im, file: f };
        if (k === 'coverF' || k === 'coverB') { S[k] = 'custom'; box.querySelector(`select[data-k="${k}"]`).value = 'custom'; }
        if (k === 'logo') { S.footerMode = 'custom'; box.querySelector('select[data-k="footerMode"]').value = 'custom'; }
        save(); drawPreviews(lang);
      });
      box.querySelector('[data-reset]').onclick = () => { st[lang].S = { ...DEF[lang] }; st[lang].custom = {}; save(); renderSettings(); drawPreviews(lang); };
    }
  }
  const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  const imgCache = {};
  const asset = async k => imgCache[k] || (imgCache[k] = A[k] ? await loadImg(A[k]) : null);

  /* ---------- artwork ---------- */
  const FNT = lang => lang === 'BV' ? "'SolaimanLipi','Hind Siliguri','Nirmala UI','Vrinda',sans-serif" : "Arial,Helvetica,sans-serif";
  const G = { dark: '#6d6e71', mid: '#a7a9ac', light: '#f1f1f2', line: '#bcbec0', ring: '#d1d3d4' };
  const fit = (ctx, t, wt, size, maxW, fam) => { let s = size; do { ctx.font = `${wt} ${s}px ${fam}`; s -= 1; } while (ctx.measureText(t).width > maxW && s > 8); return ctx.measureText(t).width; };
  function bandBase(cv, footer) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    const split = W * (footer ? 0.44 : 0.47), sl = H * 0.9;
    ctx.fillStyle = G.light; ctx.fillRect(split - sl, 0, W * 0.905 - split + sl, H * 0.82);
    ctx.fillStyle = G.mid; ctx.fillRect(split, H * 0.86, W * 0.905 - split, H * 0.07);
    ctx.fillStyle = G.dark; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(split, 0); ctx.lineTo(split + sl * 0.55, H); ctx.lineTo(0, H); ctx.fill();
    ctx.strokeStyle = G.line; ctx.lineWidth = H * 0.05;
    for (const k of [1.0, 1.55]) { ctx.beginPath(); ctx.moveTo(split + sl * k, H); ctx.lineTo(split + sl * (k + 0.55), 0); ctx.stroke(); }
    ctx.fillStyle = G.mid; ctx.beginPath(); ctx.moveTo(split + sl * 2.2, H * 0.82); ctx.lineTo(split + sl * 2.75, 0); ctx.lineTo(split + sl * 3.0, 0); ctx.lineTo(split + sl * 2.45, H * 0.82); ctx.fill();
    ctx.fillStyle = G.ring; ctx.fillRect(W * 0.905, H * 0.1, W * 0.095, H * 0.8);
    ctx.fillStyle = '#fff'; for (const x of [0.945, 0.965, 0.985]) ctx.fillRect(W * x, H * 0.1, W * 0.006, H * 0.8);
    return ctx;
  }
  function drawHeaderBg(cv) { cv.width = 2448; cv.height = 112; bandBase(cv, false); }
  async function drawFooterBg(cv, lang) {
    const S = st[lang].S;
    if (S.footerMode !== 'custom') { const im = await asset('footer_' + lang); cv.width = im ? im.naturalWidth : 1700; cv.height = im ? im.naturalHeight : 82; const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height); if (im) ctx.drawImage(im, 0, 0); return; }
    cv.width = 2448; cv.height = 90; const ctx = bandBase(cv, true);
    const logo = st[lang].custom.logo?.img || await asset('footer_logo');
    if (logo) { const h = cv.height * 0.84, w = h * logo.naturalWidth / logo.naturalHeight; ctx.fillStyle = '#fff'; ctx.fillRect(0.78 * 288 - 4, (cv.height - h) / 2 - 4, w + 8, h + 8); ctx.drawImage(logo, 0.78 * 288, (cv.height - h) / 2, w, h); }
  }
  function drawHeaderPreview(cv, lang) { // band + text (only for the on-screen preview)
    drawHeaderBg(cv); const ctx = cv.getContext('2d'), S = st[lang].S, H = cv.height;
    ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; fit(ctx, S.hLeft, 700, lang === 'BV' ? 50 : 40, 2448 * 0.4, FNT(lang)); ctx.fillText(S.hLeft, 0.8 * 288, H * 0.45);
    ctx.fillStyle = '#1a1a1a'; const w = fit(ctx, S.hRight, 700, lang === 'BV' ? 50 : 40, 2448 * 0.4, FNT(lang)); ctx.fillText(S.hRight, 2448 - 0.92 * 288 - w, H * 0.45);
  }
  async function drawFooterPreview(cv, lang) {
    await drawFooterBg(cv, lang); const S = st[lang].S, ctx = cv.getContext('2d'), H = cv.height, k = cv.width / 2448;
    ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.font = `${32 * k}px 'Times New Roman',serif`; ctx.textAlign = 'center'; ctx.fillText(lang === 'BV' ? '১' : '1', cv.width / 2, H * 0.45); ctx.textAlign = 'left';
    if (S.footerMode === 'custom') {
      ctx.fillStyle = '#fff'; fit(ctx, S.fLeft, 700, 34, 2448 * 0.28, FNT(lang)); ctx.fillText(S.fLeft, 1.15 * 288, H * 0.45);
      ctx.fillStyle = '#1a1a1a'; const w = fit(ctx, S.fRight, 700, 36, 2448 * 0.35, FNT('BV')); ctx.fillText(S.fRight, 2448 - 0.92 * 288 - w, H * 0.45);
    }
  }
  function drawTitle(cv, lang) {
    const S = st[lang].S; cv.width = 2190; cv.height = 330; const ctx = cv.getContext('2d'), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    const cx = 175, cy = H / 2, R = 152;
    // ribbon
    ctx.strokeStyle = G.line; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(cx + 60, 40); ctx.lineTo(W * 0.62, 40); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + 200, H - 38); ctx.lineTo(W * 0.7, H - 38); ctx.stroke();
    ctx.fillStyle = G.dark; ctx.beginPath(); ctx.moveTo(cx, 62); ctx.lineTo(W * 0.86, 62); ctx.lineTo(W * 0.985, H - 62); ctx.lineTo(cx, H - 62); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(cx, 86); ctx.lineTo(W * 0.84, 86); ctx.lineTo(W * 0.92, H - 86); ctx.lineTo(cx, H - 86); ctx.fill();
    ctx.fillStyle = '#000'; ctx.textBaseline = 'middle'; fit(ctx, S.title, 700, lang === 'BV' ? 92 : 64, W * 0.92 - (cx + R + 70), FNT(lang)); ctx.fillText(S.title, cx + R + 50, H / 2 + 4);
    // badge
    ctx.fillStyle = G.ring; ctx.beginPath(); ctx.arc(cx, cy, R + 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + 8, cy, R - 4, 0, 7); ctx.fill();
    ctx.fillStyle = G.dark; ctx.beginPath(); ctx.arc(cx + 12, cy, R - 16, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    const lines = [S.b1, S.b2, S.b3]; const fs = lang === 'BV' ? 58 : 46;
    lines.forEach((t, i) => { fit(ctx, t, 700, fs, 2 * (R - 34), FNT(lang)); ctx.fillText(t, cx + 12, cy + (i - 1) * (fs * 1.12)); });
    ctx.textAlign = 'left';
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawRibbon(cv, lang, label) {
    const S = st[lang].S; cv.width = 405; cv.height = 186; const ctx = cv.getContext('2d'), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 6; ctx.strokeStyle = '#3a3a3c'; ctx.fillStyle = '#fff'; rr(ctx, 18, 46, W - 36, 104, 30); ctx.fill(); ctx.stroke();
    ctx.fillStyle = G.dark; rr(ctx, W / 2 - 98, 12, 196, 50, 14); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fit(ctx, S.ribTop, 700, 32, 176, "'Times New Roman',serif"); ctx.fillText(S.ribTop, W / 2, 38);
    ctx.fillStyle = '#000'; fit(ctx, 'Set-' + label, 700, 64, W - 80, "'Times New Roman',serif"); ctx.fillText('Set-' + label, W / 2, 104);
    ctx.strokeStyle = '#3a3a3c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W / 2 - 75, H - 20); ctx.lineTo(W / 2 + 75, H - 20); ctx.stroke();
    ctx.fillStyle = '#3a3a3c'; for (const k of [-1.5, -0.5, 0.5, 1.5]) { ctx.beginPath(); ctx.arc(W / 2 + k * 40, H - 20, 9, 0, 7); ctx.fill(); }
    ctx.textAlign = 'left';
  }
  function drawAnswer(cv, lang) {
    const S = st[lang].S; cv.width = 345; cv.height = 75; const ctx = cv.getContext('2d'), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 5; ctx.strokeStyle = '#3a3a3c'; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(30, 6); ctx.lineTo(W - 6, 6); ctx.lineTo(W - 30, H - 6); ctx.lineTo(6, H - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fit(ctx, S.ans, lang === 'BV' ? 700 : 'italic 700', lang === 'BV' ? 40 : 34, W - 70, lang === 'BV' ? FNT('BV') : "'Times New Roman',serif"); ctx.fillText(S.ans, W / 2, H / 2 + 2);
    ctx.textAlign = 'left';
  }
  async function drawPreviews(only) {
    for (const lang of only ? [only] : ['BV', 'EV']) {
      const box = $('#set' + lang); if (!box) continue;
      drawTitle(box.querySelector('[data-pv="title"]'), lang);
      drawRibbon(box.querySelector('[data-pv="ribbon"]'), lang, (st[lang].files.find(Boolean) || {}).label || 'A');
      drawAnswer(box.querySelector('[data-pv="answer"]'), lang);
      drawHeaderPreview(box.querySelector('[data-pv="header"]'), lang);
      await drawFooterPreview(box.querySelector('[data-pv="footer"]'), lang);
      for (const k of ['coverF', 'coverB']) { const im = box.querySelector(`[data-cv="${k}"]`); im.src = coverSrc(lang, k) || 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; im.style.opacity = coverSrc(lang, k) ? 1 : .25; }
    }
  }
  const coverSrc = (lang, k) => { const m = st[lang].S[k]; if (m === 'none') return null; if (m === 'custom' && st[lang].custom[k]) return st[lang].custom[k].url; return A[(k === 'coverF' ? 'cover_front_' : 'cover_back_') + lang]; };
  const cvBytes = cv => new Promise(res => cv.toBlob(async b => res({ bytes: new Uint8Array(await b.arrayBuffer()), w: cv.width, h: cv.height, ext: 'png' }), 'image/png'));
  async function urlBytes(url) { const im = await loadImg(url); const b = new Uint8Array(await (await fetch(url)).arrayBuffer()); const jpg = b[0] === 0xFF && b[1] === 0xD8; return { bytes: b, w: im.naturalWidth, h: im.naturalHeight, ext: jpg ? 'jpg' : 'png' }; }

  /* ---------- generate ---------- */
  // largest header font (half-points) that keeps each text inside its band
  function headerSizes(S, lang) {
    const ctx = document.createElement('canvas').getContext('2d');
    const fam = lang === 'BV' ? "'SolaimanLipi','Hind Siliguri','Nirmala UI',sans-serif" : 'Arial,Helvetica,sans-serif';
    const fitPt = (t, maxIn, startPt) => { let pt = startPt; for (; pt > 7; pt -= 0.5) { ctx.font = `bold ${pt * 96 / 72}px ${fam}`; if (ctx.measureText(t).width <= maxIn * 96) break; } return pt; };
    const start = lang === 'BV' ? 12 : 10;
    return { hSzL: Math.round(fitPt(S.hLeft, 3.05, start) * 2), hSzR: Math.round(fitPt(S.hRight, 3.0, start) * 2) };
  }
  async function makeDocx(lang) {
    const g = st[lang], S = { ...g.S, lang }; Object.assign(S, headerSizes(S, lang));
    const files = g.files.filter(Boolean);
    if (!files.length) throw new Error(`${lang} গ্রুপে কোনো ফাইল নেই`);
    const c = () => document.createElement('canvas');
    const hc = c(); drawHeaderBg(hc); const fc = c(); await drawFooterBg(fc, lang);
    const tc = c(); drawTitle(tc, lang); const ac = c(); drawAnswer(ac, lang);
    const ribbons = []; for (const src of files) { const r = c(); drawRibbon(r, lang, src.label); ribbons.push(await cvBytes(r)); }
    const img = { headerBg: await cvBytes(hc), footerBg: await cvBytes(fc), title: await cvBytes(tc), answer: await cvBytes(ac), ribbons, answerWidthIn: 1.15 };
    const cf = coverSrc(lang, 'coverF'), cb = coverSrc(lang, 'coverB');
    if (cf) img.coverFront = await urlBytes(cf); if (cb) img.coverBack = await urlBytes(cb);
    const res = await buildC5({ sources: files, sets: files.map(src => ({ src, label: src.label })), S, img });
    return { res, img, S };
  }
  const dl = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); };
  document.querySelectorAll('[data-gen]').forEach(btn => btn.onclick = async () => {
    const [lang, kind] = btn.dataset.gen.split(':');
    btn.disabled = true; const old = btn.textContent; btn.textContent = '⏳ তৈরি হচ্ছে…';
    try {
      const { res, img, S: SS } = await makeDocx(lang);
      let name = st[lang].S.out.trim() || `Solve_Sheet_${lang}.docx`;
      if (kind === 'docx') { if (!/\.docx$/i.test(name)) name += '.docx'; dl(res.blob, name); clog(`✓ ${lang} Word তৈরি: ${name} — ${res.answers} টি উত্তর অংশ (${(res.blob.size / 1048576).toFixed(2)} MB)`, 'ok'); }
      else await showPdf(lang, res.blob, img, name.replace(/\.docx$/i, '.pdf'), SS);
      res.warnings.forEach(w => clog('⚠ ' + w, 'bad'));
    } catch (e) { console.error(e); clog('✗ ' + e.message, 'bad'); }
    btn.disabled = false; btn.textContent = old;
  });
  async function showPdf(lang, blob, img, pdfName, S) { const ov = $('#c5print'); ov.hidden = false; $('#pInfo').textContent = 'পেজ সাজানো হচ্ছে…';
    const u = o => URL.createObjectURL(new Blob([o.bytes], { type: o.ext === 'jpg' ? 'image/jpeg' : 'image/png' }));
    const r = await renderC5Pages(blob, { root: $('#pPages'), lang, S: { ...S, lang }, headerUrl: u(img.headerBg), footerUrl: u(img.footerBg), headerH: 7772400 * img.headerBg.h / img.headerBg.w * EMU2PX, footerH: 7772400 * img.footerBg.h / img.footerBg.w * EMU2PX, coverFrontUrl: img.coverFront && u(img.coverFront), coverBackUrl: img.coverBack && u(img.coverBack) });
    $('#pInfo').textContent = `${lang} Solve Sheet — ${r.pages} পেজ · "PDF হিসেবে সেভ করুন" চাপুন, তারপর Destination: Save as PDF`;
    document.title = pdfName.replace(/\.pdf$/i, '');
    clog(`✓ ${lang} PDF প্রিভিউ তৈরি — ${r.pages} পেজ`, 'ok');
  }
  $('#pPrint').onclick = () => { document.body.classList.add('printing'); try { window.print(); } catch (e) { clog('এই জায়গায় Print চালু নেই — ফাইলটি ব্রাউজারে আলাদা করে খুলে চেষ্টা করুন', 'bad'); } };
  window.addEventListener('afterprint', () => document.body.classList.remove('printing'));
  $('#pClose').onclick = () => { $('#c5print').hidden = true; $('#pPages').innerHTML = ''; document.body.classList.remove('printing'); document.title = 'TIS Solve Sheet Studio — তারিকুল ইসলাম (সুমন)'; };

  renderGroups(); renderSettings();
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => drawPreviews());
  window.__c5 = st;
})();
