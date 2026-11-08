import { test, expect, type Page } from '@playwright/test';
const menus=['교사 기본정보','교직원공제회','IRP·연금저축','퇴직급여 계산','은퇴설계 종합','AI 분석 요청문'];
async function menu(page:Page,index:number){await page.getByRole('navigation',{name:'주요 메뉴'}).getByRole('button',{name:menus[index]}).click();}
async function profile(page:Page,appointment='2016-01-01',date='2026-12-31'){
  await page.getByLabel('생년월일',{exact:true}).fill('1980-05-10');await page.getByLabel('최초 임용일',{exact:true}).fill(appointment);await page.getByLabel('현재 호봉',{exact:true}).fill('22');await page.getByLabel('승급월',{exact:true}).selectOption('3');await page.getByRole('radio',{name:'명예퇴직',exact:true}).check();await page.getByLabel('명예퇴직 예정일',{exact:true}).fill(date);
}
async function pensionIncome(page:Page,legacy=false){
  await page.getByText('공적연금 추정 상세 설정 (선택)',{exact:true}).click();await page.getByLabel('공단 확인 평균기준소득월액 (만원)',{exact:true}).fill('400');await page.getByLabel('공단 확인 소득재분배 반영 평균소득 (만원)',{exact:true}).fill('400');await page.getByLabel('공단 확인 이행률·보정률 (%)',{exact:true}).fill('100');
  if(legacy)await page.getByLabel('구기간 평균보수월액 현가액 (만원)',{exact:true}).fill('300');
  await page.getByLabel('소득·계수·가입기간을 현재 퇴직일 기준으로 확인했습니다.',{exact:true}).check();
}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-08T12:00:00+09:00')});await page.goto('/');});

test('기본정보의 정상 개시·공백과 소득 누락을 보여주고 상세 설정은 접는다',async({page})=>{
  await profile(page);await menu(page,4);const r=page.getByRole('region',{name:'공적연금 요약',exact:true});await expect(r).toContainText('추정에 필요한 정보 확인');await expect(r).toContainText('만 62세');await expect(r).toContainText('2042-05');await expect(r).toContainText('호봉');
  await expect(page.getByText('공적연금 추정 상세 설정 (선택)',{exact:true}).locator('..')).not.toHaveAttribute('open');await expect(page.getByLabel('공단 확인 평균기준소득월액 (만원)',{exact:true})).not.toBeVisible();
});

