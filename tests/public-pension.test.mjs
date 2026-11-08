import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimpleInputs } from '../src/lib/simple/model.ts';
import { createPensionEstimateInput, emptyPension } from '../src/lib/simple/pension-types.ts';
import { calculateSimple } from '../src/lib/simple/calculation.ts';
import { estimateCivilPension, estimatePrivatePension, occupationalRate, occupationalCap } from '../src/lib/simple/occupational-pension.ts';
import { estimateNationalPension, nationalCoefficient, nationalA2026 } from '../src/lib/simple/national-pension.ts';
import { nationalPensionAge, occupationalPensionAge, birthAnniversary, setPensionTiming } from '../src/lib/simple/pension-dates.ts';
import { generateSimplePrompt } from '../src/lib/simple/prompt.ts';
import { createPromptWorkspace } from '../src/lib/ai/prompt-input.ts';
import { privacyFindings } from '../src/lib/ai/prompt-privacy.ts';
const today='2026-11-08';
function fixture(scheme='civil',appointment='2016-01-01',date='2026-12-31') {
  const f=createSimpleInputs();Object.assign(f.profile,{scheme,birthDate:'1980-05-10',appointmentDate:appointment,step:'22',promotionMonth:'3',retirement:'early',earlyDate:date,military:'not'});
  if(scheme==='national')Object.assign(f.profile,{manualNormal:true,normalDate:'2042-08-31'});
  f.benefits[scheme].pensionEstimate={...createPensionEstimateInput(),averageIncome:'4000000',redistributedIncome:'4000000',factorPercent:'100',legacyIncome:'3000000',confirmedRetirementDate:date,confirmedAppointmentDate:appointment};
  return f;
}
function estimate(f){return calculateSimple(f,today);}
for(const scheme of ['civil','private-school','national'])test(`${scheme} 공단 입력 없는 기본정보는 명시적 교원 모델과 확인 소득을 구분한다`,()=>{
  const f=fixture(scheme);delete f.benefits[scheme].pensionEstimate;const r=estimate(f);if(scheme==='civil'){assert.equal(r.pensionSource,'teacher-model');assert.ok(r.pension.amountWon>0);assert.match(r.pension.confidence,/가정 기반/);f.profile.teacherModel=false;assert.equal(estimate(f).pension.amountWon,null);}else assert.equal(r.pension.amountWon,null);assert.match(estimate(f).pension.errors.join(),/평균기준소득월액/);
  assert.ok(r.pensionDetails.sources.every(x=>/^https:\/\//.test(x.url)));assert.equal(r.pensionDetails.externalValidation,'외부 금액 검증 미완료');
});
for(const scheme of ['civil','private-school'])test(`${scheme} 2016년 이후 연도별 지급률 산술 · 개시일은 소득 누락에도 표시`,()=>{
  const f=fixture(scheme),r=estimate(f);assert.equal(r.pension.amountWon,788240);assert.deepEqual(r.pensionDetails.periods.map(x=>x.months),[0,0,132]);
  assert.equal(r.pensionDetails.normalAge,62);assert.equal(r.pensionDetails.normalStartDate,'2042-05-10');assert.equal(r.pensionDetails.firstPaymentMonth,'2042-05');
  f.benefits[scheme].pensionEstimate.averageIncome='';const missing=estimate(f);assert.equal(missing.pension.amountWon,null);assert.equal(missing.pensionStartDate,r.pensionStartDate);assert.ok(missing.pensionGapMonths>0);
});
for(const scheme of ['civil','private-school'])test(`${scheme} 2009년 이전·2010~2015·2016 이후 세 구간 및 구소득 누락`,()=>{
  const f=fixture(scheme,'2005-01-01'),r=estimate(f);assert.deepEqual(r.pensionDetails.periods.map(x=>x.months),[60,72,132]);
  assert.equal(r.pension.amountWon,375000+456000+788240);
  f.benefits[scheme].pensionEstimate.legacyIncome='';assert.equal(estimate(f).pension.amountWon,null);assert.match(estimate(f).pension.errors.join(),/평균보수월액/);
});
test('2010년 이후 신규 임용자는 구기간 소득 없이 평균소득·재분배·이행률로 계산',()=>{
  const f=fixture('civil','2010-01-01');f.benefits.civil.pensionEstimate.legacyIncome='';const r=estimate(f);assert.equal(r.pension.amountWon,456000+788240);assert.equal(r.pensionDetails.periods[0].months,0);
  const v=f.benefits.civil.pensionEstimate;v.factorPercent='';assert.equal(estimate(f).pension.amountWon,null);v.factorPercent='100';v.redistributedIncome='';assert.equal(estimate(f).pension.amountWon,null);
});
test('소득재분배 1%와 개인소득 초과분을 분리하고 종전액 비교 상한 적용',()=>{
  const f=fixture();f.benefits.civil.pensionEstimate.redistributedIncome='4500000';const r=estimate(f);assert.equal(r.pension.amountWon,836000);assert.match(r.pensionDetails.notes.join(),/비교 상한/);
  f.benefits.civil.pensionEstimate.redistributedIncome='3000000';assert.equal(estimate(f).pension.amountWon,678240);
});
test('지급률·재직 상한·30년 경계 및 신규 36년 상한을 분리한다',()=>{
  assert.equal(occupationalRate(2016),18780);assert.equal(occupationalRate(2026),17360);assert.equal(occupationalRate(2034),17040);assert.equal(occupationalRate(2050),17000);
  for(const [months,cap] of [[179,432],[180,420],[203,420],[204,408],[251,408],[252,396]])assert.equal(occupationalCap(months),cap);
  const f=fixture('civil','2016-01-01','2055-12-31');f.profile.birthDate='1995-05-10';const r=estimate(f);assert.equal(r.pensionDetails.months,432);assert.equal(r.pensionDetails.capMonths,432);
  const v=f.benefits.civil.pensionEstimate;v.redistributedIncome='3000000';const lower=estimate(f);assert.equal(r.pension.amountWon-lower.pension.amountWon,300000); // 30 years * 1% * 100만원 only
  const old=fixture('civil','1999-01-01','2035-12-31');assert.equal(estimate(old).pension.amountWon,null);assert.match(estimate(old).pension.errors.join(),/33년 초과/);
});
test('현재 소득만으로 평균소득을 확정하지 않으며 명시적 고정 시나리오를 구분',()=>{
  const f=fixture(),v=f.benefits.civil.pensionEstimate;v.incomeMode='current';v.currentIncome='4000000';let r=estimate(f);assert.equal(r.pension.amountWon,null);assert.match(r.pension.errors.join(),/명시적/);
  v.constantIncome=true;r=estimate(f);assert.equal(r.pension.amountWon,788240);assert.match(r.pensionDetails.method,/가정 시나리오/);
  v.currentIncome='-1';assert.equal(estimate(f).pension.amountWon,null);
});
test('군복무 승인만으로 기간을 만들지 않고 실제 산입연도 지급률 적용',()=>{
  const f=fixture(),base=estimate(f).pension.amountWon;f.profile.military='approved';assert.equal(estimate(f).pension.amountWon,null);
  Object.assign(f.benefits.civil.pensionEstimate,{militaryMonths:'24',militaryCreditYear:'2020'});const r=estimate(f);assert.equal(r.pensionDetails.months,156);assert.equal(r.pension.amountWon,base+143200);
  f.benefits.civil.pensionEstimate.militaryCreditYear='2009';assert.equal(estimate(f).pension.amountWon,null);
});
test('군복무로 2016년 인정 상한 구간이 바뀔 수 있으면 당시 공단 인정기간을 요구',()=>{
  const f=fixture('civil','2000-01-01','2030-12-31');f.profile.military='approved';Object.assign(f.benefits.civil.pensionEstimate,{militaryMonths:'24',militaryCreditYear:'2020'});
  let r=estimate(f);assert.equal(r.pension.amountWon,null);assert.match(r.pension.errors.join(),/2016년 1월 1일/);
  f.benefits.civil.pensionEstimate.recognizedAt2016='216';r=estimate(f);assert.equal(r.pensionDetails.capMonths,408);assert.ok(r.pension.amountWon>0);
});
test('정년과 명퇴, 2029/2030 및 퇴직 전날 연도 경계와 1995년 이전 경과를 구분',()=>{
  assert.equal(occupationalPensionAge('2029-12-31'),63);assert.equal(occupationalPensionAge('2030-01-01'),63);assert.equal(occupationalPensionAge('2030-01-02'),64);assert.equal(occupationalPensionAge('2033-01-02'),65);
  const early=fixture('civil','2005-01-01','2031-08-31');assert.equal(estimate(early).pensionDetails.normalAge,64);
  early.profile.retirement='normal';assert.equal(estimate(early).pensionDetails.normalAge,65);
  const old=fixture('civil','1995-03-01','2027-02-28');let r=estimate(old);assert.equal(r.pensionDetails.normalStartDate,null);assert.equal(r.pensionDetails.normalAge,null);
  old.benefits.civil.pensionEstimate.verifiedNormalDate='2027-02-28';r=estimate(old);assert.equal(r.pensionDetails.normalStartDate,'2027-02-28');assert.equal(r.pensionDetails.firstPaymentMonth,'2027-03');
});
test('직역연금은 연령 도달월 지급·재직월 제외, 국민연금은 수급권 발생 다음 달 지급',()=>{
  const r=emptyPension();setPensionTiming(r,'2027-03-01','2027-03-01','occupational');assert.equal(r.firstPaymentMonth,'2027-03');
  setPensionTiming(r,'2027-03-02','2027-03-02','occupational');assert.equal(r.firstPaymentMonth,'2027-04');
  setPensionTiming(r,'2027-03-31','2028-05-10','occupational');assert.equal(r.firstPaymentMonth,'2028-05');
  setPensionTiming(r,'2027-03-31','2028-05-10','national');assert.equal(r.firstPaymentMonth,'2028-06');
});
test('퇴직일 변경은 기간·개시연령을 다시 계산하고 과거 소득/계수 확인은 무효화',()=>{
  const f=fixture('civil','2010-01-01','2029-12-31'),before=estimate(f);f.profile.earlyDate='2030-01-02';let after=estimate(f);assert.equal(after.pension.amountWon,null);assert.match(after.pension.errors.join(),/다시 확인/);assert.equal(after.pensionDetails.normalAge,64);
  f.benefits.civil.pensionEstimate.confirmedRetirementDate='2030-01-02';after=estimate(f);assert.ok(after.pension.amountWon>before.pension.amountWon);assert.ok(after.pensionGapMonths>before.pensionGapMonths);
});
test('특수 경력·기간 미달·금액/계수 비정상은 실제 0원과 구분',()=>{
  const f=fixture();f.benefits.civil.pensionEstimate.complexCareer=true;assert.equal(estimate(f).pension.amountWon,null);
  const short=fixture('civil','2020-01-01');assert.equal(estimate(short).pension.amountWon,null);assert.match(estimate(short).pension.errors.join(),/10년/);
  for(const raw of ['0','-1','NaN','100.00001','201']){f.benefits.civil.pensionEstimate.complexCareer=false;f.benefits.civil.pensionEstimate.factorPercent=raw;assert.equal(estimate(f).pension.amountWon,null);}
});
function nationalFixture(income='3000000',years=20){
  const p={...fixture('national').profile,birthDate:'2001-05-10',appointmentDate:'2024-03-01',military:'unknown'};
  const v={...createPensionEstimateInput(),averageIncome:income,nationalStartMonth:'2026-01',nationalAutomaticEnd:false,nationalEndMonth:`${2025+years}-12`,confirmedRetirementDate:'2065-12-31',confirmedAppointmentDate:p.appointmentDate};
  return {p,v,date:'2065-12-31'};
}
test('국민연금 2026 공단 월액표 대표 10·20·30·40년 숫자 사례 대조 (개인 지급액 검증과 구분)',()=>{
  for(const [years,expected] of [[10,332900],[20,665800],[30,998700],[40,1331600]]){
    const {p,v,date}=nationalFixture('3000000',years),r=estimateNationalPension(p,v,date);assert.deepEqual(r.errors,[]);assert.equal(r.amountWon,expected);assert.equal(r.externalValidation,'외부 금액 검증 미완료');
  }
  const {p,v,date}=nationalFixture('410000',25);let r=estimateNationalPension(p,v,date);assert.equal(r.amountWon,null);assert.match(r.errors.join(),/최종 5년/);
  v.nationalLastFiveIncome='410000';r=estimateNationalPension(p,v,date);assert.equal(r.amountWon,410000);assert.match(r.notes.join(),/월액 상한/);
});
test('국민연금 시기별 상수, 2025/2026 개정 경계와 1988~1998 개인소득 0.75',()=>{
  assert.equal(nationalA2026,3193511);for(const [year,c] of [[1987,0],[1988,2400],[1998,2400],[1999,1800],[2007,1800],[2008,1500],[2025,1245],[2026,1290],[2050,1290]])assert.equal(nationalCoefficient(year),c);
  const {p,v,date}=nationalFixture();p.birthDate='1960-05-10';v.nationalStartMonth='1988-01';v.nationalEndMonth='2007-12';v.averageIncome='3000000';
  const r=estimateNationalPension(p,v,date);const expected=Math.floor((2.4*(3193511+.75*3000000)*132+1.8*(3193511+3000000)*108)/240/12/10)*10;assert.equal(r.amountWon,expected);
});
test('국민연금 최초 납부월은 교사 임용일과 별개 · 퇴직 전 정상 수령 가능',()=>{
  const f=fixture('national','2005-03-01','2027-02-28');f.profile.birthDate='1960-05-10';const v=f.benefits.national.pensionEstimate;
  Object.assign(v,{nationalStartMonth:'1990-01',nationalAutomaticEnd:false,nationalEndMonth:'2019-12'});let r=estimate(f);assert.equal(r.pensionDetails.normalAge,62);assert.equal(r.pensionStartDate,'2022-06-01');assert.equal(r.pensionGapMonths,0);assert.ok(r.pension.amountWon>0);
  f.profile.appointmentDate='2010-03-01';v.confirmedAppointmentDate=f.profile.appointmentDate;r=estimate(f);assert.equal(r.pensionDetails.months,360);
  v.nationalStartMonth='';r=estimate(f);assert.equal(r.pension.amountWon,null);assert.match(r.pension.errors.join(),/임용일과 별도/);
});
test('국민연금 출생연도별 정상/조기 연령, 윤일 및 10년 미달',()=>{
  for(const [year,age] of [[1952,60],[1953,61],[1956,61],[1957,62],[1960,62],[1961,63],[1964,63],[1965,64],[1968,64],[1969,65]])assert.equal(nationalPensionAge(year),age);
  assert.equal(birthAnniversary('1980-02-29',65),'2045-02-28');
  const {p,v,date}=nationalFixture();v.nationalEndMonth='2035-11';const r=estimateNationalPension(p,v,date);assert.equal(r.amountWon,null);assert.match(r.errors.join(),/120개월/);assert.equal(r.earlyAge,60);
});
test('국민연금은 기본 자동 종료월을 퇴직일과 함께 갱신하고 60세 이후를 자동 연장하지 않는다',()=>{
  const {p,v}=nationalFixture();v.nationalAutomaticEnd=true;let r=estimateNationalPension(p,{...v,confirmedRetirementDate:'2035-12-31'},'2035-12-31');assert.equal(r.months,120);
  r=estimateNationalPension(p,v,'2065-12-31');assert.equal(r.months,424); // 2026-01..2061-04, before 60th birthday month
});
test('국민연금 크레딧은 공단 인정 개월만 반영 · 공무원 군 산입과 분리',()=>{
  const {p,v,date}=nationalFixture('3000000',10);const base=estimateNationalPension(p,v,date).amountWon;p.military='approved';assert.equal(estimateNationalPension(p,v,date).amountWon,base);
  v.nationalMilitaryMonths='12';let r=estimateNationalPension(p,v,date);assert.equal(r.months,132);assert.ok(r.amountWon>base);
  v.nationalMilitaryMonths='13';assert.equal(estimateNationalPension(p,v,date).amountWon,null);
});
test('국민연금 유효하지 않은 납부월·생전 가입·미래 납부 중복·개시 이후 납부 차단',()=>{
  const {p,v,date}=nationalFixture();for(const start of ['1987-12','2026-13','bad','2001-05'])assert.equal(estimateNationalPension(p,{...v,nationalStartMonth:start},date).amountWon,null);
  assert.equal(estimateNationalPension(p,{...v,nationalEndMonth:'2066-05'},date).amountWon,null);
  const older={...p,birthDate:'1960-05-10'};assert.equal(estimateNationalPension(older,{...v,nationalStartMonth:'1990-01',nationalEndMonth:'2024-12'},date).amountWon,null);
});
test('종합·AI는 자동 금액·정상 개시·공백·가정·한계와 익명화를 함께 반영',()=>{
  const f=fixture(),r=estimate(f),settings={...createPromptWorkspace().settings,money:'exact'};
  const prompt=generateSimplePrompt(f,settings,today);assert.ok(prompt);assert.match(prompt,/79만원/);assert.match(prompt,/외부 금액 검증 미완료/);assert.match(prompt,/정상 개시연령 만 62세/);assert.match(prompt,/소득 공백/);assert.doesNotMatch(prompt,/1980-05-10|2016-01-01|2042-06-01/);assert.equal(r.accumulationTotal,null);assert.deepEqual(privacyFindings(prompt,settings),[]);
  const q=f.benefits.civil.pension;Object.assign(q,{money:{amount:'1234567',unit:'won'},queryDate:today,retirementDate:f.profile.earlyDate,startDate:'2042-06-01',source:'official',taxBasis:'net'});
  const manual=estimate(f);assert.equal(manual.pensionSource,'quote');assert.equal(manual.pension.amountWon,1234567);q.retirementDate='2030-01-01';assert.equal(estimate(f).pension.amountWon,null);q.money.amount='';assert.equal(estimate(f).pension.amountWon,788240);
});
test('소득을 모르는 기존 사용자도 익명화 요청문을 생성·편집·복사할 수 있다',()=>{
  const f=fixture('civil','2005-03-01','2030-11-08');delete f.benefits.civil.pensionEstimate;const settings=createPromptWorkspace().settings;
  for(const money of ['round','range','exact']){const s={...settings,money};const text=generateSimplePrompt(f,s,today);assert.deepEqual(privacyFindings(text+'\n투자 위험을 더 설명해 주세요.',s),[]);}
});
