import { test, expect, type Page } from '@playwright/test';
const menus=['교사 기본정보','교직원공제회','IRP·연금저축','퇴직급여 계산','은퇴설계 종합','AI 분석 요청문'];
async function menu(page:Page,n:number){await page.getByRole('navigation',{name:'주요 메뉴'}).getByRole('button',{name:menus[n]}).click();}
async function profile(page:Page,birth='1971-05-10',retirement='2027-02-28'){
  await page.getByLabel('생년월일',{exact:true}).fill(birth);await page.getByLabel('최초 임용일',{exact:true}).fill('2000-03-01');await page.getByLabel('현재 호봉',{exact:true}).fill('35');await page.getByLabel('승급월',{exact:true}).selectOption('3');await page.getByRole('radio',{name:'명예퇴직',exact:true}).check();await page.getByLabel('명예퇴직 예정일',{exact:true}).fill(retirement);
}
async function details(page:Page,title='IRP'){await page.getByText(`${title} 수령 요건·한도·세금 상세 설정 (선택)`,{exact:true}).click();}
async function balances(page:Page){for(const title of ['IRP','연금저축']){await page.getByLabel(`${title} 현재 적립금 또는 평가금액 (만원)`,{exact:true}).fill('1000');await page.getByLabel(`${title} 앞으로의 월 납입액 (만원)`,{exact:true}).fill('10');}}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-08T12:00:00+09:00')});await page.goto('/');});
test('가입일 미입력·기본 접힘·공적연금과 계좌별 미확인 공백 안내',async({page})=>{
  await profile(page);await menu(page,2);await balances(page);await expect(page.getByLabel('IRP 최초 계좌 가입일',{exact:true})).not.toBeVisible();
  await expect(page.getByRole('region',{name:'IRP 수령 요건 요약',exact:true})).toContainText('가입기간 충족 여부는 추가 확인');await expect(page.getByRole('region',{name:'연금저축 수령 요건 요약',exact:true})).toContainText('실제 신청일');
  await menu(page,4);const bridge=page.getByRole('region',{name:'연금계좌 소득 공백 활용',exact:true});await expect(bridge).toContainText('공적연금');await expect(bridge).toContainText('추가 확인 후');await expect(bridge).toContainText('공백 충당 가능 금액은 별도 계산');
});
test('계좌별 5년 요건·55세 경계·퇴직일과 정년 변경·가입일 보존',async({page})=>{
  await profile(page);await menu(page,2);await details(page);await page.getByLabel('IRP 최초 계좌 가입일',{exact:true}).fill('2025-05-10');await details(page,'연금저축');await page.getByLabel('연금저축 최초 계좌 가입일',{exact:true}).fill('2020-05-10');
  await expect(page.getByRole('region',{name:'IRP 수령 요건 요약',exact:true})).toContainText('2030-05-10');await expect(page.getByRole('region',{name:'IRP 수령 요건 요약',exact:true})).toContainText('요건 미충족');await expect(page.getByRole('region',{name:'연금저축 수령 요건 요약',exact:true})).toContainText('요건 충족');
  await menu(page,0);await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2031-02-28');await menu(page,4);await expect(page.getByRole('region',{name:'IRP 수령 요건 요약',exact:true})).toContainText('요건 충족');
  await menu(page,0);await page.getByRole('radio',{name:'정년퇴직',exact:true}).check();await menu(page,4);await expect(page.getByRole('region',{name:'IRP 수령 요건 요약',exact:true})).toContainText('요건 충족');
  await menu(page,2);await details(page);await expect(page.getByLabel('IRP 최초 계좌 가입일',{exact:true})).toHaveValue('2025-05-10');
});
test('실제 이연퇴직소득 확인 예외·연간 한도 내외·재원별 세금',async({page})=>{
  await profile(page);await menu(page,2);await details(page);await page.getByLabel('IRP 최초 계좌 가입일',{exact:true}).fill('2025-05-10');await page.getByLabel('IRP 이연퇴직소득 보유 상태',{exact:true}).selectOption('confirmed');await expect(page.getByRole('region',{name:'IRP 수령 요건 요약',exact:true})).toContainText('실제 이연퇴직소득 보유');
  await page.getByLabel('IRP 확인된 이연퇴직소득 실제 입금일',{exact:true}).fill('2025-06-01');await expect(page.getByRole('region',{name:'IRP 수령 요건 요약',exact:true})).toContainText('5년 예외 반영');
  await page.getByText('IRP 연간 수령한도 계산 (선택)',{exact:true}).click();await page.getByLabel('IRP 한도 계산 과세연도',{exact:true}).fill('2026');await page.getByLabel('IRP 연금개시 신청일 (실제 또는 계획)',{exact:true}).fill('2026-06-01');await page.getByLabel('IRP 한도용 평가 기준일',{exact:true}).fill('2026-06-01');await page.getByLabel('IRP 한도용 기준 계좌 평가액 (만원)',{exact:true}).fill('10000');await page.getByLabel('IRP 연간 한도 산입 예상 인출액 (만원, 세전)',{exact:true}).fill('1500');
  const limit=page.getByText('IRP 연간 수령한도 계산 (선택)',{exact:true}).locator('..');await expect(limit).toContainText('연간 세법상 한도 1,200만원');await expect(limit).toContainText('한도 초과·연금외수령분 300만원');await page.getByLabel('IRP 연간 한도 산입 예상 인출액 (만원, 세전)',{exact:true}).fill('1200');await expect(limit).toContainText('한도 초과·연금외수령분 0만원');
  await page.getByText('IRP 재원별 과세와 추가 확인사항',{exact:true}).click();await expect(page.getByText('IRP 재원별 과세와 추가 확인사항',{exact:true}).locator('..')).toContainText('70%/60%/50%');await page.getByLabel('IRP 금융기관 확인 실제 수령연차 (선택)',{exact:true}).fill('1');await expect(page.getByText('IRP 재원별 과세와 추가 확인사항',{exact:true}).locator('..')).toContainText('70% (연금외수령');
});
test('2013년 이전 6년차·11년차 한도 미적용·좁은 화면',async({page},info)=>{
  await profile(page);await menu(page,2);await details(page);await page.getByLabel('IRP 최초 계좌 가입일',{exact:true}).fill('2005-01-01');await page.getByText('IRP 연간 수령한도 계산 (선택)',{exact:true}).click();await page.getByLabel('IRP 한도 계산 과세연도',{exact:true}).fill('2026');await page.getByLabel('IRP 연금개시 신청일 (실제 또는 계획)',{exact:true}).fill('2026-06-01');await page.getByLabel('IRP 한도용 평가 기준일',{exact:true}).fill('2026-06-01');await page.getByLabel('IRP 한도용 기준 계좌 평가액 (만원)',{exact:true}).fill('10000');
  const limit=page.getByText('IRP 연간 수령한도 계산 (선택)',{exact:true}).locator('..');await expect(limit).toContainText('6년차');await expect(limit).toContainText('2,400만원');await page.getByLabel('IRP 한도 계산 과세연도',{exact:true}).fill('2031');await expect(limit).toContainText('11년차 이상: 이 계산식의 한도 미적용');
  await page.getByText('IRP 재원별 과세와 추가 확인사항',{exact:true}).click();if(info.project.name==='mobile')await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const fits=await page.getByLabel('IRP 연금개시 신청일 (실제 또는 계획)',{exact:true}).evaluate((node:HTMLInputElement)=>{const style=getComputedStyle(node),context=document.createElement('canvas').getContext('2d')!;context.font=style.font;return context.measureText(node.value).width+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)<=node.clientWidth;});expect(fits).toBe(true);await page.screenshot({path:info.outputPath('account-receipt.png'),fullPage:true});
});
test('월·연납 전환에서 가입일 유지·기존 적립금 갱신',async({page})=>{
  await profile(page);await menu(page,2);await balances(page);await details(page);await page.getByLabel('IRP 최초 계좌 가입일',{exact:true}).fill('2020-05-10');const result=page.getByRole('region',{name:'퇴직 시 IRP 예상 적립금',exact:true});const monthly=await result.locator('.benefit-amount').first().innerText();await page.getByLabel('IRP 납입 주기',{exact:true}).selectOption('yearly');await page.getByLabel('IRP 앞으로의 연 납입액 (만원)',{exact:true}).fill('120');await expect(result.locator('.benefit-amount').first()).not.toHaveText(monthly);await expect(page.getByLabel('IRP 최초 계좌 가입일',{exact:true})).toHaveValue('2020-05-10');await page.getByLabel('IRP 납입 주기',{exact:true}).selectOption('monthly');await expect(page.getByLabel('IRP 앞으로의 월 납입액 (만원)',{exact:true})).toHaveValue('10');await expect(result.locator('.benefit-amount').first()).toHaveText(monthly);
});
test('AI 요청문에 수령 요건·세금·미확인을 반영하고 익명 복사 가능',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await profile(page);await menu(page,2);await details(page);await page.getByLabel('IRP 최초 계좌 가입일',{exact:true}).fill('2020-05-10');await menu(page,5);await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();const prompt=page.getByLabel('AI 분석 요청문',{exact:true});await expect(prompt).toHaveValue(/만 55세 도달/);await expect(prompt).toHaveValue(/가입기간 충족 여부는 추가 확인/);await expect(prompt).toHaveValue(/세후액/);await expect(prompt).not.toHaveValue(/2020-05-10/);
  await page.getByRole('button',{name:'전체 복사',exact:true}).click();await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toContain('연금계좌 수령 조건');
});
