/* Shroom Buddies
   A free phone app. Everything personal is kept on this phone only (browser storage).
   Plain JavaScript, no libraries.

   Sections:
     1. Settings
     2. Saved data
     3. Helpers
     4. Dates and "how often"
     5. Shared building blocks
     6. Pages
     7. Guides and reels (loaded from the website)
     8. Button actions
     9. Drawing pages and moving between them
    10. Start-up
*/
'use strict';

/* ================= 1. Settings ================= */

const REPO = 'longzdalez/Shroom-Buddies-2';    // GitHub repo, used by admin "Open GitHub" buttons
const ADMIN_SALT = 'shroombuddies-admin:';      // the admin passphrase is checked against site.json "adminHash"

// Swipe pages, in order. "nav" is the bottom-bar button that lights up on that page.
const PAGES = [
  { id: 'today',       name: 'Today',       nav: 'today' },
  { id: 'practices',   name: 'Practices',   nav: 'today' },
  { id: 'tracker',     name: 'Tracker',     nav: 'tracker' },
  { id: 'supplements', name: 'Supplements', nav: 'tracker' },
  { id: 'reading',     name: 'Reading',     nav: 'tracker' },
  { id: 'journal',     name: 'Journal',     nav: 'journal' },
  { id: 'calendar',    name: 'Calendar',    nav: 'calendar' },
  { id: 'guides',      name: 'Guides',      nav: 'guides' },
  { id: 'reels',       name: 'Reels',       nav: 'reels' },
  { id: 'settings',    name: 'Settings',    nav: '' },
];

// The three tick lists. They all work the same way.
const LISTS = {
  supps:   { items: 'supps',   log: 'suppLog', icon: '💊', title: 'Supplements', one: 'supplement', many: 'supplements', example: 'e.g. Vitamin D', reminders: true },
  reading: { items: 'reading', log: 'readLog', icon: '📚', title: 'Reading & Literature', one: 'book or reading', many: 'books or other reading', example: 'e.g. The Doors of Perception' },
  food:    { items: 'foods',   log: 'foodLog', icon: '🥗', title: 'Food', one: 'food type', many: 'food types', example: 'e.g. Leafy greens' },
};

const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ================= 2. Saved data ================= */
// Same storage names as earlier versions, so nobody loses their data when the app updates.

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('sb_' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('sb_' + key, JSON.stringify(value)); } catch { toast('Could not save. Your phone storage may be full.'); }
  },
};

const named = (names, prefix) => names.map((name, i) => ({ id: prefix + i, name }));

const S = {
  journal:    store.get('journal', []),      // [{id, date, mood, energy, intention, text}]
  practices:  store.get('practices', named(['Morning meditation', 'Breathwork (5 min)', 'Walk in nature', 'Drink water', 'Gratitude note', 'Evening reflection'], 'p')),
  done:       store.get('done', {}),         // {'YYYY-MM-DD': [practiceId]}
  doses:      store.get('doses', {}),        // {'YYYY-MM-DD': {micro: true} or {grams: 1.5}}
  checkins:   store.get('checkins', {}),     // {'YYYY-MM-DD': {am: {mood, energy}, pm: {mood, energy}}}
  supps:      store.get('supps', []),        // [{id, name, freq, time}]
  suppLog:    store.get('suppLog', {}),      // {'YYYY-MM-DD': [itemId]}
  reading:    store.get('reading', []),
  readLog:    store.get('readLog', {}),
  foods:      store.get('foods', named(['Fruit', 'Vegetables', 'Whole grains', 'Protein', 'Sugar / sweets', 'Caffeine', 'Alcohol'], 'f')),
  foodLog:    store.get('foodLog', {}),
  myReels:    store.get('myReels', []),      // [{id, url, title}] reels added on this phone
  guideEdits: store.get('guideEdits', {}),   // {'file.md': 'changed wording'} (admin, this phone)
  prefs:      store.get('prefs', {}),        // {admin, editMode}
};
const KEYS = Object.keys(S);
const save = key => store.set(key, S[key]);
const isAdmin = () => !!S.prefs.admin;

/* ================= 3. Helpers ================= */

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

let toastTimer;
function toast(message) {
  const t = $('#toast'); if (!t) return;
  t.textContent = message; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

async function getJSON(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(url); return r.json(); }
async function getText(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(url); return r.text(); }

async function copyText(text) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }

function download(filename, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ADMIN_SALT + text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// A small, safe reader for the guide files (headings, bullet lists, bold, italics). HTML is escaped first.
function markdown(src) {
  let out = '', list = null;
  const inline = t => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>');
  const close = () => { if (list) { out += `</${list}>`; list = null; } };
  const open = tag => { if (list !== tag) { close(); out += `<${tag}>`; list = tag; } };
  for (const line of esc(src).split('\n')) {
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)/))) { close(); out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; }
    else if ((m = line.match(/^\s*[-*]\s+(.*)/))) { open('ul'); out += `<li>${inline(m[1])}</li>`; }
    else if ((m = line.match(/^\s*\d+\.\s+(.*)/))) { open('ol'); out += `<li>${inline(m[1])}</li>`; }
    else if (!line.trim()) close();
    else { close(); out += `<p>${inline(line)}</p>`; }
  }
  close();
  return out;
}

/* ================= 4. Dates and "how often" ================= */

const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;   // 'YYYY-MM-DD'
const today = () => keyOf(new Date());
const dateOf = k => new Date(k + 'T12:00');
const addDays = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 864e5);
const niceDate = k => dateOf(k).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const monthName = (d, withYear = true) => d.toLocaleDateString(undefined, withYear ? { month: 'long', year: 'numeric' } : { month: 'long' });
const firstOfMonth = (d, step = 0) => new Date(d.getFullYear(), d.getMonth() + step, 1);
const weekday = k => (dateOf(k).getDay() + 6) % 7;   // 0 = Monday

// Is a list item due on this day? Every day, certain weekdays, or every X days.
function isDue(item, k) {
  const f = item.freq || { type: 'daily' };
  if (f.type === 'days') return (f.days || []).includes(weekday(k));
  if (f.type === 'every') {
    const gap = daysBetween(f.start || k, k);
    return gap >= 0 && gap % Math.max(1, +f.every || 1) === 0;
  }
  return true;
}
function howOften(item) {
  const f = item.freq || { type: 'daily' };
  if (f.type === 'days') return (f.days || []).map(i => WEEK[i]).join(', ') || 'Choose days';
  if (f.type === 'every') { const n = Math.max(1, +f.every || 1); return n === 1 ? 'Every day' : `Every ${n} days`; }
  return 'Every day';
}

function streak() {
  let k = today(), n = 0;
  if (!(S.done[k] || []).length) k = addDays(k, -1);
  while ((S.done[k] || []).length) { n++; k = addDays(k, -1); }
  return n;
}

const doseText = d => !d ? '' : d.micro ? 'Microdose' : `${d.grams}g`;
const checkinText = c => !c || (!c.mood && !c.energy) ? '–' : `${c.mood ? MOODS[c.mood - 1] : ''}${c.energy ? ` ⚡${c.energy}` : ''}`;
const tickedNames = (kind, k) => {
  const L = LISTS[kind], ids = S[L.log][k] || [];
  return S[L.items].filter(i => ids.includes(i.id)).map(i => esc(i.name)).join(', ');
};

/* ================= 5. Shared building blocks ================= */

const ring = (percent, big, small) =>
  `<div class="ring" style="--p:${Math.round(percent)}"><div><b>${big}</b><small>${small}</small></div></div>`;

