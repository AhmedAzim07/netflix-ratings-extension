# Netflix Ratings Overlay

A Chrome extension that injects IMDb and Rotten Tomatoes scores directly into the Netflix detail modal — no tab-switching, no searching.

![Version](https://img.shields.io/badge/version-3.0-red) ![Manifest](https://img.shields.io/badge/manifest-v3-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## What it does

When you click on any title on Netflix to open the detail panel, a translucent pill badge appears between the action buttons and the metadata row showing:

```
Title Name · ⭐ 8.4 · 🍅 89%
```

The pill disappears automatically when you close the modal, start watching, or press Escape.

---

## Setup

### 1. Get a free OMDB API key

Go to [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) and register for a free key (1,000 requests/day, no credit card needed).

### 2. Clone the repo

```bash
git clone https://github.com/AhmedAzim07/netflix-ratings-overlay.git
cd netflix-ratings-overlay
```

### 3. Add your API key

```bash
cp config.example.js config.js
```

Open `config.js` and replace `YOUR_OMDB_KEY_HERE` with your actual key:

```js
const OMDB_KEY = "your_key_here";
```

`config.js` is gitignored — your key never leaves your machine.

### 4. Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `netflix-ratings-overlay` folder

Done. Open Netflix and click any title.

---

## How it works

| Step | What happens |
|------|-------------|
| You click a title | Netflix adds `?jbv=<id>` to the URL |
| Extension detects the URL change | Waits 700ms for React to render the modal |
| Title extraction | Grabs the first `img[alt]` in the modal **outside** the More Like This / episode sections — this is always the title treatment image |
| OMDB lookup | Tries exact match → strips subtitle → search fallback |
| Pill injection | Prepended to `.previewModal--info`, between action buttons and metadata |
| Cleanup | Removed on modal close, `/watch/` navigation, or Escape |

### Why `img[alt]` and not `.fallback-text`?

Netflix renders title logos as images (e.g. the stylised "WAR DOGS" graphic). These images always have an `alt` attribute set for accessibility — that's the plain text title. The `.fallback-text` selector is tempting but it also exists on thumbnail cards inside "More Like This" and episode lists, causing it to return "Episodes" or "More Like This" as the title. The image approach avoids all of that.

---

## File structure

```
netflix-ratings-overlay/
├── manifest.json        # Extension config (MV3)
├── content.js           # Core logic — detection, extraction, ratings, UI
├── styles.css           # Pill styles (translucent, injected into modal)
├── config.js            # Your OMDB key — gitignored, never committed
├── config.example.js    # Template to copy for setup
├── .gitignore
└── README.md
```

---

## Debugging

Open DevTools on Netflix (`F12`) and check the console for `[NR]` logs:

```
[NR] Title from img alt: War Dogs
[NR] Pill injected into: .previewModal--info
```

If the title isn't being picked up, Netflix may have updated their class names. Inspect the modal element, find the title treatment image, and update the `EXCLUDE_SEL` list in `content.js` if needed.

---

## Limitations

- OMDB free tier: 1,000 requests/day. Results are cached per session so repeated hovers don't re-fetch.
- Netflix titles that don't exist in OMDB (originals with different naming, some international content) will show N/A.
- Netflix updates their DOM structure periodically. If the pill stops appearing, check the `[NR]` console logs.

---

## Tech

- Chrome Extensions Manifest V3
- Vanilla JS — no build step, no dependencies
- OMDB API for ratings data
- MutationObserver + History API for SPA navigation detection

---

## License

MIT
