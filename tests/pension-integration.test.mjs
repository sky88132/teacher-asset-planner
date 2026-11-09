import test from 'node:test';
import assert from 'node:assert/strict';
import {projectWholeIncome} from '../src/lib/simple/pension-assumptions.ts';
import {redistributionPercent,newEntrantFactor} from '../src/lib/simple/teacher-pension.ts';
import {createSimpleInputs} from '../src/lib/simple/model.ts';
import {createPensionEstimateInput} from '../src/lib/simple/pension-types.ts';
import {calculateSimple} from '../src/lib/simple/calculation.ts';
import {calculateRetirementAnalysis} from '../src/lib/simple/retirement-analysis.ts';
import {generateSimplePrompt} from '../src/lib/simple/prompt.ts';
import {createPromptWorkspace} from '../src/lib/ai/prompt-input.ts';
import {formatWonAsKoreanCurrency} from '../src/lib/simple/currency.ts';
const today='2026-11-09';
function fixture(){const f=createSimpleInputs();f.benefits.civil.pensionEstimate=createPensionEstimateInput();Object.assign(f.profile,{birthDate:'1987-02-12',appointmentDate:'2017-04-01',step:'20',promotionMonth:'4',retirement:'early',earlyDate:'2039-08-31',military:'not'});return f;}
test('전체 평균: 직전1년이 아닌 퇴직전3년·각연도 물가·개시 환산을 분리',()=>{
 const a=projectWholeIncome(2029,2035,'2');assert.deepEqual(a.years.map(x=>x.year),[2026,2027,2028]);
 const mean=(5950000*1.02**2+5950000*1.03*1.02+5950000*1.03**2)/3;
 assert.ok(Math.abs(a.precedingYearWon-mean)<.000001);assert.equal(a.startWon,Math.round(mean*1.03**7));assert.notEqual(a.precedingYearWon,a.years.at(-1).nominalWon);
 assert.equal(a.years[0].state,'공식 확인값');assert.equal(a.years[1].state,'공식 통계에 근거한 추정값');
});
test('전체 평균: 물가0은 고정 가정이고 실제 과거 물가 누락은 차단',()=>{
 const a=projectWholeIncome(2039,2052);assert.equal(a.inflation,0);assert.ok(a.note.includes('기본0%'));assert.equal(projectWholeIncome(2028,2052).startWon,null);
 for(const raw of ['','-1','NaN','21','1e2']){const b=projectWholeIncome(2039,2052,raw);assert.equal(b.startWon,null);assert.ok(b.errors.length);assert.ok(b.inflation===null||Number.isFinite(b.inflation));}
});
test('인사혁신처 공식 소득재분배 숫자 사례: A400·B600→4999800, B200→3000000',()=>{
 assert.equal(redistributionPercent(6000000,4000000),83.33);assert.equal(Math.floor(6000000*8333/10000),4999800);
 assert.equal(redistributionPercent(2000000,4000000),150);assert.equal(2000000*150/100,3000000);
});
const percentages=[300,216.67,175,150,133.33,121.43,112.5,105.56,100,95.45,91.67,88.46,85.71,83.33,81.25];
for(let i=0;i<14;i++)test(`소득재분배 구간 ${(i+3)/10} 직전·정확히·직후`,()=>{
 const edge=(i+3)*1000000;assert.equal(redistributionPercent(edge-1,10000000),percentages[i]);assert.equal(redistributionPercent(edge,10000000),percentages[i+1]);assert.equal(redistributionPercent(edge+1,10000000),percentages[i+1]);
});
test('신규자 이행률: 매년 월수 경계·33년 표 상한은 연금36년 상한과 별도',()=>{
 for(let y=1;y<=33;y++){assert.equal(newEntrantFactor(y*12),newEntrantFactor(y*12-11));if(y<33)assert.notEqual(newEntrantFactor(y*12),newEntrantFactor(y*12+1));}
 assert.equal(newEntrantFactor(432),103.44);
});
test('기본정보 자동 월연금: 세 시나리오·변수 상태·별도 확인입력 오류를 노출하지 않음',()=>{
 const f=fixture(),r=calculateSimple(f,today);assert.equal(r.pensionSource,'teacher-model');assert.ok(r.pension.amountWon>0);assert.deepEqual(r.pension.errors,[]);
 assert.equal(r.teacherPension.rows.length,3);assert.ok(r.teacherPension.rows.every(s=>s.variables.some(v=>v.state==='미확인·계산 불가')&&s.variables.some(v=>v.label.includes('적용비율')&&v.value!==100)));
 assert.equal(r.pension.amountWon,r.teacherPension.selected.amountWon);assert.notEqual(r.teacherPension.assumedWholeIncomeWon,5950000);
 for(const s of r.teacherPension.rows){const b=s.variables.find(v=>v.label==='개인 평균소득 B (개시연도)').value,a=s.variables.find(v=>v.label==='공무원 전체 평균 A (개시연도)').value,c=s.variables.find(v=>v.label==='소득재분배 평균소득 (개시연도)').value;assert.equal(s.redistributionPercent,redistributionPercent(b,a));assert.equal(c,Number(BigInt(b)*BigInt(Math.round(s.redistributionPercent*100))/10000n));assert.ok(s.estimate.notes.every(n=>!n.startsWith('입력 평균소득은 2026년')));}
});
test('04·05·06 퇴직급여는 같은 선택 결과·미래 명목끼리만 합계',()=>{
 const f=fixture(),r=calculateSimple(f,today),b=r.benefitSummary,base=r.teacherBenefits.rows.find(s=>s.id==='base');
 assert.equal(b.nominal,true);assert.equal(b.allowance.amountWon,base.allowanceWon);assert.equal(b.honorary.amountWon,base.honoraryWon);assert.equal(b.totalWon,base.allowanceWon+base.honoraryWon);assert.equal(b.priceYear,2039);
 const a=calculateRetirementAnalysis(f,r);assert.equal(a.lumpItems.find(x=>x.label==='퇴직수당').won,b.allowance.amountWon);assert.equal(a.benefitsWon,b.totalWon);
 const p=generateSimplePrompt(f,{...createPromptWorkspace().settings,money:'exact'},today);assert.ok(p.includes('04·05 공통 선택'));assert.ok(p.includes('수당 합계 '+formatWonAsKoreanCurrency(b.totalWon)));assert.ok(!p.includes('사용자 확인 적용비율 %'));
});
test('정년 선택은 명퇴수당·참고 합계에 명퇴 금액 미포함',()=>{
 const f=fixture();f.profile.retirement='normal';const r=calculateSimple(f,today);assert.equal(r.benefitSummary.totalWon,r.benefitSummary.allowance.amountWon);assert.equal(r.benefitSummary.honorary.amountWon,null);
});
test('구기간·40호봉·산입군·특수경력은 금액 보류하되 정상 개시일 유지',()=>{
 for(const patch of [{appointmentDate:'2007-04-01',step:'33'},{step:'40'},{military:'approved'}]){const f=fixture();Object.assign(f.profile,patch);const r=calculateSimple(f,today);assert.equal(r.pension.amountWon,null);assert.ok(r.pensionStartDate);assert.ok(r.teacherPension.errors.length);}
 const f=fixture();f.benefits.civil.pensionEstimate.complexCareer=true;assert.equal(calculateSimple(f,today).pension.amountWon,null);
});
test('퇴직일·호봉·승급월·물가 변경은 재계산, 표시 반올림과 내부 원 합계 분리',()=>{
 const f=fixture(),r=calculateSimple(f,today);for(const patch of [{earlyDate:'2040-08-31'},{step:'21'},{promotionMonth:'12'}]){const g=structuredClone(f);Object.assign(g.profile,patch);const x=calculateSimple(g,today);assert.notEqual(x.pension.amountWon,r.pension.amountWon);assert.notEqual(x.benefitSummary.allowance.amountWon,r.benefitSummary.allowance.amountWon);}
 f.benefits.civil.pensionEstimate.simulationInflation='2';const x=calculateSimple(f,today);assert.notEqual(x.teacherPension.assumedWholeIncomeWon,r.teacherPension.assumedWholeIncomeWon);assert.equal(x.benefitSummary.totalWon,r.benefitSummary.totalWon);assert.equal(r.benefitSummary.totalWon%10000,(r.benefitSummary.allowance.amountWon+r.benefitSummary.honorary.amountWon)%10000);
});
