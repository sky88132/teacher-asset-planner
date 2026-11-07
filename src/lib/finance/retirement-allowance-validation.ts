import { isCalendarDate } from '../profile-validation.ts';
import { parseMoney, validatePreparation } from './pension-input-validation.ts';
import type { AllowanceErrors, AllowanceIssue, AllowanceValidation, AutoAllowanceInput } from './retirement-allowance.ts';

/** Validates inputs only; calendar employment is never substituted for agency-recognized service. */
export function validateAutoAllowance(input: AutoAllowanceInput): AllowanceValidation {
  const errors: AllowanceErrors = { ...validatePreparation(input) };
  const issues: AllowanceIssue[] = [];
  for (const field of ['appointmentDate', 'retirementDate', 'calculationDate'] as const) {
    if (!isCalendarDate(input[field])) errors[field] = '실제 달력에 있는 날짜를 입력해 주세요.';
  }
  if (!errors.appointmentDate && !errors.retirementDate && input.retirementDate <= input.appointmentDate) {
    errors.retirementDate = '예상 퇴직일은 최초 임용일보다 뒤여야 합니다.';
  }
  if (!errors.appointmentDate && !errors.calculationDate && input.appointmentDate > input.calculationDate) {
    errors.appointmentDate = '최초 임용일은 계산 기준일보다 늦을 수 없습니다.';
  }
  if (!['official', 'calendar', 'unknown'].includes(input.periodSource)) errors.periodSource = '인정 재직기간의 확인 출처를 선택해 주세요.';
  for (const field of ['reduction', 'previouslyReceived'] as const) {
    if (!['yes', 'no', 'unknown'].includes(input[field])) errors[field] = '해당 여부를 선택해 주세요.';
  }
  if (!['profile', 'yes', 'no', 'unknown'].includes(input.specialCareer)) errors.specialCareer = '특수 경력 여부를 확인해 주세요.';
  const inputMonths = errors.years || errors.months ? null : Number(input.years) * 12 + Number(input.months);
  const income = parseMoney(input.finalIncome);
  const inputIncomeWon = errors.finalIncome ? null : income.won;
  if (inputMonths !== null && inputMonths < 12) issues.push({ code: 'under-one-year', message: '입력한 인정기간이 1년 미만입니다. 지급요건 확인이 필요하며 0원으로 계산하지 않습니다.' });
  if (inputMonths !== null && inputMonths > 396) issues.push({ code: 'over-cap', message: '입력기간이 33년(396개월)을 초과합니다. 상한은 참고 정보이며 현재 계산에는 적용하지 않습니다.' });
  if (input.periodSource !== 'official') issues.push({ code: 'period-not-confirmed', message: '단순 달력상 근속기간은 수당 인정기간이 아닙니다. 공단에서 확인한 수당용 인정기간이 필요합니다.' });
  if (input.before2010 !== 'no' || (!errors.appointmentDate && input.appointmentDate < '2010-01-01')) {
    issues.push({ code: 'legacy-service', message: '2009년 이전 재직분이 있거나 배제되지 않았습니다. 구법 보수·기간 배분 확인이 필요합니다.' });
  }
  // An explicit "no" cannot erase special careers already present in the linked teacher profile.
  if (input.profileHasSpecialCareer || input.specialCareer !== 'no') issues.push({ code: 'special-career',
    message: '특수 경력이 있거나 반영 여부가 미확인입니다. 기본정보 선택 없음도 경력 부재를 확정하지 않습니다.' });
  if (input.reduction !== 'no') issues.push({ code: 'reduction', message: '감액·지급제한 사유가 있거나 미확인입니다. 해당 공단의 산정이 필요합니다.' });
  if (input.previouslyReceived !== 'no') issues.push({ code: 'previous-payment', message: '기존 퇴직수당 수령 이력이 있거나 미확인입니다. 중복 지급·재임용 정산 확인이 필요합니다.' });
  if (Object.keys(errors).length) issues.unshift({ code: 'invalid-input', message: '누락되었거나 유효하지 않은 입력이 있습니다.' });
  return { errors, inputMonths, inputIncomeWon, issues };
}
