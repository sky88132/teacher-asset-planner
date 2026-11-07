import { test, expect, type Page } from '@playwright/test';

async function openPension(page: Page) {
  await page.goto('/');
  await page.getByLabel('생년월일', { exact: true }).fill('1980-02-29');
  await page.getByLabel('최초 임용일', { exact: true }).fill('2005-03-01');
  await page.getByRole('button', { name: '공적연금·퇴직수당' }).click();
}
async function fillPension(page: Page) {
  await page.getByLabel('예상 월연금액', { exact: true }).fill('2501234');
  await page.getByLabel('예상 월연금 세전·세후').selectOption('gross');
  await page.getByLabel('예상 월연금 조회 기준일').fill('2026-01-01');
  await page.getByLabel('예상 월연금 산정 시 가정한 퇴직일').fill('2040-08-31');
  await page.getByLabel('예상 연금 지급개시일').fill('2045-03-01');
  await page.getByLabel('예상 월연금 입력 출처').selectOption('official');
}

test('공식 조회값의 메타데이터·단위를 표시하고 메뉴·제도 이동에서 값을 보존한다', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await openPension(page);
  await expect(page.getByText('생년월일: 1980-02-29', { exact: false })).toBeVisible();
  const result = page.getByRole('region', { name: '예상 월연금 결과', exact: true });
  await expect(result).toContainText('미입력');
  await fillPension(page);
  await page.getByLabel('예상 월연금액 단위').selectOption('manwon');
  await expect(page.getByLabel('예상 월연금액', { exact: true })).toHaveValue('250.1234');
  await page.getByRole('button', { name: '예상 월연금 입력 확인', exact: true }).click();
  await expect(result).toContainText('2,501,234원');
  await expect(result).toContainText('공식 조회값 · 사용자 직접 입력 (진위 미확인)');
  await expect(result).toContainText('월 지급');
  await expect(result).toContainText('2040-08-31');
  await expect(result).toContainText('2045-03-01');
  await expect(result).toContainText('2026-01-01');
  await page.getByRole('button', { name: '교사 기본정보' }).click();
  await expect(page.getByLabel('생년월일', { exact: true })).toHaveValue('1980-02-29');
  await page.getByRole('button', { name: '공적연금·퇴직수당' }).click();
  await expect(result).toContainText('2,501,234원');
  await page.getByLabel('공적연금 입력 제도').selectOption('private-school');
  await expect(result).toContainText('미입력');
  await page.getByRole('button', { name: '교사 기본정보' }).click();
  await expect(page.getByLabel('가입 연금제도 확인')).toHaveValue('private-school');
  await page.getByRole('button', { name: '공적연금·퇴직수당' }).click();
  await page.getByLabel('공적연금 입력 제도').selectOption('civil');
  await expect(result).toContainText('2,501,234원');
  await page.getByLabel('공적연금 입력 제도').selectOption('unconfirmed');
  await expect(page.getByText('선택한 연금제도는 입력 지원 대상이 아닙니다.', { exact: false })).toBeVisible();
  await page.getByLabel('공적연금 입력 제도').selectOption('civil');
  await expect(result).toContainText('2,501,234원');
  expect(runtimeErrors).toEqual([]);
});

test('날짜 오류 시 결과를 보류하고 사용자 추정값·세후·명시적 0원을 구별한다', async ({ page }) => {
  await openPension(page);
  await fillPension(page);
  await page.getByLabel('예상 월연금 조회 기준일').fill('9999-01-01');
  await page.getByRole('button', { name: '예상 월연금 입력 확인', exact: true }).click();
  await expect(page.locator('#pension-queryDate-error')).toContainText('오늘(한국 시간)');
  const result = page.getByRole('region', { name: '예상 월연금 결과', exact: true });
  await expect(result).not.toContainText('2,501,234원');
  await page.getByLabel('예상 월연금 조회 기준일').fill('2026-01-01');
  await page.getByLabel('예상 연금 지급개시일').fill('2030-01-01');
  await expect(page.locator('#pension-startDate-error')).toBeVisible();
  await page.getByLabel('예상 연금 지급개시일').fill('2045-03-01');
  await page.getByLabel('예상 월연금 입력 출처').selectOption('user-estimate');
  await page.getByLabel('예상 월연금 세전·세후').selectOption('net');
  await page.getByLabel('예상 월연금액', { exact: true }).fill('0');
  await expect(result).toContainText('사용자 추정값 · 미검증');
  await expect(result).toContainText('세후 · 입력값 그대로');
  await expect(result.locator('.benefit-amount')).toHaveText('0원');
  await page.getByLabel('예상 월연금액', { exact: true }).fill('');
  await expect(result.locator('.benefit-amount')).toHaveText('미입력');
});

test('퇴직수당 조회액과 계산 준비를 독립적으로 유지하고 계산액을 만들지 않는다', async ({ page }) => {
  await openPension(page);
  await page.getByLabel('예상 퇴직수당액', { exact: true }).fill('50,000,001');
  await page.getByLabel('예상 퇴직수당 세전·세후').selectOption('gross');
  await page.getByLabel('예상 퇴직수당 조회 기준일').fill('2026-01-01');
  await page.getByLabel('예상 퇴직수당 산정 시 가정한 퇴직일').fill('2040-08-31');
  const result = page.getByRole('region', { name: '예상 퇴직수당 결과', exact: true });
  await expect(result).toContainText('50,000,001원');
  await expect(result).toContainText('일시금');
  await page.getByLabel('수당 인정 재직기간 (년)', { exact: true }).fill('20');
  await page.getByLabel('수당 인정 재직기간 (월)', { exact: true }).fill('12');
  await page.getByLabel('최종 기준소득월액', { exact: true }).fill('5000000');
  await page.getByLabel('2009년 이전 재직 여부').selectOption('no');
  await page.getByRole('button', { name: '준비 입력 확인' }).click();
  await expect(page.locator('#prep-months-error')).toContainText('0~11');
  await page.getByLabel('수당 인정 재직기간 (월)', { exact: true }).fill('0');
  await page.getByRole('button', { name: '준비 입력 확인' }).click();
  await expect(page.getByRole('heading', { name: '자동 계산 결과 · 계산 불가' })).toBeVisible();
  await expect(result).toContainText('50,000,001원');
  await expect(page.getByRole('region', { name: '예상 월연금 결과', exact: true }).locator('.benefit-amount')).toHaveText('미입력');
  await page.getByRole('button', { name: '교직원공제회' }).click();
  await page.getByRole('button', { name: '공적연금·퇴직수당' }).click();
  await expect(page.getByLabel('최종 기준소득월액', { exact: true })).toHaveValue('5000000');
  await expect(result).toContainText('50,000,001원');
});

