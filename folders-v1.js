/* Shroom Buddies: folders for Reels and for the Related Material lists.
   Loaded after app-v5.js. Only the admin can make, rename and delete folders.
   Everyone can add their own reels and entries to a folder, remove them, and move them to another folder. */
'use strict';

const DEFAULT_REEL_FOLDER = 'mushroom';
const reelFolderOf = r => r.folder || DEFAULT_REEL_FOLDER;
const linkKey = x => (String(x.material || '') + '|' + String(x.url || '')).toLowerCase();

S.reelFolders = store.get('reelFolders', null);   // [{id, name}]
S.linkFolders = store.get('linkFolders', null);   // [{id, title, icon}]
KEYS.push('reelFolders', 'linkFolders');           // include them in backups

// First time: existing reels go into "Mushroom Stuff"; the five Related Material lists become folders.
if (!Array.isArray(S.reelFolders)) { S.reelFolders = [{ id: DEFAULT_REEL_FOLDER, name: 'Mushroom Stuff' }]; save('reelFolders'); }
if (!Array.isArray(S.linkFolders)) { S.linkFolders = LINK_LISTS.map(f => ({ ...f })); save('linkFolders'); }
if (S.myReels.some(r => !r.folder)) { S.myReels.forEach(r => { if (!r.folder) r.folder = DEFAULT_REEL_FOLDER; }); save('myReels'); }

/* ----- Shared (published) data ----- */
// reels.json is either the old list of reels, or {folders: [...], reels: [{url, title, folder}]}
function sharedReels() {
  const R = ui.reels;
  const fix = list => list.filter(r => r && r.url).map(r => ({ ...r, folder: reelFolderOf(r) }));
  if (Array.isArray(R)) return { folders: null, reels: fix(R) };
  if (R && typeof R === 'object' && Array.isArray(R.reels))
    return { folders: Array.isArray(R.folders) && R.folders.length ? R.folders.filter(f => f && f.id) : null, reels: fix(R.reels) };
  return { folders: null, reels: [] };
}
const sharedLinkFolders = () => {
  const F = ui.sharedLinks && ui.sharedLinks._folders;
  return Array.isArray(F) && F.length ? F.filter(f => f && f.id) : null;
};

/* ----- Which folders this phone shows ----- */
// The admin sees their own folders. Everyone else sees the folders the admin shared
// (or the starting folders if nothing has been shared yet), plus any folder their own items are in.
function reelFolders() {
  const sh = sharedReels().folders;
  const list = (isAdmin() || !sh ? S.reelFolders : sh).map(f => ({ id: f.id, name: f.name || 'Folder' }));
  const ids = new Set(list.map(f => f.id));
  for (const r of S.myReels) {
    const id = reelFolderOf(r); if (ids.has(id)) continue;
    ids.add(id); const local = S.reelFolders.find(f => f.id === id);
    list.push({ id, name: local ? local.name : 'Other reels' });
  }
  return list;
}
function reelsIn(id) {
  const mine = S.myReels.filter(r => reelFolderOf(r) === id).map(r => ({ ...r, mine: true })).reverse();
  if (isAdmin()) return mine;
  const urls = new Set(mine.map(r => r.url));
  return [...sharedReels().reels.filter(r => r.folder === id && !urls.has(r.url)), ...mine];
}

function linkFolders() {
  const sh = sharedLinkFolders();
  const list = (isAdmin() || !sh ? S.linkFolders : sh).map(f => ({ id: f.id, title: f.title || 'Folder', icon: f.icon || '📁' }));
  const ids = new Set(list.map(f => f.id));
  for (const [id, items] of Object.entries(S.links)) {
    if (!Array.isArray(items) || !items.length || ids.has(id)) continue;
    ids.add(id); const d = S.linkFolders.find(f => f.id === id) || LINK_LISTS.find(f => f.id === id);
    list.push({ id, title: d ? d.title : 'Other', icon: d ? d.icon : '📁' });
  }
  return list;
}
function linkRows(cat) {
  const mine = S.links[cat] || [];
  if (isAdmin()) return mine;
  const shared = ((ui.sharedLinks || {})[cat] || []).map((x, i) => ({ ...x, id: 'shared' + i, shared: true }));
  const seen = new Set(shared.map(linkKey));
  return [...shared, ...mine.filter(x => !seen.has(linkKey(x)))];
}

