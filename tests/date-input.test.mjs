import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDateText, calendarMonth } from '../src/lib/date-input.ts';
import { isCalendarDate } from '../src/lib/profile-validation.ts';
test('직접 입력 8자리·구분자를 ISO 날짜로 바꾸되 잘못된 날짜를 보정하지 않는다',()=>{
  for(const [input,output] of [['19800510','1980-05-10'],['1980-05-10','1980-05-10'],['1980/05/10','1980-05-10'],['1980.05.10','1980-05-10'],['',''],['1980','1980'],['20260230','2026-02-30']])assert.equal(normalizeDateText(input),output);
  assert.equal(isCalendarDate(normalizeDateText('20260230')),false);
});
test('달력은 1980년대·윤년·세기·1년의 날짜와 요일을 정확히 표시한다',()=>{
  assert.equal(calendarMonth(1980,1).offset,2);assert.equal(calendarMonth(1980,5).days[9].date,'1980-05-10');
  for(const [year,count] of [[1980,29],[2000,29],[1900,28],[2026,28],[2028,29]])assert.equal(calendarMonth(year,2).days.length,count);
  assert.equal(calendarMonth(1,1).offset,1);assert.equal(calendarMonth(1,1).days[0].date,'0001-01-01');
  assert.equal(calendarMonth(9999,12).days.at(-1).date,'9999-12-31');
  for(const [year,month] of [[0,1],[10000,1],[2026,0],[2026,13],[2026.5,1]])assert.throws(()=>calendarMonth(year,month));
});
