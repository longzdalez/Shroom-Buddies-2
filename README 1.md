# 🍄 Shroom Buddies

A free app for daily check-ins, practices, a mushroom tracker, journaling, intentions, inspiration, guides, reels and useful links.

- **No app store, no accounts, no cost.** It's a web app you add to your home screen on Android or iPhone.
- **All personal data stays on each phone** (browser storage). Settings → Backup exports and imports it.
- **Works offline** after the first visit.
- Plain HTML, CSS and JavaScript only. No paid services or libraries.

## Pages (swipe left and right, or use the bottom bar; 🏠 goes home)
1. **Home**: quote, today's progress, and *How are you today?* (mood, energy and focus for morning, afternoon and evening, plus this week)
2. 🍄 **Tracker**: month calendar, everything for any day, and a full-screen graph showing how things connect
3. 🎯 **Intentions**: two-column list with tick boxes (ticked items hide on the page)
4. 🧘 **Practices**: daily checklist
5. 📓 **Journal**: mood, energy, intention and notes (type or speak)
6. 🥗 **Food & Supplements**: supplements (with how often and calendar alarms) and food
7. 💡 **Inspiration**: Material and Author / Source, with tick boxes
8. 📖 **Guides & Reels**: usage guides, reels, and Useful Links lists (Material, Author / Source, Link, Notes)

Tap a box to open it. Press and hold a list to add, change or remove things. ⚙️ opens Settings.

## Shared files the owner edits on GitHub
- `reels.json`: reels everyone sees
- `links.json`: Useful Links everyone sees (made by **Share this list with everyone** in a links list)
- `guides/`: the guides
- `quotes.json`: quote of the day
- `site.json`: website button and admin passphrase fingerprint

## Publish it (free, GitHub Pages)
1. On GitHub, open this repo → **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, **Branch** to `main`, folder `/ (root)`, and press **Save**.
3. After a minute or two the app is live at **https://longzdalez.github.io/Shroom-Buddies-2/**
4. Share that link. Anyone can then install it (see below). Nothing is paid and no app store is needed.

## How people install it
- **Android (Chrome):** open the link, tap ⋮ → **Install app** (or **Add to Home screen**).
- **iPhone (Safari):** open the link in *Safari* (not another browser), tap the Share button ⬆️ → **Add to Home Screen**.

The app also has an **📲 Install the app** card in Settings that does the same thing.

## Admin (only the owner can change guides and reels)
Changes that reach everyone are made through GitHub, and only people with write access to this repo can commit. The app's admin sign-in simply hides the editing tools from everyone else.

**One-time setup:**
1. Choose a long passphrase (at least 4 random words). Keep it private.
2. Create its fingerprint with: `printf '%s' 'shroombuddies-admin:YOUR PASSPHRASE' | sha256sum`
3. Put the 64-character code (without the trailing `-`) into `site.json` as `"adminHash"`, and commit.
4. On your phone: ⚙️ Settings → **Admin** → enter the passphrase → **Sign in**.

Admin mode is per phone and is not included in backups.

## Adding content (admin)
- **Guides:** in the app, open a guide while in admin mode, tick **Guide editing**, tap the text, then **Publish for everyone**. Or edit the `.md` files in `guides/` on GitHub.
- **New guide:** add a `.md` file to `guides/` and list it in `guides/guides.json`.
- **Reels for everyone:** on the Reels page (admin), paste a link and press **🌍 Share with everyone**, then commit `reels.json` on GitHub. Or add `{"title": "…", "url": "https://…"}` to `reels.json` directly.
- **Quotes:** edit `quotes.json`.
- **Website button:** put your address in `site.json` as `"website": "https://…"`. A "Visit our website" button then appears on the Reels page.

## Updating the app
When you change files, bump `CACHE` in `sw.js` (e.g. `sb-v23`) so phones pick up the new version.
