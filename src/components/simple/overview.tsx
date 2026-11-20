import { BenefitReferenceTotals } from './teacher-scenarios';
import type { SimpleInputs } from '@/lib/simple/model';
import type { SimpleResults } from '@/lib/simple/calculation';
import { simpleDisclaimer } from '@/lib/simple/config';
import { Result, won } from './shared';
import { SimplePublicPension } from './public-pension';
import { RetirementStrategy } from './retirement-strategy';
import { LumpSumOverview } from './dashboard-visuals';
export function SimpleOverview({ input, onChange, result: r }: { input: SimpleInputs; onChange: (v: SimpleInputs) => void; result: SimpleResults }) {
  const p = input.profile;
  return <div className="simple-panel retirement-dashboard"><RetirementStrategy input={input} result={r}>
    <LumpSumOverview input={input} result={r} />
    </RetirementStrategy>
    <SimplePublicPension input={input} onChange={onChange} result={r} />
    <details className="simple-details dashboard-more"><summary>항목별 금액·계산 근거 보기</summary>
    <div className="ktcu-cards"><Result compact title="교직원공제회 예상 적립금" result={r.ktcu}><p className="profile-help">{input.ktcu.split ? `가정 기반 분할 ${input.ktcu.years}년 · 월 ${won(r.split?.monthlyWon ?? null)} · 매월 25일` : '일시금 선택'} · 세금 미반영</p></Result>
      <Result compact title="IRP 예상 적립금" result={r.irp}><p className="profile-help">연 7% 가정 · 세금·수수료·환율 미반영</p></Result><Result compact title="연금저축 예상 적립금" result={r.saving}><p className="profile-help">연 8% 가정 · 세금·수수료·환율 미반영</p></Result>
      <Result compact title="퇴직수당 예상액" result={r.benefitSummary.allowance}><p className="profile-help">{r.benefitSummary.priceYear}년 {r.benefitSummary.nominal?'미래 명목':'소득 수준 고정'} · 기준 시나리오 · 세전</p></Result>{p.retirement==='early'&&<Result compact title="명예퇴직수당 예상액" result={r.benefitSummary.honorary}><p className="profile-help">선정·지급 미확정 · 세전 · {r.benefitSummary.priceYear}년 기준</p></Result>}</div>
    <BenefitReferenceTotals input={input} result={r} />
    <p className="profile-help">세금 미반영 · 공제회 연 5%·IRP 7%·연금저축 8% 가정 · 미확인 항목은 합산하지 않습니다.</p>
    </details>
    <p className="benefit-disclaimer">{simpleDisclaimer}</p></div>;
}