/* ----- The admin's phone keeps the master copy ----- */
// The first time the admin opens these, anything already shared is copied onto their phone,
// so sharing again from this phone never loses anything.
function adoptShared(linksLoaded) {
  if (!isAdmin()) return false;
  let changed = false;
  if (!S.prefs.adoptReels && ui.reels && ui.reels !== 'offline') {
    const sh = sharedReels();
    for (const f of sh.folders || []) if (!S.reelFolders.some(x => x.id === f.id)) S.reelFolders.push({ id: f.id, name: f.name || 'Folder' });
    const urls = new Set(S.myReels.map(r => r.url));
    for (const r of sh.reels) if (!urls.has(r.url)) { S.myReels.push({ id: uid(), url: r.url, title: r.title || '', folder: r.folder }); urls.add(r.url); }
    for (const r of S.myReels) if (!S.reelFolders.some(f => f.id === reelFolderOf(r)))
      S.reelFolders.push({ id: reelFolderOf(r), name: reelFolderOf(r) === DEFAULT_REEL_FOLDER ? 'Mushroom Stuff' : 'Other reels' });
    S.prefs.adoptReels = true; save('myReels'); save('reelFolders'); changed = true;
  }
  if (!S.prefs.adoptLinks && linksLoaded) {
    const L = ui.sharedLinks || {};
    for (const f of sharedLinkFolders() || []) if (!S.linkFolders.some(x => x.id === f.id)) S.linkFolders.push({ id: f.id, title: f.title || 'Folder', icon: f.icon || '📁' });
    for (const [cat, list] of Object.entries(L)) {
      if (cat === '_folders' || !Array.isArray(list)) continue;
      const mine = S.links[cat] = S.links[cat] || [], seen = new Set(mine.map(linkKey));
      for (const x of list) if (x && !seen.has(linkKey(x))) { mine.push({ id: uid(), material: x.material || '', author: x.author || '', url: x.url || '', notes: x.notes || '' }); seen.add(linkKey(x)); }
      if (!S.linkFolders.some(f => f.id === cat)) { const d = LINK_LISTS.find(f => f.id === cat); S.linkFolders.push({ id: cat, title: d ? d.title : 'Other', icon: d ? d.icon : '📁' }); }
    }
    S.prefs.adoptLinks = true; save('links'); save('linkFolders'); changed = true;
  }
  if (changed) save('prefs');
  return changed;
}

const loadSharedBeforeFolders = loadShared;
loadShared = async function () {
  await loadSharedBeforeFolders();
  let linksLoaded = false;
  try { ui.sharedLinks = await getJSON('links.json'); linksLoaded = true; } catch {}
  if (adoptShared(linksLoaded)) drawAll(ui.sheet ? 'sheet' : ui.page);
};

const adminInBeforeFolders = actions.adminIn;
actions.adminIn = async (d, el) => {
  const stop = await adminInBeforeFolders(d, el);
  if (isAdmin()) loadShared();
  return stop;
};

const openSheetBeforeFolders = openSheet;
openSheet = function (s, fromEl) {
  if (s && (s.type === 'reels' || s.type === 'links')) { ui.reelFolder = null; ui.folderEdit = null; }
  return openSheetBeforeFolders(s, fromEl);
};

