import type { SimpleInputs } from '@/lib/simple/model';
import type { SimpleResults } from '@/lib/simple/calculation';
import type { IncomeWindow, RetirementAnalysis } from '@/lib/simple/retirement-analysis';
import { ageAt } from '@/lib/finance/cashflow-validation';
import { isCalendarDate } from '@/lib/profile-validation';
import { won } from './shared';

const DAY = 86400000;
const days = (from: string, until: string) => Math.round((Date.parse(until + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY);
const ym = (date: string) => date.slice(0, 7).replace('-', '.');
export function yearsMonths(months: number) {
  const y = Math.floor(months / 12), m = months % 12;
  return y && m ? `${y}년 ${m}개월` : y ? `${y}년` : `${m}개월`;
}
type Kind = 'ktcu' | 'pension' | 'other';
const kindOf = (label: string): Kind => label.includes('공제회') ? 'ktcu' : label.includes('공적연금') ? 'pension' : 'other';
const shortLabel = (w: IncomeWindow) => w.label === '공제회 첫 지급 전' ? '첫 지급 전' : w.label === '공제회 정기 분할 지급 중' ? '공제회 분할' : w.label === '공제회 분할 종료 후' ? '분할 종료 후' : w.phase === 'after' ? '연금 수령' : '퇴직 후';

/** Four headline numbers and one plain-language sentence. All values come from existing results. */
export function KeyFacts({ input, result: r, analysis: a }: { input: SimpleInputs; result: SimpleResults; analysis: RetirementAnalysis }) {
  const early = input.profile.retirement === 'early';
  const startAge = a.publicStart && isCalendarDate(a.publicStart) && isCalendarDate(input.profile.birthDate) ? ageAt(input.profile.birthDate, a.publicStart) : null;
  const pension2026 = r.pensionSource === 'teacher-model' ? r.teacherPension.rows.find(x => x.id === 'base')?.basis2026Won ?? null : null;
  const splitCoversGap = a.split.valid && a.split.monthlyWon !== null && (a.split.beforeCount ?? 0) > 0;
  const gapSentence = !a.validTiming || a.gapMonths === null ? '퇴직일과 연금 개시일이 확인되면 소득 공백을 계산합니다.'
    : a.gapDays === 0 ? '퇴직과 함께 공적연금을 받을 수 있어 소득 공백이 없습니다.'
    : `퇴직 후 공적연금을 받기까지 약 ${yearsMonths(a.gapMonths)}이 비어요. ${splitCoversGap ? `이 기간에는 공제회 분할금(월 ${won(a.split.monthlyWon)})이 주요 수입입니다.` : '이 기간의 생활비 재원을 먼저 준비해야 합니다.'}`;
  const pensionSentence = a.pensionWon === null ? (r.pensionStatus.preparing ? '공적연금 자동 추정은 준비 중입니다.' : '공적연금 월액은 아직 확인되지 않았습니다.')
    : `연금을 받기 시작하면 월 ${won(a.pensionWon)}(세전${pension2026 !== null ? `, 지금 가치로 약 ${won(pension2026)}` : ''})을 예상합니다.`;
  return <section className="benefit-result dashboard-hero" aria-label="은퇴설계 핵심 요약"><h3>한눈에 보는 나의 은퇴</h3>
    <p className="dashboard-headline">{gapSentence} {pensionSentence}</p>
    <dl className="retirement-summary">
      <div className="fact fact-retire"><dt>퇴직</dt><dd><b>{a.retirement ?? '확인 필요'}</b><small>{a.retirementAge === null ? '연령 확인 필요' : `만 ${a.retirementAge}세`} · {early ? '명예퇴직' : '정년퇴직'}{r.step === null ? '' : ` · ${r.step}호봉`}</small></dd></div>
      <div className="fact fact-start"><dt>공적연금 개시</dt><dd><b>{a.publicStart ?? '확인 필요'}</b><small>{startAge === null ? '개시 연령 확인 필요' : `만 ${startAge}세부터`}</small></dd></div>
      <div className="fact fact-gap"><dt>{early ? '명예퇴직 후 소득 공백' : '퇴직 후 개시 전 기간'}</dt><dd><b>{a.gapMonths === null || a.gapDays === null ? '확인 필요' : a.gapDays === 0 ? '없음' : yearsMonths(a.gapMonths)}</b><small>{a.gapDays === null ? '날짜 확인 후 계산' : `${a.gapMonths}개월(완료 월) · ${a.gapDays}일`}</small></dd></div>
      <div className="fact fact-pension"><dt>{r.pensionStatus.scope === 'appointment-service-only' ? '공적연금 참고 월액 (군 산입분 제외)' : '예상 월 공적연금'}</dt><dd><b>{won(a.pensionWon, '월액 미확인')}{a.pensionWon === null ? '' : ' / 월'}</b><small>{a.pensionWon === null ? (r.pensionStatus.preparing ? '자동 추정 준비 중' : '아래 공적연금에서 확인') : pension2026 !== null ? `지금 가치 약 ${won(pension2026)} · 세전` : r.pensionSource === 'quote' ? '직접 입력한 조회액' : '세전 · 2026년 기준'}</small></dd></div>
    </dl>
    {r.pensionStatus.state === 'unavailable' && <div className="profile-context" aria-label="월연금 계산 보류 이유"><strong>{r.pensionStatus.preparing ? '2009년 이전 임용자의 자동 월연금 추정은 준비 중입니다.' : '월연금을 계산하려면 확인이 필요합니다.'}</strong>
      <details className="simple-details"><summary>이유와 대안 보기</summary>{r.pensionStatus.reasons.map(reason => <p className="profile-help" key={reason}>{reason}</p>)}{!r.pensionStatus.preparing && <p className="profile-help">퇴직 시 40호봉이 되는 것 자체는 차단 사유가 아닙니다. 현재40호봉의 과거 이력이나 2009년 이전 소득 등 필요한 자료가 없으면 금액을 만들지 않습니다. 아래 공식 조회액 직접 입력 또는 해당 공단 확인 자료를 이용해 주세요. 정상 개시일은 별도로 확인할 수 있습니다.</p>}</details></div>}
  </section>;
}

/** Retirement-to-pension timeline with a stepped monthly-income chart. Width = duration, height = monthly amount. */
export function IncomeFlowChart({ input, analysis: a }: { input: SimpleInputs; analysis: RetirementAnalysis }) {
  const shown = a.windows.filter(w => w.phase !== 'unknown' && (!w.until || days(w.from, w.until) >= 28));
  const raw = shown.map(w => w.until ? days(w.from, w.until) : 1826);
  const total = raw.reduce((s, n) => s + n, 0) || 1;
  const weight = raw.map(n => Math.max(n, total * 0.16));
  const max = Math.max(1, ...shown.map(w => w.subtotalWon ?? w.sources.reduce((s, x) => s + x.won, 0)));
  const groups = (['before', 'after'] as const).map(phase => ({ phase, items: shown.map((w, i) => ({ w, weight: weight[i] })).filter(x => x.w.phase === phase) })).filter(g => g.items.length);
  const kinds = new Set(shown.flatMap(w => w.sources.map(s => kindOf(s.label))));
  return <section className="benefit-result" aria-label="은퇴 시기 타임라인"><h3>퇴직 후 월수입 흐름</h3>
    <p className="profile-help">막대 너비는 기간, 높이는 월 지급액입니다. 세전 · 확인된 정기 지급액만 표시합니다.</p>
    {!a.validTiming ? <p className="profile-help">날짜가 확인되면 공백을 계산합니다.</p>
      : <>{a.gapDays === 0 && <p className="profile-context">개시 전 공백 0: 연금이 퇴직일 또는 그 전에 이미 개시됩니다.</p>}
        <figure className="flow-chart" aria-label="퇴직 후 월수입 흐름 그래프">
          <div className="flow-groups">{groups.map(g => <div key={g.phase} className={`flow-group flow-${g.phase}`} style={{ flexGrow: g.items.reduce((s, x) => s + x.weight, 0) }}>
            <div className="flow-band">{g.phase === 'before' ? <>A · 소득 공백 {a.gapMonths === null ? '' : yearsMonths(a.gapMonths)}</> : <>B · 공적연금 수령 ({ym(a.publicStart!)}~)</>}</div>
            <div className="flow-columns">{g.items.map(({ w, weight }) => {
              const amount = w.subtotalWon ?? w.sources.reduce((s, x) => s + x.won, 0);
              return <div key={w.from} className="flow-col" style={{ flexGrow: weight }} title={`${w.label} · ${w.from}${w.until ? ` ~ ${w.until} 전` : ' 이후'}`}>
                <div className="flow-plot">
                  <span className="flow-amount">{w.subtotalWon !== null ? won(w.subtotalWon) : w.sources.length ? '합산 보류' : w.phase === 'after' ? '월액 미확인' : '정기 수입 없음'}</span>
                  {w.sources.length > 0 && <div className={`flow-stack${w.subtotalWon === null ? ' flow-uncertain' : ''}`} style={{ height: `${Math.max(4, amount / max * 100)}%` }}>
                    {w.sources.map(s => <i key={s.label} className={`seg-${kindOf(s.label)}`} style={{ flexGrow: s.won }} />)}</div>}
                </div>
                <span className="flow-axis">{ym(w.from)}<br />{shortLabel(w)}</span>
              </div>; })}</div>
          </div>)}</div>
          <figcaption className="flow-legend">{kinds.has('ktcu') && <span><i className="seg-ktcu" />공제회 분할</span>}{kinds.has('pension') && <span><i className="seg-pension" />공적연금</span>}{kinds.has('other') && <span><i className="seg-other" />기타</span>}
            {!a.split.selected && <span className="profile-help">공제회는 일시금 선택 · 월수입에서 제외</span>}{input.monthlyLivingCost ? <span className="profile-help">희망 생활비 비교는 아래 ‘구간별 월수입’에서 확인</span> : null}</figcaption>
        </figure></>}
  </section>;
}

/** Lump sums at retirement: one total, one stacked bar, and separate (not summed) retirement benefits. */
export function LumpSumOverview({ input, result: r }: { input: SimpleInputs; result: SimpleResults }) {
  const items = [{ key: 'ktcu', name: '교직원공제회', won: r.ktcu.amountWon }, { key: 'irp', name: 'IRP', won: r.irp.amountWon }, { key: 'saving', name: '연금저축', won: r.saving.amountWon }];
  const known = items.filter(x => x.won !== null && x.won > 0) as { key: string; name: string; won: number }[];
  const sum = known.reduce((s, x) => s + x.won, 0) || 1;
  const early = input.profile.retirement === 'early';
  const benefits = [{ key: 'allowance', name: '퇴직수당', won: r.benefitSummary.allowance.amountWon }, ...(early ? [{ key: 'honorary', name: '명예퇴직수당', won: r.benefitSummary.honorary.amountWon }] : [])];
  return <section className="benefit-result" aria-label="주요 적립금 합계"><h3>퇴직할 때 모이는 목돈</h3>
    <strong className="benefit-amount">{won(r.accumulationTotal, '전체 적립금 합산 불가')}</strong>
    <p className="profile-help">공제회·IRP·연금저축 예상 적립금 합계 · 세전 · {r.retirement.date ?? '퇴직일'} 기준</p>
    <figure className="lump-chart" aria-label="주요 적립금 구성 그래프"><figcaption className="sr-only">퇴직 시 주요 적립금 구성 · 입력된 항목만 표시</figcaption>
      <div className="lump-bar">{known.map(x => <i key={x.key} className={`seg-${x.key}`} style={{ flexGrow: x.won }} title={`${x.name} ${won(x.won)}`} />)}</div>
      <ul className="lump-legend">{items.map(x => <li key={x.key}><i className={`seg-${x.key}`} /><span>{x.name}</span><strong>{won(x.won, '미입력')}</strong>{x.won !== null && x.won > 0 && <em>{Math.round(x.won / sum * 100)}%</em>}</li>)}</ul>
    </figure>
    <div className="lump-benefits"><span className="section-tag">별도 · 퇴직급여 (세전 참고, 지급 미확정)</span>
      <ul>{benefits.map(b => <li key={b.key}><span>{b.name}</span><strong>{won(b.won, '추정 불가')}</strong></li>)}</ul>
      <p className="profile-help">퇴직급여는 위 적립금 합계에 더하지 않았습니다. 연금계좌 합계 {won(r.accountsTotal)} · 환급 재투자 {input.reinvest ? r.reinvestError || won(r.reinvestEffect) : '미선택'}</p></div>
  </section>;
}
