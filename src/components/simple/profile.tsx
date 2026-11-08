import type { SimpleProfile } from '@/lib/simple/model';
import { schemeNames } from '@/lib/simple/model';
import { validateSimpleProfile } from '@/lib/simple/validation';
import type { SimpleResults } from '@/lib/simple/calculation';
import { simpleConfig, teacherSalary2026 } from '@/lib/simple/config';
import { Field, OfficialLink, won } from './shared';
export function SimpleProfilePanel({ value, onChange, result }: { value: SimpleProfile; onChange: (v: SimpleProfile) => void; result: SimpleResults }) {
  const set = <K extends keyof SimpleProfile>(key: K, v: SimpleProfile[K]) => onChange({ ...value, [key]: v });
  const errors = validateSimpleProfile(value, result.today);
  return <div className="simple-panel">
    <fieldset><legend><span className="stage-number">1</span> 가입 연금제도</legend><div className="simple-schemes">{Object.entries(schemeNames).map(([key, name]) =>
      <label key={key} className={`school ${value.scheme === key ? 'chosen' : ''}`}><input type="radio" name="simple-scheme" checked={value.scheme === key} onChange={() => set('scheme', key as SimpleProfile['scheme'])} /><strong>{name}</strong></label>)}</div></fieldset>
    <fieldset className="profile-stage"><legend><span className="stage-number">2</span> 나의 재직 정보</legend><div className="benefit-fields"><Field label="생년월일" type="date" value={value.birthDate} onChange={v => set('birthDate', v)} />
      <Field label="최초 임용일" type="date" value={value.appointmentDate} onChange={v => set('appointmentDate', v)} />
      <Field label="현재 호봉" type="number" value={value.step} onChange={v => set('step', v)} />
      <Field label="승급월" value={value.promotionMonth} onChange={v => set('promotionMonth', v)}><option value="">선택해 주세요</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}월</option>)}</Field></div>
    {value.scheme === 'national' ? <div className="profile-context"><strong>국민연금 군복무 크레딧</strong><p>공무원연금의 임용 전 산입 절차를 적용하지 않습니다. 군복무 종료 시점·중복 인정 여부 등 개인 조건을 국민연금공단에 확인해 주세요. 가입기간은 자동 추가하지 않습니다.</p><OfficialLink href={simpleConfig.militaryNationalUrl}>국민연금 군복무 크레딧 안내</OfficialLink></div> : <>
      <Field label="임용 전 군복무기간을 연금 재직기간에 산입했습니까?" value={value.military} onChange={v => set('military', v as SimpleProfile['military'])}><option value="approved">산입 승인 완료</option><option value="not">산입하지 않음</option><option value="unknown">확인 필요</option></Field>
      <details className="simple-details"><summary>군복무기간 산입 자세히 보기</summary><p className="profile-help">군복무기간 산입은 임용 전 병역법에 따른 복무기간을 관련 연금제도의 재직기간으로 인정받는 절차입니다. 단순히 군 복무를 마쳤다는 의미가 아니며 신청·승인 여부와 소급기여금 납부 상태에 따라 실제 연금 산정 조건이 달라질 수 있습니다. 승인과 완납은 별개이며 인정 재직월수를 자동 추가하지 않습니다. 현행 시행령 제20조는 재직기간 합산절차이며 임용 전 복무기간 산입절차는 제23조입니다.</p>
        {value.scheme === 'civil' ? <><OfficialLink href={simpleConfig.militaryCivilUrl}>공무원연금 산입 신청 안내</OfficialLink> · <OfficialLink href={simpleConfig.militaryCivilLawUrl}>공무원연금법 시행령 제18·20·23조</OfficialLink></> : <><OfficialLink href={simpleConfig.militaryPrivateUrl}>사학연금법 제31조</OfficialLink> · <OfficialLink href={simpleConfig.militaryPrivateProcedureUrl}>사학연금 시행령 제17조의3 · 별도 산입절차</OfficialLink></>}</details></>}
    </fieldset><fieldset className="benefit-section profile-stage"><legend><span className="stage-number">3</span> 예상 퇴직 방식</legend><div className="school-options">{[['normal', '정년퇴직'], ['early', '명예퇴직']].map(([key, name]) => <label className={`school ${value.retirement === key ? 'chosen' : ''}`} key={key}><input type="radio" name="simple-retirement" checked={value.retirement === key} onChange={() => set('retirement', key as SimpleProfile['retirement'])} /><strong>{name}</strong></label>)}</div></fieldset>
    <Field label="명예퇴직 예정일" type="date" value={value.earlyDate} onChange={v => set('earlyDate', v)} disabled={value.retirement !== 'early'} />
    <details className="simple-details"><summary>정년일이 다른 경우 직접 수정</summary><label className="checkbox"><input type="checkbox" checked={value.manualNormal} onChange={e => set('manualNormal', e.target.checked)} />기관에서 확인한 정년일 사용</label>
      <Field label="기관에서 확인한 정년일" type="date" value={value.normalDate} onChange={v => set('normalDate', v)} disabled={!value.manualNormal} />
      <p className="profile-help">일반 초·중등 교육공무원 만 62세·학기말 규정을 가정합니다. 대학 교원·사립학교·별도 신분은 실제 정년일을 확인하세요. 국민연금은 가입제도만으로 정년을 알 수 없어 직접 입력이 필요합니다. 윤일 출생의 62세 해당 연도 2월 말일을 참고 날짜로 사용하며 실제 적용일은 기관에서 확인하세요.</p><OfficialLink href={simpleConfig.retirementUrl}>교육공무원법 제47조 (2026.10.2 시행)</OfficialLink></details>
    <section className="benefit-result" aria-label="공통 퇴직 조건"><h3>예상 퇴직일</h3><strong className="benefit-amount">{result.retirement.date ?? '추가 확인 필요'}</strong><p>예상 정년일: {result.retirement.normal ?? '기관 확인 필요'}</p><p>퇴직 호봉 참고: {result.step === null ? '계산 불가' : `${result.step}호봉 · 조건부 추정값`}</p><details className="simple-details"><summary>승급 계산 가정</summary><p className="profile-help">현재 호봉은 오늘 기준입니다. 이미 지난 승급월은 다시 반영하지 않습니다. 매년 승급월 1일 1호봉 상승, 승급 제한 없음·40호봉 상한 가정이며 실제 승급 발령이 아닙니다. 근가호봉·휴직·징계·특별승급은 별도 확인이 필요합니다.</p></details></section>
    <details className="simple-details"><summary>호봉 기반 참고정보·봉급표</summary><p>2026년 봉급표상 해당 호봉 참고액: {won(result.step === null ? null : teacherSalary2026[result.step - 1])}</p><p className="profile-help">2026년 표를 참고로 표시할 뿐 미래 봉급 인상률을 적용하지 않습니다. 실제 신분별 봉급과 다를 수 있으며 기준소득월액·명퇴수당 산정 봉급액이 아닙니다.</p><OfficialLink href={simpleConfig.salaryUrl}>2026년 공식 교원 봉급표</OfficialLink> · <OfficialLink href={simpleConfig.promotionUrl}>정기승급 규정</OfficialLink></details>
    {value.scheme === 'civil' && <details className="simple-details"><summary>교원 표준 보수·연금 추정 가정</summary><label className="checkbox"><input type="checkbox" checked={value.teacherModel !== false} onChange={e=>set('teacherModel',e.target.checked)} />봉급 연3% 상승·담임수당 계속·일반 교원 표준 수당 가정 사용</label><p className="profile-help">공단 조회액이 아닌 보수 경로 시뮬레이션입니다. 과거 실제 소득·일부 평균수당·구기간 현가 자료가 없으면 전체 월액은 계산하지 않습니다. 사학·국민연금에는 자동 적용하지 않습니다.</p></details>}
    {errors.length > 0 && <div className="profile-help" aria-label="기본정보 확인 필요"><strong>확인이 필요한 정보</strong><ul>{errors.map(e => <li key={e}>{e}</li>)}</ul></div>}
    <p className="profile-help">기본정보만 입력해도 AI 분석 요청문을 만들 수 있습니다. 다른 금융 입력은 선택 사항입니다.</p>
  </div>;
}
