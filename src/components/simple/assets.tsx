import type { SimpleInputs, SimpleAccount } from '@/lib/simple/model';
import type { SimpleResults } from '@/lib/simple/calculation';
import { simpleConfig, simpleDisclaimer } from '@/lib/simple/config';
import { Field, Result, won, OfficialLink } from './shared';
export function SimpleKtcuPanel({ value, onChange, result }: { value: SimpleInputs['ktcu']; onChange: (v: SimpleInputs['ktcu']) => void; result: SimpleResults }) {
  return <div className="simple-panel"><p className="form-description">장기저축급여만 간편하게 살펴봅니다. 공통 퇴직일: {result.retirement.date ?? '01에서 확인해 주세요.'}</p>
    <Field label="현재 적립금 또는 현재 조회 급여금 (원)" value={value.balance} onChange={balance => onChange({ ...value, balance })} />
    <p className="profile-help">오늘 현재의 세전 기준 잔액을 입력하세요. 미래 퇴직일까지의 이자가 포함된 예상 퇴직급여금은 현재 잔액과 다릅니다. 미래 예상액을 입력하면 이자를 중복 계산할 수 있습니다. 세후 조회액이면 본 결과도 순수한 세전액으로 볼 수 없습니다.</p>
    <Field label="앞으로의 월 납입액 (원)" value={value.monthly} onChange={monthly => onChange({ ...value, monthly })} />
    <p className="profile-help">앞으로 매월 납입할 것으로 예상되는 금액을 입력하세요. 입력한 금액을 퇴직일까지 계속 납입한다고 가정합니다.</p>
    <label className="checkbox"><input type="checkbox" checked={value.split} onChange={e => onChange({ ...value, split: e.target.checked })} />퇴직 후 장기저축급여를 분할하여 수령하겠습니다.</label>
    {value.split && <Field label="분할 수령기간" value={value.years} onChange={years => onChange({ ...value, years })}>{[5,10,15,20,25,30].map(y => <option key={y} value={y}>{y}년</option>)}</Field>}
    <details className="simple-details"><summary>적용 이율·가입 조건·계산 근거</summary><p className="profile-help">한국교직원공제회 2026년 7월 1일 기준 장기저축급여율 연복리 5.00%를 전체 미래 기간에 고정 적용한 시뮬레이션입니다. 실제 급여율은 변동될 수 있습니다.</p><p className="profile-help">현재 잔액 기준은 {result.today}입니다. 완료 월마다 연 이율을 월복리로 환산하고 이자를 원 단위 반올림한 뒤 월 납입액을 더합니다. 마지막 미완성 월은 제외하고 퇴직일까지 추가 납입·수익이 없다고 가정합니다. 과거 연차별 급여율·특별가산금·세금은 반영하지 않습니다.</p>
      <p className="profile-help">분할급여금은 장기저축 가입자의 해당 퇴직 사유 등 자격을 확인해야 합니다. 세후 퇴직급여금 이내 최저 500만원·100만원 단위입니다. 이 화면은 세후 전환금액·자격을 확정하지 않으며 계산된 전체 세전 잔액을 가상 인출 원금으로 사용합니다. 500만원 미만이거나 금액 단위가 맞지 않아도 공식 가입 가능 금액이 아닙니다.</p><p className="profile-help">매월 25일, 퇴직일을 전환일로 가정하여 한 달 경과 후 첫 25일을 표시합니다. 실제 신청·전환일·휴일 조정은 기관 확인이 필요합니다. 금액은 정규 월 간격 원리금 균등 가상 인출로, 첫 지급까지의 추가 일수 이자·공식 끝수·세금은 반영하지 않습니다.</p>
      <OfficialLink href={simpleConfig.ktcuUrl}>장기저축급여 공식 안내</OfficialLink> · <OfficialLink href={simpleConfig.splitUrl}>분할급여금 공식 안내</OfficialLink> · <OfficialLink href={simpleConfig.splitApplicationUrl}>신청 조건</OfficialLink></details>
    <Result title="퇴직 시 예상 장기저축급여 적립금" result={result.ktcu}>
      {result.ktcu.amountWon !== null && <p className="profile-help">기준잔액 {won(result.ktcu.initial)} + 향후 납입 {won(result.ktcu.deposits)} + 가정 증가액 {won(result.ktcu.gain)} · 세금 미반영</p>}
    </Result>
    {value.split ? <section className="benefit-result" aria-label="가정 기반 분할 수령 결과"><h3>가정 기반 분할 수령 시뮬레이션</h3><strong className="benefit-amount">{won(result.split?.monthlyWon ?? null)} / 월</strong><p>총 예상 수령액 {won(result.split?.totalWon ?? null)}</p><p>매월 25일 · {value.years}년 · 첫 가상 지급일 {result.split?.rows[0]?.date ?? '계산 불가'}</p><p className="profile-help">조건부 추정값 · 세금 미반영 · 공식 상품 지급액 아님. 마지막 지급액은 원 단위 잔액 정산으로 달라질 수 있습니다. 총수령액을 원래 적립금에 더하지 않습니다.</p>{result.splitError && <p className="field-error">{result.splitError}</p>}</section>
      : <section className="benefit-result" aria-label="공제회 일시 수령 결과"><h3>퇴직 시 예상 일시 수령액</h3><strong className="benefit-amount">{won(result.ktcu.amountWon)}</strong><p className="profile-help">조건부 추정값 · 세금 미반영 · 위 적립금과 같은 금액이며 추가 자산이 아닙니다.</p></section>}
    <p className="benefit-disclaimer">{simpleDisclaimer}</p></div>;
}
export function SimpleAccountsPanel({ value, onChange, result }: { value: SimpleInputs; onChange: (v: SimpleInputs) => void; result: SimpleResults }) {
  const update = (key: 'irp' | 'saving', patch: Partial<SimpleAccount>) => onChange({ ...value, [key]: { ...value[key], ...patch } });
  return <div className="simple-panel"><p className="form-description">교사 기본정보에서 선택한 퇴직일까지 현재 월 납입액을 유지하는 것으로 계산합니다.</p><div className="simple-account-grid">{(['irp','saving'] as const).map(key => {
    const title = key === 'irp' ? 'IRP' : '연금저축'; return <section key={key} className="simple-input-card"><h3>{title}</h3><Field label={`${title} 현재 적립금 또는 평가금액 (원)`} value={value[key].balance} onChange={balance => update(key, { balance })} /><Field label={`${title} 앞으로의 월 납입액 (원)`} value={value[key].monthly} onChange={monthly => update(key, { monthly })} />
      <p className="profile-help">{key === 'irp' ? '주식·채권 혼합투자를 가정하여 연 7.0%의 장기 계획 수익률을 적용합니다.' : '미국 지수 추종 ETF의 높은 투자 비중을 가정하여 연 8.0%의 장기 계획 수익률을 적용합니다.'} 실제 투자수익률과 다를 수 있습니다.</p></section>;
  })}</div><label className="checkbox"><input type="checkbox" checked={value.reinvest} onChange={e => onChange({ ...value, reinvest: e.target.checked })} />세액공제 환급액을 재투자하겠습니다.</label>
    {value.reinvest && <p className="profile-context">재투자 효과 미반영 · 실제 환급액은 소득·결정세액·공제 대상 납입액에 따라 다릅니다. 간편 모드는 이 정보를 요구하지 않아 환급액·재투자액을 계산하지 않습니다. 0원으로 확정한 것이 아닙니다. 추가 납입한도·추가 공제 확인도 필요합니다.</p>}
    <p className="profile-help">일반 개인납입 합산 연 1,800만원 한도를 기준으로 월 납입 계획을 확인합니다. 다른 계좌 납입·기존 연중 납입·특례는 별도 확인이 필요합니다. <OfficialLink href={simpleConfig.contributionLawUrl}>납입한도 규정</OfficialLink></p>
    <details className="simple-details"><summary>복리·수익률 가정 자세히 보기</summary><p className="profile-help">기준일 {result.today}, 공통 퇴직일 {result.retirement.date ?? '확인 필요'}. 완료 월마다 (1+연 수익률)^(1/12)로 잔액 성장 후 월 납입, 곱셈 결과 원 단위 반올림. 미완성 월은 제외하고 남은 일수에는 추가 납입·수익이 없다고 가정합니다. 세금·수수료·환율·수령 자격·수익률 변동은 미반영입니다. 현재 잔액의 과거 원금/이자는 구분할 수 없습니다.</p><p className="profile-help">설정 {simpleConfig.version} · 기준일 {simpleConfig.checkedOn}. 연 7%·8%는 과거 ETF 10년 실적이나 미래 보장 수익률이 아닙니다. 공식 운용사 자료의 기준일·통화·NAV 총수익률을 개인 계좌 수익률로 바꿔 적용하지 않습니다.</p>
      <OfficialLink href="https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy">SPY 공식 자료</OfficialLink> · <OfficialLink href="https://www.invesco.com/qqq-etf/en/performance.html">QQQ 공식 자료</OfficialLink> · <OfficialLink href="https://www.ishares.com/us/products/239458/ishares-core-us-aggregate-bond-etf">AGG 공식 자료</OfficialLink></details>
    <div className="ktcu-cards">{(['irp','saving'] as const).map(key => <Result key={key} title={`퇴직 시 ${key === 'irp' ? 'IRP' : '연금저축'} 예상 적립금`} result={result[key]}>
      {result[key].amountWon !== null && <><p className="profile-help">현재 평가금액 {won(result[key].initial)} + 향후 납입원금 {won(result[key].deposits)} + 예상 투자손익 {won(result[key].gain)}</p><p className="profile-help">현재 잔액의 미래가치 {won(result[key].initialFuture)} / 향후 납입금의 미래가치 {won(result[key].depositsFuture)}</p></>}</Result>)}</div>
    <section className="benefit-result" aria-label="연금계좌 예상 적립금 합계"><h3>두 계좌의 예상 적립금 합계</h3><strong className="benefit-amount">{won(result.accountsTotal)}</strong><p className="profile-help">조건부 추정값 · 세금 미반영 · 계좌가 없으면 잔액과 월 납입액에 각각 0원을 직접 입력하세요. 누락 계좌를 0원으로 채우지 않습니다.</p><p>세액공제 환급액 재투자 추가 효과: {value.reinvest ? '계산 불가 · 실제 환급 조건 미확인' : '미선택 · 미반영'}</p></section><p className="benefit-disclaimer">{simpleDisclaimer} 원금손실이 발생할 수 있습니다.</p></div>;
}
