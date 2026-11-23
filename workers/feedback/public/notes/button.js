// A small notes button for prototypes. It appears only in a browser that has opened the private notes
// link, so other players never see it. It carries the game and a build id, never the key.
(() => {
  try {
    if (!localStorage.getItem('notes.k')) return;
    // /<slug>/ or the old /proto/<slug>/. A lab page (/lab/<name>/) is the game "lab", as it was under /proto/.
    const match = /^(?:\/proto)?\/([a-z0-9]+(?:-[a-z0-9]+)*)\//.exec(location.pathname);
    if (!match || document.getElementById('notes-button')) return;
    const link = document.createElement('a');
    link.id = 'notes-button';
    link.href = `/notes/?game=${match[1]}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '💬';
    link.setAttribute('aria-label', 'Notes');
    link.style.cssText = 'position:fixed;z-index:2147483000;right:calc(8px + env(safe-area-inset-right));top:calc(62px + env(safe-area-inset-top));width:34px;height:34px;display:grid;place-items:center;font-size:17px;line-height:1;text-decoration:none;border-radius:50%;background:#0009;border:1px solid #fff5;opacity:.55;touch-action:manipulation;-webkit-tap-highlight-color:transparent';
    // Below the pause buttons, on the right edge: clear of every prototype's HUD (checked 2026-11-22).
    // The games steer by pointer; a touch on the button must not reach them.
    for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown']) link.addEventListener(type, event => event.stopPropagation());
    (document.body || document.documentElement).append(link);
    fetch(location.pathname, { cache: 'no-store' }).then(response => (response.ok ? response.arrayBuffer() : null)).then(async bytes => {
      if (!bytes) return;
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      link.href += `&build=${[...hash.slice(0, 5)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
    }).catch(() => {});
  } catch { /* storage blocked: no button */ }
})();
