import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProfile } from '../src/lib/profile.ts';
import { createPensionInputs } from '../src/lib/finance/pension-input.ts';
import { createKtcuInput } from '../src/lib/finance/ktcu-input.ts';
import { createIrpInput } from '../src/lib/finance/irp-input.ts';
import { createRetirementComparisonInput } from '../src/lib/finance/retirement-comparison-input.ts';
import { automaticRetirement, pensionGap, scenarioDate } from '../src/lib/finance/retirement-comparison-validation.ts';
import { calculateRetirementScenario } from '../src/lib/finance/retirement-comparison.ts';
const today = '2026-11-07';
function fixture() {
  const profile = { ...initialProfile, birthDate: '1980-05-10', appointmentDate: '2005-03-01' };
  const input = createRetirementComparisonInput(); input.normalMode = 'manual';
  input.scenarios.early.date = '2028-01-01'; input.scenarios.normal.date = '2030-01-01'; input.scenarios.custom.date = '2029-01-01';
  const pensions = createPensionInputs(), ktcu = createKtcuInput(), irp = createIrpInput();
  Object.assign(ktcu, { basisDate: '2026-01-01', retirementDate: '2040-01-01', stopDate: '2040-01-01', assumedRate: '0', balance: { amount:'100', unit:'won' }, currentMonthly: { amount:'0',unit:'won' }, futureMonthly: { amount:'0',unit:'won' } });
  Object.assign(irp, { basis:'2026-01-01', retirement:'2040-01-01' });
  Object.assign(irp.irp, { balance:'200', annual:'0', rate:'0', fee:'0', stop:'2040-01-01' });
  for (const key of ['early','normal','custom']) {
    const s = input.scenarios[key]; s.pensionSource = 'local'; s.allowanceSource = 'local';
    for (const scheme of ['civil','private-school']) for (const kind of ['pension','allowance','honorary']) Object.assign(s.quotes[scheme][kind], {
      money: { amount:kind === 'pension' ? '1000000' : kind === 'allowance' ? '1000' : '2000',unit:'won' }, queryDate:today, retirementDate:s.date, startDate:'2035-01-01', source:'official', taxBasis:'gross'
    });
    s.eligibility = 'confirmed'; s.selection = 'selected';
  }
  return { input, profile, pensions, ktcu, irp };
}
function run(f, key = 'early') { return calculateRetirementScenario(key, f.input, f.profile, f.pensions, f.ktcu, f.irp, today); }
test('국공립 일반 교사의 62세·학기말 경계 및 윤년 말일', () => {
  const f=fixture(); Object.assign(f.input,{schoolLevel:'primary',position:'regular-teacher',ruleConfirmed:true});
  for (const [birth,expected] of [['1966-01-01','2028-02-29'],['1966-02-28','2028-02-29'],['1966-03-01','2028-08-31'],['1966-08-31','2028-08-31'],['1966-09-01','2029-02-28'],['1966-12-31','2029-02-28']]) {
    f.profile.birthDate=birth; assert.equal(automaticRetirement(f.profile,f.input).date,expected);
  }
});
test('사립·기간제·미확인·대학·윤일 출생에는 정년을 확정하지 않는다', () => {
  const f=fixture(); assert.equal(automaticRetirement(f.profile,f.input).date,null);
  Object.assign(f.input,{schoolLevel:'primary',position:'regular-teacher',ruleConfirmed:true}); f.profile.schoolType='private'; assert.equal(automaticRetirement(f.profile,f.input).date,null);
  f.profile.schoolType='public'; f.input.position='fixed-term'; assert.equal(automaticRetirement(f.profile,f.input).date,null);
  f.input.position='regular-teacher'; f.input.schoolLevel='university'; assert.equal(automaticRetirement(f.profile,f.input).date,null);
  f.input.schoolLevel='primary'; f.profile.birthDate='1980-02-29'; assert.equal(automaticRetirement(f.profile,f.input).date,null);
  f.input.normalMode='manual'; assert.equal(scenarioDate(f.input,f.profile,'normal'),'2030-01-01');
});
test('명퇴일이 이르면 계산하고 같거나 늦으면 모든 금액을 보류한다', () => {
  const f=fixture(); assert.equal(run(f).total,3300);
  for (const date of ['2030-01-01','2030-01-02']) { f.input.scenarios.early.date=date; const r=run(f); assert.match(r.errors.join(),/빨라야/); assert.equal(r.total,null); assert.equal(r.ktcu.amountWon,null); }
});
test('잘못된 퇴직일·기본정보 순서를 차단한다', () => {
  const f=fixture(); for (const date of ['','2028-02-30','2000-01-01']) { f.input.scenarios.early.date=date; assert.equal(run(f).total,null); }
  f.input.scenarios.early.date='2028-01-01'; f.profile.appointmentDate='1970-01-01'; assert.equal(run(f).total,null);
});
test('공적연금 개시 전 기간을 날짜로 계산하며 다른 소득을 생성하지 않는다', () => {
  assert.deepEqual(pensionGap('2028-01-01','2029-01-01'),{days:366,months:12,extraDays:0});
  assert.equal(pensionGap('2028-01-01','2027-01-01'),null); assert.ok(run(fixture()).gap.days>0);
});
test('월연금은 자산 합계에서 제외하고 조회 퇴직일 불일치는 사용하지 않는다', () => {
  const f=fixture(); const r=run(f); assert.equal(r.pension.amountWon,1000000); assert.equal(r.total,3300);
  f.input.scenarios.early.quotes.civil.pension.retirementDate='2027-01-01'; const mismatch=run(f); assert.equal(mismatch.pension.amountWon,null); assert.equal(mismatch.gap,null);
});
test('월연금 미입력과 퇴직수당 미입력은 0원이 아니다', () => {
  const f=fixture(); f.input.scenarios.early.quotes.civil.pension.money.amount=''; assert.equal(run(f).pension.amountWon,null);
  f.input.scenarios.early.quotes.civil.allowance.money.amount=''; const r=run(f); assert.equal(r.allowance.amountWon,null); assert.equal(r.total,null); assert.equal(r.subtotal,2300);
});
test('명퇴 자격 확인과 선정은 독립이며 미확정액을 합산하지 않는다', () => {
  const f=fixture(); const s=f.input.scenarios.early;
  s.selection='unknown'; assert.equal(run(f).honorary.amountWon,null); assert.equal(run(f).total,null); assert.equal(s.quotes.civil.honorary.money.amount,'2000');
  s.selection='selected'; s.eligibility='unknown'; assert.equal(run(f).honorary.amountWon,null);
  assert.equal(run(f,'normal').honorary.amountWon,null); assert.equal(run(f,'normal').total,1300);
});
test('공제회 종료일 변경으로 예상액이 바뀌고 원본은 유지된다', () => {
  const f=fixture(); f.ktcu.futureMonthly.amount='100'; assert.equal(run(f).ktcu.amountWon,2500);
  Object.assign(f.input.scenarios.early,{ktcuStopMode:'custom',ktcuStop:'2027-01-01'}); assert.equal(run(f).ktcu.amountWon,1300); assert.equal(f.ktcu.stopDate,'2040-01-01');
  f.input.scenarios.early.ktcuStop='2040-01-01'; assert.equal(run(f).ktcu.amountWon,2500);
});
test('IRP·연금저축 종료일과 수익률·계좌 선택을 시나리오별 반영한다', () => {
  const f=fixture(); f.irp.irp.annual='1200'; f.irp.saving={...f.irp.irp,enabled:true};
  assert.equal(run(f).irp.amountWon,2600); assert.equal(run(f).saving.amountWon,2600);
  Object.assign(f.input.scenarios.early,{irpStopMode:'custom',irpStop:'2026-01-01',savingStopMode:'custom',savingStop:'2027-01-01'});
  assert.equal(run(f).irp.amountWon,200); assert.equal(run(f).saving.amountWon,1400); assert.equal(f.irp.irp.stop,'2040-01-01');
  f.input.scenarios.early.irpRate='-5'; assert.ok(run(f).irp.amountWon<200);
});
test('기준일·최종 계산일 불일치 시 같은 시점의 합산을 만들지 않는다', () => {
  const f=fixture(); f.irp.basis='2026-01-15'; const r=run(f); assert.equal(r.total,null); assert.equal(r.subtotal,null); assert.ok(r.aggregationIssues.length>0); assert.equal(r.irp.amountWon,200);
});
test('시나리오별 조회·제도 전환과 기존 메뉴 연결을 분리한다', () => {
  const f=fixture(); f.input.scenarios.early.pensionSource='linked'; f.pensions.civil.pension={...f.input.scenarios.early.quotes.civil.pension};
  assert.equal(run(f).pension.amountWon,1000000); f.input.scenarios.normal.pensionSource='linked'; assert.equal(run(f,'normal').pension.amountWon,null);
  f.profile.pension={scheme:'private-school',source:'user-selected'}; assert.equal(run(f).pension.amountWon,null);
  f.profile.pension={scheme:'civil',source:'user-selected'}; assert.equal(run(f).pension.amountWon,1000000);
});
test('퇴직급여 IRP 이전 입력과 세후 조회액을 중복·혼합 합산하지 않는다', () => {
  const f=fixture(); f.irp.transferAmount='99999999'; assert.equal(run(f).total,3300);
  f.input.scenarios.early.quotes.civil.allowance.taxBasis='net'; const r=run(f); assert.equal(r.total,null); assert.equal(r.subtotal,2300); assert.equal(r.allowance.tax,'net');
});
test('공제회 공식 일시금 조회액은 해당 상품·퇴직일에서만 재사용한다', () => {
  const f=fixture(); f.input.scenarios.early.ktcuSource='official'; Object.assign(f.ktcu.quotes['long-term'],{enabled:true,money:{amount:'999',unit:'won'},targetDate:'2028-01-01',queryDate:today,taxBasis:'gross',payment:'lump-sum'});
  assert.equal(run(f).ktcu.amountWon,999); f.input.scenarios.normal.ktcuSource='official'; assert.equal(run(f,'normal').ktcu.amountWon,null);
  f.ktcu.quotes['long-term'].payment='monthly'; assert.equal(run(f).ktcu.amountWon,null);
});
test('사용자 지정 시나리오도 독립적으로 계산하고 입력을 변경하지 않는다', () => {
  const f=fixture(); const copy=structuredClone(f); assert.equal(run(f,'custom').total,1300); assert.deepEqual(f,copy);
});
