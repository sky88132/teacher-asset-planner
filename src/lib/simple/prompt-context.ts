import type { SimpleInputs, SimpleAccount } from './model.ts';
import type { SimpleResults, SimpleAmount } from './calculation.ts';

export type PromptResultState = '공식 조회값' | '법령 기반 추정값' | '가정 기반 시뮬레이션' | '사용자 입력값' | '계산 불가';
export type PromptResultStatus = { label: string; inputState: '사용자 입력값' | '미입력'; state: PromptResultState;
  amountWon: number | null; unit: '월액' | '일시금·적립금'; confidence: string; reasons: string[]; review: '추가 검증 필요' };
export const accountHasPlan = (a: SimpleAccount) => a.balance !== '' || ((a.cycle ?? 'monthly') === 'yearly' ? (a.annual ?? '') !== '' : a.monthly !== '');
export function simplePromptContext(input: SimpleInputs, r: SimpleResults) {
  const q = input.benefits[input.profile.scheme], v = q.pensionEstimate;
  const pensionInput = r.pensionSource === 'quote' || !!v && [v.averageIncome,v.currentIncome,v.legacyIncome,v.redistributedIncome,v.factorPercent,v.nationalStartMonth].some(x => x !== '');
  const rows: PromptResultStatus[] = [];
  const add = (label: string, a: SimpleAmount, provided: boolean, state: PromptResultState, unit: PromptResultStatus['unit'] = '일시금·적립금') => rows.push({ label,
    inputState: provided ? '사용자 입력값' : '미입력', state: a.amountWon === null ? '계산 불가' : state,
    amountWon: a.amountWon, unit, confidence: a.confidence, reasons: a.errors, review: '추가 검증 필요' });
  add('공적연금', r.pension, pensionInput, r.pensionSource === 'quote' ? q.pension.source === 'official' ? '공식 조회값' : '사용자 입력값' : v?.incomeMode === 'current' ? '가정 기반 시뮬레이션' : '법령 기반 추정값', '월액');
  add('퇴직수당', r.allowance, (q.income ?? '') !== '', '법령 기반 추정값');
  if (input.profile.retirement === 'early') add('명예퇴직수당', r.honorary, true, '법령 기반 추정값');
  for (const key of ['ktcu','irp','saving'] as const) add(key === 'ktcu' ? '교직원공제회' : key === 'irp' ? 'IRP' : '연금저축', r[key], accountHasPlan(input[key]), '가정 기반 시뮬레이션');
  const hasAccounts = accountHasPlan(input.irp) || accountHasPlan(input.saving) || [input.irp.receipt,input.saving.receipt].some(v => !!v &&
    [v.openedDate,v.applicationDate,v.referenceDate,v.referenceValue,v.annualWithdrawal,v.actualReceiptYears,v.deferredDepositDate].some(x => x !== '') || !!v && (v.deferred !== 'unknown' || v.specialHistory));
  const hasFinancialInput = hasAccounts || accountHasPlan(input.ktcu) || pensionInput || (q.income ?? '') !== '' || (input.monthlyLivingCost ?? '') !== '';
  return { rows, hasAccounts, hasFinancialInput, basicOnly: !hasFinancialInput };
}
