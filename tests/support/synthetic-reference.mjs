// Independent arithmetic oracle: no imports from application calculation modules.
const DAY=86400000;
const stamp=s=>Date.parse(s+'T00:00:00Z');
const iso=n=>new Date(n).toISOString().slice(0,10);
export function daysBetween(a,b){return Math.round((stamp(b)-stamp(a))/DAY);}
export function completedMonths(a,b){const [ay,am,ad]=a.split('-').map(Number),[by,bm,bd]=b.split('-').map(Number);const raw=(by-ay)*12+bm-am;const end=new Date(Date.UTC(by,bm,0)).getUTCDate();return Math.max(0,raw-(bd<Math.min(ad,end)?1:0));}
export function futureStep(profile,retirement,today){let n=Number(profile.step);for(let t=stamp(today)+DAY;t<=stamp(retirement);t+=DAY){const d=new Date(t);if(d.getUTCDate()===1&&d.getUTCMonth()+1===Number(profile.promotionMonth))n++;}return Math.min(40,n);}
export function plannedDeposits(a,today,end){
 const raw=(a.cycle??'monthly')==='yearly'?a.annual:a.monthly;if(raw===''||raw===undefined) return null;
 const rows=[];for(let t=stamp(today)+DAY;t<=stamp(end);t+=DAY){const date=new Date(t),next=new Date(t+DAY);if(date.getUTCMonth()!==next.getUTCMonth()&&((a.cycle??'monthly')==='monthly'||date.getUTCMonth()===11))rows.push({date:iso(t),won:Number(raw)});}return rows;
}
export function independentReinvest(irp,saving,today,end){const ir=plannedDeposits(irp,today,end),sa=plannedDeposits(saving,today,end);if(!ir||!sa||irp.balance===''||saving.balance==='')return null;const extra=[];const credits={};for(let y=Number(today.slice(0,4));y<=Number(end.slice(0,4));y++){const total=rows=>rows.filter(x=>Number(x.date.slice(0,4))===y).reduce((s,x)=>s+x.won,0);const s=Math.min(6000000,total(sa));const i=Math.min(9000000-s,total(ir)+total(extra));const credit=Math.floor((s+i)*132/1000);credits[y]=credit;const date=`${y+1}-05-31`;if(credit>0&&date<=end)extra.push({date,won:credit});}return {extra,credits};}
export function independentAccount(a,today,end,rate,extra=[]){
 const rows=plannedDeposits(a,today,end);if(a.balance===''||!rows)return null;
 // Multiply one effective daily factor at a time, unlike production's year-fraction power.
 const factors=new Map([[end,1]]);let factor=1;
 for(let t=stamp(end)-DAY;t>=stamp(today);t-=DAY){const year=new Date(t).getUTCFullYear();const n=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/DAY;factor*=Math.exp(Math.log1p(rate/100)/n);factors.set(iso(t),factor);}
 const all=[...rows,...extra],initialFuture=Math.round(Number(a.balance)*factors.get(today));let future=0,deposits=0;for(const r of all){future+=Math.round(r.won*factors.get(r.date));deposits+=r.won;}
 return {amountWon:initialFuture+future,initialFuture,depositsFuture:future,deposits,transactions:all.length};
}
export function independentKtcu(a,today,end){if(a.balance===''||a.monthly==='')return null;let value=Number(a.balance),deposits=0;for(let i=0;i<completedMonths(today,end);i++){value=Math.round(value*Math.exp(Math.log(1.05)/12))+Number(a.monthly);deposits+=Number(a.monthly);}return {amountWon:value,deposits};}
export function manwonReference(raw){if(raw==='')return '';const [whole,f='']=raw.replaceAll(',','').split('.');return String(BigInt(whole)*10000n+BigInt(f.padEnd(4,'0')));}
export const salary2026Reference=[2041500,2103300,2166000,2228500,2291500,2354400,2416600,2478600,2495600,2516700,2538300,2585900,2657500,2773700,2889700,3006200,3121000,3241500,3361200,3481000,3600700,3733600,3865300,3997500,4129400,4261900,4400100,4538000,4682100,4826800,4971100,5115200,5261600,5407500,5553600,5699100,5825700,5952500,6079500,6205700];
export function futureSalary(profile,year,today,lastDay){let total=0;for(let m=1;m<=12;m++){const date=`${year}-${String(m).padStart(2,'0')}-01`;if(date>lastDay||date<profile.appointmentDate.slice(0,7)+'-01')continue;const step=futureStep(profile,date,today);let base=salary2026Reference[step-1];for(let y=2027;y<=year;y++)base*=1.03;total+=Math.round(base);}return total;}
