/* Shroom Buddies
   A free phone app. Everything personal is kept on this phone only (browser storage).
   Plain JavaScript, no libraries.

   Sections:
     1. Settings
     2. Saved data
     3. Helpers
     4. Dates and "how often"
     5. Shared building blocks
     6. Pages (swipe pages 1 to 8)
     7. Pop-up panels (opened tabs)
     8. Guides, reels and useful links
     9. Button actions
    10. Drawing, moving between pages, and magic
    11. Start-up
*/
'use strict';

/* ================= 1. Settings ================= */

const REPO = 'longzdalez/Shroom-Buddies-2';    // GitHub repo, used by admin "Open GitHub" buttons
const ADMIN_SALT = 'shroombuddies-admin:';      // the admin passphrase is checked against site.json "adminHash"

// Swipe pages, in order. Page 1 (Home) has no bottom-bar button; the 🏠 button at the top goes there.
const PAGES = [
  { id: 'home',        name: 'Home' },
  { id: 'tracker',     name: 'Tracker' },
  { id: 'intentions',  name: 'Intentions' },
  { id: 'practices',   name: 'Practices' },
  { id: 'journal',     name: 'Journal' },
  { id: 'nourish',     name: 'Food & Supplements' },
  { id: 'inspiration', name: 'Inspiration' },
  { id: 'guides',      name: 'Guides & Reels' },
];

// Times of day for check-ins. They change at 12 noon and 6pm.
const PERIODS = [['am', '🌅', 'Morning'], ['pm', '☀️', 'Afternoon'], ['eve', '🌙', 'Evening']];
const periodNow = () => { const h = new Date().getHours(); return h < 12 ? 'am' : h < 18 ? 'pm' : 'eve'; };

// The three things checked in each time of day.
const MEASURES = {
  mood:   { label: 'Mood',   icon: '😊', colour: '#ffd166' },
  energy: { label: 'Energy', icon: '⚡', colour: '#6fe0e0' },
  focus:  { label: 'Focus',  icon: '🎯', colour: '#b49cff' },
};

// Tick lists with "how often".
const LISTS = {
  supps: { items: 'supps', log: 'suppLog', icon: '💊', title: 'Supplements', one: 'supplement', example: 'e.g. Vitamin D', reminders: true },
  food:  { items: 'foods', log: 'foodLog', icon: '🥗', title: 'Food', one: 'food type', example: 'e.g. Leafy greens' },
};

// Lists with a tick box, two columns, and "hide when ticked".
const COLLECTIONS = {
  intentions:  { title: 'Intentions', icon: '🎯', cols: ['Intention', 'Notes'], tick: 'Done', empty: 'What would you like to bring into your life?' },
  inspiration: { title: 'Inspiration', icon: '💡', cols: ['Material', 'Author / Source'], tick: 'Have it', empty: 'Books, films, talks and anything that inspires you.' },
};

// Useful Links lists on the Guides page.
const LINK_LISTS = [
  { id: 'books',   title: 'Books',               icon: '📚' },
  { id: 'films',   title: 'Films & Programmes',  icon: '🎬' },
  { id: 'health',  title: 'Health & Wellbeing',  icon: '🌿' },
  { id: 'studies', title: 'Medical Studies',     icon: '🔬' },
  { id: 'docs',    title: 'Related Documents',   icon: '📄' },
];

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
  journal:     store.get('journal', []),      // [{id, date, mood, energy, intention, text}]
  practices:   store.get('practices', named(['Morning meditation', 'Breathwork (5 min)', 'Walk in nature', 'Drink water', 'Gratitude note', 'Evening reflection'], 'p')),
  done:        store.get('done', {}),         // {'YYYY-MM-DD': [practiceId]}
  doses:       store.get('doses', {}),        // {'YYYY-MM-DD': {micro: true} or {grams: 1.5}}
  checkins:    store.get('checkins', {}),     // {'YYYY-MM-DD': {am: {mood, energy, focus}, pm: {...}, eve: {...}}}
  supps:       store.get('supps', []),        // [{id, name, freq, time}]
  suppLog:     store.get('suppLog', {}),      // {'YYYY-MM-DD': [itemId]}
  foods:       store.get('foods', named(['Fruit', 'Vegetables', 'Whole grains', 'Protein', 'Sugar / sweets', 'Caffeine', 'Alcohol'], 'f')),
  foodLog:     store.get('foodLog', {}),
  intentions:  store.get('intentions', []),   // [{id, a, b, ticked}]
  inspiration: store.get('inspiration', null),// [{id, a, b, ticked}]
  links:       store.get('links', {}),        // {books: [{id, material, author, url, notes}], ...} added on this phone
  reading:     store.get('reading', []),      // older versions only (moved into Inspiration)
  readLog:     store.get('readLog', {}),
  myReels:     store.get('myReels', []),      // [{id, url, title}] reels added on this phone
  guideEdits:  store.get('guideEdits', {}),   // {'file.md': 'changed wording'} (admin, this phone)
  prefs:       store.get('prefs', {}),        // {admin, editMode, lastBackup, lastGuide}
};
const KEYS = Object.keys(S);
const save = key => store.set(key, S[key]);
const isAdmin = () => !!S.prefs.admin;

// First time on this version: books from the old Reading list move into Inspiration.
if (!Array.isArray(S.inspiration)) {
  S.inspiration = S.reading.map(r => ({ id: 'r' + r.id, a: r.name, b: '', ticked: false }));
  save('inspiration');
}

/* ================= 3. Helpers ================= */

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;


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

/* ================= 5. Shared building blocks ================= */

// Progress ring. "id" lets the ring glide smoothly from its old value to the new one.
const ring = (id, percent, big, small) =>
  `<div class="ring ${percent >= 100 ? 'full' : ''}" data-ring="${id}" style="--p:${Math.round(percent)}"><div><b>${big}</b><small>${small}</small></div></div>`;

const hero = (ringHTML, title, lines) =>
  `<div class="card hero">${ringHTML}<div><div class="title">${title}</div>${lines}</div></div>`;

const stepper = (title, action, extra = '') =>
  `<div class="stepper"><button class="ghost small" data-do="${action}" data-step="-1" ${extra} aria-label="Back">‹</button>
    <h2>${title}</h2><button class="ghost small" data-do="${action}" data-step="1" ${extra} aria-label="Forward">›</button></div>`;

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

const tickRow = (on, name, change, extra, sub = '', buttons = '', dim = false) =>
  `<div class="tick ${on ? 'done' : ''} ${dim ? 'not-due' : ''}"><label>
    <input type="checkbox" data-change="${change}" ${extra} ${on ? 'checked' : ''}>
    <span style="min-width:0"><span class="name">${esc(name)}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</span></label>${buttons}</div>`;

const toggles = (items, ids, log, k) => items.length
  ? `<div class="toggles">${items.map(i => `<button class="${ids.includes(i.id) ? 'on' : ''}" data-do="toggleLog" data-log="${log}" data-id="${i.id}" data-day="${k}">${esc(i.name)}</button>`).join('')}</div>`
  : '<div class="empty">Nothing on this list yet.</div>';

const holdHint = text => `<p class="hold-hint">✋ ${text}</p>`;

// Check-in values
const checkin = (k, p) => (S.checkins[k] || {})[p] || {};
const showValue = (m, v) => !v ? '–' : m === 'mood' ? MOODS[v - 1] : `${v}<small>/5</small>`;
function dayAvg(k, m) {
  const v = PERIODS.map(([p]) => checkin(k, p)[m]).filter(Boolean);
  return v.length ? v.reduce((a, b) => a + b) / v.length : 0;
}
const dayMarks = d => (S.journal.some(e => e.date === d) ? '📓' : '') + ((S.done[d] || []).length ? '🌱' : '') + (S.doses[d] ? '🍄' : '')
  + ((S.suppLog[d] || []).length ? '💊' : '') + ((S.foodLog[d] || []).length ? '🥗' : '');

/* ================= 6. Pages (swipe pages 1 to 8) ================= */
// Things the app remembers while it's open (not saved).
const ui = {
  page: 'home',
  trMonth: firstOfMonth(new Date()), day: today(),     // tracker calendar
  editList: null,         // 'practices' or 'nourish' while changing that list (press and hold)
  editing: null,          // {kind, id} while a supplement or food form is open
  editColl: null,         // collection being changed
  collEdit: null,         // item being changed in a collection
  entry: null,            // journal entry being written or changed
  search: '',
  sheet: null,            // the open pop-up panel: {type, ...}
  popup: null,            // small notes box: {title, text}
  graph: { range: 30, show: { mood: true, energy: true, focus: true, practices: true, shrooms: true }, day: null },
  guides: null, guideText: {}, folder: null, guide: null, guideEditing: false,
  reels: null, site: {}, sharedLinks: {},
  linkBar: false, linkEdit: null,
};

const views = {};
let QUOTES = [];
function quoteHTML() {
  if (!QUOTES.length) return '';
  const q = QUOTES[Math.floor(dateOf(today()) / 864e5) % QUOTES.length];
  return `<div class="quote"><p>“${esc(q.text)}”</p><span>— ${esc(q.by)}</span></div>`;
}

// Today's progress: practices plus supplements due today.
function todayProgress(k = today()) {
  const supps = S.supps.filter(i => isDue(i, k));
  const done = S.practices.filter(p => (S.done[k] || []).includes(p.id)).length + supps.filter(i => (S.suppLog[k] || []).includes(i.id)).length;
  return { done, total: S.practices.length + supps.length };
}

/* Supplements due now (reminder time has passed, due today, not yet ticked) */
function remindersHTML(compact) {
  const now = new Date(), time = `${pad(now.getHours())}:${pad(now.getMinutes())}`, k = today(), taken = S.suppLog[k] || [];
  const due = S.supps.filter(i => i.time && i.time <= time && !taken.includes(i.id) && isDue(i, k));
  if (!due.length) return '';
  return `<div class="card alert reminder ${compact ? 'compact' : ''}"><div class="label-row"><h2 style="margin:0">⏰ Time for your supplements</h2></div>
    ${due.map(i => `<div class="tick"><span class="name" style="flex:1">💊 ${esc(i.name)} <small class="muted">${i.time}</small></span>
      <button class="small" data-do="takeNow" data-id="${i.id}">Taken ✓</button></div>`).join('')}</div>`;
}

