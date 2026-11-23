// No zoom on a game page (tester t1, note #74). A phone zooms in on a double tap or a pinch. iOS Safari ignores user-scalable=no,
// and a page whose body has touch-action: none then cannot be pinched back out: the only way out was to close the tab.
//   noZoom()   call once, from a page
// It does four things. The viewport meta gets minimum-scale=1 and maximum-scale=1. Every element without its own touch-action
// gets manipulation, which turns off double-tap zoom (a zero-specificity rule, so a game's own touch-action wins; canvas keeps none).
// A pinch (iOS gesture events), a double tap on anything that is not a control, and dblclick have their default cancelled.
// And if the page is zoomed anyway, setting the viewport again asks the browser to return to scale 1.
// Not verified on a real phone: emulated browsers do not zoom on a double tap.
export function noZoom() {
  if (window.__noZoom) return; window.__noZoom = true;
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'viewport'; document.head.append(meta); }
  const keep = (meta.content || 'width=device-width, initial-scale=1').split(',').map(p => p.trim()).filter(p => p && !/^(minimum|maximum)-scale=/.test(p));
  const fixed = [...keep, 'minimum-scale=1', 'maximum-scale=1'].join(', ');
  meta.content = fixed;
  const style = document.createElement('style');
  style.textContent = ':where(*:not(canvas)) { touch-action: manipulation; } :where(canvas) { touch-action: none; }';
  document.head.prepend(style); // first, so the page's own rules come after it
  const stop = e => e.preventDefault();
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, stop, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  let lastEnd = 0;
  document.addEventListener('touchend', e => {
    const now = e.timeStamp, control = e.target.closest?.('button, a, input, select, textarea, label');
    if (now - lastEnd < 350 && !control && e.cancelable) e.preventDefault(); // the second tap of a double tap
    lastEnd = now;
  }, { passive: false });
  const vv = window.visualViewport;
  if (vv) vv.addEventListener('resize', () => { if (vv.scale > 1.01) { meta.content = fixed + ' '; meta.content = fixed; } });
}
