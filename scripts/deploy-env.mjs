// Build tools need runtime settings, not upload or registry credentials.
// This limits inheritance; it is not a sandbox against a hostile same-user process.
export function buildEnvironment(source) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !/^(?:CLOUDFLARE_|CF_API_|CF_EMAIL$|CF_GLOBAL_API_KEY$|GH_TOKEN$|GITHUB_TOKEN$|NPM_TOKEN$|NODE_AUTH_TOKEN$)/.test(key)));
}
