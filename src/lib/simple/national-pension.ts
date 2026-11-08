import type { SimpleProfile } from './model.ts';
import { emptyPension, type PensionEstimateInput, type PensionEstimate } from './pension-types.ts';
import { isCalendarDate } from '../profile-validation.ts';
import { birthAnniversary, monthIndex, monthString, nationalPensionAge, setPensionTiming, validMonth } from './pension-dates.ts';
import { checkPensionContext, pensionIncome, positiveMoney } from './pension-income.ts';
/** NPS A-value used for 2026-price scenarios, not a forecast of the future A-value. */
export const nationalA2026 = 3193511;
export function nationalCoefficient(year: number): number {
  if (year < 1988) return 0;
  return year <= 1998 ? 2400 : year <= 2007 ? 1800 : year <= 2025 ? 1500 - (year - 2008) * 15 : 1290;
}
function creditMonths(raw: string, name: string, r: PensionEstimate): number {
  if (!raw) return 0; // Explicit model exclusion, documented in notes; not an entitlement decision.
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > 1200) { r.errors.push(`${name}은 공단에서 확인한 정수 개월(0~1200개월 지원)로 입력해 주세요.`); return 0; }
  return Number(raw);
}
export function nationalEndMonth(p: SimpleProfile, v: PensionEstimateInput, date: string | null): string | null {
  if (!v.nationalAutomaticEnd) return validMonth(v.nationalEndMonth) ? v.nationalEndMonth : null;
  const sixty = birthAnniversary(p.birthDate, 60);
  if (!date || !isCalendarDate(date) || !sixty) return null;
  // This is a stated contribution PLAN, not a determination of the actual loss-of-coverage day.
  return monthString(Math.min(monthIndex(date), monthIndex(sixty) - 1));
}
export function estimateNationalPension(p: SimpleProfile, v: PensionEstimateInput, date: string | null): PensionEstimate {
  const r = emptyPension();
  r.sources = [
    { title: '국민연금공단 가입시기별 산식·A/B값', url: 'https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0048M0.do?menuId=MN24000982' },
    { title: '국민연금공단 노령연금·개시연령·상한', url: 'https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0056M0.do' },
    { title: '국민연금법 제51조', url: 'https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1013489159' },
    { title: '국민연금법 시행령 제36조 재평가', url: 'https://www.law.go.kr/LSW/lumLsLinkPop.do?chrClsCd=010202&lspttninfSeq=69780' },
  ];
  checkPensionContext(p, v, date, r);
  r.notes.push('최초 교사 임용일을 국민연금 가입 시작일로 사용하지 않습니다. 실제 최초 납부월부터 종료월까지 빠짐없이 납부한다는 시나리오입니다. 납부예외·체납·반환·추납·실업크레딧이 있으면 이 연속기간 모델을 사용할 수 없습니다.',
    '2026 A값 3,193,511원 및 2026년 가격 고정 B값을 사용합니다. 미래 A값·재평가율·물가 인상을 예측하지 않습니다. 부양가족연금·소득활동 감액·세금·분할연금은 미반영입니다.',
    '군복무/출산 크레딧은 공단 확인 개월을 입력한 경우만 반영합니다. 01의 공무원 군 산입 상태로 국민연금 크레딧을 만들지 않습니다.');
  const average = pensionIncome(v, r);
  const timingErrorsBeforePeriods = r.errors.length;
  const end = nationalEndMonth(p, v, date);
  if (!validMonth(v.nationalStartMonth) || v.nationalStartMonth < '1988-01') r.errors.push('국민연금 실제 최초 납부월(1988년 이후)이 필요합니다. 교사 임용일과 별도로 입력해 주세요.');
  if (!end) r.errors.push('국민연금 예상 마지막 납부월을 확인해 주세요.');
  const birthMonth = isCalendarDate(p.birthDate) ? p.birthDate.slice(0, 7) : null;
  const sixtyFive = birthAnniversary(p.birthDate, 65);
  if (birthMonth && validMonth(v.nationalStartMonth) && v.nationalStartMonth <= birthMonth) r.errors.push('최초 납부월은 출생월보다 뒤여야 합니다.');
  if (end && sixtyFive && end >= sixtyFive.slice(0, 7)) r.errors.push('65세 도달월 이후 납부는 이 일반 연속가입 시나리오에서 지원하지 않습니다. 실제 인정기간을 공단에 확인해 주세요.');
  const military = creditMonths(v.nationalMilitaryMonths, '국민연금 군복무 크레딧', r), child = creditMonths(v.nationalChildMonths, '국민연금 출산 크레딧', r);
  if (military > 12) r.errors.push('국민연금 군복무 크레딧은 최대 12개월입니다. 2026년 개정 전 경과조건과 공단 인정 개월을 확인해 주세요.');
  if (v.incomeMode === 'current' && average !== null && (average < 410000 || average > 6590000)) r.errors.push('2026년 7월~2027년 6월 국민연금 기준소득월액은 41만원~659만원 범위입니다. 현재 소득과 재평가 평균소득을 구분해 주세요.');
  const rows: { year: number; months: number }[] = [];
  if (end && validMonth(v.nationalStartMonth)) {
    const startIndex = monthIndex(v.nationalStartMonth), endIndex = monthIndex(end);
    if (endIndex < startIndex || endIndex - startIndex > 1200) r.errors.push('국민연금 납부 시작/종료월의 순서와 기간(최대 100년)을 확인해 주세요.');
    else {
      const byYear = new Map<number, number>();
      for (let i = startIndex; i <= endIndex; i++) { const year = Math.floor(i / 12); byYear.set(year, (byYear.get(year) ?? 0) + 1); }
      for (const [year, months] of byYear) rows.push({ year, months });
      r.months = endIndex - startIndex + 1 + military + child;
    }
  }
  if (r.months === null || r.months < 120) r.errors.push('노령연금은 가입기간 10년(120개월) 이상이 필요합니다. 실제 납부 및 인정기간을 확인해 주세요.');
  r.periods = [
    { label: '1988~1998년 · 상수 2.4', months: rows.filter(x => x.year <= 1998).reduce((n, x) => n + x.months, 0), amountWon: null },
    { label: '1999~2007년 · 상수 1.8', months: rows.filter(x => x.year >= 1999 && x.year <= 2007).reduce((n, x) => n + x.months, 0), amountWon: null },
    { label: '2008~2025년 · 연도별 1.5→1.245', months: rows.filter(x => x.year >= 2008 && x.year <= 2025).reduce((n, x) => n + x.months, 0), amountWon: null },
    { label: '2026년 이후 · 상수 1.29', months: rows.filter(x => x.year >= 2026).reduce((n, x) => n + x.months, 0), amountWon: null },
    { label: '공단 확인 군복무/출산 크레딧', months: military + child, amountWon: null },
  ];
  if (isCalendarDate(p.birthDate)) {
    r.normalAge = nationalPensionAge(Number(p.birthDate.slice(0, 4))); r.earlyAge = r.normalAge - 5;
    const ageDate = birthAnniversary(p.birthDate, r.normalAge);
    if (ageDate && r.months !== null && r.months >= 120 && end && !v.complexCareer && r.errors.length === timingErrorsBeforePeriods) {
      // For late eligibility, wait until the 120th contribution month; future contributions aren't received early.
      const requiredPaidMonths = Math.max(1, 120 - military - child);
      const qualifyingMonth = monthString(monthIndex(v.nationalStartMonth) + requiredPaidMonths - 1);
      const day = new Date(Date.UTC(Number(qualifyingMonth.slice(0, 4)), Number(qualifyingMonth.slice(5, 7)), 0)).getUTCDate();
      const qualifyingDate = `${qualifyingMonth}-${day}`;
      setPensionTiming(r, date, qualifyingDate > ageDate ? qualifyingDate : ageDate);
      if (monthIndex(end) > monthIndex(r.normalStartDate!)) {
        r.errors.push('정상 수급권 발생 이후의 추가 납부가 포함되어 있습니다. 연기·임의계속가입 선택을 자동 가정하지 않으므로 마지막 납부월과 실제 수급 시점을 공단에 확인해 주세요.');
        setPensionTiming(r, date, null);
      }
    }
  }
  r.earlyNote = '조기노령연금은 가입 10년 이상·정상연령보다 최대 5년 전·소득 있는 업무에 종사하지 않는 등 요건을 확인하고 신청해야 합니다. 월 0.5%(연 6%, 최대 30%) 감액되며 자동 선택하지 않았습니다. 정상연금도 소득활동에 따른 감액을 별도 확인하세요.';
  if ((military || child) && (!r.normalStartDate || r.normalStartDate < '2026-01-01')) r.errors.push('2026년 이전 수급권의 크레딧 경과규정은 자동 지원하지 않습니다.');
  r.formula = 'Σ[가입연도별 비례상수 × (A+B, 1988~1998년은 A+0.75B) × 해당 가입개월] / 240 / 12. 10~20년 지급률과 20년 초과 가산을 반영한 형태. 확인 크레딧은 1.29×(A+0.5A 또는 A+A)×개월을 별도 반영.';
  if (!r.errors.length && average !== null && r.months !== null) try {
    const a = BigInt(nationalA2026), b = BigInt(average);
    let numerator = 0n;
    for (const row of rows) numerator += BigInt(nationalCoefficient(row.year)) * (row.year <= 1998 ? 4n * a + 3n * b : 4n * (a + b)) * BigInt(row.months);
    numerator += 1290n * a * (6n * BigInt(military) + 8n * BigInt(child));
    const raw = numerator / 11520000n;
    let cap = average;
    if (v.incomeMode === 'current' && v.constantIncome) r.notes.push('고정소득 시나리오의 최종 5년 평균도 동일 소득으로 가정하여 월액 상한을 적용합니다.');
    else if (v.nationalLastFiveIncome) { const n = positiveMoney(v.nationalLastFiveIncome, '최종 5년 기준소득월액 평균', r); if (n !== null) cap = Math.max(average, n); }
    else if (raw > BigInt(average)) r.errors.push('계산액이 가입기간 평균소득을 넘어 월액 상한 확인에 최종 5년 기준소득월액 평균이 필요합니다.');
    if (!r.errors.length) {
      const amount = raw < BigInt(cap) ? raw : BigInt(cap);
      if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('연금액이 안전한 원 단위 범위를 초과했습니다.');
      r.amountWon = Number(amount / 10n * 10n); r.confidence = '조건부 추정값 · 국민연금 가입이력·소득 기반 · 세전';
      if (raw > BigInt(cap)) r.notes.push('최종 5년 평균과 재평가된 가입기간 평균 중 큰 금액으로 월액 상한을 적용했습니다.');
    }
  } catch (e) { r.errors.push((e as Error).message); }
  r.errors = [...new Set(r.errors)];
  return r;
}