const hero = (ringHTML, title, lines) =>
  `<div class="card hero">${ringHTML}<div><div class="title">${title}</div>${lines}</div></div>`;

// ‹ title › row. "action" is the button action; it gets data-step -1 or 1.
const stepper = (title, action, extra = '') =>
  `<div class="stepper"><button class="ghost small" data-do="${action}" data-step="-1" ${extra} aria-label="Back">‹</button>
    <h2>${title}</h2><button class="ghost small" data-do="${action}" data-step="1" ${extra} aria-label="Forward">›</button></div>`;

// A month of day buttons. mark(k) returns {html, on} for each day.
function monthGrid(month, selected, action, mark) {
  const y = month.getFullYear(), m = month.getMonth();
  const blanks = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
  let html = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<div class="dow">${d}</div>`).join('') + '<div></div>'.repeat(blanks);
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`, mk = mark(k) || {};
    const cls = ['day', k === today() && 'today', k === selected && 'sel', mk.on && 'marked'].filter(Boolean).join(' ');
    html += `<button class="${cls}" data-do="${action}" data-day="${k}">${d}<span class="marks">${mk.html || ''}</span></button>`;
  }
  return `<div class="month">${html}</div>`;
}

function scaleButtons(values, labels, selected, attrs) {
  return `<div class="scale">${values.map((v, i) =>
    `<button type="button" class="${selected === v ? 'sel' : ''}" ${attrs} data-v="${v}">${labels[i]}</button>`).join('')}</div>`;
}

/* ================= 6. Pages ================= */
// Things the pages remember while the app is open (not saved).
const ui = {
  page: 'today',
  calMonth: firstOfMonth(new Date()), calDay: today(),
  trTab: 'shroom', trMonth: firstOfMonth(new Date()), trDay: today(),
  listDay: { supps: today(), reading: today(), food: today() },
  editing: null,          // {kind, id} while a list item form is open
  entry: null,            // journal entry being written or changed
  guides: null,           // guides.json once loaded, or 'offline'
  guideText: {},          // guide file -> text
  folder: null, guide: null, guideEditing: false,
  reels: null, site: {},  // shared reels and site.json once loaded
};

const views = {};

/* ----- Today ----- */
let QUOTES = [];
function quoteHTML() {
  if (!QUOTES.length) return '';
  const q = QUOTES[Math.floor(dateOf(today()) / 864e5) % QUOTES.length];
  return `<div class="quote"><p>“${esc(q.text)}”</p><span>— ${esc(q.by)}</span></div>`;
}

function remindersHTML() {
  const now = new Date(), time = `${pad(now.getHours())}:${pad(now.getMinutes())}`, k = today(), taken = S.suppLog[k] || [];
  const due = S.supps.filter(i => i.time && i.time <= time && !taken.includes(i.id) && isDue(i, k));
  if (!due.length) return '';
  return `<div class="card alert"><h2>⏰ Supplement reminder</h2>${due.map(i =>
    `<div class="tick"><span class="name" style="flex:1">💊 ${esc(i.name)} <small class="muted">(${i.time})</small></span>
      <button class="small" data-do="takeNow" data-id="${i.id}">Taken ✓</button></div>`).join('')}</div>`;
}

function checkinHTML(k) {
  const c = S.checkins[k] || {}, now = new Date().getHours() < 12 ? 'am' : 'pm';
  return `<div class="card"><h2>How are you feeling?</h2>${[['am', '🌅 Morning'], ['pm', '☀️ Afternoon']].map(([p, label]) => `
    <div class="checkin ${p === now ? 'now' : ''}"><div class="when">${label}</div>
      <div class="line"><span class="what">Mood</span>${scaleButtons([1, 2, 3, 4, 5], MOODS, (c[p] || {}).mood, `data-do="checkin" data-when="${p}" data-field="mood"`)}</div>
      <div class="line"><span class="what">Energy</span>${scaleButtons([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], (c[p] || {}).energy, `data-do="checkin" data-when="${p}" data-field="energy"`)}</div>
    </div>`).join('')}</div>`;
}

views.today = () => {
  const k = today(), done = S.done[k] || [];
  const n = S.practices.filter(p => done.includes(p.id)).length, total = S.practices.length;
  const h = new Date().getHours(), greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${quoteHTML()}
    <div class="greet">✦ ${greeting}, buddy ✦</div>
    ${remindersHTML()}
    ${hero(ring(total ? n / total * 100 : 0, `${total ? Math.round(n / total * 100) : 0}%`, 'TODAY'), niceDate(k),
      `<div class="muted">${n} of ${total} practices done</div>
       <div class="chips"><span class="chip">🔥 ${plural(streak(), 'day')} streak</span><span class="chip">📓 ${plural(S.journal.length, 'entry', 'entries')}</span></div>`)}
    ${checkinHTML(k)}
    <button class="ghost wide" data-do="go" data-page="practices">✅ Today's practices ›</button>`;
};

/* ----- Practices ----- */
views.practices = () => {
  const k = today(), done = S.done[k] || [];
  return `<div class="card"><h2>Daily practices</h2>
      ${S.practices.length ? S.practices.map(p => `<div class="tick ${done.includes(p.id) ? 'done' : ''}"><label>
        <input type="checkbox" data-change="practice" data-id="${p.id}" ${done.includes(p.id) ? 'checked' : ''}>
        <span class="name">${esc(p.name)}</span></label></div>`).join('')
      : '<p class="muted">No practices yet. Add some in Settings.</p>'}
    </div>
    <button class="ghost wide" data-do="go" data-page="settings" data-to="practicesCard">✎ Change the practices</button>`;
};

/* ----- Tracker (Shrooms and Food) ----- */
views.tracker = () => {
  const tabs = `<div class="tabs">${[['shroom', '🍄 Shrooms'], ['food', '🥗 Food']].map(([t, label]) =>
    `<button class="${ui.trTab === t ? 'on' : ''}" data-do="trackerTab" data-tab="${t}">${label}</button>`).join('')}</div>`;
  return tabs + (ui.trTab === 'shroom' ? shroomTracker() : listPage('food'));
};

function shroomTracker() {
  const month = ui.trMonth, y = month.getFullYear(), m = month.getMonth(), days = new Date(y, m + 1, 0).getDate();
  let count = 0, grams = 0;
  for (let d = 1; d <= days; d++) { const ds = S.doses[`${y}-${pad(m + 1)}-${pad(d)}`]; if (ds) { count++; grams += ds.grams || 0; } }
  const last = Object.keys(S.doses).filter(k => k <= today()).sort().pop();
  const since = last == null ? null : daysBetween(last, today());
  const sinceText = since === null ? 'none yet' : since === 0 ? 'today' : `${plural(since, 'day')} ago`;
  const cur = S.doses[ui.trDay];
  return `${hero(ring(count / days * 100, count, 'DAYS'), monthName(month, false),
      `<div class="muted">${plural(count, 'mushroom day')} this month</div>
       <div class="chips">${grams ? `<span class="chip">⚖️ ${+grams.toFixed(2)}g logged</span>` : ''}<span class="chip">⏳ ${sinceText}</span></div>`)}
    <div class="card">${stepper(monthName(month), 'trackerMonth')}
      ${monthGrid(month, ui.trDay, 'trackerDay', k => { const ds = S.doses[k]; return ds && { on: true, html: ds.micro ? '🍄' : `<small>${ds.grams}g</small>` }; })}</div>
    <div class="card"><h2>${niceDate(ui.trDay)}</h2>
      <p class="muted">${cur ? 'Logged: ' + doseText(cur) : 'Nothing logged for this day.'}</p>
      <button class="wide" data-do="doseMicro">🍄 Microdose</button>
      <div class="row mt"><input id="grams" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Or type grams" value="${cur && cur.grams ? cur.grams : ''}">
        <button class="fit" data-do="doseGrams">Save</button></div>
      ${cur ? '<button class="ghost small mt" data-do="doseClear">Clear this day</button>' : ''}</div>`;
}

