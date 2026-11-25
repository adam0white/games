// Paths this site never serves. The Worker answers them itself instead of asking the static assets: Cloudflare
// Issues reports a scanner's request only when the Worker passes the probed path on (workers/OBSERVABILITY.md,
// "Scanner probes"). scripts/build.mjs fails when a built file matches, so a rule here cannot hide a real file
// and a file of these kinds cannot be shipped.
const FILES = /\.(?:php\d?|phtml|aspx?|axd|jsp|cgi|sql|sqlite|bak|old|orig|save|swp|log|env|ini|ya?ml|rb|pem|key|config)(?:\.(?:gz|zip|txt|bak|old))?$/;

// pathname: URL.pathname, still percent-encoded. topLevel: the site's top-level names, or null when unknown
// (Wrangler builds and unit tests); null leaves that part out.
export function isProbe(pathname, topLevel = null) {
  let path = pathname;
  // Scanners hide dots and slashes as %2e and %2f, some twice. A path that does not decode is judged as it is.
  try { for (let i = 0; i < 2; i++) path = decodeURIComponent(path); } catch { /* keep the last good form */ }
  const parts = path.toLowerCase().split(/[/\\]+/).filter(Boolean);
  if (!parts.length) return false;
  if (parts.some((part, i) => part.startsWith('.') && !(i === 0 && part === '.well-known'))) return true;
  if (parts.some(part => part.startsWith('@') || part.endsWith('~'))) return true;
  if (FILES.test(parts.at(-1))) return true;
  return topLevel !== null && parts[0] !== '.well-known' && !topLevel.some(name => name.toLowerCase() === parts[0]);
}