/* ----- Page 1: Home ----- */
function measureTile(m) {
  const M = MEASURES[m], k = today(), now = periodNow(), P = PERIODS.find(p => p[0] === now), v = checkin(k, now)[m];
  return `<button class="tile" data-do="openSheet" data-sheet="measure" data-m="${m}" data-day="${k}">
    <span class="tile-icon">${M.icon}</span>
    <span class="tile-main"><span class="tile-label">${M.label}</span><span class="tile-sub">${P[1]} ${P[2]}</span></span>
    <span class="tile-val ${v ? '' : 'empty'}">${v ? showValue(m, v) : 'Tap to add'}</span>
    <span class="pips">${PERIODS.map(([p]) => `<i class="${checkin(k, p)[m] ? 'on' : ''} ${p === now ? 'now' : ''}"></i>`).join('')}</span></button>`;
}

function weekTile() {
  const k = today(), monday = addDays(k, -weekday(k));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return `<button class="tile week" data-do="go" data-page="tracker" data-day="${k}">
    <span class="tile-head"><span class="tile-icon">🍄</span><span class="tile-label">Tracker</span><span class="tile-sub" style="margin-left:auto">This week ›</span></span>
    <span class="week-strip">${days.map((d, i) => {
      const mood = dayAvg(d, 'mood'), ds = S.doses[d];
      return `<span class="wday ${d === k ? 'today' : ''} ${d > k ? 'future' : ''}"><small>${WEEK[i][0]}</small><b>${+d.slice(8)}</b>
        <span class="wmark">${ds ? (ds.micro ? '🍄' : `<em>${ds.grams}g</em>`) : ''}</span>
        <span class="wmood">${mood ? MOODS[Math.round(mood) - 1] : ''}</span></span>`;
    }).join('')}</span></button>`;
}

views.home = () => {
  const k = today(), P = todayProgress(k), pct = P.total ? P.done / P.total * 100 : 0;
  const h = new Date().getHours(), greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const last = Object.keys(S.doses).filter(d => d <= k).sort().pop(), since = last == null ? null : daysBetween(last, k);
  return `${quoteHTML()}
    <div class="greet">✦ ${greeting}, buddy ✦</div>
    ${hero(ring('home', pct, `${Math.round(pct)}%`, 'TODAY'), niceDate(k),
      `<div class="muted">${P.done} of ${P.total} done today</div>
       <div class="chips"><span class="chip">🔥 ${plural(streak(), 'day')}</span><span class="chip">📓 ${plural(S.journal.length, 'entry', 'entries')}</span>
       <span class="chip">🍄 ${since === null ? 'none yet' : since === 0 ? 'today' : plural(since, 'day') + ' ago'}</span></div>`)}
    ${remindersHTML(true)}
    <div class="card grow"><h2>How are you today?</h2>
      ${measureTile('mood')}${measureTile('energy')}${measureTile('focus')}${weekTile()}</div>`;
};

/* ----- Page 2: Tracker ----- */
function doseControls(k, inputId) {
  const cur = S.doses[k], last = Object.keys(S.doses).filter(d => d < k && S.doses[d].grams).sort().pop();
  return `<p class="muted">${cur ? '✨ Logged: <b style="color:var(--gold-hi)">' + doseText(cur) + '</b>' : 'Nothing logged.'}</p>
    <div class="row"><button data-do="doseMicro" data-day="${k}">🍄 Microdose</button>
      ${cur ? `<button class="ghost fit" data-do="doseClear" data-day="${k}">Clear</button>` : ''}</div>
    <div class="row mt"><input id="${inputId}" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Or type grams" value="${cur && cur.grams ? cur.grams : ''}">
      <button class="fit" data-do="doseGrams" data-day="${k}" data-input="${inputId}">Save</button></div>
    ${!cur && last ? `<button class="ghost small mt" data-do="doseRepeat" data-day="${k}" data-from="${last}">↻ Same as last time (${S.doses[last].grams}g)</button>` : ''}`;
}

// One line per measure, showing morning, afternoon and evening. Tap to change.
const measureLine = (k, m) => `<button class="mline" data-do="openSheet" data-sheet="measure" data-m="${m}" data-day="${k}">
  <span class="mline-label">${MEASURES[m].icon} ${MEASURES[m].label}</span>
  ${PERIODS.map(([p, icon]) => `<span class="mline-val">${icon} ${showValue(m, checkin(k, p)[m])}</span>`).join('')}<span class="chev">›</span></button>`;

function sparkline() {
  const days = Array.from({ length: 30 }, (_, i) => addDays(today(), i - 29));
  const W = 300, H = 60, X = i => 4 + i * (W - 8) / 29, Y = v => H - 6 - (v - 1) / 4 * (H - 12);
  const lines = Object.keys(MEASURES).map(m => {
    const pts = days.map((d, i) => [i, dayAvg(d, m)]).filter(p => p[1]);
    return pts.length > 1 ? `<path d="${pts.map(([i, v], j) => `${j ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('')}" stroke="${MEASURES[m].colour}"/>` : '';
  }).join('');
  return lines ? `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${lines}</svg>` : '<p class="muted">Check in for a few days and your graph will appear here.</p>';
}

views.tracker = () => {
  const month = ui.trMonth, y = month.getFullYear(), m = month.getMonth(), days = new Date(y, m + 1, 0).getDate(), k = ui.day;
  let count = 0, grams = 0;
  for (let d = 1; d <= days; d++) { const ds = S.doses[`${y}-${pad(m + 1)}-${pad(d)}`]; if (ds) { count++; grams += ds.grams || 0; } }
  const last = Object.keys(S.doses).filter(d => d <= today()).sort().pop(), since = last == null ? null : daysBetween(last, today());
  const entries = S.journal.filter(e => e.date === k);
  return `${hero(ring('shroom', count / days * 100, count, 'DAYS'), monthName(month, false),
      `<div class="muted">${plural(count, 'mushroom day')} this month</div>
       <div class="chips">${grams ? `<span class="chip">⚖️ ${+grams.toFixed(2)}g</span>` : ''}<span class="chip">⏳ ${since === null ? 'none yet' : since === 0 ? 'today' : plural(since, 'day') + ' ago'}</span></div>`)}
    <div class="card">${stepper(monthName(month), 'trackerMonth')}
      ${monthGrid(month, k, 'pickDay', d => { const ds = S.doses[d]; return { on: !!ds, html: ds && !ds.micro ? `<small>${ds.grams}g</small>` : dayMarks(d) }; })}</div>
    <div class="card"><h2>${k === today() ? 'Today · ' : ''}${niceDate(k)}</h2>
      <p class="muted small-text">Tap anything below to add or change it for this day.</p>
      <div class="group-title"><span>🍄 Mushrooms</span></div>${doseControls(k, 'trGrams')}
      <div class="group-title"><span>💭 How you felt</span></div>${measureLine(k, 'mood')}${measureLine(k, 'energy')}${measureLine(k, 'focus')}
      <div class="group-title"><span>🧘 Practices</span></div>${toggles(S.practices, S.done[k] || [], 'done', k)}
      <div class="group-title"><span>💊 Supplements</span></div>${toggles(S.supps, S.suppLog[k] || [], 'suppLog', k)}
      <div class="group-title"><span>🥗 Food</span></div>${toggles(S.foods, S.foodLog[k] || [], 'foodLog', k)}
      <div class="group-title"><span>📓 Journal</span></div>
      ${entries.map(e => `<div class="inner">${entryHTML(e)}</div>`).join('')}
      <button class="small" data-do="entryNew" data-date="${k}">✍️ Write for this day</button></div>
    <button class="card tile-card" data-do="openSheet" data-sheet="graph">
      <span class="label-row"><h2 style="margin:0">📈 Your graph</h2><span class="chev">Open ›</span></span>
      ${sparkline()}
      <span class="legend">${Object.values(MEASURES).map(M => `<span><i style="background:${M.colour}"></i>${M.label}</span>`).join('')}<span class="muted">· last 30 days</span></span></button>`;
};

/* ----- Pages 3 and 7: Intentions and Inspiration ----- */
function collectionCard(key) {
  const C = COLLECTIONS[key], items = S[key], open = items.filter(i => !i.ticked), ticked = items.length - open.length;
  return `<div class="card grow tappable" data-do="openSheet" data-sheet="collection" data-key="${key}" data-hold="collEditOn">
    <div class="label-row"><h2 style="margin:0">${C.icon} ${C.title}</h2><span class="chev">Open ›</span></div>
    ${open.length ? `<div class="ctable"><div class="crow head"><span>${C.cols[0]}</span><span>${C.cols[1]}</span></div>
      ${open.map(i => `<div class="crow"><span>${esc(i.a)}</span><span>${esc(i.b)}</span></div>`).join('')}</div>`
      : `<p class="muted mt">${items.length ? 'Everything is ticked off. ✨' : C.empty}</p>`}
    ${ticked ? `<p class="muted small-text mt">✓ ${ticked} ticked off (tap to see)</p>` : ''}
    ${holdHint('Press and hold to add or change')}</div>`;
}
views.intentions = () => collectionCard('intentions');
views.inspiration = () => collectionCard('inspiration');

/* ----- Page 4: Practices ----- */
views.practices = () => {
  const k = today(), done = S.done[k] || [], n = S.practices.filter(p => done.includes(p.id)).length;
  if (ui.editList === 'practices') {
    return `<div class="card grow editing"><h2>✎ Change your practices</h2>
      <div class="row"><input id="newPractice" placeholder="Add a practice" enterkeyhint="done"><button class="fit" data-do="practiceAdd">Add</button></div>
      ${S.practices.map((p, i) => `<div class="edit-row"><span>${esc(p.name)}</span>
        <button class="ghost tiny" data-do="practiceMove" data-id="${p.id}" data-step="-1" ${i ? '' : 'disabled'} aria-label="Move up">↑</button>
        <button class="ghost tiny" data-do="practiceRemove" data-id="${p.id}">Remove</button></div>`).join('')}
      <button class="wide mt" data-do="editDone">Done</button></div>`;
  }
  return `<div class="card grow" data-hold="editList" data-list="practices">
    <div class="list-head">${ring('practices', S.practices.length ? n / S.practices.length * 100 : 0, `${n}/${S.practices.length}`, 'TODAY')}
      <div><h2 style="margin:0 0 4px">🧘 Daily practices</h2><div class="muted">${n === S.practices.length && n ? 'All done. Beautiful. ✨' : 'Tick each one as you do it.'}</div>
      <div class="chips"><span class="chip">🔥 ${plural(streak(), 'day')} streak</span></div></div></div>
    ${S.practices.length ? S.practices.map(p => tickRow(done.includes(p.id), p.name, 'practice', `data-id="${p.id}"`)).join('') : '<p class="muted">No practices yet.</p>'}
    ${holdHint('Press and hold to add or change practices')}</div>`;
};

