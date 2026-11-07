import type { BenefitInput } from '../finance/pension-input.ts';
import { parseMoney } from '../finance/pension-input-validation.ts';
import { createKtcuInput } from '../finance/ktcu-input.ts';
import { simulateKtcuAccumulation, simulateVirtualWithdrawals } from '../finance/ktcu-simulation.ts';
import { addSimulationMonths, completedSimulationMonths } from '../finance/ktcu-validation.ts';
import { growMonth } from '../finance/irp-simulation.ts';
import { isCalendarDate } from '../profile-validation.ts';
import { simpleConfig } from './config.ts';
import type { SimpleAccount, SimpleInputs } from './model.ts';
import { moneyWon, resolveRetirement, projectedStep } from './validation.ts';

export type SimpleAmount = { amountWon: number | null; errors: string[]; confidence: string; date: string | null;
  initial: number | null; deposits: number | null; gain: number | null; initialFuture: number | null; depositsFuture: number | null };
export function noAmount(errors: string[], date: string | null = null): SimpleAmount {
  return { amountWon: null, errors: [...new Set(errors)], confidence: '계산 불가', date, initial: null, deposits: null, gain: null, initialFuture: null, depositsFuture: null };
}
function safe(n: number) { if (!Number.isSafeInteger(n) || n < 0) throw new Error('안전한 원 단위 계산 범위를 초과했습니다.'); return n; }
/** Full monthly anniversaries, return first, month-end deposit second; no tax or fee model. */
export function calculateAccount(input: SimpleAccount, date: string | null, today: string, rate: number): SimpleAmount {
  const initial = moneyWon(input.balance), monthly = moneyWon(input.monthly);
  if (!date || !isCalendarDate(date) || date < today) return noAmount(['01의 예상 퇴직일을 확인해 주세요.']);
  if (initial.won === null || initial.error || monthly.won === null || monthly.error) return noAmount([initial.error ?? monthly.error ?? '현재 적립금과 월 납입액을 입력해 주세요. 0원은 직접 입력합니다.'], date);
  const months = completedSimulationMonths(today, date);
  if (months > simpleConfig.maxMonths) return noAmount(['계산 기간은 최대 60년입니다.'], date);
  try {
    let balance = initial.won, initialFuture = initial.won;
    for (let i = 0; i < months; i++) { balance = safe(growMonth(balance, rate, 0) + monthly.won); initialFuture = growMonth(initialFuture, rate, 0); }
    const deposits = safe(monthly.won * months);
    return { amountWon: balance, initial: initial.won, deposits, gain: balance - initial.won - deposits,
      initialFuture, depositsFuture: balance - initialFuture, date, errors: [], confidence: '조건부 추정값' };
  } catch (e) { return noAmount([(e as Error).message], date); }
}
export function quoteAmount(q: BenefitInput, kind: 'pension' | 'allowance' | 'honorary', date: string | null, today: string): SimpleAmount {
  const errors: string[] = [];
  const parsed = parseMoney(q.money);
  if (parsed.won === null || parsed.error) errors.push(parsed.error ?? '공식 조회 금액을 입력해 주세요.');
  if (!date) errors.push('01의 예상 퇴직일을 확인해 주세요.');
  else if (q.retirementDate !== date) errors.push('조회 시 가정한 퇴직일이 현재 퇴직일과 다릅니다. 재확인 필요');
  if (!isCalendarDate(q.queryDate) || q.queryDate > today) errors.push('조회 기준일을 확인해 주세요.');
  if (!['gross', 'net'].includes(q.taxBasis)) errors.push('세전·세후를 선택해 주세요.');
  if (!['official', 'user-estimate'].includes(q.source)) errors.push('금액 출처를 선택해 주세요.');
  if (kind === 'pension' && (!isCalendarDate(q.startDate) || (!!date && q.startDate < date))) errors.push('연금 지급개시일을 확인해 주세요.');
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
  const irpMonthly = moneyWon(input.irp.monthly).won, savingMonthly = moneyWon(input.saving.monthly).won;
  const overLimit = (irpMonthly !== null && irpMonthly > simpleConfig.annualPersonalLimit / 12)
    || (savingMonthly !== null && savingMonthly > simpleConfig.annualPersonalLimit / 12)
    || (irpMonthly !== null && savingMonthly !== null && irpMonthly + savingMonthly > simpleConfig.annualPersonalLimit / 12);
  if (overLimit) {
    const error = ['매월 계속 납입 계획이 연금계좌 일반 개인납입 합산 연 1,800만원 한도를 초과합니다. 다른 납입·특례는 별도 확인이 필요합니다.'];
    irp = noAmount(error, date); saving = noAmount(error, date);
  }
  const quotes = input.benefits[input.profile.scheme];
  const pension = quoteAmount(quotes.pension, 'pension', date, today);
  const allowance = input.profile.scheme === 'national' ? noAmount(['국민연금 가입자는 공무원·사학 퇴직수당 대상이 아닙니다. 별도 법정 퇴직급여 적용·계속근로기간·평균임금 또는 DB/DC 내역을 확인해 주세요.'], date) : quoteAmount(quotes.allowance, 'allowance', date, today);
  let honorary = quoteAmount(quotes.honorary, 'honorary', date, today);
  if (input.profile.retirement !== 'early' || input.profile.scheme === 'national') honorary = noAmount(['명예퇴직수당 적용 대상·신분 확인 필요'], date);
  else if (quotes.eligibility !== 'confirmed' || quotes.selection !== 'selected') honorary = noAmount(['명예퇴직수당 지급 자격과 실제 선정 여부가 확인되지 않았습니다.'], date);
  const benefitItems = input.profile.retirement === 'early' ? [allowance, honorary] : [allowance];
  const sameTax = input.profile.retirement !== 'early' || quotes.allowance.taxBasis === quotes.honorary.taxBasis;
  const benefitsTotal = sameTax ? sumKnown(benefitItems, date) : null;
  const accountsTotal = sumKnown([irp, saving], date);
  const accumulationTotal = sumKnown([ktcu, irp, saving], date);
  return { today, retirement, step, ktcu, split, splitError, irp, saving, pension, allowance, honorary,
    benefitsTotal, accountsTotal, accumulationTotal, accumulation,
    residualMonths: date && retirement.normal ? completedSimulationMonths(date, retirement.normal) : null,
    serviceMonths: date && isCalendarDate(input.profile.appointmentDate) ? completedSimulationMonths(input.profile.appointmentDate, date) : null,
    lastCalculatedDate: date ? addSimulationMonths(today, completedSimulationMonths(today, date)) : null };
}
export type SimpleResults = ReturnType<typeof calculateSimple>;