/* ----- Guides & Reels page ----- */
views.guides = () => {
  const G = Array.isArray(ui.guides) ? ui.guides : [];
  const count = G.reduce((n, f) => n + f.guides.length, 0);
  const rf = reelFolders(), reelCount = rf.reduce((n, f) => n + reelsIn(f.id).length, 0);
  return `<div class="heading">Usage Guides</div>
    <button class="card tile-card big-tile" data-do="openSheet" data-sheet="guides"><span class="tile-icon">📖</span>
      <span class="tile-main"><span class="tile-label">Guides</span><span class="tile-sub">${G.length ? `${G.map(f => esc(f.folder)).join(' · ')} · ${plural(count, 'guide')}` : 'Microdosing and flood doses'}</span></span><span class="chev">›</span></button>
    <button class="card tile-card big-tile" data-do="openSheet" data-sheet="reels"><span class="tile-icon">🎬</span>
      <span class="tile-main"><span class="tile-label">Reels</span><span class="tile-sub">${plural(rf.length, 'folder')}${reelCount ? ' · ' + plural(reelCount, 'reel') : ''}</span></span><span class="chev">›</span></button>
    <div class="heading">Related Material</div>
    ${linkFolders().map(l => { const n = linkRows(l.id).length; return `<button class="card tile-card" data-do="openSheet" data-sheet="links" data-cat="${esc(l.id)}"><span class="tile-icon">${esc(l.icon)}</span>
      <span class="tile-main"><span class="tile-label">${esc(l.title)}</span><span class="tile-sub">${n ? plural(n, 'entry', 'entries') : 'Tap to add'}</span></span><span class="chev">›</span></button>`; }).join('')}
    ${isAdmin() ? '<button class="ghost wide mt" data-do="linkFolderNew">📁 New folder</button>' : ''}`;
};

/* ----- Reels ----- */
sheets.reels = () => {
  const f = ui.reelFolder != null ? reelFolders().find(x => x.id === ui.reelFolder) : null;
  if (!f) ui.reelFolder = null;
  return { title: f ? `🎬 ${esc(f.name)}` : '🎬 Reels', body: f ? reelFolderBody(f) : reelHomeBody(), back: f ? 'reelsHome' : null };
};

function reelHomeBody() {
  const site = /^https:\/\//.test(ui.site.website || '') ? `<a class="btn wide" style="margin-bottom:14px" href="${esc(ui.site.website)}" target="_blank" rel="noopener">🌐 Visit our website</a>` : '';
  const folders = reelFolders();
  return `${site}
    ${ui.reels === null ? '<div class="card muted">Loading shared reels…</div>' : ''}
    ${folders.map(f => { const n = reelsIn(f.id).length; return `<button class="card tile-card" data-do="reelFolderOpen" data-id="${esc(f.id)}"><span class="tile-icon">📁</span>
      <span class="tile-main"><span class="tile-label">${esc(f.name)}</span><span class="tile-sub">${n ? plural(n, 'reel') : 'Empty'}</span></span><span class="chev">›</span></button>`; }).join('')
      || '<div class="card muted">No folders yet.</div>'}
    ${isAdmin() ? `<div class="card"><h2>📁 New folder</h2>
        <p class="muted">Only you can make folders. Everyone sees them once you share your reels.</p>
        <div class="row"><input id="rfName" placeholder="Folder name" maxlength="40" enterkeyhint="done"><button class="fit" data-do="reelFolderAdd">＋ Add</button></div></div>
      <button class="ghost wide" data-do="reelShareAll">🌍 Share reels with everyone</button><div id="reelSteps"></div>`
    : '<p class="hold-hint">Open a folder to watch its reels or add your own.</p>'}`;
}

