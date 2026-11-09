import type { SimpleInputs } from './model.ts';
import type { SimpleAmount } from './calculation.ts';
import type { estimateTeacherBenefits } from './teacher-benefits.ts';
import type { estimateAllowanceReference } from './allowance-reference.ts';
/** One presentation result for 04, 05 and 06; legacy fixed-price calculations remain comparison data. */
export function selectBenefitSummary(input: SimpleInputs, teacher: ReturnType<typeof estimateTeacherBenefits>, legacy: ReturnType<typeof estimateAllowanceReference>, allowance: SimpleAmount, honorary: SimpleAmount) {
  const early=input.profile.retirement==='early', nominal=teacher.rows.length>0;
  const rows=nominal?teacher.rows.map(s=>({...s,amountWon:s.allowanceWon})):legacy.rows.map((s,i)=>({...s,id:legacy.actual?'base':i===0?'low':i===1?'base':'high',allowanceWon:s.amountWon,honoraryWon:honorary.amountWon}));
  const selected=rows.find(s=>s.id==='base')??null;
  const priceYear=nominal?teacher.priceYear:2026;
  const confidence=`조건부 추정값 · ${priceYear}년 ${nominal?'미래 명목·교원 표준 보수 가정':'소득 수준 고정 가정'} · 세전 · 지급 미확정`;
  const asAmount=(original:SimpleAmount,amountWon:number|null):SimpleAmount=>({...original,amountWon,confidence,errors:amountWon===null?original.errors:[]});
  const selectedAllowance=selected?asAmount(allowance,selected.allowanceWon):allowance;
  const selectedHonorary=nominal?asAmount(honorary,teacher.honorary?.amountWon??null):honorary;
  return {rows,selected,nominal,priceYear,confidence,early,
    allowance:selectedAllowance,honorary:selectedHonorary,
    totalWon:early?selected?.combinedWon??null:selectedAllowance.amountWon,
    source:nominal?'교원 표준 보수 미래 명목':legacy.actual?'입력 소득 기준':'전체 공무원 통계 비교 가정'};
}