/* ----- Page 5: Journal ----- */
function entryHTML(e) {
  return `<div class="entry"><h3>${MOODS[e.mood - 1] || ''} ${niceDate(e.date)}</h3>
    ${e.intention ? `<div class="muted">Intention: ${esc(e.intention)}</div>` : ''}
    ${e.energy ? `<div class="muted">Energy: ${'⚡'.repeat(e.energy)}</div>` : ''}
    ${e.text ? `<p>${esc(e.text)}</p>` : ''}
    <div class="actions"><button class="ghost small" data-do="entryEdit" data-id="${e.id}">Edit</button>
      <button class="ghost small" data-do="entryDelete" data-id="${e.id}">Delete</button></div></div>`;
}
const micButton = id => `<button type="button" class="mic" data-do="speak" data-field="${id}" aria-label="Speak instead of typing">🎤 Speak</button>`;
function entryForm(e) {
  return `<div class="card grow" data-form><h2>${e.id ? 'Change entry' : '✍️ New entry'}</h2>
    <label for="eDate">Date</label><input id="eDate" type="date" value="${e.date}">
    <label>Mood</label>${scaleButtons([1, 2, 3, 4, 5], MOODS, e.mood, 'data-do="entryPick" data-field="mood"')}
    <label>Energy</label>${scaleButtons([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], e.energy, 'data-do="entryPick" data-field="energy"')}
    <div class="label-row"><label for="eIntent">Intention</label>${micButton('eIntent')}</div>
    <input id="eIntent" value="${esc(e.intention)}" placeholder="What do you want to focus on?">
    <div class="label-row"><label for="eText">Notes</label>${micButton('eText')}</div>
    <textarea id="eText" placeholder="How are you feeling? What did you notice? Tap 🎤 to speak.">${esc(e.text)}</textarea>
    <div class="row"><button class="ghost" data-do="entryCancel">Cancel</button><button data-do="entrySave">Save</button></div></div>`;
}
const searchText = e => `${niceDate(e.date)} ${e.intention || ''} ${e.text || ''}`.toLowerCase();
views.journal = () => {
  if (ui.entry) return entryForm(ui.entry);
  const list = [...S.journal].sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
  const [latest, ...older] = list;
  return `<div class="card grow"><div class="label-row"><h2 style="margin:0">📓 Journal</h2><button class="small fit" data-do="entryNew">✍️ New entry</button></div>
    ${list.length > 3 ? `<input id="jSearch" class="search mt" type="search" placeholder="🔍 Search your journal" value="${esc(ui.search)}">` : ''}
    ${latest ? `<div class="inner jitem mt" data-search="${esc(searchText(latest))}"><div class="label-small">Latest entry</div>${entryHTML(latest)}</div>`
      : '<p class="muted mt">Your journal is empty. Start with how you feel today.</p>'}
    ${older.length ? `<div class="sec">Earlier entries</div>${older.map(e => `<details class="older jitem" data-search="${esc(searchText(e))}">
      <summary>${MOODS[e.mood - 1] || ''} ${niceDate(e.date)}${e.intention ? ' · ' + esc(e.intention) : ''}</summary>${entryHTML(e)}</details>`).join('')}
      <p class="muted hidden" id="noMatch">No entries match.</p>` : ''}</div>`;
};
function filterJournal() {
  const q = ui.search.trim().toLowerCase(); let shown = 0;
  document.querySelectorAll('#p-journal .jitem').forEach(el => {
    const hit = !q || el.dataset.search.includes(q); el.classList.toggle('hidden', !hit); if (hit) shown++;
    if (el.tagName === 'DETAILS') el.open = !!q && hit;
  });
  $('#noMatch')?.classList.toggle('hidden', shown > 0);
}

/* ----- Page 6: Food & Supplements ----- */
function itemForm(kind) {
  const L = LISTS[kind], it = ui.editing.id ? S[L.items].find(i => i.id === ui.editing.id) : null;
  const f = (it && it.freq) || { type: 'daily' }, type = f.type || 'daily', days = f.days || [];
  return `<div class="inner" data-form><h2>${it ? 'Change' : 'New'} ${L.one}</h2>
    <label for="iName">Name</label><input id="iName" value="${esc(it ? it.name : '')}" placeholder="${L.example}" enterkeyhint="done">
    <label>How often</label>
    <div class="tabs" id="iType" data-value="${type}">${[['daily', 'Every day'], ['days', 'Some days'], ['every', 'Every few days']].map(([v, l]) =>
      `<button type="button" class="${type === v ? 'on' : ''}" data-do="freqType" data-v="${v}">${l}</button>`).join('')}</div>
    <div id="iDaysBox" class="${type === 'days' ? '' : 'hidden'}"><label>Tick the days</label>
      <div class="weekdays">${WEEK.map((w, i) => `<label><input type="checkbox" class="iDay" value="${i}" ${days.includes(i) ? 'checked' : ''}>${w}</label>`).join('')}</div></div>
    <div id="iEveryBox" class="${type === 'every' ? '' : 'hidden'}"><label for="iEvery">How many days apart?</label>
      <input id="iEvery" type="number" inputmode="numeric" min="1" max="365" value="${f.every || 2}"></div>
    ${L.reminders ? `<label for="iTime">Reminder time (optional)</label><input id="iTime" type="time" value="${it && it.time ? it.time : ''}">` : ''}
    <div class="row mt"><button class="ghost" data-do="itemCancel">Cancel</button><button data-do="itemSave" data-kind="${kind}">Save</button></div></div>`;
}

views.nourish = () => {
  const k = today();
  if (ui.editList === 'nourish') {
    const section = kind => {
      const L = LISTS[kind];
      return `<div class="group-title"><span>${L.icon} ${L.title}</span><button class="tiny" data-do="itemNew" data-kind="${kind}">+ Add</button></div>
        ${ui.editing && ui.editing.kind === kind && !ui.editing.id ? itemForm(kind) : ''}
        ${S[L.items].map(i => ui.editing && ui.editing.id === i.id ? itemForm(kind) : `<div class="edit-row"><span>${esc(i.name)}<span class="sub">${howOften(i)}${i.time ? ' · ⏰ ' + i.time : ''}</span></span>
          <button class="ghost tiny" data-do="itemEdit" data-kind="${kind}" data-id="${i.id}">✎</button>
          <button class="ghost tiny" data-do="itemRemove" data-kind="${kind}" data-id="${i.id}">Remove</button></div>`).join('') || '<div class="empty">Nothing yet.</div>'}`;
    };
    return `<div class="card grow editing"><h2>✎ Change Food & Supplements</h2>${section('supps')}${section('food')}
      <button class="wide mt" data-do="editDone">Done</button></div>`;
  }
  const supps = S.supps, due = supps.filter(i => isDue(i, k)), took = due.filter(i => (S.suppLog[k] || []).includes(i.id)).length;
  return `${remindersHTML(false)}<div class="card grow" data-hold="editList" data-list="nourish">
    <div class="list-head">${ring('nourish', due.length ? took / due.length * 100 : 0, `${took}/${due.length}`, 'DUE')}
      <div><h2 style="margin:0 0 4px">🥗 Food & Supplements</h2><div class="muted">${niceDate(k)}</div></div></div>
    <div class="group-title"><span>💊 Supplements</span></div>
    ${supps.length ? supps.map(i => {
      const dueNow = isDue(i, k);
      return tickRow((S.suppLog[k] || []).includes(i.id), i.name, 'tickItem', `data-kind="supps" data-id="${i.id}" data-day="${k}"`,
        `${howOften(i)}${dueNow ? '' : ' · not due today'}${i.time ? ' · ⏰ ' + i.time : ''}`,
        i.time ? `<button class="ghost small" data-do="calendarAlarm" data-id="${i.id}" aria-label="Add alarm to phone calendar">📅</button>` : '', !dueNow);
    }).join('') : '<div class="empty">No supplements yet.</div>'}
    <div class="group-title"><span>🥗 Food today</span></div>
    ${S.foods.length ? `<div class="toggles">${S.foods.map(i => `<button class="${(S.foodLog[k] || []).includes(i.id) ? 'on' : ''}" data-do="toggleLog" data-log="foodLog" data-id="${i.id}" data-day="${k}">${esc(i.name)}</button>`).join('')}</div>` : '<div class="empty">No food types yet.</div>'}
    ${supps.some(i => i.time) ? '<p class="muted small-text mt">📅 adds a repeating alarm to your phone calendar, on the same days as the supplement.</p>' : ''}
    ${holdHint('Press and hold to add or change items')}</div>`;
};

