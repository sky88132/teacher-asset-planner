import type { SimpleInputs } from '@/lib/simple/model';
import { schemeNames } from '@/lib/simple/model';
import type { SimpleResults } from '@/lib/simple/calculation';
import { ageAt } from '@/lib/finance/cashflow-validation';
import { isCalendarDate } from '@/lib/profile-validation';
import { simpleConfig, simpleDisclaimer } from '@/lib/simple/config';
import { Result, won, OfficialLink } from './shared';
import { SimpleQuoteEditor } from './benefits';
export function SimpleOverview({ input, onChange, result: r }: { input: SimpleInputs; onChange: (v: SimpleInputs) => void; result: SimpleResults }) {
  const p = input.profile, q = input.benefits[p.scheme];
  const values = [{ name: '교직원공제회', amount: r.ktcu.amountWon }, { name: 'IRP', amount: r.irp.amountWon }, { name: '연금저축', amount: r.saving.amountWon }];
  const max = Math.max(1, ...values.flatMap(v => v.amount === null ? [] : [v.amount]));
  return <div className="simple-panel"><section className="profile-context" aria-label="기본정보 요약"><strong>{schemeNames[p.scheme]} · {p.retirement === 'early' ? '명예퇴직' : '정년퇴직'}</strong><p>현재 {isCalendarDate(p.birthDate) && p.birthDate <= r.today ? `만 ${ageAt(p.birthDate, r.today)}세` : '연령 확인 필요'} · 임용일 {p.appointmentDate || '미입력'}</p><p>현재 {p.step || '미입력'}호봉 → 퇴직 참고 {r.step === null ? '계산 불가' : `${r.step}호봉 (조건부)`}</p></section>
    <section className="benefit-result" aria-label="예상 퇴직일 요약"><h3>예상 퇴직일</h3><strong className="benefit-amount">{r.retirement.date ?? '추가 확인 필요'}</strong>{r.retirement.errors.map(e => <p className="profile-help" key={e}>{e}</p>)}</section>
    <section className="benefit-result" aria-label="공적연금 요약"><h3>공적연금 예상 월수령액</h3><strong className="benefit-amount">{won(r.pension.amountWon, '공식 조회 필요')}{r.pension.amountWon !== null ? ' / 월' : ''}</strong><p className="profile-help">{r.pension.confidence} · {q.pension.taxBasis === 'net' ? '입력액 세후' : q.pension.taxBasis === 'gross' ? '세전' : '세금 기준 확인 필요'}</p><p>예상 개시 시점: {r.pension.amountWon === null ? '적용 제도와 개인별 조건 확인 필요' : `${q.pension.startDate}${isCalendarDate(p.birthDate) ? ` (만 ${ageAt(p.birthDate, q.pension.startDate)}세)` : ''}`}</p><p className="profile-help">65세를 일괄 적용하지 않습니다. 월연금은 일시금·계좌 적립금에 더하지 않습니다. 조회 가정일 {q.pension.retirementDate || '미입력'} / 조회 기준일 {q.pension.queryDate || '미입력'}.</p>
      {q.pension.money.amount && r.pension.errors.map(e => <p className="field-error" key={e}>{e}</p>)}
      <SimpleQuoteEditor title="예상 월연금" kind="pension" value={q.pension} onChange={pension => onChange({ ...input, benefits: { ...input.benefits, [p.scheme]: { ...q, pension } } })} date={r.retirement.date} />
      <OfficialLink href={p.scheme === 'civil' ? 'https://www.geps.or.kr/' : p.scheme === 'private-school' ? 'https://www.tp.or.kr/' : 'https://www.nps.or.kr/'}>{schemeNames[p.scheme]} 공식 조회 안내</OfficialLink></section>
    <div className="ktcu-cards"><Result title="교직원공제회 예상 적립금" result={r.ktcu}><p className="profile-help">{input.ktcu.split ? `가정 기반 분할 ${input.ktcu.years}년 · 월 ${won(r.split?.monthlyWon ?? null)} · 매월 25일` : '일시금 선택'} · 세금 미반영</p></Result>
      <Result title="IRP 예상 적립금" result={r.irp}><p className="profile-help">연 7% 가정 · 세금·수수료·환율 미반영</p></Result><Result title="연금저축 예상 적립금" result={r.saving}><p className="profile-help">연 8% 가정 · 세금·수수료·환율 미반영</p></Result>
      <section className="benefit-result" aria-label="퇴직급여 요약"><h3>퇴직급여 예상액</h3><strong className="benefit-amount">{won(r.benefitsTotal, '완전한 합계 확인 불가')}</strong><p>퇴직수당 {won(r.allowance.amountWon)}</p>{p.retirement === 'early' && <p>명예퇴직수당 {won(r.honorary.amountWon)}</p>}<p className="profile-help">누락·미선정 또는 세전/세후 혼합 시 합산하지 않습니다. 각 수당 금액·조회 조건은 04에서 확인하세요.</p></section></div>
    <section className="benefit-result" aria-label="주요 적립금 합계"><h3>퇴직 시 주요 적립금 합계</h3><strong className="benefit-amount">{won(r.accumulationTotal, '전체 적립금 합산 불가')}</strong><p className="profile-help">공제회 + IRP + 연금저축만 포함한 조건부 추정값입니다. 월연금·퇴직급여·미래 분할 총수령액은 더하지 않습니다. 모든 원천이 유효할 때만 합계를 표시합니다. 별도 세금 계산은 없습니다.</p><p>연금계좌 합계 {won(r.accountsTotal)} / 환급 재투자 효과 {input.reinvest ? '미반영 · 추가 확인 필요' : '미선택'}</p></section>
    <figure className="simple-composition" aria-label="주요 적립금 구성 그래프"><figcaption>퇴직 시 주요 적립금 구성 · 입력된 항목만 표시</figcaption>{values.map(v => <div key={v.name} className="simple-bar-row"><span>{v.name}</span><div className="simple-bar-track">{v.amount !== null && v.amount > 0 && <div style={{ width: `${v.amount / max * 100}%` }} />}</div><strong>{won(v.amount, '미입력/계산 불가')}</strong></div>)}<p className="profile-help">기준일 {r.today} → 공통 퇴직일 {r.retirement.date ?? '확인 필요'}. 완료 계산월 {r.lastCalculatedDate ?? '계산 불가'} 이후 퇴직일까지 추가 납입·수익이 없다고 가정합니다. 다른 시점의 공식 조회액을 이 그래프에 섞지 않습니다.</p></figure>
    <div className="ktcu-table-wrap"><table className="ktcu-table"><caption>예상 금액 요약 · 월액과 적립금을 구분</caption><thead><tr><th>항목</th><th>예상 금액</th><th>기준</th></tr></thead><tbody>
      <tr><td>공적연금</td><td>{won(r.pension.amountWon, '공식 조회 필요')}</td><td>월 지급 · {r.pension.confidence}</td></tr>
      {values.map(v => <tr key={v.name}><td>{v.name}</td><td>{won(v.amount)}</td><td>퇴직 적립금 · {v.amount === null ? '계산 불가' : '조건부 추정값'}</td></tr>)}
      <tr><td>퇴직수당</td><td>{won(r.allowance.amountWon)}</td><td>일시금 · {r.allowance.confidence}</td></tr>{p.retirement === 'early' && <tr><td>명예퇴직수당</td><td>{won(r.honorary.amountWon)}</td><td>일시금 · {r.honorary.confidence}</td></tr>}</tbody></table></div>
    <p className="benefit-disclaimer">{simpleDisclaimer} 설정 {simpleConfig.version}.</p><p className="profile-help">입력한 정보는 서버에 저장되지 않습니다. 화면을 새로고침하거나 브라우저를 닫으면 입력 내용이 사라질 수 있습니다.</p></div>;
}
