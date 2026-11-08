import { BenefitReferenceTotals } from './teacher-scenarios';
import { AllowanceReferenceCard } from './allowance-reference';
import type { BenefitInput } from '@/lib/finance/pension-input';
import { changeMoneyUnit } from '@/lib/finance/pension-input-validation';
import type { SimpleInputs, SimpleBenefits } from '@/lib/simple/model';
import { schemeNames } from '@/lib/simple/model';
import type { SimpleResults } from '@/lib/simple/calculation';
import { benefitSources } from '@/lib/simple/benefit-estimates';
import { simpleConfig, simpleDisclaimer } from '@/lib/simple/config';
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
  const p = input.profile, q = input.benefits[p.scheme], h = result.honoraryDetails, a = result.allowanceDetails;
  const update = (patch: Partial<SimpleBenefits>) => onChange({ ...input, benefits: { ...input.benefits, [p.scheme]: { ...q, ...patch } } });
  return <div className="simple-panel"><p className="profile-context">{schemeNames[p.scheme]} · {p.retirement === 'early' ? '명예퇴직' : '정년퇴직'} · 예상 퇴직일 {result.retirement.date ?? '01에서 확인해 주세요.'}</p>
    {p.retirement === 'early' && <details className="simple-benefit-card"><summary>명예퇴직수당 예상액</summary>
      <Result title="명예퇴직수당 결과" result={result.honorary} />
      <dl className="benefit-details"><dt>명퇴 예정일</dt><dd>{result.retirement.date ?? '확인 필요'}</dd><dt>정년 예정일</dt><dd>{result.retirement.normal ?? '확인 필요'}</dd><dt>정년 잔여기간</dt><dd>{h.months === null ? '계산 불가' : h.months + '개월 · 퇴직 다음 달 1일부터 정년 월말까지'}</dd><dt>퇴직 시 호봉</dt><dd>{result.step === null ? '계산 불가' : result.step + '호봉 · 정기승급 가정'}</dd><dt>적용 봉급액</dt><dd>{won(h.salaryWon)} / 월</dd><dt>적용 산식</dt><dd>{h.formula}</dd><dt>기준 봉급표</dt><dd>{h.basis}</dd><dt>자료 확인일</dt><dd>{simpleConfig.checkedOn}</dd></dl>
      <p className="profile-help">공무원연금에 가입한 일반 국공립 유·초·중·고 호봉제 정규 교원 가정입니다. 임용일부터 중단 없이 재직하고 승급 제한이 없다고 가정합니다. 대학·연봉제·시간제·특별 가산·근가호봉은 반영하지 않습니다. 법정 20년 재직·최소 1년 조기퇴직을 확인하며, 징계·수사 등 지급제한과 예산·인력수급에 따른 선정 심사는 기관이 판단합니다. 조건을 충족한 경우의 금액이며 지급 확정이 아닙니다.</p>
      <p className="profile-help"><OfficialLink href={benefitSources.honorary}>국가공무원 명예퇴직수당 등 지급 규정·별표 1</OfficialLink> · <OfficialLink href={simpleConfig.salaryUrl}>2026 교원 봉급표</OfficialLink></p>
      <p className="benefit-disclaimer">명예퇴직수당은 관련 법령과 지급 심사 결과에 따라 실제 지급 여부 및 금액이 달라질 수 있습니다.</p></details>}
    <BenefitReferenceTotals input={input} result={result} />
    <AllowanceReferenceCard value={q} onChange={update} result={result}/>
    <section className="benefit-result" aria-label="퇴직급여 합계"><h3>{p.retirement === 'early' ? '명예퇴직수당 + 퇴직수당' : '퇴직수당 요약'}</h3><strong className="benefit-amount">{won(result.benefitsTotal, '완전한 합계 확인 불가')}</strong><p>퇴직수당: {won(result.allowance.amountWon)} · 세전</p>{p.retirement === 'early' && <p>명예퇴직수당: {won(result.honorary.amountWon)} · 세전</p>}<p className="profile-help">같은 퇴직일·2026년 가격 고정·세전 조건부 시나리오에서 계산 가능한 수당만 합산합니다. 지급 미확정이며 세후 실지급액이 아닙니다. 한 항목이 계산 불가이면 완전한 합계를 표시하지 않습니다.</p></section><p className="benefit-disclaimer">{simpleDisclaimer}</p></div>;
}
