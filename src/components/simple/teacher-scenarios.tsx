import type { SimpleInputs } from '@/lib/simple/model';
import type { SimpleResults } from '@/lib/simple/calculation';
import { teacherPayAssumptions, teacherPriceNote, teacherPaySources } from '@/lib/simple/teacher-pay';
import { won, OfficialLink } from './shared';

export function scenarioRange(values: (number | null)[], empty='전체액 확인 필요') {
  if(!values.length||values.some(x=>x===null))return empty;
  const known=values as number[], low=Math.min(...known),high=Math.max(...known);
  return low===high?won(low):`${won(low)} ~ ${won(high)}`;
}
export function TeacherPayDetails({ result:r }: {result:SimpleResults}) {
  return <details className="simple-details"><summary>교원 보수 추정 가정·연도별 근거</summary>
    <p className="profile-help">{teacherPayAssumptions}</p><p className="profile-help">{teacherPriceNote}</p>
    {r.teacherPay.errors.map(e=><p className="profile-help" key={e}>{e}</p>)}
    {r.teacherPay.historyErrors.map(e=><p className="profile-help" key={e}>{e}</p>)}
    {r.teacherPension.eligible && r.teacherPension.errors.map(e=><p className="profile-help" key={e}>{e}</p>)}
    <p>퇴직일 봉급 참고: {won(r.teacherPay.finalSalaryWon)} · 퇴직연도 미래 명목 · 기본봉급만</p>
    <p className="profile-help">명절휴가비는 봉급60% 연2회, 정근수당은 근무연수별10~50% 연2회를 연간 보수에 월별 발생액으로 환산합니다. 부분 연도는 근무월만 반영하며 실제1·7월/설·추석 재직일 지급표가 아닙니다. 정근가산금은 임용 후 연속 근무연수 기준이며 군경력·휴직·별도 인정경력은 미반영입니다.</p>
    <p className="profile-help">교직·담임·정근·명절은 일반 과세 보수로, 급식비는 식사 미제공 및 월20만원 이내 비과세 가정을 적용합니다. 교원연구비는 별도 요건이 필요해 담임수당에서 임의 공제하지 않습니다. 가족·보직·특수·55세/30년 교육경력 가산·연가보상·성과/초과근무 및 기타 미확인 수당은 미포함입니다.</p>
    <div className="ktcu-table-wrap"><table className="ktcu-table"><caption>교원 표준 보수 경로 · 과거는2026 수준 재구성 / 미래는 해당 연도 명목</caption><thead><tr><th>연도·반영월</th><th>호봉</th><th>기본봉급 합계</th><th>담임</th><th>교직·정근가산</th><th>정근 연2회 발생분</th><th>명절 연2회 발생분</th><th>비과세 급식</th><th>과세 보수</th><th>연환산 과세</th><th>월평균 보수 기초</th><th>2026 환산 기초</th></tr></thead>
      <tbody>{r.teacherPay.rows.map(y=><tr key={y.year}><td>{y.year} · {y.months}개월{y.reconstructed?' (재구성)':''}</td><td>{y.firstStep}→{y.lastStep}</td><td>{won(y.salaryWon)}</td><td>{won(y.homeroomWon)}</td><td>{won(y.teachingWon+y.serviceBonusWon)}</td><td>{won(y.regularBonusWon)}</td><td>{won(y.holidayBonusWon)}</td><td>{won(y.mealWon)}</td><td>{won(y.taxableWon)}</td><td>{won(y.annualizedTaxableWon)}</td><td>{won(y.incomeProxyWon)}</td><td>{won(y.basis2026IncomeWon)}</td></tr>)}</tbody></table></div>
    {teacherPaySources.map(s=><p key={s.url}><OfficialLink href={s.url}>{s.title}</OfficialLink></p>)}
  </details>;
}
export function TeacherPensionScenarios({result:r}:{result:SimpleResults}) {
  if(r.pensionSource!=='teacher-model')return null;
  return <div aria-label="교원 보수 기반 월연금 시나리오"><p className="profile-help">교원 봉급 및 수당, 연 3% 상승 가정에 따른 참고 추정액입니다. 실제 공단 예상액과 다를 수 있습니다.</p>
    {r.teacherPension.rows.map(s=><p key={s.id}><strong>{s.label}: {won(s.estimate.amountWon)} / 월</strong> · {s.estimate.priceYear}년 개시 명목 가정 <span className="profile-help">(2026 보수수준 환산 {won(s.basis2026Won)})</span></p>)}
    <p className="profile-help">90/100/110% 보수 기초 민감도입니다. 실제 지급범위·법정 최저/최고가 아니며 구간 경계에서 금액 순서가 달라질 수 있습니다. 실제 직종별 평균수당·과거 소득 재평가·퇴직 전3년 전체 평균은 미확인입니다.</p>
  </div>;
}
export function BenefitReferenceTotals({input,result:r}:{input:SimpleInputs;result:SimpleResults}) {
  const early=input.profile.retirement==='early';
  const teacher=r.teacherBenefits, legacy=r.allowanceReference;
  const primary=r.benefitReference.source==='teacher-model';
  const oldRows=legacy.rows.map(s=>({label:s.label,allowanceWon:s.amountWon,honoraryWon:r.honorary.amountWon,combinedWon:s.combinedWon}));
  const rows=r.benefitReference.rows;
  if(input.profile.scheme!=='civil'&&!rows.length)return null;
  return <section className="benefit-result" aria-label="퇴직급여 참고 합계"><h3>{early?'명예퇴직수당 + 퇴직수당 참고 합계':'퇴직수당 참고 시나리오'}</h3>
    <strong className="benefit-amount">{scenarioRange(rows.map(s=>early?s.combinedWon:s.allowanceWon),'전체 참고 합계 확인 필요')}</strong>
    <p className="profile-help">동일 가정 기준 세전 참고 합계 · {primary?`${teacher.priceYear}년 미래 명목 · 교원 표준 보수 기반`:'2026년 고정 기준 · 입력 소득 또는 전체 공무원 통계 가정'} · 실제 지급 확정 합계 아님</p>
    {rows.map(s=><div className="profile-context" key={s.label}><strong>{s.label} 참고 {early?'합계':'퇴직수당'}: {won(early?s.combinedWon:s.allowanceWon,'합계 보류')}</strong><p className="profile-help">{early?`명퇴수당 ${won(s.honoraryWon,'추정 불가')} + `:''}퇴직수당 {won(s.allowanceWon,'전체액 미확인')}</p></div>)}
    {(!rows.length||rows.some(s=>early?s.combinedWon===null:s.allowanceWon===null))&&<p className="profile-help">어느 한 항목이 미확인이면0원으로 채우지 않습니다. 구기간 현가 소득·지급 자격 등04의 조건을 확인하세요.</p>}
    <details className="simple-details"><summary>참고 합계 기준·다른 시나리오</summary><p className="profile-help">{teacher.notes}</p>
      {teacher.errors.map(e=><p className="profile-help" key={e}>{e}</p>)}
      {primary&&<><p>별도2026 고정 기준 합계 · 위 미래 명목 합계와 더하지 않습니다.</p>{oldRows.map(s=><p key={s.label}>{s.label}: {won(early?s.combinedWon:s.allowanceWon,'전체액 미확인')}</p>)}</>}
      <p className="profile-help">명퇴수당에는 교직·담임수당을 기본봉급에 더하지 않습니다. 기존68%·잔여월 산식을 재사용하고 봉급표 상승만 별도로 적용합니다. 기존 개인 소득 기반 합계·금융 적립금은 이 참고 결과로 덮어쓰지 않습니다.</p>
    </details>
  </section>;
}
