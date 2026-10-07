// Smooth scrolling (Lenis), the bubble-blowing About sun, and the looping, auto-playing projects carousel.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const mod = (a, n) => ((a % n) + n) % n;

// --- Smooth scroll. Lenis also handles the nav's #about / #projects / #contact links.
// Slightly heavier than the default so a big flick doesn't fly through whole sections.
const lenis = !reduceMotion.matches && 'Lenis' in window
  ? new Lenis({ autoRaf: true, anchors: true, lerp: 0.08, wheelMultiplier: 0.8, touchMultiplier: 1.2 })
  : null;
window.lenis = lenis; // project.js pauses it while a project panel is open

// --- Cover: as you scroll away, the tiles and circles float up faster than the page and
// turn slightly, each at its own speed (styles.css reads --scroll, --speed and --spin).
const cover = document.querySelector('.page');
cover.querySelectorAll('.piece').forEach((piece, i) => {
  piece.style.setProperty('--speed', (0.25 + ((i * 7) % 5) * 0.12).toFixed(2));            // 0.25–0.73
  piece.style.setProperty('--spin', ((i % 2 ? 1 : -1) * (0.012 + ((i * 3) % 4) * 0.006)).toFixed(3)); // ±0.012–0.03°/px
});

function updateCover() {
  if (reduceMotion.matches) return;
  cover.style.setProperty('--scroll', Math.min(scrollY, cover.offsetHeight * 1.5).toFixed(1));
}
addEventListener('scroll', updateCover, { passive: true });
updateCover();

// --- About: --p goes 0 → 1 from when the section enters the screen to when its pinned stage
// is released. The sun inflates like a bubble: it starts as a small orange dot in the middle
// of the screen, swells past full size, wobbles (squash and stretch) and settles.
const about = document.querySelector('.about');
const sunCanvas = about.querySelector('.sun-canvas');
const SUN_CENTRE_Y = 879; // design units: the sun's centre when fully grown

function updateAbout() {
  let p = 1;
  if (!reduceMotion.matches) {
    const { top, height } = about.getBoundingClientRect();
    p = Math.min(1, Math.max(0, (innerHeight - top) / height));
  }
  about.style.setProperty('--p', p.toFixed(4));

  // Inflate while the stage is pinned (p ≈ 0.3 → 0.75)
  const t = Math.min(1, Math.max(0, (p - 0.3) / 0.45));
  const c1 = 1.9;                                              // overshoot (ease-out-back)
  const grow = 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  const size = 0.03 + 0.97 * grow;
  const wobble = Math.sin(t * Math.PI * 4) * (1 - t) * 0.09;   // dies away as it settles

  // Start centred on the screen, drift down to its final spot as it grows
  const a = sunCanvas.offsetWidth / 1280;
  const startY = (sunCanvas.offsetHeight - innerHeight / 2) / a;
  const rise = 1 - (1 - t) ** 3;
  about.style.setProperty('--ty', ((1 - rise) * (startY - SUN_CENTRE_Y)).toFixed(1));
  about.style.setProperty('--sx', (size * (1 + wobble)).toFixed(4));
  about.style.setProperty('--sy', (size * (1 - wobble)).toFixed(4));
}

addEventListener('scroll', updateAbout, { passive: true });
addEventListener('resize', updateAbout);
updateAbout();

// --- Projects carousel -------------------------------------------------------------
// The current project is a full card; the rest are small thumbnails either side.
// It loops forever: `current` just keeps counting, and positions wrap round.
const CARD_W = 405;        // card width (px, before --cs scaling)
const CARD_H = 574;        // card height plus room for tilt and shadow
const IMG_W = 357;         // image width inside the card
const THUMB = 0.68;        // size of the thumbnails next to the current card…
const SHRINK = 0.85;      // …each one further out is this much smaller again
const GAP = 26;            // space between the big card and thumbnails, and between thumbnails
const MAX_SCALE = 1.6;     // how much bigger than the Figma card it can grow
const AUTOPLAY_MS = 2000;  // move on every 2 seconds…
const FAV_MS = 3500;       // …but linger on the favourite projects

const carousel = document.querySelector('.carousel');
const viewport = carousel.querySelector('.carousel-viewport');
const track = carousel.querySelector('.cards');
const dotsBox = carousel.querySelector('.carousel-dots');
const statusEl = carousel.querySelector('.carousel-status');
const headingBox = document.querySelector('.projects-inner');
const projects = [...track.children];
const N = projects.length;

