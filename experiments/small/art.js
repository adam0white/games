// A drawn preview for each game, in the game's own colours: small, never stale against the game's art, and free to load.
// Classes s1..s18 animate (style.css) and stop under reduced motion. Shared with the share picture, so each one must also
// draw as a still image (no CSS needed to look right).
export const ART = {
  'night-bells': `<rect width="160" height="120" fill="#17233b"/><circle cx="132" cy="22" r="7" fill="#f4e3b0"/><circle cx="135" cy="20" r="6" fill="#17233b"/><path d="M10 34h140" stroke="#3a4a6a" stroke-width="3"/>
    <g class="s1" style="transform-origin:52px 34px"><path d="M52 34v32" stroke="#d9a441" stroke-width="2"/><path d="M42 82q0-18 10-18t10 18z" fill="#f2b84b"/><circle cx="52" cy="84" r="3" fill="#f2b84b"/></g>
    <g class="s2" style="transform-origin:104px 34px"><path d="M104 34v40" stroke="#c9cfdc" stroke-width="2"/><path d="M94 90q0-18 10-18t10 18z" fill="#e9ecf2"/><circle cx="104" cy="92" r="3" fill="#e9ecf2"/></g>
    <path d="M0 108h160v12H0z" fill="#101a2c"/><g fill="#f2b84b" class="s3"><rect x="20" y="100" width="4" height="4"/><rect x="70" y="102" width="4" height="4"/><rect x="128" y="99" width="4" height="4"/></g>`,
  'wild-pour': `<rect width="160" height="120" fill="#f7dcb3"/><path d="M0 116h160v4H0z" fill="#d9a974"/>
    <g class="s18" style="transform-origin:66px 52px"><path d="M30 26h42l-4 46H34z" fill="#fff6e8" stroke="#2f2a26" stroke-width="3" stroke-linejoin="round"/><path d="M36 46h34l-2 24H36z" fill="#f08a2a"/><path d="M72 30q10 2 8 14" fill="none" stroke="#2f2a26" stroke-width="3"/></g>
    <g fill="#f08a2a" class="s3"><circle cx="86" cy="70" r="2.6"/><circle cx="90" cy="80" r="2.6"/><circle cx="93" cy="89" r="2.4"/></g>
    <path d="M84 92h36l-4 24H88z" fill="#fff6e8" stroke="#2f2a26" stroke-width="3" stroke-linejoin="round"/><path d="M87 106h31l-2 9H89z" fill="#f08a2a"/><path d="M82 100h40" stroke="#2f2a26" stroke-width="1.5" stroke-dasharray="3 2"/>`,
  'night-podwire': `<rect width="160" height="120" fill="#f3ecdc"/><circle cx="80" cy="56" r="34" fill="#efdcb2"/><path d="M28 34q40-30 104-6" fill="none" stroke="#4f6b3a" stroke-width="3"/>
    <g fill="#6b8a4a"><ellipse cx="50" cy="26" rx="9" ry="4" transform="rotate(-30 50 26)"/><ellipse cx="74" cy="20" rx="9" ry="4" transform="rotate(20 74 20)"/><ellipse cx="104" cy="22" rx="9" ry="4" transform="rotate(-15 104 22)"/></g>
    <path d="M80 28v14" stroke="#4f6b3a" stroke-width="2"/><g class="s4" style="transform-origin:80px 54px"><ellipse cx="80" cy="56" rx="10" ry="13" fill="#e0733a"/><path d="M80 44v24M74 47q6 9 0 18M86 47q-6 9 0 18" stroke="#a9471e" stroke-width="1.3" fill="none"/></g>
    <path class="s5" style="transform-origin:80px 92px" d="M24 92 L80 104 L136 92" fill="none" stroke="#b46a3c" stroke-width="2"/><circle cx="24" cy="92" r="3" fill="#5b4a3a"/><circle cx="136" cy="92" r="3" fill="#5b4a3a"/>`,
  'wild2-face-shift': `<rect width="160" height="120" fill="#1d3b45"/><rect x="18" y="16" width="124" height="90" rx="10" fill="#f1ead8"/>
    <rect x="28" y="28" width="38" height="46" rx="3" fill="#fff" transform="rotate(-6 47 51)"/><ellipse cx="47" cy="52" rx="12" ry="15" fill="#9bcf6a" transform="rotate(-6 47 52)"/><circle cx="43" cy="49" r="2.4" fill="#203"/><circle cx="51" cy="48" r="2.4" fill="#203"/><ellipse cx="48" cy="59" rx="4" ry="2" fill="#203"/>
    <g class="s6" style="transform-origin:100px 56px"><ellipse cx="100" cy="56" rx="22" ry="20" fill="#ef6b5b"/><circle cx="92" cy="50" r="5" fill="#fff"/><circle cx="108" cy="50" r="5" fill="#fff"/><circle cx="92" cy="51" r="2.4" fill="#203"/><circle cx="108" cy="51" r="2.4" fill="#203"/><ellipse cx="100" cy="66" rx="7" ry="5" fill="#5a1b1b"/></g>
    <rect x="50" y="88" width="60" height="10" rx="5" fill="#d7f07a"/>`,
  'night-channels': `<rect width="160" height="120" fill="#1f2a1e"/><g fill="#b8774c" stroke="#9b5f3a" stroke-width="1"><rect x="22" y="8" width="116" height="104" rx="4"/></g>
    <path d="M22 30h116M22 52h116M22 74h116M22 96h116M44 8v104M66 8v104M88 8v104M110 8v104" stroke="#a5683f" stroke-width=".8"/>
    <rect x="70" y="10" width="14" height="22" rx="7" fill="#3fb7c7"/><path class="s7" d="M77 30 V66 H100 V92" fill="none" stroke="#3fb7c7" stroke-width="7" stroke-linecap="round" stroke-dasharray="90" />
    <circle cx="100" cy="96" r="8" fill="#5a7a3a"/><path d="M96 96q4-8 8 0M100 90v8" stroke="#c8e08a" stroke-width="2" fill="none"/><g fill="#7d8a8c"><ellipse cx="44" cy="42" rx="7" ry="5"/><ellipse cx="122" cy="66" rx="7" ry="5"/></g><rect x="28" y="82" width="12" height="12" fill="#e4c48a" opacity=".7"/>`,
  'night-sand': `<rect width="160" height="120" fill="#16203a"/><circle cx="126" cy="26" r="10" fill="#f0e3a8"/><g fill="#fff8" ><circle cx="30" cy="20" r="1"/><circle cx="62" cy="34" r="1"/><circle cx="96" cy="14" r="1"/></g>
    <path d="M0 120V96q40-50 80-46t80 40v30z" fill="#d79a3a"/><path d="M0 120V104q40-34 80-30t80 30v16z" fill="#c4842c"/><g class="s8" fill="#e9b45a"><circle cx="112" cy="40" r="1.6"/><circle cx="114" cy="48" r="1.6"/><circle cx="111" cy="56" r="1.6"/></g>
    <path d="M70 52q10-14 20 0" fill="none" stroke="#3a2f22" stroke-width="2.4"/><circle cx="80" cy="44" r="2" fill="#f6d46a"/>`,
  'night-splitlight': `<rect width="160" height="120" fill="#10181f"/><circle cx="80" cy="60" r="46" fill="none" stroke="#2c3a44" stroke-width="1.5"/>
    <path d="M0 58 L70 60" stroke="#fff" stroke-width="2.4"/><path d="M80 34 L100 76 H60 Z" fill="#9fd3e633" stroke="#cfe7ef" stroke-width="1.6"/>
    <g class="s9" stroke-width="2" style="transform-origin:86px 62px"><path d="M86 62 L150 80" stroke="#ff5b5b"/><path d="M86 62 L150 86" stroke="#ffb347"/><path d="M86 62 L150 92" stroke="#ffe75c"/><path d="M86 62 L150 98" stroke="#5be37a"/><path d="M86 62 L150 104" stroke="#5bb6ff"/><path d="M86 62 L150 110" stroke="#a77bff"/></g>`,
  ring: `<rect width="160" height="120" fill="#0b120f"/><path class="s10" d="M44 64q-6-34 34-36t40 30q0 30-36 30t-38-24" fill="none" stroke="#ffd27a" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="210" opacity=".95"/>
    <g class="s3"><circle cx="64" cy="52" r="4" fill="#ffa443"/><circle cx="84" cy="44" r="4" fill="#ffa443"/><circle cx="92" cy="66" r="4" fill="#ffa443"/><circle cx="72" cy="72" r="4" fill="#ffa443"/></g>
    <g class="s11"><circle cx="128" cy="24" r="3.4" fill="#5fe3b0"/><circle cx="24" cy="98" r="3.4" fill="#ff7fc0"/><circle cx="140" cy="96" r="3.4" fill="#5fe3b0"/><circle cx="20" cy="28" r="3" fill="#ff7fc0"/></g>`,
  pitch: `<rect width="160" height="120" fill="#f7f2e6"/><path d="M0 12h160M0 24h160M0 36h160M0 48h160M0 60h160M0 72h160M0 84h160M0 96h160M0 108h160M16 0v120M32 0v120M48 0v120M64 0v120M80 0v120M96 0v120M112 0v120M128 0v120M144 0v120" stroke="#d6dfe8" stroke-width=".8"/>
    <path d="M32 12h32v-8h32v8h32v96H96v8H64v-8H32z" fill="none" stroke="#5a5a5a" stroke-width="1.6"/><path class="s12" d="M80 60l16-12 0-12-16 12-16-12 16-12" fill="none" stroke="#1e4fd6" stroke-width="2" stroke-dasharray="100"/><path d="M80 60l-16 12 16 12 16 0" fill="none" stroke="#d63a2e" stroke-width="2"/><circle cx="80" cy="24" r="3.4" fill="#222"/>`,
  'night-saltplate': `<rect width="160" height="120" fill="#efe6d2"/><rect x="34" y="8" width="92" height="92" fill="#1d2c47" stroke="#8a6a3a" stroke-width="3"/>
    <g class="s13" fill="#f3dfa0"><circle cx="50" cy="24" r="1.2"/><circle cx="58" cy="32" r="1.2"/><circle cx="66" cy="40" r="1.2"/><circle cx="74" cy="48" r="1.2"/><circle cx="80" cy="54" r="1.2"/><circle cx="88" cy="62" r="1.2"/><circle cx="96" cy="70" r="1.2"/><circle cx="104" cy="78" r="1.2"/><circle cx="112" cy="86" r="1.2"/><circle cx="110" cy="24" r="1.2"/><circle cx="102" cy="32" r="1.2"/><circle cx="94" cy="40" r="1.2"/><circle cx="86" cy="48" r="1.2"/><circle cx="72" cy="60" r="1.2"/><circle cx="64" cy="68" r="1.2"/><circle cx="56" cy="76" r="1.2"/><circle cx="48" cy="84" r="1.2"/><circle cx="80" cy="20" r="1.2"/><circle cx="80" cy="88" r="1.2"/><circle cx="46" cy="54" r="1.2"/><circle cx="114" cy="54" r="1.2"/></g>
    <path d="M24 110h112" stroke="#6b5a40" stroke-width="2"/><rect class="s14" x="58" y="104" width="8" height="12" rx="2" fill="#b07a3a"/>`,
  'night-rubbing': `<rect width="160" height="120" fill="#1c3529"/><rect x="34" y="8" width="92" height="104" rx="2" fill="#efe8d6"/>
    <g fill="none" stroke="#b9b2a2" stroke-width="1.4"><path d="M80 90 L48 46 M80 90 L58 40 M80 90 L69 37 M80 90 L80 36 M80 90 L91 37 M80 90 L102 40 M80 90 L112 46"/><path d="M48 46 Q80 22 112 46"/></g>
    <g class="s15"><path d="M48 46 Q80 22 112 46 L80 90Z" fill="#5a5a5a" opacity=".35"/></g><path d="M100 70 l26-20" stroke="#e9a13a" stroke-width="5" stroke-linecap="round"/><path d="M98 72l-3 3" stroke="#333" stroke-width="3"/>`,
  thankful: `<rect width="160" height="120" fill="#10251d"/><path d="M0 0h160v62H0z" fill="#132a3c"/><circle cx="128" cy="20" r="8" fill="#f2efe0"/><circle cx="132" cy="17" r="7" fill="#132a3c"/>
    <path d="M0 120V80q80-16 160 0v40z" fill="#173a2a"/><g stroke="#7fb37f" stroke-width="2" fill="none"><path d="M44 104q2-18-2-34M80 106q-2-22 2-42M116 104q2-16-4-30"/><path d="M43 90q-8-4-12 0M81 88q8-6 12-2M114 92q8-2 10 2"/></g>
    <g class="s3"><g fill="#ffd27a"><circle cx="42" cy="66" r="5"/><circle cx="35" cy="66" r="4"/><circle cx="49" cy="66" r="4"/><circle cx="42" cy="59" r="4"/><circle cx="42" cy="73" r="4"/></g><circle cx="42" cy="66" r="3" fill="#b5532e"/></g>
    <g fill="#f4a7c0"><circle cx="82" cy="60" r="5"/><circle cx="75" cy="60" r="4"/><circle cx="89" cy="60" r="4"/><circle cx="82" cy="53" r="4"/><circle cx="82" cy="67" r="4"/></g><circle cx="82" cy="60" r="3" fill="#7a2e4e"/>
    <g opacity=".55"><circle cx="112" cy="70" r="6" fill="#9fd0ff"/><circle cx="112" cy="70" r="2.6" fill="#2e4e7a"/></g>`,
};
export const svgOf = slug => ART[slug] || '';
export const artOf = slug => `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" class="art">${svgOf(slug)}</svg>`;

