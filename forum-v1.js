/* Shroom Buddies: Message Centre (community forum)
   Loaded after app-v5.js and uses its building blocks (sheets, actions, ui, toast, esc and so on).

   - Switched off until site.json has a "firebase" section (the free Firebase project's web config).
   - Everyone signs in anonymously; only a chosen username is ever shown.
   - Posts live in Firebase (Firestore). The rules in firestore.rules decide who may do what.
*/
'use strict';

/* ================= Settings ================= */

const FB_VERSION = '10.12.2';
const FORUM_TOPICS = [
  { id: 'intro',     icon: '👋', title: 'Introductions',              about: 'Say hello and share what brought you here.' },
  { id: 'micro',     icon: '🌱', title: 'Microdosing',                about: 'Routines, protocols and what you notice.' },
  { id: 'journeys',  icon: '🌀', title: 'Experiences & Integration',  about: 'Making sense of experiences, big and small.' },
  { id: 'practices', icon: '🧘', title: 'Practices & Wellbeing',      about: 'Meditation, breathwork, movement, food, sleep.' },
  { id: 'resources', icon: '📚', title: 'Books, Films & Resources',   about: 'Recommendations and reviews.' },
  { id: 'general',   icon: '💬', title: 'General Chat',               about: 'Anything else (kindly).' },
];
// Posts that look like buying, selling or sourcing are stopped before sending (the server rules check too).
const FORUM_BLOCKED = /\b(sell|selling|seller|for sale|buy(ing)? from|vendor|plug|dm me|pm me|telegram|wickr|signal me|whatsapp me|snapchat|ship(ping)? to|price per|£\s?\d|\$\s?\d|cash app|paypal me|venmo|crypto|bitcoin)\b/i;
const FORUM_RULES = [
  'Be kind. No harassment, hate or bullying.',
  'No buying, selling, sourcing or swapping of any substance. Posts like this are removed and the username blocked.',
  'No personal information: no real names, phone numbers, emails, addresses or social media handles (yours or anyone\'s).',
  'Share experiences, not medical advice. In an emergency call 999. To talk to someone any time, call Samaritans free on 116 123.',
  'You must be 18 or over.',
];

/* ================= Saved on this phone ================= */

S.forum = store.get('forum', {});   // {name, joined, asked, follow: [threadId], seen: {threadId: ms}, lastPost: ms}
KEYS.push('forum');
const saveForum = () => save('forum');

/* ================= Connection ================= */

const F = {
  ready: null,          // promise while connecting
  db: null, auth: null, uid: null, isAdmin: false,
  view: 'home',         // home | topic | thread | compose | activity | profile | reports
  topic: null, threadId: null, thread: null, replies: [],
  list: null,           // threads shown in a list (or null while loading)
  activity: null, reports: null,
  draft: '', newTitle: '', newBody: '',
  unsub: [], unread: false, error: '', blocked: false,
};

function forumConfig() {
  const c = (ui.site || {}).firebase;
  return c && c.apiKey && c.projectId ? c : null;
}
async function forumConfigLoaded() {
  if (!forumConfig()) { try { ui.site = await getJSON('site.json'); } catch {} }
  return forumConfig();
}
function loadScript(src) {
  return new Promise((ok, fail) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s);
  });
}

// Connect to Firebase and sign in anonymously (once).
function forumConnect() {
  if (F.ready) return F.ready;
  F.ready = (async () => {
    const cfg = await forumConfigLoaded();
    if (!cfg) throw new Error('off');
    const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
    await loadScript(base + 'firebase-app-compat.js');
    await Promise.all([loadScript(base + 'firebase-auth-compat.js'), loadScript(base + 'firebase-firestore-compat.js')]);
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    F.auth = firebase.auth(); F.db = firebase.firestore();
    const user = F.auth.currentUser || await new Promise(res => { const off = F.auth.onAuthStateChanged(u => { off(); res(u); }); });
    F.uid = (user || (await F.auth.signInAnonymously()).user).uid;
    try { F.isAdmin = (await F.db.collection('admins').doc(F.uid).get()).exists; } catch { F.isAdmin = false; }
    // the username on this phone must match the server (it may have been removed by an admin)
    if (S.forum.name) {
      try {
        const me = await F.db.collection('users').doc(F.uid).get();
        if (!me.exists) { S.forum.name = ''; saveForum(); }
        else if (me.data().blocked) F.blocked = true;
      } catch {}
    }
    return F;
  })();
  F.ready.catch(() => { F.ready = null; });
  return F.ready;
}

