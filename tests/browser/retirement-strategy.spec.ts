import { test, expect, type Page } from '@playwright/test';
const menus=['교사 기본정보','교직원공제회','IRP·연금저축','퇴직급여 계산','은퇴설계 종합','AI 분석 요청문'];
async function menu(page:Page,n:number){await page.getByRole('navigation',{name:'주요 메뉴'}).getByRole('button',{name:menus[n]}).click();}
async function profile(page:Page,birth='1972-01-01',retire='2027-01-01'){
  await page.getByLabel('생년월일',{exact:true}).fill(birth);await page.getByLabel('최초 임용일',{exact:true}).fill('2000-03-01');await page.getByLabel('현재 호봉',{exact:true}).fill('30');await page.getByLabel('승급월',{exact:true}).selectOption('3');await page.getByRole('radio',{name:'명예퇴직',exact:true}).check();await page.getByLabel('명예퇴직 예정일',{exact:true}).fill(retire);
}
async function quote(page:Page,start='2037-01-01',tax='gross'){
  await page.getByText('예상 월연금 직접 입력 (선택)',{exact:true}).click();await page.getByLabel('예상 월연금 금액 (만원)',{exact:true}).fill('200');await page.getByLabel('예상 월연금 조회 기준일',{exact:true}).fill('2026-11-08');await page.getByLabel('예상 월연금 세전·세후',{exact:true}).selectOption(tax);await page.getByLabel('예상 월연금 출처',{exact:true}).selectOption('official');await page.getByLabel('공적연금 지급개시일',{exact:true}).fill(start);await page.getByText('예상 월연금 직접 입력 (선택)',{exact:true}).locator('..').getByRole('checkbox').check();
}
async function split(page:Page,years='10'){
  await menu(page,1);await page.getByLabel('현재 적립금 또는 현재 조회 급여금 (만원)',{exact:true}).fill('3000');await page.getByLabel('앞으로의 월 납입액 (만원)',{exact:true}).fill('10');await page.getByLabel('퇴직 후 장기저축급여를 분할하여 수령하겠습니다.',{exact:true}).check();await page.getByLabel('분할 수령기간',{exact:true}).selectOption(years);
}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-08T12:00:00+09:00')});await page.goto('/');});
test('55세 명퇴10년 공백·선택 생활비·조언5개·원 단위 차이·입력 보존',async({page})=>{
  await profile(page);await menu(page,4);await quote(page);const summary=page.getByRole('region',{name:'은퇴설계 핵심 요약',exact:true});await expect(summary).toContainText('만 55세');await expect(summary).toContainText('120개월');const advice=page.getByRole('region',{name:'규칙 기반 맞춤형 조언',exact:true});await expect(advice.getByRole('article')).toHaveCount(5);await expect(advice).toContainText('미계산 수당');
  const compare=page.getByRole('region',{name:'월 생활비와 수입 비교',exact:true});await expect(compare).toContainText('생활비 미입력');await page.getByLabel('은퇴 후 희망 월 생활비(만원)',{exact:true}).fill('300.0001');await expect(page.getByRole('figure',{name:'공적연금 개시 후 월수입 그래프',exact:true})).toContainText('−100.0001만원');await expect(compare).toContainText('실제 부족액·잉여액 아님');await menu(page,0);await menu(page,4);await expect(page.getByLabel('은퇴 후 희망 월 생활비(만원)',{exact:true})).toHaveValue('300.0001');
});
test('62세 정년3년·60세 명퇴·동시 개시0·퇴직일 변경시 오래된 조회액 제외',async({page})=>{
  await profile(page,'1965-08-31','2027-01-01');await page.getByRole('radio',{name:'정년퇴직',exact:true}).check();await menu(page,4);await quote(page,'2030-08-31');const summary=page.getByRole('region',{name:'은퇴설계 핵심 요약',exact:true});await expect(summary).toContainText('만 62세');await expect(summary).toContainText('36개월');
  await page.getByLabel('공적연금 지급개시일',{exact:true}).fill('2027-08-31');await expect(page.getByRole('region',{name:'은퇴 시기 타임라인',exact:true})).toContainText('개시 전 공백 0');await expect(page.getByRole('figure',{name:'공적연금 개시 전 월수입 그래프',exact:true})).toContainText('비교 구간이 없습니다.');
  await menu(page,0);await page.getByLabel('생년월일',{exact:true}).fill('1967-01-01');await page.getByRole('radio',{name:'명예퇴직',exact:true}).check();await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2027-01-01');await menu(page,4);await expect(summary).toContainText('만 60세');await expect(summary).toContainText('월액 미확인');
  await menu(page,0);await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2028-01-01');await menu(page,4);await expect(summary).toContainText('2028-01-01');await expect(summary).toContainText('만 61세');
});
test('공제회 분할기간·개시 후 지속·종료 후·세전세후 혼합 합산 보류',async({page},info)=>{
  await profile(page);await split(page);await menu(page,4);await quote(page,'2030-01-01');const groups=page.getByRole('region',{name:'자산 활용 방식 구분',exact:true});await expect(groups).toContainText('10년 선택');await expect(groups).not.toContainText('공제회 일시금');await expect(groups).toContainText('남은 가상 잔액');const after=page.getByRole('figure',{name:'공적연금 개시 후 월수입 그래프',exact:true});await expect(after).toContainText('공제회 정기 분할 지급 중');await expect(after).toContainText('공제회 최종 지급일');await expect(after).toContainText('공제회 분할 종료 후');
  await page.getByLabel('예상 월연금 세전·세후',{exact:true}).selectOption('net');await expect(after).toContainText('세전·세후 또는 미확인 기준이 달라');
  if(info.project.name==='mobile')await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('region',{name:'은퇴설계 종합 분석',exact:true}).screenshot({path:info.outputPath('retirement-strategy.png')});
});
test('가입기간 미확인·요건 충족/미충족 계좌를 즉시 인출액에 넣지 않는다',async({page})=>{
  await profile(page);await menu(page,2);await page.getByText('IRP 수령 요건·한도·세금 상세 설정 (선택)',{exact:true}).click();await page.getByLabel('IRP 최초 계좌 가입일',{exact:true}).fill('2025-01-01');await menu(page,4);const groups=page.getByRole('region',{name:'자산 활용 방식 구분',exact:true});await expect(groups).toContainText('퇴직일 요건 미충족');await expect(groups).toContainText('가입기간 등 미확인');await expect(groups).toContainText('즉시 사용 가능한 목돈에 합산하지 않습니다');
  await menu(page,2);await page.getByText('IRP 수령 요건·한도·세금 상세 설정 (선택)',{exact:true}).click();await page.getByLabel('IRP 최초 계좌 가입일',{exact:true}).fill('2020-01-01');await menu(page,4);await expect(groups).toContainText('퇴직일 연령·기간 요건 충족 예상');await expect(groups).toContainText('월 인출계획이 아닙니다');
});
test('월연금 미확인과 공제회 일시금은 월수입0으로 표시하지 않는다',async({page})=>{
  await profile(page);await menu(page,4);const after=page.getByRole('figure',{name:'공적연금 개시 후 월수입 그래프',exact:true});await expect(after).toContainText('월수입 합산 미확인');await expect(after).toContainText('공적연금 월액 미확인');await expect(after.locator('.simple-bar-track>div')).toHaveCount(0);await expect(page.getByRole('region',{name:'규칙 기반 맞춤형 조언',exact:true})).toContainText('추정 불가');
});
test('종합의 생활비·조언이 요청문에 연결되고 익명화·금액 구간·복사 유지',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await profile(page);await split(page);await menu(page,4);await quote(page,'2030-01-01');await page.getByLabel('은퇴 후 희망 월 생활비(만원)',{exact:true}).fill('333.3333');await menu(page,5);await page.getByLabel('금융금액 표시 방식',{exact:true}).selectOption('exact');
  await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();const prompt=page.getByLabel('AI 분석 요청문',{exact:true});await expect(prompt).toHaveValue(/6-2. 은퇴설계 종합 분석/);await expect(prompt).toHaveValue(/3,333,333원/);await expect(prompt).toHaveValue(/검토할 대응/);await expect(prompt).not.toHaveValue(/2030-01-01/);await page.getByRole('button',{name:'전체 복사',exact:true}).click();await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toContain('6-2. 은퇴설계 종합 분석');
});
