import type { ReactNode } from 'react';
import type { TeacherProfile } from '@/lib/profile';
import { type IrpInput, type AccountKey, irpDisclaimer } from '@/lib/finance/irp-input';
import { irpMoney, irpRate } from '@/lib/finance/irp-validation';
import { simulateIrp, simulateWithdrawal, type GrowthRow } from '@/lib/finance/irp-simulation';
import { pensionTaxCredit, retirementTransfer, taxRule } from '@/lib/finance/irp-tax';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
function Field({ label, value, onChange, type = 'text', help }: { label: string; value: string; onChange: (v: string) => void; type?: string; help?: string }) {
  return <div className="benefit-field"><label>{label}<input type={type} value={value} onChange={e => onChange(e.target.value)} /></label>{help && <small>{help}</small>}</div>;
}
function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return <div className="benefit-field"><label>{label}<select value={value} onChange={e => onChange(e.target.value)}>{children}</select></label></div>;
}
function GrowthChart({ rows }: { rows: GrowthRow[] }) {
  const points = rows.filter((_, i) => i % 12 === 0 || i === rows.length - 1);
  const max = Math.max(1, ...points.map(p => p.total));
  const line = (key: 'irp' | 'saving' | 'total') => points.map((p, i) => `${35 + i / Math.max(1, points.length - 1) * 520},${205 - p[key] / max * 175}`).join(' ');
  return <figure className="ktcu-chart"><svg viewBox="0 0 600 240" role="img" aria-label="IRP·연금저축 연도별 자산 성장 그래프"><text x="35" y="18" fontSize="11">{won(max)} · 세전</text><path d="M35 30V205H560" fill="none" stroke="#cddbd0" />{(['irp', 'saving', 'total'] as const).map((key, i) => <polyline key={key} points={line(key)} fill="none" stroke={['#20604f', '#9a7539', '#4c8497'][i]} strokeWidth="2" />)}<text x="35" y="228" fontSize="10">{points[0].date}</text><text x="560" y="228" textAnchor="end" fontSize="10">{points.at(-1)!.date}</text></svg><figcaption>초록 IRP · 갈색 연금저축 · 파랑 합산(재투자·환급 현금 포함). 아래 표에서 정확한 값을 확인하세요.</figcaption></figure>;
}
export function IrpPanel({ value, onChange, profile }: { value: IrpInput; onChange: (v: IrpInput) => void; profile: TeacherProfile }) {
  const set = <K extends keyof IrpInput>(key: K, v: IrpInput[K]) => onChange({ ...value, [key]: v });
  const result = simulateIrp(value);
  const income = irpMoney(value.income);
  const tax = value.scopeConfirmed && income !== null ? pensionTaxCredit(
    value.irp.enabled && value.irp.credit ? irpMoney(value.irp.annual) ?? 0 : 0,
    value.saving.enabled && value.saving.credit ? irpMoney(value.saving.annual) ?? 0 : 0,
    value.incomeKind, income, irpMoney(value.capacity)) : null;
  const taxInputsReady = [value.irp, value.saving].every(a => !a.enabled || irpMoney(a.annual) !== null);
  return <div className="irp-panel ktcu-panel">
    <p className="form-description">IRP와 연금저축의 개인 추가납입금으로 자산을 전망합니다. 모든 투자 결과는 가정 기반 조건부 추정값입니다.</p>
    <p className="profile-context">기본정보 생년월일: {profile.birthDate || '미입력'} · 최초 임용일: {profile.appointmentDate || '미입력'}. 계좌 가입일·수령연차를 확인하지 않으므로 연금 수령 자격을 판정하지 않습니다. 정밀 계산 모드는 준비 중입니다.</p>
    <div className="benefit-fields"><Field label="연금계좌 잔액 기준일" type="date" value={value.basis} onChange={v => set('basis', v)} /><Field label="연금계좌 퇴직예정일" type="date" value={value.retirement} onChange={v => set('retirement', v)} /></div>
    {(['irp', 'saving'] as AccountKey[]).map(key => {
      const a = value[key], name = key === 'irp' ? 'IRP' : '연금저축';
      const update = (field: keyof typeof a, v: string | boolean) => set(key, { ...a, [field]: v });
      const withdrawal = result.ok && a.enabled ? simulateWithdrawal(result.rows.at(-1)![key], value.retirement, a) : null;
      return <section className="benefit-section" key={key}><h3>{name} 입력</h3><label className="checkbox"><input type="checkbox" checked={a.enabled} onChange={e => update('enabled', e.target.checked)} />{name} 계산에 포함</label>
        {a.enabled && <><div className="benefit-fields">
          <Field label={`${name} 현재 평가금액 (원)`} value={a.balance} onChange={v => update('balance', v)} />
          <Field label={`${name} 연간 납입액 (원)`} value={a.annual} onChange={v => update('annual', v)} />
          <Select label={`${name} 납입 주기`} value={a.cycle} onChange={v => update('cycle', v)}><option value="monthly">매월 · 연간 금액을 12회 분할</option><option value="yearly">매년 · 12개월마다 후납</option></Select>
          <Field label={`${name} 예상 연평균 수익률 (%)`} value={a.rate} onChange={v => update('rate', v)} />
          <Field label={`${name} 예상 연 수수료율 (%)`} value={a.fee} onChange={v => update('fee', v)} />
          <Field label={`${name} 납입 종료일`} type="date" value={a.stop} onChange={v => update('stop', v)} />
          <Field label={`${name} 수령 시작일`} type="date" value={a.start} onChange={v => update('start', v)} />
          <Field label={`${name} 예상 수령기간 (년)`} value={a.years} onChange={v => update('years', v)} />
          <Field label={`${name} 희망 월 인출액 (원, 선택)`} value={a.withdrawal} onChange={v => update('withdrawal', v)} help="비워 두면 선택 기간에 걸쳐 잔액을 소진하는 일정액을 산출합니다. 마지막 회차는 잔액 정산입니다." />
        </div><label className="checkbox"><input type="checkbox" checked={a.credit} onChange={e => update('credit', e.target.checked)} />{name} 향후 개인납입금 세액공제 적용</label>
        <section className="benefit-result" aria-label={`${name} 예상 결과`}><h4>{name} 퇴직 시 예상 평가금액</h4><strong className="benefit-amount">{result.ok ? won(result.rows.at(-1)![key]) : '계산 불가'}</strong><p className="profile-help">세전 · 가정 기반 조건부 추정값 · 출처: 사용자 입력과 앱 복리 모델</p>
          {withdrawal?.ok ? <><p>가상 연금 인출: {won(withdrawal.amountWon)} / 월 · 총 인출 {won(withdrawal.total)} · 잔여 {won(withdrawal.remaining)}</p><p className="profile-help">수령 시작 잔액 {won(withdrawal.opening)} · 소진일 {withdrawal.depleted || '선택 기간 내 미소진'} · 세후 계산 불가. 연금수령한도와 가입 5년 요건은 미반영입니다.</p><details><summary>{name} 월별 인출·잔여자산</summary><div className="ktcu-table-wrap ktcu-schedule"><table className="ktcu-table"><caption>{name} 세전 가상 인출 일정</caption><thead><tr><th>일자</th><th>인출</th><th>잔여</th></tr></thead><tbody>{withdrawal.rows.map(r => <tr key={r.date}><td>{r.date}</td><td>{won(r.payment)}</td><td>{won(r.remaining)}</td></tr>)}</tbody></table></div></details></> : <p className="profile-help">{withdrawal && !withdrawal.ok ? withdrawal.error : '수령 정보를 입력하면 세전 가상 인출 일정을 확인할 수 있습니다.'}</p>}
        </section></>}
      </section>;
    })}
    <section className="benefit-section"><h3>세액공제 · 환급액 재투자</h3>
      <label className="checkbox"><input type="checkbox" checked={value.scopeConfirmed} onChange={e => set('scopeConfirmed', e.target.checked)} />거주자의 일반 개인납입금만 입력했으며 다른 연금계좌·DC 추가납입·ISA·주택 특례·퇴직급여 이전금이 없음을 확인합니다.</label>
      <div className="benefit-fields"><Select label="세액공제 소득 기준" value={value.incomeKind} onChange={v => set('incomeKind', v as IrpInput['incomeKind'])}><option value="wage">근로소득만 있음 · 총급여</option><option value="comprehensive">그 외 · 종합소득금액</option></Select>
      <Field label="세액공제 소득금액 (원)" value={value.income} onChange={v => set('income', v)} />
      <Field label="연금계좌 공제 전 남은 국세 (원, 선택)" value={value.capacity} onChange={v => set('capacity', v)} help="다른 감면·공제를 반영하고 연금계좌 공제에 사용할 수 있는 세액입니다. 최종 결정세액과 다릅니다. 불명확하면 비워 두세요." />
      <Field label="재투자 가능한 연간 국세 환급 현금 상한 (원)" value={value.refundCash} onChange={v => set('refundCash', v)} help="원천징수 등까지 확인한 사용자 가정입니다. 공제액 자체가 현금 환급액은 아닙니다. 지방소득세 제외." /></div>
      <div className="benefit-result" role="region" aria-label="세액공제 결과">{tax && taxInputsReady && result.ok ? <><p>연간 계획 기준 이론상 국세 공제액: {won(tax.theoretical)} ({tax.rate}%)</p><p>남은 국세 반영 조건부 공제 가능액: {tax.usable === null ? '계산 불가 · 남은 국세 미입력' : won(tax.usable)}</p><p>실제 현금 환급액: 확정 불가</p></> : <p>공제액 계산 불가 · 소득·적용 범위 및 계좌 입력을 확인해 주세요.</p>}<p className="profile-help">연금저축 600만 원, 합산 900만 원의 일반 공제한도. 국세만 계산하며 지방소득세·다른 공제·원천징수 정산은 계산하지 않습니다. 연간 계획과 실제 미래 월별 납입의 연도별 공제액은 다를 수 있습니다.</p></div>
      <label className="checkbox"><input type="checkbox" checked={value.reinvest} onChange={e => set('reinvest', e.target.checked)} />세액공제 환급액 재투자</label>
      {value.reinvest && <div className="benefit-fields"><Field label="환급액 재투자 비율 (%)" value={value.ratio} onChange={v => set('ratio', v)} /><Select label="재투자 계좌" value={value.target} onChange={v => set('target', v as IrpInput['target'])}><option value="general">일반 투자계좌</option><option value="irp" disabled>IRP · 추가 공제·한도 검증 준비 중</option><option value="saving" disabled>연금저축 · 추가 공제·한도 검증 준비 중</option></Select><Select label="재투자 시점 · 납입 다음 해" value={value.refundMonth} onChange={v => set('refundMonth', v)}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}월 · 기준일 기념일</option>)}</Select><Field label="재투자 예상 연 수익률 (%)" value={value.reinvestRate} onChange={v => set('reinvestRate', v)} /></div>}
      <p className="profile-help">소득·사용 가능 세액·현금 상한·현행 규정은 향후에도 동일하다는 가정입니다. 모델에 포함된 향후 납입만 연도별 집계하며 기준일 이전 납입은 제외합니다. 재투자 비교에서는 같은 환급 현금을 미재투자 시 0% 현금으로 보유합니다. 일반 계좌 재투자에는 추가 연금계좌 세액공제를 적용하지 않습니다.</p>
    </section>
    <section className="benefit-result" aria-label="IRP·연금저축 합산 결과"><h3>퇴직 시 자산 · 세전</h3>{!result.ok ? <><strong className="benefit-amount">계산 불가</strong><ul>{result.errors.map(e => <li key={e}>{e}</li>)}</ul></> : <><strong className="benefit-amount">{won(result.amountWon)}</strong><p>계좌 합산 · 초기 평가금액 {won(result.initial)} + 향후 납입원금 {won(result.deposits)} + 가정 투자손익 {won(result.investmentGain)}</p><p>환급 현금 포함 비교: 재투자 전 {won(result.comparison.without)} / 재투자 후 {won(result.comparison.with)} · 차이 {won(result.comparison.difference)}</p><p className="profile-help">계좌 합산액에 일반 계좌 재투자 자산을 포함하지 않습니다. 비교 합계에는 한 번만 포함합니다. 초기 잔액의 과거 원금·수익은 구분하지 못합니다.</p><GrowthChart rows={result.rows} />
      <div className="ktcu-table-wrap"><table className="ktcu-table"><caption>연도별 자산 · 기준일의 12개월 간격과 마지막 월</caption><thead><tr><th>일자</th><th>IRP</th><th>연금저축</th><th>향후 납입원금</th><th>재투자·현금 포함 합계</th></tr></thead><tbody>{result.rows.filter((_, i) => i % 12 === 0 || i === result.rows.length - 1).map(r => <tr key={r.date}><td>{r.date}</td><td>{won(r.irp)}</td><td>{won(r.saving)}</td><td>{won(r.deposits)}</td><td>{won(r.total)}</td></tr>)}</tbody></table></div>
      <details><summary>모델 납입의 연도별 국세 공제</summary><div className="ktcu-table-wrap"><table className="ktcu-table"><caption>향후 실제 모델 납입 기준 · 국세 한정</caption><thead><tr><th>연도</th><th>공제대상 IRP</th><th>공제대상 연금저축</th><th>이론상</th><th>조건부 가능액</th><th>환급 가정</th></tr></thead><tbody>{result.taxYears.map(t => <tr key={t.year}><td>{t.year}</td><td>{won(t.irp)}</td><td>{won(t.saving)}</td><td>{t.credit ? won(t.credit.theoretical) : '계산 불가'}</td><td>{t.credit?.usable == null ? '계산 불가' : won(t.credit.usable)}</td><td>{t.refundReceived ? '비교에 반영' : '미반영'}</td></tr>)}</tbody></table></div></details></>}
      <p className="profile-help">신뢰도: 조건부 추정값 · 기준일 {value.basis || '미입력'} · 법규 확인일 {taxRule.checkedOn}. 퇴직일 마지막 미완성 월과 퇴직 후 도래할 환급액은 제외합니다.</p><p className="benefit-disclaimer">{irpDisclaimer}</p></section>
    <section className="benefit-section"><h3>보수적·기준·낙관적 시나리오</h3><p className="profile-help">각 수익률을 입력하면 양 계좌의 수익률을 그 값으로 대체합니다. 수수료와 재투자 수익률은 유지합니다. 순서는 사용자가 정하며 확정 수익을 뜻하지 않습니다.</p><div className="benefit-fields">{(['conservative', 'standard', 'optimistic'] as const).map((key, i) => <Field key={key} label={`${['보수적', '기준', '낙관적'][i]} 시나리오 연 수익률 (%)`} value={value[key]} onChange={v => set(key, v)} />)}</div><div className="ktcu-table-wrap"><table className="ktcu-table"><caption>사용자 수익률별 퇴직 계좌 합산 · 세전</caption><tbody>{(['conservative', 'standard', 'optimistic'] as const).map((key, i) => { const rate = irpRate(value[key]); const scenario = rate === null ? null : simulateIrp(value, rate); return <tr key={key}><th>{['보수적', '기준', '낙관적'][i]}</th><td>{value[key] || '미입력'}%</td><td>{scenario?.ok ? won(scenario.amountWon) : '계산 불가'}</td></tr>; })}</tbody></table></div></section>
    <section className="benefit-section"><h3>퇴직수당·퇴직급여 IRP 이전 · 검증 준비 중</h3><p className="profile-help">{retirementTransfer().reason} 공적연금 퇴직수당은 근로자퇴직급여보장법상 퇴직급여와 구분합니다. 공무원연금공단은 수령 후 60일 내 과세대상 금액의 이전 절차를 안내하나, 사학연금과 금융회사별 요건까지 검증하지 못했습니다.</p><div className="benefit-fields"><Select label="이전 검토 급여 종류" value={value.transferKind} onChange={v => set('transferKind', v)}><option value="public">공적연금 퇴직수당</option><option value="employer">법정 퇴직급여</option><option value="other">기타 · 확인 필요</option></Select><Field label="IRP 이전 검토 금액 (원, 계산 미반영)" value={value.transferAmount} onChange={v => set('transferAmount', v)} /><Field label="예상 이전일 (계산 미반영)" type="date" value={value.transferDate} onChange={v => set('transferDate', v)} /><Field label="이전 후 가정 수익률 (%, 계산 미반영)" value={value.transferRate} onChange={v => set('transferRate', v)} /></div><button className="secondary" disabled>이전 시나리오 계산 비활성화</button></section>
    <section className="benefit-section"><h3>계산 근거와 적용 조건</h3><p className="profile-help">매월 기준일의 기념일(말일 보정)에 수익 반영 → 수수료 차감 → 납입 순서입니다. 연 수익률은 (1+r)^(1/12), 수수료는 (1-f)^(1/12)로 환산합니다. 월 납입은 연간 금액을 원 단위 12분할하고 나머지 원은 앞 회차에 배분합니다. 연 납입은 최초 12개월 뒤입니다. 각 곱셈마다 원 단위 사사오입하며 부분 월은 제외합니다. 인출 시작일까지 같은 수익률로 성장하고 첫 인출은 시작일 한 달 뒤입니다.</p><p className="profile-help"><a href={taxRule.source} target="_blank" rel="noreferrer">국세청 연금계좌 세액공제</a> · <a href="https://www.geps.or.kr/pensionInfo_information_card_irp" target="_blank" rel="noreferrer">공무원연금공단 과세이연 안내</a>. 세후·연금 수령 자격·상품별 수수료 징수 방식은 미검증이며 공식 조회값이 아닙니다.</p></section>
  </div>;
}
