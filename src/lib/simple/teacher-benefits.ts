import type { SimpleProfile, SimpleBenefits } from './model.ts';
import { estimateAllowance, estimateHonorary } from './benefit-estimates.ts';
import { teacherIncomeSensitivities } from './teacher-pension.ts';
import { salaryGrowth, type TeacherPayProjection } from './teacher-pay.ts';

export function estimateTeacherBenefits(p: SimpleProfile, q: SimpleBenefits, date: string | null, normal: string | null, step: number | null, pay: TeacherPayProjection) {
  const errors=[...pay.errors];
  if ((q.income ?? '') !== '') errors.push('개인 기준소득월액 입력 경로를 우선합니다. 교원 표준 소득으로 입력값이나 오류를 대체하지 않습니다.');
  if(p.appointmentDate<'2010-01-01')errors.push('구기간 보수 현가액의 미래 환산 근거가 없어 교원 모델의 미래 명목 전체 수당 합계는 보류합니다. 아래2026 기준 참고 시나리오는 별도로 확인하세요.');
  // A January-1 retirement can reference the previous pay year. Only salary-linked
  // components follow salary-table growth; fixed homeroom/teaching/service additions do not.
  const salaryLinkedMonthly = pay.final ? (pay.final.salaryWon + pay.final.regularBonusWon + pay.final.holidayBonusWon) / pay.final.months : 0;
  const income=pay.final && date ? Math.round(pay.final.incomeProxyWon + salaryLinkedMonthly *
    (salaryGrowth(Number(date.slice(0,4))) / salaryGrowth(pay.final.year) - 1)) : null;
  const honorary=date&&pay.finalSalaryWon!==null?estimateHonorary(p,date,normal,step,{won:pay.finalSalaryWon,year:Number(date.slice(0,4))}):null;
  const rows=!errors.length&&date&&income!==null?teacherIncomeSensitivities.map(s=>{
    // Pay is an annualized standard-component proxy. Never written into the user's official-income field.
    const baseIncome=Math.floor(income*s.percent/100);
    const allowance=estimateAllowance(p,{...q,income:String(baseIncome)},date);
    allowance.basis='퇴직연도 미래 명목 · 교원 표준 보수 일부 항목 기반 · 실제 기준소득월액 아님';
    const sum=p.retirement==='early'&&allowance.amountWon!==null&&honorary?.amountWon!==null&&honorary?.amountWon!==undefined
      ? BigInt(allowance.amountWon)+BigInt(honorary.amountWon):null;
    return {...s,incomeWon:baseIncome,allowanceWon:allowance.amountWon,honoraryWon:honorary?.amountWon??null,
      combinedWon:sum!==null&&sum<=BigInt(Number.MAX_SAFE_INTEGER)?Number(sum):null,errors:allowance.errors};
  }):[];
  return {rows,honorary,errors,priceYear:date?Number(date.slice(0,4)):null,
    notes:'교원 보수 기반 미래 명목·세전 참고 시나리오입니다. 명퇴수당은 봉급액의 법정68% 및 잔여월 산식, 퇴직수당은 표준 과세 보수 월평균 근사 소득과 인정기간/지급률을 사용해 소득 가정이 다릅니다. 직종별 평균수당·기준소득 적용시기 조정·실제 소득은 미확인입니다.2026 고정가격/전체 공무원 통계 시나리오·금융자산에 자동 합산하지 않습니다.'};
}