/* ----- Supplements, Reading and Food lists ----- */
views.supplements = () => listPage('supps');
views.reading = () => listPage('reading');

function listPage(kind) {
  const L = LISTS[kind], items = S[L.items], k = ui.listDay[kind], ticked = S[L.log][k] || [], isToday = k === today();
  const due = items.filter(i => isDue(i, k));
  const doneDue = due.filter(i => ticked.includes(i.id)).length;
  const rows = items.length ? items.map(i => {
    const on = ticked.includes(i.id), dueNow = isDue(i, k);
    return `<div class="tick ${on ? 'done' : ''} ${dueNow ? '' : 'not-due'}"><label>
        <input type="checkbox" data-change="tickItem" data-kind="${kind}" data-id="${i.id}" ${on ? 'checked' : ''}>
        <span style="min-width:0"><span class="name">${esc(i.name)}</span>
          <span class="sub">${howOften(i)}${dueNow ? '' : ' · not due'}${i.time ? ' · ⏰ ' + i.time : ''}</span></span></label>
      ${L.reminders && i.time ? `<button class="ghost small" data-do="calendarAlarm" data-id="${i.id}" aria-label="Add alarm to phone calendar">📅</button>` : ''}
      <button class="ghost small" data-do="itemEdit" data-kind="${kind}" data-id="${i.id}" aria-label="Change">✎</button></div>`;
  }).join('') : `<p class="muted">Nothing on this list yet. Tap + below to add ${L.many}.</p>`;
  return `${hero(ring(due.length ? doneDue / due.length * 100 : 0, `${doneDue}/${due.length}`, isToday ? 'TODAY' : 'DAY'), `${L.icon} ${L.title}`,
      `<div class="muted">${due.length} due ${isToday ? 'today' : 'this day'}</div>`)}
    <div class="card">${stepper(isToday ? 'Today' : niceDate(k), 'listDay', `data-kind="${kind}"`)}${rows}
      ${L.reminders && items.some(i => i.time) ? '<p class="muted small-text mt">📅 adds a repeating alarm to your phone calendar, on the same days as the supplement, so it reminds you even when the app is closed.</p>' : ''}</div>
    ${itemForm(kind)}`;
}

function itemForm(kind) {
  const L = LISTS[kind];
  if (!ui.editing || ui.editing.kind !== kind) return `<button class="wide" data-do="itemNew" data-kind="${kind}">+ Add to ${L.title}</button>`;
  const it = ui.editing.id ? S[L.items].find(i => i.id === ui.editing.id) : null;
  const f = (it && it.freq) || { type: 'daily' }, type = f.type || 'daily', days = f.days || [];
  return `<div class="card" data-form><h2>${it ? 'Change' : 'New'} ${L.one}</h2>
    <label for="iName">Name</label><input id="iName" value="${esc(it ? it.name : '')}" placeholder="${L.example}">
    <label for="iType">How often</label>
    <select id="iType" data-change="freqType">
      <option value="daily" ${type === 'daily' ? 'selected' : ''}>Every day</option>
      <option value="days" ${type === 'days' ? 'selected' : ''}>On certain days of the week</option>
      <option value="every" ${type === 'every' ? 'selected' : ''}>Every few days</option></select>
    <div id="iDaysBox" class="${type === 'days' ? '' : 'hidden'}"><label>Tick the days</label>
      <div class="weekdays">${WEEK.map((w, i) => `<label><input type="checkbox" class="iDay" value="${i}" ${days.includes(i) ? 'checked' : ''}>${w}</label>`).join('')}</div></div>
    <div id="iEveryBox" class="${type === 'every' ? '' : 'hidden'}"><label for="iEvery">How many days apart?</label>
      <input id="iEvery" type="number" inputmode="numeric" min="1" max="365" value="${f.every || 2}"></div>
    ${L.reminders ? `<label for="iTime">Reminder time (optional)</label><input id="iTime" type="time" value="${it && it.time ? it.time : ''}">` : ''}
    <div class="row mt"><button class="ghost" data-do="itemCancel">Cancel</button>
      ${it ? `<button class="ghost" data-do="itemRemove" data-kind="${kind}" data-id="${it.id}">Remove</button>` : ''}
      <button data-do="itemSave" data-kind="${kind}">Save</button></div></div>`;
}

