import type { ReactNode } from 'react';
import type { SimpleInputs } from '@/lib/simple/model';
import type { SimpleResults } from '@/lib/simple/calculation';
import { calculateRetirementAnalysis } from '@/lib/simple/retirement-analysis';
import { generateRetirementAdvice } from '@/lib/simple/retirement-advice';
import { won } from './shared';
import { AccountReceiptSummary } from './account-receipt';
import { IncomeFlowChart, KeyFacts } from './dashboard-visuals';

export function RetirementStrategy({ input, children, result: r }: { input: SimpleInputs; children?: ReactNode; result: SimpleResults }) {
  const a = calculateRetirementAnalysis(input, r), advice = generateRetirementAdvice(input, r, a);
  const maximum = Math.max(1, ...a.windows.flatMap(w => w.subtotalWon === null ? [] : [w.subtotalWon]));
  return <section className="retirement-strategy" aria-label="은퇴설계 종합 분석">
    <KeyFacts input={input} result={r} analysis={a} />
    <IncomeFlowChart input={input} analysis={a} />
    {children}
    <section className="benefit-result" aria-label="규칙 기반 맞춤형 조언"><h3>나의 은퇴 준비, 세 가지 점검</h3>
      {[{title:'소득 공백과 생활비', ids:['gap','living']},{title:'공제회와 퇴직급여',ids:['ktcu','benefits']},{title:'연금계좌 수령 전략',ids:['accounts']}].map(group => <div className="retirement-advice-group" key={group.title}><h4>{group.title}</h4><p>{advice.find(x=>x.id===group.ids[0])?.situation}</p><p>{advice.find(x=>x.id===group.ids[0])?.action}</p><details className="simple-details"><summary>{group.title} 조언 자세히 보기</summary>{advice.filter(x=>group.ids.includes(x.id)).map(item=><article className="retirement-advice" key={item.id}><h4>{item.title}</h4><p><strong>현재 상황</strong> {item.situation}</p><p><strong>문제·선택지</strong> {item.issue}</p><p><strong>검토할 대응</strong> {item.action}</p><p className="profile-help"><strong>추가 확인</strong> {item.confirm}</p></article>)}</details></div>)}
    </section>
    <details className="simple-details dashboard-more"><summary>구간별 월수입·생활비 비교 자세히 보기</summary>
    <section className="benefit-result" aria-label="월 생활비와 수입 비교"><h3>월수입과 생활비를 함께 보기</h3>
      <p>희망 월 생활비 {won(a.expenseWon, '생활비 미입력')} · 06 AI 분석 요청문에서 선택 입력</p>
      <p className="profile-help">근로·임대·기타수입과 연금계좌 월 인출은 미반영입니다. 생활비와의 차이는 확인된 월액만 비교하며 실제 부족액·잉여액을 확정하지 않습니다.</p>
      {a.expenseError && <p className="field-error">{a.expenseError}</p>}
      {(['before','after'] as const).map(phase => <figure className="simple-composition" key={phase} aria-label={phase === 'before' ? '공적연금 개시 전 월수입 그래프' : '공적연금 개시 후 월수입 그래프'}><figcaption>{phase === 'before' ? 'A · 공적연금 개시 전' : 'B · 공적연금 개시 후'} · 계산 가능한 월 지급액 수준</figcaption>
        {!a.windows.some(w=>w.phase===phase) && <p className="profile-help">{a.validTiming && phase==='before' && a.gapDays===0 ? '개시 전 공백 없음 · 비교 구간이 없습니다.' : '개시일·퇴직일 확인 후 구간을 표시합니다.'}</p>}
        {a.windows.filter(w=>w.phase===phase).map(w => <div className="retirement-income-window" key={w.from}><p><strong>{w.label}</strong><br />{w.from}{w.until ? ` ~ ${w.until} 전` : ' 이후'}</p>
          <div className="simple-bar-row"><span>월액 소계</span><div className="simple-bar-track">{w.subtotalWon !== null && <div style={{width:`${w.subtotalWon/maximum*100}%`}} />}</div><strong>{won(w.subtotalWon,'월수입 합산 미확인')} / 월</strong></div>
          <p className="profile-help">{w.sources.length ? w.sources.map(s=>`${s.label} ${won(s.won)} (${s.tax === 'gross' ? '세전' : s.tax==='net' ? '입력 세후' : '세금 기준 미확인'})`).join(' + ') : '확인된 정기 월 지급액 없음 · 0원 수입 확정 아님'}</p>
          <p className="profile-help">{a.expenseWon === null ? '생활비 미입력 · 차이 비교 보류' : w.differenceWon !== null ? `희망 생활비 대비 선택 자료 차이: ${w.differenceWon>0 ? '+' : ''}${won(w.differenceWon)} / 월 (실제 부족액·잉여액 아님)` : w.difference2026Won !== null ? `2026 보수수준 환산 월액 ${won(w.subtotal2026Won)} 기준 희망 생활비 대비 차이: ${w.difference2026Won>0 ? '+' : ''}${won(w.difference2026Won)} / 월 (미래 명목 월액과 현재 물가 기준 생활비는 직접 비교하지 않음 · 실제 부족액·잉여액 아님)` : w.subtotalWon !== null && !w.expenseComparable ? '미래 명목 월액과 현재 물가 기준 생활비는 화폐가치가 달라 부족·잉여 판정 보류' : '월액 합산 미확인 · 부족·잉여 판정 보류'}</p>
          <details className="simple-details"><summary>미반영·추가 확인할 수입</summary><p className="profile-help">{w.missing.join(' · ')}</p></details></div>)}
      </figure>)}
      <details className="simple-details"><summary>월수입 비교 기준 자세히 보기</summary><p className="profile-help">구간별 월 지급액 예시이며 구간 전체 평균이나 매일 같은 금액을 받는다는 뜻이 아닙니다. 첫 지급 전·마지막 지급일의 정산·분할 종료 후를 나눴습니다. 일시금은 그래프에서 제외하고, 미확인 월액은 막대를 그리지 않습니다. 세전·세후 기준이 다른 월액도 합산하지 않습니다. 가정 수익률·물가·세금·실제 월별 지급 변동은 별도 확인해야 합니다.</p></details>
    </section>
    </details>
    <details className="simple-details"><summary>자산 활용 조건 자세히 보기</summary>    <section className="benefit-result" aria-label="자산 활용 방식 구분"><h3>일시금·분할·연금계좌 활용 조건</h3>
      <div className="retirement-asset-groups"><div><span className="section-tag">A · 일시 수령 검토 재원</span>{a.lumpItems.map(x => <p key={x.label}>{x.label} {won(x.won,'추정 불가')}</p>)}<strong>조건부 세전 합계 {won(a.lumpTotalWon,a.lumpPriceCompatible?'누락 항목으로 합산 불가':'2026 기준과 미래 명목 혼합으로 합산 보류')}</strong><p className="profile-help">지급·선정·세금·입금일까지 확인해야 합니다. 사용 가능한 현금으로 확정한 금액이 아닙니다. 2026 고정 기준 수당과 공제회 미래 명목액은 자동 합산하지 않습니다. 각 항목은 실제 세후 현금과 다릅니다.</p></div>
        <div><span className="section-tag">B · 기간을 정해 분할</span><p>{a.split.selected ? `${a.split.years}년 선택 · 가상 정기 월 ${won(a.split.monthlyWon,'계산 불가')}` : '공제회 일시금 선택 · 분할 월수입 미반영'}</p>
          {a.split.selected && <><p>첫 지급 {a.split.first ?? '확인 필요'} / 마지막 {a.split.last ?? '확인 필요'}</p><p>공적연금 개시 전 {a.split.beforeCount ?? '미확인'}회 / 퇴직 이후 개시 후 {a.split.afterCount ?? '미확인'}회</p><p>잔액 비교 기준 {a.split.balanceSnapshotDate ?? '확인 필요'} (퇴직일·개시일 중 늦은 날)</p><p>기준일 직전까지 가상 누적 지급 {won(a.split.paidBeforeStartWon,'확인 필요')}</p><p>해당 지급 후 남은 가상 잔액 {won(a.split.balanceAtPublicStartWon,'확인 필요')}</p></>}
          <p className="profile-help">5~30년의 지원 선택 기간을 유지합니다. 전체 세전 적립금의 가상 인출이며 실제 상품 지급액이 아닙니다. 기존 지급표의 차감 후 잔액을 사용하고 일시금과 중복 합산하지 않습니다.</p></div>
        <div><span className="section-tag">C · 수령 조건 확인 계좌</span><p className="profile-help">공적연금 전 소득 공백 충당 가능 금액은 별도 계산이 필요합니다.</p>{a.accounts.map(x => <div key={x.key}><AccountReceiptSummary title={x.title} result={x.receipt} /><p><strong>{x.title} {won(x.balanceWon,'미확인')}</strong></p><p>요건 예상일 {x.receipt.eligibleDate ?? '가입기간 등 미확인'} · {x.eligibleAtRetirement === null ? '판정 보류' : x.eligibleAtRetirement ? '퇴직일 연령·기간 요건 충족 예상' : '퇴직일 요건 미충족'}</p><p className="profile-help">{x.receipt.bridge} / 연간 한도 {x.receipt.unlimited ? '산식 미적용 (세금·잔액 제약 유지)' : won(x.receipt.limitWon,'계산 정보 확인 필요')}</p></div>)}
          <p className="profile-help">즉시 사용 가능한 목돈에 합산하지 않습니다. 실제 신청·가입기간·재원·한도·세금을 확인하세요. 03의 연간 한도 산입 인출액은 월 인출계획이 아닙니다. 이번 분석은 계좌 인출을 실행·차감하지 않으며 위 금액을 미래의 남은 잔액으로 표시하지 않습니다. 인출 전략을 만들 때는 지급액만큼 잔액을 차감해야 합니다.</p></div></div>
    </section>
</details>
  </section>;
}
