import test from 'node:test';
import assert from 'node:assert/strict';
import { contributionSchedule, growthFactor } from '../src/lib/simple/account-schedule.ts';
import { calculateAccount, calculateSimple } from '../src/lib/simple/calculation.ts';
import { estimateHonorary, estimateAllowance, honoraryMultiplier, allowanceRate, serviceCalendarMonths } from '../src/lib/simple/benefit-estimates.ts';
import { createSimpleInputs } from '../src/lib/simple/model.ts';
import { generateSimplePrompt } from '../src/lib/simple/prompt.ts';
import { createPromptWorkspace } from '../src/lib/ai/prompt-input.ts';
const today='2026-11-08';
function fixture(){const f=createSimpleInputs();Object.assign(f.profile,{birthDate:'1980-05-10',appointmentDate:'2010-03-01',step:'22',promotionMonth:'3',retirement:'early',earlyDate:'2031-08-31'});for(const key of ['irp','saving'])Object.assign(f[key],{balance:'0',monthly:'500000',annual:'6000000'});return f;}

test('연600만원 월납과 12월 말 연납은 원금은 같고 미래가치는 다르다',()=>{
  const start='2026-01-01',end='2026-12-31',a={balance:'0',monthly:'500000',annual:'6000000'};
  const m=calculateAccount(a,end,start,7),y=calculateAccount({...a,cycle:'yearly'},end,start,7);
  assert.equal(m.deposits,6000000);assert.equal(y.deposits,6000000);assert.equal(y.amountWon,6000000);assert.ok(m.amountWon>y.amountWon);
  const days=[334,306,275,245,214,184,153,122,92,61,31,0];
  assert.equal(m.amountWon,days.reduce((sum,d)=>sum+Math.round(500000*1.07**(d/365)),0));
});
test('첫해·마지막 해는 실제 월말만 납입하고 연납은 퇴직 후 12월에 넣지 않는다',()=>{
  const a={balance:'0',monthly:'1',annual:'12'};
  assert.deepEqual(contributionSchedule(a,'2026-11-08','2027-02-27').map(r=>r.date),['2026-11-30','2026-12-31','2027-01-31']);
  assert.deepEqual(contributionSchedule({...a,cycle:'yearly'},'2026-11-08','2027-02-28'),[{date:'2026-12-31',won:12}]);
  assert.deepEqual(contributionSchedule(a,'2028-02-29','2028-03-30'),[]);
  assert.deepEqual(contributionSchedule(a,'2028-02-01','2028-02-29'),[{date:'2028-02-29',won:1}]);
  assert.equal(calculateAccount({...a,cycle:'yearly'},'2027-06-30','2027-01-01',7).deposits,0);
});
test('부분 월·윤년 복리·연 경계·잘못된 입력·0기간을 구분한다',()=>{
  assert.equal(growthFactor('2028-01-01','2029-01-01',8),1.08);
  assert.ok(Math.abs(growthFactor('2027-12-31','2028-01-02',7)-1.07**(1/365+1/366))<1e-12);
  assert.equal(calculateAccount({balance:'1000000',monthly:'0'},'2028-02-15','2028-02-01',7).amountWon,Math.round(1000000*1.07**(14/366)));
  assert.equal(calculateAccount({balance:'1',monthly:'',cycle:'yearly',annual:'0'},today,today,7).amountWon,1);
  for(const a of [{balance:'0',monthly:'1',cycle:'bad'},{balance:'0',monthly:'1',cycle:'yearly',annual:''},{balance:'0',monthly:'-1'}])assert.equal(calculateAccount(a,'2027-01-01',today,7).amountWon,null);
});
test('주기가 다른 계좌의 실제 연도별 합산 한도와 누락 계좌',()=>{
  const f=fixture();f.profile.earlyDate='2027-02-28';f.irp.cycle='yearly';f.irp.annual='18000000';f.saving.monthly='1';
  assert.equal(calculateSimple(f,today).accountsTotal,null);
  f.saving.monthly='0';assert.notEqual(calculateSimple(f,today).accountsTotal,null);
  f.irp.annual='18000001';assert.equal(calculateSimple(f,today).accountsTotal,null);
  f.irp.annual='18000000';f.saving.monthly='';assert.equal(calculateSimple(f,today).saving.amountWon,null);
});
test('참고 재투자는13.2%·연도별 한도·차년도5월·퇴직일 제한 적용',()=>{
  const f=fixture();f.profile.earlyDate='2028-06-30';f.reinvest=true;f.taxIncome='50000000';f.taxCapacity='2000000';
  const r=calculateSimple(f,today);
  assert.equal(r.taxCredits['2026'],264000); // 200만원 * 13.2%
  assert.deepEqual(r.reinvestments,[{date:'2027-05-31',won:264000},{date:'2028-05-31',won:1188000}]);
  assert.ok(r.reinvestEffect>1452000);assert.equal(r.irp.deposits,10000000+1452000);
  f.profile.earlyDate='2027-05-30';assert.deepEqual(calculateSimple(f,today).reinvestments,[]);
  f.profile.earlyDate='2027-05-31';assert.deepEqual(calculateSimple(f,today).reinvestments,[{date:'2027-05-31',won:264000}]);
  f.taxCapacity='0';assert.equal(calculateSimple(f,today).reinvestEffect,264000); // legacy input ignored
  f.taxCapacity='';assert.equal(calculateSimple(f,today).reinvestEffect,264000);
});
test('재투자 포함 납입한도 초과는 기본 결과를 보존하고 효과를 차단한다',()=>{
  const f=fixture();f.irp.monthly='1000000';f.saving.monthly='500000';const before=calculateSimple(f,today);f.reinvest=true;f.taxIncome='50000000';f.taxCapacity='2000000';const r=calculateSimple(f,today);
  assert.match(r.reinvestError,/1,800만원/);assert.equal(r.accountsTotal,before.accountsTotal);assert.equal(r.reinvestEffect,null);assert.deepEqual(r.reinvestments,[]);
});
test('명퇴 1년·5년·10년 경계의 배수 및 최대 상한',()=>{
  for(const [m,mult] of [[11,null],[12,12],[13,13],[60,60],[61,60.5],[120,90],[121,90],[240,90]])assert.equal(honoraryMultiplier(m),mult);
  const f=fixture(),p={...f.profile,appointmentDate:'2000-03-01'};
  for(const [normal,m,expected] of [['2032-08-31',12,19693344],['2036-08-31',60,98466720],['2041-08-31',120,147700080],['2042-08-31',132,147700080]]){
    const r=estimateHonorary(p,'2031-08-31',normal,30);assert.equal(r.months,m);assert.equal(r.amountWon,expected);
  }
});
test('명퇴 신분·20년·1년 미만·비월말 정년·호봉 누락은 확정하지 않는다',()=>{
  const f=fixture(),p=f.profile;
  assert.equal(estimateHonorary(p,'2031-08-31','2042-08-31',30).amountWon,147700080);
  for(const scheme of ['private-school','national'])assert.equal(estimateHonorary({...p,scheme},'2031-08-31','2042-08-31',30).amountWon,null);
  for(const [date,normal,step] of [['2029-08-31','2042-08-31',30],['2031-08-31','2032-08-30',30],['2031-08-31','2042-08-30',30],['2031-08-31','2042-08-31',null]])assert.equal(estimateHonorary(p,date,normal,step).amountWon,null);
});
test('수당 재직 월 계산은 임용월 포함·퇴직일 전날 기준이다',()=>{
  assert.equal(serviceCalendarMonths('2010-03-01','2011-03-01'),12);
  assert.equal(serviceCalendarMonths('2010-03-31','2011-03-31'),13);
  assert.equal(serviceCalendarMonths('2028-02-29','2028-03-01'),1);
});
test('공무원·사학 퇴직수당 지급률 모든 경계와 33년 상한',()=>{
  for(const [months,rate] of [[11,null],[12,.065],[59,.065],[60,.2275],[119,.2275],[120,.2925],[179,.2925],[180,.325],[239,.325],[240,.39],[396,.39]]){
    assert.equal(allowanceRate(months),rate);
    for(const scheme of ['civil','private-school']){
      const p={...fixture().profile,scheme};const date='2050-03-01';const r=estimateAllowance(p,{...fixture().benefits[scheme],income:'6000000',recognizedMonths:String(months),recognizedDate:date},date);
      assert.equal(r.amountWon,rate===null?null:6000000*months/12*rate);
    }
  }
  const f=fixture();f.benefits.civil.income='6000000';const r=estimateAllowance(f.profile,f.benefits.civil,'2050-03-01');assert.equal(r.months,396);assert.equal(r.amountWon,77220000);
});
test('구법 소득을 대체하지 않고 병역 산입 상태를 퇴직수당에 더하지 않는다',()=>{
  const f=fixture();f.benefits.civil.income='6000000';let r=calculateSimple(f,today);assert.equal(r.allowance.amountWon,50310000);
  f.profile.military='approved';assert.equal(calculateSimple(f,today).allowance.amountWon,r.allowance.amountWon);
  f.profile.appointmentDate='2009-12-31';r=calculateSimple(f,today);assert.equal(r.allowance.amountWon,null);assert.match(r.allowance.errors.join(),/2009년 이전/);
  f.profile.appointmentDate='2010-03-01';f.benefits.civil.recognizedMonths='100';f.benefits.civil.recognizedDate='2030-08-31';assert.equal(calculateSimple(f,today).allowance.amountWon,null);
});
test('새 결과의 종합·기존 요청문 정합성: 구 조회 세금과 섞지 않는다',()=>{
  const f=fixture();f.benefits.civil.income='6000000';f.irp.cycle='yearly';const r=calculateSimple(f,today);assert.equal(r.benefitsTotal,r.honorary.amountWon+r.allowance.amountWon);
  const prompt=generateSimplePrompt(f,createPromptWorkspace().settings,today);assert.match(prompt,/12월 말 연납/);assert.match(prompt,/2026년 봉급표/);assert.match(prompt,/ACT\/ACT/);assert.doesNotMatch(prompt,/완료 월 계산 후 퇴직일까지 추가 납입·수익 없음/);
});
