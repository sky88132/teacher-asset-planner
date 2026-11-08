import type { BenefitInput } from '../finance/pension-input.ts';
import { parseMoney } from '../finance/pension-input-validation.ts';
import { createKtcuInput } from '../finance/ktcu-input.ts';
import { simulateKtcuAccumulation, simulateVirtualWithdrawals } from '../finance/ktcu-simulation.ts';
import { addSimulationMonths, completedSimulationMonths } from '../finance/ktcu-validation.ts';
import { contributionSchedule, annualContributions, growthFactor, type Deposit } from './account-schedule.ts';
import { estimateHonorary, estimateAllowance } from './benefit-estimates.ts';
import { pensionTaxCredit } from '../finance/irp-tax.ts';
import { createPensionEstimateInput } from './pension-types.ts';
import { estimateCivilPension, estimatePrivatePension } from './occupational-pension.ts';
import { estimateNationalPension } from './national-pension.ts';
import { calculateAccountReceipt, createAccountReceiptInput } from './account-receipt.ts';
import { isCalendarDate } from '../profile-validation.ts';
import { simpleConfig } from './config.ts';
import type { SimpleAccount, SimpleInputs, SimpleScheme } from './model.ts';
import { moneyWon, resolveRetirement, projectedStep } from './validation.ts';

export type SimpleAmount = { amountWon: number | null; errors: string[]; confidence: string; date: string | null;
  initial: number | null; deposits: number | null; gain: number | null; initialFuture: number | null; depositsFuture: number | null;
  contributionsByYear?: Record<string, number> };
