// ============================================================
//  Netflix Ratings Overlay — content.js v3
//  Triggered on full detail modal open (jbv URL param)
//  Pill injected inside modal, in the circled empty space
// ============================================================

// OMDB_KEY is injected from config.js (loaded before this script in manifest.json)
// Copy config.example.js → config.js and add your key there

let lastJbv       = null;   // tracks the open modal's jbv ID
let currentPill   = null;   // the injected pill element
let lastTitle     = null;   // last fetched title (for cache key)
const cache       = new Map();

// ─── SELECTORS ───────────────────────────────────────────────

const MODAL_SEL = [
  '.previewModal--container',
  '.preview-modal-container',
  '[data-uia="previewModal-container"]',
].join(', ');

// Sections that contain thumbnails / episode cards — NOT the title treatment
const EXCLUDE_SEL = [
  '.previewModal--morelikethis',
  '[data-uia="previewModal-morelikeThis"]',
  '.episodeList',
  '.episodesContainer',
  '.episodeInfo',
  '.previewModal--episodeSelector',
  '.titleCard',
  '.previewModal--tabs',
  '.previewModal--slider',
].join(', ');

// ─── TITLE EXTRACTION ────────────────────────────────────────
//
//  THE FIX for "More Like This" / "Episodes" appearing as title:
//  We grab the FIRST img[alt] in the modal that is NOT nested
//  inside a More Like This or episodes section.
//  Netflix's title treatment image is always near the top of
//  the modal DOM, well before any of those sections.

function extractTitle(modal) {
  // Strategy 1: first image with alt text, outside excluded sections
  for (const img of modal.querySelectorAll('img[alt]')) {
    const alt = img.alt?.trim();
    if (!alt || alt.length < 2 || alt.length > 100)  continue; // too short / too long
    if (/^netflix$/i.test(alt))                        continue; // Netflix logo
    if (img.closest(EXCLUDE_SEL))                     continue; // in a thumbnail grid
    console.log('[NR] Title from img alt:', alt);
    return alt;
  }

  // Strategy 2: .fallback-text ONLY inside the title-treatment wrapper
  const titleWrappers = [
    '.previewModal--player-titleTreatmentWrapper',
    '[data-uia="previewModal--titleTreatment"]',
    '.previewModal--playerContainer',
  ];
  for (const sel of titleWrappers) {
    const wrapper = modal.querySelector(sel);
    if (!wrapper) continue;
    const fb = wrapper.querySelector('.fallback-text');
    const txt = fb?.textContent?.trim();
    if (txt) { console.log('[NR] Title from fallback-text:', txt); return txt; }
  }

  console.warn('[NR] Could not extract title — inspect modal DOM with DevTools.');
  return null;
}

// ─── OMDB API ────────────────────────────────────────────────

async function omdb(params) {
  const r = await fetch(`https://www.omdbapi.com/?${params}&apikey=${OMDB_KEY}`);
  return r.json();
}

async function getRatings(title) {
  if (cache.has(title)) return cache.get(title);

  // 1. Exact title match
  let data = await omdb(`t=${encodeURIComponent(title)}`);

  // 2. Strip subtitle after colon ("Squid Game: The Challenge" → "Squid Game")
  if (data.Response !== 'True') {
    const noColon = title.replace(/\s*:.*$/, '').trim();
    if (noColon && noColon !== title) data = await omdb(`t=${encodeURIComponent(noColon)}`);
  }

  // 3. OMDB search → take top result
  if (data.Response !== 'True') {
    const s = await omdb(`s=${encodeURIComponent(title)}`);
    if (s.Response === 'True' && s.Search?.length) {
      data = await omdb(`i=${s.Search[0].imdbID}`);
    }
  }

  cache.set(title, data);
  return data;
}

// ─── PILL ────────────────────────────────────────────────────

const esc = s => {
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
};

function makePill(title) {
  const p = document.createElement('div');
  p.id = 'nr-pill';
  p.innerHTML = `
    <span class="nr-pname">${esc(title)}</span>
    <span class="nr-pdot">·</span>
    <span class="nr-pscore">⭐ …</span>
    <span class="nr-pdot">·</span>
    <span class="nr-pscore">🍅 …</span>
  `;
  return p;
}

function fillPill(pill, imdb, rt) {
  const scores = pill.querySelectorAll('.nr-pscore');
  if (scores[0]) scores[0].textContent = `⭐ ${imdb}`;
  if (scores[1]) scores[1].textContent = `🍅 ${rt}`;
  pill.classList.remove('nr-loading');
}

