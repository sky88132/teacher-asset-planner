import type { TeacherProfile } from '../profile.ts';
import { isCalendarDate, validateProfileDates } from '../profile-validation.ts';
import type { BenefitInput, PensionInputs } from './pension-input.ts';
import { parseMoney, validateBenefit } from './pension-input-validation.ts';
import type { KtcuInput } from './ktcu-input.ts';
import { validateKtcuQuote } from './ktcu-validation.ts';
import { simulateKtcuAccumulation } from './ktcu-simulation.ts';
import type { IrpInput } from './irp-input.ts';
import { simulateIrp } from './irp-simulation.ts';
import type { RetirementComparisonInput, ScenarioKey } from './retirement-comparison-input.ts';
import { scenarioDate, validateScenarioDate, pensionGap } from './retirement-comparison-validation.ts';

export type ComparisonItem = { amountWon: number | null; confidence: '공식 조회값' | '검증된 추정값' | '조건부 추정값' | '계산 불가';
  tax: '' | 'gross' | 'net'; notes: string[]; date: string; queryDate?: string; start?: string; valueDate?: string };
const unavailable = (date: string, ...notes: string[]): ComparisonItem => ({ amountWon: null, confidence: '계산 불가', tax: '', notes, date });
export function quoteForScenario(quote: BenefitInput, date: string, kind: 'pension' | 'allowance', profile: TeacherProfile, today: string): ComparisonItem {
  const errors = Object.values(validateBenefit(quote, kind, profile, today));
  if (quote.source !== 'official') errors.push('공식 조회값만 연결합니다. 사용자 추정값은 제외합니다.');
  if (quote.retirementDate !== date) errors.push('조회 시 가정한 퇴직일이 시나리오와 다릅니다. 해당 퇴직일 기준으로 다시 조회해 주세요.');
  if (errors.length) return unavailable(date, ...errors);
  return { amountWon: parseMoney(quote.money).won, confidence: '공식 조회값', tax: quote.taxBasis,
    notes: ['사용자가 직접 입력한 공식 조회값 · 기관 진위 확인 아님', quote.assumptions].filter(Boolean), date, queryDate: quote.queryDate, start: kind === 'pension' ? quote.startDate : undefined };
}
function stopAtRetirement(mode: string, custom: string, shared: string, retirement: string) {
  const requested = mode === 'retirement' ? retirement : mode === 'shared' ? shared : custom;
  // A valid later stop remains visible as an assumption, but deposits after the snapshot do not enter it.
  return { requested, applied: isCalendarDate(requested) && requested > retirement ? retirement : requested };
}
export function calculateRetirementScenario(key: ScenarioKey, input: RetirementComparisonInput, profile: TeacherProfile,
  pensions: PensionInputs, ktcu: KtcuInput, irp: IrpInput, today: string) {
  const s = input.scenarios[key], date = scenarioDate(input, profile, key);
  const errors = [...validateScenarioDate(date, profile), ...Object.values(validateProfileDates(profile, today))];
  const normalDate = scenarioDate(input, profile, 'normal');
  if (key === 'early') {
    if (validateScenarioDate(normalDate, profile).length) errors.push('명퇴 비교를 위해 유효한 정년퇴직일도 필요합니다.');
    else if (isCalendarDate(date) && date >= normalDate) errors.push('명퇴일은 정년퇴직일보다 빨라야 합니다.');
  }
  const scheme = s.scheme === 'profile' ? profile.pension.scheme : s.scheme;
  const supported = scheme === 'civil' || scheme === 'private-school';
  const blocked = (...notes: string[]) => unavailable(date, ...errors, ...notes);
  const quote = (kind: 'pension' | 'allowance') => {
    if (errors.length || !supported) return blocked('공무원연금 또는 사학연금을 확인해 주세요.');
    const q = s[kind === 'pension' ? 'pensionSource' : 'allowanceSource'] === 'linked' ? pensions[scheme][kind] : s.quotes[scheme][kind];
    return quoteForScenario(q, date, kind, profile, today);
  };
  const pension = quote('pension'), allowance = quote('allowance');
  let honorary = blocked(key === 'early' ? '명퇴수당 선정·공식 조회액 확인이 필요합니다.' : '해당 없음 · 명퇴 시나리오에만 적용');
  if (key === 'early' && !errors.length && supported) {
    honorary = quoteForScenario(s.quotes[scheme].honorary, date, 'allowance', profile, today);
    if (s.eligibility !== 'confirmed' || s.selection !== 'selected') honorary = blocked('명퇴 자격 및 선정이 확인되지 않아 예상 자산에 포함하지 않습니다. 입력액은 보존합니다.');
  }
  let ktcuItem = blocked('03 교직원공제회의 현재 잔액·기준일·납입액·수익률을 입력해 주세요.');
  const ktcuStop = stopAtRetirement(s.ktcuStopMode, s.ktcuStop, ktcu.stopDate, date);
  if (!errors.length && s.ktcuSource === 'official') {
    const q = ktcu.quotes[ktcu.product], issues = Object.values(validateKtcuQuote(q, today));
    if (!q.enabled || q.targetDate !== date || q.payment !== 'lump-sum') issues.push('03 메뉴에서 해당 퇴직일의 일시금 공식 조회액을 활성화해 주세요. 월·연 지급액은 적립금으로 합산하지 않습니다.');
    ktcuItem = issues.length ? blocked(...issues) : { amountWon: parseMoney(q.money).won, confidence: '공식 조회값', tax: q.taxBasis, notes: [`사용자 직접 입력 · 상품 ${ktcu.product}`], date, queryDate: q.queryDate };
  } else if (!errors.length) {
    const changeAfter = ktcu.changeEnabled && isCalendarDate(ktcu.changeDate) && ktcu.changeDate > date;
    const derived: KtcuInput = { ...ktcu, retirementDate: date, stopDate: ktcuStop.applied,
      ...(s.ktcuRate.trim() ? { rateSource: 'assumed', assumedRate: s.ktcuRate } : {}), changeEnabled: ktcu.changeEnabled && !changeAfter };
    const r = simulateKtcuAccumulation(derived, today);
    ktcuItem = r.result ? { amountWon: r.result.finalWon, confidence: '조건부 추정값', tax: 'gross', date, valueDate: r.result.lastCalculatedDate,
      notes: [`기준일 ${ktcu.basisDate} · 최종 계산월 ${r.result.lastCalculatedDate}`, `납입 종료 가정 ${ktcuStop.requested} · 적용 ${ktcuStop.applied}`, `연 ${r.result.effectiveAnnualRate}% · ${r.result.rateSource}`, '공식 상품 급여금 아님 · 부분 월 제외', ...(changeAfter ? ['변경 이율은 퇴직 이후이므로 이 시점에 미반영'] : [])] } : blocked(...Object.values(r.errors));
  }
  const irpStop = stopAtRetirement(s.irpStopMode, s.irpStop, irp.irp.stop, date);
  const savingStop = stopAtRetirement(s.savingStopMode, s.savingStop, irp.saving.stop, date);
  const derived: IrpInput = { ...irp, retirement: date,
    irp: { ...irp.irp, stop: irpStop.applied, ...(s.irpRate.trim() ? { rate: s.irpRate } : {}) },
    saving: { ...irp.saving, stop: savingStop.applied, ...(s.savingRate.trim() ? { rate: s.savingRate } : {}) } };
  const irpResult = errors.length ? null : simulateIrp(derived);
  const accountItem = (account: 'irp' | 'saving'): ComparisonItem => {
    const stop = account === 'irp' ? irpStop : savingStop;
    if (!irp[account].enabled) return unavailable(date, '04 메뉴에서 계산 제외로 선택한 계좌입니다.');
    if (!irpResult?.ok) return blocked(...(irpResult && !irpResult.ok ? irpResult.errors : ['04 계좌 입력을 확인해 주세요.']));
    return { amountWon: irpResult.rows.at(-1)![account], confidence: '조건부 추정값', tax: 'gross', date, valueDate: irpResult.rows.at(-1)!.date,
      notes: [`기준일 ${irp.basis} · 최종 계산월 ${irpResult.rows.at(-1)!.date}`, `납입 종료 가정 ${stop.requested} · 적용 ${stop.applied}`, `연 ${derived[account].rate}% · 수수료 연 ${derived[account].fee}%`, '공식 예상액 아님 · 퇴직 이후 납입 미반영'] };
  };
  const irpItem = accountItem('irp'), saving = accountItem('saving');
  const items = { allowance, honorary, ktcu: ktcuItem, irp: irpItem, saving };
  const expected = [allowance, ktcuItem, ...(key === 'early' ? [honorary] : []), ...(irp.irp.enabled ? [irpItem] : []), ...(irp.saving.enabled ? [saving] : [])];
  const aggregationIssues: string[] = [];
  if (expected.some(item => item.amountWon !== null && item.valueDate && item.valueDate !== date)) aggregationIssues.push('부분 월을 제외한 적립금의 최종 계산일이 퇴직일과 다릅니다. 해당 금액은 항목별로만 표시하고 같은 날짜 합산은 보류합니다.');
  if (ktcuItem.amountWon !== null && s.ktcuSource === 'simulation' && (irpItem.amountWon !== null || saving.amountWon !== null) && ktcu.basisDate !== irp.basis) aggregationIssues.push('공제회와 IRP·연금저축의 현재 잔액 기준일이 다릅니다. 동일 기준일의 잔액을 조회한 후 합산해 주세요.');
  let subtotal: number | null = null;
  const known = expected.filter(item => item.amountWon !== null && item.tax === 'gross');
  if (!errors.length && !aggregationIssues.length && known.length) { const sum = known.reduce((sum, item) => sum + BigInt(item.amountWon!), 0n); if (sum <= BigInt(Number.MAX_SAFE_INTEGER)) subtotal = Number(sum); else aggregationIssues.push('합계가 안전한 원 단위 금액 범위를 초과합니다.'); }
  const complete = subtotal !== null && expected.every(item => item.amountWon !== null && item.tax === 'gross');
  return { key, date, scheme, errors, aggregationIssues, pension, ...items, subtotal, total: complete ? subtotal : null, complete,
    gap: pension.start ? pensionGap(date, pension.start) : null,
    reinvest: irp.reinvest ? '04의 재투자 설정으로 계좌 계산을 검증했습니다. 일반 계좌 재투자·환급 현금은 이 화면의 연금자산 합산에서 제외합니다.' : '세액공제 환급액 재투자 안 함',
    excluded: ['공적연금 월액은 자산잔액에 합산하지 않음', '퇴직급여 IRP 이전 금액·외부 자산·재취업 소득은 미반영', '생활비·물가·세금·연금 인출·퇴직 이후 운용은 미반영', '세후 조회액은 세전 소계에 혼합하지 않음'] };
}
export type RetirementScenarioResult = ReturnType<typeof calculateRetirementScenario>;
