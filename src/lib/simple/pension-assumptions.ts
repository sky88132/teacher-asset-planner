/** Planning inputs, not agency-certified income or revaluation coefficients. */
export type VariableState = '공식 확인값' | '공식 통계에 근거한 추정값' | '사용자 지정 가정값' | '미확인·계산 불가';
export type PensionVariable = { label: string; state: VariableState; value: number | null; unit: string; basis: string };
export const wholeIncomeSources = [
  {title:'2026 전체 공무원 평균 595만원 · 2026.5~2027.4 적용',url:'https://www.geps.or.kr/notiCommunication_notice_center/41683?curPage=1'},
  {title:'2025 전체 공무원 평균 571만원 · 2025.5~2026.4 적용',url:'https://www.geps.or.kr/notiCommunication_notice_center/38247?curPage=23'},
  {title:'공무원연금법 시행령 제10·26조',url:'https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=290325&efYd=20261002'},
] as const;
export const wholeIncome2026 = 5950000;
export function projectWholeIncome(retirementYear: number, startYear: number, inflationRaw = '0') {
  const errors: string[] = [];
  const inflation = /^\d+(?:\.\d{1,4})?$/.test(inflationRaw) ? Number(inflationRaw) : NaN;
  if (!Number.isFinite(inflation) || inflation > 20) errors.push('미래 물가 가정은 0~20%의 숫자로 입력해 주세요. 공식 예측 범위가 아닌 입력 지원 범위입니다.');
  if (!Number.isInteger(retirementYear) || !Number.isInteger(startYear) || startYear < retirementYear || retirementYear < 2029 || startYear > 2200)
    errors.push('퇴직 전 3년 평균의 과거 고시액·실제 물가 환산 자료가 부족합니다. 이 자동 경로는 2029년 이후 퇴직의 미래 물가 가정만 지원합니다.');
  const years = errors.length ? [] : [retirementYear-3,retirementYear-2,retirementYear-1].map(year=>{
    const nominalWon = wholeIncome2026 * 1.03 ** (year-2026);
    const adjustedWon = nominalWon * (1+inflation/100) ** (retirementYear-1-year);
    return {year,nominalWon,adjustedWon,state:year===2026?'공식 확인값' as const:'공식 통계에 근거한 추정값' as const};
  });
  // The preceding-year price basis is carried to pension start using assumed future pay growth.
  // Only the final input to whole-won pension arithmetic is rounded.
  const precedingYearWon = years.length ? years.reduce((s,y)=>s+y.adjustedWon,0)/3 : null;
  const startWon = precedingYearWon===null ? null : Math.round(precedingYearWon * 1.03 ** (startYear-(retirementYear-1)));
  const basis2026Won = startWon===null ? null : Math.round(startWon / 1.03 ** (startYear-2026));
  return {years,precedingYearWon,startWon,basis2026Won,inflation:Number.isFinite(inflation)?inflation:null,errors,
    note:`퇴직 전 3개 연도 평균 · 2026 고시 595만원에서 전체 평균 연3% 증가 · 미래 물가 연${Number.isFinite(inflation)?inflation:"미확인"}% 사용자 가정(기본0%, 물가 고정) · 개시까지 보수 연3% 환산. 실제 고시·물가·재평가계수가 아니며 5월 적용·개인별 소득 산정의 정밀 계산은 미반영.`};
}
