import test from 'node:test';
import assert from 'node:assert/strict';
import { manwonToWon, wonToManwon, formatWonAsKoreanCurrency, groupManwon } from '../src/lib/simple/currency.ts';
import { calculateSimple } from '../src/lib/simple/calculation.ts';
import { createSimpleInputs } from '../src/lib/simple/model.ts';
import { generateSimplePrompt } from '../src/lib/simple/prompt.ts';
import { createPromptWorkspace } from '../src/lib/ai/prompt-input.ts';
import { changeMoneyUnit } from '../src/lib/finance/pension-input-validation.ts';
const today='2026-11-08';
function fixture(){const f=createSimpleInputs();Object.assign(f.profile,{birthDate:'1980-05-10',appointmentDate:'2005-03-01',step:'22',promotionMonth:'3',manualNormal:true,normalDate:'2030-11-08'});return f;}
for(const [label,manwon,won] of [['A 공제회 잔액','3000',30000000],['B 공제회 월납입','30',300000],['C IRP 잔액','5000',50000000],['D IRP 월납입','50',500000],['E 연금저축 잔액','2000',20000000],['F 월연금','450',4500000]]){
  test(label+' 만원 입력을 원으로 정확히 변환',()=>{assert.equal(manwonToWon(manwon).valueWon,String(won));assert.equal(wonToManwon(String(won)),manwon);});
}
test('빈 값·0·소수·1원·만원/억원 경계·쉼표와 안전범위',()=>{
  for(const [raw,expected] of [['',''],['0','0'],['0.5','5000'],['0.0001','1'],['1','10000'],['9999','99990000'],['10000','100000000'],['3,000','30000000'],['900719925474.0991',String(Number.MAX_SAFE_INTEGER)]])assert.equal(manwonToWon(raw).valueWon,expected);
  for(const raw of ['-1','abc','1e3','1.00001','900719925474.0992','999999999999999999999','1,00'])assert.ok(manwonToWon(raw).error);
  assert.equal(groupManwon('3000.0001'),'3,000.0001');
  assert.equal(formatWonAsKoreanCurrency(null),'미입력 또는 계산 불가');
  for(const [n,text] of [[0,'0만원'],[30000000,'3,000만원'],[150000000,'1억 5,000만원'],[300000000,'3억원'],[4500000,'450만원'],[1,'0.0001만원'],[-5000,'-0.5만원']])assert.equal(formatWonAsKoreanCurrency(n),text);
});
test('기존 원 및 만원 조회값은 표시만 변환하고 중복 환산하지 않는다',()=>{
  const legacy={amount:'450',unit:'manwon'};assert.equal(wonToManwon(changeMoneyUnit(legacy,'won').amount),'450');assert.deepEqual(legacy,{amount:'450',unit:'manwon'});
  assert.equal(wonToManwon('4500000'),'450');assert.equal(manwonToWon(wonToManwon('1234567')).valueWon,'1234567');
});
test('화면 단위 변경 전후 공제회·IRP·연금저축 복리 결과가 완전히 동일하다',()=>{
  const old=fixture();Object.assign(old.ktcu,{balance:'30000000',monthly:'300000'});Object.assign(old.irp,{balance:'50000000',monthly:'500000'});Object.assign(old.saving,{balance:'20000000',monthly:'200000'});
  const next=structuredClone(old);for(const key of ['ktcu','irp','saving'])for(const field of ['balance','monthly'])next[key][field]=manwonToWon(wonToManwon(old[key][field])).valueWon;
  assert.deepEqual(calculateSimple(next,today),calculateSimple(old,today));
});
test('450만원 월연금은 AI 요청문에 4,500,000원으로 전달하며 적립금과 합산하지 않는다',()=>{
  const f=fixture();const q=f.benefits.civil.pension;Object.assign(q,{money:{amount:manwonToWon('450').valueWon,unit:'won'},retirementDate:f.profile.normalDate,queryDate:today,startDate:'2035-01-01',source:'official',taxBasis:'gross'});
  assert.equal(calculateSimple(f,today).pension.amountWon,4500000);
  const text=generateSimplePrompt(f,{...createPromptWorkspace().settings,money:'exact'},today);assert.match(text,/4,500,000원/);assert.doesNotMatch(text,/45,000,000,000원/);assert.equal(calculateSimple(f,today).accumulationTotal,null);
});
test('경계 수정 1: 1개월 월200만원을 연환산하지 않고 실제 1회 납입으로 계산',()=>{
  const f=fixture();f.profile.normalDate='2026-12-08';Object.assign(f.irp,{balance:'0',monthly:manwonToWon('200').valueWon});Object.assign(f.saving,{balance:'0',monthly:'0'});
  const r=calculateSimple(f,today);assert.equal(r.irp.amountWon,Math.round(2000000*1.07**(8/365)));assert.equal(r.irp.deposits,2000000);
});
test('경계 수정 2: 공식 국민연금 개시일이 퇴직일보다 빨라도 표시',()=>{
  const f=fixture();Object.assign(f.profile,{scheme:'national',birthDate:'1960-05-10',appointmentDate:'1990-03-01',normalDate:'2027-02-28'});
  Object.assign(f.benefits.national.pension,{money:{amount:manwonToWon('100').valueWon,unit:'won'},queryDate:today,retirementDate:'2027-02-28',startDate:'2025-05-10',source:'official',taxBasis:'gross'});
  const r=calculateSimple(f,today);assert.equal(r.pension.amountWon,1000000);assert.equal(r.pension.confidence,'공식 조회값');
});
