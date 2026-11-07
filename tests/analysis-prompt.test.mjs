import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProfile } from '../src/lib/profile.ts';
import { createPensionInputs } from '../src/lib/finance/pension-input.ts';
import { createKtcuInput } from '../src/lib/finance/ktcu-input.ts';
import { createIrpInput } from '../src/lib/finance/irp-input.ts';
import { createRetirementComparisonInput } from '../src/lib/finance/retirement-comparison-input.ts';
import { createCashflowInput } from '../src/lib/finance/cashflow-input.ts';
import { analysisTypes, createPromptWorkspace, aiServices } from '../src/lib/ai/prompt-input.ts';
import { displayPromptMoney, privacyFindings, reviewedQuestion } from '../src/lib/ai/prompt-privacy.ts';
import { generateAnalysisPrompt, promptSourceKey } from '../src/lib/ai/prompt-generator.ts';
const today='2026-11-07';
function fixture() {
  return { profile:structuredClone(initialProfile),pensions:createPensionInputs(),ktcu:createKtcuInput(),irp:createIrpInput(),comparison:createRetirementComparisonInput(),cashflow:createCashflowInput() };
}
function populated() {
  const d=fixture();d.profile.birthDate='1980-01-01';d.profile.appointmentDate='2005-03-01';
  Object.assign(d.irp,{basis:'2026-01-01',retirement:'2030-01-01'});
  Object.assign(d.irp.irp,{balance:'12345678',annual:'1200000',rate:'0',fee:'0',stop:'2030-01-01',start:'2030-01-01',years:'10'});
  Object.assign(d.ktcu,{basisDate:'2026-01-01',stopDate:'2030-01-01',retirementDate:'2030-01-01',assumedRate:'0',balance:{amount:'3000000',unit:'won'},currentMonthly:{amount:'0',unit:'won'},futureMonthly:{amount:'0',unit:'won'}});
  d.comparison.normalMode='manual';d.comparison.scenarios.early.date='2028-01-01';d.comparison.scenarios.normal.date='2030-01-01';
  for(const key of ['early','normal']) {
    const s=d.comparison.scenarios[key];s.pensionSource='local';s.allowanceSource='local';
    for(const kind of ['pension','allowance','honorary']) Object.assign(s.quotes.civil[kind],{source:'official',money:{amount:kind==='pension'?'2345678':'3000000',unit:'won'},retirementDate:s.date,queryDate:today,startDate:'2045-01-01',taxBasis:'gross'});
  }
  Object.assign(d.cashflow,{living:'1000000',inflation:'0',finalAge:'70'});
  return d;
}
test('8개 분석 목적과 요청문 12개 절을 현재 데이터로 생성한다',()=>{
  for(const key of Object.keys(analysisTypes)) {
    const s={...createPromptWorkspace().settings,analysis:key,question:key==='custom'?'인출 시점의 위험을 분석해 주세요.':'',questionReviewed:true};
    const r=generateAnalysisPrompt(fixture(),s,today);
    assert.ok(r.text.includes(analysisTypes[key].title)); assert.ok(r.text.includes(analysisTypes[key].question));
    const headings=[...r.text.matchAll(/^(\d+)\. /gm)].map(m=>Number(m[1]));assert.deepEqual(headings,[1,2,3,4,5,6,7,8,9,10,11,12]);
  }
});
test('빈 데이터의 결과를 0원 금액으로 만들지 않는다',()=>{
  const r=generateAnalysisPrompt(fixture(),createPromptWorkspace().settings,today);
  assert.match(r.text,/계산 불가/);assert.doesNotMatch(r.text,/0원 \(계산값 또는 명시적 입력값\)/);
  assert.doesNotMatch(r.text,/2,345,678|12,345,678/);
});
test('실제 입력과 기존 엔진 결과·출처·누락을 함께 반영한다',()=>{
  const r=generateAnalysisPrompt(populated(),{...createPromptWorkspace().settings,money:'exact'},today);
  assert.match(r.text,/12,345,678원 \(사용자 입력\)/);assert.match(r.text,/17,145,678원/);
  assert.match(r.text,/2,345,678원 \/ 공식 조회값/);assert.match(r.text,/사용자가 직접 입력한 값/);
  assert.match(r.text,/확인된 원천만의 부분 결과/);assert.match(r.text,/명퇴 자격: 미확정/);
  assert.match(r.text,/조건부 추정값/);assert.match(r.text,/동일 연령의 완전한 비교 불가/);
});
test('기본 익명화는 생일·임용일·개별 날짜를 연령대로 바꾼다',()=>{
  const r=generateAnalysisPrompt(populated(),createPromptWorkspace().settings,today);
  for(const date of ['1980-01-01','2005-03-01','2028-01-01','2030-01-01','2045-01-01','2026-11-07']) assert.ok(!r.text.includes(date),date);
  assert.match(r.text,/40대/);assert.match(r.text,/약 21년/);assert.match(r.text,/45~49세|50~54세/);
});
test('익명화 OFF만으로 정확한 날짜를 허용하지 않는다',()=>{
  const d=populated(),s={...createPromptWorkspace().settings,anonymize:false};
  assert.ok(!generateAnalysisPrompt(d,s,today).text.includes(d.profile.birthDate));
  s.allowExactDates=true;const exact=generateAnalysisPrompt(d,s,today);assert.ok(exact.text.includes(d.profile.birthDate));assert.ok(exact.text.includes(d.profile.appointmentDate));
  s.anonymize=true;assert.ok(!generateAnalysisPrompt(d,s,today).text.includes(d.profile.birthDate));
});
test('원본의 알 수 없는 식별 필드·기존 자유 메모·부적합 숫자를 내보내지 않는다',()=>{
  const d=populated();Object.assign(d.profile,{name:'홍길동',schoolName:'가나다초등학교',email:'teacher@example.test',accountNumber:'123-456-789012'});
  d.comparison.scenarios.early.quotes.civil.pension.assumptions='홍길동 가나다초등학교 teacher@example.test 123-456-789012';
  d.pensions.civil.pension.assumptions='이름: 홍길동';d.irp.irp.annual='teacher@example.test';
  const r=generateAnalysisPrompt(d,createPromptWorkspace().settings,today);
  for(const raw of ['홍길동','가나다초등학교','teacher@example.test','123-456-789012']) assert.ok(!r.text.includes(raw));
});
test('금액 반올림·구간·명시적 0·음수·안전 정수 끝수를 정확히 표시한다',()=>{
  assert.equal(displayPromptMoney(null,'exact'),'계산 불가 · 금액 없음');
  assert.equal(displayPromptMoney(12345678,'round'),'약 12,300,000원 (10만 원 단위 반올림)');
  assert.equal(displayPromptMoney(1250000,'round'),'약 1,300,000원 (10만 원 단위 반올림)');
  assert.match(displayPromptMoney(12345678,'range'),/12,000,000원 이상~13,000,000원 미만/);
  assert.match(displayPromptMoney(1,'round'),/0원 초과/);assert.match(displayPromptMoney(-1,'round'),/0원 미만/);
  assert.match(displayPromptMoney(0,'round'),/^0원 \(계산값/);assert.match(displayPromptMoney(-1000001,'range'),/-2,000,000원 초과~-1,000,000원 이하/);
  assert.match(displayPromptMoney(Number.MAX_SAFE_INTEGER,'range'),/9,007,199,255,000,000/);
});
test('추가 질문은 명시 확인 전 제외하며 식별정보 줄을 제거한다',()=>{
  const s={...createPromptWorkspace().settings,question:'이름: 홍길동\nteacher@example.test\n123-456-789012\n1980-01-01\n물가 위험을 점검해 주세요.'};
  assert.equal(reviewedQuestion(s).omitted,true);assert.ok(!reviewedQuestion(s).text.includes('물가 위험'));
  s.questionReviewed=true;const r=generateAnalysisPrompt(fixture(),s,today);
  assert.match(r.text,/물가 위험/);for(const raw of ['홍길동','teacher@example.test','123-456-789012','1980-01-01']) assert.ok(!r.text.includes(raw));
  assert.equal(r.questionOmitted,true);assert.ok(r.questionFindings.length>0);
  assert.throws(()=>generateAnalysisPrompt(fixture(),{...s,analysis:'custom',questionReviewed:false},today),/질문/);
});
test('편집본의 개인정보 패턴과 외부 주소를 점검한다',()=>{
  const s=createPromptWorkspace().settings;
  for(const raw of ['teacher@example.test','010-1234-5678','800101-1234567','계좌번호: 123-456-789012','가나다초등학교','1980.1.1','1980년 1월 1일','https://unknown.example/path','https://chatgpt.com/?name=person']) assert.ok(privacyFindings(raw,s).length>0,raw);
  assert.equal(privacyFindings('https://chatgpt.com/ https://gemini.google.com/ https://claude.ai/',s).length,0);
  assert.equal(privacyFindings('1980-01-01',{anonymize:false,allowExactDates:true}).length,0);
});
test('다른 메뉴·옵션 변경을 감지하되 원본 데이터는 수정하지 않는다',()=>{
  const d=populated(),copy=structuredClone(d),s=createPromptWorkspace().settings,k=promptSourceKey(d,s,today);
  generateAnalysisPrompt(d,s,today);assert.deepEqual(d,copy);
  d.irp.irp.balance='20000000';assert.notEqual(promptSourceKey(d,s,today),k);
  assert.notEqual(promptSourceKey(copy,{...s,money:'exact'},today),k);
  assert.notEqual(promptSourceKey(copy,s,'2026-11-08'),k);
});
test('상세 모드는 연령별 원장과 소진 구분을 확장하며 간단 모드도 제한을 보존한다',()=>{
  const d=populated(),s=createPromptWorkspace().settings;
  const detailed=generateAnalysisPrompt(d,s,today).text,simple=generateAnalysisPrompt(d,{...s,detail:'simple'},today).text;
  assert.ok(detailed.length>simple.length);assert.match(detailed,/세 구간\(/);assert.match(simple,/세금/);assert.match(simple,/신뢰도/);assert.match(simple,/중복 합산/);
});
test('공식 사이트는 고정 주소이며 요청문이나 데이터 쿼리를 붙이지 않는다',()=>{
  assert.deepEqual(aiServices.map(s=>s.url),['https://chatgpt.com/','https://gemini.google.com/','https://claude.ai/']);
  for(const s of aiServices) assert.equal(new URL(s.url).search,'');
});
