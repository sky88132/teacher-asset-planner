import { test, expect } from '@playwright/test';

test('7개 은퇴 메뉴와 합산 준비 상태를 표시하고 모든 메뉴 이동에서 입력을 유지한다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('교사 은퇴 연금 시뮬레이터');
  const nav = page.getByRole('navigation', { name: '주요 메뉴' });
  const names = ['교사 기본정보', '공적연금·퇴직수당', '교직원공제회', 'IRP·연금저축', '명퇴·정년 비교', '은퇴 현금흐름', 'AI 분석 요청문'];
  await expect(nav.getByRole('button')).toHaveCount(7);
  for (let index = 0; index < names.length; index++) {
    await expect(nav.getByRole('button').nth(index)).toHaveText(`${String(index + 1).padStart(2, '0')}${names[index]}`);
  }
  await expect(page.getByRole('button', { name: '개인연금', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '기타 자산·부채', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /개인연금|기타 자산·부채/ })).toHaveCount(0);
  await expect(page.locator('.summary')).toContainText('예상 은퇴 금융자산');
  await expect(page.locator('.summary')).toContainText('공적연금 월액과 적립금은 별도로');
  await expect(page.locator('.summary .muted')).toHaveText(['합산 준비 중', '합산 준비 중']);
  await page.getByLabel('생년월일', { exact: true }).fill('1980-02-29');
  await nav.getByRole('button', { name: '공적연금·퇴직수당' }).click();
  await page.getByLabel('예상 월연금액', { exact: true }).fill('1234567');
  await nav.getByRole('button', { name: '교직원공제회' }).click();
  await page.getByLabel('현재 적립금 (기준일 잔액)', { exact: true }).fill('2345678');
  await nav.getByRole('button', { name: 'IRP·연금저축' }).click();
  await page.getByLabel('IRP 현재 평가금액 (원)', { exact: true }).fill('3456789');
  for (let index = 4; index < names.length; index++) {
    await nav.getByRole('button', { name: names[index] }).click();
    await expect(page.getByRole('heading', { name: names[index], exact: true })).toBeVisible();
    await expect(page.locator('.step-badge')).toHaveText(`STEP ${String(index + 1).padStart(2, '0')} / 07`);
    await expect(page.getByText('정밀 계산 모드 · 준비 중', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '다음 단계에서 연결됩니다.' })).toBeVisible();
  }
  await nav.getByRole('button', { name: names[0] }).click();
  await expect(page.getByLabel('생년월일', { exact: true })).toHaveValue('1980-02-29');
  await nav.getByRole('button', { name: names[1] }).click();
  await expect(page.getByLabel('예상 월연금액', { exact: true })).toHaveValue('1234567');
  await nav.getByRole('button', { name: names[2] }).click();
  await expect(page.getByLabel('현재 적립금 (기준일 잔액)', { exact: true })).toHaveValue('2345678');
  await nav.getByRole('button', { name: names[3] }).click();
  await expect(page.getByLabel('IRP 현재 평가금액 (원)', { exact: true })).toHaveValue('3456789');
});
