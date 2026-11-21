# 🍄 Shroom Buddies

A free app for daily check-ins, practices, a mushroom tracker, journaling, intentions, inspiration, guides, reels and useful links.

- **No app store, no accounts, no cost.** It's a web app you add to your home screen on Android or iPhone.
- **All personal data stays on each phone** (browser storage). Settings → Backup exports and imports it.
- **Works offline** after the first visit.
- Plain HTML, CSS and JavaScript only. No paid services or libraries.

## Pages (swipe left and right, or use the bottom bar; the golden house at the top goes home)
1. **Home**: quote, today's progress, and *How are you today?* (mood, energy and focus for morning, afternoon and evening, plus this week)
2. 🍄 **Tracker**: month calendar and mushroom logging for any day, all on one screen
3. 📈 **Graph**: your daily average (mood, energy and focus) over 1 week to 3 months, with the separate lines, day details, best time of day and how things connect
4. 🎯 **Intentions**: two-column list with tick boxes (ticked items hide on the page)
5. 🧘 **Practices**: daily checklist
6. 📓 **Journal**: mood, energy, intention and notes (type or speak)
7. 🥗 **Food & Supplements**: supplements (with how often and calendar alarms) and food
8. 💡 **Literature & Related Material**: Material and Author / Source, with tick boxes
9. 📖 **Guides & Reels**: usage guides, reels, and Related Material lists (Material, Author / Source, Link, Notes; 💡 adds an entry to Literature & Related Material)

Tap a box to open it. Press and hold a list to add, change or remove things. ⚙️ opens Settings.

## Shared files the owner edits on GitHub
- `reels.json`: reels everyone sees
- `links.json`: Related Material everyone sees (made by **Share this list with everyone** in a links list)
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
When you change files, bump `CACHE` in `sw.js` (e.g. `sb-v26`) so phones pick up the new version.

The main code is in `app-v5.js`; the styles are `style-v3.css` plus `style-v5-extra.css`. For a big update, give them a new number (for example `app-v6.js`), change the two names in `index.html` and `sw.js`, and delete the old ones. New names mean phone downloads never clash with older copies.