// Copy the set twice so a card wrapping from one end to the other always jumps off-screen.
for (let copy = 1; copy < 3; copy++) {
  projects.forEach((card) => {
    const clone = card.cloneNode(true);
    // Hidden from screen readers and the Tab key, but still clickable with a mouse or finger
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a, button').forEach((el) => { el.tabIndex = -1; });
    track.append(clone);
  });
}
const items = [...track.children];
const M = items.length;
const lastOffset = new Array(M).fill(null);
let current = 0;

// Dots, one per project, plus a pause / play button
const dots = projects.map((card, i) => {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.className = 'carousel-dot';
  dot.style.setProperty('--c', ['var(--green)', 'var(--pink)', 'var(--blue)', 'var(--yellow)', 'var(--orange)'][i % 5]);
  dot.style.setProperty('--tilt', `${[12, -9, 20, -15, 6][i % 5]}deg`);
  dot.setAttribute('aria-label', `Project ${i + 1} of ${N}`);
  dot.addEventListener('click', () => goToProject(i));
  dotsBox.append(dot);
  return dot;
});
const toggle = document.createElement('button');
toggle.type = 'button';
toggle.className = 'carousel-toggle';
dotsBox.append(toggle);

// Playful, fixed tilt and bob for each thumbnail (stays with the card as it moves)
const tilt = (j) => ((j * 37) % 9) - 4;          // -4…4 degrees
const bob = (j) => (((j * 53) % 5) - 2) * 7;     // -14…14 px

function render(dragPx = 0) {
  // As big as fits, up to 1.6× the Figma card: the Projects heading, the carousel and its
  // dots should all be on screen together (the skills strip above is its own section).
  const reserved = headingBox.offsetHeight + dotsBox.offsetHeight + 56;
  const cs = Math.max(0.5, Math.min(MAX_SCALE, (viewport.clientWidth - 32) / CARD_W, (innerHeight - reserved) / CARD_H));
  carousel.style.setProperty('--cs', cs.toFixed(4));
  const centre = viewport.clientWidth / 2 / cs + dragPx / cs;

  items.forEach((item, j) => {
    let d = mod(j - current, M);   // how many places from the current card
    if (d >= M / 2) d -= M;
    const n = Math.abs(d);

    // Thumbnails shrink the further out they are; x is the centre of each one.
    let x = 0;
    let scale = 1;
    if (n > 0) {
      x = CARD_W / 2 + GAP;
      for (let k = 1; k <= n; k++) {
        scale = THUMB * SHRINK ** (k - 1);
        x += k === n ? (IMG_W * scale) / 2 : IMG_W * scale + GAP;
      }
      x *= Math.sign(d);
    }

    // Cards that wrap round the loop (or follow a drag) move instantly instead of sliding across.
    const wrapped = lastOffset[j] !== null && Math.abs(d - lastOffset[j]) > 1;
    item.style.transition = wrapped || dragPx ? 'none' : '';
    item.style.transform = n === 0
      ? `translateX(${centre - CARD_W / 2}px)`
      : `translate(${centre + x - CARD_W / 2}px, ${bob(j)}px) rotate(${tilt(j)}deg) scale(${scale})`;
    item.classList.toggle('is-active', n === 0);
    lastOffset[j] = d;
  });

  const index = mod(current, N);
  dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
}

function go(step) {
  if (!step) return;
  current += step;
  render();
  const index = mod(current, N);
  statusEl.textContent = `Project ${index + 1} of ${N}: ${projects[index].querySelector('.card-title').textContent}`;
  restartAutoplay();
}

// Take the shortest way round the loop to project i
function goToProject(i) {
  let step = mod(i - current, N);
  if (step > N / 2) step -= N;
  go(step);
}

// --- Autoplay: next project every 2 s whenever the carousel is on screen. It only pauses
// mid-drag, when the tab is hidden, or with the pause button (and starts paused for
// reduced-motion users).
// The current dot (a star) spins to show the time left.
let userPaused = reduceMotion.matches;
let dragging = false;
let onScreen = false;
let timer = null;
const slideTime = () => (projects[mod(current, N)].classList.contains('is-fav') ? FAV_MS : AUTOPLAY_MS);
let remaining = slideTime();
carousel.style.setProperty('--autoplay', `${remaining}ms`);
let startedAt = 0;

let panelOpen = false;
const canPlay = () => !userPaused && !dragging && !panelOpen && onScreen && !document.hidden;

