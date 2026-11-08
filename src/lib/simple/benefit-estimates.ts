import type { SimpleBenefits, SimpleProfile } from './model.ts';
import { isCalendarDate } from '../profile-validation.ts';
import { addSimulationMonths } from '../finance/ktcu-validation.ts';
import { moneyWon } from './validation.ts';
import { teacherSalary2026 } from './config.ts';

export const benefitSources = {
  honorary: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=290347',
  civil: 'https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=82190',
  private: 'https://law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=03&joNo=0063&lsiSeq=290433&urlMode=lsScJoRltInfoR',
} as const;
export type BenefitEstimate = { amountWon: number | null; errors: string[]; formula: string; months: number | null;
  salaryWon: number | null; rate: number | null; basis: string; source: string };
const empty = (source: string, basis: string): BenefitEstimate => ({ amountWon: null, errors: [], formula: '', months: null, salaryWon: null, rate: null, source, basis });
/** Statutory month counting: appointment month through month containing day before retirement. */
export function serviceCalendarMonths(start: string, retirement: string): number | null {
  if (!isCalendarDate(start) || !isCalendarDate(retirement) || retirement <= start) return null;
  const previous = new Date(Date.parse(retirement + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  return (Number(previous.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(previous.slice(5, 7)) - Number(start.slice(5, 7)) + 1;
}
export function honoraryMultiplier(months: number): number | null {
  if (!Number.isInteger(months) || months < 12) return null;
  return months <= 60 ? months : months <= 120 ? 60 + (months - 60) / 2 : 90;
}
export function estimateHonorary(p: SimpleProfile, date: string | null, normal: string | null, step: number | null): BenefitEstimate {
  const r = empty(benefitSources.honorary, '2026년 봉급표 가격 고정 · 세전 · 미래 봉급 인상 미반영');
  if (p.retirement !== 'early') r.errors.push('정년퇴직은 명예퇴직수당 대상이 아닙니다.');
  if (p.scheme !== 'civil') {
    r.errors.push(p.scheme === 'private-school' ? '사학 명퇴수당은 사립학교법 제60조의3, 학교 정관·관할청 시행계획 확인이 필요하여 공무원 산식을 자동 적용하지 않습니다.' : '국민연금 가입만으로 교육공무원 명퇴수당 적용 신분을 확인할 수 없습니다.');
    r.formula = '해당 제도의 적용 근거 확인 전 공무원 산식 미적용';
    r.basis = '학교별·신분별 적용 근거 확인 필요';
    return r;
  }
  if (!date || !normal || !isCalendarDate(date) || !isCalendarDate(normal)) r.errors.push('최초 임용일·예상 명예퇴직일·정년일을 확인해 주세요.');
  if (step === null || !Number.isInteger(step) || step < 1 || step > 40) r.errors.push('현재 호봉과 승급월을 입력해 주세요.');
  if (date && normal && isCalendarDate(date) && isCalendarDate(normal)) {
    const lastDay = new Date(Date.UTC(Number(normal.slice(0, 4)), Number(normal.slice(5, 7)), 0)).getUTCDate();
    if (Number(normal.slice(8, 10)) !== lastDay) r.errors.push('월말이 아닌 정년일의 잔여월 끝수는 자동 지원하지 않습니다. 기관의 정년일을 확인해 주세요.');
    r.months = (Number(normal.slice(0, 4)) - Number(date.slice(0, 4))) * 12 + Number(normal.slice(5, 7)) - Number(date.slice(5, 7));
    if (addSimulationMonths(date, 12) > normal || r.months < 12) r.errors.push('정년퇴직일보다 최소 1년 전 퇴직하는 일반 지급요건을 충족하지 않습니다.');
    const service = serviceCalendarMonths(p.appointmentDate, date);
    if (service === null || service < 240) r.errors.push('임용일 기준 20년 재직을 확인할 수 없습니다. 병역·합산 등 법정 인정기간은 소속 기관 확인이 필요합니다.');
  }
  if (step !== null) r.salaryWon = teacherSalary2026[step - 1] ?? null;
  const multiplier = r.months === null ? null : honoraryMultiplier(r.months);
  r.formula = multiplier === null ? '정년 잔여 1년 이상 필요' : `2026 봉급액 × 68% × 1/2 × ${multiplier} (잔여 60개월 초과분은 1/2, 최대 90)`;
  if (!r.errors.length && r.salaryWon !== null && multiplier !== null) r.amountWon = Math.floor(r.salaryWon * 68 * multiplier / 200);
  return r;
}
export function allowanceRate(months: number): number | null {
  if (!Number.isInteger(months) || months < 12) return null;
  return months < 60 ? 0.065 : months < 120 ? 0.2275 : months < 180 ? 0.2925 : months < 240 ? 0.325 : 0.39;
}
export function estimateAllowance(p: SimpleProfile, q: SimpleBenefits, date: string | null): BenefitEstimate {
  const r = empty(p.scheme === 'private-school' ? benefitSources.private : benefitSources.civil, '2026년 기준 입력 소득 가격 고정 · 세전 · 미래 소득 인상 미반영');
  if (p.scheme === 'national') {
    r.errors.push('국민연금 가입자는 공무원·사학 퇴직수당 자동 지급 대상이 아닙니다. 별도 법정 퇴직급여·평균임금 또는 DB/DC 내역이 필요합니다.');
    r.source = 'https://www.law.go.kr/법령/근로자퇴직급여보장법';
    r.basis = '국민연금과 별개인 근로자 퇴직급여 적용 여부 확인 필요';
    r.formula = '공무원·사학 퇴직수당 산식 미적용';
    return r;
  }
  if (!date) r.errors.push('01의 최초 임용일과 예상 퇴직일을 확인해 주세요.');
  // Pre-2010 conversion and transitional rules are not approximated with a final salary proxy.
  if (isCalendarDate(p.appointmentDate) && p.appointmentDate < '2010-01-01') r.errors.push('2009년 이전 재직분은 별도 최종보수월액 환산·경과규정 검증이 남아 자동 금액을 제공하지 않습니다. 현재 기준소득월액을 구기간 소득으로 대체하지 않습니다.');
  const income = moneyWon(q.income ?? '');
  if (income.won === null || income.error || income.won === 0) r.errors.push(income.error ?? '선택 입력: 공단에서 확인한 퇴직수당용 기준소득월액이 필요합니다. 호봉 봉급액·실수령액과 다릅니다.');
  const calendar = date ? serviceCalendarMonths(p.appointmentDate, date) : null;
  let months = calendar;
  if (q.recognizedMonths) {
    if (q.recognizedDate !== date) r.errors.push('퇴직일이 바뀌었습니다. 퇴직수당 인정 개월을 새 퇴직일 기준으로 다시 입력해 주세요.');
    if (q.recognizedAppointment && q.recognizedAppointment !== p.appointmentDate) r.errors.push('임용일이 바뀌었습니다. 퇴직수당 인정 개월을 다시 확인해 주세요.');
    if (!/^\d+$/.test(q.recognizedMonths) || !Number.isSafeInteger(Number(q.recognizedMonths)) || calendar === null || Number(q.recognizedMonths) > calendar) r.errors.push('퇴직수당 인정기간은 임용 후 달력상 기간 이내의 정수 개월로 입력해 주세요. 임용 전 병역·합산기간을 더하지 않습니다.');
    else months = Number(q.recognizedMonths);
  }
  if (months === null) r.errors.push('최초 임용일과 퇴직일로 재직기간을 확인해 주세요.');
  else {
    r.months = Math.min(months, 396); r.rate = allowanceRate(r.months);
    if (r.rate === null) r.errors.push('퇴직수당은 인정 재직기간 1년 이상이 필요합니다.');
  }
  r.salaryWon = income.won;
  r.formula = `기준소득월액 × ${r.months ?? '?'} / 12 × ${r.rate === null ? '?' : (r.rate * 100).toFixed(2)}% (33년 상한)`;
  if (!r.errors.length && r.salaryWon !== null && r.months !== null && r.rate !== null) {
    // One final whole-won floor, not an assertion of the agency's statutory rounding.
    const n = BigInt(r.salaryWon) * BigInt(r.months) * BigInt(Math.round(r.rate * 10000)) / 120000n;
    if (n > BigInt(Number.MAX_SAFE_INTEGER)) r.errors.push('금액 범위를 초과했습니다.');
    else r.amountWon = Number(n);
  }
  return r;
}
