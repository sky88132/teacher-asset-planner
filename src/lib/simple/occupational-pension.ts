import type { SimpleProfile } from './model.ts';
import { emptyPension, type PensionEstimateInput, type PensionEstimate } from './pension-types.ts';
import { isCalendarDate } from '../profile-validation.ts';
import { monthIndex, occupationalPensionAge, birthAnniversary, setPensionTiming } from './pension-dates.ts';
import { checkPensionContext, pensionIncome, positiveMoney } from './pension-income.ts';
import { ageAt } from '../finance/cashflow-validation.ts';

const rates = [18780,18560,18340,18120,17900,17800,17700,17600,17500,17400,17360,17320,17280,17240,17200,17160,17120,17080,17040];
/** Annual service rates, millionths. 2035 onward: 1.7%; not a retirement-year-only rate. */
export function occupationalRate(year: number): number { return year >= 2035 ? 17000 : rates[year - 2016] ?? 0; }
export function occupationalCap(monthsAt2016: number): number { return monthsAt2016 >= 252 ? 396 : monthsAt2016 >= 204 ? 408 : monthsAt2016 >= 180 ? 420 : 432; }
type YearService = { year: number; months: number };
function careerYears(p: SimpleProfile, date: string | null, v: PensionEstimateInput, today: string, r: PensionEstimate): YearService[] {
  if (!date || !isCalendarDate(date) || !isCalendarDate(p.appointmentDate) || date <= p.appointmentDate) return [];
  const last = new Date(Date.parse(date + 'T00:00:00Z') - 86400000).toISOString().slice(0, 7);
  const startIndex = monthIndex(p.appointmentDate), endIndex = monthIndex(last);
  if (endIndex - startIndex > 1200) { r.errors.push('100년을 넘는 재직기간은 지원하지 않습니다.'); return []; }
  const map = new Map<number, number>();
  for (let n = startIndex; n <= endIndex; n++) { const year = Math.floor(n / 12); map.set(year, (map.get(year) ?? 0) + 1); }
  if (p.military === 'approved') {
    const months = Number(v.militaryMonths), year = Number(v.militaryCreditYear);
    if (!/^\d+$/.test(v.militaryMonths) || !Number.isSafeInteger(months) || months < 1 || months > 120 || !/^\d{4}$/.test(v.militaryCreditYear) || year < 2016 || year < Number(p.appointmentDate.slice(0, 4)) || year > Number(today.slice(0, 4)) || year > Number(date.slice(0, 4))) {
      r.errors.push('군복무 산입 승인자는 공단 인정 복무개월(1~120개월 지원)과 실제 산입연도(2016년 이후)가 필요합니다. 승인 여부만으로 기간을 임의 가산하지 않습니다. 2015년 이전 산입은 별도 경과규정 확인이 필요합니다.');
    } else {
      map.set(year, (map.get(year) ?? 0) + months);
      r.notes.push(`임용 전 군복무 ${months}개월을 실제 복무연도가 아닌 공단 산입연도 ${year}년 지급률로 반영했습니다. 중복 산입·소급기여금은 기관 확인이 필요합니다.`);
    }
  } else r.notes.push('임용 전 군복무·과거 합산은 미반영입니다. 산입 여부 미확인은 실제 인정기간 0개월이라는 판정이 아닙니다.');
  return [...map].sort(([a], [b]) => a - b).map(([year, months]) => ({ year, months }));
}
function factor(raw: string, r: PensionEstimate): bigint | null {
  if (!/^\d+(?:\.\d{1,4})?$/.test(raw) || Number(raw) <= 0 || Number(raw) > 200) {
    r.errors.push('공단 확인 재직기간별 적용비율(이행률/보정률, %)이 필요합니다. 1로 임의 대체하지 않습니다. 입력 지원 범위는 0% 초과~200%입니다.'); return null;
  }
  const [whole, fraction = ''] = raw.split('.');
  return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
}
const denominator = 12000000000000n;
function money(n: bigint): number {
  const whole = n / denominator;
  if (whole < 0n || whole > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('연금액이 안전한 원 단위 범위를 초과했습니다.');
  return Number(whole);
}
function calculateOccupational(p: SimpleProfile, v: PensionEstimateInput, date: string | null, today: string, scheme: 'civil' | 'private-school'): PensionEstimate {
  const r = emptyPension();
  r.sources = scheme === 'civil' ? [
    { title: '공무원연금법·부칙', url: 'https://law.go.kr/LSW/lsInfoP.do?lsiSeq=290745' },
    { title: '공무원연금법 시행령', url: 'https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=82190' },
    { title: '공무원연금공단 산정 안내', url: 'https://www.geps.or.kr/bizInformation_pensionBiz_pensionReceipt' },
    { title: '공무원연금법 제34조 지급대상월', url: 'https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1030484343' },
  ] : [
    { title: '사학연금법·고유 부칙', url: 'https://law.go.kr/LSW/lsInfoP.do?lsiSeq=290719' },
    { title: '사학연금법 시행령', url: 'https://law.go.kr/LSW/lsInfoP.do?lsiSeq=290433' },
    { title: '사학연금공단 공식 안내', url: 'https://www.tp.or.kr/asset/tp-kr/download/알아두면유익한사학연금.pdf' },
    { title: '법제처 사학 퇴직연금 안내', url: 'https://www.easylaw.go.kr/CSP/CnpClsMainBtr.laf?ccfNo=2&cciNo=2&cnpClsNo=3&csmSeq=2056' },
  ];
  checkPensionContext(p, v, date, r);
  r.notes.push('일반 전일제·임용 후 중단 없는 재직 가정입니다. 01의 호봉·승급월·예상 최종봉급은 평균소득으로 사용하지 않습니다.',
    '2026년 가격 고정 세전 추정입니다. 미래 보수 인상·물가 조정·세금·분할연금·감액·재취업 지급정지·미납 공제는 미반영입니다.');
  const rows = careerYears(p, date, v, today, r);
  const before2016 = rows.filter(x => x.year < 2016).reduce((n, x) => n + x.months, 0);
  let capBasis = before2016;
  if (p.military === 'approved' && before2016 > 0 && /^\d+$/.test(v.militaryMonths)) {
    const maximum = before2016 + Number(v.militaryMonths);
    if (v.recognizedAt2016) {
      const confirmed = Number(v.recognizedAt2016);
      if (!/^\d+$/.test(v.recognizedAt2016) || !Number.isSafeInteger(confirmed) || confirmed < before2016 || confirmed > maximum) r.errors.push('군복무 산입자의 2016년 기준 인정기간은 연속 재직기간과 인정 복무기간 범위의 공단 확인 개월로 입력해 주세요. 그 밖의 합산·감축은 별도 이력에 해당합니다.');
      else capBasis = confirmed;
    } else if (occupationalCap(before2016) !== occupationalCap(maximum)) r.errors.push('군복무 산입으로 2016년 경과 상한이 달라질 수 있습니다. 공단에서 확인한 2016년 1월 1일 기준 인정 재직개월이 필요합니다.');
  }
  r.capMonths = occupationalCap(capBasis);
  let remaining = r.capMonths;
  const capped = rows.map(row => { const months = Math.min(row.months, remaining); remaining -= months; return { ...row, months }; });
  const oldMonths = capped.filter(x => x.year <= 2009).reduce((n, x) => n + x.months, 0);
  const middleMonths = capped.filter(x => x.year >= 2010 && x.year <= 2015).reduce((n, x) => n + x.months, 0);
  const recent = capped.filter(x => x.year >= 2016), recentMonths = recent.reduce((n, x) => n + x.months, 0);
  r.months = rows.length ? oldMonths + middleMonths + recentMonths : null;
  r.periods = [{ label: '2009년 이전', months: oldMonths, amountWon: null }, { label: '2010~2015년', months: middleMonths, amountWon: null }, { label: '2016년 이후', months: recentMonths, amountWon: null }];
  if (r.months === null || r.months < 120) r.errors.push('일반 퇴직연금은 인정 재직기간 10년 이상이 필요합니다. 현재 재직기간 가정을 확인해 주세요.');
  if (date && isCalendarDate(date) && isCalendarDate(p.birthDate) && isCalendarDate(p.appointmentDate)) {
    if (p.appointmentDate < '1996-01-01') {
      r.notes.push('1995년 이전 임용자는 2001년 당시 인정기간·추가 재직·합산 경과규정이 필요해 정상 개시일을 자동 확정하지 않습니다. 공단 확인 정상 수급조건 충족일만 선택 입력할 수 있습니다.');
      if (v.verifiedNormalDate) {
        if (!isCalendarDate(v.verifiedNormalDate) || v.verifiedNormalDate < date || v.verifiedNormalDate <= p.birthDate) r.errors.push('공단 확인 정상 수급조건 충족일은 유효한 퇴직일 이후 날짜여야 합니다.');
        else if (v.confirmedRetirementDate === date && v.confirmedAppointmentDate === p.appointmentDate) {
          r.normalAge = ageAt(p.birthDate, v.verifiedNormalDate);
          setPensionTiming(r, date, v.verifiedNormalDate, 'occupational');
          r.notes.push('정상 개시일은 1995년 이전 임용자의 기관 확인일을 사용한 사용자 입력이며 앱이 진위를 검증하지 않습니다.');
        }
      }
    }
    else if (!v.complexCareer) {
      r.normalAge = occupationalPensionAge(date); r.earlyAge = r.normalAge - 5;
      const ageDate = birthAnniversary(p.birthDate, r.normalAge);
      if (ageDate && r.months !== null && r.months >= 120) setPensionTiming(r, date, ageDate > date ? ageDate : date, 'occupational');
    }
  }
  r.earlyNote = '조기퇴직연금은 10년 이상 재직·퇴직 후 정상 개시보다 최대 5년 전 신청이 가능하며 미달 1년당 5%(최대 25%) 감액됩니다. 자동 선택하지 않았으며 월별 감액·개인 예외는 공단 확인이 필요합니다.';
  const average = pensionIncome(v, r);
  const k = factor(v.factorPercent, r);
  const legacy = oldMonths ? positiveMoney(v.legacyIncome, '2009년 이전분의 재평가된 평균보수월액', r) : 0;
  const redistributed = recentMonths ? positiveMoney(v.redistributedIncome, '소득재분배가 반영된 평균기준소득월액', r) : 0;
  if (oldMonths && (r.months ?? 0) > 396) r.errors.push('2009년 이전 재직분이 있는 33년 초과 경력은 구법/신법 상한 배분·비교조정의 외부 검증이 남아 금액을 제공하지 않습니다.');
  r.formula = '구기간: 평균보수×(20년 미만 2.5%×연수 / 이상 50%+초과연수×2%). 2010~2015: 평균기준소득×적용비율×연수×1.9%. 2016 이후: 재분배소득×적용비율×1% + 평균소득×적용비율×(연도별 지급률−1%), 총 재직 30년 초과분은 개인소득×연도별 지급률.';
  if (!r.errors.length && average !== null && k !== null && legacy !== null && redistributed !== null) try {
    const a = BigInt(average), b = BigInt(legacy), c = BigInt(redistributed);
    const old = oldMonths < 240 ? b * BigInt(oldMonths) * 25000n * 1000000n : b * (6000000n + BigInt(oldMonths - 240) * 20000n) * 1000000n;
    const mid = a * k * BigInt(middleMonths) * 19000n;
    let service = oldMonths + middleMonths, post = 0n;
    for (const row of recent) {
      const redistributedMonths = Math.min(row.months, Math.max(0, 360 - service));
      const rate = BigInt(occupationalRate(row.year));
      post += k * (BigInt(redistributedMonths) * (c * 10000n + a * (rate - 10000n)) + BigInt(row.months - redistributedMonths) * a * rate);
      service += row.months;
    }
    // Civil Act supplementary Art.13(4); private decree's 2016 supplementary Art.3.
    const prior = a * k * 19000n * BigInt(Math.min(recentMonths, Math.max(0, 396 - oldMonths - middleMonths)));
    if (post > prior) r.notes.push(`${scheme === 'civil' ? '공무원연금법 부칙 제13조제4항' : '사학연금법 시행령의 2016년 개정 부칙 제3조'}에 따라 2016년 이후분에 종전 1.9% 산식 비교 상한을 적용했습니다.`);
    post = post < prior ? post : prior;
    if (!r.errors.length) {
      r.amountWon = money(old + mid + post);
      [old, mid, post].forEach((n, i) => { r.periods[i].amountWon = money(n); });
      r.confidence = '조건부 추정값 · 입력 소득 기반 · 세전';
    }
  } catch (e) { r.errors.push((e as Error).message); }
  r.errors = [...new Set(r.errors)];
  return r;
}
export function estimateCivilPension(p: SimpleProfile, v: PensionEstimateInput, date: string | null, today: string) { return calculateOccupational(p, v, date, today, 'civil'); }
export function estimatePrivatePension(p: SimpleProfile, v: PensionEstimateInput, date: string | null, today: string) { return calculateOccupational(p, v, date, today, 'private-school'); }
