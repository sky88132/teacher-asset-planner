import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimpleInputs } from '../src/lib/simple/model.ts';
import { calculateSimple, calculateAccount, firstSplitDate, sumKnown } from '../src/lib/simple/calculation.ts';
import { normalRetirementCandidate, projectedStep, resolveRetirement, validateSimpleProfile } from '../src/lib/simple/validation.ts';
import { simpleConfig, teacherSalary2026 } from '../src/lib/simple/config.ts';
import { createPromptWorkspace } from '../src/lib/ai/prompt-input.ts';
import { generateSimplePrompt, simpleAnalyses } from '../src/lib/simple/prompt.ts';
const today = '2026-11-08';
function fixture() {
  const f = createSimpleInputs(); Object.assign(f.profile, { birthDate:'1980-05-10', appointmentDate:'2005-03-01', step:'22',promotionMonth:'3',manualNormal:true,normalDate:'2030-11-08' });
  Object.assign(f.ktcu,{balance:'1000000',monthly:'100000'}); Object.assign(f.irp,{balance:'2000000',monthly:'200000'}); Object.assign(f.saving,{balance:'3000000',monthly:'300000'}); return f;
}
function quote(f, kind, amount, tax='gross') { Object.assign(f.benefits[f.profile.scheme][kind], {money:{amount:String(amount),unit:'won'},queryDate:today,retirementDate:resolveRetirement(f.profile,today).date,startDate:'2035-01-01',source:'official',taxBasis:tax}); }

