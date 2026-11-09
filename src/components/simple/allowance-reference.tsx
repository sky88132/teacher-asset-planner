import type { SimpleBenefits } from '@/lib/simple/model';
import type { SimpleResults } from '@/lib/simple/calculation';
import { allowanceReferenceSources } from '@/lib/simple/allowance-reference';
import { Field, MoneyField, Result, won, OfficialLink } from './shared';
export function AllowanceReferenceCard({value:q,onChange:update,result:r}:{value:SimpleBenefits;onChange:(v:Partial<SimpleBenefits>)=>void;result:SimpleResults}){
  const a=r.allowanceReference, amounts=a.rows.flatMap(x=>x.amountWon===null?[]:[x.amountWon]);
  const headline=amounts.length===a.rows.length&&amounts.length?amounts.length===1?won(amounts[0]):`${won(Math.min(...amounts))} ~ ${won(Math.max(...amounts))}`:'전체액 확인 필요';
  return <section className="benefit-result" aria-label="퇴직수당 참고 시뮬레이션"><details className="simple-details"><summary>2026년 소득 수준 고정 상세 비교</summary><h3>퇴직수당 참고 시뮬레이션</h3><strong className="benefit-amount">{headline}</strong>
    <p className="profile-help">{a.actual?'입력 소득 기반 조건부 계산':'전체 공무원 통계 평균을 중심으로 한 소득 가정'} · 세전 · 개인 공식 조회액 아님</p>
    <p>계산 기준 {a.priceYear}년 · 인정기간 {a.rows[0]?.months??a.total??'미확인'}개월 · 최대33년</p>
    <p className="profile-help">2026년 소득 수준 고정 가정. 595만원은 전체 공무원 평균이며 교사 개인 소득이 아닙니다.</p>
    {a.errors.map(e=><p className="profile-help" key={e}>{e}</p>)}{a.oldReason&&<p className="profile-help">{a.oldReason}</p>}
    {a.rows.map(row=><div className="profile-context" key={row.label}><strong>{row.label}: {won(row.amountWon,'전체액 미확인')}</strong><p>기준소득월액 {won(row.income,'확인 필요')} · 지급비율 {row.rate===null?'확인 필요':(row.rate*100).toLocaleString('ko-KR',{maximumFractionDigits:2})+'%'}</p>
      <p className="profile-help">2009년 이전 {row.oldMonths}개월 / 2010년 이후 {row.newMonths??'미확인'}개월{row.oldMonths?` · 이후분 참고 소계 ${won(row.postWon,'계산 불가')} (전체액 아님)`:''}</p>
      {row.combinedWon!==null&&<p className="profile-help">명예퇴직수당 포함 동일 가정 기준 참고 합계 {won(row.combinedWon)} · 명퇴는 호봉·봉급표, 퇴직수당은 입력/통계 소득 기준 · 선정·개인별 지급액·세금 미확정</p>}{row.errors.map(e=><p className="profile-help" key={e}>{e}</p>)}</div>)}
    </details><details className="simple-details"><summary>계산 근거 보기 (퇴직수당)</summary>
      <MoneyField label="2026년 기준 퇴직수당용 기준소득월액 (만원, 선택)" valueWon={q.income??''} onChangeWon={income=>update({income})}/>
      {a.oldMonths>0&&<><MoneyField label="2009년 이전분 최종보수월액 현가액 (만원, 2026년 기준)" valueWon={q.legacyAllowanceIncome??''} onChangeWon={legacyAllowanceIncome=>update({legacyAllowanceIncome})}/>
      </>}
      {a.oldMonths>0&&<label className="checkbox"><input type="checkbox" checked={!!r.retirement.date&&q.legacyAllowanceDate===r.retirement.date&&q.legacyAllowanceAppointment===a.appointmentDate} onChange={e=>update({legacyAllowanceDate:e.target.checked?r.retirement.date??'':'',legacyAllowanceAppointment:e.target.checked?r.allowanceReference.appointmentDate:''})}/>공단 확인 구기간 현가액을 현재 임용일·퇴직일 기준으로 확인했습니다.</label>}
      <Field label="퇴직일 기준 퇴직수당 인정 개월 (선택)" value={q.recognizedMonths??''} onChange={recognizedMonths=>update({recognizedMonths,recognizedDate:r.retirement.date??'',recognizedAppointment:a.appointmentDate})}/>
      <Result title="퇴직수당 결과" result={r.allowance}/><p className="profile-help">기존 개인 소득 경로: {r.allowanceDetails.formula} · {r.allowanceDetails.basis}</p>
      <p className="profile-help">구기간은 최종보수월액 현가액×구기간 연수×전체 인정기간의 10/35/45/50/60%, 이후분은 기준소득월액×이후 연수×6.5/22.75/29.25/32.5/39%입니다. 구기간 소득을 현재 소득에서 역산하지 않습니다.</p>
      <p className="profile-help">{a.notes}</p>{allowanceReferenceSources.map(s=><p className="profile-help" key={s.url}><OfficialLink href={s.url}>{s.title}</OfficialLink></p>)}<OfficialLink href={r.allowanceDetails.source}>해당 제도 법령</OfficialLink>
    </details></section>;
}
