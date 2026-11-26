// Which page to run (2026-11-26). ?v=classic is the page as it was before the deeper sheet: the stick, par and the
// six-second plates. Anything else plays the deeper sheet (deep.js) in one of its three ways (survey, name, craft).
const v = new URLSearchParams(location.search).get('v');
if (v === 'classic') import('./main.js');
else import('./deep.js');
