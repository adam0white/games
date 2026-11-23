// Saves in localStorage. Every call survives a browser that blocks storage (private mode, a full disk):
// reads give the fallback and writes report false. Keys and formats belong to each game and must not
// change once players have them; see README.md.
export function read(key, fallback = null) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
export function write(key, value) { try { localStorage.setItem(key, String(value)); return true; } catch { return false; } }
export function readNumber(key, fallback = 0) { const text = read(key, ''), n = Number(text); return text !== '' && Number.isFinite(n) ? n : fallback; }
export function readJson(key, fallback = null) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
export function writeJson(key, value) { return write(key, JSON.stringify(value)); }