test('간편 모드는 학교 구분 없이 세 연금제도를 별도 보관한다',()=>{
  const f=fixture();assert.equal('schoolType' in f.profile,false);assert.deepEqual(Object.keys(f.benefits),['civil','private-school','national']);
  quote(f,'pension',123);f.profile.scheme='private-school';assert.equal(calculateSimple(f,today).pension.amountWon,null);f.profile.scheme='civil';assert.equal(calculateSimple(f,today).pension.amountWon,123);
});
test('기본정보 필수·호봉·승급월·날짜 오류를 검증한다',()=>{
  assert.ok(validateSimpleProfile(createSimpleInputs().profile,today).length);const f=fixture();assert.deepEqual(validateSimpleProfile(f.profile,today),[]);
  for(const step of ['','0','41','22.5','NaN']) {f.profile.step=step;assert.ok(validateSimpleProfile(f.profile,today).some(e=>e.includes('호봉')));}
  f.profile.step='22';f.profile.promotionMonth='13';assert.ok(validateSimpleProfile(f.profile,today).some(e=>e.includes('승급월')));
});
test('정년 62세·3/8월·9/2월 경계와 윤일 후보를 계산한다',()=>{
  for(const [birth,date] of [['1980-03-01','2042-08-31'],['1980-08-31','2042-08-31'],['1980-09-01','2043-02-28'],['1980-02-01','2042-02-28'],['1980-02-29','2042-02-28'],['1982-12-30','2045-02-28']]) assert.equal(normalRetirementCandidate(birth),date);
  assert.equal(normalRetirementCandidate('1980-02-30'),null);
});
test('승급월 이전·이후·당일은 현재 호봉과 미래 승급을 중복 반영하지 않는다',()=>{
  const p=fixture().profile;
  assert.equal(projectedStep(p,'2027-02-28','2026-11-08'),22);assert.equal(projectedStep(p,'2027-03-01','2026-11-08'),23);
  assert.equal(projectedStep(p,'2026-12-31','2026-03-01'),22);assert.equal(projectedStep(p,'2027-03-01','2026-03-01'),23);
  assert.equal(projectedStep({...p,step:'39'},'2030-11-08',today),40);
});
test('군복무 승인 상태는 자동 인정기간이나 소득을 추가하지 않는다',()=>{
  const f=fixture(),before=calculateSimple(f,today);f.profile.military='approved';const after=calculateSimple(f,today);assert.equal(after.serviceMonths,before.serviceMonths);assert.equal(after.allowance.amountWon,null);assert.equal(after.ktcu.amountWon,before.ktcu.amountWon);
});
test('국민연금은 정년과 공무원·사학 수당 엔진을 자동 적용하지 않는다',()=>{
  const f=fixture();f.profile.scheme='national';f.profile.manualNormal=false;assert.equal(resolveRetirement(f.profile,today).date,null);
  f.profile.manualNormal=true;quote(f,'allowance',123);assert.equal(calculateSimple(f,today).allowance.amountWon,null);quote(f,'pension',321);assert.equal(calculateSimple(f,today).pension.amountWon,321);
});
test('명퇴일은 정년보다 엄격히 빨라야 하며 잘못된 날짜를 거부한다',()=>{
  const f=fixture();f.profile.retirement='early';for(const date of ['2030-11-08','2030-11-09','2027-02-30','2025-01-01']) {f.profile.earlyDate=date;assert.equal(resolveRetirement(f.profile,today).date,null);}
  f.profile.earlyDate='2028-11-08';assert.equal(resolveRetirement(f.profile,today).date,'2028-11-08');f.profile.retirement='normal';assert.equal(resolveRetirement(f.profile,today).date,'2030-11-08');
});
test('공통 퇴직일이 바뀌면 세 계좌·호봉·조회액 유효성이 즉시 바뀐다',()=>{
  const f=fixture();quote(f,'pension',450);quote(f,'allowance',1000);const before=calculateSimple(f,today);f.profile.normalDate='2031-11-08';const after=calculateSimple(f,today);
  for(const key of ['ktcu','irp','saving'])assert.ok(after[key].amountWon>before[key].amountWon);assert.ok(after.step>before.step);assert.equal(after.pension.amountWon,null);assert.equal(after.allowance.amountWon,null);assert.match(after.pension.errors.join(),/재확인/);
});
test('현재 조회잔액만 사용하며 공제회 연 5%는 미래 고정 가정이다',()=>{
  const f=fixture(),r=calculateSimple(f,today);assert.equal(r.accumulation.result.effectiveAnnualRate,5);assert.equal(r.ktcu.initial,1000000);assert.equal(r.ktcu.deposits,4800000);
  assert.equal(r.ktcu.amountWon,r.ktcu.initial+r.ktcu.deposits+r.ktcu.gain);
});
test('IRP 7%·연금저축 8%의 수학적 미래가치와 원 단위를 검증한다',()=>{
  for(const rate of [7,8]){const r=calculateAccount({balance:'1000000',monthly:'0'},'2027-11-08',today,rate);assert.ok(Math.abs(r.amountWon-1000000*(1+rate/100))<=6);assert.ok(Number.isSafeInteger(r.amountWon));assert.equal(r.deposits,0);}
  const f=fixture(),r=calculateSimple(f,today);assert.equal(simpleConfig.irpRate,7);assert.equal(simpleConfig.savingRate,8);
  for(const key of ['irp','saving']){const a=r[key];assert.equal(a.initial+a.deposits+a.gain,a.amountWon);assert.equal(a.initialFuture+a.depositsFuture,a.amountWon);}
});
test('빈 금액·명시적 0원·0개월은 서로 다르게 처리한다',()=>{
  const f=fixture();for(const key of ['ktcu','irp','saving'])Object.assign(f[key],{balance:'0',monthly:'0'});let r=calculateSimple(f,today);assert.equal(r.accumulationTotal,0);f.irp.balance='';r=calculateSimple(f,today);assert.equal(r.irp.amountWon,null);assert.equal(r.accumulationTotal,null);
  assert.equal(calculateAccount({balance:'123',monthly:'100'},today,today,7).amountWon,123);assert.equal(calculateAccount({balance:'0',monthly:'0'},'2026-12-08',today,7).amountWon,0);
});
test('비정상 금액·범위 초과·한도 초과를 차단한다',()=>{
  for(const raw of ['-1','0.1','NaN','9007199254740992'])assert.equal(calculateAccount({balance:raw,monthly:'0'},'2028-11-08',today,7).amountWon,null);
  const f=fixture();f.irp.monthly='1000000';f.saving.monthly='600000';assert.equal(calculateSimple(f,today).accountsTotal,null);
  f.saving.monthly='500000';assert.notEqual(calculateSimple(f,today).accountsTotal,null);
});
test('분할 기간 5~30년·첫 25일·마지막 정산과 총액을 검증한다',()=>{
  for(const [date,expected] of [['2026-03-01','2026-04-25'],['2026-03-25','2026-04-25'],['2026-03-26','2026-05-25'],['2028-01-31','2028-03-25'],['2026-12-31','2027-02-25']])assert.equal(firstSplitDate(date),expected);
  const f=fixture();f.ktcu.split=true;
  for(const years of [5,10,15,20,25,30]){f.ktcu.years=String(years);const r=calculateSimple(f,today);assert.equal(r.split.rows.length,years*12);assert.ok(r.split.rows.every(row=>row.date.endsWith('-25')));assert.equal(r.split.rows.at(-1).balanceWon,0);assert.equal(r.split.rows.reduce((n,row)=>n+row.paymentWon,0),r.split.totalWon);assert.equal(r.split.totalWon,r.ktcu.amountWon+r.split.growthWon);}
});
test('일시금·분할 총액은 적립금 합계에 중복 합산하지 않는다',()=>{
  const f=fixture(),before=calculateSimple(f,today);f.ktcu.split=true;const after=calculateSimple(f,today);assert.equal(after.accumulationTotal,before.accumulationTotal);assert.equal(after.accumulationTotal,after.ktcu.amountWon+after.irp.amountWon+after.saving.amountWon);
});
test('재투자 체크는 유지하되 미확인 환급을 0원 또는 추가 자산으로 만들지 않는다',()=>{
  const f=fixture(),before=calculateSimple(f,today);f.reinvest=true;const after=calculateSimple(f,today);assert.equal(after.accountsTotal,before.accountsTotal);assert.equal(after.accumulationTotal,before.accumulationTotal);
  const text=generateSimplePrompt(f,createPromptWorkspace().settings,today);assert.match(text,/선택했으나/);assert.match(text,/0원 확정 아님/);
});
test('급여 합계는 두 자동 추정이 같은 가격·세전 기준에서 가능한 경우만 제공한다',()=>{
  const f=fixture();Object.assign(f.profile,{retirement:'early',appointmentDate:'2010-03-01',earlyDate:'2031-08-31',normalDate:'2042-08-31'});
  let r=calculateSimple(f,today);assert.equal(r.benefitsTotal,null);assert.ok(r.honorary.amountWon>0);
  f.benefits.civil.income='6000000';r=calculateSimple(f,today);assert.equal(r.benefitsTotal,r.allowance.amountWon+r.honorary.amountWon);
  assert.match(r.honorary.confidence,/지급 미확정/);
  // Removed quote/selection fields do not control automatic results.
  quote(f,'honorary',200,'net');f.benefits.civil.selection='rejected';assert.equal(calculateSimple(f,today).benefitsTotal,r.benefitsTotal);
  f.benefits.civil.income='';assert.equal(calculateSimple(f,today).benefitsTotal,null);
});
test('월연금을 적립금·수당 합계에 더하지 않는다',()=>{
  const f=fixture(),before=calculateSimple(f,today);quote(f,'pension',4500000);const after=calculateSimple(f,today);assert.equal(after.pension.amountWon,4500000);assert.equal(after.accumulationTotal,before.accumulationTotal);assert.equal(after.benefitsTotal,before.benefitsTotal);
});
test('기본정보만으로 6개 목적의 요청문을 생성하고 금융 누락을 유지한다',()=>{
  const f=fixture();for(const key of ['ktcu','irp','saving'])Object.assign(f[key],{balance:'',monthly:''});assert.equal(Object.keys(simpleAnalyses).length,6);
  for(const analysis of Object.keys(simpleAnalyses)){const s={...createPromptWorkspace().settings,analysis};const text=generateSimplePrompt(f,s,today);assert.match(text,/미입력 또는 계산 불가/);assert.match(text,/22호봉/);assert.match(text,/공무원연금/);assert.doesNotMatch(text,/1980-05-10|2005-03-01/);}
  f.profile.step='';assert.equal(generateSimplePrompt(f,createPromptWorkspace().settings,today),null);
});
test('AI 금액은 현재 결과와 반올림을 사용하며 식별 필드·자유 메모를 내보내지 않는다',()=>{
  const f=fixture();f.profile.name='홍길동';f.profile.account='123456789123';f.benefits.civil.pension.assumptions='학교명: 가나다초등학교';quote(f,'pension',1234567);
  const text=generateSimplePrompt(f,createPromptWorkspace().settings,today);assert.match(text,/약 1,200,000원/);assert.doesNotMatch(text,/홍길동|123456789123|가나다초등학교|1980-05-10|2005-03-01/);
  f.profile.normalDate='2031-11-08';assert.match(generateSimplePrompt(f,createPromptWorkspace().settings,today),/재확인 필요/);
});
test('공식 2026 봉급표의 숫자와 상한을 대조하되 미래 봉급 산식으로 쓰지 않는다',()=>{
  assert.equal(teacherSalary2026.length,40);assert.equal(teacherSalary2026[21],3733600);assert.equal(teacherSalary2026[39],6205700);
});
test('합산은 시점 불일치·범위 초과를 0원 대신 null로 반환한다',()=>{
  const a=calculateAccount({balance:'1',monthly:'0'},today,today,7);assert.equal(sumKnown([a,{...a,date:'2030-01-01'}],today),null);assert.equal(sumKnown([{...a,amountWon:Number.MAX_SAFE_INTEGER},a],today),null);
});
test('입력과 보존된 제도별 조회값을 계산 함수가 변경하지 않는다',()=>{
  const f=fixture(),copy=structuredClone(f);calculateSimple(f,today);generateSimplePrompt(f,createPromptWorkspace().settings,today);assert.deepEqual(f,copy);
});
