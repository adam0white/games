// The campaign is fixed. A seed changes the flock, never the layout.
// Coordinates are pond widths. Rows are written in the order a player meets them.
const rock = (x, y, r) => ({ x, y, r });
const road = (y, dir, phase, period = 5.8, speed = 0.57) =>
  ({ kind: 'car', y, dir, phase, period, speed, y0: y - 0.09, y1: y + 0.09 });
const patch = (kind, x, y, r) => ({ kind, x, y, r, y0: y - r, y1: y + r });
const cat = (x, y, r = 0.18) => ({ ...patch('cat', x, y, r), trigger: r + 0.08, warning: 1.05 });
const weed = (x, y, r) => patch('weed', x, y, r);
const bridge = (x, y, r = 0.13) => ({ ...patch('bridge', x, y, r), trigger: r, warning: 1.55 });
const flow = (x, y0, y1, w, dx = 0) => ({ kind: 'current', x, y0, y1, w, dx, dy: 0.29 });

function level(name, start, need, x, y, layout = {}) {
  return { name, start, need, nest: { x, y }, lost: [], rocks: [], hazards: [], ...layout };
}

export const CHAPTERS = [
  { name: 'Pond', first: 1, last: 4, icon: 'pond', color: '#497e65' },
  { name: 'Road', first: 5, last: 8, icon: 'car', color: '#96604a' },
  { name: 'Garden', first: 9, last: 15, icon: 'cat', color: '#6b6895' },
  { name: 'River', first: 16, last: 24, icon: 'current', color: '#327b91' },
];

export const LEVELS = [
  null,
  level('First swim', 1, 1, .50, 1.28,
    { lesson: 'pond', guide: [[.50, .80], [.50, 1.13]] }),
  level('A little peep', 1, 2, .54, 1.62,
    { lesson: 'rescue', guide: [[.73, .86], [.54, 1.49]], lost: [[.73, .86]] }),
  level('Round the stone', 2, 2, .69, 1.59,
    { lesson: 'bend', guide: [[.19, .83], [.23, 1.26]], rocks: [rock(.55, .94, .21)] }),
  level('Reed pockets', 1, 3, .47, 2.32,
    { guide: [[.22, .86]], lost: [[.22, .86], [.76, 1.53], [.30, 1.91]], rocks: [rock(.51, 1.09, .16), rock(.54, 1.65, .11)] }),
  level('Look both ways', 2, 2, .55, 1.78,
    { lesson: 'car', guide: [[.50, .83]], hazards: [road(1.04, 1, -.25)] }),
  level('The middle island', 3, 2, .28, 2.55,
    { hazards: [road(1.00, 1, 1.05), road(1.77, -1, 2.0, 5.1)], rocks: [rock(.71, 1.40, .13)] }),
  level('Other side', 2, 3, .77, 2.00,
    { lost: [[.22, 1.45]], hazards: [road(1.08, -1, .65, 4.9, .65)] }),
  level('Rush hour', 2, 3, .26, 2.91,
    { lost: [[.73, 1.33], [.27, 2.42]], hazards: [road(.96, 1, .80, 4.9), road(1.96, -1, 1.2, 5.15, .67)] }),
  level('Catnap', 2, 2, .54, 1.78,
    { lesson: 'cat', guide: [[.20, .84], [.20, 1.39]], hazards: [cat(.54, 1.04)] }),
  level('Tiptoe', 3, 2, .72, 2.16,
    { hazards: [cat(.27, 1.19, .23)], rocks: [rock(.70, .91, .13)] }),
  level('Between paws', 3, 3, .25, 2.52,
    { lost: [[.70, 1.35]], hazards: [cat(.28, .91), cat(.71, 1.78, .19)] }),
  level('Sticky water', 2, 2, .50, 1.83,
    { lesson: 'weed', guide: [[.77, .81], [.77, 1.34]], hazards: [weed(.49, 1.03, .18)] }),
  level('Little islands', 3, 3, .36, 2.46,
    { hazards: [weed(.31, 1.00, .20), weed(.67, 1.57, .22)] }),
  level('Down the middle', 4, 3, .56, 2.32,
    { hazards: [weed(.20, 1.14, .19), weed(.79, 1.14, .19)], rocks: [rock(.47, 1.74, .13)] }),
  level('Garden gate', 2, 3, .28, 2.74,
    { lost: [[.76, .90], [.23, 1.91]], hazards: [weed(.45, 1.25, .17), cat(.65, 1.94, .20)] }),
  level('Folding leaves', 3, 2, .50, 1.87,
    { lesson: 'bridge', guide: [[.77, .86], [.77, 1.38]], hazards: [bridge(.50, 1.04)] }),
  level('Two ways', 4, 3, .65, 2.62,
    { hazards: [bridge(.32, 1.02, .16), bridge(.68, 1.74, .15)], rocks: [rock(.49, 1.41, .13)] }),
  level('Fast water', 2, 2, .65, 2.16,
    { lesson: 'current', guide: [[.51, 1.30], [.51, 1.76]], hazards: [flow(.50, .73, 1.74, .22, .026)] }),
  level('Bend in the river', 3, 3, .71, 2.88,
    { hazards: [flow(.30, .74, 1.39, .16, .055), flow(.66, 1.65, 2.40, .17)], rocks: [rock(.35, 1.73, .15)] }),
  level('Beat the bell', 2, 2, .50, 2.71,
    { lesson: 'clock', guide: [[.50, 1.30], [.50, 2.18]], time: 7.5, hazards: [flow(.50, .75, 2.28, .22)] }),
  level('Step out early', 3, 2, .25, 2.70,
    { hazards: [flow(.50, .71, 1.94, .19, .071), weed(.66, 1.91, .18)] }),
  level('Cat at the curb', 2, 3, .69, 2.98,
    { lost: [[.21, 1.39], [.74, 2.28]], hazards: [road(1.02, -1, .70, 5.6), cat(.44, 1.94)] }),
  level('Leaf to river', 4, 3, .30, 3.06,
    { hazards: [bridge(.51, .94, .17), flow(.25, 1.38, 2.37, .14), weed(.55, 2.35, .17)] }),
  level('All the way home', 3, 4, .70, 3.69,
    { lost: [[.73, .76], [.24, 2.73]], hazards: [
      road(1.13, -1, .78, 5.9), bridge(.65, 1.76, .15), cat(.72, 2.30, .19), flow(.36, 2.65, 3.26, .19, .05),
    ] }),
];

export const LAST_STAGE = LEVELS.length - 1;
export const chapterOf = n => CHAPTERS.findIndex(chapter => n <= chapter.last);
