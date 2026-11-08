import { createAccountReceiptInput, receiptSources, receiptTaxNotes, type AccountReceiptInput, type AccountReceiptResult } from '@/lib/simple/account-receipt';
import { Field, MoneyField, OfficialLink, won } from './shared';

export function AccountReceiptSummary({ title, result: r }: { title: string; result: AccountReceiptResult }) {
  return <section className="profile-context" aria-label={`${title} 수령 요건 요약`}><strong>{title} 연금수령 조건</strong>
    <p>연령·기간 요건 충족 예상일: {r.eligibleDate ?? '추가 확인 필요'}</p><p>{r.status}</p>
    <p className="profile-help">개시 신청·세금·한도 확인 필요 · 55세만으로 전액 자유 인출 불가</p>
    <details className="simple-details"><summary>{title} 수령 판정 근거</summary>{!r.eligibleDate && r.errors.map(e => <p className="profile-help" key={e}>{e}</p>)}
    <p className="profile-help">{r.exceptionApplied ? '사용자 확인 이연퇴직소득 보유로 가입 5년 예외 반영 · 실제 자료 확인 필요' : '만 55세·가입 5년의 일반 요건 기준 · 미확인 퇴직급여 예외 미적용'}</p>
    <p className="profile-help">조건 충족일은 실제 신청일·지급일이 아닙니다. 실제 신청 후 재원별 세금과 연간 한도를 확인하세요.</p></details>
  </section>;
}
export function AccountReceiptPanel({ title, value, onChange, result: r }: { title: string; value?: AccountReceiptInput; onChange: (v: AccountReceiptInput) => void; result: AccountReceiptResult }) {
  const v = value ?? createAccountReceiptInput();
  const update = (patch: Partial<AccountReceiptInput>) => onChange({ ...v, ...patch });
  return <><AccountReceiptSummary title={title} result={r} />
    <details className="simple-details account-receipt-settings"><summary>{title} 수령 요건·한도·세금 상세 설정 (선택)</summary>
      <Field label={`${title} 최초 계좌 가입일`} type="date" value={v.openedDate} onChange={openedDate => update({ openedDate })} />
      <p className="profile-help">최초 임용일과 별개입니다. 계좌이체·승계 시 유효 가입일은 금융기관 확인이 필요합니다. 2001년 이전 구 개인연금·별도 계약은 자동 판정하지 않습니다.</p>
      <Field label={`${title} 이연퇴직소득 보유 상태`} value={v.deferred} onChange={deferred => update({ deferred: deferred as AccountReceiptInput['deferred'] })}>
        <option value="unknown">확인 필요 · 5년 예외 미적용</option><option value="no">개인 납입금·수익만 있음</option><option value="confirmed">금융기관에서 실제 이연퇴직소득 보유 확인</option>
      </Field>
      {v.deferred === 'confirmed' && <Field label={`${title} 확인된 이연퇴직소득 실제 입금일`} type="date" value={v.deferredDepositDate} onChange={deferredDepositDate => update({ deferredDepositDate })} />}
      <p className="profile-help">이연퇴직소득은 세금을 이연한 실제 퇴직소득 재원입니다. 04의 공무원연금법상 퇴직수당·명퇴수당을 일반 근로자 퇴직급여와 같다고 보지 않으며, 이체 가능 여부·지급 방법을 확인하지 않아 자동 합산하지 않습니다. 잔액 입력만으로 재원을 판정하지 않습니다.</p>
      <label className="checkbox"><input type="checkbox" checked={v.specialHistory} onChange={e => update({ specialHistory: e.target.checked })} />{title}에 승계·계좌이체·구 개인연금 등 별도 이력이 있습니다.</label>
      <p className="profile-help">만 55세 도달일 {r.age55Date ?? '확인 필요'} / 가입 5년 충족일 {r.fiveYearDate ?? '가입일 확인 필요'} / 예외 없는 일반 요건 충족일 {r.generalDate ?? '확인 필요'}</p>
      <details className="simple-details"><summary>{title} 연간 수령한도 계산 (선택)</summary>
        <Field label={`${title} 한도 계산 과세연도`} value={v.taxYear} onChange={taxYear => update({ taxYear })} />
        <p className="profile-help">미입력 시 퇴직연도 {r.taxYear ?? '확인 필요'}를 검토합니다. 한도는 계좌별로 계산합니다.</p>
        <Field label={`${title} 연금개시 신청일 (실제 또는 계획)`} type="date" value={v.applicationDate} onChange={applicationDate => update({ applicationDate })} />
        <Field label={`${title} 한도용 평가 기준일`} type="date" value={v.referenceDate} onChange={referenceDate => update({ referenceDate })} />
        <MoneyField label={`${title} 한도용 기준 계좌 평가액 (만원)`} valueWon={v.referenceValue} onChangeWon={referenceValue => update({ referenceValue })} />
        <p className="profile-help">필요 평가 기준일: {r.requiredReferenceDate ?? '신청일·과세연도 확인 필요'}. 개시 신청연도는 신청일, 이후 연도는 1월 1일 평가액입니다. 미래 값을 입력하면 사용자 가정입니다. 위 퇴직 예상 적립금을 자동 사용하지 않습니다.</p>
        <MoneyField label={`${title} 연간 한도 산입 예상 인출액 (만원, 세전)`} valueWon={v.annualWithdrawal} onChangeWon={annualWithdrawal => update({ annualWithdrawal })} />
        <p className="profile-help">선택 연도의 누적·예정 인출 합계 중 과세제외금액 및 법정 의료비·부득이한 인출을 제외한 금액을 금융기관 기준으로 확인하세요. 월액이 아니며 실제 수령액을 자동 설계하지 않습니다.</p>
        <p>한도 계산 수령연차: {r.receiptYear === null ? '확인 필요' : `${r.receiptYear}년차`} / {r.unlimited ? '11년차 이상: 이 계산식의 한도 미적용' : `연간 세법상 한도 ${won(r.limitWon, '계산에 필요한 정보 확인')}`}</p>
        <p className="profile-help">평가액 ÷ (11−수령연차) × 120%, 1~10년차 적용. 2013-03-01 이전 가입은 6년차 기산입니다. 한도용 연차는 연령·기간 요건을 처음 충족한 과세연도부터 쌓이며 실제 수령연차와 다릅니다. 한도 미적용도 무세금·잔액 초과 지급 보장이 아닙니다.</p>
        {r.withdrawalWon !== null && <p>예상 세전 인출액(한도 산입분) {won(r.withdrawalWon)} / 한도 이내 {won(r.withinWon)} / 한도 초과·연금외수령분 {won(r.excessWon)}</p>}
        {r.limitErrors.map(e => <p className="profile-help" key={e}>{e}</p>)}
      </details>
      <details className="simple-details"><summary>{title} 재원별 과세와 추가 확인사항</summary>
        {receiptTaxNotes.map(note => <p className="profile-help" key={note}>{note}</p>)}
        <Field label={`${title} 금융기관 확인 실제 수령연차 (선택)`} value={v.actualReceiptYears} onChange={actualReceiptYears => update({ actualReceiptYears })} />
        {r.taxErrors.map(e => <p className="profile-help" key={e}>{e}</p>)}
        <p className="profile-help">최초 수령한 과세연도부터 실제 수령한 과세연도를 합산합니다. 수령하지 않은 해는 자동 포함하지 않으며 한도용 연차·나이·가입기간으로 대체하지 않습니다. 이체·중복 이력은 금융기관 확인이 필요합니다.</p>
        <p>확인된 실제 수령연차의 퇴직소득세 적용비율: {r.deferredPercent === null ? '이연퇴직소득·실제 수령연차 확인 필요' : `${r.deferredPercent}% (연금외수령 퇴직소득세 대비)`}. 세후액 미산출.</p>
      </details>
      <p className="profile-help">적립금은 퇴직일까지 인출 없이 계속 납입하는 기존 가정입니다. 이 수령 조건·신청 계획은 적립 엔진을 바꾸지 않습니다. 개시 후 납입 제한과 중도 수령을 반영한 적립금·인출 현금흐름은 별도 설계가 필요합니다.</p>
      <p className="profile-help">2026년 세법 기준 조건부 안내 · 실제 계약·금융기관 처리·증빙 확인 필요.</p>
      {receiptSources.map(s => <p className="profile-help" key={s.url}><OfficialLink href={s.url}>{s.title}</OfficialLink></p>)}
    </details></>;
}
