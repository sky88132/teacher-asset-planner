import { test, expect } from '@playwright/test';
import { menuNames, openMenu } from './helpers';

test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toBeVisible(); });

test('본문 바로가기는 첫 Tab에 보이고 Enter 후 본문 첫 입력으로 이동', async ({ page }) => {
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: '본문 바로가기' });
  await expect(skip).toBeFocused(); await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('main'))).toBe(true);
});

test('단계 이동 시 새 단계 제목으로 포커스·메뉴는 전체 이름을 접근성 이름으로 유지', async ({ page }, info) => {
  await expect(page.locator('h1')).not.toBeFocused();
  for (const n of [4, 1, 5]) {
    await openMenu(page, n);
    await expect(page.getByRole('heading', { level: 1, name: menuNames[n] })).toBeFocused();
  }
  const nav = page.getByRole('navigation', { name: '주요 메뉴' });
  for (const name of menuNames) await expect(nav.getByRole('button', { name, exact: true })).toHaveCount(1);
  // Mobile tab bar shows short labels on one line; desktop shows full names.
  const second = nav.getByRole('button', { name: '교직원공제회' });
  if (info.project.name === 'mobile') { await expect(second.locator('.nav-short')).toBeVisible(); await expect(second.locator('.nav-short')).toHaveText('공제회'); }
  else { await expect(second.locator('.nav-full')).toBeVisible(); await expect(second.locator('.nav-short')).toBeHidden(); }
});

test('단계별 자주 묻는 질문이 바뀌고 펼치면 답이 보인다', async ({ page }) => {
  const faq = page.getByRole('region', { name: '자주 묻는 질문' });
  await expect(faq.getByText('군복무 개월은 어디에 입력하나요?')).toBeVisible();
  await expect(faq.getByText('입력한 내용은 저장되나요?')).toBeVisible();
  await openMenu(page, 4);
  await expect(faq.getByText('군복무 개월은 어디에 입력하나요?')).toHaveCount(0);
  const q = faq.getByText('"지금 가치"와 "미래 금액"은 무엇이 다른가요?');
  await expect(q).toBeVisible();
  const answer = faq.getByText(/큰 글씨가 지금 가치, 작은 글씨가 미래 금액/);
  await expect(answer).toBeHidden(); await q.click(); await expect(answer).toBeVisible();
});

test('주요 버튼과 보조 글자 대비는 4.5:1 이상', async ({ page }) => {
  const ratio = (sel: string) => page.locator(sel).first().evaluate(el => {
    const rgb = (c: string) => c.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const lum = (c: number[]) => { const f = (x: number) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    let bgEl: Element | null = el, bg = [255, 255, 255];
    while (bgEl) { const b = getComputedStyle(bgEl).backgroundColor; const m = b.match(/[\d.]+/g)!.map(Number); if ((m[3] ?? 1) > 0.9) { bg = m.slice(0, 3); break; } bgEl = bgEl.parentElement; }
    const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(await ratio('.simple-navigation .primary')).toBeGreaterThanOrEqual(4.5);
  expect(await ratio('.planner-ui footer')).toBeGreaterThanOrEqual(4.5);
  expect(await ratio('.help-faq .section-tag')).toBeGreaterThanOrEqual(4.5);
});