function calendarAlarm(item) {
  const [hh, mm] = item.time.split(':'), f = item.freq || { type: 'daily' }, BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  let rule = 'RRULE:FREQ=DAILY';
  if (f.type === 'days' && (f.days || []).length) rule = 'RRULE:FREQ=WEEKLY;BYDAY=' + [...f.days].sort().map(i => BYDAY[i]).join(',');
  else if (f.type === 'every') rule = 'RRULE:FREQ=DAILY;INTERVAL=' + Math.max(1, +f.every || 1);
  let first = today();
  for (let n = 0; n < 400 && !isDue(item, first); n++) first = addDays(first, 1);
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shroom Buddies//EN', 'BEGIN:VEVENT',
    `UID:${item.id}-${Date.now()}@shroombuddies`, `DTSTAMP:${stamp}`, `DTSTART:${first.replace(/-/g, '')}T${hh}${mm}00`, 'DURATION:PT5M', rule,
    `SUMMARY:💊 Take ${item.name}`, 'DESCRIPTION:Reminder from Shroom Buddies',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:Take ${item.name}`, 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  download(`reminder-${item.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`, ics, 'text/calendar');
}

/* ----- Page 8: Guides & Reels ----- */
views.guides = () => {
  const G = Array.isArray(ui.guides) ? ui.guides : [];
  const count = G.reduce((n, f) => n + f.guides.length, 0);
  const linkCount = id => (S.links[id] || []).length + ((ui.sharedLinks || {})[id] || []).length;
  return `<div class="heading">Usage Guides</div>
    <button class="card tile-card big-tile" data-do="openSheet" data-sheet="guides"><span class="tile-icon">📖</span>
      <span class="tile-main"><span class="tile-label">Guides</span><span class="tile-sub">${G.length ? `${G.map(f => esc(f.folder)).join(' · ')} · ${plural(count, 'guide')}` : 'Microdosing and flood doses'}</span></span><span class="chev">›</span></button>
    <button class="card tile-card big-tile" data-do="openSheet" data-sheet="reels"><span class="tile-icon">🎬</span>
      <span class="tile-main"><span class="tile-label">Reels</span><span class="tile-sub">${S.myReels.length ? plural(S.myReels.length, 'reel') + ' of yours · ' : ''}${Array.isArray(ui.reels) && ui.reels.length ? plural(ui.reels.length, 'shared reel') : 'Watch and share'}</span></span><span class="chev">›</span></button>
    <div class="heading">Useful Links</div>
    ${LINK_LISTS.map(l => `<button class="card tile-card" data-do="openSheet" data-sheet="links" data-cat="${l.id}"><span class="tile-icon">${l.icon}</span>
      <span class="tile-main"><span class="tile-label">${l.title}</span><span class="tile-sub">${linkCount(l.id) ? plural(linkCount(l.id), 'entry', 'entries') : 'Tap to add'}</span></span><span class="chev">›</span></button>`).join('')}`;
};

/* ================= 7. Pop-up panels (opened tabs) ================= */
// Each returns {title, body}. "back" (optional) is the action for the ‹ button.
const sheets = {};

sheets.measure = s => {
  const M = MEASURES[s.m], k = s.day, now = k === today() ? periodNow() : '';
  const labels = s.m === 'mood' ? MOODS : [1, 2, 3, 4, 5];
  return { title: `${M.icon} ${M.label}`, body: `<p class="muted center">${k === today() ? 'Today · ' : ''}${niceDate(k)}</p>
    ${PERIODS.map(([p, icon, name]) => `<div class="checkin ${p === now ? 'now' : ''}"><div class="when">${icon} ${name}${p === now ? ' <small class="muted">(now)</small>' : ''}</div>
      ${scaleButtons([1, 2, 3, 4, 5], labels, checkin(k, p)[s.m], `data-do="checkin" data-day="${k}" data-when="${p}" data-field="${s.m}"`)}</div>`).join('')}
    <p class="muted small-text center">${s.m === 'mood' ? '😞 low … 😄 great' : '1 = very low · 5 = very high'}. Tap again to clear.</p>
    <div class="row mt">${Object.keys(MEASURES).filter(m => m !== s.m).map(m => `<button class="ghost" data-do="openSheet" data-sheet="measure" data-m="${m}" data-day="${k}">${MEASURES[m].icon} ${MEASURES[m].label}</button>`).join('')}</div>
    <button class="wide mt" data-do="closeSheet">Done</button>` };
};

sheets.collection = s => {
  const C = COLLECTIONS[s.key], items = S[s.key], editing = ui.editColl === s.key, it = ui.collEdit ? items.find(i => i.id === ui.collEdit) : null;
  return { title: `${C.icon} ${C.title}`, body: `
    ${editing ? `<div class="edit-bar" data-form><div class="label-small">${it ? 'Change entry' : 'Add an entry'}</div>
      <input id="cA" placeholder="${C.cols[0]}" value="${esc(it ? it.a : '')}" enterkeyhint="next">
      <input id="cB" placeholder="${C.cols[1]}" value="${esc(it ? it.b : '')}" enterkeyhint="done">
      <div class="row">${it ? '<button class="ghost" data-do="collCancel">Cancel</button>' : ''}<button data-do="collSave" data-key="${s.key}">${it ? 'Save' : '+ Add'}</button></div></div>` : ''}
    <div class="ctable full" ${editing ? '' : `data-hold="collEditOn" data-key="${s.key}"`}>
      <div class="crow head"><span class="ctick">${C.tick}</span><span>${C.cols[0]}</span><span>${C.cols[1]}</span>${editing ? '<span class="cbtns"></span>' : ''}</div>
      ${items.length ? items.map(i => `<div class="crow ${i.ticked ? 'crossed' : ''}">
        <span class="ctick"><input type="checkbox" data-change="collTick" data-key="${s.key}" data-id="${i.id}" ${i.ticked ? 'checked' : ''} aria-label="${C.tick}"></span>
        <span>${esc(i.a)}</span><span>${esc(i.b)}</span>
        ${editing ? `<span class="cbtns"><button class="ghost tiny" data-do="collEditItem" data-id="${i.id}" aria-label="Change">✎</button><button class="ghost tiny" data-do="collDelete" data-key="${s.key}" data-id="${i.id}" aria-label="Delete">🗑</button></span>` : ''}</div>`).join('')
      : `<p class="muted" style="padding:12px 4px">${C.empty}</p>`}</div>
    ${editing ? '<button class="wide mt" data-do="collEditOff">Done</button>' : holdHint('Press and hold to add, change or delete. Ticked items are hidden on the page.')}` };
};

sheets.guides = () => ({ title: '📖 Guides', body: guidesBody(), back: ui.guide !== null ? 'guideBack' : ui.folder !== null ? 'guidesHome' : null });
sheets.reels = () => ({ title: '🎬 Reels', body: reelsBody() });
sheets.links = s => { const L = LINK_LISTS.find(l => l.id === s.cat); return { title: `${L.icon} ${L.title}`, body: linksBody(s.cat) }; };
sheets.graph = () => ({ title: '📈 Your graph', body: graphBody() });
sheets.settings = () => ({ title: '⚙️ Settings', body: settingsBody() });

/* ----- Graph ----- */
function graphData(range) {
  return Array.from({ length: range }, (_, i) => {
    const k = addDays(today(), i - range + 1);
    return { k, mood: dayAvg(k, 'mood'), energy: dayAvg(k, 'energy'), focus: dayAvg(k, 'focus'),
      practices: S.practices.length ? S.practices.filter(p => (S.done[k] || []).includes(p.id)).length / S.practices.length : 0,
      dose: S.doses[k], afterDose: !!S.doses[addDays(k, -1)] };
  });
}

function graphBody() {
  const G = ui.graph, D = graphData(G.range), n = D.length;
  const W = 360, H = 230, left = 20, right = 6, top = 24, bottom = 24, cw = (W - left - right) / n;
  const X = i => left + (i + .5) * cw, Y = v => top + (H - top - bottom) * (1 - (v - 1) / 4);
  let g = '<defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe29a" stop-opacity=".55"/><stop offset="1" stop-color="#f4cf6e" stop-opacity=".08"/></linearGradient></defs>';
  for (let v = 1; v <= 5; v++) g += `<line class="grid" x1="${left}" x2="${W - right}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${left - 5}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`;
  D.forEach((x, i) => {
    if (x.k === G.day) g += `<rect x="${(X(i) - cw / 2).toFixed(1)}" y="${top - 4}" width="${cw.toFixed(1)}" height="${H - top - bottom + 8}" rx="3" fill="rgba(244,207,110,.14)"/>`;
    if (G.show.practices && x.practices) { const h = (H - top - bottom) * x.practices; g += `<rect class="bar" x="${(X(i) - cw * .36).toFixed(1)}" y="${(H - bottom - h).toFixed(1)}" width="${(cw * .72).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`; }
    if (G.show.shrooms && x.dose) g += `<text x="${X(i).toFixed(1)}" y="${top - 8}" text-anchor="middle" font-size="${Math.min(13, Math.max(7, cw * .9))}">🍄</text>`;
    const step = n <= 14 ? 1 : n <= 30 ? 5 : 15;
    if (i % step === 0 || i === n - 1) g += `<text class="ax" x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${+x.k.slice(8)}${n > 30 && (+x.k.slice(8) <= step) ? '/' + +x.k.slice(5, 7) : ''}</text>`;
  });
  for (const m of Object.keys(MEASURES)) {
    if (!G.show[m]) continue;
    const pts = D.map((x, i) => [i, x[m]]).filter(p => p[1]);
    g += `<path class="gline" stroke="${MEASURES[m].colour}" d="${pts.map(([i, v], j) => `${j ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('')}"/>`
      + pts.map(([i, v]) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${n > 30 ? 1.8 : 2.8}" fill="${MEASURES[m].colour}"/>`).join('');
  }
  D.forEach((x, i) => { g += `<rect x="${(X(i) - cw / 2).toFixed(1)}" y="0" width="${cw.toFixed(1)}" height="${H}" fill="transparent" data-do="graphDay" data-day="${x.k}"/>`; });

  // averages for the period
  const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  const avg = m => mean(D.map(x => x[m]).filter(Boolean));
  const summary = Object.keys(MEASURES).map(m => `<span class="stat" style="--c:${MEASURES[m].colour}"><b>${avg(m) ? avg(m).toFixed(1) : '–'}</b><small>${MEASURES[m].label}</small></span>`).join('')
    + `<span class="stat" style="--c:#ffb04a"><b>${D.filter(x => x.dose).length}</b><small>🍄 days</small></span>`;

  // the chosen day
  const sel = G.day && D.find(x => x.k === G.day);
  const dayBox = sel ? `<div class="inner day-box"><b>${niceDate(sel.k)}</b>
      ${Object.keys(MEASURES).map(m => `<div class="mini-line"><span>${MEASURES[m].icon} ${MEASURES[m].label}</span>${PERIODS.map(([p, icon]) => `<span>${icon} ${showValue(m, checkin(sel.k, p)[m])}</span>`).join('')}</div>`).join('')}
      <div class="muted small-text mt">🍄 ${doseText(sel.dose) || 'none'} · 🧘 ${Math.round(sel.practices * 100)}% practices · 💊 ${(S.suppLog[sel.k] || []).length} · 🥗 ${(S.foodLog[sel.k] || []).length}</div>
      <button class="ghost small mt" data-do="openDay" data-day="${sel.k}">Open this day in the tracker ›</button></div>`
    : '<p class="muted small-text center">Tap any day on the graph to see its details.</p>';

  // best time of day
  const byPeriod = PERIODS.map(([p, icon, name]) => {
    const vals = m => mean(D.map(x => checkin(x.k, p)[m]).filter(Boolean));
    return `<div class="trow"><span>${icon} ${name}</span>${Object.keys(MEASURES).map(m => `<span>${vals(m) ? vals(m).toFixed(1) : '–'}</span>`).join('')}</div>`;
  }).join('');

  // how things connect: average on days with something vs days without
  const factor = (label, test) => {
    const cells = Object.keys(MEASURES).map(m => {
      const days = D.filter(x => x[m]), yes = days.filter(test).map(x => x[m]), no = days.filter(x => !test(x)).map(x => x[m]);
      if (yes.length < 2 || no.length < 2) return null;
      return mean(yes) - mean(no);
    });
    if (cells.every(c => c === null)) return null;
    return { label, cells, size: Math.max(...cells.map(c => Math.abs(c || 0))) };
  };
  const factors = [factor('🍄 Mushroom day', x => !!x.dose), factor('🍄 Day after mushrooms', x => x.afterDose),
    ...S.practices.map(p => factor('🧘 ' + esc(p.name), x => (S.done[x.k] || []).includes(p.id))),
    ...S.supps.map(i => factor('💊 ' + esc(i.name), x => (S.suppLog[x.k] || []).includes(i.id))),
    ...S.foods.map(i => factor('🥗 ' + esc(i.name), x => (S.foodLog[x.k] || []).includes(i.id)))].filter(Boolean).sort((a, b) => b.size - a.size);
  const cell = c => c === null ? '<span class="muted">–</span>' : `<span class="${c > .05 ? 'up' : c < -.05 ? 'down' : ''}">${c > 0 ? '+' : ''}${c.toFixed(1)} ${c > .05 ? '↑' : c < -.05 ? '↓' : ''}</span>`;

  return `<div class="tabs">${[[14, '2 weeks'], [30, '30 days'], [90, '3 months']].map(([r, l]) => `<button class="${G.range === r ? 'on' : ''}" data-do="graphRange" data-v="${r}">${l}</button>`).join('')}</div>
    <div class="toggles center-row">${[...Object.keys(MEASURES).map(m => [m, MEASURES[m].icon + ' ' + MEASURES[m].label]), ['practices', '🧘 Practices'], ['shrooms', '🍄 Mushrooms']].map(([key, l]) =>
      `<button class="${G.show[key] ? 'on' : ''}" data-do="graphShow" data-v="${key}">${l}</button>`).join('')}</div>
    <div class="card graph-card"><svg class="graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mood, energy and focus over time">${g}</svg>
      <div class="legend">${Object.values(MEASURES).map(M => `<span><i style="background:${M.colour}"></i>${M.label}</span>`).join('')}<span><i class="bar"></i>Practices done</span><span>🍄 Mushroom day</span></div>
      <p class="muted small-text">Lines are the average of your morning, afternoon and evening check-ins (1 to 5).</p></div>
    ${dayBox}
    <div class="stats">${summary}</div>
    <div class="card"><h2>🕐 Best time of day</h2><div class="ttable"><div class="trow head"><span></span>${Object.values(MEASURES).map(M => `<span>${M.icon}</span>`).join('')}</div>${byPeriod}</div>
      <p class="muted small-text mt">Your average for each time of day.</p></div>
    <div class="card"><h2>🔗 How things connect</h2>
      <p class="muted small-text">Compares days when you did something with days you didn't. <span class="up">+1.0 ↑</span> means you felt a point higher on those days. It shows patterns, not proof.</p>
      ${factors.length ? `<div class="ttable"><div class="trow head"><span></span>${Object.values(MEASURES).map(M => `<span>${M.icon}</span>`).join('')}</div>
        ${factors.map(f => `<div class="trow"><span>${f.label}</span>${f.cells.map(cell).join('')}</div>`).join('')}</div>`
        : '<p class="muted">Keep checking in. Once you have a few days with and without each thing, the connections appear here.</p>'}</div>`;
}

/* ----- Settings ----- */
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; drawSheet(); });

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
  if (!isAdmin()) return `<div class="card"><h2>🔐 Admin</h2><p class="muted">Only the owner of the app can change the guides, reels and shared links.</p>
    <div class="row"><input id="adminPw" type="password" autocomplete="off" placeholder="Admin passphrase" enterkeyhint="go"><button class="fit" data-do="adminIn">Sign in</button></div></div>`;
  return `<div class="card"><h2>🔐 Admin</h2><p class="muted">You're signed in as admin on this phone.</p>
    <div class="inner">${tickRow(!!S.prefs.editMode, 'Let me change the wording in the guides', 'editMode', '')}
      <p class="muted small-text">When this is on, open a guide and tap the text to change it. <b>Publish for everyone</b> updates it for all users.</p></div>
    <button class="ghost small" data-do="adminOut">Sign out of admin</button></div>`;
}

