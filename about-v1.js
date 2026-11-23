/* Shroom Buddies: "About & legal" folders in Settings (AI Handiwork, Waiver, Privacy).
   Loaded after app-v5.js. Adds a card to the end of Settings. */
'use strict';

const ABOUT_UPDATED = '22 November 2026';
const ABOUT = [
  { id: 'ai', icon: '🤝', tab: 'AI Handiwork', html: `
    <h3>Human wisdom, AI handiwork</h3>
    <p>Shroom Buddies is a human project. Every guide, practice, idea and recommendation in this app comes from the Shroom Buddies team: our own knowledge, research and lived experience.</p>
    <p>We used AI (Claude, made by Anthropic) as <b>skilled labour</b>. It wrote the code, laid out the screens and tidied the wording, always working from our instructions, and we checked the results.</p>
    <p>Think of it like hiring a builder: the plans, the materials and the vision are ours. The AI did the building.</p>
    <div class="about-split">
      <div><b>What AI did</b><ul><li>Writing the app's code</li><li>Design, layout and animation</li><li>Tidying and proofreading wording</li></ul></div>
      <div><b>What AI did not do</b><ul><li>Decide what goes in the guides</li><li>Provide the experience or knowledge behind them</li><li>Give medical or legal advice</li></ul></div>
    </div>
    <p class="muted small-text">AI can make mistakes, and so can people. If you spot something wrong, please let us know.</p>` },

  { id: 'waiver', icon: '📜', tab: 'Waiver', html: `
    <h3>Shroom Buddies waiver and disclaimer</h3>
    <p class="muted small-text">Please read this carefully. By using Shroom Buddies, including its guides, tools and community, you agree to it.</p>
    <h4>1. Information and harm reduction only</h4>
    <p>Everything in this app is shared for education, harm reduction and personal reflection. It is not medical, psychological or legal advice, and it is not a substitute for advice from a qualified professional.</p>
    <h4>2. Our position on psychedelics and the law</h4>
    <p>We believe psychedelic substances, including psilocybin mushrooms, have real potential as medicine. We support their responsible medicinal use and the research and clinical work that makes that possible.</p>
    <p><b>We do not encourage or condone breaking the law.</b> Psilocybin mushrooms are a controlled substance in the UK and in many other countries. You alone are responsible for knowing and following the laws where you live. Before acting on anything you read here, please get appropriate medical and legal advice.</p>
    <h4>3. Your health comes first</h4>
    <p>Speak to a doctor or other qualified health professional before using any psychedelic or herbal substance, especially if you:</p>
    <ul><li>take any medication (for example antidepressants, lithium, or heart or blood pressure medicines)</li>
      <li>have, or have a family history of, psychosis, schizophrenia or bipolar disorder</li>
      <li>have a heart condition or high blood pressure</li>
      <li>are pregnant or breastfeeding</li></ul>
    <h4>4. Understanding the risks</h4>
    <p>Natural does not mean safe. Psychedelic and herbal substances affect everyone differently and can cause strong psychological and physical effects, including anxiety, panic, confusion, paranoia, distressing experiences, risky behaviour and, rarely, longer-lasting difficulties. Wild mushrooms can be misidentified, and some look-alikes are deadly poisonous. Products are unregulated and their strength and purity can vary.</p>
    <p>If you choose to use any substance, you do so voluntarily and at your own risk. Never drive or operate machinery under the influence, avoid mixing substances, and have a trusted, sober person with you.</p>
    <h4>5. No guarantees</h4>
    <p>We work hard to keep our information accurate and up to date, but we make no promises that it is complete, correct or suitable for you. Research and laws change.</p>
    <h4>6. Limitation of liability</h4>
    <p>To the fullest extent permitted by law, Shroom Buddies, its creators and contributors are not responsible for any injury, illness, loss, damage, negative effects or legal consequences arising from the use of any substance, or from acting on any information in this app or its community. Nothing in this waiver limits any liability that cannot be limited by law.</p>
    <h4>7. Community posts</h4>
    <p>Posts in the Message Centre are the views of the people who write them, not of Shroom Buddies. Please never share personal details, and report anything that breaks the community rules.</p>
    <h4>8. Age</h4>
    <p>Shroom Buddies is for adults aged 18 and over.</p>
    <h4>In an emergency</h4>
    <p>Call <b>999</b> (or your local emergency number). For urgent medical advice in the UK call <b>111</b>. To talk to someone any time, call Samaritans free on <b>116 123</b>.</p>` },

  { id: 'privacy', icon: '🔒', tab: 'Privacy', html: `
    <h3>Your privacy</h3>
    <h4>Your tracker, journal and lists</h4>
    <p>Everything you enter (check-ins, mushroom days, practices, journal, food, supplements, intentions and lists) is stored <b>only on your phone</b>. It is never sent to us or anyone else. Backups are files you save and control.</p>
    <h4>The Message Centre</h4>
    <p>If you join the community, your username and your posts are stored on Google Firebase so other members can read them. You are signed in with an anonymous ID. We never ask for your email, name or phone number. You can leave at any time from Message Centre → You.</p>
    <h4>Other services</h4>
    <p>Guides and shared content load from GitHub. Reels you watch are shown by Instagram, Facebook, TikTok or YouTube, which may use their own cookies. Links open other websites with their own privacy policies.</p>` },
];

ui.aboutTab = ui.aboutTab || 'ai';

function aboutCard() {
  const cur = ABOUT.find(a => a.id === ui.aboutTab) || ABOUT[0];
  return `<div class="card about-card"><h2>📖 About & legal</h2>
    <div class="folder-tabs">${ABOUT.map(a => `<button class="${a.id === cur.id ? 'on' : ''}" data-do="aboutTab" data-v="${a.id}">${a.icon} ${a.tab}</button>`).join('')}</div>
    <div class="folder-body">${cur.html}<p class="muted small-text about-date">Last updated ${ABOUT_UPDATED}</p></div></div>`;
}

// add the card to the end of Settings
const settingsBodyBeforeAbout = settingsBody;
settingsBody = function () { return settingsBodyBeforeAbout() + aboutCard(); };

actions.aboutTab = (d, el) => {
  ui.aboutTab = d.v;
  const card = el.closest('.about-card');
  if (card) { card.outerHTML = aboutCard(); return true; }
};

/* ----- Share the app (top of Settings) ----- */
const SHARE_URL = 'https://longzdalez.github.io/Shroom-Buddies-2/';
const SHARE_TEXT = 'Shroom Buddies: a free app for microdosing check-ins, a tracker, journal, practices and guides. Everything stays private on your own phone. Open the link, then add it to your home screen:';

function shareCard() {
  return `<div class="card share-card"><h2>💌 Share Shroom Buddies</h2>
    <p class="muted">Send the app to a friend. They get their own fresh copy. None of your entries are shared.</p>
    <button class="wide" data-do="shareApp">📤 Share the app</button>
    <button class="ghost wide mt" data-do="copyAppLink">🔗 Copy link</button></div>`;
}

const settingsBodyBeforeShare = settingsBody;
settingsBody = function () { return shareCard() + settingsBodyBeforeShare(); };

actions.shareApp = async (d, el) => {
  if (navigator.share) {
    try { await navigator.share({ title: 'Shroom Buddies', text: SHARE_TEXT, url: SHARE_URL }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  return actions.copyAppLink(d, el);
};

actions.copyAppLink = async (d, el) => {
  const ok = await copyText(SHARE_TEXT + ' ' + SHARE_URL);
  toast(ok ? 'Link copied. Paste it into a message.' : SHARE_URL);
  if (ok && el) sparkleFrom(el, 14, 50);
};
