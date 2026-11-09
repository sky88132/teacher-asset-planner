import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimpleInputs } from '../src/lib/simple/model.ts';
import { createPensionEstimateInput } from '../src/lib/simple/pension-types.ts';
import { calculateSimple } from '../src/lib/simple/calculation.ts';
import { teacherSalary2026 } from '../src/lib/simple/config.ts';
import { projectTeacherPay, teacherStepAt, salaryGrowth, regularBonusRate, serviceBonusMonthly } from '../src/lib/simple/teacher-pay.ts';
import { newEntrantFactor, redistributionPercent } from '../src/lib/simple/teacher-pension.ts';
import { occupationalRate } from '../src/lib/simple/occupational-pension.ts';
import { estimateHonorary, estimateAllowance } from '../src/lib/simple/benefit-estimates.ts';
import { calculateRetirementAnalysis } from '../src/lib/simple/retirement-analysis.ts';
import { generateSimplePrompt } from '../src/lib/simple/prompt.ts';
import { createPromptWorkspace } from '../src/lib/ai/prompt-input.ts';
const today='2026-11-08';
function fixture(){const f=createSimpleInputs();Object.assign(f.profile,{birthDate:'1987-02-12',appointmentDate:'2017-04-01',step:'20',promotionMonth:'4',retirement:'early',earlyDate:'2039-08-31',military:'not'});return f;}

test('40호봉은 최근 정기승급 도달 경로·표준소득의 참고 추정이며 AI에 가정 포함',()=>{
 const f=fixture();f.profile.step='40';const r=calculateSimple(f,today);
 assert.equal(teacherStepAt(f.profile,'2026-03-31',today),39);
 assert.equal(teacherStepAt(f.profile,'2017-04-01',today),31);
 assert.equal(r.teacherPay.rows[0].firstStep,31);assert.equal(r.teacherPay.historyErrors.length,0);
 assert.equal(r.pensionSource,'teacher-model');assert.ok(r.teacherPension.rows.every(s=>s.estimate.amountWon>0));
 assert.match(r.teacherPay.assumptions,/최근 정기승급일/);
 assert.match(generateSimplePrompt(f,createPromptWorkspace().settings,today),/40호봉.*계획 가정/);
 assert.ok(r.pensionStartDate);assert.ok(r.pensionGapMonths>0);
});

function legacyFixture(){
 const f=fixture();Object.assign(f.profile,{appointmentDate:'2007-04-01',step:'33',earlyDate:'2037-08-31'});
 // Synthetic user-supplied values, not a claim about an actual agency factor.
 f.benefits.civil.pensionEstimate={...createPensionEstimateInput(),legacyIncome:'3000000',factorPercent:'95',confirmedAppointmentDate:f.profile.appointmentDate,confirmedRetirementDate:f.profile.earlyDate};
 return f;
}
test('구기간 확인 변수는 교원 평균소득 모델과 결합·구간별 엔진·동일 가격 환산',()=>{
 const f=legacyFixture(),r=calculateSimple(f,today);assert.equal(r.pensionSource,'teacher-model');assert.equal(r.pensionDetails.periods[0].months,33);
 const legacyNominal=Math.round(3000000*salaryGrowth(r.pensionDetails.priceYear));
 assert.equal(r.pensionDetails.periods[0].amountWon,Math.floor(legacyNominal*33*25/12000));
 assert.ok(r.pensionDetails.periods[1].amountWon>0);assert.ok(r.pensionDetails.periods[2].amountWon>0);
 for(const row of r.teacherPension.rows){assert.equal(row.factorPercent,95);assert.equal(row.estimate.periods[0].amountWon,r.pensionDetails.periods[0].amountWon);assert.match(row.estimate.notes.join(),/구기간.*동일하게 유지/);}
 assert.equal(f.benefits.civil.pensionEstimate.averageIncome,'');assert.equal(f.benefits.civil.pensionEstimate.redistributedIncome,'');
});
test('구기간 확인일이 오래되면 자동 결합 금지·정상 개시와 공백은 유지',()=>{
 const f=legacyFixture(),before=calculateSimple(f,today);f.profile.earlyDate='2038-08-31';const r=calculateSimple(f,today);
 assert.equal(r.pension.amountWon,null);assert.match(r.teacherPension.errors.join(),/다시 확인/);assert.equal(r.pensionStartDate,before.pensionStartDate);assert.ok(r.pensionGapMonths>0);
});
test('구기간 변수 누락·잘못된 값·33년 초과는 임의 계수나 보수로 대체하지 않음',()=>{
 for(const patch of [{legacyIncome:''},{factorPercent:''},{legacyIncome:'oops'},{factorPercent:'0'},{factorPercent:'oops'}]){
  const f=legacyFixture();Object.assign(f.benefits.civil.pensionEstimate,patch);const r=calculateSimple(f,today);assert.equal(r.pension.amountWon,null);assert.ok(r.teacherPension.errors.length>0);assert.ok(r.pensionStartDate);
 }
 const f=legacyFixture();f.profile.earlyDate='2045-08-31';f.benefits.civil.pensionEstimate.confirmedRetirementDate=f.profile.earlyDate;
 const r=calculateSimple(f,today);assert.equal(r.pension.amountWon,null);assert.match(r.teacherPension.errors.join(),/33년 초과/);
});
test('확인 적용비율만 입력해도 표준 평균소득 추정 유지·실제 평균소득 입력은 우선',()=>{
 const f=fixture();f.benefits.civil.pensionEstimate={...createPensionEstimateInput(),factorPercent:'95',confirmedRetirementDate:f.profile.earlyDate,confirmedAppointmentDate:f.profile.appointmentDate};
 let r=calculateSimple(f,today);assert.equal(r.pensionSource,'teacher-model');assert.equal(r.teacherPension.rows[1].factorPercent,95);
 f.benefits.civil.pensionEstimate.averageIncome='5000000';r=calculateSimple(f,today);assert.equal(r.pensionSource,'automatic');assert.equal(r.pension.amountWon,null);
});

