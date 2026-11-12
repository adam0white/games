import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { retainDeployBundle, verifyDeployBundle } from './deploy-bundle.mjs';
const commit = 'a'.repeat(40);
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'bundle-test-')); t.after(() => rmSync(root, { recursive:true, force:true }));
  const checkout = join(root,'checkout'), dist = join(checkout,'dist'), out = join(root,'output');
  mkdirSync(join(dist,'one'), { recursive:true });
  const manifest = { game:'one', commit, dirty:false, framework:'4.17.0' };
  writeFileSync(join(dist,'one','release.json'), JSON.stringify(manifest)); writeFileSync(join(dist,'one','asset.js'),'abc');
  return { root, checkout, dist, out, manifest };
}
test('copies exact assembled files with hash and complete manifest receipt', t => {
  const f=fixture(t); const result=retainDeployBundle({ checkout:f.checkout, dist:f.dist, output:f.out, commit, slugs:['one'] });
  assert.equal(readFileSync(join(f.out,'dist/one/asset.js'),'utf8'),'abc');
  assert.deepEqual(result.manifests.one,f.manifest);
  assert.equal(result.files.find(x=>x.path==='one/asset.js').sha256,createHash('sha256').update('abc').digest('hex'));
  assert.deepEqual(JSON.parse(readFileSync(join(f.out,'receipt.json'),'utf8')),result);
});
test('refuses symlinks in the assembled dist', t => {
  const f=fixture(t); symlinkSync('/etc/passwd',join(f.dist,'one','bad'));
  assert.throws(()=>retainDeployBundle({checkout:f.checkout,dist:f.dist,output:f.out,commit,slugs:['one']}),/symlink|regular/i);
});
test('preserves existing output and refuses overlap', t => {
  const f=fixture(t); mkdirSync(f.out); writeFileSync(join(f.out,'sentinel'),'keep');
  assert.throws(()=>retainDeployBundle({checkout:f.checkout,dist:f.dist,output:f.out,commit,slugs:['one']}));
  assert.equal(readFileSync(join(f.out,'sentinel'),'utf8'),'keep');
  assert.throws(()=>retainDeployBundle({checkout:f.checkout,dist:f.dist,output:join(f.dist,'output'),commit,slugs:['one']}),/overlap|outside/i);
});
test('rejects a mismatched release before copying', t => {
  const f=fixture(t); writeFileSync(join(f.dist,'one','release.json'),JSON.stringify({...f.manifest,dirty:true}));
  assert.throws(()=>retainDeployBundle({checkout:f.checkout,dist:f.dist,output:f.out,commit,slugs:['one']}),/invalid release/i);
});
test('resolves output parents before checking source overlap', t => {
  const f=fixture(t); const alias=join(f.root,'alias'); symlinkSync(f.checkout,alias);
  assert.throws(()=>retainDeployBundle({checkout:f.checkout,dist:f.dist,output:join(alias,'output'),commit,slugs:['one']}),/overlap|outside/i);
});
test('rejects changed, missing or added files on either side after upload', t => {
  const f=fixture(t); const receipt=retainDeployBundle({checkout:f.checkout,dist:f.dist,output:f.out,commit,slugs:['one']});
  for (const root of [f.dist, join(f.out,'dist')]) {
    const asset=join(root,'one','asset.js');
    writeFileSync(asset,'changed'); assert.throws(()=>verifyDeployBundle({dist:f.dist,output:f.out,receipt}),/bundle|changed/i); writeFileSync(asset,'abc');
    rmSync(asset); assert.throws(()=>verifyDeployBundle({dist:f.dist,output:f.out,receipt}),/bundle|changed/i); writeFileSync(asset,'abc');
    const added=join(root,'one','extra'); writeFileSync(added,'x'); assert.throws(()=>verifyDeployBundle({dist:f.dist,output:f.out,receipt}),/bundle|changed/i); rmSync(added);
  }
  verifyDeployBundle({dist:f.dist,output:f.out,receipt});
  writeFileSync(join(f.out,'receipt.json'),'{}');
  assert.throws(()=>verifyDeployBundle({dist:f.dist,output:f.out,receipt}),/receipt changed/i);
});