function reelFolderBody(f) {
  const list = reelsIn(f.id), folders = reelFolders(), admin = isAdmin();
  const tools = !admin ? '' : ui.folderEdit === 'reel:' + f.id
    ? `<div class="card" data-form><h2>✏️ Rename folder</h2><input id="rfRename" value="${esc(f.name)}" maxlength="40">
        <div class="row mt"><button class="ghost" data-do="folderEditCancel">Cancel</button><button data-do="reelFolderRename" data-id="${esc(f.id)}">Save</button></div></div>`
    : `<div class="row folder-tools"><button class="ghost small" data-do="folderEditOpen" data-key="reel:${esc(f.id)}">✏️ Rename</button>
        <button class="ghost small" data-do="reelFolderDelete" data-id="${esc(f.id)}">🗑 Delete folder</button></div>`;
  return `${tools}
    <div class="card"><h2>🎬 Add a reel</h2>
      <p class="muted">Paste a link from Instagram, Facebook, TikTok or YouTube.${admin ? ' To show it to everyone, tap Share reels with everyone on the Reels page.' : ' It shows only on this phone.'}</p>
      <div class="row"><input id="reelUrl" type="url" inputmode="url" placeholder="https://www.instagram.com/reel/…">
        <button class="ghost fit" data-do="pasteInto" data-field="reelUrl" aria-label="Paste">📋</button></div>
      <input id="reelTitle" placeholder="Title (optional)" style="margin-top:8px">
      <button class="wide" data-do="reelAdd" data-folder="${esc(f.id)}">Add reel</button></div>
    ${list.length ? list.map(r => folderReelCard(r, folders)).join('') : '<div class="card muted">No reels in this folder yet.</div>'}`;
}

