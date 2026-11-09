import {test,expect,type Page} from '@playwright/test';
const names=['교사 기본정보','교직원공제회','IRP·연금저축','퇴직급여 계산','은퇴설계 종합','AI 분석 요청문'];
async function menu(p:Page,n:number){await p.getByRole('navigation',{name:'주요 메뉴'}).getByRole('button',{name:names[n]}).click();}
async function profile(p:Page){for(const [label,value]of [['생년월일','1987-02-12'],['최초 임용일','2017-04-01'],['현재 호봉','20']])await p.getByLabel(label,{exact:true}).fill(value);await p.getByLabel('승급월',{exact:true}).selectOption('4');await p.getByRole('radio',{name:'명예퇴직',exact:true}).check();await p.getByLabel('명예퇴직 예정일',{exact:true}).fill('2039-08-31');}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-08T12:00:00+09:00')});await page.goto('/');});

test('40호봉 기본정보의 참고 월액·최근 상한 도달 가정·정상 개시와 공백 기본 표시·AI',async({page},info)=>{
 await profile(page);await page.getByLabel('현재 호봉',{exact:true}).fill('40');await menu(page,4);
 const pension=page.getByRole('region',{name:'공적연금 요약',exact:true});
 await expect(pension.locator('.benefit-amount').first()).not.toHaveText('추정에 필요한 정보 확인');
 await expect(pension.locator('[aria-label="교원 보수 기반 월연금 시나리오"]')).toContainText('최근 정기승급일');
 await expect(pension.locator(':scope>dl')).toContainText('2052-02-12');await expect(pension.locator(':scope>dl')).toContainText('149개월');await expect(pension.locator(':scope>dl')).toContainText('2026년 봉급표');
 await pension.screenshot({path:info.outputPath('pension-step40.png')});
 await menu(page,5);await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();await expect(page.getByLabel('AI 분석 요청문',{exact:true})).toHaveValue(/40호봉.*계획 가정/);
});

test('구기간 보수·적용비율 확인 후 교원 보수 평균으로 자동 월액·퇴직일 변경은 확인 무효',async({page})=>{
 await profile(page);await page.getByLabel('최초 임용일',{exact:true}).fill('2007-04-01');await page.getByLabel('현재 호봉',{exact:true}).fill('33');await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2037-08-31');await menu(page,4);
 const pension=page.getByRole('region',{name:'공적연금 요약',exact:true});await expect(pension).toContainText('2009년 이전');
 await page.getByText('공적연금 추정 상세 설정 (선택)',{exact:true}).click();await page.getByLabel('구기간 평균보수월액 현가액 (만원)',{exact:true}).fill('300');await page.getByLabel('공단 확인 이행률·보정률 (%)',{exact:true}).fill('95');
 await page.getByLabel('소득·계수·가입기간을 현재 퇴직일 기준으로 확인했습니다.',{exact:true}).check();await expect(pension.locator('.benefit-amount').first()).not.toHaveText('추정에 필요한 정보 확인');await expect(pension).toContainText('가정 기반 시뮬레이션');
 await expect(page.getByLabel('공단 확인 평균기준소득월액 (만원)',{exact:true})).toHaveValue('');
 await menu(page,0);await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2038-08-31');await menu(page,4);await expect(pension.locator('.benefit-amount').first()).toHaveText('추정에 필요한 정보 확인');await expect(pension).toContainText('다시 확인');await expect(page.getByRole('region',{name:'은퇴설계 핵심 요약',exact:true})).toContainText('2052');
});

