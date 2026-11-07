import { isCalendarDate } from '../profile-validation.ts';
import { addSimulationMonths } from './ktcu-validation.ts';
import { irpMoney, irpRate } from './irp-validation.ts';
import type { CashflowInput, CashflowKey } from './cashflow-input.ts';
export const monthKey = (date: string) => date.slice(0, 7);
export function monthIndex(date: string): number { return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1; }
export function monthEnd(date: string): string {
  const first = `${monthKey(date)}-01`, next = addSimulationMonths(first, 1);
  return new Date(Date.parse(`${next}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
}
export function ageDate(birth: string, age: number): string { return addSimulationMonths(birth, age * 12); }
export function ageAt(birth: string, date: string): number {
  let age = Number(date.slice(0, 4)) - Number(birth.slice(0, 4));
  if (ageDate(birth, age) > date) age--;
  return age;
}
export function validateCashflow(input: CashflowInput, key: CashflowKey, birth: string, retirement: string): string[] {
  const errors: string[] = [];
  if (!isCalendarDate(birth) || !isCalendarDate(retirement)) return ['01 기본정보와 05 시나리오의 유효한 퇴직일을 확인해 주세요.'];
  if (!/^\d{1,3}$/.test(input.finalAge) || Number(input.finalAge) < 1 || Number(input.finalAge) > 120) errors.push('최종 분석 연령은 1~120세의 정수로 입력해 주세요.');
  else if (ageDate(birth, Number(input.finalAge)) < retirement || Number(birth.slice(0, 4)) + Number(input.finalAge) > 9899 || monthIndex(ageDate(birth, Number(input.finalAge))) - monthIndex(retirement) > 1200) errors.push('최종 분석 월은 퇴직일 이후, 퇴직 후 최대 100년 이내여야 합니다.');
  if (!['gross', 'net'].includes(input.taxBasis)) errors.push('금액 기준을 확인해 주세요.');
  if (irpMoney(input.sharedLiving ? input.living : input.scenarios[key].living) === null) errors.push('첫해 월 생활비를 원 단위로 입력해 주세요. 0원은 직접 입력해야 합니다.');
  if (irpRate(input.inflation, -20, 30) === null) errors.push('물가상승률을 -20~30%로 입력해 주세요.');
  if (input.pensionAdjustment.trim() && irpRate(input.pensionAdjustment, -20, 30) === null) errors.push('연금액 가정 조정률은 -20~30%로 입력해 주세요.');
  if (input.priceDate && !isCalendarDate(input.priceDate)) errors.push('생활비 가격 기준일을 확인해 주세요.');
  if (input.livingChange && (!isCalendarDate(input.changeDate) || irpMoney(input.changedLiving) === null)) errors.push('생활비 변경일과 변경 월 생활비를 입력해 주세요.');
  for (const s of input.specials) if (!isCalendarDate(s.date) || irpMoney(s.amount) === null || !['both', 'early', 'normal'].includes(s.target)) errors.push('특별 지출의 날짜·금액·적용 시나리오를 확인해 주세요.');
  return [...new Set(errors)];
}
