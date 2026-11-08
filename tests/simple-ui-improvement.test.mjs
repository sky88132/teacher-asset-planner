import test from 'node:test';
import assert from 'node:assert/strict';
import { formatWonAsKoreanCurrency as won,manwonToWon,wonToManwon } from '../src/lib/simple/currency.ts';
import { createSimpleInputs } from '../src/lib/simple/model.ts';
import { calculateSimple } from '../src/lib/simple/calculation.ts';
import { estimateAllowanceReference } from '../src/lib/simple/allowance-reference.ts';
import { generateSimplePrompt } from '../src/lib/simple/prompt.ts';
import { createPromptWorkspace } from '../src/lib/ai/prompt-input.ts';
import { privacyFindings } from '../src/lib/ai/prompt-privacy.ts';
function fixture(appointment='2010-01-01',date='2030-01-01',scheme='civil'){const f=createSimpleInputs();Object.assign(f.profile,{birthDate:'1970-05-10',appointmentDate:appointment,scheme,step:'30',promotionMonth:'3',military:'not',retirement:'early',earlyDate:date});return f;}
test('요청 예시·반올림·억 경계·양수/음수 최소액·0·누락',()=>{
  for(const [n,s] of [[173423613,'1억 7,342만원'],[75802384,'7,580만원'],[660173263,'6억 6,017만원'],[99994999,'9,999만원'],[99995000,'1억원'],[100005000,'1억 1만원'],[5000,'1만원'],[-5000,'-1만원'],[0,'0만원'],[1,'0만원 초과~1만원 미만'],[-1,'-1만원 초과~0만원 미만'],[null,'미입력 또는 계산 불가']])assert.equal(won(n),s);
  assert.equal(won(Number.MAX_SAFE_INTEGER),'90,071,992억 5,474만원');assert.ok(!won(Number.MAX_SAFE_INTEGER,undefined,'range').includes('계산 불가'));
});
test('표시 반올림은 원 단위 입력·원금·복리·소수 정밀도를 바꾸지 않는다',()=>{
  const f=fixture();Object.assign(f.irp,{balance:'1234567',monthly:'100001'});const r=calculateSimple(f,'2026-11-08');const original=structuredClone(r);won(r.irp.amountWon);assert.deepEqual(r,original);assert.equal(manwonToWon('123.4567').valueWon,'1234567');assert.equal(wonToManwon('1234567'),'123.4567');
});
test('소득 미입력은595만원을 개인 소득으로 채우지 않고 세 시나리오만 생성',()=>{
  const f=fixture(),copy=structuredClone(f),r=calculateSimple(f,'2026-11-08');assert.equal(r.allowance.amountWon,null);assert.deepEqual(r.allowanceReference.rows.map(x=>x.income),[4760000,5950000,7140000]);assert.deepEqual(r.allowanceReference.rows.map(x=>x.amountWon),[37128000,46410000,55692000]);assert.deepEqual(f,copy);assert.equal(r.benefitsTotal,null);
});
test('실제 소득 입력은 기존 공식 경로의 정확한 원 금액과 일치',()=>{
  const f=fixture();f.benefits.civil.income='4000001';const r=calculateSimple(f,'2026-11-08');assert.equal(r.allowance.amountWon,31200007);assert.equal(r.allowanceReference.rows[0].amountWon,r.allowance.amountWon);assert.equal(r.allowanceReference.actual,true);
});
test('구기간·신기간은 각각 다른 소득/지급률과 전체 재직기간 기준 비율 사용',()=>{
  const f=fixture('2005-01-01'),q=f.benefits.civil;Object.assign(q,{income:'4000000',legacyAllowanceIncome:'3000000',legacyAllowanceDate:'2030-01-01',legacyAllowanceAppointment:'2005-01-01'});const r=calculateSimple(f,'2026-11-08'),row=r.allowanceReference.rows[0];assert.equal(row.oldMonths,60);assert.equal(row.newMonths,240);assert.equal(row.oldRate,.6);assert.equal(row.rate,.39);assert.equal(row.oldWon,9000000);assert.equal(row.postWon,31200000);assert.equal(row.amountWon,40200000);assert.equal(r.allowance.amountWon,null); // Existing personal engine is not silently replaced.
});
test('구기간 소득 미확인은 전체액을 만들지 않고 이후분만 별도 참고',()=>{
  const f=fixture('2005-01-01'),r=calculateSimple(f,'2026-11-08');assert.ok(r.allowanceReference.oldReason);for(const row of r.allowanceReference.rows){assert.equal(row.oldWon,null);assert.equal(row.amountWon,null);assert.ok(row.postWon>0);assert.equal(row.combinedWon,null);}
});
test('33년 상한에서 구기간 먼저 배분·군복무 승인만으로 기간 추가 금지',()=>{
  const f=fixture('1995-01-01','2030-01-01');f.profile.military='approved';const r=calculateSimple(f,'2026-11-08');assert.equal(r.allowanceReference.total,396);assert.equal(r.allowanceReference.oldMonths,180);assert.equal(r.allowanceReference.newMonths,216);
});
test('감축·구법·퇴직일 변경·잘못된 입력은 전체 구기간 금액을 차단',()=>{
  const f=fixture('2005-01-01'),q=f.benefits.civil;Object.assign(q,{income:'4000000',legacyAllowanceIncome:'3000000',legacyAllowanceDate:'2030-01-01',legacyAllowanceAppointment:'2005-01-01'});q.recognizedMonths='200';assert.equal(calculateSimple(f,'2026-11-08').allowanceReference.rows.length,0);delete q.recognizedMonths;f.profile.earlyDate='2031-01-01';assert.equal(calculateSimple(f,'2026-11-08').allowanceReference.rows[0].amountWon,null);f.profile.appointmentDate='1990-01-01';assert.equal(calculateSimple(f,'2026-11-08').allowanceReference.rows.length,0);
});
test('사학 통계 미확인/구기간과 국민연금은 공무원 평균 시나리오 적용 금지',()=>{
  const p=fixture('2010-01-01','2030-01-01','private-school');assert.equal(calculateSimple(p,'2026-11-08').allowanceReference.rows.length,0);p.benefits['private-school'].income='4000000';assert.ok(calculateSimple(p,'2026-11-08').allowanceReference.rows[0].amountWon>0);
  const n=fixture('2010-01-01','2030-01-01','national');assert.equal(estimateAllowanceReference(n.profile,n.benefits.national,'2030-01-01',null).rows.length,0);
});
test('만원 표시 AI도 원 계산값과 분리되고 익명 복사를 방해하지 않는다',()=>{
  const f=fixture();f.monthlyLivingCost='3333333';const settings=createPromptWorkspace().settings,text=generateSimplePrompt(f,settings,'2026-11-08');assert.match(text,/333만원/);assert.ok(!text.includes('3,333,333원'));assert.deepEqual(privacyFindings(text,settings),[]);
});
