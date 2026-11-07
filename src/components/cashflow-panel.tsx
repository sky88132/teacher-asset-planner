import { useState, type ReactNode } from 'react';
import type { TeacherProfile } from '@/lib/profile';
import { todayInKorea } from '@/lib/profile-validation';
import type { PensionInputs } from '@/lib/finance/pension-input';
import type { KtcuInput } from '@/lib/finance/ktcu-input';
import type { IrpInput } from '@/lib/finance/irp-input';
import type { RetirementComparisonInput } from '@/lib/finance/retirement-comparison-input';
import { type CashflowInput, type CashflowKey, type CashflowScenarioInput, cashflowDisclaimer } from '@/lib/finance/cashflow-input';
import { compareAtAge, simulateRetirementCashflow, type CashflowOutcome } from '@/lib/finance/cashflow';
import { monthIndex } from '@/lib/finance/cashflow-validation';
import type { CashflowRow } from '@/lib/finance/cashflow-engine';

const won = (n: number | null) => n === null ? '미확정' : `${n.toLocaleString('ko-KR')}원`;
function Field({ label, value, onChange, type = 'text', help }: { label: string; value: string; onChange: (v: string) => void; type?: string; help?: string }) {
  return <div className="benefit-field"><label>{label}<input aria-label={label} type={type} value={value} onChange={e => onChange(e.target.value)} /></label>{help && <small>{help}</small>}</div>;
}
function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return <div className="benefit-field"><label>{label}<select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{children}</select></label></div>;
}
function MonthlyLedger({ rows, name }: { rows: CashflowRow[]; name: string }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={e => setOpen(e.currentTarget.open)}><summary>{name} 월별 현금흐름 원장</summary>{open && <div className="ktcu-table-wrap ktcu-schedule"><table className="ktcu-table"><caption>{name} 월별 원장 · 계좌 인출은 자산 내부 이동</caption><thead><tr>{['월말', '만 나이', '기초 금융자산', '공적연금', '공제회 수령', 'IRP 인출', '연금저축 인출', '퇴직수당', '명퇴수당', '생활비 요구액', '특별 지출', '투자손익', '실제 충당 지출', '현금 부족액', '현금 잔액', '공제회 잔액', 'IRP 잔액', '연금저축 잔액', '기말 금융자산'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.date}><td>{r.date}</td><td>{r.age}</td>{(['opening', 'pension', 'ktcu', 'irp', 'saving', 'allowance', 'honorary', 'living', 'special', 'gain', 'paidExpenses', 'shortfall', 'cash', 'ktcuRemaining', 'irpRemaining', 'savingRemaining', 'closing'] as const).map(k => <td key={k}>{won(r[k])}</td>)}</tr>)}</tbody></table></div>}</details>;
}
function Result({ result, name }: { result: CashflowOutcome; name: string }) {
  return <section className="comparison-column" aria-label={`${name} 현금흐름 결과`}><h3>{name} 은퇴 이후 현금흐름</h3>{!result.ok ? <><strong className="benefit-amount">계산 불가</strong><ul className="field-error">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul></> : <>
    <p className="profile-help">{result.confidence} · {result.partial ? '확인된 원천만의 부분 결과' : '입력 원천·가정 범위 내 결과'} · 세금 미반영</p>
    <p>분석: {result.date} → {result.end}</p><p className="profile-help">월말 잔액 기준 · 생활비 가격 기준일 {result.priceDate}</p>
    <div className="benefit-result"><h4>최종 분석월 금융자산</h4><strong className="benefit-amount">{won(result.amountWon)}</strong><p>최초 현금 부족: {result.firstShortfall || '분석 기간 내 없음'}</p><p>충당하지 못한 지출 누계: {won(result.cumulativeShortfall)}</p><p className="profile-help">계좌에 자산이 남아 있어도 예정 인출 현금이 부족할 수 있습니다. 부족 지출은 부채로 만들거나 미래 현금에서 자동 상환하지 않습니다.</p></div>
    <p>공적연금 누적 유입: {won(result.totalPension)}</p><MonthlyLedger rows={result.rows} name={name} />
    {(['years', 'ages'] as const).map(group => <details key={group}><summary>{name} {group === 'years' ? '연도별' : '연령별'} 집계</summary><div className="ktcu-table-wrap ktcu-schedule"><table className="ktcu-table"><caption>{name} {group === 'years' ? '연도별' : '연령별'} 합계 · 잔액은 마지막 월말값</caption><thead><tr>{['기간', '개월', '공적연금', '내부 인출', '일시 수당', '생활비', '특별 지출', '투자손익', '현금 부족', '마지막 잔액'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{result[group].map(r => <tr key={r.period}><td>{r.period}{group === 'ages' ? '세' : '년'}</td><td>{r.months}</td><td>{won(r.pension)}</td><td>{won(r.withdrawals)}</td><td>{won(r.allowances)}{r.honoraryUnknown ? ' + 명퇴수당 미확정' : ''}</td><td>{won(r.living)}</td><td>{won(r.special)}</td><td>{won(r.gain)}</td><td>{won(r.shortfall)}</td><td>{won(r.closing)}</td></tr>)}</tbody></table></div></details>)}
    <details><summary>{name} 적용 가정·계산 근거</summary><ul className="profile-help">{result.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></details>
  </>}<p className="benefit-disclaimer">{cashflowDisclaimer}</p></section>;
}
function AssetChart({ early, normal }: { early: CashflowOutcome; normal: CashflowOutcome }) {
  const valid = [early, normal].filter(r => r.ok);
  if (!valid.length) return <p className="profile-help">필수 입력을 완료하면 월별 금융자산 그래프가 표시됩니다.</p>;
  const start = Math.min(...valid.map(r => monthIndex(r.date))), end = Math.max(...valid.map(r => monthIndex(r.end)));
  const max = Math.max(1, ...valid.flatMap(r => r.rows.map(row => row.closing)));
  return <figure className="ktcu-chart"><svg viewBox="0 0 600 250" role="img" aria-label="은퇴 이후 월별 금융자산 추이"><path d="M35 30V210H565" fill="none" stroke="#cddbd0" /><text x="35" y="19" fontSize="11">{won(max)} · 세금 미반영</text>{[early, normal].map((r, i) => r.ok ? <polyline key={i} fill="none" stroke={i === 0 ? '#20604f' : '#a48448'} strokeWidth="2" points={r.rows.map(row => `${35 + (monthIndex(row.date) - start) / Math.max(1, end - start) * 530},${210 - row.closing / max * 175}`).join(' ')} /> : null)}<text x="35" y="235" fontSize="10">각 시나리오 퇴직 이후만 표시</text><text x="565" y="235" textAnchor="end" fontSize="10">동일 달력월 눈금</text></svg><figcaption>초록 명퇴 · 갈색 정년. 퇴직 전 기간에는 선이나 0원 잔액을 생성하지 않습니다. 미확정 원천·누적 부족액은 잔액 그래프와 별도로 확인하세요.</figcaption></figure>;
}
export function CashflowPanel({ value, onChange, comparison, profile, pensions, ktcu, irp, onNavigate }: {
  value: CashflowInput; onChange: (v: CashflowInput) => void; comparison: RetirementComparisonInput;
  profile: TeacherProfile; pensions: PensionInputs; ktcu: KtcuInput; irp: IrpInput; onNavigate: (name: string) => void;
}) {
  const set = <K extends keyof CashflowInput>(key: K, v: CashflowInput[K]) => onChange({ ...value, [key]: v });
  const update = (key: CashflowKey, patch: Partial<CashflowScenarioInput>) => set('scenarios', { ...value.scenarios, [key]: { ...value.scenarios[key], ...patch } });
  const today = todayInKorea();
  const early = simulateRetirementCashflow('early', value, comparison, profile, pensions, ktcu, irp, today);
  const normal = simulateRetirementCashflow('normal', value, comparison, profile, pensions, ktcu, irp, today);
  const milestoneAges = [...new Set([60, 65, 70, 75, 80, Number(value.compareAge)])];
  const milestones = milestoneAges.map(age => compareAtAge(early, normal, profile.birthDate, age)).filter(r => r !== null);
  return <div className="cashflow-panel ktcu-panel"><p className="form-description">05의 명퇴·정년 조건과 02·03·04 입력을 연결합니다. 월별 원장은 계좌 잔액과 수령 현금을 분리하며, 연금액·세금을 새로 산정하지 않습니다.</p>
    <div className="comparison-actions"><button className="secondary" onClick={() => onNavigate('명퇴·정년 비교')}>05 퇴직 시나리오 수정</button><button className="secondary" onClick={() => onNavigate('IRP·연금저축')}>04 계좌 수령 조건 수정</button></div>
    <section className="benefit-section"><h3>분석 기간과 금액 기준</h3><div className="benefit-fields"><Field label="최종 분석 연령 (세)" value={value.finalAge} onChange={v => set('finalAge', v)} help="해당 나이에 도달하는 달의 말일까지 분석합니다. 기본 90세, 최대 120세·퇴직 후 100년입니다." /><Field label="추가 비교 연령 (세)" value={value.compareAge} onChange={v => set('compareAge', v)} /><Select label="현금흐름 입력 금액 기준" value={value.taxBasis} onChange={v => set('taxBasis', v as CashflowInput['taxBasis'])}><option value="gross">세전 조회액 · 세금 미반영</option><option value="net">세후 조회액만 · 미래 세금 미반영</option></Select><Field label="공적연금 가정 연 조정률 (%, 선택)" value={value.pensionAdjustment} onChange={v => set('pensionAdjustment', v)} help="비워 두면 조정 없음. 개시월 12개월 후부터 매 12개월마다 적용하는 사용자 가정이며 법정 인상률이 아닙니다." /></div>
      <p className="profile-help">세전 연금과 실제 생활비를 비교하면 가용 현금을 과대평가할 수 있습니다. 공적연금·공제회·사적연금은 과세 방식이 다르며, 앱은 세후 변환·지급정지·감액을 계산하지 않습니다. 선택 기준과 다른 원천은 계산을 보류합니다.</p>
      <label className="checkbox"><input type="checkbox" checked={value.acceptPartialMonths} onChange={e => set('acceptPartialMonths', e.target.checked)} />05의 잔액 기준일·부분 월 차이를 확인했으며, 최종 계산월부터 퇴직일까지 추가 납입·수익이 없다는 가정으로 연결합니다.</label>
    </section>
    <section className="benefit-section"><h3>생활비와 특별 지출</h3><label className="checkbox"><input type="checkbox" checked={value.sharedLiving} onChange={e => set('sharedLiving', e.target.checked)} />명퇴·정년에 동일한 생활비 경로 적용</label><div className="benefit-fields">
      {value.sharedLiving && <Field label="은퇴 첫해 월 생활비 (원)" value={value.living} onChange={v => set('living', v)} />}
      <Field label="생활비 가격 기준일 (선택)" type="date" value={value.priceDate} onChange={v => set('priceDate', v)} help="공통 적용에서 비워 두면 두 퇴직일 중 이른 날의 첫해 금액입니다. 정년 첫해에는 경과 물가가 반영됩니다. 개별 적용은 각 퇴직일이 기본입니다." />
      <Field label="가정 연 물가상승률 (%)" value={value.inflation} onChange={v => set('inflation', v)} help="0%도 직접 입력해 주세요. 가격 기준월 이후 매 12개월마다 조정합니다." /></div>
      <label className="checkbox"><input type="checkbox" checked={value.livingChange} onChange={e => set('livingChange', e.target.checked)} />생활비 변경 시점 지정</label>{value.livingChange && <div className="benefit-fields"><Field label="생활비 변경일" type="date" value={value.changeDate} onChange={v => set('changeDate', v)} /><Field label="변경 시점 월 생활비 (원)" value={value.changedLiving} onChange={v => set('changedLiving', v)} /></div>}
      <p className="profile-help">퇴직일이 1일이면 그 달부터, 그 외에는 다음 달부터 월 생활비를 반영합니다. 월별 일할 계산과 퇴직 전 근로소득·저축·생활비는 추정하지 않습니다. 수입·인출 뒤 생활비·특별 지출을 충당하며, 현금 부족 시 계좌를 임의 해지하거나 추가 인출하지 않습니다.</p>
      {value.specials.map((special, index) => <div className="benefit-section" key={special.id}><h4>특별 지출 {index + 1}</h4><div className="benefit-fields"><Field label={`특별 지출 ${index + 1} 날짜`} type="date" value={special.date} onChange={v => set('specials', value.specials.map(s => s.id === special.id ? { ...s, date: v } : s))} /><Field label={`특별 지출 ${index + 1} 금액 (원)`} value={special.amount} onChange={v => set('specials', value.specials.map(s => s.id === special.id ? { ...s, amount: v } : s))} /><Select label={`특별 지출 ${index + 1} 적용`} value={special.target} onChange={v => set('specials', value.specials.map(s => s.id === special.id ? { ...s, target: v as typeof s.target } : s))}><option value="both">두 시나리오</option><option value="early">명퇴만</option><option value="normal">정년만</option></Select></div><button className="secondary" onClick={() => set('specials', value.specials.filter(s => s.id !== special.id))}>특별 지출 {index + 1} 삭제</button></div>)}
      <button className="secondary" onClick={() => set('specials', [...value.specials, { id: String(Math.max(0, ...value.specials.map(s => Number(s.id))) + 1), date: '', amount: '', target: 'both' }])}>특별 지출 추가</button>
    </section>
    <div className="comparison-grid">{(['early', 'normal'] as CashflowKey[]).map(key => {
      const name = key === 'early' ? '명퇴' : '정년', s = value.scenarios[key];
      return <section className="comparison-column" key={key}><h3>{name} 지급·인출 조건</h3><details><summary>{name} 현금흐름 조건 수정</summary>
        {!value.sharedLiving && <Field label={`${name} 첫해 월 생활비 (원)`} value={s.living} onChange={v => update(key, { living: v })} />}
        <label className="checkbox"><input type="checkbox" checked={s.includeAllowance} onChange={e => update(key, { includeAllowance: e.target.checked })} />{name} 퇴직수당 포함</label>
        <Field label={`${name} 퇴직수당 지급일 (선택)`} type="date" value={s.allowanceDate} onChange={v => update(key, { allowanceDate: v })} help="비워 두면 해당 퇴직일 지급 가정입니다. 공식 지급일을 자동 확인하지 않습니다." />
        {key === 'early' && <Field label="명퇴 명예퇴직수당 지급일 (선택)" type="date" value={s.honoraryDate} onChange={v => update(key, { honoraryDate: v })} help="05의 자격·선정·공식 금액이 확인된 경우만 유입됩니다. 미확정은 미반영·부분 결과로 표시합니다." />}
        <label className="checkbox"><input type="checkbox" checked={s.includeKtcu} onChange={e => update(key, { includeKtcu: e.target.checked })} />{name} 공제회 포함</label>
        <Select label={`${name} 공제회 수령 방식`} value={s.ktcuMode} onChange={v => update(key, { ktcuMode: v as CashflowScenarioInput['ktcuMode'] })}><option value="lump">일시 수령 · 현금으로 내부 이동</option><option value="virtual">가상 분할 인출 · 공식 상품 급여 아님</option></Select>
        <Field label={`${name} 공제회 수령·분할 개시일 (선택)`} type="date" value={s.ktcuStart} onChange={v => update(key, { ktcuStart: v })} help="비워 두면 퇴직일입니다. 일시금은 그 날짜에, 분할 인출은 개시 한 달 뒤부터 반영합니다." />
        {s.ktcuMode === 'virtual' && <><Select label={`${name} 공제회 가상 수령기간`} value={s.ktcuYears} onChange={v => update(key, { ktcuYears: v })}><option value="">03 입력 사용</option>{[5,10,15,20,25,30].map(n => <option key={n} value={n}>{n}년</option>)}</Select><Field label={`${name} 공제회 인출 가정 연 수익률 (%, 선택)`} value={s.ktcuRate} onChange={v => update(key, { ktcuRate: v })} help="비워 두면 03 가상 인출 수익률을 사용합니다. 개시 전 대기 기간에도 같은 가정으로 운용합니다." /></>}
        {(['irp', 'saving'] as const).map(a => <div className="benefit-section" key={a}><h4>{a === 'irp' ? 'IRP' : '연금저축'}</h4><Field label={`${name} ${a === 'irp' ? 'IRP' : '연금저축'} 수령 개시일 (선택)`} type="date" value={s[a].start} onChange={v => update(key, { [a]: { ...s[a], start: v } })} help="비워 두면 04 입력을 사용합니다. 해당 퇴직일 이후여야 합니다." /><Field label={`${name} ${a === 'irp' ? 'IRP' : '연금저축'} 수령기간 (년, 선택)`} value={s[a].years} onChange={v => update(key, { [a]: { ...s[a], years: v } })} /><Select label={`${name} ${a === 'irp' ? 'IRP' : '연금저축'} 인출 방식`} value={s[a].mode} onChange={v => update(key, { [a]: { ...s[a], mode: v } })}><option value="shared">04 월 인출액·기간 설정 사용</option><option value="period">기간 내 균등 인출 · 마지막 잔액 정산</option><option value="fixed">희망 월 정액 인출</option></Select>{s[a].mode === 'fixed' && <Field label={`${name} ${a === 'irp' ? 'IRP' : '연금저축'} 월 인출액 (원)`} value={s[a].monthly} onChange={v => update(key, { [a]: { ...s[a], monthly: v } })} />}</div>)}
        <p className="profile-help">현재 잔액·수익률·수수료·퇴직 시 자산은 03·04·05에서 연결합니다. 계좌가 04에서 제외되면 인출도 생성하지 않습니다. 퇴직급여 IRP 이전은 계속 비활성화되어 있으며 이전 금액을 다시 더하지 않습니다.</p>
      </details></section>;
    })}</div>
    <section className="benefit-section"><h3>월별 은퇴 금융자산</h3><AssetChart early={early} normal={normal} /></section>
    <div className="comparison-grid"><Result result={early} name="명퇴" /><Result result={normal} name="정년" /></div>
    <section className="benefit-section"><h3>동일 연령의 조건부 잔액</h3><p className="profile-help">동일 연령의 완전한 비교 불가 · 퇴직 전 근로소득·저축·생활비 정보가 없습니다. 퇴직 전 구간은 0원으로 채우지 않으며, 두 시나리오 모두 퇴직한 뒤에도 전체 경제적 유불리를 단정하지 않습니다.</p>
      {!/^\d{1,3}$/.test(value.compareAge) || Number(value.compareAge) < 1 || Number(value.compareAge) > 120 ? <p className="field-error">추가 비교 연령은 1~120세로 입력해 주세요.</p> : null}
      <div className="ktcu-table-wrap"><table className="ktcu-table"><caption>같은 생일 도달월 말 · 세금 미반영 · 순위·차액 미산출</caption><thead><tr><th>만 나이 / 기준일</th><th>명퇴</th><th>정년</th></tr></thead><tbody>{milestones.map(r => <tr key={r.age}><td>{r.age}세 / {r.date}</td><td>{r.early.value === null ? '비교 불가' : won(r.early.value)}<br/>{r.early.reason}{r.early.unfunded !== null && <><br/>미충당 지출 누계 {won(r.early.unfunded)}</>}</td><td>{r.normal.value === null ? '비교 불가' : won(r.normal.value)}<br/>{r.normal.reason}{r.normal.unfunded !== null && <><br/>미충당 지출 누계 {won(r.normal.unfunded)}</>}</td></tr>)}</tbody></table></div>
    </section>
    <section className="benefit-section"><h3>원장 처리 순서와 한계</h3><p className="profile-help">계좌별 기념일 수익·수수료 및 인출을 해당 달에 반영 → 공적연금과 지급일별 수당 유입 → 생활비·특별 지출 충당 → 월말 잔액 집계 순서입니다. 공적연금은 개시일이 속한 달부터 월액 전액을 반영하는 가정입니다. 인출액은 해당 계좌 잔액에서 빠져 현금으로 이동하므로 총 금융자산 증가가 아닙니다. 현금은 이 시뮬레이션의 지급·지출 원장이고 별도 일반 금융자산 입력은 받지 않습니다.</p><p className="profile-help">모든 금액은 원 단위이며 기존 모듈의 반올림·수수료 가정을 사용합니다. 생활비·연금 조정은 연 단위 원 미만 사사오입 가정입니다. 월별 잔액을 더하지 않고 연도·연령 구간 마지막 월말 잔액을 표시합니다. 명퇴수당 미확정은 원장에도 미확정으로 남습니다.</p></section>
  </div>;
}
