import type { SimpleInputs } from '@/lib/simple/model';
import { schemeNames } from '@/lib/simple/model';
import type { SimpleResults } from '@/lib/simple/calculation';
import { ageAt } from '@/lib/finance/cashflow-validation';
import { isCalendarDate } from '@/lib/profile-validation';
import { simpleConfig, simpleDisclaimer } from '@/lib/simple/config';
import { Result, won, OfficialLink } from './shared';
import { SimplePublicPension } from './public-pension';
import { AccountReceiptSummary } from './account-receipt';
export function SimpleOverview({ input, onChange, result: r }: { input: SimpleInputs; onChange: (v: SimpleInputs) => void; result: SimpleResults }) {
  const p = input.profile, q = input.benefits[p.scheme];
  const values = [{ name: '교직원공제회', amount: r.ktcu.amountWon }, { name: 'IRP', amount: r.irp.amountWon }, { name: '연금저축', amount: r.saving.amountWon }];
  const max = Math.max(1, ...values.flatMap(v => v.amount === null ? [] : [v.amount]));
  return <div className="simple-panel"><section className="profile-context" aria-label="기본정보 요약"><strong>{schemeNames[p.scheme]} · {p.retirement === 'early' ? '명예퇴직' : '정년퇴직'}</strong><p>현재 {isCalendarDate(p.birthDate) && p.birthDate <= r.today ? `만 ${ageAt(p.birthDate, r.today)}세` : '연령 확인 필요'} · 임용일 {p.appointmentDate || '미입력'}</p><p>현재 {p.step || '미입력'}호봉 → 퇴직 참고 {r.step === null ? '계산 불가' : `${r.step}호봉 (조건부)`}</p></section>
    <section className="benefit-result" aria-label="예상 퇴직일 요약"><h3>예상 퇴직일</h3><strong className="benefit-amount">{r.retirement.date ?? '추가 확인 필요'}</strong>{r.retirement.errors.map(e => <p className="profile-help" key={e}>{e}</p>)}</section>
    <SimplePublicPension input={input} onChange={onChange} result={r} />
    <section className="benefit-result" aria-label="연금계좌 소득 공백 활용"><h3>공적연금 전 소득 공백과 연금계좌</h3>
      <p>공적연금 정상 조건 충족일 {r.pensionDetails.normalStartDate ?? '확인 필요'} / 적용 개시일 {r.pensionStartDate ?? '확인 필요'}</p>
      <p>퇴직 후 공적연금 전 공백: {r.pensionGapMonths === null ? '확인 필요' : `${r.pensionGapMonths}개월 (완료 월) · ${r.pensionGapDays}일`}</p>
      {(['irp', 'saving'] as const).map(key => <div key={key}><AccountReceiptSummary title={key === 'irp' ? 'IRP' : '연금저축'} result={r.accountReceipts[key]} /><p className="profile-help">{r.accountReceipts[key].bridge}{r.accountReceipts[key].bridgeStart ? ` · 검토 시작 ${r.accountReceipts[key].bridgeStart}` : ''}</p></div>)}
      <p className="profile-help">가입일·재원·연간 한도는 03 상세 설정에서 확인하세요. 세액공제 이력·재원별 잔액·다른 연금소득이 없어 정확한 세후액은 미산출입니다. 실제 수령액·생활비·공백 충당 가능 금액은 별도 계산이 필요합니다. 예상 적립금 전액을 공백에 쓸 수 있다고 가정하지 않습니다.</p>
    </section>
    <div className="ktcu-cards"><Result title="교직원공제회 예상 적립금" result={r.ktcu}><p className="profile-help">{input.ktcu.split ? `가정 기반 분할 ${input.ktcu.years}년 · 월 ${won(r.split?.monthlyWon ?? null)} · 매월 25일` : '일시금 선택'} · 세금 미반영</p></Result>
      <Result title="IRP 예상 적립금" result={r.irp}><p className="profile-help">연 7% 가정 · 세금·수수료·환율 미반영</p></Result><Result title="연금저축 예상 적립금" result={r.saving}><p className="profile-help">연 8% 가정 · 세금·수수료·환율 미반영</p></Result>
      <section className="benefit-result" aria-label="퇴직급여 요약"><h3>퇴직급여 예상액</h3><strong className="benefit-amount">{won(r.benefitsTotal, '완전한 합계 확인 불가')}</strong><p>퇴직수당 {won(r.allowance.amountWon)}</p>{p.retirement === 'early' && <p>명예퇴직수당 {won(r.honorary.amountWon)}</p>}<p className="profile-help">두 수당 모두 계산 가능한 동일 퇴직일·2026년 가격·세전 시나리오만 합산합니다. 지급 미확정이며 산식과 한계는 04에서 확인하세요.</p></section></div>
    <section className="benefit-result" aria-label="주요 적립금 합계"><h3>퇴직 시 주요 적립금 합계</h3><strong className="benefit-amount">{won(r.accumulationTotal, '전체 적립금 합산 불가')}</strong><p className="profile-help">공제회 + IRP + 연금저축만 포함한 조건부 추정값입니다. 월연금·퇴직급여·미래 분할 총수령액은 더하지 않습니다. 모든 원천이 유효할 때만 합계를 표시합니다. 별도 세금 계산은 없습니다.</p><p>연금계좌 합계 {won(r.accountsTotal)} / 환급 재투자 효과 {input.reinvest ? r.reinvestError || won(r.reinvestEffect) : '미선택'}</p></section>
    <figure className="simple-composition" aria-label="주요 적립금 구성 그래프"><figcaption>퇴직 시 주요 적립금 구성 · 입력된 항목만 표시</figcaption>{values.map(v => <div key={v.name} className="simple-bar-row"><span>{v.name}</span><div className="simple-bar-track">{v.amount !== null && v.amount > 0 && <div style={{ width: `${v.amount / max * 100}%` }} />}</div><strong>{won(v.amount, '미입력/계산 불가')}</strong></div>)}<p className="profile-help">기준일 {r.today} → 공통 퇴직일 {r.retirement.date ?? '확인 필요'}. 공제회는 완료 계산월 {r.lastCalculatedDate ?? '계산 불가'}까지만 계산하고, IRP·연금저축은 실제 월말·연말 납입과 퇴직일까지의 부분 기간 수익을 반영합니다. 다른 시점의 공식 조회액을 이 그래프에 섞지 않습니다.</p></figure>
    <div className="ktcu-table-wrap"><table className="ktcu-table"><caption>예상 금액 요약 · 월액과 적립금을 구분</caption><thead><tr><th>항목</th><th>예상 금액</th><th>기준</th></tr></thead><tbody>
      <tr><td>공적연금</td><td>{won(r.pension.amountWon, '추정에 필요한 정보 확인')}</td><td>월 지급 · {r.pension.confidence}</td></tr>
      {values.map(v => <tr key={v.name}><td>{v.name}</td><td>{won(v.amount)}</td><td>퇴직 적립금 · {v.amount === null ? '계산 불가' : '조건부 추정값'}</td></tr>)}
      <tr><td>퇴직수당</td><td>{won(r.allowance.amountWon)}</td><td>일시금 · {r.allowance.confidence}</td></tr>{p.retirement === 'early' && <tr><td>명예퇴직수당</td><td>{won(r.honorary.amountWon)}</td><td>일시금 · {r.honorary.confidence}</td></tr>}</tbody></table></div>
    <p className="benefit-disclaimer">{simpleDisclaimer} 설정 {simpleConfig.version}.</p><p className="profile-help">입력한 정보는 서버에 저장되지 않습니다. 화면을 새로고침하거나 브라우저를 닫으면 입력 내용이 사라질 수 있습니다.</p></div>;
}
