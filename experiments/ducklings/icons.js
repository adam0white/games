// The same shapes follow the ducklings, nest and sun from the pond to the counters.
const duck = '<path d="M5 13C3 13 2 11 2 10c0 7 4 10 11 10 5 0 8-3 8-7l-3-2c2-4-1-7-4-7-4 0-6 4-4 7l-2 2z" fill="#ffc84e" stroke="#81541c"/><path d="m18 9 5 1-4 3-2-1z" fill="#e98535"/><circle cx="15.8" cy="8.2" r="1" fill="#423220"/>';
const nest = '<ellipse cx="12" cy="13" rx="10.5" ry="8" fill="#94ba69"/><ellipse cx="12" cy="12" rx="8.7" ry="6.4" fill="#926136"/><ellipse cx="12" cy="12" rx="5.9" ry="3.9" fill="#f4dca6"/><path d="m5 14 4 2m0 2 6-1m3-2 2-3M7 8l4-1m5 1 3 2" stroke="#dbb37a"/>';
const sun = '<circle cx="12" cy="12" r="4" fill="#ffc858" stroke="#a26116"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" stroke="#a26116"/>';
const shapes = {
  globe: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor"/><ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="currentColor"/><path d="M3 12h18" stroke="currentColor"/>',
  duck,
  waiting: duck + '<path d="M4 3v4m0 2v.1" stroke="#9a541c" stroke-width="2"/>',
  nest,
  goal: nest + '<path d="M14 11V2l8 2-8 3" fill="#f4ad43" stroke="#744d30"/>',
  up: '<path d="M12 20V4m-6 6 6-6 6 6" stroke="currentColor" stroke-width="2.5" fill="none"/>',
  down: '<path d="M12 4v16m-6-6 6 6 6-6" stroke="currentColor" stroke-width="2.5" fill="none"/>',
  call: '<path d="m3 9 6-4v14l-6-4H1V9z" fill="#b76c22"/><path d="M13 8q4 4 0 8m3-11q7 7 0 14" fill="none" stroke="#a15e21" stroke-width="2"/>',
  close: '<path d="M2 12h7m-3-3 3 3-3 3m16-3h-7m3-3-3 3 3 3" fill="none" stroke="currentColor" stroke-width="2"/>',
  sun,
  pad: '<path d="M12 14 7 6a9 8 0 1 1-3 13l8-5z" fill="#79b365" stroke="#477e54"/><circle cx="16" cy="11" r="2.5" fill="#f9ce65"/>',
  right: '<path d="M3 12h17m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2"/>',
  life: '<path d="M12 21 3 12C-2 5 7 0 12 7c5-7 14-2 9 5z" fill="#f56978" stroke="#a33248"/>',
  spent: '<path d="M12 21 3 12C-2 5 7 0 12 7c5-7 14-2 9 5z" fill="#fff9df" stroke="#7a6556"/>',
  clock: '<circle cx="12" cy="12" r="9" fill="#fff9df" stroke="currentColor"/><path d="M12 6v6l4 2" fill="none" stroke="currentColor"/>',
  heart: '<path d="M12 21 3 12C-2 5 7 0 12 7c5-7 14-2 9 5z" fill="#f56978" stroke="#a33248"/><path d="m13 6-3 6 4 1-3 5" fill="none" stroke="#6f273b"/>',
  scatter: duck + '<path d="m3 5 2 3M6 2l1 3M2 8l2 2" stroke="#874321" stroke-width="2"/>',
  check: '<path d="m5 12 4 4L19 6" fill="none" stroke="#277053" stroke-width="3"/>',
  cross: '<path d="m6 6 12 12M18 6 6 18" stroke="#ab4535" stroke-width="2.5"/>',
  reeds: '<path d="M7 20 3 7m8 13L8 3m6 17 2-16m2 16 4-11" stroke="#497f52" stroke-width="2"/>',
};

export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${shapes[name]}</svg>`;
}
