import type { SimpleAccount } from './model.ts';
import { isCalendarDate } from '../profile-validation.ts';
import { parseMoney } from '../finance/pension-input-validation.ts';

export type Deposit = { date: string; won: number };
export function contributionSchedule(input: SimpleAccount, today: string, end: string): Deposit[] {
  if (!isCalendarDate(today) || !isCalendarDate(end) || end < today) throw new Error('납입 기간을 확인해 주세요.');
  const cycle = input.cycle ?? 'monthly';
  if (!['monthly', 'yearly'].includes(cycle)) throw new Error('납입 주기를 선택해 주세요.');
  const amount = parseMoney({ amount: cycle === 'yearly' ? input.annual ?? '' : input.monthly, unit: 'won' });
  if (amount.won === null || amount.error) throw new Error(amount.error ?? '선택한 주기의 납입액을 입력해 주세요. 0원은 직접 입력합니다.');
  const rows: Deposit[] = [];
  const start = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1;
  const last = Number(end.slice(0, 4)) * 12 + Number(end.slice(5, 7)) - 1;
  if (last - start > 720) throw new Error('계산 기간은 최대 60년입니다.');
  for (let n = start; n <= last; n++) {
    const y = Math.floor(n / 12), m = n % 12 + 1;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const date = `${y}-${String(m).padStart(2, '0')}-${days}`;
    if (date > today && date <= end && (cycle === 'monthly' || m === 12)) rows.push({ date, won: amount.won });
  }
  return rows;
}
export function annualContributions(rows: Deposit[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const y = row.date.slice(0, 4);
    totals[y] = (totals[y] ?? 0) + row.won;
    if (!Number.isSafeInteger(totals[y])) throw new Error('연간 납입액 범위를 초과했습니다.');
  }
  return totals;
}
/** ACT/ACT: actual days in each calendar year; effective annual return, no fee or tax. */
export function growthFactor(from: string, to: string, rate: number): number {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('수익률 범위를 확인해 주세요.');
  let cursor = from, years = 0;
  while (cursor < to) {
    const y = Number(cursor.slice(0, 4));
    const boundary = `${y + 1}-01-01`, end = boundary < to ? boundary : to;
    const days = (Date.parse(end + 'T00:00:00Z') - Date.parse(cursor + 'T00:00:00Z')) / 86400000;
    const yearDays = (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86400000;
    years += days / yearDays; cursor = end;
  }
  return Math.pow(1 + rate / 100, years);
}
