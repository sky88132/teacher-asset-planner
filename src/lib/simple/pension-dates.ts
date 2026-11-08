import { isCalendarDate } from '../profile-validation.ts';
import { addSimulationMonths, completedSimulationMonths } from '../finance/ktcu-validation.ts';
import type { PensionEstimate } from './pension-types.ts';
export const monthIndex = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
export const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && isCalendarDate(value + '-01');
export function monthString(index: number): string { return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`; }
export function birthAnniversary(birth: string, age: number): string | null {
  if (!isCalendarDate(birth) || !Number.isInteger(age) || age < 0) return null;
  const year = Number(birth.slice(0, 4)) + age;
  if (year > 9900) return null;
  const month = Number(birth.slice(5, 7)), day = Math.min(Number(birth.slice(8, 10)), new Date(Date.UTC(year, month, 0)).getUTCDate());
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function nextMonth(date: string): string { return addSimulationMonths(date.slice(0, 7) + '-01', 1).slice(0, 7); }
export function pensionGap(retirement: string | null, firstMonth: string | null) {
  if (!retirement || !isCalendarDate(retirement) || !firstMonth || !validMonth(firstMonth)) return { gapMonths: null, gapDays: null };
  const start = firstMonth + '-01';
  return { gapMonths: Math.max(0, completedSimulationMonths(retirement, start)),
    gapDays: Math.max(0, Math.round((Date.parse(start + 'T00:00:00Z') - Date.parse(retirement + 'T00:00:00Z')) / 86400000)) };
}
export function setPensionTiming(r: PensionEstimate, retirement: string | null, entitlement: string | null, scheme: 'national' | 'occupational' = 'national') {
  r.normalStartDate = entitlement;
  r.firstPaymentMonth = entitlement ? nextMonth(entitlement) : null;
  if (scheme === 'occupational' && entitlement && retirement && isCalendarDate(retirement)) {
    // Act Art.34 proviso: age-triggered pension starts in the eligibility month,
    // excluding a month already counted as service under Art.25(1).
    const lastServiceDay = new Date(Date.parse(retirement + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
    const firstNonServiceMonth = nextMonth(lastServiceDay);
    r.firstPaymentMonth = entitlement.slice(0, 7) > firstNonServiceMonth ? entitlement.slice(0, 7) : firstNonServiceMonth;
  }
  Object.assign(r, pensionGap(retirement, r.firstPaymentMonth));
}
export function nationalPensionAge(birthYear: number): number {
  return birthYear <= 1952 ? 60 : birthYear <= 1956 ? 61 : birthYear <= 1960 ? 62 : birthYear <= 1964 ? 63 : birthYear <= 1968 ? 64 : 65;
}
export function occupationalPensionAge(retirement: string): number {
  const previous = new Date(Date.parse(retirement + 'T00:00:00Z') - 86400000).getUTCFullYear();
  return previous <= 2021 ? 60 : previous <= 2023 ? 61 : previous <= 2026 ? 62 : previous <= 2029 ? 63 : previous <= 2032 ? 64 : 65;
}
