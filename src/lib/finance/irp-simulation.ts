import type { IrpInput, RetirementAccountInput } from './irp-input.ts';
import { validateIrp, irpMoney, irpRate } from './irp-validation.ts';
import { addSimulationMonths, completedSimulationMonths } from './ktcu-validation.ts';
import { isCalendarDate } from '../profile-validation.ts';
import { pensionTaxCredit } from './irp-tax.ts';

const SCALE = 1000000000000n;
export function roundedWon(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) throw new Error('금액 범위를 초과했습니다.');
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}
function checked(n: number): number { if (!Number.isSafeInteger(n) || n < 0) throw new Error('원 단위 계산 범위를 초과했습니다.'); return n; }
function multiply(n: number, factor: number) {
  const fixed = BigInt(Math.round(factor * Number(SCALE)));
  return checked(Number((BigInt(n) * fixed + SCALE / 2n) / SCALE));
}
export function growMonth(balance: number, rate: number, fee: number) {
  if (irpRate(String(rate)) === null || irpRate(String(fee), 0, 20) === null) throw new Error('수익률 범위를 확인해 주세요.');
  const afterReturn = multiply(checked(balance), Math.pow(1 + rate / 100, 1 / 12));
  return multiply(afterReturn, Math.pow(1 - fee / 100, 1 / 12));
}
export function scheduledContribution(annual: number, cycle: 'monthly' | 'yearly', month: number) {
  checked(annual);
  if (!Number.isInteger(month) || month < 1) throw new Error('월 순서를 확인해 주세요.');
  if (cycle === 'yearly') return month % 12 === 0 ? annual : 0;
  if (cycle !== 'monthly') throw new Error('납입 주기를 확인해 주세요.');
  // Annual budget is split into exact won: the first remainder months receive one extra won.
  return Math.floor(annual / 12) + ((month - 1) % 12 < annual % 12 ? 1 : 0);
}
export type GrowthRow = { date: string; irp: number; saving: number; deposits: number; reinvested: number; cash: number; baselineCash: number; total: number; baseline: number };
export function simulateIrp(input: IrpInput, overrideRate?: number) {
  const errors = validateIrp(input);
  if (overrideRate !== undefined && irpRate(String(overrideRate)) === null) errors.push('시나리오 수익률 범위를 확인해 주세요.');
  if (errors.length) return { ok: false as const, amountWon: null, errors };
  try {
    const income = irpMoney(input.income), capacity = irpMoney(input.capacity), cashLimit = irpMoney(input.refundCash);
    const taxReady = input.scopeConfirmed && income !== null && ['wage', 'comprehensive'].includes(input.incomeKind);
    if (input.reinvest && (!taxReady || capacity === null || cashLimit === null || irpRate(input.ratio, 0, 100) === null || irpRate(input.reinvestRate) === null || !/^(?:[1-9]|1[0-2])$/.test(input.refundMonth) || input.target !== 'general')) return { ok: false as const, amountWon: null, errors: ['재투자는 소득·적용 범위 확인, 남은 국세, 재투자 가능한 국세 환급 현금 상한, 비율·수익률·시점 입력이 필요합니다. 일반 투자계좌만 지원합니다.'] };
    const months = completedSimulationMonths(input.basis, input.retirement);
    const balances = { irp: input.irp.enabled ? irpMoney(input.irp.balance)! : 0, saving: input.saving.enabled ? irpMoney(input.saving.balance)! : 0 };
    const initial = checked(balances.irp + balances.saving);
    let deposits = 0, reinvested = 0, cash = 0, baselineCash = 0, reinvestPrincipal = 0;
    const annuals = new Map<number, { irp: number; saving: number }>();
    const paidYears = new Set<number>();
    const rows: GrowthRow[] = [];
    const record = (date: string) => rows.push({ date, ...balances, deposits, reinvested, cash, baselineCash, total: checked(balances.irp + balances.saving + reinvested + cash), baseline: checked(balances.irp + balances.saving + baselineCash) });
    record(input.basis);
    for (let month = 1; month <= months; month++) {
      const date = addSimulationMonths(input.basis, month), year = Number(date.slice(0, 4));
      const annual = annuals.get(year) ?? { irp: 0, saving: 0 };
      for (const key of ['irp', 'saving'] as const) {
        const a = input[key]; if (!a.enabled) continue;
        balances[key] = growMonth(balances[key], overrideRate ?? Number(a.rate), Number(a.fee));
        const payment = date <= a.stop ? scheduledContribution(irpMoney(a.annual)!, a.cycle, month) : 0;
        balances[key] = checked(balances[key] + payment); deposits = checked(deposits + payment);
        if (a.credit) annual[key] = checked(annual[key] + payment);
      }
      annuals.set(year, annual);
      if (input.reinvest) {
        reinvested = growMonth(reinvested, Number(input.reinvestRate), 0);
        if (Number(date.slice(5, 7)) === Number(input.refundMonth) && !paidYears.has(year - 1)) {
          const previous = annuals.get(year - 1);
          if (previous) {
            const credit = pensionTaxCredit(previous.irp, previous.saving, input.incomeKind, income!, capacity);
            const refund = Math.min(credit.usable!, cashLimit!);
            const invest = Math.floor(refund * Number(input.ratio) / 100);
            baselineCash = checked(baselineCash + refund); cash = checked(cash + refund - invest);
            reinvested = checked(reinvested + invest); reinvestPrincipal = checked(reinvestPrincipal + invest);
            paidYears.add(year - 1);
          }
        }
      }
      record(date);
    }
    const taxYears = [...annuals].map(([year, annual]) => ({ year, ...annual, credit: taxReady ? pensionTaxCredit(annual.irp, annual.saving, input.incomeKind, income!, capacity) : null, refundReceived: paidYears.has(year) }));
    const last = rows.at(-1)!;
    return { ok: true as const, amountWon: checked(balances.irp + balances.saving), initial, deposits,
      investmentGain: balances.irp + balances.saving - initial - deposits, rows, taxYears, reinvestPrincipal,
      reinvestGain: reinvested - reinvestPrincipal, comparison: { without: last.baseline, with: last.total, difference: last.total - last.baseline } };
  } catch (e) { return { ok: false as const, amountWon: null, errors: [e instanceof Error ? e.message : '계산 범위를 확인해 주세요.'] }; }
}
export function simulateWithdrawal(balance: number, retirement: string, account: RetirementAccountInput) {
  if (!isCalendarDate(retirement) || !isCalendarDate(account.start) || account.start < retirement || completedSimulationMonths(retirement, account.start) > 720 || !/^\d{1,2}$/.test(account.years) || Number(account.years) < 1 || Number(account.years) > 40 || irpRate(account.rate) === null || irpRate(account.fee, 0, 20) === null || (account.withdrawal.trim() !== '' && (irpMoney(account.withdrawal) === null || irpMoney(account.withdrawal) === 0))) return { ok: false as const, amountWon: null, error: '수령 시작일은 퇴직일 이후 60년 이내, 기간은 1~40년으로 입력해 주세요. 희망 월 인출액은 비워 두거나 0원보다 크게 입력해 주세요.' };
  try {
    let remaining = checked(balance);
    const rate = Number(account.rate), fee = Number(account.fee), months = Number(account.years) * 12;
    for (let i = 0; i < completedSimulationMonths(retirement, account.start); i++) remaining = growMonth(remaining, rate, fee);
    const opening = remaining;
    const factor = Math.pow((1 + rate / 100) * (1 - fee / 100), 1 / 12), q = factor - 1;
    const requested = account.withdrawal.trim() ? irpMoney(account.withdrawal)! : Math.max(0, Math.floor(Math.abs(q) < 1e-12 ? remaining / months : remaining * q / (1 - Math.pow(factor, -months))));
    checked(requested);
    const rows = []; let total = 0, depleted: string | null = null;
    for (let i = 1; i <= months; i++) {
      remaining = growMonth(remaining, rate, fee);
      const payment = !account.withdrawal.trim() && i === months ? remaining : Math.min(remaining, requested);
      remaining -= payment; total = checked(total + payment);
      const date = addSimulationMonths(account.start, i);
      if (remaining === 0 && depleted === null) depleted = date;
      rows.push({ date, payment, remaining });
    }
    return { ok: true as const, amountWon: requested, opening, total, remaining, depleted, rows };
  } catch { return { ok: false as const, amountWon: null, error: '원 단위 계산 범위를 초과했습니다.' }; }
}
