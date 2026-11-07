import { test, expect, type Page } from '@playwright/test';
async function open(page: Page) {
  await page.goto('/');
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('button', { name: '명퇴·정년 비교' }).click();
  await expect(page.getByRole('heading', { name: '명퇴·정년 비교', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('button', { name: '교사 기본정보' }).click();
  await expect(page.getByRole('heading', { name: '교사 기본정보', exact: true })).toBeVisible();
  await page.getByLabel('생년월일', { exact: true }).fill('1980-05-10');
  await page.getByLabel('최초 임용일', { exact: true }).fill('2005-03-01');
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('button', { name: '명퇴·정년 비교' }).click();
  await page.getByLabel('정년퇴직일 입력 방식').selectOption('manual');
  await page.getByRole('button', { name: '정년 조건 수정', exact: true }).click();
  await page.getByLabel('정년 퇴직예정일', { exact: true }).fill('2030-01-01');
  await page.getByRole('button', { name: '명퇴 조건 수정', exact: true }).click();
  await page.getByLabel('명퇴 퇴직예정일', { exact: true }).fill('2028-01-01');
}
test('공식 조회 조건·선정·날짜 변경을 구분하고 메뉴 이동 후 값을 유지한다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  await page.getByLabel('명퇴 월연금 출처', { exact: true }).selectOption('local');
  for (const [label, v] of Object.entries({ '명퇴 월연금 공식 예상액 (원)': '2000000', '명퇴 월연금 조회 기준일': '2026-11-07', '명퇴 월연금 조회 시 가정한 퇴직일': '2028-01-01', '명퇴 월연금 지급개시일': '2035-01-01' })) await page.getByLabel(label, { exact: true }).fill(v);
  await page.getByLabel('명퇴 월연금 세전·세후', { exact: true }).selectOption('gross');
  const pension = page.getByRole('region', { name: '명퇴 예상 공적연금 월수령액', exact: true });
  await expect(pension.locator('.benefit-amount')).toHaveText('2,000,000원 / 월');
  await expect(pension).toContainText('공식 조회값');
  await expect(page.getByRole('region', { name: '정년 예상 공적연금 월수령액', exact: true })).toContainText('계산 불가');
  await expect(page.getByRole('region', { name: '명퇴 명예퇴직수당', exact: true })).toContainText('선정이 확인되지 않아');
  await expect(page.getByRole('img', { name: '퇴직일부터 공적연금 개시일까지의 기간' })).toBeVisible();
  await page.getByLabel('명퇴 퇴직예정일', { exact: true }).fill('2029-01-01');
  await expect(pension.locator('.benefit-amount')).toHaveText('계산 불가');
  await expect(pension).toContainText('조회 시 가정한 퇴직일이 시나리오와 다릅니다');
  await page.getByLabel('명퇴 퇴직예정일', { exact: true }).fill('2030-01-01');
  await expect(page.getByRole('region', { name: '명퇴 비교', exact: true }).getByRole('alert')).toContainText('명퇴일은 정년퇴직일보다 빨라야');
  await page.getByLabel('명퇴 퇴직예정일', { exact: true }).fill('2028-01-01');
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('button', { name: 'IRP·연금저축' }).click();
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('button', { name: '명퇴·정년 비교' }).click();
  await expect(pension.locator('.benefit-amount')).toHaveText('2,000,000원 / 월');
  await page.getByLabel('사용자 지정 퇴직일 추가 비교', { exact: true }).check();
  const custom = page.getByRole('region', { name: '사용자 지정 비교', exact: true });
  await custom.locator('summary').first().click();
  await page.getByLabel('사용자 지정 퇴직예정일', { exact: true }).fill('2029-01-01');
  await expect(custom).toContainText('2029-01-01');
  for (const width of info.project.name === 'mobile' ? [320,390,640] : [900,1440]) {
    await page.setViewportSize({ width, height:1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  if (info.project.name === 'mobile') {
    const a = await page.getByRole('region', { name:'명퇴 비교', exact:true }).boundingBox();
    const b = await page.getByRole('region', { name:'정년 비교', exact:true }).boundingBox();
    expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
  }
  await page.screenshot({ path:info.outputPath('comparison.png'), fullPage:true }); expect(errors).toEqual([]);
});
test('정년 자동 산정은 학교·직위 확인 범위에서만 활성화한다', async ({ page }) => {
  await open(page); await page.getByLabel('정년퇴직일 입력 방식').selectOption('auto');
  await page.getByLabel('비교 학교급', { exact:true }).selectOption('primary');
  await page.getByLabel('비교 직위·신분', { exact:true }).selectOption('regular-teacher');
  await page.getByLabel('교육공무원법 제47조 적용 일반 교사이며', { exact:false }).check();
  await expect(page.getByRole('region', { name:'정년 비교', exact:true })).toContainText('2042-08-31');
  await page.getByRole('button', { name:'교사 기본정보', exact:false }).click();
  await page.getByLabel('사립학교', { exact:false }).check();
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('button', { name: '명퇴·정년 비교' }).click();
  await expect(page.getByRole('region', { name:'정년 비교', exact:true })).not.toContainText('2042-08-31');
  await expect(page.getByText('국공립 일반 교사·학교급·제47조 적용 확인이 필요합니다.', { exact:false })).toBeVisible();
});
test('다른 메뉴의 공식 조회액을 퇴직일 일치 조건으로 재사용한다', async ({ page }) => {
  await open(page); await page.getByRole('button', { name:'02 공적연금 입력 수정', exact:true }).click();
  for (const [label,v] of Object.entries({ '예상 월연금액':'1234567', '예상 월연금 조회 기준일':'2026-11-07', '예상 월연금 산정 시 가정한 퇴직일':'2028-01-01', '예상 연금 지급개시일':'2035-01-01' })) await page.getByLabel(label, { exact:true }).fill(v);
  await page.getByLabel('예상 월연금 세전·세후').selectOption('gross'); await page.getByLabel('예상 월연금 입력 출처').selectOption('official');
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('button', { name: '명퇴·정년 비교' }).click();
  await expect(page.getByRole('region', { name:'명퇴 예상 공적연금 월수령액', exact:true }).locator('.benefit-amount')).toHaveText('1,234,567원 / 월');
  await expect(page.getByRole('region', { name:'정년 예상 공적연금 월수령액', exact:true })).toContainText('계산 불가');
  await page.getByRole('button', { name:'03 공제회 입력 수정', exact:true }).click();
  for (const [label,v] of Object.entries({ '현재 적립금 (기준일 잔액)':'1000000', '현재 잔액 기준일':'2026-01-01', '현재 월 납입액':'100000', '향후 월 납입액':'100000', '납입 종료일':'2030-01-01', '공제회 퇴직예정일':'2030-01-01', '사용자 가정 연 수익률 (%)':'0' })) await page.getByLabel(label,{exact:true}).fill(v);
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('button', { name: 'IRP·연금저축' }).click();
  for (const [label,v] of Object.entries({ '연금계좌 잔액 기준일':'2026-01-01', '연금계좌 퇴직예정일':'2030-01-01', 'IRP 현재 평가금액 (원)':'2000000', 'IRP 연간 납입액 (원)':'1200000', 'IRP 예상 연평균 수익률 (%)':'0', 'IRP 예상 연 수수료율 (%)':'0', 'IRP 납입 종료일':'2030-01-01' })) await page.getByLabel(label,{exact:true}).fill(v);
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('button', { name: '명퇴·정년 비교' }).click();
  await expect(page.getByRole('region', { name:'명퇴 교직원공제회 예상 적립금', exact:true }).locator('.benefit-amount')).toHaveText('3,400,000원');
  await expect(page.getByRole('region', { name:'정년 교직원공제회 예상 적립금', exact:true }).locator('.benefit-amount')).toHaveText('5,800,000원');
  await expect(page.getByRole('region', { name:'명퇴 IRP 예상 적립금', exact:true }).locator('.benefit-amount')).toHaveText('4,400,000원');
  await page.getByRole('button', { name:'명퇴 조건 수정',exact:true }).click();
  await page.getByLabel('명퇴 공제회 납입 종료 기준',{exact:true}).selectOption('custom');
  await page.getByLabel('명퇴 공제회 납입 종료일',{exact:true}).fill('2026-01-01');
  await expect(page.getByRole('region', { name:'명퇴 교직원공제회 예상 적립금',exact:true }).locator('.benefit-amount')).toHaveText('1,000,000원');
  await page.getByLabel('명퇴 IRP 납입 종료 기준',{exact:true}).selectOption('custom');
  await page.getByLabel('명퇴 IRP 납입 종료일',{exact:true}).fill('2027-01-01');
  await expect(page.getByRole('region', { name:'명퇴 IRP 예상 적립금',exact:true }).locator('.benefit-amount')).toHaveText('3,200,000원');
  await page.getByRole('button', { name:'03 공제회 입력 수정', exact:true }).click();
  await expect(page.getByLabel('납입 종료일',{exact:true})).toHaveValue('2030-01-01');
});
