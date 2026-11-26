// Runs the Human Framework villager host off the main thread. The page posts {id, op, arg} (arg a JSON string);
// the worker answers {id, op, out} with the host's JSON string. One HF step costs tens of milliseconds for a full
// camp, so it must not run on the frame that draws the game.
import './exile-hf.js';
const api = globalThis.exileHF;
onmessage = (e) => {
  const { id, op, arg } = e.data;
  let out;
  try { out = api[op](arg); } catch (err) { out = JSON.stringify({ ok: false, error: String(err) }); }
  postMessage({ id, op, out });
};
