import test from 'node:test';
import assert from 'node:assert/strict';
import { createIrpInput } from '../src/lib/finance/irp-input.ts';
import { validateIrp, irpMoney, irpRate } from '../src/lib/finance/irp-validation.ts';
import { pensionTaxCredit, retirementTransfer } from '../src/lib/finance/irp-tax.ts';
import { simulateIrp, simulateWithdrawal, scheduledContribution, growMonth, roundedWon } from '../src/lib/finance/irp-simulation.ts';

function fixture() {
  const i = createIrpInput(); i.basis = '2026-01-01'; i.retirement = '2028-01-01';
  Object.assign(i.irp, { balance: '1000000', annual: '1200000', rate: '0', fee: '0', stop: i.retirement, start: i.retirement, years: '10' });
  return i;
}
test('빈 금액과 날짜는 계산 불가이며 0원을 반환하지 않는다', () => {
  const r = simulateIrp(createIrpInput()); assert.equal(r.ok, false); assert.equal(r.amountWon, null);
  const i = fixture(); i.irp.balance = ''; assert.equal(simulateIrp(i).amountWon, null);
  i.irp.balance = '0'; i.retirement = '2026-02-30'; assert.equal(simulateIrp(i).amountWon, null);
});
test('0% · 두 해 월납입 · 계좌 합산', () => {
  const i = fixture(); const r = simulateIrp(i); assert.equal(r.ok, true); assert.equal(r.amountWon, 3400000); assert.equal(r.investmentGain, 0);
  i.saving = { ...i.irp, enabled: true }; const both = simulateIrp(i); assert.equal(both.amountWon, 6800000);
});
test('초기 잔액·납입액 0원 및 기간 0개월을 명시적으로 허용한다', () => {
  const i = fixture(); i.irp.balance = '0'; i.irp.annual = '0'; assert.equal(simulateIrp(i).amountWon, 0);
  i.irp.balance = '123'; i.retirement = i.basis; i.irp.stop = i.basis; const r = simulateIrp(i); assert.equal(r.amountWon, 123); assert.equal(r.rows.length, 1);
});
test('음수 수익률·수수료를 별도 순서로 반영한다', () => {
  const i = fixture(); i.irp.annual = '0'; i.irp.rate = '-20'; const r = simulateIrp(i); assert.ok(r.amountWon < 1000000); assert.ok(r.investmentGain < 0);
  assert.equal(growMonth(1000000, 0, 0), 1000000); assert.ok(growMonth(1000000, 0, 5) < 1000000);
  assert.ok(growMonth(1000000, -20, 1) < growMonth(1000000, -20, 0));
});
test('월 납입과 연 후납은 시점이 다르고 원 단위 연간 합계가 같다', () => {
  assert.equal(Array.from({ length: 12 }, (_, n) => scheduledContribution(1000001, 'monthly', n + 1)).reduce((a,b) => a+b), 1000001);
  assert.equal(scheduledContribution(1200000, 'yearly', 11), 0); assert.equal(scheduledContribution(1200000, 'yearly', 12), 1200000);
  const i = fixture(); i.irp.rate = '5'; const monthly = simulateIrp(i); i.irp.cycle = 'yearly'; const yearly = simulateIrp(i); assert.ok(monthly.amountWon > yearly.amountWon);
});
test('납입 종료 후에도 성장하고 마지막 부분 월은 납입하지 않는다', () => {
  const i = fixture(); i.irp.stop = '2026-02-01'; i.retirement = '2026-03-15'; const r = simulateIrp(i); assert.equal(r.deposits, 100000); assert.equal(r.rows.at(-1).date, '2026-03-01');
});
test('한도 초과·역전 날짜·비정상 수익률·원 미만 금액 차단', () => {
  const i = fixture(); i.irp.annual = '18000001'; assert.ok(validateIrp(i).length); assert.equal(simulateIrp(i).amountWon, null);
  i.irp.annual = '1'; i.irp.stop = '2025-01-01'; assert.ok(validateIrp(i).length);
  for (const raw of ['-1', '1.1', '1e6', 'NaN', '9007199254740992']) assert.equal(irpMoney(raw), null);
  for (const raw of ['-100', '101', '', 'Infinity', '1e2']) assert.equal(irpRate(raw), null);
});
test('소득 경계별 국세율·공제한도·남은 세액·실제 현금 구분', () => {
  assert.equal(pensionTaxCredit(9000000, 0, 'wage', 55000000, null).rate, 15);
  assert.equal(pensionTaxCredit(9000000, 0, 'wage', 55000001, null).rate, 12);
  assert.equal(pensionTaxCredit(9000000, 0, 'comprehensive', 45000000, null).rate, 15);
  assert.equal(pensionTaxCredit(9000000, 0, 'comprehensive', 45000001, null).rate, 12);
  const c = pensionTaxCredit(9000000, 9000000, 'wage', 50000000, 100000); assert.equal(c.eligible, 9000000); assert.equal(c.usable, 100000); assert.equal(c.cashRefund, null);
  assert.equal(pensionTaxCredit(0, 9000000, 'wage', 50000000, 0).usable, 0);
});
test('생명보험협회 2026 교재 PDF p125(인쇄124) 공식 발행 수치 사례 · 국세만', () => {
  // https://exam.insure.or.kr/upload/upfile/common/recent/varisu_recent.pdf?dt=1772594506437
  // PDF zero-based page125, printed page124. This is an association teaching example, not NTS certification.
  for (const [saving, irp, low, high] of [[0,900,135,108],[200,700,135,108],[700,200,120,96],[900,0,90,72]]) {
    assert.equal(pensionTaxCredit(irp*10000, saving*10000, 'comprehensive', 40000000, null).theoretical, low*10000);
    assert.equal(pensionTaxCredit(irp*10000, saving*10000, 'comprehensive', 60000000, null).theoretical, high*10000);
  }
});
test('재투자 ON/OFF·차년도 지급·현금 상한·추가 공제 없음', () => {
  const i = fixture(); Object.assign(i, { scopeConfirmed: true, income: '40000000', capacity: '1000000', refundCash: '1000000', reinvest: true, ratio: '100', reinvestRate: '0' });
  const r = simulateIrp(i); assert.equal(r.ok, true); assert.equal(r.reinvestPrincipal, 165000); assert.equal(r.comparison.difference, 0); assert.equal(r.taxYears[1].credit.theoretical, 180000);
  assert.equal(r.rows.find(r => r.date === '2027-04-01').reinvested, 0); assert.equal(r.rows.find(r => r.date === '2027-05-01').reinvested, 165000);
  i.reinvestRate = '10'; const growth = simulateIrp(i); assert.ok(growth.comparison.difference > 0);
  i.ratio = '0'; assert.equal(simulateIrp(i).comparison.difference, 0);
  i.reinvest = false; const off = simulateIrp(i); assert.equal(off.reinvestPrincipal, 0); assert.equal(off.amountWon, r.amountWon);
  i.irp.credit = false; i.reinvest = true; assert.equal(simulateIrp(i).reinvestPrincipal, 0);
});
test('세액 정보 미확인·지원하지 않는 재투자 계좌는 차단한다', () => {
  const i = fixture(); i.reinvest = true; assert.equal(simulateIrp(i).amountWon, null);
  Object.assign(i, { scopeConfirmed: true, income: '1', capacity: '1', refundCash: '1', ratio: '50', reinvestRate: '0', target: 'irp' }); assert.equal(simulateIrp(i).ok, false);
});
test('퇴직급여 이전 입력을 합산·공제하지 않는다', () => {
  const i = fixture(); const baseline = simulateIrp(i); i.transferAmount = '99999999'; i.transferDate = '2027-01-01'; i.transferRate = '5';
  assert.equal(simulateIrp(i).amountWon, baseline.amountWon); assert.equal(retirementTransfer().amountWon, null); assert.equal(retirementTransfer().enabled, false);
});
test('정액 인출 잔액 감소·고갈·음수 수익률·총액 정산', () => {
  const a = fixture().irp; a.years = '1'; const r = simulateWithdrawal(1200000, a.start, a); assert.equal(r.ok, true); assert.equal(r.amountWon, 100000); assert.equal(r.total, 1200000); assert.equal(r.remaining, 0);
  a.withdrawal = '700000'; const depleted = simulateWithdrawal(1200000, a.start, a); assert.equal(depleted.rows[0].remaining, 500000); assert.equal(depleted.rows[1].payment, 500000); assert.equal(depleted.rows[2].payment, 0);
  a.withdrawal = ''; a.rate = '-10'; const negative = simulateWithdrawal(1200000, a.start, a); assert.ok(negative.total < 1200000); assert.equal(negative.remaining, 0);
  a.start = '2020-01-01'; assert.equal(simulateWithdrawal(1, '2026-01-01', a).amountWon, null);
});
test('원 반올림·안전 정수 범위·시나리오', () => {
  assert.equal(roundedWon(1.5), 2); assert.equal(roundedWon(-1.5), -2);
  const i = fixture(); assert.ok(simulateIrp(i, -5).amountWon < simulateIrp(i, 5).amountWon);
  i.irp.balance = String(Number.MAX_SAFE_INTEGER); i.irp.rate = '100'; assert.equal(simulateIrp(i).amountWon, null);
});
