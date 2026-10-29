import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
for(const fault of ['open','match','put','keys']) for(const path of ['/assets/index-abcdefgh.js','/portraits/person.webp']) {
  test(`cache ${fault} failure preserves network response: ${path}`,async()=>{
    const handlers={};let requests=0;
    const fail=async()=>{throw new DOMException('Storage unavailable','SecurityError')};
    const cache={match:async()=>undefined,put:async()=>{},keys:async()=>[],delete:async()=>true};cache[fault]=fail;
    const context=vm.createContext({URL,Request,location:{origin:'https://example.test'},caches:{open:fault==='open'?fail:async()=>cache},fetch:async()=>{requests++;return new Response('resource',{status:200})},self:{addEventListener:(name,fn)=>handlers[name]=fn}});
    vm.runInContext(source,context);
    let response;
    handlers.fetch({request:new Request('https://example.test'+path),respondWith:p=>response=p});
    assert.equal(await (await response).text(),'resource');assert.equal(requests,1);
  });
}
test('activation still claims clients when storage is unavailable',async()=>{
  const handlers={};let claimed=false,done;
  vm.runInNewContext(source,{URL,location:{origin:'https://example.test'},caches:{keys:async()=>{throw Error('denied')}},self:{addEventListener:(n,f)=>handlers[n]=f,clients:{claim:async()=>{claimed=true}}}});
  handlers.activate({waitUntil:p=>done=p});await done;assert.equal(claimed,true);
});
