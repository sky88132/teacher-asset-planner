import { test, expect, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/');
  await page.getByLabel('생년월일', { exact: true }).fill('1980-02-29');
  await page.getByLabel('최초 임용일', { exact: true }).fill('2005-03-01');
  await page.getByRole('button', { name: '교직원공제회' }).click();
}
async function fill(page: Page) {
  await page.getByLabel('현재 적립금 (기준일 잔액)', { exact: true }).fill('1000000');
  await page.getByLabel('현재 잔액 기준일', { exact: true }).fill('2026-07-01');
  await page.getByLabel('현재 월 납입액', { exact: true }).fill('30000');
  await page.getByLabel('향후 월 납입액', { exact: true }).fill('100000');
  await page.getByLabel('납입 종료일', { exact: true }).fill('2027-07-01');
  await page.getByLabel('공제회 퇴직예정일', { exact: true }).fill('2027-07-01');
  await page.getByLabel('사용자 가정 연 수익률 (%)', { exact: true }).fill('0');
}
test('적립·가상 인출을 계산하고 메뉴·기본정보와 입력을 유지한다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await open(page);
  const result = page.getByRole('region', { name: '공제회 퇴직 예상 적립금', exact: true });
  await expect(result).toContainText('계산 불가');
  await fill(page);
  await expect(result.locator('.benefit-amount')).toHaveText('2,200,000원');
  await expect(page.getByRole('img', { name: '기준잔액·향후 납입과 가정 증가액 비교' })).toBeVisible();
  await page.getByLabel('가상 인출 시작금액 출처').selectOption('projection');
  await page.getByLabel('가상 인출 가정 연 수익률 (%)', { exact: true }).fill('0');
  await page.getByLabel('분할 수령 희망 기간', { exact: true }).selectOption('5');
  const payout = page.getByRole('region', { name: '가상 인출 결과', exact: true });
  await expect(payout.locator('.benefit-amount')).toHaveText('36,666원 / 월');
  await expect(payout).toContainText('총수령 2,200,000원');
  await expect(payout).toContainText('세후 계산 불가');
  await page.getByText('선택 기간의 월별 가상 지급 일정', { exact: true }).click();
  await expect(page.getByRole('table', { name: '5년 월별 일정 · 세전' }).locator('tbody tr')).toHaveCount(60);
  for (const width of info.project.name === 'mobile' ? [320, 390, 640] : [900, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: info.outputPath('ktcu.png'), fullPage: true });
  await page.getByRole('button', { name: '기본정보 입력으로 돌아가기' }).click();
  await expect(page.getByLabel('최초 임용일', { exact: true })).toHaveValue('2005-03-01');
  await page.getByRole('button', { name: '공적연금·퇴직수당' }).click();
  await expect(page.getByRole('heading', { name: '03 · 퇴직수당 자동 계산 준비' })).toBeVisible();
  await page.getByRole('button', { name: '교직원공제회' }).click();
  await expect(result.locator('.benefit-amount')).toHaveText('2,200,000원');
  expect(errors).toEqual([]);
});
test('공식 조회액은 상품별로 분리하고 자체 전망에 합산하지 않는다', async ({ page }) => {
  await open(page); await fill(page);
  await page.getByLabel('공식 조회액 직접 입력 사용', { exact: true }).check();
  await page.getByLabel('공식 조회 급여금', { exact: true }).fill('9000000');
  await page.getByLabel('공제회 조회 기준일', { exact: true }).fill('2026-07-01');
  await page.getByLabel('조회 시 가정한 수령·퇴직일', { exact: true }).fill('2027-07-01');
  await page.getByLabel('공식 조회액 세전·세후').selectOption('net');
  await page.getByLabel('공식 조회액 지급 단위').selectOption('lump-sum');
  const quote = page.getByRole('region', { name: '공제회 공식 조회 결과', exact: true });
  await expect(quote.locator('.benefit-amount')).toHaveText('9,000,000원');
  await expect(quote).toContainText('세후');
  await expect(page.getByRole('region', { name: '공제회 퇴직 예상 적립금', exact: true })).toContainText('2,200,000원');
  await page.getByLabel('확인할 공제회 상품').selectOption('retirement-interest');
  await expect(quote).not.toContainText('9,000,000원');
  await expect(page.getByText('이 상품의 공식 자동 계산은 미검증입니다.', { exact: false })).toBeVisible();
  await page.getByLabel('확인할 공제회 상품').selectOption('long-term');
  await expect(quote.locator('.benefit-amount')).toHaveText('9,000,000원');
  await page.getByLabel('공식 조회액 직접 입력 사용', { exact: true }).uncheck();
  await expect(quote.locator('.benefit-amount')).toHaveText('미입력 또는 확인 필요');
});
test('오류·0원·금리 변경·새로고침을 구분한다', async ({ page }) => {
  await open(page); await fill(page);
  await page.getByLabel('향후 월 납입액', { exact: true }).fill('-1');
  await page.getByRole('button', { name: '공제회 입력 확인' }).click();
  await expect(page.locator('#ktcu-futureMonthly-error')).toBeVisible();
  const result = page.getByRole('region', { name: '공제회 퇴직 예상 적립금', exact: true });
  await expect(result.locator('.benefit-amount')).toHaveText('계산 불가');
  await page.getByLabel('향후 월 납입액', { exact: true }).fill('0');
  await page.getByLabel('현재 적립금 (기준일 잔액)', { exact: true }).fill('0');
  await expect(result.locator('.benefit-amount')).toHaveText('0원');
  await page.getByLabel('현재 적립금 (기준일 잔액)', { exact: true }).fill('1000000');
  await page.getByLabel('금리 변경 시나리오 사용 (사용자 가정)', { exact: true }).check();
  await page.getByLabel('가정 이율 변경일', { exact: true }).fill('2027-01-01');
  await page.getByLabel('변경 후 가정 연 수익률 (%)', { exact: true }).fill('5');
  await expect(page.getByText('이율 유지 가정:', { exact: false })).toContainText('1,000,000원');
  await page.reload();
  await page.getByRole('button', { name: '교직원공제회' }).click();
  await expect(page.getByLabel('현재 적립금 (기준일 잔액)', { exact: true })).toHaveValue('');
});
