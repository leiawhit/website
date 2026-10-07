// Project details: the slide-up panel on the home page and the YouTube player
// (used by index.html and the project pages).

// --- Video: show a thumbnail, and only load YouTube when someone presses play.
// Closing the panel puts the thumbnail and play button back, so the video can be played again.
document.querySelectorAll('.video-lite').forEach((box) => {
  const thumbnail = [...box.childNodes];
  box.resetVideo = () => { if (box.querySelector('iframe')) box.replaceChildren(...thumbnail); };
  box.querySelector('.video-play').addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${box.dataset.youtube}?autoplay=1&rel=0`;
    iframe.title = box.dataset.title;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    box.replaceChildren(iframe);
    iframe.focus();
  });
});

// --- Game: "Expand game" makes the frame fullscreen, or fills the window where fullscreen
// isn't available (iPhone). The game inside rescales itself to the new size.
function setGameExpanded(frame, expand) {
  const button = frame.querySelector('.game-expand');
  frame.classList.toggle('is-expanded', expand);
  button.setAttribute('aria-pressed', String(expand));
  button.querySelector('.game-expand-label').textContent = expand ? 'Exit full screen' : 'Expand game';
  if (expand && frame.requestFullscreen) {
    frame.requestFullscreen().catch(() => {}); // refused: the CSS fallback still fills the window
  } else if (!expand && document.fullscreenElement === frame) {
    document.exitFullscreen().catch(() => {});
  }
  frame.querySelector('iframe').focus();
}

const GAME_PAGES = { 'index.html': 'menu', 'game.html': 'game', 'tutorial.html': 'tutorial' };

document.querySelectorAll('.game-frame').forEach((frame) => {
  frame.querySelector('.game-expand').addEventListener('click', () => {
    setGameExpanded(frame, !frame.classList.contains('is-expanded'));
  });
  // Back: the game moves between its own pages (menu → game → tutorial). Keep our own list of
  // them so Back only ever steps back inside the game, never takes the site itself back a page.
  const iframe = frame.querySelector('iframe');
  const back = frame.querySelector('.game-back');
  let visited = [];
  let goingBack = false;
  back.addEventListener('click', () => {
    if (visited.length < 2) return;
    visited.pop();
    goingBack = true;
    iframe.contentWindow.location.replace(visited[visited.length - 1]); // replace: no extra history
    iframe.focus();
  });

  iframe.addEventListener('load', () => {
    let page;
    try { page = iframe.contentWindow.location.href; } catch { page = null; }
    if (!page || page === 'about:blank') {
      visited = []; // panel closed: start over next time
    } else if (goingBack) {
      goingBack = false;
    } else if (visited[visited.length - 1] !== page) {
      visited.push(page);
    }
    back.disabled = visited.length < 2;
    // The button just says "Back" (kept short so it stays clear of the board); the tooltip and
    // screen readers say where it goes, e.g. "Back to menu"
    const target = visited.length > 1 ? visited[visited.length - 2].split('/').pop().split(/[?#]/)[0] : '';
    back.title = `Back to ${GAME_PAGES[target] || 'previous screen'}`;
    back.setAttribute('aria-label', back.title);
    if (!page || page === 'about:blank') return;
    // While playing, key presses go to the game itself, so listen there for Esc too
    iframe.contentWindow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && frame.classList.contains('is-expanded')) setGameExpanded(frame, false);
    });
  });
});

// Leaving fullscreen with Esc or the browser's own controls shrinks the frame back
document.addEventListener('fullscreenchange', () => {
  document.querySelectorAll('.game-frame.is-expanded').forEach((frame) => {
    if (document.fullscreenElement !== frame && frame.dataset.wasFullscreen) setGameExpanded(frame, false);
    if (document.fullscreenElement === frame) frame.dataset.wasFullscreen = '1';
    else delete frame.dataset.wasFullscreen;
  });
});

// --- Panel: slides up over the page; the page behind is blurred (::backdrop in styles.css).
const reduceMotionPanel = matchMedia('(prefers-reduced-motion: reduce)');

function setPanelOpen(isOpen) {
  document.documentElement.classList.toggle('panel-open', isOpen);
  if (window.lenis) isOpen ? window.lenis.stop() : window.lenis.start();
  document.dispatchEvent(new CustomEvent('panelchange', { detail: { open: isOpen } }));
}

function openProject(id) {
  const panel = document.getElementById(`panel-${id}`);
  if (!panel || panel.open) return;
  panel.classList.remove('is-closing'); // never reopen in a half-closed state
  panel.querySelector('.panel-scroll').scrollTop = 0;
  // Embedded games only load once their panel is opened
  panel.querySelectorAll('iframe[data-src]').forEach((f) => { f.src = f.dataset.src; });
  panel.showModal();
  // Park focus on the panel itself (not next to the X) so no focus line or text cursor shows
  panel.tabIndex = -1;
  panel.focus({ preventScroll: true });
  setPanelOpen(true);
}

// Tidy up whenever a panel ends up closed, however that happened (our close, a double Esc
// forcing the browser to close it, or leaving the page mid-animation). Without this an
// invisible half-closed panel could stay on top and block every click.
function resetPanel(panel) {
  panel.classList.remove('is-closing');
  if (panel.open) panel.close();
  if (!document.querySelector('.project-panel[open]')) setPanelOpen(false);
  panel.querySelectorAll('.video-lite').forEach((box) => box.resetVideo());
  panel.querySelectorAll('iframe[data-src]').forEach((f) => { f.src = 'about:blank'; });
  panel.querySelectorAll('.game-frame.is-expanded').forEach((frame) => setGameExpanded(frame, false));
  panel.querySelectorAll('video').forEach((v) => v.pause());
}

function closePanel(panel) {
  if (!panel.open || panel.classList.contains('is-closing')) return;
  if (reduceMotionPanel.matches) { resetPanel(panel); return; }
  panel.classList.add('is-closing');
  const done = (e) => {
    if (e && e.target !== panel) return; // ignore animations of things inside the panel
    panel.removeEventListener('animationend', done);
    clearTimeout(fallback);
    resetPanel(panel);
  };
  const fallback = setTimeout(done, 600); // in case the animation never reports finishing
  panel.addEventListener('animationend', done);
}

document.querySelectorAll('.project-panel').forEach((panel) => {
  panel.querySelector('.panel-close').addEventListener('click', () => closePanel(panel));
  panel.addEventListener('cancel', (e) => { // Esc
    e.preventDefault();
    const expanded = panel.querySelector('.game-frame.is-expanded');
    if (expanded) setGameExpanded(expanded, false); // shrink the game first
    else closePanel(panel);
  });
  panel.addEventListener('click', (e) => { if (e.target === panel) closePanel(panel); }); // click on the blur
  panel.addEventListener('close', () => resetPanel(panel)); // the browser closed it for us
});

// Coming back with the browser's Back button can restore a frozen copy of the page with a
// panel still open; start clean instead.
addEventListener('pageshow', (e) => {
  if (e.persisted) document.querySelectorAll('.project-panel').forEach(resetPanel);
});

document.querySelectorAll('[data-open]').forEach((button) => {
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    openProject(button.dataset.open);
  });
});

window.openProject = openProject;

// Opening the home page with #open=<project> (e.g. from a project page) shows that project's panel
const openMatch = location.hash.match(/^#open=([\w-]+)$/);
if (openMatch && document.getElementById(`panel-${openMatch[1]}`)) {
  document.getElementById('projects')?.scrollIntoView();
  history.replaceState(null, '', `${location.pathname}#projects`);
  openProject(openMatch[1]);
}