function settingsBody() {
  const lb = S.prefs.lastBackup, ago = lb ? daysBetween(lb, today()) : null;
  return `<div class="card howto"><h2>How to use Shroom Buddies</h2><ol>
    <li><b>Swipe</b> left and right to move between pages, or tap the buttons at the bottom. 🏠 takes you home.</li>
    <li><b>Tap</b> a box to open it. <b>Press and hold</b> a list to add, change or remove things.</li>
    <li><b>Home</b>: tap Mood, Energy or Focus to fill in morning, afternoon and evening.</li>
    <li><b>🍄 Tracker</b>: tap any day to see and change it. Open <b>Your graph</b> to see how things connect.</li>
    <li><b>🎯 Intentions</b> and <b>💡 Inspiration</b>: tick things off. Ticked items are hidden on the page.</li>
    <li><b>📖 Guides</b>: guides, reels, and your useful links with notes.</li></ol>
    <p class="muted">Everything is kept only on this phone. Removed something by mistake? Tap <b>Undo</b>.</p></div>
  ${installCard()}
  <div class="card"><h2>💾 Backup</h2><p class="muted">Your data only lives on this phone. Export a backup now and then, and keep the file somewhere safe.</p>
    <p class="small-text" style="color:${ago === null || ago > 30 ? 'var(--orange)' : 'var(--muted)'}">${ago === null ? 'No backup yet.' : ago === 0 ? 'Last backup: today ✓' : `Last backup: ${plural(ago, 'day')} ago`}</p>
    <div class="row"><button data-do="exportData">Export</button><button class="ghost" data-do="importData">Import</button></div>
    <input type="file" id="importFile" accept=".json,application/json" data-change="importFile" hidden></div>
  ${adminCard()}`;
}

/* ================= 8. Guides, reels and useful links ================= */

async function loadGuides() {
  try {
    const list = await getJSON('guides/guides.json');
    ui.guides = list.length && list[0].folder ? list : [{ folder: 'Guides', icon: '📖', guides: list }];
  } catch { if (!ui.guides) ui.guides = 'offline'; }
  draw('guides'); if (ui.sheet && ui.sheet.type === 'guides') drawSheet();
}

async function openGuide(file) {
  if (ui.guideText[file] == null) {
    try { ui.guideText[file] = await getText('guides/' + file); }
    catch { toast('This guide needs the internet the first time you open it.'); ui.guide = null; }
  }
  drawSheet(true);
  $('#sheetBody').scrollTop = 0;
}

function findGuide(file) {
  if (!Array.isArray(ui.guides)) return null;
  for (let f = 0; f < ui.guides.length; f++) { const g = ui.guides[f].guides.findIndex(x => x.file === file); if (g >= 0) return { f, g }; }
  return null;
}

function guidesBody() {
  const G = ui.guides;
  if (G === null) return '<div class="card muted">Loading guides…</div>';
  if (G === 'offline') return '<div class="card muted">The guides need the internet the first time. Please connect and open this again.</div>';
  if (ui.folder === null) {
    const last = S.prefs.lastGuide && findGuide(S.prefs.lastGuide);
    return `${last ? `<button class="card tile-card" data-do="guideResume"><span class="tile-icon">🔖</span><span class="tile-main"><span class="tile-sub">Continue reading</span>
        <span class="tile-label">${esc(G[last.f].guides[last.g].title)}</span></span><span class="chev">›</span></button>` : ''}
      ${G.map((f, i) => `<button class="card tile-card" data-do="guideFolder" data-i="${i}">
        <span class="tile-icon">${esc(f.icon || '📁')}</span><span class="tile-main"><span class="tile-label">${esc(f.folder)}</span>
        <span class="tile-sub">${plural(f.guides.length, 'guide')}</span></span><span class="chev">›</span></button>`).join('')}`;
  }
  const f = G[ui.folder];
  if (ui.guide === null) {
    return `<h2>${esc(f.icon || '📁')} ${esc(f.folder)}</h2>
      ${f.guides.map((g, i) => `<button class="card tile-card guide-link" data-do="guideOpen" data-i="${i}">
        <span class="num">${i + 1}</span><span class="tile-main"><span class="tile-label">${esc(g.title)}</span></span><span class="chev">›</span></button>`).join('')}`;
  }
  const g = f.guides[ui.guide], original = ui.guideText[g.file];
  if (original == null) return '<div class="card muted">Loading…</div>';
  if (S.guideEdits[g.file] != null && S.guideEdits[g.file].trim() === original.trim()) { delete S.guideEdits[g.file]; save('guideEdits'); }
  const changed = S.guideEdits[g.file], text = changed ?? original;
  if (ui.guideEditing) {
    return `<div class="card guide-editor" data-form><h2>Change the wording</h2>
      <textarea id="gText" rows="18">${esc(text)}</textarea>
      <p class="muted small-text">A line starting with <b>#</b> is a title, <b>##</b> a heading, and <b>-</b> a bullet point. Leave an empty line between paragraphs.</p>
      <div class="row"><button class="ghost" data-do="guideCancel">Cancel</button><button data-do="guideSave">Save</button></div>
      <button class="ghost wide mt" data-do="guidePublish">🌍 Publish for everyone</button><div id="guideSteps"></div>
      ${changed != null ? '<button class="ghost small mt" data-do="guideReset">↺ Go back to the original wording</button>' : ''}</div>`;
  }
  const canEdit = isAdmin() && S.prefs.editMode, prev = f.guides[ui.guide - 1], next = f.guides[ui.guide + 1];
  return `${g.image ? `<img class="guide-pic" src="${esc(g.image)}" alt="" onerror="this.remove()">` : ''}
    ${changed != null ? '<p class="muted small-text">✏️ You changed this wording on this phone</p>' : ''}
    <div class="card guide ${canEdit ? 'editable' : ''}" ${canEdit ? 'data-do="guideEdit"' : ''}>${markdown(text)}
      ${canEdit ? '<p class="center small-text" style="color:var(--gold)">✏️ Tap the text to change it</p>' : ''}</div>
    <div class="guide-nav">${prev ? `<button class="ghost" data-do="guideStep" data-step="-1">‹ ${esc(prev.title)}</button>` : ''}
      ${next ? `<button data-do="guideStep" data-step="1">${esc(next.title)} ›</button>` : ''}</div>`;
}

async function loadShared() {
  try { ui.site = await getJSON('site.json'); } catch {}
  try { ui.reels = await getJSON('reels.json'); } catch { if (!ui.reels) ui.reels = 'offline'; }
  try { ui.sharedLinks = await getJSON('links.json'); } catch {}
  draw('guides'); if (ui.sheet && ['reels', 'links'].includes(ui.sheet.type)) drawSheet();
}

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

