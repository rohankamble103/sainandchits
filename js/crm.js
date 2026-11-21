/* Sainand CRM — single-page app (no build step, no dependencies) */
(() => {
  'use strict';

  const S = { meta: null, me: null, plans: [], dashScope: null, followAssignee: 'me' };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const view = () => $('#view');

  const STANDARD_PLANS = ['₹5 Lakh Bhisi', '₹10 Lakh Bhisi', '₹15 Lakh Bhisi', '₹20 Lakh Bhisi', '₹25 Lakh Bhisi', '₹50 Lakh Bhisi', 'Not sure yet'];

  const ICONS = {
    phone: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .6 3.6 1 1 0 0 1-.3 1z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.6a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3z"/></svg>',
    email: '<svg viewBox="0 0 24 24"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M3 17.2V21h3.8l11-11-3.8-3.8zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14zM7 11h5v5H7z"/></svg>',
    enquiry: '<svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>',
    flag: '<svg viewBox="0 0 24 24"><path d="M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>',
    info: '<svg viewBox="0 0 24 24"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/></svg>',
    meeting: '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 14.5 9a2.5 2.5 0 0 1-2.5 2.5z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M3 17.2V21h3.8l11-11-3.8-3.8zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8z"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7zM5 18v2h14v-2z"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>',
    merge: '<svg viewBox="0 0 24 24"><path d="M17 20.4 18.4 19 15 15.6 13.6 17zM7.5 8H11v5.6L5.6 19 7 20.4l6-6V8h3.5L12 3.5z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/></svg>',
  };
  const ACTIVITY_ICON = { call: 'phone', whatsapp: 'whatsapp', email: 'email', note: 'note', enquiry: 'enquiry', stage_change: 'flag', followup: 'calendar', system: 'info', meeting: 'meeting' };

  // ---------------------------------------------------------------- helpers
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  async function api(path, options = {}) {
    const init = { credentials: 'same-origin', ...options, headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } };
    if (init.body && typeof init.body !== 'string' && !(init.body instanceof FormData)) init.body = JSON.stringify(init.body);
    const response = await fetch(path, init);
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && !path.includes('/login')) {
      const wasSignedIn = Boolean(S.me);
      S.me = null;
      showLogin();
      if (wasSignedIn && data.code === 'idle') toast(data.error, 'error');
      throw new Error(data.error || 'Please sign in again.');
    }
    if (!response.ok) { const error = new Error(data.error || 'Something went wrong.'); error.status = response.status; error.data = data; throw error; }
    return data;
  }
  function toast(message, type = '') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    $('#toasts').append(el);
    setTimeout(() => el.remove(), type === 'error' ? 6000 : 3200);
  }
  const fail = error => toast(error.message, 'error');

  const IST = { timeZone: 'Asia/Kolkata' };
  function fmtDate(value, withTime = true) {
    if (!value) return '—';
    const d = new Date(value);
    return d.toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}), ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) });
  }
  function fmtTime(value) { return new Date(value).toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit' }); }
  function dayKey(date) { return new Date(date).toLocaleDateString('en-CA', IST); }
  function relTime(value) {
    if (!value) return '—';
    const diff = (Date.now() - new Date(value).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
    return fmtDate(value, false);
  }
  function dueInfo(value) {
    if (!value) return { cls: '', label: '—' };
    const today = dayKey(new Date());
    const tomorrow = dayKey(Date.now() + 86400000);
    const key = dayKey(value);
    if (new Date(value).getTime() < Date.now()) {
      return { cls: 'overdue', label: key === today ? `Overdue · ${fmtTime(value)}` : `Overdue · ${fmtDate(value, false)}` };
    }
    if (key === today) return { cls: 'today', label: `Today ${fmtTime(value)}` };
    if (key === tomorrow) return { cls: 'later', label: `Tomorrow ${fmtTime(value)}` };
    return { cls: 'later', label: fmtDate(value) };
  }
  function dueHtml(value) { const d = dueInfo(value); return value ? `<span class="due ${d.cls}">${esc(d.label)}</span>` : '<span class="muted">—</span>'; }
  function toLocalInput(date) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function presetDate(preset) {
    const d = new Date();
    // Quick picks never land on a Sunday (office closed): they move to Monday.
    const at = (days, hour) => { const x = new Date(); x.setDate(x.getDate() + days); x.setHours(hour, 0, 0, 0); if (x.getDay() === 0) x.setDate(x.getDate() + 1); return x; };
    if (preset === 'later') { d.setHours(d.getHours() + 3, 0, 0, 0); return d; }
    if (preset === 'tomorrow') return at(1, 11);
    if (preset === '2days') return at(2, 11);
    if (preset === 'week') return at(7, 11);
    return null;
  }


  // ---------------------------------------------------------------- date & time picker
  // A friendly calendar + time-slot picker used wherever a schedule is scheduled.
  // Value is stored in a hidden input as "YYYY-MM-DDTHH:mm" (local time).
  const DTP_BOOKED = { at: 0, map: null };
  async function bookedByDay() {
    if (DTP_BOOKED.map && Date.now() - DTP_BOOKED.at < 60000) return DTP_BOOKED.map;
    try {
      const { tasks } = await api('/api/crm/tasks?assignee=me');
      const map = {};
      for (const t of tasks) { const k = dayKey(t.dueAt); map[k] = (map[k] || 0) + 1; }
      DTP_BOOKED.map = map; DTP_BOOKED.at = Date.now();
    } catch { DTP_BOOKED.map = {}; }
    return DTP_BOOKED.map;
  }
  const pad2 = n => String(n).padStart(2, '0');
  const localKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  function dtpLabel(value) {
    if (!value) return '';
    const d = new Date(value);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const that = new Date(d); that.setHours(0, 0, 0, 0);
    const days = Math.round((that - today) / 86400000);
    const rel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days > 1 && days < 7 ? `In ${days} days` : '';
    const date = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
    const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    return `${rel ? `${rel}, ` : ''}${date} · ${time}`;
  }
  function dtpHtml(name, value = '', { placeholder = 'Choose date & time', hidden = false } = {}) {
    return `<div class="dtp" data-dtp ${hidden ? 'hidden' : ''}>
      <input type="hidden" name="${name}" value="${esc(value)}">
      <button type="button" class="dtp-display ${value ? 'has-value' : ''}" aria-expanded="false">${ICONS.calendar}<span>${esc(value ? dtpLabel(value) : placeholder)}</span><svg class="dtp-caret" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg></button>
      <div class="dtp-pop" hidden></div>
    </div>`;
  }
  function wireDtp(root, { onChange } = {}) {
    $$('[data-dtp]', root).forEach(el => {
      const input = $('input[type=hidden]', el);
      const display = $('.dtp-display', el);
      const pop = $('.dtp-pop', el);
      const placeholder = $('span', display).textContent;
      let month = null;
      const current = () => (input.value ? new Date(input.value) : null);
      const setValue = (date, { silent = false } = {}) => {
        input.value = date ? toLocalInput(date) : '';
        $('span', display).textContent = date ? dtpLabel(input.value) : placeholder;
        display.classList.toggle('has-value', Boolean(date));
        if (!silent) onChange?.(input.value);
        if (!pop.hidden) draw();
      };
      const draw = async () => {
        const sel = current();
        const base = month || sel || new Date();
        const y = base.getFullYear(); const m = base.getMonth();
        const first = new Date(y, m, 1);
        const lead = (first.getDay() + 6) % 7; // Monday first
        const daysIn = new Date(y, m + 1, 0).getDate();
        const todayK = localKey(new Date());
        const selK = sel ? localKey(sel) : '';
        const booked = DTP_BOOKED.map || {};
        const cells = [];
        for (let i = 0; i < lead; i += 1) cells.push('<span></span>');
        for (let d = 1; d <= daysIn; d += 1) {
          const date = new Date(y, m, d);
          const k = localKey(date);
          const past = k < todayK;
          const count = booked[k] || 0;
          cells.push(`<button type="button" class="dtp-day ${k === todayK ? 'is-today' : ''} ${k === selK ? 'is-selected' : ''} ${date.getDay() === 0 ? 'is-sunday' : ''}" data-day="${k}" ${past ? 'disabled' : ''} title="${count ? `${count} schedule${count === 1 ? '' : 's'} already booked` : date.getDay() === 0 ? 'Sunday' : ''}">${d}${count ? `<i class="dtp-dot">${count > 3 ? '3+' : ''}</i>` : ''}</button>`);
        }
        const slots = [];
        for (let h = 9; h <= 20; h += 1) for (const mm of [0, 30]) if (!(h === 20 && mm === 30)) slots.push([h, mm]);
        const groups = [['Morning', slots.filter(([h]) => h < 12)], ['Afternoon', slots.filter(([h]) => h >= 12 && h < 17)], ['Evening', slots.filter(([h]) => h >= 17)]];
        const selDay = sel || null;
        const now = new Date();
        const slotHtml = ([h, mm]) => {
          const t = new Date(selDay || now); t.setHours(h, mm, 0, 0);
          const disabled = selDay && localKey(selDay) === todayK && t < now;
          const on = sel && sel.getHours() === h && sel.getMinutes() === mm;
          return `<button type="button" class="dtp-slot ${on ? 'on' : ''}" data-time="${pad2(h)}:${pad2(mm)}" ${disabled || !selDay ? 'disabled' : ''}>${t.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</button>`;
        };
        pop.innerHTML = `
          <div class="dtp-body">
            <div class="dtp-cal">
              <div class="dtp-head">
                <button type="button" class="icon-btn" data-nav="-1" aria-label="Previous month" ${y === now.getFullYear() && m <= now.getMonth() ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg></button>
                <strong>${first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong>
                <button type="button" class="icon-btn" data-nav="1" aria-label="Next month"><svg viewBox="0 0 24 24"><path d="M10 6 8.6 7.4 13.2 12l-4.6 4.6L10 18l6-6z"/></svg></button>
              </div>
              <div class="dtp-week">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(w => `<span>${w}</span>`).join('')}</div>
              <div class="dtp-grid">${cells.join('')}</div>
              <div class="dtp-legend"><span><i class="dtp-dot"></i> your schedules already booked</span></div>
            </div>
            <div class="dtp-times">
              ${selDay ? '' : '<p class="muted small" style="margin:0 0 8px">Pick a day first.</p>'}
              ${groups.map(([label, list]) => `<div class="dtp-group"><span>${label}</span><div class="dtp-slots">${list.map(slotHtml).join('')}</div></div>`).join('')}
              <label class="dtp-other">Other time <input type="time" value="${sel ? `${pad2(sel.getHours())}:${pad2(sel.getMinutes())}` : ''}" ${selDay ? '' : 'disabled'}></label>
            </div>
          </div>
          <div class="dtp-foot"><span>${sel ? `<strong>${esc(dtpLabel(input.value))}</strong>` : 'No date chosen'}</span><button type="button" class="btn btn-primary btn-sm" data-done ${sel ? '' : 'disabled'}>Done</button></div>`;
        $$('[data-nav]', pop).forEach(b => b.addEventListener('click', () => { month = new Date(y, m + Number(b.dataset.nav), 1); draw(); }));
        $$('[data-day]', pop).forEach(b => b.addEventListener('click', () => {
          const [yy, mo, dd] = b.dataset.day.split('-').map(Number);
          const prev = current();
          const d = new Date(yy, mo - 1, dd, prev ? prev.getHours() : 11, prev ? prev.getMinutes() : 0);
          if (d < new Date()) { const n = new Date(); n.setMinutes(n.getMinutes() < 30 ? 30 : 60, 0, 0); d.setHours(n.getHours(), n.getMinutes()); }
          month = new Date(yy, mo - 1, 1);
          setValue(d);
        }));
        $$('[data-time]', pop).forEach(b => b.addEventListener('click', () => {
          const [h, mm] = b.dataset.time.split(':').map(Number);
          const d = current(); d.setHours(h, mm, 0, 0); setValue(d);
        }));
        $('.dtp-other input', pop).addEventListener('change', e => {
          if (!e.target.value) return;
          const [h, mm] = e.target.value.split(':').map(Number);
          const d = current(); d.setHours(h, mm, 0, 0); setValue(d);
        });
        $('[data-done]', pop).addEventListener('click', close);
        const chosen = $('.dtp-slot.on', pop);
        const list = $('.dtp-times', pop);
        if (chosen && list.scrollHeight > list.clientHeight) list.scrollTop = chosen.offsetTop - list.offsetTop - 60;
      };
      const open = async () => {
        pop.hidden = false; display.setAttribute('aria-expanded', 'true'); el.classList.add('is-open');
        month = current() ? new Date(current().getFullYear(), current().getMonth(), 1) : null;
        draw();
        await bookedByDay();
        if (!pop.hidden) draw();
      };
      const close = () => { pop.hidden = true; display.setAttribute('aria-expanded', 'false'); el.classList.remove('is-open'); };
      display.addEventListener('click', () => (pop.hidden ? open() : close()));
      el._dtp = { set: d => setValue(d), clear: () => setValue(null), open, close, get value() { return input.value; } };
    });
  }


  // ---------------------------------------------------------------- dropdowns
  // Native <select> lists are drawn by the operating system and can't be styled. On computers we
  // show our own list instead (same options, keyboard support, search for long lists). The real
  // <select> stays in the page, so forms and change events keep working. Phones keep the native picker.
  const DD = { open: null };
  const fineptr = window.matchMedia('(pointer: fine)').matches;
  (() => {
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(HTMLSelectElement.prototype, 'value', {
      configurable: true,
      get() { return desc.get.call(this); },
      set(v) { desc.set.call(this, v); this._dd?.sync(); },
    });
  })();
  function enhanceSelect(select) {
    if (!fineptr || select._dd || select.multiple || select.dataset.native !== undefined) return;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'dd-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const label = select.getAttribute('aria-label') || select.closest('label')?.querySelector(':scope > span')?.textContent || '';
    if (label) trigger.setAttribute('aria-label', label);
    select.classList.add('dd-native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select.after(trigger);
    const sync = () => {
      const opt = select.options[select.selectedIndex];
      trigger.innerHTML = `<span class="dd-value">${esc(opt ? opt.text : '')}</span>`;
      trigger.disabled = select.disabled;
    };
    select._dd = { sync, trigger };
    sync();
    select.addEventListener('change', sync);
    select.form?.addEventListener('reset', () => setTimeout(sync));
    trigger.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); DD.open?.select === select ? closeDropdown() : openDropdown(select); });
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); openDropdown(select); }
    });
    // Clicking the pill's label text opens the list too.
    select.closest('.pill-select')?.addEventListener('click', event => {
      if (event.target.closest('.dd-trigger')) return;
      event.preventDefault();
      openDropdown(select);
    });
  }
  function openDropdown(select) {
    closeDropdown();
    const { trigger } = select._dd;
    const anchor = select.closest('.pill-select') || trigger;
    const items = [];
    const panel = document.createElement('div');
    panel.className = 'dd-panel';
    panel.setAttribute('role', 'listbox');
    const many = select.options.length > 9;
    let html = many ? '<div class="dd-search"><input type="text" placeholder="Search…" aria-label="Search options"></div>' : '';
    html += '<div class="dd-list">';
    for (const node of select.children) {
      if (node.tagName === 'OPTGROUP') {
        if (node.children.length) html += `<div class="dd-group">${esc(node.label)}</div>`;
        for (const opt of node.children) html += optionHtml(opt);
      } else html += optionHtml(node);
    }
    html += '</div>';
    function optionHtml(opt) {
      const i = items.push(opt) - 1;
      const initials = opt.dataset.initials;
      return `<div class="dd-option ${opt.selected ? 'is-selected' : ''} ${opt.disabled ? 'is-disabled' : ''}" role="option" data-i="${i}" aria-selected="${opt.selected}">
        ${initials ? `<span class="avatar sm">${esc(initials)}</span>` : ''}<span class="dd-text">${esc(opt.text)}</span>${opt.selected ? `<span class="dd-check">${ICONS.check}</span>` : ''}</div>`;
    }
    panel.innerHTML = html;
    document.body.append(panel);
    const rect = anchor.getBoundingClientRect();
    const width = Math.max(rect.width, 220);
    const below = window.innerHeight - rect.bottom;
    panel.style.minWidth = `${width}px`;
    panel.style.left = `${Math.min(rect.left, window.innerWidth - width - 8)}px`;
    if (below < 260 && rect.top > below) { panel.style.bottom = `${window.innerHeight - rect.top + 6}px`; panel.classList.add('is-up'); }
    else panel.style.top = `${rect.bottom + 6}px`;
    panel.querySelector('.dd-list').style.maxHeight = `${Math.max(160, Math.min(320, (panel.classList.contains('is-up') ? rect.top : below) - 70))}px`;
    let active = Math.max(0, items.findIndex(o => o.selected));
    const options = () => $$('.dd-option:not([hidden]):not(.is-disabled)', panel);
    const setActive = el => {
      $$('.dd-option.is-active', panel).forEach(x => x.classList.remove('is-active'));
      if (!el) return;
      el.classList.add('is-active');
      el.scrollIntoView({ block: 'nearest' });
      active = Number(el.dataset.i);
    };
    setActive(panel.querySelector(`[data-i="${active}"]`));
    const choose = el => {
      const opt = items[Number(el.dataset.i)];
      if (!opt || opt.disabled) return;
      const changed = select.value !== opt.value;
      select.value = opt.value;
      closeDropdown();
      trigger.focus();
      if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
    };
    panel.addEventListener('mousedown', event => event.preventDefault());
    panel.addEventListener('click', event => { const el = event.target.closest('.dd-option'); if (el) choose(el); });
    panel.addEventListener('mousemove', event => { const el = event.target.closest('.dd-option:not(.is-disabled)'); if (el && Number(el.dataset.i) !== active) setActive(el); });
    const search = panel.querySelector('.dd-search input');
    search?.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      $$('.dd-option', panel).forEach(el => { el.hidden = q && !el.textContent.toLowerCase().includes(q); });
      $$('.dd-group', panel).forEach(g => { let n = g.nextElementSibling; let any = false; while (n && !n.classList.contains('dd-group')) { if (!n.hidden) any = true; n = n.nextElementSibling; } g.hidden = !any; });
      setActive(options()[0]);
    });
    let typed = ''; let typedAt = 0;
    const onKey = event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(event.key)) event.stopPropagation();
      const list = options();
      const idx = list.findIndex(el => Number(el.dataset.i) === active);
      if (event.key === 'ArrowDown') { event.preventDefault(); setActive(list[Math.min(list.length - 1, idx + 1)]); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(list[Math.max(0, idx - 1)]); }
      else if (event.key === 'Home') { event.preventDefault(); setActive(list[0]); }
      else if (event.key === 'End') { event.preventDefault(); setActive(list[list.length - 1]); }
      else if (event.key === 'Enter') { event.preventDefault(); const el = list[idx]; if (el) choose(el); }
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDropdown(); trigger.focus(); }
      else if (event.key === 'Tab') closeDropdown();
      else if (!search && event.key.length === 1) {
        typed = Date.now() - typedAt > 700 ? event.key.toLowerCase() : typed + event.key.toLowerCase();
        typedAt = Date.now();
        const hit = list.find(el => el.textContent.trim().toLowerCase().startsWith(typed));
        if (hit) setActive(hit);
      }
    };
    document.addEventListener('keydown', onKey, true);
    trigger.setAttribute('aria-expanded', 'true');
    anchor.classList.add('dd-open');
    DD.open = { select, panel, onKey, anchor };
    if (search) setTimeout(() => search.focus(), 0);
  }
  function closeDropdown() {
    if (!DD.open) return;
    const { select, panel, onKey, anchor } = DD.open;
    document.removeEventListener('keydown', onKey, true);
    panel.remove();
    select._dd?.trigger.setAttribute('aria-expanded', 'false');
    anchor.classList.remove('dd-open');
    DD.open = null;
  }
  document.addEventListener('mousedown', event => { if (DD.open && !event.target.closest('.dd-panel, .dd-trigger, .pill-select')) closeDropdown(); });
  window.addEventListener('resize', closeDropdown);
  document.addEventListener('scroll', event => { if (DD.open && !event.target.closest?.('.dd-panel')) closeDropdown(); }, true);
  // Enhance every <select> as soon as it appears (pages, modals, forms).
  new MutationObserver(records => {
    for (const r of records) for (const n of r.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'SELECT') enhanceSelect(n); else n.querySelectorAll?.('select').forEach(enhanceSelect);
    }
  }).observe(document.body, { childList: true, subtree: true });

  const stage = id => S.meta.stages.find(item => item.id === id) || { id, label: id };
  const stagePill = id => `<span class="pill st-${esc(id)}">${esc(stage(id).label)}</span>`;
  const sourceLabel = id => S.meta.sources.find(item => item.id === id)?.label || id || '—';
  const outcomeLabel = id => [...S.meta.outcomes, ...(S.meta.legacyOutcomes || [])].find(item => item.id === id)?.label || id;
  const member = username => S.meta.team.find(item => item.username.toLowerCase() === String(username || '').toLowerCase());
  const memberName = username => (username ? member(username)?.displayName || username : 'Unassigned');
  function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'; }
  // Red "Enquired again" badge for 7 days after a repeat enquiry.
  function repeatBadge(c) {
    if (!c.repeatEnquiryAt || Date.now() - new Date(c.repeatEnquiryAt).getTime() > 7 * 86400000) return '';
    const n = Number(c.enquiryCount) || 0;
    const ord = n ? `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}` : '';
    return `<span class="repeat-badge" title="Enquired again ${esc(relTime(c.repeatEnquiryAt))}">↻ Enquired again${ord ? ` · ${ord}` : ''}</span>`;
  }
  function ownerHtml(username) {
    if (!username) return '<span class="owner-cell muted"><span class="avatar sm empty">–</span>Unassigned</span>';
    const name = memberName(username);
    return `<span class="owner-cell"><span class="avatar sm" title="${esc(name)}">${esc(initials(name))}</span>${esc(name.split(' ')[0])}</span>`;
  }
  function telHref(phone) { const digits = String(phone || '').replace(/[^\d+]/g, ''); return `tel:${digits}`; }
  function waHref(phone, text = '') {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) digits = `91${digits}`;
    if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
    return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  }
  // Customers, calls and schedules are only ever given to SALES AGENTS, so people pickers list agents only.
  const agents = () => S.meta.team.filter(m => m.role === 'agent');
  function agentOptions(selected, { label = 'Staff' } = {}) {
    const sel = String(selected || '').toLowerCase();
    const list = agents();
    // Keep an older owner who isn't an agent visible, so the current value still shows.
    const extra = sel && !['me', 'unassigned', 'all', '__auto', '__none', '__'].includes(sel) && !list.some(m => m.username.toLowerCase() === sel)
      ? `<option value="${esc(selected)}" selected>${esc(memberName(selected))} (not staff)</option>` : '';
    return `<optgroup label="${esc(label)}">${list.map(m => `<option value="${esc(m.username)}" data-initials="${esc(initials(m.displayName))}" ${sel === m.username.toLowerCase() ? 'selected' : ''}>${esc(m.displayName)}</option>`).join('')}${extra}</optgroup>`;
  }
  function teamOptions(selected, { includeUnassigned = true, unassignedLabel = 'Unassigned' } = {}) {
    return `${includeUnassigned ? `<option value="" ${selected ? '' : 'selected'}>${esc(unassignedLabel)}</option>` : ''}${agentOptions(selected)}`;
  }
  function stageOptions(selected, { exclude = [] } = {}) {
    return S.meta.stages.filter(s => !exclude.includes(s.id)).map(s => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(s.label)}</option>`).join('');
  }
  function planDatalist(id = 'planList') {
    const plans = [...new Set([...STANDARD_PLANS, ...S.plans.map(p => p.plan)])];
    return `<datalist id="${id}">${plans.map(p => `<option value="${esc(p)}">`).join('')}</datalist>`;
  }
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [pathPart, queryPart = ''] = raw.split('?');
    const parts = pathPart.split('/').filter(Boolean);
    return { route: parts[0] || 'dashboard', id: parts[1], query: Object.fromEntries(new URLSearchParams(queryPart)) };
  }
  function setQuery(route, query) {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v !== undefined && v !== null)).toString();
    const next = `#/${route}${qs ? `?${qs}` : ''}`;
    if (location.hash !== next) location.hash = next; else render();
  }

  // ---------------------------------------------------------------- modal
  function openModal(title, html, onMount, { wide = false } = {}) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modal .modal').style.maxWidth = wide ? '680px' : '';
    $('#modal').hidden = false;
    onMount?.($('#modalBody'));
    setTimeout(() => $('#modalBody input:not([type=hidden]), #modalBody select, #modalBody textarea')?.focus(), 30);
  }
  function closeModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; }
  $('#modal').addEventListener('click', event => { if (event.target.id === 'modal' || event.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#modal').hidden) closeModal(); });

  function askLostReason(name) {
    return new Promise(resolve => {
      openModal(`Mark ${name} as Not interested`, `
        <form class="stack" id="lostForm">
          <label class="field"><span>Reason</span>
            <select id="lostPreset">
              <option>Not interested right now</option>
              <option>Monthly instalment too high</option>
              <option>Joined another chit fund</option>
              <option>Wanted a loan, not a chit</option>
              <option>Could not reach after many attempts</option>
              <option>Wrong / fake details</option>
              <option value="">Other (write below)</option>
            </select>
          </label>
          <label class="field"><span>Details (optional)</span><textarea id="lostText" rows="3" placeholder="Anything the team should know"></textarea></label>
          <div class="form-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Mark Not interested</button></div>
        </form>`, body => {
        $('#lostForm', body).addEventListener('submit', event => {
          event.preventDefault();
          const reason = [$('#lostPreset', body).value, $('#lostText', body).value.trim()].filter(Boolean).join(' — ');
          if (!reason) return toast('Please add a reason.', 'error');
          closeModal();
          resolve(reason);
        });
        $('#modal').addEventListener('click', function onClose(event) {
          if (event.target.id === 'modal' || event.target.closest('[data-close]')) { $('#modal').removeEventListener('click', onClose); resolve(null); }
        });
      });
    });
  }

  // ---------------------------------------------------------------- auth
  function showLogin() {
    $('#app').hidden = true;
    $('#loginScreen').hidden = false;
    $('#loginForm').hidden = false;
    $('#otpForm').hidden = true;
    $('#forgotForm').hidden = true;
    $('#resetForm').hidden = true;
    setTimeout(() => $('#loginUser').focus(), 30);
  }
  let pendingLogin = null;
  async function doLogin(body, errorEl) {
    errorEl.hidden = true;
    try {
      const result = await api('/api/admin/login', { method: 'POST', body });
      if (result.requireOtp) {
        pendingLogin = body;
        $('#otpEmail').textContent = result.maskedEmail || 'your email';
        $('#loginForm').hidden = true;
        $('#otpForm').hidden = false;
        $('#otpCode').focus();
        return;
      }
      await startApp();
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
    }
  }
  $('#loginForm').addEventListener('submit', event => {
    event.preventDefault();
    doLogin({ username: $('#loginUser').value.trim(), password: $('#loginPass').value }, $('#loginError'));
  });
  // Forgot password (owner account): request a code by email, then set a new password.
  $('#forgotLink').addEventListener('click', event => {
    event.preventDefault();
    $('#loginForm').hidden = true; $('#forgotForm').hidden = false; $('#resetForm').hidden = true;
    $('#forgotId').focus();
  });
  $$('[data-back-login]').forEach(el => el.addEventListener('click', event => { event.preventDefault(); showLogin(); }));
  $('#forgotForm').addEventListener('submit', async event => {
    event.preventDefault();
    const err = $('#forgotError'); err.hidden = true;
    try {
      const r = await api('/api/admin/forgot-password/request', { method: 'POST', body: { identifier: $('#forgotId').value.trim() } });
      $('#resetNote').textContent = r.message;
      $('#forgotForm').hidden = true; $('#resetForm').hidden = false; $('#resetCode').focus();
    } catch (error) { err.textContent = error.message; err.hidden = false; }
  });
  $('#resetForm').addEventListener('submit', async event => {
    event.preventDefault();
    const err = $('#resetError'); err.hidden = true;
    try {
      await api('/api/admin/forgot-password/reset', { method: 'POST', body: { identifier: $('#forgotId').value.trim(), otpCode: $('#resetCode').value.trim(), newPassword: $('#resetPass').value } });
      toast('Password changed. You are signed in.');
      await startApp();
    } catch (error) { err.textContent = error.message; err.hidden = false; }
  });
  $('#otpForm').addEventListener('submit', event => {
    event.preventDefault();
    doLogin({ ...pendingLogin, otpCode: $('#otpCode').value.trim() }, $('#otpError'));
  });
  // Name card at the bottom of the menu: shows who is signed in; clicking it opens My account / Log out.
  function paintMe() {
    const roleLabel = S.meta.roles.find(r => r.id === S.me.role)?.label || S.me.role;
    $('#meName').textContent = S.me.displayName || S.me.username;
    $('#meRole').textContent = S.me.designation || roleLabel;
    $('#meAvatar').textContent = initials(S.me.displayName || S.me.username);
    $('#meMenuName').textContent = S.me.displayName || S.me.username;
    $('#meMenuSub').textContent = S.me.designation || roleLabel;
  }
  const meMenu = $('#meMenu');
  const toggleMeMenu = open => {
    meMenu.hidden = !open;
    $('#meCard').setAttribute('aria-expanded', String(open));
  };
  $('#meCard').addEventListener('click', event => { event.stopPropagation(); toggleMeMenu(meMenu.hidden); });
  document.addEventListener('click', event => {
    const back = event.target.closest('[data-back]');
    if (back && history.length > 1) { event.preventDefault(); history.back(); }
  });
  document.addEventListener('click', event => { if (!meMenu.hidden && !event.target.closest('#meMenu, #meCard')) toggleMeMenu(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !meMenu.hidden) toggleMeMenu(false); });
  $('#meMenuAccount').addEventListener('click', () => { toggleMeMenu(false); location.hash = '#/account'; });
  $('#meMenuLogout').addEventListener('click', () => {
    toggleMeMenu(false);
    openModal('Log out?', `
      <div class="stack">
        <p style="margin:0">You will be signed out of the admin panel on this device. Any unsaved changes will be lost.</p>
        <div class="form-actions"><button type="button" class="btn" data-close>Stay signed in</button><button type="button" class="btn btn-danger-solid" id="confirmLogout">Log out</button></div>
      </div>`, body => {
      $('#confirmLogout', body).focus();
      $('#confirmLogout', body).addEventListener('click', async () => {
        closeModal();
        clearInterval(ALERTS.timer);
        await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
        location.hash = '';
        showLogin();
      });
    });
  });

  async function startApp() {
    S.meta = await api('/api/crm/meta');
    S.me = S.meta.me;
    // Everyone starts on the whole team's dashboard; "Mine" narrows it to their own enquiries.
    S.dashScope = S.dashScope || 'all';
    // Managers see everyone's schedules by default; staff only ever see their own.
    S.followAssignee = S.me.isManager ? (S.followTouched ? S.followAssignee : 'all') : 'me';
    api('/api/crm/plans').then(r => { S.plans = r.plans; }).catch(() => {});
    document.body.className = `role-${S.me.role}`;
    paintMe();
    $('#emailBanner').hidden = S.meta.emailConfigured || !S.me.isManager;
    $('#loginScreen').hidden = true;
    $('#app').hidden = false;
    refreshFollowCount();
    startAlerts();
    render();
  }

  async function refreshSupportCount() {
    try {
      const { open } = await api('/api/crm/support/count');
      const el = $('#navSupportCount');
      el.textContent = open;
      el.hidden = !open;
    } catch { /* ignore */ }
  }

  async function refreshFollowCount() {
    refreshSupportCount();
    try {
      const { tasks } = await api('/api/crm/tasks?assignee=me');
      const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
      const due = tasks.filter(t => new Date(t.dueAt) <= endOfToday).length;
      const el = $('#navFollowCount');
      el.textContent = due;
      el.hidden = !due;
    } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------- per-browser preferences
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
  };

  // ---------------------------------------------------------------- new-enquiry alerts
  const ALERTS = { timer: null, known: null, data: null, audio: null };
  const seenKey = () => `sainand.crm.seen.${S.me?.username}`;
  const soundOn = () => store.get('sainand.crm.sound', true);
  function chime() {
    if (!soundOn()) return;
    try {
      ALERTS.audio = ALERTS.audio || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = ALERTS.audio;
      [[880, 0], [1320, 0.16]].forEach(([freq, at]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + at);
        osc.stop(ctx.currentTime + at + 0.32);
      });
    } catch { /* audio not available */ }
  }
  // Browsers only allow sound after the user has clicked something on the page.
  document.addEventListener('click', () => {
    try { ALERTS.audio = ALERTS.audio || new (window.AudioContext || window.webkitAudioContext)(); ALERTS.audio.resume(); } catch { /* ignore */ }
  }, { once: true });

  function leadKey(lead) { return `${lead.id}:${lead.at}`; }
  async function pollAlerts() {
    if (!S.me) return;
    let data;
    try { data = await api('/api/crm/notifications', { headers: { 'X-Background': '1' } }); } catch { return; }
    ALERTS.data = data;
    // First visit on this computer: treat the last 24 hours of enquiries as unread.
    if (!store.get(seenKey(), null)) store.set(seenKey(), new Date(new Date(data.serverTime).getTime() - 86400000).toISOString());
    const seen = store.get(seenKey(), data.serverTime);
    const unread = data.leads.filter(lead => lead.at > seen);
    $('#bellCount').textContent = unread.length > 9 ? '9+' : unread.length;
    $('#bellCount').hidden = !unread.length;
    const followEl = $('#navFollowCount');
    followEl.textContent = data.followUpsDue;
    followEl.hidden = !data.followUpsDue;

    const keys = new Set(data.leads.map(leadKey));
    if (ALERTS.known) {
      const fresh = data.leads.filter(lead => !ALERTS.known.has(leadKey(lead)) && lead.at > seen);
      if (fresh.length) announce(fresh);
    }
    ALERTS.known = keys;
    if (!$('#bellPanel').hidden) drawBell();
  }
  function announce(fresh) {
    const lead = fresh[0];
    const more = fresh.length > 1 ? ` (+${fresh.length - 1} more)` : '';
    const who = lead.owner ? (lead.owner.toLowerCase() === S.me.username.toLowerCase() ? 'assigned to you' : `assigned to ${lead.ownerName || lead.owner}`) : 'NOT ASSIGNED — no staff member available, please assign';
    toast(`${lead.owner ? '🔔' : '⚠️'} ${lead.repeat ? 'Enquired again' : 'New enquiry'}: ${lead.name}${lead.plan ? ` · ${lead.plan}` : ''} — ${who}${more}`, lead.owner ? '' : 'error');
    chime();
    $('#bellBtn').classList.remove('ring'); void $('#bellBtn').offsetWidth; $('#bellBtn').classList.add('ring');
    if ('Notification' in window && Notification.permission === 'granted' && (document.hidden || !document.hasFocus())) {
      try {
        const n = new Notification(`New enquiry: ${lead.name}`, { body: `${lead.plan || 'Plan not specified'} · ${who}${more}`, icon: '/images/logo.webp', tag: `lead-${lead.id}` });
        n.onclick = () => { window.focus(); location.hash = `#/customers/${lead.id}`; n.close(); };
      } catch { /* notifications unavailable */ }
    }
    if (parseHash().route === 'dashboard' && $('#modal').hidden) renderDashboard().catch(() => {});
  }
  function drawBell() {
    const data = ALERTS.data;
    if (!data) return;
    const seen = store.get(seenKey(), data.serverTime);
    $('#bellList').innerHTML = data.leads.length ? data.leads.map(lead => `
      <li data-lead="${lead.id}" class="${lead.at > seen ? 'unread' : ''}">
        <span class="avatar">${esc(initials(lead.name))}</span>
        <div class="grow"><span class="title">${esc(lead.name)}</span>
          <div class="sub">${lead.repeat ? '<strong style="color:var(--brand)">Enquired again</strong> · ' : ''}${esc(lead.plan || 'Plan not specified')} · ${esc(sourceLabel(lead.source))} · ${relTime(lead.at)}</div>
          <div class="sub">${lead.owner ? `→ ${esc(lead.ownerName || lead.owner)}` : 'Unassigned'}${lead.responded ? '' : ' · <strong style="color:var(--danger)">Not called yet</strong>'}</div></div>
      </li>`).join('') : '<li class="muted" style="display:block">No enquiries in the last 3 days.</li>';
    $$('#bellList [data-lead]').forEach(li => li.addEventListener('click', () => { closeBell(); location.hash = `#/customers/${li.dataset.lead}`; }));
    $('#bellDesktop').hidden = !('Notification' in window) || Notification.permission !== 'default';
    $('#bellSound').checked = soundOn();
  }
  function openBell() {
    $('#bellPanel').hidden = false;
    $('#bellBtn').setAttribute('aria-expanded', 'true');
    drawBell();
    if (ALERTS.data) store.set(seenKey(), ALERTS.data.serverTime);
    $('#bellCount').hidden = true;
  }
  function closeBell() { $('#bellPanel').hidden = true; $('#bellBtn').setAttribute('aria-expanded', 'false'); }
  $('#bellBtn').addEventListener('click', event => { event.stopPropagation(); $('#bellPanel').hidden ? openBell() : closeBell(); });
  document.addEventListener('click', event => { if (!$('#bellPanel').hidden && !event.target.closest('.bell-wrap')) closeBell(); });
  $('#bellMarkRead').addEventListener('click', () => { if (ALERTS.data) store.set(seenKey(), ALERTS.data.serverTime); drawBell(); $('#bellCount').hidden = true; });
  $('#bellSound').addEventListener('change', event => { store.set('sainand.crm.sound', event.target.checked); if (event.target.checked) chime(); });
  $('#bellDesktop').addEventListener('click', async () => { try { await Notification.requestPermission(); } catch { /* ignore */ } drawBell(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollAlerts(); });
  function startAlerts() {
    clearInterval(ALERTS.timer);
    ALERTS.known = null;
    pollAlerts();
    ALERTS.timer = setInterval(pollAlerts, 30000);
  }

  // ---------------------------------------------------------------- shell
  $('#menuBtn').addEventListener('click', () => document.body.classList.add('menu-open'));
  $('#sidebarBackdrop').addEventListener('click', () => document.body.classList.remove('menu-open'));
  $('#globalSearch').addEventListener('submit', event => {
    event.preventDefault();
    setQuery('customers', { view: 'all', q: $('#globalSearchInput').value.trim() });
  });
  $('#addCustomerBtn').addEventListener('click', () => openAddCustomer());
  window.addEventListener('hashchange', render);

  const CUSTOMER_ROUTES = ['dashboard', 'customers', 'followups'];
  // Press "/" anywhere (outside a text box) to search customers.
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable]') || !$('#modal').hidden || $('#app').hidden) return;
    event.preventDefault();
    if ($('#globalSearch').hidden) location.hash = '#/customers?view=all';
    setTimeout(() => $('#globalSearchInput').focus(), 50);
  });
  const TITLES = { dashboard: 'Dashboard', customers: 'Enquiries', followups: 'Schedules', support: 'Support', team: 'Team', news: 'News & media', careers: 'Careers', site: 'Site pages', account: 'My account' };
  async function render() {
    if (!S.meta) return;
    document.body.classList.remove('menu-open');
    const { route, id, query } = parseHash();
    const allowed = { team: S.me.isOwner, site: S.me.isOwner, news: S.me.isOwner, careers: S.me.isOwner };
    if (allowed[route] === false) { location.hash = '#/dashboard'; return; }
    $$('.nav a[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    // Customer search and "Add customer" only belong to the customer-work screens.
    const customerScreen = CUSTOMER_ROUTES.includes(route);
    $('#globalSearch').hidden = !customerScreen;
    document.body.classList.toggle('on-customer-list', route === 'customers' && !id);
    $('#addCustomerBtn').hidden = !customerScreen;
    $('#pageTitle').textContent = route === 'customers' && id ? 'Enquiry' : route === 'support' && id ? 'Support request' : (TITLES[route] || 'Dashboard');
    document.title = `${$('#pageTitle').textContent} · Sainand CRM`;
    view().innerHTML = '<div class="loading">Loading…</div>';
    try {
      if (route === 'customers' && id) await renderCustomer(Number(id), query);
      else if (route === 'customers') await renderCustomers(query);
      else if (route === 'followups') await renderFollowups();
      else if (route === 'support' && id) await renderSupportRequest(Number(id));
      else if (route === 'support') await renderSupport(query);
      else if (route === 'team' && S.me.isOwner) await renderTeam();
      else if (route === 'news' && S.me.isOwner) await renderNews();
      else if (route === 'careers' && S.me.isOwner) await renderCareers(query);
      else if (route === 'site' && S.me.isOwner) await renderSite(query);
      else if (route === 'account') await renderAccount();
      else await renderDashboard();
    } catch (error) {
      view().innerHTML = `<div class="card card-empty">${esc(error.message)}</div>`;
    }
    view().focus({ preventScroll: true });
  }


  // ---------------------------------------------------------------- support requests
  const SUPPORT_STATUS = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' };
  const supportStatusPill = id => `<span class="pill sr-st-${esc(id)}">${esc(SUPPORT_STATUS[id] || id)}</span>`;
  function supportTopicChip(r) {
    return `<span class="sr-topic${r.priority ? ' is-priority' : ''}">${r.priority ? '⚠ ' : ''}${esc(r.topicLabel)}</span>`;
  }
  function teamPicker(selected) {
    const sel = String(selected || '').toLowerCase();
    return `<option value="" ${sel ? '' : 'selected'}>Unassigned</option>${S.meta.team.map(m => `<option value="${esc(m.username)}" ${sel === m.username.toLowerCase() ? 'selected' : ''}>${esc(m.displayName)}</option>`).join('')}`;
  }

  async function renderSupport(query = {}) {
    const status = ['open', 'in_progress', 'resolved', 'all'].includes(query.status) ? query.status : 'open';
    const mine = query.mine === '1';
    const q = query.q || '';
    const data = await api(`/api/crm/support?status=${status}${mine ? '&mine=1' : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
    const tab = (id, label) => `<a href="#/support?status=${id}${mine ? '&mine=1' : ''}" class="${id === status ? 'on' : ''}">${label} <span class="muted">${data.counts[id]}</span></a>`;
    view().innerHTML = `
      <div class="page-head">
        <div><h2>Support</h2><p>Requests raised on the website's Support Center. Plan questions also appear in Enquiries.</p></div>
        <div class="sr-head-tools">
          <form id="srSearch" class="sr-search"><input name="q" value="${esc(q)}" placeholder="Search name, mobile or SR number" aria-label="Search support requests"></form>
          <div class="seg" role="group" aria-label="Show">
            <button data-mine="0" class="${mine ? '' : 'on'}">Everyone</button>
            <button data-mine="1" class="${mine ? 'on' : ''}">Mine</button>
          </div>
        </div>
      </div>
      <div class="tabs">${tab('open', 'Open')}${tab('in_progress', 'In progress')}${tab('resolved', 'Resolved')}${tab('all', 'All')}</div>
      <section class="card">
        ${data.requests.length ? `<div class="table-wrap"><table class="data sr-table">
          <thead><tr><th>Request</th><th>From</th><th class="hide-sm">Received</th><th class="sr-col-status">Status</th><th class="hide-sm">Assigned to</th></tr></thead>
          <tbody>${data.requests.map(r => `
            <tr data-id="${r.id}" class="${r.priority && r.status !== 'resolved' ? 'is-priority' : ''}">
              <td><div class="sr-ref-cell"><strong>${esc(r.ref)}<span class="sr-mob-status">${supportStatusPill(r.status)}</span></strong>${supportTopicChip(r)}${r.alsoInEnquiries ? '<span class="sr-also" title="This request is also in Enquiries">Also in Enquiries</span>' : ''}</div></td>
              <td><div class="cust-cell"><span class="avatar">${esc(initials(r.name))}</span><div><strong>${esc(r.name)}</strong><div class="cust-sub"><a class="phone-link" href="${telHref(r.phone)}">${esc(r.phone)}</a>${r.memberNo ? `<span class="sr-member">Member ${esc(r.memberNo)}</span>` : ''}</div></div></div></td>
              <td class="hide-sm enq-when">${enquiredWhen(r.createdAt)}</td>
              <td class="sr-col-status">${supportStatusPill(r.status)}</td>
              <td class="hide-sm">${ownerHtml(r.assignedTo)}</td>
            </tr>`).join('')}</tbody></table></div>`
          : `<div class="card-empty">${q ? 'No requests match your search.' : status === 'open' ? 'No open support requests. 🎉' : 'Nothing here yet.'}</div>`}
      </section>`;
    $$('.seg button', view()).forEach(btn => btn.addEventListener('click', () => setQuery('support', { status, mine: btn.dataset.mine === '1' ? '1' : '', q })));
    $('#srSearch').addEventListener('submit', event => { event.preventDefault(); setQuery('support', { status: 'all', mine: mine ? '1' : '', q: event.target.q.value.trim() }); });
    $$('tbody tr', view()).forEach(tr => tr.addEventListener('click', event => {
      if (event.target.closest('a')) return;
      location.hash = `#/support/${tr.dataset.id}`;
    }));
    refreshSupportCount();
  }

  async function renderSupportRequest(id) {
    const { request: r, notes, statuses } = await api(`/api/crm/support/${id}`);
    const noteIcon = n => (n.kind === 'system' ? '•' : '✎');
    view().innerHTML = `
      <div class="row" style="margin-bottom:10px"><a href="#/support" class="btn btn-ghost btn-sm">${ICONS.back}All support requests</a></div>
      <div class="cust-header sr-header">
        <div class="grow">
          <div class="sr-title-row"><h2>${esc(r.ref)}</h2>${supportStatusPill(r.status)}${supportTopicChip(r)}</div>
          <p class="muted">Received ${esc(fmtDate(r.createdAt))} · ${esc(relTime(r.createdAt))}${r.resolvedAt ? ` · resolved ${esc(fmtDate(r.resolvedAt))}` : ''}</p>
        </div>
        <div class="cust-actions">
          <a class="btn btn-call" href="${telHref(r.phone)}">Call</a>
          <a class="btn btn-wa" href="${waHref(r.phone, `Hello ${r.name.split(' ')[0]}, this is about your support request ${r.ref} with Sainand Chits India.`)}" target="_blank" rel="noopener">WhatsApp</a>
          ${r.contactId ? `<a class="btn" href="#/customers/${r.contactId}">${r.alsoInEnquiries ? 'Open in Enquiries' : 'Open customer'}</a>` : ''}
        </div>
      </div>
      <div class="cust-main">
        <div>
          <section class="card">
            <div class="card-head"><h2>Request</h2>${r.alsoInEnquiries ? '<span class="sr-also">Also in Enquiries</span>' : ''}</div>
            <div class="card-body">
              <div class="sr-message">${esc(r.message).replace(/\n/g, '<br>')}</div>
              <dl class="sr-facts">
                <div><dt>Name</dt><dd>${esc(r.name)}</dd></div>
                <div><dt>Mobile</dt><dd><a class="phone-link" href="${telHref(r.phone)}">${esc(r.phone)}</a></dd></div>
                <div><dt>Email</dt><dd>${r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : '<span class="muted">Not given</span>'}</dd></div>
                <div><dt>Member / group no.</dt><dd>${esc(r.memberNo || '—')}</dd></div>
                ${r.contactId ? `<div><dt>Customer record</dt><dd><a href="#/customers/${r.contactId}">${esc(r.contactName || 'Open')}</a></dd></div>` : ''}
              </dl>
            </div>
          </section>
          <section class="card">
            <div class="card-head"><h2>Notes &amp; history</h2><span class="muted">${notes.length}</span></div>
            <form id="srNoteForm" class="card-body sr-note-form">
              <textarea name="body" rows="3" placeholder="Add a note: what you did, what the customer said, what is next…" required></textarea>
              <div class="form-actions"><button class="btn btn-primary" type="submit">Add note</button></div>
            </form>
            <ul class="sr-notes">${notes.map(n => `
              <li class="${n.kind === 'system' ? 'is-system' : ''}"><span class="sr-note-dot">${noteIcon(n)}</span><div><p>${esc(n.body).replace(/\n/g, '<br>')}</p><small>${n.author ? `${esc(n.authorName)} · ` : ''}${esc(fmtDate(n.createdAt))}</small></div></li>`).join('')}</ul>
          </section>
        </div>
        <div>
          <section class="card">
            <div class="card-head"><h2>Handle this request</h2></div>
            <div class="card-body sr-handle">
              <div class="field"><span>Status</span>
                <div class="sr-status-btns" role="group" aria-label="Status">${statuses.map(st => `<button type="button" data-status="${st.id}" class="${st.id === r.status ? 'on' : ''} sr-st-${st.id}-btn" aria-pressed="${st.id === r.status}">${esc(st.label)}</button>`).join('')}</div>
              </div>
              <label class="field"><span>Assigned to</span><select id="srAssign">${teamPicker(r.assignedTo)}</select></label>
              <p class="muted small">${r.priority ? '⚠ Complaint: please respond quickly. Admins were emailed when it came in.' : 'The person assigned gets an email.'}</p>
            </div>
          </section>
        </div>
      </div>`;
    const save = async body => {
      try { await api(`/api/crm/support/${id}`, { method: 'PATCH', body }); toast('Saved'); render(); refreshSupportCount(); } catch (error) { fail(error); }
    };
    $$('.sr-status-btns button', view()).forEach(btn => btn.addEventListener('click', () => { if (btn.dataset.status !== r.status) save({ status: btn.dataset.status }); }));
    $('#srAssign').addEventListener('change', event => save({ assignedTo: event.target.value }));
    $('#srNoteForm').addEventListener('submit', async event => {
      event.preventDefault();
      const body = event.target.body.value.trim();
      if (!body) return;
      try { await api(`/api/crm/support/${id}/notes`, { method: 'POST', body: { body } }); toast('Note added'); render(); } catch (error) { fail(error); }
    });
  }

  // ---------------------------------------------------------------- dashboard
  async function renderDashboard() {
    const d = await api(`/api/crm/dashboard?scope=${S.dashScope}`);
    const mine = S.dashScope === 'mine';
    const ownerQ = mine ? '&owner=me' : '';
    const stageTotal = S.meta.stages.reduce((sum, s) => sum + (d.stages[s.id] || 0), 0);
    const followRows = [...d.overdue, ...d.dueToday];
    view().innerHTML = `
      <div class="page-head">
        <div><h2>Good ${greeting()}, ${esc((S.me.displayName || '').split(' ')[0] || S.me.username)}</h2><p>${followRows.length ? (mine ? `You have ${followRows.length} schedule${followRows.length === 1 ? '' : 's'} to do today.` : `The team has ${followRows.length} schedule${followRows.length === 1 ? '' : 's'} to do today.`) : 'No schedules pending for today.'}</p></div>
        <div class="seg" role="group" aria-label="Show">
          <button data-scope="all" class="${mine ? '' : 'on'}">Everyone</button>
          <button data-scope="mine" class="${mine ? 'on' : ''}">Mine</button>
        </div>
      </div>
      <div class="kpis kpis-4">
        <a class="kpi" href="#/customers?view=new_today${ownerQ}"><span>New today</span><strong>${d.counts.new_today}</strong><small>${d.counts.new_week} this week</small></a>
        <a class="kpi ${d.counts.untouched ? 'is-alert' : ''}" href="#/customers?view=untouched${ownerQ}"><span>Not called yet</span><strong>${d.counts.untouched}</strong><small>New enquiries waiting</small></a>
        <a class="kpi ${d.overdue.length ? 'is-alert' : ''}" href="#/followups"><span>Due today</span><strong>${d.overdue.length + d.dueToday.length}</strong><small>${d.overdue.length ? `${d.overdue.length} overdue` : 'None overdue'}</small></a>
        <a class="kpi" href="#/customers?view=all&stage=converted${ownerQ}"><span>Converted this month</span><strong>${d.counts.converted_month}</strong><small>from ${d.counts.new_month} enquir${d.counts.new_month === 1 ? 'y' : 'ies'} this month${d.counts.new_month ? ` · ${Math.round(100 * d.counts.converted_month / d.counts.new_month)}%` : ''}</small></a>
      </div>
      ${S.me.isManager && d.counts.unassigned && !mine ? `<div class="warn-bar">
        <span>⚠️ <strong>${d.counts.unassigned} open enquir${d.counts.unassigned === 1 ? 'y has' : 'ies have'} nobody assigned.</strong> ${d.agentsInRotation ? '' : 'Add a Staff member on the Team page so new enquiries get assigned.'}</span>
        ${d.agentsInRotation ? '<button class="btn btn-sm btn-primary" id="shareUnassigned">Assign them now</button>' : `${S.me.isOwner ? '<a class="btn btn-sm" href="#/team">Open Team</a>' : ''}`}
      </div>` : ''}
      <div class="dash-grid">
        <div>
          <section class="card">
            <div class="card-head"><h2>Today's schedules</h2><a href="#/followups" class="small">View all</a></div>
            ${followRows.length ? `<ul class="list">${followRows.map(taskLi).join('')}</ul>` : '<div class="card-empty">Nothing due today. Add a schedule from an enquiry\'s page after each call.</div>'}
          </section>
          <section class="card">
            <div class="card-head"><h2>New enquiries waiting for a first call</h2><a href="#/customers?view=untouched${ownerQ}" class="small">View all</a></div>
            ${d.newLeads.length ? `<ul class="list">${d.newLeads.map(c => `
              <li>
                <span class="avatar">${esc(initials(c.name))}</span>
                <div class="grow"><a class="title" href="#/customers/${c.id}">${esc(c.name)}</a><div class="sub">${esc(c.plan || 'Plan not specified')} · ${esc(sourceLabel(c.source))} · ${relTime(c.createdAt)}</div></div>
                ${ownerHtml(c.owner)}
                <a class="btn btn-sm btn-call" href="${telHref(c.phone)}" data-call="${c.id}">${ICONS.phone}Call</a>
              </li>`).join('')}</ul>` : '<div class="card-empty">All new enquiries have been contacted. 🎉</div>'}
          </section>
        </div>
        <div>
          <section class="card">
            <div class="card-head"><h2>Enquiries by status</h2><a href="#/customers" class="small">Open list</a></div>
            <div class="card-body">
              <div class="stage-bar" role="img" aria-label="Customers by status">${S.meta.stages.map(s => d.stages[s.id] ? `<span style="flex:${d.stages[s.id]};background:var(--st-${s.id})" title="${esc(s.label)}: ${d.stages[s.id]}"></span>` : '').join('') || '<span style="flex:1;background:#eee"></span>'}</div>
              <div class="stage-legend">${S.meta.stages.map(s => `<a href="#/customers?view=all&stage=${s.id}${ownerQ}"><span><i class="swatch" style="background:var(--st-${s.id})"></i>${esc(s.label)}</span><strong>${d.stages[s.id] || 0}</strong></a>`).join('')}</div>
              <p class="muted small" style="margin:12px 0 0">${stageTotal} enquiries in total</p>
            </div>
          </section>
          <section class="card">
            <div class="card-head"><h2>Recent activity</h2></div>
            ${d.recentActivity.length ? `<ul class="feed">${d.recentActivity.map(a => `
              <li><span class="feed-icon">${ICONS[ACTIVITY_ICON[a.type]] || ICONS.info}</span>
                <div><a href="#/customers/${a.contactId}"><strong>${esc(a.contactName)}</strong></a> · ${esc(activitySummary(a))}<div class="when">${a.createdBy ? `${esc(memberName(a.createdBy))} · ` : ''}${relTime(a.createdAt)}</div></div>
              </li>`).join('')}</ul>` : '<div class="card-empty">No activity yet.</div>'}
          </section>
        </div>
      </div>`;
    $$('[data-scope]').forEach(btn => btn.addEventListener('click', () => { S.dashScope = btn.dataset.scope; renderDashboard().catch(fail); }));
    $('#shareUnassigned')?.addEventListener('click', async event => {
      event.target.disabled = true;
      try {
        const r = await api('/api/crm/assign-unassigned', { method: 'POST' });
        toast(r.shared ? `Shared ${r.shared}: ${Object.entries(r.counts).map(([n, c]) => `${n.split(' ')[0]} ${c}`).join(', ')}` : 'No staff member available to share with.', r.shared ? '' : 'error');
        renderDashboard().catch(fail);
      } catch (error) { fail(error); event.target.disabled = false; }
    });
    bindCallButtons();
    bindTaskButtons(renderDashboard);
  }
  function greeting() { const h = Number(new Date().toLocaleString('en-IN', { ...IST, hour: 'numeric', hour12: false })); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; }
  function todayStartIso() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); }
  function activitySummary(a) {
    if (a.type === 'call') return `Call: ${outcomeLabel(a.outcome)}`;
    if (a.type === 'email') return `Email sent: ${a.subject}`;
    if (a.type === 'note') return 'Note added';
    if (a.type === 'whatsapp') return 'WhatsApp conversation';
    if (a.type === 'meeting') return 'Office visit / meeting';
    if (a.type === 'enquiry') return a.subject || 'New enquiry';
    return a.subject;
  }
  // Ask for an optional note when a schedule is ticked off, so the history says what happened.
  function markTaskDone(taskId, title, after) {
    openModal('Mark schedule as done', `
      <form class="stack" id="doneForm">
        <p class="muted" style="margin:0">${esc(title || 'Schedule')}</p>
        <label class="field"><span>What happened? <small class="muted">optional</small></span><textarea name="note" rows="3" placeholder="e.g. Spoke to customer, will visit office on Monday"></textarea></label>
        <p class="muted small" style="margin:0">Tip: if you called, use <strong>Call</strong> → log the call instead. The call result is saved and the schedule is closed in one step.</p>
        <div class="form-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-success">${ICONS.check}Mark done</button></div>
      </form>`, body => {
      $('#doneForm', body).addEventListener('submit', async event => {
        event.preventDefault();
        try {
          await api(`/api/crm/tasks/${taskId}`, { method: 'PATCH', body: { status: 'done', note: event.target.note.value } });
          closeModal(); toast('Schedule marked done'); refreshFollowCount(); after();
        } catch (error) { fail(error); }
      });
    });
  }
  function taskLi(t) {
    return `<li data-task="${t.id}">
      <button class="check" data-done="${t.id}" data-title="${esc(t.title)} · ${esc(t.contactName)}" title="Mark done" aria-label="Mark done">${ICONS.check}</button>
      <div class="grow"><a class="title" href="#/customers/${t.contactId}?log=${t.id}">${esc(t.contactName)}</a>
        <div class="sub">${esc(t.title)}${t.notes ? ` — ${esc(t.notes)}` : ''}${S.dashScope === 'all' || S.followAssignee !== 'me' ? ` · ${esc(memberName(t.assignee))}` : ''}</div></div>
      ${dueHtml(t.dueAt)}
      <a class="btn btn-sm btn-call" href="${telHref(t.contactPhone)}" data-call="${t.contactId}" data-task-id="${t.id}">${ICONS.phone}Call</a>
    </li>`;
  }
  // Clicking Call dials the number, then opens the customer page ready to log the call.
  function bindCallButtons(root = view()) {
    $$('[data-call]', root).forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.call;
      const taskId = btn.dataset.taskId;
      setTimeout(() => { location.hash = `#/customers/${id}?log=${taskId || 'call'}`; }, 300);
    }));
  }
  function bindTaskButtons(rerender, root = view()) {
    $$('[data-done]', root).forEach(btn => btn.addEventListener('click', event => {
      event.preventDefault();
      markTaskDone(btn.dataset.done, btn.dataset.title, () => rerender().catch(fail));
    }));
  }

  // ---------------------------------------------------------------- customers list
  const VIEWS = [
    { id: 'all', label: 'All enquiries', q: {} },
    { id: 'new_today', label: 'New today', q: { today: '1' } },
    { id: 'new', label: 'New', q: { stage: 'new' } },
    { id: 'contacted', label: 'Contacted', q: { stage: 'contacted' } },
    { id: 'interested', label: 'Interested', q: { stage: 'interested' } },
    { id: 'converted', label: 'Converted', q: { stage: 'converted' } },
    { id: 'not_interested', label: 'Not interested', q: { stage: 'not_interested' } },
    // Still reachable by link (dashboard, alerts, older bookmarks) but not shown as tabs.
    { id: 'open', label: 'Open', q: { stage: 'open' }, hidden: true },
    { id: 'mine', label: 'My enquiries', q: { owner: 'me', stage: 'open' }, hidden: true },
    { id: 'untouched', label: 'Not called yet', q: { stage: 'new', untouched: '1' }, hidden: true },
    { id: 'repeat', label: 'Enquired again', q: { repeat: '1' }, hidden: true },
    { id: 'due', label: 'Schedule due', q: { follow: 'due' }, hidden: true },
    { id: 'unassigned', label: 'Unassigned', q: { owner: 'unassigned', stage: 'open' }, hidden: true },
    { id: 'overdue', label: 'Schedule overdue', q: { follow: 'overdue' }, hidden: true },
    { id: 'today', label: 'Schedule today', q: { follow: 'today' }, hidden: true },
  ];
  const SORT_PRESETS = {
    latest: ['enquired', 'desc'], newest: ['created', 'desc'], oldest: ['created', 'asc'], updated: ['updated', 'desc'], followup: ['followup', 'asc'],
    neglected: ['contacted', 'asc'], value: ['plan', 'desc'], status: ['stage', 'asc'], repeat: ['enquiries', 'desc'], name: ['name', 'asc'],
  };
  const SORT_MENU = [['latest', 'Latest enquiry'], ['followup', 'Next schedule'], ['neglected', 'Not contacted longest']];
  const DEFAULT_DIR = { created: 'desc', enquired: 'desc', updated: 'desc', plan: 'desc', enquiries: 'desc' };
  async function renderCustomers(query) {
    let viewId = query.view || 'all';
    // "All" + a single status (links from the dashboard) opens that status's own tab.
    if (viewId === 'all' && query.stage && VIEWS.some(v => v.id === query.stage && !v.hidden)) {
      viewId = query.stage;
      query = Object.fromEntries(Object.entries(query).filter(([k]) => k !== 'stage'));
    }
    const preset = VIEWS.find(v => v.id === viewId)?.q || {};
    const filters = { ...preset, ...Object.fromEntries(Object.entries(query).filter(([k]) => k !== 'view')) };
    // Rows load 30 at a time; scrolling to the bottom of the list fetches the next 30.
    const PAGE = 30;
    const listParams = page => new URLSearchParams(Object.entries({ ...filters, page, pageSize: PAGE }).filter(([k, v]) => v && k !== 'view')).toString();
    const params = listParams(1);
    const [data, countsRes] = await Promise.all([api(`/api/crm/contacts?${params}`), api('/api/crm/contacts/counts').catch(() => ({ counts: {} }))]);
    const counts = countsRes.counts || {};
    const extraFilters = Object.entries(query).filter(([k, v]) => v && !['view', 'page', 'sort', 'dir'].includes(k) && preset[k] !== v);
    const sortLabel = (SORT_MENU.find(([v]) => v === (filters.sort || 'latest')) || [, 'Column'])[1];
    const exportParams = new URLSearchParams(Object.entries(filters).filter(([k, v]) => v && k !== 'page')).toString();
    view().innerHTML = `
      <div class="tabs">${VIEWS.filter(v => !v.hidden || v.id === viewId).map(v => `<a href="#/customers?view=${v.id}" class="${v.id === viewId ? 'on' : ''}">${esc(v.label)}${counts[v.id] !== undefined ? `<span class="tab-count">${counts[v.id]}</span>` : ''}</a>`).join('')}</div>
      <form class="toolbar" id="filterForm">
        <label class="search-box">${ICONS.search}<input name="q" value="${esc(filters.q || '')}" placeholder="Search name, mobile, email, city…" aria-label="Search enquiries"></label>
        <label class="pill-select ${filters.owner && filters.owner !== preset.owner ? 'active' : ''}"><span>Owner</span><select name="owner"><option value="">Anyone</option>${S.me.isManager ? '' : `<option value="me" ${filters.owner === 'me' ? 'selected' : ''}>Me</option>`}<option value="unassigned" ${filters.owner === 'unassigned' ? 'selected' : ''}>Unassigned</option>${agentOptions(filters.owner)}</select></label>
        ${extraFilters.length || filters.q ? `<a href="#/customers?view=${viewId}" class="clear-link">Clear filters</a>` : ''}
        <span class="spacer"></span>
        <label class="pill-select sort-pill"><span>Sort</span><select name="sort">
          ${!SORT_PRESETS[filters.sort || 'latest'] ? `<option value="${esc(filters.sort)}" selected>By column</option>` : ''}
          ${SORT_MENU.map(([v, l]) => `<option value="${v}" ${(filters.sort || 'latest') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
        ${S.me.isManager ? `<div class="menu-wrap">
          <button type="button" class="btn" id="moreBtn" aria-haspopup="true" aria-expanded="false">More<svg viewBox="0 0 24 24" class="caret"><path d="M7 10l5 5 5-5z"/></svg></button>
          <div class="menu card" id="moreMenu" hidden>
            <a href="/api/crm/export.csv?${exportParams}">${ICONS.download}<span><strong>Export to Excel</strong><small>The enquiries in this list</small></span></a>
            <button type="button" id="importBtn">${ICONS.upload}<span><strong>Import from Excel</strong><small>Add enquiries from a file</small></span></button>
          </div>
        </div>` : ''}
      </form>
      <section class="card">
        ${data.contacts.length ? `<div class="table-wrap"><table class="data enq-cards">
          <thead><tr>${sortTh('name', 'Name', filters)}${sortTh('phone', 'Mobile', filters, 'col-phone')}${sortTh('plan', 'Plan', filters, 'hide-sm')}${sortTh('stage', 'Status', filters)}${sortTh('enquired', 'Enquired', filters, 'hide-sm')}${sortTh('followup', 'Scheduled', filters)}${sortTh('contacted', 'Contacted', filters, 'hide-sm')}${sortTh('owner', 'Owner', filters, 'hide-sm')}</tr></thead>
          <tbody>${data.contacts.map(enquiryRow).join('')}</tbody></table>
          <div class="list-more" id="listMore"></div></div>
          <div class="list-foot" id="listFoot"></div>`
          : `<div class="card-empty">No enquiries match these filters.${filters.q ? ` <a href="#" id="addFromSearch">Add “${esc(filters.q)}” as a new customer</a>` : ''}</div>`}
      </section>`;

    const form = $('#filterForm');
    const apply = (extra = {}) => {
      const fd = Object.fromEntries(new FormData(form));
      const keepDir = fd.sort === filters.sort ? filters.dir : '';
      // If a filter now disagrees with the tab (e.g. Status "Converted" on the "Open" tab), show it under "All".
      const conflict = Object.entries(preset).some(([k, v]) => k in fd && fd[k] !== v);
      if (conflict) {
        const carried = Object.fromEntries(Object.entries(query).filter(([k]) => !['view', 'page'].includes(k)));
        setQuery('customers', { ...carried, view: 'all', ...fd, dir: keepDir, ...extra });
        return;
      }
      const changed = Object.fromEntries(Object.entries(fd).filter(([k, v]) => preset[k] !== v));
      setQuery('customers', { view: viewId, ...changed, dir: keepDir, ...extra });
    };
    const moreBtn = $('#moreBtn');
    moreBtn?.addEventListener('click', event => {
      event.stopPropagation();
      const menu = $('#moreMenu');
      menu.hidden = !menu.hidden;
      moreBtn.setAttribute('aria-expanded', String(!menu.hidden));
    });
    $$('#moreMenu a, #moreMenu button').forEach(item => item.addEventListener('click', () => { $('#moreMenu').hidden = true; }));
    document.addEventListener('click', function closeMore(event) {
      if (!$('#moreMenu')) { document.removeEventListener('click', closeMore); return; }
      if (!event.target.closest('.menu-wrap')) $('#moreMenu').hidden = true;
    });
    form.addEventListener('submit', event => { event.preventDefault(); apply(); });
    $$('select', form).forEach(sel => sel.addEventListener('change', () => apply()));
    let searchTimer;
    form.q.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => apply(), 450); });
    $$('th[data-sort]').forEach(th => th.addEventListener('click', () => {
      const [col, dir] = currentSort(filters);
      const next = th.dataset.sort === col ? (dir === 'asc' ? 'desc' : 'asc') : (DEFAULT_DIR[th.dataset.sort] || 'asc');
      setQuery('customers', { ...Object.fromEntries(Object.entries(query)), view: viewId, sort: th.dataset.sort, dir: next, page: '' });
    }));
    $('#importBtn')?.addEventListener('click', openImport);
    $('#addFromSearch')?.addEventListener('click', event => { event.preventDefault(); openAddCustomer(/\d{6,}/.test(filters.q) ? { phone: filters.q } : { name: filters.q }); });

    const bindRows = root => {
      $$('tr[data-id]', root).forEach(tr => tr.addEventListener('click', event => {
        if (event.target.closest('input, a, button')) return;
        location.hash = `#/customers/${tr.dataset.id}`;
      }));
      bindCallButtons(root);
    };
    bindRows(view());
    // Load more rows as the list is scrolled.
    let loaded = data.contacts.length;
    let page = 1;
    let loading = false;
    const foot = () => {
      const el = $('#listFoot');
      if (el) el.innerHTML = `<span>Showing <strong>${loaded}</strong> of ${data.total} enquir${data.total === 1 ? 'y' : 'ies'}</span>${loaded < data.total ? '<span class="muted">Scroll down to load more</span>' : ''}`;
    };
    foot();
    const more = $('#listMore');
    if (more && loaded < data.total) {
      const observer = new IntersectionObserver(async entries => {
        if (!entries.some(e => e.isIntersecting) || loading || loaded >= data.total) return;
        loading = true;
        more.innerHTML = '<span class="spinner"></span> Loading more…';
        try {
          const next = await api(`/api/crm/contacts?${listParams(page + 1)}`);
          page += 1;
          const tmp = document.createElement('tbody');
          tmp.innerHTML = next.contacts.map(enquiryRow).join('');
          bindRows(tmp);
          $('table.data tbody', view()).append(...tmp.children);
          loaded += next.contacts.length;
          if (!next.contacts.length) loaded = data.total;
        } catch (error) { fail(error); }
        more.innerHTML = '';
        loading = false;
        foot();
        if (loaded >= data.total) observer.disconnect();
      }, { rootMargin: '0px 0px 300px 0px' });
      observer.observe(more);
      S.listObserver?.disconnect();
      S.listObserver = observer;
    }
  }
  function enquiryRow(c) {
    return `
            <tr data-id="${c.id}" data-stage="${esc(c.stage)}">
              <td><div class="cust-cell"><span class="avatar">${esc(initials(c.name))}</span><div><strong>${esc(c.name)}</strong>${repeatBadge(c)}${c.consentWithdrawnAt ? '<span class="dnc-badge" title="Consent withdrawn — do not contact">Do not contact</span>' : ''}${c.supportCount ? `<span class="support-badge${c.openSupport ? '' : ' is-done'}" title="${c.openSupport ? 'Has an open support request' : 'Raised a support request'}">Support</span>` : ''}<div class="cust-sub">${c.phone ? `<a class="phone-link cell-phone" href="${telHref(c.phone)}" data-call="${c.id}">${esc(c.phone)}</a>` : ''}<span>${esc(c.email || sourceLabel(c.source))}${c.enquiryCount > 1 && !repeatBadge(c) ? ` · ${c.enquiryCount} enquiries` : ''}</span></div></div></div></td>
              <td class="col-phone"><a class="phone-link" href="${telHref(c.phone)}" data-call="${c.id}">${esc(c.phone || '—')}</a></td>
              <td class="hide-sm">${c.plan ? `<span class="tag">${esc(c.plan)}</span>` : '<span class="muted">—</span>'}</td>
              <td>${stagePill(c.stage)}</td>
              <td class="hide-sm enq-when" title="First enquiry ${esc(fmtDate(c.createdAt, false))}">${enquiredWhen(c.lastEnquiryAt)}</td>
              <td>${dueHtml(c.nextFollowUpAt)}</td>
              <td class="hide-sm muted">${c.lastContactedAt ? relTime(c.lastContactedAt) : 'Never'}</td>
              <td class="hide-sm">${ownerHtml(c.owner)}</td>
            </tr>`;
  }


  // "Today at 3:27 pm", "Yesterday at 11:05 am", "31 Oct at 4:10 pm" (year added when it isn't this year).
  function enquiredWhen(value) {
    if (!value) return '<span class="muted">—</span>';
    const d = new Date(value);
    const time = d.toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit' });
    const key = dayKey(d);
    if (key === dayKey(new Date())) return `<span class="when-chip is-today"><b>Today</b> at ${time}</span>`;
    if (key === dayKey(Date.now() - 86400000)) return `<span class="when-chip is-yday"><b>Yesterday</b> at ${time}</span>`;
    const sameYear = key.slice(0, 4) === dayKey(new Date()).slice(0, 4);
    return `<span class="when-chip"><b>${d.toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })}</b> at ${time}</span>`;
  }
  function currentSort(filters) {
    if (SORT_PRESETS[filters.sort || 'latest'] && !filters.dir) return SORT_PRESETS[filters.sort || 'latest'];
    const [col, presetDir] = SORT_PRESETS[filters.sort] || [filters.sort, DEFAULT_DIR[filters.sort] || 'asc'];
    return [col, filters.dir || presetDir];
  }
  function sortTh(key, label, filters, cls = '') {
    const [col, dir] = currentSort(filters);
    const active = col === key;
    return `<th class="sortable ${cls} ${active ? 'sorted' : ''}" data-sort="${key}" aria-sort="${active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}" title="Sort by ${esc(label)}">${esc(label)}<span class="sort-arrow">${active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span></th>`;
  }

  // ---------------------------------------------------------------- duplicates

  // ---------------------------------------------------------------- import from Excel
  const IMPORT_FIELDS = [
    ['name', 'Full name', true, /name|naam|customer|client/i],
    ['altPhone', 'Alternate mobile', false, /alt|alternate|other.*(phone|mobile)|second/i],
    ['phone', 'Mobile', true, /mobile|phone|contact|cell|whatsapp|number/i],
    ['email', 'Email', false, /e-?mail/i],
    ['city', 'City / area', false, /city|area|location|town|village|address/i],
    ['occupation', 'Occupation', false, /occupation|profession|job|business|work/i],
    ['plan', 'Plan', false, /plan|scheme|chit|bhisi|amount|lakh/i],
    ['source', 'Source', false, /source|lead from|channel|reference/i],
    ['stage', 'Status', false, /status|stage/i],
    ['owner', 'Owner (team member)', false, /owner|assigned|agent|executive|handled/i],
    ['note', 'Notes / remarks', false, /note|remark|comment|message|feedback/i],
    ['createdAt', 'Received date', false, /date|created|received|enquiry on/i],
  ];
  function parseIndianDate(value) {
    const v = String(value || '').trim();
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v;
    const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (m) {
      const year = m[3].length === 2 ? `20${m[3]}` : m[3];
      const d = new Date(Number(year), Number(m[2]) - 1, Number(m[1]), 12);
      return Number.isNaN(d.getTime()) ? '' : d.toISOString();
    }
    return '';
  }
  function openImport() {
    const sample = 'Name,Mobile,Email,City,Plan,Status,Owner,Notes,Received date\nRamesh Patil,9876543210,ramesh@example.com,Nagpur,₹10 Lakh Bhisi,Interested,,Wants to start next month,31/10/2026\n';
    openModal('Import customers from Excel', `
      <div class="stack" id="impStep1">
        <p style="margin:0">Upload an Excel (.xlsx) or CSV file. The <strong>first row must be the column headings</strong> (Name, Mobile, Email…). You'll match the columns on the next step.</p>
        <label class="dropzone"><input type="file" id="impFile" accept=".xlsx,.csv"><span>${ICONS.upload}<strong>Choose a file</strong> or drop it here</span><small class="muted">Up to 5,000 customers, 5 MB</small></label>
        <a href="#" id="impSample" class="small">Download a sample file</a>
        <div class="form-error" hidden></div>
      </div>
      <div id="impStep2" hidden></div>
      <div id="impStep3" hidden></div>`, body => {
      $('#impSample', body).addEventListener('click', event => {
        event.preventDefault();
        const blob = new Blob([`﻿${sample}`], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sainand-customers-sample.csv'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
      $('#impFile', body).addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;
        const err = $('#impStep1 .form-error', body); err.hidden = true;
        try {
          const parsed = await uploadFile('/api/crm/import/parse', 'file', file);
          showMapping(body, parsed);
        } catch (error) { err.textContent = error.message; err.hidden = false; }
      });
    }, { wide: true });
  }
  function showMapping(body, parsed) {
    const used = new Set();
    const guess = {};
    for (const [key, , , re] of IMPORT_FIELDS) {
      const idx = parsed.headers.findIndex((h, i) => !used.has(i) && re.test(h));
      if (idx >= 0) { guess[key] = idx; used.add(idx); }
    }
    const opts = sel => `<option value="">— not in file —</option>${parsed.headers.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}`;
    $('#impStep1', body).hidden = true;
    const step = $('#impStep2', body);
    step.hidden = false;
    step.innerHTML = `
      <form class="stack" id="mapForm">
        <p style="margin:0"><strong>${esc(parsed.fileName)}</strong> · ${parsed.total} row${parsed.total === 1 ? '' : 's'}${parsed.truncated ? ' (only the first 5,000 will be imported)' : ''}. Check which column holds each detail:</p>
        <div class="map-grid">${IMPORT_FIELDS.map(([key, label, req]) => `<label class="field"><span>${esc(label)}${req ? ' *' : ''}</span><select name="${key}">${opts(guess[key])}</select></label>`).join('')}</div>
        <div class="grid-2">
          <label class="field"><span>If the customer already exists (same mobile or email)</span><select name="duplicates"><option value="skip">Skip that row</option><option value="update">Fill in their empty details</option></select></label>
          <label class="field"><span>Source for these customers</span><select name="source">${S.meta.sources.map(src => `<option value="${src.id}" ${src.id === 'other' ? 'selected' : ''}>${esc(src.label)}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Give enquiries without an owner in the file to</span><select name="owner"><option value="__auto" selected>Share among staff (in turn)</option><option value="__none">Leave unassigned</option>${agentOptions('', { label: 'Or give all to one agent' })}</select></label>
        <div class="field"><span>Preview (first 5 rows)</span><div class="table-wrap preview-table" id="mapPreview"></div></div>
        <div class="form-error" hidden></div>
        <div class="form-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Import ${Math.min(parsed.total, 5000)} rows</button></div>
      </form>`;
    const form = $('#mapForm', step);
    const mapped = () => {
      const fd = new FormData(form);
      return parsed.rows.map((row, i) => {
        const out = { rowNumber: i + 2 };
        for (const [key] of IMPORT_FIELDS) {
          const col = fd.get(key);
          out[key] = col === '' || col === null ? '' : String(row[Number(col)] ?? '').trim();
        }
        out.createdAt = parseIndianDate(out.createdAt);
        return out;
      });
    };
    const preview = () => {
      const rows = mapped().slice(0, 5);
      const cols = IMPORT_FIELDS.filter(([key]) => form[key].value !== '');
      $('#mapPreview', step).innerHTML = `<table class="data"><thead><tr>${cols.map(([, label]) => `<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr style="cursor:default">${cols.map(([key]) => `<td>${esc(key === 'createdAt' && r[key] ? fmtDate(r[key], false) : r[key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    };
    $$('select', form).forEach(sel => sel.addEventListener('change', preview));
    preview();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const err = $('.form-error', form); err.hidden = true;
      if (form.name.value === '' || form.phone.value === '') { err.textContent = 'Choose the columns for Full name and Mobile.'; err.hidden = false; return; }
      const rows = mapped();
      step.hidden = true;
      const out = $('#impStep3', body);
      out.hidden = false;
      const total = { created: 0, updated: 0, skipped: 0, errors: [] };
      for (let i = 0; i < rows.length; i += 500) {
        out.innerHTML = `<div class="loading">Importing… ${Math.min(i + 500, rows.length)} of ${rows.length}</div>`;
        try {
          const r = await api('/api/crm/import', { method: 'POST', body: { rows: rows.slice(i, i + 500), options: { duplicates: form.duplicates.value, source: form.source.value, owner: form.owner.value, fileName: parsed.fileName } } });
          total.created += r.created; total.updated += r.updated; total.skipped += r.skipped; total.errors.push(...r.errors);
        } catch (error) { total.errors.push({ row: `${i + 2}–${Math.min(i + 501, rows.length + 1)}`, reason: error.message }); }
      }
      out.innerHTML = `
        <div class="stack">
          <div class="kpis" style="grid-template-columns:repeat(4,1fr);margin:0">
            <div class="kpi"><span>Added</span><strong>${total.created}</strong></div>
            <div class="kpi"><span>Updated</span><strong>${total.updated}</strong></div>
            <div class="kpi"><span>Skipped (already exist)</span><strong>${total.skipped}</strong></div>
            <div class="kpi ${total.errors.length ? 'is-alert' : ''}"><span>Problems</span><strong>${total.errors.length}</strong></div>
          </div>
          ${total.errors.length ? `<div class="field"><span>Rows that were not imported</span><div class="table-wrap preview-table"><table class="data"><thead><tr><th>Row</th><th>Problem</th></tr></thead><tbody>${total.errors.slice(0, 100).map(e => `<tr style="cursor:default"><td>${esc(e.row)}</td><td>${esc(e.reason)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
          <div class="form-actions"><button class="btn btn-primary" data-close>Done</button></div>
        </div>`;
      S.plans = (await api('/api/crm/plans').catch(() => ({ plans: S.plans }))).plans;
      if (parseHash().route === 'customers') render();
    });
  }

  // ---------------------------------------------------------------- activity log

  // ---------------------------------------------------------------- add / edit customer
  function customerFormHtml(c = {}, { isNew = true } = {}) {
    return `
      <form class="stack" id="custForm" novalidate>
        <label class="field"><span>Full name *</span><input name="name" value="${esc(c.name || '')}" required autocomplete="off"></label>
        <div class="grid-2">
          <label class="field"><span>Mobile *</span><input name="phone" value="${esc(c.phone || '')}" inputmode="tel" placeholder="98765 43210"></label>
          <label class="field"><span>Email</span><input name="email" type="email" value="${esc(c.email || '')}"></label>
        </div>
        <div class="grid-2">
          <label class="field"><span>Interested plan</span><input name="plan" list="planList" value="${esc(c.plan || '')}">${planDatalist()}</label>
          <label class="field"><span>How did they reach us?</span><select name="source">${S.meta.sources.map(s => `<option value="${s.id}" ${s.id === (c.source || 'phone') ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
        </div>
        ${isNew ? '<label class="field"><span>Note <small class="muted">optional</small></span><textarea name="note" rows="2" placeholder="What did they ask about?"></textarea></label>' : ''}
        <details class="more-details" ${!isNew && (c.altPhone || c.city || c.occupation) ? 'open' : ''}>
          <summary>More details (alternate mobile, city, occupation${isNew && S.me.isManager ? ', assigned to' : ''})</summary>
          <div class="stack" style="margin-top:12px">
            <div class="grid-2">
              <label class="field"><span>Alternate mobile</span><input name="altPhone" value="${esc(c.altPhone || '')}" inputmode="tel"></label>
              <label class="field"><span>City / area</span><input name="city" value="${esc(c.city || '')}" placeholder="Nagpur"></label>
            </div>
            <div class="grid-2">
              <label class="field"><span>Occupation</span><input name="occupation" value="${esc(c.occupation || '')}" placeholder="Business, salaried…"></label>
              ${isNew && S.me.isManager ? `<label class="field"><span>Assigned to</span><select name="owner"><option value="__auto" selected>Automatic</option>${agentOptions('', { label: 'Or choose an agent' })}</select></label>` : '<span></span>'}
            </div>
          </div>
        </details>
        <div class="form-error" id="custError" hidden></div>
        <div class="form-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">${isNew ? 'Add enquiry' : 'Save changes'}</button></div>
      </form>`;
  }
  function openAddCustomer(prefill = {}) {
    openModal('Add enquiry', customerFormHtml(prefill), body => {
      $('#custForm', body).addEventListener('submit', async event => {
        event.preventDefault();
        const fd = Object.fromEntries(new FormData(event.target));
        try {
          const { contact, assignedTo } = await api('/api/crm/contacts', { method: 'POST', body: fd });
          closeModal();
          toast(assignedTo ? `Enquiry added — assigned to ${assignedTo}` : 'Enquiry added — no staff member available, please assign');
          location.hash = `#/customers/${contact.id}`;
        } catch (error) {
          const el = $('#custError', body);
          el.innerHTML = esc(error.message) + (error.data?.contactId ? ` <a href="#/customers/${error.data.contactId}" data-close>Open existing customer</a>` : '');
          el.hidden = false;
        }
      });
    });
  }

  // ---------------------------------------------------------------- customer page

  async function renderCustomer(id, query = {}) {
    const data = await api(`/api/crm/contacts/${id}`);
    const c = data.contact;
    const openTasks = data.tasks.filter(t => t.status === 'open');
    const stepStages = S.meta.stages.filter(s => s.id !== 'not_interested');
    const currentIndex = stepStages.findIndex(s => s.id === c.stage);
    const preTask = query.log && query.log !== 'call' ? openTasks.find(t => String(t.id) === String(query.log)) : openTasks[0];
    let composerTab = query.log ? 'call' : 'call';

    const prop = (label, value) => (value ? `<div><dt>${label}</dt><dd>${value}</dd></div>` : '');
    view().innerHTML = `
      <div class="row" style="margin-bottom:10px"><a href="#/customers" class="btn btn-ghost btn-sm" data-back>${ICONS.back}Back</a></div>
      <div class="cust-header">
        <span class="avatar lg">${esc(initials(c.name))}</span>
        <div>
          <h2>${esc(c.name)} ${repeatBadge({ ...c, enquiryCount: data.enquiries.length })}</h2>
          <div class="cust-meta">
            <span>${ICONS.phone}${esc(c.phone || '—')}</span>
            ${c.email ? `<span>${ICONS.email}${esc(c.email)}</span>` : ''}
            ${c.plan ? `<span class="tag">${esc(c.plan)}</span>` : ''}
            <span class="muted">Since ${fmtDate(c.createdAt, false)}</span>
          </div>
        </div>
        <div class="cust-actions">
          ${c.consentWithdrawnAt ? '' : (c.phone ? `<a class="btn btn-call" href="${telHref(c.phone)}" id="callNow">${ICONS.phone}Call</a>
          <a class="btn btn-wa" href="${waHref(c.phone, `Namaste ${c.name.split(' ')[0]}, this is ${(S.me.displayName || '').split(' ')[0]} from Sainand Chits regarding your enquiry${c.plan ? ` for the ${c.plan}` : ''}.`)}" target="_blank" rel="noopener" id="waNow">${ICONS.whatsapp}WhatsApp</a>` : '')}
          ${c.consentWithdrawnAt ? '' : '<button class="btn btn-ghost btn-sm" id="dncBtn" title="Customer asked us to stop contacting them">Do not contact</button>'}
        </div>
      </div>
      ${c.consentWithdrawnAt ? `<div class="dnc-banner" role="alert">
        <div><strong>⛔ Consent withdrawn on ${esc(fmtDate(c.consentWithdrawnAt))} — do not call, WhatsApp or email this person.</strong>${c.consentWithdrawnNote ? `<span>${esc(c.consentWithdrawnNote)}</span>` : ''}<span>If they enquire again on the website, this is cleared automatically.</span></div>
        <button class="btn btn-sm" id="dncUndo">They agreed to be contacted again</button>
      </div>` : ''}

      <div class="stepper" role="group" aria-label="Customer status">
        ${stepStages.map((s, i) => `<button data-stage="${s.id}" class="${s.id === c.stage ? `current st-${s.id}-btn` : (c.stage !== 'not_interested' && i < currentIndex ? 'done' : '')}" aria-pressed="${s.id === c.stage}">${i < currentIndex && c.stage !== 'not_interested' ? '✓ ' : ''}${esc(s.label)}</button>`).join('')}
        <button data-stage="not_interested" class="lost ${c.stage === 'not_interested' ? 'current st-not_interested-btn' : ''}">Not interested</button>
      </div>
      ${c.stage === 'not_interested' && c.lostReason ? `<div class="banner" style="margin:-6px 0 16px">Reason: ${esc(c.lostReason)}</div>` : ''}
      <div id="dupBanner"></div>

      <div class="cust-main">
        <div>
          <section class="card composer">
            <div class="composer-tabs" role="tablist">
              <button data-ctab="call">${ICONS.phone}Log call</button>
              <button data-ctab="note">${ICONS.note}Note</button>
              <button data-ctab="email">${ICONS.email}Email</button>
              <button data-ctab="schedule">${ICONS.calendar}Schedule</button>
            </div>
            <div id="composerBody"></div>
          </section>
        </div>
        <div>
          <section class="card">
            <div class="card-head"><h2>Upcoming schedules</h2><button class="btn btn-sm btn-ghost" data-tab-jump="schedule">+ Add</button></div>
            ${openTasks.length ? openTasks.map(t => `
              <div class="task">
                <button class="check" data-done="${t.id}" data-title="${esc(t.title)}" aria-label="Mark done" title="Mark done">${ICONS.check}</button>
                <div class="grow"><strong>${esc(t.title)}</strong>${dueHtml(t.dueAt)}${t.rescheduleCount ? ` <span class="tag">moved ${t.rescheduleCount}×</span>` : ''}
                  <div class="muted small">${esc(memberName(t.assignee))}${t.notes ? ` · ${esc(t.notes)}` : ''}</div></div>
                <button class="btn btn-sm btn-ghost" data-resched="${t.id}" title="Reschedule" aria-label="Reschedule">${ICONS.calendar}</button>
              </div>`).join('') : '<div class="card-empty">Nothing scheduled.</div>'}
          </section>
          <section class="card">
            <div class="card-head"><h2>Details</h2><button class="btn btn-sm btn-ghost" id="editCust">${ICONS.edit}Edit</button></div>
            <div class="card-body"><dl class="props">
              <div><dt>Assigned to</dt><dd>${S.me.isManager ? `<select id="ownerSel" aria-label="Assigned to">${teamOptions(c.owner, { unassignedLabel: 'Nobody yet' })}</select>` : ownerHtml(c.owner)}</dd></div>
              ${prop('Mobile', c.phone ? `<a href="${telHref(c.phone)}">${esc(c.phone)}</a>` : '')}
              ${prop('Alternate', c.altPhone ? `<a href="${telHref(c.altPhone)}">${esc(c.altPhone)}</a>` : '')}
              <div><dt>Email</dt><dd>${c.email ? esc(c.email) : '<a href="#" id="addEmailLink">Add email</a>'}</dd></div>
              ${prop('Plan', esc(c.plan))}
              ${prop('City', esc(c.city))}
              ${prop('Occupation', esc(c.occupation))}
              ${prop('Source', esc(sourceLabel(c.source)))}
              ${prop('Last contacted', c.lastContactedAt ? fmtDate(c.lastContactedAt) : '<span class="muted">Never</span>')}
              ${prop('Consent', c.consentAt ? `Agreed · ${fmtDate(c.consentAt, false)}` : '')}
            </dl></div>
            ${S.me.isOwner ? '<div class="card-body" style="border-top:1px solid var(--line-2);padding-top:10px;padding-bottom:12px"><button class="btn btn-sm btn-ghost btn-danger" id="deleteCust">Delete customer</button></div>' : ''}
          </section>
          ${data.enquiries.length ? `<section class="card">
            <div class="card-head"><h2>Website enquiries</h2><span class="muted">${data.enquiries.length}</span></div>
            ${data.enquiries.map(e => `
              <div class="enq">
                <div class="row"><strong>${esc(e.plan || 'Plan not specified')}</strong><span class="spacer"></span><span class="muted small">${fmtDate(e.createdAt)}</span></div>
                ${e.message && e.message !== 'No message provided' ? `<div style="margin-top:4px;white-space:pre-wrap">${esc(e.message)}</div>` : ''}
                ${e.chatTranscript.length ? `<details style="margin-top:6px"><summary class="small" style="cursor:pointer;color:var(--brand)">Chatbot conversation (${e.chatTranscript.length} messages)</summary>
                  <div class="chat">${e.chatTranscript.map(m => `<div class="${m.role === 'user' ? 'u' : 'a'}">${esc(m.content)}</div>`).join('')}</div></details>` : ''}
              </div>`).join('')}
          </section>` : ''}
        </div>
      </div>

      <section class="card fold" data-fold="timeline">
        <button type="button" class="fold-head" aria-expanded="true"><h2>Timeline</h2><span class="muted" id="tlCount"></span><svg class="fold-caret" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg></button>
        <div class="fold-body">
          <div class="chips tl-filter" id="tlFilter">${[['all', 'All'], ['call', 'Calls'], ['followup', 'Schedules'], ['email', 'Emails'], ['note', 'Notes'], ['enquiry', 'Enquiries']].map(([v, l], i) => `<button class="chip ${i ? '' : 'on'}" data-f="${v}">${l}</button>`).join('')}</div>
          <ul class="timeline" id="timeline"></ul>
          <div class="more-row" id="tlMore"></div>
        </div>
      </section>
      ${followHistoryHtml(data.tasks.filter(t => t.status !== 'open'), { title: 'Schedule history', showCustomer: false, canReopen: !['converted', 'not_interested'].includes(c.stage), fold: true })}`;
    wireFolds(view());
    $('#addEmailLink')?.addEventListener('click', event => { event.preventDefault(); editCustomer(); });

    if (S.me.isManager) {
      api(`/api/crm/duplicates?contactId=${id}`).then(({ groups }) => {
        const others = (groups[0]?.contacts || []).filter(x => x.id !== id);
        if (!others.length || !$('#dupBanner')) return;
        $('#dupBanner').innerHTML = `<div class="banner" style="margin:-6px 0 16px">Possible duplicate: ${others.map(o => `<a href="#/customers/${o.id}">${esc(o.name)}</a>`).join(', ')} (${esc(groups[0].reason)}). <a href="#/customers?view=duplicates">Review &amp; merge</a></div>`;
      }).catch(() => {});
    }

    // timeline
    let tlFilter = 'all';
    let tlShown = 5;
    const drawTimeline = () => {
      const all = data.activities.filter(a => tlFilter === 'all' || a.type === tlFilter || (tlFilter === 'call' && ['whatsapp', 'meeting'].includes(a.type)));
      const items = all.slice(0, tlShown);
      $('#tlCount').textContent = `${data.activities.length} entr${data.activities.length === 1 ? 'y' : 'ies'}`;
      $('#tlMore').innerHTML = all.length > tlShown
        ? `<button type="button" class="btn btn-sm" id="tlMoreBtn">Show ${Math.min(10, all.length - tlShown)} more</button><span class="muted small">Showing ${items.length} of ${all.length}</span>`
        : (all.length > 5 ? `<button type="button" class="btn btn-sm btn-ghost" id="tlLessBtn">Show less</button>` : '');
      $('#tlMoreBtn')?.addEventListener('click', () => { tlShown += 10; drawTimeline(); });
      $('#tlLessBtn')?.addEventListener('click', () => { tlShown = 5; drawTimeline(); $('[data-fold="timeline"]').scrollIntoView({ block: 'nearest' }); });
      $('#timeline').innerHTML = items.length ? items.map(a => `
        <li class="tl-${esc(a.type)}">
          <span class="tl-icon">${ICONS[ACTIVITY_ICON[a.type]] || ICONS.info}</span>
          <div>
            <div class="tl-head"><strong>${esc(timelineTitle(a))}</strong>${a.createdBy && a.createdBy !== 'imported' ? `<span class="muted">by ${esc(memberName(a.createdBy))}</span>` : ''}<span class="when" title="${esc(fmtDate(a.createdAt))}">${fmtDate(a.createdAt)}</span></div>
            ${a.type === 'email' ? `<div class="tl-box"><div class="small muted">To ${esc(a.meta?.to || c.email)}</div><strong style="font-size:13px">${esc(a.subject)}</strong><div class="tl-body">${esc(a.body)}</div></div>` : ''}
            ${a.type === 'enquiry' ? `<div class="tl-body">${a.meta?.plan ? `Plan: ${esc(a.meta.plan)}` : ''}${a.body ? `${a.meta?.plan ? '\n' : ''}“${esc(a.body)}”` : ''}</div>` : ''}
            ${['call', 'note', 'whatsapp', 'meeting', 'stage_change', 'system', 'followup'].includes(a.type) && a.body ? `<div class="tl-body">${esc(a.body)}</div>` : ''}
            ${a.meta?.completedTask ? `<div class="tl-tag">${ICONS.check}Completed schedule “${esc(a.meta.completedTask.title)}” (due ${fmtDate(a.meta.completedTask.dueAt)})</div>` : ''}
          </div>
        </li>`).join('') : '<li class="muted" style="display:block;padding:16px 0">Nothing here yet.</li>';
    };
    drawTimeline();
    $$('#tlFilter .chip').forEach(chip => chip.addEventListener('click', () => {
      tlFilter = chip.dataset.f;
      tlShown = 5;
      $$('#tlFilter .chip').forEach(x => x.classList.toggle('on', x === chip));
      drawTimeline();
    }));

    // composer
    const reload = () => renderCustomer(id).catch(fail);
    const followChips = (name = 'follow') => `
      <div class="field"><span>Schedule next call</span>
        <div class="chips" data-follow-chips>
          ${[['none', 'No schedule'], ['later', 'In 3 hours'], ['tomorrow', new Date(Date.now() + 86400000).getDay() === 0 ? 'Monday 11 AM' : 'Tomorrow 11 AM'], ['week', 'Next week'], ['custom', 'Pick date & time…']].map(([v, l]) => `<button type="button" class="chip ${v === 'none' ? 'on' : ''}" data-preset="${v}">${l}</button>`).join('')}
        </div>
        ${dtpHtml(name, '', { hidden: true })}
      </div>`;
    const wireFollowChips = form => {
      const box = form.querySelector('[data-dtp]');
      const chips = $$('[data-preset]', form);
      wireDtp(form, { onChange: () => chips.forEach(x => x.classList.toggle('on', x.dataset.preset === 'custom')) });
      chips.forEach(chip => chip.addEventListener('click', () => {
        chips.forEach(x => x.classList.toggle('on', x === chip));
        const p = chip.dataset.preset;
        if (p === 'none') { box.hidden = true; box._dtp.clear(); box._dtp.close(); chip.classList.add('on'); return; }
        box.hidden = false;
        if (p === 'custom') { box._dtp.open(); return; }
        box._dtp.set(presetDate(p));
        chips.forEach(x => x.classList.toggle('on', x === chip));
        box._dtp.close();
      }));
    };
    const statusSelect = () => `
      <div class="grid-2">
        <label class="field"><span>Update status</span><select name="stage">${stageOptions(c.stage)}</select></label>
        <label class="field" data-lost hidden><span>Reason for Not interested</span><input name="lostReason" placeholder="e.g. Instalment too high"></label>
      </div>`;
    const wireStatus = form => {
      const sel = form.querySelector('select[name=stage]');
      const lost = form.querySelector('[data-lost]');
      sel?.addEventListener('change', () => { lost.hidden = sel.value !== 'not_interested'; });
    };
    const completeTaskBox = () => preTask ? `<label class="row small" style="font-weight:600"><input type="checkbox" name="completeTask" value="${preTask.id}" checked> Mark “${esc(preTask.title)}” (${esc(dueInfo(preTask.dueAt).label)}) as done</label>` : '';

    const COMPOSERS = {
      call: () => `
        <form id="cForm">
          <div class="field"><span>How did you contact them?</span>
            <div class="chips" id="channel">${[['call', 'Phone call'], ['whatsapp', 'WhatsApp'], ['meeting', 'Office visit']].map(([v, l], i) => `<button type="button" class="chip ${i ? '' : 'on'}" data-ch="${v}">${l}</button>`).join('')}</div>
          </div>
          <div class="field" id="outcomeField"><span>Call result *</span>
            <div class="chips" id="outcomes">${S.meta.outcomes.map(o => `<button type="button" class="chip" data-out="${o.id}">${esc(o.label)}</button>`).join('')}</div>
          </div>
          <label class="field"><span>Remarks</span><textarea name="body" rows="3" placeholder="What did the customer say? Plan, budget, next step…"></textarea></label>
          ${statusSelect()}
          ${followChips()}
          ${completeTaskBox()}
          <div class="form-actions"><button class="btn btn-primary">Save</button></div>
        </form>`,
      note: () => `
        <form id="cForm">
          <label class="field"><span>Note</span><textarea name="body" rows="4" placeholder="Add a remark for the team…" required></textarea></label>
          <div class="form-actions"><button class="btn btn-primary">Save note</button></div>
        </form>`,
      email: () => c.email ? `
        <form id="cForm">
          <label class="field"><span>To</span><input value="${esc(c.name)} <${esc(c.email)}>" disabled></label>
          <label class="field"><span>Subject</span><input name="subject" required maxlength="200"></label>
          <label class="field"><span>Message</span><textarea name="body" rows="8" required></textarea></label>
          ${S.meta.emailConfigured ? '' : '<div class="form-error">Email is not set up on the server yet, so this cannot be sent.</div>'}
          <div class="form-actions"><button class="btn btn-primary" ${S.meta.emailConfigured ? '' : 'disabled'}>${ICONS.email}Send email</button></div>
        </form>` : `<div class="card-empty">This customer has no email address. <a href="#" id="addEmail">Add one</a></div>`,
      schedule: () => `
        <form id="cForm">
          <div class="grid-2">
            <label class="field"><span>What</span><select name="title"><option>Scheduled call</option><option>Office visit</option><option>Send plan details</option><option>Bidding day reminder</option></select></label>
            <div class="field"><span>Assigned to</span><div class="assigned-note">${c.owner && agents().some(m => m.username.toLowerCase() === c.owner.toLowerCase()) ? `${ownerHtml(c.owner)}<small class="muted">customer's staff member</small>` : '<small class="muted">the next staff member in turn</small>'}</div></div>
          </div>
          ${followChips('dueAt').replace('No schedule', 'Choose')}
          <label class="field"><span>Notes</span><input name="notes" placeholder="e.g. Call after 6 PM, ask about 15 Lakh plan"></label>
          <div class="form-actions"><button class="btn btn-primary">${ICONS.calendar}Schedule</button></div>
        </form>`,
    };

    const drawComposer = tab => {
      composerTab = tab;
      $$('.composer-tabs [data-ctab]').forEach(b => b.classList.toggle('on', b.dataset.ctab === tab));
      $('#composerBody').innerHTML = COMPOSERS[tab]();
      const form = $('#cForm');
      $('#addEmail')?.addEventListener('click', event => { event.preventDefault(); editCustomer(); });
      if (!form) return;
      if (tab === 'call') {
        let channel = 'call';
        let outcome = '';
        wireStatus(form);
        wireFollowChips(form);
        $$('[data-ch]', form).forEach(chip => chip.addEventListener('click', () => {
          channel = chip.dataset.ch;
          $$('[data-ch]', form).forEach(x => x.classList.toggle('on', x === chip));
          $('#outcomeField').hidden = channel !== 'call';
        }));
        $$('[data-out]', form).forEach(chip => chip.addEventListener('click', () => {
          outcome = chip.dataset.out;
          $$('[data-out]', form).forEach(x => x.classList.toggle('on', x === chip));
          // Sensible defaults: unanswered calls usually need a retry.
          if (['no_answer', 'switched_off'].includes(outcome) && !form.follow.value) $('[data-preset="later"]', form).click();
          if (outcome === 'callback' && !form.follow.value) $('[data-preset="tomorrow"]', form).click();
          if (outcome === 'connected' && form.stage.value === 'new') form.stage.value = 'contacted';
        }));
        form.addEventListener('submit', async event => {
          event.preventDefault();
          if (channel === 'call' && !outcome) return toast('Choose the call result.', 'error');
          const fd = new FormData(form);
          if (fd.get('stage') === 'not_interested' && !String(fd.get('lostReason') || '').trim()) return toast('Add a reason for Not interested.', 'error');
          if (channel !== 'call' && !String(fd.get('body')).trim()) return toast('Add a remark.', 'error');
          try {
            await api(`/api/crm/contacts/${id}/activities`, { method: 'POST', body: {
              type: channel, outcome, body: fd.get('body'), stage: fd.get('stage'), lostReason: fd.get('lostReason'),
              followUpAt: fd.get('follow') ? new Date(fd.get('follow')).toISOString() : null,
              completeTaskId: fd.get('completeTask') || null,
            } });
            toast('Saved to timeline');
            refreshFollowCount();
            if (query.log) history.replaceState(null, '', `#/customers/${id}`);
            reload();
          } catch (error) { fail(error); }
        });
      }
      if (tab === 'note') {
        form.addEventListener('submit', async event => {
          event.preventDefault();
          try {
            await api(`/api/crm/contacts/${id}/activities`, { method: 'POST', body: { type: 'note', body: form.body.value } });
            toast('Note saved');
            reload();
          } catch (error) { fail(error); }
        });
      }
      if (tab === 'email') {
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const btn = form.querySelector('button.btn-primary');
          btn.disabled = true;
          try {
            await api(`/api/crm/contacts/${id}/email`, { method: 'POST', body: { subject: form.subject.value, body: form.body.value } });
            toast(`Email sent to ${c.email}`);
            reload();
          } catch (error) { fail(error); btn.disabled = false; }
        });
      }
      if (tab === 'schedule') {
        wireFollowChips(form);
        $('[data-preset="tomorrow"]', form).click();
        form.addEventListener('submit', async event => {
          event.preventDefault();
          if (!form.dueAt.value) return toast('Pick a date and time.', 'error');
          try {
            await api(`/api/crm/contacts/${id}/tasks`, { method: 'POST', body: { title: form.title.value, notes: form.notes.value, dueAt: new Date(form.dueAt.value).toISOString() } });
            toast('Scheduled');
            refreshFollowCount();
            reload();
          } catch (error) { fail(error); }
        });
      }
    };
    $$('.composer-tabs [data-ctab]').forEach(b => b.addEventListener('click', () => drawComposer(b.dataset.ctab)));
    $$('[data-tab-jump]').forEach(b => b.addEventListener('click', () => { drawComposer(b.dataset.tabJump); $('.composer').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    drawComposer(composerTab);
    $('#dncBtn')?.addEventListener('click', () => {
      openModal('Mark as "Do not contact"?', `
        <p style="margin-top:0">Use this when the customer asks us to stop contacting them. Calls, WhatsApp and email will be blocked for them, and their open schedules will be closed.</p>
        <label class="field"><span>Note (optional)</span><input name="note" placeholder="e.g. Said on the phone: please don't call again"></label>
        <div class="form-actions"><button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="dncConfirm">Mark do not contact</button></div>`, body => {
        $('#dncConfirm', body).addEventListener('click', async () => {
          try { await api(`/api/crm/contacts/${id}/consent`, { method: 'POST', body: { withdrawn: true, note: $('input[name=note]', body).value } }); closeModal(); toast('Marked do not contact'); render(); } catch (error) { fail(error); }
        });
      });
    });
    $('#dncUndo')?.addEventListener('click', async () => {
      if (!window.confirm('Only do this if the customer clearly agreed to be contacted again. Continue?')) return;
      try { await api(`/api/crm/contacts/${id}/consent`, { method: 'POST', body: { withdrawn: false, note: 'Customer agreed to be contacted again' } }); toast('Can be contacted again'); render(); } catch (error) { fail(error); }
    });
    $('#callNow')?.addEventListener('click', () => setTimeout(() => drawComposer('call'), 200));
    $('#waNow')?.addEventListener('click', () => setTimeout(() => { drawComposer('call'); $('[data-ch="whatsapp"]')?.click(); }, 200));

    // header actions
    $$('.stepper [data-stage]').forEach(btn => btn.addEventListener('click', async () => {
      const target = btn.dataset.stage;
      if (target === c.stage) return;
      const body = { stage: target };
      if (target === 'not_interested') {
        const reason = await askLostReason(c.name);
        if (!reason) return;
        body.lostReason = reason;
      }
      try {
        await api(`/api/crm/contacts/${id}`, { method: 'PATCH', body });
        toast(`Status: ${stage(target).label}`);
        reload();
      } catch (error) { fail(error); }
    }));
    $('#ownerSel')?.addEventListener('change', async event => {
      try {
        await api(`/api/crm/contacts/${id}`, { method: 'PATCH', body: { owner: event.target.value } });
        toast(event.target.value ? `Assigned to ${memberName(event.target.value)} — open schedules moved too` : 'Unassigned');
        reload();
      } catch (error) { fail(error); }
    });
    const editCustomer = () => openModal('Edit customer', customerFormHtml(c, { isNew: false }), body => {
      $('#custForm', body).addEventListener('submit', async event => {
        event.preventDefault();
        try {
          await api(`/api/crm/contacts/${id}`, { method: 'PATCH', body: Object.fromEntries(new FormData(event.target)) });
          closeModal();
          toast('Saved');
          reload();
        } catch (error) { const el = $('#custError', body); el.textContent = error.message; el.hidden = false; }
      });
    });
    $('#editCust').addEventListener('click', editCustomer);
    $('#deleteCust')?.addEventListener('click', () => openModal('Delete customer?', `
      <p>This permanently deletes <strong>${esc(c.name)}</strong> with their timeline and schedules. Their original website enquiries are kept.</p>
      <div class="form-actions"><button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="confirmDelete">Delete</button></div>`, body => {
      $('#confirmDelete', body).addEventListener('click', async () => {
        try { await api(`/api/crm/contacts/${id}`, { method: 'DELETE' }); closeModal(); toast('Customer deleted'); location.hash = '#/customers'; } catch (error) { fail(error); }
      });
    }));
    bindTaskButtons(() => renderCustomer(id));
    $$('[data-reopen]').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await api(`/api/crm/tasks/${btn.dataset.reopen}`, { method: 'PATCH', body: { status: 'open' } });
        toast('Schedule re-opened'); refreshFollowCount(); reload();
      } catch (error) { fail(error); }
    }));
    $$('[data-resched]').forEach(btn => btn.addEventListener('click', () => openReschedule(data.tasks.find(t => String(t.id) === btn.dataset.resched), reload)));
  }
  function followResult(t) {
    if (t.status === 'cancelled') return '<span class="pill st-not_interested">Cancelled</span>';
    const lateDays = Math.floor((new Date(t.completedAt) - new Date(t.dueAt)) / 86400000);
    return `<span class="pill st-converted">Done</span> <span class="small ${lateDays >= 1 ? 'due overdue' : 'muted'}">${lateDays >= 1 ? `${lateDays} day${lateDays === 1 ? '' : 's'} late` : 'on time'}</span>`;
  }
  // Collapsible sections; open/closed is remembered per browser.
  function wireFolds(root) {
    $$('[data-fold]', root).forEach(section => {
      const key = `sainand.crm.fold.${section.dataset.fold}`;
      const head = $('.fold-head', section);
      const set = open => { section.classList.toggle('is-closed', !open); head.setAttribute('aria-expanded', String(open)); };
      set(store.get(key, true));
      head.addEventListener('click', () => { const open = section.classList.contains('is-closed'); set(open); store.set(key, open); });
    });
    // "Show more" for long tables: reveal 10 more rows at a time.
    $$('[data-more-table]', root).forEach(btn => btn.addEventListener('click', () => {
      const rows = $$(`${btn.dataset.moreTable} tr[data-extra][hidden]`, root);
      rows.slice(0, 10).forEach(row => { row.hidden = false; });
      const left = rows.length - 10;
      if (left <= 0) btn.remove(); else btn.textContent = `Show ${Math.min(10, left)} more`;
    }));
  }
  function followHistoryHtml(list, { title, showCustomer, canReopen = true, fold = false, empty = 'No completed schedules yet.' }) {
    const limit = fold ? 5 : Infinity;
    if (fold) {
      return `<section class="card fold follow-history" data-fold="followhistory">
        <button type="button" class="fold-head" aria-expanded="true"><h2>${esc(title)}</h2><span class="muted">${list.length} record${list.length === 1 ? '' : 's'}</span><svg class="fold-caret" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg></button>
        <div class="fold-body" id="fhTable">${historyTable(list, { showCustomer, canReopen, limit, empty })}
          ${list.length > limit ? `<div class="more-row"><button type="button" class="btn btn-sm" data-more-table="#fhTable">Show ${Math.min(10, list.length - limit)} more</button><span class="muted small">Showing the latest ${limit}</span></div>` : ''}
        </div>
      </section>`;
    }
    return `<section class="card follow-history">
      <div class="card-head"><h2>${esc(title)}</h2><span class="muted">${list.length} record${list.length === 1 ? '' : 's'}</span></div>
      ${historyTable(list, { showCustomer, canReopen, limit, empty })}
    </section>`;
  }
  function historyTable(list, { showCustomer, canReopen, limit, empty }) {
    return `
      ${list.length ? `<div class="table-wrap"><table class="data">
        <thead><tr>${showCustomer ? '<th>Customer</th>' : ''}<th>Schedule</th><th>Was due</th><th class="hide-sm">Assigned to</th><th>Result</th><th>Closed by</th><th class="hide-sm">Closed on</th><th>Outcome / note</th>${showCustomer ? '' : '<th></th>'}</tr></thead>
        <tbody>${list.map((t, i) => `<tr style="cursor:default" ${i >= limit ? 'data-extra hidden' : ''}>
          ${showCustomer ? `<td><a href="#/customers/${t.contactId}"><strong>${esc(t.contactName)}</strong></a></td>` : ''}
          <td><strong>${esc(t.title)}</strong>${t.rescheduleCount ? `<div class="muted small">moved ${t.rescheduleCount}× · first set for ${fmtDate(t.originalDueAt)}</div>` : ''}</td>
          <td style="white-space:nowrap">${fmtDate(t.dueAt)}</td>
          <td class="hide-sm">${ownerHtml(t.assignee)}</td>
          <td style="white-space:nowrap">${followResult(t)}</td>
          <td>${ownerHtml(t.completedBy)}</td>
          <td class="hide-sm muted" style="white-space:nowrap">${fmtDate(t.completedAt)}</td>
          <td class="small">${t.completionNote ? esc(t.completionNote) : '<span class="muted">—</span>'}</td>
          ${showCustomer ? '' : `<td>${canReopen ? `<button class="btn btn-sm btn-ghost" data-reopen="${t.id}" title="Re-open">Re-open</button>` : ''}</td>`}
        </tr>`).join('')}</tbody></table></div>` : `<div class="card-empty">${esc(empty)}</div>`}`;
  }
  function timelineTitle(a) {
    if (a.type === 'call') return `Call — ${outcomeLabel(a.outcome)}`;
    if (a.type === 'email') return 'Email sent';
    if (a.type === 'note') return a.subject || 'Note';
    if (a.type === 'whatsapp') return 'WhatsApp conversation';
    if (a.type === 'meeting') return 'Office visit / meeting';
    return a.subject || a.type;
  }
  function openReschedule(task, done) {
    if (!task) return;
    openModal('Reschedule', `
      <form class="stack" id="reForm">
        <p class="muted" style="margin:0">${esc(task.title)}${task.contactName ? ` · ${esc(task.contactName)}` : ''}</p>
        <div class="field"><span>New date &amp; time</span>${dtpHtml('dueAt', toLocalInput(task.dueAt))}</div>
        <div class="form-actions"><button type="button" class="btn btn-ghost btn-danger" id="cancelTask">Cancel schedule</button><span class="spacer"></span><button class="btn btn-primary">Save</button></div>
      </form>`, body => {
      wireDtp(body);
      $('[data-dtp]', body)._dtp.open();
      $('#reForm', body).addEventListener('submit', async event => {
        event.preventDefault();
        if (!event.target.dueAt.value) return toast('Pick a date and time.', 'error');
        try {
          await api(`/api/crm/tasks/${task.id}`, { method: 'PATCH', body: { dueAt: new Date(event.target.dueAt.value).toISOString() } });
          closeModal(); toast('Rescheduled'); refreshFollowCount(); done();
        } catch (error) { fail(error); }
      });
      $('#cancelTask', body).addEventListener('click', async () => {
        try { await api(`/api/crm/tasks/${task.id}`, { method: 'PATCH', body: { status: 'cancelled' } }); closeModal(); toast('Schedule cancelled'); refreshFollowCount(); done(); } catch (error) { fail(error); }
      });
    }, { wide: true });
  }

  // ---------------------------------------------------------------- pipeline

  // ---------------------------------------------------------------- schedules
  async function renderFollowups() {
    if (parseHash().query.tab === 'history') return renderFollowHistory(parseHash().query);
    const { tasks: allTasks } = await api(`/api/crm/tasks?assignee=${encodeURIComponent(S.followAssignee)}`);
    // Tabs: All schedules, then one tab per customer status (New, Contacted, ...).
    let tab = parseHash().query.tab || 'all';
    if (tab !== 'all' && !S.meta.stages.some(st => st.id === tab)) tab = 'all';
    const tasks = tab === 'all' ? allTasks : allTasks.filter(t => t.contactStage === tab);
    const tabCounts = { all: allTasks.length };
    for (const st of S.meta.stages) tabCounts[st.id] = allTasks.filter(t => t.contactStage === st.id).length;
    const now = new Date();
    const today = dayKey(now);
    const tomorrow = dayKey(Date.now() + 86400000);
    // All schedules in date and time order: Overdue, Today, Tomorrow, then one group per date.
    const groups = [];
    const late = tasks.filter(t => new Date(t.dueAt) < now);
    if (late.length) groups.push({ label: 'Overdue', cls: 'overdue', list: late });
    for (const t of tasks.filter(x => new Date(x.dueAt) >= now)) {
      const key = dayKey(t.dueAt);
      let g = groups.find(x => x.key === key);
      if (!g) {
        const label = key === today ? 'Today' : key === tomorrow ? 'Tomorrow' : new Date(t.dueAt).toLocaleDateString('en-IN', { ...IST, weekday: 'long', day: 'numeric', month: 'short' });
        g = { key, label, cls: key === today ? 'today' : '', list: [] };
        groups.push(g);
      }
      g.list.push(t);
    }
    const timeOf = t => new Date(t.dueAt).toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit' });
    const dateOf = t => new Date(t.dueAt).toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short' });
    const showWho = S.followAssignee !== 'me';
    view().innerHTML = `
      <div class="page-head">
        <div><h2>Schedules</h2><p>Scheduled calls and visits. Tap Call to dial, then log what happened.</p></div>
        ${S.me.isManager ? `<label class="pill-select ${S.followAssignee !== 'all' ? 'active' : ''}"><span>Showing</span><select id="followWho"><option value="all" ${S.followAssignee === 'all' ? 'selected' : ''}>Everyone</option><option value="unassigned" ${S.followAssignee === 'unassigned' ? 'selected' : ''}>Not assigned</option>${agentOptions(S.followAssignee)}</select></label>` : '<span class="scope-note">Your schedules</span>'}
      </div>
      ${followTabs(tab, tabCounts)}
      <section class="card sched">
        ${tasks.length ? groups.map(g => `
          <div class="sched-day ${g.cls}"><strong>${esc(g.label)}</strong><span>${g.list.length} schedule${g.list.length === 1 ? '' : 's'}</span></div>
          <ul class="sched-list">${g.list.map(t => `<li data-task="${t.id}" class="${g.cls === 'overdue' ? 'is-late' : ''}">
            <button class="check" data-done="${t.id}" data-title="${esc(t.title)} · ${esc(t.contactName)}" aria-label="Mark done" title="Mark done">${ICONS.check}</button>
            <div class="sched-time"><strong>${timeOf(t)}</strong>${g.cls === 'overdue' ? `<small>${dateOf(t)}</small>` : ''}</div>
            <div class="grow"><div class="sched-name"><a class="title" href="#/customers/${t.contactId}?log=${t.id}">${esc(t.contactName)}</a>${stagePill(t.contactStage)}${t.rescheduleCount ? `<span class="tag">moved ${t.rescheduleCount}×</span>` : ''}</div>
              <div class="sub">${esc(t.title)}${t.notes ? ` — ${esc(t.notes)}` : ''}${showWho ? ` · <b>${esc(memberName(t.assignee))}</b>` : ''}</div></div>
            <button class="icon-btn" data-resched="${t.id}" title="Reschedule" aria-label="Reschedule">${ICONS.calendar}</button>
            <a class="btn btn-sm btn-call" href="${telHref(t.contactPhone)}" data-call="${t.contactId}" data-task-id="${t.id}">${ICONS.phone}Call</a>
          </li>`).join('')}</ul>`).join('') : `<div class="card-empty">${tab === 'all' ? 'No open schedules. 👍' : `No schedules for ${esc(stage(tab).label.toLowerCase())} customers.`}</div>`}
      </section>`;
    $('#followWho')?.addEventListener('change', event => { S.followAssignee = event.target.value; S.followTouched = true; renderFollowups().catch(fail); });
    bindCallButtons();
    bindTaskButtons(renderFollowups);
    $$('[data-resched]').forEach(btn => btn.addEventListener('click', () => openReschedule(tasks.find(t => String(t.id) === btn.dataset.resched), () => renderFollowups().catch(fail))));
  }

  function followTabs(active, counts = {}) {
    const n = id => counts[id] === undefined ? '' : `<span class="tab-count">${counts[id]}</span>`;
    return `<div class="tabs">
      <a href="#/followups" class="${active === 'all' ? 'on' : ''}">All schedules${n('all')}</a>
      ${S.meta.stages.map(st => `<a href="#/followups?tab=${st.id}" class="${active === st.id ? 'on' : ''}">${esc(st.label)}${n(st.id)}</a>`).join('')}
      <a href="#/followups?tab=history" class="tab-history ${active === 'history' ? 'on' : ''}">History</a>
    </div>`;
  }
  async function renderFollowHistory(query) {
    const days = Number(query.days) || 30;
    const who = query.who || (S.me.isManager ? '' : 'me');
    const params = new URLSearchParams({ status: 'history', days, assignee: 'all', ...(who ? { doneBy: who } : {}) });
    const { tasks } = await api(`/api/crm/tasks?${params}`);
    const done = tasks.filter(t => t.status === 'done');
    const late = done.filter(t => new Date(t.completedAt) - new Date(t.dueAt) >= 86400000);
    view().innerHTML = `
      <div class="page-head">
        <div><h2>Schedules</h2><p>Every schedule that was completed or cancelled: who closed it, when, and what happened.</p></div>
        <div class="row">
          ${S.me.isManager ? `<label class="pill-select ${who ? 'active' : ''}"><span>Closed by</span><select id="histWho"><option value="">Anyone</option><option value="me" ${who === 'me' ? 'selected' : ''}>Me</option>${S.meta.team.filter(m => m.username.toLowerCase() !== S.me.username.toLowerCase()).map(m => `<option value="${esc(m.username)}" ${who === m.username ? 'selected' : ''}>${esc(m.displayName)}</option>`).join('')}</select></label>` : '<span class="scope-note">Your schedules</span>'}
          <div class="seg">${[[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '1 year']].map(([d, l]) => `<button data-days="${d}" class="${days === d ? 'on' : ''}">${l}</button>`).join('')}</div>
        </div>
      </div>
      ${followTabs('history')}
      <div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        <div class="kpi"><span>Completed</span><strong>${done.length}</strong><small>Last ${days} days</small></div>
        <div class="kpi"><span>On time</span><strong>${done.length ? Math.round(((done.length - late.length) / done.length) * 100) : 0}%</strong><small>${done.length - late.length} of ${done.length}</small></div>
        <div class="kpi ${late.length ? 'is-alert' : ''}"><span>Done late (1+ day)</span><strong>${late.length}</strong><small>after the due date</small></div>
        <div class="kpi"><span>Cancelled</span><strong>${tasks.length - done.length}</strong><small>incl. closed customers</small></div>
      </div>
      ${followHistoryHtml(tasks, { title: 'Closed schedules', showCustomer: true, empty: 'No schedules were closed in this period.' })}`;
    const go = extra => setQuery('followups', { tab: 'history', days, who, ...extra });
    $('#histWho')?.addEventListener('change', e => go({ who: e.target.value }));
    $$('[data-days]').forEach(b => b.addEventListener('click', () => go({ days: b.dataset.days })));
  }

  // ---------------------------------------------------------------- reports
  function fmtMinutes(min) {
    const m = Math.max(0, Number(min) || 0);
    if (m < 60) return `${m} min`;
    if (m < 1440) return `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}`;
    return `${Math.round(m / 1440)} day${Math.round(m / 1440) === 1 ? '' : 's'}`;
  }
  function teamRows(r) {
    const map = new Map();
    for (const o of r.byOwner) map.set((o.key || '').toLowerCase(), { username: o.key, count: o.count, open: o.open, converted: o.converted, calls: 0, connected: 0, emails: 0 });
    for (const c of r.calls) {
      const key = (c.key || '').toLowerCase();
      const row = map.get(key) || { username: c.key, count: 0, open: 0, converted: 0, calls: 0, connected: 0, emails: 0 };
      Object.assign(row, { calls: c.calls, connected: c.connected, emails: c.emails });
      map.set(key, row);
    }
    for (const sp of r.speed || []) {
      if (sp.key === null) continue;
      const row = map.get(sp.key || '');
      if (row) row.speed = sp.avg_minutes;
    }
    return [...map.values()].sort((a, b) => (b.count + b.calls) - (a.count + a.calls));
  }
  function bindTips() {
    let tip;
    $$('[data-tip]').forEach(el => {
      el.addEventListener('mouseenter', () => { tip = document.createElement('div'); tip.className = 'tip'; tip.textContent = el.dataset.tip; document.body.append(tip); });
      el.addEventListener('mousemove', event => { if (tip) { tip.style.left = `${event.clientX + 12}px`; tip.style.top = `${event.clientY - 32}px`; } });
      el.addEventListener('mouseleave', () => { tip?.remove(); tip = null; });
    });
  }

  // ---------------------------------------------------------------- team
  async function renderTeam() {
    const [{ members }, { settings }] = await Promise.all([api('/api/crm/team'), api('/api/crm/settings')]);
    const staff = members.filter(m => m.isActive && m.role === 'agent');
    const roleLabel = role => (role === 'agent' ? 'Staff' : 'Admin');
    view().innerHTML = `
      <div class="page-head">
        <div><h2>Team</h2><p>Everyone who can sign in. <strong>Admin</strong>: everything, including website content and team. <strong>Staff</strong>: enquiries and schedules only.</p></div>
        <button class="btn btn-primary" id="addMember">+ Add team member</button>
      </div>
      <section class="card assign-card">
        <div class="assign-row">
          <div class="grow"><strong>New enquiries go to</strong>
            <span>${staff.length ? 'Website enquiries and enquiries you add are given to staff automatically. A repeat enquiry stays with the same person.' : '<strong style="color:var(--danger)">There is no active Staff member yet</strong> — new enquiries stay unassigned and admins get an email. Add a Staff member below.'}</span></div>
          <label class="field assign-field"><select id="assignTo" ${staff.length ? '' : 'disabled'}>
            <option value="" ${settings.assignTo ? '' : 'selected'}>${staff.length > 1 ? 'Take turns between staff' : staff.length ? `${esc(staff[0].displayName)} (only staff member)` : 'Nobody yet'}</option>
            ${staff.length > 1 ? `<optgroup label="Always the same person">${staff.map(m => `<option value="${esc(m.username)}" data-initials="${esc(initials(m.displayName))}" ${settings.assignTo === m.username.toLowerCase() ? 'selected' : ''}>${esc(m.displayName)}</option>`).join('')}</optgroup>` : ''}
          </select></label>
        </div>
      </section>
      <section class="card"><div class="table-wrap"><table class="data">
        <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th class="num">Open enquiries</th><th class="num">Converted</th><th>Status</th><th></th></tr></thead>
        <tbody>${members.map(m => `<tr style="cursor:default">
          <td><div class="cust-cell" style="min-width:0"><span class="avatar">${esc(initials(m.displayName))}</span><div><strong>${esc(m.displayName)}</strong>${m.designation ? `<span class="member-desig">${esc(m.designation)}</span>` : ''}</div></div></td>
          <td>${esc(m.username)}</td><td>${esc(m.email || '—')}</td>
          <td><span class="role-tag ${m.role === 'agent' ? '' : 'is-admin'}">${roleLabel(m.role)}</span></td>
          <td class="num">${m.openLeads}</td><td class="num">${m.converted}</td>
          <td>${m.isActive ? '<span class="pill st-converted">Active</span>' : '<span class="pill st-not_interested">Deactivated</span>'}</td>
          <td><button class="btn btn-sm" data-edit="${esc(m.username)}">Edit</button></td>
        </tr>`).join('')}</tbody></table></div></section>`;
    $('#assignTo')?.addEventListener('change', async event => {
      try {
        await api('/api/crm/settings', { method: 'PUT', body: { assignTo: event.target.value, autoAssign: true } });
        toast(event.target.value ? `New enquiries will go to ${memberName(event.target.value)}` : 'New enquiries will take turns between staff');
      } catch (error) { fail(error); }
    });
    // Admin keeps an older Manager account's own role value, so its login is unchanged.
    const roleOptions = sel => `<option value="${sel === 'systemadmin' ? 'systemadmin' : 'superadmin'}" ${sel === 'agent' ? '' : 'selected'}>Admin — everything</option><option value="agent" ${sel === 'agent' ? 'selected' : ''}>Staff — enquiries and schedules</option>`;
    $('#addMember').addEventListener('click', () => openModal('Add team member', `
      <form class="stack" id="mForm">
        <label class="field"><span>Full name</span><input name="displayName" required></label>
        <div class="grid-2">
          <label class="field"><span>Username</span><input name="username" required pattern="[a-zA-Z0-9._-]{3,40}" placeholder="e.g. priya"></label>
          <label class="field"><span>Role</span><select name="role">${roleOptions('agent')}</select></label>
        </div>
        <label class="field"><span>Email</span><input name="email" type="email" required></label>
        <label class="field"><span>Temporary password <small class="muted">min 12 characters, letters and numbers</small></span><input name="password" type="text" minlength="12" required value="${esc(randomPassword())}"></label>
        <p class="muted small" style="margin:0">Share the username and password with them privately. They can change the password after signing in.</p>
        <div class="form-error" id="mError" hidden></div>
        <div class="form-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Add</button></div>
      </form>`, body => {
      $('#mForm', body).addEventListener('submit', async event => {
        event.preventDefault();
        try {
          await api('/api/crm/team', { method: 'POST', body: Object.fromEntries(new FormData(event.target)) });
          closeModal(); toast('Team member added');
          S.meta = await api('/api/crm/meta');
          renderTeam().catch(fail);
        } catch (error) { const el = $('#mError', body); el.textContent = error.message; el.hidden = false; }
      });
    }));
    $$('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
      const m = members.find(x => x.username === btn.dataset.edit);
      openModal(`Edit ${m.displayName}`, `
        <form class="stack" id="mForm">
          <label class="field"><span>Full name</span><input name="displayName" value="${esc(m.displayName)}" required></label>
          <label class="field"><span>Email</span><input name="email" type="email" value="${esc(m.email || '')}"></label>
          <label class="field"><span>Role</span><select name="role">${roleOptions(m.role)}</select></label>
          <label class="field"><span>Reset password <small class="muted">leave empty to keep</small></span><input name="password" type="text" minlength="12" autocomplete="new-password"></label>
          <label class="row"><input type="checkbox" name="isActive" ${m.isActive ? 'checked' : ''}> Active (can sign in)</label>
          ${m.isActive && m.openLeads ? `<p class="muted small" style="margin:0">If you deactivate ${esc(m.displayName.split(' ')[0])}, their ${m.openLeads} open customer${m.openLeads === 1 ? '' : 's'} and schedules are handed to the other staff in turn.</p>` : ''}
          <div class="form-error" id="mError" hidden></div>
          <div class="form-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Save</button></div>
        </form>`, body => {
        $('#mForm', body).addEventListener('submit', async event => {
          event.preventDefault();
          const f = event.target;
          const payload = { displayName: f.displayName.value, role: f.role.value, isActive: f.isActive.checked };
          if (f.email.value) payload.email = f.email.value;
          if (f.password.value) payload.password = f.password.value;
          try {
            const r = await api(`/api/crm/team/${encodeURIComponent(m.username)}`, { method: 'PATCH', body: payload });
            closeModal(); toast('Saved');
            S.meta = await api('/api/crm/meta');
            renderTeam().catch(fail);
            if (r.handover) {
              const h = r.handover;
              openModal(`${m.displayName} has been deactivated`, `
                <p style="margin-top:0">${h.total ? `Their <strong>${h.total} open customer${h.total === 1 ? '' : 's'}</strong> and open schedules were handed over:` : 'They had no open customers to hand over.'}</p>
                ${Object.keys(h.counts).length ? `<ul>${Object.entries(h.counts).map(([n, c]) => `<li><strong>${esc(n)}</strong> — ${c} customer${c === 1 ? '' : 's'}</li>`).join('')}</ul>` : ''}
                ${h.unassigned ? `<p class="form-error">${h.unassigned} customer${h.unassigned === 1 ? ' is' : 's are'} unassigned because no other staff member is available. Assign them from Customers → Owner: Unassigned.</p>` : ''}
                <p class="muted small">Each customer's timeline shows the hand-over. Closed customers (Converted / Not interested) keep their history.</p>
                <div class="form-actions"><button class="btn btn-primary" data-close>OK</button></div>`);
            }
          } catch (error) { const el = $('#mError', body); el.textContent = error.message; el.hidden = false; }
        });
      });
    }));
  }
  function randomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const arr = new Uint32Array(13);
    crypto.getRandomValues(arr);
    return `${[...arr].map(n => chars[n % chars.length]).join('')}!7`;
  }

  // ================================================================ WEBSITE CONTENT (inside the CRM)
  const pubBadge = on => on ? '<span class="pill st-converted">Published</span>' : '<span class="pill st-not_interested">Draft</span>';
  const CATEGORY_LABELS = { news: 'News / blog', youtube: 'YouTube video', instagram: 'Instagram post' };
  function sectionTabs(route, tabs, current) {
    return `<div class="tabs">${tabs.map(([id, label, count]) => `<a href="#/${route}?tab=${id}" class="${id === current ? 'on' : ''}">${esc(label)}${count !== undefined ? ` <span class="muted">${count}</span>` : ''}</a>`).join('')}</div>`;
  }
  function confirmDelete(what, run) {
    openModal(`Delete ${what}?`, `
      <p style="margin-top:0">This cannot be undone.</p>
      <div class="form-actions"><button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="confirmDel">Delete</button></div>`, body => {
      $('#confirmDel', body).addEventListener('click', async () => {
        try { await run(); closeModal(); toast('Deleted'); render(); } catch (error) { fail(error); }
      });
    });
  }
  async function uploadFile(url, field, file) {
    const data = new FormData();
    data.append(field, file);
    return api(url, { method: 'POST', body: data });
  }
  function formError(body, error) { const el = $('.form-error', body); el.textContent = error.message; el.hidden = false; }

  // ---------------------------------------------------------------- News & media
  async function renderNews() {
    const { posts } = await api('/api/admin/news');
    view().innerHTML = `
      <div class="page-head">
        <div><h2>News &amp; media</h2><p>Posts shown on the website's News page. YouTube and Instagram links are embedded automatically.</p></div>
        <button class="btn btn-primary" id="newPost">+ New post</button>
      </div>
      <section class="card">
        ${posts.length ? `<ul class="list">${posts.map(p => `
          <li>
            ${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="" class="thumb" loading="lazy">` : `<span class="thumb thumb-empty">${ICONS.note}</span>`}
            <div class="grow"><a href="#" class="title" data-edit-post="${p.id}">${esc(p.title)}</a>
              <div class="sub">${esc(CATEGORY_LABELS[p.category] || p.category)} · ${fmtDate(p.createdAt, false)}${p.description ? ` · ${esc(p.description.slice(0, 90))}` : ''}</div></div>
            ${pubBadge(p.isPublished)}
            <button class="btn btn-sm" data-edit-post="${p.id}">Edit</button>
            ${S.me.isOwner ? `<button class="btn btn-sm btn-ghost btn-danger" data-del-post="${p.id}">Delete</button>` : ''}
          </li>`).join('')}</ul>` : '<div class="card-empty">No posts yet. Add your first news update, YouTube video or Instagram post.</div>'}
      </section>`;
    const openPost = (post = {}) => openModal(post.id ? 'Edit post' : 'New post', `
      <form class="stack" id="postForm">
        <div class="grid-2">
          <label class="field"><span>Type</span><select name="category">${Object.entries(CATEGORY_LABELS).map(([v, l]) => `<option value="${v}" ${v === (post.category || 'news') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field"><span>Visibility</span><select name="isPublished"><option value="true" ${post.isPublished !== false ? 'selected' : ''}>Published</option><option value="false" ${post.isPublished === false ? 'selected' : ''}>Draft (hidden)</option></select></label>
        </div>
        <label class="field"><span>Title</span><input name="title" value="${esc(post.title || '')}" required maxlength="180"></label>
        <label class="field"><span>Description</span><textarea name="description" rows="5">${esc(post.description || '')}</textarea></label>
        <label class="field"><span>YouTube / Instagram / article link</span><input name="mediaUrl" value="${esc(post.mediaUrl || '')}" placeholder="https://"></label>
        <div class="field"><span>Photo</span>
          <div class="row"><input name="imageUrl" value="${esc(post.imageUrl || '')}" placeholder="Image link, or upload →" style="flex:1"><label class="btn">Upload<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" id="postImage" hidden></label></div>
          <img id="postPreview" class="preview" alt="" ${post.imageUrl ? `src="${esc(post.imageUrl)}"` : 'hidden'}>
        </div>
        <div class="form-error" hidden></div>
        <div class="form-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">${post.id ? 'Save' : 'Publish'}</button></div>
      </form>`, body => {
      const form = $('#postForm', body);
      $('#postImage', body).addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;
        try {
          toast('Uploading photo…');
          const { url } = await uploadFile('/api/admin/uploads', 'image', file);
          form.imageUrl.value = url;
          $('#postPreview', body).src = url;
          $('#postPreview', body).hidden = false;
        } catch (error) { fail(error); }
      });
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const payload = { ...Object.fromEntries(new FormData(form)), isPublished: form.isPublished.value === 'true' };
        try {
          await api(post.id ? `/api/admin/news/${post.id}` : '/api/admin/news', { method: post.id ? 'PATCH' : 'POST', body: payload });
          closeModal(); toast('Post saved'); renderNews().catch(fail);
        } catch (error) { formError(body, error); }
      });
    }, { wide: true });
    $('#newPost').addEventListener('click', () => openPost());
    $$('[data-edit-post]').forEach(el => el.addEventListener('click', event => { event.preventDefault(); openPost(posts.find(p => String(p.id) === el.dataset.editPost)); }));
    $$('[data-del-post]').forEach(el => el.addEventListener('click', () => confirmDelete('this post', () => api(`/api/admin/news/${el.dataset.delPost}`, { method: 'DELETE' }))));
  }

  // ---------------------------------------------------------------- Careers
  const APP_STATUSES = [['new', 'New'], ['reviewed', 'Reviewed'], ['shortlisted', 'Shortlisted'], ['rejected', 'Rejected']];
  const APP_STATUS_CLASS = { new: 'st-new', reviewed: 'st-contacted', shortlisted: 'st-converted', rejected: 'st-not_interested' };
  async function renderCareers(query) {
    const tab = query.tab === 'openings' ? 'openings' : 'applications';
    const [{ applications }, { openings }] = await Promise.all([api('/api/admin/applications'), api('/api/admin/openings')]);
    const head = `
      <div class="page-head">
        <div><h2>Careers</h2><p>Job applications from the website's Careers page, and the openings shown there.</p></div>
        ${tab === 'openings' ? '<button class="btn btn-primary" id="newOpening">+ New opening</button>' : ''}
      </div>
      ${sectionTabs('careers', [['applications', 'Applications', applications.length], ['openings', 'Job openings', openings.length]], tab)}`;

    if (tab === 'applications') {
      const filter = query.status || '';
      const rows = applications.filter(a => !filter || a.status === filter);
      view().innerHTML = `${head}
        <div class="chips" style="margin-bottom:12px">${[['', 'All'], ...APP_STATUSES].map(([v, l]) => `<a class="chip ${v === filter ? 'on' : ''}" href="#/careers?tab=applications${v ? `&status=${v}` : ''}" style="text-decoration:none">${l} ${v ? applications.filter(a => a.status === v).length : applications.length}</a>`).join('')}</div>
        <section class="card">${rows.length ? `<div class="table-wrap"><table class="data">
          <thead><tr><th>Candidate</th><th>Position</th><th>Mobile</th><th class="hide-sm">City</th><th>Status</th><th class="hide-sm">Applied</th><th>Resume</th></tr></thead>
          <tbody>${rows.map(a => `<tr data-app="${a.id}">
            <td><div class="cust-cell"><span class="avatar">${esc(initials(`${a.firstName} ${a.lastName}`))}</span><div><strong>${esc(a.firstName)} ${esc(a.lastName)}</strong><span>${esc(a.email)}</span></div></div></td>
            <td>${esc(a.positionName)}</td>
            <td><a class="phone-link" href="${telHref(a.phone)}">${esc(a.phone)}</a></td>
            <td class="hide-sm">${esc(a.city || '—')}</td>
            <td><span class="pill ${APP_STATUS_CLASS[a.status] || 'st-new'}">${esc((APP_STATUSES.find(s => s[0] === a.status) || [, a.status])[1])}</span></td>
            <td class="hide-sm muted">${fmtDate(a.createdAt, false)}</td>
            <td>${a.resumeUrl ? `<a class="btn btn-sm" href="${esc(a.resumeUrl)}" target="_blank" rel="noopener">${ICONS.download}Resume</a>` : '—'}</td>
          </tr>`).join('')}</tbody></table></div>` : '<div class="card-empty">No applications here yet.</div>'}</section>`;
      $$('tr[data-app]').forEach(tr => tr.addEventListener('click', event => {
        if (event.target.closest('a')) return;
        const a = applications.find(x => String(x.id) === tr.dataset.app);
        openModal(`${a.firstName} ${a.lastName}`, `
          <dl class="props" style="margin-bottom:16px">
            <div><dt>Position</dt><dd>${esc(a.positionName)}</dd></div>
            <div><dt>Mobile</dt><dd><a href="${telHref(a.phone)}">${esc(a.phone)}</a></dd></div>
            <div><dt>Email</dt><dd><a href="mailto:${esc(a.email)}">${esc(a.email)}</a></dd></div>
            <div><dt>Address</dt><dd>${esc([a.address, a.city, a.state, a.pincode, a.country].filter(Boolean).join(', ') || '—')}</dd></div>
            <div><dt>Applied</dt><dd>${fmtDate(a.createdAt)}</dd></div>
            <div><dt>Resume</dt><dd>${a.resumeUrl ? `<a href="${esc(a.resumeUrl)}" target="_blank" rel="noopener">${esc(a.resumeFilename || 'Download')}</a>` : '—'}</dd></div>
          </dl>
          <form class="stack" id="appForm">
            <label class="field"><span>Status</span><select name="status">${APP_STATUSES.map(([v, l]) => `<option value="${v}" ${v === a.status ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="field"><span>Notes</span><textarea name="notes" rows="4" placeholder="Interview feedback, next step…">${esc(a.notes || '')}</textarea></label>
            <div class="form-error" hidden></div>
            <div class="form-actions">${S.me.isOwner ? '<button type="button" class="btn btn-ghost btn-danger" id="delApp">Delete</button><span class="spacer"></span>' : ''}<button type="button" class="btn" data-close>Close</button><button class="btn btn-primary">Save</button></div>
          </form>`, body => {
          $('#appForm', body).addEventListener('submit', async event => {
            event.preventDefault();
            try {
              await api(`/api/admin/applications/${a.id}`, { method: 'PATCH', body: Object.fromEntries(new FormData(event.target)) });
              closeModal(); toast('Saved'); render();
            } catch (error) { formError(body, error); }
          });
          $('#delApp', body)?.addEventListener('click', () => confirmDelete('this application', () => api(`/api/admin/applications/${a.id}`, { method: 'DELETE' })));
        });
      }));
      return;
    }

    view().innerHTML = `${head}
      <section class="card">${openings.length ? `<ul class="list">${openings.map(o => `
        <li>
          <div class="grow"><a href="#" class="title" data-edit-opening="${o.id}">${esc(o.title)}</a>
            <div class="sub">${esc([o.department, o.location, o.jobType, o.experience].filter(Boolean).join(' · '))}</div></div>
          ${o.isActive ? '<span class="pill st-converted">Open</span>' : '<span class="pill st-not_interested">Closed</span>'}
          <button class="btn btn-sm" data-edit-opening="${o.id}">Edit</button>
          ${S.me.isOwner ? `<button class="btn btn-sm btn-ghost btn-danger" data-del-opening="${o.id}">Delete</button>` : ''}
        </li>`).join('')}</ul>` : '<div class="card-empty">No job openings yet.</div>'}</section>`;
    const openOpening = (o = {}) => openModal(o.id ? 'Edit opening' : 'New job opening', `
      <form class="stack" id="openForm">
        <label class="field"><span>Job title</span><input name="title" value="${esc(o.title || '')}" required></label>
        <div class="grid-2">
          <label class="field"><span>Department</span><input name="department" value="${esc(o.department || 'Sales & Operations')}"></label>
          <label class="field"><span>Location</span><input name="location" value="${esc(o.location || 'Nagpur, Maharashtra')}"></label>
        </div>
        <div class="grid-2">
          <label class="field"><span>Job type</span><select name="jobType">${['Full Time', 'Part Time', 'Contract', 'Internship'].map(v => `<option ${v === (o.jobType || 'Full Time') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="field"><span>Experience</span><input name="experience" value="${esc(o.experience || '1-3 Years')}"></label>
        </div>
        <label class="field"><span>Description</span><textarea name="description" rows="4" required>${esc(o.description || '')}</textarea></label>
        <label class="field"><span>Requirements</span><textarea name="requirements" rows="3">${esc(o.requirements || '')}</textarea></label>
        <div class="grid-2">
          <label class="field"><span>Show on website</span><select name="isActive"><option value="true" ${o.isActive !== false ? 'selected' : ''}>Yes, accepting applications</option><option value="false" ${o.isActive === false ? 'selected' : ''}>No, closed</option></select></label>
          <label class="field"><span>Display order</span><input name="sortOrder" type="number" value="${esc(o.sortOrder ?? 0)}"></label>
        </div>
        <div class="form-error" hidden></div>
        <div class="form-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Save</button></div>
      </form>`, body => {
      $('#openForm', body).addEventListener('submit', async event => {
        event.preventDefault();
        const payload = { ...Object.fromEntries(new FormData(event.target)), isActive: event.target.isActive.value === 'true' };
        try {
          await api(o.id ? `/api/admin/openings/${o.id}` : '/api/admin/openings', { method: o.id ? 'PATCH' : 'POST', body: payload });
          closeModal(); toast('Opening saved'); render();
        } catch (error) { formError(body, error); }
      });
    }, { wide: true });
    $('#newOpening').addEventListener('click', () => openOpening());
    $$('[data-edit-opening]').forEach(el => el.addEventListener('click', event => { event.preventDefault(); openOpening(openings.find(o => String(o.id) === el.dataset.editOpening)); }));
    $$('[data-del-opening]').forEach(el => el.addEventListener('click', () => confirmDelete('this opening', () => api(`/api/admin/openings/${el.dataset.delOpening}`, { method: 'DELETE' }))));
  }

  // ---------------------------------------------------------------- Site pages, FAQs, support, certificates
  const PAGE_LABELS = { faq: 'FAQ page', 'contact-us': 'Contact us', 'support-center': 'Support center', 'privacy-policy': 'Privacy policy', 'authorized-certificates': 'Certificates page', 'terms-and-conditions': 'Terms & conditions' };
  const PAGE_URLS = { faq: '/faq', 'contact-us': '/contact-us', 'support-center': '/support-center', 'privacy-policy': '/privacy-policy', 'authorized-certificates': '/authorized-certificates', 'terms-and-conditions': '/terms-and-conditions' };
  async function renderSite(query) {
    const tab = ['pages', 'faqs', 'support', 'certificates'].includes(query.tab) ? query.tab : 'pages';
    const data = await api('/api/admin/site-content');
    const head = `
      <div class="page-head"><div><h2>Site pages</h2><p>Text on the website's information pages, FAQs, support options and published certificates.</p></div>
        ${tab === 'faqs' ? '<button class="btn btn-primary" data-new>+ New FAQ</button>' : tab === 'support' ? '<button class="btn btn-primary" data-new>+ New support item</button>' : tab === 'certificates' ? '<button class="btn btn-primary" data-new>+ Upload certificate</button>' : ''}
      </div>
      ${sectionTabs('site', [['pages', 'Pages', data.pages.length], ['faqs', 'FAQs', data.faqs.length], ['support', 'Support items', data.supportItems.length], ['certificates', 'Certificates', data.certificates.length]], tab)}`;

    if (tab === 'pages') {
      const slug = PAGE_LABELS[query.page] ? query.page : data.pages[0]?.slug;
      const page = data.pages.find(p => p.slug === slug) || {};
      view().innerHTML = `${head}
        <div class="split">
          <nav class="card side-list">${data.pages.map(p => `<a href="#/site?tab=pages&page=${p.slug}" class="${p.slug === slug ? 'on' : ''}"><strong>${esc(PAGE_LABELS[p.slug] || p.slug)}</strong><span>${p.updatedAt ? `Updated ${relTime(p.updatedAt)}` : 'Default text'}</span></a>`).join('')}</nav>
          <section class="card"><form class="card-body stack" id="pageForm">
            <div class="row"><h2 style="font-size:15px">${esc(PAGE_LABELS[slug] || slug)}</h2><span class="spacer"></span><a class="btn btn-sm" href="${PAGE_URLS[slug]}" target="_blank" rel="noopener">View page ↗</a></div>
            <label class="field"><span>Page title</span><input name="title" value="${esc(page.title || '')}" required></label>
            <label class="field"><span>Short introduction</span><textarea name="intro" rows="2">${esc(page.intro || '')}</textarea></label>
            <label class="field"><span>Page text</span><textarea name="body" rows="14">${esc(page.body || '')}</textarea></label>
            <p class="muted small" style="margin:0">Plain text. Leave a blank line between paragraphs.</p>
            <div class="form-error" hidden></div>
            <div class="form-actions"><button class="btn btn-primary">Save page</button></div>
          </form></section>
        </div>`;
      $('#pageForm').addEventListener('submit', async event => {
        event.preventDefault();
        try {
          await api(`/api/admin/site-pages/${slug}`, { method: 'PUT', body: Object.fromEntries(new FormData(event.target)) });
          toast('Page saved'); render();
        } catch (error) { formError(view(), error); }
      });
      return;
    }

    const configs = {
      faqs: {
        items: data.faqs, api: '/api/admin/site-faqs', noun: 'FAQ',
        title: f => f.question, sub: f => f.answer,
        form: (f = {}) => `
          <label class="field"><span>Question</span><input name="question" value="${esc(f.question || '')}" required></label>
          <label class="field"><span>Answer</span><textarea name="answer" rows="5">${esc(f.answer || '')}</textarea></label>`,
      },
      support: {
        items: data.supportItems, api: '/api/admin/support-items', noun: 'support item',
        title: f => f.title, sub: f => [f.description, f.linkUrl].filter(Boolean).join(' · '),
        form: (f = {}) => `
          <label class="field"><span>Title</span><input name="title" value="${esc(f.title || '')}" required></label>
          <label class="field"><span>Description</span><textarea name="description" rows="3">${esc(f.description || '')}</textarea></label>
          <label class="field"><span>Link (page, phone or email)</span><input name="linkUrl" value="${esc(f.linkUrl || '')}" placeholder="/contact-us, tel:+91…, mailto:…"></label>`,
      },
      certificates: {
        items: data.certificates, api: '/api/admin/certificates', noun: 'certificate',
        title: f => f.title, sub: f => [f.fileName, f.description].filter(Boolean).join(' · '),
        form: (f = {}) => `
          <label class="field"><span>Title</span><input name="title" value="${esc(f.title || '')}" required placeholder="e.g. Certificate of Registration"></label>
          <label class="field"><span>Description</span><textarea name="description" rows="3">${esc(f.description || '')}</textarea></label>
          <div class="field"><span>File (image or PDF, max 10 MB)</span>
            <div class="row"><input name="fileName" value="${esc(f.fileName || '')}" readonly placeholder="No file uploaded" style="flex:1"><label class="btn">${f.fileUrl ? 'Replace' : 'Upload'}<input type="file" id="certFile" accept="image/jpeg,image/png,image/webp,application/pdf" hidden></label></div>
            <input type="hidden" name="fileUrl" value="${esc(f.fileUrl || '')}">
          </div>`,
      },
    };
    const cfg = configs[tab];
    view().innerHTML = `${head}
      <section class="card">${cfg.items.length ? `<ul class="list">${cfg.items.map(item => `
        <li>
          <div class="grow"><a href="#" class="title" data-edit-item="${item.id}">${esc(cfg.title(item))}</a><div class="sub">${esc(cfg.sub(item) || '')}</div></div>
          ${tab === 'certificates' && item.fileUrl ? `<a class="btn btn-sm" href="${esc(item.fileUrl)}" target="_blank" rel="noopener">View file</a>` : ''}
          ${pubBadge(item.isPublished)}
          <button class="btn btn-sm" data-edit-item="${item.id}">Edit</button>
          <button class="btn btn-sm btn-ghost btn-danger" data-del-item="${item.id}">Delete</button>
        </li>`).join('')}</ul>` : `<div class="card-empty">No ${cfg.noun}s yet.</div>`}</section>`;
    const openItem = (item = {}) => openModal(item.id ? `Edit ${cfg.noun}` : `New ${cfg.noun}`, `
      <form class="stack" id="itemForm">
        ${cfg.form(item)}
        <div class="grid-2">
          <label class="field"><span>Visibility</span><select name="isPublished"><option value="true" ${item.isPublished !== false ? 'selected' : ''}>Published</option><option value="false" ${item.isPublished === false ? 'selected' : ''}>Hidden</option></select></label>
          <label class="field"><span>Display order</span><input name="sortOrder" type="number" value="${esc(item.sortOrder ?? 0)}"></label>
        </div>
        <div class="form-error" hidden></div>
        <div class="form-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Save</button></div>
      </form>`, body => {
      const form = $('#itemForm', body);
      $('#certFile', body)?.addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;
        try {
          toast('Uploading…');
          const result = await uploadFile('/api/admin/certificates/upload', 'certificate', file);
          form.fileUrl.value = result.url;
          form.fileName.value = result.fileName || file.name;
          toast('File uploaded');
        } catch (error) { fail(error); }
      });
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const payload = { ...Object.fromEntries(new FormData(form)), isPublished: form.isPublished.value === 'true' };
        if (tab === 'certificates' && !payload.fileUrl) return formError(body, new Error('Upload the certificate file first.'));
        try {
          await api(item.id ? `${cfg.api}/${item.id}` : cfg.api, { method: item.id ? 'PATCH' : 'POST', body: payload });
          closeModal(); toast('Saved'); render();
        } catch (error) { formError(body, error); }
      });
    });
    $('[data-new]').addEventListener('click', () => openItem());
    $$('[data-edit-item]').forEach(el => el.addEventListener('click', event => { event.preventDefault(); openItem(cfg.items.find(i => String(i.id) === el.dataset.editItem)); }));
    $$('[data-del-item]').forEach(el => el.addEventListener('click', () => confirmDelete(`this ${cfg.noun}`, () => api(`${cfg.api}/${el.dataset.delItem}`, { method: 'DELETE' }))));
  }

  // ---------------------------------------------------------------- My account
  async function renderAccount() {
    const [profile, sec] = await Promise.all([api('/api/admin/profile'), api('/api/admin/security/profile')]);
    view().innerHTML = `
      <div class="page-head"><div><h2>My account</h2><p>Your details, password and sign-in security.</p></div></div>
      <div class="report-grid">
        <section class="card"><div class="card-head"><h2>Profile</h2></div>
          <form class="card-body stack" id="profileForm">
            <div class="row"><span class="avatar lg">${esc(initials(profile.displayName))}</span><div><strong>${esc(profile.username)}</strong><div class="muted small">${esc(profile.designation || S.meta.roles.find(r => r.id === profile.role)?.label || profile.role)}</div></div></div>
            <div class="grid-2">
              <label class="field"><span>Full name</span><input name="displayName" value="${esc(profile.displayName || '')}" required maxlength="100"></label>
              <label class="field"><span>Designation</span><input name="designation" value="${esc(profile.designation || '')}" maxlength="100" placeholder="e.g. Sales Executive" list="designationList"></label>
            </div>
            <datalist id="designationList"><option>Director</option><option>Branch Manager</option><option>Operations Manager</option><option>Sales Executive</option><option>Relationship Manager</option><option>Telecaller</option><option>Accounts Executive</option></datalist>
            <div class="grid-2">
              <label class="field"><span>Mobile</span><input name="mobile" type="tel" inputmode="tel" value="${esc(profile.mobile || '')}" placeholder="98765 43210" maxlength="16"></label>
              <label class="field"><span>Date of birth</span><input name="dob" type="date" value="${esc(profile.dob || '')}" max="${dayKey(new Date())}" min="1920-01-01"></label>
            </div>
            <label class="field"><span>Email <small class="muted">change it in “Email &amp; two-step sign-in” below</small></span><input value="${esc(profile.email || sec.email || '')}" disabled></label>
            <div class="form-error" hidden></div>
            <div class="form-actions"><button class="btn btn-primary">Save</button></div>
          </form>
        </section>
        <section class="card"><div class="card-head"><h2>Change password</h2></div>
          <form class="card-body stack" id="pwForm" autocomplete="off">
            <label class="field"><span>Current password</span><input name="currentPassword" type="password" autocomplete="current-password" required></label>
            <label class="field"><span>New password <small class="muted">min 12 characters, letters and numbers</small></span><input name="newPassword" type="password" autocomplete="new-password" minlength="12" required></label>
            <label class="field"><span>Repeat new password</span><input name="repeat" type="password" autocomplete="new-password" required></label>
            <div class="form-error" hidden></div>
            <div class="form-actions"><button class="btn btn-primary">Update password</button></div>
          </form>
        </section>
        <section class="card wide"><div class="card-head"><h2>Email &amp; two-step sign-in</h2></div>
          <div class="card-body stack">
            <form class="stack" id="emailForm">
              <label class="field"><span>Your email ${sec.emailVerified ? '<span class="pill st-converted">Verified</span>' : '<span class="pill st-interested">Not verified</span>'}</span>
                <div class="row"><input name="email" type="email" value="${esc(sec.email || '')}" style="flex:1" required><button class="btn">Send verification code</button></div></label>
            </form>
            <form class="row" id="verifyForm" hidden>
              <input name="otpCode" inputmode="numeric" maxlength="6" placeholder="6-digit code" style="max-width:180px" required>
              <button class="btn btn-primary">Verify</button>
            </form>
            <label class="row" style="font-weight:600"><input type="checkbox" id="twofa" ${sec.requireEmailOtp ? 'checked' : ''} ${sec.emailVerified ? '' : 'disabled'}> Ask for an emailed code every time I sign in</label>
            ${sec.smtpConfigured ? '' : '<p class="muted small" style="margin:0">Email is not set up on the server yet, so verification codes cannot be sent.</p>'}
            <div class="form-error" hidden></div>
          </div>
        </section>
      </div>`;
    $('#profileForm').addEventListener('submit', async event => {
      event.preventDefault();
      try {
        const f = event.target;
        await api('/api/admin/profile', { method: 'PATCH', body: { displayName: f.displayName.value, designation: f.designation.value, mobile: f.mobile.value, dob: f.dob.value } });
        toast('Profile saved');
        S.meta = await api('/api/crm/meta'); S.me = S.meta.me;
        paintMe();
      } catch (error) { formError(event.target, error); }
    });
    $('#pwForm').addEventListener('submit', async event => {
      event.preventDefault();
      const f = event.target;
      if (f.newPassword.value !== f.repeat.value) return formError(f, new Error('The new passwords do not match.'));
      try {
        await api('/api/admin/security/change-password', { method: 'POST', body: { currentPassword: f.currentPassword.value, newPassword: f.newPassword.value } });
        f.reset(); toast('Password updated');
      } catch (error) { formError(f, error); }
    });
    const secError = error => { const el = $('.card.wide .form-error'); el.textContent = error.message; el.hidden = false; };
    $('#emailForm').addEventListener('submit', async event => {
      event.preventDefault();
      try {
        const r = await api('/api/admin/security/send-email-verification', { method: 'POST', body: { email: event.target.email.value } });
        toast(r.message || 'Code sent'); $('#verifyForm').hidden = false; $('#verifyForm input').focus();
      } catch (error) { secError(error); }
    });
    $('#verifyForm').addEventListener('submit', async event => {
      event.preventDefault();
      try {
        await api('/api/admin/security/verify-email', { method: 'POST', body: { otpCode: event.target.otpCode.value } });
        toast('Email verified'); renderAccount().catch(fail);
      } catch (error) { secError(error); }
    });
    $('#twofa').addEventListener('change', async event => {
      try {
        await api('/api/admin/security/profile', { method: 'PATCH', body: { requireEmailOtp: event.target.checked } });
        toast(event.target.checked ? 'Two-step sign-in turned on' : 'Two-step sign-in turned off');
      } catch (error) { event.target.checked = !event.target.checked; secError(error); }
    });
  }

  // ---------------------------------------------------------------- boot
  (async () => {
    try {
      const session = await fetch('/api/admin/session', { credentials: 'same-origin' }).then(r => r.json());
      if (session.authenticated) await startApp(); else showLogin();
    } catch {
      showLogin();
    }
  })();
})();

// ========== Show / hide password (eye button on every password box) ==========
(() => {
  const EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>';

  function setVisible(input, button, visible) {
    input.type = visible ? 'text' : 'password';
    button.innerHTML = visible ? EYE_OFF : EYE;
    button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    button.setAttribute('aria-pressed', String(visible));
    button.title = visible ? 'Hide password' : 'Show password';
  }

  function enhance(input) {
    if (input.dataset.eye) return;
    input.dataset.eye = '1';
    const wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pw-eye';
    wrap.appendChild(button);
    setVisible(input, button, false);
    button.addEventListener('click', event => {
      event.preventDefault();
      const caret = input.selectionStart;
      setVisible(input, button, input.type === 'password');
      input.focus();
      try { input.setSelectionRange(caret, caret); } catch { /* not supported on this input */ }
    });
    // Hide the password again whenever the form is sent.
    input.form?.addEventListener('submit', () => setVisible(input, button, false));
  }

  const scan = root => root.querySelectorAll?.('input[type="password"]:not([data-eye])').forEach(enhance);
  const start = () => {
    scan(document);
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.matches?.('input[type="password"]')) enhance(node); else scan(node);
    }))).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

