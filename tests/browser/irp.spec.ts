import { test, expect } from '@playwright/test';
test('IRP 적립·인출·합산·메뉴 유지 및 모바일 표시', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByLabel('생년월일', { exact: true }).fill('1980-02-29');
  await page.getByRole('button', { name: 'IRP·연금저축' }).click();
  const result = page.getByRole('region', { name: 'IRP·연금저축 합산 결과', exact: true });
  await expect(result).toContainText('계산 불가');
  const inputs: Record<string,string> = { '연금계좌 잔액 기준일':'2026-01-01', '연금계좌 퇴직예정일':'2028-01-01', 'IRP 현재 평가금액 (원)':'1000000', 'IRP 연간 납입액 (원)':'1200000', 'IRP 예상 연평균 수익률 (%)':'0', 'IRP 예상 연 수수료율 (%)':'0', 'IRP 납입 종료일':'2028-01-01', 'IRP 수령 시작일':'2028-01-01', 'IRP 예상 수령기간 (년)':'10' };
  for (const [label,value] of Object.entries(inputs)) await page.getByLabel(label, { exact: true }).fill(value);
  await expect(result.locator('.benefit-amount')).toHaveText('3,400,000원');
  await expect(page.getByRole('img', { name: 'IRP·연금저축 연도별 자산 성장 그래프' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'IRP 예상 결과', exact: true })).toContainText('28,333원 / 월');
  await page.getByRole('button', { name: '교사 기본정보' }).click(); await expect(page.getByLabel('생년월일', { exact: true })).toHaveValue('1980-02-29');
  await page.getByRole('button', { name: 'IRP·연금저축' }).click(); await expect(result.locator('.benefit-amount')).toHaveText('3,400,000원');
  await expect(page.getByRole('button', { name: '이전 시나리오 계산 비활성화' })).toBeDisabled();
  await page.getByLabel('세액공제 환급액 재투자', { exact: true }).check(); await expect(result.locator('.benefit-amount')).toHaveText('계산 불가');
  await page.getByLabel('세액공제 환급액 재투자', { exact: true }).uncheck();
  await page.getByLabel('거주자의 일반 개인납입금만 입력했으며', { exact: false }).check();
  await page.getByLabel('세액공제 소득금액 (원)', { exact: true }).fill('40000000');
  await page.getByLabel('연금계좌 공제 전 남은 국세 (원, 선택)', { exact: true }).fill('1000000');
  await expect(page.getByRole('region', { name:'세액공제 결과', exact:true })).toContainText('180,000원');
  await page.getByLabel('재투자 가능한 연간 국세 환급 현금 상한 (원)', { exact:true }).fill('1000000');
  await page.getByLabel('세액공제 환급액 재투자', { exact:true }).check();
  await page.getByLabel('환급액 재투자 비율 (%)', { exact:true }).fill('100');
  await page.getByLabel('재투자 예상 연 수익률 (%)', { exact:true }).fill('0');
  await expect(result).toContainText('재투자 전 3,565,000원 / 재투자 후 3,565,000원');
  await page.getByLabel('재투자 예상 연 수익률 (%)', { exact:true }).fill('10');
  await expect(result).not.toContainText('재투자 후 3,565,000원');
  for (const width of info.project.name === 'mobile' ? [320,390,640] : [900,1440]) { await page.setViewportSize({ width, height:1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.screenshot({ path: info.outputPath('irp.png'), fullPage:true }); expect(errors).toEqual([]);
});
test('소득 공제와 재투자 설정 검증', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'IRP·연금저축' }).click();
  await page.getByLabel('IRP 현재 평가금액 (원)', { exact:true }).fill('-1');
  await expect(page.getByRole('region', { name:'IRP·연금저축 합산 결과', exact:true })).toContainText('계산 불가');
  await page.getByLabel('연금저축 계산에 포함', { exact:true }).check();
  await expect(page.getByLabel('연금저축 연간 납입액 (원)', { exact:true })).toBeVisible();
  await expect(page.getByText('정밀 계산 모드 · 준비 중', { exact:true })).toBeVisible();
});
