import { test, expect, type Page } from '@playwright/test';
const names = ['교사 기본정보','교직원공제회','IRP·연금저축','퇴직급여 계산','은퇴설계 종합','AI 분석 요청문'];
async function menu(page: Page, index: number) { await page.getByRole('navigation',{name:'주요 메뉴'}).getByRole('button',{name:names[index]}).click(); }
async function profile(page: Page, date='2030-11-08') {
  await menu(page,0); await page.getByLabel('생년월일',{exact:true}).fill('1980-05-10'); await page.getByLabel('최초 임용일',{exact:true}).fill('2005-03-01');
  await page.getByLabel('현재 호봉',{exact:true}).fill('22'); await page.getByLabel('승급월',{exact:true}).selectOption('3');
  await page.getByRole('radio',{name:'명예퇴직',exact:true}).check(); await page.getByLabel('명예퇴직 예정일',{exact:true}).fill(date);
}
async function assets(page: Page) {
  await menu(page,1);await page.getByLabel('현재 적립금 또는 현재 조회 급여금 (만원)',{exact:true}).fill('100');await page.getByLabel('앞으로의 월 납입액 (만원)',{exact:true}).fill('10');
  await menu(page,2);for(const title of ['IRP','연금저축']){await page.getByLabel(`${title} 현재 적립금 또는 평가금액 (만원)`,{exact:true}).fill('100');await page.getByLabel(`${title} 앞으로의 월 납입액 (만원)`,{exact:true}).fill('10');}
}
async function quote(page: Page, title: string, amount: string, tax='gross') {
  await page.getByText(`${title} 직접 입력 (선택)`,{exact:true}).click();await page.getByLabel(`${title} 금액 (만원)`,{exact:true}).fill(String(Number(amount)/10000));
  await page.getByLabel(`${title} 조회 기준일`,{exact:true}).fill('2026-11-08');await page.getByLabel(`${title} 세전·세후`,{exact:true}).selectOption(tax);
  await page.getByLabel(`${title} 출처`,{exact:true}).selectOption('official');
  await page.getByText(`${title} 직접 입력 (선택)`,{exact:true}).locator('..').getByRole('checkbox').check();
}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-08T12:00:00+09:00')});await page.goto('/');});