test('04 핵심 금액 기본 표시·합계 마지막·05 동일 금액·날짜 확인만으로 자동 연금 유지',async({page},info)=>{
 await profile(page);await menu(page,3);
 const h=page.getByRole('region',{name:'명예퇴직수당 예상액',exact:true}),a=page.getByRole('region',{name:'퇴직수당 참고 시뮬레이션',exact:true}),total=page.getByRole('region',{name:'퇴직급여 참고 합계',exact:true});
 await expect(h.locator('.benefit-amount')).toBeVisible();await expect(a.locator('.benefit-amount').first()).toBeVisible();await expect(page.getByText('완전한 합계 확인 불가',{exact:true})).toHaveCount(0);
 expect(await h.evaluate((el)=>Boolean(el.compareDocumentPosition(document.querySelector('[aria-label="퇴직수당 참고 시뮬레이션"]')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 expect(await a.evaluate((el)=>Boolean(el.compareDocumentPosition(document.querySelector('[aria-label="퇴직급여 참고 합계"]')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 const honorary=await h.locator('.benefit-amount').innerText(),allowance=await a.locator('.benefit-amount').first().innerText(),sum=await total.locator('.benefit-amount').innerText();
 await page.screenshot({path:info.outputPath('benefits-default.png'),fullPage:true});
 await menu(page,4);await expect(page.getByRole('region',{name:'명예퇴직수당 예상액',exact:true}).locator('.benefit-amount')).toHaveText(honorary);await expect(page.getByRole('region',{name:'퇴직수당 예상액',exact:true}).locator('.benefit-amount')).toHaveText(allowance);await expect(total.locator('.benefit-amount')).toHaveText(sum);
 const pension=page.getByRole('region',{name:'공적연금 요약',exact:true}),before=await pension.locator('.benefit-amount').first().innerText();
 await page.getByText('공적연금 추정 상세 설정 (선택)',{exact:true}).click();await page.getByLabel('소득·계수·가입기간을 현재 퇴직일 기준으로 확인했습니다.',{exact:true}).check();await expect(pension.locator('.benefit-amount').first()).toHaveText(before);
 await menu(page,0);await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2040-08-31');await menu(page,4);await expect(pension.locator('.benefit-amount').first()).not.toHaveText(before);await expect(pension.locator('.benefit-amount').first()).not.toHaveText('추정에 필요한 정보 확인');
});
test('기본정보만으로3개 월연금·명목/2026 환산·급여 근거 기본 접힘',async({page},info)=>{
 await profile(page);await menu(page,4);const pension=page.getByRole('region',{name:'공적연금 요약',exact:true});await expect(pension.locator('.benefit-amount').first()).not.toHaveText('추정에 필요한 정보 확인');await expect(pension).toContainText('가정 기반 시뮬레이션');await expect(pension).toContainText('2052년 개시 명목');await expect(pension.locator('[aria-label="교원 보수 기반 월연금 시나리오"]>p>strong')).toHaveCount(3);await expect(pension).toContainText('2026 보수수준 환산');
 const pay=pension.getByText('교원 보수 추정 가정·연도별 근거',{exact:true}).locator('..');await expect(pay).not.toHaveAttribute('open');await pay.locator('summary').first().click();await expect(pay).toContainText('교직수당 월25만원');const year=pay.getByRole('row').filter({has:page.getByRole('cell',{name:'2027 · 12개월',exact:true})});await expect(year).toContainText('240만원');await expect(year).toContainText('192만원');
 await pay.locator('summary').first().click();if(info.project.name==='mobile')await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await pension.screenshot({path:info.outputPath('teacher-pension.png')});
});
test('수당3개 참고 합계는 미래 명목끼리·퇴직일 변경으로 전체 갱신',async({page},info)=>{
 await profile(page);await menu(page,3);const card=page.getByRole('region',{name:'퇴직급여 참고 합계',exact:true});await expect(card).toContainText('동일 가정 기준 세전 참고 합계');await expect(card).toContainText('2039년 미래 명목');await expect(card.locator(':scope>.profile-context')).toHaveCount(3);await expect(card).not.toContainText('합계 보류');const before=await card.locator('.benefit-amount').innerText();await card.screenshot({path:info.outputPath('teacher-benefits.png')});
 await menu(page,4);await expect(page.getByRole('region',{name:'퇴직수당 예상액',exact:true})).toContainText('미래 명목');const monthly=await page.getByRole('region',{name:'공적연금 요약',exact:true}).locator('.benefit-amount').first().innerText();await menu(page,0);await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2040-08-31');await menu(page,3);await expect(card.locator('.benefit-amount')).not.toHaveText(before);await menu(page,4);await expect(page.getByRole('region',{name:'공적연금 요약',exact:true}).locator('.benefit-amount').first()).not.toHaveText(monthly);
});
test('구기간 소득 미확인은 전체 합계 보류·확인자료 입력 후2026 참고 합계만',async({page})=>{
 await profile(page);await page.getByLabel('최초 임용일',{exact:true}).fill('2007-04-01');await page.getByLabel('현재 호봉',{exact:true}).fill('33');await menu(page,4);const pension=page.getByRole('region',{name:'공적연금 요약',exact:true});await expect(pension.locator('.benefit-amount').first()).toHaveText('추정에 필요한 정보 확인');await expect(pension).toContainText('2009년 이전');await expect(page.getByRole('region',{name:'은퇴설계 핵심 요약',exact:true})).toContainText('2052');
 await menu(page,3);const total=page.getByRole('region',{name:'퇴직급여 참고 합계',exact:true});await expect(total.locator('.benefit-amount')).toHaveText('전체 참고 합계 확인 필요');await page.getByText('계산 근거 보기 (퇴직수당)',{exact:true}).click();await page.getByLabel('2009년 이전분 최종보수월액 현가액 (만원, 2026년 기준)',{exact:true}).fill('300');await page.getByLabel('공단 확인 구기간 현가액을 현재 임용일·퇴직일 기준으로 확인했습니다.',{exact:true}).check();await expect(total.locator('.benefit-amount')).not.toHaveText('전체 참고 합계 확인 필요');await expect(total).toContainText('2026년 고정 기준');
});
test('공식 조회 우선·오래된 조회를 자동 시나리오로 대체하지 않는다',async({page})=>{
 await profile(page);await menu(page,4);await page.getByText('예상 월연금 직접 입력 (선택)',{exact:true}).click();await page.getByLabel('예상 월연금 금액 (만원)',{exact:true}).fill('200');await page.getByLabel('예상 월연금 조회 기준일',{exact:true}).fill('2026-11-08');await page.getByLabel('예상 월연금 세전·세후',{exact:true}).selectOption('gross');await page.getByLabel('예상 월연금 출처',{exact:true}).selectOption('official');await page.getByLabel('공적연금 지급개시일',{exact:true}).fill('2052-02-01');await page.getByText('예상 월연금 직접 입력 (선택)',{exact:true}).locator('..').getByRole('checkbox').check();const pension=page.getByRole('region',{name:'공적연금 요약',exact:true});await expect(pension.locator('.benefit-amount').first()).toHaveText('200만원 / 월');await expect(pension).toContainText('공식 조회값');await expect(pension.locator('[aria-label="교원 보수 기반 월연금 시나리오"]')).toHaveCount(0);
 await menu(page,0);await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2040-08-31');await menu(page,4);await expect(pension.locator('.benefit-amount').first()).toHaveText('추정에 필요한 정보 확인');await expect(pension).toContainText('재확인');
});
test('가정 해제·사학·국민연금에는 교원 자동 월액을 강제하지 않음',async({page})=>{
 await profile(page);await page.getByText('교원 표준 보수·연금 추정 가정',{exact:true}).click();await page.getByLabel('봉급 연3% 상승·담임수당 계속·일반 교원 표준 수당 가정 사용',{exact:true}).uncheck();await menu(page,4);await expect(page.getByRole('region',{name:'공적연금 요약',exact:true}).locator('.benefit-amount').first()).toHaveText('추정에 필요한 정보 확인');
 await menu(page,0);await page.getByRole('radio',{name:'사학연금',exact:true}).check();await menu(page,4);await expect(page.locator('[aria-label="교원 보수 기반 월연금 시나리오"]')).toHaveCount(0);await menu(page,0);await page.getByRole('radio',{name:'국민연금',exact:true}).check();await menu(page,4);await expect(page.locator('[aria-label="교원 보수 기반 월연금 시나리오"]')).toHaveCount(0);
});
test('AI에3%·담임·시점·참고 합계 반영·익명 복사·모바일6메뉴',async({page,context},info)=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await profile(page);await menu(page,5);await page.getByLabel('은퇴 후 희망 월 생활비(만원)',{exact:true}).fill('350');await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();const draft=page.getByLabel('AI 분석 요청문',{exact:true});await expect(draft).toHaveValue(/봉급표 연 3%/);await expect(draft).toHaveValue(/담임수당 계속/);await expect(draft).toHaveValue(/미래 명목/);await expect(draft).toHaveValue(/동일 가정 기준 세전 참고 합계/);await expect(draft).not.toHaveValue(/1987-02-12|2017-04-01/);await page.getByRole('button',{name:'전체 복사',exact:true}).click();await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toContain('봉급표 연 3%');
 if(info.project.name==='mobile')await page.setViewportSize({width:320,height:844});for(let n=0;n<6;n++){await menu(page,n);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});

test('1월1일 미래 소득 경계·펼친 보수표 모바일·참고 합계 연결',async({page},info)=>{
 await profile(page);await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2040-01-01');await menu(page,3);
 const total=page.getByRole('region',{name:'퇴직급여 참고 합계',exact:true});await expect(total).toContainText('2040년 미래 명목');
 // Independent fixed fixture: 9,912,217 won income proxy × 273/12 years × 39%, then integer-manwon display.
 await expect(total.locator(':scope>.profile-context').nth(1)).toContainText('퇴직수당 8,795만원');
 await menu(page,4);await page.getByText('교원 보수 추정 가정·연도별 근거',{exact:true}).click();
 if(info.project.name==='mobile')await page.setViewportSize({width:320,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.getByRole('table',{name:'교원 표준 보수 경로 · 과거는2026 수준 재구성 / 미래는 해당 연도 명목',exact:true})).toBeVisible();
});