test('소득 없는 날짜 확인값은 자동 모델을 차단하지 않고 퇴직일 변경도 재계산',()=>{
 const f=fixture(), initial=calculateSimple(f,today);
 f.benefits.civil.pensionEstimate={...createPensionEstimateInput(),confirmedRetirementDate:f.profile.earlyDate,confirmedAppointmentDate:f.profile.appointmentDate};
 let r=calculateSimple(f,today);assert.equal(r.pensionSource,'teacher-model');assert.equal(r.pension.amountWon,initial.pension.amountWon);
 assert.equal(r.pensionStartDate,initial.pensionStartDate);assert.equal(r.pensionGapDays,initial.pensionGapDays);
 f.profile.earlyDate='2040-08-31';r=calculateSimple(f,today);assert.equal(r.pensionSource,'teacher-model');assert.ok(r.pension.amountWon>0);assert.notEqual(r.pension.amountWon,initial.pension.amountWon);assert.notEqual(r.pensionGapDays,initial.pensionGapDays);
 f.benefits.civil.pensionEstimate.averageIncome='5000000';r=calculateSimple(f,today);assert.equal(r.pensionSource,'automatic');assert.equal(r.pension.amountWon,null);
});

test('화면 참고 결과는 동일 퇴직일·세전·가격연도의 원단위 합계이며 고정 기준과 분리',()=>{
 const f=fixture(),r=calculateSimple(f,today),v=r.benefitReference;
 assert.equal(v.source,'teacher-model');assert.equal(v.date,f.profile.earlyDate);assert.equal(v.taxBasis,'gross');assert.equal(v.priceYear,2039);
 assert.equal(v.honoraryWon,r.teacherBenefits.honorary.amountWon);
 for(const row of v.rows)assert.equal(row.combinedWon,row.honoraryWon+row.allowanceWon);
 assert.equal(r.benefitsTotal,null);assert.equal(r.accumulationTotal,null);
 f.benefits.civil.income='5000000';const fixed=calculateSimple(f,today).benefitReference;
 assert.equal(fixed.source,'fixed-2026');assert.equal(fixed.priceYear,2026);assert.equal(fixed.taxBasis,'gross');assert.equal(fixed.rows[0].combinedWon,fixed.rows[0].allowanceWon+fixed.honoraryWon);
});

