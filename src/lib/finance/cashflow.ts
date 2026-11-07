import type { TeacherProfile } from '../profile.ts';
import { isCalendarDate } from '../profile-validation.ts';
import type { PensionInputs } from './pension-input.ts';
import type { KtcuInput } from './ktcu-input.ts';
import type { IrpInput } from './irp-input.ts';
import type { RetirementComparisonInput } from './retirement-comparison-input.ts';
import { calculateRetirementScenario, type ComparisonItem } from './retirement-comparison.ts';
import { scenarioDate } from './retirement-comparison-validation.ts';
import { completedSimulationMonths } from './ktcu-validation.ts';
import { simulateVirtualWithdrawals } from './ktcu-simulation.ts';
import { growMonth, simulateWithdrawal } from './irp-simulation.ts';
import { irpMoney, irpRate } from './irp-validation.ts';
import type { CashflowInput, CashflowKey } from './cashflow-input.ts';
import { ageDate, monthEnd, monthKey, validateCashflow } from './cashflow-validation.ts';
import { accountEvents, aggregateCashflow, runCashflow, safeWon, type CashflowAccount, type CashflowPlan } from './cashflow-engine.ts';

export function simulateRetirementCashflow(key: CashflowKey, input: CashflowInput, comparison: RetirementComparisonInput,
  profile: TeacherProfile, pensions: PensionInputs, ktcu: KtcuInput, irp: IrpInput, today: string) {
  const snapshot = calculateRetirementScenario(key, comparison, profile, pensions, ktcu, irp, today);
  const date = snapshot.date, s = input.scenarios[key], sourceScenario = comparison.scenarios[key];
  const errors = [...snapshot.errors, ...validateCashflow(input, key, profile.birthDate, date)], notes: string[] = [];
  if (snapshot.aggregationIssues.length && !input.acceptPartialMonths) errors.push('05의 기준일·부분 월 차이를 확인하고, 완료 월 이후 수익·납입을 반영하지 않는 가정에 동의해 주세요.');
  if (input.acceptPartialMonths) notes.push(...snapshot.aggregationIssues, '완료 계산월부터 퇴직일까지 추가 납입·수익이 없다는 가정으로 시작합니다.');
  function requireItem(item: ComparisonItem, label: string) {
    if (item.amountWon === null) errors.push(`${label}: ${item.notes.join(' ')}`);
    else if (item.tax !== input.taxBasis) errors.push(`${label}: 선택한 ${input.taxBasis === 'gross' ? '세전' : '입력액 세후'} 기준과 일치하지 않습니다. 자동 세금 변환은 제공하지 않습니다.`);
  }
  requireItem(snapshot.pension, '공식 월연금');
  if (s.includeAllowance) requireItem(snapshot.allowance, '퇴직수당'); else notes.push('퇴직수당은 사용자가 이 분석에서 제외했습니다. 미입력을 0원으로 확정한 것이 아닙니다.');
  if (s.includeKtcu) requireItem(snapshot.ktcu, '공제회 퇴직 적립금'); else notes.push('공제회는 사용자가 이 분석에서 제외했습니다.');
  for (const a of ['irp', 'saving'] as const) if (irp[a].enabled) requireItem(snapshot[a], a === 'irp' ? 'IRP 퇴직 적립금' : '연금저축 퇴직 적립금');
  const honoraryUnknown = key === 'early' && snapshot.honorary.amountWon === null && sourceScenario.selection !== 'rejected';
  if (key === 'early' && snapshot.honorary.amountWon !== null) requireItem(snapshot.honorary, '명예퇴직수당');
  if (honoraryUnknown) notes.push('명퇴수당은 자격·선정·금액이 미확정 또는 누락되어 유입을 생성하지 않습니다. 확인된 원천만의 부분 시뮬레이션이며 실제 금액을 0원으로 정하지 않습니다.');
  if (key === 'early' && sourceScenario.selection === 'rejected') notes.push('사용자가 명퇴수당 미선정으로 기록하여 명퇴수당 유입을 제외했습니다.');
  const end = /^\d{1,3}$/.test(input.finalAge) && Number(input.finalAge) <= 120 && isCalendarDate(profile.birthDate)
    ? monthEnd(ageDate(profile.birthDate, Number(input.finalAge))) : '';
  const early = scenarioDate(comparison, profile, 'early'), normal = scenarioDate(comparison, profile, 'normal');
  const commonPriceDate = [early, normal].filter(isCalendarDate).sort()[0] ?? date;
  const priceDate = input.priceDate || (input.sharedLiving ? commonPriceDate : date);
  const paymentDate = (raw: string, label: string) => {
    const v = raw || date;
    if (!isCalendarDate(v) || v < date || v > '9899-12-31') errors.push(`${label}은 퇴직일 이후의 유효한 날짜로 입력해 주세요.`);
    if (isCalendarDate(v) && end && v > end) notes.push(`${label}이 분석 종료 후라 기간 내 유입은 반영하지 않습니다.`);
    return v;
  };
  const allowanceDate = s.includeAllowance ? paymentDate(s.allowanceDate, '퇴직수당 지급일') : date;
  const honoraryDate = key === 'early' && snapshot.honorary.amountWon !== null ? paymentDate(s.honoraryDate, '명퇴수당 지급일') : date;
  if (errors.length) return { ok: false as const, errors: [...new Set(errors)], amountWon: null, date };
  try {
    const accounts: CashflowAccount[] = [];
    if (s.includeKtcu) {
      const initial = snapshot.ktcu.amountWon!, start = paymentDate(s.ktcuStart, '공제회 수령·분할 개시일');
      if (s.ktcuMode === 'lump') accounts.push({ key: 'ktcu', initial, events: [{ date: start, payment: initial, balance: 0 }] });
      else if (s.ktcuMode === 'virtual') {
        const rateRaw = s.ktcuRate.trim() || ktcu.withdrawalRate, yearsRaw = s.ktcuYears.trim() || ktcu.withdrawalYears;
        const rate = irpRate(rateRaw, 0, 20);
        if (rate === null || !['5', '10', '15', '20', '25', '30'].includes(yearsRaw)) errors.push('공제회 가상 분할 인출의 수익률(0~20%)·기간(5/10/15/20/25/30년)을 03 또는 이 화면에 입력해 주세요.');
        else if (!errors.length) {
          let opening = initial;
          const waitMonths = completedSimulationMonths(date, start);
          if (waitMonths > 720) errors.push('공제회 분할 개시일은 퇴직 후 60년 이내여야 합니다.');
          else {
            for (let m = 0; m < waitMonths; m++) opening = growMonth(opening, rate, 0);
            const r = simulateVirtualWithdrawals(opening, rate, Number(yearsRaw), start, today);
            accounts.push({ key: 'ktcu', initial, events: accountEvents(initial, date, start, end, rate, 0,
              r.rows.map(row => ({ date: row.date, payment: row.paymentWon, balance: row.balanceWon }))) });
          }
        }
      } else errors.push('공제회 수령 방식을 확인해 주세요.');
      notes.push(s.ktcuMode === 'lump' ? '공제회 일시 수령 전 잔액은 수익률 0%로 보유하는 가정입니다. 일시금은 자산 내부 현금 이동입니다.' : '공제회는 공식 분할급여가 아닌 가상 분할 인출입니다. 첫 인출은 개시일 한 달 뒤입니다.');
    }
    for (const a of ['irp', 'saving'] as const) {
      if (!irp[a].enabled) continue;
      const override = s[a], original = irp[a];
      const account = { ...original, start: override.start || original.start, years: override.years || original.years,
        rate: (a === 'irp' ? sourceScenario.irpRate : sourceScenario.savingRate).trim() || original.rate,
        withdrawal: override.mode === 'shared' ? original.withdrawal : override.mode === 'period' ? '' : override.monthly };
      if (!['shared', 'period', 'fixed'].includes(override.mode) || (override.mode === 'fixed' && (!override.monthly.trim() || irpMoney(override.monthly) === 0))) errors.push(`${a} 정액 인출 금액을 0원보다 크게 입력해 주세요.`);
      const r = simulateWithdrawal(snapshot[a].amountWon!, date, account);
      if (!r.ok) errors.push(`${a}: ${r.error}`);
      else accounts.push({ key: a, initial: snapshot[a].amountWon!, events: accountEvents(snapshot[a].amountWon!, date, account.start, end, Number(account.rate), Number(account.fee),
        r.rows.map(row => ({ date: row.date, payment: row.payment, balance: row.remaining }))) });
      notes.push(`${a === 'irp' ? 'IRP' : '연금저축'}: ${account.start || '미입력'} 개시 · ${account.years || '미입력'}년 · 연 ${account.rate}% · 수수료 ${account.fee}% · 첫 인출은 한 달 뒤. 기간 종료 후 잔액은 같은 수익·수수료 가정으로 유지합니다.`);
    }
    if (errors.length) return { ok: false as const, errors: [...new Set(errors)], amountWon: null, date };
    const relevantSpecials = input.specials.filter(special => special.target === 'both' || special.target === key);
    const specials = relevantSpecials.filter(special => special.date >= date && special.date <= end);
    if (specials.length !== relevantSpecials.length) notes.push('퇴직 전 또는 분석 종료 후 특별 지출은 이 은퇴 이후 분석에 포함하지 않았습니다.');
    const plan: CashflowPlan = { birth: profile.birthDate, retirement: date, end,
      pension: { amount: snapshot.pension.amountWon!, start: snapshot.pension.start!, adjustment: input.pensionAdjustment.trim() ? Number(input.pensionAdjustment) : 0 },
      allowance: s.includeAllowance ? { amount: snapshot.allowance.amountWon!, date: allowanceDate } : null,
      honorary: key === 'early' && snapshot.honorary.amountWon !== null ? { amount: snapshot.honorary.amountWon, date: honoraryDate } : null, honoraryUnknown,
      accounts, living: irpMoney(input.sharedLiving ? input.living : s.living)!, priceDate, inflation: Number(input.inflation),
      change: input.livingChange ? { date: input.changeDate, amount: irpMoney(input.changedLiving)! } : null,
      specials: specials.map(special => ({ date: special.date, amount: irpMoney(special.amount)! })) };
    const rows = runCashflow(plan), final = rows.at(-1)!;
    // Flow aggregates must remain exact won too; balances are never summed across months.
    const years = aggregateCashflow(rows, 'year'), ages = aggregateCashflow(rows, 'age');
    for (const bucket of [...years, ...ages]) for (const field of ['pension', 'withdrawals', 'allowances', 'living', 'special', 'shortfall'] as const) safeWon(bucket[field]);
    return { ok: true as const, date, end, rows, years, ages, amountWon: final.closing,
      partial: honoraryUnknown || !s.includeAllowance || !s.includeKtcu, priceDate,
      firstShortfall: rows.find(row => row.shortfall > 0)?.date ?? null, cumulativeShortfall: final.cumulativeShortfall,
      totalPension: safeWon(rows.reduce((sum, row) => sum + row.pension, 0)),
      confidence: '조건부 추정값' as const, notes: [...notes, snapshot.excluded[0], snapshot.excluded[1],
        '기초자산은 공제회·IRP·연금저축 잔액만 포함하며 퇴직수당·명퇴수당은 지급월에 한 번 반영합니다.',
        '세액공제 재투자·환급 현금은 일반 계좌에서 별도 생성하지 않으며, 입력 잔액에 이미 포함됐다면 그대로 한 번만 사용합니다.',
        '근로소득·추가저축·퇴직 전 생활비·재취업·지급정지·감액·세금·법정 연금액 인상은 계산하지 않습니다.',
        '물가·연금 조정률은 사용자 고정 가정이며 공적연금과 사적계좌의 실제 과세방식·지급자격은 서로 다릅니다.'] };
  } catch (e) { return { ok: false as const, amountWon: null, date, errors: [e instanceof Error ? e.message : '계산 범위를 확인해 주세요.'] }; }
}
export type CashflowOutcome = ReturnType<typeof simulateRetirementCashflow>;
export function compareAtAge(early: CashflowOutcome, normal: CashflowOutcome, birth: string, age: number) {
  if (!isCalendarDate(birth) || !Number.isInteger(age) || age < 1 || age > 120) return null;
  const date = monthEnd(ageDate(birth, age));
  const get = (r: CashflowOutcome) => {
    if (!r.ok) return { value: null, unfunded: null, reason: '필수 입력·시나리오 확인 필요' };
    if (date < r.date) return { value: null, unfunded: null, reason: '퇴직 전 근로소득·저축·생활비 정보 없음' };
    if (date > r.end) return { value: null, unfunded: null, reason: '분석 종료 후' };
    const row = r.rows.find(row => monthKey(row.date) === monthKey(date));
    return { value: row?.closing ?? null, unfunded: row?.cumulativeShortfall ?? null,
      reason: r.partial ? '확인된 원천만의 부분 결과' : '은퇴 이후 가정에 따른 잔액' };
  };
  return { age, date, early: get(early), normal: get(normal), complete: false,
    reason: '동일 연령의 완전한 비교 불가 · 퇴직 전 근로소득·저축·생활비가 미입력입니다. 은퇴 이후 잔액만 조건부로 표시하며 유불리를 단정하지 않습니다.' };
}