function updateAutoplay() {
  const play = canPlay();
  carousel.classList.toggle('is-autoplay', !userPaused);
  carousel.classList.toggle('is-paused', !play);
  toggle.setAttribute('aria-label', userPaused ? 'Play slideshow' : 'Pause slideshow');
  toggle.dataset.state = userPaused ? 'paused' : 'playing';
  if (play && !timer) {
    startedAt = performance.now();
    timer = setTimeout(() => { timer = null; go(1); }, remaining);
  } else if (!play && timer) {
    clearTimeout(timer);
    timer = null;
    remaining = Math.max(0, remaining - (performance.now() - startedAt));
  }
}

function restartAutoplay() {
  clearTimeout(timer);
  timer = null;
  remaining = slideTime();
  carousel.style.setProperty('--autoplay', `${remaining}ms`);
  // Restart the star's spin
  carousel.classList.remove('is-autoplay');
  void carousel.offsetWidth;
  updateAutoplay();
}

toggle.addEventListener('click', () => {
  userPaused = !userPaused;
  restartAutoplay();
});
document.addEventListener('visibilitychange', updateAutoplay);
document.addEventListener('panelchange', (e) => { panelOpen = e.detail.open; updateAutoplay(); });
new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; updateAutoplay(); }, { threshold: 0.3 }).observe(viewport);

// --- Swipe (touch) and drag (mouse)
let dragStartX = null;
let dragDx = 0;
let pressedCard = null; // the card under the pointer when it went down

viewport.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  dragStartX = e.clientX;
  dragDx = 0;
  // Remember the card now, so autoplay sliding mid-click can't swap it for another
  pressedCard = e.target.closest('.cards > .card');
  dragging = true; // hold autoplay still while pressed
  updateAutoplay();
  viewport.setPointerCapture(e.pointerId);
});
viewport.addEventListener('pointermove', (e) => {
  if (dragStartX === null) return;
  dragDx = e.clientX - dragStartX;
  if (Math.abs(dragDx) > 8) {
    if (!dragging) { dragging = true; updateAutoplay(); }
    viewport.classList.add('is-dragging');
    render(dragDx * 0.6);
  }
});
function endDrag(e) {
  if (dragStartX === null) return;
  viewport.classList.remove('is-dragging');
  const dx = dragDx;
  dragStartX = null;
  dragging = false;
  if (Math.abs(dx) > 40) {
    go(dx < 0 ? 1 : -1);
  } else if (Math.abs(dx) <= 8 && e.type === 'pointerup') {
    // A tap on a thumbnail jumps to it; a tap on the current card opens its project
    const card = pressedCard;
    if (card && !card.classList.contains('is-active')) go(lastOffset[items.indexOf(card)]);
    else {
      render();
      updateAutoplay();
      if (card) openCurrentProject();
    }
  } else {
    render();
    updateAutoplay();
  }
}
viewport.addEventListener('pointerup', endDrag);
viewport.addEventListener('pointercancel', endDrag);
// If the browser drops the pointer (e.g. the page lost focus mid-press), never stay stuck mid-drag
viewport.addEventListener('lostpointercapture', () => {
  if (dragStartX === null) return;
  dragStartX = null;
  dragging = false;
  viewport.classList.remove('is-dragging');
  render();
  updateAutoplay();
});

// --- Trackpad / horizontal wheel: one card per swipe gesture
let wheelSum = 0;
let wheelLocked = false;
viewport.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical: let the page scroll
  e.preventDefault();
  if (wheelLocked) return;
  wheelSum += e.deltaX;
  if (Math.abs(wheelSum) > 50) {
    go(wheelSum > 0 ? 1 : -1);
    wheelSum = 0;
    wheelLocked = true;
    setTimeout(() => { wheelLocked = false; }, 450);
  }
}, { passive: false });

// --- Keyboard
// Left / right arrows move the carousel whenever it's on screen (no need to click it first),
// unless a project panel is open or someone is typing.
addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  if (!onScreen || panelOpen || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
  e.preventDefault();
  go(e.key === 'ArrowRight' ? 1 : -1);
});
carousel.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target === carousel) { e.preventDefault(); openCurrentProject(); }
});

// Open the panel for the project in the middle (if it has one)
function openCurrentProject() {
  const id = projects[mod(current, N)].dataset.project;
  if (id && window.openProject) window.openProject(id);
}

addEventListener('resize', () => render());
render();
updateAutoplay();