// A repeating calendar event with an alarm, which the phone's calendar can import (works with the app closed).
function calendarAlarm(item) {
  const [hh, mm] = item.time.split(':'), f = item.freq || { type: 'daily' }, BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  let rule = 'RRULE:FREQ=DAILY';
  if (f.type === 'days' && (f.days || []).length) rule = 'RRULE:FREQ=WEEKLY;BYDAY=' + [...f.days].sort().map(i => BYDAY[i]).join(',');
  else if (f.type === 'every') rule = 'RRULE:FREQ=DAILY;INTERVAL=' + Math.max(1, +f.every || 1);
  let first = today();                                      // start on the first day it is actually due
  for (let n = 0; n < 400 && !isDue(item, first); n++) first = addDays(first, 1);
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shroom Buddies//EN', 'BEGIN:VEVENT',
    `UID:${item.id}-${Date.now()}@shroombuddies`, `DTSTAMP:${stamp}`, `DTSTART:${first.replace(/-/g, '')}T${hh}${mm}00`, 'DURATION:PT5M', rule,
    `SUMMARY:💊 Take ${item.name}`, 'DESCRIPTION:Reminder from Shroom Buddies',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:Take ${item.name}`, 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  download(`reminder-${item.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`, ics, 'text/calendar');
}

/* ----- Journal ----- */
function entryHTML(e) {
  return `<div class="entry"><h3>${MOODS[e.mood - 1] || ''} ${niceDate(e.date)}</h3>
    ${e.intention ? `<div class="muted">Intention: ${esc(e.intention)}</div>` : ''}
    ${e.energy ? `<div class="muted">Energy: ${e.energy}/5</div>` : ''}
    ${e.text ? `<p>${esc(e.text)}</p>` : ''}
    <div class="actions"><button class="ghost small" data-do="entryEdit" data-id="${e.id}">Edit</button>
      <button class="ghost small" data-do="entryDelete" data-id="${e.id}">Delete</button></div></div>`;
}

const micButton = id => `<button type="button" class="mic" data-do="speak" data-field="${id}" aria-label="Speak instead of typing">🎤 Speak</button>`;

function entryForm(e) {
  return `<div class="card" data-form><h2>${e.id ? 'Change entry' : 'New entry'}</h2>
    <label for="eDate">Date</label><input id="eDate" type="date" value="${e.date}">
    <label>Mood</label>${scaleButtons([1, 2, 3, 4, 5], MOODS, e.mood, 'data-do="entryPick" data-field="mood"')}
    <label>Energy</label>${scaleButtons([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], e.energy, 'data-do="entryPick" data-field="energy"')}
    <div class="label-row"><label for="eIntent">Intention</label>${micButton('eIntent')}</div>
    <input id="eIntent" value="${esc(e.intention)}" placeholder="What do you want to focus on?">
    <div class="label-row"><label for="eText">Notes</label>${micButton('eText')}</div>
    <textarea id="eText" placeholder="How are you feeling? What did you notice? Tap 🎤 to speak.">${esc(e.text)}</textarea>
    <div class="row"><button class="ghost" data-do="entryCancel">Cancel</button><button data-do="entrySave">Save</button></div></div>`;
}

views.journal = () => {
  if (ui.entry) return entryForm(ui.entry);
  const list = [...S.journal].sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
  const [latest, ...older] = list;
  return `<button class="wide" data-do="entryNew" style="margin-bottom:14px">+ New entry</button>
    ${latest ? `<div class="card"><div class="label-small">Latest entry</div>${entryHTML(latest)}</div>`
      : '<div class="card muted">Your journal is empty. Start with how you feel today.</div>'}
    ${older.length ? `<div class="card"><h2>Earlier entries</h2>${older.map(e => `<details class="older">
      <summary>${MOODS[e.mood - 1] || ''} ${niceDate(e.date)}${e.intention ? ' · ' + esc(e.intention) : ''}</summary>${entryHTML(e)}</details>`).join('')}</div>` : ''}`;
};

/* ----- Calendar ----- */
views.calendar = () => {
  const k = ui.calDay, c = S.checkins[k] || {}, done = S.done[k] || [], entries = S.journal.filter(e => e.date === k);
  const marks = d => {
    const html = (S.journal.some(e => e.date === d) ? '📓' : '') + ((S.done[d] || []).length ? '🌱' : '') + (S.doses[d] ? '🍄' : '')
      + ((S.suppLog[d] || []).length ? '💊' : '') + ((S.foodLog[d] || []).length ? '🥗' : '') + ((S.readLog[d] || []).length ? '📚' : '');
    return { html };
  };
  return `<div class="card">${stepper(monthName(ui.calMonth), 'calMonth')}${monthGrid(ui.calMonth, k, 'calDay', marks)}</div>
    <div class="card"><h2>${niceDate(k)}</h2>
      <div class="facts muted">
        <div>🍄 Mushrooms: ${doseText(S.doses[k]) || 'none'}</div>
        <div>🌅 Morning: ${checkinText(c.am)} · ☀️ Afternoon: ${checkinText(c.pm)}</div>
        <div>🌱 Practices: ${S.practices.filter(p => done.includes(p.id)).map(p => esc(p.name)).join(', ') || 'none'}</div>
        <div>💊 Supplements: ${tickedNames('supps', k) || 'none'}</div>
        <div>🥗 Food: ${tickedNames('food', k) || 'none'}</div>
        <div>📚 Reading: ${tickedNames('reading', k) || 'none'}</div></div>
      ${entries.map(e => `<div class="inner mt">${entryHTML(e)}</div>`).join('')}
      <button class="small mt" data-do="entryNew" data-date="${k}">+ Entry for this day</button></div>
    ${graphHTML(ui.calMonth)}`;
};

// Graph: morning and afternoon mood and energy, practices done, and mushroom days, for one month.
function graphHTML(month) {
  const y = month.getFullYear(), m = month.getMonth(), days = new Date(y, m + 1, 0).getDate();
  const D = [];
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`, c = S.checkins[k] || {};
    const moods = [c.am, c.pm, ...S.journal.filter(e => e.date === k)].filter(Boolean).map(e => e.mood).filter(Boolean);
    D.push({ d, k, amMood: (c.am || {}).mood || 0, pmMood: (c.pm || {}).mood || 0, amEn: (c.am || {}).energy || 0, pmEn: (c.pm || {}).energy || 0,
      mood: moods.length ? moods.reduce((a, b) => a + b) / moods.length : 0, practices: (S.done[k] || []).length, dose: S.doses[k] });
  }
  if (!D.some(x => x.mood || x.amEn || x.pmEn || x.practices || x.dose))
    return '<div class="card"><h2>Mood & practices graph</h2><p class="muted">Do your morning and afternoon check-ins, practices and mushroom days and your graph will appear here.</p></div>';

  const W = 340, H = 190, left = 22, right = 6, top = 22, bottom = 22, cw = (W - left - right) / days, maxP = Math.max(1, S.practices.length);
  const X = d => left + (d - 0.5) * cw, Y = v => top + (H - top - bottom) * (1 - (v - 1) / 4);
  const line = (field, cls) => {
    const pts = D.filter(x => x[field]);
    return `<path class="${cls}" d="${pts.map((x, i) => `${i ? 'L' : 'M'}${X(x.d).toFixed(1)} ${Y(x[field]).toFixed(1)}`).join('')}"/>`
      + pts.map(x => `<circle class="${cls}" cx="${X(x.d).toFixed(1)}" cy="${Y(x[field]).toFixed(1)}" r="2.6"/>`).join('');
  };
  let g = '';
  for (let v = 1; v <= 5; v++) g += `<line class="grid" x1="${left}" x2="${W - right}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${left - 6}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`;
  for (const x of D) {
    if (x.practices) { const h = (H - top - bottom) * x.practices / maxP; g += `<rect class="bar" x="${(X(x.d) - cw * .35).toFixed(1)}" y="${(H - bottom - h).toFixed(1)}" width="${(cw * .7).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`; }
    if (x.dose) g += `<text x="${X(x.d).toFixed(1)}" y="${top - 7}" text-anchor="middle" font-size="${x.dose.micro ? 9 : Math.min(14, 8 + x.dose.grams * 2)}">🍄</text>`;
    if (x.d === 1 || x.d % 5 === 0) g += `<text class="ax" x="${X(x.d).toFixed(1)}" y="${H - 7}" text-anchor="middle">${x.d}</text>`;
  }
  g += line('amEn', 'en c-en-am') + line('pmEn', 'en c-en-pm') + line('amMood', 'c-mo-am') + line('pmMood', 'c-mo-pm');
  for (const x of D) g += `<rect x="${(X(x.d) - cw / 2).toFixed(1)}" y="0" width="${cw.toFixed(1)}" height="${H}" fill="transparent" data-do="calDay" data-day="${x.k}"/>`;

  // average mood with and without each thing
  const withMood = D.filter(x => x.mood), mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const compare = (label, test) => {
    const yes = withMood.filter(test).map(x => x.mood), no = withMood.filter(x => !test(x)).map(x => x.mood);
    if (!yes.length || !no.length) return '';
    const a = mean(yes), b = mean(no);
    return `<div class="compare"><span>${label}</span><b class="${a > b ? 'up' : a < b ? 'down' : ''}">${MOODS[Math.round(a) - 1]} ${a.toFixed(1)}</b><span class="muted">vs ${b.toFixed(1)} without</span></div>`;
  };
  const am = D.map(x => x.amMood).filter(Boolean), pm = D.map(x => x.pmMood).filter(Boolean);
  const rows = (am.length && pm.length ? `<div class="compare"><span>🌅 Morning vs ☀️ afternoon</span><b>${MOODS[Math.round(mean(am)) - 1]} ${mean(am).toFixed(1)}</b><span class="muted">vs ${mean(pm).toFixed(1)}</span></div>` : '')
    + [compare('🍄 Mushroom days', x => !!x.dose),
       ...S.practices.map(p => compare(esc(p.name), x => (S.done[x.k] || []).includes(p.id))),
       ...S.supps.map(i => compare('💊 ' + esc(i.name), x => (S.suppLog[x.k] || []).includes(i.id))),
       ...S.foods.map(i => compare('🥗 ' + esc(i.name), x => (S.foodLog[x.k] || []).includes(i.id)))].join('');

  return `<div class="card"><h2>Mood & practices graph</h2>
    <svg class="graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mood, energy and practices this month">${g}</svg>
    <div class="legend"><span><i class="c-mo-am"></i>Morning mood</span><span><i class="c-mo-pm"></i>Afternoon mood</span>
      <span><i class="c-en-am"></i>Morning energy</span><span><i class="c-en-pm"></i>Afternoon energy</span>
      <span><i class="bar"></i>Practices done</span><span>🍄 Mushroom day</span></div>
    <p class="muted small-text">Tap a day on the graph to see its details above.</p>
    ${rows ? `<h2 class="mt">Average mood this month</h2>${rows}` : ''}</div>`;
}

