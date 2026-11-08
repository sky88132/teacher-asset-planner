import type { SimpleInputs } from './model.ts';
import type { SimpleResults } from './calculation.ts';
import { ageAt } from '../finance/cashflow-validation.ts';
import { isCalendarDate } from '../profile-validation.ts';
import { moneyWon } from './validation.ts';

export type MonthlySource = { label: string; won: number; tax: 'gross' | 'net' | 'unknown' };
export type IncomeWindow = { from: string; until: string | null; phase: 'before' | 'after' | 'unknown'; label: string;
  sources: MonthlySource[]; subtotalWon: number | null; tax: 'gross' | 'net' | 'unknown'; differenceWon: number | null; missing: string[] };
function sum(values: (number | null)[]): number | null {
  if (!values.length || values.some(n => n === null || !Number.isSafeInteger(n) || n < 0)) return null;
  const total = values.reduce<bigint>((a, n) => a + BigInt(n!), 0n);
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}
const dayAfter = (date: string) => new Date(Date.parse(date + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
/** Reuses stage 1–6 outputs. No investment, pension, tax or withdrawal engine is run here. */
export function calculateRetirementAnalysis(input: SimpleInputs, r: SimpleResults) {
  const retirement = r.retirement.date, start = r.pensionStartDate;
  const validTiming = !!retirement && isCalendarDate(retirement) && !!start && isCalendarDate(start);
  const expense = moneyWon(input.monthlyLivingCost ?? '');
  const expenseWon = expense.error ? null : expense.won;
  const splitValid = input.ktcu.split && [5,10,15,20,25,30].includes(Number(input.ktcu.years)) && !r.splitError && !!r.split && r.split.rows.length === Number(input.ktcu.years) * 12;
  const rows = splitValid ? r.split!.rows : [];
  const first = rows[0]?.date ?? null, last = rows.at(-1)?.date ?? null;
  const splitBefore = validTiming ? rows.filter(row => row.date >= retirement! && row.date < start!) : [];
  const splitAfter = validTiming ? rows.filter(row => row.date >= (start! > retirement! ? start! : retirement!)) : [];
  const paidBeforeStart = validTiming ? rows.filter(row => row.date < (start! > retirement! ? start! : retirement!)) : [];
  const splitBalanceAtStart = rows.length && validTiming ? paidBeforeStart.at(-1)?.balanceWon ?? r.ktcu.amountWon : null;
  const lumpItems = [
    ...(!input.ktcu.split ? [{ label: '공제회 일시금', won: r.ktcu.amountWon }] : []),
    { label: '퇴직수당', won: r.allowance.amountWon },
    ...(input.profile.retirement === 'early' ? [{ label: '명예퇴직수당', won: r.honorary.amountWon }] : []),
  ];
  const accounts = (['irp','saving'] as const).map(key => ({ key, title: key === 'irp' ? 'IRP' : '연금저축',
    balanceWon: r[key].amountWon, receipt: r.accountReceipts[key],
    eligibleAtRetirement: !retirement || !r.accountReceipts[key].eligibleDate ? null : r.accountReceipts[key].eligibleDate! <= retirement,
  }));
  const windows: IncomeWindow[] = [];
  const lumpPriceCompatible = !retirement || retirement.slice(0,4)==='2026' || input.ktcu.split || r.ktcu.amountWon===null || !lumpItems.some(x=>x.label!=='공제회 일시금'&&x.won!==null);
  if (retirement && isCalendarDate(retirement)) {
    const points = new Set([retirement]);
    for (const date of [start, first, last, last ? dayAfter(last) : null]) if (date && date > retirement) points.add(date);
    const dates = [...points].sort();
    for (let i=0; i<dates.length; i++) {
      const from = dates[i], phase = !validTiming ? 'unknown' : from < start! ? 'before' : 'after';
      const sources: MonthlySource[] = [], missing = ['근로·임대·기타수입 미반영', 'IRP·연금저축 월 인출 미설계'];
      if (phase === 'unknown') missing.push('공적연금 개시일 미확인: 전후 구분 보류');
      else if (phase === 'after') {
        if (r.pension.amountWon === null) missing.push('공적연금 월액 미확인');
        else sources.push({ label: '공적연금', won: r.pension.amountWon, tax: r.pensionSource !== 'quote' ? 'gross' : input.benefits[input.profile.scheme].pension.taxBasis === 'gross' ? 'gross' : input.benefits[input.profile.scheme].pension.taxBasis === 'net' ? 'net' : 'unknown' });
      }
      if (input.ktcu.split && !splitValid) missing.push('공제회 분할 월액·기간 미확인');
      if (first && last && from >= first && from <= last) sources.push({ label: from === last ? '공제회 마지막 정산' : '공제회 분할', won: from === last ? rows.at(-1)!.paymentWon : r.split!.monthlyWon, tax: 'gross' });
      const tax = sources[0]?.tax ?? 'unknown';
      const priceCompatible = !(r.pensionSource==='automatic' && sources.length>1 && from.slice(0,4)!=='2026');
      const compatible = tax !== 'unknown' && sources.every(s => s.tax === tax) && priceCompatible;
      if(!priceCompatible)missing.push('2026 고정 기준 월연금과 공제회 미래 명목 월액은 기준이 달라 합산 보류');
      if (sources.length && !compatible) missing.push('세전·세후 또는 미확인 기준이 달라 월액 합산 보류');
      const subtotalWon = compatible ? sum(sources.map(s => s.won)) : null;
      const label = !first || !last ? '월액 확인 범위' : from < first ? '공제회 첫 지급 전' : from === last ? '공제회 최종 지급일·정산액' : from > last ? '공제회 분할 종료 후' : '공제회 정기 분할 지급 중';
      windows.push({ from, until: dates[i+1] ?? null, phase, label, sources, subtotalWon, tax,
        differenceWon: expenseWon !== null && subtotalWon !== null ? subtotalWon - expenseWon : null, missing });
    }
  }
  return { retirement, retirementAge: retirement && isCalendarDate(input.profile.birthDate) ? ageAt(input.profile.birthDate, retirement) : null,
    publicStart: start, normalPublicDate: r.pensionDetails.normalStartDate, validTiming,
    gapMonths: r.pensionGapMonths, gapDays: r.pensionGapDays, pensionWon: r.pension.amountWon,
    expenseWon, expenseError: expense.error, windows, lumpItems, lumpPriceCompatible, lumpTotalWon: lumpPriceCompatible?sum(lumpItems.map(x => x.won)):null,
    accounts, accumulationWon: r.accumulationTotal, benefitsWon: r.benefitsTotal,
    split: { selected: input.ktcu.split, valid: splitValid, years: input.ktcu.years, first, last,
      balanceSnapshotDate: validTiming ? (start! > retirement! ? start! : retirement!) : null,
      monthlyWon: splitValid ? r.split!.monthlyWon : null, lastPaymentWon: splitValid ? r.split!.lastPaymentWon : null,
      beforeCount: validTiming && splitValid ? splitBefore.length : null, afterCount: validTiming && splitValid ? splitAfter.length : null,
      paidBeforeStartWon: paidBeforeStart.length ? sum(paidBeforeStart.map(x => x.paymentWon)) : validTiming && splitValid ? 0 : null,
      balanceAtPublicStartWon: splitBalanceAtStart },
    // No monthly withdrawal schedule exists for these accounts. Annual limit-check input is not a payment.
    accountWithdrawalSchedule: null, afterTaxIncomeWon: null,
  };
}
export type RetirementAnalysis = ReturnType<typeof calculateRetirementAnalysis>;
