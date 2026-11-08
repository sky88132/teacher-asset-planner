import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAccountReceipt, createAccountReceiptInput, statutoryReceiptLimit, deferredTaxPercent, receiptTaxNotes } from '../src/lib/simple/account-receipt.ts';
import { createSimpleInputs } from '../src/lib/simple/model.ts';
import { calculateSimple } from '../src/lib/simple/calculation.ts';
import { generateSimplePrompt } from '../src/lib/simple/prompt.ts';
import { createPromptWorkspace } from '../src/lib/ai/prompt-input.ts';
import { privacyFindings } from '../src/lib/ai/prompt-privacy.ts';
const today='2026-11-08';
const input=(patch={})=>({...createAccountReceiptInput(),openedDate:'2020-05-10',...patch});
const calc=(v=input(),birth='1971-05-10',retirement='2027-02-28',publicStart='2034-05-01')=>calculateAccountReceipt(v,birth,retirement,today,publicStart);
test('55세 미만·도달 당일·가입 5년 미만/이상의 경계',()=>{
  const before=calc(input(),'1972-03-01','2027-02-28');assert.equal(before.eligibleDate,'2027-03-01');assert.match(before.status,/미충족/);
  const birthday=calc(input(),'1971-11-08',today);assert.equal(birthday.age55Date,today);assert.match(birthday.status,/요건 충족/);
  const youngAccount=calc(input({openedDate:'2025-05-10'}));assert.equal(youngAccount.fiveYearDate,'2030-05-10');assert.match(youngAccount.status,/미충족/);
  const seasoned=calc();assert.equal(seasoned.eligibleDate,'2026-05-10');assert.match(seasoned.status,/요건 충족/);
});
test('가입일 미입력은 임용일로 채우지 않고 날짜·금액 미확인 유지',()=>{
  const r=calc(createAccountReceiptInput());assert.equal(r.eligibleDate,null);assert.equal(r.fiveYearDate,null);assert.equal(r.limitWon,null);assert.match(r.errors.join(),/가입기간 충족 여부는 추가 확인/);assert.equal(r.netWon,null);
});
test('가입일은 실제 달력·출생 이후·오늘 이내, 윤일의 5년 도달',()=>{
  for(const date of ['2025-02-29','1970-01-01','2027-01-01','bad'])assert.equal(calc(input({openedDate:date})).eligibleDate,null);
  assert.equal(calc(input({openedDate:'2020-02-29'})).fiveYearDate,'2025-02-28');
});
test('개인 납입금·미확인 재원은 5년 예외를 만들지 않는다',()=>{
  for(const deferred of ['no','unknown']){const r=calc(input({openedDate:'2025-05-10',deferred,deferredDepositDate:'2025-06-01'}));assert.equal(r.exceptionApplied,false);assert.equal(r.eligibleDate,'2030-05-10');}
});
test('실제 이연퇴직소득·입금일을 확인한 경우만 5년 예외 적용',()=>{
  const v=input({openedDate:'2025-05-10',deferred:'confirmed',deferredDepositDate:'2025-06-01'}),r=calc(v);assert.equal(r.eligibleDate,'2026-05-10');assert.equal(r.generalDate,'2030-05-10');assert.equal(r.exceptionApplied,true);assert.equal(r.applicationRequired,true);
  assert.equal(calc({...v,deferredDepositDate:'2026-10-01'}).eligibleDate,'2026-10-01'); // no retroactive eligibility
  for(const date of ['', '2024-01-01','2028-01-01'])assert.equal(calc({...v,deferredDepositDate:date}).eligibleDate,null);
});
test('승계·이체·구 개인연금은 별도 심사로 보류',()=>{
  assert.equal(calc(input({specialHistory:true})).eligibleDate,null);assert.equal(calc(input({openedDate:'1999-01-01'})).eligibleDate,null);
});
function limitInput(patch={}){return input({taxYear:'2026',applicationDate:'2026-06-01',referenceDate:'2026-06-01',referenceValue:'100000000',annualWithdrawal:'12000000',...patch});}
test('1년차 1억원 한도 1200만원, 한도 이내·초과를 별도 표시',()=>{
  let r=calc(limitInput());assert.deepEqual(r.limitErrors,[]);assert.equal(r.receiptYear,1);assert.equal(r.limitWon,12000000);assert.equal(r.withinWon,12000000);assert.equal(r.excessWon,0);
  r=calc(limitInput({annualWithdrawal:'15000000'}));assert.equal(r.withinWon,12000000);assert.equal(r.excessWon,3000000);assert.equal(r.netWon,null);
});
test('한도 연차는 신청을 늦춰도 초기화되지 않고 첫 충족연도부터 계산',()=>{
  const r=calc(limitInput({taxYear:'2029',applicationDate:'2029-03-01',referenceDate:'2029-03-01'}));assert.equal(r.receiptYear,4);assert.equal(r.limitWon,17142857);
});
test('신청연도 기준액은 신청일, 이후 과세연도는 1월1일 · 임의 대체 금지',()=>{
  let r=calc(limitInput({taxYear:'2027',referenceDate:'2027-01-01'}));assert.equal(r.requiredReferenceDate,'2027-01-01');assert.equal(r.limitWon,13333333);
  for(const patch of [{referenceDate:'2026-01-01'},{referenceValue:''},{applicationDate:''},{applicationDate:'2025-01-01'},{referenceValue:'-1'},{taxYear:'2025'}])assert.equal(calc(limitInput(patch)).limitWon,null);
});
test('2013년3월 이전은 6년차, 경계일부터 1년차 · 2013년 이전 충족은 보류',()=>{
  assert.equal(calc(limitInput({openedDate:'2013-02-28'})).receiptYear,6);assert.equal(calc(limitInput({openedDate:'2013-02-28'})).limitWon,24000000);
  assert.equal(calc(limitInput({openedDate:'2013-03-01'})).receiptYear,1);
  const old=calc(limitInput({openedDate:'2001-01-01'}),'1950-05-10');assert.equal(old.limitWon,null);assert.match(old.limitErrors.join(),/제도개편/);
});
test('10년차 법정 산식은 120%, 11년차부터 미적용 · 무한대나0원 한도로 표시 금지',()=>{
  assert.equal(statutoryReceiptLimit(100000000,10),120000000);assert.equal(statutoryReceiptLimit(100000000,11),null);
  const r=calc(limitInput({taxYear:'2036',referenceDate:'2036-01-01',referenceValue:''}));assert.equal(r.receiptYear,11);assert.equal(r.unlimited,true);assert.equal(r.limitWon,null);assert.equal(r.withinWon,12000000);assert.equal(r.excessWon,0);
  assert.equal(calc(limitInput({taxYear:'2036',referenceDate:'',applicationDate:''})).unlimited,false);
});
test('안전한 정수·소수 연차·음수 입력 방어 및 원 단위 보수적 버림',()=>{
  for(const [amount,year] of [[-1,1],[1,0],[1,1.5],[Number.MAX_SAFE_INTEGER,10]])assert.equal(statutoryReceiptLimit(amount,year),null);
  assert.equal(statutoryReceiptLimit(1,1),0);assert.equal(statutoryReceiptLimit(0,1),0);
});
test('세금용 실제 수령연차 오류는 유효한 한도 계산·비교를 무효화하지 않는다',()=>{
  const r=calc(limitInput({actualReceiptYears:'21'}));assert.equal(r.limitWon,12000000);assert.equal(r.withinWon,12000000);assert.deepEqual(r.limitErrors,[]);assert.equal(r.deferredPercent,null);assert.equal(r.taxErrors.length,1);
});
test('2026 이연퇴직소득 세금 70/60/50은 실제 수령연차 기준이며 한도연차와 별개',()=>{
  for(const [years,rate] of [[1,70],[10,70],[11,60],[20,60],[21,50]])assert.equal(deferredTaxPercent(years),rate);
  for(const value of [0,-1,1.5,101])assert.equal(deferredTaxPercent(value),null);
  const r=calc(limitInput({deferred:'confirmed',deferredDepositDate:'2024-01-01',actualReceiptYears:'1',taxYear:'2036',referenceDate:'2036-01-01'}));assert.equal(r.receiptYear,11);assert.equal(r.deferredPercent,70);
  assert.equal(calc(limitInput({actualReceiptYears:'21'})).deferredPercent,null);
});
test('재원별 세금·공제 이력 미확인·종신 2026·1500만원은 안내하고 세후액 미생성',()=>{
  const notes=receiptTaxNotes.join(' ');for(const text of ['과세제외','5.5%','4.4%','3.3%','1,500만원','16.5%','50%','세후액은 계산하지'])assert.ok(notes.includes(text));assert.equal(calc().netWon,null);
});
test('소득 공백 중 조건 충족·공백 종료 후 충족·미확인·퇴직 전 공적연금을 구분',()=>{
  assert.match(calc().bridge,/활용 검토 가능/);assert.equal(calc().bridgeStart,'2027-02-28');
  assert.match(calc(input({openedDate:'2025-01-01'}),'1971-05-10','2027-02-28','2029-01-01').bridge,/활용 어려움/);
  assert.match(calc(createAccountReceiptInput()).bridge,/추가 확인/);assert.match(calc(input(),'1971-05-10','2027-02-28','2026-01-01').bridge,/공백 없음/);
});
function fixture(){const f=createSimpleInputs();Object.assign(f.profile,{birthDate:'1971-05-10',appointmentDate:'2000-03-01',step:'35',promotionMonth:'3',retirement:'early',earlyDate:'2027-02-28'});for(const key of ['irp','saving'])Object.assign(f[key],{balance:'10000000',monthly:'100000',annual:'1200000'});return f;}
test('수령 설정은 기존 적립엔진·퇴직급여 재원·7/8% 금액을 변경하지 않는다',()=>{
  const f=fixture(),before=calculateSimple(f,today);f.irp.receipt=limitInput({deferred:'confirmed',deferredDepositDate:'2025-01-01'});f.saving.receipt=input();const after=calculateSimple(f,today);
  for(const key of ['irp','saving','allowance','honorary'])assert.deepEqual(after[key],before[key]);assert.equal(after.accountsTotal,before.accountsTotal);
});
test('월납/연납 전환·퇴직일 변경·정년 선택에서 적립금과 조건 메타데이터 분리',()=>{
  const f=fixture();f.irp.receipt=input({openedDate:'2025-05-10'});const before=calculateSimple(f,today);f.irp.cycle='yearly';const yearly=calculateSimple(f,today);assert.notEqual(yearly.irp.amountWon,before.irp.amountWon);assert.deepEqual(yearly.accountReceipts,before.accountReceipts);
  f.profile.earlyDate='2030-02-28';const changed=calculateSimple(f,today);assert.equal(changed.accountReceipts.irp.taxYear,2030);assert.equal(changed.accountReceipts.irp.eligibleDate,'2030-05-10');
  f.profile.retirement='normal';const normal=calculateSimple(f,today);assert.match(normal.accountReceipts.irp.status,/요건 충족/);assert.ok(normal.irp.amountWon>changed.irp.amountWon);
});
test('AI 요청문에 요건·한도·세금·공백을 반영하고 익명 날짜·복사 감지 유지',()=>{
  const f=fixture();f.irp.receipt=limitInput({taxYear:'2027',referenceDate:'2027-01-01'});const settings=createPromptWorkspace().settings;settings.money='exact';const prompt=generateSimplePrompt(f,settings,today);assert.ok(prompt);for(const text of ['만 55세 도달','한도용 연차','정확한 세후액','공적연금 전 공백 활용','가입기간 충족 여부는 추가 확인'])assert.ok(prompt.includes(text));
  assert.ok(!prompt.includes('2020-05-10'));assert.deepEqual(privacyFindings(prompt,settings),[]);
  const exact=generateSimplePrompt(f,{...settings,anonymize:false,allowExactDates:true},today);assert.ok(exact.includes('2020-05-10'));
});