test('공식2026 봉급표·연3%와 호봉효과는 한 번씩만 적용',()=>{
 const f=fixture(),pay=projectTeacherPay(f.profile,'2027-12-31',today),y=pay.rows.find(y=>y.year===2027);
 assert.equal(y.firstStep,20);assert.equal(y.lastStep,21);
 assert.equal(y.salaryWon,3*Math.round(teacherSalary2026[19]*1.03)+9*Math.round(teacherSalary2026[20]*1.03));
 assert.equal(pay.finalSalaryWon,Math.round(teacherSalary2026[20]*1.03));assert.equal(salaryGrowth(2026),1);
});
test('승급 경계·40호봉 상한·과거 상한 경로의 계획 가정',()=>{
 const f=fixture();assert.equal(teacherStepAt(f.profile,'2026-04-01',today),20);assert.equal(teacherStepAt(f.profile,'2026-03-31',today),19);
 assert.equal(teacherStepAt(f.profile,'2027-03-31',today),20);assert.equal(teacherStepAt(f.profile,'2027-04-01',today),21);
 f.profile.step='40';const r=calculateSimple(f,today);assert.equal(r.teacherPay.historyErrors.length,0);assert.ok(r.pension.amountWon>0);assert.ok(r.teacherPay.historyNote);assert.ok(r.teacherPay.finalSalaryWon>teacherSalary2026[39]);assert.equal(r.step,40);
});
test('담임20·교직25·급식16 분리와 연간 발생 수당의 월평균 환산',()=>{
 const f=fixture(),y=projectTeacherPay(f.profile,f.profile.earlyDate,today).rows.find(y=>y.year===2027);
 assert.equal(y.homeroomWon,2400000);assert.equal(y.teachingWon,3000000);assert.equal(y.mealWon,1920000);
 assert.equal(y.taxableWon,y.salaryWon+y.homeroomWon+y.teachingWon+y.serviceBonusWon+y.regularBonusWon+y.holidayBonusWon);
 assert.equal(y.grossWon-y.taxableWon,y.mealWon);assert.equal(y.holidayBonusWon,Math.round(y.salaryWon*.1));
 assert.equal(y.incomeProxyWon,Math.round(y.taxableWon/12));assert.equal(y.basis2026IncomeWon,Math.round(y.incomeProxyWon/1.03));
});
test('정근수당2025개정 구간·가산금 장기근속 추가분',()=>{
 assert.deepEqual([0,1,2,4,5,6,7,8,9,10].map(regularBonusRate),[.1,.1,.2,.2,.25,.3,.35,.4,.45,.5]);
 assert.deepEqual([0,5,7,10,15,20,24,25].map(serviceBonusMonthly),[30000,40000,50000,60000,80000,110000,110000,130000]);
});
test('부분 퇴직연도는 근무월 과세액과 연환산을 구분·퇴직 후 담임수당 없음',()=>{
 const f=fixture(),r=calculateSimple(f,today),last=r.teacherPay.rows.at(-1);
 assert.equal(last.year,2039);assert.equal(last.months,8);assert.equal(last.homeroomWon,1600000);
 assert.equal(last.annualizedTaxableWon,Math.round(last.taxableWon*12/8));assert.ok(r.teacherPay.rows.every(x=>x.year<=2039));
});
test('현재40호봉은 계획 경로로 추정·역산 범위 이탈만 보류·개시 유지',()=>{
 const f=fixture();f.profile.step='40';let r=calculateSimple(f,today);assert.ok(r.pension.amountWon>0);assert.ok(r.pensionStartDate);assert.match(r.pensionDetails.notes.join(),/40호봉.*계획 가정/);
 f.profile.step='2';r=calculateSimple(f,today);assert.ok(r.teacherPay.historyErrors.length);assert.equal(r.pension.amountWon,null);assert.ok(r.pensionStartDate);
});
test('공식 신규자 이행률 표의 기간 경계 및33년 고정',()=>{
 for(const [m,want]of [[1,77.25],[12,77.25],[13,78],[120,82.45],[156,84.62],[168,85.65],[312,96.07],[324,97.02],[360,100],[372,101.09],[396,103.44],[432,103.44]])assert.equal(newEntrantFactor(m),want);
 assert.equal(newEntrantFactor(0),null);assert.equal(newEntrantFactor(12.5),null);
});
test('재분배 비율은 공식 경계표를 적용·전체평균을 개인소득으로 복사하지 않음',()=>{
 for(const [b,want]of [[2999999,300],[3000000,216.67],[8999999,112.5],[9000000,105.56],[10000000,100],[11000000,95.45],[16000000,81.25]])assert.equal(redistributionPercent(b,10000000),want);
 assert.equal(redistributionPercent(0,10000000),null);const r=calculateSimple(fixture(),today);assert.notEqual(r.teacherPension.averageIncome2026Won,r.teacherPension.assumedWholeIncomeWon);
});
test('연도별 지급률·2035이후1.7%·기본정보 자동 시나리오와 개시 명목/2026 환산',()=>{
 assert.deepEqual([2016,2026,2034,2035,2050].map(occupationalRate),[18780,17360,17040,17000,17000]);
 const f=fixture(),r=calculateSimple(f,today);assert.equal(r.pensionSource,'teacher-model');assert.ok(r.pension.amountWon>0);assert.equal(r.teacherPension.rows.length,3);
 for(const s of r.teacherPension.rows){assert.ok(s.basis2026Won>0);assert.ok(s.estimate.amountWon>s.basis2026Won);assert.equal(s.estimate.priceYear,2052);assert.match(s.estimate.notes.join(),/실제 급여/);assert.match(s.estimate.notes.join(),/대리 가정/);}
 assert.equal(r.pension.amountWon,r.teacherPension.rows[1].estimate.amountWon);assert.equal(r.pensionDetails.periods[2].months,r.pensionDetails.months);
});
test('2010~2015와2016 이후 두 구간·2009이전은 자료 없이 전체액을 만들지 않음',()=>{
 const f=fixture();f.profile.appointmentDate='2012-04-01';f.profile.step='28';let r=calculateSimple(f,today);assert.equal(r.pensionSource,'teacher-model');assert.equal(r.pensionDetails.periods[1].months,45);assert.ok(r.pensionDetails.periods[2].amountWon>0);
 f.profile.appointmentDate='2007-04-01';f.profile.step='33';r=calculateSimple(f,today);assert.equal(r.pension.amountWon,null);assert.match(r.teacherPension.errors.join(),/2009년 이전/);assert.ok(r.pensionStartDate);
});
test('확인 소득/조회 우선·오래된 조회는 모델로 조용히 대체하지 않음',()=>{
 const f=fixture();f.benefits.civil.pension.money={amount:'2000000',unit:'won'};const r=calculateSimple(f,today);assert.equal(r.pensionSource,'quote');assert.equal(r.pension.amountWon,null);
 f.benefits.civil.pension.money.amount='';f.profile.teacherModel=false;assert.equal(calculateSimple(f,today).pension.amountWon,null);
});
test('사학·국민·복잡한 경력·승인 군경력에 교원 자동 월액 강제 적용 금지',()=>{
 for(const scheme of ['private-school','national']){const f=fixture();f.profile.scheme=scheme;const r=calculateSimple(f,today);assert.notEqual(r.pensionSource,'teacher-model');assert.equal(r.teacherPension.rows.length,0);}
 const f=fixture();f.profile.military='approved';let r=calculateSimple(f,today);assert.equal(r.pension.amountWon,null);assert.ok(r.pensionStartDate);
 f.profile.military='not';f.benefits.civil.pensionEstimate={...createPensionEstimateInput(),complexCareer:true};r=calculateSimple(f,today);assert.equal(r.pension.amountWon,null);assert.equal(r.teacherPension.rows.length,0);
});
test('명퇴와 퇴직수당은 기존 함수 재사용·원 합산 후 표시·미래 명목끼리만 합산',()=>{
 const f=fixture(),r=calculateSimple(f,today),t=r.teacherBenefits;assert.equal(t.rows.length,3);
 assert.equal(t.honorary.amountWon,estimateHonorary(f.profile,r.retirement.date,r.retirement.normal,r.step,{won:r.teacherPay.finalSalaryWon,year:2039}).amountWon);
 for(const s of t.rows){assert.equal(s.allowanceWon,estimateAllowance(f.profile,{...f.benefits.civil,income:String(s.incomeWon)},r.retirement.date).amountWon);assert.equal(s.combinedWon,s.allowanceWon+s.honoraryWon);}
 assert.equal(r.benefitsTotal,null);assert.equal(r.allowance.amountWon,null);assert.ok(t.rows[1].honoraryWon>r.honorary.amountWon);
});
test('구기간 확인 소득이 있는2026 통계 참고 합계도 보존·미확인은0으로 합산 안 함',()=>{
 const f=fixture();f.profile.appointmentDate='2007-04-01';f.profile.step='33';let r=calculateSimple(f,today);assert.ok(r.allowanceReference.rows.every(x=>x.combinedWon===null));assert.equal(r.teacherBenefits.rows.length,0);
 Object.assign(f.benefits.civil,{legacyAllowanceIncome:'3000000',legacyAllowanceDate:f.profile.earlyDate,legacyAllowanceAppointment:f.profile.appointmentDate});r=calculateSimple(f,today);assert.ok(r.allowanceReference.rows.every(x=>x.combinedWon===x.amountWon+r.honorary.amountWon));assert.equal(r.teacherBenefits.rows.length,0);
});
test('명퇴20년 미충족은 미래 참고 합계 보류·정년은 명퇴 합계 없음',()=>{
 const f=fixture();f.profile.earlyDate='2030-08-31';let r=calculateSimple(f,today);assert.ok(r.teacherBenefits.rows.every(x=>x.combinedWon===null));
 f.profile.retirement='normal';r=calculateSimple(f,today);assert.ok(r.teacherBenefits.rows.every(x=>x.combinedWon===null));assert.ok(r.teacherBenefits.rows[1].allowanceWon>0);
});
test('퇴직일 변경은 미래 봉급/월연금/수당 합계를 갱신하고 금융자산에 합산하지 않음',()=>{
 const f=fixture(),a=calculateSimple(f,today);f.profile.earlyDate='2040-08-31';const b=calculateSimple(f,today);assert.notEqual(a.teacherPay.finalSalaryWon,b.teacherPay.finalSalaryWon);assert.notEqual(a.pension.amountWon,b.pension.amountWon);assert.notEqual(a.teacherBenefits.rows[1].combinedWon,b.teacherBenefits.rows[1].combinedWon);assert.equal(b.accumulationTotal,null);
});
test('2026 수당과 공제회 미래 적립금을 합산하지 않고 월연금도 일시금 제외',()=>{
 const f=fixture();Object.assign(f.ktcu,{balance:'10000000',monthly:'0'});f.benefits.civil.income='5000000';const r=calculateSimple(f,today),a=calculateRetirementAnalysis(f,r);assert.equal(a.lumpPriceCompatible,false);assert.equal(a.lumpTotalWon,null);assert.ok(!a.lumpItems.some(x=>x.label.includes('공적연금')));
});
test('AI 요청문은 익명 가정·시점·월연금·수당 참고 합계와 남은 확인사항 반영',()=>{
 const f=fixture(),text=generateSimplePrompt(f,createPromptWorkspace().settings,today);for(const term of ['봉급표 연 3%','담임수당 계속','미래 명목','2026 보수수준 환산','동일 가정 기준 세전 참고 합계','실제 소득이 아닌','외부 금액 검증 미완료'])assert.ok(text.includes(term),term);assert.ok(!text.includes(f.profile.birthDate));assert.ok(!text.includes(f.profile.appointmentDate));assert.equal(f.benefits.civil.income,undefined);
});

