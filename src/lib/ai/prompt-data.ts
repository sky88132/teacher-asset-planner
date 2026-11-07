import type { TeacherProfile } from '../profile.ts';
import { isCalendarDate, validateProfileDates } from '../profile-validation.ts';
import type { PensionInputs } from '../finance/pension-input.ts';
import { parseMoney, validateBenefit } from '../finance/pension-input-validation.ts';
import type { KtcuInput } from '../finance/ktcu-input.ts';
import { simulateKtcuAccumulation, simulateVirtualWithdrawals } from '../finance/ktcu-simulation.ts';
import { completedSimulationMonths, validateKtcuQuote, validateKtcuWithdrawal } from '../finance/ktcu-validation.ts';
import { ktcuProducts } from '../finance/ktcu-products.ts';
import type { IrpInput } from '../finance/irp-input.ts';
import { simulateIrp, simulateWithdrawal } from '../finance/irp-simulation.ts';
import { irpMoney, irpRate } from '../finance/irp-validation.ts';
import { pensionTaxCredit, taxRule } from '../finance/irp-tax.ts';
import type { RetirementComparisonInput, ScenarioKey } from '../finance/retirement-comparison-input.ts';
import { calculateRetirementScenario, type ComparisonItem } from '../finance/retirement-comparison.ts';
import { automaticRetirement, retirementRule } from '../finance/retirement-comparison-validation.ts';
import type { CashflowInput } from '../finance/cashflow-input.ts';
import { simulateRetirementCashflow, compareAtAge } from '../finance/cashflow.ts';
import { ageAt } from '../finance/cashflow-validation.ts';
import type { PromptSettings } from './prompt-input.ts';
import { displayPromptMoney } from './prompt-privacy.ts';

export type PromptDataSources = { profile: TeacherProfile; pensions: PensionInputs; ktcu: KtcuInput; irp: IrpInput;
  comparison: RetirementComparisonInput; cashflow: CashflowInput };