const FV = () => firebase.firestore.FieldValue;
const tsMs = t => t && t.toMillis ? t.toMillis() : (t && t.seconds ? t.seconds * 1000 : Date.now());
function ago(t) {
  const s = Math.max(0, (Date.now() - tsMs(t)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(tsMs(t)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
const topicOf = id => FORUM_TOPICS.find(t => t.id === id) || FORUM_TOPICS[FORUM_TOPICS.length - 1];
const postText = s => esc(s).replace(/\n/g, '<br>');
function stopLive() { F.unsub.forEach(u => { try { u(); } catch {} }); F.unsub = []; }
function follow(id) {
  S.forum.follow = [...new Set([id, ...(S.forum.follow || [])])].slice(0, 60);
  saveForum();
}
function markSeen(id, ms) { S.forum.seen = S.forum.seen || {}; S.forum.seen[id] = ms || Date.now(); saveForum(); }

/* ================= Header button and "new" dot ================= */

function setForumDot(on) {
  F.unread = !!on;
  const b = $('#forumBtn'); if (b) b.classList.toggle('unread', F.unread);
}

// Look for new replies in threads you follow.
async function checkForumActivity() {
  if (!S.forum.name || !(S.forum.follow || []).length || document.hidden) return;
  try {
    await forumConnect();
    const items = await fetchFollowed();
    F.activity = items;
    setForumDot(items.some(isNew));
  } catch {}
}
const isNew = t => tsMs(t.lastAt) > ((S.forum.seen || {})[t.id] || 0) && t.lastName && t.lastName !== S.forum.name;

async function fetchFollowed() {
  const ids = (S.forum.follow || []).slice(0, 30), out = [];
  for (let i = 0; i < ids.length; i += 10) {
    const snap = await F.db.collection('threads').where(firebase.firestore.FieldPath.documentId(), 'in', ids.slice(i, i + 10)).get();
    snap.forEach(d => out.push({ id: d.id, ...d.data() }));
  }
  return out.filter(t => !t.hidden || F.isAdmin).sort((a, b) => tsMs(b.lastAt) - tsMs(a.lastAt));
}

/* ================= Joining (choose a username) ================= */

function joinHTML() {
  return `<p class="muted">Choose a username for the Shroom Buddies community. <b>Only your username is ever shown.</b> No email, name or other details are needed.</p>
    <input id="fName" placeholder="Username (3 to 20 letters, numbers or _)" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
    <div class="forum-rules"><b>Community rules</b><ol>${FORUM_RULES.map(r => `<li>${esc(r)}</li>`).join('')}</ol></div>
    <label class="check-line"><input type="checkbox" id="fAge"> I am 18 or over</label>
    <label class="check-line"><input type="checkbox" id="fRules"> I agree to the community rules</label>
    <div class="row mt"><button class="ghost" data-do="forumLater">Later</button><button data-do="forumJoin">Join</button></div>
    <p class="muted small-text mt">You can do this any time from the 💬 button at the top. Your tracker and journal stay private on your phone either way.</p>`;
}

function askToJoin() { openPopup('💬 Join the community', joinHTML()); setTimeout(() => $('#fName')?.focus(), 300); }

// First time the app is opened (once the forum is switched on): offer to choose a username.
async function maybeAskToJoin() {
  if (S.forum.name || S.forum.asked) return;
  if (!(await forumConfigLoaded())) return;
  // wait until the title slide has gone and nothing else is open
  const tryAsk = (n = 0) => {
    if (S.forum.name || S.forum.asked || n > 40) return;
    if (ui.popup || ui.sheet || document.body.classList.contains('splashing')) return setTimeout(() => tryAsk(n + 1), 1500);
    S.forum.asked = true; saveForum(); askToJoin();
  };
  setTimeout(tryAsk, 1500);
}

/* ================= Message Centre views ================= */

function forumTabs() {
  return `<div class="tabs forum-tabs">${[['home', '💬 Forum'], ['activity', `🔔 Activity${F.unread ? ' •' : ''}`], ['profile', '👤 You']].map(([v, l]) =>
    `<button class="${F.view === v || (v === 'home' && ['topic', 'thread', 'compose'].includes(F.view)) ? 'on' : ''}" data-do="forumTab" data-v="${v}">${l}</button>`).join('')}</div>`;
}
const loadingHTML = '<div class="card muted center">Loading…</div>';
const nameTag = (name, uid) => `<span class="fname ${uid && uid === F.uid ? 'me' : ''}">${esc(name || 'someone')}</span>`;

function threadRow(t) {
  const tp = topicOf(t.topic);
  return `<button class="card tile-card fthread ${isNew(t) ? 'new' : ''}" data-do="forumOpenThread" data-id="${esc(t.id)}">
    <span class="tile-main"><span class="tile-label">${t.hidden ? '🚫 ' : ''}${esc(t.title)}</span>
      <span class="tile-sub">${tp.icon} ${esc(tp.title)} · ${nameTag(t.name, t.uid)} · 💬 ${t.replyCount || 0} · ${ago(t.lastAt)}</span></span>
    ${isNew(t) ? '<span class="fnew">new</span>' : '<span class="chev">›</span>'}</button>`;
}

function forumBody() {
  if (F.error === 'off') return `<div class="card center"><h2>💬 Community coming soon</h2><p class="muted">The Message Centre isn't switched on yet.</p></div>`;
  if (F.error) return `<div class="card center"><h2>💬 Message Centre</h2><p class="muted">${esc(F.error)}</p><button class="wide mt" data-do="forumRetry">Try again</button></div>`;
  if (!F.db) return loadingHTML;
  if (!S.forum.name) return `<div class="card">${joinHTML()}</div>`;
  if (F.blocked) return `${forumTabs()}<div class="card"><p class="muted">Your username has been blocked from posting for breaking the community rules. You can still read.</p></div>${forumHome()}`;
  if (F.view === 'topic') return forumTopic();
  if (F.view === 'thread') return forumThread();
  if (F.view === 'compose') return forumCompose();
  if (F.view === 'activity') return forumTabs() + forumActivity();
  if (F.view === 'profile') return forumTabs() + forumProfile();
  if (F.view === 'reports') return forumReports();
  return forumTabs() + forumHome();
}

function forumHome() {
  return `<div class="sec">Topics</div>
    ${FORUM_TOPICS.map(t => `<button class="card tile-card" data-do="forumOpenTopic" data-id="${t.id}"><span class="tile-icon">${t.icon}</span>
      <span class="tile-main"><span class="tile-label">${t.title}</span><span class="tile-sub">${t.about}</span></span><span class="chev">›</span></button>`).join('')}
    <div class="sec">Latest</div>
    ${F.list === null ? loadingHTML : F.list.length ? F.list.map(threadRow).join('') : '<div class="card muted">No posts yet. Be the first to say hello in Introductions. 👋</div>'}`;
}

function forumTopic() {
  const t = topicOf(F.topic);
  return `<div class="label-row"><h2 style="margin:0">${t.icon} ${t.title}</h2>${F.blocked ? '' : '<button class="small fit" data-do="forumCompose">✍️ New post</button>'}</div>
    <p class="muted small-text">${t.about}</p>
    ${F.list === null ? loadingHTML : F.list.length ? F.list.map(threadRow).join('') : '<div class="card muted">Nothing here yet. Start the first conversation.</div>'}`;
}

function postActions(kind, p) {
  const mine = p.uid === F.uid, id = esc(p.id);
  return `<div class="factions">
    ${!mine ? `<button class="ghost tiny" data-do="forumReport" data-kind="${kind}" data-id="${id}">⚑ Report</button>` : ''}
    ${mine ? `<button class="ghost tiny" data-do="forumDelete" data-kind="${kind}" data-id="${id}">Delete</button>` : ''}
    ${F.isAdmin ? `<button class="ghost tiny" data-do="forumHide" data-kind="${kind}" data-id="${id}" data-on="${p.hidden ? '0' : '1'}">${p.hidden ? 'Unhide' : 'Hide'}</button>
      ${!mine ? `<button class="ghost tiny" data-do="forumBlock" data-uid="${esc(p.uid)}" data-name="${esc(p.name)}">Block user</button>` : ''}` : ''}</div>`;
}

function repliesHTML() {
  const list = F.replies.filter(r => !r.hidden || F.isAdmin);
  return list.length ? list.map(r => `<div class="fpost reply ${r.hidden ? 'hidden-post' : ''}"><div class="fmeta">${nameTag(r.name, r.uid)} · ${ago(r.created)}${r.hidden ? ' · hidden' : ''}</div>
      <div class="ftext">${postText(r.body)}</div>${postActions('reply', r)}</div>`).join('')
    : '<p class="muted small-text center">No replies yet.</p>';
}

function forumThread() {
  const t = F.thread;
  if (!t) return loadingHTML;
  if (t.gone) return '<div class="card muted">This post has been removed.</div>';
  const tp = topicOf(t.topic), following = (S.forum.follow || []).includes(t.id);
  return `<div class="card fpost op ${t.hidden ? 'hidden-post' : ''}">
      <div class="fmeta">${tp.icon} ${esc(tp.title)} · ${nameTag(t.name, t.uid)} · ${ago(t.created)}${t.hidden ? ' · hidden' : ''}</div>
      <h3>${esc(t.title)}</h3><div class="ftext">${postText(t.body)}</div>
      <div class="label-row mt">${postActions('thread', t)}<button class="ghost tiny fit" data-do="forumFollow">${following ? '🔔 Following' : '🔕 Follow'}</button></div></div>
    <div class="sec">Replies</div>
    <div id="fReplies">${repliesHTML()}</div>
    ${F.blocked ? '' : `<div class="freply-box"><textarea id="fReply" data-fkeep="draft" placeholder="Write a reply…" maxlength="4000">${esc(F.draft)}</textarea>
      <button class="wide" data-do="forumSendReply">Send</button></div>`}`;
}

function forumCompose() {
  const t = topicOf(F.topic);
  return `<div class="card" data-form><h2>✍️ New post in ${t.icon} ${t.title}</h2>
    <input id="fTitle" data-fkeep="newTitle" placeholder="Title" maxlength="120" value="${esc(F.newTitle)}">
    <textarea id="fBody" data-fkeep="newBody" placeholder="What would you like to share or ask?" maxlength="4000" style="min-height:160px">${esc(F.newBody)}</textarea>
    <p class="muted small-text">Please keep to the community rules: no buying or selling, and no personal details.</p>
    <div class="row"><button class="ghost" data-do="forumBack">Cancel</button><button data-do="forumSendThread">Post</button></div></div>`;
}

function forumActivity() {
  if (F.activity === null) return loadingHTML;
  const items = F.activity || [];
  return items.length ? `<p class="muted small-text">Posts you started, replied to or follow. <b>new</b> means someone has replied since you last looked.</p>${items.map(threadRow).join('')}`
    : '<div class="card muted">Nothing yet. Posts you start or reply to will appear here, with new replies marked.</div>';
}

function forumProfile() {
  return `<div class="card"><h2>👤 ${esc(S.forum.name)}</h2>
      <p class="muted">This username is all anyone sees. It's kept on this phone, so if you clear the app's data or change phone you'll choose a new one.</p>
      <div class="forum-rules"><b>Community rules</b><ol>${FORUM_RULES.map(r => `<li>${esc(r)}</li>`).join('')}</ol></div>
      <button class="ghost wide mt" data-do="forumLeave">Leave the community (remove my username)</button></div>
    ${F.isAdmin ? `<div class="card"><h2>🛡️ Moderator</h2><p class="muted">You can hide posts and block usernames from any post.</p>
      <button class="wide" data-do="forumOpenReports">⚑ View reports</button></div>` : ''}
    ${isAdmin() && !F.isAdmin ? `<div class="card"><h2>🛡️ Become the moderator</h2><p class="muted">Your forum ID (needed once, in Firebase):</p>
      <p class="fid">${esc(F.uid || '')}</p><button class="ghost small" data-do="forumCopyId">📋 Copy forum ID</button></div>` : ''}`;
}

function forumReports() {
  return `<h2>⚑ Reports</h2>
    ${F.reports === null ? loadingHTML : F.reports.length ? F.reports.map(r => `<div class="card"><div class="fmeta">${ago(r.created)} · ${esc(r.kind)} by ${nameTag(r.name)}</div>
      <div class="ftext">${postText(r.excerpt || '')}</div>
      <div class="factions">${r.threadId ? `<button class="ghost tiny" data-do="forumOpenThread" data-id="${esc(r.threadId)}">Open post</button>` : ''}
        <button class="ghost tiny" data-do="forumDismiss" data-id="${esc(r.id)}">Dismiss</button></div></div>`).join('')
      : '<div class="card muted">No reports. 🌿</div>'}`;
}

sheets.forum = () => ({
  title: '💬 Message Centre',
  body: forumBody(),
  back: ['topic', 'thread', 'compose', 'reports'].includes(F.view) ? 'forumBack' : null,
});

/* ================= Loading lists ================= */

async function loadLatest() {
  F.list = null; drawSheet(true);
  try {
    const snap = await F.db.collection('threads').orderBy('lastAt', 'desc').limit(25).get();
    F.list = []; snap.forEach(d => F.list.push({ id: d.id, ...d.data() }));
    F.list = F.list.filter(t => !t.hidden || F.isAdmin);
  } catch (e) { F.list = []; toast('Could not load posts. Check your internet.'); }
  if (F.view === 'home') drawSheet(true);
}

async function loadTopic(id) {
  F.list = null; drawSheet(true);
  try {
    const snap = await F.db.collection('threads').where('topic', '==', id).limit(200).get();
    F.list = []; snap.forEach(d => F.list.push({ id: d.id, ...d.data() }));
    F.list = F.list.filter(t => !t.hidden || F.isAdmin).sort((a, b) => tsMs(b.lastAt) - tsMs(a.lastAt));
  } catch { F.list = []; toast('Could not load posts. Check your internet.'); }
  if (F.view === 'topic') drawSheet(true);
}

function openThread(id) {
  stopLive();
  F.view = 'thread'; F.threadId = id; F.thread = null; F.replies = []; F.draft = '';
  drawSheet(true); $('#sheetBody').scrollTop = 0;
  const ref = F.db.collection('threads').doc(id);
  F.unsub.push(ref.onSnapshot(d => {
    if (F.threadId !== id) return;
    F.thread = d.exists ? { id: d.id, ...d.data() } : { gone: true };
    if (d.exists) markSeen(id, tsMs(F.thread.lastAt));
    const box = $('#fReplies');
    if (!box || !$('.fpost.op')) drawSheet(true);
  }, () => { F.thread = { gone: true }; drawSheet(true); }));
  F.unsub.push(ref.collection('replies').orderBy('created').limit(500).onSnapshot(snap => {
    if (F.threadId !== id) return;
    F.replies = []; snap.forEach(d => F.replies.push({ id: d.id, ...d.data() }));
    const box = $('#fReplies');
    if (box) box.innerHTML = withLogo(repliesHTML()); else drawSheet(true);
  }));
}

/* ================= Actions ================= */

const forumGuard = () => { if (F.blocked) { toast('Your username is blocked from posting.'); return false; } return true; };
function tooSoon() {
  const wait = 20000 - (Date.now() - (S.forum.lastPost || 0));
  if (wait > 0 && !F.isAdmin) { toast(`Please wait ${Math.ceil(wait / 1000)} seconds before posting again.`); return true; }
  return false;
}
function badWords(text) {
  if (FORUM_BLOCKED.test(text)) { toast('That looks like buying, selling or contact details, which the community rules don\'t allow.'); return true; }
  return false;
}

Object.assign(actions, {
  openForum: (d, el) => { openForum(el); return true; },
  forumRetry: () => { F.error = ''; F.ready = null; openForum(); return true; },
  forumLater: () => { S.forum.asked = true; saveForum(); closePopup(); if (ui.sheet && ui.sheet.type === 'forum') closeSheet(); return true; },
  forumJoin: async () => {
    const name = ($('#fName').value || '').trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) { toast('Use 3 to 20 letters, numbers or _ (no spaces).'); return true; }
    if (FORUM_BLOCKED.test(name.replace(/_/g, ' '))) { toast('Please choose a different username.'); return true; }
    if (!$('#fAge').checked) { toast('Please confirm you are 18 or over.'); return true; }
    if (!$('#fRules').checked) { toast('Please agree to the community rules.'); return true; }
    try {
      await forumConnect();
      const key = name.toLowerCase(), taken = await F.db.collection('usernames').doc(key).get();
      if (taken.exists && taken.data().uid !== F.uid) { toast('That username is taken. Please try another.'); return true; }
      const batch = F.db.batch();
      batch.set(F.db.collection('usernames').doc(key), { uid: F.uid, name, created: FV().serverTimestamp() });
      batch.set(F.db.collection('users').doc(F.uid), { name, created: FV().serverTimestamp() });
      await batch.commit();
      Object.assign(S.forum, { name, joined: today(), asked: true }); saveForum();
      closePopup(); celebrate(); toast(`✨ Welcome, ${name}!`);
      if (!ui.sheet || ui.sheet.type !== 'forum') openForum(); else { F.view = 'home'; loadLatest(); }
    } catch (e) {
      toast(e && e.message === 'off' ? 'The community isn\'t switched on yet.' : 'That username is taken or there was a problem. Please try another.');
    }
    return true;
  },
  forumTab: d => {
    stopLive(); F.view = d.v;
    if (d.v === 'home') loadLatest();
    if (d.v === 'activity') { F.activity = null; fetchFollowed().then(a => { F.activity = a; setForumDot(false); drawSheet(true); }).catch(() => { F.activity = []; drawSheet(true); }); }
    drawSheet(true); return true;
  },
  forumOpenTopic: d => { stopLive(); F.view = 'topic'; F.topic = d.id; loadTopic(d.id); return true; },
  forumOpenThread: d => { openThread(d.id); return true; },
  forumBack: () => {
    if (F.view === 'thread') { stopLive(); if (F.topic) { F.view = 'topic'; loadTopic(F.topic); } else { F.view = 'home'; loadLatest(); } }
    else if (F.view === 'compose') { F.view = 'topic'; loadTopic(F.topic); }
    else if (F.view === 'topic') { F.view = 'home'; F.topic = null; loadLatest(); }
    else if (F.view === 'reports') { F.view = 'profile'; drawSheet(true); }
    return true;
  },
  forumCompose: () => { if (!forumGuard()) return true; F.view = 'compose'; drawSheet(true); setTimeout(() => $('#fTitle')?.focus(), 100); return true; },
  forumSendThread: async () => {
    const title = $('#fTitle').value.trim(), body = $('#fBody').value.trim();
    if (!title || !body) { toast('Please add a title and a message.'); return true; }
    if (!forumGuard() || tooSoon() || badWords(title + ' ' + body)) return true;
    try {
      const now = FV().serverTimestamp();
      const ref = await F.db.collection('threads').add({ topic: F.topic, title, body, uid: F.uid, name: S.forum.name,
        created: now, lastAt: now, lastName: S.forum.name, replyCount: 0, hidden: false });
      S.forum.lastPost = Date.now(); follow(ref.id); F.newTitle = ''; F.newBody = '';
      toast('✨ Posted'); openThread(ref.id);
    } catch { toast('Could not post. Check your internet and try again.'); }
    return true;
  },
  forumSendReply: async (d, el) => {
    const body = ($('#fReply').value || '').trim();
    if (!body) return true;
    if (!forumGuard() || tooSoon() || badWords(body)) return true;
    try {
      const tRef = F.db.collection('threads').doc(F.threadId), batch = F.db.batch();
      batch.set(tRef.collection('replies').doc(), { body, uid: F.uid, name: S.forum.name, created: FV().serverTimestamp(), hidden: false });
      batch.update(tRef, { replyCount: FV().increment(1), lastAt: FV().serverTimestamp(), lastName: S.forum.name });
      await batch.commit();
      S.forum.lastPost = Date.now(); follow(F.threadId); F.draft = ''; $('#fReply').value = '';
      sparkleFrom(el, 10, 44); buzz();
    } catch { toast('Could not send. Check your internet and try again.'); }
    return true;
  },
  forumFollow: () => {
    const id = F.threadId, list = S.forum.follow || [];
    S.forum.follow = list.includes(id) ? list.filter(x => x !== id) : [id, ...list]; saveForum();
    toast(S.forum.follow.includes(id) ? '🔔 You\'ll see new replies in Activity' : 'Unfollowed');
    drawSheet(true); return true;
  },
  forumReport: async d => {
    const p = d.kind === 'thread' ? F.thread : F.replies.find(r => r.id === d.id); if (!p) return true;
    if (!confirm('Report this to the moderator?')) return true;
    try {
      await F.db.collection('reports').add({ by: F.uid, kind: d.kind, threadId: F.threadId, replyId: d.kind === 'reply' ? d.id : '',
        name: p.name || '', uid: p.uid || '', excerpt: String(p.body || '').slice(0, 300), created: FV().serverTimestamp() });
      toast('Thank you. The moderator will take a look.');
    } catch { toast('Could not send the report. Please try again.'); }
    return true;
  },
  forumDelete: async d => {
    if (!confirm('Delete your post?')) return true;
    try {
      const tRef = F.db.collection('threads').doc(F.threadId);
      if (d.kind === 'thread') { await tRef.delete(); toast('Deleted'); actions.forumBack(); }
      else { await tRef.collection('replies').doc(d.id).delete(); toast('Deleted'); }
    } catch { toast('Could not delete. Please try again.'); }
    return true;
  },
  forumHide: async d => {
    try {
      const tRef = F.db.collection('threads').doc(F.threadId), on = d.on === '1';
      await (d.kind === 'thread' ? tRef : tRef.collection('replies').doc(d.id)).update({ hidden: on });
      toast(on ? 'Hidden from everyone' : 'Visible again');
      if (d.kind === 'thread') drawSheet(true);
    } catch { toast('Could not change it. Are you set up as moderator?'); }
    return true;
  },
  forumBlock: async d => {
    if (!confirm(`Block ${d.name} from posting?`)) return true;
    try { await F.db.collection('users').doc(d.uid).update({ blocked: true }); toast(`${d.name} can no longer post`); }
    catch { toast('Could not block. Are you set up as moderator?'); }
    return true;
  },
  forumOpenReports: async () => {
    F.view = 'reports'; F.reports = null; drawSheet(true);
    try {
      const snap = await F.db.collection('reports').orderBy('created', 'desc').limit(50).get();
      F.reports = []; snap.forEach(x => F.reports.push({ id: x.id, ...x.data() }));
    } catch { F.reports = []; toast('Could not load reports.'); }
    drawSheet(true); return true;
  },
  forumDismiss: async d => {
    try { await F.db.collection('reports').doc(d.id).delete(); F.reports = F.reports.filter(r => r.id !== d.id); drawSheet(true); }
    catch { toast('Could not dismiss.'); }
    return true;
  },
  forumCopyId: async () => { toast(await copyText(F.uid) ? 'Forum ID copied' : F.uid); return true; },
  forumLeave: async () => {
    if (!confirm('Remove your username? Your posts stay, but you\'ll need to choose a new username to post again.')) return true;
    try {
      const batch = F.db.batch();
      batch.delete(F.db.collection('usernames').doc(S.forum.name.toLowerCase()));
      batch.delete(F.db.collection('users').doc(F.uid));
      await batch.commit();
    } catch {}
    S.forum.name = ''; saveForum(); F.view = 'home'; toast('You have left the community'); drawSheet(true);
    return true;
  },
});

async function openForum(fromEl) {
  F.view = F.view === 'profile' || F.view === 'activity' ? F.view : 'home';
  openSheet({ type: 'forum' }, fromEl);
  try {
    await forumConnect();
    F.error = '';
    if (!S.forum.name) { drawSheet(true); return; }
    if (F.view === 'home') loadLatest(); else actions.forumTab({ v: F.view });
  } catch (e) {
    F.error = e && e.message === 'off' ? 'off' : 'The Message Centre needs the internet. Please check your connection.';
    drawSheet(true);
  }
}

/* ================= Hooking into the app ================= */

// stop live updates when the panel closes
const closeSheetBefore = closeSheet;
closeSheet = function (fromBack) { if (ui.sheet && ui.sheet.type === 'forum') stopLive(); return closeSheetBefore(fromBack); };

// keep half-written posts while the screen redraws
document.body.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.fkeep; if (k) F[k] = e.target.value; });

document.getElementById('forumBtn')?.addEventListener('click', e => { buzz(8); sparkleFrom(e.currentTarget, 8, 36); openForum(e.currentTarget); });

// once the forum is switched on: show the button, offer to join, and check for new replies now and then
(async () => {
  const on = await forumConfigLoaded();
  document.body.classList.toggle('forum-on', !!on);
  if (!on) return;
  maybeAskToJoin();
  setTimeout(checkForumActivity, 4000);
  setInterval(checkForumActivity, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForumActivity(); });
})();
