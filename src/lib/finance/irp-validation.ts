import { isCalendarDate } from '../profile-validation.ts';
import { parseMoney } from './pension-input-validation.ts';
import { completedSimulationMonths } from './ktcu-validation.ts';
import type { IrpInput } from './irp-input.ts';
export function irpMoney(raw: string): number | null { return parseMoney({ amount: raw, unit: 'won' }).won; }
export function irpRate(raw: string, min = -90, max = 100): number | null {
  if (!/^-?\d{1,3}(?:\.\d{1,4})?$/.test(raw.trim())) return null;
  const n = Number(raw); return n >= min && n <= max ? n : null;
}
export function validateIrp(input: IrpInput): string[] {
  const errors: string[] = [];
  if (!isCalendarDate(input.basis) || !isCalendarDate(input.retirement)) return ['잔액 기준일과 퇴직예정일을 입력해 주세요.'];
  if (input.retirement < input.basis || completedSimulationMonths(input.basis, input.retirement) > 720 || input.retirement > '9899-12-31') errors.push('퇴직일은 기준일 이후 60년 이내로 입력해 주세요.');
  if (!input.irp.enabled && !input.saving.enabled) errors.push('계산할 계좌를 선택해 주세요.');
  for (const key of ['irp', 'saving'] as const) {
    const a = input[key]; if (!a.enabled) continue;
    const label = key === 'irp' ? 'IRP' : '연금저축';
    if (irpMoney(a.balance) === null || irpMoney(a.annual) === null) errors.push(`${label}: 현재 평가금액과 연간 납입액을 원 단위로 입력해 주세요. 0원은 직접 입력해 주세요.`);
    if (irpRate(a.rate) === null || irpRate(a.fee, 0, 20) === null) errors.push(`${label}: 수익률은 -90~100%, 수수료율은 0~20%로 입력해 주세요.`);
    if (!['monthly', 'yearly'].includes(a.cycle)) errors.push(`${label}: 납입 주기를 확인해 주세요.`);
    if (!isCalendarDate(a.stop) || a.stop < input.basis || a.stop > input.retirement) errors.push(`${label}: 납입 종료일은 기준일~퇴직일 사이여야 합니다.`);
  }
  // This ordinary-contribution model excludes ISA/housing exceptions and other accounts.
  const annual = (input.irp.enabled ? irpMoney(input.irp.annual) : 0) ?? 0;
  const saving = (input.saving.enabled ? irpMoney(input.saving.annual) : 0) ?? 0;
  if (annual + saving > 18000000) errors.push('일반 개인납입금 합산 연 1,800만 원 한도를 초과했습니다. 특례 납입은 지원하지 않습니다.');
  return errors;
}
