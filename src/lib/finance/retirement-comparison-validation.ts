import type { TeacherProfile } from '../profile.ts';
import { isCalendarDate } from '../profile-validation.ts';
import { addSimulationMonths, completedSimulationMonths } from './ktcu-validation.ts';
import type { RetirementComparisonInput, ScenarioKey } from './retirement-comparison-input.ts';

export const retirementRule = { checkedOn: '2026-11-07', effectiveOn: '2026-10-02',
  source: 'https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1032085735', title: '교육공무원법 제47조 제1·2항' };
export function automaticRetirement(profile: TeacherProfile, input: RetirementComparisonInput) {
  if (profile.schoolType !== 'public' || !['kindergarten', 'primary', 'middle', 'high', 'special'].includes(input.schoolLevel)
    || input.position !== 'regular-teacher' || !input.ruleConfirmed) return { date: null, reason: '국공립 일반 교사·학교급·제47조 적용 확인이 필요합니다. 사립 정관·대학·기간제·기타 직위는 직접 입력해 주세요.' };
  if (!isCalendarDate(profile.birthDate)) return { date: null, reason: '기본정보의 유효한 생년월일이 필요합니다.' };
  // Leap-day attainment needs its own official interpretation; never silently clamp it.
  if (profile.birthDate.slice(5) === '02-29') return { date: null, reason: '2월 29일 출생자의 정년 도달일 해석은 자동 적용하지 않습니다. 기관에서 확인한 정년일을 직접 입력해 주세요.' };
  const year = Number(profile.birthDate.slice(0, 4)) + 62, month = Number(profile.birthDate.slice(5, 7));
  const y = month >= 9 ? year + 1 : year;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const date = month >= 3 && month <= 8 ? `${year}-08-31` : `${y}-02-${leap ? '29' : '28'}`;
  if (!isCalendarDate(date) || date < retirementRule.effectiveOn) return { date: null, reason: '확인한 법령 시행일 이전 정년일은 자동 산정 범위가 아닙니다.' };
  return { date, reason: '현행 62세·학기말 규정에 따른 추정일입니다. 신분·인사기록 및 향후 법령 변경은 기관에 확인해 주세요.' };
}
export function scenarioDate(input: RetirementComparisonInput, profile: TeacherProfile, key: ScenarioKey): string {
  return key === 'normal' && input.normalMode === 'auto' ? automaticRetirement(profile, input).date ?? '' : input.scenarios[key].date;
}
export function validateScenarioDate(date: string, profile: TeacherProfile): string[] {
  if (!isCalendarDate(date) || date > '9899-12-31') return ['유효한 퇴직일을 입력해 주세요.'];
  const errors: string[] = [];
  if (!isCalendarDate(profile.birthDate) || !isCalendarDate(profile.appointmentDate)) errors.push('기본정보의 생년월일과 최초 임용일을 확인해 주세요.');
  if (isCalendarDate(profile.appointmentDate) && date <= profile.appointmentDate) errors.push('퇴직일은 최초 임용일보다 뒤여야 합니다.');
  if (isCalendarDate(profile.birthDate) && date <= profile.birthDate) errors.push('퇴직일은 생년월일보다 뒤여야 합니다.');
  return errors;
}
export function pensionGap(retirement: string, start: string) {
  if (!isCalendarDate(retirement) || !isCalendarDate(start) || start < retirement) return null;
  const months = completedSimulationMonths(retirement, start);
  const millis = (date: string) => Date.parse(`${date}T00:00:00Z`);
  return { days: Math.round((millis(start) - millis(retirement)) / 86400000), months,
    extraDays: Math.round((millis(start) - millis(addSimulationMonths(retirement, months))) / 86400000) };
}