test('1월1일 퇴직연도 환산은 봉급 연동분만3%·담임/교직/정근가산 고정',()=>{
 const f=fixture();f.profile.earlyDate='2040-01-01';const r=calculateSimple(f,today),last=r.teacherPay.final;
 assert.equal(last.year,2039);
 const linked=(last.salaryWon+last.regularBonusWon+last.holidayBonusWon)/last.months;
 const expected=Math.round(last.incomeProxyWon+linked*(salaryGrowth(2040)/salaryGrowth(2039)-1));
 const base=r.teacherBenefits.rows.find(x=>x.id==='base');assert.equal(base.incomeWon,expected);
 assert.ok(base.incomeWon<Math.round(last.incomeProxyWon*1.03));
 assert.equal(last.homeroomWon/last.months,200000);assert.equal(last.teachingWon/last.months,250000);
 assert.equal(base.combinedWon,base.allowanceWon+base.honoraryWon);
});

test('같은 연도 수당 소득 시나리오는 기존 월평균 기초를 그대로 사용',()=>{
 const f=fixture(),r=calculateSimple(f,today);assert.equal(r.teacherPay.final.year,2039);
 assert.equal(r.teacherBenefits.rows.find(x=>x.id==='base').incomeWon,r.teacherPay.final.incomeProxyWon);
});
