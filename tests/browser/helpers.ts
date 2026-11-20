import type { Page } from '@playwright/test';

/** Sidebar / bottom-tab menu labels in step order (01–06). */
export const menuNames = ['교사 기본정보', '교직원공제회', 'IRP·연금저축', '퇴직급여 계산', '은퇴설계 종합', 'AI 분석 요청문'] as const;

/** Opens step `n` (0-based) through the main navigation, the same way a user does. */
export function openMenu(page: Page, n: number) {
  return page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('button', { name: menuNames[n] }).click();
}
