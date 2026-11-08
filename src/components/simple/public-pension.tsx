import { TeacherPayDetails, TeacherPensionScenarios } from './teacher-scenarios';
import type { SimpleInputs } from '@/lib/simple/model';
import { schemeNames } from '@/lib/simple/model';
import { createPensionEstimateInput, type PensionEstimateInput } from '@/lib/simple/pension-types';
import { nationalEndMonth } from '@/lib/simple/national-pension';
import type { SimpleResults } from '@/lib/simple/calculation';
import { Field, MoneyField, OfficialLink, won } from './shared';
import { SimpleQuoteEditor } from './benefits';
import { Fragment } from 'react';

export function SimplePublicPension({ input, onChange, result: r }: { input: SimpleInputs; onChange: (v: SimpleInputs) => void; result: SimpleResults }) {
  const p = input.profile, q = input.benefits[p.scheme], details = r.pensionDetails;
  const v = q.pensionEstimate ?? createPensionEstimateInput();
  const update = (patch: Partial<PensionEstimateInput>) => onChange({ ...input, benefits: { ...input.benefits, [p.scheme]: { ...q, pensionEstimate: { ...v, ...patch } } } });
  const checked = !!r.retirement.date && v.confirmedRetirementDate === r.retirement.date && v.confirmedAppointmentDate === p.appointmentDate;
  return <section className="benefit-result" aria-label="공적연금 요약"><h3>공적연금 예상 월수령액</h3>
    <strong className="benefit-amount">{won(r.pension.amountWon, '추정에 필요한 정보 확인')}{r.pension.amountWon !== null ? ' / 월' : ''}</strong>
    <p className="profile-help">{schemeNames[p.scheme]} · {r.pension.confidence} · {r.pensionSource === 'quote' ? q.pension.taxBasis === 'net' ? '입력액 세후' : q.pension.taxBasis === 'gross' ? '세전' : '세금 기준 확인 필요' : r.pensionSource === 'teacher-model' ? `세전 · ${details.priceYear}년 개시 명목 가정` : '세전 · 2026년 가격 고정'}</p>
    <p className="profile-help">{r.pensionSource === 'quote' ? '직접 입력한 조회액을 우선 표시합니다. 기관에 자동 조회하거나 진위를 검증한 값은 아닙니다.' : '웹앱의 조건부 추정이며 공단이 확정한 실제 지급액이 아닙니다. ' + details.externalValidation + '.'}</p>
    <TeacherPensionScenarios result={r} />
    {r.teacherPension.eligible && !r.teacherPension.selected && r.teacherPension.errors.length>0 && <p className="profile-help">교원 모델 추정 보류: {r.teacherPension.errors[0]}</p>}
    <TeacherPayDetails result={r} />
    <details className="simple-details"><summary>연금 개시·기간 자세히 보기</summary><dl className="benefit-details"><dt>정상 개시연령</dt><dd>{details.normalAge === null ? '개인별 경과규정 확인 필요' : `만 ${details.normalAge}세 · 일반 조건`}</dd>
      <dt>정상 수급조건 충족 예상일</dt><dd>{details.normalStartDate ?? '인정 가입기간·개인별 예외 확인 필요'}</dd>
      <dt>정상 최초 지급대상월</dt><dd>{details.firstPaymentMonth ?? '조건 확인 필요'} · 실제 입금일 아님</dd>
      {r.pensionSource === 'quote' && <><dt>입력 지급개시일</dt><dd>{r.pensionStartDate ?? '조회 가정·날짜 재확인 필요'}</dd></>}
      <dt>퇴직 후 연금 개시 전 기간</dt><dd>{r.pensionGapMonths === null ? '개시일 확인 후 계산' : `완료 월 ${r.pensionGapMonths}개월 · ${r.pensionGapDays}일 (${r.pensionSource === 'quote' ? '입력 개시일' : '최초 지급대상월 1일'} 기준)`}</dd>
      <dt>재직·가입기간 시나리오</dt><dd>{details.months === null ? '확인 필요' : details.months + '개월'}{details.capMonths !== null ? ` · 인정 상한 ${details.capMonths}개월` : ''}</dd>
      <dt>계산 기준</dt><dd>{details.priceYear}년 가격 · 자료 확인 {details.checkedOn}</dd></dl></details>
    <p className="profile-help">개인별 정상 개시 조건을 적용합니다. 감액·지급정지·세금·실제 입금일은 별도 확인하며 월연금을 목돈에 더하지 않습니다.</p>
    {r.pension.errors.length > 0 && <details className="simple-details"><summary>공적연금 추가 확인 사항 ({r.pension.errors.length})</summary><ul className="profile-help" aria-label="공적연금 추가 확인 사항">{r.pension.errors.map(error => <li key={error}>{error}</li>)}</ul></details>}
    <details className="simple-details"><summary>공적연금 추정 상세 설정 (선택)</summary>
      <p className="profile-help">호봉과 예상 최종봉급만으로 평균소득을 만들지 않습니다. 아래 기초 소득자료가 있으면 예상 월연금을 자동 계산합니다. 공단 자료의 재평가·상한 반영 여부를 확인하세요. 04의 퇴직수당용 소득을 연금 평균소득으로 자동 재사용하지 않습니다.</p>
      <Field label="공적연금 소득 적용 방식" value={v.incomeMode} onChange={incomeMode => update({ incomeMode: incomeMode as PensionEstimateInput['incomeMode'] })}><option value="average">공단 확인 평균소득 사용</option><option value="current">현재 소득 고정 시나리오</option></Field>
      {v.incomeMode === 'average' ? <MoneyField label="공단 확인 평균기준소득월액 (만원)" valueWon={v.averageIncome} onChangeWon={averageIncome => update({ averageIncome })} />
        : <><MoneyField label="공적연금 현재 기준소득월액 (만원)" valueWon={v.currentIncome} onChangeWon={currentIncome => update({ currentIncome })} /><label className="checkbox"><input type="checkbox" checked={v.constantIncome} onChange={e => update({ constantIncome: e.target.checked })} />현재 소득을 전체 가입기간의 재평가 평균소득으로 가정하겠습니다.</label><p className="profile-help">실제 법정 평균소득을 산출한 것이 아닙니다. 과거·미래 소득이 다르면 실제 연금액과 차이가 날 수 있는 가정 시나리오입니다.</p></>}
      {p.scheme === 'national' ? <>
        <Field label="국민연금 실제 최초 납부월" type="month" value={v.nationalStartMonth} onChange={nationalStartMonth => update({ nationalStartMonth })} />
        <label className="checkbox"><input type="checkbox" checked={v.nationalAutomaticEnd} onChange={e => update({ nationalAutomaticEnd: e.target.checked })} />퇴직월과 60세 생일 전월 중 빠른 월까지 납부하는 계획을 사용합니다.</label>
        {v.nationalAutomaticEnd ? <p className="profile-help">계획상 마지막 납부월: {nationalEndMonth(p, v, r.retirement.date) ?? '기본정보 확인 필요'}. 실제 자격상실일·보험료 부과월을 확정하지 않습니다.</p> : <Field label="국민연금 예상 마지막 납부월" type="month" value={v.nationalEndMonth} onChange={nationalEndMonth => update({ nationalEndMonth })} />}
        <p className="profile-help">납부월을 양 끝 포함하여 계산합니다. 임용 이전의 국민연금도 실제 납부월로 입력할 수 있습니다. 직접 지정한 60세 이후 기간은 임의계속가입 승인 등 조건을 확인한 계획이어야 합니다. 가입 중 납부예외·체납 등 공백은 아래 별도 이력으로 표시하세요.</p>
        {v.incomeMode === 'average' && <MoneyField label="국민연금 최종 5년 기준소득월액 평균 (만원, 상한 확인 시)" valueWon={v.nationalLastFiveIncome} onChangeWon={nationalLastFiveIncome => update({ nationalLastFiveIncome })} />}
        <details className="simple-details"><summary>국민연금 공단 확인 크레딧 (선택)</summary><Field label="공단 확인 국민연금 군복무 크레딧 개월" value={v.nationalMilitaryMonths} onChange={nationalMilitaryMonths => update({ nationalMilitaryMonths })} /><Field label="공단 확인 국민연금 출산 크레딧 개월" value={v.nationalChildMonths} onChange={nationalChildMonths => update({ nationalChildMonths })} /><p className="profile-help">2008년 이후 군복무와 2026년 개정의 완료일·수급권 경과조건, 출산 인정·배분·중복 여부를 공단에서 확인한 개월만 입력하세요. 미입력은 시나리오에서 제외하며 수급권이 없다고 판정하는 것은 아닙니다. 실업크레딧은 이 간편 계산에서 지원하지 않습니다.</p></details>
      </> : <>
        {p.appointmentDate < '1996-01-01' && <><p className="profile-help">1995년 이전 임용자는 2001년 당시 인정기간·추가 재직·합산 경과규정에 따라 즉시 개시 또는 별도 연령이 적용될 수 있습니다.</p><Field label="공단 확인 정상 수급조건 충족일 (선택)" type="date" value={v.verifiedNormalDate} onChange={verifiedNormalDate => update({ verifiedNormalDate })} /></>}
        {p.appointmentDate < '2010-01-01' && <MoneyField label="구기간 평균보수월액 현가액 (만원)" valueWon={v.legacyIncome} onChangeWon={legacyIncome => update({ legacyIncome })} />}
        <MoneyField label="공단 확인 소득재분배 반영 평균소득 (만원)" valueWon={v.redistributedIncome} onChangeWon={redistributedIncome => update({ redistributedIncome })} />
        <Field label="공단 확인 이행률·보정률 (%)" inputMode="decimal" value={v.factorPercent} onChange={factorPercent => update({ factorPercent })} />
        <p className="profile-help">재분배 반영 평균소득과 이행률은 해당 제도에서 확인한 값입니다. 공무원 전체 평균액 하나나 최종 봉급만으로 임의 산정하지 않습니다. 평균소득·구기간 소득은 과거 소득을 같은 2026년 가격 수준으로 환산한 값을 입력하세요.</p>
        {p.military === 'approved' && <><Field label="공단 확인 직역연금 군복무 인정 개월" value={v.militaryMonths} onChange={militaryMonths => update({ militaryMonths })} /><Field label="군복무 실제 산입연도" value={v.militaryCreditYear} onChange={militaryCreditYear => update({ militaryCreditYear })} />{p.appointmentDate < '2016-01-01' && <Field label="공단 확인 2016년 기준 인정 재직개월 (경과 상한 확인 시)" value={v.recognizedAt2016} onChange={recognizedAt2016 => update({ recognizedAt2016 })} />}<p className="profile-help">2016년 이후 실제 산입연도의 지급률을 적용합니다. 실제 복무연도와 다를 수 있습니다. 2015년 이전 산입이나 경력 합산은 별도 경과 검증이 필요합니다. 군복무 인정으로 2016년 기준 재직 상한 구간이 바뀌면 당시의 공단 인정기간도 필요합니다.</p></>}
      </>}
      <label className="checkbox"><input type="checkbox" checked={v.complexCareer} onChange={e => update({ complexCareer: e.target.checked })} />중단·휴직·시간제·납부예외·체납·재임용·직역 합산·기수령 등 별도 이력이 있습니다.</label>
      <p className="profile-help">별도 이력이 있으면 이 연속 가입 모델은 금액을 표시하지 않습니다. 연도별 공단 인정기간·경과규정이 필요합니다.</p>
      <label className="checkbox"><input type="checkbox" disabled={!r.retirement.date} checked={checked} onChange={e => update({ confirmedRetirementDate: e.target.checked ? r.retirement.date ?? '' : '', confirmedAppointmentDate: e.target.checked ? p.appointmentDate : '' })} />소득·계수·가입기간을 현재 퇴직일 기준으로 확인했습니다.</label>
      <p className="profile-help">현재 퇴직일 {r.retirement.date ?? '확인 필요'} · 임용일/퇴직일이 바뀌면 가정을 다시 확인해야 합니다.</p>
    </details>
    <details className="simple-details"><summary>공적연금 계산 근거·구간·한계</summary><p className="profile-help">계산 방법: {details.method}</p><p className="profile-help">{details.formula}</p>
      {details.periods.length > 0 && <dl className="benefit-details">{details.periods.map(period => <Fragment key={period.label}><dt>{period.label}</dt><dd>{period.months}개월{period.amountWon !== null ? ` · 월 구성액 ${won(period.amountWon)}` : ''}</dd></Fragment>)}</dl>}
      <ul className="profile-help">{details.notes.map(note => <li key={note}>{note}</li>)}</ul><p className="profile-help">{details.earlyNote}</p><p className="profile-help">{details.earlyAge === null ? '' : `일반 조기 신청 검토 연령: 만 ${details.earlyAge}세부터. `}조기수령을 선택한 결과가 아닙니다. {details.externalValidation}. 직역연금 원 미만 버림·국민연금 10원 미만 버림을 적용하며, 기관의 전체 급여 끝수·개인별 지급액 대조가 끝난 것은 아닙니다.</p>
      {details.sources.map(source => <p className="profile-help" key={source.url}><OfficialLink href={source.url}>{source.title}</OfficialLink></p>)}</details>
    <p className="profile-help">공식 조회액이 있으면 아래에 입력하세요. 입력액을 우선 사용하며 지우면 자동 추정으로 돌아갑니다.</p>
    <SimpleQuoteEditor title="예상 월연금" kind="pension" value={q.pension} onChange={pension => onChange({ ...input, benefits: { ...input.benefits, [p.scheme]: { ...q, pension } } })} date={r.retirement.date} />
  </section>;
}
