// Only inspect complete chains of plain package-script commands. Unknown shell
// syntax keeps the separate test call rather than assuming a suite was covered.
function laneRunsTest(scripts, name, ancestors = new Set()) {
  if (name === 'test') return typeof scripts.test === 'string';
  if (ancestors.has(name) || typeof scripts[name] !== 'string') return false;
  const commands = scripts[name].split(/\s*&&\s*/).map(command =>
    command.trim().match(/^(?:npm (?:run )?|pnpm (?:run )?)([\w:-]+)$/));
  if (commands.some(command => !command)) return false;
  const next = new Set([...ancestors, name]);
  return commands.some(command => laneRunsTest(scripts, command[1], next));
}

export function qualificationScripts(pkg) {
  const scripts = pkg.scripts ?? {};
  return ['check:lane', ...(!laneRunsTest(scripts, 'check:lane') ? ['test'] : []),
    ...(scripts['ci:check'] ? ['ci:check'] : [])];
}