export function noAmount(errors: string[], date: string | null = null): SimpleAmount {
  return { amountWon: null, errors: [...new Set(errors)], confidence: '계산 불가', date, initial: null, deposits: null, gain: null, initialFuture: null, depositsFuture: null };
}
function safe(n: number) { if (!Number.isSafeInteger(n) || n < 0) throw new Error('안전한 원 단위 계산 범위를 초과했습니다.'); return n; }
/** Calendar month-end / December-end contributions; actual-day compounding through retirement. */
export function calculateAccount(input: SimpleAccount, date: string | null, today: string, rate: number, extra: Deposit[] = []): SimpleAmount {
  const initial = moneyWon(input.balance);
  if (!date || !isCalendarDate(today) || !isCalendarDate(date) || date < today) return noAmount(['01의 예상 퇴직일을 확인해 주세요.']);
  if (initial.won === null || initial.error) return noAmount([initial.error ?? '현재 적립금을 입력해 주세요. 0원은 직접 입력합니다.'], date);
  const months = completedSimulationMonths(today, date);
  if (months > simpleConfig.maxMonths) return noAmount(['계산 기간은 최대 60년입니다.'], date);
  try {
    const rows = [...contributionSchedule(input, today, date), ...extra.filter(row => row.date > today && row.date <= date)];
    const initialFuture = safe(Math.round(initial.won * growthFactor(today, date, rate)));
    let depositsFuture = 0, deposits = 0;
    for (const row of rows) {
      deposits = safe(deposits + row.won);
      depositsFuture = safe(depositsFuture + safe(Math.round(row.won * growthFactor(row.date, date, rate))));
    }
    const balance = safe(initialFuture + depositsFuture);
    return { amountWon: balance, initial: initial.won, deposits, gain: balance - initial.won - deposits,
      initialFuture, depositsFuture, date, errors: [], confidence: '조건부 추정값', contributionsByYear: annualContributions(rows) };
  } catch (e) { return noAmount([(e as Error).message], date); }
}
export function quoteAmount(q: BenefitInput, kind: 'pension' | 'allowance' | 'honorary', date: string | null, today: string, context: { scheme?: SimpleScheme; birthDate?: string } = {}): SimpleAmount {
  const errors: string[] = [];
  const parsed = parseMoney(q.money);
  if (parsed.won === null || parsed.error) errors.push(parsed.error ?? '공식 조회 금액을 입력해 주세요.');
  if (!date) errors.push('01의 예상 퇴직일을 확인해 주세요.');
  else if (q.retirementDate !== date) errors.push('조회 시 가정한 퇴직일이 현재 퇴직일과 다릅니다. 재확인 필요');
  if (!isCalendarDate(q.queryDate) || q.queryDate > today) errors.push('조회 기준일을 확인해 주세요.');
  if (!['gross', 'net'].includes(q.taxBasis)) errors.push('세전·세후를 선택해 주세요.');
  if (!['official', 'user-estimate'].includes(q.source)) errors.push('금액 출처를 선택해 주세요.');
  if (kind === 'pension') {
    if (!isCalendarDate(q.startDate) || (context.birthDate && isCalendarDate(context.birthDate) && q.startDate <= context.birthDate)) errors.push('연금 지급개시일을 확인해 주세요.');
    else if (date && q.startDate < date) {
      if (context.scheme !== 'national') errors.push('이 간편 모드의 공무원·사학 일반 퇴직연금은 현재 퇴직일 이후 개시일을 입력합니다. 재임용·별도 수급권은 기관 확인이 필요합니다.');
      else if (q.source !== 'official') errors.push('퇴직 전 국민연금 개시일은 개인별 수급·감액 조건을 확인한 공식 조회값으로 입력해 주세요.');
    }
  }
  if (errors.length) return noAmount(errors, date);
  return { ...noAmount([], date), amountWon: parsed.won, confidence: q.source === 'official' ? '공식 조회값' : '조건부 추정값' };
}
export function sumKnown(items: SimpleAmount[], date: string | null): number | null {
  if (!date || items.some(i => i.amountWon === null || i.date !== date)) return null;
  try { return safe(items.reduce((sum, i) => safe(sum + i.amountWon!), 0)); } catch { return null; }
}
export function firstSplitDate(retirement: string): string {
  const anniversary = addSimulationMonths(retirement, 1);
  const this25 = `${anniversary.slice(0, 7)}-25`;
  return this25 >= anniversary ? this25 : `${addSimulationMonths(anniversary, 1).slice(0, 7)}-25`;
}
export function calculateSimple(input: SimpleInputs, today: string) {
  const retirement = resolveRetirement(input.profile, today), date = retirement.date;
  const step = projectedStep(input.profile, date, today);
  const ktcuInput = createKtcuInput();
  Object.assign(ktcuInput, { balance: { amount: input.ktcu.balance, unit: 'won' }, currentMonthly: { amount: '0', unit: 'won' },
    futureMonthly: { amount: input.ktcu.monthly, unit: 'won' }, basisDate: today, stopDate: date ?? '', retirementDate: date ?? '',
    rateSource: 'assumed', assumedRate: String(simpleConfig.ktcuRate), depositTiming: 'end' });
  const accumulation = simulateKtcuAccumulation(ktcuInput, today);
  const k = accumulation.result;
  const ktcu: SimpleAmount = k ? { amountWon: k.finalWon, errors: [], confidence: '조건부 추정값', date,
    initial: k.initialWon, deposits: k.futureContributionWon, gain: k.growthWon, initialFuture: null, depositsFuture: null }
    : noAmount(Object.values(accumulation.errors), date);
  let split: ReturnType<typeof simulateVirtualWithdrawals> | null = null;
  let splitError = '';
  if (input.ktcu.split && k && date) {
    if (!['5','10','15','20','25','30'].includes(input.ktcu.years)) splitError = '분할 수령기간을 선택해 주세요.';
    else try { split = simulateVirtualWithdrawals(k.finalWon, simpleConfig.ktcuRate, Number(input.ktcu.years), date, today);
      // Display dates follow the chosen 25th-day scenario; monetary math remains a full-month virtual model.
      const first = firstSplitDate(date);
      split.rows = split.rows.map((row, i) => ({ ...row, date: addSimulationMonths(first, i) }));
    } catch (e) { splitError = (e as Error).message; }
  }
  let irp = calculateAccount(input.irp, date, today, simpleConfig.irpRate), saving = calculateAccount(input.saving, date, today, simpleConfig.savingRate);
  const plannedTotals: Record<string, number> = {};
  // Independently inspect valid plans even when an account's opening balance is missing.
  for (const account of [input.irp, input.saving]) {
    try { if (date) for (const [year, total] of Object.entries(annualContributions(contributionSchedule(account, today, date)))) plannedTotals[year] = (plannedTotals[year] ?? 0) + total; } catch { /* Account reports its own invalid plan. */ }
  }
  const overLimitYears = Object.keys(plannedTotals).filter(year => plannedTotals[year] > simpleConfig.annualPersonalLimit);
  if (overLimitYears.length) {
    const error = [overLimitYears.join('·') + '년의 입력된 납입 계획 합계가 연금계좌 일반 개인납입 합산 연 1,800만원 한도를 초과합니다. 다른 납입·특례는 별도 확인이 필요합니다.'];
    irp = noAmount(error, date); saving = noAmount(error, date);
  }
  const reinvestments: Deposit[] = [];
  let reinvestError = '';
  const taxCredits: Record<string, number> = {};
  if (input.reinvest) {
    const income = moneyWon(input.taxIncome ?? ''), capacity = moneyWon(input.taxCapacity ?? '');
    if (income.won === null || income.error || capacity.won === null || capacity.error) reinvestError = '재투자 효과 미반영 · 선택했으나 연 총급여·공제 전 소득세 여력 확인이 없어 계산 불가 (0원 확정 아님)';
    else if (irp.amountWon === null || saving.amountWon === null || !date) reinvestError = '재투자 계산에는 두 계좌의 유효한 납입 계획과 잔액이 필요합니다.';
    else {
      for (let year = Number(today.slice(0, 4)); year <= Number(date.slice(0, 4)); year++) {
        const priorReinvest = reinvestments.filter(row => row.date.startsWith(String(year))).reduce((sum, row) => sum + row.won, 0);
        const credit = pensionTaxCredit((irp.contributionsByYear?.[year] ?? 0) + priorReinvest, saving.contributionsByYear?.[year] ?? 0, 'wage', income.won, capacity.won).usable!;
        taxCredits[year] = credit;
        const refundDate = `${year + 1}-05-31`;
        if (credit > 0 && refundDate <= date) {
          const refundYear = String(year + 1);
          const total = (plannedTotals[refundYear] ?? 0) + credit;
          if (total > simpleConfig.annualPersonalLimit) { reinvestError = `${refundYear}년 재투자 포함 납입액이 연 1,800만원을 초과하여 재투자 시나리오를 계산하지 않습니다.`; break; }
          reinvestments.push({ date: refundDate, won: credit });
        }
      }
      if (!reinvestError) irp = calculateAccount(input.irp, date, today, simpleConfig.irpRate, reinvestments);
    }
  }
  const quotes = input.benefits[input.profile.scheme];
  const pensionInput = quotes.pensionEstimate ?? createPensionEstimateInput();
  const pensionDetails = input.profile.scheme === 'civil' ? estimateCivilPension(input.profile, pensionInput, date, today)
    : input.profile.scheme === 'private-school' ? estimatePrivatePension(input.profile, pensionInput, date, today)
    : estimateNationalPension(input.profile, pensionInput, date);
  // An intentionally entered quote retains priority, including its stale/invalid state.
  // Deleting the quoted amount returns to automatic estimation; never silently replace a stale quote.
  const pensionSource = quotes.pension.money.amount !== '' ? 'quote' as const : 'automatic' as const;
  const pension: SimpleAmount = pensionSource === 'quote'
    ? quoteAmount(quotes.pension, 'pension', date, today, { scheme: input.profile.scheme, birthDate: input.profile.birthDate })
    : { ...noAmount(pensionDetails.errors, date), amountWon: pensionDetails.amountWon, confidence: pensionDetails.confidence };
  const pensionStartDate = pensionSource === 'quote' ? pension.amountWon !== null ? quotes.pension.startDate : null
    : pensionDetails.firstPaymentMonth ? pensionDetails.firstPaymentMonth + '-01' : null;
  const pensionGapMonths = date && pensionStartDate ? Math.max(0, completedSimulationMonths(date, pensionStartDate)) : null;
  const pensionGapDays = date && pensionStartDate ? Math.max(0, Math.round((Date.parse(pensionStartDate + 'T00:00:00Z') - Date.parse(date + 'T00:00:00Z')) / 86400000)) : null;
  const allowanceDetails = estimateAllowance(input.profile, quotes, date);
  const honoraryDetails = estimateHonorary(input.profile, date, retirement.normal, step);
  const allowance: SimpleAmount = { ...noAmount(allowanceDetails.errors, date), amountWon: allowanceDetails.amountWon,
    confidence: allowanceDetails.amountWon === null ? '계산 불가' : '조건부 추정값 · 세전 · 소득 고정 가정' };
  const honorary: SimpleAmount = { ...noAmount(honoraryDetails.errors, date), amountWon: honoraryDetails.amountWon,
    confidence: honoraryDetails.amountWon === null ? '계산 불가' : '조건부 추정값 · 2026년 봉급표 기준 · 지급 미확정' };
  const benefitItems = input.profile.retirement === 'early' ? [allowance, honorary] : [allowance];
  // Both estimates are gross, fixed-price scenarios at the same retirement date.
  // Both salary and income inputs explicitly use fixed 2026 prices.
  const benefitsTotal = sumKnown(benefitItems, date);
  const accountsTotal = sumKnown([irp, saving], date);
  const accumulationTotal = sumKnown([ktcu, irp, saving], date);
  return { today, retirement, step, ktcu, split, splitError, irp, saving, pension, allowance, honorary,
    benefitsTotal, accountsTotal, accumulationTotal, accumulation, allowanceDetails, honoraryDetails, plannedTotals,
    pensionDetails, pensionSource, pensionStartDate, pensionGapMonths, pensionGapDays,
    accountReceipts: {
      irp: calculateAccountReceipt(input.irp.receipt ?? createAccountReceiptInput(), input.profile.birthDate, date, today, pensionStartDate),
      saving: calculateAccountReceipt(input.saving.receipt ?? createAccountReceiptInput(), input.profile.birthDate, date, today, pensionStartDate),
    },
    taxCredits, reinvestments: reinvestError ? [] : reinvestments, reinvestError,
    reinvestEffect: !input.reinvest || reinvestError || irp.amountWon === null ? null : irp.amountWon - (calculateAccount(input.irp, date, today, simpleConfig.irpRate).amountWon ?? irp.amountWon),
    residualMonths: date && retirement.normal ? completedSimulationMonths(date, retirement.normal) : null,
    serviceMonths: date && isCalendarDate(input.profile.appointmentDate) ? completedSimulationMonths(input.profile.appointmentDate, date) : null,
    lastCalculatedDate: date ? addSimulationMonths(today, completedSimulationMonths(today, date)) : null };
}
export type SimpleResults = ReturnType<typeof calculateSimple>;
