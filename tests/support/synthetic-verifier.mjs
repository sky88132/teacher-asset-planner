import assert from 'node:assert/strict';
import {calculateSimple} from '../../src/lib/simple/calculation.ts';
import {validateSimpleProfile} from '../../src/lib/simple/validation.ts';
import {calculateRetirementAnalysis} from '../../src/lib/simple/retirement-analysis.ts';
import {generateSimplePrompt} from '../../src/lib/simple/prompt.ts';
import {createPromptWorkspace} from '../../src/lib/ai/prompt-input.ts';
import {privacyFindings} from '../../src/lib/ai/prompt-privacy.ts';
import {manwonToWon,wonToManwon,formatWonAsKoreanCurrency} from '../../src/lib/simple/currency.ts';
import {basisDate,buildSyntheticInput,expectedNormalDate} from './synthetic-inputs.mjs';
import {futureStep,independentAccount,independentKtcu,independentReinvest,plannedDeposits,daysBetween,futureSalary,manwonReference,salary2026Reference} from './synthetic-reference.mjs';
const roundedTolerance=(actual,expected,n=0)=>{assert.ok(Math.abs(actual-expected)<=Math.max(1,n+1),`arithmetic mismatch: ${actual} vs ${expected}`);};
function finiteTree(value,path='result'){if(typeof value==='number')assert.ok(Number.isFinite(value),`${path} is not finite`);else if(value&&typeof value==='object')for(const [key,x] of Object.entries(value))finiteTree(x,path+'.'+key);}
export function verifySyntheticCase(c){
 const f=buildSyntheticInput(c),before=structuredClone(f),birth=Date.parse(f.profile.birthDate+'T00:00:00Z'),app=Date.parse(f.profile.appointmentDate+'T00:00:00Z');
 assert.equal(c.synthetic,true);assert.ok(app>birth);assert.ok(Number(f.profile.appointmentDate.slice(0,4))-Number(f.profile.birthDate.slice(0,4))>=22);assert.ok(f.profile.appointmentDate<=basisDate);
 assert.deepEqual(validateSimpleProfile(f.profile,basisDate),[]);
 const normal=expectedNormalDate(f.profile.birthDate),date=f.profile.retirement==='early'?f.profile.earlyDate:normal;
 if(f.profile.retirement==='early'){const age=Number(date.slice(0,4))-Number(f.profile.birthDate.slice(0,4))-(date.slice(5)<f.profile.birthDate.slice(5)?1:0);assert.ok(age>=45&&age<=60);assert.ok(date<normal);}
 const r=calculateSimple(f,basisDate);finiteTree(r);assert.deepEqual(f,before);assert.equal(r.retirement.date,date);assert.equal(r.retirement.normal,normal);assert.equal(r.step,futureStep(f.profile,date,basisDate));
 const pending={};const independentlyReinvested=f.reinvest?independentReinvest(f.irp,f.saving,basisDate,date):null;
 for(const [key,rate] of [['irp',7],['saving',8]]){
  const extra=key==='irp'&&independentlyReinvested?independentlyReinvested.extra:[];
  const ref=independentAccount(f[key],basisDate,date,rate,extra);
  if(ref===null){assert.equal(r[key].amountWon,null);assert.ok(r[key].errors.length);}else{
   assert.notEqual(r[key].amountWon,null,`${key} unexpectedly blocked ${r[key].errors}`);assert.ok(r[key].amountWon>=0);roundedTolerance(r[key].amountWon,ref.amountWon,ref.transactions);assert.equal(r[key].deposits,ref.deposits);assert.equal(r[key].initial+r[key].deposits+r[key].gain,r[key].amountWon);assert.equal(r[key].initialFuture+r[key].depositsFuture,r[key].amountWon);
   pending[key]=Math.abs(r[key].amountWon-ref.amountWon);
   const source=f[key].cycle==='yearly'?f[key].annual:f[key].monthly;if(source!=='')assert.equal(manwonToWon(wonToManwon(source)).valueWon,manwonReference(wonToManwon(source)));
  }
 }
 if(independentlyReinvested){assert.deepEqual(r.reinvestments,independentlyReinvested.extra);assert.deepEqual(r.taxCredits,independentlyReinvested.credits);assert.equal(r.irp.deposits,plannedDeposits(f.irp,basisDate,date).reduce((s,x)=>s+x.won,0)+r.reinvestments.reduce((s,x)=>s+x.won,0));}
 const ktcu=independentKtcu(f.ktcu,basisDate,date);if(ktcu===null)assert.equal(r.ktcu.amountWon,null);else{assert.equal(r.ktcu.amountWon,ktcu.amountWon);assert.equal(r.ktcu.deposits,ktcu.deposits);assert.equal(r.ktcu.initial+r.ktcu.deposits+r.ktcu.gain,r.ktcu.amountWon);}
 for(const keys of [['irp','saving'],['ktcu','irp','saving']]){const actual=keys.length===2?r.accountsTotal:r.accumulationTotal;assert.equal(actual,keys.every(k=>r[k].amountWon!==null)?keys.reduce((s,k)=>s+r[k].amountWon,0):null);}
 if(r.split){assert.equal(r.split.rows.length,Number(f.ktcu.years)*12);assert.equal(r.split.rows.reduce((s,x)=>s+x.paymentWon,0),r.split.totalWon);assert.equal(r.split.rows.at(-1).balanceWon,0);assert.ok(r.split.rows.every(x=>x.balanceWon>=0&&x.date.endsWith('-25')));}
 if(c.profile.scheme!=='civil')assert.equal(r.teacherPension.rows.length,0);
 if(c.profile.scheme==='national'){assert.equal(r.honorary.amountWon,null);assert.equal(r.allowance.amountWon,null);}
 for(const key of ['pension','allowance','honorary']){if(r[key].amountWon===null)assert.ok(r[key].errors.length,`${key} missing reason`);else assert.ok(Number.isSafeInteger(r[key].amountWon)&&r[key].amountWon>=0);}
 for(const row of r.teacherBenefits.rows){assert.equal(row.combinedWon,f.profile.retirement==='early'&&row.honoraryWon!==null&&row.allowanceWon!==null?row.allowanceWon+row.honoraryWon:null);}
 for(const row of r.allowanceReference.rows){assert.equal(row.combinedWon,row.amountWon!==null&&r.honorary.amountWon!==null?row.amountWon+r.honorary.amountWon:null);}
 for(const y of r.teacherPay.rows){assert.equal(y.homeroomWon,y.months*200000);assert.equal(y.teachingWon,y.months*250000);assert.equal(y.mealWon,y.months*160000);assert.equal(y.grossWon,y.taxableWon+y.mealWon);if(y.year>2026)assert.equal(y.salaryWon,futureSalary(f.profile,y.year,basisDate,new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10)));}
 if(r.teacherPay.finalSalaryWon!==null){let salary=salary2026Reference[r.step-1];for(let y=2027;y<=Number(date.slice(0,4));y++)salary*=1.03;assert.equal(r.teacherPay.finalSalaryWon,Math.round(salary));}
 const a=calculateRetirementAnalysis(f,r);finiteTree(a);assert.equal(a.accumulationWon,r.accumulationTotal);assert.equal(a.pensionWon,r.pension.amountWon);assert.equal(a.accountWithdrawalSchedule,null);
 if(r.pensionStartDate)assert.equal(a.gapDays,Math.max(0,daysBetween(date,r.pensionStartDate)));
 for(const w of a.windows){if(a.expenseWon===null||w.subtotalWon===null)assert.equal(w.differenceWon,null);else assert.equal(w.differenceWon,w.subtotalWon-a.expenseWon);}
 const settings={...createPromptWorkspace().settings,detail:'detailed',money:'exact'};const prompt=generateSimplePrompt(f,settings,basisDate);assert.ok(prompt);assert.ok(!prompt.includes(f.profile.birthDate));assert.ok(!prompt.includes(f.profile.appointmentDate));assert.deepEqual(privacyFindings(prompt,settings),[]);
 for(const key of ['pension','ktcu','irp','saving'])if(r[key].amountWon!==null)assert.ok(prompt.includes(formatWonAsKoreanCurrency(r[key].amountWon)),`${key} result missing in prompt`);
 const moved=structuredClone(f);const nextYear=Number(date.slice(0,4))+1,month=Number(date.slice(5,7)),day=Math.min(Number(date.slice(8,10)),new Date(Date.UTC(nextYear,month,0)).getUTCDate());const changedDate=String(nextYear)+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');if(moved.profile.retirement==='early')moved.profile.earlyDate=changedDate;else{moved.profile.manualNormal=true;moved.profile.normalDate=changedDate;}
 const r2=calculateSimple(moved,basisDate);assert.ok(r2.retirement.date);assert.notEqual(r2.retirement.date,date);for(const key of ['irp','saving','ktcu']){if(r2[key].amountWon!==null){assert.equal(r2[key].date,r2.retirement.date);if(r[key].amountWon>0)assert.ok(r2[key].amountWon>=r[key].amountWon);}}
 if(c.pensionPath==='quote')assert.equal(r2.pension.amountWon,null);assert.deepEqual(f,before);
 return {id:c.id,status:'pass',scheme:f.profile.scheme,retirement:f.profile.retirement,pensionSource:r.pensionSource,pensionAvailable:r.pension.amountWon!==null,allowanceAvailable:r.allowance.amountWon!==null,honoraryAvailable:r.honorary.amountWon!==null,teacherPensionAvailable:r.teacherPension.rows.length>0,teacherBenefitAvailable:r.teacherBenefits.rows.length>0,referenceBenefitAvailable:r.allowanceReference.rows.some(x=>x.amountWon!==null),ktcuAvailable:r.ktcu.amountWon!==null,irpAvailable:r.irp.amountWon!==null,savingAvailable:r.saving.amountWon!==null,driftWon:pending,externalPayoutValidation:'not-verified'};
}