/* ----- Settings ----- */
let installPrompt = null;   // Android's "Install app" offer, when Chrome gives one
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; draw('settings'); });

function installCard() {
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `<div class="card"><h2>📲 Install the app</h2>${installed
    ? '<p class="muted">✅ Installed on this phone. Open it from your home screen.</p>'
    : installPrompt ? '<button class="wide" data-do="install">📲 Install Shroom Buddies</button>'
    : `<ol class="muted" style="margin:0;padding-left:20px">
        <li><b>Android (Chrome):</b> tap ⋮ at the top right, then <b>Install app</b> or <b>Add to Home screen</b>.</li>
        <li><b>iPhone (Safari):</b> tap the Share button ⬆️, then <b>Add to Home Screen</b>.</li></ol>`}</div>`;
}

function adminCard() {
  if (!isAdmin()) return `<div class="card"><h2>🔐 Admin</h2><p class="muted">Only the owner of the app can change the guides and reels.</p>
    <div class="row"><input id="adminPw" type="password" autocomplete="off" placeholder="Admin passphrase"><button class="fit" data-do="adminIn">Sign in</button></div></div>`;
  return `<div class="card"><h2>🔐 Admin</h2><p class="muted">You're signed in as admin on this phone.</p>
    <div class="inner"><div class="tick"><label><input type="checkbox" data-change="editMode" ${S.prefs.editMode ? 'checked' : ''}>
      <span class="name">Let me change the wording in the guides</span></label></div>
      <p class="muted small-text">When this is on, open a guide and tap the text to change it. <b>Publish for everyone</b> updates it for all users.</p></div>
    <button class="ghost small" data-do="adminOut">Sign out of admin</button></div>`;
}

views.settings = () => `
  <div class="card howto"><h2>How to use Shroom Buddies</h2><ol>
    <li><b>Swipe</b> left and right to move between pages, or tap the buttons at the bottom.</li>
    <li><b>🌱 Today</b>: tap your mood and energy in the morning and again in the afternoon.</li>
    <li><b>✅ Practices</b>: tick off each daily practice as you do it.</li>
    <li><b>🍄 Tracker</b>: tap a day, then press <b>Microdose</b> or type grams and press <b>Save</b>. Food is here too.</li>
    <li><b>💊 Supplements</b> and <b>📚 Reading</b>: tick off what's due. Tap ✎ to change the name, how often, or the reminder time.</li>
    <li><b>📓 Journal</b>: your latest entry is shown open. Tap <b>+ New entry</b> to write another, or 🎤 to speak.</li>
    <li><b>📅 Calendar</b>: tap any day to see everything you logged.</li>
    <li><b>📖 Guides</b>: pick a folder, then tap a guide to read it.</li>
    <li><b>🎬 Reels</b>: your own reels show first. Tap 📤 to share one with a friend. Shared reels are underneath.</li></ol>
    <p class="muted">Everything is kept only on this phone.</p></div>
  ${installCard()}
  <div class="card" id="practicesCard"><h2>Daily practices</h2>
    ${S.practices.map(p => `<div class="tick"><span class="name" style="flex:1">${esc(p.name)}</span>
      <button class="ghost small" data-do="practiceRemove" data-id="${p.id}">Remove</button></div>`).join('')}
    <div class="row mt"><input id="newPractice" placeholder="Add a practice"><button class="fit" data-do="practiceAdd">Add</button></div></div>
  <div class="card"><h2>Lists</h2><p class="muted">Add, change or remove items and how often they're due.</p>
    <div class="row"><button class="ghost" data-do="go" data-page="supplements">💊 Supplements</button><button class="ghost" data-do="go" data-page="reading">📚 Reading</button></div>
    <button class="ghost wide mt" data-do="foodList">🥗 Food</button></div>
  <div class="card"><h2>Backup</h2><p class="muted">Your data only lives on this phone. Export a backup now and then, and keep the file safe.</p>
    <div class="row"><button data-do="exportData">Export</button><button class="ghost" data-do="importData">Import</button></div>
    <input type="file" id="importFile" accept=".json,application/json" data-change="importFile" hidden></div>
  ${adminCard()}`;

/* ================= 7. Guides and reels (loaded from the website) ================= */

async function loadGuides() {
  try {
    const list = await getJSON('guides/guides.json');
    ui.guides = list.length && list[0].folder ? list : [{ folder: 'Guides', icon: '📖', guides: list }];
  } catch { if (!ui.guides) ui.guides = 'offline'; }
  draw('guides');
}

async function openGuide(file) {
  if (ui.guideText[file] == null) {
    try { ui.guideText[file] = await getText('guides/' + file); }
    catch { toast('This guide needs the internet the first time you open it.'); ui.guide = null; }
  }
  draw('guides', true);
  pageEl('guides').scrollTop = 0;
}

views.guides = () => {
  const G = ui.guides;
  if (G === null) return '<div class="card muted">Loading guides…</div>';
  if (G === 'offline') return '<div class="card muted">The guides need the internet the first time. Please connect and open this page again.</div>';
  if (ui.folder === null) {
    return G.map((f, i) => `<div class="card guide-link" data-do="guideFolder" data-i="${i}">
      ${f.cover ? `<img src="${esc(f.cover)}" alt="" onerror="this.remove()">` : ''}
      <h2><span class="num emoji">${esc(f.icon || '📁')}</span>${esc(f.folder)}</h2>
      <div class="muted mt">${plural(f.guides.length, 'guide')}</div></div>`).join('');
  }
  const f = G[ui.folder];
  if (ui.guide === null) {
    return `<button class="ghost small" data-do="guidesHome">‹ All guides</button>
      <h2 class="mt">${esc(f.icon || '📁')} ${esc(f.folder)}</h2>
      ${f.guides.map((g, i) => `<div class="card guide-link" data-do="guideOpen" data-i="${i}">
        ${g.image ? `<img src="${esc(g.image)}" alt="" onerror="this.remove()">` : ''}
        <h2><span class="num">${i + 1}</span>${esc(g.title)}</h2></div>`).join('')}`;
  }
  const g = f.guides[ui.guide], original = ui.guideText[g.file];
  const back = `<button class="ghost small" data-do="guideBack">‹ ${esc(f.folder)}</button>`;
  if (original == null) return back + '<div class="card muted mt">Loading…</div>';
  if (S.guideEdits[g.file] != null && S.guideEdits[g.file].trim() === original.trim()) { delete S.guideEdits[g.file]; save('guideEdits'); }  // already published
  const changed = S.guideEdits[g.file], text = changed ?? original;
  if (ui.guideEditing) {
    return `${back}<div class="card guide-editor mt" data-form><h2>Change the wording</h2>
      <textarea id="gText" rows="18">${esc(text)}</textarea>
      <p class="muted small-text">A line starting with <b>#</b> is a title, <b>##</b> a heading, and <b>-</b> a bullet point. Leave an empty line between paragraphs.</p>
      <div class="row"><button class="ghost" data-do="guideCancel">Cancel</button><button data-do="guideSave">Save</button></div>
      <button class="ghost wide mt" data-do="guidePublish">🌍 Publish for everyone</button><div id="guideSteps"></div>
      ${changed != null ? '<button class="ghost small mt" data-do="guideReset">↺ Go back to the original wording</button>' : ''}</div>`;
  }
  const canEdit = isAdmin() && S.prefs.editMode;
  return `${back}
    ${g.image ? `<img class="guide-pic mt" src="${esc(g.image)}" alt="" onerror="this.remove()">` : ''}
    ${changed != null ? '<p class="muted small-text mt">✏️ You changed this wording on this phone</p>' : ''}
    <div class="card guide mt ${canEdit ? 'editable' : ''}" ${canEdit ? 'data-do="guideEdit"' : ''}>${markdown(text)}
      ${canEdit ? '<p class="center small-text" style="color:var(--gold)">✏️ Tap the text to change it</p>' : ''}</div>`;
};

