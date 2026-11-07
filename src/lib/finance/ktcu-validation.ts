import { isCalendarDate, todayInKorea } from '../profile-validation.ts';
import { parseMoney } from './pension-input-validation.ts';
import type { MoneyInput } from './pension-input.ts';
import type { KtcuInput, KtcuQuote } from './ktcu-input.ts';
import { ktcuProducts } from './ktcu-products.ts';

export type KtcuErrors = Record<string, string>;
export function readRate(raw: string): number | null {
  if (!/^\d{1,2}(?:\.\d{1,4})?$/.test(raw.trim())) return null;
  const rate = Number(raw);
  return rate <= 20 ? rate : null; // simulation input range, not a product rate/guarantee
}
export function addSimulationMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const index = year * 12 + month - 1 + months;
  const y = Math.floor(index / 12), m = index % 12 + 1;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const end = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(Math.min(day, end)).padStart(2, '0')}`;
}
export function completedSimulationMonths(start: string, end: string): number {
  const [sy, sm] = start.split('-').map(Number), [ey, em] = end.split('-').map(Number);
  const months = (ey - sy) * 12 + em - sm;
  return Math.max(0, months - (addSimulationMonths(start, months) > end ? 1 : 0));
}
function requireMoney(value: MoneyInput, key: string, errors: KtcuErrors) {
  const parsed = parseMoney(value);
  if (parsed.error || parsed.won === null) errors[key] = parsed.error ?? '금액을 입력해 주세요. 0원은 직접 입력한 경우에만 반영합니다.';
}
export function validateKtcuAccumulation(input: KtcuInput, today = todayInKorea()): KtcuErrors {
  const errors: KtcuErrors = {};
  if (!isCalendarDate(today)) errors.calculationDate = '계산 시점을 확인해 주세요.';
  for (const key of ['balance', 'currentMonthly', 'futureMonthly'] as const) requireMoney(input[key], key, errors);
  if (!['begin', 'end'].includes(input.depositTiming)) errors.depositTiming = '월 납입 시점을 선택해 주세요.';
  if (!['user', 'official-current'].includes(input.balanceSource)) errors.balanceSource = '현재 잔액의 출처를 확인해 주세요.';
  for (const key of ['basisDate', 'stopDate', 'retirementDate'] as const) {
    if (!isCalendarDate(input[key])) errors[key] = '실제 달력에 있는 날짜를 입력해 주세요.';
  }
  if (!errors.basisDate && input.basisDate > today) errors.basisDate = '현재 잔액 기준일은 오늘보다 늦을 수 없습니다.';
  if (!errors.basisDate && !errors.retirementDate) {
    if (input.retirementDate < input.basisDate) errors.retirementDate = '퇴직예정일은 잔액 기준일보다 빠를 수 없습니다.';
    else if (completedSimulationMonths(input.basisDate, input.retirementDate) > 720) errors.retirementDate = '시뮬레이션은 최대 60년까지 지원합니다.';
  }
  if (!errors.stopDate && !errors.basisDate && input.stopDate < input.basisDate) errors.stopDate = '납입 종료일은 잔액 기준일 이후로 입력해 주세요. 같은 날은 향후 납입 0개월입니다.';
  if (!errors.stopDate && !errors.retirementDate && input.stopDate > input.retirementDate) errors.stopDate = '납입 종료일은 퇴직예정일보다 늦을 수 없습니다.';
  if (!['assumed', 'official-reference'].includes(input.rateSource)) errors.rateSource = '이율 출처를 확인해 주세요.';
  if (input.rateSource === 'assumed' && readRate(input.assumedRate) === null) errors.assumedRate = '가정 연 수익률을 0~20%, 소수 넷째 자리까지 입력해 주세요.';
  if (input.rateSource === 'official-reference' && !errors.basisDate && input.basisDate < ktcuProducts['long-term'].effectiveOn) errors.rateSource = '이 공식 참고 이율의 적용 시작일 이전 기준일에는 사용자 가정 이율을 입력해 주세요.';
  if (input.changeEnabled) {
    if (readRate(input.changedRate) === null) errors.changedRate = '변경 후 가정 연 수익률을 0~20%로 입력해 주세요.';
    if (!isCalendarDate(input.changeDate)) errors.changeDate = '이율 변경일을 입력해 주세요.';
    else if ((!errors.basisDate && input.changeDate <= input.basisDate) || (!errors.retirementDate && input.changeDate > input.retirementDate)) errors.changeDate = '변경일은 기준일 이후, 퇴직예정일 이내여야 합니다.';
  }
  return errors;
}
export function validateKtcuQuote(quote: KtcuQuote, today = todayInKorea()): KtcuErrors {
  const errors: KtcuErrors = {};
  requireMoney(quote.money, 'quoteMoney', errors);
  if (!isCalendarDate(quote.queryDate) || quote.queryDate > today) errors.quoteDate = '조회 기준일은 오늘까지의 유효한 날짜로 입력해 주세요.';
  if (!isCalendarDate(quote.targetDate)) errors.quoteTarget = '조회 시 가정한 수령·퇴직일을 입력해 주세요.';
  if (!['gross', 'net'].includes(quote.taxBasis)) errors.quoteTax = '세전·세후를 선택해 주세요.';
  if (!['lump-sum', 'monthly', 'yearly'].includes(quote.payment)) errors.quotePayment = '조회 금액의 지급 단위를 선택해 주세요.';
  return errors;
}
export function validateKtcuWithdrawal(input: Pick<KtcuInput, 'retirementDate' | 'withdrawalRate' | 'withdrawalYears' | 'withdrawalSource' | 'withdrawalPrincipal' | 'product'>): KtcuErrors {
  const errors: KtcuErrors = {};
  if (!isCalendarDate(input.retirementDate) || input.retirementDate > '9969-12-31') errors.retirementDate = '퇴직예정일을 유효한 날짜로 입력해 주세요.';
  if (readRate(input.withdrawalRate) === null) errors.withdrawalRate = '가상 인출 연 수익률을 0~20%로 입력해 주세요.';
  if (!['5', '10', '15', '20', '25', '30'].includes(input.withdrawalYears)) errors.withdrawalYears = '희망 수령기간을 선택해 주세요.';
  if (input.withdrawalSource === 'manual') requireMoney(input.withdrawalPrincipal, 'withdrawalPrincipal', errors);
  else if (input.withdrawalSource !== 'projection' || input.product !== 'long-term') errors.withdrawalPrincipal = '장기저축 적립 전망 또는 별도 인출 시작금액을 선택해 주세요.';
  return errors;
}