function reelsBody() {
  const shared = Array.isArray(ui.reels) ? ui.reels : [];
  const site = /^https:\/\//.test(ui.site.website || '') ? `<a class="btn wide" style="margin-bottom:14px" href="${esc(ui.site.website)}" target="_blank" rel="noopener">🌐 Visit our website</a>` : '';
  return `${site}
    <div class="card"><h2>🎬 Add a reel</h2>
      <p class="muted">Paste a link from Instagram, Facebook, TikTok or YouTube. It shows only on this phone.</p>
      <div class="row"><input id="reelUrl" type="url" inputmode="url" placeholder="https://www.instagram.com/reel/…">
        <button class="ghost fit" data-do="pasteInto" data-field="reelUrl" aria-label="Paste">📋</button></div>
      <input id="reelTitle" placeholder="Title (optional)" style="margin-top:8px">
      <button class="wide" data-do="reelAdd">Add reel</button>
      ${isAdmin() ? `<button class="ghost wide mt" data-do="reelShareAll">🌍 Share with everyone</button><div id="reelSteps"></div>` : ''}</div>
    ${S.myReels.length ? '<div class="sec">Your reels</div>' : ''}
    ${[...S.myReels].reverse().map(r => reelCard(r, true)).join('')}
    ${shared.length ? '<div class="sec">Shared reels</div>' : ''}
    ${shared.map(r => reelCard(r, false)).join('')}
    ${ui.reels === null ? '<div class="card muted">Loading shared reels…</div>' : ''}
    ${ui.reels !== null && !shared.length && !S.myReels.length ? '<div class="card muted">No reels yet.</div>' : ''}`;
}

/* ----- Useful Links: Material, Author / Source, Link, Notes ----- */
const okLink = url => { try { return /^https?:$/.test(new URL(url).protocol); } catch { return false; } };

function linksBody(cat) {
  const mine = S.links[cat] || [], shared = ((ui.sharedLinks || {})[cat] || []).map((x, i) => ({ ...x, id: 'shared' + i, shared: true }));
  const seen = new Set(shared.map(x => (x.material + '|' + x.url).toLowerCase()));
  const rows = [...shared, ...mine.filter(x => !seen.has((x.material + '|' + x.url).toLowerCase()))];
  const it = ui.linkEdit ? mine.find(x => x.id === ui.linkEdit) : null, open = ui.linkBar || !!it;
  return `<div class="edit-bar ${open ? '' : 'closed'}" ${open ? 'data-form' : ''}>
    ${open ? `<div class="label-small">${it ? 'Change entry' : 'Add an entry'}</div>
      <input id="lMat" placeholder="Material" value="${esc(it ? it.material : '')}">
      <input id="lAuth" placeholder="Author / Source" value="${esc(it ? it.author : '')}">
      <div class="row"><input id="lUrl" type="url" inputmode="url" placeholder="Link (https://…)" value="${esc(it ? it.url : '')}">
        <button class="ghost fit" data-do="pasteInto" data-field="lUrl" aria-label="Paste link">📋 Paste</button></div>
      <textarea id="lNotes" placeholder="Notes" style="min-height:70px;margin-top:12px">${esc(it ? it.notes : '')}</textarea>
      <div class="row"><button class="ghost" data-do="linkCancel">Cancel</button>
        ${it ? `<button class="ghost" data-do="linkDelete" data-cat="${cat}" data-id="${it.id}">🗑 Delete</button>` : ''}
        <button data-do="linkSave" data-cat="${cat}">${it ? 'Save' : '+ Add'}</button></div>`
    : '<button class="ghost wide" data-do="linkBarOpen">＋ Add an entry</button>'}</div>
    <div class="ltable">
      <div class="lrow head"><span>Material</span><span>Author / Source</span><span class="lbtn">Link</span><span class="lbtn">Notes</span></div>
      ${rows.length ? rows.map(x => `<div class="lrow" ${x.shared ? '' : `data-hold="linkEdit" data-id="${x.id}"`}>
        <span>${esc(x.material)}</span><span class="muted">${esc(x.author)}</span>
        <span class="lbtn">${okLink(x.url) ? `<a class="btn small" href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="Open link">🔗</a>` : '<span class="muted">–</span>'}</span>
        <span class="lbtn">${x.notes ? `<button class="ghost small" data-do="showNote" data-cat="${cat}" data-id="${x.id}" aria-label="Notes">📝</button>` : '<span class="muted">–</span>'}</span></div>`).join('')
      : '<p class="muted" style="padding:12px 4px">Nothing here yet. Tap ＋ Add an entry.</p>'}</div>
    ${mine.length ? holdHint('Press and hold one of your entries to change or delete it.') : ''}
    ${isAdmin() && mine.length ? `<button class="ghost wide mt" data-do="linksShareAll" data-cat="${cat}">🌍 Share this list with everyone</button><div id="linkSteps"></div>` : ''}`;
}

