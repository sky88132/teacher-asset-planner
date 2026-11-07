import { test, expect, type Page } from '@playwright/test';
async function menu(page: Page, name: string) { await page.getByRole('navigation', { name:'주요 메뉴' }).getByRole('button', { name }).click(); }
async function open(page: Page, populated = true) {
  await page.goto('/'); await menu(page,'AI 분석 요청문');
  await expect(page.getByRole('heading',{name:'AI 분석 요청문',exact:true})).toBeVisible();
  if (!populated) return;
  await menu(page,'교사 기본정보');
  await page.getByLabel('생년월일',{exact:true}).fill('1980-01-01'); await page.getByLabel('최초 임용일',{exact:true}).fill('2005-03-01');
  await menu(page,'IRP·연금저축');
  for(const [label,value] of Object.entries({'연금계좌 잔액 기준일':'2026-01-01','연금계좌 퇴직예정일':'2030-01-01','IRP 현재 평가금액 (원)':'12345678','IRP 연간 납입액 (원)':'1200000','IRP 예상 연평균 수익률 (%)':'0','IRP 예상 연 수수료율 (%)':'0','IRP 납입 종료일':'2030-01-01','IRP 수령 시작일':'2030-01-01','IRP 예상 수령기간 (년)':'10'})) await page.getByLabel(label,{exact:true}).fill(value);
  await menu(page,'AI 분석 요청문');
}
async function generate(page: Page) {
  await page.getByLabel('포함 정보의 종류·익명화·금액 표시와 누락 사항을 확인했습니다.',{exact:true}).check();
  await page.getByRole('button',{name:/^AI 요청문 (?:다시 )?생성$/}).click();
}
test('실제 데이터 생성·수정·복사와 변경 후 재생성·메뉴 유지·모바일',async({page},info)=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as unknown as {copiedPrompt:string}).copiedPrompt=text;}}}));
  const external: string[]=[];const errors:string[]=[];
  page.on('request',request=>{if(/^https?:/.test(request.url()) && new URL(request.url()).hostname!=='127.0.0.1') external.push(request.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await open(page);
  await expect(page.getByLabel('익명화 모드',{exact:true})).toBeChecked();
  await expect(page.getByRole('button',{name:'AI 요청문 생성',exact:true})).toBeDisabled();
  await generate(page);const draft=page.getByLabel('AI 분석 요청문',{exact:true});let text=await draft.inputValue();
  expect(text).toContain('약 12,300,000원');expect(text).toContain('40대');expect(text).toContain('조건부 추정');
  expect(text).not.toContain('1980-01-01');expect(text).not.toContain('2005-03-01');
  await draft.fill(text+'\n인출 기간을 더 길게 검토해 주세요.');await page.getByRole('button',{name:'전체 복사',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('전체 요청문을 복사했습니다');
  expect(await page.evaluate(()=>(window as unknown as {copiedPrompt:string}).copiedPrompt)).toContain('인출 기간을 더 길게');
  await menu(page,'IRP·연금저축');await page.getByLabel('IRP 현재 평가금액 (원)',{exact:true}).fill('20000000');await menu(page,'AI 분석 요청문');
  await expect(page.getByRole('region',{name:'생성된 AI 요청문',exact:true})).toContainText('요청문을 다시 생성해 주세요');
  await expect(page.getByRole('button',{name:'전체 복사',exact:true})).toBeDisabled();await expect(draft).toHaveValue(text+'\n인출 기간을 더 길게 검토해 주세요.');
  await generate(page);text=await draft.inputValue();expect(text).toContain('20,000,000원');expect(text).not.toContain('인출 기간을 더 길게');
  await menu(page,'교사 기본정보');await menu(page,'AI 분석 요청문');await expect(draft).toHaveValue(text);
  for(const [name,url] of [['ChatGPT','https://chatgpt.com/'],['Gemini','https://gemini.google.com/'],['Claude','https://claude.ai/']]) {
    const link=page.getByRole('link',{name:`${name} 공식 사이트`,exact:true});await expect(link).toHaveAttribute('href',url);await expect(link).toHaveAttribute('referrerpolicy','no-referrer');await expect(link).toHaveAttribute('rel','noopener noreferrer');
  }
  for(const width of info.project.name==='mobile'?[320,390,640]:[900,1440]) {await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.screenshot({path:info.outputPath('analysis-prompt.png'),fullPage:true});expect(external).toEqual([]);expect(errors).toEqual([]);
});
test('날짜 명시 동의·금액 옵션·질문과 편집본 개인정보 점검',async({page})=>{
  await open(page);await page.getByRole('radio',{name:'사용자 직접 질문',exact:true}).check();
  await page.getByLabel('사용자 추가 질문',{exact:true}).fill('인출 시점의 위험을 분석해 주세요.\n이메일: private@example.test\n계좌번호: 111-222-333444');
  await expect(page.getByRole('button',{name:'AI 요청문 생성',exact:true})).toBeDisabled();
  await page.getByLabel('추가 질문에 직접 식별정보가 없는지 확인했으며, 검토된 질문을 요청문에 포함합니다.',{exact:true}).check();
  await generate(page);const draft=page.getByLabel('AI 분석 요청문',{exact:true});let text=await draft.inputValue();
  expect(text).toContain('인출 시점의 위험');expect(text).not.toContain('private@example.test');expect(text).not.toContain('111-222-333444');
  await page.getByLabel('익명화 모드',{exact:true}).uncheck();await expect(draft).toHaveValue('');await generate(page);expect(await draft.inputValue()).not.toContain('1980-01-01');
  await page.getByLabel('정확한 생년월일·최초 임용일 및 조회·퇴직·수령 날짜를 요청문에 포함하는 데 명시적으로 동의합니다.',{exact:true}).check();
  await generate(page);text=await draft.inputValue();expect(text).toContain('1980-01-01');expect(text).toContain('2005-03-01');
  await page.getByLabel('익명화 모드',{exact:true}).check();await expect(draft).toHaveValue('');
  await page.getByLabel('금융금액 표시 방식',{exact:true}).selectOption('range');await generate(page);expect(await draft.inputValue()).toContain('12,000,000원 이상~13,000,000원 미만');
  await draft.fill('이메일: private@example.test');await expect(page.getByRole('region',{name:'생성된 AI 요청문',exact:true})).toContainText('편집본의 개인정보 점검 필요');await expect(page.getByRole('button',{name:'전체 복사',exact:true})).toBeDisabled();
});
test('미입력 처리·모든 분석 카드·복사 실패 시 수동 선택',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}}));
  await open(page,false);await expect(page.getByRole('radio')).toHaveCount(8);
  await page.getByLabel('요청문 분량',{exact:true}).selectOption('simple');await generate(page);
  const draft=page.getByLabel('AI 분석 요청문',{exact:true});const text=await draft.inputValue();expect(text).toContain('계산 불가');expect(text).not.toContain('0원 (계산값 또는 명시적 입력값)');
  await page.getByRole('button',{name:'전체 복사',exact:true}).click();await expect(page.getByRole('status')).toContainText('자동 복사에 실패했습니다');
  expect(await draft.evaluate((node:HTMLTextAreaElement)=>node.selectionEnd-node.selectionStart)).toBe(text.length);
  await draft.fill('사용자가 직접 수정한 안전한 질문입니다.');await page.getByRole('button',{name:'전체 텍스트 선택',exact:true}).click();
  expect(await draft.evaluate((node:HTMLTextAreaElement)=>node.selectionEnd-node.selectionStart)).toBe((await draft.inputValue()).length);
});