test('6개 메뉴·학교 구분 제거·연금 3개·국민연금 별도 처리',async({page})=>{
  const nav=page.getByRole('navigation',{name:'주요 메뉴'});await expect(nav.getByRole('button')).toHaveCount(6);
  await expect(page.getByRole('radio',{name:'공무원연금',exact:true})).toBeVisible();await expect(page.getByRole('radio',{name:'사학연금',exact:true})).toBeVisible();await expect(page.getByRole('radio',{name:'국민연금',exact:true})).toBeVisible();
  await expect(page.getByText('학교 구분',{exact:true})).toHaveCount(0);await expect(page.getByText('육아휴직',{exact:true})).toHaveCount(0);
  await profile(page);await page.getByRole('radio',{name:'국민연금',exact:true}).check();await expect(page.getByText('국민연금 군복무 크레딧',{exact:true})).toBeVisible();
  await expect(page.getByLabel('임용 전 군복무기간을 연금 재직기간에 산입했습니까?',{exact:true})).toHaveCount(0);
  await page.getByText('정년일이 다른 경우 직접 수정',{exact:true}).click();await page.getByLabel('기관에서 확인한 정년일 사용',{exact:true}).check();await page.getByLabel('기관에서 확인한 정년일',{exact:true}).fill('2040-02-29');
  await menu(page,3);await page.getByText('퇴직수당 예상액',{exact:true}).click();await expect(page.getByText('국민연금 가입자는 공무원·사학 퇴직수당 자동 지급 대상이 아닙니다.',{exact:false})).toBeVisible();
});
test('승급월 경계·군 산입·정년과 명퇴의 배타 선택 및 날짜 오류',async({page})=>{
  await profile(page,'2027-02-28');const condition=page.getByRole('region',{name:'공통 퇴직 조건'});await expect(condition).toContainText('22호봉');
  await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2027-03-01');await expect(condition).toContainText('23호봉');
  await page.getByLabel('임용 전 군복무기간을 연금 재직기간에 산입했습니까?',{exact:true}).selectOption('approved');
  await page.getByRole('radio',{name:'정년퇴직',exact:true}).check();await expect(page.getByRole('radio',{name:'명예퇴직',exact:true})).not.toBeChecked();await expect(page.getByLabel('명예퇴직 예정일',{exact:true})).toBeDisabled();await expect(condition).toContainText('2042-08-31');
  await page.getByRole('radio',{name:'명예퇴직',exact:true}).check();await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2042-08-31');await expect(page.getByLabel('기본정보 확인 필요')).toContainText('명예퇴직일은 정년일보다 빨라야');
});
test('최소 공제회 입력·고정 5%·0과 미입력·분할 기간 및 매월 25일',async({page})=>{
  await profile(page);await menu(page,1);await expect(page.getByRole('textbox')).toHaveCount(2);
  const result=page.getByRole('region',{name:'퇴직 시 예상 장기저축급여 적립금',exact:true});await expect(result).toContainText('계산 불가');
  await page.getByLabel('현재 적립금 또는 현재 조회 급여금 (만원)',{exact:true}).fill('0');await page.getByLabel('앞으로의 월 납입액 (만원)',{exact:true}).fill('0');await expect(result.locator('.benefit-amount')).toHaveText('0만원');
  await page.getByLabel('현재 적립금 또는 현재 조회 급여금 (만원)',{exact:true}).fill('1000');
  const amount=await result.locator('.benefit-amount').innerText();await page.getByLabel('퇴직 후 장기저축급여를 분할하여 수령하겠습니다.',{exact:true}).check();
  for(const years of [5,10,15,20,25,30]){await page.getByLabel('분할 수령기간',{exact:true}).selectOption(String(years));await expect(page.getByRole('region',{name:'가정 기반 분할 수령 결과'})).toContainText(`매월 25일 · ${years}년`);}
  await expect(result.locator('.benefit-amount')).toHaveText(amount);await expect(page.getByRole('region',{name:'공제회 일시 수령 결과'})).toHaveCount(0);
  await page.getByText('적용 이율·가입 조건·계산 근거',{exact:true}).click();await expect(page.getByText('한국교직원공제회 2026년 7월 1일 기준 장기저축급여율 연복리 5.00%',{exact:false})).toBeVisible();
});
test('두 연금계좌는 각 2개 입력·고정 가정·재투자 미반영·독립 계산',async({page})=>{
  await profile(page);await menu(page,2);await expect(page.getByRole('textbox')).toHaveCount(4);await expect(page.getByRole('combobox')).toHaveCount(0);
  await page.getByLabel('IRP 현재 적립금 또는 평가금액 (만원)',{exact:true}).fill('0');await page.getByLabel('IRP 앞으로의 월 납입액 (만원)',{exact:true}).fill('10');
  const irp=page.getByRole('region',{name:'퇴직 시 IRP 예상 적립금',exact:true});await expect(irp.locator('.benefit-amount')).not.toHaveText('미입력 또는 계산 불가');await expect(page.getByRole('region',{name:'연금계좌 예상 적립금 합계'})).toContainText('미입력 또는 계산 불가');
  await page.getByLabel('연금저축 현재 적립금 또는 평가금액 (만원)',{exact:true}).fill('0');await page.getByLabel('연금저축 앞으로의 월 납입액 (만원)',{exact:true}).fill('0');
  const sum=page.getByRole('region',{name:'연금계좌 예상 적립금 합계'}).locator('.benefit-amount'),before=await sum.innerText();await page.getByLabel('세액공제 환급액을 재투자하겠습니다.',{exact:true}).check();await expect(sum).toHaveText(before);await expect(page.getByText('재투자 효과 미반영',{exact:false})).toBeVisible();
});
test('공통 퇴직일 변경이 모든 적립금·종합·AI에 즉시 연결된다',async({page})=>{
  await profile(page);await assets(page);await menu(page,4);const card=page.getByRole('region',{name:'주요 적립금 합계'}).locator('.benefit-amount'),before=await card.innerText();
  await expect(page.getByRole('figure',{name:'주요 적립금 구성 그래프'})).toBeVisible();await expect(page.getByRole('region',{name:'공적연금 요약'})).toContainText('공식 조회 필요');
  await menu(page,0);await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2031-11-08');await menu(page,4);await expect(card).not.toHaveText(before);await expect(page.getByRole('region',{name:'예상 퇴직일 요약'})).toContainText('2031-11-08');
  await menu(page,5);await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();await expect(page.getByLabel('AI 분석 요청문',{exact:true})).toHaveValue(/가정 연 7%/);
});
test('급여 카드는 접혀 있고 명퇴에만 명퇴수당 표시·공식 입력·선정·세금 혼합 방지',async({page})=>{
  await profile(page);await menu(page,3);const retirement=page.getByText('퇴직수당 예상액',{exact:true}).locator('..');await expect(retirement).not.toHaveAttribute('open');
  await page.getByText('퇴직수당 예상액',{exact:true}).click();await quote(page,'퇴직수당','1000000');await expect(page.getByRole('region',{name:'퇴직수당 결과'})).toContainText('100만원');
  await page.getByText('명예퇴직수당 예상액',{exact:true}).click();await quote(page,'명예퇴직수당','2000000');await expect(page.getByRole('region',{name:'명예퇴직수당 결과'})).toContainText('미입력 또는 계산 불가');
  await page.getByLabel('명예퇴직수당 지급 자격',{exact:true}).selectOption('confirmed');await page.getByLabel('명예퇴직수당 실제 선정',{exact:true}).selectOption('selected');await expect(page.getByRole('region',{name:'퇴직급여 합계'}).locator('.benefit-amount')).toHaveText('300만원');
  await page.getByLabel('명예퇴직수당 세전·세후',{exact:true}).selectOption('net');await expect(page.getByRole('region',{name:'퇴직급여 합계'})).toContainText('완전한 합계 확인 불가');
  await menu(page,0);await page.getByRole('radio',{name:'정년퇴직',exact:true}).check();await menu(page,3);await expect(page.getByText('명예퇴직수당 예상액',{exact:true})).toHaveCount(0);await expect(page.getByText('퇴직수당 예상액',{exact:true})).toBeVisible();
});
test('공식 연금은 해당 퇴직일에서만 재사용하고 다른 제도와 섞지 않는다',async({page})=>{
  await profile(page);await menu(page,4);await quote(page,'예상 월연금','1234567');await page.getByLabel('공적연금 지급개시일',{exact:true}).fill('2035-01-01');
  const r=page.getByRole('region',{name:'공적연금 요약'});await expect(r).toContainText('123.4567만원 / 월');await expect(r).toContainText('공식 조회값');
  await menu(page,0);await page.getByLabel('명예퇴직 예정일',{exact:true}).fill('2031-11-08');await menu(page,4);await expect(r).toContainText('공식 조회 필요');await expect(r).toContainText('재확인 필요');
  await menu(page,0);await page.getByRole('radio',{name:'사학연금',exact:true}).check();await menu(page,4);await expect(page.getByLabel('예상 월연금 금액 (만원)',{exact:true})).toHaveValue('');
});
test('기본정보만으로 AI 6개 목적·익명화·편집·복사·변경 후 재생성',async({page})=>{
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as unknown as {copied:string}).copied=text;}}}));
  await profile(page);await page.getByRole('button',{name:'AI 요청문으로 바로 이동',exact:true}).click();await expect(page.getByRole('radio')).toHaveCount(6);await expect(page.getByLabel('익명화 모드',{exact:true})).toBeChecked();
  await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();const draft=page.getByLabel('AI 분석 요청문',{exact:true});const text=await draft.inputValue();expect(text).toContain('미입력 또는 계산 불가');expect(text).not.toContain('1980-05-10');expect(text).not.toContain('2005-03-01');expect(text).toContain('2005년');
  await draft.fill(text+'\n투자 위험을 더 설명해 주세요.');await page.getByRole('button',{name:'전체 복사',exact:true}).click();await expect(page.getByRole('status')).toContainText('복사했습니다');expect(await page.evaluate(()=>(window as unknown as {copied:string}).copied)).toContain('투자 위험');
  await menu(page,0);await page.getByLabel('현재 호봉',{exact:true}).fill('23');await menu(page,5);await expect(page.getByRole('button',{name:'전체 복사',exact:true})).toBeDisabled();await expect(page.getByText('입력 또는 계산 조건이 변경되었습니다.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'AI 요청문 다시 생성',exact:true}).click();await expect(draft).toHaveValue(/23호봉/);
});
test('AI 개인정보·금액 옵션·복사 실패 시 수동 선택·공식 링크',async({page})=>{
  await profile(page);await menu(page,5);await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}}));
  await page.getByLabel('추가 질문',{exact:true}).fill('소득 공백을 검토해 주세요.\n이메일: private@example.test');await page.getByLabel('추가 질문에 개인정보가 없는지 검토했습니다.',{exact:true}).check();await page.getByLabel('금융금액 표시 방식',{exact:true}).selectOption('range');
  await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();const draft=page.getByLabel('AI 분석 요청문',{exact:true});expect(await draft.inputValue()).not.toContain('private@example.test');
  await page.getByRole('button',{name:'전체 복사',exact:true}).click();await expect(page.getByRole('status')).toContainText('자동 복사에 실패');expect(await draft.evaluate((n:HTMLTextAreaElement)=>n.selectionEnd-n.selectionStart)).toBe((await draft.inputValue()).length);
  for(const [name,url] of [['ChatGPT','https://chatgpt.com/'],['Gemini','https://gemini.google.com/'],['Claude','https://claude.ai/']])await expect(page.getByRole('link',{name:`${name} 공식 사이트`,exact:true})).toHaveAttribute('href',url);
  await draft.fill('이메일: private@example.test');await expect(page.getByRole('button',{name:'전체 복사',exact:true})).toBeDisabled();
});
test('전 메뉴 입력 유지·모바일 폭·새로고침 초기화·외부 전송과 저장 없음',async({page},info)=>{
  const external:string[]=[],writes:string[]=[],errors:string[]=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).hostname!=='127.0.0.1')external.push(r.url());if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await profile(page);await assets(page);
  for(let i=0;i<6;i++){await menu(page,i);await expect(page.getByRole('heading',{name:names[i],exact:true})).toBeVisible();await expect(page.getByText('정밀 계산 모드 · 준비 중',{exact:true})).toBeVisible();for(const width of info.project.name==='mobile'?[320,390,640]:[900,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}}
  await menu(page,2);await expect(page.getByLabel('IRP 현재 적립금 또는 평가금액 (만원)',{exact:true})).toHaveValue('100');
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
  await menu(page,4);await page.screenshot({path:info.outputPath('simple-overview.png'),fullPage:true});
  await page.reload();await expect(page.getByLabel('생년월일',{exact:true})).toHaveValue('');await menu(page,2);await expect(page.getByLabel('IRP 현재 적립금 또는 평가금액 (만원)',{exact:true})).toHaveValue('');expect(errors).toEqual([]);expect(external).toEqual([]);expect(writes).toEqual([]);
});

