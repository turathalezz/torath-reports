/* تقارير تراث العز — واجهة الموقع
 * كل البيانات تجي من سكربت سجل الملاحظات (API.gs) عن طريق CONFIG.API_URL
 */
(function () {
  'use strict';

  /* ================= أدوات ================= */
  const $app = document.getElementById('app');
  const NOTES = 'الملاحظات';
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('tz_' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('tz_' + k, JSON.stringify(v)); } catch (e) { /* التخزين غير متاح */ } },
    del(k) { try { localStorage.removeItem('tz_' + k); } catch (e) { /* */ } },
  };

  // h('div', {class:'x', onclick:fn}, child, 'text', [children])
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = c => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(add);
      else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    };
    kids.forEach(add);
    return el;
  }
  // يحط عناصر داخل عنصر: يتجاهل null ويفك المصفوفات
  const flat = kids => kids.flat(Infinity).filter(k => k != null && k !== false).map(k => (k instanceof Node ? k : document.createTextNode(String(k))));
  const fill = (el, ...kids) => el.replaceChildren(...flat(kids));
  const show = (...nodes) => { fill($app, ...nodes); window.scrollTo(0, 0); };
  const enc = encodeURIComponent, dec = decodeURIComponent;
  const go = hash => { if (location.hash === hash) route(); else location.hash = hash; };

  let toastT;
  function toast(msg, bad) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast'; }, 2600);
  }
  function confirmBox(title, body, okText, danger) {
    return new Promise(res => {
      const close = v => { m.remove(); res(v); };
      const m = h('div', { class: 'modal', onclick: e => { if (e.target === m) close(false); } },
        h('div', { class: 'card' }, h('h3', null, title), h('p', { class: 'muted' }, body),
          h('div', { class: 'row' },
            h('button', { class: 'btn ' + (danger ? 'danger' : ''), onclick: () => close(true) }, okText),
            h('button', { class: 'btn ghost', onclick: () => close(false) }, 'إلغاء'))));
      document.body.appendChild(m);
    });
  }

  /* ---------- التواريخ والأرقام ---------- */
  const pad = n => (n < 10 ? '0' : '') + n;
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  function parseStamp(s) { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/); return m ? new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null; }
  function ampm(d) { let x = d.getHours(); const a = x < 12 ? 'ص' : 'م'; x = x % 12 || 12; return pad(x) + ':' + pad(d.getMinutes()) + ' ' + a; }
  function niceDay(k) {
    const d = parseStamp(k); if (!d) return k;
    const t = dayKey(new Date()), y = dayKey(addDays(new Date(), -1));
    return k === t ? 'اليوم' : k === y ? 'أمس' : DAYS[d.getDay()] + ' ' + k;
  }
  const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  function fmt(v, f) {
    if (v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v))) return '—';
    if (typeof v !== 'number') return String(v);
    if (f === 'p') return Math.round(v * 100) + '%';
    if (f === 'd') return v.toFixed(1);
    if (f === 'sar') return NF.format(Math.round(v)) + ' ر.س';
    return NF.format(v);
  }

  const PERIODS = [['اليوم', 0], ['أسبوع', 6], ['شهر', 29], ['٣ شهور', 89], ['٦ شهور', 179], ['سنة', 364], ['مخصص', -1]];
  function periodRange(p) {
    const today = dayKey(new Date());
    if (p.key === 'مخصص') return { from: p.from || today, to: p.to || today };
    const n = (PERIODS.find(x => x[0] === p.key) || PERIODS[1])[1];
    return { from: dayKey(addDays(new Date(), -n)), to: today };
  }
  // اختيار الفترة: يرجع عنصر ويستدعي onChange بالمدى
  function periodPicker(name, onChange, def) {
    const saved = store.get('period_' + name) || { key: def || 'أسبوع' };
    const wrap = h('div');
    const draw = () => {
      const custom = saved.key === 'مخصص';
      const r = periodRange(saved);
      fill(wrap, 
        h('div', { class: 'period' }, PERIODS.map(([k]) => h('button', {
          class: 'chip' + (saved.key === k ? ' on' : ''),
          onclick: () => { saved.key = k; if (k === 'مخصص' && !saved.from) { saved.from = r.from; saved.to = r.to; } store.set('period_' + name, saved); draw(); onChange(periodRange(saved)); }
        }, k))),
        custom ? h('div', { class: 'custom' },
          h('input', { class: 'in', type: 'date', value: saved.from, onchange: e => { saved.from = e.target.value; store.set('period_' + name, saved); onChange(periodRange(saved)); } }),
          h('input', { class: 'in', type: 'date', value: saved.to, onchange: e => { saved.to = e.target.value; store.set('period_' + name, saved); onChange(periodRange(saved)); } })) : null);
    };
    draw();
    return { el: wrap, range: () => periodRange(saved) };
  }

  /* ================= الاتصال بالسكربت ================= */
  const S = { token: store.get('token'), user: store.get('user'), meta: null };

  async function api(action, data) {
    if (!window.CONFIG || !CONFIG.API_URL) throw new Error('رابط السكربت ناقص في config.js');
    let res;
    try {
      const r = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(Object.assign({ action, token: S.token }, data || {})) });
      res = await r.json();
    } catch (e) {
      throw new Error('ما قدرت أوصل للسيرفر. تأكد من الإنترنت وجرّب مرة ثانية.');
    }
    if (!res.ok) {
      if (res.error === 'AUTH') { logout(true); throw new Error('انتهت الجلسة، ادخل مرة ثانية'); }
      throw new Error(res.error || 'صار خطأ');
    }
    return res.data;
  }
  // النماذج محفوظة في الجهاز: الصفحة تفتح فورًا، وتتحدث من السيرفر بالخلفية
  function keepMeta(m) { S.meta = m; S.user = m.user; store.set('user', S.user); store.set('meta', m); return m; }
  async function getMeta(force) {
    if (S.meta && !force) return S.meta;
    if (!force) {
      const saved = store.get('meta');
      if (saved && saved.forms && saved.user && S.user && saved.user.name === S.user.name) {
        S.meta = saved;
        api('meta').then(keepMeta).catch(() => { /* تبقى النسخة المحفوظة */ });
        return S.meta;
      }
    }
    return keepMeta(await api('meta', force ? { refresh: true } : null));
  }
  const isOwner = () => S.user && S.user.role === 'owner';
  function logout(silent) {
    S.token = null; S.user = null; S.meta = null;
    store.del('token'); store.del('user'); store.del('meta'); dashCacheClear();
    if (!silent) go('#/login'); else location.hash = '#/login';
  }
  const formBySheet = sheet => S.meta.forms.find(f => f.sheet === sheet);

  /* ================= رسالة الواتساب ================= */
  const WA_LINE = '━━━━━━━━━━━━━━';
  function waIcon(v) {
    if (/^(نعم|تم|موجود|متوفر|سليم|سليمة|ممتاز|مكتمل|جيد|جيدة|نظيف|نظيفة|جاهز|شغال)$/.test(v)) return '🟢 ';
    if (/^(لا|لم يتم|ما تم|غير موجود|غير متوفر|ناقص|تالف|سيء|ملغي|متأخر|معطل|خربان)$/.test(v)) return '🔴 ';
    if (/^(متوسط|جزئي|جزئياً|بانتظار|قيد|يحتاج)/.test(v)) return '🟡 ';
    return '';
  }
  function waMessage(titles, emp, stamp, fields) {
    const d = parseStamp(stamp) || new Date();
    const out = titles.map(t => '*' + t + '*');
    out.push(WA_LINE);
    if (emp) out.push('*الموظف:* ' + emp);
    out.push('*التاريخ:* ' + dayKey(d) + '   *الوقت:* ' + ampm(d));
    out.push(WA_LINE);
    fields.forEach(([k, v]) => {
      v = v == null ? '' : String(v).trim();
      if (v === '') return;
      if (v.indexOf('\n') >= 0) out.push('- *' + k + ':*\n' + v);
      else out.push('- *' + k + ':* ' + waIcon(v) + v);
    });
    out.push(WA_LINE, '_تراث العز_');
    return out.join('\n');
  }
  function waFor(rec) {
    if (rec.sheet === NOTES) {
      const v = rec.values, type = v.type || 'ملاحظة';
      const icon = /شكوى/.test(type) ? '🔴 ' : /الغاء|إلغاء|ملغي/.test(type) ? '🟡 ' : '';
      return waMessage(['سجل الملاحظات والشكاوى', icon + type + '  #' + rec.ref], rec.emp, rec.date,
        [['المنتج', v.product], ['رقم الطلب', v.order], ['العميل', v.customer], ['القسم المعني', v.dept], ['التفاصيل', v.details], ['السبب', v.reason]]);
    }
    const f = formBySheet(rec.sheet);
    const qs = f ? f.questions : [];
    return waMessage([rec.dept, rec.form + '  #' + rec.ref], rec.emp, rec.date, qs.map(q => [q.title, rec.values[q.col]]));
  }
  async function copyText(txt) {
    try { await navigator.clipboard.writeText(txt); return true; } catch (e) {
      const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = txt; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* */ } ta.remove(); return ok;
    }
  }
  function waButtons(msg) {
    const cp = h('button', { class: 'btn light', onclick: async () => { if (await copyText(msg)) { cp.textContent = '✓ تم النسخ'; setTimeout(() => { cp.textContent = 'نسخ الرسالة'; }, 1800); } else toast('ما قدرت أنسخ، حدّد النص وانسخه', true); } }, 'نسخ الرسالة');
    return h('div', { class: 'row' }, h('a', { class: 'btn wa grow', href: 'https://wa.me/?text=' + enc(msg), target: '_blank', rel: 'noopener' }, 'إرسال واتساب'), cp);
  }

  /* ================= الصفحات ================= */
  function setTab(name) {
    const tabs = document.getElementById('tabs');
    tabs.hidden = !S.token;
    tabs.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.tab === name));
    tabs.querySelector('[data-tab=mine]').lastChild.textContent = isOwner() ? 'التقارير' : 'تقاريري';
    const who = document.getElementById('who');
    fill(who, ...(S.user ? [h('span', null, S.user.name), h('button', { onclick: () => logout() }, 'خروج')] : []));
  }

  /* ---------- الدخول ---------- */
  async function pageLogin() {
    setTab('');
    show(h('div', { class: 'loading' }, 'جاري التحميل…'));
    let names, pinNames, draw = null;
    const useList = r => { names = r.names; pinNames = r.pinNames || r.names; };
    // قائمة الأسماء من الجهاز فورًا، وتتحدث بالخلفية
    const saved = store.get('employees');
    const fresh = api('employees').then(r => { store.set('employees', r); return r; });
    if (saved && saved.names) {
      useList(saved);
      fresh.then(r => { if (JSON.stringify(r) !== JSON.stringify(saved)) { useList(r); if (draw) draw(); } }).catch(() => { /* */ });
    } else {
      try { useList(await fresh); } catch (e) { return show(errorBox(e)); }
    }
    const needPin = n => pinNames.indexOf(n) >= 0;   // المالك والمدير بس يحتاجون رمز
    let picked = store.get('lastName') || '';
    if (names.indexOf(picked) < 0) picked = '';
    const pin = h('input', { class: 'in pin', type: 'password', inputmode: 'numeric', autocomplete: 'current-password', maxlength: 8, placeholder: '••••' });
    const pinBox = h('div', null, h('label', { class: 'small muted' }, 'رمز الدخول'), pin);
    const err = h('div', { class: 'err' });
    const btn = h('button', { class: 'btn block', type: 'submit' }, 'دخول');
    const grid = h('div', { class: 'names' });
    draw = () => {
      if (names.indexOf(picked) < 0) picked = '';
      pinBox.hidden = !picked || !needPin(picked);
      fill(grid, ...names.map(n => h('button', { type: 'button', class: n === picked ? 'on' : '', onclick: () => { picked = n; draw(); if (needPin(n)) pin.focus(); } }, n)));
    };
    draw();
    const submit = async e => {
      e.preventDefault(); err.textContent = '';
      if (!picked) { err.textContent = 'اختر اسمك أول'; return; }
      if (needPin(picked) && !pin.value) { err.textContent = 'اكتب رمز الدخول'; pin.focus(); return; }
      btn.disabled = true; btn.textContent = 'جاري الدخول…';
      try {
        const r = await api('login', { name: picked, pin: pin.value });
        S.token = r.token; S.user = { name: r.name, role: r.role, depts: r.depts };
        store.set('token', r.token); store.set('user', S.user); store.set('lastName', picked);
        go('#/');
      } catch (ex) { err.textContent = ex.message; pin.value = ''; btn.disabled = false; btn.textContent = 'دخول'; }
    };
    show(h('form', { class: 'login card', onsubmit: submit },
      h('h1', null, 'أهلًا 👋'), h('p', { class: 'muted' }, 'اختر اسمك واضغط دخول.'),
      grid, pinBox, err, btn));
  }

  function errorBox(e, retry) {
    return h('div', { class: 'card empty' }, h('p', null, e.message || String(e)),
      h('button', { class: 'btn light', onclick: retry || (() => route()) }, 'حاول مرة ثانية'));
  }

  /* ---------- الرئيسية ---------- */
  function formTiles(forms) {
    const recent = store.get('recent') || [];
    return h('div', { class: 'tiles' }, forms.map(f => h('a', { class: 'tile' + (recent[0] === f.sheet ? ' hl' : ''), href: '#/new/' + enc(f.sheet) },
      h('b', null, f.form), h('span', null, f.questions.length + ' سؤال'))));
  }
  async function pageHome() {
    setTab('home');
    const m = await getMeta();
    const mine = m.depts.filter(d => S.user.depts.indexOf(d) >= 0);
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'صباح الخير' : 'مساء الخير';
    const parts = [h('div', { class: 'head' }, h('div', null, h('h1', null, hello + '، ' + S.user.name), h('p', null, DAYS[new Date().getDay()] + ' ' + dayKey(new Date()))))];
    const recent = (store.get('recent') || []).map(formBySheet).filter(Boolean).slice(0, 4);
    if (recent.length) parts.push(h('div', { class: 'dept-h' }, 'آخر النماذج اللي استخدمتها'), formTiles(recent));
    (isOwner() ? [] : mine).forEach(d => parts.push(h('div', { class: 'dept-h' }, d), formTiles(m.forms.filter(f => f.dept === d))));
    parts.push(h('div', { class: 'dept-h' }, 'سريع'), h('div', { class: 'tiles' },
      h('a', { class: 'tile note', href: '#/note' }, h('b', null, 'ملاحظة أو شكوى'), h('span', null, 'سجل الملاحظات والشكاوى')),
      h('a', { class: 'tile', href: '#/new' }, h('b', null, 'كل النماذج'), h('span', null, m.forms.length + ' نموذج')),
      h('a', { class: 'tile', href: '#/mine' }, h('b', null, isOwner() ? 'كل التقارير' : 'تقاريري'), h('span', null, 'عرض وتعديل')),
      h('a', { class: 'tile', href: '#/dash' }, h('b', null, 'اللوحات'), h('span', null, isOwner() ? 'الإدارات والملاحظات' : 'المؤشرات والردود')),
      isOwner() ? h('a', { class: 'tile hl', href: '#/review' }, h('b', null, 'المراجعة الأسبوعية'), h('span', null, 'للاجتماع')) : null,
      h('a', { class: 'tile', href: '#/goals' }, h('b', null, 'أهداف الأسبوع'), h('span', null, isOwner() ? 'كل الإدارات' : 'اكتب وقيّم أهداف إدارتك')),
      isOwner() ? h('a', { class: 'tile', href: '#/owner' }, h('b', null, 'لوحة المالك'), h('span', null, 'كل الإدارات')) : null,
      isOwner() ? h('a', { class: 'tile', href: '#/reports' }, h('b', null, 'جدول وتصدير'), h('span', null, 'Excel وطباعة')) : null));
    show(parts);
    setTimeout(prefetchDash, 1200);   // تجهيز اللوحة بالخلفية عشان تفتح فورًا
  }

  /* ---------- اختيار النموذج ---------- */
  async function pageNewList() {
    setTab('new');
    const m = await getMeta();
    const order = m.depts.slice().sort((a, b) => (S.user.depts.indexOf(b) >= 0) - (S.user.depts.indexOf(a) >= 0));
    show(h('div', { class: 'head' }, h('div', null, h('h1', null, 'تقرير جديد'), h('p', null, 'اختر النموذج'))),
      h('div', { class: 'tiles' }, h('a', { class: 'tile note', href: '#/note' }, h('b', null, 'ملاحظة أو شكوى'), h('span', null, 'سجل الملاحظات والشكاوى'))),
      order.map(d => [h('div', { class: 'dept-h' }, d), formTiles(m.forms.filter(f => f.dept === d))]));
  }

  /* ---------- حقل حسب نوع السؤال ---------- */
  const splitVals = v => (v == null || v === '' ? [] : String(v).split(/\s*،\s*/).filter(Boolean));
  function field(q, value, onDirty) {
    const t = q.type, opts = q.options || [];
    let get;
    let el;
    const multi = /أكثر من اختيار/.test(t), other = /أخرى/.test(t);
    if (t === 'نص طويل') { el = h('textarea', { class: 'in', oninput: onDirty }); el.value = value || ''; get = () => el.value.trim(); }
    else if (t === 'رقم') { el = h('input', { class: 'in', inputmode: 'decimal', oninput: onDirty }); el.value = value === '' || value == null ? '' : value; get = () => el.value.trim(); }
    else if (t === 'تاريخ') { el = h('input', { class: 'in', type: 'date', oninput: onDirty }); el.value = value || ''; get = () => el.value; }
    else if (t === 'وقت') { el = h('input', { class: 'in', type: 'time', oninput: onDirty }); el.value = value || ''; get = () => el.value; }
    else if (t === 'نعم/لا' || /اختيار/.test(t)) {
      const cur = new Set(multi ? splitVals(value) : (value ? [String(value)] : []));
      const extra = [...cur].filter(x => opts.indexOf(x) < 0);
      let otherOn = extra.length > 0;
      const otherIn = h('input', { class: 'in other', placeholder: 'اكتب الخيار', oninput: onDirty });
      otherIn.value = extra.join('، ');
      const useSelect = !multi && !other && t !== 'نعم/لا' && opts.length > 7;
      if (useSelect) {
        el = h('select', { class: 'in', onchange: onDirty }, h('option', { value: '' }, '— اختر —'), opts.map(o => h('option', { value: o }, o)));
        el.value = value || ''; get = () => el.value;
      } else {
        const box = h('div', { class: 'chips' });
        const draw = () => {
          fill(box, ...opts.map(o => h('button', {
            type: 'button', class: 'chip' + (cur.has(o) ? ' on' : '') + (t === 'نعم/لا' ? (o === 'نعم' ? ' yes' : ' no') : ''),
            onclick: () => { if (multi) { cur.has(o) ? cur.delete(o) : cur.add(o); } else { const was = cur.has(o); cur.clear(); otherOn = false; if (!was) cur.add(o); } draw(); onDirty(); }
          }, o)), other ? h('button', { type: 'button', class: 'chip' + (otherOn ? ' on' : ''), onclick: () => { otherOn = !otherOn; if (!multi && otherOn) cur.clear(); draw(); if (otherOn) otherIn.focus(); onDirty(); } }, 'أخرى…') : null);
          otherIn.hidden = !otherOn;
        };
        draw();
        el = h('div', null, box, other ? otherIn : null);
        get = () => {
          const picked = opts.filter(o => cur.has(o));
          const typed = otherOn ? splitVals(otherIn.value.replace(/,/g, '،')) : [];
          if (multi) return picked.concat(typed);
          return typed[0] || picked[0] || '';
        };
      }
    } else { el = h('input', { class: 'in', oninput: onDirty }); el.value = value || ''; get = () => el.value.trim(); }
    return { el, get };
  }
  const isEmpty = v => v == null || v === '' || (Array.isArray(v) && !v.length);

  /* ---------- تعبئة نموذج (جديد أو تعديل) ---------- */
  async function pageForm(sheet, editRec) {
    setTab('new');
    const m = await getMeta();
    const f = formBySheet(sheet);
    if (!f) return show(errorBox(new Error('النموذج ما عاد موجود'), () => go('#/new')));
    const draftKey = 'draft_' + sheet;
    const draft = !editRec && store.get(draftKey);
    const fields = [];
    const saveDraft = () => { if (!editRec) store.set(draftKey, collect()); };
    const collect = () => { const a = {}; fields.forEach(({ q, get }) => { a[q.col] = get(); }); return a; };
    const qs = f.questions.map(q => {
      const init = editRec ? editRec.values[q.col] : (draft ? draft[q.col] : '');
      const fd = field(q, Array.isArray(init) ? init.join('، ') : init, saveDraft);
      fields.push({ q, get: fd.get });
      return h('div', { class: 'q' }, h('label', { class: 't' }, q.title, /أكثر من اختيار/.test(q.type) ? h('span', { class: 'hint' }, ' (تقدر تختار أكثر من واحد)') : null), fd.el);
    });
    const btn = h('button', { class: 'btn', type: 'submit' }, editRec ? 'حفظ التعديل' : 'إرسال التقرير');
    const submit = async e => {
      e.preventDefault();
      const answers = collect();
      if (Object.values(answers).every(isEmpty)) { toast('التقرير فاضي، عبّ سؤال واحد على الأقل', true); return; }
      btn.disabled = true; btn.textContent = 'جاري الحفظ…';
      try {
        let rec;
        if (editRec) {
          rec = await api('update', { sheet, row: editRec.row, ref: editRec.ref, answers });
          toast('انحفظ التعديل');
          go('#/rec/' + enc(sheet) + '/' + rec.row + '/' + enc(rec.ref));
          return;
        }
        const r = await api('submit', { sheet, answers });
        store.del(draftKey);
        const recent = [sheet].concat((store.get('recent') || []).filter(x => x !== sheet)).slice(0, 6);
        store.set('recent', recent);
        rec = { sheet, dept: f.dept, form: f.form, ref: r.ref, row: r.row, date: r.date, emp: r.emp, values: {} };
        f.questions.forEach(q => { const v = answers[q.col]; rec.values[q.col] = Array.isArray(v) ? v.join('، ') : v; });
        sentPage(rec);
      } catch (ex) { toast(ex.message, true); btn.disabled = false; btn.textContent = editRec ? 'حفظ التعديل' : 'إرسال التقرير'; }
    };
    show(h('a', { class: 'back', href: editRec ? 'javascript:history.back()' : '#/new' }, 'رجوع'),
      h('div', { class: 'head' }, h('div', null, h('h1', null, f.form), h('p', null, f.dept + (editRec ? ' · تعديل #' + editRec.ref : '')))),
      draft && Object.values(draft).some(v => !isEmpty(v)) ? h('div', { class: 'pill warn' }, 'رجّعت لك المسودة اللي ما انرسلت') : null,
      h('form', { onsubmit: submit }, h('div', { class: 'card' }, qs), h('div', { class: 'actions' }, btn)));
  }

  /* ---------- سجل الملاحظات ---------- */
  async function pageNote(editRec) {
    setTab('new');
    const m = await getMeta();
    const N = m.notes;
    const v = editRec ? editRec.values : (store.get('draft_notes') || {});
    const save = () => { if (!editRec) store.set('draft_notes', collect()); };
    const mk = (title, q, key) => { const fd = field(q, v[key], save); return { key, get: fd.get, el: h('div', { class: 'q' }, h('label', { class: 't' }, title), fd.el) }; };
    const parts = {
      type: mk('النوع', { type: 'اختيار', options: N.types }, 'type'),
      product: mk('المنتج', { type: 'اختيار', options: N.products }, 'product'),
      order: mk('رقم الطلب', { type: 'نص' }, 'order'),
      customer: mk('رمز العميل', { type: 'نص' }, 'customer'),
      dept: mk('القسم المعني', { type: 'اختيار', options: N.depts }, 'dept'),
      details: mk('التفاصيل (وش صار بالضبط؟)', { type: 'نص طويل' }, 'details'),
      reason: mk('ليش ألغى العميل الطلب؟', { type: 'اختيار + أخرى', options: N.reasons }, 'reason'),
    };
    if (editRec && isOwner()) {
      const st = ['بانتظار متابعة', 'تمت المتابعة', 'مغلقة'];
      if (v.status && st.indexOf(v.status) < 0) st.push(v.status);
      parts.status = mk('الحالة', { type: 'اختيار', options: st }, 'status');
    }
    const collect = () => { const a = {}; Object.values(parts).forEach(p => { a[p.key] = p.get(); }); return a; };
    // سبب الإلغاء يطلع بس لما النوع «طلب ملغي»
    const syncReason = () => { parts.reason.el.hidden = parts.type.get() !== N.cancelType; };
    parts.type.el.addEventListener('click', () => setTimeout(syncReason));
    parts.type.el.addEventListener('change', syncReason);
    syncReason();
    const btn = h('button', { class: 'btn', type: 'submit' }, editRec ? 'حفظ التعديل' : 'إرسال');
    const submit = async e => {
      e.preventDefault();
      const fields = collect();
      if (fields.type !== N.cancelType) fields.reason = '';
      if (!fields.type && !fields.details && !fields.product) { toast('اختر النوع واكتب التفاصيل', true); return; }
      btn.disabled = true; btn.textContent = 'جاري الحفظ…';
      try {
        if (editRec) {
          const rec = await api('update', { sheet: NOTES, row: editRec.row, ref: editRec.ref, fields });
          toast('انحفظ التعديل'); go('#/rec/' + enc(NOTES) + '/' + rec.row + '/' + enc(rec.ref)); return;
        }
        const r = await api('submit', { sheet: NOTES, fields });
        store.del('draft_notes');
        sentPage({ sheet: NOTES, dept: N.dept, form: 'سجل الملاحظات', ref: r.ref, row: r.row, date: r.date, emp: r.emp, values: fields });
      } catch (ex) { toast(ex.message, true); btn.disabled = false; btn.textContent = editRec ? 'حفظ التعديل' : 'إرسال'; }
    };
    show(h('a', { class: 'back', href: editRec ? 'javascript:history.back()' : '#/' }, 'رجوع'),
      h('div', { class: 'head' }, h('div', null, h('h1', null, 'ملاحظة أو شكوى'), h('p', null, N.dept + (editRec ? ' · تعديل #' + editRec.ref : '')))),
      h('form', { onsubmit: submit }, h('div', { class: 'card' }, Object.values(parts).map(p => p.el)), h('div', { class: 'actions' }, btn)));
  }

  /* ---------- بعد الإرسال: رسالة الواتساب ---------- */
  function sentPage(rec) {
    const msg = waFor(rec);
    const again = rec.sheet === NOTES ? '#/note' : '#/new/' + enc(rec.sheet);
    show(h('div', { class: 'card' },
      h('div', { class: 'done' }, h('div', { class: 'tick' }, '✓'), h('h1', null, 'انرسل التقرير'), h('p', { class: 'muted' }, rec.form + ' · رقم المرجع #' + rec.ref)),
      h('pre', { class: 'wa' }, msg), waButtons(msg)),
      h('div', { class: 'row', style: 'margin-top:12px' },
        h('a', { class: 'btn ghost grow', href: '#/' }, 'الرئيسية'),
        h('a', { class: 'btn ghost grow', href: '#/rec/' + enc(rec.sheet) + '/' + rec.row + '/' + enc(rec.ref) }, 'عرض أو تعديل'),
        h('a', { class: 'btn ghost grow', href: again }, 'تقرير ثاني')));
    history.replaceState(null, '', '#/sent');
  }

  /* ---------- قائمة التقارير ---------- */
  async function pageMine() {
    setTab('mine');
    const m = await getMeta();
    const f = store.get('mineFilter') || { dept: '', emp: '' };
    const list = h('div', { class: 'list' }, h('div', { class: 'loading' }, 'جاري التحميل…'));
    const count = h('p', { class: 'small muted' });
    let seq = 0;
    const load = async r => {
      const my = ++seq;
      fill(list, h('div', { class: 'loading' }, 'جاري التحميل…'));
      try {
        const d = await api('records', Object.assign({ from: r.from, to: r.to }, isOwner() ? { dept: f.dept, emp: f.emp } : {}));
        if (my !== seq) return;
        count.textContent = d.total + ' تقرير' + (d.total > d.rows.length ? ' (يظهر آخر ' + d.rows.length + ')' : '');
        if (!d.rows.length) { fill(list, h('div', { class: 'empty' }, 'ما فيه تقارير في هذي الفترة')); return; }
        const out = []; let last = '';
        d.rows.forEach(x => {
          const k = (x.date || '').slice(0, 10);
          if (k !== last) { out.push(h('div', { class: 'day' }, niceDay(k))); last = k; }
          const t = parseStamp(x.date);
          out.push(h('a', { class: 'item', href: '#/rec/' + enc(x.sheet) + '/' + x.row + '/' + enc(x.ref) },
            h('span', { class: 'ref' }, '#' + x.ref),
            h('span', { class: 'grow' }, h('b', null, x.form), h('small', null, x.dept + (isOwner() ? ' · ' + (x.emp || 'بدون اسم') : '') + (t ? ' · ' + ampm(t) : '')))));
        });
        fill(list, ...out);
      } catch (e) { if (my === seq) fill(list, errorBox(e)); }
    };
    const pp = periodPicker('mine', load);
    const filters = isOwner() ? h('div', { class: 'row', style: 'margin-bottom:10px' },
      h('select', { class: 'in grow', onchange: e => { f.dept = e.target.value; store.set('mineFilter', f); load(pp.range()); } },
        h('option', { value: '' }, 'كل الإدارات'), m.depts.concat([m.notes.dept]).map(d => h('option', { value: d, selected: f.dept === d }, d))),
      h('select', { class: 'in grow', onchange: e => { f.emp = e.target.value; store.set('mineFilter', f); load(pp.range()); } },
        h('option', { value: '' }, 'كل الموظفين'), m.staff.map(s => h('option', { value: s.name, selected: f.emp === s.name }, s.name)))) : null;
    show(h('div', { class: 'head' }, h('div', null, h('h1', null, isOwner() ? 'كل التقارير' : 'تقاريري'),
      h('p', null, isOwner() ? 'اضغط أي تقرير لعرضه أو تعديله' : 'تقدر تعدل أو تحذف تقريرك خلال ' + m.editHours + ' ساعة'))),
      pp.el, filters, count, list);
    load(pp.range());
  }

  /* ---------- عرض تقرير ---------- */
  async function pageRecord(sheet, row, ref) {
    setTab('mine');
    await getMeta();
    show(h('div', { class: 'loading' }, 'جاري التحميل…'));
    let rec;
    try { rec = await api('record', { sheet, row: Number(row), ref }); } catch (e) { return show(errorBox(e)); }
    const isNote = sheet === NOTES;
    const t = parseStamp(rec.date);
    const canEdit = isOwner() || (rec.t && Date.now() - rec.t < S.meta.editHours * 3600000);
    let kv;
    if (isNote) {
      const v = rec.values;
      kv = [['النوع', v.type], ['المنتج', v.product], ['رقم الطلب', v.order], ['رمز العميل', v.customer], ['القسم المعني', v.dept], ['التفاصيل', v.details], ['سبب الإلغاء', v.reason], ['الحالة', v.status]];
    } else {
      const f = formBySheet(sheet);
      kv = (f ? f.questions : []).map(q => [q.title, rec.values[q.col]]);
    }
    const msg = waFor(rec);
    const del = async () => {
      if (!(await confirmBox('حذف التقرير #' + rec.ref + '؟', 'ينحذف السطر من الشيت نهائيًا وما يرجع.', 'احذف', true))) return;
      try { await api('delete', { sheet, row: rec.row, ref: rec.ref }); toast('انحذف التقرير'); go('#/mine'); } catch (e) { toast(e.message, true); }
    };
    show(h('a', { class: 'back', href: '#/mine' }, 'التقارير'),
      h('div', { class: 'head' }, h('div', null, h('h1', null, rec.form + ' #' + rec.ref), h('p', null, rec.dept + ' · ' + (rec.emp || 'بدون اسم') + (t ? ' · ' + DAYS[t.getDay()] + ' ' + dayKey(t) + ' ' + ampm(t) : '')))),
      h('div', { class: 'card' }, h('div', { class: 'kv' }, kv.filter(([, v]) => !isEmpty(v)).map(([k, v]) => [h('div', null, k), h('div', null, String(v))]))),
      h('div', { class: 'card' }, h('b', null, 'رسالة الواتساب'), h('pre', { class: 'wa' }, msg), waButtons(msg)),
      canEdit ? h('div', { class: 'row', style: 'margin-top:12px' },
        h('a', { class: 'btn grow', href: '#/edit/' + enc(sheet) + '/' + rec.row + '/' + enc(rec.ref) }, 'تعديل'),
        h('button', { class: 'btn danger', onclick: del }, 'حذف'))
        : h('p', { class: 'small muted' }, 'انتهت مدة التعديل. لو تحتاج تعدّل، كلّم المالك.'));
  }
  async function pageEdit(sheet, row, ref) {
    await getMeta();
    show(h('div', { class: 'loading' }, 'جاري التحميل…'));
    let rec;
    try { rec = await api('record', { sheet, row: Number(row), ref }); } catch (e) { return show(errorBox(e)); }
    return sheet === NOTES ? pageNote(rec) : pageForm(sheet, rec);
  }

  /* ---------- اللوحات ---------- */
  function kpiGrid(kpis) {
    return h('div', { class: 'kpis' }, kpis.map(k => h('div', { class: 'kpi' },
      h('div', { class: 'n' }, k.name), h('div', { class: 'v' }, fmt(k.value, k.fmt)),
      k.target != null ? h('div', { class: 'tg' }, 'المستهدف: ' + fmt(typeof k.target === 'number' ? k.target : Number(k.target) || k.target, k.fmt)) : null)));
  }
  function deptBody(d) {
    const out = [];
    out.push(h('div', { class: 'sec' }, h('h2', null, 'التسليم في الفترة'),
      h('div', { class: 'scroll' }, h('table', { class: 'tbl' }, h('tr', null, h('th', null, 'النموذج'), h('th', null, 'الردود'), h('th', null, 'مين سلّم')),
        d.forms.filter(f => f.count || /فحص|اليومي/.test(f.form)).map(f => h('tr', null, h('td', null, f.form), h('td', null, f.count), h('td', null, f.who.join('، ') || '—')))))));
    if (d.missing) out.push(h('p', { class: 'small' }, h('b', null, 'ما سلّموا التقرير اليومي اليوم: '),
      d.missing.team ? (d.missing.names.length ? h('span', { class: 'pill bad' }, d.missing.names.join('، ')) : h('span', { class: 'pill ok' }, 'الكل سلّم ✓'))
        : h('span', { class: 'muted' }, 'حدّد إدارة كل موظف في ورقة القوائم عشان يطلع هنا')));
    out.push(h('div', { class: 'sec' }, h('h2', null, 'المؤشرات'), kpiGrid(d.kpis)));
    d.extras.forEach(x => out.push(h('div', { class: 'sec' }, h('h2', null, x.title),
      x.rows.length ? h('div', { class: 'scroll' }, h('table', { class: 'tbl' }, x.head ? h('tr', null, x.head.map(t => h('th', null, t))) : null,
        x.rows.map(r => h('tr', null, r.map(c => h('td', null, String(c)))))))
        : h('p', { class: 'muted small' }, x.empty || '—'))));
    out.push(h('div', { class: 'sec' }, h('h2', null, 'آخر الردود'), d.recent.length
      ? h('div', { class: 'scroll' }, h('table', { class: 'tbl' }, h('tr', null, h('th', null, 'التاريخ'), h('th', null, 'النموذج'), h('th', null, 'الموظف'), h('th', null, '#')),
        d.recent.map(r => h('tr', null, h('td', null, r.date), h('td', null, r.form), h('td', null, r.emp || '—'), h('td', null, r.ref)))))
      : h('p', { class: 'muted small' }, 'ما فيه ردود في هذي الفترة')));
    return out;
  }
  /* ---------- اللوحات التفاعلية ---------- */
  const NOTE_STATUS = ['بانتظار متابعة', 'تمت المتابعة', 'مغلقة'];
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const numOf = v => {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v == null ? '' : v).trim().replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d)).replace(/,/g, '');
    if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return null;
    return Number(s);
  };
  const splitMulti = v => String(v).split(/[،,]\s*/).map(x => x.trim()).filter(Boolean);
  const countBy = (arr, f) => {
    const m = new Map();
    arr.forEach(x => [].concat(f(x)).forEach(k => { k = k == null ? '' : String(k).trim(); if (k) m.set(k, (m.get(k) || 0) + 1); }));
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const svgEl = (tag, a) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in a) e.setAttribute(k, a[k]); return e; };

  // أشرطة توزيع قابلة للضغط: الضغط على شريط يفلتر، والضغط مرة ثانية يلغي
  function bars(items, total, onPick, picked, max) {
    max = max || 8;
    const top = items.slice(0, max), rest = items.length - top.length;
    const big = Math.max(1, ...top.map(x => x[1]));
    return h('div', { class: 'bars' }, top.map(([k, c]) => h('button', {
      type: 'button', class: 'bar' + (picked === k ? ' on' : '') + (onPick ? '' : ' static'),
      onclick: onPick ? () => onPick(picked === k ? null : k) : null
    }, h('span', { class: 'bl' }, k), h('span', { class: 'bt' }, h('i', { style: 'width:' + Math.max(4, c / big * 100) + '%' })),
      h('span', { class: 'bc' }, c + (total ? ' · ' + Math.round(c / total * 100) + '%' : '')))),
    rest > 0 ? h('div', { class: 'small muted' }, '+ ' + rest + ' غيرها') : null);
  }

  // أعمدة يومية (أو شهرية للفترات الطويلة)
  function dayBars(from, to, map, unitFmt) {
    const days = [];
    for (let d = parseStamp(from); d && dayKey(d) <= to && days.length < 400; d = addDays(d, 1)) days.push(dayKey(d));
    let keys = days, val = k => map.get(k) || 0, lab = k => k.slice(8) + '/' + k.slice(5, 7);
    if (days.length > 62) {
      keys = [...new Set(days.map(k => k.slice(0, 7)))];
      val = k => days.filter(x => x.startsWith(k)).reduce((s, x) => s + (map.get(x) || 0), 0);
      lab = k => k.slice(5) + '/' + k.slice(2, 4);
    }
    if (keys.length < 2) return null;
    const W = 640, H = 128, P = { l: 4, r: 4, t: 14, b: 20 }, bw = (W - P.l - P.r) / keys.length, max = Math.max(1, ...keys.map(val));
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', class: 'daybars', role: 'img' });
    const every = Math.ceil(keys.length / 10);
    keys.forEach((k, i) => {
      const v = val(k), x = W - P.r - (i + 1) * bw, hh = (H - P.t - P.b) * v / max;
      const r = svgEl('rect', { x: x + bw * 0.15, y: H - P.b - hh, width: bw * 0.7, height: Math.max(hh, v ? 2 : 0), rx: 2, fill: v ? '#6B4423' : '#E6DCCB' });
      const tt = svgEl('title', {}); tt.textContent = k + ': ' + (unitFmt ? unitFmt(v) : v); r.appendChild(tt); svg.appendChild(r);
      if (v && keys.length <= 16) { const t = svgEl('text', { x: x + bw / 2, y: H - P.b - hh - 3, 'font-size': 10.5, fill: '#4A2E17', 'text-anchor': 'middle' }); t.textContent = NF.format(Math.round(v * 10) / 10); svg.appendChild(t); }
      if (i % every === 0) { const t = svgEl('text', { x: x + bw / 2, y: H - 5, 'font-size': 10, fill: '#7A6B5A', 'text-anchor': 'middle' }); t.textContent = lab(k); svg.appendChild(t); }
    });
    return svg;
  }

  // كاش اللوحات في الجهاز: تطلع فورًا ثم تتحدث
  const DASH_KEYS = 'dashKeys';
  const dashKey = (dept, r) => dept + '|' + r.from + '|' + r.to;
  function dashCacheGet(k) { return store.get('d_' + k); }
  function dashCacheSet(k, v) {
    const ks = (store.get(DASH_KEYS) || []).filter(x => x !== k); ks.unshift(k);
    ks.slice(8).forEach(x => store.del('d_' + x));
    store.set(DASH_KEYS, ks.slice(0, 8)); store.set('d_' + k, { at: Date.now(), d: v });
  }
  function dashCacheClear() { (store.get(DASH_KEYS) || []).forEach(x => store.del('d_' + x)); store.del(DASH_KEYS); }
  function prefetchDash() {
    if (!S.meta) return;
    const notesDept = S.meta.notes.dept;
    const depts = (isOwner() ? [notesDept] : []).concat(S.meta.depts.filter(d => d !== notesDept));
    let dept = store.get('dashDept') || S.user.depts[0] || depts[0];
    if (depts.indexOf(dept) < 0) dept = depts[0];
    const r = periodRange(store.get('period_dash') || { key: 'أسبوع' });
    const k = dashKey(dept, r), c = dashCacheGet(k);
    if (c && Date.now() - c.at < 180000) return;
    api('dash', { dept, from: r.from, to: r.to }).then(d => dashCacheSet(k, d)).catch(() => { /* */ });
  }

  async function pageDash(dept) {
    setTab('dash');
    const m = await getMeta();
    const notesDept = m.notes.dept;
    const depts = (isOwner() ? [notesDept] : []).concat(m.depts.filter(d => d !== notesDept));
    dept = dept || store.get('dashDept') || S.user.depts[0] || depts[0];
    if (depts.indexOf(dept) < 0) dept = depts[0];
    store.set('dashDept', dept);
    const body = h('div', null, h('div', { class: 'loading' }, 'جاري التحميل…'));
    const live = h('span', { class: 'live' });
    const state = {};   // الفلاتر تبقى لين تطلع من الصفحة
    let seq = 0;
    const draw = (d, key) => (dept === notesDept ? renderNotes : renderDeptI)(body, d, state, key);
    const load = async r => {
      const my = ++seq, key = dashKey(dept, r), c = dashCacheGet(key);
      if (c) draw(c.d, key); else fill(body, h('div', { class: 'loading' }, 'جاري الحساب…'));
      live.textContent = 'يتحدث…'; live.className = 'live on';
      try {
        const d = await api('dash', { dept, from: r.from, to: r.to });
        if (my !== seq) return;
        dashCacheSet(key, d);
        if (!c || JSON.stringify(c.d) !== JSON.stringify(d)) draw(d, key);
        live.textContent = 'محدّث'; live.className = 'live';
      } catch (e) {
        if (my !== seq) return;
        if (c) { live.textContent = 'ما قدرت أحدّث، هذي آخر نسخة'; live.className = 'live bad'; } else fill(body, errorBox(e));
      }
    };
    const pp = periodPicker('dash', load);
    show(h('div', { class: 'head' }, h('div', null, h('h1', null, 'اللوحات'), h('p', null, 'اضغط أي شريط أو اسم عشان تفلتر')), live),
      h('div', { class: 'deptbar' }, depts.map(d => h('a', { class: (d === dept ? 'on' : '') + (d === notesDept ? ' notes' : ''), href: '#/dash/' + enc(d) },
        d === notesDept ? 'الملاحظات والشكاوى' : d.replace('إدارة ', '')))),
      isOwner() ? h('a', { class: 'btn light sm', href: '#/owner', style: 'margin-bottom:10px' }, 'لوحة المالك ←') : null,
      pp.el, body);
    load(pp.range());
  }

  // صف قابل للفتح: يعرض كل الإجابات في مكانه بدون ما تفتح التقرير
  function answerRow(title, sub, kv, href, extra) {
    return h('details', { class: 'ans' },
      h('summary', null, h('span', { class: 'grow' }, h('b', null, title), h('small', null, sub))),
      h('div', { class: 'kv' }, kv.filter(([, v]) => !isEmpty(v)).map(([k, v]) => [h('div', null, k), h('div', null, String(v))])),
      h('div', { class: 'row', style: 'margin-top:8px' }, extra, h('a', { class: 'btn ghost sm', href }, 'فتح التقرير')));
  }
  function moreList(items, n) {
    const box = h('div', { class: 'list' });
    let shown = n;
    const draw = () => fill(box, items.slice(0, shown), items.length > shown
      ? h('button', { class: 'btn ghost sm', onclick: () => { shown += n; draw(); } }, 'عرض المزيد (' + (items.length - shown) + ')') : null);
    draw();
    return box;
  }
  const ago = date => { const t = parseStamp(date); if (!t) return ''; const dd = Math.floor((Date.now() - t) / 86400000); return dd <= 0 ? 'اليوم' : dd === 1 ? 'أمس' : 'من ' + dd + ' يوم'; };

  function renderDeptI(body, d, st) {
    const detail = (d.detail || []).filter(f => f.total);
    const rowsAll = detail.flatMap(f => f.rows.map(r => Object.assign({ f }, r)));
    const emps = countBy(rowsAll, r => r.emp || 'بدون اسم');
    const pass = (f, r) => (!st.emp || (r.emp || 'بدون اسم') === st.emp) && (!st.pick || st.pick.sheet !== f.sheet ||
      (r.v[st.pick.i] != null && splitMulti(r.v[st.pick.i]).concat([String(r.v[st.pick.i]).trim()]).indexOf(st.pick.val) >= 0));
    const redraw = () => renderDeptI(body, d, st);
    const forms = detail.filter(f => !st.form || f.sheet === st.form);

    const summaries = forms.map((f, fi) => {
      const rows = f.rows.filter(r => pass(f, r));
      const qs = f.cols.map((c, i) => {
        const vals = rows.map(r => ({ r, v: r.v[i] })).filter(x => !isEmpty(x.v));
        if (!vals.length) return null;
        const nums = vals.map(x => numOf(x.v)).filter(x => x !== null);
        const choice = c.y === 'نعم/لا' || /اختيار/.test(c.y);
        const head = h('div', { class: 'qh' }, h('b', null, c.t), h('small', null, vals.length + ' إجابة'));
        if (!choice && nums.length >= vals.length * 0.7 && !/تاريخ|وقت/.test(c.y)) {
          const sum = nums.reduce((s, x) => s + x, 0), byDay = new Map();
          vals.forEach(x => { const n = numOf(x.v); if (n !== null) { const k = x.r.date.slice(0, 10); byDay.set(k, (byDay.get(k) || 0) + n); } });
          if (nums.every(x => x === 0)) return h('div', { class: 'qs zero' }, head, h('span', { class: 'small muted' }, 'كل الإجابات صفر'));
          return h('div', { class: 'qs' }, head,
            h('div', { class: 'stats' }, [['آخر قيمة', numOf(vals[0].v)], ['المجموع', sum], ['المتوسط', sum / nums.length], ['الأعلى', Math.max(...nums)]]
              .map(([k, v]) => h('span', null, h('small', null, k), h('b', null, NF.format(Math.round(v * 10) / 10))))),
            Math.min(...nums) !== Math.max(...nums) ? dayBars(d.from, d.to, byDay) : null);
        }
        const distinct = new Set(vals.map(x => String(x.v).trim()));
        if (choice || (distinct.size <= 6 && vals.length >= 4)) {
          const items = countBy(vals, x => choice ? splitMulti(x.v) : String(x.v).trim());
          const picked = st.pick && st.pick.sheet === f.sheet && st.pick.i === i ? st.pick.val : null;
          return h('div', { class: 'qs' }, head, bars(items, vals.length, val => { st.pick = val ? { sheet: f.sheet, i, val, t: c.t } : null; redraw(); }, picked));
        }
        return h('div', { class: 'qs' }, head, moreList(vals.map(x => h('div', { class: 'quote' },
          h('small', null, (x.r.emp || '—') + ' · ' + niceDay(x.r.date.slice(0, 10))), h('div', null, String(x.v)))), 3));
      }).filter(Boolean);
      const who = countBy(rows, r => r.emp || 'بدون اسم').map(([k, c]) => k + ' (' + c + ')').join('، ');
      return h('details', { class: 'fcard', open: forms.length <= 2 || fi < 2 },
        h('summary', null, h('span', { class: 'grow' }, h('b', null, f.form), h('small', null, who || '—')), h('span', { class: 'cnt' }, rows.length)),
        f.total > f.rows.length ? h('p', { class: 'small muted' }, 'الملخص لآخر ' + f.rows.length + ' رد من ' + f.total + '. صغّر الفترة للباقي.') : null,
        rows.length ? qs : h('p', { class: 'muted small' }, 'ما فيه ردود بهذا الفلتر'));
    });

    const list = forms.flatMap(f => f.rows.filter(r => pass(f, r)).map(r => ({ f, r }))).sort((a, b) => (a.r.date < b.r.date ? 1 : -1))
      .map(({ f, r }) => answerRow(f.form + ' #' + r.ref, (r.emp || 'بدون اسم') + ' · ' + niceDay(r.date.slice(0, 10)) + ' ' + (parseStamp(r.date) ? ampm(parseStamp(r.date)) : ''),
        f.cols.map((c, i) => [c.t, r.v[i]]), '#/rec/' + enc(f.sheet) + '/' + r.row + '/' + enc(r.ref)));

    const chip = (label, on, fn) => h('button', { type: 'button', class: 'chip sm' + (on ? ' on' : ''), onclick: fn }, label);
    const active = [st.emp ? 'الموظف: ' + st.emp : null, st.form ? 'النموذج: ' + (detail.find(f => f.sheet === st.form) || {}).form : null,
      st.pick ? st.pick.t + ': ' + st.pick.val : null].filter(Boolean);

    fill(body,
      h('p', { class: 'small muted' }, 'من ' + d.from + ' إلى ' + d.to),
      d.missing ? h('p', { class: 'small' }, h('b', null, 'ما سلّموا التقرير اليومي اليوم: '),
        d.missing.team ? (d.missing.names.length ? h('span', { class: 'pill bad' }, d.missing.names.join('، ')) : h('span', { class: 'pill ok' }, 'الكل سلّم ✓'))
          : h('span', { class: 'muted' }, 'حدّد إدارة كل موظف في ورقة القوائم عشان يطلع هنا')) : null,
      h('div', { class: 'sec' }, h('h2', null, 'المؤشرات'), kpiGrid(d.kpis)),
      d.extras.map(x => h('div', { class: 'sec' }, h('h2', null, x.title),
        x.rows.length ? h('div', { class: 'scroll' }, h('table', { class: 'tbl' }, x.head ? h('tr', null, x.head.map(t => h('th', null, t))) : null,
          x.rows.map(r => h('tr', null, r.map(c => h('td', null, String(c)))))))
          : h('p', { class: 'muted small' }, x.empty || '—'))),
      h('div', { class: 'sec' }, h('h2', null, 'وش قالت التقارير'),
        rowsAll.length ? [
          h('div', { class: 'filters' },
            h('div', { class: 'chips' }, chip('كل الموظفين', !st.emp, () => { st.emp = ''; redraw(); }),
              emps.map(([k, c]) => chip(k + ' ' + c, st.emp === k, () => { st.emp = st.emp === k ? '' : k; redraw(); }))),
            detail.length > 1 ? h('div', { class: 'chips' }, chip('كل النماذج', !st.form, () => { st.form = ''; st.pick = null; redraw(); }),
              detail.map(f => chip(f.form + ' ' + f.total, st.form === f.sheet, () => { st.form = st.form === f.sheet ? '' : f.sheet; st.pick = null; redraw(); }))) : null,
            active.length ? h('div', { class: 'activef' }, h('span', null, 'الفلتر: ' + active.join(' · ')),
              h('button', { type: 'button', class: 'linkbtn', onclick: () => { st.emp = ''; st.form = ''; st.pick = null; redraw(); } }, 'إلغاء الفلتر')) : null),
          summaries,
          h('div', { class: 'sec' }, h('h2', null, 'الردود (' + list.length + ')'), h('p', { class: 'small muted' }, 'اضغط أي رد يفتح لك إجاباته هنا'),
            list.length ? moreList(list, 30) : h('p', { class: 'muted small' }, 'ما فيه ردود بهذا الفلتر'))]
          : h('div', { class: 'empty' }, 'ما فيه ردود في هذي الفترة')));
  }

  function renderNotes(body, d, st, key) {
    const redraw = () => renderNotes(body, d, st, key);
    const F = [['type', 'النوع'], ['product', 'المنتج'], ['dept', 'القسم المعني'], ['reason', 'سبب الإلغاء'], ['status', 'الحالة'], ['emp', 'الموظف']];
    const val = (x, k) => k === 'emp' ? (x.emp || 'بدون اسم') : String(x.v[k] || '').trim();
    const pass = x => F.every(([k]) => !st[k] || val(x, k) === st[k]);
    const rows = d.notes.filter(pass);
    const n = t => rows.filter(x => x.v.type === t).length;
    const setStatus = async (x, status, btn) => {
      btn.disabled = true;
      try {
        await api('update', { sheet: NOTES, row: x.row, ref: x.ref, fields: { status } });
        [d.notes, d.open].forEach(arr => arr.forEach(y => { if (y.ref === x.ref && y.row === x.row) y.v.status = status; }));
        const before = d.open.length;
        d.open = d.open.filter(y => y.v.status === d.pendingStatus);
        if (status === d.pendingStatus && !d.open.some(y => y.ref === x.ref && y.row === x.row)) {
          d.open.push(x); d.open.sort((a, b) => (a.date < b.date ? -1 : 1));
        }
        d.openTotal += d.open.length - before;
        if (key) dashCacheSet(key, d);
        toast('تم: ' + status); redraw();
      } catch (e) { toast(e.message, true); btn.disabled = false; }
    };
    const actions = x => isOwner() ? h('span', { class: 'row' }, NOTE_STATUS.filter(s => s !== x.v.status).map(s =>
      h('button', { type: 'button', class: 'btn sm ' + (s === d.pendingStatus ? 'ghost' : 'light'), onclick: e => { e.preventDefault(); setStatus(x, s, e.currentTarget); } }, s))) : null;
    const pillOf = s => h('span', { class: 'pill ' + (s === d.pendingStatus ? 'warn' : s ? 'ok' : '') }, s || 'بدون حالة');
    const noteRow = x => answerRow((x.v.type || 'ملاحظة') + ' #' + x.ref + (x.v.product ? ' · ' + x.v.product : ''),
      [x.emp || 'بدون اسم', niceDay(x.date.slice(0, 10)), x.v.status || ''].filter(Boolean).join(' · ') + (x.v.details ? ' — ' + x.v.details.slice(0, 70) : ''),
      [['النوع', x.v.type], ['المنتج', x.v.product], ['رقم الطلب', x.v.order], ['رمز العميل', x.v.customer], ['القسم المعني', x.v.dept],
        ['التفاصيل', x.v.details], ['سبب الإلغاء', x.v.reason], ['الحالة', x.v.status]],
      '#/rec/' + enc(NOTES) + '/' + x.row + '/' + enc(x.ref), actions(x));
    const byDay = new Map(); rows.forEach(x => { const k = x.date.slice(0, 10); byDay.set(k, (byDay.get(k) || 0) + 1); });
    const active = F.filter(([k]) => st[k]).map(([k, t]) => t + ': ' + st[k]);
    const dist = (k, t, src) => {
      const items = countBy(src || rows, x => val(x, k));
      return items.length ? h('div', { class: 'card dist' }, h('b', null, t), bars(items, (src || rows).length, v => { st[k] = v || ''; redraw(); }, st[k] || null, k === 'product' ? 10 : 8)) : null;
    };
    const openRows = d.open.filter(pass);
    fill(body,
      h('p', { class: 'small muted' }, 'من ' + d.from + ' إلى ' + d.to),
      h('div', { class: 'kpis' }, [['كل الملاحظات', rows.length], ['شكاوى', n('شكوى')], ['طلبات ملغية', n(S.meta.notes.cancelType)], ['غير متوفر', n('غير متوفر')],
        ['بانتظار متابعة (في الفترة)', rows.filter(x => x.v.status === d.pendingStatus).length], ['مفتوحة الآن (كل الأوقات)', d.openTotal]]
        .map(([k, v], i) => h('div', { class: 'kpi' + (i === 5 && v ? ' alert' : '') }, h('div', { class: 'n' }, k), h('div', { class: 'v' }, NF.format(v))))),
      active.length ? h('div', { class: 'activef' }, h('span', null, 'الفلتر: ' + active.join(' · ')),
        h('button', { type: 'button', class: 'linkbtn', onclick: () => { F.forEach(([k]) => { st[k] = ''; }); redraw(); } }, 'إلغاء الفلتر')) : null,
      h('div', { class: 'sec' }, h('h2', null, 'الملاحظات يوميًا'), rows.length ? h('div', { class: 'card' }, dayBars(d.from, d.to, byDay) || h('p', { class: 'muted small' }, rows.length + ' ملاحظة اليوم')) : null),
      h('div', { class: 'sec' }, h('h2', null, 'التوزيع'), h('p', { class: 'small muted' }, 'اضغط أي شريط يفلتر الصفحة كلها'),
        h('div', { class: 'dists' }, dist('type', 'النوع'), dist('product', 'المنتج'), dist('dept', 'القسم المعني'),
          dist('reason', 'أسباب الإلغاء', rows.filter(x => x.v.type === S.meta.notes.cancelType)), dist('status', 'الحالة'), dist('emp', 'مين سجّل'))),
      h('div', { class: 'sec' }, h('h2', null, 'المفتوحة: بانتظار متابعة (' + openRows.length + ')'),
        h('p', { class: 'small muted' }, 'الأقدم أول. غيّر الحالة من هنا مباشرة.'),
        openRows.length ? moreList(openRows.map(x => h('div', { class: 'openrow' },
          h('div', { class: 'grow' }, h('b', null, (x.v.type || 'ملاحظة') + ' #' + x.ref + (x.v.product ? ' · ' + x.v.product : '')),
            h('small', null, ago(x.date) + ' · ' + (x.emp || '—') + (x.v.dept ? ' · ' + x.v.dept : '')), x.v.details ? h('div', { class: 'det' }, x.v.details) : null),
          actions(x))), 10) : h('p', { class: 'pill ok' }, 'ما فيه شي مفتوح ✓')),
      h('div', { class: 'sec' }, h('h2', null, 'كل الملاحظات في الفترة (' + rows.length + ')'),
        rows.length ? moreList(rows.map(noteRow), 30) : h('p', { class: 'muted small' }, 'ما فيه ملاحظات بهذا الفلتر')));
  }

  function lineChart(chart) {
    const W = 640, H = 220, P = { l: 40, r: 18, t: 12, b: 28 };
    const colors = ['#6B4423', '#1E9E55', '#B8862F'];
    const all = chart.series.flatMap(s => s.values), max = Math.max(1, ...all);
    const x = i => P.l + (W - P.l - P.r) * (chart.days.length - 1 - i) / (chart.days.length - 1);   // من اليمين لليسار
    const y = v => P.t + (H - P.t - P.b) * (1 - v / max);
    const ns = 'http://www.w3.org/2000/svg';
    const el = (tag, a) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'الطلبات يوميًا' });
    [0, .5, 1].forEach(f => { svg.appendChild(el('line', { x1: P.l, x2: W - P.r, y1: y(max * f), y2: y(max * f), stroke: '#E6DCCB' }));
      const t = el('text', { x: P.l - 6, y: y(max * f) + 4, 'font-size': 11, fill: '#7A6B5A', 'text-anchor': 'end' }); t.textContent = Math.round(max * f); svg.appendChild(t); });
    chart.days.forEach((d, i) => { if (i % 2) return; const t = el('text', { x: x(i), y: H - 8, 'font-size': 10.5, fill: '#7A6B5A', 'text-anchor': 'middle' }); t.textContent = d.slice(5); svg.appendChild(t); });
    chart.series.forEach((s, k) => {
      svg.appendChild(el('polyline', { points: s.values.map((v, i) => x(i) + ',' + y(v)).join(' '), fill: 'none', stroke: colors[k], 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
      s.values.forEach((v, i) => { const c = el('circle', { cx: x(i), cy: y(v), r: 2.8, fill: colors[k] }); const tt = el('title', {}); tt.textContent = s.name + ' ' + chart.days[i] + ': ' + v; c.appendChild(tt); svg.appendChild(c); });
    });
    return h('div', { class: 'card' }, svg, h('div', { class: 'legend' }, chart.series.map((s, k) => h('span', null, h('i', { style: 'background:' + colors[k] }), s.name))));
  }

  async function pageOwner() {
    setTab('dash');
    await getMeta();
    if (!isOwner()) return go('#/dash');
    const body = h('div', null, h('div', { class: 'loading' }, 'جاري التحميل…'));
    let seq = 0;
    const load = async r => {
      const my = ++seq;
      fill(body, h('div', { class: 'loading' }, 'جاري حساب كل الإدارات…'));
      try {
        const d = await api('owner', { from: r.from, to: r.to });
        if (my !== seq) return;
        const n = d.notes;
        fill(body, 
          h('p', { class: 'small muted' }, 'من ' + d.from + ' إلى ' + d.to),
          h('div', { class: 'sec' }, h('h2', null, 'سجل الملاحظات والشكاوى'), kpiGrid(n.kpis)),
          h('div', { class: 'sec' }, h('h2', null, 'الشكاوى المفتوحة (الأقدم أول)'), n.open.length
            ? h('div', { class: 'list' }, n.open.map(o => h('a', { class: 'item', href: '#/rec/' + enc(NOTES) + '/' + o.row + '/' + enc(o.ref) }, h('span', { class: 'ref' }, '#' + o.ref),
              h('span', { class: 'grow' }, h('b', null, o.product || 'بدون منتج'), h('small', null, o.date + ' · ' + o.details)))))
            : h('p', { class: 'pill ok' }, 'ما فيه شكاوى مفتوحة')),
          h('div', { class: 'sec' }, h('h2', null, 'الطلبات يوميًا: آخر ١٤ يوم'), lineChart(d.chart)),
          h('div', { class: 'sec' }, h('h2', null, 'الإدارات')),
          d.depts.map(dd => h('details', { class: 'dept' },
            h('summary', null, dd.dept, h('span', { class: 'small muted' }, ' ' + dd.forms.reduce((s, f) => s + f.count, 0) + ' رد')),
            deptBody(dd))));
      } catch (e) { if (my === seq) fill(body, errorBox(e)); }
    };
    const pp = periodPicker('owner', load);
    show(h('div', { class: 'head' }, h('div', null, h('h1', null, 'لوحة المالك'), h('p', null, 'كل الإدارات في صفحة وحدة'))),
      h('div', { class: 'row no-print', style: 'margin-bottom:10px' },
        h('a', { class: 'btn light sm', href: '#/review' }, 'المراجعة الأسبوعية'),
        h('a', { class: 'btn light sm', href: '#/reports' }, 'جدول وتصدير'),
        h('button', { class: 'btn ghost sm', onclick: async () => { await getMeta(true); toast('تحدّثت النماذج والتقارير من الشيت'); } }, 'تحديث من الشيت')),
      pp.el, body);
    load(pp.range());
  }

  /* ---------- جدول وتصدير (للمالك) ---------- */
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => res(window.XLSX); s.onerror = () => rej(new Error('ما قدرت أحمّل أداة Excel'));
      document.head.appendChild(s);
    });
  }
  async function pageReports() {
    setTab('mine');
    const m = await getMeta();
    if (!isOwner()) return go('#/mine');
    const st = store.get('reportsFilter') || { sheet: (m.forms[0] || {}).sheet, emp: '' };
    const body = h('div');
    let last = null, seq = 0;
    const load = async r => {
      const my = ++seq;
      fill(body, h('div', { class: 'loading' }, 'جاري التحميل…'));
      try {
        const d = await api('records', { sheet: st.sheet, from: r.from, to: r.to, emp: st.emp });
        if (my !== seq) return;
        last = { d, r };
        const cols = d.columns;
        fill(body, 
          h('p', { class: 'small muted' }, d.rows.length + ' سطر · من ' + r.from + ' إلى ' + r.to),
          d.rows.length ? h('div', { class: 'scroll' }, h('table', { class: 'tbl' },
            h('tr', null, h('th', null, '#'), h('th', null, 'التاريخ'), h('th', null, 'الموظف'), cols.map(c => h('th', null, c.title))),
            d.rows.map(x => h('tr', { class: 'click', onclick: () => go('#/rec/' + enc(st.sheet) + '/' + x.row + '/' + enc(x.ref)) },
              h('td', null, x.ref), h('td', null, x.date), h('td', null, x.emp || '—'),
              cols.map(c => { const v = x.values[c.key]; return h('td', null, typeof v === 'number' ? NF.format(v) : String(v == null ? '' : v)); })))))
            : h('div', { class: 'empty' }, 'ما فيه بيانات في هذي الفترة'));
      } catch (e) { if (my === seq) fill(body, errorBox(e)); }
    };
    const exportXlsx = async () => {
      if (!last || !last.d.rows.length) { toast('ما فيه بيانات للتصدير', true); return; }
      try {
        const X = await loadXLSX();
        const { d, r } = last;
        const aoa = [['رقم المرجع', 'التاريخ', 'الموظف'].concat(d.columns.map(c => c.title))]
          .concat(d.rows.map(x => [x.ref, x.date, x.emp].concat(d.columns.map(c => x.values[c.key]))));
        const ws = X.utils.aoa_to_sheet(aoa);
        ws['!cols'] = aoa[0].map((t, i) => ({ wch: i < 3 ? 16 : Math.min(40, Math.max(12, String(t).length + 2)) }));
        const wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
        X.utils.book_append_sheet(wb, ws, 'التقرير');
        const name = (st.sheet === NOTES ? 'سجل الملاحظات' : st.sheet) + ' ' + r.from + ' إلى ' + r.to + '.xlsx';
        X.writeFile(wb, name);
      } catch (e) { toast(e.message, true); }
    };
    const pp = periodPicker('reports', load, 'شهر');
    const sheets = m.forms.map(f => [f.sheet, f.dept.replace('إدارة ', '') + ' — ' + f.form]).concat([[NOTES, 'سجل الملاحظات والشكاوى']]);
    show(h('div', { class: 'head' }, h('div', null, h('h1', null, 'جدول وتصدير'), h('p', null, 'اختر النموذج والفترة، وصدّر Excel أو اطبع PDF'))),
      h('div', { class: 'row no-print', style: 'margin-bottom:10px' },
        h('select', { class: 'in grow', onchange: e => { st.sheet = e.target.value; store.set('reportsFilter', st); load(pp.range()); } },
          sheets.map(([v, t]) => h('option', { value: v, selected: st.sheet === v }, t))),
        h('select', { class: 'in', style: 'max-width:180px', onchange: e => { st.emp = e.target.value; store.set('reportsFilter', st); load(pp.range()); } },
          h('option', { value: '' }, 'كل الموظفين'), m.staff.map(s => h('option', { value: s.name, selected: st.emp === s.name }, s.name)))),
      pp.el,
      h('div', { class: 'row no-print', style: 'margin-bottom:12px' },
        h('button', { class: 'btn sm', onclick: exportXlsx }, 'تصدير Excel'),
        h('button', { class: 'btn ghost sm', onclick: () => window.print() }, 'طباعة / PDF')),
      body);
    load(pp.range());
  }

  /* ---------- أهداف الأسبوع (لكل إدارة) ---------- */
  const shortDept = d => String(d || '').replace('إدارة ', '');
  function weekNav(d, base) {
    return h('div', { class: 'weeknav no-print' },
      h('a', { class: 'btn ghost sm', href: base + d.prev }, '→ الأسبوع اللي قبل'),
      h('a', { class: 'btn ghost sm', href: base.replace(/\/$/, '') }, 'هذا الأسبوع'),
      h('a', { class: 'btn ghost sm', href: base + d.next }, 'الأسبوع اللي بعد ←'));
  }
  const RATE_CLASS = { 'تحقق': 'ok', 'تحقق جزئيًا': 'warn', 'ما تحقق': 'bad' };
  async function pageGoals(week) {
    setTab('home');
    await getMeta();
    show(h('div', { class: 'loading' }, 'جاري التحميل…'));
    let d;
    try { d = await api('goals', week ? { week } : null); } catch (e) { return show(errorBox(e)); }
    const save = async (body, btn) => {
      if (btn) btn.disabled = true;
      try { d = await api('goalSave', body); draw(); } catch (e) { toast(e.message, true); if (btn) btn.disabled = false; }
    };
    const goalRow = g => {
      const note = h('input', { class: 'in sm', placeholder: 'ملاحظة على التقييم (اختياري)', value: g.note || '',
        onchange: e => { if (g.rate) save({ id: g.id, rate: g.rate, note: e.target.value }); } });
      const edit = async () => {
        const inp = h('input', { class: 'in', value: g.text });
        const box = h('div', { class: 'row' }, inp, h('button', { class: 'btn sm', onclick: e => save({ id: g.id, text: inp.value }, e.currentTarget) }, 'حفظ'));
        row.replaceWith(box); inp.focus();
      };
      const row = h('div', { class: 'goal' },
        h('div', { class: 'gtext' }, h('b', null, g.text), g.rate ? h('span', { class: 'pill ' + RATE_CLASS[g.rate] }, g.rate) : h('span', { class: 'pill' }, 'لسا ما تقيّم')),
        h('div', { class: 'chips' }, d.rates.map(r => h('button', { type: 'button', class: 'chip sm' + (g.rate === r ? ' on' : ''),
          onclick: e => save({ id: g.id, rate: g.rate === r ? '' : r, note: note.value }, e.currentTarget) }, r))),
        g.rate && g.rate !== 'تحقق' ? note : null,
        h('div', { class: 'row small' },
          h('button', { type: 'button', class: 'linkbtn', onclick: edit }, 'تعديل النص'),
          h('button', { type: 'button', class: 'linkbtn danger', onclick: async () => { if (await confirmBox('حذف الهدف؟', g.text, 'احذف', true)) save({ id: g.id, del: true }); } }, 'حذف'),
          h('span', { class: 'muted' }, 'كتبه ' + (g.by || '—'))));
      return row;
    };
    const draw = () => {
      show(h('a', { class: 'back', href: '#/' }, 'الرئيسية'),
        h('div', { class: 'head' }, h('div', null, h('h1', null, 'أهداف الأسبوع'), h('p', null, 'من الجمعة ' + d.from + ' إلى الخميس ' + d.to))),
        weekNav(d, '#/goals/'),
        h('p', { class: 'small muted' }, 'بداية الأسبوع اكتب أهداف إدارتك، ونهايته قيّم كل هدف. التقييم يطلع للمالك في المراجعة الأسبوعية.'),
        d.depts.map(dept => {
          const mine = d.goals.filter(g => g.dept === dept), prev = d.prevUnmet.filter(g => g.dept === dept);
          const inp = h('input', { class: 'in', placeholder: 'هدف جديد…' });
          const add = e => { e.preventDefault(); if (inp.value.trim()) save({ week: d.week, dept, text: inp.value }, btn); };
          const btn = h('button', { class: 'btn sm', type: 'submit' }, 'إضافة');
          return h('div', { class: 'card goals' }, h('h2', null, shortDept(dept), h('small', { class: 'muted' }, ' ' + mine.length + ' هدف')),
            prev.length ? h('div', { class: 'carry' }, h('b', { class: 'small' }, 'ما تحقق الأسبوع اللي قبل:'),
              prev.map(g => h('div', { class: 'row small' }, h('span', { class: 'grow' }, g.text + (g.rate ? ' (' + g.rate + ')' : ' (ما تقيّم)')),
                mine.some(x => x.text === g.text) ? h('span', { class: 'muted' }, 'منقول ✓')
                  : h('button', { type: 'button', class: 'btn light sm', onclick: e => save({ week: d.week, dept, text: g.text }, e.currentTarget) }, 'انقله لهذا الأسبوع')))) : null,
            mine.length ? mine.map(goalRow) : h('p', { class: 'muted small' }, 'ما فيه أهداف لهذا الأسبوع'),
            h('form', { class: 'row', onsubmit: add }, h('div', { class: 'grow' }, inp), btn));
        }));
    };
    draw();
  }

  /* ---------- المراجعة الأسبوعية (للاجتماع) ---------- */
  const RV_PERIODS = [['أسبوع', 7], ['شهر', 30], ['٣ شهور', 90], ['٦ شهور', 180], ['٩ شهور', 270], ['سنة', 365], ['مخصص', 0]];
  const fridayOf = d => addDays(d, -((d.getDay() + 2) % 7));
  function reviewRange(p) {
    const end = parseStamp(p.end) || new Date();
    if (p.key === 'مخصص') { const a = p.from || dayKey(fridayOf(new Date())), b = p.to || dayKey(new Date()); return a <= b ? { from: a, to: b } : { from: b, to: a }; }
    if (p.key === 'أسبوع') { const f = fridayOf(end); return { from: dayKey(f), to: dayKey(addDays(f, 6)) }; }
    const n = (RV_PERIODS.find(x => x[0] === p.key) || RV_PERIODS[1])[1];
    return { from: dayKey(addDays(end, -(n - 1))), to: dayKey(end) };
  }
  async function pageReview(arg) {
    setTab('dash');
    await getMeta();
    if (!isOwner()) return go('#/dash');
    const st = { dept: store.get('reviewDept') || '' };
    const p = store.get('reviewPeriod') || { key: 'أسبوع' };
    if (parseStamp(arg)) { p.key = 'أسبوع'; p.end = arg; }
    const body = h('div', null, h('div', { class: 'loading' }, 'جاري التجميع…'));
    const live = h('span', { class: 'live' });
    const ctrl = h('div', { class: 'no-print' });
    let seq = 0;
    const save = () => store.set('reviewPeriod', p);
    const shift = dir => {
      const r = reviewRange(p), len = Math.round((parseStamp(r.to) - parseStamp(r.from)) / 86400000) + 1;
      if (p.key === 'مخصص') { p.from = dayKey(addDays(parseStamp(r.from), dir * len)); p.to = dayKey(addDays(parseStamp(r.to), dir * len)); }
      else p.end = dayKey(addDays(parseStamp(r.to), dir * len));
      save(); drawCtrl(); load();
    };
    const drawCtrl = () => {
      const r = reviewRange(p);
      fill(ctrl,
        h('div', { class: 'period' }, RV_PERIODS.map(([k]) => h('button', { type: 'button', class: 'chip' + (p.key === k ? ' on' : ''),
          onclick: () => { if (k === 'مخصص' && p.key !== k) { p.from = r.from; p.to = r.to; } p.key = k; p.end = ''; save(); drawCtrl(); load(); } }, k))),
        p.key === 'مخصص' ? h('div', { class: 'custom' },
          h('input', { class: 'in', type: 'date', value: r.from, onchange: e => { p.from = e.target.value; save(); load(); } }),
          h('input', { class: 'in', type: 'date', value: r.to, onchange: e => { p.to = e.target.value; save(); load(); } })) : null,
        h('div', { class: 'weeknav' },
          h('button', { type: 'button', class: 'btn ghost sm', onclick: () => shift(-1) }, '→ اللي قبل'),
          h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { p.end = ''; if (p.key === 'مخصص') p.key = 'أسبوع'; save(); drawCtrl(); load(); } }, 'الحالي'),
          h('button', { type: 'button', class: 'btn ghost sm', onclick: () => shift(1) }, 'اللي بعد ←'),
          h('button', { type: 'button', class: 'btn light sm', onclick: () => { document.querySelectorAll('details').forEach(x => { x.open = true; }); window.print(); } }, 'طباعة / PDF')));
    };
    const load = async () => {
      const my = ++seq, r = reviewRange(p), key = 'rv_' + r.from + '_' + r.to, weekMode = p.key === 'أسبوع';
      let d = store.get(key);
      const draw = () => renderReview(body, d, st, () => { try { store.set(key, d); } catch (e) { /* */ } }, weekMode);
      if (d) draw(); else fill(body, h('div', { class: 'loading' }, 'جاري التجميع…'));
      live.textContent = 'يتحدث…'; live.className = 'live on';
      try {
        const fresh = await api('review', { from: r.from, to: r.to });
        if (my !== seq) return;
        if (!d || JSON.stringify(d) !== JSON.stringify(fresh)) { d = fresh; draw(); }
        store.set(key, fresh); live.textContent = 'محدّث'; live.className = 'live';
      } catch (e) {
        if (my !== seq) return;
        if (d) { live.textContent = 'ما قدرت أحدّث، هذي آخر نسخة'; live.className = 'live bad'; } else fill(body, errorBox(e));
      }
    };
    show(h('div', { class: 'head' }, h('div', null, h('h1', null, 'المراجعة الأسبوعية'), h('p', null, 'للاجتماع: الأهداف والمشاكل والاحتياجات والملاحظات')), live), ctrl, body);
    drawCtrl(); load();
  }

  function renderReview(body, d, st, persist, weekMode) {
    const redraw = () => { persist(); renderReview(body, d, st, persist, weekMode); };
    const T = weekMode ? 'الأسبوع' : 'الفترة';
    const wkLabel = w => 'أسبوع ' + w.slice(8) + '/' + w.slice(5, 7);
    const okDept = dept => !st.dept || dept === st.dept;
    const okNote = x => !st.dept || String(x.v.dept || '').indexOf(shortDept(st.dept)) >= 0;
    const OPEN = 'مفتوحة', DONE = 'تمت المتابعة', CLOSED = 'مغلقة';
    // إعادة توزيع البنود بعد تغيير الحالة
    const regroup = (grp, pending, openName) => {
      const all = new Map(); [grp.week, grp.open, grp.done].forEach(a => a.forEach(x => all.set(x.key || (x.sheet + x.row + x.ref), x)));
      const items = [...all.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
      const st0 = x => (x.status !== undefined ? x.status : x.v.status);
      grp.week = items.filter(x => x.day >= d.from && x.day <= d.to);
      grp.open = items.filter(x => x.day < d.from && st0(x) === openName).reverse();
      grp.done = items.filter(x => st0(x) === DONE && x.day <= d.to).slice(0, 60);
    };
    const setItem = async (grp, x, status, btn) => {
      btn.disabled = true;
      try { await api('track', { key: x.key, status }); x.status = status; regroup(grp, null, OPEN); toast('تم: ' + status); redraw(); }
      catch (e) { toast(e.message, true); btn.disabled = false; }
    };
    const setNote = async (x, status, btn) => {
      btn.disabled = true;
      try { await api('update', { sheet: NOTES, row: x.row, ref: x.ref, fields: { status } }); x.v.status = status; regroup(d.notes, null, d.pendingStatus); toast('تم: ' + status); redraw(); }
      catch (e) { toast(e.message, true); btn.disabled = false; }
    };
    const pill = s => h('span', { class: 'pill ' + (s === DONE ? 'ok' : s === CLOSED ? '' : 'warn') }, s);
    const itemRow = (grp, x) => h('div', { class: 'ritem' },
      h('div', { class: 'grow' }, h('div', { class: 'rtext' }, x.text),
        h('small', null, shortDept(x.dept) + ' · ' + x.form + ' · ' + (x.emp || '—') + ' · ' + niceDay(x.day) + ' ', pill(x.status), x.note ? ' — ' + x.note : '')),
      h('div', { class: 'row no-print' },
        (x.status === OPEN ? [DONE, CLOSED] : x.status === DONE ? [OPEN, CLOSED] : [OPEN]).map(s =>
          h('button', { type: 'button', class: 'btn sm ' + (s === OPEN ? 'ghost' : 'light'), onclick: e => setItem(grp, x, s, e.currentTarget) }, s === OPEN ? 'رجّعها مفتوحة' : s)),
        h('a', { class: 'linkbtn', href: '#/rec/' + enc(x.sheet) + '/' + x.row + '/' + enc(x.ref) }, 'التقرير')));
    const noteRow = x => h('div', { class: 'ritem' },
      h('div', { class: 'grow' }, h('div', { class: 'rtext' }, (x.v.type || 'ملاحظة') + ' #' + x.ref + (x.v.product ? ' · ' + x.v.product : '') + (x.v.details ? ': ' + x.v.details : '')),
        h('small', null, (x.v.dept || '—') + ' · ' + (x.emp || '—') + ' · ' + niceDay(x.day) + ' ', pill(x.v.status === d.pendingStatus ? OPEN : x.v.status || '—'))),
      h('div', { class: 'row no-print' },
        (x.v.status === d.pendingStatus ? [DONE, CLOSED] : x.v.status === DONE ? [d.pendingStatus, CLOSED] : [d.pendingStatus]).map(s =>
          h('button', { type: 'button', class: 'btn sm ' + (s === d.pendingStatus ? 'ghost' : 'light'), onclick: e => setNote(x, s, e.currentTarget) }, s === d.pendingStatus ? 'رجّعها مفتوحة' : s)),
        h('a', { class: 'linkbtn', href: '#/rec/' + enc(NOTES) + '/' + x.row + '/' + enc(x.ref) }, 'السجل')));
    const block = (title, grp, rowFn, okFn, empty) => {
      const w = grp.week.filter(okFn), o = grp.open.filter(okFn), dn = grp.done.filter(okFn);
      return h('div', { class: 'sec' }, h('h2', null, title),
        h('h3', { class: 'sub' }, (weekMode ? 'هذا الأسبوع' : 'في الفترة') + ' (' + w.length + ')'), w.length ? moreList(w.map(rowFn), 15) : h('p', { class: 'muted small' }, empty),
        h('h3', { class: 'sub' }, 'مفتوحة من قبل، الأقدم أول (' + o.length + ')'), o.length ? moreList(o.map(rowFn), 10) : h('p', { class: 'muted small' }, 'ما فيه شي متأخر ✓'),
        dn.length ? h('details', { class: 'fcard' }, h('summary', null, h('span', { class: 'grow' }, h('b', null, 'تمت متابعتها (' + dn.length + ')'), h('small', null, 'تقدر ترجع أي وحدة مفتوحة'))), moreList(dn.map(rowFn), 10)) : null);
    };
    const gw = d.goals.week.filter(g => okDept(g.dept)), gDone = gw.filter(g => g.rate === 'تحقق').length;
    const count = (grp, f) => [grp.week.filter(f).length, grp.open.filter(f).length];
    const [pw, po] = count(d.problems, x => okDept(x.dept)), [nw, no] = count(d.needs, x => okDept(x.dept)), [cw, co] = count(d.notes, okNote);
    const minutes = h('textarea', { class: 'in', rows: 6, placeholder: 'القرارات، المسؤول، الموعد…' }); minutes.value = d.minutes.text || '';
    const saved = h('span', { class: 'small muted' }, d.minutes.saved ? 'آخر حفظ ' + d.minutes.saved : '');
    const saveMin = async e => {
      const b = e.currentTarget; b.disabled = true;
      try { const r = await api('minutes', { week: d.week, text: minutes.value }); d.minutes = { text: minutes.value, saved: r.saved }; saved.textContent = 'آخر حفظ ' + r.saved; persist(); toast('انحفظ المحضر'); }
      catch (ex) { toast(ex.message, true); } b.disabled = false;
    };
    const goalList = (arr, dept) => { const a = arr.filter(g => g.dept === dept); return a.length ? a.map(g => h('div', { class: 'gline' },
      h('span', { class: 'grow' }, weekMode ? '' : h('small', { class: 'muted' }, wkLabel(g.week) + ': '), g.text, g.note ? h('small', { class: 'muted' }, ' — ' + g.note) : ''), g.rate ? h('span', { class: 'pill ' + RATE_CLASS[g.rate] }, g.rate) : h('span', { class: 'pill' }, 'ما تقيّم'))) : null; };
    fill(body,
      h('p', { class: 'wk' }, weekMode ? 'الأسبوع من الجمعة ' + d.from + ' إلى الخميس ' + d.to : 'الفترة من ' + d.from + ' إلى ' + d.to),
      h('div', { class: 'chips no-print', style: 'margin-bottom:12px' },
        [''].concat(d.depts).map(x => h('button', { type: 'button', class: 'chip sm' + (st.dept === x ? ' on' : ''), onclick: () => { st.dept = x; store.set('reviewDept', x); redraw(); } }, x ? shortDept(x) : 'كل الإدارات'))),
      h('div', { class: 'kpis' }, [['أهداف تحققت', gw.length ? gDone + ' من ' + gw.length : '—', gw.length && gDone < gw.length],
        ['مشاكل ' + T, pw], ['مشاكل مفتوحة من قبل', po, po > 0], ['احتياجات ' + T, nw], ['احتياجات مفتوحة من قبل', no, no > 0],
        ['ملاحظات وشكاوى ' + T, cw], ['ملاحظات مفتوحة من قبل', co, co > 0]]
        .map(([k, v, alert]) => h('div', { class: 'kpi' + (alert ? ' alert' : '') }, h('div', { class: 'n' }, k), h('div', { class: 'v' }, typeof v === 'number' ? NF.format(v) : v)))),
      h('div', { class: 'sec' }, h('h2', null, weekMode ? 'أهداف الأسبوع' : 'الأهداف في الفترة'),
        d.depts.filter(okDept).map(dept => h('div', { class: 'card gcard' }, h('b', null, shortDept(dept)),
          goalList(d.goals.week, dept) || h('p', { class: 'muted small' }, weekMode ? 'ما انكتبت أهداف لهذا الأسبوع' : 'ما انكتبت أهداف في الفترة'),
          weekMode && goalList(d.goals.prevUnmet, dept) ? h('details', null, h('summary', { class: 'small' }, 'ما تحقق الأسبوع اللي قبل'), goalList(d.goals.prevUnmet, dept)) : null,
          weekMode && goalList(d.goals.next, dept) ? h('details', null, h('summary', { class: 'small' }, 'أهداف الأسبوع الجاي'), goalList(d.goals.next, dept)) : null)),
        h('a', { class: 'btn ghost sm no-print', href: '#/goals/' + d.week, style: 'margin-top:8px' }, 'فتح صفحة الأهداف')),
      block('المشاكل (من خانة «المشاكل» في التقارير)', d.problems, x => itemRow(d.problems, x), x => okDept(x.dept), 'ما فيه مشاكل مسجلة هذا الأسبوع'),
      block('الاحتياجات (من خانة «وش أحتاج»)', d.needs, x => itemRow(d.needs, x), x => okDept(x.dept), 'ما فيه احتياجات مسجلة هذا الأسبوع'),
      block('الملاحظات والشكاوى', d.notes, noteRow, okNote, 'ما فيه ملاحظات هذا الأسبوع'),
      h('div', { class: 'sec' }, h('h2', null, 'مؤشرات ' + T),
        d.kpis.filter(x => okDept(x.dept)).map(x => h('details', { class: 'dept', open: !!st.dept },
          h('summary', null, shortDept(x.dept), h('span', { class: 'small muted' }, ' ' + x.forms.reduce((s, f) => s + f.count, 0) + ' تقرير')),
          kpiGrid(x.kpis), x.forms.length ? h('p', { class: 'small muted' }, x.forms.map(f => f.form + ': ' + f.count + ' (' + f.who.join('، ') + ')').join(' · ')) : null))),
      weekMode ? h('div', { class: 'sec' }, h('h2', null, 'محضر الاجتماع'), h('div', { class: 'card' }, minutes,
        h('div', { class: 'row no-print', style: 'margin-top:8px' }, h('button', { class: 'btn sm', onclick: saveMin }, 'حفظ المحضر'), saved)))
        : h('div', { class: 'sec' }, h('h2', null, 'محاضر الاجتماعات في الفترة (' + (d.minutesList || []).length + ')'),
          h('p', { class: 'small muted no-print' }, 'لكتابة محضر اختر «أسبوع».'),
          (d.minutesList || []).length ? (d.minutesList || []).map(m => h('div', { class: 'card minute' }, h('b', null, wkLabel(m.week)),
            h('div', { class: 'mtext' }, m.text), m.saved ? h('small', { class: 'muted' }, 'آخر حفظ ' + m.saved + (m.by ? ' · ' + m.by : '')) : null))
            : h('p', { class: 'muted small' }, 'ما فيه محاضر محفوظة في الفترة')));
  }

  /* ================= التوجيه ================= */
  async function route() {
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').map(dec);
    const page = parts[0] || '';
    if (!S.token && page !== 'login') { location.replace('#/login'); return pageLogin(); }
    if (S.token && page === 'login') { location.replace('#/'); return; }
    try {
      switch (page) {
        case 'login': return await pageLogin();
        case 'new': return parts[1] ? await pageForm(parts[1]) : await pageNewList();
        case 'note': return await pageNote();
        case 'mine': return await pageMine();
        case 'rec': return await pageRecord(parts[1], parts[2], parts[3]);
        case 'edit': return await pageEdit(parts[1], parts[2], parts[3]);
        case 'dash': return await pageDash(parts[1]);
        case 'owner': return await pageOwner();
        case 'reports': return await pageReports();
        case 'goals': return await pageGoals(parts[1]);
        case 'review': return await pageReview(parts[1]);
        case 'sent': return go('#/');
        default: return await pageHome();
      }
    } catch (e) {
      if (S.token) show(errorBox(e));
    }
  }
  window.addEventListener('hashchange', route);
  route();
})();
