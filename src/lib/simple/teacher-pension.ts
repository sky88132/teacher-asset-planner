import type { SimpleProfile } from './model.ts';
import { estimateCivilPension } from './occupational-pension.ts';
import type { PensionEstimate, PensionEstimateInput } from './pension-types.ts';
import { teacherPriceNote, teacherPaySources, salaryGrowth, type TeacherPayProjection } from './teacher-pay.ts';
import { moneyWon } from './validation.ts';

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
export function estimateTeacherPension(p: SimpleProfile, v: PensionEstimateInput, pay: TeacherPayProjection, base: PensionEstimate, date: string | null, today: string) {
  const errors = [...pay.errors, ...pay.historyErrors];
  // A context confirmation is not income data. It must not disable generated income.
  const hasIncome = !!(v.averageIncome || v.currentIncome || v.redistributedIncome || v.incomeMode !== 'average');
  const eligible = p.scheme === 'civil' && p.teacherModel !== false && !hasIncome;
  const hasLegacy = p.appointmentDate<'2010-01-01';
  if(hasLegacy && (!v.legacyIncome || !v.factorPercent)) errors.push('2009년 이전분의 2007~2009년 평균보수월액 현가액과 기존 재직자용 재직기간별 적용비율이 부족합니다. 현재 보수 모델은 과세 보수 기초만 추정하므로 구법 평균보수와 신규자용이 아닌 경과 비율을 대체할 수 없습니다. 공단 확인 자료를 상세 설정에 입력해 주세요.');
  if((v.legacyIncome || v.factorPercent) && (v.confirmedRetirementDate!==date || v.confirmedAppointmentDate!==p.appointmentDate)) errors.push('입력한 구기간 보수·적용비율을 현재 임용일·퇴직일 기준으로 다시 확인해 주세요. 확인 전에는 추정 모델과 결합하지 않습니다.');
  if(v.complexCareer)errors.push('휴직·중단·시간제·재임용 등 별도 이력은 표준 보수 경로에 적용하지 않습니다.');
  if(p.military==='approved')errors.push('군 산입 승인 경력은 공단 인정개월·산입연도·경과규정을 상세 설정에서 확인해 주세요. 표준 모델에 임의 가산하지 않습니다.');
  if(!base.normalStartDate||base.months===null||base.months<120||base.capMonths===null)errors.push('정상 개시일·10년 이상 인정기간을 확인해야 표준 월연금을 계산할 수 있습니다.');
  let remaining=base.capMonths??0, weighted=0n, months=0;
  const assumedWholeIncome=5950000; // A proxy for the 3-year whole-civil-service average, NOT personal income.
  for(const row of pay.rows){
    const m=Math.min(remaining,row.months);remaining-=m;
    if(row.year<2010||m===0)continue;
    const capped=Math.min(row.basis2026IncomeWon,Math.floor(assumedWholeIncome*(row.year<2016?1.8:1.6)));
    weighted+=BigInt(capped)*BigInt(m);months+=m;
  }
  const average=months?Number(weighted/BigInt(months)):null;
  const factorValue=v.factorPercent || (!hasLegacy && base.months!==null ? String(newEntrantFactor(base.months)??'') : '');
  const k=Number.isFinite(Number(factorValue))?Number(factorValue):null;
  const startYear=base.normalStartDate?Number(base.normalStartDate.slice(0,4)):null;
  const rows=eligible&&!errors.length&&average!==null&&factorValue!==''&&date&&startYear!==null?teacherIncomeSensitivities.map(s=>{
    const income=Math.min(Math.floor(average*s.percent/100),Math.floor(assumedWholeIncome*1.6));
    const redistribution=redistributionPercent(income,assumedWholeIncome)!;
    const redistributed=Number(BigInt(income)*BigInt(Math.round(redistribution*100))/10000n);
    const generated={...v, averageIncome:String(income), redistributedIncome:String(redistributed), factorPercent:factorValue,
      confirmedRetirementDate:date, confirmedAppointmentDate:p.appointmentDate};
    const basis=estimateCivilPension(p,generated,date,today);
    // The statutory revaluation direction is reused; future civil pay growth is a 3% planning assumption.
    const legacyWon=hasLegacy?moneyWon(v.legacyIncome).won:null;
    const nominal=estimateCivilPension(p,{...generated,legacyIncome:legacyWon!==null?String(Math.round(legacyWon*salaryGrowth(startYear))):v.legacyIncome,
      averageIncome:String(Math.round(income*salaryGrowth(startYear))),
      redistributedIncome:String(Math.round(redistributed*salaryGrowth(startYear)))},date,today);
    nominal.priceYear=startYear;nominal.method='교원 표준 보수 경로·법정 구간식 기반 가정 시뮬레이션 (개시연도 미래 명목)';
    nominal.confidence='가정 기반 시뮬레이션 · 표준 보수 일부 항목 · 세전 · 외부 금액 검증 미완료';
    nominal.notes=nominal.notes.filter(n=>!n.includes('2026년 가격 고정')&&!n.includes('01의 호봉'));
    nominal.notes.push(pay.assumptions,teacherPriceNote,
      '연도별 과거 실제 급여와 과거 법정 재평가계수는 확보하지 못해 2026 표 기준 역산 경로로 대체했습니다. 전년도 보수/5월 적용·1~4월 예외/직종별 평균수당까지 완성한 공식 기준소득월액이 아닙니다.',
      '재분배 비교 전체 평균 A는 595만원 고시를 퇴직 전 3년 평균의 대리 가정으로 고정합니다. 실제 퇴직 전 3년 평균·물가/보수 환산 자료가 아닙니다. 2010~2015 상한 1.8배·2016 이후 1.6배도 같은 가정 A를 사용합니다.',
      `소득 민감도 ${s.percent}% · 이행률 ${factorValue}% (${v.factorPercent?'현재 임용일·퇴직일 기준 사용자 확인 적용비율 · 기관 진위 미검증':'2010년 이후 신규자 표,33년 초과는33년 기준'}) · 재분배 적용 ${redistribution}%. 민감도 세 값은 법정·통계 최저/최고나 실제 개인 지급범위가 아닙니다.`,
      '미래 공무원 보수인상률도 연3%로 가정해 정상 개시연도까지 재평가했습니다. 최초 지급대상월·입금일 및 이후 연금 물가조정은 별개입니다.');
    nominal.sources=[...nominal.sources,...teacherPaySources];
    if(hasLegacy) nominal.notes.push('구기간은 사용자가 확인한 2026년 가격의 평균보수월액 현가액과 적용비율을 사용합니다. 구기간 보수는 세 시나리오에서 동일하게 유지하고 2010년 이후 소득 기초만 90/100/110% 변화시킵니다. 개시연도까지 연3% 환산은 계획 가정이며 법정 재평가를 검증한 값이 아닙니다.');
    return {...s,averageIncome2026Won:income,redistributionPercent:redistribution,factorPercent:k,basis2026Won:basis.amountWon,estimate:nominal};
  }):[];
  return {eligible,rows,errors:[...new Set([...errors,...rows.flatMap(s=>s.estimate.errors)])],averageIncome2026Won:average,assumedWholeIncomeWon:assumedWholeIncome,
    selected:rows.find(r=>r.id==='base'&&r.estimate.amountWon!==null&&r.basis2026Won!==null)?.estimate??null};
}