async function loadReels() {
  try { ui.site = await getJSON('site.json'); } catch {}
  try { ui.reels = await getJSON('reels.json'); } catch { if (!ui.reels) ui.reels = 'offline'; }
  draw('reels');
}

// Works out the site and a preview for a reel link.
function reelInfo(url) {
  let u; try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, ''), path = u.pathname;
  let m;
  if (host === 'instagram.com' && (m = path.match(/^\/(?:[^/]+\/)?(reel|reels|p|tv)\/([\w-]+)/)))
    return { site: 'Instagram', icon: '📸', tall: true, embed: `https://www.instagram.com/${m[1] === 'p' ? 'p' : 'reel'}/${m[2]}/embed` };
  if (host === 'facebook.com' || host === 'fb.watch')
    return { site: 'Facebook', icon: '📘', tall: /\/reel/.test(path), embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false` };
  if (host === 'tiktok.com' && (m = path.match(/\/video\/(\d+)/)))
    return { site: 'TikTok', icon: '🎵', tall: true, embed: `https://www.tiktok.com/embed/v2/${m[1]}` };
  if (host === 'youtu.be' || host === 'youtube.com') {
    const id = host === 'youtu.be' ? path.slice(1) : (u.searchParams.get('v') || (path.match(/\/(?:shorts|embed)\/([\w-]+)/) || [])[1]);
    if (id) return { site: 'YouTube', icon: '▶️', thumb: `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` };
  }
  return { site: host, icon: '🔗' };
}

