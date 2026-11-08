import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syntheticCases,basisDate} from './support/synthetic-inputs.mjs';
import {verifySyntheticCase} from './support/synthetic-verifier.mjs';
const results=[];
assert.equal(syntheticCases.length,100);
for(const c of syntheticCases)test(`가상 교사 ${c.id}: 전체 계산·독립 산술·갱신·익명 요청문`,()=>{try{results.push(verifySyntheticCase(c));}catch(e){results.push({id:c.id,status:'fail',message:e.message});throw e;}});
test.after(()=>{fs.mkdirSync('test-results/synthetic-100',{recursive:true});fs.writeFileSync('test-results/synthetic-100/results.json',JSON.stringify({basisDate,synthetic:true,executed:results.length,passed:results.filter(x=>x.status==='pass').length,failed:results.filter(x=>x.status==='fail').length,results},null,2));});
