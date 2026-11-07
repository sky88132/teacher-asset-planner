export type AccountKey = 'irp' | 'saving';
export type RetirementAccountInput = {
  enabled: boolean; balance: string; annual: string; cycle: 'monthly' | 'yearly';
  rate: string; fee: string; stop: string; start: string; years: string;
  withdrawal: string; credit: boolean;
};
export type IrpInput = {
  basis: string; retirement: string; irp: RetirementAccountInput; saving: RetirementAccountInput;
  incomeKind: 'wage' | 'comprehensive'; income: string; capacity: string;
  scopeConfirmed: boolean; refundCash: string; reinvest: boolean; ratio: string;
  target: 'general' | 'irp' | 'saving'; refundMonth: string; reinvestRate: string;
  conservative: string; standard: string; optimistic: string;
  transferKind: string; transferAmount: string; transferDate: string; transferRate: string;
};
export function createIrpInput(): IrpInput {
  const account = (enabled: boolean): RetirementAccountInput => ({ enabled, balance: '', annual: '',
    cycle: 'monthly', rate: '', fee: '', stop: '', start: '', years: '', withdrawal: '', credit: true });
  return { basis: '', retirement: '', irp: account(true), saving: account(false),
    incomeKind: 'wage', income: '', capacity: '', scopeConfirmed: false, refundCash: '',
    reinvest: false, ratio: '', target: 'general', refundMonth: '5', reinvestRate: '',
    conservative: '', standard: '', optimistic: '', transferKind: 'public', transferAmount: '', transferDate: '', transferRate: '' };
}
export const irpDisclaimer = '본 결과는 입력한 납입금, 기간, 수익률 및 세금 조건에 따른 예상 시뮬레이션입니다. 실제 투자수익과 연금 수령액은 시장 상황, 수수료, 세법 및 개인별 조건에 따라 달라질 수 있으며 원금손실이 발생할 수 있습니다. 참고용으로 활용하시기 바랍니다.';