function reelCard(r, mine) {
  const info = reelInfo(r.url); if (!info) return '';
  const url = esc(r.url);
  const preview = info.embed
    ? `<div class="reel-frame ${info.tall ? 'tall' : ''}"><iframe src="${esc(info.embed)}" loading="lazy" allowfullscreen title="${esc(r.title || info.site)}"
        allow="autoplay; encrypted-media; picture-in-picture; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    : info.thumb ? `<a class="reel-thumb" href="${url}" target="_blank" rel="noopener"><img src="${esc(info.thumb)}" alt="" loading="lazy"><span>▶</span></a>` : '';
  return `<div class="card reel">${r.title ? `<h2>${esc(r.title)}</h2>` : ''}${preview}
    <div class="row mt"><a class="btn" href="${url}" target="_blank" rel="noopener">${info.icon} Watch on ${esc(info.site)}</a>
      <button class="ghost small fit" data-do="reelShare" data-url="${url}" aria-label="Share">📤</button>
      ${mine ? `<button class="ghost small fit" data-do="reelRemove" data-id="${r.id}" aria-label="Remove">✕</button>` : ''}</div></div>`;
}

views.reels = () => {
  const shared = Array.isArray(ui.reels) ? ui.reels : [];
  const site = /^https:\/\//.test(ui.site.website || '') ? `<a class="btn wide" style="margin-bottom:14px" href="${esc(ui.site.website)}" target="_blank" rel="noopener">🌐 Visit our website</a>` : '';
  return `${site}
    <div class="card"><h2>🎬 Add a reel</h2>
      <p class="muted">Paste a link from Instagram, Facebook, TikTok or YouTube. It shows only on this phone.</p>
      <input id="reelUrl" type="url" inputmode="url" placeholder="https://www.instagram.com/reel/…">
      <input id="reelTitle" placeholder="Title (optional)">
      <button class="wide" data-do="reelAdd">Add reel</button>
      ${isAdmin() ? `<button class="ghost wide mt" data-do="reelShareAll">🌍 Share with everyone</button><div id="reelSteps"></div>` : ''}</div>
    ${S.myReels.length ? '<div class="sec">Your reels</div>' : ''}
    ${[...S.myReels].reverse().map(r => reelCard(r, true)).join('')}
    ${shared.length ? '<div class="sec">Shared reels</div>' : ''}
    ${shared.map(r => reelCard(r, false)).join('')}
    ${ui.reels === null ? '<div class="card muted">Loading shared reels…</div>' : ''}
    ${ui.reels !== null && !shared.length && !S.myReels.length ? '<div class="card muted">No reels yet.</div>' : ''}`;
};

// Steps shown to the admin after pressing a "Publish" or "Share with everyone" button.
function publishSteps(copied, text, path, what) {
  return `<div class="steps"><p><b>${copied ? '✅ Copied.' : 'Copy the text in the box first.'}</b></p>
    <ol><li>Tap <b>Open GitHub</b> below (sign in if asked).</li><li>Tap in the text box there, select all, and paste.</li><li>Press <b>Commit changes</b>.</li></ol>
    ${copied ? '' : `<textarea rows="6" readonly>${esc(text)}</textarea>`}
    <p class="muted small-text">Everyone sees the new ${what} a minute or two later.</p>
    <a class="btn wide" href="https://github.com/${REPO}/edit/main/${path}" target="_blank" rel="noopener">Open GitHub</a></div>`;
}

/* ----- Voice typing ----- */
let recognizer = null, recognizerBtn = null;
function stopSpeaking() { if (recognizer) { try { recognizer.stop(); } catch {} recognizer = null; } }
function speakInto(btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast("Voice typing isn't available here. Use the microphone on your keyboard instead."); return; }
  if (recognizer) { const same = recognizerBtn === btn; stopSpeaking(); if (same) return; }
  const field = document.getElementById(btn.dataset.field);
  const before = field.value ? field.value.replace(/\s*$/, ' ') : '';
  let finished = '';
  recognizer = new SR(); recognizerBtn = btn;
  Object.assign(recognizer, { lang: navigator.language || 'en-GB', continuous: true, interimResults: true });
  recognizer.onresult = ev => {
    let partial = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) finished += (finished && !/\s$/.test(finished) ? ' ' : '') + t.trim(); else partial += t;
    }
    let spoken = (finished + (partial ? ' ' + partial : '')).trim();
    if (!before.trim() || /[.!?]\s*$/.test(before)) spoken = spoken.charAt(0).toUpperCase() + spoken.slice(1);
    field.value = before + spoken;
  };
  recognizer.onerror = ev => { if (/not-allowed/.test(ev.error)) toast('Please allow the microphone for this app in your phone settings.'); };
  recognizer.onend = () => { btn.classList.remove('on'); btn.textContent = '🎤 Speak'; if (recognizerBtn === btn) { recognizer = null; recognizerBtn = null; } };
  btn.classList.add('on'); btn.textContent = '⏹ Stop';
  try { recognizer.start(); } catch { recognizer.onend(); }
}

/* ================= 8. Button actions ================= */
// Each button has data-do="name"; ticks and selects have data-change="name".
// "d" is the button's data (data-id → d.id, and so on). Return true to stop the page redrawing.

const actions = {
  go: d => { show(d.page); if (d.to) setTimeout(() => document.getElementById(d.to)?.scrollIntoView({ behavior: 'smooth' }), 350); return true; },

  // Today
  checkin: d => {
    const k = today(), day = S.checkins[k] = S.checkins[k] || {}, p = day[d.when] = day[d.when] || {}, v = +d.v;
    p[d.field] = p[d.field] === v ? 0 : v; save('checkins');
  },
  takeNow: d => { const k = today(); S.suppLog[k] = [...new Set([...(S.suppLog[k] || []), d.id])]; save('suppLog'); },

  // Tracker
  trackerTab: d => { ui.trTab = d.tab; },
  trackerMonth: d => { ui.trMonth = firstOfMonth(ui.trMonth, +d.step); },
  trackerDay: d => { ui.trDay = d.day; },
  doseMicro: () => { S.doses[ui.trDay] = { micro: true }; save('doses'); },
  doseGrams: () => {
    const g = parseFloat($('#grams').value);
    if (!(g > 0)) { toast('Type the grams first, for example 1.5'); return true; }
    S.doses[ui.trDay] = { grams: +g.toFixed(2) }; save('doses');
  },
  doseClear: () => { delete S.doses[ui.trDay]; save('doses'); },

  // Lists
  listDay: d => { ui.listDay[d.kind] = addDays(ui.listDay[d.kind], +d.step); },
  itemNew: d => { ui.editing = { kind: d.kind, id: null }; },
  itemEdit: d => { ui.editing = { kind: d.kind, id: d.id }; },
  itemCancel: () => { ui.editing = null; },
  itemRemove: d => {
    const L = LISTS[d.kind];
    if (!confirm('Remove this from your list?')) return true;
    S[L.items] = S[L.items].filter(i => i.id !== d.id); save(L.items); ui.editing = null;
  },
  itemSave: d => {
    const L = LISTS[d.kind], name = $('#iName').value.trim(), type = $('#iType').value;
    if (!name) { toast('Please type a name first.'); return true; }
    const days = [...document.querySelectorAll('.iDay:checked')].map(c => +c.value);
    if (type === 'days' && !days.length) { toast('Tick at least one day of the week.'); return true; }
    const every = Math.max(1, Math.min(365, parseInt($('#iEvery').value, 10) || 2));
    const list = S[L.items], old = ui.editing.id ? list.find(i => i.id === ui.editing.id) : null;
    const time = L.reminders ? ($('#iTime').value || '') : '';
    const freq = { type, days: type === 'days' ? days : [], every, start: (old && old.freq && old.freq.start) || today() };
    if (old) Object.assign(old, { name, freq, time });
    else list.push({ id: uid(), name, freq, time });
    save(L.items); ui.editing = null;
  },
  calendarAlarm: d => { calendarAlarm(S.supps.find(i => i.id === d.id)); return true; },
  foodList: () => { ui.trTab = 'food'; show('tracker'); return true; },

  // Journal
  entryNew: d => { ui.entry = { date: d.date || today(), mood: 0, energy: 0, intention: '', text: '' }; show('journal'); },
  entryEdit: d => { ui.entry = { ...S.journal.find(e => e.id === d.id) }; show('journal'); },
  entryPick: (d, el) => {
    ui.entry[d.field] = ui.entry[d.field] === +d.v ? 0 : +d.v;
    el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('sel', +b.dataset.v === ui.entry[d.field]));
    return true;
  },
  entryCancel: () => { stopSpeaking(); ui.entry = null; },
  entrySave: () => {
    stopSpeaking();
    const e = Object.assign(ui.entry, { date: $('#eDate').value || today(), intention: $('#eIntent').value.trim(), text: $('#eText').value.trim() });
    if (!e.text && !e.mood && !e.intention) { toast('Write something or pick a mood first.'); return true; }
    if (e.id) S.journal = S.journal.map(x => x.id === e.id ? e : x); else S.journal.push({ ...e, id: uid() });
    save('journal'); ui.entry = null;
  },
  entryDelete: d => {
    if (!confirm('Delete this entry?')) return true;
    S.journal = S.journal.filter(e => e.id !== d.id); save('journal');
  },
  speak: (d, el) => { speakInto(el); return true; },

  // Calendar
  calMonth: d => { ui.calMonth = firstOfMonth(ui.calMonth, +d.step); },
  calDay: d => { ui.calDay = d.day; const m = dateOf(d.day); ui.calMonth = firstOfMonth(m); },

  // Guides
  guideFolder: d => { ui.folder = +d.i; ui.guide = null; },
  guidesHome: () => { ui.folder = null; ui.guide = null; },
  guideOpen: d => { ui.guide = +d.i; ui.guideEditing = false; openGuide(ui.guides[ui.folder].guides[ui.guide].file); },
  guideBack: () => { ui.guide = null; ui.guideEditing = false; },
  guideEdit: () => { ui.guideEditing = true; },
  guideCancel: () => { ui.guideEditing = false; },
  guideSave: () => {
    const g = ui.guides[ui.folder].guides[ui.guide], t = $('#gText').value.replace(/\s+$/, '') + '\n';
    if (t.trim() === ui.guideText[g.file].trim()) delete S.guideEdits[g.file]; else S.guideEdits[g.file] = t;
    save('guideEdits'); ui.guideEditing = false; toast('Saved on this phone.');
  },
  guidePublish: async () => {
    const g = ui.guides[ui.folder].guides[ui.guide], t = $('#gText').value.replace(/\s+$/, '') + '\n';
    S.guideEdits[g.file] = t; save('guideEdits');
    $('#guideSteps').innerHTML = publishSteps(await copyText(t), t, 'guides/' + g.file, 'wording');
    return true;
  },
  guideReset: () => {
    if (!confirm('Go back to the original wording?')) return true;
    delete S.guideEdits[ui.guides[ui.folder].guides[ui.guide].file]; save('guideEdits'); ui.guideEditing = false;
  },

  // Reels
  reelAdd: () => {
    const url = $('#reelUrl').value.trim(), title = $('#reelTitle').value.trim();
    if (!reelInfo(url)) { toast('Please paste a full link starting with https://'); return true; }
    S.myReels.push({ id: uid(), url, title }); save('myReels'); toast('Reel added.');
  },
  reelRemove: d => {
    if (!confirm('Remove this reel?')) return true;
    S.myReels = S.myReels.filter(r => r.id !== d.id); save('myReels');
  },
  reelShare: async d => {
    if (navigator.share) { try { await navigator.share({ title: 'A reel from Shroom Buddies', url: d.url }); } catch {} return true; }
    toast(await copyText(d.url) ? 'Link copied. Paste it into a message.' : d.url);
    return true;
  },
  reelShareAll: async () => {
    const url = $('#reelUrl').value.trim(), title = $('#reelTitle').value.trim();
    if (!reelInfo(url)) { toast('Paste the reel link in the box first.'); return true; }
    if (!Array.isArray(ui.reels)) { toast("The shared reels didn't load. Check your internet and try again."); return true; }
    const text = JSON.stringify([...ui.reels, title ? { title, url } : { url }], null, 2) + '\n';
    $('#reelSteps').innerHTML = publishSteps(await copyText(text), text, 'reels.json', 'reel');
    return true;
  },

  // Settings
  practiceAdd: () => {
    const v = $('#newPractice').value.trim();
    if (!v) return true;
    S.practices.push({ id: uid(), name: v }); save('practices');
  },
  practiceRemove: d => {
    const p = S.practices.find(x => x.id === d.id);
    if (!confirm(`Remove "${p.name}"?`)) return true;
    S.practices = S.practices.filter(x => x.id !== d.id); save('practices');
  },
  install: () => { if (installPrompt) { installPrompt.prompt(); installPrompt = null; } },
  adminIn: async () => {
    let site = ui.site; try { site = ui.site = await getJSON('site.json'); } catch {}
    if (!site.adminHash) { toast('Admin sign-in needs the internet, or is not set up yet.'); return true; }
    if (await sha256($('#adminPw').value) !== site.adminHash) { toast('That passphrase is not right.'); return true; }
    S.prefs.admin = true; save('prefs'); toast('Signed in as admin.');
  },
  adminOut: () => { S.prefs.admin = false; S.prefs.editMode = false; save('prefs'); ui.guideEditing = false; },
  exportData: () => {
    const data = Object.fromEntries(KEYS.map(k => [k, k === 'prefs' ? { ...S.prefs, admin: false } : S[k]]));
    download(`shroom-buddies-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
    return true;
  },
  importData: () => { $('#importFile').click(); return true; },
};

