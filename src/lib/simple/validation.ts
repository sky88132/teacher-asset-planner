import { isCalendarDate, validateProfileDates } from '../profile-validation.ts';
import { addSimulationMonths, completedSimulationMonths } from '../finance/ktcu-validation.ts';
import { parseMoney } from '../finance/pension-input-validation.ts';
import type { SimpleProfile } from './model.ts';
import { simpleConfig } from './config.ts';

export const moneyWon = (raw: string) => parseMoney({ amount: raw, unit: 'won' });
export function normalRetirementCandidate(birth: string): string | null {
  if (!isCalendarDate(birth) || Number(birth.slice(0, 4)) > 9936) return null;
  const year = Number(birth.slice(0, 4)) + 62, month = Number(birth.slice(5, 7));
  if (month >= 3 && month <= 8) return `${year}-08-31`;
  const y = year + (month >= 9 ? 1 : 0);
  return addSimulationMonths(`${y}-01-31`, 1);
}
export function resolveRetirement(p: SimpleProfile, today: string) {
  const errors: string[] = Object.values(validateProfileDates(p, today));
  if (!['civil', 'private-school', 'national'].includes(p.scheme)) errors.push('가입 연금제도를 선택해 주세요.');
  const candidate = normalRetirementCandidate(p.birthDate);
  const normal = p.manualNormal ? p.normalDate : p.scheme === 'national' ? '' : candidate ?? '';
  if (!isCalendarDate(normal)) errors.push(p.scheme === 'national' ? '국민연금 가입만으로 정년을 확정할 수 없습니다. 실제 정년일을 직접 입력해 주세요.' : '정년일을 확인해 주세요.');
  const date = p.retirement === 'early' ? p.earlyDate : normal;
  if (!['normal', 'early'].includes(p.retirement)) errors.push('퇴직 방식을 선택해 주세요.');
  if (!isCalendarDate(date)) errors.push('예상 퇴직일을 입력해 주세요.');
  else {
    if (date < today || (isCalendarDate(p.appointmentDate) && date <= p.appointmentDate)) errors.push('퇴직일은 오늘 이후이며 최초 임용일보다 뒤여야 합니다.');
    if (date > '9900-12-31' || completedSimulationMonths(today, date) > simpleConfig.maxMonths) errors.push('간편 계산은 향후 60년 이내만 지원합니다.');
    if (p.retirement === 'early' && isCalendarDate(normal) && date >= normal) errors.push('명예퇴직일은 정년일보다 빨라야 합니다.');
  }
  return { date: errors.length ? null : date, normal: isCalendarDate(normal) ? normal : null, candidate, errors: [...new Set(errors)] };
}
export function validateSimpleProfile(p: SimpleProfile, today: string) {
  const errors = [...resolveRetirement(p, today).errors];
  if (!/^(?:[1-9]|[1-3]\d|40)$/.test(p.step)) errors.push('현재 호봉은 1~40호봉으로 입력해 주세요. 근가호봉은 별도 확인이 필요합니다.');
  if (!/^(?:[1-9]|1[0-2])$/.test(p.promotionMonth)) errors.push('승급월을 선택해 주세요.');
  if (!['approved', 'not', 'unknown'].includes(p.military)) errors.push('군복무기간 산입 상태를 확인해 주세요.');
  return [...new Set(errors)];
}
/** Future scheduled increments only. Today's salary step already includes any increment due today. */
export function projectedStep(p: SimpleProfile, date: string | null, today: string): number | null {
  if (!date || !isCalendarDate(date) || date < today || !/^(?:[1-9]|[1-3]\d|40)$/.test(p.step) || !/^(?:[1-9]|1[0-2])$/.test(p.promotionMonth)) return null;
  let step = Number(p.step);
  for (let y = Number(today.slice(0, 4)); y <= Number(date.slice(0, 4)); y++) {
    const scheduled = `${y}-${p.promotionMonth.padStart(2, '0')}-01`;
    if (scheduled > today && scheduled <= date) step = Math.min(simpleConfig.maxStep, step + 1);
  }
  return step;
}
