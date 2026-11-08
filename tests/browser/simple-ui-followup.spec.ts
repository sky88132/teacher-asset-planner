import {test,expect,type Page} from '@playwright/test';
const menus=['교사 기본정보','교직원공제회','IRP·연금저축','퇴직급여 계산','은퇴설계 종합','AI 분석 요청문'];
async function menu(p:Page,n:number){await p.getByRole('navigation',{name:'주요 메뉴'}).getByRole('button',{name:menus[n]}).click();}
async function profile(p:Page){await p.getByLabel('생년월일',{exact:true}).fill('1972-01-01');await p.getByLabel('최초 임용일',{exact:true}).fill('2000-03-01');await p.getByLabel('현재 호봉',{exact:true}).fill('30');await p.getByLabel('승급월',{exact:true}).selectOption('3');await p.getByRole('radio',{name:'명예퇴직',exact:true}).check();await p.getByLabel('명예퇴직 예정일',{exact:true}).fill('2030-01-01');}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-08T12:00:00+09:00')});await page.goto('/');});
test('재투자 체크 하나·미반영/반영 비교·연도별 내역 제거·입력과 해제 복구',async({page},info)=>{
 await profile(page);await menu(page,2);for(const title of ['IRP','연금저축']){await page.getByLabel(title+' 현재 적립금 또는 평가금액 (만원)',{exact:true}).fill('1000');await page.getByLabel(title+' 앞으로의 월 납입액 (만원)',{exact:true}).fill('25');}
 const sum=page.getByRole('region',{name:'연금계좌 예상 적립금 합계',exact:true});const before=await sum.locator('.benefit-amount').innerText();
 await page.getByLabel('세액공제 환급액을 재투자하겠습니다.',{exact:true}).check();await expect(sum.locator('.benefit-amount')).not.toHaveText(before);await expect(sum).toContainText('재투자 미반영');await expect(sum).toContainText('재투자 반영');
 await expect(page.getByLabel('재투자 가정 연 총급여 (만원, 선택)',{exact:true})).toHaveCount(0);await expect(page.getByText(/연도별 예정 납입:/)).toHaveCount(0);await expect(page.getByText('납입·재투자 가정 자세히 보기',{exact:true}).locator('..')).not.toHaveAttribute('open');
 await page.screenshot({path:info.outputPath('compact-accounts.png'),fullPage:true});await page.getByLabel('세액공제 환급액을 재투자하겠습니다.',{exact:true}).uncheck();await expect(sum.locator('.benefit-amount')).toHaveText(before);
});
test('생활비는06 분석 유형 앞에 한 번만·05 연동·생성후 변경시 복사 차단',async({page})=>{
 await profile(page);await menu(page,4);await expect(page.getByLabel('은퇴 후 희망 월 생활비(만원)',{exact:true})).toHaveCount(0);await menu(page,5);
 const cost=page.getByLabel('은퇴 후 희망 월 생활비(만원)',{exact:true});await expect(cost).toHaveCount(1);await cost.fill('300.0001');
 const order=await cost.evaluate(node=>!!(node.compareDocumentPosition(document.querySelector('fieldset')!)&Node.DOCUMENT_POSITION_FOLLOWING));expect(order).toBe(true);
 await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();await expect(page.getByLabel('AI 분석 요청문',{exact:true})).toHaveValue(/300만원/);await cost.fill('350');await expect(page.getByRole('button',{name:'전체 복사',exact:true})).toBeDisabled();
 await menu(page,4);await expect(page.getByRole('region',{name:'월 생활비와 수입 비교',exact:true})).toContainText('350만원');await menu(page,5);await expect(cost).toHaveValue('350');await cost.fill('');await page.getByRole('button',{name:'AI 요청문 다시 생성',exact:true}).click();await expect(page.getByLabel('AI 분석 요청문',{exact:true})).toHaveValue(/생활비.*미입력/);
});
test('대시보드 핵심·그래프·세 조언 범주·상세 기본 접힘·전 메뉴320px',async({page},info)=>{
 await profile(page);await menu(page,4);await expect(page.getByRole('region',{name:'은퇴설계 핵심 요약',exact:true})).toBeVisible();await expect(page.getByRole('figure',{name:'주요 적립금 구성 그래프',exact:true})).toBeVisible();
 const advice=page.getByRole('region',{name:'규칙 기반 맞춤형 조언',exact:true});await expect(advice.locator('.retirement-advice-group')).toHaveCount(3);await expect(advice.getByRole('article')).toHaveCount(0);await advice.getByText('소득 공백과 생활비 조언 자세히 보기',{exact:true}).click();await expect(advice.getByRole('article')).toHaveCount(2);
 await expect(page.getByText('자산 활용 조건 자세히 보기',{exact:true}).locator('..')).not.toHaveAttribute('open');await expect(page.getByRole('table')).toHaveCount(0);
 if(info.project.name==='mobile')await page.setViewportSize({width:320,height:844});expect(await page.locator('.retirement-summary').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(2);await page.screenshot({path:info.outputPath('retirement-dashboard.png'),fullPage:true});
 for(let n=0;n<6;n++){await menu(page,n);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByRole('heading',{name:menus[n],exact:true,level:1})).toBeVisible();}
});