// ---------- live previews ----------
// A few seconds of each game, looping on a canvas over the drawing above: the game's own gesture, done by a ghost
// finger, and what it makes happen. Drawn in the same 160 × 120 box as ART, in the same colours. `liveOf(slug)` gives a
// fresh draw function (g, t): g a 2D context already scaled to the box, t seconds since the preview began. The page
// runs only the previews on screen (main.js); under reduced motion it runs none and the drawing stays.
const TAU = Math.PI * 2;
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = x => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const out = x => 1 - (1 - x) ** 3;
function rand(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2654435761) + 0x9e3779b9 >>> 0) % 100000) / 100000; }
const circle = (g, x, y, r, fill) => { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); g.fillStyle = fill; g.fill(); };
const line = (g, pts, stroke, width, cap = 'round') => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokeStyle = stroke; g.lineWidth = width; g.lineCap = cap; g.lineJoin = 'round'; g.stroke(); };
// The ghost finger: a soft disc with a rim that reads on light and dark grounds; a ring while it presses.
function finger(g, x, y, down, alpha = 1) {
  if (alpha <= 0) return;
  g.save(); g.globalAlpha = alpha;
  circle(g, x + 1.2, y + 1.6, 6.4, 'rgba(0,0,0,.18)');
  g.beginPath(); g.arc(x, y, down ? 5.4 : 6.4, 0, TAU); g.fillStyle = 'rgba(255,255,255,.72)'; g.fill();
  g.lineWidth = 1; g.strokeStyle = 'rgba(25,25,35,.45)'; g.stroke();
  if (down) { g.globalAlpha = alpha * 0.55; g.beginPath(); g.arc(x, y, 9.5, 0, TAU); g.strokeStyle = 'rgba(255,255,255,.9)'; g.stroke(); }
  g.restore();
}
// A point `d` along a polyline, and the polyline cut at `d`.
function along(pts, d) {
  const outPts = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
    if (d <= len) { outPts.push([ax + (bx - ax) * d / len, ay + (by - ay) * d / len]); return outPts; }
    d -= len; outPts.push(pts[i]);
  }
  return outPts;
}
const lengthOf = pts => pts.slice(1).reduce((s, [x, y], i) => s + Math.hypot(x - pts[i][0], y - pts[i][1]), 0);
function sparks(g, x, y, k, color, n = 10, reach = 22) {
  if (k <= 0 || k >= 1) return;
  g.save(); g.globalAlpha = 1 - k; g.fillStyle = color;
  for (let i = 0; i < n; i++) { const a = i / n * TAU + 0.3, r = out(k) * reach; g.fillRect(x + Math.cos(a) * r - 1, y + Math.sin(a) * r - 1, 2, 2); }
  g.restore();
}

