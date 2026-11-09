import { test,expect,type Page } from '@playwright/test';
const names=['교사 기본정보','교직원공제회','IRP·연금저축','퇴직급여 계산','은퇴설계 종합','AI 분석 요청문'];
async function menu(page:Page,n:number){await page.getByRole('navigation',{name:'주요 메뉴'}).getByRole('button',{name:names[n]}).click();}
async function profile(page:Page,appointment='2010-01-01',date='2030-01-01'){
  await page.getByLabel('생년월일',{exact:true}).fill('1970-05-10');await page.getByLabel('최초 임용일',{exact:true}).fill(appointment);await page.getByLabel('현재 호봉',{exact:true}).fill('30');await page.getByLabel('승급월',{exact:true}).selectOption('3');await page.getByRole('radio',{name:'명예퇴직',exact:true}).check();await page.getByLabel('명예퇴직 예정일',{exact:true}).fill(date);
}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-08T12:00:00+09:00')});await page.goto('/');});
test('미입력 소득의 세 시나리오는 개인 소득·기존 합계와 구분한다',async({page},info)=>{
  await profile(page);await menu(page,3);await page.getByText('2026년 소득 수준 고정 상세 비교',{exact:true}).click();const card=page.getByRole('region',{name:'퇴직수당 참고 시뮬레이션',exact:true});await expect(card.locator('.benefit-amount').first()).toHaveText('3,713만원 ~ 5,569만원');for(const text of ['476만원','595만원','714만원','2026년 소득 수준 고정 가정','개인 공식 조회액 아님'])await expect(card).toContainText(text);await expect(page.getByRole('region',{name:'퇴직급여 참고 합계',exact:true})).not.toContainText('완전한 합계 확인 불가');
  await page.getByText('계산 근거 보기 (퇴직수당)',{exact:true}).click();await page.getByLabel('2026년 기준 퇴직수당용 기준소득월액 (만원, 선택)',{exact:true}).fill('400.0001');await expect(card.locator('.benefit-amount').first()).toHaveText('3,120만원');await expect(page.getByLabel('2026년 기준 퇴직수당용 기준소득월액 (만원, 선택)',{exact:true})).toHaveValue('400.0001');
  if(info.project.name==='mobile')await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await card.screenshot({path:info.outputPath('allowance-reference.png')});
});
test('구기간 소득 없이는 전체액 보류·추가자료 확인 후 구간 합산',async({page})=>{
  await profile(page,'2005-01-01');await menu(page,3);const card=page.getByRole('region',{name:'퇴직수당 참고 시뮬레이션',exact:true});await expect(card.locator('.benefit-amount').first()).toHaveText('전체액 확인 필요');await expect(card).toContainText('이후분 참고 소계');await page.getByText('계산 근거 보기 (퇴직수당)',{exact:true}).click();await page.getByLabel('2026년 기준 퇴직수당용 기준소득월액 (만원, 선택)',{exact:true}).fill('400');await page.getByLabel('2009년 이전분 최종보수월액 현가액 (만원, 2026년 기준)',{exact:true}).fill('300');await page.getByLabel('공단 확인 구기간 현가액을 현재 임용일·퇴직일 기준으로 확인했습니다.',{exact:true}).check();await expect(card.locator('.benefit-amount').first()).toHaveText('4,020만원');await expect(card).toContainText('2009년 이전 60개월 / 2010년 이후 240개월');
  await menu(page,0);await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2031-01-01');await menu(page,3);await expect(card.locator('.benefit-amount').first()).toHaveText('전체액 확인 필요');
});
test('사학에는 공무원 통계 미적용·국민연금에는 수당식 미적용',async({page})=>{
  await profile(page);await page.getByRole('radio',{name:'사학연금',exact:true}).check();await menu(page,3);const card=page.getByRole('region',{name:'퇴직수당 참고 시뮬레이션',exact:true});await expect(card).toContainText('사학 개인 소득의 통계 근거로 자동 사용하지');await page.getByText('계산 근거 보기 (퇴직수당)',{exact:true}).click();await page.getByLabel('2026년 기준 퇴직수당용 기준소득월액 (만원, 선택)',{exact:true}).fill('400');await expect(card.locator('.benefit-amount').first()).toHaveText('3,120만원');
  await menu(page,0);await page.getByRole('radio',{name:'국민연금',exact:true}).check();await page.getByText('정년일이 다른 경우 직접 수정',{exact:true}).click();await page.getByLabel('기관에서 확인한 정년일 사용',{exact:true}).check();await page.getByLabel('기관에서 확인한 정년일',{exact:true}).fill('2032-08-31');await menu(page,3);await expect(card).toContainText('국민연금 가입자에게');await expect(card.locator('.benefit-amount').first()).toHaveText('전체액 확인 필요');
});
test('주요 적립금은 억/만원 정수이고 입력 소수는 그대로 유지',async({page})=>{
  await profile(page,'2010-01-01','2026-11-08');await menu(page,2);await page.getByLabel('IRP 현재 적립금 또는 평가금액 (만원)',{exact:true}).fill('17342.3613');await page.getByLabel('IRP 앞으로의 월 납입액 (만원)',{exact:true}).fill('0');await expect(page.getByRole('region',{name:'퇴직 시 IRP 예상 적립금',exact:true}).locator('.benefit-amount').first()).toHaveText('1억 7,342만원');await expect(page.getByLabel('IRP 현재 적립금 또는 평가금액 (만원)',{exact:true})).toHaveValue('17,342.3613');
});
test('AI 금액도 만원 정수·참고 시나리오 구분·익명 복사 유지',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await profile(page);await menu(page,5);await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();const text=await page.getByLabel('AI 분석 요청문',{exact:true}).inputValue();expect(text).toContain('퇴직수당 참고 시뮬레이션');expect(text).toContain('595만원');expect(text).not.toMatch(/\d+\.\d+만원/);expect(text).not.toContain('1970-05-10');await page.getByRole('button',{name:'전체 복사',exact:true}).click();await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toContain('퇴직수당 참고 시뮬레이션');
});
