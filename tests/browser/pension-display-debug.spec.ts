import {test,expect,type Page} from '@playwright/test';
import {pensionDisplayCase,pensionDisplayBasis} from '../support/pension-display-cases.mjs';
import {calculateSimple} from '../../src/lib/simple/calculation';
import {formatWonAsKoreanCurrency as won} from '../../src/lib/simple/currency';
const names=['교사 기본정보','교직원공제회','IRP·연금저축','퇴직급여 계산','은퇴설계 종합','AI 분석 요청문'];
const baseline=process.env.PENSION_DISPLAY_BASELINE==='1';
async function menu(p:Page,n:number){await p.getByRole('navigation',{name:'주요 메뉴'}).getByRole('button',{name:names[n]}).click();}
async function enter(p:Page,id:string){const f=pensionDisplayCase(id);await p.goto('/');for(const [label,v]of [['생년월일',f.profile.birthDate],['최초 임용일',f.profile.appointmentDate],['현재 호봉',f.profile.step]])await p.getByLabel(label,{exact:true}).fill(v);await p.getByLabel('승급월',{exact:true}).selectOption(f.profile.promotionMonth);await p.getByLabel('임용 전 군복무기간을 연금 재직기간에 산입했습니까?',{exact:true}).selectOption(f.profile.military);
 if(id==='A'){await p.getByRole('radio',{name:'명예퇴직',exact:true}).check();await p.getByLabel('명예퇴직 예정일',{exact:true}).fill(f.profile.earlyDate);}
 await menu(p,4);if(id==='C'){await p.getByText('공적연금 추정 상세 설정 (선택)',{exact:true}).click();await p.getByLabel('소득·계수·가입기간을 현재 퇴직일 기준으로 확인했습니다.',{exact:true}).check();await p.getByLabel('공적연금 소득 적용 방식',{exact:true}).selectOption('current');}return f;
}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date(pensionDisplayBasis+'T12:00:00+09:00')});});
for(const id of ['A','B','C'])test(`가상 ${id} 월액 UI·엔진·AI 확인${baseline?' (수정전 빌드)':''}`,async({page},info)=>{
 const f=await enter(page,id),r=calculateSimple(f,pensionDisplayBasis),card=page.getByRole('region',{name:'공적연금 요약',exact:true});
 if(baseline&&id!=='A'){await expect(card.locator('.benefit-amount').first()).toHaveText('추정에 필요한 정보 확인');await expect(page.getByRole('region',{name:'은퇴설계 핵심 요약',exact:true})).toContainText('월액 미확인');await page.screenshot({path:info.outputPath(id+'-before.png'),fullPage:true});await menu(page,5);await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();const before=await page.getByLabel('AI 분석 요청문',{exact:true}).inputValue();expect(before).not.toContain(won(r.pension.amountWon));expect(before).toMatch(/공적연금.*계산 불가/);return;}
 await expect(card.locator('.benefit-amount').first()).toHaveText(won(r.pension.amountWon)+' / 월');await expect(page.getByRole('region',{name:'은퇴설계 핵심 요약',exact:true})).toContainText(won(r.pension.amountWon));await expect(card).toContainText('가정 기반 시뮬레이션');if(id==='B'){await expect(card).toContainText('군복무 산입분 제외');if(info.project.name==='mobile')await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('B-after.png'),fullPage:true});}
 await menu(page,5);await page.getByLabel('금융금액 표시 방식',{exact:true}).selectOption('exact');await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();const text=await page.getByLabel('AI 분석 요청문',{exact:true}).inputValue();expect(text).toContain(won(r.pension.amountWon));expect(text).not.toContain(f.profile.birthDate);expect(text).not.toContain(f.profile.appointmentDate);
 if(id==='B'){expect(text).toContain('임용 후 재직분만');expect(text).toContain('전체 예상액 아님');await menu(page,0);await page.getByLabel('현재 호봉',{exact:true}).fill('25');await menu(page,4);await expect(card.locator('.benefit-amount').first()).not.toHaveText(won(r.pension.amountWon)+' / 월');}
});
test('현재40: 보류 사유를05에 바로 표시·AI도 같은 이유',async({page})=>{
 test.skip(baseline,'수정전에는 진단 UI가 없으므로 A/B 금액만 재현');await enter(page,'C');await menu(page,0);await page.getByLabel('현재 호봉',{exact:true}).fill('40');await menu(page,4);
 const reason=page.getByLabel('월연금 계산 보류 이유',{exact:true});await expect(reason).toBeVisible();await expect(reason).toContainText('과거 소득 경로');await expect(page.getByRole('region',{name:'공적연금 요약',exact:true})).toContainText('2050-06-15');
 await menu(page,5);await page.getByLabel('포함 정보·익명화·누락 사항을 확인했습니다.',{exact:true}).check();await page.getByRole('button',{name:'AI 요청문 생성',exact:true}).click();await expect(page.getByLabel('AI 분석 요청문',{exact:true})).toHaveValue(/과거 소득 경로/);
});
