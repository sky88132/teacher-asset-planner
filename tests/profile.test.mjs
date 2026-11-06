import test from 'node:test';
import assert from 'node:assert/strict';
import { isCalendarDate, todayInKorea, validateProfileDates } from '../src/lib/profile-validation.ts';
import { initialProfile, changeSchool, toggleSpecialCareer } from '../src/lib/profile.ts';

test('실제 달력과 윤년·세기·연도 경계를 검증한다', () => {
  for (const value of ['2000-02-29', '2024-02-29', '0001-01-01', '2026-12-31']) assert.equal(isCalendarDate(value), true, value);
  for (const value of ['', '2025-02-29', '1900-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '0000-01-01', '2026-1-1', '2026-11-06T00:00:00Z']) assert.equal(isCalendarDate(value), false, value);
});
test('한국 자정 전후와 연도 변경을 처리한다', () => {
  assert.equal(todayInKorea(new Date('2026-11-05T14:59:59Z')), '2026-11-05');
  assert.equal(todayInKorea(new Date('2026-11-05T15:00:00Z')), '2026-11-06');
  assert.equal(todayInKorea(new Date('2026-12-31T15:00:00Z')), '2027-01-01');
});
const validate = (birthDate, appointmentDate) => validateProfileDates({ birthDate, appointmentDate }, '2026-11-06');
test('필수 날짜를 각각 검증한다', () => {
  assert.deepEqual(Object.keys(validate('', '')).sort(), ['appointmentDate', 'birthDate']);
});
test('존재하지 않는 날짜에 항목별 오류를 반환한다', () => {
  assert.ok(validate('1980-02-30', '2005-04-31').birthDate);
  assert.ok(validate('1980-02-30', '2005-04-31').appointmentDate);
});
test('미래 생년월일과 미래 임용일을 거부한다', () => {
  assert.ok(validate('2026-11-07', '2026-11-06').birthDate);
  assert.ok(validate('1980-01-01', '2026-11-07').appointmentDate);
});
test('임용일이 출생일과 같거나 빠르면 거부한다', () => {
  assert.ok(validate('1980-01-01', '1979-12-31').appointmentDate);
  assert.ok(validate('1980-01-01', '1980-01-01').appointmentDate);
});
test('유효한 입력과 기준일 당일 임용을 허용한다', () => {
  assert.deepEqual(validate('1980-02-29', '2005-03-01'), {});
  assert.deepEqual(validate('1980-01-01', '2026-11-06'), {});
  assert.throws(() => validateProfileDates({ birthDate: '', appointmentDate: '' }, 'invalid'));
});
test('학교별 기본 연금 변경은 날짜와 경력 입력을 보존한다', () => {
  const profile = { ...initialProfile, birthDate: '1980-01-01', appointmentDate: '2005-03-01' };
  const changed = changeSchool(profile, 'private');
  assert.equal(changed.pension.scheme, 'private-school');
  assert.equal(changed.birthDate, profile.birthDate);
  assert.equal(changed.appointmentDate, profile.appointmentDate);
  assert.equal(changeSchool(changed, 'public').pension.scheme, 'civil');
  assert.equal(changeSchool({ ...changed, pension: { scheme: 'other', source: 'user-selected' } }, 'public').pension.scheme, 'other');
});
test('특수 경력은 복수 선택·해제하며 상세 입력과 구분한다', () => {
  const selected = toggleSpecialCareer(toggleSpecialCareer(initialProfile, 'military'), 'parental-leave');
  assert.equal(selected.hasSpecialCareer, true);
  assert.deepEqual(selected.specialCareers, ['military', 'parental-leave']);
  assert.equal(selected.specialCareerDetailsEntered, false);
  const cleared = toggleSpecialCareer(toggleSpecialCareer(selected, 'military'), 'parental-leave');
  assert.equal(cleared.hasSpecialCareer, false);
  assert.deepEqual(cleared.specialCareers, []);
});
