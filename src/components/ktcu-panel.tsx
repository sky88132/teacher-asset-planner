'use client';

import { useState, type ReactNode } from 'react';
import type { TeacherProfile } from '@/lib/profile';
import type { MoneyInput } from '@/lib/finance/pension-input';
import { ktcuDisclaimer, type KtcuInput, type KtcuProduct, type KtcuQuote } from '@/lib/finance/ktcu-input';
import { ktcuProducts, ktcuReviewedOn } from '@/lib/finance/ktcu-products';
import { parseMoney, changeMoneyUnit } from '@/lib/finance/pension-input-validation';
import { isCalendarDate, todayInKorea } from '@/lib/profile-validation';
import { readRate, validateKtcuQuote, validateKtcuWithdrawal } from '@/lib/finance/ktcu-validation';
import { simulateKtcuAccumulation, simulateVirtualWithdrawals, type AccumulationResult, type WithdrawalResult } from '@/lib/finance/ktcu-simulation';

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return <div className="benefit-field"><label htmlFor={id}>{label}</label>{children}
    {error && <span id={`${id}-error`} className="field-error" role="alert">{error}</span>}</div>;
}
function Money({ id, label, value, error, onChange }: { id: string; label: string; value: MoneyInput; error?: string; onChange: (v: MoneyInput) => void }) {
  const message = error ?? parseMoney(value).error;
  return <Field id={id} label={label} error={message}><div className="money-input">
    <input id={id} inputMode="decimal" value={value.amount} aria-invalid={!!message} aria-describedby={message ? `${id}-error` : undefined}
      onChange={e => onChange({ ...value, amount: e.target.value })} />
    <select aria-label={`${label} 단위`} value={value.unit} onChange={e => onChange(changeMoneyUnit(value, e.target.value as MoneyInput['unit']))}>
      <option value="won">원</option><option value="manwon">만 원</option>
    </select></div></Field>;
}
function AccumulationChart({ result }: { result: AccumulationResult }) {
  const points = result.points.filter((p, i) => i === 0 || i % 12 === 0 || i === result.points.length - 1);
  const max = Math.max(result.finalWon, 1);
  const x = (month: number) => 30 + (result.months === 0 ? 0 : month / result.months * 520);
  const y = (amount: number) => 175 - amount / max * 145;
  const line = (kind: 'balance' | 'deposits') => points.map(p => `${x(p.month)},${y(kind === 'balance' ? p.balanceWon : result.initialWon + p.contributedWon)}`).join(' ');
  return <figure className="ktcu-chart"><svg viewBox="0 0 580 210" role="img" aria-labelledby="ktcu-chart-title ktcu-chart-desc">
    <title id="ktcu-chart-title">기준잔액·향후 납입과 가정 증가액 비교</title>
    <desc id="ktcu-chart-desc">기준잔액 {won(result.initialWon)}, 향후 납입 {won(result.futureContributionWon)}, 가정 증가액 {won(result.growthWon)}. 공식 상품 급여 그래프가 아닙니다.</desc>
    <path d="M30 20V175H550" fill="none" stroke="#dce7df" />
    <polyline points={line('deposits')} fill="none" stroke="#9aafa1" strokeWidth="3" strokeDasharray="6 4" />
    <polyline points={line('balance')} fill="none" stroke="#20604f" strokeWidth="3" />
    {points.length === 1 && <circle cx="30" cy={y(result.finalWon)} r="4" fill="#20604f" />}
    <text x="30" y="199" fontSize="12" fill="#66756e">기준일</text><text x="490" y="199" fontSize="12" fill="#66756e">{result.months}개월</text>
  </svg><figcaption>실선: 가정 잔액 · 점선: 기준잔액+향후 납입. 기준잔액에는 과거 이자가 포함될 수 있습니다.</figcaption></figure>;
}

