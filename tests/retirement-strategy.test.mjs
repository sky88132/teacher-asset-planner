import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimpleInputs } from '../src/lib/simple/model.ts';
import { calculateSimple } from '../src/lib/simple/calculation.ts';
import { createAccountReceiptInput } from '../src/lib/simple/account-receipt.ts';
import { calculateRetirementAnalysis } from '../src/lib/simple/retirement-analysis.ts';
import { generateRetirementAdvice } from '../src/lib/simple/retirement-advice.ts';
import { generateSimplePrompt } from '../src/lib/simple/prompt.ts';
import { createPromptWorkspace } from '../src/lib/ai/prompt-input.ts';
import { privacyFindings } from '../src/lib/ai/prompt-privacy.ts';
const today='2026-11-08';
function fixture({birth='1972-01-01',retirement='2027-01-01',start='2037-01-01',normal=false,split=false,years='10'}={}){
  const f=createSimpleInputs();Object.assign(f.profile,{birthDate:birth,appointmentDate:'2000-03-01',step:'30',promotionMonth:'3',retirement:normal?'normal':'early',earlyDate:retirement,military:'not'});
  Object.assign(f.ktcu,{balance:'30000000',monthly:'100000',split,years});for(const key of ['irp','saving'])Object.assign(f[key],{balance:'10000000',monthly:'100000'});
  const date=calculateSimple(f,today).retirement.date;
  Object.assign(f.benefits.civil.pension,{money:{amount:'2000000',unit:'won'},queryDate:today,retirementDate:date,startDate:start,taxBasis:'gross',source:'official'});
  return f;
}
function run(f){const r=calculateSimple(f,today),a=calculateRetirementAnalysis(f,r);return {r,a,advice:generateRetirementAdvice(f,r,a)};}
test('55세 명퇴·공백 10년은 실제 날짜·120개월·제도 결과로 산정',()=>{
  const {a,advice}=run(fixture());assert.equal(a.retirementAge,55);assert.equal(a.gapMonths,120);assert.equal(a.publicStart,'2037-01-01');assert.match(advice[0].situation,/120개월/);assert.match(advice[0].situation,/명예퇴직/);
});
test('60세 명퇴·62세 정년의 3년 공백을 별도로 설명',()=>{
  const early=run(fixture({birth:'1967-01-01',start:'2030-01-01'}));assert.equal(early.a.retirementAge,60);assert.equal(early.a.gapMonths,36);
  const normal=run(fixture({birth:'1965-08-31',normal:true,start:'2030-08-31'}));assert.equal(normal.a.retirement,'2027-08-31');assert.equal(normal.a.retirementAge,62);assert.equal(normal.a.gapMonths,36);assert.ok(!normal.a.lumpItems.some(x=>x.label==='명예퇴직수당'));
});
test('동시 개시와 퇴직 전 국민연금은 공백0이며 개시 전 비교창을 생성하지 않는다',()=>{
  const same=run(fixture({start:'2027-01-01'}));assert.equal(same.a.gapDays,0);assert.ok(same.a.windows.every(w=>w.phase==='after'));assert.match(same.advice[0].situation,/공백은 0/);
  const f=fixture();f.profile.scheme='national';f.profile.manualNormal=true;f.profile.normalDate='2034-02-28';Object.assign(f.benefits.national.pension,{...f.benefits.civil.pension,startDate:'2026-01-01'});const before=run(f);assert.equal(before.a.gapMonths,0);assert.equal(before.a.publicStart,'2026-01-01');assert.match(before.advice[0].situation,/전에 이미 개시/);assert.equal(before.a.split.balanceSnapshotDate,'2027-01-01');
});
test('공제회 일시금은 목돈 항목에만 포함하고 월소득에 배분하지 않는다',()=>{
  const {a,r}=run(fixture());assert.equal(a.lumpItems.find(x=>x.label==='공제회 일시금').won,r.ktcu.amountWon);assert.equal(a.windows.find(w=>w.phase==='before').subtotalWon,null);assert.ok(a.windows.every(w=>!w.sources.some(s=>s.label.includes('공제회'))));
});
test('분할 선택은 기존 10년 지급표·개시 전후 횟수·마지막 잔액을 재사용',()=>{
  const {a,r}=run(fixture({split:true,start:'2030-01-01'}));assert.ok(!a.lumpItems.some(x=>x.label==='공제회 일시금'));assert.equal(a.split.beforeCount+a.split.afterCount,120);assert.ok(a.split.afterCount>0);assert.equal(a.split.monthlyWon,r.split.monthlyWon);
  const paid=r.split.rows.filter(x=>x.date<'2030-01-01');assert.equal(a.split.paidBeforeStartWon,paid.reduce((n,x)=>n+x.paymentWon,0));assert.equal(a.split.balanceAtPublicStartWon,paid.at(-1).balanceWon);
});
test('분할 5년이 10년 공백보다 짧으면 종료 후 월액을 남기지 않고 잔액0 표시',()=>{
  const {a}=run(fixture({split:true,years:'5'}));assert.equal(a.split.afterCount,0);assert.equal(a.split.balanceAtPublicStartWon,0);assert.equal(a.split.beforeCount,60);assert.equal(a.windows.find(w=>w.phase==='before'&&w.label==='공제회 분할 종료 후').subtotalWon,null);
});
test('첫 지급 전·최종 정산·종료 후를 분리하고 공적연금과 겹치는 월액만 합산',()=>{
  const {a,r}=run(fixture({split:true,start:'2030-01-01'}));assert.equal(a.windows[0].label,'공제회 첫 지급 전');assert.equal(a.windows[0].subtotalWon,null);
  const both=a.windows.find(w=>w.phase==='after'&&w.label==='공제회 정기 분할 지급 중');assert.equal(both.subtotalWon,2000000+r.split.monthlyWon);
  const final=a.windows.find(w=>w.label==='공제회 최종 지급일·정산액');assert.equal(final.subtotalWon,2000000+r.split.lastPaymentWon);
  assert.equal(a.windows.at(-1).subtotalWon,2000000);
});
test('공식 지원 밖 분할기간을 새로 만들지 않는다',()=>{
  const {a}=run(fixture({split:true,years:'7'}));assert.equal(a.split.valid,false);assert.equal(a.split.monthlyWon,null);assert.ok(a.windows.every(w=>!w.sources.some(s=>s.label.includes('공제회'))));
});
test('IRP 요건 충족·미충족·저축 가입기간 미확인을 즉시 사용액과 구분',()=>{
  const f=fixture();f.irp.receipt={...createAccountReceiptInput(),openedDate:'2020-01-01'};let x=run(f);assert.equal(x.a.accounts[0].eligibleAtRetirement,true);assert.equal(x.a.accounts[1].eligibleAtRetirement,null);assert.ok(!x.a.lumpItems.some(x=>/IRP|연금저축/.test(x.label)));
  f.irp.receipt.openedDate='2025-01-01';x=run(f);assert.equal(x.a.accounts[0].eligibleAtRetirement,false);assert.match(x.advice[2].situation,/퇴직일 요건 미충족/);
});
test('연간 한도 검토액을12로 나누거나 실제 인출·남은 미래 잔액으로 바꾸지 않는다',()=>{
  const f=fixture();f.irp.receipt={...createAccountReceiptInput(),openedDate:'2020-01-01',annualWithdrawal:'12000000'};const {a,r}=run(f);assert.equal(a.accountWithdrawalSchedule,null);assert.ok(a.windows.every(w=>!w.sources.some(s=>s.label.includes('IRP'))));assert.equal(a.accounts[0].balanceWon,r.irp.amountWon);
});
test('퇴직급여 미계산은 합산불가·보수적 조언이며 누락0원 처리 금지',()=>{
  const {a,advice}=run(fixture());assert.equal(a.benefitsWon,null);assert.equal(a.lumpTotalWon,null);assert.match(advice[3].title,/미계산 수당/);assert.match(advice[3].issue,/0원/);
});
test('생활비 미입력은 차이null, 입력은 선택 자료 차이이며 기타소득0 확정 금지',()=>{
  const f=fixture(),base=run(f);assert.equal(base.a.expenseWon,null);assert.ok(base.a.windows.every(w=>w.differenceWon===null));assert.equal(base.advice.length,5);
  f.monthlyLivingCost='3000000';const {a,advice}=run(f);assert.equal(a.expenseWon,3000000);assert.equal(a.windows.find(w=>w.phase==='after').differenceWon,-1000000);assert.match(advice[4].confirm,/확정 부족액·잉여액이 아닙니다/);assert.ok(a.windows.every(w=>w.missing.includes('근로·임대·기타수입 미반영')));
  f.monthlyLivingCost='0';assert.equal(run(f).a.expenseWon,0);f.monthlyLivingCost='-1';assert.equal(run(f).a.expenseWon,null);
});
test('공적연금 월액 누락은0아님·기존5단계 정상 개시일은 계속 활용',()=>{
  const f=fixture();f.benefits.civil.pension.money.amount='';const {a}=run(f);assert.equal(a.pensionWon,null);assert.ok(a.publicStart);assert.equal(a.windows.find(w=>w.phase==='after').subtotalWon,null);assert.ok(a.windows.find(w=>w.phase==='after').missing.includes('공적연금 월액 미확인'));
});
test('공제회만 계산 가능하면 부분소계로 유지하고 누락 공적연금을 표시',()=>{
  const f=fixture({split:true});f.benefits.civil.pension.money.amount='';const {a}=run(f);const partial=a.windows.find(w=>w.phase==='after'&&w.label==='공제회 정기 분할 지급 중');assert.ok(partial);assert.equal(partial.sources.length,1);assert.ok(partial.missing.includes('공적연금 월액 미확인'));
});
test('세후 조회월액과 세전 분할월액은 합산·생활비 차이 계산을 보류',()=>{
  const f=fixture({split:true,start:'2030-01-01'});f.benefits.civil.pension.taxBasis='net';f.monthlyLivingCost='3000000';const {a}=run(f);const mixed=a.windows.find(w=>w.sources.length===2);assert.equal(mixed.subtotalWon,null);assert.equal(mixed.differenceWon,null);assert.match(mixed.missing.join(),/기준이 달라/);
});
test('개시일 미확인인 구법 경력은 전후 구분 보류·금액 임의 생성 없음',()=>{
  const f=fixture();f.profile.appointmentDate='1995-03-01';f.benefits.civil.pension.money.amount='';const {a,advice}=run(f);assert.equal(a.publicStart,null);assert.equal(a.validTiming,false);assert.ok(a.windows.every(w=>w.phase==='unknown'));assert.match(advice[0].title,/개시 조건부터 확인/);
});
test('퇴직일 변경은 조회값 무효화·공백과 지급표 갱신, 생활비 입력은 기존 엔진 불변',()=>{
  const f=fixture({split:true}),before=calculateSimple(f,today),original=JSON.stringify(f);calculateRetirementAnalysis(f,before);generateRetirementAdvice(f,before,calculateRetirementAnalysis(f,before));assert.equal(JSON.stringify(f),original);
  f.monthlyLivingCost='3500000';assert.deepEqual(calculateSimple(f,today),before);f.profile.earlyDate='2028-01-01';const changed=run(f);assert.equal(changed.a.publicStart,null);assert.notEqual(changed.a.split.first,before.split.rows[0].date);assert.equal(changed.a.expenseWon,3500000);
});
test('AI 요청문 연결은 조언·생활비·구간 포함, 익명화·금액 축약·복사 검사 유지',()=>{
  const f=fixture({split:true,start:'2030-01-01'});f.monthlyLivingCost='3333333';const settings=createPromptWorkspace().settings;settings.money='exact';const text=generateSimplePrompt(f,settings,today);assert.match(text,/6-2. 은퇴설계 종합 분석/);assert.match(text,/333만원/);assert.match(text,/검토할 대응/);assert.match(text,/남은 가상 잔액/);assert.ok(!text.includes('2030-01-01'));assert.deepEqual(privacyFindings(text,settings),[]);
  const rounded=generateSimplePrompt(f,{...settings,money:'range'},today);assert.ok(!rounded.includes('333만원'));assert.deepEqual(privacyFindings(rounded,settings),[]);
});
