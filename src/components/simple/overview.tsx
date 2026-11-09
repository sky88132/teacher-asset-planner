import { BenefitReferenceTotals } from './teacher-scenarios';
import type { SimpleInputs } from '@/lib/simple/model';
import type { SimpleResults } from '@/lib/simple/calculation';
import { simpleDisclaimer } from '@/lib/simple/config';
import { Result, won } from './shared';
import { SimplePublicPension } from './public-pension';
import { RetirementStrategy } from './retirement-strategy';
export function SimpleOverview({ input, onChange, result: r }: { input: SimpleInputs; onChange: (v: SimpleInputs) => void; result: SimpleResults }) {
  const p = input.profile;
  const values = [{ name: '교직원공제회', amount: r.ktcu.amountWon }, { name: 'IRP', amount: r.irp.amountWon }, { name: '연금저축', amount: r.saving.amountWon }];
  const max = Math.max(1, ...values.flatMap(v => v.amount === null ? [] : [v.amount]));
  return <div className="simple-panel retirement-dashboard"><RetirementStrategy input={input} result={r}>
    <div className="ktcu-cards"><Result compact title="교직원공제회 예상 적립금" result={r.ktcu}><p className="profile-help">{input.ktcu.split ? `가정 기반 분할 ${input.ktcu.years}년 · 월 ${won(r.split?.monthlyWon ?? null)} · 매월 25일` : '일시금 선택'} · 세금 미반영</p></Result>
      <Result compact title="IRP 예상 적립금" result={r.irp}><p className="profile-help">연 7% 가정 · 세금·수수료·환율 미반영</p></Result><Result compact title="연금저축 예상 적립금" result={r.saving}><p className="profile-help">연 8% 가정 · 세금·수수료·환율 미반영</p></Result>
      <Result compact title="퇴직수당 예상액" result={r.benefitSummary.allowance}><p className="profile-help">{r.benefitSummary.priceYear}년 {r.benefitSummary.nominal?'미래 명목':'소득 수준 고정'} · 기준 시나리오 · 세전</p></Result>{p.retirement==='early'&&<Result compact title="명예퇴직수당 예상액" result={r.benefitSummary.honorary}><p className="profile-help">선정·지급 미확정 · 세전 · {r.benefitSummary.priceYear}년 기준</p></Result>}</div>
    <section className="benefit-result" aria-label="주요 적립금 합계"><h3>퇴직 시 주요 적립금 합계</h3><strong className="benefit-amount">{won(r.accumulationTotal, '전체 적립금 합산 불가')}</strong><p className="profile-help">공제회·IRP·연금저축 합계 · 조건부 추정 · 즉시 인출 가능액 아님. 월연금·퇴직급여는 제외합니다.</p><p>연금계좌 합계 {won(r.accountsTotal)} / 환급 재투자 효과 {input.reinvest ? r.reinvestError || won(r.reinvestEffect) : '미선택'}</p></section>
    <figure className="simple-composition" aria-label="주요 적립금 구성 그래프"><figcaption>퇴직 시 주요 적립금 구성 · 입력된 항목만 표시</figcaption>{values.map(v => <div key={v.name} className="simple-bar-row"><span>{v.name}</span><div className="simple-bar-track">{v.amount !== null && v.amount > 0 && <div style={{ width: `${v.amount / max * 100}%` }} />}</div><strong>{won(v.amount, '미입력/계산 불가')}</strong></div>)}<p className="profile-help">세금 미반영 · 연 5%·7%·8% 가정 · 미확인 항목은 합산하지 않습니다.</p></figure>
    <BenefitReferenceTotals input={input} result={r} />
    </RetirementStrategy>
    <SimplePublicPension input={input} onChange={onChange} result={r} />
    <p className="benefit-disclaimer">{simpleDisclaimer}</p></div>;
}
