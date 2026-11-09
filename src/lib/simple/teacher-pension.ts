import {projectWholeIncome,wholeIncome2026,wholeIncomeSources,type PensionVariable} from './pension-assumptions.ts';
import type { SimpleProfile } from './model.ts';
import { hasEnteredPensionIncome } from './pension-income.ts';
import { estimateCivilPension } from './occupational-pension.ts';
import type { PensionEstimate, PensionEstimateInput } from './pension-types.ts';
import { teacherPayAssumptions, teacherPriceNote, teacherPaySources, salaryGrowth, type TeacherPayProjection } from './teacher-pay.ts';

// Civil decree supplementary Art.10(10), NEW ENTRANT column only, <=1 through <=33 years.
// Read against all three images in the official NHIS law mirror. Never used for pre-2010 careers.
export const newEntrantFactors = [77.25,78.00,78.35,78.91,79.56,80.05,80.72,81.32,81.75,82.45,82.88,83.70,84.62,
  85.65,86.70,87.89,89.00,90.25,91.42,92.52,92.86,93.30,93.81,94.58,95.33,96.07,97.02,97.98,98.99,100.00,101.09,102.23,103.44] as const;
export function newEntrantFactor(months: number): number | null {
  return Number.isInteger(months) && months > 0 ? newEntrantFactors[Math.min(33, Math.ceil(months / 12)) - 1] : null;
}
// Law 13387 supplementary Art.9(2), MPM's official redistribution table.
export function redistributionPercent(personal: number, whole: number): number | null {
  if (![personal, whole].every(n=>Number.isSafeInteger(n)&&n>0)) return null;
  const percentages=[300,216.67,175,150,133.33,121.43,112.50,105.56,100,95.45,91.67,88.46,85.71,83.33];
  for (let i=0;i<percentages.length;i++) if(BigInt(personal)*10n<BigInt(whole)*BigInt(i+3)) return percentages[i];
  return 81.25;
}
export const teacherIncomeSensitivities = [
  { id: 'low', label: '보수적', percent: 90 }, { id: 'base', label: '기준', percent: 100 }, { id: 'high', label: '높은 소득 시나리오', percent: 110 },
] as const;
export function estimateTeacherPension(p: SimpleProfile, v: PensionEstimateInput, pay: TeacherPayProjection, confirmedBase: PensionEstimate, date: string | null, today: string) {
  const errors = [...pay.errors, ...pay.historyErrors];
  const hasIncome = hasEnteredPensionIncome(v);
  const eligible = p.scheme === 'civil' && p.teacherModel !== false && !hasIncome;
  // Approval alone does not identify credit months/year. A separate appointment-only
  // reference uses exactly the existing formulas, without claiming the full pension.
  const excludesMilitary = eligible && p.military==='approved';
  const modelProfile = excludesMilitary ? {...p,military:'not' as const} : p;
  const base = excludesMilitary ? estimateCivilPension(modelProfile,v,date,today) : confirmedBase;
  const limitations = excludesMilitary ? ['군복무 산입 승인 이력은 있으나 이 참고액은 임용 후 재직분만 계산했습니다. 군복무 산입분·산입에 따른 이행률과 상한 변화는 제외했으며 전체 예상 연금액이 아닙니다. 실제 전체액의 하한·최솟값도 아닙니다. 산입 개월·연도·소득과 경과규정은 공단 확인이 필요합니다.'] : [];
  if(p.appointmentDate<'2010-01-01') errors.push('2009년 이전 평균보수 현가액·재직기간별 이행률은 교원 봉급만으로 확인할 수 없습니다. 전체 월연금은 공단 확인 자료가 필요합니다.');
  if(v.complexCareer)errors.push('휴직·중단·시간제·재임용 등 별도 이력은 표준 보수 경로에 적용하지 않습니다.');
  if(!base.normalStartDate||base.months===null||base.months<120||base.capMonths===null)errors.push('정상 개시일·10년 이상 인정기간을 확인해야 표준 월연금을 계산할 수 있습니다.');
  let remaining=base.capMonths??0, weighted=0n, months=0;
  const whole = projectWholeIncome(date?Number(date.slice(0,4)):0,base.normalStartDate?Number(base.normalStartDate.slice(0,4)):0,v.simulationInflation??'0');
  if(eligible) errors.push(...whole.errors);
  const assumedWholeIncome=whole.basis2026Won??wholeIncome2026; // A proxy for the 3-year whole-civil-service average, NOT personal income.
  for(const row of pay.rows){
    const m=Math.min(remaining,row.months);remaining-=m;
    if(row.year<2010||m===0)continue;
    const capped=Math.min(row.basis2026IncomeWon,Math.floor(wholeIncome2026*(row.year<2016?1.8:1.6)));
    weighted+=BigInt(capped)*BigInt(m);months+=m;
  }
  const average=months?Number(weighted/BigInt(months)):null, k=base.months===null?null:newEntrantFactor(base.months);
  const startYear=base.normalStartDate?Number(base.normalStartDate.slice(0,4)):null;
  const rows=eligible&&!errors.length&&average!==null&&k!==null&&date&&startYear!==null?teacherIncomeSensitivities.map(s=>{
    const income=Math.min(Math.floor(average*s.percent/100),Math.floor(wholeIncome2026*1.6));
    const nominalIncome=Math.round(income*salaryGrowth(startYear));
    // Compare B and A at the same pension-start price basis, before display conversion.
    const redistribution=redistributionPercent(nominalIncome,whole.startWon!)!;
    const redistributed=Number(BigInt(income)*BigInt(Math.round(redistribution*100))/10000n);
    const nominalRedistributed=Number(BigInt(nominalIncome)*BigInt(Math.round(redistribution*100))/10000n);
    const generated={...v, incomeMode:'average' as const, averageIncome:String(income), redistributedIncome:String(redistributed), factorPercent:String(k),
      confirmedRetirementDate:date, confirmedAppointmentDate:p.appointmentDate};
    const basis=estimateCivilPension(modelProfile,generated,date,today);
    // The statutory revaluation direction is reused; future civil pay growth is a 3% planning assumption.
    const nominal=estimateCivilPension(modelProfile,{...generated,averageIncome:String(nominalIncome),
      redistributedIncome:String(nominalRedistributed)},date,today);
    nominal.priceYear=startYear;nominal.method='교원 표준 보수 경로·법정 구간식 기반 가정 시뮬레이션 (개시연도 미래 명목)';
    nominal.confidence='가정 기반 시뮬레이션 · 표준 보수 일부 항목 · 세전 · 외부 금액 검증 미완료';
    if(excludesMilitary)nominal.confidence+=' · 임용 후 재직분만 · 군복무 산입분 제외 · 전체 예상액 아님';
    nominal.notes=nominal.notes.filter(n=>!n.includes('2026년 가격 고정')&&!n.includes('01의 호봉')&&!n.startsWith('입력 평균소득은 2026년'));
    nominal.notes.push(teacherPayAssumptions,teacherPriceNote,
      '연도별 과거 실제 급여와 과거 법정 재평가계수는 확보하지 못해 2026 표 기준 역산 경로로 대체했습니다. 전년도 보수/5월 적용·1~4월 예외/직종별 평균수당까지 완성한 공식 기준소득월액이 아닙니다.',
      '재분배 비교 전체 평균 A는 595만원 고시를 퇴직 전 3년 평균의 대리 가정으로 고정합니다. 실제 퇴직 전 3년 평균·물가/보수 환산 자료가 아닙니다. 2010~2015 상한 1.8배·2016 이후 1.6배도 같은 가정 A를 사용합니다.',
      `소득 민감도 ${s.percent}% · 이행률 ${k}% (2010년 이후 신규자 표,33년 초과는33년 기준) · 재분배 적용 ${redistribution}%. 민감도 세 값은 법정·통계 최저/최고나 실제 개인 지급범위가 아닙니다.`,
      '미래 공무원 보수인상률도 연3%로 가정해 정상 개시연도까지 재평가했습니다. 최초 지급대상월·입금일 및 이후 연금 물가조정은 별개입니다.');
    nominal.sources=[...nominal.sources,...teacherPaySources,...wholeIncomeSources];
    nominal.notes=nominal.notes.filter(n=>!n.includes('대리 가정'));
    nominal.notes.push(whole.note);
    nominal.notes.push(...limitations);
    const variables:PensionVariable[]=[
      {label:'개인 평균소득 B (2026 보수수준)',value:income,unit:'원/월',state:'사용자 지정 가정값',basis:'2026 표 기반 호봉 역산·표준 수당·90/100/110% 민감도. 실제 과거 봉급표·법정 재평가·직종별 평균 수당 미확인'},
      {label:'개인 평균소득 B (개시연도)',value:nominalIncome,unit:'원/월',state:'사용자 지정 가정값',basis:'2026 보수수준 B를 미래 보수 연3% 가정으로 환산·A와 같은 기준에서 비교'},
      {label:'공무원 전체 평균 A (개시연도)',value:whole.startWon,unit:'원/월',state:'공식 통계에 근거한 추정값',basis:whole.note},
      {label:'소득재분배 평균소득 (개시연도)',value:nominalRedistributed,unit:'원/월',state:'사용자 지정 가정값',basis:'가정 B/A와 법률13387호 부칙9조2항 구간표·원 미만 최종 절사'},
      {label:'재직기간별 적용비율',value:k,unit:'%',state:'공식 확인값',basis:'시행령 부칙10조10항 신규자 표·개인 재직기간은 연속경력 가정'},
      {label:'인정 재직기간',value:base.months,unit:'개월',state:'사용자 지정 가정값',basis:'임용월부터 퇴직 전일까지·법정 상한·군복무 및 복잡 경력 미반영'},
      {label:'과거 실제 소득·공식 재평가계수',value:null,unit:'',state:'미확인·계산 불가',basis:'2026 보수수준 대체 경로로 참고 시뮬레이션만 제공'},
    ];
    return {...s,variables,averageIncome2026Won:income,redistributionPercent:redistribution,factorPercent:k,basis2026Won:basis.amountWon,estimate:nominal};
  }):[];
  // Stable reason codes identify blockers without logging dates, income or raw inputs.
  const errorCodes = [
    ...(pay.errors.length?['PAY_MODEL_UNAVAILABLE']:[]),
    ...(pay.historyErrors.length?['PAY_HISTORY_UNRECONSTRUCTABLE']:[]),
    ...(p.appointmentDate<'2010-01-01'?['PRE_2010_INCOME_REQUIRED']:[]),
    ...(v.complexCareer?['COMPLEX_CAREER_UNSUPPORTED']:[]),
    ...(!base.normalStartDate||base.months===null||base.months<120||base.capMonths===null?['PENSION_TIMING_OR_SERVICE_UNAVAILABLE']:[]),
    ...(eligible&&whole.errors.length?['WHOLE_INCOME_ASSUMPTION_UNAVAILABLE']:[]),
  ];
  return {eligible,rows,errorCodes,excludesMilitary,limitations,errors:[...new Set(errors)],averageIncome2026Won:average,assumedWholeIncomeWon:assumedWholeIncome,
    wholeIncome:whole, selected:rows.find(r=>r.id==='base')?.estimate??null};
}
