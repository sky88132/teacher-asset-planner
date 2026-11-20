import test from 'node:test';
import assert from 'node:assert/strict';
import {pensionDisplayCase,pensionDisplayBasis as today} from './support/pension-display-cases.mjs';
import {calculateSimple} from '../src/lib/simple/calculation.ts';
import {generateSimplePrompt} from '../src/lib/simple/prompt.ts';
import {createPromptWorkspace} from '../src/lib/ai/prompt-input.ts';
import {formatWonAsKoreanCurrency} from '../src/lib/simple/currency.ts';
import {calculateRetirementAnalysis} from '../src/lib/simple/retirement-analysis.ts';
for(const id of ['A','B','C'])test(`월액 재현 ${id}: 반환상태·05용월액·06·입력불변`,()=>{
 const f=pensionDisplayCase(id),before=structuredClone(f),r=calculateSimple(f,today);
 assert.equal(r.pensionStatus.state,'available');assert.deepEqual(r.pensionStatus.codes,[]);assert.equal(r.pensionSource,'teacher-model');assert.equal(r.teacherPension.rows.length,3);
 assert.equal(r.pension.amountWon,id==='A'?3614180:id==='C'?6734630:7357500);assert.equal(r.pension.amountWon,r.teacherPension.selected.amountWon);assert.equal(r.pension.amountWon,r.pensionDetails.amountWon);assert.deepEqual(r.pension.errors,[]);
 assert.ok(generateSimplePrompt(f,{...createPromptWorkspace().settings,money:'exact'},today).includes(formatWonAsKoreanCurrency(r.pension.amountWon)));assert.deepEqual(f,before);
 if(id!=='A'){assert.equal(r.step,40);assert.equal(r.teacherPay.historyErrors.length,0);}if(id==='B'){assert.equal(r.pensionStatus.scope,'appointment-service-only');assert.deepEqual(r.pensionStatus.limitationCodes,['MILITARY_CREDIT_EXCLUDED']);assert.match(r.pension.confidence,/군복무 산입분 제외/);const g=structuredClone(f);g.profile.military='not';const plain=calculateSimple(g,today);assert.equal(r.pension.amountWon,plain.pension.amountWon);assert.equal(r.pensionDetails.months,plain.pensionDetails.months);}
});
test('군 산입 승인만 있으면 임용 후 참고액·제한을 종합·AI에 보존',()=>{
 const f=pensionDisplayCase('B'),r=calculateSimple(f,today);assert.equal(r.pensionStatus.scope,'appointment-service-only');
 const a=calculateRetirementAnalysis(f,r);assert.ok(a.windows.every(w=>w.missing.some(s=>s.includes('군복무 산입분 제외'))));
 const text=generateSimplePrompt(f,createPromptWorkspace().settings,today);assert.ok(text.includes('군복무 산입분 제외'));assert.ok(text.includes('전체 예상액 아님'));assert.ok(text.includes('하한·최솟값도 아닙니다'));
});
test('군 산입 개월·연도를 입력하면 자동 추정에 같은 법정 산식으로 포함',()=>{
 const f=pensionDisplayCase('B'),r=calculateSimple(f,today);Object.assign(f.benefits.civil.pensionEstimate,{militaryMonths:'24',militaryCreditYear:'2020'});const x=calculateSimple(f,today);
 assert.equal(x.pensionSource,'teacher-model');assert.equal(x.pensionStatus.scope,'selected-input-or-model');assert.deepEqual(x.pensionStatus.limitationCodes,[]);
 // 414 service months + 24 credited = 438, capped at the 36-year (432-month) transitional maximum.
 assert.equal(r.pensionDetails.months,414);assert.equal(x.pensionDetails.months,432);assert.ok(x.pension.amountWon>r.pension.amountWon);assert.equal(x.pension.amountWon,7693550);
 assert.ok(x.pensionDetails.notes.some(n=>n.includes('군복무 산입 24개월')));
 const a=calculateRetirementAnalysis(f,x);assert.ok(a.windows.every(w=>!w.missing.some(s=>s.includes('군복무 산입분 제외'))));
 const text=generateSimplePrompt(f,createPromptWorkspace().settings,today);assert.ok(!text.includes('전체 예상액 아님'));
 Object.assign(f.benefits.civil.pensionEstimate,{militaryCreditYear:'2014'});const bad=calculateSimple(f,today);assert.equal(bad.pension.amountWon,null);assert.ok(bad.pension.errors.some(e=>e.includes('2016년 이후')));
});
test('현재1~39에서 미래40은 차단하지 않음·호봉과 승급월 변경은 실제 갱신',()=>{
 const f=pensionDisplayCase('C'),r=calculateSimple(f,today);assert.equal(r.step,40);
 f.profile.step='27';const changed=calculateSimple(f,today);assert.equal(changed.step,40);assert.notEqual(changed.pension.amountWon,r.pension.amountWon);
});
test('확인 날짜·소득 방식·동의만 바꿔도 실제 소득이 없으면 자동 모형 유지',()=>{
 for(const patch of [{confirmedRetirementDate:'2047-08-31'},{confirmedAppointmentDate:'2010-03-01'},{incomeMode:'current'},{incomeMode:'current',constantIncome:true}]){
  const f=pensionDisplayCase('C');Object.assign(f.benefits.civil.pensionEstimate,patch);assert.equal(calculateSimple(f,today).pension.amountWon,6734630);
 }
});
test('일부·0·잘못된 수동 소득이나 계수는 입력 오류를 자동값으로 숨기지 않음',()=>{
 for(const patch of [{averageIncome:'0'},{averageIncome:'abc'},{factorPercent:'100'},{currentIncome:'4000000',constantIncome:false}]){
  const f=pensionDisplayCase('C');Object.assign(f.benefits.civil.pensionEstimate,patch);const r=calculateSimple(f,today);assert.equal(r.teacherPension.eligible,false);assert.equal(r.pension.amountWon,null);assert.equal(r.pensionStatus.state,'unavailable');assert.deepEqual(r.pensionStatus.codes,['CONFIRMED_INCOME_OR_CONTEXT_REQUIRED']);
 }
});
for(const [label,patch,code]of [
 ['현재40',{step:'40'},'PAY_HISTORY_UNRECONSTRUCTABLE'],
 ['2009이전',{birthDate:'1980-06-15',appointmentDate:'2005-03-01',step:'30'},'PRE_2010_INCOME_REQUIRED'],
])test(`안전한 보류 ${label}: 실제 원인 코드·문구·정상개시일·AI 반영`,()=>{
 const f=pensionDisplayCase('C');Object.assign(f.profile,patch);const r=calculateSimple(f,today);
 assert.equal(r.pension.amountWon,null);assert.ok(r.pensionStartDate);assert.ok(r.pensionStatus.codes.includes(code));assert.deepEqual(r.pensionStatus.reasons,r.teacherPension.errors);assert.ok(r.pension.errors.length);
 assert.ok(!r.pension.errors.some(x=>x.includes('재평가된 평균기준소득월액이 필요')));
 assert.equal(r.pensionStatus.preparing,code==='PRE_2010_INCOME_REQUIRED');if(r.pensionStatus.preparing)assert.match(r.pensionStatus.reasons.join(),/자동 추정은 준비 중/);
 const prompt=generateSimplePrompt(f,createPromptWorkspace().settings,today);assert.ok(prompt.includes('계산 보류 이유'));assert.ok(prompt.includes(r.pensionStatus.reasons[0]));assert.ok(!prompt.includes(f.profile.birthDate));
});
test('유효 조회 우선 및 오래된 조회는 모형 대체 금지 유지',()=>{
 const f=pensionDisplayCase('C');Object.assign(f.benefits.civil.pension,{money:{amount:'4500000',unit:'won'},source:'official',taxBasis:'gross',queryDate:today,retirementDate:'2047-08-31',startDate:'2050-06-01'});
 let r=calculateSimple(f,today);assert.equal(r.pension.amountWon,4500000);assert.equal(r.pensionSource,'quote');
 f.benefits.civil.pension.retirementDate='2046-08-31';r=calculateSimple(f,today);assert.equal(r.pension.amountWon,null);assert.deepEqual(r.pensionStatus.codes,['QUOTE_VALIDATION_FAILED']);
 const b=pensionDisplayCase('B');Object.assign(b.benefits.civil.pension,{money:{amount:'4500000',unit:'won'},source:'official',taxBasis:'gross',queryDate:today,retirementDate:'2050-08-31',startDate:'2053-07-01'});const official=calculateSimple(b,today);assert.equal(official.pension.amountWon,4500000);assert.equal(official.pensionSource,'quote');
 const text=generateSimplePrompt(b,createPromptWorkspace().settings,today);assert.ok(text.includes('군 산입분 제외·전체액 아님'));assert.ok(text.includes('임용 후 재직분만'));
});
test('보수 상승률 기본 2.5%·사용자 변경·범위 오류·지금 가치 주 금액',async()=>{
 const {pensionDisplay}=await import('../src/lib/simple/pension-display.ts');
 const f=pensionDisplayCase('C'),r=calculateSimple(f,today);assert.equal(r.teacherPay.growthRate,0.025);
 const d=pensionDisplay(r),base=r.teacherPension.rows.find(x=>x.id==='base');assert.equal(d.present,true);assert.equal(d.primaryWon,base.basis2026Won);assert.equal(d.futureWon,r.pension.amountWon);assert.ok(d.primaryWon<d.futureWon);
 const g=structuredClone(f);g.profile.salaryGrowthPercent='3';const three=calculateSimple(g,today);assert.equal(three.teacherPay.growthRate,0.03);assert.equal(three.pension.amountWon,7554960);assert.ok(three.pension.amountWon>r.pension.amountWon);
 g.profile.salaryGrowthPercent='';assert.equal(calculateSimple(g,today).pension.amountWon,r.pension.amountWon);
 for(const bad of ['11','-1','abc','2.555']){g.profile.salaryGrowthPercent=bad;const x=calculateSimple(g,today);assert.equal(x.pension.amountWon,null,bad);assert.ok(x.pensionStatus.reasons.some(s=>s.includes('보수 상승률')),bad);}
 const q=structuredClone(f);Object.assign(q.benefits.civil.pension,{money:{amount:'4500000',unit:'won'},source:'official',taxBasis:'gross',queryDate:today,retirementDate:'2047-08-31',startDate:'2050-06-01'});
 const qd=pensionDisplay(calculateSimple(q,today));assert.equal(qd.present,false);assert.equal(qd.primaryWon,4500000);
});
