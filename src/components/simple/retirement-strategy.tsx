import type { SimpleInputs } from '@/lib/simple/model';
import type { SimpleResults } from '@/lib/simple/calculation';
import { calculateRetirementAnalysis } from '@/lib/simple/retirement-analysis';
import { generateRetirementAdvice } from '@/lib/simple/retirement-advice';
import { MoneyField, won } from './shared';

export function RetirementStrategy({ input, onChange, result: r }: { input: SimpleInputs; onChange: (v: SimpleInputs) => void; result: SimpleResults }) {
  const a = calculateRetirementAnalysis(input, r), advice = generateRetirementAdvice(input, r, a);
  const maximum = Math.max(1, ...a.windows.flatMap(w => w.subtotalWon === null ? [] : [w.subtotalWon]));
  return <section className="retirement-strategy" aria-label="은퇴설계 종합 분석">
    <section className="benefit-result" aria-label="은퇴설계 핵심 요약"><h3>나의 은퇴 후 자산 활용</h3>
      <dl className="retirement-summary"><div><dt>예상 퇴직</dt><dd>{a.retirement ?? '확인 필요'} · {a.retirementAge === null ? '연령 확인 필요' : `만 ${a.retirementAge}세`}</dd></div>
        <div><dt>정상 공적연금 조건 충족</dt><dd>{a.normalPublicDate ?? '확인 필요'}</dd></div><div><dt>분석에 적용한 연금 개시</dt><dd>{a.publicStart ?? '확인 필요'}</dd></div>
        <div><dt>{input.profile.retirement === 'early' ? '명예퇴직 후 소득 공백' : '퇴직 후 개시 전 기간'}</dt><dd>{a.gapDays === null ? '확인 필요' : `${a.gapMonths}개월(완료 월) · ${a.gapDays}일`}</dd></div>
        <div><dt>예상 월 공적연금</dt><dd>{won(a.pensionWon, '월액 미확인')} / 월<br /><small>{r.pension.confidence}</small></dd></div><div><dt>퇴직 시 금융 적립금</dt><dd>{won(a.accumulationWon, '전체 합산 불가')}</dd></div><div><dt>퇴직급여 예상액</dt><dd>{won(a.benefitsWon, '합산 불가')} · 세전</dd></div></dl>
      <p className="profile-help">위 적립금은 퇴직 시점의 조건부 스냅샷입니다. 즉시 인출 가능액이 아니며 월 공적연금·분할 총지급액을 더하지 않습니다. 아래에서는 일시금·분할 재원·조건부 연금계좌를 구분합니다.</p>
    </section>
    <section className="benefit-result" aria-label="은퇴 시기 타임라인"><h3>은퇴 후 두 시기</h3>
      <ol className="retirement-timeline"><li><span className="section-tag">A · 공적연금 개시 전</span><strong>{a.validTiming && a.gapDays === 0 ? '퇴직 후 개시 전 공백 없음' : <>{a.retirement ?? '퇴직일 확인 필요'} → {a.publicStart ?? '개시일 확인 필요'}</>}</strong><p>{!a.validTiming ? '날짜가 확인되면 공백을 계산합니다.' : a.gapDays === 0 ? '개시 전 공백 0: 연금이 퇴직일 또는 그 전에 이미 개시됩니다.' : `${a.gapMonths}개월(완료 월) · ${a.gapDays}일. ${input.profile.retirement === 'early' ? '명예퇴직 후 생활비 재원과 수령 시점을 먼저 확인하세요.' : '이 기간의 생활비 재원을 확인하세요.'}`}</p></li>
        <li><span className="section-tag">B · 공적연금 개시 후</span><strong>{a.publicStart ?? '개시일 확인 필요'} 이후</strong><p>예상 월 공적연금 {won(a.pensionWon,'미확인')}. 분할급여가 끝난 뒤의 월수입 변화도 확인하세요.</p></li></ol>
      <p className="profile-help">공적연금 정상 조건 충족일과 분석 개시 기준은 다를 수 있습니다. 자동 추정은 최초 지급대상월 1일, 직접 조회값은 입력한 개시일을 사용합니다. 실제 입금일·감액·세금은 별도 확인합니다.</p>
    </section>
    <section className="benefit-result" aria-label="자산 활용 방식 구분"><h3>같은 자산을 두 번 쓰지 않도록</h3>
      <div className="retirement-asset-groups"><div><span className="section-tag">A · 일시 수령 검토 재원</span>{a.lumpItems.map(x => <p key={x.label}>{x.label} {won(x.won,'추정 불가')}</p>)}<strong>조건부 세전 합계 {won(a.lumpTotalWon,'누락 항목으로 합산 불가')}</strong><p className="profile-help">지급·선정·세금·입금일까지 확인해야 합니다. 사용 가능한 현금으로 확정한 금액이 아닙니다. 공제회 수익률 가정과 2026년 가격 고정 수당을 결합한 참고 합계로, 실제 세후 현금과 다릅니다.</p></div>
        <div><span className="section-tag">B · 기간을 정해 분할</span><p>{a.split.selected ? `${a.split.years}년 선택 · 가상 정기 월 ${won(a.split.monthlyWon,'계산 불가')}` : '공제회 일시금 선택 · 분할 월수입 미반영'}</p>
          {a.split.selected && <><p>첫 지급 {a.split.first ?? '확인 필요'} / 마지막 {a.split.last ?? '확인 필요'}</p><p>공적연금 개시 전 {a.split.beforeCount ?? '미확인'}회 / 퇴직 이후 개시 후 {a.split.afterCount ?? '미확인'}회</p><p>잔액 비교 기준 {a.split.balanceSnapshotDate ?? '확인 필요'} (퇴직일·개시일 중 늦은 날)</p><p>기준일 직전까지 가상 누적 지급 {won(a.split.paidBeforeStartWon,'확인 필요')}</p><p>해당 지급 후 남은 가상 잔액 {won(a.split.balanceAtPublicStartWon,'확인 필요')}</p></>}
          <p className="profile-help">5~30년의 지원 선택 기간을 유지합니다. 전체 세전 적립금의 가상 인출이며 실제 상품 지급액이 아닙니다. 기존 지급표의 차감 후 잔액을 사용하고 일시금과 중복 합산하지 않습니다.</p></div>
        <div><span className="section-tag">C · 수령 조건 확인 계좌</span>{a.accounts.map(x => <div key={x.key}><p><strong>{x.title} {won(x.balanceWon,'미확인')}</strong></p><p>요건 예상일 {x.receipt.eligibleDate ?? '가입기간 등 미확인'} · {x.eligibleAtRetirement === null ? '판정 보류' : x.eligibleAtRetirement ? '퇴직일 연령·기간 요건 충족 예상' : '퇴직일 요건 미충족'}</p><p className="profile-help">{x.receipt.bridge} / 연간 한도 {x.receipt.unlimited ? '산식 미적용 (세금·잔액 제약 유지)' : won(x.receipt.limitWon,'계산 정보 확인 필요')}</p></div>)}
          <p className="profile-help">즉시 사용 가능한 목돈에 합산하지 않습니다. 실제 신청·가입기간·재원·한도·세금을 확인하세요. 03의 연간 한도 산입 인출액은 월 인출계획이 아닙니다. 이번 분석은 계좌 인출을 실행·차감하지 않으며 위 금액을 미래의 남은 잔액으로 표시하지 않습니다. 인출 전략을 만들 때는 지급액만큼 잔액을 차감해야 합니다.</p></div></div>
    </section>
    <section className="benefit-result" aria-label="월 생활비와 수입 비교"><h3>월수입과 생활비를 함께 보기</h3>
      <MoneyField label="은퇴 후 희망 월 생활비(만원)" valueWon={input.monthlyLivingCost ?? ''} onChangeWon={monthlyLivingCost => onChange({ ...input, monthlyLivingCost })} />
      <p className="profile-help">선택 입력입니다. 미입력은 0원 생활비가 아니며 일반 조언은 계속 표시됩니다. 근로·임대·기타수입, IRP·연금저축 월 인출은 미반영입니다. 차이는 계산 가능한 월액 소계와의 비교이며 실제 부족액·잉여액을 확정하지 않습니다.</p>
      {a.expenseError && <p className="field-error">{a.expenseError}</p>}
      {(['before','after'] as const).map(phase => <figure className="simple-composition" key={phase} aria-label={phase === 'before' ? '공적연금 개시 전 월수입 그래프' : '공적연금 개시 후 월수입 그래프'}><figcaption>{phase === 'before' ? 'A · 공적연금 개시 전' : 'B · 공적연금 개시 후'} · 계산 가능한 월 지급액 수준</figcaption>
        {!a.windows.some(w=>w.phase===phase) && <p className="profile-help">{a.validTiming && phase==='before' && a.gapDays===0 ? '개시 전 공백 없음 · 비교 구간이 없습니다.' : '개시일·퇴직일 확인 후 구간을 표시합니다.'}</p>}
        {a.windows.filter(w=>w.phase===phase).map(w => <div className="retirement-income-window" key={w.from}><p><strong>{w.label}</strong><br />{w.from}{w.until ? ` ~ ${w.until} 전` : ' 이후'}</p>
          <div className="simple-bar-row"><span>월액 소계</span><div className="simple-bar-track">{w.subtotalWon !== null && <div style={{width:`${w.subtotalWon/maximum*100}%`}} />}</div><strong>{won(w.subtotalWon,'월수입 합산 미확인')} / 월</strong></div>
          <p className="profile-help">{w.sources.length ? w.sources.map(s=>`${s.label} ${won(s.won)} (${s.tax === 'gross' ? '세전' : s.tax==='net' ? '입력 세후' : '세금 기준 미확인'})`).join(' + ') : '확인된 정기 월 지급액 없음 · 0원 수입 확정 아님'}</p>
          <p className="profile-help">{a.expenseWon === null ? '생활비 미입력 · 차이 비교 보류' : w.differenceWon === null ? '월액 합산 미확인 · 부족·잉여 판정 보류' : `희망 생활비 대비 선택 자료 차이: ${w.differenceWon>=0 ? '+' : '−'}${won(Math.abs(w.differenceWon))} / 월 (실제 부족액·잉여액 아님)`}</p>
          <p className="profile-help">{w.missing.join(' · ')}</p></div>)}
      </figure>)}
      <p className="profile-help">구간별 월 지급액 예시이며 구간 전체 평균이나 매일 같은 금액을 받는다는 뜻이 아닙니다. 첫 지급 전·마지막 지급일의 정산·분할 종료 후를 나눴습니다. 일시금은 그래프에서 제외하고, 미확인 월액은 막대를 그리지 않습니다. 세전·세후 기준이 다른 월액도 합산하지 않습니다. 가정 수익률·물가·세금·실제 월별 지급 변동은 별도 확인해야 합니다.</p>
    </section>
    <section className="benefit-result" aria-label="규칙 기반 맞춤형 조언"><h3>지금 확인할 다섯 가지</h3><p className="profile-help">현재 계산 결과를 이용한 규칙 기반 안내입니다. 외부 AI·투자 추천 API를 사용하지 않습니다.</p>
      {advice.map((item,index)=><article className="retirement-advice" key={item.id}><h4>{index+1}. {item.title}</h4><p><strong>현재 상황</strong> {item.situation}</p><p><strong>문제·선택지</strong> {item.issue}</p><p><strong>검토할 대응</strong> {item.action}</p><p className="profile-help"><strong>추가 확인</strong> {item.confirm}</p></article>)}
    </section>
  </section>;
}
