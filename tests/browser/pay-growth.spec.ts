import { test, expect } from '@playwright/test';
import { openMenu } from './helpers';
test('01 보수 상승률 기본 2.5%·변경 반영·05는 지금 가치를 주 금액, 미래 금액은 보조',async({page})=>{
 await page.clock.install({time:new Date('2026-11-20T12:00:00+09:00')});await page.goto('/');
 const menu=(n:number)=>openMenu(page,n);
 await page.getByLabel('생년월일',{exact:true}).fill('1988-02-18');await page.getByLabel('최초 임용일',{exact:true}).fill('2016-03-01');await page.getByLabel('현재 호봉',{exact:true}).fill('22');await page.getByLabel('승급월',{exact:true}).selectOption('2');
 await page.getByText('교원 표준 보수·연금 추정 가정',{exact:true}).click();const rate=page.getByLabel('공무원 보수 상승률 가정 (연 %)',{exact:true});await expect(rate).toHaveValue('2.5');
 await menu(4);const card=page.getByRole('region',{name:'공적연금 요약',exact:true});await expect(card.locator('.pension-future')).toContainText('실제 받는 금액');await expect(page.getByRole('region',{name:'은퇴설계 핵심 요약',exact:true})).toContainText('지금 가치');
 const future=await card.locator('.pension-future span').innerText();
 await menu(0);await page.getByText('교원 표준 보수·연금 추정 가정',{exact:true}).click();await rate.fill('3');await menu(4);await expect(card.locator('.pension-future span')).not.toHaveText(future);
 await menu(0);await page.getByText('교원 표준 보수·연금 추정 가정',{exact:true}).click();await rate.fill('12');await menu(4);await expect(card.locator('.benefit-amount').first()).toHaveText('추정에 필요한 정보 확인');
});
