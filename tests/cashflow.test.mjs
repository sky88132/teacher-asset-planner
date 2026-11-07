import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProfile } from '../src/lib/profile.ts';
import { createPensionInputs } from '../src/lib/finance/pension-input.ts';
import { createKtcuInput } from '../src/lib/finance/ktcu-input.ts';
import { createIrpInput } from '../src/lib/finance/irp-input.ts';
import { createRetirementComparisonInput } from '../src/lib/finance/retirement-comparison-input.ts';
import { createCashflowInput } from '../src/lib/finance/cashflow-input.ts';
import { simulateRetirementCashflow, compareAtAge } from '../src/lib/finance/cashflow.ts';
import { aggregateCashflow, runCashflow } from '../src/lib/finance/cashflow-engine.ts';

function fixture() {
  const profile={...initialProfile,birthDate:'1980-01-01',appointmentDate:'2005-03-01'};
  const comparison=createRetirementComparisonInput(); comparison.normalMode='manual';
  comparison.scenarios.early.date='2028-01-01'; comparison.scenarios.normal.date='2030-01-01';
  for (const key of ['early','normal']) {
    const s=comparison.scenarios[key]; s.pensionSource='local'; s.allowanceSource='local'; s.eligibility='confirmed'; s.selection='selected';
    for (const kind of ['pension','allowance','honorary']) Object.assign(s.quotes.civil[kind], { money:{amount:kind==='pension'?'100':kind==='allowance'?'1000':'2000',unit:'won'}, retirementDate:s.date,queryDate:'2026-11-07',startDate:'2031-01-01',source:'official',taxBasis:'gross' });
  }
  const ktcu=createKtcuInput(); Object.assign(ktcu,{basisDate:'2026-01-01',stopDate:'2040-01-01',retirementDate:'2040-01-01',assumedRate:'0',withdrawalRate:'0',withdrawalYears:'5',balance:{amount:'3000',unit:'won'},currentMonthly:{amount:'0',unit:'won'},futureMonthly:{amount:'0',unit:'won'}});
  const irp=createIrpInput(); irp.basis='2026-01-01'; irp.retirement='2040-01-01'; Object.assign(irp.irp,{balance:'1200',annual:'0',rate:'0',fee:'0',stop:'2040-01-01',start:'2030-01-01',years:'1',withdrawal:''});
  const input=createCashflowInput(); Object.assign(input,{finalAge:'52',living:'0',inflation:'0'});
  return {profile,comparison,ktcu,irp,pensions:createPensionInputs(),input};
}
const run=(f,key='early')=>simulateRetirementCashflow(key,f.input,f.comparison,f.profile,f.pensions,f.ktcu,f.irp,'2026-11-07');
function valid(result) { assert.equal(result.ok,true,result.ok?'':result.errors.join('\n')); return result; }
test('최종 연령 기본 90세·필수 누락은 금액 없음',()=>{
  assert.equal(createCashflowInput().finalAge,'90'); const f=fixture(); f.input.living=''; assert.equal(run(f).amountWon,null);
  f.input.living='0'; f.comparison.scenarios.early.quotes.civil.pension.money.amount=''; assert.equal(run(f).amountWon,null);
});
test('공적연금은 개시 월부터 유입하며 잔액에 미리 더하지 않는다',()=>{
  const r=valid(run(fixture())); assert.equal(r.rows[0].opening,4200); assert.equal(r.rows[0].closing,7200);
  assert.equal(r.rows.find(r=>r.date==='2030-12-31').pension,0); assert.equal(r.rows.find(r=>r.date==='2031-01-31').pension,100);
  assert.equal(r.rows.filter(r=>r.pension>0).length,13); assert.equal(r.totalPension,1300);
});
test('지급개시일이 월 중간이어도 해당 월부터 월액을 반영하는 명시적 가정',()=>{
  const f=fixture(); f.comparison.scenarios.early.quotes.civil.pension.startDate='2030-06-15'; const r=valid(run(f));
  assert.equal(r.rows.find(r=>r.date==='2030-05-31').pension,0); assert.equal(r.rows.find(r=>r.date==='2030-06-30').pension,100);
});
test('퇴직수당·명퇴수당은 지정 월 한 번만 외부 유입된다',()=>{
  const f=fixture(); f.input.scenarios.early.allowanceDate='2028-03-15'; f.input.scenarios.early.honoraryDate='2028-04-20'; const r=valid(run(f));
  assert.equal(r.rows[0].allowance,0); assert.equal(r.rows.find(r=>r.date==='2028-03-31').allowance,1000);
  assert.equal(r.rows.reduce((s,r)=>s+r.allowance,0),1000); assert.equal(r.rows.reduce((s,r)=>s+(r.honorary??0),0),2000);
  assert.equal(valid(run(f,'normal')).rows.reduce((s,r)=>s+(r.honorary??0),0),0);
});
test('명퇴 미확정 금액은 null·부분 결과로 남으며 실제 0원으로 표시하지 않는다',()=>{
  const f=fixture(); f.comparison.scenarios.early.selection='unknown'; const r=valid(run(f));
  assert.equal(r.partial,true); assert.equal(r.rows[0].honorary,null); assert.equal(r.rows[0].closing,5200); assert.equal(r.years[0].honoraryUnknown,true);
});
test('퇴직수당 미입력·세전세후 혼합·역전 지급일 차단',()=>{
  const f=fixture(); f.comparison.scenarios.early.quotes.civil.allowance.money.amount=''; assert.equal(run(f).ok,false);
  f.input.scenarios.early.includeAllowance=false; assert.equal(valid(run(f)).partial,true);
  f.comparison.scenarios.early.quotes.civil.pension.taxBasis='net'; assert.equal(run(f).ok,false);
  f.comparison.scenarios.early.quotes.civil.pension.taxBasis='gross'; f.input.scenarios.early.ktcuStart='2027-01-01'; assert.equal(run(f).ok,false);
});
test('공제회 일시 수령은 내부 이동·분할 인출과 중복되지 않는다',()=>{
  const f=fixture(); const lump=valid(run(f)); assert.equal(lump.rows[0].ktcu,3000); assert.equal(lump.rows[0].ktcuRemaining,0); assert.equal(lump.rows[0].closing,7200);
  f.input.scenarios.early.ktcuMode='virtual'; const split=valid(run(f)); assert.equal(split.rows[0].ktcu,0); assert.equal(split.rows[0].ktcuRemaining,3000); assert.equal(split.rows[0].closing,7200);
  assert.equal(split.rows[1].ktcu,50); assert.equal(split.rows[1].ktcuRemaining,2950); assert.equal(split.rows[1].closing,7200);
  assert.equal(split.rows.reduce((s,r)=>s+r.ktcu,0),2400); // 48 receipts before Jan2032
});
test('IRP 인출은 총 금융자산을 늘리지 않고 고갈 이후 지급이 없다',()=>{
  const f=fixture(); Object.assign(f.input.scenarios.early.irp,{start:'2028-01-01',mode:'fixed',monthly:'700'});
  const r=valid(run(f)); assert.equal(r.rows[1].irp,700); assert.equal(r.rows[1].irpRemaining,500); assert.equal(r.rows[1].closing,7200);
  assert.equal(r.rows[2].irp,500); assert.equal(r.rows[3].irp,0); assert.equal(r.rows[3].irpRemaining,0);
});
test('현금 부족은 계좌 자산과 구분하고 빚·자동 추가인출을 만들지 않는다',()=>{
  const f=fixture(); f.input.scenarios.early.ktcuMode='virtual'; f.input.living='4000'; const r=valid(run(f));
  assert.equal(r.rows[0].cash,0); assert.equal(r.rows[0].shortfall,1000); assert.equal(r.rows[0].closing,4200);
  assert.equal(r.firstShortfall,'2028-01-31'); assert.ok(r.cumulativeShortfall>0); assert.ok(r.rows.every(r=>r.cash>=0));
});
test('퇴직월 부분 기간에는 생활비를 추정하지 않고 다음 달부터 반영한다',()=>{
  const f=fixture(); f.comparison.scenarios.early.date='2028-01-15';
  for (const q of Object.values(f.comparison.scenarios.early.quotes.civil)) q.retirementDate='2028-01-15';
  f.input.acceptPartialMonths=true; f.input.living='10'; const r=valid(run(f)); assert.equal(r.rows[0].living,0); assert.equal(r.rows[1].living,10);
});
test('공통 물가 경로·개별 생활비·변경일·특별 지출을 반영한다',()=>{
  const f=fixture(); f.input.living='100'; f.input.inflation='10';
  assert.equal(valid(run(f,'normal')).rows[0].living,121);
  f.input.sharedLiving=false; f.input.scenarios.normal.living='200'; assert.equal(valid(run(f,'normal')).rows[0].living,200);
  f.input.livingChange=true; f.input.changeDate='2031-01-01'; f.input.changedLiving='50';
  f.input.specials=[{id:'1',date:'2031-01-15',amount:'300',target:'both'},{id:'2',date:'2029-01-01',amount:'20',target:'early'}];
  const r=valid(run(f,'normal')); assert.equal(r.rows.find(r=>r.date==='2031-01-31').living,50); assert.equal(r.rows.find(r=>r.date==='2031-01-31').special,300);
});
test('연금 조정률은 첫 지급 월 12개월 후부터 적용한다',()=>{
  const f=fixture(); f.input.pensionAdjustment='10'; const r=valid(run(f));
  assert.equal(r.rows.find(r=>r.date==='2031-12-31').pension,100); assert.equal(r.rows.find(r=>r.date==='2032-01-31').pension,110);
});
test('수령 시작 대기·음수 수익률·기간 종료 잔여자산 운용을 재사용한다',()=>{
  const f=fixture(); f.irp.irp.rate='-10'; f.irp.irp.withdrawal='1'; const r=valid(run(f));
  assert.equal(r.rows[0].irpRemaining,972); // two years of pre-retirement model, rounded monthly
  assert.ok(r.rows[1].gain<0); assert.ok(r.rows.at(-1).irpRemaining<r.rows.find(r=>r.date==='2031-02-28').irpRemaining);
});
test('연도·연령 집계는 유입 합계와 마지막 잔액을 사용한다',()=>{
  const r=valid(run(fixture())); assert.equal(r.years[0].opening,4200); assert.equal(r.years[0].closing,r.rows[11].closing);
  assert.equal(r.years.reduce((s,y)=>s+y.pension,0),r.totalPension); assert.equal(r.ages.reduce((s,y)=>s+y.months,0),r.rows.length);
  assert.equal(aggregateCashflow(r.rows,'age')[0].period,'48');
});
test('같은 연령이라도 퇴직 전 기간은 0원이 아니며 완전한 비교를 단정하지 않는다',()=>{
  const f=fixture(), early=run(f),normal=run(f,'normal'); const c=compareAtAge(early,normal,f.profile.birthDate,49);
  assert.ok(c.early.value!==null); assert.equal(c.normal.value,null); assert.match(c.normal.reason,/퇴직 전/); assert.equal(c.complete,false);
  assert.ok(compareAtAge(early,normal,f.profile.birthDate,51).normal.value!==null);
  assert.equal(compareAtAge(early,normal,f.profile.birthDate,60).early.value,null);
});
test('이전 금액·재투자 자산을 새 자산으로 더하지 않고 입력은 보존한다',()=>{
  const f=fixture(); const copy=structuredClone(f), before=valid(run(f)); assert.deepEqual(f,copy);
  f.irp.transferAmount='999999999'; assert.equal(valid(run(f)).amountWon,before.amountWon);
  Object.assign(f.irp,{reinvest:true,scopeConfirmed:true,income:'40000000',capacity:'1000000',refundCash:'1000000',ratio:'100',reinvestRate:'10'});
  assert.equal(valid(run(f)).amountWon,before.amountWon);
});
test('비정상 입력·최종 연령 역전·부분 월 미동의 차단',()=>{
  const f=fixture(); for (const raw of ['-1','1.1','NaN','']) {f.input.living=raw;assert.equal(run(f).ok,false);}
  f.input.living='0'; f.input.finalAge='40'; assert.equal(run(f).ok,false); f.input.finalAge='52'; f.input.inflation='101'; assert.equal(run(f).ok,false);
  f.input.inflation='0'; f.irp.basis='2026-01-15'; assert.equal(run(f).ok,false); f.input.acceptPartialMonths=true; assert.equal(run(f).ok,true);
});
test('원장 항등식은 매월 성립하고 원 미만·안전 정수 초과는 차단된다',()=>{
  const f=fixture(); f.input.living='1'; const r=valid(run(f));
  for (const row of r.rows) assert.equal(row.closing,row.opening+row.pension+row.allowance+(row.honorary??0)+row.gain-row.paidExpenses);
  f.input.living='0.1'; assert.equal(run(f).ok,false);
  assert.throws(()=>runCashflow({birth:'1980-01-01',retirement:'2028-01-01',end:'2028-01-31',pension:{amount:Number.MAX_SAFE_INTEGER,start:'2028-01-01',adjustment:0},allowance:{amount:1,date:'2028-01-01'},honorary:null,honoraryUnknown:false,accounts:[],living:0,priceDate:'2028-01-01',inflation:0,change:null,specials:[]}),/범위/);
});
