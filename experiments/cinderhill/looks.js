// Looks: the same scene drawn three ways, picked with ?look= (or the pause card) so the owner can choose one.
// Page only: the sim, its hashes and the replay do not depend on the look. Each look is one shader variant
// (render.js, `#define LOOK n`) and one palette for the Canvas 2D overlay (labels, crews, the spider, the nest).
//
// ink   — ink and wash (02-spec section 9): paper ash, hand-drawn inked edges, scent as watercolour. The first look.
// ember — night over the ash: dark ground, rock edges that glow like cooling coals, scent as light, ants as
//         silhouettes with a hot rim (far away they are sparks).
// field — a field-guide plate in daylight: flat stepped colours, thick clean outlines, halftone shading, scent as
//         moving stripes, bigger ants coloured by job with a white outline.
export const LOOK_NAMES = ['ink', 'ember', 'field'];

const ink = {
  id: 0, theme: '#2b2622',
  label: '#2b1d12', halo: 'rgba(244, 236, 220, 0.9)',
  bubble: '#2b1d12', bubbleOld: '#2b1d1288', bubbleText: '#f4ecdc', bubbleRim: '#f4ecdc',
  pulse: '255, 240, 200', stroke: '#2b1d12', select: '#e2913a',
  spider: '#1b1210', spiderMark: '#b8432f', danger: '184, 67, 47',
  roomQueen: 'rgba(201, 120, 60, 0.13)', roomOther: 'rgba(120, 90, 50, 0.08)',
  sugar: '#f4e6b0', protein: '#9a4a2c', grainRim: '#2b1d1288',
  egg: '#fbf7ec', larva: '#f1e3b8', larvaHungry: '#efe9dc', broodLine: '#2b1d12', pupa: [220, 110],
  queen: '#5a2e14', queenRim: '#f4ecdc', queenLegs: '#2b1d12', queenBands: '#f4ecdc55',
};

export const LOOKS = {
  ink,
  ember: {
    ...ink, id: 1, theme: '#120d0b',
    label: '#ffd9a8', halo: 'rgba(18, 10, 8, 0.85)',
    bubble: '#ff9a3c', bubbleOld: '#ff9a3c88', bubbleText: '#1a0f0a', bubbleRim: '#1a0f0a',
    pulse: '255, 190, 110', stroke: '#ffcf8a', select: '#ffe27a',
    spider: '#e9dfcf', spiderMark: '#ff3b2a', danger: '255, 70, 50',
    roomQueen: 'rgba(255, 140, 50, 0.14)', roomOther: 'rgba(255, 120, 60, 0.07)',
    sugar: '#fff0b8', protein: '#ff7a4a', grainRim: '#00000088',
    egg: '#fff6e0', larva: '#ffe2a8', larvaHungry: '#c9b8a8', broodLine: '#1a0f0a', pupa: [240, 140],
    queen: '#2a120a', queenRim: '#ff9a3c', queenLegs: '#ff9a3c', queenBands: '#ff9a3c66',
  },
  field: {
    ...ink, id: 2, theme: '#e8d49a',
    label: '#1a1420', halo: 'rgba(255, 252, 240, 0.95)',
    bubble: '#1a1420', bubbleOld: '#1a142088', bubbleText: '#fffcf0', bubbleRim: '#fffcf0',
    pulse: '255, 255, 255', stroke: '#1a1420', select: '#1f7ae0',
    spider: '#3a1d5c', spiderMark: '#ffd23a', danger: '210, 30, 60',
    roomQueen: 'rgba(240, 150, 40, 0.18)', roomOther: 'rgba(60, 130, 200, 0.12)',
    sugar: '#ffffff', protein: '#d6402a', grainRim: '#1a1420',
    egg: '#ffffff', larva: '#fff1c2', larvaHungry: '#e8e8e8', broodLine: '#1a1420', pupa: [235, 120],
    queen: '#c2321f', queenRim: '#1a1420', queenLegs: '#1a1420', queenBands: '#1a142066',
  },
};

/** The look a query value names, or 'ink' for none or an unknown name. */
export function pickLook(name) { return Object.hasOwn(LOOKS, name ?? '') ? name : 'ink'; }