export function KtcuPanel({ profile, value, onChange, onBack }: { profile: TeacherProfile; value: KtcuInput; onChange: (v: KtcuInput) => void; onBack: () => void }) {
  const [attempted, setAttempted] = useState(false);
  const today = todayInKorea();
  const product = ktcuProducts[value.product];
  const outcome = simulateKtcuAccumulation(value, today);
  const result = outcome.result;
  const quote = value.quotes[value.product];
  const quoteErrors = validateKtcuQuote(quote, today);
  const quoteValid = quote.enabled && Object.keys(quoteErrors).length === 0;
  const withdrawalErrors = validateKtcuWithdrawal(value);
  const principal = value.withdrawalSource === 'projection' ? result?.finalWon ?? null : parseMoney(value.withdrawalPrincipal).won;
  if (value.withdrawalSource === 'projection' && !result) withdrawalErrors.withdrawalPrincipal = '유효한 장기저축 적립 전망이 먼저 필요합니다. 공식 조회액을 자동으로 가져오지 않습니다.';
  let comparisons: WithdrawalResult[] = [];
  if (!Object.keys(withdrawalErrors).length && principal !== null) {
    try { comparisons = [5, 10, 15, 20, 25, 30].map(years => simulateVirtualWithdrawals(principal, readRate(value.withdrawalRate)!, years, value.retirementDate, today)); }
    catch (error) { withdrawalErrors.calculation = (error as Error).message; }
  }
  const selected = comparisons.find(row => String(row.years) === value.withdrawalYears);
  const update = <K extends keyof KtcuInput>(key: K, next: KtcuInput[K]) => onChange({ ...value, [key]: next });
  const updateQuote = (patch: Partial<KtcuQuote>) => update('quotes', { ...value.quotes, [value.product]: { ...quote, ...patch } });
  const error = (key: string) => attempted ? outcome.errors[key] ?? withdrawalErrors[key] ?? quoteErrors[key] : undefined;
  const text = (key: 'assumedRate' | 'changedRate' | 'withdrawalRate', label: string) => <Field id={`ktcu-${key}`} label={label} error={error(key)}>
    <input id={`ktcu-${key}`} inputMode="decimal" value={value[key]} aria-invalid={!!error(key)} aria-describedby={error(key) ? `ktcu-${key}-error` : undefined} onChange={e => update(key, e.target.value)} />
  </Field>;
  const date = (key: 'basisDate' | 'stopDate' | 'retirementDate' | 'changeDate', label: string) => <Field id={`ktcu-${key}`} label={label} error={error(key)}>
    <input id={`ktcu-${key}`} type="date" value={value[key]} aria-invalid={!!error(key)} aria-describedby={error(key) ? `ktcu-${key}-error` : undefined} onChange={e => update(key, e.target.value)} />
  </Field>;
  const baseMoney = parseMoney(value.balance);
  const currentValid = !baseMoney.error && baseMoney.won !== null && isCalendarDate(value.basisDate) && value.basisDate <= today;
  const baseline = value.changeEnabled && result ? simulateKtcuAccumulation({ ...value, changeEnabled: false }, today).result : null;
  return <div className="ktcu-panel">
    <p className="form-description">공식 조회값을 기록하고, 별도 가정으로 저축·인출 계획을 비교하세요.</p>
    <div className="profile-context">기본정보 연동 · {profile.schoolType === 'public' ? '국공립학교' : '사립학교'} · 최초 임용일 {profile.appointmentDate || '미입력'}<br />학교 구분만으로 공제회 가입자격을 확정하지 않습니다.</div>
    <form noValidate onSubmit={e => { e.preventDefault(); setAttempted(true); }}>
      <label className="pension-field">확인할 공제회 상품<select value={value.product} onChange={e => update('product', e.target.value as KtcuProduct)}>
        {Object.entries(ktcuProducts).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}
      </select></label>
      <p className="profile-help">{product.summary}</p>
      <section className="benefit-result" aria-label="공식 상품 확인 상태"><h3>공식 상품 계산 · 미검증</h3>
        <p className="profile-help">상품별 일자·경과금리·과세·끝수 처리 대조를 완료하지 못해 공식 급여액 자동 계산은 비활성화했습니다.</p>
        <p className="profile-help"><a href={product.url} target="_blank" rel="noreferrer">공제회 공식 상품 안내 ↗</a><br />공식 확인 이율: 세전 연 {product.rate.toFixed(2)}% · {product.effectiveOn} 기준 · 변동금리<br />자료 확인일 {ktcuReviewedOn}. 상품·지급주기별 적용이 다르며 미래 이율을 보장하지 않습니다.</p>
      </section>
      <section className="benefit-section"><h3>01 · 공식 조회액 직접 입력</h3>
        <label className="checkbox"><input type="checkbox" checked={quote.enabled} onChange={e => updateQuote({ enabled: e.target.checked })} />공식 조회액 직접 입력 사용</label>
        {quote.enabled && <><div className="benefit-fields">
          <Money id="ktcu-quoteMoney" label="공식 조회 급여금" value={quote.money} error={error('quoteMoney')} onChange={money => updateQuote({ money })} />
          <Field id="ktcu-quoteDate" label="공제회 조회 기준일" error={error('quoteDate')}><input id="ktcu-quoteDate" type="date" value={quote.queryDate} onChange={e => updateQuote({ queryDate: e.target.value })} /></Field>
          <Field id="ktcu-quoteTarget" label="조회 시 가정한 수령·퇴직일" error={error('quoteTarget')}><input id="ktcu-quoteTarget" type="date" value={quote.targetDate} onChange={e => updateQuote({ targetDate: e.target.value })} /></Field>
          <Field id="ktcu-quoteTax" label="공식 조회액 세전·세후" error={error('quoteTax')}><select id="ktcu-quoteTax" value={quote.taxBasis} onChange={e => updateQuote({ taxBasis: e.target.value as KtcuQuote['taxBasis'] })}><option value="">선택해 주세요</option><option value="gross">세전</option><option value="net">세후</option></select></Field>
          <Field id="ktcu-quotePayment" label="공식 조회액 지급 단위" error={error('quotePayment')}><select id="ktcu-quotePayment" value={quote.payment} onChange={e => updateQuote({ payment: e.target.value as KtcuQuote['payment'] })}><option value="">선택해 주세요</option><option value="lump-sum">일시금</option><option value="monthly">월 지급</option><option value="yearly">연 지급</option></select></Field>
        </div><p className="profile-help">공식 조회값도 사용자 직접 입력이며 진위는 미확인입니다. 상품별로 별도 보관하며 미래 조회 급여금을 현재 잔액으로 복리 계산하지 않습니다.</p></>}
        <section className="benefit-result" aria-label="공제회 공식 조회 결과"><h4>{product.name} · 공식 조회값</h4><strong className="benefit-amount">{quoteValid ? won(parseMoney(quote.money).won!) : '미입력 또는 확인 필요'}</strong>
          {quoteValid && <p className="profile-help">{quote.taxBasis === 'gross' ? '세전' : '세후'} · {quote.payment === 'monthly' ? '월 지급' : quote.payment === 'yearly' ? '연 지급' : '일시금'}<br />조회일 {quote.queryDate} · 가정한 수령·퇴직일 {quote.targetDate}<br />공식 조회값 · 사용자 직접 입력 · 앱 조회·진위 확인 아님</p>}
        </section>
      </section>
      <section className="benefit-section"><h3>02 · 장기저축 적립 가정</h3>
        <p className="profile-help">퇴직예정일은 공제회 계획용 입력입니다. 공적연금의 퇴직 가정은 덮어쓰지 않습니다.</p>
        <div className="benefit-fields">{date('retirementDate', '공제회 퇴직예정일')}</div>
        {value.product === 'long-term' ? <>
          <div className="benefit-fields">
            <Money id="ktcu-balance" label="현재 적립금 (기준일 잔액)" value={value.balance} error={error('balance')} onChange={v => update('balance', v)} />
            {date('basisDate', '현재 잔액 기준일')}
            <Field id="ktcu-balanceSource" label="현재 잔액 출처"><select id="ktcu-balanceSource" value={value.balanceSource} onChange={e => update('balanceSource', e.target.value as KtcuInput['balanceSource'])}><option value="user">사용자 입력 잔액</option><option value="official-current">공식 조회 현재 잔액 · 사용자 전사</option></select></Field>
            <Money id="ktcu-currentMonthly" label="현재 월 납입액" value={value.currentMonthly} error={error('currentMonthly')} onChange={v => update('currentMonthly', v)} />
            <Money id="ktcu-futureMonthly" label="향후 월 납입액" value={value.futureMonthly} error={error('futureMonthly')} onChange={v => update('futureMonthly', v)} />
            {date('stopDate', '납입 종료일')}
            <Field id="ktcu-depositTiming" label="가정 월 납입 시점"><select id="ktcu-depositTiming" value={value.depositTiming} onChange={e => update('depositTiming', e.target.value as KtcuInput['depositTiming'])}><option value="end">각 계산월 말</option><option value="begin">각 계산월 초</option></select></Field>
            <Field id="ktcu-rateSource" label="적용 이율 출처" error={error('rateSource')}><select id="ktcu-rateSource" value={value.rateSource} onChange={e => update('rateSource', e.target.value as KtcuInput['rateSource'])}><option value="assumed">사용자 가정 수익률</option><option value="official-reference">공식 확인 이율을 고정하는 가정</option></select></Field>
            {value.rateSource === 'assumed' && text('assumedRate', '사용자 가정 연 수익률 (%)')}
          </div>
          <label className="checkbox"><input type="checkbox" checked={value.changeEnabled} onChange={e => update('changeEnabled', e.target.checked)} />금리 변경 시나리오 사용 (사용자 가정)</label>
          {value.changeEnabled && <div className="benefit-fields">{date('changeDate', '가정 이율 변경일')}{text('changedRate', '변경 후 가정 연 수익률 (%)')}</div>}
          <p className="profile-help">현재 적립금은 세전 기준일 잔액으로 입력해 주세요. 현재 월 납입액은 기록용입니다. 기준일 잔액에 이미 반영된 납입금을 다시 더하지 않으며 이후에는 향후 월 납입액만 사용합니다. 공식 월 납입은 3만~150만원·6천원 단위이지만, 0원 등 가정 입력은 가입 가능성을 뜻하지 않습니다.</p>
          <div className="ktcu-cards">
            <section className="benefit-result" aria-label="공제회 현재 적립금"><h4>현재 적립금</h4><strong className="benefit-amount">{currentValid ? won(baseMoney.won!) : '미입력 또는 확인 필요'}</strong><p className="profile-help">{value.balanceSource === 'official-current' ? '공식 조회 현재 잔액 · 사용자 직접 입력' : '사용자 입력 잔액'} · {value.basisDate || '기준일 미입력'}</p></section>
            <section className="benefit-result" aria-label="공제회 퇴직 예상 적립금"><h4>퇴직 시점 적립 전망</h4><strong className="benefit-amount">{result ? won(result.finalWon) : '계산 불가'}</strong><p className="profile-help">세전 · 자체 시뮬레이션 · 공식 급여액 아님</p></section>
          </div>
          {result ? <><p className="profile-help">기준잔액 {won(result.initialWon)} + 향후 납입 {won(result.futureContributionWon)} + 가정 증가액 {won(result.growthWon)}<br />총 {result.months}개월 중 {result.contributionMonths}개월 납입 · 계산 종료일 {result.lastCalculatedDate}</p>
            <AccumulationChart result={result} />
            {baseline && <p className="feedback">이율 유지 가정: {won(baseline.finalWon)} / 변경 가정: {won(result.finalWon)} (동일한 세전 자체 모델)</p>}
          </> : <p className="profile-help">금액·날짜·이율을 모두 입력하면 가정 전망을 표시합니다. 미입력 금액은 0원이 아닙니다.</p>}
          {attempted && outcome.errors.calculation && <p role="alert" className="field-error">{outcome.errors.calculation}</p>}
          <p className="profile-help">계산 근거: 연 유효수익률을 월 수익률로 환산하고 월 이자를 원 단위 반올림합니다. 기준일의 매월 같은 일(없는 날은 월 말)로 완성된 개월만 계산하며 잔여 일수는 제외합니다. 변경일 이후 첫 월 계산부터 새 가정 이율을 적용합니다. 납입 종료 후에도 퇴직 전까지 이자를 가정합니다. 실제 미납·탈퇴 조건과는 다릅니다.</p>
        </> : <p className="feedback">이 상품의 공식 자동 계산은 미검증입니다. 장기저축 적립 모델을 적용하지 않습니다. 위 공식 조회액 입력 또는 아래 별도 가상 인출을 이용해 주세요.</p>}
      </section>
      <section className="benefit-section"><h3>03 · 가상 인출 시뮬레이션</h3><p className="profile-help">공식 분할급여금·퇴직생활급여 예상액이 아닙니다. 퇴직일에 준비한 자금을 다음 달부터 매월 인출하는 독립적인 가정입니다.</p>
        <div className="benefit-fields">
          <Field id="ktcu-withdrawalSource" label="가상 인출 시작금액 출처"><select id="ktcu-withdrawalSource" value={value.withdrawalSource} onChange={e => update('withdrawalSource', e.target.value as KtcuInput['withdrawalSource'])}><option value="manual">퇴직일 기준 자금 직접 입력</option><option value="projection" disabled={value.product !== 'long-term'}>위 자체 적립 전망 사용 · 장기저축 전용</option></select></Field>
          {value.withdrawalSource === 'manual' && <Money id="ktcu-withdrawalPrincipal" label="가상 인출 시작금액" value={value.withdrawalPrincipal} error={error('withdrawalPrincipal')} onChange={v => update('withdrawalPrincipal', v)} />}
          {text('withdrawalRate', '가상 인출 가정 연 수익률 (%)')}
          <Field id="ktcu-withdrawalYears" label="분할 수령 희망 기간" error={error('withdrawalYears')}><select id="ktcu-withdrawalYears" value={value.withdrawalYears} onChange={e => update('withdrawalYears', e.target.value)}><option value="">선택해 주세요</option>{[5, 10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n}년 · 가상 비교</option>)}</select></Field>
        </div>
        {attempted && withdrawalErrors.withdrawalPrincipal && value.withdrawalSource === 'projection' && <p className="field-error" role="alert">{withdrawalErrors.withdrawalPrincipal}</p>}
        {attempted && withdrawalErrors.calculation && <p className="field-error" role="alert">{withdrawalErrors.calculation}</p>}
        <section className="benefit-result" aria-label="가상 인출 결과"><h4>가상 인출 · 세전</h4>
          <strong className="benefit-amount">{selected ? `${won(selected.monthlyWon)} / 월` : '계산 불가'}</strong>
          {selected && <><p className="profile-help">{selected.years}년 · 첫 지급일 {selected.rows[0].date} · 마지막 지급 {won(selected.lastPaymentWon)}<br />총수령 {won(selected.totalWon)} · 가정 증가액 {won(selected.growthWon)} · 세후 계산 불가</p>
            <div className="ktcu-table-wrap"><table className="ktcu-table"><caption>수령기간별 가상 비교 · 세전</caption><thead><tr><th>기간</th><th>월 지급</th><th>마지막 지급</th><th>총수령</th></tr></thead><tbody>{comparisons.map(row => <tr key={row.years}><td>{row.years}년</td><td>{won(row.monthlyWon)}</td><td>{won(row.lastPaymentWon)}</td><td>{won(row.totalWon)}</td></tr>)}</tbody></table></div>
            <details><summary>선택 기간의 월별 가상 지급 일정</summary><div className="ktcu-table-wrap ktcu-schedule"><table className="ktcu-table"><caption>{selected.years}년 월별 일정 · 세전</caption><thead><tr><th>지급일</th><th>가정 이자</th><th>인출액</th><th>잔액</th></tr></thead><tbody>{selected.rows.map(row => <tr key={row.month}><td>{row.date}</td><td>{won(row.interestWon)}</td><td>{won(row.paymentWon)}</td><td>{won(row.balanceWon)}</td></tr>)}</tbody></table></div></details>
          </>}
          <p className="profile-help">월 이자는 원 단위 반올림, 균등 인출액은 원 단위 내림 후 마지막 회차에 잔액을 정산합니다. 세금·수수료·상품 가입조건은 반영하지 않습니다. 세후 금액을 0원 또는 세전과 같은 값으로 표시하지 않습니다.</p>
        </section>
      </section>
      <button className="secondary" type="submit">공제회 입력 확인</button>
      {attempted && <p className="profile-help" role="status">필드별 확인 안내를 검토해 주세요. 공식 조회·적립 가정·가상 인출 결과는 각각 독립적으로 표시됩니다.</p>}
    </form>
    <p className="profile-help">계산 신뢰도: 공식 기록은 공식 조회값(사용자 전사·진위 미확인), 시뮬레이션은 조건부 추정값입니다. 공식 상품 계산은 미검증입니다. 계산일 {today} · 이율 자료 확인일 {ktcuReviewedOn}. 실제 지급액 일치 확률은 산출하지 않습니다.</p>
    <p className="benefit-disclaimer">{ktcuDisclaimer}</p>
    <p className="profile-help">메뉴 이동 시 입력이 유지됩니다. 새로고침하면 초기화되며 서버·브라우저 저장소에는 저장하지 않습니다.</p>
    <button type="button" className="secondary" onClick={onBack}>기본정보 입력으로 돌아가기</button>
  </div>;
}
