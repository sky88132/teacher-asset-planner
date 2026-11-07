import type { KtcuInput } from './ktcu-input.ts';
import { ktcuProducts, ktcuReviewedOn } from './ktcu-products.ts';
import { parseMoney } from './pension-input-validation.ts';
import { addSimulationMonths, completedSimulationMonths, readRate, validateKtcuAccumulation, validateKtcuWithdrawal, type KtcuErrors } from './ktcu-validation.ts';
import { isCalendarDate } from '../profile-validation.ts';

const SCALE = 1_000_000_000_000n;
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
function safe(value: bigint): number {
  if (value < 0n || value > MAX) throw new Error('계산 결과가 안전한 원 단위 범위를 초과했습니다. 금액·기간·수익률을 줄여 주세요.');
  return Number(value);
}
function rateFactor(annualPercent: number): bigint {
  return BigInt(Math.round(Math.expm1(Math.log1p(annualPercent / 100) / 12) * Number(SCALE)));
}
function interest(balance: bigint, factor: bigint): bigint {
  return (balance * factor + SCALE / 2n) / SCALE;
}
export interface KtcuPoint { month: number; date: string; balanceWon: number; contributedWon: number; growthWon: number }
export interface AccumulationResult {
  source: 'simulation'; confidence: '조건부 추정값 · 자체 시뮬레이션'; taxBasis: 'gross';
  initialWon: number; futureContributionWon: number; growthWon: number; finalWon: number;
  months: number; contributionMonths: number; effectiveAnnualRate: number; rateSource: string;
  calculationDate: string; rateReviewedOn: string; lastCalculatedDate: string;
  points: KtcuPoint[];
}
export type AccumulationOutcome = { result: AccumulationResult; errors: KtcuErrors } | { result: null; errors: KtcuErrors };

/** A generic full-month model, deliberately NOT the KTCU contractual benefit formula. */
export function simulateKtcuAccumulation(input: KtcuInput, calculationDate: string): AccumulationOutcome {
  const errors = validateKtcuAccumulation(input, calculationDate);
  if (input.product !== 'long-term') errors.product = '이 적립 모델은 장기저축급여 검토용 가정 모델이며 다른 상품에는 적용하지 않습니다.';
  if (Object.keys(errors).length) return { result: null, errors };
  try {
    const initial = parseMoney(input.balance).won!;
    const monthly = BigInt(parseMoney(input.futureMonthly).won!);
    const months = completedSimulationMonths(input.basisDate, input.retirementDate);
    const contributionMonths = Math.min(months, completedSimulationMonths(input.basisDate, input.stopDate));
    const annual = input.rateSource === 'official-reference' ? ktcuProducts['long-term'].rate : readRate(input.assumedRate)!;
    const firstFactor = rateFactor(annual);
    const changedFactor = input.changeEnabled ? rateFactor(readRate(input.changedRate)!) : firstFactor;
    let balance = BigInt(initial), contributed = 0n;
    const points: KtcuPoint[] = [{ month: 0, date: input.basisDate, balanceWon: initial, contributedWon: 0, growthWon: 0 }];
    for (let month = 1; month <= months; month++) {
      const date = addSimulationMonths(input.basisDate, month);
      const deposit = month <= contributionMonths ? monthly : 0n;
      const factor = input.changeEnabled && date >= input.changeDate ? changedFactor : firstFactor;
      if (input.depositTiming === 'begin') balance += deposit;
      balance += interest(balance, factor);
      if (input.depositTiming === 'end') balance += deposit;
      contributed += deposit;
      points.push({ month, date, balanceWon: safe(balance), contributedWon: safe(contributed), growthWon: safe(balance - BigInt(initial) - contributed) });
    }
    return { errors: {}, result: { source: 'simulation', confidence: '조건부 추정값 · 자체 시뮬레이션', taxBasis: 'gross',
      initialWon: initial, futureContributionWon: safe(contributed), growthWon: safe(balance - BigInt(initial) - contributed), finalWon: safe(balance),
      months, contributionMonths, effectiveAnnualRate: annual,
      rateSource: input.rateSource === 'official-reference' ? '공식 확인 이율을 고정하는 가정 · 미래 보장 아님' : '사용자 가정 수익률',
      calculationDate, rateReviewedOn: ktcuReviewedOn, lastCalculatedDate: addSimulationMonths(input.basisDate, months), points } };
  } catch (error) { return { result: null, errors: { calculation: (error as Error).message } }; }
}

export interface WithdrawalRow { month: number; date: string; interestWon: number; paymentWon: number; balanceWon: number }
export interface WithdrawalResult {
  source: 'virtual-withdrawal'; rateSource: 'user-assumed'; taxBasis: 'gross';
  calculationDate: string; annualPercent: number; startDate: string;
  years: number; monthlyWon: number; lastPaymentWon: number; totalWon: number; growthWon: number; rows: WithdrawalRow[];
}

/** Virtual level withdrawals: monthly interest rounded half-up, payment floored, last month settles remainder. */
export function simulateVirtualWithdrawals(principalWon: number, annualPercent: number, years: number, startDate: string, calculationDate: string): WithdrawalResult {
  const errors = validateKtcuWithdrawal({ retirementDate: startDate, withdrawalRate: String(annualPercent), withdrawalYears: String(years),
    withdrawalSource: 'manual', withdrawalPrincipal: { amount: String(principalWon), unit: 'won' }, product: 'long-term' });
  if (Object.keys(errors).length || !isCalendarDate(calculationDate)) throw new Error('가상 인출 입력값을 확인해 주세요.');
  const months = years * 12, factor = rateFactor(annualPercent);
  const q = Number(factor) / Number(SCALE);
  const nominal = factor === 0n ? BigInt(principalWon) / BigInt(months)
    : BigInt(Math.floor(principalWon * q / -Math.expm1(-months * Math.log1p(q))));
  safe(nominal);
  let balance = BigInt(principalWon), total = 0n;
  const rows: WithdrawalRow[] = [];
  for (let month = 1; month <= months; month++) {
    const gain = interest(balance, factor);
    const available = balance + gain;
    const payment = month === months || nominal > available ? available : nominal;
    balance = available - payment; total += payment;
    rows.push({ month, date: addSimulationMonths(startDate, month), interestWon: safe(gain), paymentWon: safe(payment), balanceWon: safe(balance) });
  }
  return { source: 'virtual-withdrawal', rateSource: 'user-assumed', taxBasis: 'gross', calculationDate, annualPercent, startDate,
    years, monthlyWon: rows[0].paymentWon, lastPaymentWon: rows.at(-1)!.paymentWon, totalWon: safe(total), growthWon: safe(total - BigInt(principalWon)), rows };
}
