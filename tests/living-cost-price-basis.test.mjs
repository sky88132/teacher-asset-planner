import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSimple } from '../src/lib/simple/calculation.ts';
import { calculateRetirementAnalysis } from '../src/lib/simple/retirement-analysis.ts';
import { createSimpleInputs } from '../src/lib/simple/model.ts';
import { generateSimplePrompt } from '../src/lib/simple/prompt.ts';
import { createPromptWorkspace } from '../src/lib/ai/prompt-input.ts';

const today = '2026-11-20';
function young() {
  const f = createSimpleInputs();
  Object.assign(f.profile, { birthDate: '1999-10-10', appointmentDate: '2024-03-01', step: '11', promotionMonth: '3', military: 'not' });
  f.monthlyLivingCost = '3000000';
  return f;
}

test('생활비 비교: 교원 모델의 개시연도 명목 월연금을 현재 물가 기준 생활비와 직접 빼지 않는다', () => {
  const f = young(), r = calculateSimple(f, today), a = calculateRetirementAnalysis(f, r);
  assert.equal(r.pensionSource, 'teacher-model');
  const base = r.teacherPension.rows.find(x => x.id === 'base');
  assert.ok(r.pension.amountWon > base.basis2026Won, 'headline pension is future nominal');
  const after = a.windows.find(w => w.phase === 'after');
  assert.equal(after.subtotalWon, r.pension.amountWon, 'displayed subtotal unchanged');
  assert.equal(after.expenseComparable, false);
  assert.equal(after.differenceWon, null);
  assert.equal(after.subtotal2026Won, base.basis2026Won);
  assert.equal(after.difference2026Won, base.basis2026Won - 3000000);
  assert.ok(after.missing.some(m => m.includes('2026 보수수준 환산액으로 비교')));
});

test('생활비 비교: 공적연금 계산값 자체는 바뀌지 않는다', () => {
  const f = young(), before = calculateSimple(f, today);
  f.monthlyLivingCost = '';
  const without = calculateSimple(f, today);
  assert.equal(before.pension.amountWon, without.pension.amountWon);
  assert.deepEqual(before.teacherPension.rows.map(x => x.estimate.amountWon), without.teacherPension.rows.map(x => x.estimate.amountWon));
});

test('생활비 비교: 공식 조회 입력 월액은 기존처럼 직접 비교한다', () => {
  const f = young(), q = f.benefits.civil.pension;
  const date = calculateSimple(f, today).retirement.date;
  Object.assign(q, { money: { amount: '2000000', unit: 'won' }, retirementDate: date, queryDate: '2026-11-01', taxBasis: 'gross', source: 'official', startDate: '2064-10-10' });
  const r = calculateSimple(f, today), a = calculateRetirementAnalysis(f, r);
  assert.equal(r.pensionSource, 'quote');
  const after = a.windows.find(w => w.phase === 'after');
  assert.equal(after.expenseComparable, true);
  assert.equal(after.differenceWon, -1000000);
  assert.equal(after.difference2026Won, -1000000);
});

test('생활비 비교: 미래 공제회 분할 명목 월액은 생활비와 직접 비교하지 않는다', () => {
  const f = young();
  Object.assign(f.ktcu, { balance: '50000000', monthly: '0', split: true, years: '5' });
  const r = calculateSimple(f, today), a = calculateRetirementAnalysis(f, r);
  const splitWindow = a.windows.find(w => w.sources.some(s => s.label.includes('공제회')));
  assert.ok(splitWindow);
  assert.equal(splitWindow.differenceWon, null);
  assert.equal(splitWindow.difference2026Won, null);
});

test('생활비 비교: AI 요청문에 명목 월연금 기준 잉여액이 들어가지 않는다', () => {
  const f = young(), r = calculateSimple(f, today), a = calculateRetirementAnalysis(f, r);
  const settings = { ...createPromptWorkspace().settings, detail: 'detailed', money: 'exact' };
  const prompt = generateSimplePrompt(f, settings, today);
  assert.match(prompt, /2026 보수수준 환산 월액 .* 기준 (잔여|부족) 방향/);
  const nominalSurplus = a.windows.find(w => w.phase === 'after').subtotalWon - 3000000;
  assert.ok(nominalSurplus > 0);
});