test('좁은 화면 레이아웃과 새로고침 초기화를 확인한다', async ({ page }, testInfo) => {
  await openPension(page);
  await fillPension(page);
  for (const width of testInfo.project.name === 'mobile' ? [320, 390, 640] : [900, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await expect(page.getByText('정밀 계산 모드 · 준비 중', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pension.png'), fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: '공적연금·퇴직수당' }).click();
  await expect(page.getByLabel('예상 월연금액', { exact: true })).toHaveValue('');
});

test('필수 자동 입력을 모두 채워도 검증 전 금액을 표시하지 않고 공식 입력을 보존한다', async ({ page }) => {
  await openPension(page);
  await page.getByLabel('예상 퇴직수당액', { exact: true }).fill('123456');
  await page.getByLabel('예상 퇴직수당 세전·세후').selectOption('gross');
  await page.getByLabel('예상 퇴직수당 조회 기준일').fill('2026-01-01');
  await page.getByLabel('예상 퇴직수당 산정 시 가정한 퇴직일').fill('2040-08-31');
  await page.getByLabel('자동 계산 예상 퇴직일').fill('2040-08-31');
  await page.getByLabel('퇴직수당 계산 기준일').fill('2026-11-07');
  await page.getByLabel('수당 인정 재직기간 (년)', { exact: true }).fill('34');
  await page.getByLabel('수당 인정 재직기간 (월)', { exact: true }).fill('0');
  await page.getByLabel('최종 기준소득월액', { exact: true }).fill('5000001');
  await page.getByLabel('2009년 이전 재직 여부').selectOption('no');
  await page.getByLabel('휴직·경력 합산 등 특수 경력 여부').selectOption('no');
  await page.getByLabel('수당 인정 재직기간 확인 출처').selectOption('official');
  await page.getByLabel('감액·지급제한 사유 여부').selectOption('no');
  await page.getByLabel('기존 퇴직수당 수령 이력 여부').selectOption('no');
  await page.getByRole('button', { name: '준비 입력 확인' }).click();
  await expect(page.getByRole('button', { name: '자동 계산 · 검증 대기' })).toBeDisabled();
  const result = page.getByRole('region', { name: '퇴직수당 자동 계산 결과', exact: true });
  await expect(result.locator('.benefit-amount')).toHaveText('계산 불가');
  await expect(result).toContainText('408개월');
  await expect(result).toContainText('33년(396개월)을 초과');
  await expect(result).toContainText('5,000,001원 · 최종 기준소득월액 (산식 미적용)');
  await expect(result).toContainText('공식 숫자 사례');
  await expect(result).toContainText('원 미만');
  await expect(page.getByRole('region', { name: '예상 퇴직수당 결과', exact: true }).locator('.benefit-amount')).toHaveText('123,456원');
  await page.getByRole('button', { name: '교사 기본정보' }).click();
  await page.getByRole('button', { name: '공적연금·퇴직수당' }).click();
  await expect(page.getByLabel('자동 계산 예상 퇴직일')).toHaveValue('2040-08-31');
  await expect(page.getByLabel('기존 퇴직수당 수령 이력 여부')).toHaveValue('no');
  await page.getByLabel('공적연금 입력 제도').selectOption('private-school');
  await expect(result).toContainText('사학연금법 시행령 제63조의3');
  await expect(page.getByLabel('자동 계산 예상 퇴직일')).toHaveValue('');
  await page.getByLabel('공적연금 입력 제도').selectOption('civil');
  await expect(page.getByLabel('자동 계산 예상 퇴직일')).toHaveValue('2040-08-31');
});

test('자동 입력의 퇴직일 역전·달력기간·기본정보 특수경력을 확인한다', async ({ page }) => {
  await openPension(page);
  await page.getByLabel('자동 계산 예상 퇴직일').fill('2000-01-01');
  await page.getByRole('button', { name: '준비 입력 확인' }).click();
  await expect(page.locator('#auto-retirementDate-error')).toContainText('최초 임용일보다 뒤');
  await page.getByLabel('수당 인정 재직기간 확인 출처').selectOption('calendar');
  await page.getByLabel('휴직·경력 합산 등 특수 경력 여부').selectOption('no');
  await page.getByRole('button', { name: '교사 기본정보' }).click();
  await page.getByLabel('군 복무', { exact: true }).check();
  await page.getByRole('button', { name: '공적연금·퇴직수당' }).click();
  const result = page.getByRole('region', { name: '퇴직수당 자동 계산 결과', exact: true });
  await expect(result).toContainText('단순 달력상 근속기간은 수당 인정기간이 아닙니다');
  await expect(result).toContainText('특수 경력이 있거나 반영 여부가 미확인입니다');
  await expect(result.locator('.benefit-amount')).toHaveText('계산 불가');
});
