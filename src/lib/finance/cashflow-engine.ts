import { addSimulationMonths } from './ktcu-validation.ts';
import { growMonth, roundedWon } from './irp-simulation.ts';
import { ageAt, monthEnd, monthIndex, monthKey } from './cashflow-validation.ts';
export type CashflowEvent = { date: string; payment: number; balance: number };
export type CashflowAccount = { key: 'ktcu' | 'irp' | 'saving'; initial: number; events: CashflowEvent[] };
export type CashflowPlan = {
  birth: string; retirement: string; end: string; pension: { amount: number; start: string; adjustment: number };
  allowance: { amount: number; date: string } | null; honorary: { amount: number; date: string } | null; honoraryUnknown: boolean;
  accounts: CashflowAccount[]; living: number; priceDate: string; inflation: number;
  change: { date: string; amount: number } | null; specials: { date: string; amount: number }[];
};
export type CashflowRow = {
  date: string; age: number; opening: number; pension: number; ktcu: number; irp: number; saving: number;
  allowance: number; honorary: number | null; living: number; special: number; gain: number;
  paidExpenses: number; shortfall: number; cumulativeShortfall: number; cash: number; ktcuRemaining: number;
  irpRemaining: number; savingRemaining: number; closing: number;
};
export function safeWon(n: number): number { if (!Number.isSafeInteger(n) || n < 0) throw new Error('원 단위 계산 범위를 초과했습니다.'); return n; }
export function annualValue(amount: number, rate: number, years: number) { return safeWon(roundedWon(amount * Math.pow(1 + rate / 100, years))); }
/** Pure ledger: account withdrawals are transfers, not new wealth. No borrowing or emergency withdrawals. */
export function runCashflow(plan: CashflowPlan): CashflowRow[] {
  const rows: CashflowRow[] = [], balances = { ktcu: 0, irp: 0, saving: 0 };
  for (const a of plan.accounts) balances[a.key] = safeWon(a.initial);
  const eventsByMonth = new Map<string, { key: CashflowAccount['key']; event: CashflowEvent }[]>();
  for (const a of plan.accounts) for (const event of a.events) {
    const key = monthKey(event.date);
    eventsByMonth.set(key, [...(eventsByMonth.get(key) ?? []), { key: a.key, event }]);
  }
  let cash = 0, cumulativeShortfall = 0;
  const months = monthIndex(plan.end) - monthIndex(plan.retirement);
  if (!Number.isInteger(months) || months < 0 || months > 1200) throw new Error('분석 기간을 확인해 주세요.');
  const livingStart = plan.retirement.slice(8) === '01' ? monthIndex(plan.retirement) : monthIndex(plan.retirement) + 1;
  for (let i = 0; i <= months; i++) {
    const date = monthEnd(addSimulationMonths(`${monthKey(plan.retirement)}-01`, i)), index = monthIndex(date);
    const opening = safeWon(cash + balances.ktcu + balances.irp + balances.saving);
    const pension = monthKey(date) >= monthKey(plan.pension.start) ? annualValue(plan.pension.amount, plan.pension.adjustment,
      Math.floor((index - monthIndex(plan.pension.start)) / 12)) : 0;
    const allowance = plan.allowance && monthKey(plan.allowance.date) === monthKey(date) ? plan.allowance.amount : 0;
    const honorary = plan.honoraryUnknown ? null : plan.honorary && monthKey(plan.honorary.date) === monthKey(date) ? plan.honorary.amount : 0;
    let gain = 0;
    const payouts = { ktcu: 0, irp: 0, saving: 0 };
    for (const { key, event: e } of eventsByMonth.get(monthKey(date)) ?? []) {
      const nextGain = BigInt(gain) + BigInt(e.balance) + BigInt(e.payment) - BigInt(balances[key]);
      if (nextGain > BigInt(Number.MAX_SAFE_INTEGER) || nextGain < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('투자손익이 안전한 원 단위 범위를 초과했습니다.');
      gain = Number(nextGain);
      balances[key] = safeWon(e.balance); payouts[key] = safeWon(payouts[key] + e.payment);
    }
    const changed = plan.change && monthKey(date) >= monthKey(plan.change.date);
    const expenseBase = changed ? plan.change!.amount : plan.living, priceDate = changed ? plan.change!.date : plan.priceDate;
    const living = index >= livingStart ? annualValue(expenseBase, plan.inflation, Math.floor((index - monthIndex(priceDate)) / 12)) : 0;
    const special = safeWon(plan.specials.filter(s => monthKey(s.date) === monthKey(date)).reduce((sum, s) => sum + s.amount, 0));
    const available = safeWon(cash + pension + allowance + (honorary ?? 0) + payouts.ktcu + payouts.irp + payouts.saving);
    const requested = safeWon(living + special), paidExpenses = Math.min(available, requested), shortfall = requested - paidExpenses;
    cumulativeShortfall = safeWon(cumulativeShortfall + shortfall); cash = safeWon(available - paidExpenses);
    const closing = safeWon(cash + balances.ktcu + balances.irp + balances.saving);
    if (BigInt(closing) !== BigInt(opening) + BigInt(pension) + BigInt(allowance) + BigInt(honorary ?? 0) + BigInt(gain) - BigInt(paidExpenses)) throw new Error('자산 이동 검증에 실패했습니다.');
    rows.push({ date, age: ageAt(plan.birth, date), opening, pension, ...payouts, allowance, honorary, living, special, gain,
      paidExpenses, shortfall, cumulativeShortfall, cash, ktcuRemaining: balances.ktcu, irpRemaining: balances.irp, savingRemaining: balances.saving, closing });
  }
  return rows;
}
export function aggregateCashflow(rows: CashflowRow[], by: 'year' | 'age') {
  const groups = new Map<string, CashflowRow[]>();
  for (const r of rows) { const key = by === 'year' ? r.date.slice(0, 4) : String(r.age); groups.set(key, [...(groups.get(key) ?? []), r]); }
  return [...groups].map(([period, items]) => ({ period, months: items.length, opening: items[0].opening, closing: items.at(-1)!.closing,
    pension: items.reduce((sum, r) => sum + r.pension, 0), withdrawals: items.reduce((sum, r) => sum + r.ktcu + r.irp + r.saving, 0),
    allowances: items.reduce((sum, r) => sum + r.allowance + (r.honorary ?? 0), 0), living: items.reduce((sum, r) => sum + r.living, 0),
    special: items.reduce((sum, r) => sum + r.special, 0), gain: items.reduce((sum, r) => sum + r.gain, 0), shortfall: items.reduce((sum, r) => sum + r.shortfall, 0),
    honoraryUnknown: items.some(r => r.honorary === null) }));
}
/** Monthly anniversary events; level withdrawals themselves come from existing account engines. */
export function accountEvents(initial: number, retirement: string, start: string, end: string, rate: number, fee: number,
  withdrawals: CashflowEvent[]): CashflowEvent[] {
  const events: CashflowEvent[] = []; let balance = initial;
  for (let m = 1; m <= 1200; m++) {
    const date = addSimulationMonths(retirement, m); if (date > start || date > end) break;
    balance = growMonth(balance, rate, fee); events.push({ date, balance, payment: 0 });
  }
  for (const row of withdrawals) if (row.date <= end) { events.push(row); balance = row.balance; }
  const last = withdrawals.at(-1);
  if (last && last.date <= end) for (let m = 1; m <= 1200; m++) {
    const date = addSimulationMonths(last.date, m); if (date > end) break;
    balance = growMonth(balance, rate, fee); events.push({ date, balance, payment: 0 });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}
