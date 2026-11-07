export type CashflowKey = 'early' | 'normal';
export type CashflowWithdrawalInput = { start: string; years: string; mode: 'shared' | 'period' | 'fixed'; monthly: string };
export type CashflowScenarioInput = {
  living: string; allowanceDate: string; honoraryDate: string; includeAllowance: boolean; includeKtcu: boolean;
  ktcuMode: 'lump' | 'virtual'; ktcuStart: string; ktcuYears: string; ktcuRate: string;
  irp: CashflowWithdrawalInput; saving: CashflowWithdrawalInput;
};
export type CashflowInput = {
  finalAge: string; compareAge: string; taxBasis: 'gross' | 'net'; acceptPartialMonths: boolean;
  sharedLiving: boolean; living: string; priceDate: string; inflation: string; pensionAdjustment: string;
  livingChange: boolean; changeDate: string; changedLiving: string;
  specials: { id: string; date: string; amount: string; target: 'both' | CashflowKey }[];
  scenarios: Record<CashflowKey, CashflowScenarioInput>;
};
export function createCashflowInput(): CashflowInput {
  const scenario = (): CashflowScenarioInput => ({ living: '', allowanceDate: '', honoraryDate: '', includeAllowance: true, includeKtcu: true,
    ktcuMode: 'lump', ktcuStart: '', ktcuYears: '', ktcuRate: '',
    irp: { start: '', years: '', mode: 'shared', monthly: '' }, saving: { start: '', years: '', mode: 'shared', monthly: '' } });
  return { finalAge: '90', compareAge: '85', taxBasis: 'gross', acceptPartialMonths: false, sharedLiving: true,
    living: '', priceDate: '', inflation: '', pensionAdjustment: '', livingChange: false, changeDate: '', changedLiving: '', specials: [],
    scenarios: { early: scenario(), normal: scenario() } };
}
export const cashflowDisclaimer = '본 결과는 입력한 연금·급여·적립금, 지급 시점, 생활비 및 수익률 가정에 따른 조건부 현금흐름 시뮬레이션입니다. 실제 수령액과 지급 가능 여부, 세금, 수익률 및 지출은 달라질 수 있습니다. 참고용으로 활용하시고 정확한 금액과 조건은 해당 기관에서 확인하시기 바랍니다.';
