import { formatWonAsKoreanCurrency } from '../src/lib/simple/currency.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import scenarios from './fixtures/final-release-scenarios.json' with { type:'json' };
import { createSimpleInputs } from '../src/lib/simple/model.ts';
import { calculateSimple } from '../src/lib/simple/calculation.ts';
import { generateSimplePrompt, simpleAnalyses } from '../src/lib/simple/prompt.ts';
import { simplePromptContext } from '../src/lib/simple/prompt-context.ts';
import { createPensionEstimateInput } from '../src/lib/simple/pension-types.ts';
import { createAccountReceiptInput } from '../src/lib/simple/account-receipt.ts';
import { createPromptWorkspace } from '../src/lib/ai/prompt-input.ts';
import { privacyFindings } from '../src/lib/ai/prompt-privacy.ts';
const today='2026-11-08';
function fixture(s){
  const f=createSimpleInputs();Object.assign(f.profile,{birthDate:s.birth,appointmentDate:s.appointment,scheme:s.scheme,step:'30',promotionMonth:'3',military:'not',retirement:s.retirement,earlyDate:s.date??''});
  if(s.scheme==='national')Object.assign(f.profile,{manualNormal:true,normalDate:'2042-08-31'});
  if(s.funding==='all'||s.funding==='split')Object.assign(f.ktcu,{balance:'30000000',monthly:'100000',split:s.funding==='split',years:'10'});
  if(s.funding==='all'||s.funding==='irp')Object.assign(f.irp,{balance:'10000000',monthly:'200000',receipt:{...createAccountReceiptInput(),openedDate:'2020-05-10'}});
  if(s.funding==='all')Object.assign(f.saving,{balance:'5000000',monthly:'100000'});
  if(s.funding==='saving-yearly')Object.assign(f.saving,{balance:'5000000',cycle:'yearly',annual:'6000000',monthly:'999999'});
  f.monthlyLivingCost=s.living??'';
  const q=f.benefits[s.scheme];if(s.id==='C')q.income='4000000';
  if(s.pension==='auto'||s.pension==='national')q.pensionEstimate={...createPensionEstimateInput(),averageIncome:'4000000',redistributedIncome:'4000000',factorPercent:'100',nationalStartMonth:s.pension==='national'?'2010-01':'',confirmedRetirementDate:s.expectedDate,confirmedAppointmentDate:s.appointment};
  if(s.pension==='quote')Object.assign(q.pension,{money:{amount:'2000000',unit:'won'},source:'official',taxBasis:'gross',retirementDate:s.expectedDate,queryDate:today,startDate:'2045-05-01'});
  return f;
}
for(const s of scenarios)test(`최종 시나리오 ${s.id}: ${s.label} 결과·상태·기본 익명화·원 단위`,()=>{
  const f=fixture(s),r=calculateSimple(f,today),context=simplePromptContext(f,r);assert.equal(r.retirement.date,s.expectedDate);assert.equal(context.rows.find(x=>x.label==='IRP').amountWon,r.irp.amountWon);
  const settings={...createPromptWorkspace().settings,money:'exact'};const text=generateSimplePrompt(f,settings,today);assert.ok(text);assert.ok(!text.includes(s.birth));assert.ok(!text.includes(s.appointment));assert.deepEqual(privacyFindings(text,settings),[]);assert.match(text,/입력 상태·계산 신뢰도/);assert.match(text,/추가 검증 필요/);assert.match(text,/투자수익률·지급액을 보장하지/);
  if(['auto','national','quote'].includes(s.pension)){assert.ok(r.pension.amountWon>0);assert.ok(text.includes(formatWonAsKoreanCurrency(r.pension.amountWon)));}else if(s.id==='E'){assert.equal(r.pensionSource,'teacher-model');assert.ok(r.pension.amountWon>0);assert.match(r.pension.confidence,/가정 기반/);}else assert.equal(r.pension.amountWon,null);
  if(s.id==='B'){assert.match(text,/퇴직 호봉/);assert.ok(r.honorary.amountWon>0);}
  if(s.id==='E'){assert.equal(context.basicOnly,true);assert.match(text,/현재 경력 단계/);assert.equal(r.ktcu.amountWon,null);assert.equal(r.irp.amountWon,null);}
  if(s.id==='F'){assert.ok(r.irp.amountWon>0);assert.equal(r.saving.amountWon,null);assert.equal(r.accountsTotal,null);assert.match(text,/IRP 현재 적립금: \[사용자 입력값\] 1,000만원/);}
  if(s.id==='G'){assert.equal(r.split.rows.length,120);assert.equal(r.split.rows.at(-1).balanceWon,0);}
  if(s.id==='H'){assert.equal(r.saving.deposits,96000000);assert.match(text,/연 납입액 \(12월 말 연납\).*600만원/);assert.ok(!text.includes('999,999원'));}
  if(s.id==='I'){assert.equal(r.pensionStartDate,null);assert.equal(r.pensionGapMonths,null);assert.match(text,/1995년 이전/);}
  if(s.id==='J'){assert.match(text,/300만원/);assert.match(text,/실제 부족액·잉여액 아님/);assert.equal(context.rows[0].state,'공식 조회값');}
});
test('최종 분석 유형은 요청한6종·기본정보만으로 모두 생성',()=>{
  assert.deepEqual(Object.values(simpleAnalyses),['은퇴설계 종합 분석','명예퇴직·정년퇴직 관련 조언','공적연금 및 퇴직급여 분석','교직원공제회 수령 전략','IRP·연금저축 활용 전략','직접 질문 작성']);
  const f=fixture(scenarios[4]);for(const analysis of Object.keys(simpleAnalyses)){const text=generateSimplePrompt(f,{...createPromptWorkspace().settings,analysis},today);assert.ok(text);assert.match(text,/현재 경력 단계/);}
});
test('미입력·사용자입력·0원·불완전입력·가정 결과의 상태를 분리',()=>{
  const f=fixture(scenarios[4]);let x=simplePromptContext(f,calculateSimple(f,today)).rows.find(x=>x.label==='IRP');assert.equal(x.inputState,'미입력');assert.equal(x.state,'계산 불가');assert.equal(x.amountWon,null);
  f.irp.balance='0';x=simplePromptContext(f,calculateSimple(f,today)).rows.find(x=>x.label==='IRP');assert.equal(x.inputState,'사용자 입력값');assert.equal(x.state,'계산 불가');
  f.irp.monthly='0';x=simplePromptContext(f,calculateSimple(f,today)).rows.find(x=>x.label==='IRP');assert.equal(x.amountWon,0);assert.equal(x.state,'가정 기반 시뮬레이션');assert.match(generateSimplePrompt(f,{...createPromptWorkspace().settings,money:'exact'},today),/0만원/);
});
test('공식 조회·법령 추정·고정소득 가정·오래된 조회의 상태를 구분',()=>{
  const f=fixture(scenarios[2]);let r=calculateSimple(f,today);assert.equal(simplePromptContext(f,r).rows[0].state,'법령 기반 추정값');const v=f.benefits['private-school'].pensionEstimate;Object.assign(v,{incomeMode:'current',constantIncome:true,currentIncome:'4000000'});r=calculateSimple(f,today);assert.equal(simplePromptContext(f,r).rows[0].state,'가정 기반 시뮬레이션');
  const quoted=fixture(scenarios[9]);quoted.benefits.civil.pension.retirementDate='2031-01-01';const stale=simplePromptContext(quoted,calculateSimple(quoted,today)).rows[0];assert.equal(stale.state,'계산 불가');assert.equal(stale.amountWon,null);assert.match(stale.reasons.join(),/재확인/);
});
test('간단 분량에도 현재 잔액·활성 납입액·계산 결과를 연결하고 숨은 과거 주기는 제외',()=>{
  const f=fixture(scenarios[7]),text=generateSimplePrompt(f,{...createPromptWorkspace().settings,detail:'simple',money:'exact'},today);assert.match(text,/연금저축 현재 적립금: \[사용자 입력값\] 500만원/);assert.match(text,/600만원/);assert.ok(!text.includes('999,999원'));
});
test('퇴직일·승급월·납입주기·제도·생활비 변경시 요청문은 최신 공통 결과를 반영',()=>{
  const f=fixture(scenarios[0]),settings={...createPromptWorkspace().settings,money:'exact'};const before=generateSimplePrompt(f,settings,today);f.profile.retirement='early';f.profile.earlyDate='2030-11-08';f.profile.promotionMonth='12';f.saving.cycle='yearly';f.saving.annual='1200000';f.monthlyLivingCost='3333333';let after=generateSimplePrompt(f,settings,today);assert.notEqual(before,after);const r=calculateSimple(f,today);assert.ok(after.includes(formatWonAsKoreanCurrency(r.irp.amountWon)));assert.match(after,/12월 말 연납/);assert.match(after,/333만원/);
  f.profile.scheme='private-school';after=generateSimplePrompt(f,settings,today);assert.match(after,/사학연금/);assert.ok(!after.includes('가입 제도: 공무원연금'));
});
test('지원 밖 식별필드·질문 PII 제외·기본 금액 축약·원본 불변',()=>{
  const f=fixture(scenarios[0]);f.profile.name='홍길동';f.profile.school='비밀초등학교';f.irp.accountNumber='123456789012';f.benefits.civil.pension.assumptions='hidden@example.test';const copy=structuredClone(f),settings={...createPromptWorkspace().settings,question:'학교명: 비밀초등학교\n익명으로 유동성을 검토해 주세요.',questionReviewed:true};const text=generateSimplePrompt(f,settings,today);for(const value of ['홍길동','비밀초등학교','123456789012','hidden@example.test',f.profile.birthDate])if(value)assert.ok(!text.includes(value));assert.deepEqual(privacyFindings(text,settings),[]);assert.deepEqual(f,copy);assert.match(text,/질문 줄 제외/);
});
test('직접 조회값 우선 시 비활성 평균소득은 내보내지 않고 참고 산식임을 명시',()=>{
  const f=fixture(scenarios[9]);f.benefits.civil.pensionEstimate={...createPensionEstimateInput(),averageIncome:'1234567'};const settings={...createPromptWorkspace().settings,money:'exact'},text=generateSimplePrompt(f,settings,today);assert.match(text,/200만원/);assert.ok(!text.includes('1,234,567원'));assert.match(text,/해당 조회액의 산출 근거로 간주하지/);
  f.benefits.civil.pension.source='user-estimate';assert.equal(simplePromptContext(f,calculateSimple(f,today)).rows[0].state,'사용자 입력값');
});
test('금액 없이 수령 가입일만 입력해도 기초정보 전용으로 잘못 분류하지 않는다',()=>{
  const f=fixture(scenarios[4]);f.irp.receipt={...createAccountReceiptInput(),openedDate:'2020-05-10'};assert.equal(simplePromptContext(f,calculateSimple(f,today)).basicOnly,false);assert.equal(calculateSimple(f,today).irp.amountWon,null);
});
