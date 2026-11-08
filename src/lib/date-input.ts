import { isCalendarDate } from './profile-validation.ts';
/** Input convenience only; financial date validation stays in the existing engines. */
export function normalizeDateText(text: string): string {
  const value = text.trim().replace(/[./]/g, '-');
  return /^\d{8}$/.test(value) ? value.slice(0, 4) + '-' + value.slice(4, 6) + '-' + value.slice(6) : value;
}
export function calendarMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) throw new Error('달력의 연도와 월을 확인해 주세요.');
  const prefix = String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0');
  const first = new Date(0);
  first.setUTCFullYear(year, month - 1, 1);
  const days = Array.from({ length: 31 }, (_, i) => ({ day: i + 1, date: prefix + '-' + String(i + 1).padStart(2, '0') })).filter(d => isCalendarDate(d.date));
  return { offset: first.getUTCDay(), days };
}
