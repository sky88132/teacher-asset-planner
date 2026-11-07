import test from 'node:test';
import assert from 'node:assert/strict';
import { createPensionInputs } from '../src/lib/finance/pension-input.ts';
import { parseMoney, changeMoneyUnit, validateBenefit, validatePreparation } from '../src/lib/finance/pension-input-validation.ts';

const money = (amount, unit = 'won') => ({ amount, unit });
const profile = { birthDate: '1980-02-29', appointmentDate: '2005-03-01' };
const complete = () => ({ ...createPensionInputs().civil.pension, money: money('250.1234', 'manwon'),
  queryDate: '2026-11-07', retirementDate: '2040-08-31', startDate: '2045-03-01', taxBasis: 'gross', source: 'official' });
const validate = (input, kind = 'pension') => validateBenefit(input, kind, profile, '2026-11-07');

test('빈 금액과 명시적인 0원을 구분한다', () => {
  assert.deepEqual(parseMoney(money('  ')), { won: null });
  assert.deepEqual(parseMoney(money('0')), { won: 0 });
  assert.ok(validate({ ...complete(), money: money('') }).money);
  assert.deepEqual(validate({ ...complete(), money: money('0') }), {});
});
test('원·만 원·세 자리 쉼표를 원 단위로 정확하게 변환한다', () => {
  for (const [amount, unit, won] of [['2,501,234', 'won', 2501234], ['250.1234', 'manwon', 2501234],
    ['0.0001', 'manwon', 1], ['1,000.5', 'manwon', 10005000]]) {
    assert.deepEqual(parseMoney(money(amount, unit)), { won });
  }
  const input = money('2,501,234');
  const converted = changeMoneyUnit(input, 'manwon');
  assert.equal(converted.amount, '250.1234');
  assert.deepEqual(changeMoneyUnit(converted, 'won'), money('2501234'));
  assert.deepEqual(changeMoneyUnit(money(''), 'manwon'), money('', 'manwon'));
});
test('음수·잘못된 쉼표·지수·원 미만·안전 정수 초과를 반올림 없이 거부한다', () => {
  for (const input of [money('-1'), money('1e6'), money('12,34'), money('1.0'), money('NaN'),
    money('0.00001', 'manwon'), money('9007199254740992'), money('900719925474.0992', 'manwon')]) {
    assert.ok(parseMoney(input).error, JSON.stringify(input));
    assert.deepEqual(changeMoneyUnit(input, 'manwon'), input);
  }
  assert.equal(parseMoney(money('900719925474.0991', 'manwon')).won, Number.MAX_SAFE_INTEGER);
});
test('제도별 초깃값을 독립적으로 만들고 미입력 출처를 공식으로 확정하지 않는다', () => {
  const inputs = createPensionInputs();
  inputs.civil.pension.money.amount = '100';
  assert.equal(inputs['private-school'].pension.money.amount, '');
  assert.equal(inputs.civil.allowance.money.amount, '');
  assert.equal(inputs.civil.pension.source, '');
});
test('연금은 필수 메타데이터를 요구하고 수당은 지급개시일을 요구하지 않는다', () => {
  const empty = validate(createPensionInputs().civil.pension);
  for (const key of ['money', 'queryDate', 'retirementDate', 'startDate', 'taxBasis', 'source']) assert.ok(empty[key]);
  assert.deepEqual(validate(complete()), {});
  assert.deepEqual(validate({ ...complete(), startDate: '' }, 'allowance'), {});
  assert.ok(validate({ ...complete(), source: 'user-estimate' }, 'allowance').source);
  assert.deepEqual(validate({ ...complete(), source: 'user-estimate' }), {});
});
test('윤년·실제 달력·조회일 미래·퇴직과 개시일 순서를 검증한다', () => {
  assert.ok(validate({ ...complete(), queryDate: '2026-02-29' }).queryDate);
  assert.ok(validate({ ...complete(), queryDate: '2026-11-08' }).queryDate);
  assert.deepEqual(validate({ ...complete(), queryDate: '2024-02-29' }), {});
  assert.ok(validate({ ...complete(), retirementDate: '2005-03-01' }).retirementDate);
  assert.ok(validate({ ...complete(), startDate: '2040-08-30' }).startDate);
  assert.ok(validate({ ...complete(), retirementDate: '2040-02-30' }).retirementDate);
  assert.ok(validate({ ...complete(), startDate: '2045-13-01' }).startDate);
  assert.ok(validate({ ...complete(), queryDate: '1979-01-01' }).queryDate);
  assert.throws(() => validateBenefit(complete(), 'pension', profile, 'invalid'));
});
test('일관된 미래 퇴직·개시일과 과거 퇴직 조회를 허용한다', () => {
  assert.deepEqual(validate(complete()), {});
  assert.deepEqual(validate({ ...complete(), retirementDate: '2020-08-31', startDate: '2026-01-01' }), {});
  assert.deepEqual(validate({ ...complete(), startDate: complete().retirementDate }), {});
});
test('수당 준비 입력은 정수 년·0~11개월·양수 소득을 검증하며 급여를 생성하지 않는다', () => {
  const input = { ...createPensionInputs().civil.preparation, years: '20', months: '11',
    finalIncome: money('500', 'manwon'), before2010: 'unknown' };
  assert.deepEqual(validatePreparation(input), {});
  assert.ok(validatePreparation({ ...input, months: '12' }).months);
  assert.ok(validatePreparation({ ...input, years: '2.5' }).years);
  assert.ok(validatePreparation({ ...input, finalIncome: money('0') }).finalIncome);
  assert.ok(validatePreparation({ ...input, months: '' }).months);
});
