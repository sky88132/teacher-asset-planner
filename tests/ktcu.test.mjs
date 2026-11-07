import test from 'node:test';
import assert from 'node:assert/strict';
import { createKtcuInput } from '../src/lib/finance/ktcu-input.ts';
import { simulateKtcuAccumulation, simulateVirtualWithdrawals } from '../src/lib/finance/ktcu-simulation.ts';
import { validateKtcuQuote, validateKtcuWithdrawal, readRate, addSimulationMonths } from '../src/lib/finance/ktcu-validation.ts';

const money = amount => ({ amount: String(amount), unit: 'won' });
const input = (patch = {}) => ({ ...createKtcuInput(), balance: money(1000000), currentMonthly: money(30000), futureMonthly: money(100000),
  basisDate: '2026-07-01', stopDate: '2027-07-01', retirementDate: '2027-07-01', assumedRate: '0', ...patch });
const simulate = value => simulateKtcuAccumulation(value, '2026-11-07');
const withdraw = (...args) => simulateVirtualWithdrawals(...args, '2026-11-07');

test('미입력은 결과 없음이며 명시적 0원·0%는 유효한 가정이다', () => {
  assert.equal(simulate(createKtcuInput()).result, null);
  const outcome = simulate(input({ balance: money(0), currentMonthly: money(0), futureMonthly: money(0) }));
  assert.deepEqual(outcome.errors, {});
  assert.equal(outcome.result.finalWon, 0);
  assert.equal(outcome.result.growthWon, 0);
});
test('수익률 0%는 잔액+향후납입과 일치하고 현재 납입액을 중복 가산하지 않는다', () => {
  const result = simulate(input()).result;
  assert.equal(result.futureContributionWon, 1200000);
  assert.equal(result.finalWon, 2200000);
  assert.equal(result.growthWon, 0);
  assert.equal(simulate(input({ currentMonthly: money(999999) })).result.finalWon, result.finalWon);
});
test('납입기간 0개월과 1개월 및 잔여 일수를 구분한다', () => {
  const same = input({ stopDate: '2026-07-01', retirementDate: '2026-07-01' });
  assert.equal(simulate(same).result.months, 0);
  assert.equal(simulate(same).result.finalWon, 1000000);
  assert.equal(simulate(input({ stopDate: '2026-07-31', retirementDate: '2026-07-31' })).result.contributionMonths, 0);
  const one = simulate(input({ stopDate: '2026-08-01', retirementDate: '2026-08-01' })).result;
  assert.equal(one.contributionMonths, 1);
  assert.equal(one.finalWon, 1100000);
});
test('월 납입 0원에서도 잔액은 가정 이율로 증가하고 월 초 납입이 월 말보다 크다', () => {
  const noDeposit = simulate(input({ futureMonthly: money(0), assumedRate: '5' })).result;
  assert.ok(Math.abs(noDeposit.finalWon - 1050000) <= 12);
  const begin = simulate(input({ assumedRate: '5', depositTiming: 'begin' })).result;
  const end = simulate(input({ assumedRate: '5' })).result;
  assert.ok(begin.finalWon > end.finalWon);
});
test('월 말·윤년 기념일은 원래 기준일에 고정해 월별 누적 날짜 밀림을 피한다', () => {
  assert.equal(addSimulationMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addSimulationMonths('2028-01-31', 2), '2028-03-31');
  assert.equal(addSimulationMonths('2027-01-31', 1), '2027-02-28');
});
test('납입 종료 후 퇴직일까지 추가 납입 없이 가정 이자만 반영한다', () => {
  const result = simulate(input({ stopDate: '2026-08-01', assumedRate: '5' })).result;
  assert.equal(result.contributionMonths, 1);
  assert.equal(result.futureContributionWon, 100000);
  assert.ok(result.finalWon > 1100000);
  assert.equal(result.points.at(-1).contributedWon, 100000);
});
test('변경일 이후 첫 계산월부터 새 가정 이율을 적용한다', () => {
  const changed = simulate(input({ futureMonthly: money(0), changeEnabled: true, changeDate: '2027-01-01', changedRate: '12' })).result;
  assert.equal(changed.points[5].balanceWon, 1000000);
  assert.ok(changed.points[6].balanceWon > 1000000);
  assert.ok(changed.finalWon > simulate(input({ futureMonthly: money(0) })).result.finalWon);
});
test('공식 확인 이율을 사용해도 자체 시뮬레이션이며 미래 확정값이 아니다', () => {
  const result = simulate(input({ rateSource: 'official-reference', assumedRate: '' })).result;
  assert.equal(result.effectiveAnnualRate, 5);
  assert.equal(result.source, 'simulation');
  assert.match(result.rateSource, /미래 보장 아님/);
  assert.equal(simulate(input({ basisDate: '2026-06-30', rateSource: 'official-reference' })).result, null);
});
test('음수·비정상 이율·날짜·안전 범위 초과는 금액을 만들지 않는다', () => {
  for (const patch of [{ balance: money(-1) }, { futureMonthly: money('1e9') }, { assumedRate: '-1' }, { assumedRate: 'Infinity' },
    { assumedRate: '20.0001' }, { stopDate: '2026-02-30' }, { retirementDate: '2026-06-30' },
    { stopDate: '2028-01-01' }, { retirementDate: '2087-08-01' },
    { changeEnabled: true, changeDate: '2026-07-01', changedRate: '5' },
    { balance: money(Number.MAX_SAFE_INTEGER), assumedRate: '20' }]) {
    const outcome = simulate(input(patch));
    assert.equal(outcome.result, null, JSON.stringify(patch));
    assert.ok(Object.keys(outcome.errors).length);
  }
  assert.equal(readRate('0'), 0);
  assert.equal(readRate(''), null);
});
test('퇴직생활급여·분할급여금에 장기저축 적립 모델을 재사용하지 않는다', () => {
  for (const product of ['installment', 'retirement-interest', 'retirement-annuity', 'retirement-saving']) assert.equal(simulate(input({ product })).result, null);
});
test('공식 조회액은 상품별 독립이며 미래 금액을 현재 잔액에 중복 가산하지 않는다', () => {
  const value = input();
  value.quotes['long-term'] = { enabled: true, money: money(99999999), queryDate: '2026-11-07', targetDate: '2030-01-01', taxBasis: 'net', payment: 'lump-sum' };
  assert.deepEqual(validateKtcuQuote(value.quotes['long-term'], '2026-11-07'), {});
  assert.equal(simulate(value).result.finalWon, simulate(input()).result.finalWon);
  assert.equal(value.quotes.installment.money.amount, '');
  assert.ok(validateKtcuQuote({ ...value.quotes['long-term'], queryDate: '2099-01-01' }, '2026-11-07').quoteDate);
  assert.ok(validateKtcuQuote({ ...value.quotes['long-term'], money: money('') }, '2026-11-07').quoteMoney);
});
test('0% 가상 인출은 전체 기간 합계가 원금이며 마지막 회차가 끝수를 정산한다', () => {
  const result = withdraw(1000001, 0, 5, '2030-08-31');
  assert.equal(result.monthlyWon, 16666);
  assert.equal(result.lastPaymentWon, 16707);
  assert.equal(result.totalWon, 1000001);
  assert.equal(result.rows[0].date, '2030-09-30');
  assert.equal(result.rows.at(-1).balanceWon, 0);
});
test('수령기간별 총액 = 원금+월 이자 합 = 월별 인출 합, 최종 잔액 0', () => {
  for (const years of [5, 10, 15, 20, 25, 30]) {
    const result = withdraw(12345678, 4, years, '2040-01-01');
    assert.equal(result.calculationDate, '2026-11-07');
    assert.equal(result.rateSource, 'user-assumed');
    assert.equal(result.rows.length, years * 12);
    assert.equal(result.totalWon, result.rows.reduce((sum, row) => sum + row.paymentWon, 0));
    assert.equal(result.totalWon, 12345678 + result.rows.reduce((sum, row) => sum + row.interestWon, 0));
    assert.equal(result.rows.at(-1).balanceWon, 0);
  }
});
test('가상 인출은 0원도 처리하며 음수·비정상 기간·날짜를 거부한다', () => {
  assert.equal(withdraw(0, 0, 5, '2030-01-01').totalWon, 0);
  assert.throws(() => withdraw(-1, 0, 5, '2030-01-01'));
  assert.throws(() => withdraw(100, -1, 5, '2030-01-01'));
  assert.throws(() => withdraw(100, 0, 0, '2030-01-01'));
  assert.throws(() => withdraw(100, 0, 5, 'invalid'));
  assert.throws(() => withdraw(100, 0, 5, '9999-01-01'));
  assert.throws(() => simulateVirtualWithdrawals(100, 0, 5, '2030-01-01', 'invalid'));
  assert.ok(validateKtcuWithdrawal({ ...input(), withdrawalRate: '', withdrawalYears: '5' }).withdrawalRate);
});
test('공식 비교표와는 백만원 단위 규모만 비교하며 정확한 공식 급여액 검증으로 간주하지 않는다', () => {
  // https://www.ktcu.or.kr/PPW-FIA-101000: 150만원/월, 10년, 5%, 원금180·이자52 (단위: 백만원).
  // Official example deposits on the 17th; this model deposits at period-end and has no individual taxation.
  const result = simulate(input({ balance: money(0), futureMonthly: money(1500000), assumedRate: '5', stopDate: '2036-07-01', retirementDate: '2036-07-01' })).result;
  assert.equal(result.futureContributionWon, 180000000);
  assert.ok(Math.abs(result.finalWon - 232000000) < 1000000);
  assert.notEqual(result.finalWon, 232000000);
  assert.equal(result.source, 'simulation');
});
