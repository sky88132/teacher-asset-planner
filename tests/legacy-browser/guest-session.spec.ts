import { test, expect } from '@playwright/test';

const menus = ['교사 기본정보', '공적연금·퇴직수당', '교직원공제회', 'IRP·연금저축', '명퇴·정년 비교', '은퇴 현금흐름', 'AI 분석 요청문'];

test('비회원 안내·진행 단계·결과 연결이 모든 화면과 모바일에서 유지된다', async ({ page }, info) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: '주요 메뉴' });
  for (const [index, name] of menus.entries()) {
    await nav.getByRole('button', { name, exact: false }).click();
    await expect(page.getByRole('region', { name: '입력정보 보관 안내' })).toHaveCount(0);
    await expect(page.locator('.privacy')).toHaveText('◈ 개인정보 보호입력 정보는 저장되지 않으며, 새로고침하면 초기화됩니다.');
    await expect(page.getByRole('progressbar', { name: '현재 계산 단계' })).toHaveAttribute('value', String(index + 1));
    await expect(nav.getByRole('button', { name, exact: false })).toHaveAttribute('aria-current', 'step');
    await expect(page.getByRole('region', { name: '간편 계산 진행 안내' })).toContainText('계산 완료나 공식 검증을 의미하지 않습니다');
    await expect(page.getByText('정밀 계산 모드 · 준비 중', { exact: true })).toBeVisible();
    const widths = info.project.name === 'mobile' ? [320, 390, 640] : [900, 1440];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.getByRole('button', { name: '명퇴·정년 비교 결과 보기', exact: true }).click();
  await expect(page.getByRole('heading', { name: menus[4], exact: true })).toBeVisible();
  await page.getByRole('button', { name: '은퇴 현금흐름 결과 보기', exact: true }).click();
  await expect(page.getByRole('heading', { name: menus[5], exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('guest-session.png'), fullPage: true });
});

test('모든 메뉴의 금융 입력은 전송·저장하지 않고 이동 중 유지하며 새로고침하면 초기화한다', async ({ page }) => {
  const external: string[] = [], writes: string[] = [], financialRequests: string[] = [], errors: string[] = [];
  const sentinels = ['1981-07-12', '2006-03-01', '123456789', '234567891', '345678912'];
  page.on('request', request => {
    if (!/^https?:/.test(request.url())) return;
    if (new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.method() + ' ' + request.url());
    const payload = decodeURIComponent(request.url()) + (request.postData() ?? '');
    if (sentinels.some(value => payload.includes(value))) financialRequests.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: '주요 메뉴' });
  const menu = async (index: number) => { await nav.getByRole('button', { name: menus[index] }).click(); };
  await expect(page.getByText('로그인 없는 간편 계산', { exact: true })).toBeVisible();
  await page.getByLabel('생년월일', { exact: true }).fill(sentinels[0]);
  await page.getByLabel('최초 임용일', { exact: true }).fill(sentinels[1]);
  await menu(1); await page.getByLabel('예상 월연금액', { exact: true }).fill(sentinels[2]);
  await menu(2); await page.getByLabel('현재 적립금 (기준일 잔액)', { exact: true }).fill(sentinels[3]);
  await menu(3); await page.getByLabel('IRP 현재 평가금액 (원)', { exact: true }).fill(sentinels[4]);
  await menu(4); await page.getByLabel('정년퇴직일 입력 방식').selectOption('manual');
  await menu(5); await page.getByLabel('은퇴 첫해 월 생활비 (원)', { exact: true }).fill('876543');
  await menu(6); await page.getByLabel('사용자 추가 질문', { exact: true }).fill('소득 공백을 검토해 주세요.');
  const saved = [
    ['생년월일', sentinels[0]], ['예상 월연금액', sentinels[2]], ['현재 적립금 (기준일 잔액)', sentinels[3]],
    ['IRP 현재 평가금액 (원)', sentinels[4]], ['정년퇴직일 입력 방식', 'manual'],
    ['은퇴 첫해 월 생활비 (원)', '876543'], ['사용자 추가 질문', '소득 공백을 검토해 주세요.'],
  ];
  for (const [index, [label, value]] of saved.entries()) {
    await menu(index); await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  }
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  await page.reload();
  await expect(page.getByLabel('생년월일', { exact: true })).toHaveValue('');
  for (const index of [1, 2, 3, 5, 6]) {
    await menu(index); await expect(page.getByLabel(saved[index][0], { exact: true })).toHaveValue('');
  }
  await menu(4); await expect(page.getByLabel('정년퇴직일 입력 방식')).toHaveValue('auto');
  expect(external).toEqual([]); expect(writes).toEqual([]); expect(financialRequests).toEqual([]); expect(errors).toEqual([]);
});
