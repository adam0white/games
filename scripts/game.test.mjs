import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const moduleUrl=pathToFileURL(resolve('scripts/game.mjs')).href;
const url=(name,version)=>`https://github.com/adam0white/human-framework/releases/download/${name}-v${version}/adam0white-${name}-${version}.tgz`;
function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'game-graph-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const game=join(root,'games','sample'), nm=join(game,'node_modules','@adam0white');
  function write(p,value){mkdirSync(dirname(p),{recursive:true});writeFileSync(p,JSON.stringify(value));}
  const pkg={dependencies:{'@adam0white/human-framework':'4.17.0','@adam0white/lab-client':url('lab-client','0.5.19'),'@adam0white/lab-kit':url('lab-kit','0.5.36')}};
  write(join(game,'package.json'),pkg);
  write(join(nm,'human-framework/package.json'),{name:'@adam0white/human-framework',version:'4.17.0'});
  write(join(nm,'lab-client/package.json'),{name:'@adam0white/lab-client',version:'0.5.19',dependencies:{'@adam0white/human-framework':'4.17.0'}});
  write(join(nm,'lab-kit/package.json'),{name:'@adam0white/lab-kit',version:'0.5.36',peerDependencies:{'@adam0white/lab-client':'0.5.18 || 0.5.19'}});
  function run(){return execFileSync(process.execPath,['--input-type=module','-e',`import {validateGame} from ${JSON.stringify(moduleUrl)}; console.log(validateGame({slug:'sample'},{hfVersion:'4.17.0'}));`],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
  return {root,game,nm,pkg,write,run};
}
test('accepts exact declared client kit and HF runtime graph',t=>{const f=fixture(t);assert.equal(f.run(),'0.5.19');});
test('rejects stale or incompatible installed runtime dependencies',t=>{
  const variants=[
    ['lab-client',{name:'@adam0white/lab-client',version:'0.5.18',dependencies:{'@adam0white/human-framework':'4.17.0'}}],
    ['lab-kit',{name:'@adam0white/lab-kit',version:'0.5.35',peerDependencies:{'@adam0white/lab-client':'0.5.19'}}],
    ['lab-client',{name:'@adam0white/lab-client',version:'0.5.19',dependencies:{'@adam0white/human-framework':'4.17.0','@adam0white/hf-legacy':'npm:@adam0white/human-framework@3.0.0'}}],
    ['lab-client',{name:'@adam0white/lab-client',version:'0.5.19',dependencies:{'@adam0white/human-framework':'3.0.0'}}],
    ['human-framework',{name:'@adam0white/human-framework',version:'3.0.0'}],
    ['lab-kit',{name:'@adam0white/lab-kit',version:'0.5.36',peerDependencies:{'@adam0white/lab-client':'0.5.18'}}],
  ];
  for(const [name,value] of variants){const f=fixture(t);f.write(join(f.nm,name,'package.json'),value);assert.throws(()=>f.run(),undefined,name);}
});
test('rejects a different transitive HF or kit client resolution', t => {
  const hf=fixture(t);
  hf.write(join(hf.nm,'lab-client/node_modules/@adam0white/human-framework/package.json'),{name:'@adam0white/human-framework',version:'3.0.0'});
  assert.throws(()=>hf.run());
  const client=fixture(t);
  client.write(join(client.nm,'lab-kit/node_modules/@adam0white/lab-client/package.json'),{name:'@adam0white/lab-client',version:'0.5.18'});
  assert.throws(()=>client.run());
});
test('rejects mutable or inconsistent release URLs', t => {
  for (const spec of ['https://example.com/lab-client-0.5.19.tgz', url('lab-client','0.5.19').replace('lab-client-v0.5.19','lab-client-v0.5.18')]) {
    const f=fixture(t); f.pkg.dependencies['@adam0white/lab-client']=spec; f.write(join(f.game,'package.json'),f.pkg); assert.throws(()=>f.run());
  }
});