const LIVE = {
  // A bell swings; its ring closes in; the finger taps as it glows; the bell peals and throws sparks.
  'night-bells'() {
    const r = rand(7), stars = Array.from({ length: 16 }, () => [r() * 160, r() * 64, r() * 9]);
    function bell(g, x, y, len, a, color) {
      g.save(); g.translate(x, y); g.rotate(a);
      line(g, [[0, 0], [0, len]], '#c9a24a', 1.6);
      g.beginPath(); g.moveTo(-11, len + 17); g.quadraticCurveTo(-10, len - 1, 0, len - 1); g.quadraticCurveTo(10, len - 1, 11, len + 17); g.closePath(); g.fillStyle = color; g.fill();
      circle(g, 0, len + 19, 3, color); g.restore();
    }
    return (g, t) => {
      const P = 2.8, p = (t % P) / P, since = (p - 0.5) * P;
      g.fillStyle = '#17233b'; g.fillRect(0, 0, 160, 120);
      for (const [x, y, k] of stars) { g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + k); g.fillStyle = '#f4e3b0'; g.fillRect(x, y, 1.2, 1.2); }
      g.globalAlpha = 1; circle(g, 134, 18, 7, '#f4e3b0'); circle(g, 137, 16, 6, '#17233b');
      line(g, [[10, 20], [150, 20]], '#3a4a6a', 3);
      const a1 = since > 0 ? 0.55 * Math.exp(-since * 1.6) * Math.sin(since * 8) : 0.07 * Math.sin(t * 2.2), a2 = 0.1 * Math.sin(t * 1.7 + 1);
      bell(g, 104, 20, 44, a2, '#e9ecf2'); bell(g, 56, 20, 36, a1, '#f2b84b');
      const bx = 56 - Math.sin(a1) * 45, by = 20 + Math.cos(a1) * 45;
      g.lineWidth = 1.6;
      if (since <= 0) { const k = seg(p, 0, 0.5); g.globalAlpha = 0.25 + 0.75 * k; g.beginPath(); g.arc(bx, by, 32 - 19 * k, 0, TAU); g.strokeStyle = '#f2b84b'; g.stroke(); }
      else { const k = clamp01(since * 1.4); g.globalAlpha = 1 - k; g.beginPath(); g.arc(bx, by, 13 + k * 40, 0, TAU); g.strokeStyle = '#ffe3a0'; g.stroke(); }
      g.globalAlpha = 1; sparks(g, bx, by, clamp01(since * 1.5), '#ffd27a', 12, 26);
      g.fillStyle = '#101a2c'; g.fillRect(0, 106, 160, 14);
      for (let i = 0; i < 9; i++) { const h = 6 + (i * 37 % 9); g.fillRect(i * 18 + 2, 106 - h, 14, h); g.beginPath(); g.moveTo(i * 18, 106 - h); g.lineTo(i * 18 + 9, 100 - h); g.lineTo(i * 18 + 18, 106 - h); g.fill(); }
      g.fillStyle = '#f2b84b'; for (let i = 0; i < 9; i += 2) { g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + i); g.fillRect(i * 18 + 8, 102, 2.5, 2.5); }
      g.globalAlpha = 1;
      const k = seg(p, 0.28, 0.5), fx = bx + 26 - 22 * ease(k), fy = by + 34 - 26 * ease(k);
      finger(g, since > 0 ? bx + 4 + since * 14 : fx, since > 0 ? by + 8 + since * 18 : fy, p > 0.47 && p < 0.58, p < 0.2 ? seg(p, 0.05, 0.2) : 1 - seg(p, 0.7, 0.85));
    };
  },
  // The finger tips the jug; real drops arc into the glass and fill it to the dashed line.
  'wild-pour'() {
    const N = 30, rr = rand(3), wob = Array.from({ length: N }, () => rr() - 0.5);
    return (g, t) => {
      const P = 4.4, p = (t % P) / P;
      g.fillStyle = '#f7dcb3'; g.fillRect(0, 0, 160, 120); g.fillStyle = '#d9a974'; g.fillRect(0, 112, 160, 8);
      const tilt = 1.05 * ease(seg(p, 0.06, 0.32)) * (1 - ease(seg(p, 0.76, 0.9)));
      const px = 50, py = 50, sx = px + Math.cos(1.05) * 22 + Math.sin(1.05) * 32, sy = py + Math.sin(1.05) * 22 - Math.cos(1.05) * 32;
      const top = 80, bottom = 112, gl = 98, gr = 126, target = 0.7;
      let landed = 0;
      g.fillStyle = '#f08a2a';
      for (let i = 0; i < N; i++) {
        const te = 0.3 + i * (0.42 / N); if (p < te) continue;
        const dt = (p - te) * P, x = sx + (26 + wob[i] * 8) * dt, y = sy + 0.5 * 300 * dt * dt;
        const surface = bottom - 2 - (bottom - top - 4) * target * landed / N;
        if (y >= surface && x > gl - 4) { landed++; continue; }
        circle(g, x, y, 2.1, '#f08a2a');
      }
      const fill = target * landed / N * (1 - seg(p, 0.92, 1));
      g.fillStyle = '#f08a2a'; g.fillRect(gl + 2, bottom - 2 - (bottom - top - 4) * fill, gr - gl - 4, (bottom - top - 4) * fill);
      line(g, [[gl, top], [gl + 1, bottom], [gr - 1, bottom], [gr, top]], '#2f2a26', 2.4);
      g.setLineDash([3, 2]); line(g, [[gl - 4, bottom - 2 - (bottom - top - 4) * target], [gr + 4, bottom - 2 - (bottom - top - 4) * target]], '#2f2a26', 1.2, 'butt'); g.setLineDash([]);
      if (landed === N) sparks(g, (gl + gr) / 2, top - 6, seg(p, 0.74, 0.92), '#2f2a26', 8, 16);
      g.save(); g.translate(px, py); g.rotate(tilt);
      const level = 0.72 - 0.5 * landed / N, body = [[-20, -32], [22, -32], [18, 22], [-16, 22]];
      g.save(); g.beginPath(); body.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = '#fff6e8'; g.fill(); g.clip();
      g.rotate(-tilt); g.fillStyle = '#f08a2a'; g.fillRect(-60, 22 - 54 * level, 120, 90); g.restore();
      g.beginPath(); body.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.lineWidth = 2.6; g.strokeStyle = '#2f2a26'; g.lineJoin = 'round'; g.stroke();
      g.beginPath(); g.moveTo(-19, -24); g.quadraticCurveTo(-34, -16, -17, 8); g.lineWidth = 4; g.strokeStyle = '#2f8f8c'; g.stroke();
      const hx = -27, hy = -10; g.restore();
      finger(g, px + Math.cos(tilt) * hx - Math.sin(tilt) * hy, py + Math.sin(tilt) * hx + Math.cos(tilt) * hy, p > 0.06 && p < 0.88, seg(p, 0, 0.06) * (1 - seg(p, 0.88, 0.95)));
    };
  },
  // The finger pulls the wire down and lets go; the wave runs up and the pod bursts into seeds.
  'night-podwire'() {
    const r = rand(11), seeds = Array.from({ length: 12 }, () => [r() * TAU, 30 + r() * 30]);
    return (g, t) => {
      const P = 3.4, p = (t % P) / P, rt = (p - 0.45) * P;
      g.fillStyle = '#f3ecdc'; g.fillRect(0, 0, 160, 120); circle(g, 80, 52, 34, '#efdcb2');
      g.beginPath(); g.moveTo(18, 36); g.quadraticCurveTo(80, 4, 144, 28); g.strokeStyle = '#4f6b3a'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#6b8a4a'; for (const [x, y, a] of [[40, 26, -0.5], [62, 18, 0.3], [100, 16, -0.2], [124, 22, 0.4]]) { g.save(); g.translate(x, y); g.rotate(a + 0.08 * Math.sin(t * 2 + x)); g.beginPath(); g.ellipse(0, 0, 9, 3.6, 0, 0, TAU); g.fill(); g.restore(); }
      line(g, [[80, 18], [80, 42]], '#4f6b3a', 1.6);
      const disp = rt < 0 ? 18 * ease(seg(p, 0.1, 0.4)) : 18 * Math.exp(-rt * 3) * Math.cos(rt * 24);
      const burst = p > 0.53, k = seg(p, 0.53, 0.86), grow = seg(p, 0.88, 1);
      if (!burst || grow > 0) {
        const s = burst ? out(grow) : 1 + (rt > 0 ? 0.1 * Math.sin(rt * 40) : 0);
        g.save(); g.translate(80, 56); g.scale(s, s); g.beginPath(); g.ellipse(0, 0, 10, 13, 0, 0, TAU); g.fillStyle = '#e0733a'; g.fill();
        g.strokeStyle = '#a9471e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 12); g.moveTo(-6, -9); g.quadraticCurveTo(0, 0, -6, 9); g.moveTo(6, -9); g.quadraticCurveTo(0, 0, 6, 9); g.stroke(); g.restore();
      }
      if (burst && k < 1) {
        g.globalAlpha = 1 - k; g.beginPath(); g.arc(80, 56, 12 + k * 30, 0, TAU); g.strokeStyle = '#e0733a'; g.lineWidth = 1.5; g.stroke();
        for (const [a, v] of seeds) { const d = k * P * 0.33, x = 80 + Math.cos(a) * v * d, y = 56 + Math.sin(a) * v * d + 60 * d * d; circle(g, x, y, 1.6, '#5b3a22'); line(g, [[x, y], [x - 2, y - 3]], '#fff', 0.8); }
        g.globalAlpha = 1;
      }
      g.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40, x = 22 + u * 116, y = 96 + disp * Math.sin(Math.PI * u) * (rt > 0 ? Math.cos(u * 3 - rt * 10) * 0.4 + 0.6 : 1); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.strokeStyle = '#b46a3c'; g.lineWidth = 2; g.stroke();
      circle(g, 22, 96, 3, '#5b4a3a'); circle(g, 138, 96, 3, '#5b4a3a');
      finger(g, 80, rt < 0 ? 96 + disp + 2 : 114 - Math.min(1, rt) * 8, p > 0.1 && p < 0.45, seg(p, 0.02, 0.1) * (1 - seg(p, 0.48, 0.62)));
    };
  },
  // The finger stretches the rubber face wide until it matches the sitter; the likeness bar fills.
  'wild2-face-shift'() {
    function face(g, x, y, rx, ry, color, mouthW, mouthH, eye) {
      g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fillStyle = color; g.fill();
      for (const s of [-1, 1]) { circle(g, x + s * rx * 0.38, y - ry * 0.22, eye, '#fff'); circle(g, x + s * rx * 0.38, y - ry * 0.2, eye * 0.48, '#203'); }
      g.beginPath(); g.ellipse(x, y + ry * 0.45, mouthW, mouthH, 0, 0, TAU); g.fillStyle = '#5a1b1b'; g.fill();
    }
    return (g, t) => {
      const P = 3.8, p = (t % P) / P;
      g.fillStyle = '#1d3b45'; g.fillRect(0, 0, 160, 120);
      g.save(); g.translate(28, 30); g.rotate(-0.08); g.fillStyle = '#f4f0e6'; g.fillRect(-17, -22, 34, 42); face(g, 0, -4, 13, 9, '#ef8a7a', 6, 2.2, 2.4); g.restore();
      const back = seg(p, 0.86, 1), s = ease(seg(p, 0.14, 0.62)) * (1 - back) + (back > 0 ? 0.12 * Math.sin(back * 18) * (1 - back) : 0);
      const rx = 21 + 12 * s, ry = 23 - 7 * s;
      g.beginPath(); g.arc(98, 62, 38, 0, TAU); g.strokeStyle = '#ffffff1a'; g.lineWidth = 1; g.stroke();
      face(g, 98, 62, rx, ry, '#ef6b5b', 4 + 5 * s, 3.2 - 1 * s, 4.6);
      const like = 0.12 + 0.84 * s;
      g.fillStyle = '#ffffff22'; g.fillRect(58, 106, 80, 5); g.fillStyle = like > 0.9 ? '#d7f07a' : '#ef6b5b'; g.fillRect(58, 106, 80 * like, 5);
      if (p > 0.6) sparks(g, 98, 62, seg(p, 0.6, 0.86), '#d7f07a', 14, 44);
      finger(g, 98 + rx + 2, 62, p > 0.14 && p < 0.64, seg(p, 0.06, 0.14) * (1 - seg(p, 0.64, 0.74)));
    };
  },
  // The thumb digs a furrow from the spring; water follows it down to the seedbed, which flowers.
  'night-channels'() {
    const path = [[52, 26], [52, 60], [100, 60], [100, 90]], L = lengthOf(path);
    return (g, t) => {
      const P = 4.6, p = (t % P) / P, fade = 1 - seg(p, 0.9, 1);
      g.fillStyle = '#1f2a1e'; g.fillRect(0, 0, 160, 120); g.fillStyle = '#b8774c'; g.fillRect(22, 6, 116, 108);
      g.strokeStyle = '#a5683f'; g.lineWidth = 0.7; g.beginPath(); for (let x = 22; x <= 138; x += 23.2) { g.moveTo(x, 6); g.lineTo(x, 114); } for (let y = 6; y <= 114; y += 21.6) { g.moveTo(22, y); g.lineTo(138, y); } g.stroke();
      for (const [x, y] of [[40, 90], [124, 34], [118, 98]]) { g.beginPath(); g.ellipse(x, y, 7, 5, 0.3, 0, TAU); g.fillStyle = '#7d8a8c'; g.fill(); }
      g.beginPath(); g.ellipse(52, 18, 7, 10, 0, 0, TAU); g.fillStyle = '#3fb7c7'; g.fill();
      g.globalAlpha = fade;
      const dig = ease(seg(p, 0.05, 0.5)) * L, water = seg(p, 0.32, 0.8) * L;
      line(g, along(path, dig), '#7a4a2c', 8); line(g, along(path, dig), '#8c5634', 5);
      if (water > 0) line(g, along(path, water), '#3fb7c7', 4.4);
      g.globalAlpha = 1;
      circle(g, 100, 98, 8, '#5a7a3a');
      const bloom = out(seg(p, 0.8, 0.88)) * fade;
      if (bloom > 0) { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + t; circle(g, 100 + Math.cos(a) * 5 * bloom, 96 + Math.sin(a) * 5 * bloom, 3.4 * bloom, '#f4a7c0'); } circle(g, 100, 96, 2.4 * bloom, '#ffd27a'); }
      const [fx, fy] = along(path, dig).at(-1);
      finger(g, fx + 3, fy + 3, p > 0.05 && p < 0.5, seg(p, 0, 0.05) * (1 - seg(p, 0.52, 0.62)));
    };
  },
  // The finger scoops the dune; sand runs off to the sides and the buried lamp lights up.
  'night-sand'() {
    const r = rand(5), grains = Array.from({ length: 18 }, () => [r(), r() < 0.5 ? -1 : 1, 0.6 + r() * 0.8]), stars = Array.from({ length: 12 }, () => [r() * 160, r() * 50]);
    return (g, t) => {
      const P = 4.8, p = (t % P) / P, d = 30 * ease(seg(p, 0.08, 0.66)) * (1 - ease(seg(p, 0.88, 1)));
      g.fillStyle = '#16203a'; g.fillRect(0, 0, 160, 120); circle(g, 128, 24, 9, '#f0e3a8');
      g.fillStyle = '#fff8'; for (const [x, y] of stars) g.fillRect(x, y, 1, 1);
      g.fillStyle = '#3a2f22'; g.fillRect(75, 88, 10, 12); g.fillStyle = '#6b5a40'; g.fillRect(73, 86, 14, 3);
      const lit = seg(p, 0.45, 0.66) * (1 - seg(p, 0.86, 0.95)); circle(g, 80, 94, 3, lit > 0 ? '#f6d46a' : '#5a4a30');
      const top = x => 112 - 52 * Math.exp(-(((x - 86) / 40) ** 2)) + d * Math.exp(-(((x - 80) / 13) ** 2)) * (1 - 0.06 * Math.sin(x));
      for (let x = 0; x < 160; x += 3) { const y = Math.round(top(x)); g.fillStyle = '#d79a3a'; g.fillRect(x, y, 3, 120 - y); g.fillStyle = '#e9b45a'; g.fillRect(x, y + ((x * 7) % 11) + 2, 3, 2); g.fillStyle = '#c4842c'; g.fillRect(x, y + 14 + ((x * 5) % 9), 3, 2); }
      if (lit > 0) { const gr = g.createRadialGradient(80, 92, 1, 80, 92, 34); gr.addColorStop(0, `rgba(255,214,110,${0.75 * lit})`); gr.addColorStop(1, 'rgba(255,214,110,0)'); g.fillStyle = gr; g.fillRect(40, 56, 80, 64); }
      const fx = 80 + 7 * Math.sin(t * 7), fy = top(80) - 6;
      if (p > 0.08 && p < 0.66) for (const [o, side, v] of grains) { const k = (p * 6 + o) % 1, x = fx + side * v * 26 * k, y = fy - 18 * k + 34 * k * k; g.fillStyle = '#e9b45a'; g.fillRect(x, y, 2, 2); }
      finger(g, fx, fy, p > 0.08 && p < 0.66, seg(p, 0, 0.08) * (1 - seg(p, 0.66, 0.76)));
    };
  },
  // The finger slides the dial; the prism turns until each colour lands on its receiver, and they light.
  'night-splitlight'() {
    const COLORS = ['#ff5b5b', '#ffb347', '#ffe75c', '#5be37a', '#5bb6ff', '#a77bff'];
    return (g, t) => {
      const P = 5, p = (t % P) / P, turn = ease(seg(p, 0.1, 0.5)) * (1 - ease(seg(p, 0.86, 1))), ang = -0.55 + 0.55 * turn, lit = seg(p, 0.48, 0.56) * (1 - seg(p, 0.84, 0.9));
      g.fillStyle = '#10181f'; g.fillRect(0, 0, 160, 120);
      g.beginPath(); g.arc(78, 56, 44, 0, TAU); g.strokeStyle = '#2c3a44'; g.lineWidth = 1.4; g.stroke();
      g.save(); g.shadowColor = '#fff'; g.shadowBlur = 6; line(g, [[0, 54], [74, 56]], '#fff', 2); g.restore();
      g.save(); g.globalCompositeOperation = 'lighter';
      COLORS.forEach((c, i) => { const a = 0.2 + i * 0.075 + ang; line(g, [[82, 58], [82 + Math.cos(a) * 80, 58 + Math.sin(a) * 80]], c, 1.6); });
      g.restore();
      g.save(); g.translate(78, 56); g.rotate(ang * 0.6); g.beginPath(); g.moveTo(0, -16); g.lineTo(14, 10); g.lineTo(-14, 10); g.closePath(); g.fillStyle = '#9fd3e633'; g.fill(); g.strokeStyle = '#cfe7ef'; g.lineWidth = 1.4; g.stroke(); g.restore();
      COLORS.forEach((c, i) => {
        const a = 0.2 + i * 0.075, x = 82 + Math.cos(a) * 70, y = 58 + Math.sin(a) * 70;
        g.save(); if (lit > 0) { g.shadowColor = c; g.shadowBlur = 10 * lit; } g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.lineWidth = 1.4; g.strokeStyle = c; g.stroke(); if (lit > 0) { g.globalAlpha = lit; g.fillStyle = c; g.fill(); } g.restore();
      });
      line(g, [[36, 112], [120, 112]], '#3a4a56', 3); const kx = 50 + 50 * turn; circle(g, kx, 112, 4.6, '#cfe7ef');
      finger(g, kx, 112, p > 0.1 && p < 0.52, seg(p, 0.02, 0.1) * (1 - seg(p, 0.52, 0.62)));
    };
  },
  // Fireflies glow; the finger draws a ring round the orange ones, which burst for points.
  ring() {
    const r = rand(17), ours = [[66, 50], [86, 44], [92, 66], [70, 70]], others = Array.from({ length: 9 }, (_, i) => [r() * 160, r() * 120, r() * TAU, i % 2 ? '#5fe3b0' : '#ff7fc0']);
    const glow = (g, x, y, c, a) => { g.globalAlpha = 0.22 * a; circle(g, x, y, 7, c); g.globalAlpha = a; circle(g, x, y, 2.2, c); g.globalAlpha = 1; };
    const ringAt = u => { const a = u * TAU - Math.PI / 2; const rr = 28 + 2.5 * Math.sin(u * TAU * 3); return [78 + Math.cos(a) * rr * 1.1, 58 + Math.sin(a) * rr]; };
    return (g, t) => {
      const P = 4.4, p = (t % P) / P, draw = seg(p, 0.08, 0.58), pop = seg(p, 0.58, 0.82), back = seg(p, 0.88, 1);
      g.fillStyle = '#0b120f'; g.fillRect(0, 0, 160, 120);
      for (const [x, y, ph, c] of others) { const k = 0.6 + 0.4 * Math.sin(t * 2.4 + ph * 3); glow(g, (x + Math.sin(t * 0.7 + ph) * 8 + 160) % 160, y + Math.cos(t * 0.6 + ph) * 6, c, k); }
      if (pop === 0) for (const [x, y] of ours) glow(g, x + Math.sin(t * 2 + x) * 1.5, y + Math.cos(t * 1.8 + y) * 1.5, '#ffa443', 0.75 + 0.25 * Math.sin(t * 5 + x));
      else if (back > 0) for (const [x, y] of ours) glow(g, x, y, '#ffa443', back);
      else for (const [x, y] of ours) sparks(g, x, y, pop, '#ffa443', 8, 14);
      if (draw > 0 && pop < 1) {
        const pts = []; for (let i = 0; i <= 60 * draw; i++) pts.push(ringAt(i / 60));
        g.save(); g.globalAlpha = 1 - pop; g.shadowColor = '#ffd27a'; g.shadowBlur = 6; line(g, pts, '#ffd27a', 2.2); g.restore();
      }
      if (pop > 0 && pop < 1) { g.globalAlpha = 1 - pop; g.fillStyle = '#ffd27a'; g.font = 'bold 12px Georgia, serif'; g.textAlign = 'center'; g.fillText('+4', 78, 56 - 16 * pop); g.globalAlpha = 1; }
      const [fx, fy] = ringAt(draw);
      finger(g, fx, fy, p > 0.08 && p < 0.58, seg(p, 0, 0.08) * (1 - seg(p, 0.6, 0.7)));
    };
  },
  // The pencil game: the finger draws the ball from line to line, up into the goal.
  pitch() {
    const mine = [[80, 60], [92, 48], [80, 36], [92, 24], [80, 12]], theirs = [[80, 60], [68, 72], [80, 84], [92, 84]], L = lengthOf(mine);
    return (g, t) => {
      const P = 4.8, p = (t % P) / P, d = ease(seg(p, 0.06, 0.66)) * L, goal = seg(p, 0.66, 0.9), fade = 1 - seg(p, 0.9, 1);
      g.fillStyle = '#f7f2e6'; g.fillRect(0, 0, 160, 120);
      g.strokeStyle = '#d6dfe8'; g.lineWidth = 0.7; g.beginPath(); for (let x = 8; x < 160; x += 12) { g.moveTo(x, 0); g.lineTo(x, 120); } for (let y = 0; y <= 120; y += 12) { g.moveTo(0, y); g.lineTo(160, y); } g.stroke();
      if (goal > 0) { g.globalAlpha = (1 - goal) * 0.6 * fade; g.fillStyle = '#1e4fd6'; g.fillRect(68, 4, 24, 8); g.globalAlpha = 1; }
      line(g, [[68, 12], [68, 4], [92, 4], [92, 12], [128, 12], [128, 108], [92, 108], [92, 116], [68, 116], [68, 108], [32, 108], [32, 12], [68, 12]], '#5a5a5a', 1.4);
      g.globalAlpha = fade; line(g, theirs, '#d63a2e', 1.8); const drawn = along(mine, d); line(g, drawn, '#1e4fd6', 1.8);
      for (const [x, y] of drawn.slice(0, -1)) circle(g, x, y, 1.4, '#1e4fd6');
      const [bx, by] = drawn.at(-1); circle(g, bx, by, 3.4, '#222'); g.globalAlpha = 1;
      if (goal > 0) sparks(g, 80, 10, goal, '#1e4fd6', 10, 18);
      finger(g, bx + 4, by + 5, p > 0.06 && p < 0.66, seg(p, 0, 0.06) * (1 - seg(p, 0.66, 0.76)));
    };
  },
  // The finger slides the tuner; scattered salt dances into the plate's nodal figure.
  'night-saltplate'() {
    const r = rand(23), n = 3, m = 2;
    const f = (x, y) => Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) - Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y);
    const grains = Array.from({ length: 260 }, () => {
      const sx = r(), sy = r(); let x = r(), y = r();
      for (let i = 0; i < 24; i++) { const e = 1e-3, v = f(x, y), gx = (f(x + e, y) - v) / e, gy = (f(x, y + e) - v) / e, gg = gx * gx + gy * gy || 1; x = Math.min(1, Math.max(0, x - v * gx / gg)); y = Math.min(1, Math.max(0, y - v * gy / gg)); }
      return [sx, sy, x, y, r() * TAU];
    });
    return (g, t) => {
      const P = 5.2, p = (t % P) / P, tune = ease(seg(p, 0.08, 0.6)) * (1 - ease(seg(p, 0.86, 1)));
      g.fillStyle = '#efe6d2'; g.fillRect(0, 0, 160, 120);
      g.fillStyle = '#1d2c47'; g.fillRect(36, 6, 88, 88); g.strokeStyle = '#8a6a3a'; g.lineWidth = 3; g.strokeRect(36, 6, 88, 88);
      const k = ease(tune), buzz = (1 - k) * 1.2 + 0.25;
      g.fillStyle = '#f3dfa0';
      for (const [sx, sy, tx, ty, ph] of grains) { const x = sx + (tx - sx) * k, y = sy + (ty - sy) * k; g.fillRect(38 + x * 84 + Math.sin(t * 40 + ph) * buzz, 8 + y * 84 + Math.cos(t * 37 + ph) * buzz, 1.3, 1.3); }
      line(g, [[30, 108], [130, 108]], '#6b5a40', 2); line(g, [[110, 103], [110, 113]], '#c0392b', 1.4);
      const kx = 44 + 66 * tune; g.fillStyle = '#b07a3a'; g.fillRect(kx - 4, 102, 8, 12);
      finger(g, kx, 112, p > 0.08 && p < 0.6, seg(p, 0, 0.08) * (1 - seg(p, 0.62, 0.72)));
    };
  },
  // The finger rubs graphite back and forth over the paper; the fossil's ridges come up under it.
  'night-rubbing'() {
    let layer = null;
    const zig = []; for (let k = 0; k <= 12; k++) zig.push([k % 2 ? 114 : 46, 24 + k * 6]);
    const Z = lengthOf(zig);
    function ridges(g, color, w) { g.strokeStyle = color; g.lineWidth = w; g.beginPath(); for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.12 + i * 0.095); g.moveTo(80, 92); g.lineTo(80 + Math.cos(a) * 52, 92 + Math.sin(a) * 58); } g.moveTo(32, 64); g.quadraticCurveTo(80, 6, 128, 64); g.stroke(); }
    return (g, t) => {
      const P = 4.8, p = (t % P) / P, d = ease(seg(p, 0.05, 0.78)) * Z, fade = 1 - seg(p, 0.88, 1);
      g.fillStyle = '#1c3529'; g.fillRect(0, 0, 160, 120); g.fillStyle = '#efe8d6'; g.fillRect(34, 6, 92, 108);
      ridges(g, '#e1d9c4', 1.2);
      if (typeof document !== 'undefined') {
        layer ||= Object.assign(document.createElement('canvas'), { width: 320, height: 240 });
        const o = layer.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, 320, 240); o.setTransform(2, 0, 0, 2, 0, 0);
        o.globalCompositeOperation = 'source-over'; line(o, along(zig, d), 'rgba(70,70,74,.42)', 10);
        o.globalCompositeOperation = 'source-atop'; ridges(o, '#262628', 2.2);
        g.save(); g.globalAlpha = fade; g.drawImage(layer, 0, 0, 160, 120); g.restore();
      }
      const [fx, fy] = along(zig, d).at(-1);
      g.save(); g.translate(fx, fy); g.rotate(-0.7); g.fillStyle = '#e9a13a'; g.fillRect(-2.5, -26, 5, 24); g.fillStyle = '#333'; g.fillRect(-2.5, -3, 5, 4); g.restore();
      finger(g, fx + 9, fy - 14, p > 0.05 && p < 0.78, seg(p, 0, 0.05) * (1 - seg(p, 0.8, 0.88)));
    };
  },
  // Three thanks: the finger taps a word, a stem rises and a flower opens, three times.
  thankful() {
    const r = rand(29), flies = Array.from({ length: 8 }, () => [r() * 160, 20 + r() * 60, r() * TAU]);
    const F = [[44, '#ffd27a', '#b5532e'], [80, '#f4a7c0', '#7a2e4e'], [116, '#9fd0ff', '#2e4e7a']];
    return (g, t) => {
      const P = 6, p = (t % P) / P, fade = 1 - seg(p, 0.9, 1);
      g.fillStyle = '#132a3c'; g.fillRect(0, 0, 160, 120); circle(g, 130, 18, 8, '#f2efe0'); circle(g, 134, 15, 7, '#132a3c');
      g.beginPath(); g.moveTo(0, 82); g.quadraticCurveTo(80, 66, 160, 82); g.lineTo(160, 120); g.lineTo(0, 120); g.fillStyle = '#173a2a'; g.fill();
      for (const [x, y, ph] of flies) { g.globalAlpha = 0.4 + 0.4 * Math.sin(t * 3 + ph); circle(g, x + Math.sin(t + ph) * 6, y + Math.cos(t * 0.8 + ph) * 4, 1.2, '#e8f59a'); }
      g.globalAlpha = 1;
      F.forEach(([x, petal, mid], i) => {
        const s0 = 0.06 + i * 0.27, stem = out(seg(p, s0 + 0.04, s0 + 0.14)) * fade, bloom = out(seg(p, s0 + 0.12, s0 + 0.22)) * fade, top = 96 - 30 * stem;
        g.fillStyle = '#ffffff1f'; g.beginPath(); g.roundRect ? g.roundRect(x - 13, 104, 26, 10, 5) : g.rect(x - 13, 104, 26, 10); g.fill();
        circle(g, x, 109, 2, petal);
        if (stem > 0) line(g, [[x, 98], [x + Math.sin(t + i) * 1.5, top]], '#7fb37f', 2);
        if (bloom > 0) { for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + t * 0.3; circle(g, x + Math.cos(a) * 6 * bloom, top + Math.sin(a) * 6 * bloom, 4 * bloom, petal); } circle(g, x, top, 3 * bloom, mid); }
      });
      const i = Math.min(2, Math.floor((p - 0.02) / 0.27)), s0 = 0.06 + Math.max(0, i) * 0.27, fx = F[Math.max(0, i)][0];
      finger(g, fx + 3, 111, p > s0 && p < s0 + 0.05, p < 0.85 ? seg(p, 0, 0.04) : 1 - seg(p, 0.85, 0.9));
    };
  },
};
// A new looping preview for a game, or null for a game without one.
// Each preview's ground colour, for the margin round its box when the card is not 4:3.
export const groundOf = slug => (/fill="(#[0-9a-f]{3,8})"/i.exec(ART[slug] || '') || [])[1] || '#0b0d14';
export const liveOf = slug => (LIVE[slug] ? LIVE[slug]() : null);
export const LIVE_SLUGS = Object.keys(LIVE);
