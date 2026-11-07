import { test, expect, type Page } from '@playwright/test';
async function navigate(page: Page, name: string) { await page.getByRole('navigation', { name:'주요 메뉴' }).getByRole('button', { name }).click(); }
async function setup(page: Page) {
  await page.goto('/'); await navigate(page,'은퇴 현금흐름');
  await expect(page.getByRole('heading',{name:'은퇴 현금흐름',exact:true})).toBeVisible();
  await navigate(page,'교사 기본정보');
  await page.getByLabel('생년월일',{exact:true}).fill('1980-01-01'); await page.getByLabel('최초 임용일',{exact:true}).fill('2005-03-01');
  await navigate(page,'명퇴·정년 비교'); await page.getByLabel('정년퇴직일 입력 방식').selectOption('manual');
  for (const [name,date] of [['정년','2030-01-01'],['명퇴','2028-01-01']]) {
    await page.getByRole('button',{name:`${name} 조건 수정`,exact:true}).click();
    await page.getByLabel(`${name} 퇴직예정일`,{exact:true}).fill(date);
    for (const kind of ['월연금','퇴직수당']) {
      await page.getByLabel(`${name} ${kind} 출처`,{exact:true}).selectOption('local');
      await page.getByLabel(`${name} ${kind} 공식 예상액 (원)`,{exact:true}).fill(kind==='월연금'?'100':'1000');
      await page.getByLabel(`${name} ${kind} 조회 기준일`,{exact:true}).fill('2026-11-07');
      await page.getByLabel(`${name} ${kind} 조회 시 가정한 퇴직일`,{exact:true}).fill(date);
      await page.getByLabel(`${name} ${kind} 세전·세후`,{exact:true}).selectOption('gross');
    }
    await page.getByLabel(`${name} 월연금 지급개시일`,{exact:true}).fill('2031-01-01');
  }
  await navigate(page,'교직원공제회');
  for (const [label,v] of Object.entries({'현재 적립금 (기준일 잔액)':'3000','현재 잔액 기준일':'2026-01-01','현재 월 납입액':'0','향후 월 납입액':'0','납입 종료일':'2030-01-01','공제회 퇴직예정일':'2030-01-01','사용자 가정 연 수익률 (%)':'0'})) await page.getByLabel(label,{exact:true}).fill(v);
  await navigate(page,'IRP·연금저축');
  for (const [label,v] of Object.entries({'연금계좌 잔액 기준일':'2026-01-01','연금계좌 퇴직예정일':'2030-01-01','IRP 현재 평가금액 (원)':'1200','IRP 연간 납입액 (원)':'0','IRP 예상 연평균 수익률 (%)':'0','IRP 예상 연 수수료율 (%)':'0','IRP 납입 종료일':'2030-01-01','IRP 수령 시작일':'2030-01-01','IRP 예상 수령기간 (년)':'1'})) await page.getByLabel(label,{exact:true}).fill(v);
  await navigate(page,'은퇴 현금흐름');
  await page.getByLabel('최종 분석 연령 (세)',{exact:true}).fill('52');
  await page.getByLabel('은퇴 첫해 월 생활비 (원)',{exact:true}).fill('0');
  await page.getByLabel('가정 연 물가상승률 (%)',{exact:true}).fill('0');
}
test('기존 원천을 연결해 월별·연도별·연령별 원장과 부분 결과를 표시한다',async({page},info)=>{
  const errors: string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await setup(page);
  const result=page.getByRole('region',{name:'명퇴 현금흐름 결과',exact:true});
  await expect(result).toContainText('확인된 원천만의 부분 결과');
  await expect(result.locator('.benefit-amount')).toHaveText('6,500원');
  await expect(page.getByRole('img',{name:'은퇴 이후 월별 금융자산 추이'})).toBeVisible();
  await result.getByText('명퇴 월별 현금흐름 원장',{exact:true}).click();
  const table=page.getByRole('table',{name:'명퇴 월별 원장 · 계좌 인출은 자산 내부 이동',exact:true});
  await expect(table.locator('tbody tr')).toHaveCount(49);
  const first=table.locator('tbody tr').first();
  await expect(first.locator('td').nth(2)).toHaveText('4,200원');
  await expect(first.locator('td').nth(3)).toHaveText('0원');
  await expect(first.locator('td').nth(4)).toHaveText('3,000원');
  await expect(first.locator('td').nth(8)).toHaveText('미확정');
  await expect(first.locator('td').last()).toHaveText('5,200원');
  await result.getByText('명퇴 연도별 집계',{exact:true}).click();
  await expect(page.getByRole('table',{name:'명퇴 연도별 합계 · 잔액은 마지막 월말값',exact:true}).locator('tbody tr')).toHaveCount(5);
  await result.getByText('명퇴 연령별 집계',{exact:true}).click();
  await expect(page.getByRole('table',{name:'명퇴 연령별 합계 · 잔액은 마지막 월말값',exact:true})).toBeVisible();
  await page.getByLabel('추가 비교 연령 (세)',{exact:true}).fill('49');
  await expect(page.getByRole('table',{name:'같은 생일 도달월 말 · 세금 미반영 · 순위·차액 미산출',exact:true})).toContainText('퇴직 전 근로소득·저축·생활비 정보 없음');
  await navigate(page,'명퇴·정년 비교'); await navigate(page,'은퇴 현금흐름');
  await expect(page.getByLabel('최종 분석 연령 (세)',{exact:true})).toHaveValue('52');
  await expect(result.locator('.benefit-amount')).toHaveText('6,500원');
  for(const width of info.project.name==='mobile'?[320,390,640]:[900,1440]) {await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.screenshot({path:info.outputPath('cashflow.png'),fullPage:true});expect(errors).toEqual([]);
});
test('현금 부족·특별 지출·가상 분할·수령 조건·검증 오류를 실시간 반영한다',async({page})=>{
  await setup(page);const result=page.getByRole('region',{name:'명퇴 현금흐름 결과',exact:true});
  await page.getByLabel('은퇴 첫해 월 생활비 (원)',{exact:true}).fill('100000');
  await expect(result).toContainText('최초 현금 부족: 2028-01-31');
  await page.getByLabel('은퇴 첫해 월 생활비 (원)',{exact:true}).fill('0');
  await page.getByText('명퇴 현금흐름 조건 수정',{exact:true}).click();
  await page.getByLabel('명퇴 공제회 수령 방식',{exact:true}).selectOption('virtual');
  await expect(result).toContainText('계산 불가');
  await page.getByLabel('명퇴 공제회 가상 수령기간',{exact:true}).selectOption('5');
  await page.getByLabel('명퇴 공제회 인출 가정 연 수익률 (%, 선택)',{exact:true}).fill('0');
  await expect(result).not.toContainText('계산 불가');
  await page.getByLabel('명퇴 IRP 인출 방식',{exact:true}).selectOption('fixed');
  await page.getByLabel('명퇴 IRP 월 인출액 (원)',{exact:true}).fill('0'); await expect(result).toContainText('계산 불가');
  await page.getByLabel('명퇴 IRP 월 인출액 (원)',{exact:true}).fill('100'); await expect(result).not.toContainText('계산 불가');
  await page.getByRole('button',{name:'특별 지출 추가',exact:true}).click();
  await page.getByLabel('특별 지출 1 날짜',{exact:true}).fill('2028-02-01');
  await page.getByLabel('특별 지출 1 금액 (원)',{exact:true}).fill('100000'); await expect(result).toContainText('최초 현금 부족: 2028-02-29');
  await page.getByRole('button',{name:'특별 지출 1 삭제',exact:true}).click();
  await expect(result).toContainText('최초 현금 부족: 분석 기간 내 없음');
  await page.getByLabel('현금흐름 입력 금액 기준',{exact:true}).selectOption('net'); await expect(result).toContainText('선택한 입력액 세후 기준과 일치하지 않습니다');
});