function publishSteps(copied, text, path, what) {
  return `<div class="steps"><p><b>${copied ? '✅ Copied.' : 'Copy the text in the box first.'}</b></p>
    <ol><li>Tap <b>Open GitHub</b> below (sign in if asked).</li><li>Tap in the text box there, select all, and paste.</li><li>Press <b>Commit changes</b>.</li></ol>
    ${copied ? '' : `<textarea rows="6" readonly>${esc(text)}</textarea>`}
    <p class="muted small-text">Everyone sees the new ${what} a minute or two later. If GitHub says the file doesn't exist, tap <b>Add file → Create new file</b>, name it <code>${esc(path)}</code> and paste.</p>
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

/* ================= 9. Button actions ================= */
// Buttons have data-do="name", ticks have data-change="name", and press-and-hold areas have data-hold="name".
// "d" is the element's data (data-id → d.id). Return true to stop the pages redrawing.

function removeWithUndo(list, id, message, onSave) {
  const i = list.findIndex(x => x.id === id); if (i < 0) return;
  const [item] = list.splice(i, 1); onSave();
  toast(message, () => { list.splice(i, 0, item); onSave(); });
}

function maybeCelebrate() {
  const P = todayProgress();
  if (P.total && P.done === P.total && S.prefs.celebrated !== today()) {
    S.prefs.celebrated = today(); save('prefs');
    setTimeout(() => { celebrate(); toast('✨ Everything done for today. Wonderful!'); buzz([20, 60, 20]); }, 250);
  }
}

const actions = {
  go: d => { if (d.day) ui.day = d.day; show(d.page); return true; },
  openDay: d => { ui.day = d.day; ui.trMonth = firstOfMonth(dateOf(d.day)); closeSheet(); show('tracker'); return true; },

  // Pop-up panels
  openSheet: (d, el) => { openSheet({ type: d.sheet, m: d.m, day: d.day, key: d.key, cat: d.cat }, el); return true; },
  closeSheet: () => { closeSheet(); return true; },
  sheetBack: () => {
    const back = ui.sheet && sheets[ui.sheet.type](ui.sheet).back;
    if (back) { actions[back](); drawSheet(true); } else closeSheet();
    return true;
  },
  showNote: d => {
    const x = (S.links[d.cat] || []).find(i => i.id === d.id) || ((ui.sharedLinks || {})[d.cat] || [])[+String(d.id).replace('shared', '')];
    if (x) openPopup('📝 Notes', `<div class="note-title">${esc(x.material)}${x.author ? ` <span class="muted">· ${esc(x.author)}</span>` : ''}</div><p class="note-text">${esc(x.notes)}</p>`);
    return true;
  },
  closePopup: () => { closePopup(); return true; },

  takeNow: (d, el) => {
    const k = today(); S.suppLog[k] = [...new Set([...(S.suppLog[k] || []), d.id])]; save('suppLog');
    sparkleFrom(el, 12, 48); buzz(); toast('💊 Taken'); maybeCelebrate();
  },

  // Check-ins (any day, any time of day)
  checkin: d => {
    const k = d.day || today(), day = S.checkins[k] = S.checkins[k] || {}, p = day[d.when] = day[d.when] || {}, v = +d.v;
    p[d.field] = p[d.field] === v ? 0 : v; save('checkins');
  },

  // Mushrooms (any day)
  trackerMonth: d => { ui.trMonth = firstOfMonth(ui.trMonth, +d.step); },
  pickDay: d => { ui.day = d.day; },
  doseMicro: d => { S.doses[d.day] = { micro: true }; save('doses'); toast('🍄 Microdose logged'); },
  doseGrams: d => {
    const g = parseFloat(document.getElementById(d.input).value);
    if (!(g > 0)) { toast('Type the grams first, for example 1.5'); return true; }
    S.doses[d.day] = { grams: +g.toFixed(2) }; save('doses'); toast(`🍄 ${+g.toFixed(2)}g logged`);
  },
  doseRepeat: d => { S.doses[d.day] = { ...S.doses[d.from] }; save('doses'); toast(`🍄 ${S.doses[d.day].grams}g logged`); },
  doseClear: d => {
    const old = S.doses[d.day]; delete S.doses[d.day]; save('doses');
    toast('Cleared', () => { S.doses[d.day] = old; save('doses'); });
  },
  toggleLog: (d, el) => {
    const set = new Set(S[d.log][d.day] || []), on = !set.has(d.id);
    on ? set.add(d.id) : set.delete(d.id); S[d.log][d.day] = [...set]; save(d.log);
    if (on) { sparkleFrom(el, 8, 40); buzz(); }
    if (d.day === today()) maybeCelebrate();
  },

  // Graph
  graphRange: d => { ui.graph.range = +d.v; },
  graphShow: d => { ui.graph.show[d.v] = !ui.graph.show[d.v]; },
  graphDay: d => { ui.graph.day = ui.graph.day === d.day ? null : d.day; },

  // Press and hold: change a list
  editList: d => { ui.editList = d.list; ui.editing = null; },
  editDone: () => { ui.editList = null; ui.editing = null; },

  // Practices
  practiceAdd: () => {
    const v = $('#newPractice').value.trim(); if (!v) return true;
    S.practices.push({ id: uid(), name: v }); save('practices'); toast(`✨ ${v} added`);
    setTimeout(() => $('#newPractice')?.focus(), 50);
  },
  practiceRemove: d => removeWithUndo(S.practices, d.id, 'Practice removed', () => save('practices')),
  practiceMove: d => {
    const i = S.practices.findIndex(p => p.id === d.id), j = i + +d.step;
    if (j < 0 || j >= S.practices.length) return true;
    [S.practices[i], S.practices[j]] = [S.practices[j], S.practices[i]]; save('practices');
  },

  // Food & Supplements
  itemNew: d => { ui.editing = { kind: d.kind, id: null }; setTimeout(() => $('#iName')?.focus(), 50); },
  itemEdit: d => { ui.editing = { kind: d.kind, id: d.id }; },
  itemCancel: () => { ui.editing = null; },
  itemRemove: d => { const L = LISTS[d.kind]; removeWithUndo(S[L.items], d.id, 'Removed', () => save(L.items)); ui.editing = null; },
  freqType: (d, el) => {
    const box = el.parentElement; box.dataset.value = d.v;
    box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
    $('#iDaysBox').classList.toggle('hidden', d.v !== 'days');
    $('#iEveryBox').classList.toggle('hidden', d.v !== 'every');
    return true;
  },
  itemSave: d => {
    const L = LISTS[d.kind], name = $('#iName').value.trim(), type = $('#iType').dataset.value;
    if (!name) { toast('Please type a name first.'); return true; }
    const days = [...document.querySelectorAll('.iDay:checked')].map(c => +c.value);
    if (type === 'days' && !days.length) { toast('Tick at least one day of the week.'); return true; }
    const every = Math.max(1, Math.min(365, parseInt($('#iEvery').value, 10) || 2));
    const list = S[L.items], old = ui.editing.id ? list.find(i => i.id === ui.editing.id) : null;
    const time = L.reminders ? ($('#iTime').value || '') : '';
    const freq = { type, days: type === 'days' ? days : [], every, start: (old && old.freq && old.freq.start) || today() };
    if (old) Object.assign(old, { name, freq, time }); else list.push({ id: uid(), name, freq, time });
    save(L.items); ui.editing = null; toast(old ? 'Saved' : `✨ ${name} added`);
  },
  calendarAlarm: d => { calendarAlarm(S.supps.find(i => i.id === d.id)); return true; },

  // Intentions and Inspiration
  collEditOn: d => {
    const key = d.key || (ui.sheet && ui.sheet.key);
    ui.editColl = key; ui.collEdit = null;
    if (!ui.sheet || ui.sheet.type !== 'collection') openSheet({ type: 'collection', key });
    else drawSheet(true);
    setTimeout(() => $('#cA')?.focus(), 350);
    return true;
  },
  collEditOff: () => { ui.editColl = null; ui.collEdit = null; },
  collEditItem: d => { ui.collEdit = d.id; setTimeout(() => $('#cA')?.focus(), 50); },
  collCancel: () => { ui.collEdit = null; },
  collSave: d => {
    const a = $('#cA').value.trim(), b = $('#cB').value.trim();
    if (!a) { toast(`Type the ${COLLECTIONS[d.key].cols[0].toLowerCase()} first.`); return true; }
    const it = ui.collEdit && S[d.key].find(i => i.id === ui.collEdit);
    if (it) Object.assign(it, { a, b }); else S[d.key].push({ id: uid(), a, b, ticked: false });
    save(d.key); ui.collEdit = null; toast(it ? 'Saved' : '✨ Added');
    setTimeout(() => $('#cA')?.focus(), 50);
  },
  collDelete: d => removeWithUndo(S[d.key], d.id, 'Deleted', () => save(d.key)),

  // Useful links
  linkBarOpen: () => { ui.linkBar = true; ui.linkEdit = null; setTimeout(() => $('#lMat')?.focus(), 50); },
  linkCancel: () => { ui.linkBar = false; ui.linkEdit = null; },
  linkEdit: d => { ui.linkEdit = d.id; ui.linkBar = true; $('#sheetBody').scrollTop = 0; },
  linkSave: d => {
    const material = $('#lMat').value.trim(), author = $('#lAuth').value.trim(), url = $('#lUrl').value.trim(), notes = $('#lNotes').value.trim();
    if (!material) { toast('Type the material first.'); return true; }
    if (url && !okLink(url)) { toast('The link should start with https://'); return true; }
    const list = S.links[d.cat] = S.links[d.cat] || [], it = ui.linkEdit && list.find(x => x.id === ui.linkEdit);
    if (it) Object.assign(it, { material, author, url, notes }); else list.push({ id: uid(), material, author, url, notes });
    save('links'); ui.linkEdit = null; ui.linkBar = false; toast(it ? 'Saved' : '✨ Added');
  },
  linkDelete: d => { removeWithUndo(S.links[d.cat], d.id, 'Deleted', () => save('links')); ui.linkEdit = null; ui.linkBar = false; },
  linksShareAll: async d => {
    const strip = x => ({ material: x.material, author: x.author, url: x.url, notes: x.notes });
    const all = { ...(ui.sharedLinks || {}) };
    all[d.cat] = [...(all[d.cat] || []), ...(S.links[d.cat] || []).map(strip)];
    const text = JSON.stringify(all, null, 2) + '\n';
    $('#linkSteps').innerHTML = publishSteps(await copyText(text), text, 'links.json', 'links');
    return true;
  },
  pasteInto: async d => {
    try { const t = (await navigator.clipboard.readText()).trim(); if (t) document.getElementById(d.field).value = t; else toast('Nothing copied yet.'); }
    catch { toast('Press and hold in the box, then tap Paste.'); }
    return true;
  },

  // Journal
  entryNew: d => {
    const k = d.date || today(), p = k === today() ? checkin(k, periodNow()) : {};
    ui.entry = { date: k, mood: p.mood || 0, energy: p.energy || 0, intention: '', text: '' };
    closeSheet(); show('journal'); setTimeout(() => $('#eText')?.focus(), 400);
    return true;
  },
  entryEdit: d => { ui.entry = { ...S.journal.find(e => e.id === d.id) }; show('journal'); return true; },
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
    save('journal'); ui.entry = null; toast('📓 Saved');
  },
  entryDelete: d => removeWithUndo(S.journal, d.id, 'Entry deleted', () => save('journal')),
  speak: (d, el) => { speakInto(el); return true; },

  // Guides
  guideFolder: d => { ui.folder = +d.i; ui.guide = null; },
  guidesHome: () => { ui.folder = null; ui.guide = null; },
  guideOpen: d => {
    ui.guide = +d.i; ui.guideEditing = false;
    const file = ui.guides[ui.folder].guides[ui.guide].file; S.prefs.lastGuide = file; save('prefs'); openGuide(file);
  },
  guideStep: d => { actions.guideOpen({ i: ui.guide + +d.step }); },
  guideResume: () => { const at = findGuide(S.prefs.lastGuide); if (at) { ui.folder = at.f; actions.guideOpen({ i: at.g }); } },
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
    S.myReels.push({ id: uid(), url, title }); save('myReels'); toast('🎬 Reel added');
  },
  reelRemove: d => removeWithUndo(S.myReels, d.id, 'Reel removed', () => save('myReels')),
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
  install: () => { if (installPrompt) { installPrompt.prompt(); installPrompt = null; } },
  adminIn: async () => {
    let site = ui.site; try { site = ui.site = await getJSON('site.json'); } catch {}
    if (!site.adminHash) { toast('Admin sign-in needs the internet, or is not set up yet.'); return true; }
    if (await sha256($('#adminPw').value) !== site.adminHash) { toast('That passphrase is not right.'); return true; }
    S.prefs.admin = true; save('prefs'); toast('🔐 Signed in as admin');
  },
  adminOut: () => { S.prefs.admin = false; S.prefs.editMode = false; save('prefs'); ui.guideEditing = false; },
  exportData: () => {
    const data = Object.fromEntries(KEYS.map(k => [k, k === 'prefs' ? { ...S.prefs, admin: false } : S[k]]));
    download(`shroom-buddies-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
    S.prefs.lastBackup = today(); save('prefs'); toast('💾 Backup saved to your downloads');
  },
  importData: () => { $('#importFile').click(); return true; },
};

const changes = {
  practice: (d, el) => {
    const k = today(), set = new Set(S.done[k] || []);
    el.checked ? set.add(d.id) : set.delete(d.id); S.done[k] = [...set]; save('done');
    if (el.checked) maybeCelebrate();
  },
  tickItem: (d, el) => {
    const L = LISTS[d.kind], k = d.day || today(), set = new Set(S[L.log][k] || []);
    el.checked ? set.add(d.id) : set.delete(d.id); S[L.log][k] = [...set]; save(L.log);
    if (el.checked && k === today()) maybeCelebrate();
  },
  collTick: (d, el) => {
    const it = S[d.key].find(i => i.id === d.id); if (!it) return true;
    it.ticked = el.checked; save(d.key);
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
    if (!Array.isArray(S.inspiration)) { S.inspiration = []; save('inspiration'); }
    toast('✨ Backup loaded'); closeSheet(); show('home');
  },
};

async function runAction(table, name, el, where) {
  const fn = table[name]; if (!fn) return;
  const stop = await fn({ ...el.dataset }, el);
  if (!stop) drawAll(where);
}

/* ================= 10. Drawing, moving between pages, and magic ================= */

const pageEl = id => document.getElementById('p-' + id);

// Keep rings gliding from their old value to the new one.
function keepRings(el, render) {
  const rings = {};
  el.querySelectorAll('.ring[data-ring]').forEach(r => { rings[r.dataset.ring] = getComputedStyle(r).getPropertyValue('--p'); });
  render();
  el.querySelectorAll('.ring[data-ring]').forEach(r => {
    const target = r.style.getPropertyValue('--p'), from = rings[r.dataset.ring] ?? 0;
    if (String(from).trim() === String(target).trim()) return;
    r.style.setProperty('--p', from);
    requestAnimationFrame(() => requestAnimationFrame(() => r.style.setProperty('--p', target)));
  });
}
const isTyping = el => el.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

// Draw one page. A page with a half-filled form, or where you're typing, is left alone unless "force" is true.
function draw(id, force = false) {
  const el = pageEl(id); if (!el || !views[id]) return;
  if (!force && (el.querySelector('[data-form]') || isTyping(el))) return;
  const y = el.scrollTop;
  keepRings(el, () => { el.innerHTML = views[id](); });
  el.scrollTop = y;
  if (id === 'journal' && ui.search) filterJournal();
}
function drawSheet(force = false) {
  const box = $('#sheet');
  if (!ui.sheet) { box.classList.remove('open'); return; }
  const body = $('#sheetBody');
  if (!force && (body.querySelector('[data-form]') || isTyping(body))) return;
  const s = sheets[ui.sheet.type](ui.sheet), y = body.scrollTop;
  $('#sheetTitle').innerHTML = s.title;
  $('#sheetBack').classList.toggle('hidden', !s.back);
  body.innerHTML = s.body;
  body.scrollTop = y;
}
// Redraw everything after a change. "from" is where the change was made (always redrawn).
function drawAll(from) {
  PAGES.forEach(p => draw(p.id, p.id === from));
  drawSheet(from === 'sheet');
}

