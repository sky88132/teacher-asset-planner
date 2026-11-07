import type { MoneyInput, TaxBasis } from './pension-input.ts';

export type KtcuProduct = 'long-term' | 'installment' | 'retirement-interest' | 'retirement-annuity' | 'retirement-saving';
export interface KtcuQuote {
  enabled: boolean;
  money: MoneyInput;
  queryDate: string;
  targetDate: string;
  taxBasis: TaxBasis;
  payment: '' | 'lump-sum' | 'monthly' | 'yearly';
}
export interface KtcuInput {
  product: KtcuProduct;
  balance: MoneyInput;
  balanceSource: 'user' | 'official-current';
  currentMonthly: MoneyInput;
  futureMonthly: MoneyInput;
  depositTiming: 'begin' | 'end';
  basisDate: string;
  stopDate: string;
  retirementDate: string;
  rateSource: 'assumed' | 'official-reference';
  assumedRate: string;
  changeEnabled: boolean;
  changeDate: string;
  changedRate: string;
  withdrawalSource: 'manual' | 'projection';
  withdrawalPrincipal: MoneyInput;
  withdrawalRate: string;
  withdrawalYears: string;
  quotes: Record<KtcuProduct, KtcuQuote>;
}
export function createKtcuInput(): KtcuInput {
  const money = (): MoneyInput => ({ amount: '', unit: 'won' });
  const quote = (): KtcuQuote => ({ enabled: false, money: money(), queryDate: '', targetDate: '', taxBasis: '', payment: '' });
  return { product: 'long-term', balance: money(), balanceSource: 'user', currentMonthly: money(), futureMonthly: money(), depositTiming: 'end',
    basisDate: '', stopDate: '', retirementDate: '', rateSource: 'assumed', assumedRate: '', changeEnabled: false,
    changeDate: '', changedRate: '', withdrawalSource: 'manual', withdrawalPrincipal: money(), withdrawalRate: '', withdrawalYears: '',
    quotes: { 'long-term': quote(), installment: quote(), 'retirement-interest': quote(), 'retirement-annuity': quote(), 'retirement-saving': quote() } };
}
export const ktcuDisclaimer = '본 계산은 입력한 납입액, 기간 및 적용 이율에 따른 예상 결과입니다. 실제 지급액은 한국교직원공제회의 상품별 지급 기준, 이율 변동, 세금 및 가입 조건에 따라 달라질 수 있습니다. 참고용으로 활용하시고 정확한 금액은 공제회 공식 조회 결과를 확인하시기 바랍니다.';
