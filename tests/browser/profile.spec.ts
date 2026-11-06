import { test, expect } from '@playwright/test';

test('학교·연금·날짜·특수 경력을 메뉴 이동 후에도 유지한다', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.goto('/');
  await page.locator('input[value="private"]').check();
  await expect(page.locator('.summary-row').first()).toContainText('사학연금');
  await page.getByLabel('생년월일', { exact: true }).fill('1980-02-29');
  await page.getByLabel('최초 임용일', { exact: true }).fill('2005-03-01');
  await page.getByLabel('군 복무', { exact: true }).check();
  await page.getByLabel('육아휴직', { exact: true }).check();
  await expect(page.getByText('군 복무, 휴직, 경력 합산 등은 간편 계산에 일부 반영되지 않을 수 있습니다. 정확한 금액은 공식 연금 조회 결과를 확인해 주세요.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '입력 확인' }).click();
  await expect(page.getByRole('status')).toContainText('기본정보 입력을 확인했습니다');
  await page.getByRole('button', { name: '교직원공제회' }).click();
  await page.getByRole('button', { name: '기본정보 입력으로 돌아가기' }).click();
  await expect(page.getByLabel('생년월일', { exact: true })).toHaveValue('1980-02-29');
  await expect(page.getByLabel('최초 임용일', { exact: true })).toHaveValue('2005-03-01');
  await expect(page.locator('input[value="private"]')).toBeChecked();
  await expect(page.getByLabel('군 복무', { exact: true })).toBeChecked();
  await expect(page.getByLabel('육아휴직', { exact: true })).toBeChecked();
  await page.getByRole('link', { name: /TEACHER ASSET PLANNER/ }).click();
  await expect(page.getByLabel('생년월일', { exact: true })).toHaveValue('1980-02-29');
  await page.getByLabel('가입 연금제도 확인').selectOption('other');
  await page.locator('input[value="public"]').check();
  await expect(page.locator('.summary-row').first()).toContainText('기타 연금제도');
  await page.getByLabel('가입 연금제도 확인').selectOption('school-default');
  await expect(page.locator('.summary-row').first()).toContainText('공무원연금');
  await expect(page.locator('body')).not.toContainText('????');
  expect(runtimeErrors).toEqual([]);
});

test('필수·미래·날짜 순서 오류를 항목 아래 표시하고 수정하면 해제한다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '입력 확인' }).click();
  await expect(page.locator('#birthDate-error')).toContainText('입력해 주세요');
  await expect(page.locator('#appointmentDate-error')).toContainText('입력해 주세요');
  await page.getByLabel('생년월일', { exact: true }).fill('9999-01-01');
  await expect(page.locator('#birthDate-error')).toContainText('오늘(한국 시간)');
  await page.getByLabel('생년월일', { exact: true }).fill('1980-01-01');
  await page.getByLabel('최초 임용일', { exact: true }).fill('1979-12-31');
  await expect(page.locator('#appointmentDate-error')).toContainText('생년월일보다 뒤');
  await page.getByLabel('최초 임용일', { exact: true }).fill('2005-03-01');
  await expect(page.locator('form').getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: '입력 확인' }).click();
  await expect(page.getByRole('status')).toBeVisible();
});

test('좁은 화면에서 폼이 넘치지 않고 새로고침 안내와 초기화를 확인한다', async ({ page }, testInfo) => {
  await page.goto('/');
  for (const width of testInfo.project.name === 'mobile' ? [320, 390, 640] : [900, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole('button', { name: '입력 확인' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await expect(page.getByText('메뉴 이동 시 유지됩니다. 새로고침하면 초기화됩니다.', { exact: true })).toBeVisible();
  await page.getByLabel('생년월일', { exact: true }).fill('1980-01-01');
  await page.reload();
  await expect(page.getByLabel('생년월일', { exact: true })).toHaveValue('');
  await page.screenshot({ path: testInfo.outputPath('profile.png'), fullPage: true });
});
