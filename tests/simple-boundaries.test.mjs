import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimpleInputs } from '../src/lib/simple/model.ts';
import { calculateSimple, calculateAccount } from '../src/lib/simple/calculation.ts';
import { contributionLimitYears } from '../src/lib/simple/validation.ts';
import { addSimulationMonths } from '../src/lib/finance/ktcu-validation.ts';
import { manwonToWon } from '../src/lib/simple/currency.ts';
const today='2027-01-01';
function fixture(months=12){const f=createSimpleInputs();Object.assign(f.profile,{birthDate:'1960-05-10',appointmentDate:'1990-03-01',step:'40',promotionMonth:'3',manualNormal:true,normalDate:addSimulationMonths(today,months)});Object.assign(f.irp,{balance:'1000000',monthly:'1500000'});Object.assign(f.saving,{balance:'0',monthly:'0'});return f;}
for(const months of [0,1,6,12,120])test(`${months}개월: 실제 납입 일정·연도별 한도·정상 복리 보존`,()=>{
  const f=fixture(months);const result=calculateSimple(f,today);
  assert.equal(result.irp.deposits,1500000*months);
  assert.deepEqual(result.irp,calculateAccount(f.irp,f.profile.normalDate,today,7));
  assert.deepEqual(result.saving,calculateAccount(f.saving,f.profile.normalDate,today,8));
  assert.deepEqual(contributionLimitYears([1500000,0],today,f.profile.normalDate),[]);
});
for(const [months,monthly] of [[1,18000000],[6,3000000],[12,1500000],[120,1500000]])test(`${months}개월 연도별 한도 정확 경계와 1원 초과`,()=>{
  const start='2026-12-31';const f=fixture(months);f.profile.normalDate=addSimulationMonths(start,months);f.irp.monthly=String(monthly);assert.notEqual(calculateSimple(f,start).irp.amountWon,null);
  f.irp.monthly=String(monthly+1);const result=calculateSimple(f,start);assert.equal(result.irp.amountWon,null);assert.equal(result.saving.amountWon,null);assert.match(result.irp.errors.join(),/1,800만원/);
});
test('0개월은 월 납입이 매우 커도 납입 0회·기초잔액 유지',()=>{const f=fixture(0);f.irp.monthly=String(Number.MAX_SAFE_INTEGER);const r=calculateSimple(f,today);assert.equal(r.irp.amountWon,1000000);assert.equal(r.irp.deposits,0);});
test('연말 경계는 총기간 합계가 아닌 각 달력 연도 기준',()=>{
  assert.deepEqual(contributionLimitYears([4500000,0],'2026-10-31','2027-04-30'),[]); // 2026:2회, 2027:4회
  assert.deepEqual(contributionLimitYears([4500001,0],'2026-10-31','2027-04-30'),[2027]);
  assert.deepEqual(contributionLimitYears([18000000,0],'2026-11-08','2027-01-08'),[2026]); // 11·12월 말 2회
});
test('합산 한도·미입력 계좌·유효하지 않은 기간을 유지',()=>{
  const f=fixture(6);f.irp.monthly='2000000';f.saving.monthly='1000000';assert.notEqual(calculateSimple(f,today).accountsTotal,null);
  f.saving.monthly='1000001';assert.equal(calculateSimple(f,today).accountsTotal,null);
  f.saving.monthly='';f.saving.balance='';const r=calculateSimple(f,today);assert.notEqual(r.irp.amountWon,null);assert.equal(r.saving.amountWon,null);assert.equal(r.accountsTotal,null);
  for(const date of [null,'bad','2026-12-31','2099-01-01'])assert.deepEqual(contributionLimitYears([2000000,0],today,date),[]);
});
test('만원 입력으로 월 200만원·1개월이면 1월말 납입 후 하루 수익 반영',()=>{const f=fixture(1);f.irp.balance='0';f.irp.monthly=manwonToWon('200').valueWon;const r=calculateSimple(f,today).irp;assert.equal(r.deposits,2000000);assert.equal(r.amountWon,Math.round(2000000*1.07**(1/365)));});
for(const scheme of ['civil','private-school','national'])for(const relation of ['before','same','after'])test(`${scheme} 연금 개시일 ${relation}: 제도별 검증`,()=>{
  const f=fixture(12);f.profile.scheme=scheme;
  const date=f.profile.normalDate,startDate=relation==='before'?'2027-12-31':relation==='same'?date:'2028-01-02';
  Object.assign(f.benefits[scheme].pension,{money:{amount:manwonToWon('450').valueWon,unit:'won'},retirementDate:date,queryDate:today,startDate,source:'official',taxBasis:'gross'});
  const r=calculateSimple(f,today);assert.equal(r.pension.amountWon,relation==='before'&&scheme!=='national'?null:4500000);
  assert.equal(r.accumulationTotal,null); // 공제회 누락·월연금을 자산 합산하지 않음
});
test('퇴직 전 국민연금은 공식 조회만 허용·잘못된 날짜·출생 전·조회 가정 불일치 차단',()=>{
  const f=fixture();f.profile.scheme='national';const q=f.benefits.national.pension;
  Object.assign(q,{money:{amount:'1000000',unit:'won'},retirementDate:f.profile.normalDate,queryDate:today,startDate:'2025-05-10',source:'official',taxBasis:'gross'});
  assert.equal(calculateSimple(f,today).pension.amountWon,1000000);
  q.source='user-estimate';assert.equal(calculateSimple(f,today).pension.amountWon,null);q.source='official';
  for(const date of ['','2025-02-30','1960-05-10','1959-01-01']){q.startDate=date;assert.equal(calculateSimple(f,today).pension.amountWon,null);}
  q.startDate='2025-05-10';q.retirementDate='2028-02-01';assert.equal(calculateSimple(f,today).pension.amountWon,null);
});