test('2016년 이후 자동 연금·상한/신뢰도·퇴직일 변경·종합과 AI 연결',async({page},info)=>{
  await profile(page);await menu(page,4);await pensionIncome(page);const r=page.getByRole('region',{name:'공적연금 요약',exact:true});await expect(r.locator('.benefit-amount').first()).toHaveText('79만원 / 월');await expect(r).toContainText('외부 금액 검증 미완료');
  await page.getByText('공적연금 계산 근거·구간·한계',{exact:true}).click();await expect(r).toContainText('132개월');await expect(r).toContainText('조기수령을 선택한 결과가 아닙니다');
  for(const width of info.project.name==='mobile'?[320,390]:[1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.screenshot({path:info.outputPath('automatic-public-pension.png'),fullPage:true});
  await menu(page,5);await page.getByLabel('금융금액 표시 방식',{exact:true}).selectOption('exact');await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();const prompt=page.getByLabel('AI 분석 요청문',{exact:true});await expect(prompt).toHaveValue(/79만원/);await expect(prompt).toHaveValue(/정상 개시연령 만 62세/);await expect(prompt).toHaveValue(/소득 공백/);
  await menu(page,0);await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2027-01-02');await menu(page,4);await expect(r).toContainText('다시 확인');await expect(r).toContainText('만 63세');await page.getByText('공적연금 추정 상세 설정 (선택)',{exact:true}).click();await page.getByLabel('소득·계수·가입기간을 현재 퇴직일 기준으로 확인했습니다.',{exact:true}).check();await expect(r.locator('.benefit-amount').first()).toHaveText('79만원 / 월');
});

test('2009년 이전 구기간과 사학 소득자료를 별도 보관한다',async({page})=>{
  await profile(page,'2005-01-01');await menu(page,4);await pensionIncome(page,true);const r=page.getByRole('region',{name:'공적연금 요약',exact:true});await expect(r.locator('.benefit-amount').first()).toHaveText('162만원 / 월');
  await menu(page,0);await page.getByRole('radio',{name:'사학연금',exact:true}).check();await menu(page,4);await expect(r).toContainText('추정에 필요한 정보 확인');await pensionIncome(page,true);await expect(r.locator('.benefit-amount').first()).toHaveText('162만원 / 월');await page.getByText('공적연금 계산 근거·구간·한계',{exact:true}).click();await expect(page.getByRole('link',{name:'사학연금법·고유 부칙',exact:true})).toBeVisible();
  await menu(page,0);await page.getByRole('radio',{name:'공무원연금',exact:true}).check();await menu(page,4);await expect(r.locator('.benefit-amount').first()).toHaveText('162만원 / 월');
});

test('현재 소득 고정 가정·군복무 실제 산입연도·특수경력 차단',async({page})=>{
  await profile(page);await page.getByLabel('임용 전 군복무기간을 연금 재직기간에 산입했습니까?',{exact:true}).selectOption('approved');await menu(page,4);await pensionIncome(page);const r=page.getByRole('region',{name:'공적연금 요약',exact:true});await expect(r).toContainText('실제 산입연도');
  await page.getByLabel('공단 확인 직역연금 군복무 인정 개월',{exact:true}).fill('24');await page.getByLabel('군복무 실제 산입연도',{exact:true}).fill('2020');await expect(r.locator('.benefit-amount').first()).toHaveText('93만원 / 월');
  await page.getByLabel('공적연금 소득 적용 방식',{exact:true}).selectOption('current');await page.getByLabel('공적연금 현재 기준소득월액 (만원)',{exact:true}).fill('400');await expect(r.locator('.benefit-amount').first()).toHaveText('추정에 필요한 정보 확인');await page.getByLabel('현재 소득을 전체 가입기간의 재평가 평균소득으로 가정하겠습니다.',{exact:true}).check();await expect(r.locator('.benefit-amount').first()).toHaveText('93만원 / 월');
  await page.getByLabel('중단·휴직·시간제·납부예외·체납·재임용·직역 합산·기수령 등 별도 이력이 있습니다.',{exact:true}).check();await expect(r.locator('.benefit-amount').first()).toHaveText('추정에 필요한 정보 확인');await expect(r).toContainText('연도별 공단 인정기간');
});

test('국민연금 독립 납부기간·퇴직 전 정상 수급·직접 조회값 우선 및 복귀',async({page})=>{
  await profile(page,'2005-03-01','2027-02-28');await page.getByLabel('생년월일',{exact:true}).fill('1960-05-10');await page.getByRole('radio',{name:'국민연금',exact:true}).check();await page.getByText('정년일이 다른 경우 직접 수정',{exact:true}).click();await page.getByLabel('기관에서 확인한 정년일 사용',{exact:true}).check();await page.getByLabel('기관에서 확인한 정년일',{exact:true}).fill('2030-02-28');
  await menu(page,4);const r=page.getByRole('region',{name:'공적연금 요약',exact:true});await expect(r).toContainText('임용일과 별도');await page.getByText('공적연금 추정 상세 설정 (선택)',{exact:true}).click();await page.getByLabel('공단 확인 평균기준소득월액 (만원)',{exact:true}).fill('400');await page.getByLabel('국민연금 실제 최초 납부월',{exact:true}).fill('1990-01');await page.getByLabel('퇴직월과 60세 생일 전월 중 빠른 월까지 납부하는 계획을 사용합니다.',{exact:true}).uncheck();await page.getByLabel('국민연금 예상 마지막 납부월',{exact:true}).fill('2019-12');await page.getByLabel('소득·계수·가입기간을 현재 퇴직일 기준으로 확인했습니다.',{exact:true}).check();
  await expect(r).toContainText('2022-06');await expect(r).toContainText('완료 월 0개월');await expect(r).toContainText('360개월');const automatic=await r.locator('.benefit-amount').first().innerText();expect(automatic).not.toContain('정보 확인');
  await page.getByText('예상 월연금 직접 입력 (선택)',{exact:true}).click();await page.getByLabel('예상 월연금 금액 (만원)',{exact:true}).fill('123');await page.getByLabel('예상 월연금 조회 기준일',{exact:true}).fill('2026-11-08');await page.getByLabel('예상 월연금 세전·세후',{exact:true}).selectOption('gross');await page.getByLabel('예상 월연금 출처',{exact:true}).selectOption('official');await page.getByLabel('공적연금 지급개시일',{exact:true}).fill('2022-06-01');await page.getByText('예상 월연금 직접 입력 (선택)',{exact:true}).locator('..').getByRole('checkbox').check();await expect(r.locator('.benefit-amount').first()).toHaveText('123만원 / 월');
  await page.getByLabel('예상 월연금 금액 (만원)',{exact:true}).fill('');await expect(r.locator('.benefit-amount').first()).toHaveText(automatic);
});
