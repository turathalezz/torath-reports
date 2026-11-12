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
    store.del('token'); store.del('user'); store.del('meta');
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
      h('a', { class: 'tile', href: '#/dash' }, h('b', null, 'لوحة الإدارة'), h('span', null, 'المؤشرات')),
      isOwner() ? h('a', { class: 'tile hl', href: '#/owner' }, h('b', null, 'لوحة المالك'), h('span', null, 'كل الإدارات')) : null,
      isOwner() ? h('a', { class: 'tile', href: '#/reports' }, h('b', null, 'جدول وتصدير'), h('span', null, 'Excel وطباعة')) : null));
    show(parts);
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
  async function pageDash(dept) {
    setTab('dash');
    const m = await getMeta();
    const depts = m.depts.filter(d => d !== m.notes.dept);
    dept = dept || store.get('dashDept') || S.user.depts[0] || depts[0];
    if (depts.indexOf(dept) < 0) dept = depts[0];
    store.set('dashDept', dept);
    const body = h('div', null, h('div', { class: 'loading' }, 'جاري التحميل…'));
    let seq = 0;
    const load = async r => {
      const my = ++seq;
      fill(body, h('div', { class: 'loading' }, 'جاري الحساب…'));
      try { const d = await api('dash', { dept, from: r.from, to: r.to }); if (my === seq) fill(body, h('p', { class: 'small muted' }, 'من ' + d.from + ' إلى ' + d.to), ...deptBody(d)); }
      catch (e) { if (my === seq) fill(body, errorBox(e)); }
    };
    const pp = periodPicker('dash', load);
    show(h('div', { class: 'head' }, h('div', null, h('h1', null, 'لوحة الإدارة'))),
      h('div', { class: 'deptbar' }, depts.map(d => h('a', { class: d === dept ? 'on' : '', href: '#/dash/' + enc(d) }, d.replace('إدارة ', '')))),
      isOwner() ? h('a', { class: 'btn light sm', href: '#/owner', style: 'margin-bottom:10px' }, 'لوحة المالك ←') : null,
      pp.el, body);
    load(pp.range());
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
