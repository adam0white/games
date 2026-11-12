import { constants, lstatSync, mkdirSync, openSync, closeSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

// Copies only the assembled build; the receipt describes prepared bytes, not a deployment.
export function retainDeployBundle({ checkout, dist, output, commit, slugs, sourceRoot = checkout }) {
  if (!isAbsolute(output) || !/^[a-f0-9]{40}$/.test(commit) || !Array.isArray(slugs) || !slugs.length ||
      new Set(slugs).size !== slugs.length || slugs.some(s => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))) throw new Error('Invalid bundle request');
  const source = realpathSync(checkout), root = realpathSync(sourceRoot), built = realpathSync(dist);
  if (lstatSync(dist).isSymbolicLink() || !lstatSync(dist).isDirectory() || built !== join(source, 'dist')) throw new Error('Invalid assembled dist');
  const target = join(realpathSync(dirname(resolve(output))), basename(resolve(output)));
  const overlaps = (a,b) => a === b || a.startsWith(b + sep) || b.startsWith(a + sep);
  if (overlaps(target, source) || overlaps(target, root)) throw new Error('Output must be outside source; overlap forbidden');
  const files = [];
  function collect(dir) {
    for (const entry of readdirSync(dir, { withFileTypes:true }).sort((a,b)=>a.name.localeCompare(b.name))) {
      const file = join(dir,entry.name), rel = relative(built,file).split(sep).join('/');
      if (entry.name === '.git' || entry.isSymbolicLink()) throw new Error(`Forbidden symlink or git metadata: ${rel}`);
      if (entry.isDirectory()) collect(file);
      else if (entry.isFile()) files.push({ path:rel, source:file });
      else throw new Error(`Not a regular file: ${rel}`);
    }
  }
  collect(built);
  const manifests = {};
  for (const slug of slugs) {
    const file=files.find(x=>x.path===`${slug}/release.json`);
    if (!file) throw new Error(`Missing release: ${slug}`);
    const manifest=JSON.parse(readFileSync(file.source,'utf8'));
    if (manifest.game!==slug || manifest.commit!==commit || manifest.dirty!==false) throw new Error(`Invalid release: ${slug}`);
    manifests[slug]=manifest;
  }
  mkdirSync(target, { mode:0o700 });
  try {
    const rows=[];
    for (const file of files) {
      const fd=openSync(file.source, constants.O_RDONLY | constants.O_NOFOLLOW);
      let bytes;
      try { bytes=readFileSync(fd); } finally { closeSync(fd); }
      const dest=join(target,'dist',file.path); mkdirSync(dirname(dest),{recursive:true,mode:0o700});
      writeFileSync(dest,bytes,{flag:'wx',mode:0o600});
      rows.push({path:file.path,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
    }
    rows.sort((a,b)=>a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    const receipt={scope:'prepared bundle; deployment success is established separately',commit,slugs:[...slugs].sort(),manifests,files:rows};
    writeFileSync(join(target,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
    return receipt;
  } catch (error) { rmSync(target,{recursive:true,force:true}); throw error; }
}

export function verifyDeployBundle({ dist, output, receipt }) {
  const receiptPath = join(output, 'receipt.json');
  if (!lstatSync(receiptPath).isFile() || lstatSync(receiptPath).isSymbolicLink()) throw new Error('Bundle receipt changed');
  const actualReceipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  if (JSON.stringify(actualReceipt) !== JSON.stringify(receipt)) throw new Error('Bundle receipt changed');
  function scan(root) {
    if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) throw new Error('Bundle root changed');
    const rows = [];
    function visit(dir) {
      for (const entry of readdirSync(dir, { withFileTypes:true })) {
        const file = join(dir, entry.name), path = relative(root, file).split(sep).join('/');
        if (entry.isSymbolicLink() || entry.name === '.git') throw new Error(`Bundle changed: ${path}`);
        if (entry.isDirectory()) visit(file);
        else if (entry.isFile()) {
          const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
          let bytes; try { bytes = readFileSync(fd); } finally { closeSync(fd); }
          rows.push({ path, size:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex') });
        } else throw new Error(`Bundle changed: ${path}`);
      }
    }
    visit(root);
    return rows.sort((a,b)=>a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  }
  for (const root of [dist, join(output, 'dist')]) {
    if (JSON.stringify(scan(root)) !== JSON.stringify(receipt.files)) throw new Error('Bundle files changed after preparation');
  }
}
