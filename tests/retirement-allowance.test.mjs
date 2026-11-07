import test from 'node:test';
import assert from 'node:assert/strict';
import { createPensionInputs } from '../src/lib/finance/pension-input.ts';
import { parseMoney, validateBenefit } from '../src/lib/finance/pension-input-validation.ts';
import { calculateCivilAllowance, civilAllowanceBasis } from '../src/lib/finance/civil-retirement-allowance.ts';
import { calculatePrivateAllowance, privateAllowanceBasis } from '../src/lib/finance/private-retirement-allowance.ts';
import { validateAutoAllowance } from '../src/lib/finance/retirement-allowance-validation.ts';

// Synthetic input-validation fixtures, NOT official legal monetary examples or payment answers.
const input = (months = 240) => ({ ...createPensionInputs().civil.preparation,
  appointmentDate: '2010-01-01', retirementDate: '2050-01-01', calculationDate: '2026-11-07',
  years: String(Math.floor(months / 12)), months: String(months % 12),
  finalIncome: { amount: '5000001', unit: 'won' }, periodSource: 'official',
  before2010: 'no', specialCareer: 'no', profileHasSpecialCareer: false,
  reduction: 'no', previouslyReceived: 'no',
});

function assertBlocked(result) {
  assert.equal(result.status, 'blocked');
  assert.equal(result.amountWon, null);
  assert.equal(result.appliedMonths, null);
  assert.equal(result.appliedRate, null);
  assert.equal(result.confidence, '계산 불가');
  assert.ok(result.reasons.some(reason => reason.code === 'official-examples-missing'));
  assert.ok(result.reasons.some(reason => reason.code === 'rounding-unverified'));
}

for (const [scheme, calculate, basis] of [['civil', calculateCivilAllowance, civilAllowanceBasis],
  ['private-school', calculatePrivateAllowance, privateAllowanceBasis]]) {
  for (const months of [11, 12, 59, 60, 119, 120, 179, 180, 239, 240, 395, 396, 397]) {
    test(`${scheme}: 인정기간 ${months}개월 경계에서도 검증 전 금액·비율·상한을 적용하지 않는다`, () => {
      const result = calculate(input(months));
      assertBlocked(result);
      assert.equal(result.basis.scheme, scheme);
      assert.equal(result.inputMonths, months);
      assert.equal(result.reasons.some(reason => reason.code === 'under-one-year'), months < 12);
      assert.equal(result.reasons.some(reason => reason.code === 'over-cap'), months > 396);
    });
  }
  test(`${scheme}: 참고 비율과 33년 상한은 현행 조문과 일치하지만 계산 검증 완료를 의미하지 않는다`, () => {
    // Source: 시행령 제58조 / 사학 시행령 제63조의3 (2026-10-02). Reference data only.
    assert.deepEqual(basis.referenceRates.map(rate => [rate.minMonths, rate.numerator, rate.denominator]),
      [[12, 650, 10000], [60, 2275, 10000], [120, 2925, 10000], [180, 3250, 10000], [240, 3900, 10000]]);
    assert.equal(basis.referenceCapMonths, 396);
    assert.equal(basis.verification, 'incomplete');
  });
  test(`${scheme}: 퇴직일 역전과 소득 누락은 필드별 오류이며 0원으로 바꾸지 않는다`, () => {
    const result = calculate({ ...input(), retirementDate: '2009-12-31', finalIncome: { amount: '', unit: 'won' } });
    assertBlocked(result);
    assert.ok(result.errors.retirementDate);
    assert.ok(result.errors.finalIncome);
    assert.equal(result.inputIncomeWon, null);
  });
  test(`${scheme}: 구법·특수경력·감액·기수령·달력기간은 각각 차단 사유가 된다`, () => {
    const cases = [
      [{ before2010: 'yes' }, 'legacy-service'], [{ before2010: 'unknown' }, 'legacy-service'],
      [{ appointmentDate: '2009-12-31', before2010: 'no' }, 'legacy-service'],
      [{ specialCareer: 'yes' }, 'special-career'],
      [{ profileHasSpecialCareer: true, specialCareer: 'no' }, 'special-career'],
      [{ specialCareer: 'profile', profileHasSpecialCareer: false }, 'special-career'],
      [{ reduction: 'yes' }, 'reduction'], [{ reduction: 'unknown' }, 'reduction'],
      [{ previouslyReceived: 'yes' }, 'previous-payment'], [{ previouslyReceived: 'unknown' }, 'previous-payment'],
      [{ periodSource: 'calendar' }, 'period-not-confirmed'],
    ];
    for (const [patch, code] of cases) {
      const result = calculate({ ...input(), ...patch });
      assertBlocked(result);
      assert.ok(result.reasons.some(reason => reason.code === code), JSON.stringify(patch));
    }
  });
  test(`${scheme}: 원 단위 소득은 그대로 보존하며 미검증 반올림으로 급여액을 만들지 않는다`, () => {
    const result = calculate(input(13));
    assertBlocked(result);
    assert.equal(result.inputIncomeWon, 5000001);
    assert.match(result.rounding, /미적용/);
    const fractional = calculate({ ...input(), finalIncome: { amount: '5000001.5', unit: 'won' } });
    assertBlocked(fractional);
    assert.ok(fractional.errors.finalIncome);
    assert.equal(fractional.inputIncomeWon, null);
  });
  test(`${scheme}: 함수가 입력을 변경하지 않고 같은 입력에 같은 판정을 반환한다`, () => {
    const original = input();
    const snapshot = structuredClone(original);
    Object.freeze(original.finalIncome); Object.freeze(original);
    assert.deepEqual(calculate(original), calculate(original));
    assert.deepEqual(original, snapshot);
  });
}

test('빈 기간·소수 개월·윤년·미확인 항목을 검증한다', () => {
  const result = validateAutoAllowance({ ...input(), years: '', months: '1.5', retirementDate: '2041-02-29',
    reduction: '', previouslyReceived: '', periodSource: '', specialCareer: 'invalid' });
  for (const field of ['years', 'months', 'retirementDate', 'reduction', 'previouslyReceived', 'periodSource', 'specialCareer']) assert.ok(result.errors[field]);
  assert.equal(result.inputMonths, null);
});

test('공식 조회액은 별도 상태에 보존하고 앱 계산 불가 결과와 합치지 않는다', () => {
  const state = createPensionInputs();
  state.civil.allowance = { ...state.civil.allowance, money: { amount: '12.3456', unit: 'manwon' },
    source: 'official', queryDate: '2026-11-07', retirementDate: '2050-01-01', taxBasis: 'gross' };
  const snapshot = structuredClone(state);
  assert.deepEqual(validateBenefit(state.civil.allowance, 'allowance', { birthDate: '', appointmentDate: '2010-01-01' }, '2026-11-07'), {});
  assert.equal(parseMoney(state.civil.allowance.money).won, 123456);
  assertBlocked(calculateCivilAllowance(input()));
  assert.deepEqual(state, snapshot);
  assert.equal(state['private-school'].allowance.money.amount, '');
});