test('금액 구분 표시·편집·삭제 후 결과 갱신과 빈 상태',async({page})=>{
  await profile(page);await menu(page,1);
  const input=page.getByLabel('현재 적립금 또는 현재 조회 급여금 (만원)',{exact:true});
  const monthly=page.getByLabel('앞으로의 월 납입액 (만원)',{exact:true});
  await input.fill('123.4567');await monthly.fill('0');await expect(input).toHaveValue('123.4567');
  const result=page.getByRole('region',{name:'퇴직 시 예상 장기저축급여 적립금',exact:true});
  await expect(result).toHaveClass(/result-ready/);const before=await result.locator('.benefit-amount').innerText();
  await input.fill('234.5678');await expect(input).toHaveValue('234.5678');await expect(result.locator('.benefit-amount')).not.toHaveText(before);
  await input.fill('');await expect(result).toHaveClass(/result-empty/);await expect(result).toContainText('입력 정보와 아래 확인 사항');
  await input.fill('0');await expect(result.locator('.benefit-amount')).toHaveText('0만원');
});

test('새 레이아웃·터치 크기·기본 설명 대비·대시보드와 카드 접기',async({page},info)=>{
  await profile(page);await menu(page,1);
  const nav=page.getByRole('navigation',{name:'주요 메뉴'});
  expect(await nav.evaluate(n=>n.scrollWidth<=n.clientWidth)).toBe(true);
  const height=await page.getByLabel('현재 적립금 또는 현재 조회 급여금 (만원)',{exact:true}).evaluate(n=>n.getBoundingClientRect().height);expect(height).toBeGreaterThanOrEqual(44);
  const contrast=await page.locator('.form-card .profile-help').first().evaluate(n=>{const rgb=getComputedStyle(n).color.match(/\d+/g)!.slice(0,3).map(Number);const l=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return 1.05/(.2126*l[0]+.7152*l[1]+.0722*l[2]+.05);});expect(contrast).toBeGreaterThanOrEqual(4.5);
  await assets(page);await menu(page,4);await expect(page.getByRole('figure',{name:'주요 적립금 구성 그래프'})).toBeVisible();
  await page.screenshot({path:info.outputPath('redesigned-dashboard.png'),fullPage:true});
  await menu(page,0);await page.screenshot({path:info.outputPath('redesigned-profile.png'),fullPage:true});
});