const changes = {
  practice: (d, el) => {
    const k = today(), set = new Set(S.done[k] || []);
    el.checked ? set.add(d.id) : set.delete(d.id); S.done[k] = [...set]; save('done');
  },
  tickItem: (d, el) => {
    const L = LISTS[d.kind], k = ui.listDay[d.kind], set = new Set(S[L.log][k] || []);
    el.checked ? set.add(d.id) : set.delete(d.id); S[L.log][k] = [...set]; save(L.log);
  },
  freqType: (d, el) => {
    $('#iDaysBox').classList.toggle('hidden', el.value !== 'days');
    $('#iEveryBox').classList.toggle('hidden', el.value !== 'every');
    return true;
  },
  editMode: (d, el) => { S.prefs.editMode = el.checked; save('prefs'); },
  importFile: async (d, el) => {
    const file = el.files[0]; el.value = '';
    if (!file) return true;
    let data;
    try { data = JSON.parse(await file.text()); } catch { data = null; }
    if (!data || typeof data !== 'object' || !KEYS.some(k => k in data)) { toast('That file is not a Shroom Buddies backup.'); return true; }
    if (!confirm('Replace the data on this phone with this backup?')) return true;
    for (const k of KEYS) if (k in data) { S[k] = k === 'prefs' ? { ...data.prefs, admin: S.prefs.admin } : data[k]; save(k); }
    toast('Backup loaded.'); show('today');
  },
};

async function runAction(table, name, el, page) {
  const fn = table[name]; if (!fn) return;
  const stop = await fn({ ...el.dataset }, el);
  if (!stop) drawAll(page);
}

/* ================= 9. Drawing pages and moving between them ================= */

const pageEl = id => document.getElementById('p-' + id);

// Draw one page. Pages with a half-filled form are left alone unless "force" is true.
function draw(id, force = false) {
  const el = pageEl(id); if (!el || !views[id]) return;
  const typing = el.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (!force && (el.querySelector('[data-form]') || typing)) return;
  const y = el.scrollTop;
  el.innerHTML = views[id]();
  el.scrollTop = y;
}
// Redraw every page after a change. "from" is the page where the change was made (always redrawn).
function drawAll(from) { PAGES.forEach(p => draw(p.id, p.id === from)); }

function setCurrent(id) {
  ui.page = id;
  const i = PAGES.findIndex(p => p.id === id), page = PAGES[i];
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === page.nav));
  $('#pageName').innerHTML = `<span>${page.name}</span><span class="dots">${PAGES.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</span>`;
  if (id === 'guides') loadGuides();
  if (id === 'reels') loadReels();
}

function scrollToPage(id, smooth = true) {
  const i = PAGES.findIndex(p => p.id === id), box = $('#view');
  if (i >= 0) box.scrollTo({ left: i * box.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
}
function show(id, smooth = true) {
  if (!PAGES.some(p => p.id === id)) return;
  draw(id, true);
  setCurrent(id);
  scrollToPage(id, smooth);
}

/* ================= 10. Start-up ================= */

function start() {
  const view = $('#view');
  view.innerHTML = PAGES.map(p => `<section class="page" id="p-${p.id}" aria-label="${p.name}"></section>`).join('');

  // header and bottom bar heights, so pages fit between them
  const sizes = () => {
    document.documentElement.style.setProperty('--hdr', $('header').offsetHeight + 'px');
    document.documentElement.style.setProperty('--nav', $('#nav').offsetHeight + 'px');
  };
  sizes(); addEventListener('resize', () => { sizes(); scrollToPage(ui.page, false); });

  // taps and ticks
  view.addEventListener('click', e => {
    const el = e.target.closest('[data-do]');
    if (el) { e.preventDefault(); runAction(actions, el.dataset.do, el, el.closest('.page')?.id.slice(2)); }
  });
  view.addEventListener('change', e => {
    const el = e.target.closest('[data-change]');
    if (el) runAction(changes, el.dataset.change, el, el.closest('.page')?.id.slice(2));
  });
  $('#nav').addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    if (b.dataset.go === 'guides') { ui.folder = null; ui.guide = null; ui.guideEditing = false; }   // Guides button always opens the folder list
    show(b.dataset.go);
  });
  $('#settingsBtn').addEventListener('click', () => show('settings'));

  // after a swipe settles, that page becomes the current one
  let settle;
  view.addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      const page = PAGES[Math.round(view.scrollLeft / view.clientWidth)];
      if (page && page.id !== ui.page) { stopSpeaking(); setCurrent(page.id); }
    }, 90);
  });

  drawAll();
  show('today', false);

  // quote of the day
  getJSON('quotes.json').then(q => { QUOTES = Array.isArray(q) ? q : []; draw('today'); }).catch(() => {});

  // keep Today fresh (reminders, greeting, new day)
  setInterval(() => draw('today'), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) drawAll(); });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Title slide, once each time the app is opened
function splash() {
  const el = $('#splash'); if (!el) return;
  const finish = () => { document.body.classList.remove('splashing'); el.remove(); };
  if (sessionStorage.getItem('sb_seen')) return finish();
  sessionStorage.setItem('sb_seen', '1');
  const hide = () => { el.classList.add('hide'); document.body.classList.remove('splashing'); setTimeout(() => el.remove(), 900); };
  el.addEventListener('click', hide);
  setTimeout(hide, 4500);
}

// Drifting sparkles behind everything
function sparkles() {
  const c = $('#sparkles'); if (!c || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = c.getContext('2d'), colours = ['251,231,166', '233,196,106', '120,200,210', '255,150,60', '255,255,255'];
  let W, H, dots = [];
  const make = () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() ** 3 * 9 + 0.6, c: colours[Math.random() * colours.length | 0],
    vy: -(Math.random() * .25 + .05), vx: (Math.random() - .5) * .12, a: Math.random() * .55 + .25, t: Math.random() * 6.28, s: Math.random() * .02 + .005 });
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = Array.from({ length: Math.min(90, Math.round(W * H / 9000)) }, make);
  };
  resize(); addEventListener('resize', resize);
  (function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const p of dots) {
      p.x += p.vx; p.y += p.vy; p.t += p.s;
      if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W; }
      const a = p.a * (.55 + .45 * Math.sin(p.t)), g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.2);
      g.addColorStop(0, `rgba(${p.c},${a})`); g.addColorStop(.4, `rgba(${p.c},${a * .45})`); g.addColorStop(1, `rgba(${p.c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, 6.283); ctx.fill();
    }
    document.hidden ? setTimeout(frame, 500) : requestAnimationFrame(frame);
  })();
}

splash();
sparkles();
start();
