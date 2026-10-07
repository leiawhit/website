// Project details: the slide-up panel on the home page and the YouTube player
// (used by index.html and the project pages).

// --- Video: show a thumbnail, and only load YouTube when someone presses play.
document.querySelectorAll('.video-lite').forEach((box) => {
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
  panel.querySelectorAll('.video-lite iframe').forEach((f) => { f.src = 'about:blank'; });
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
  panel.addEventListener('cancel', (e) => { e.preventDefault(); closePanel(panel); }); // Esc
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
