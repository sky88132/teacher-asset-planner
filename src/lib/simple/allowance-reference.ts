import type { SimpleProfile, SimpleBenefits } from './model.ts';
import { estimateAllowance, allowanceRate, allowanceAmount, serviceCalendarMonths } from './benefit-estimates.ts';
import { moneyWon } from './validation.ts';
export const allowanceReferenceSources = [
  { title:'공무원연금공단 구간별 퇴직수당 산식', url:'https://www.geps.or.kr/bizInformation_pensionBiz_retirementBenefit_salaryType' },
  { title:'2026 전체 공무원 기준소득월액 평균 고시', url:'https://www.law.go.kr/admRulInfoP.do?admRulSeq=2100000278474' },
  { title:'공단 고시금액 공지', url:'https://www.geps.or.kr/notiCommunication_notice_center/41683?curPage=12' },
];
export function estimateAllowanceReference(p: SimpleProfile, q: SimpleBenefits, date: string | null, honoraryWon: number | null) {
  const errors:string[]=[], actual=(q.income??'')!=='';
  const calendar=date?serviceCalendarMonths(p.appointmentDate,date):null;
  const total=calendar===null?null:Math.min(calendar,396), rate=total===null?null:allowanceRate(total);
  const oldCalendar=p.appointmentDate<'2010-01-01'&&date?serviceCalendarMonths(p.appointmentDate,date<'2010-01-01'?date:'2010-01-01')??0:0;
  const oldMonths=total===null?0:Math.min(oldCalendar,total), newMonths=total===null?0:total-oldMonths;
  const oldRate=total===null||total<12?null:total<60?.10:total<120?.35:total<180?.45:total<240?.50:.60;
  if(p.scheme==='national')errors.push('국민연금 가입자에게 공무원·사학 퇴직수당 산식을 적용하지 않습니다.');
  if(!date||total===null||rate===null)errors.push('기본정보·퇴직일·1년 이상 인정기간을 확인해 주세요.');
  if(!actual&&p.scheme==='private-school')errors.push('595만원은 전체 공무원 평균입니다. 사학 개인 소득의 통계 근거로 자동 사용하지 않으므로 해당 공단 확인 소득이 필요합니다.');
  if(oldMonths&&p.scheme==='private-school')errors.push('사학 구기간 현가화·경과규정의 금액 검증이 남아 전체 시나리오를 지원하지 않습니다.');
  if(oldMonths&&p.appointmentDate<'1991-10-01')errors.push('1991년 이전 경력의 종전 급여 보장 등 경과규정 확인이 필요하여 구기간 전체액을 계산하지 않습니다.');
  if(oldMonths&&q.recognizedMonths&&Number(q.recognizedMonths)!==calendar)errors.push('인정기간 감축이 있으면 2009년 이전/이후의 공단 확인 기간 배분이 필요합니다. 연속 재직으로 자동 배분하지 않습니다.');
  if(oldMonths&&q.recognizedMonths&&(q.recognizedDate!==date||q.recognizedAppointment&&q.recognizedAppointment!==p.appointmentDate))errors.push('인정기간의 임용일·퇴직일을 다시 확인해 주세요.');
  const legacy=moneyWon(q.legacyAllowanceIncome??'');
  const legacyConfirmed=!!date&&q.legacyAllowanceDate===date&&q.legacyAllowanceAppointment===p.appointmentDate;
  const oldReady=!oldMonths||legacy.won!==null&&!legacy.error&&legacy.won>0&&legacyConfirmed;
  const oldReason=oldReady?'':'2009년 이전분은 공단 확인 최종보수월액 현가액(2026년 기준)과 현재 임용일·퇴직일 확인이 필요합니다. 595만원으로 대체하지 않습니다.';
  const assumptions=actual?[{label:'입력 소득 기반',income:moneyWon(q.income!).won,multiplier:null}]:[
    {label:'보수적 시나리오',income:4760000,multiplier:80}, {label:'기준 시나리오',income:5950000,multiplier:100}, {label:'높은 소득 시나리오',income:7140000,multiplier:120},
  ];
  const rows=errors.length?[]:assumptions.map(s=>{
    const base=estimateAllowance(p,{...q,income:String(s.income??'')},date);
    const rowErrors=oldMonths?[]:[...base.errors];
    if(s.income===null||s.income<=0)rowErrors.push('유효한 기준소득월액이 필요합니다.');
    const months=oldMonths?total!:base.months;
    const rowRate=oldMonths?rate:base.rate;
    const postWon=months!==null&&rowRate!==null&&s.income!==null&&s.income>0?allowanceAmount(s.income,oldMonths?newMonths:months,rowRate):null;
    const oldWon=oldMonths&&oldReady&&oldRate!==null?allowanceAmount(legacy.won!,oldMonths,oldRate):oldMonths?null:0;
    const sum=oldWon!==null&&postWon!==null?BigInt(oldWon)+BigInt(postWon):null;
    const amountWon=rowErrors.length||sum===null||sum>BigInt(Number.MAX_SAFE_INTEGER)?null:Number(sum);
    const combined=amountWon!==null&&honoraryWon!==null?BigInt(amountWon)+BigInt(honoraryWon):null;
    return {...s,months,rate:rowRate,oldMonths,newMonths:oldMonths?newMonths:months,oldRate,oldWon,postWon,amountWon,
      combinedWon:combined!==null&&combined<=BigInt(Number.MAX_SAFE_INTEGER)?Number(combined):null,errors:rowErrors};
  });
  return {actual,rows,errors,oldReason,oldMonths,newMonths,total,appointmentDate:p.appointmentDate,priceYear:2026,
    notes:'2026년 소득 수준 고정 가정 · 세전 · 외부 금액 검증 미완료. 80%/100%/120%는 앱의 비교용 소득 가정이며 법정·통계상 개인 지급 범위가 아닙니다. 군복무·합산은 수당에 자동 가산하지 않고 휴직 등 감축·실제 소득·현가화·기수령·징계 감액은 기관 확인이 필요합니다.'};
}
