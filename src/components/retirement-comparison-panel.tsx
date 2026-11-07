import type { ReactNode } from 'react';
import type { TeacherProfile } from '@/lib/profile';
import type { BenefitInput, PensionInputs, SupportedScheme } from '@/lib/finance/pension-input';
import type { KtcuInput } from '@/lib/finance/ktcu-input';
import type { IrpInput } from '@/lib/finance/irp-input';
import { type RetirementComparisonInput, type RetirementScenario, type ScenarioKey, comparisonDisclaimer } from '@/lib/finance/retirement-comparison-input';
import { automaticRetirement, retirementRule, scenarioDate } from '@/lib/finance/retirement-comparison-validation';
import { calculateRetirementScenario, type ComparisonItem, type RetirementScenarioResult } from '@/lib/finance/retirement-comparison';
import { todayInKorea } from '@/lib/profile-validation';

const names: Record<ScenarioKey, string> = { early: '명퇴', normal: '정년', custom: '사용자 지정' };
const labels = { allowance: '퇴직수당', honorary: '명예퇴직수당', ktcu: '교직원공제회 예상 적립금', irp: 'IRP 예상 적립금', saving: '연금저축 예상 적립금' };
const won = (n: number | null) => n === null ? '계산 불가' : `${n.toLocaleString('ko-KR')}원`;
function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <div className="benefit-field"><label>{label}<input type={type} value={value} onChange={e => onChange(e.target.value)} /></label></div>;
}
function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return <div className="benefit-field"><label>{label}<select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{children}</select></label></div>;
}
function QuoteFields({ prefix, quote, pension, onChange }: { prefix: string; quote: BenefitInput; pension: boolean; onChange: (v: BenefitInput) => void }) {
  const set = (key: keyof BenefitInput, value: string) => onChange({ ...quote, [key]: value });
  return <div className="benefit-fields"><Field label={`${prefix} 공식 예상액 (원)`} value={quote.money.amount} onChange={v => onChange({ ...quote, money: { amount: v, unit: 'won' } })} />
    <Field label={`${prefix} 조회 기준일`} type="date" value={quote.queryDate} onChange={v => set('queryDate', v)} />
    <Field label={`${prefix} 조회 시 가정한 퇴직일`} type="date" value={quote.retirementDate} onChange={v => set('retirementDate', v)} />
    {pension && <Field label={`${prefix} 지급개시일`} type="date" value={quote.startDate} onChange={v => set('startDate', v)} />}
    <Select label={`${prefix} 세전·세후`} value={quote.taxBasis} onChange={v => set('taxBasis', v)}><option value="">선택</option><option value="gross">세전</option><option value="net">세후 · 세전 합산 제외</option></Select>
    <Field label={`${prefix} 적용 규정·조회 가정`} value={quote.assumptions} onChange={v => set('assumptions', v)} />
  </div>;
}
function Item({ label, item, monthly = false }: { label: string; item: ComparisonItem; monthly?: boolean }) {
  return <section className="benefit-result" aria-label={label}><h4>{label}</h4><strong className="benefit-amount">{won(item.amountWon)}{item.amountWon !== null && monthly ? ' / 월' : ''}</strong><p className="profile-help">{item.confidence} · {item.tax === 'net' ? '세후 · 입력값 그대로' : item.tax === 'gross' ? '세전' : '세전·세후 미확인'} · {monthly ? '월 지급' : '일시금·적립금'}</p>{item.queryDate && <p className="profile-help">조회일 {item.queryDate} · 가정 퇴직일 {item.date}</p>}{item.start && <p className="profile-help">공적연금 개시일 {item.start}</p>}<ul className="profile-help">{item.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></section>;
}
function Composition({ results }: { results: RetirementScenarioResult[] }) {
  const keys = ['allowance', 'honorary', 'ktcu', 'irp', 'saving'] as const;
  const max = Math.max(1, ...results.map(r => r.subtotal ?? 0));
  const colors = ['#20604f', '#758846', '#a48448', '#4e8794', '#9a79a5'];
  return <figure className="ktcu-chart"><svg viewBox={`0 0 600 ${results.length * 92 + 10}`} role="img" aria-label="시나리오별 퇴직 시점 금융자산 구성">
    {results.map((r, i) => { let x = 20; return <g key={r.key}><text x="20" y={i * 92 + 18} fontSize="12">{names[r.key]} · {r.date || '퇴직일 미입력'} · {r.complete ? '세전 합계' : '확인된 세전 항목 소계'} {won(r.subtotal)}</text>{keys.map((key, j) => { const item = r[key]; const width = r.errors.length || r.aggregationIssues.length || item.amountWon === null || item.tax !== 'gross' ? 0 : item.amountWon / max * 550; const start = x; x += width; return <rect key={key} x={start} y={i * 92 + 30} width={width} height="26" fill={colors[j]}><title>{labels[key]}: {item.tax === 'net' ? '세후 조회액 · 그래프 제외' : won(item.amountWon)}</title></rect>; })}<text x="20" y={i * 92 + 75} fontSize="10">각자의 퇴직일 스냅샷 · 동일 시점의 자산 비교가 아닙니다.</text></g>; })}
  </svg><figcaption>초록 퇴직수당 · 연두 명퇴수당 · 갈색 공제회 · 파랑 IRP · 보라 연금저축. 미입력·미확정·세후액은 막대에서 제외하며 0원으로 간주하지 않습니다.</figcaption></figure>;
}
function GapChart({ results }: { results: RetirementScenarioResult[] }) {
  const max = Math.max(1, ...results.map(r => r.gap?.days ?? 0));
  return <figure className="ktcu-chart"><svg viewBox={`0 0 600 ${results.length * 85 + 15}`} role="img" aria-label="퇴직일부터 공적연금 개시일까지의 기간">
    {results.map((r, i) => <g key={r.key}><text x="20" y={i * 85 + 17} fontSize="12">{names[r.key]} · {r.gap ? `${r.gap.months}개월 ${r.gap.extraDays}일 (${r.gap.days}일)` : '개시일·공식 월연금 확인 필요'}</text>{r.gap && <rect x="20" y={i * 85 + 29} width={r.gap.days / max * 550} height="20" fill="#a48448" />}<text x="20" y={i * 85 + 68} fontSize="10">{r.date || '퇴직일 미입력'} → {r.pension.start || '공적연금 개시일 미확인'}</text></g>)}
  </svg><figcaption>같은 일수 눈금으로 표시한 공적연금 미지급 기간입니다. 다른 소득·생활비를 반영한 전체 소득 공백이나 부족액은 아닙니다.</figcaption></figure>;
}
export function RetirementComparisonPanel({ value, onChange, profile, pensions, ktcu, irp, onNavigate }: {
  value: RetirementComparisonInput; onChange: (v: RetirementComparisonInput) => void; profile: TeacherProfile;
  pensions: PensionInputs; ktcu: KtcuInput; irp: IrpInput; onNavigate: (menu: string) => void;
}) {
  const set = <K extends keyof RetirementComparisonInput>(key: K, v: RetirementComparisonInput[K]) => onChange({ ...value, [key]: v });
  const update = (key: ScenarioKey, patch: Partial<RetirementScenario>) => set('scenarios', { ...value.scenarios, [key]: { ...value.scenarios[key], ...patch } });
  const auto = automaticRetirement(profile, value), today = todayInKorea();
  const keys: ScenarioKey[] = value.customEnabled ? ['early', 'normal', 'custom'] : ['early', 'normal'];
  const results = keys.map(key => calculateRetirementScenario(key, value, profile, pensions, ktcu, irp, today));
  function edit(key: ScenarioKey) { const element = document.getElementById(`${key}-conditions`) as HTMLDetailsElement | null; if (element) { element.open = true; element.scrollIntoView({ behavior: 'smooth', block: 'start' }); element.querySelector('input,select')?.scrollIntoView({ block: 'nearest' }); } }
  return <div className="comparison-panel ktcu-panel"><p className="form-description">명퇴와 정년의 퇴직일별 연금·급여·적립금을 비교합니다. 우열이나 동일 연령 자산은 은퇴 현금흐름 검토 전 확정하지 않습니다.</p>
    <p className="profile-context">{profile.schoolType === 'public' ? '국공립학교' : '사립학교'} · 생년월일 {profile.birthDate || '미입력'} · 최초 임용일 {profile.appointmentDate || '미입력'}. 임용일부터의 달력상 근속은 공단 인정기간·명퇴 자격으로 대체하지 않습니다.</p>
    <section className="benefit-section"><h3>정년 적용 조건 확인</h3><div className="benefit-fields">
      <Select label="비교 학교급" value={value.schoolLevel} onChange={v => set('schoolLevel', v as RetirementComparisonInput['schoolLevel'])}><option value="">선택</option>{Object.entries({ kindergarten: '유치원', primary: '초등학교', middle: '중학교', high: '고등학교', special: '특수학교', university: '대학교', other: '기타' }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      <Select label="비교 직위·신분" value={value.position} onChange={v => set('position', v as RetirementComparisonInput['position'])}><option value="">선택</option><option value="regular-teacher">일반 정규 교사</option><option value="principal">교장·원장</option><option value="vice-principal">교감·원감</option><option value="fixed-term">기간제교원</option><option value="other">기타</option></Select>
      <Select label="정년퇴직일 입력 방식" value={value.normalMode} onChange={v => set('normalMode', v as RetirementComparisonInput['normalMode'])}><option value="auto">검증 범위에서 자동 산정</option><option value="manual">기관 확인일 직접 입력</option></Select></div>
      <label className="checkbox"><input type="checkbox" checked={value.ruleConfirmed} onChange={e => set('ruleConfirmed', e.target.checked)} />교육공무원법 제47조 적용 일반 교사이며 별도 계약·임기 종료가 없음을 확인합니다.</label>
      <p className="profile-help">{auto.reason} 자동 산정일: {auto.date || '계산 불가'}. 적용 법령 시행일 {retirementRule.effectiveOn} · 확인일 {retirementRule.checkedOn}. 사립은 법인 정관·인사부서 확인이 필요합니다.</p>
      <label className="checkbox"><input type="checkbox" checked={value.customEnabled} onChange={e => set('customEnabled', e.target.checked)} />사용자 지정 퇴직일 추가 비교</label>
    </section>
    <div className="comparison-actions"><button className="secondary" onClick={() => edit('early')}>명퇴 조건 수정</button><button className="secondary" onClick={() => edit('normal')}>정년 조건 수정</button></div>
    <div className="comparison-grid">{results.map(r => {
      const key = r.key, s = value.scenarios[key], prefix = names[key];
      const scheme: SupportedScheme | null = r.scheme === 'civil' || r.scheme === 'private-school' ? r.scheme : null;
      const updateQuote = (kind: 'pension' | 'allowance' | 'honorary', q: BenefitInput) => { if (scheme) update(key, { quotes: { ...s.quotes, [scheme]: { ...s.quotes[scheme], [kind]: q } } }); };
      return <section className="comparison-column" aria-label={`${prefix} 비교`} key={key}><h3>{prefix === '명퇴' ? '명예퇴직' : prefix === '정년' ? '정년퇴직' : '사용자 지정 퇴직'}</h3>
        <p>예상 퇴직일: <strong>{r.date || '미입력'}</strong></p><p className="profile-help">{key === 'normal' && value.normalMode === 'auto' && auto.date ? '검증된 추정값 · 현행 규정 적용 조건 내 날짜 산정' : '조건부 추정값 · 사용자 지정일, 기관 확인 필요'}</p>
        {r.errors.length > 0 && <ul className="field-error" role="alert">{r.errors.map(e => <li key={e}>{e}</li>)}</ul>}
        <details id={`${key}-conditions`}><summary>{prefix} 입력 조건</summary>
          {key === 'normal' && value.normalMode === 'auto' ? <p className="profile-help">학교급·직위·생년월일에서 자동 산정합니다. 직접 변경하려면 위에서 기관 확인일 직접 입력을 선택하세요.</p> : <Field label={`${prefix} 퇴직예정일`} type="date" value={s.date} onChange={v => update(key, { date: v })} />}
          <Select label={`${prefix} 연금제도`} value={s.scheme} onChange={v => update(key, { scheme: v as RetirementScenario['scheme'] })}><option value="profile">교사 기본정보 연결</option><option value="civil">공무원연금</option><option value="private-school">사학연금</option></Select>
          <p className="profile-help">적용 제도: {r.scheme === 'civil' ? '공무원연금' : r.scheme === 'private-school' ? '사학연금' : '가입제도 확인 필요'}. 공식 조회값도 사용자가 직접 입력한 값입니다.</p>
          {(['pension', 'allowance'] as const).map(kind => <div key={kind}><Select label={`${prefix} ${kind === 'pension' ? '월연금' : '퇴직수당'} 출처`} value={s[kind === 'pension' ? 'pensionSource' : 'allowanceSource']} onChange={v => update(key, { [kind === 'pension' ? 'pensionSource' : 'allowanceSource']: v })}><option value="linked">02 공적연금 입력 실시간 연결 · 퇴직일 일치 시만</option><option value="local">이 시나리오의 공식 조회값 별도 입력</option></Select>{scheme && s[kind === 'pension' ? 'pensionSource' : 'allowanceSource'] === 'local' && <QuoteFields prefix={`${prefix} ${kind === 'pension' ? '월연금' : '퇴직수당'}`} quote={s.quotes[scheme][kind]} pension={kind === 'pension'} onChange={q => updateQuote(kind, q)} />}</div>)}
          {key === 'early' && <><Select label="명퇴 자격 확인 상태" value={s.eligibility} onChange={v => update(key, { eligibility: v as RetirementScenario['eligibility'] })}><option value="unknown">기관 확인 전</option><option value="confirmed">기관에서 자격 확인 · 사용자 기록</option><option value="no">요건 미충족</option></Select><Select label="명퇴수당 선정 상태" value={s.selection} onChange={v => update(key, { selection: v as RetirementScenario['selection'] })}><option value="unknown">선정 미확정</option><option value="selected">선정 확인 · 사용자 기록</option><option value="rejected">미선정</option></Select><p className="profile-help">신청 가능 요건과 실제 선정·지급은 다릅니다. 인정 재직기간·제한 사유·교육청 회차·예산을 기관에 확인하세요. 앱은 자격을 자동 판정하지 않습니다.</p>{scheme && <QuoteFields prefix="명퇴 명예퇴직수당" quote={s.quotes[scheme].honorary} pension={false} onChange={q => updateQuote('honorary', q)} />}</>}
          <h4>기존 적립 모델 연결</h4><Select label={`${prefix} 공제회 금액 출처`} value={s.ktcuSource} onChange={v => update(key, { ktcuSource: v as RetirementScenario['ktcuSource'] })}><option value="simulation">03 장기저축 가정 시뮬레이션</option><option value="official">03 선택 상품 공식 일시금 조회액</option></Select>
          {(['ktcu', 'irp', 'saving'] as const).map(account => { const label = account === 'ktcu' ? '공제회' : account === 'irp' ? 'IRP' : '연금저축'; return <div key={account}><Select label={`${prefix} ${label} 납입 종료 기준`} value={s[`${account}StopMode`]} onChange={v => update(key, { [`${account}StopMode`]: v })}><option value="retirement">해당 퇴직일에 중단</option><option value="shared">03·04 메뉴 종료일 사용</option><option value="custom">별도 종료일 지정</option></Select>{s[`${account}StopMode`] === 'custom' && <Field label={`${prefix} ${label} 납입 종료일`} type="date" value={s[`${account}Stop`]} onChange={v => update(key, { [`${account}Stop`]: v })} />}<Field label={`${prefix} ${label} 가정 연 수익률 (%, 선택)`} value={s[`${account}Rate`]} onChange={v => update(key, { [`${account}Rate`]: v })} /></div>; })}
          <p className="profile-help">수익률을 비워 두면 03·04의 가정을 사용합니다. 기존 잔액·기준일·납입액·수수료는 연결됩니다. 종료일을 퇴직 뒤로 지정해도 퇴직 시점 잔액에는 그 뒤 납입이 포함되지 않습니다. 다른 메뉴 입력을 덮어쓰지 않습니다.</p>
        </details>
        <section className="benefit-result" aria-label={`${prefix} 은퇴 금융자산`}><h4>퇴직 시 예상 은퇴 금융자산 · 세전</h4><strong className="benefit-amount">{won(r.total)}</strong><p className="profile-help">{r.complete ? '조건부 추정값 · 아래 항목의 세전 합계' : '계산 불가 · 누락·미확정·세후 항목 확인 필요'}</p>{r.aggregationIssues.map(issue => <p className="profile-help" key={issue}>{issue}</p>)}{r.subtotal !== null && <p>확인된 세전 항목만의 소계: {won(r.subtotal)}</p>}<p className="profile-help">기준: {r.date || '미입력'} · 다른 퇴직일의 금액과 동일 시점으로 비교하지 않습니다.</p></section>
        <Item label={`${prefix} 예상 공적연금 월수령액`} item={r.pension} monthly />
        {(['allowance', 'honorary', 'ktcu', 'irp', 'saving'] as const).map(k => <Item key={k} label={`${prefix} ${labels[k]}`} item={r[k]} />)}
        <p className="profile-help">{r.reinvest}</p><details><summary>{prefix} 계산 근거 보기</summary><p className="profile-help">연금·수당은 해당 퇴직일의 공식 입력만 표시합니다. 공제회·IRP는 기존 순수 월별 적립 모델을 재사용하며 부분 월과 퇴직 후 납입은 제외합니다.</p><ul className="profile-help">{r.excluded.map(n => <li key={n}>{n}</li>)}</ul></details>
        <p className="benefit-disclaimer">{comparisonDisclaimer}</p>
      </section>;
    })}</div>
    <section className="benefit-section"><h3>퇴직 시점 금융자산 구성</h3><Composition results={results} /><h3>동일 기준연령 금융자산 비교</h3><p className="profile-help">은퇴 현금흐름 단계에서 제공 예정입니다. 퇴직 후 생활비·연금 인출·추가 소득과 운용을 포함하기 전에는 어느 시나리오가 최종적으로 유리한지 판단하지 않습니다.</p><h3>공적연금 개시 전 기간</h3><GapChart results={results} /></section>
    <section className="benefit-section"><h3>공적연금 공식 조회 안내</h3><p className="profile-help">각 시나리오의 퇴직일을 지정해 기관에서 월연금·개시일·퇴직수당을 조회하세요. 현재 퇴직 가정의 금액을 미래 퇴직일로 옮기지 마세요. 명예퇴직수당은 연금공단의 퇴직수당과 별도로 소속 교육청·법인에서 확인합니다.</p><p className="profile-help"><a href="https://www.geps.or.kr/" target="_blank" rel="noreferrer">공무원연금공단</a> · <a href="https://www.tp.or.kr/" target="_blank" rel="noreferrer">사학연금공단</a> · <a href={retirementRule.source} target="_blank" rel="noreferrer">정년 법령·시행일</a></p><div className="comparison-actions"><button className="secondary" onClick={() => onNavigate('공적연금·퇴직수당')}>02 공적연금 입력 수정</button><button className="secondary" onClick={() => onNavigate('교직원공제회')}>03 공제회 입력 수정</button><button className="secondary" onClick={() => onNavigate('IRP·연금저축')}>04 IRP·연금저축 입력 수정</button></div></section>
  </div>;
}
