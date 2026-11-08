import data from '../fixtures/synthetic-teachers-100.json' with { type:'json' };
import { createSimpleInputs } from '../../src/lib/simple/model.ts';
import { createPensionEstimateInput } from '../../src/lib/simple/pension-types.ts';
import { createAccountReceiptInput } from '../../src/lib/simple/account-receipt.ts';
export const syntheticCases=data.cases;
export const basisDate=data.basisDate;
export function expectedNormalDate(birth){const y=Number(birth.slice(0,4))+62,m=Number(birth.slice(5,7));if(m>=3&&m<=8)return `${y}-08-31`;const year=y+(m>=9?1:0);return `${year}-02-${new Date(Date.UTC(year,2,0)).getUTCDate()}`;}
export function buildSyntheticInput(c){
 const f=createSimpleInputs();Object.assign(f.profile,c.profile);
 if(c.profile.scheme==='national')Object.assign(f.profile,{manualNormal:true,normalDate:expectedNormalDate(c.profile.birthDate)});
 for(const key of ['ktcu','irp','saving']){
  const a=c[key],known=a.state!=='missing',member=a.state==='member';
  Object.assign(f[key],{balance:known?(member?a.balanceWon:'0'):'',monthly:known?(member?a.monthlyWon:'0'):'',cycle:a.cycle??'monthly',annual:known?(member?a.annualWon??'0':'0'):''});
  if(key!=='ktcu'&&c.receiptKnown&&member)f[key].receipt={...createAccountReceiptInput(),openedDate:'2025-01-01'};
 }
 Object.assign(f.ktcu,{split:c.ktcu.split,years:String(c.ktcu.years)});f.reinvest=c.reinvest;f.monthlyLivingCost=c.monthlyLivingCostWon;
 const date=f.profile.retirement==='early'?f.profile.earlyDate:expectedNormalDate(f.profile.birthDate),q=f.benefits[f.profile.scheme];
 q.income=c.allowanceIncomeWon;
 q.pensionEstimate={...createPensionEstimateInput(),complexCareer:c.complexCareer};
 if(c.pensionPath==='confirmed-input')Object.assign(q.pensionEstimate,{averageIncome:'4500000',legacyIncome:'3000000',redistributedIncome:'4600000',factorPercent:'90',confirmedRetirementDate:date,confirmedAppointmentDate:f.profile.appointmentDate,nationalStartMonth:f.profile.appointmentDate.slice(0,7)});
 if(c.pensionPath==='quote')Object.assign(q.pension,{money:{amount:'1234567',unit:'won'},taxBasis:c.id.endsWith('8')?'net':'gross',source:'official',queryDate:basisDate,retirementDate:date,startDate:f.profile.scheme==='national'?`${Number(date.slice(0,4))-1}-01-01`:`${Number(date.slice(0,4))+3}-01-01`});
 if(c.recognizedAllowanceReduction){
  const last=new Date(Date.parse(date+'T00:00:00Z')-86400000),start=new Date(f.profile.appointmentDate+'T00:00:00Z');
  q.recognizedMonths=String((last.getUTCFullYear()-start.getUTCFullYear())*12+last.getUTCMonth()-start.getUTCMonth()+1-c.recognizedAllowanceReduction);q.recognizedDate=date;q.recognizedAppointment=f.profile.appointmentDate;
 }
 return f;
}
