import {test,expect,type Page} from '@playwright/test';
import {createSimpleInputs} from '../../src/lib/simple/model';
import {calculateSimple} from '../../src/lib/simple/calculation';
import {formatWonAsKoreanCurrency as won} from '../../src/lib/simple/currency';
const today='2026-11-09',names=['교사 기본정보','교직원공제회','IRP·연금저축','퇴직급여 계산','은퇴설계 종합','AI 분석 요청문'];
async function menu(p:Page,n:number){await p.getByRole('navigation',{name:'주요 메뉴'}).getByRole('button',{name:names[n]}).click();}
function input(){const f=createSimpleInputs();Object.assign(f.profile,{birthDate:'1987-02-12',appointmentDate:'2017-04-01',step:'20',promotionMonth:'4',retirement:'early',earlyDate:'2039-08-31'});return f;}
async function profile(p:Page){const f=input();for(const [label,v]of [['생년월일',f.profile.birthDate],['최초 임용일',f.profile.appointmentDate],['현재 호봉',f.profile.step]])await p.getByLabel(label,{exact:true}).fill(v);await p.getByLabel('승급월',{exact:true}).selectOption('4');await p.getByRole('radio',{name:'명예퇴직',exact:true}).check();await p.getByLabel('명예퇴직 예정일',{exact:true}).fill(f.profile.earlyDate);}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date(today+'T12:00:00+09:00')});await page.goto('/');await profile(page);});
test('기본정보만 입력한 월연금은 엔진과 일치·공식 변수 입력 불필요·개시일 표시',async({page})=>{
 const r=calculateSimple(input(),today);await menu(page,4);const p=page.getByRole('region',{name:'공적연금 요약',exact:true});await expect(p.locator('.benefit-amount').first()).toHaveText(won(r.pension.amountWon)+' / 월');await expect(p).toContainText(r.pensionDetails.normalStartDate!);await expect(p).toContainText('공백');await page.getByText('월연금 변수별 출처·자동 산출 과정',{exact:true}).click();await expect(p).toContainText('퇴직 전 3개 연도 평균');await expect(p).toContainText('공식 통계에 근거한 추정값');await expect(p).toContainText('미확인·계산 불가');
});
test('명퇴04 순서·펼치지 않은 금액·05·06 동일값·원 합산 후 만원 표시',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);const r=calculateSimple(input(),today),b=r.benefitSummary;await menu(page,3);
 const h=page.getByRole('region',{name:'명예퇴직수당 결과',exact:true}),a=page.getByRole('region',{name:'퇴직수당 예상액',exact:true}),sum=page.getByRole('region',{name:'퇴직급여 참고 합계',exact:true});
 await expect(h.locator('.benefit-amount')).toBeVisible();await expect(h.locator('.benefit-amount')).toHaveText(won(b.honorary.amountWon));await expect(a.locator('.benefit-amount')).toHaveText(won(b.allowance.amountWon));
 expect((await h.boundingBox())!.y).toBeLessThan((await a.boundingBox())!.y);expect((await a.boundingBox())!.y).toBeLessThan((await sum.boundingBox())!.y);await expect(page.getByText('완전한 합계 확인 불가',{exact:true})).toHaveCount(0);await expect(page.getByText('2026년 소득 수준 고정 상세 비교',{exact:true}).locator('..')).not.toHaveAttribute('open');
 await menu(page,4);await expect(page.getByRole('region',{name:'퇴직수당 예상액',exact:true}).locator('.benefit-amount')).toHaveText(won(b.allowance.amountWon));await expect(page.getByRole('region',{name:'명예퇴직수당 예상액',exact:true}).locator('.benefit-amount')).toHaveText(won(b.honorary.amountWon));
 await menu(page,5);await page.getByLabel('금융금액 표시 방식',{exact:true}).selectOption('exact');await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();const text=await page.getByLabel('AI 분석 요청문',{exact:true}).inputValue();expect(text).toContain('수당 합계 '+won(b.totalWon));expect(text).toContain('04·05 공통 선택');expect(text).not.toContain('사용자 확인 적용비율 %');expect(text).not.toContain(input().profile.birthDate);await page.getByRole('button',{name:'전체 복사',exact:true}).click();await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toContain(won(b.totalWon));
});
test('호봉·승급월·명퇴일 변경은 월연금과 수당을 갱신·정년은 명퇴 카드 없음',async({page},info)=>{
 await menu(page,4);const p=page.getByRole('region',{name:'공적연금 요약',exact:true}).locator('.benefit-amount').first();let before=await p.innerText();for(const [label,value]of [['현재 호봉','21'],['승급월','12'],['명예퇴직 예정일','2040-08-31']]){await menu(page,0);if(label==='승급월')await page.getByLabel(label,{exact:true}).selectOption(value);else await page.getByLabel(label,{exact:true}).fill(value);await menu(page,4);await expect(p).not.toHaveText(before);before=await p.innerText();}
 await menu(page,0);await page.getByRole('radio',{name:'정년퇴직',exact:true}).check();await menu(page,3);await expect(page.getByRole('region',{name:'명예퇴직수당 결과',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'퇴직수당 예상액',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'퇴직급여 합계',exact:true})).toHaveCount(0);
 if(info.project.name==='mobile')await page.setViewportSize({width:320,height:844});for(let i=0;i<6;i++){await menu(page,i);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});
test('구기간 미확인은 월액 생성하지 않고 정상개시·구체적 차단 사유 유지',async({page})=>{
 await menu(page,0);await page.getByLabel('최초 임용일',{exact:true}).fill('2007-04-01');await page.getByLabel('현재 호봉',{exact:true}).fill('33');await menu(page,4);const p=page.getByRole('region',{name:'공적연금 요약',exact:true});await expect(p.locator('.benefit-amount').first()).toHaveText('추정에 필요한 정보 확인');await expect(p).toContainText('2009년 이전');await expect(p).toContainText('2052-02-12');
});