export type PromptSection = { title: string; lines: string[] };
/** Build an explicit allowlist. Never serialize raw state or copy free-form benefit assumptions/notes. */
export function collectPromptSections(data: PromptDataSources, settings: PromptSettings, today: string): PromptSection[] {
  const { profile, pensions, ktcu, irp, comparison, cashflow } = data;
  const money = (n: number | null) => displayPromptMoney(n, settings.money);
  const rawMoney = (raw: string) => money(irpMoney(raw));
  const rate = (raw: string, min = -90, max = 100) => { const r = irpRate(raw, min, max); return r === null ? '미입력 또는 추가 확인 필요' : `${r}% (사용자 가정)`; };
  const integer = (raw: string, min = 0, max = 120) => /^\d{1,3}$/.test(raw) && Number(raw) >= min && Number(raw) <= max ? String(Number(raw)) : '추가 확인 필요';
  const validProfile = Object.keys(validateProfileDates(profile, today)).length === 0;
  const band = (age: number) => `${Math.floor(age / 5) * 5}~${Math.floor(age / 5) * 5 + 4}세`;
  const date = (value: string) => {
    if (!isCalendarDate(value)) return '미입력 또는 추가 확인 필요';
    if (!settings.anonymize && settings.allowExactDates) return value;
    if (validProfile) return `${settings.anonymize ? band(ageAt(profile.birthDate, value)) : `만 ${ageAt(profile.birthDate, value)}세`} 시점 (정확한 날짜 제외)`;
    return '입력된 시점 (정확한 날짜 제외·연령 산정 불가)';
  };
  const tax = (basis: string) => basis === 'gross' ? '세전' : basis === 'net' ? '입력액 세후·자동 변환 아님' : '세전/세후 추가 확인 필요';
  const scheme = (value: string) => value === 'civil' ? '공무원연금' : value === 'private-school' ? '사학연금' : '가입제도 추가 확인 필요';
  const item = (label: string, value: ComparisonItem) => `${label}: ${money(value.amountWon)} / ${value.confidence} / ${tax(value.tax)}${value.queryDate ? ` / 조회 ${date(value.queryDate)}` : ''} / 퇴직 가정 ${date(value.date)}${value.start ? ` / 개시 ${date(value.start)}` : ''}${value.valueDate ? ` / 최종 계산월 ${value.valueDate === value.date ? '퇴직일과 일치' : '퇴직일과 상이·부분 월 제외'}` : ''}`;
  const keys: ScenarioKey[] = comparison.customEnabled ? ['early', 'normal', 'custom'] : ['early', 'normal'];
  const labels: Record<ScenarioKey, string> = { early: '명예퇴직', normal: '정년퇴직', custom: '사용자 지정' };
  const scenarios = keys.map(key => calculateRetirementScenario(key, comparison, profile, pensions, ktcu, irp, today));
  const ktcuResult = simulateKtcuAccumulation(ktcu, today), irpResult = simulateIrp(irp);
  const flows = { early: simulateRetirementCashflow('early', cashflow, comparison, profile, pensions, ktcu, irp, today),
    normal: simulateRetirementCashflow('normal', cashflow, comparison, profile, pensions, ktcu, irp, today) };
  const currentAge = validProfile ? ageAt(profile.birthDate, today) : null;
  const profileLines = [
    `연금제도: ${scheme(profile.pension.scheme)} / ${profile.pension.source === 'school-default' ? '학교 구분 기본 선택·기관 확인 아님' : '사용자 직접 선택'}`,
    `학교 구분: ${profile.schoolType === 'public' ? '국공립' : '사립'} / 직위·학교급 적용 확인: ${comparison.ruleConfirmed ? '사용자 확인 기록·자동 자격 확정 아님' : '추가 확인 필요'}`,
    `현재 연령: ${currentAge === null ? '계산 불가' : settings.anonymize ? `${Math.floor(currentAge / 10) * 10}대` : `만 ${currentAge}세`}`,
    `임용 후 달력상 경과기간: ${validProfile ? `약 ${Math.floor(completedSimulationMonths(profile.appointmentDate, today) / 12)}년 (공단 인정기간 아님)` : '계산 불가'}`,
    `특수 경력: ${profile.hasSpecialCareer ? '있음·인정기간과 감액 반영 추가 확인 필요' : '기본정보상 선택 없음·기관 확인 아님'}`,
  ];
  if (!settings.anonymize && settings.allowExactDates) profileLines.push(`생년월일: ${isCalendarDate(profile.birthDate) ? profile.birthDate : '미입력'}`, `최초 임용일: ${isCalendarDate(profile.appointmentDate) ? profile.appointmentDate : '미입력'}`);
  const scenarioLines = scenarios.flatMap(r => [`${labels[r.key]}: 퇴직 ${date(r.date)} / ${scheme(r.scheme)} / ${r.errors.length ? '계산 불가·기본정보/퇴직일 확인 필요' : '시나리오 날짜 검증 통과·자격 확정 아님'}`,
    `퇴직 금융자산: ${money(r.total)} / ${r.complete ? '조건부 추정값·세전 합계' : '전체 합산 불가'}${r.subtotal === null ? '' : ` / 확인된 세전 항목 소계 ${money(r.subtotal)}`}`,
    ...(r.gap ? [`공적연금 미지급 기간: 약 ${Math.floor(r.gap.months / 12)}년 ${r.gap.months % 12}개월 (다른 소득 0원 가정 아님)`] : ['공적연금 미지급 기간: 계산 불가·개시일/조회조건 필요']),
    ...(r.key === 'early' ? [`명퇴 자격: ${comparison.scenarios.early.eligibility === 'confirmed' ? '사용자 기관 확인 기록' : '미확정 또는 미충족'} / 선정: ${comparison.scenarios.early.selection === 'selected' ? '사용자 선정 확인 기록' : comparison.scenarios.early.selection === 'rejected' ? '사용자 미선정 기록' : '미확정'}`] : []),
  ]);
  const benefitLines: string[] = [];
  if (profile.pension.scheme === 'civil' || profile.pension.scheme === 'private-school') for (const kind of ['pension', 'allowance'] as const) {
    const q = pensions[profile.pension.scheme][kind], errors = validateBenefit(q, kind, profile, today);
    benefitLines.push(`02 ${kind === 'pension' ? '월연금' : '퇴직수당'}: ${Object.keys(errors).length ? '계산 불가·필수 금액/조회조건 미완료' : `${money(parseMoney(q.money).won)} / ${q.source === 'official' ? '공식 조회값·사용자 직접 입력' : '사용자 추정값·미검증'} / ${tax(q.taxBasis)} / 가정 퇴직 ${date(q.retirementDate)} / 조회 ${date(q.queryDate)}${kind === 'pension' ? ` / 개시 ${date(q.startDate)}` : ''}`}`);
  }
  else benefitLines.push('02 가입제도 확인 전·급여 계산 불가');
  benefitLines.push(...scenarios.flatMap(r => [`[${labels[r.key]}] ${item('공적연금 월액 (월 지급·자산 합산 제외)', r.pension)}`, item('퇴직수당 (일시금)', r.allowance), item('명예퇴직수당 (정년/사용자 지정에는 해당 없음)', r.honorary)]));
  const ktcuLines = [ `03 선택 상품: ${ktcuProducts[ktcu.product]?.name ?? '추가 확인 필요'}`,
    `현재 잔액: ${money(parseMoney(ktcu.balance).won)} (사용자 입력·계산 결과 아님) / 잔액 기준 ${date(ktcu.basisDate)}`,
    `향후 월 납입: ${money(parseMoney(ktcu.futureMonthly).won)} / 종료 ${date(ktcu.stopDate)} / 월 ${ktcu.depositTiming === 'begin' ? '초' : '말'} 납입 가정`,
    `03 퇴직 적립 전망: ${ktcuResult.result ? `${money(ktcuResult.result.finalWon)} / 조건부 추정값·세전·자체 시뮬레이션 / 적용 연 ${ktcuResult.result.effectiveAnnualRate}% / ${ktcu.rateSource === 'official-reference' ? '공식 참고 이율을 미래까지 고정하는 가정' : '사용자 수익률 가정'}` : '계산 불가·입력 및 적용 상품 확인 필요'}`,
  ];
  ktcuLines.push(`03 이율 변경: ${ktcu.changeEnabled ? `${date(ktcu.changeDate)}부터 연 ${rate(ktcu.changedRate, 0, 20)}` : '미선택'}`);
  const quote = ktcu.quotes[ktcu.product];
  ktcuLines.push(`03 상품 공식 조회액: ${quote?.enabled && !Object.keys(validateKtcuQuote(quote, today)).length ? `${money(parseMoney(quote.money).won)} / 공식 조회값·사용자 직접 입력 / ${tax(quote.taxBasis)} / ${quote.payment === 'lump-sum' ? '일시금' : quote.payment === 'monthly' ? '월 지급' : '연 지급'} / 대상 ${date(quote.targetDate)} / 조회 ${date(quote.queryDate)}` : '미입력 또는 조회조건 확인 필요'}`);
  if (!Object.keys(validateKtcuWithdrawal(ktcu)).length) {
    const principal = ktcu.withdrawalSource === 'projection' ? ktcuResult.result?.finalWon ?? null : parseMoney(ktcu.withdrawalPrincipal).won;
    if (principal !== null) try { const w = simulateVirtualWithdrawals(principal, Number(ktcu.withdrawalRate), Number(ktcu.withdrawalYears), ktcu.retirementDate, today);
      ktcuLines.push(`03 가상 분할 인출: 월 ${money(w.monthlyWon)} / ${w.years}년 / 총 ${money(w.totalWon)} / 조건부 추정값·세전·공식 상품 지급액 아님`);
    } catch { ktcuLines.push('03 가상 분할 인출: 계산 불가'); }
    else ktcuLines.push('03 가상 분할 인출: 계산 불가·시작 잔액 필요');
  } else ktcuLines.push('03 가상 분할 인출: 계산 불가·기간/수익률/시작금액 확인 필요');
  ktcuLines.push(...scenarios.map(r => `[${labels[r.key]}] ${item('공제회 퇴직 적립금', r.ktcu)}`));
  for (const key of ['early', 'normal'] as const) ktcuLines.push(`[${labels[key]}] 06 수령 방식: ${cashflow.scenarios[key].includeKtcu ? cashflow.scenarios[key].ktcuMode === 'lump' ? '일시 수령·자산 내부 이동' : '가상 분할 인출·공식 상품 급여 아님' : '사용자 분석 제외'} / 개시 ${date(cashflow.scenarios[key].ktcuStart || scenarios.find(s => s.key === key)!.date)}`);
  const irpLines: string[] = [];
  for (const key of ['irp', 'saving'] as const) {
    const a = irp[key], name = key === 'irp' ? 'IRP' : '연금저축';
    if (!a.enabled) { irpLines.push(`${name}: 사용자가 계산에서 제외한 계좌`); continue; }
    irpLines.push(`${name} 현재 평가금액: ${rawMoney(a.balance)} (사용자 입력) / 연간 납입 ${rawMoney(a.annual)} / ${a.cycle === 'monthly' ? '월 분할 납입' : '연 후납'} / 종료 ${date(a.stop)} / 연 수익률 ${rate(a.rate)} / 연 수수료 ${rate(a.fee, 0, 20)}`,
      `${name} 04 퇴직 평가금액: ${irpResult.ok ? money(irpResult.rows.at(-1)![key]) : '계산 불가'} / 조건부 추정 경로·세전·공식 조회액 아님 / 퇴직 가정 ${date(irp.retirement)}`);
    if (irpResult.ok) { const w = simulateWithdrawal(irpResult.rows.at(-1)![key], irp.retirement, a);
      irpLines.push(`${name} 04 가상 인출: ${w.ok ? `월 ${money(w.amountWon)} / 총 ${money(w.total)} / 잔여 ${money(w.remaining)} / 소진 ${w.depleted ? date(w.depleted) : '선택 기간 내 미소진'}` : '계산 불가·수령 조건 확인 필요'} / 조건부 추정 경로·세전`);
    }
    irpLines.push(`${name} 수령 개시 ${date(a.start)} / 기간 ${integer(a.years, 1, 40)}년 / ${a.withdrawal.trim() ? `희망 정액 ${rawMoney(a.withdrawal)}` : '기간 내 균등·마지막 잔액 정산'} / 세액공제 ${a.credit ? '적용 선택' : '미적용 선택'}`);
  }
  irpLines.push(...scenarios.flatMap(r => [`[${labels[r.key]}] ${item('IRP', r.irp)}`, item('연금저축', r.saving)]));
  irpLines.push(`환급 재투자: ${irp.reinvest ? '선택됨·일반 계좌 보조 시뮬레이션' : '미선택'} / 비율 ${rate(irp.ratio, 0, 100)} / 재투자 가정 수익률 ${rate(irp.reinvestRate)} / 시점 납입 다음 해 ${integer(irp.refundMonth, 1, 12)}월`,
    `04 재투자 비교: ${irpResult.ok ? `동일 환급 현금 보유 ${money(irpResult.comparison.without)} / 재투자 ${money(irpResult.comparison.with)} / 차이 ${money(irpResult.comparison.difference)} (조건부 추정값·세전)` : '계산 불가'}`);
  const income = irpMoney(irp.income), capacity = irpMoney(irp.capacity);
  if (irpResult.ok && irp.scopeConfirmed && income !== null) {
    const t = pensionTaxCredit(irp.irp.enabled && irp.irp.credit ? irpMoney(irp.irp.annual)! : 0, irp.saving.enabled && irp.saving.credit ? irpMoney(irp.saving.annual)! : 0, irp.incomeKind, income, capacity);
    irpLines.push(`연간 계획 이론상 국세 공제 ${money(t.theoretical)} / 적용 국세율 ${t.rate}% / 남은 국세 반영 조건부 공제 가능액 ${money(t.usable)} / 실제 현금 환급액: 추가 확인 필요·자동 확정 불가`);
  } else irpLines.push('연간 계획 공제액: 계산 불가·소득/범위/납입 입력 확인 필요 / 실제 현금 환급액은 자동 확정하지 않음');
  const flowLines: string[] = [];
  for (const key of ['early', 'normal'] as const) {
    const r = flows[key];
    if (!r.ok) { flowLines.push(`[${labels[key]}] 06 현금흐름: 계산 불가·필수 원천/기간/세전·세후 조건/생활비를 확인해야 함`); continue; }
    flowLines.push(`[${labels[key]}] ${r.confidence} / ${r.partial ? '확인된 원천만의 부분 결과·누락 원천은 0원 아님' : '입력 범위 내 결과'} / ${tax(cashflow.taxBasis)}·미래 세금 미반영`,
      `분석 종료 ${date(r.end)} / 최종 금융자산 ${money(r.amountWon)} / 첫 현금 부족 ${r.firstShortfall ? date(r.firstShortfall) : '분석 기간 내 없음'} / 누적 미충당 지출 ${money(r.cumulativeShortfall)}`);
    const exhausted = r.rows.find(row => row.opening > 0 && row.closing === 0);
    flowLines.push(`전체 금융자산의 양의 잔액 소진: ${exhausted ? date(exhausted.date) : '분석 기간 내 소진 관측 없음·처음부터 잔액이 없었다면 새 고갈 시점으로 판정하지 않음'}`);
    if (settings.detail === 'detailed') {
      const depletion = (field: 'irpRemaining' | 'savingRemaining' | 'ktcuRemaining', enabled: boolean) => {
        if (!enabled) return '사용자 제외';
        const first = r.rows.find(row => row[field] > 0), depleted = first ? r.rows.find(row => row.date >= first.date && row[field] === 0) : undefined;
        return depleted ? `${date(depleted.date)} (인출에 따른 계좌 소진·전체 자산 고갈과 다름)` : first ? '분석 기간 내 소진 미발생' : '양의 잔액이 없어 고갈 시점 판정하지 않음';
      };
      flowLines.push(`IRP 잔액 소진 ${depletion('irpRemaining', irp.irp.enabled)} / 연금저축 ${depletion('savingRemaining', irp.saving.enabled)} / 공제회 ${cashflow.scenarios[key].ktcuMode === 'lump' ? '일시금 현금 전환은 자산 고갈이 아님' : depletion('ktcuRemaining', cashflow.scenarios[key].includeKtcu)}`);
    }
  }
  const ages = [...new Set([60, 65, 70, 75, 80, Number(cashflow.compareAge), Number(cashflow.finalAge)])];
  for (const age of ages) {
    const c = compareAtAge(flows.early, flows.normal, profile.birthDate, age); if (!c) continue;
    flowLines.push(`만 ${age}세 도달월말: 명퇴 ${c.early.value === null ? '비교 불가·미입력/퇴직 전/분석 종료 후' : `${money(c.early.value)} / 미충당 지출 ${money(c.early.unfunded)}`} / 정년 ${c.normal.value === null ? '비교 불가·미입력/퇴직 전/분석 종료 후' : `${money(c.normal.value)} / 미충당 지출 ${money(c.normal.unfunded)}`} / 조건부 잔액·완전한 비교 불가`);
    if (settings.detail === 'detailed') for (const key of ['early', 'normal'] as const) { const r = flows[key]; if (!r.ok) continue;
      const bucket = r.ages.find(a => a.period === String(age));
      if (bucket) flowLines.push(`${labels[key]} 만 ${age}세 구간(${bucket.months}개월): 공적연금 유입 합계 ${money(bucket.pension)} / 내부 인출 ${money(bucket.withdrawals)} / 생활비 ${money(bucket.living)} / 특별 지출 ${money(bucket.special)} / 현금 부족 ${money(bucket.shortfall)} / 구간 마지막 잔액 ${money(bucket.closing)} (생일 도달월 잔액과 다른 구간)`);
    }
  }
  const assumptions = [`공통 월 생활비 ${cashflow.sharedLiving ? rawMoney(cashflow.living) : '시나리오별 설정'} / 물가 연 ${rate(cashflow.inflation, -20, 30)} / 연금 조정 ${cashflow.pensionAdjustment.trim() ? rate(cashflow.pensionAdjustment, -20, 30) : '사용자 미선택·조정 없음'}`,
    `최종 분석 연령 ${integer(cashflow.finalAge, 1, 120)}세 도달월 말 / 생활비 가격 기준 ${cashflow.priceDate ? date(cashflow.priceDate) : '기존 현금흐름의 공통/시나리오별 기본 기준'}`,
    `생활비 변경 ${cashflow.livingChange ? `${date(cashflow.changeDate)}부터 ${rawMoney(cashflow.changedLiving)}` : '미선택'} / 특별 지출 ${cashflow.specials.length}건`,
    '공제회·IRP: 완료 월 단위·원 단위 반올림. 미래 수익률은 사용자 가정이며 확정 수익이 아님. 인출은 자산 내부 이동.',
  ];
  assumptions.push(`부분 월 차이 연결: ${cashflow.acceptPartialMonths ? '사용자가 완료 계산월 이후 퇴직일까지 추가 납입·수익 없음에 동의' : '미동의·날짜 차이가 있으면 현금흐름 계산 보류'}`);
  for (const r of scenarios) {
    const s = comparison.scenarios[r.key];
    const stop = (mode: string, custom: string, shared: string) => mode === 'retirement' ? '해당 퇴직일 중단' : `${mode === 'custom' ? '별도' : '원본 메뉴'} 종료 ${date(mode === 'custom' ? custom : shared)} (퇴직 이후 납입은 퇴직 스냅샷에 미반영)`;
    assumptions.push(`${labels[r.key]} 공제회: ${s.ktcuRate.trim() ? rate(s.ktcuRate, 0, 20) : '03 이율·변경 가정 연결'} / ${stop(s.ktcuStopMode, s.ktcuStop, ktcu.stopDate)}`,
      `${labels[r.key]} IRP: ${rate(s.irpRate.trim() || irp.irp.rate)} / ${stop(s.irpStopMode, s.irpStop, irp.irp.stop)}`,
      `${labels[r.key]} 연금저축: ${rate(s.savingRate.trim() || irp.saving.rate)} / ${stop(s.savingStopMode, s.savingStop, irp.saving.stop)}`,
      `${labels[r.key]} 집계 상태: ${r.aggregationIssues.length ? '기준일/부분 월/금액 범위 등의 제약으로 05 합산 보류' : '05 기준일 집계 제약 미발생·급여 자격 검증 아님'}`);
  }
  for (const key of ['early', 'normal'] as const) {
    const s = cashflow.scenarios[key];
    assumptions.push(`${labels[key]} 06 원천: 퇴직수당 ${s.includeAllowance ? '포함' : '사용자 제외'} / 공제회 ${s.includeKtcu ? '포함' : '사용자 제외'} / 분할 기간 ${integer(s.ktcuYears || ktcu.withdrawalYears, 1, 30)}년 / 인출 가정 ${rate(s.ktcuRate.trim() || ktcu.withdrawalRate, 0, 20)}`);
    for (const a of ['irp', 'saving'] as const) assumptions.push(`${labels[key]} 06 ${a === 'irp' ? 'IRP' : '연금저축'}: 개시 ${date(s[a].start || irp[a].start)} / ${integer(s[a].years || irp[a].years, 1, 40)}년 / ${s[a].mode === 'period' ? '기간 내 균등·마지막 잔액 정산' : s[a].mode === 'fixed' ? `정액 ${rawMoney(s[a].monthly)}` : `04 인출 설정 연결 ${irp[a].withdrawal.trim() ? rawMoney(irp[a].withdrawal) : '균등·마지막 잔액 정산'}`} / 세금·수령자격 미검증`);
  }
  if (settings.detail === 'detailed') {
    for (const s of cashflow.specials) assumptions.push(`특별 지출: ${date(s.date)} / ${rawMoney(s.amount)} / ${s.target === 'both' ? '두 시나리오' : s.target === 'early' ? '명퇴' : '정년'}`);
    for (const key of ['early', 'normal'] as const) assumptions.push(`${labels[key]} 개별 월 생활비 ${rawMoney(cashflow.scenarios[key].living)} (공통 적용 시 미사용) / 퇴직수당 지급 ${date(cashflow.scenarios[key].allowanceDate || scenarios.find(r => r.key === key)!.date)} / 명퇴수당 지급 ${key === 'early' ? date(cashflow.scenarios[key].honoraryDate || scenarios.find(r => r.key === key)!.date) : '해당 없음'}`);
  }
  for (const [name, raw] of [['보수적', irp.conservative], ['기준', irp.standard], ['낙관적', irp.optimistic]]) {
    const r = irpRate(raw); const simulation = r === null ? null : simulateIrp(irp, r);
    assumptions.push(`04 ${name} 수익률 시나리오: ${r === null ? '미입력·임의 수익률 생성 금지' : `${r}% / 퇴직 계좌 합산 ${simulation?.ok ? money(simulation.amountWon) : '계산 불가'} / 조건부 추정 경로·세전`}`);
  }
  return [
    { title: '사용자 기본 조건', lines: profileLines }, { title: '명퇴·정년 시나리오', lines: scenarioLines },
    { title: '공적연금과 퇴직수당 정보', lines: benefitLines }, { title: '교직원공제회 정보', lines: ktcuLines },
    { title: 'IRP·연금저축 정보', lines: irpLines }, { title: '은퇴 현금흐름 결과', lines: flowLines },
    { title: '적용한 수익률 및 물가 가정', lines: assumptions },
    { title: '계산 신뢰도와 공식 조회 여부', lines: [
      '공식 조회값은 사용자가 직접 입력한 값이며 기관 진위 검증이 아니다. 조건부 추정값을 공식 지급액이나 검증된 추정값으로 승격하지 말 것.',
      '검증된 추정값 표지는 지원 범위 내 정년 날짜 규칙에만 사용할 수 있다. 월연금·수당의 미검증 자체 산식은 계속 비활성화되어 있다.',
      `정년 자동 적용 경로: ${automaticRetirement(profile, comparison).date ? '조건 내 날짜 산정 가능·기관 확인 필요' : '자동 범위 밖 또는 필수 정보 부족'}. ${retirementRule.title} / 시행 버전 ${retirementRule.effectiveOn.slice(0, 7)} / ${retirementRule.source}`,
      `세액공제 국세 일반 규정 검토 ${taxRule.checkedOn.slice(0, 7)} / ${taxRule.source} / 지방소득세·실제 환급 정산 미반영`,
      `공제회 상품 참고 ${ktcuProducts[ktcu.product]?.url ?? '상품 확인 필요'} / 공식 상품 급여액 자동 계산 검증 완료 아님`,
    ] },
    { title: '누락된 정보와 계산 제한 사항', lines: [
      '미입력·계산 불가·미확정은 0원이나 수급 불가 판정이 아니다. 금액의 월 지급/일시금/잔액 및 세전/세후 기준을 혼합하지 말 것.',
      '이름·학교명·계좌번호 등 직접 식별정보와 기존 자유 메모는 자동 데이터에서 제외했다. 날짜·금액 표시가 축약되면 원래 값을 역추정하지 말 것.',
      '퇴직 전 근로소득·저축·생활비가 없어 동일 연령의 완전한 비교 불가. 퇴직 전 잔액·소득을 0원으로 채우지 말 것.',
      '공적연금 월액을 적립금 잔액에 더하지 말 것. 계좌 인출·퇴직급여 이전금·세액공제 환급 재투자를 중복 합산하지 말 것.',
      '미선정 명퇴수당을 확정 유입으로 만들지 말 것. 미래 세법·지급정지·감액·계좌 수령자격·일할 계산은 별도 공식 확인이 필요하다.',
      '현금 부족은 계좌 자산 고갈과 다르다. 미충당 지출은 부채가 아니고 자동 추가 인출/상환도 가정하지 말 것.',
      '개인연금·부동산·일반 투자자산·ISA·부채는 서비스 범위 밖이다. 누락 정보로 새 자산을 만들어 넣지 말 것.',
    ] },
  ];
}
