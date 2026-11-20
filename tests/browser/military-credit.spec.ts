import { test, expect } from '@playwright/test';
import { openMenu } from './helpers';
test('01 군복무 산입 개월·연도 입력이 05 자동 월연금에 반영되고 05 상세 설정과 같은 값',async({page},info)=>{
 await page.clock.install({time:new Date('2026-11-20T12:00:00+09:00')});await page.goto('/');
 const menu=(n:number)=>openMenu(page,n);
 await page.getByLabel('생년월일',{exact:true}).fill('1988-02-18');await page.getByLabel('최초 임용일',{exact:true}).fill('2016-03-01');await page.getByLabel('현재 호봉',{exact:true}).fill('22');await page.getByLabel('승급월',{exact:true}).selectOption('2');
 await expect(page.getByLabel('군복무 산입 개월 (공단 인정)',{exact:true})).toHaveCount(0);
 await page.getByLabel('임용 전 군복무기간을 연금 재직기간에 산입했습니까?',{exact:true}).selectOption('approved');
 await menu(4);const card=page.getByRole('region',{name:'공적연금 요약',exact:true});await expect(card).toContainText('군 산입분 제외');const before=await card.locator('.benefit-amount').first().innerText();
 await menu(0);await page.getByLabel('군복무 산입 개월 (공단 인정)',{exact:true}).fill('21');await page.getByLabel('군복무 산입연도',{exact:true}).fill('2019');
 await menu(4);await expect(card).not.toContainText('군 산입분 제외');await expect(card.locator('.benefit-amount').first()).not.toHaveText(before);await expect(page.getByRole('region',{name:'은퇴설계 핵심 요약',exact:true})).toContainText('예상 월 공적연금');
 await page.getByText('공적연금 추정 상세 설정 (선택)',{exact:true}).click();await expect(page.getByLabel('공단 확인 직역연금 군복무 인정 개월',{exact:true})).toHaveValue('21');await expect(page.getByLabel('군복무 실제 산입연도',{exact:true})).toHaveValue('2019');
 await menu(0);await page.getByLabel('군복무 산입연도',{exact:true}).fill('2014');await menu(4);await expect(card.locator('.benefit-amount').first()).toHaveText('추정에 필요한 정보 확인');
 if(info.project.name==='mobile')await page.setViewportSize({width:320,height:844});await menu(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
