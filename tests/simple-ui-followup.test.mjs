import test from 'node:test';
import assert from 'node:assert/strict';
import { plannedReinvestment } from '../src/lib/simple/reinvestment.ts';
import { calculateSimple, calculateAccount } from '../src/lib/simple/calculation.ts';
import { createSimpleInputs } from '../src/lib/simple/model.ts';
import { generateSimplePrompt } from '../src/lib/simple/prompt.ts';
import { createPromptWorkspace } from '../src/lib/ai/prompt-input.ts';
const today='2026-11-08';
function fixture(){const f=createSimpleInputs();Object.assign(f.profile,{birthDate:'1972-01-01',appointmentDate:'2000-03-01',step:'30',promotionMonth:'3',retirement:'early',earlyDate:'2030-01-01'});for(const k of ['irp','saving'])Object.assign(f[k],{balance:'10000000',monthly:'250000'});return f;}
test('13.2% 참고액은 기존600/900만원 한도와 원 미만 버림 적용',()=>{
 for(const [irp,saving,want] of [[0,0,0],[0,9000000,792000],[9000000,0,1188000],[3000000,6000000,1188000],[9000000,9000000,1188000],[1,0,0],[1001,0,132]])assert.equal(plannedReinvestment(irp,saving),want);
 assert.throws(()=>plannedReinvestment(-1,0));
});
test('체크만으로 자동 재투자·기본 복리 동일·두 계좌 중 IRP에만 입금',()=>{
 const f=fixture(),base=calculateSimple(f,today);f.reinvest=true;const r=calculateSimple(f,today);
 assert.equal(r.accountsWithoutReinvestment,base.accountsTotal);assert.equal(r.reinvestError,'');assert.ok(r.reinvestEffect>0);
 assert.equal(r.saving.amountWon,base.saving.amountWon);assert.equal(r.accountsTotal-base.accountsTotal,r.reinvestEffect);
 assert.equal(r.irp.deposits-base.irp.deposits,r.reinvestments.reduce((n,x)=>n+x.won,0));
 assert.equal(r.irp.amountWon,calculateAccount(f.irp,r.retirement.date,today,7,r.reinvestments).amountWon);
});
test('참고 재투자금은 차년도 공제에도 한 번만 포함·세액정보 없음과0 동일한 가정',()=>{
 const f=fixture();f.reinvest=true;let r=calculateSimple(f,today);
 assert.equal(r.taxCredits[2026],132000);assert.equal(r.taxCredits[2027],809424);
 f.taxIncome='0';f.taxCapacity='0';assert.deepEqual(calculateSimple(f,today).reinvestments,r.reinvestments);
});
test('연말납·퇴직일 변경·환급 시점 경계·체크해제는 원래 계산으로 복구',()=>{
 const f=fixture();f.irp.cycle='yearly';f.irp.annual='3000000';f.reinvest=true;
 f.profile.earlyDate='2027-05-30';assert.deepEqual(calculateSimple(f,today).reinvestments,[]);
 f.profile.earlyDate='2027-05-31';const r=calculateSimple(f,today);assert.deepEqual(r.reinvestments,[{date:'2027-05-31',won:462000}]);
 assert.ok(r.reinvestments.every(x=>x.date<=r.retirement.date));f.reinvest=false;assert.equal(calculateSimple(f,today).accountsTotal,r.accountsWithoutReinvestment);
});
test('누락 계좌·기본한도 초과·재투자한도 초과에는 임의 자산 없음',()=>{
 const f=fixture();f.reinvest=true;f.saving.balance='';assert.equal(calculateSimple(f,today).reinvestEffect,null);
 f.saving.balance='0';f.irp.monthly='1000000';f.saving.monthly='500000';const r=calculateSimple(f,today);
 assert.match(r.reinvestError,/1,800만원/);assert.equal(r.accountsTotal,r.accountsWithoutReinvestment);assert.deepEqual(r.reinvestments,[]);
 f.saving.monthly='500001';assert.equal(calculateSimple(f,today).accountsTotal,null);
});
test('06 생활비 공유·미입력과0 구분·AI는13.2% 가정을 명시하고 신원 제외',()=>{
 const f=fixture();f.reinvest=true;const s=createPromptWorkspace().settings;
 const empty=generateSimplePrompt(f,s,today);assert.match(empty,/13.2%/);assert.match(empty,/실제 환급 미확인/);assert.match(empty,/생활비.*미입력/);
 f.monthlyLivingCost='3000000';const p=generateSimplePrompt(f,s,today);assert.match(p,/300만원/);assert.ok(!p.includes(f.profile.birthDate));
 f.monthlyLivingCost='0';assert.match(generateSimplePrompt(f,s,today),/희망 월 생활비.*0만원/);
});