test('만원 입력·천 단위·소수·음수/문자/범위 차단·빈 값 보존',async({page})=>{
  await profile(page);await menu(page,1);const input=page.getByLabel('현재 적립금 또는 현재 조회 급여금 (만원)',{exact:true});
  await input.fill('3000');await expect(input).toHaveValue('3,000');await expect(page.getByText('3,000만원 = 30,000,000원',{exact:false})).toBeVisible();
  await expect(input).toHaveAttribute('inputmode','decimal');
  await page.getByLabel('앞으로의 월 납입액 (만원)',{exact:true}).fill('30');await expect(page.getByText('30만원 = 300,000원',{exact:false})).toBeVisible();
  await input.fill('0.5');await expect(page.getByText('0.5만원 = 5,000원',{exact:false})).toBeVisible();
  await input.fill('1.');await expect(input).toHaveValue('1.');await expect(page.getByText('1.만원 = 10,000원',{exact:false})).toBeVisible();
  for(const invalid of ['-1','abc','0.00001','999999999999999999999']){await input.fill(invalid);await expect(input).toHaveAttribute('aria-invalid','true');await expect(input).toHaveValue('1.');}
  await input.fill('0');await expect(input).toHaveAttribute('aria-invalid','false');await expect(page.getByText('0만원 = 0원',{exact:false})).toBeVisible();
  await input.fill('');await expect(page.getByRole('region',{name:'퇴직 시 예상 장기저축급여 적립금',exact:true})).toContainText('계산 불가');
  await input.fill('10000');await expect(input).toHaveValue('10,000');await menu(page,2);await menu(page,1);await expect(input).toHaveValue('10,000');
});

test('공식 월연금 450만원·수당 입력 단위 고정·AI 원 단위 정확성',async({page})=>{
  await profile(page);await menu(page,3);await page.getByText('퇴직수당 예상액',{exact:true}).click();await quote(page,'퇴직수당','30000000');
  await expect(page.getByRole('region',{name:'퇴직수당 결과'})).toContainText('3,000만원');await expect(page.getByLabel('퇴직수당 단위',{exact:true})).toHaveCount(0);
  await menu(page,4);await quote(page,'예상 월연금','4500000');await page.getByLabel('공적연금 지급개시일',{exact:true}).fill('2035-01-01');
  await expect(page.getByRole('region',{name:'공적연금 요약'})).toContainText('450만원 / 월');
  await menu(page,5);await page.getByLabel('금융금액 표시 방식',{exact:true}).selectOption('exact');await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();
  await expect(page.getByLabel('AI 분석 요청문',{exact:true})).toHaveValue(/4,500,000원/);await expect(page.getByLabel('AI 분석 요청문',{exact:true})).not.toHaveValue(/45,000,000,000원/);
});
