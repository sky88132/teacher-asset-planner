import type { BenefitInput } from '@/lib/finance/pension-input';
import { changeMoneyUnit } from '@/lib/finance/pension-input-validation';
import type { SimpleInputs, SimpleBenefits } from '@/lib/simple/model';
import { schemeNames } from '@/lib/simple/model';
import type { SimpleResults } from '@/lib/simple/calculation';
import { simpleDisclaimer } from '@/lib/simple/config';
import { Field, MoneyField, Result, won, OfficialLink } from './shared';
export function SimpleQuoteEditor({ value, onChange, title, kind, date }: { value: BenefitInput; onChange: (v: BenefitInput) => void; title: string;
  kind: 'pension' | 'allowance' | 'honorary'; date: string | null }) {
  const set = <K extends keyof BenefitInput>(key: K, v: BenefitInput[K]) => onChange({ ...value, [key]: v });
  return <details className="simple-details"><summary>{title} 직접 입력 (선택)</summary><p className="profile-help">공식 조회값도 사용자가 직접 입력한 값입니다. 기관에 자동 조회하거나 진위를 검증하지 않습니다.</p>
    <div className="benefit-fields"><MoneyField label={`${title} 금액 (만원)`} valueWon={changeMoneyUnit(value.money, 'won').amount} onChangeWon={amount => set('money', { amount, unit: 'won' })} />
      <Field label={`${title} 조회 기준일`} type="date" value={value.queryDate} onChange={v => set('queryDate', v)} />
      <Field label={`${title} 세전·세후`} value={value.taxBasis} onChange={v => set('taxBasis', v as BenefitInput['taxBasis'])}><option value="">선택</option><option value="gross">세전</option><option value="net">세후</option></Field>
      <Field label={`${title} 출처`} value={value.source} onChange={v => set('source', v as BenefitInput['source'])}><option value="">선택</option><option value="official">공식 조회값 · 사용자 직접 입력</option><option value="user-estimate">사용자 추정값 · 공식 검증 아님</option></Field>
      {kind === 'pension' && <Field label="공적연금 지급개시일" type="date" value={value.startDate} onChange={v => set('startDate', v)} />}</div>
    <label className="checkbox"><input type="checkbox" disabled={!date} checked={!!date && value.retirementDate === date} onChange={e => set('retirementDate', e.target.checked ? date ?? '' : '')} />현재 퇴직일 {date ?? '(01 확인 필요)'}을 가정하여 조회한 금액임을 확인했습니다.</label>
    {value.retirementDate && value.retirementDate !== date && <p className="field-error">이전 조회 가정일 {value.retirementDate} · 현재 퇴직일로 재조회 후 확인하세요.</p>}</details>;
}
export function SimpleBenefitsPanel({ input, onChange, result }: { input: SimpleInputs; onChange: (v: SimpleInputs) => void; result: SimpleResults }) {
  const p = input.profile, q = input.benefits[p.scheme];
  const update = (patch: Partial<SimpleBenefits>) => onChange({ ...input, benefits: { ...input.benefits, [p.scheme]: { ...q, ...patch } } });
  const tax = (v: BenefitInput) => v.taxBasis === 'gross' ? '세전' : v.taxBasis === 'net' ? '입력액 세후 · 자동 세금 계산 아님' : '세금 기준 미입력';
  return <div className="simple-panel"><p className="profile-context">{schemeNames[p.scheme]} · {p.retirement === 'early' ? '명예퇴직' : '정년퇴직'} · 예상 퇴직일 {result.retirement.date ?? '01에서 확인해 주세요.'}</p>
    {p.retirement === 'early' && <details className="simple-benefit-card"><summary>명예퇴직수당 예상액</summary>
      <dl className="benefit-details"><dt>명퇴 예정일</dt><dd>{result.retirement.date ?? '확인 필요'}</dd><dt>정년 예정일</dt><dd>{result.retirement.normal ?? '확인 필요'}</dd><dt>정년 잔여기간</dt><dd>{result.residualMonths === null ? '계산 불가' : `달력상 완료 월 ${result.residualMonths}개월 · 법정 지급용 잔여월수 아님`}</dd><dt>퇴직 시 호봉</dt><dd>{result.step === null ? '계산 불가' : `${result.step}호봉 · 조건부 참고정보`}</dd><dt>산정 봉급액</dt><dd>확인 필요 · 해당 퇴직연도 봉급표·신분·현행 별표 검증 전</dd></dl>
      <p className="profile-help">호봉만으로 명퇴수당을 계산하지 않습니다. 적용 신분·지급 자격·현행 별표·정년 잔여월수·산정 봉급액이 필요하며 실제 선정도 별개입니다. 국민연금 가입만으로 교원 명퇴수당 자격을 확정하지 않습니다.</p>
      <div className="benefit-fields"><Field label="명예퇴직수당 지급 자격" value={q.eligibility} onChange={v => update({ eligibility: v as SimpleBenefits['eligibility'] })}><option value="unknown">확인 필요</option><option value="confirmed">소속 기관 확인 완료</option><option value="no">해당 없음</option></Field><Field label="명예퇴직수당 실제 선정" value={q.selection} onChange={v => update({ selection: v as SimpleBenefits['selection'] })}><option value="unknown">미확정</option><option value="selected">선정 확인 완료</option><option value="rejected">미선정</option></Field></div>
      {p.scheme !== 'national' && <SimpleQuoteEditor title="명예퇴직수당" kind="honorary" value={q.honorary} onChange={honorary => update({ honorary })} date={result.retirement.date} />}
      <Result title="명예퇴직수당 결과" result={result.honorary}><p className="profile-help">{tax(q.honorary)} · 소속 기관의 최종 확인 필요</p></Result></details>}
    <details className="simple-benefit-card"><summary>퇴직수당 예상액</summary><dl className="benefit-details"><dt>퇴직 방식</dt><dd>{p.retirement === 'early' ? '명예퇴직' : '정년퇴직'}</dd><dt>예상 퇴직일</dt><dd>{result.retirement.date ?? '계산 불가'}</dd><dt>예상 재직기간</dt><dd>{result.serviceMonths === null ? '계산 불가' : `달력상 완료 월 ${result.serviceMonths}개월`}</dd><dt>수당 인정기간</dt><dd>공단 인정기간 조회 필요 · 달력상 근속과 다름</dd><dt>적용 소득정보</dt><dd>최종 기준소득월액 등 공식 확인 필요 · 호봉 봉급액과 다름</dd><dt>미반영 조건</dt><dd>구법 재직분·휴직·감액·기수령·군복무/합산의 수당 반영·끝수 처리</dd></dl>
      {p.scheme === 'national' ? <p className="profile-context">국민연금 가입자는 공무원·사학 퇴직수당 자동 지급 대상이 아닙니다. 별도 법정 퇴직급여의 적용 여부, 계속근로기간·평균임금 또는 DB/DC 내역을 확인해야 합니다. 이 화면에서는 해당 금액을 계산하지 않습니다.</p> : <><p className="profile-help">공무원·사학 각각의 기존 검증 차단 상태를 유지합니다. 현재 입력만으로 공식 금액을 자동 산정할 수 없어 조회값을 선택적으로 입력합니다.</p><SimpleQuoteEditor title="퇴직수당" kind="allowance" value={q.allowance} onChange={allowance => update({ allowance })} date={result.retirement.date} /></>}
      <Result title="퇴직수당 결과" result={result.allowance}><p className="profile-help">{tax(q.allowance)} · 일시금</p></Result>
      <p className="profile-help"><OfficialLink href={p.scheme === 'private-school' ? 'https://www.tp.or.kr/' : p.scheme === 'national' ? 'https://www.moel.go.kr/' : 'https://www.geps.or.kr/'}>적용 기관 공식 안내</OfficialLink> · <OfficialLink href={p.scheme === 'private-school' ? 'https://www.law.go.kr/법령/사립학교교직원연금법/제42조' : p.scheme === 'national' ? 'https://www.law.go.kr/법령/근로자퇴직급여보장법' : 'https://www.law.go.kr/법령/공무원연금법/제62조'}>관련 법령</OfficialLink></p></details>
    <section className="benefit-result" aria-label="퇴직급여 합계"><h3>{p.retirement === 'early' ? '명예퇴직수당 + 퇴직수당' : '퇴직수당 요약'}</h3><strong className="benefit-amount">{won(result.benefitsTotal, '완전한 합계 확인 불가')}</strong>
      <p>퇴직수당: {won(result.allowance.amountWon)} · {tax(q.allowance)}</p>{p.retirement === 'early' && <p>명예퇴직수당: {won(result.honorary.amountWon)} · {tax(q.honorary)}</p>}
      <p className="profile-help">누락·미선정·서로 다른 세금 기준은 완전한 합계로 만들지 않습니다. 공식 입력은 사용자 조회값이며 자동 산식 검증 결과가 아닙니다.</p></section><p className="benefit-disclaimer">{simpleDisclaimer}</p></div>;
}