function openSheet(s, fromEl) {
  const wasOpen = !!ui.sheet;
  ui.sheet = s;
  if (s.type === 'guides') loadGuides();
  if (s.type === 'reels' || s.type === 'links') { ui.linkBar = false; ui.linkEdit = null; loadShared(); }
  drawSheet(true);
  $('#sheetBody').scrollTop = 0;
  const box = $('#sheet');
  if (!wasOpen) {
    if (fromEl) { const r = fromEl.getBoundingClientRect(); box.style.transformOrigin = `${r.left + r.width / 2}px ${r.top + r.height / 2 - box.getBoundingClientRect().top}px`; sparkleFrom(fromEl, 10, 50); }
    box.classList.add('open');
    history.pushState({ sheet: 1 }, '');
  } else { box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap'); }
}
function closeSheet(fromBack = false) {
  if (!ui.sheet) return;
  stopSpeaking();
  ui.sheet = null; ui.editColl = null; ui.collEdit = null; ui.linkBar = false; ui.linkEdit = null;
  closePopup(true);
  $('#sheet').classList.remove('open');
  if (!fromBack && history.state && history.state.sheet) history.back();
  drawAll();
}
function openPopup(title, html) {
  ui.popup = true;
  $('#popupTitle').innerHTML = title; $('#popupBody').innerHTML = html;
  $('#popup').classList.add('open');
}
function closePopup() { ui.popup = null; $('#popup').classList.remove('open'); }

// Light up the bottom-bar button for a page (raised, with the glow sliding under it).
function markNav(id) {
  let lit = null;
  document.querySelectorAll('#nav button').forEach(b => { const on = b.dataset.go === id; b.classList.toggle('on', on); if (on) lit = b; });
  const glow = $('#navGlow');
  if (lit) { glow.style.opacity = 1; glow.style.width = (lit.offsetWidth - 6) + 'px'; glow.style.transform = `translateX(${lit.offsetLeft + 3}px)`; }
  else glow.style.opacity = 0;
  $('#homeBtn').classList.toggle('on', id === 'home');
}

function setCurrent(id) {
  const changed = ui.page !== id;
  ui.page = id;
  const i = PAGES.findIndex(p => p.id === id);
  markNav(id);
  $('#pageName').innerHTML = `<span>${PAGES[i].name}</span><span class="dots">${PAGES.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</span>`;
  if (changed && id === 'guides') { loadGuides(); loadShared(); }
}

function scrollToPage(id, smooth = true) {
  const i = PAGES.findIndex(p => p.id === id), box = $('#view');
  if (i >= 0) box.scrollTo({ left: i * box.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
}

// Open a page: cards rise in one after another.
function show(id, smooth = false) {
  if (!PAGES.some(p => p.id === id)) return;
  if (ui.sheet) closeSheet();
  const el = pageEl(id);
  draw(id, true);
  setCurrent(id);
  scrollToPage(id, smooth);
  el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
  clearTimeout(el._enter); el._enter = setTimeout(() => el.classList.remove('enter'), 900);
}

/* ----- Magic dust ----- */
const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DUST = ['#fff2c2', '#f4cf6e', '#ffb04a', '#ff8a2a', '#a68bff', '#6fe0e0'];
function sparkleAt(x, y, count = 12, spread = 60) {
  if (CALM) return;
  const fx = $('#fx');
  const ring = document.createElement('div'); ring.className = 'ripple'; ring.style.left = x + 'px'; ring.style.top = y + 'px';
  fx.appendChild(ring); ring.addEventListener('animationend', () => ring.remove());
  for (let n = 0; n < count; n++) {
    const m = document.createElement('div'), a = Math.random() * Math.PI * 2, r = spread * (.4 + Math.random() * .8);
    m.className = 'mote' + (Math.random() < .35 ? ' star' : '');
    m.style.cssText = `left:${x}px;top:${y}px;--x:${Math.cos(a) * r}px;--y:${Math.sin(a) * r - 18}px;--c:${DUST[n % DUST.length]};--t:${.6 + Math.random() * .6}s;--r:${Math.random() * 360}deg`;
    fx.appendChild(m); m.addEventListener('animationend', () => m.remove());
  }
}
function sparkleFrom(el, count, spread) { const r = el.getBoundingClientRect(); sparkleAt(r.left + r.width / 2, r.top + r.height / 2, count, spread); }
function celebrate() {
  const w = innerWidth, h = innerHeight;
  for (let n = 0; n < 6; n++) setTimeout(() => sparkleAt(w * (.15 + Math.random() * .7), h * (.2 + Math.random() * .45), 18, 110), n * 140);
}
const buzz = (pattern = 12) => { try { navigator.vibrate && navigator.vibrate(pattern); } catch {} };

/* ----- Messages (with optional Undo) ----- */
let toastTimer, toastUndo = null;
function toast(message, undo) {
  $('#toastText').textContent = message;
  toastUndo = undo || null;
  $('#toastBtn').classList.toggle('hidden', !undo);
  $('#toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').classList.remove('show'); toastUndo = null; }, undo ? 5000 : 2600);
}

/* ================= 11. Start-up ================= */

function start() {
  const view = $('#view');
  view.innerHTML = PAGES.map(p => `<section class="page fill" id="p-${p.id}" aria-label="${p.name}"></section>`).join('');

  const sizes = () => {
    document.documentElement.style.setProperty('--hdr', $('header').offsetHeight + 'px');
    document.documentElement.style.setProperty('--nav', $('#nav').offsetHeight + 'px');
  };
  sizes(); addEventListener('resize', () => { sizes(); scrollToPage(ui.page, false); markNav(ui.page); });

  // where a tap happened: a page id, or 'sheet'
  const whereOf = el => el.closest('#sheet, #popup') ? 'sheet' : el.closest('.page')?.id.slice(2);
  const app = document.body;

  // press and hold
  let hold = null, held = false;
  app.addEventListener('pointerdown', e => {
    held = false;   // a new touch: whatever happened before no longer counts
    const el = e.target.closest('[data-hold]'); if (!el || e.target.closest('input, textarea, a')) return;
    el.classList.add('holding');
    hold = { el, x: e.clientX, y: e.clientY, timer: setTimeout(() => {
      held = true; el.classList.remove('holding');
      buzz(30); sparkleAt(hold.x, hold.y, 16, 70);
      runAction(actions, el.dataset.hold, el, whereOf(el));
      hold = null;
    }, 550) };
  });
  const cancelHold = () => { if (hold) { clearTimeout(hold.timer); hold.el.classList.remove('holding'); hold = null; } };
  app.addEventListener('pointermove', e => { if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) cancelHold(); });
  app.addEventListener('pointerup', () => { cancelHold(); if (held) setTimeout(() => { held = false; }, 400); });
  app.addEventListener('pointercancel', cancelHold);
  app.addEventListener('contextmenu', e => { if (e.target.closest('[data-hold]')) e.preventDefault(); });
  // a long press shouldn't also count as a tap
  app.addEventListener('click', e => { if (held) { held = false; e.preventDefault(); e.stopPropagation(); } }, true);

  // taps and ticks
  app.addEventListener('click', e => {
    const el = e.target.closest('[data-do]'); if (!el || !el.closest('#view, #sheet, #popup')) return;
    e.preventDefault();
    if (el.closest('.scale') && !el.classList.contains('sel')) { sparkleFrom(el, 7, 34); buzz(8); }
    runAction(actions, el.dataset.do, el, whereOf(el));
  });
  app.addEventListener('change', e => {
    const el = e.target.closest('[data-change]'); if (!el) return;
    if (el.type === 'checkbox' && el.checked) { sparkleFrom(el, 12, 48); buzz(); }
    runAction(changes, el.dataset.change, el, whereOf(el));
  });
  app.addEventListener('input', e => { if (e.target.id === 'jSearch') { ui.search = e.target.value; filterJournal(); } });
  app.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const go = { newPractice: 'practiceAdd', adminPw: 'adminIn', iName: 'itemSave', cB: 'collSave' }[e.target.id];
    if (go) { e.preventDefault(); e.target.closest('.card, .inner, .edit-bar, #sheetBody').querySelector(`[data-do="${go}"]`)?.click(); }
    if (e.target.id === 'cA') { e.preventDefault(); $('#cB')?.focus(); }
  });

  $('#toastBtn').addEventListener('click', () => { if (toastUndo) { toastUndo(); toastUndo = null; drawAll(ui.sheet ? 'sheet' : ui.page); } $('#toast').classList.remove('show'); });
  $('#sheetClose').addEventListener('click', () => closeSheet());
  $('#sheetBack').addEventListener('click', () => actions.sheetBack());
  $('#popup').addEventListener('click', e => { if (e.target.id === 'popup' || e.target.closest('#popupClose')) closePopup(); });
  addEventListener('popstate', () => { if (ui.popup) closePopup(); if (ui.sheet) closeSheet(true); });

  $('#nav').addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    sparkleFrom(b, 10, 46); buzz(8);
    if (b.dataset.go === ui.page && !ui.sheet) pageEl(ui.page).scrollTo({ top: 0, behavior: 'smooth' });
    show(b.dataset.go);
  });
  $('#homeBtn').addEventListener('click', e => { sparkleFrom(e.currentTarget, 8, 36); buzz(8); show('home'); });
  $('#settingsBtn').addEventListener('click', e => { buzz(8); openSheet({ type: 'settings' }, e.currentTarget); });

  // while swiping, the matching bottom-bar button lights up and rises
  let settle, frame;
  view.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(() => {
      frame = null;
      const page = PAGES[Math.round(view.scrollLeft / view.clientWidth)];
      if (page) markNav(page.id);
    });
    clearTimeout(settle);
    settle = setTimeout(() => {
      const page = PAGES[Math.round(view.scrollLeft / view.clientWidth)];
      if (page && page.id !== ui.page) { stopSpeaking(); setCurrent(page.id); }
    }, 90);
  });

  drawAll();
  show('home');
  loadGuides(); loadShared();
  getJSON('quotes.json').then(q => { QUOTES = Array.isArray(q) ? q : []; draw('home'); }).catch(() => {});

  // keep Home fresh (morning / afternoon / evening, new day)
  setInterval(() => draw('home'), 60000);
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