function removePill() {
  document.getElementById('nr-pill')?.remove();
  currentPill = null;
}

// ─── INJECTION ───────────────────────────────────────────────
//
//  We want to inject the pill BETWEEN the action buttons row
//  (Play, +, thumbs) and the metadata row (year, runtime, HD).
//  That's the circled empty space in the screenshot.
//
//  Best target: prepend to .previewModal--info (the info section
//  that starts right after the video player area).

function inject(modal, title) {
  removePill(); // clear any stale pill first
  if (document.getElementById('nr-pill')) return currentPill; // already there

  const pill = makePill(title);
  pill.classList.add('nr-loading');

  // Try to prepend to the info section
  const infoSelectors = [
    '.previewModal--info',
    '.previewModal--detailsAndSynopsis',
    '[data-uia="previewModal--info"]',
  ];

  let injected = false;
  for (const sel of infoSelectors) {
    const info = modal.querySelector(sel);
    if (info) {
      info.prepend(pill);
      injected = true;
      console.log('[NR] Pill injected into:', sel);
      break;
    }
  }

  if (!injected) {
    // Fallback: inject after the play button's parent row
    const playBtn = modal.querySelector(
      'a[href*="/watch/"], .playLink, [data-uia="play-button"], button.color-primary'
    );
    const row = playBtn?.parentElement;
    if (row) {
      row.after(pill);
      injected = true;
      console.log('[NR] Pill injected after play button row');
    }
  }

  if (!injected) {
    modal.appendChild(pill);
    console.log('[NR] Pill appended to modal (fallback)');
  }

  currentPill = pill;
  return pill;
}

// ─── MAIN FLOW ───────────────────────────────────────────────

async function handleModalOpen() {
  const modal = document.querySelector(MODAL_SEL);
  if (!modal) { console.warn('[NR] Modal not found in DOM'); return; }

  const title = extractTitle(modal);
  if (!title) return;

  if (title === lastTitle && currentPill) return; // same modal still open
  lastTitle = title;

  const pill = inject(modal, title);
  if (!pill) return;

  try {
    const data = await getRatings(title);
    if (data.Response === 'True') {
      const imdb = data.imdbRating ?? 'N/A';
      const rt   = data.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value ?? 'N/A';
      fillPill(pill, imdb, rt);
    } else {
      fillPill(pill, 'N/A', 'N/A');
    }
  } catch (e) {
    console.error('[NR] Fetch error:', e);
    fillPill(pill, '—', '—');
  }
}

// ─── URL STATE ───────────────────────────────────────────────
//
//  Netflix adds ?jbv=<id> to the URL when the full detail
//  modal is open. Watching this is the cleanest trigger.

function checkUrl() {
  if (location.pathname.startsWith('/watch/')) {
    // User started watching — remove pill
    removePill();
    lastJbv   = null;
    lastTitle = null;
    return;
  }

  const jbv = new URLSearchParams(location.search).get('jbv');

  if (jbv !== lastJbv) {
    lastJbv = jbv;
    if (jbv) {
      // Modal just opened — give React 700ms to render content
      setTimeout(handleModalOpen, 700);
    } else {
      // Modal closed
      removePill();
      lastTitle = null;
    }
  }
}

// Hook into SPA navigation
const _push = history.pushState.bind(history);
history.pushState = (...a) => { _push(...a); checkUrl(); };
window.addEventListener('popstate', checkUrl);

// Fallback poll for navigation that bypasses pushState
setInterval(checkUrl, 800);

// ─── MUTATION OBSERVER (backup) ──────────────────────────────
//
//  Some Netflix navigation doesn't trigger pushState.
//  This catches those by watching for modal add/remove.

const observer = new MutationObserver(mutations => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.matches?.(MODAL_SEL) || node.querySelector?.(MODAL_SEL)) {
        if (!currentPill) setTimeout(handleModalOpen, 700);
        return;
      }
    }
    for (const node of m.removedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.matches?.(MODAL_SEL) || node.querySelector?.(MODAL_SEL)) {
        removePill();
        lastJbv   = null;
        lastTitle = null;
        return;
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// ─── KEYBOARD ────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { removePill(); lastJbv = null; lastTitle = null; }
});

console.log('[NR] Netflix Ratings v3 ✅  (full-modal mode)');
