// Finds a daily garden's par off the page's thread. Planning and confirming a route takes 10-150 ms on a phone-class
// browser, which would stall the tap that opened the daily. The answer is the same as plan.js gives on the page.
import { create, dig, tick } from './sim.js';
import { par } from './plan.js';

self.onmessage = ({ data: { id, level, date } }) => {
  let cuts = null;
  try { cuts = par({ create, dig, tick }, level, date)?.cuts ?? null; } catch { /* no par shown */ }
  self.postMessage({ id, cuts });
};
