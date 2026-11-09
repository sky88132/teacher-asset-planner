import type { SimpleProfile } from './model.ts';
import { teacherSalary2026 } from './config.ts';
import { validateSimpleProfile, projectedStep } from './validation.ts';
import { monthIndex } from './pension-dates.ts';

export const teacherPaySources = [
  { title: '2026 인사혁신처 교원 봉급표', url: 'https://www.mpm.go.kr/mpm/info/resultPay/bizSalary/2026/' },
  { title: '수당규정 제7·18·18의3조 및 별표2·11', url: 'https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=290323&efYd=20261002&chrClsCd=010202&ancYnChk=0' },
  { title: '기준소득·재평가 규정 제4·5·8·10조', url: 'https://www.nhis.or.kr/lm/lmxsrv/law/lawFullContent.do?SEQ=228&SEQ_HISTORY=' },
] as const;
export const teacherPayAssumptions = '봉급표 연 3% 상승·승급월 1일 정기승급·40호봉 상한·담임수당 계속 월20만원·교직수당 월25만원·기타 표준 수당. 실제 소득이 아닌 가정 기반 추정. 급식비 월16만원은 비과세 제외. 성과·초과근무 등 직종별 평균수당은 미확인·미포함이며 실제 기준소득월액이 아님.';
export const teacherPriceNote = '2026 환산은 봉급상승률 3% 가정으로 환산한 보수수준 비교액이며 물가할인에 따른 구매력 현재가치가 아닙니다. 과거 소득은 실제 급여·공식 과거 재평가액이 아닌 2026 표 기반 대체 경로입니다.';
export function salaryGrowth(year: number) { return 1.03 ** Math.max(0, year - 2026); }
function rounded(n: number) {
  const result = Math.round(n);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('교원 보수 추정의 원 단위 범위를 초과했습니다.');
  return result;
}
/** Table thresholds are completed remuneration-service years; prior military/other careers excluded. */
export function regularBonusRate(years: number) {
  return years < 2 ? .10 : years < 5 ? .20 : years < 6 ? .25 : years < 7 ? .30 : years < 8 ? .35 : years < 9 ? .40 : years < 10 ? .45 : .50;
}
export function serviceBonusMonthly(years: number) {
  return years < 5 ? 30000 : years < 7 ? 40000 : years < 10 ? 50000 : years < 15 ? 60000 : years < 20 ? 80000 : years < 25 ? 110000 : 130000;
}
/** At the cap, choose the latest possible arrival as an explicit planning assumption. */
export function teacherStepAt(p: SimpleProfile, date: string, today: string): number | null {
  if (date >= today) return projectedStep(p, date, today);
  let increments = 0;
  for (let year = Number(date.slice(0, 4)); year <= Number(today.slice(0, 4)); year++) {
    const scheduled = `${year}-${p.promotionMonth.padStart(2, '0')}-01`;
    if (scheduled > date && scheduled <= today) increments++;
  }
  const step = Number(p.step) - increments;
  return step >= 1 && step <= 40 ? step : null;
}
export type TeacherPayYear = {
  year: number; months: number; firstStep: number; lastStep: number;
  salaryWon: number; homeroomWon: number; teachingWon: number; serviceBonusWon: number;
  regularBonusWon: number; holidayBonusWon: number; mealWon: number;
  taxableWon: number; grossWon: number; annualizedTaxableWon: number; incomeProxyWon: number;
  basis2026IncomeWon: number; reconstructed: boolean;
};
export function projectTeacherPay(p: SimpleProfile, date: string | null, today: string) {
  const errors: string[] = [], historyErrors: string[] = [], rows: TeacherPayYear[] = [];
  const historyNote = p.step === '40' ? '40호봉 도달 이력이 없어 현재 기준 가장 최근 정기승급일에 40호봉에 도달한 것으로 가정해 과거 호봉을 역산합니다. 상한에 더 일찍 도달했다면 과거 보수가 달라집니다. 실제 호봉 이력이 아닌 계획 가정입니다.' : null;
  const assumptions = teacherPayAssumptions + (historyNote ? ' ' + historyNote : '');
  if (p.teacherModel === false) errors.push('교원 표준 보수 가정을 사용하지 않았습니다.');
  if (p.scheme !== 'civil') errors.push('새 보수 모델은 일반 국공립 초·중등 호봉제 교원 시나리오에만 자동 적용합니다.');
  errors.push(...validateSimpleProfile(p, today));
  const lastDay = date ? new Date(Date.parse(date + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10) : null;
  if (!date || !lastDay || errors.length) return { rows, errors: [...new Set(errors)], historyErrors, final: null, finalSalaryWon: null, assumptions, historyNote };
  const start = monthIndex(p.appointmentDate), end = monthIndex(lastDay);
  if (end - start > 1200) errors.push('100년 초과 보수 경로는 지원하지 않습니다.');
  if (errors.length) return { rows, errors, historyErrors, final: null, finalSalaryWon: null, assumptions, historyNote };
  // Monthly remuneration reference, not an agency payroll or exact lunar-holiday cash schedule.
  for (let year = Number(p.appointmentDate.slice(0, 4)); year <= Number(lastDay.slice(0, 4)); year++) {
    let salary = 0, homeroom = 0, teaching = 0, serviceBonus = 0, regular = 0, holiday = 0, meal = 0;
    const steps: number[] = [];
    for (let month = 1; month <= 12; month++) {
      const index = year * 12 + month - 1;
      if (index < start || index > end) continue;
      const when = `${year}-${String(month).padStart(2, '0')}-01`;
      // Current month uses the currently supplied step, including an increment due today.
      const step = when.slice(0, 7) === today.slice(0, 7) ? Number(p.step) : teacherStepAt(p, when, today);
      if (step === null) { historyErrors.push('과거 호봉 역산값이 1~40호봉 범위를 벗어납니다. 초임 호봉·승급 제한 등 실제 호봉 이력 없이 현재 보수만으로 전 재직기간 평균소득을 대체할 수 없습니다.'); continue; }
      const base = rounded(teacherSalary2026[step - 1] * salaryGrowth(year));
      const years = Math.max(0, Math.floor((index - start) / 12));
      steps.push(step); salary += base; homeroom += 200000; teaching += 250000;
      serviceBonus += serviceBonusMonthly(years); meal += 160000;
      // Annual two-payment benefits are accrued across eligible months for an annual-income proxy.
      // This deliberately is not a claim that two full bonuses are paid in a partial retirement year.
      regular += base * regularBonusRate(years) / 6;
      holiday += base * .10; // 60% twice per full year / 12 months.
    }
    if (!steps.length) continue;
    regular = rounded(regular); holiday = rounded(holiday);
    const taxable = rounded(salary + homeroom + teaching + serviceBonus + regular + holiday);
    const annualized = rounded(taxable * 12 / steps.length);
    rows.push({ year, months: steps.length, firstStep: steps[0], lastStep: steps.at(-1)!, salaryWon: salary,
      homeroomWon: homeroom, teachingWon: teaching, serviceBonusWon: serviceBonus, regularBonusWon: regular,
      holidayBonusWon: holiday, mealWon: meal, taxableWon: taxable, grossWon: rounded(taxable + meal),
      annualizedTaxableWon: annualized, incomeProxyWon: rounded(annualized / 12),
      basis2026IncomeWon: rounded(annualized / 12 / salaryGrowth(year)), reconstructed: year < Number(today.slice(0, 4)) });
  }
  const final = rows.at(-1) ?? null, step = projectedStep(p, date, today);
  const finalSalaryWon = step === null ? null : rounded(teacherSalary2026[step - 1] * salaryGrowth(Number(date.slice(0, 4))));
  return { rows, errors, historyErrors: [...new Set(historyErrors)], final, finalSalaryWon, assumptions, historyNote };
}
export type TeacherPayProjection = ReturnType<typeof projectTeacherPay>;