function folderReelCard(r, folders) {
  const info = reelInfo(r.url); if (!info) return '';
  const url = esc(r.url);
  const preview = info.embed
    ? `<div class="reel-frame ${info.tall ? 'tall' : ''}"><iframe src="${esc(info.embed)}" loading="lazy" allowfullscreen title="${esc(r.title || info.site)}"
        allow="autoplay; encrypted-media; picture-in-picture; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    : info.thumb ? `<a class="reel-thumb" href="${url}" target="_blank" rel="noopener"><img src="${esc(info.thumb)}" alt="" loading="lazy"><span>▶</span></a>` : '';
  const move = r.mine && folders.length > 1
    ? `<label class="move-line"><span>📁 Folder</span><select data-change="reelMove" data-id="${esc(r.id)}" aria-label="Move to another folder">
        ${folders.map(f => `<option value="${esc(f.id)}" ${f.id === reelFolderOf(r) ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>` : '';
  return `<div class="card reel">${r.title ? `<h2>${esc(r.title)}</h2>` : ''}${preview}
    <div class="row mt"><a class="btn" href="${url}" target="_blank" rel="noopener">${info.icon} Watch on ${esc(info.site)}</a>
      <button class="ghost small fit" data-do="reelShare" data-url="${url}" aria-label="Share">📤</button>
      ${r.mine ? `<button class="ghost small fit" data-do="reelRemove" data-id="${esc(r.id)}" aria-label="Remove">✕</button>` : ''}</div>${move}</div>`;
}

Object.assign(actions, {
  reelFolderOpen: d => { ui.reelFolder = d.id; ui.folderEdit = null; $('#sheetBody').scrollTop = 0; },
  reelsHome: () => { ui.reelFolder = null; ui.folderEdit = null; },
  folderEditOpen: d => { ui.folderEdit = d.key; setTimeout(() => ($('#rfRename') || $('#lfRename'))?.focus(), 50); },
  folderEditCancel: () => { ui.folderEdit = null; },

  reelAdd: d => {
    const url = $('#reelUrl').value.trim(), title = $('#reelTitle').value.trim();
    if (!reelInfo(url)) { toast('Please paste a full link starting with https://'); return true; }
    const folder = d.folder || ui.reelFolder || (reelFolders()[0] || {}).id || DEFAULT_REEL_FOLDER;
    S.myReels.push({ id: uid(), url, title, folder }); save('myReels'); toast('🎬 Reel added');
  },
  reelFolderAdd: () => {
    if (!isAdmin()) return true;
    const name = $('#rfName').value.trim();
    if (!name) { toast('Type a name for the folder first.'); return true; }
    if (S.reelFolders.some(f => f.name.toLowerCase() === name.toLowerCase())) { toast('There is already a folder with that name.'); return true; }
    S.reelFolders.push({ id: 'rf' + uid(), name }); save('reelFolders'); toast('📁 Folder made');
  },
  reelFolderRename: d => {
    const name = $('#rfRename').value.trim(), f = S.reelFolders.find(x => x.id === d.id);
    if (!isAdmin() || !f) return true;
    if (!name) { toast('Type a name for the folder first.'); return true; }
    f.name = name; save('reelFolders'); ui.folderEdit = null; toast('Renamed');
  },
  reelFolderDelete: d => {
    if (!isAdmin()) return true;
    if (S.myReels.some(r => reelFolderOf(r) === d.id)) { toast('Move or remove the reels in this folder first.'); return true; }
    const i = S.reelFolders.findIndex(f => f.id === d.id); if (i < 0) return true;
    const [f] = S.reelFolders.splice(i, 1); save('reelFolders'); ui.reelFolder = null;
    toast('Folder deleted', () => { S.reelFolders.splice(i, 0, f); save('reelFolders'); });
  },
  reelShareAll: async () => {
    if (!isAdmin()) return true;
    const data = {
      folders: S.reelFolders.map(f => ({ id: f.id, name: f.name })),
      reels: S.myReels.filter(r => reelInfo(r.url)).map(r => ({ ...(r.title ? { title: r.title } : {}), url: r.url, folder: reelFolderOf(r) })),
    };
    const text = JSON.stringify(data, null, 2) + '\n';
    $('#reelSteps').innerHTML = publishSteps(await copyText(text), text, 'reels.json', 'reels');
    return true;
  },
});

changes.reelMove = (d, el) => {
  const r = S.myReels.find(x => x.id === d.id); if (!r) return true;
  r.folder = el.value; save('myReels');
  const f = reelFolders().find(x => x.id === el.value);
  toast(`Moved to ${f ? f.name : 'another folder'}`);
};

/* ----- Related Material folders ----- */
sheets.links = s => {
  const f = linkFolders().find(x => x.id === s.cat) || { id: s.cat, title: 'Related Material', icon: '📁' };
  return { title: `${esc(f.icon)} ${esc(f.title)}`, body: linksBody(s.cat) };
};

linksBody = function (cat) {
  const mine = S.links[cat] || [], rows = linkRows(cat), folders = linkFolders(), admin = isAdmin();
  const it = ui.linkEdit ? mine.find(x => x.id === ui.linkEdit) : null, open = ui.linkBar || !!it;
  const f = folders.find(x => x.id === cat) || { title: 'Related Material', icon: '📁' };
  const tools = !admin ? '' : ui.folderEdit === 'link:' + cat
    ? `<div class="card" data-form><h2>✏️ Rename folder</h2>
        <div class="row"><input id="lfRenameIcon" value="${esc(f.icon)}" maxlength="8" aria-label="Icon" style="flex:0 0 64px;text-align:center">
          <input id="lfRename" value="${esc(f.title)}" maxlength="40" aria-label="Folder name"></div>
        <div class="row mt"><button class="ghost" data-do="folderEditCancel">Cancel</button><button data-do="linkFolderRename" data-cat="${esc(cat)}">Save</button></div></div>`
    : `<div class="row folder-tools"><button class="ghost small" data-do="folderEditOpen" data-key="link:${esc(cat)}">✏️ Rename</button>
        <button class="ghost small" data-do="linkFolderDelete" data-cat="${esc(cat)}">🗑 Delete folder</button></div>`;
  const moveTo = it && folders.length > 1
    ? `<label class="move-line"><span>📁 Folder</span><select id="lFolder" aria-label="Folder">
        ${folders.map(x => `<option value="${esc(x.id)}" ${x.id === cat ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></label>` : '';
  return `${tools}<div class="edit-bar ${open ? '' : 'closed'}" ${open ? 'data-form' : ''}>
    ${open ? `<div class="label-small">${it ? 'Change entry' : 'Add an entry'}</div>
      <input id="lMat" placeholder="Material" value="${esc(it ? it.material : '')}">
      <input id="lAuth" placeholder="Author / Source" value="${esc(it ? it.author : '')}">
      <div class="row"><input id="lUrl" type="url" inputmode="url" placeholder="Link (https://…)" value="${esc(it ? it.url : '')}">
        <button class="ghost fit" data-do="pasteInto" data-field="lUrl" aria-label="Paste link">📋 Paste</button></div>
      <textarea id="lNotes" placeholder="Notes" style="min-height:70px;margin-top:12px">${esc(it ? it.notes : '')}</textarea>
      ${moveTo}
      ${it && inLiterature(it.material) ? '' : `<label class="check-line"><input type="checkbox" id="lLit"> Also add to 💡 Literature & Related Material</label>`}
      <div class="row"><button class="ghost" data-do="linkCancel">Cancel</button>
        ${it ? `<button class="ghost" data-do="linkDelete" data-cat="${esc(cat)}" data-id="${esc(it.id)}">🗑 Delete</button>` : ''}
        <button data-do="linkSave" data-cat="${esc(cat)}">${it ? 'Save' : '+ Add'}</button></div>`
    : '<button class="ghost wide" data-do="linkBarOpen">＋ Add an entry</button>'}</div>
    <div class="ltable">
      <div class="lrow head"><span>Material</span><span>Author / Source</span><span class="lbtn">Link</span><span class="lbtn">Notes</span><span class="lbtn" title="Add to Literature & Related Material">💡</span></div>
      ${rows.length ? rows.map(x => `<div class="lrow" ${x.shared ? '' : `data-hold="linkEdit" data-id="${esc(x.id)}"`}>
        <span>${esc(x.material)}</span><span class="muted">${esc(x.author)}</span>
        <span class="lbtn">${okLink(x.url) ? `<a class="btn small" href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="Open link">🔗</a>` : '<span class="muted">–</span>'}</span>
        <span class="lbtn">${x.notes ? `<button class="ghost small" data-do="showNote" data-cat="${esc(cat)}" data-id="${esc(x.id)}" aria-label="Notes">📝</button>` : '<span class="muted">–</span>'}</span>
        <span class="lbtn">${inLiterature(x.material) ? '<span class="added" title="In Literature & Related Material">✓</span>' : `<button class="ghost small" data-do="linkToLit" data-cat="${esc(cat)}" data-id="${esc(x.id)}" aria-label="Add to Literature & Related Material">💡</button>`}</span></div>`).join('')
      : '<p class="muted" style="padding:12px 4px">Nothing here yet. Tap ＋ Add an entry.</p>'}</div>
    ${rows.length ? `<p class="hold-hint">💡 adds an entry to Literature & Related Material${mine.length ? '. Press and hold one of your entries to change it, delete it or move it to another folder.' : '.'}</p>` : ''}
    ${admin ? `<button class="ghost wide mt" data-do="linksShareAll">🌍 Share Related Material with everyone</button><div id="linkSteps"></div>` : ''}`;
};

Object.assign(actions, {
  linkSave: d => {
    const material = $('#lMat').value.trim(), author = $('#lAuth').value.trim(), url = $('#lUrl').value.trim(), notes = $('#lNotes').value.trim();
    if (!material) { toast('Type the material first.'); return true; }
    if (url && !okLink(url)) { toast('The link should start with https://'); return true; }
    const list = S.links[d.cat] = S.links[d.cat] || [], it = ui.linkEdit && list.find(x => x.id === ui.linkEdit);
    const dest = $('#lFolder') ? $('#lFolder').value : d.cat;
    let moved = null;
    if (it) {
      Object.assign(it, { material, author, url, notes });
      if (dest && dest !== d.cat) {
        list.splice(list.indexOf(it), 1); (S.links[dest] = S.links[dest] || []).push(it);
        moved = (linkFolders().find(f => f.id === dest) || { title: 'another folder' }).title;
      }
    } else list.push({ id: uid(), material, author, url, notes });
    const lit = $('#lLit') && $('#lLit').checked && addToLiterature({ material, author, url });
    save('links'); ui.linkEdit = null; ui.linkBar = false;
    toast(moved ? `Moved to ${moved}` : lit ? '✨ Added here and to Literature & Related Material' : it ? 'Saved' : '✨ Added');
  },
  linkFolderNew: () => {
    if (!isAdmin()) return true;
    openPopup('📁 New folder', `<p class="muted">A new list for Related Material. Everyone sees it once you share.</p>
      <div class="row"><input id="lfNewIcon" placeholder="📁" maxlength="8" aria-label="Icon (optional)" style="flex:0 0 64px;text-align:center">
        <input id="lfNewName" placeholder="Folder name" maxlength="40" aria-label="Folder name"></div>
      <div class="row mt"><button class="ghost" data-do="closePopup">Cancel</button><button data-do="linkFolderAdd">＋ Add folder</button></div>`);
    setTimeout(() => $('#lfNewName')?.focus(), 50);
    return true;
  },
  linkFolderAdd: () => {
    if (!isAdmin()) return true;
    const title = $('#lfNewName').value.trim(), icon = $('#lfNewIcon').value.trim() || '📁';
    if (!title) { toast('Type a name for the folder first.'); return true; }
    if (S.linkFolders.some(f => f.title.toLowerCase() === title.toLowerCase())) { toast('There is already a folder with that name.'); return true; }
    S.linkFolders.push({ id: 'lf' + uid(), title, icon }); save('linkFolders');
    closePopup(); toast('📁 Folder made');
  },
  linkFolderRename: d => {
    const f = S.linkFolders.find(x => x.id === d.cat), title = $('#lfRename').value.trim(), icon = $('#lfRenameIcon').value.trim() || '📁';
    if (!isAdmin() || !f) return true;
    if (!title) { toast('Type a name for the folder first.'); return true; }
    Object.assign(f, { title, icon }); save('linkFolders'); ui.folderEdit = null; toast('Renamed');
  },
  linkFolderDelete: d => {
    if (!isAdmin()) return true;
    if ((S.links[d.cat] || []).length) { toast('Move or delete the entries in this folder first.'); return true; }
    const i = S.linkFolders.findIndex(f => f.id === d.cat); if (i < 0) return true;
    const [f] = S.linkFolders.splice(i, 1); save('linkFolders'); delete S.links[d.cat]; save('links');
    closeSheet();
    toast('Folder deleted', () => { S.linkFolders.splice(i, 0, f); save('linkFolders'); });
  },
  linksShareAll: async () => {
    if (!isAdmin()) return true;
    const strip = x => ({ material: x.material, author: x.author, url: x.url, notes: x.notes });
    const all = { _folders: S.linkFolders.map(f => ({ id: f.id, title: f.title, icon: f.icon || '📁' })) };
    for (const f of S.linkFolders) all[f.id] = (S.links[f.id] || []).map(strip);
    const text = JSON.stringify(all, null, 2) + '\n';
    $('#linkSteps').innerHTML = publishSteps(await copyText(text), text, 'links.json', 'Related Material');
    return true;
  },
});

/* ----- Styles ----- */
document.head.insertAdjacentHTML('beforeend', `<style>
  .folder-tools { gap: 8px; margin: 0 0 12px; }
  .folder-tools button { flex: 1; }
  .move-line { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: .9rem; color: var(--muted, #b9c3dd); }
  .move-line span { flex: 0 0 auto; }
  .move-line select { flex: 1; min-width: 0; margin: 0; }
</style>`);
