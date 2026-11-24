// The version check at join, shared by the Worker, the page and the tests. PROTO (config.js) names what the page
// and the server must agree on: the wire format and the shared constants. See DECISIONS.md, "Version check".

// The Worker closes a socket with this code when the page is not the version it serves. The page then reloads once.
export const UPDATE_CODE = 4005;
// A room refuses a join from a Worker of another protocol with this status. The Worker then asks for another room.
export const STALE_ROOM_STATUS = 421;
// Rooms from before rooms reported a protocol ran protocol 1: PROTO was 1 from the first commit until this check.
export const LEGACY_PROTO = 1;

// What the Worker does with a page that sent `sent` (the raw query value, or null). The page and the Worker are
// deployed together, so a page whose number differs from the Worker's is not the page the Worker now serves, in
// either direction (a deploy or a rollback). A reload fetches the right one. A page from before this check sends
// nothing; it is let through, and its own WELCOME check reloads it if the protocol changed.
export function pageVerdict(sent, own) {
  if (sent === null || sent === undefined || sent === '') return 'legacy';
  return Number(sent) === own ? 'ok' : 'reload';
}

// At most one reload for an update per minute. If the reload brings back the same page (a cache, or two versions
// served side by side), the second ask is refused and the page shows a message instead of looping. If storage
// cannot be written, no reload happens at all, because the guard would not hold.
export function mayReload(store, now, key = 'crumbwar:reloadAt', within = 60_000) {
  let last = 0;
  try { last = Number(store?.getItem(key)) || 0; } catch {}
  if (now - last < within && now >= last) return false;
  try { store.setItem(key, String(now)); return Number(store.getItem(key)) === now; } catch { return false; }
}
