import type { SimpleInputs } from './model.ts';
import type { SimpleResults } from './calculation.ts';
import type { RetirementAnalysis } from './retirement-analysis.ts';
import { formatWonAsKoreanCurrency } from './currency.ts';
export type RetirementAdvice = { id: string; title: string; situation: string; issue: string; action: string; confirm: string };
/** Deterministic guidance only. It never creates a benefit amount, return, withdrawal or allocation. */
export function generateRetirementAdvice(input: SimpleInputs, r: SimpleResults, a: RetirementAnalysis, formatAmount: (n: number | null, empty?: string) => string = formatWonAsKoreanCurrency): RetirementAdvice[] {
  const won = formatAmount;
  const result: RetirementAdvice[] = [];
  result.push({ id:'gap', title: !a.validTiming ? '공적연금 개시 조건부터 확인하세요' : a.gapDays === 0 ? '퇴직 전후 연금 지급 흐름을 확인하세요' : '공적연금 전 소득 공백을 먼저 준비하세요',
    situation: `퇴직 ${a.retirement ?? '미확인'} · 퇴직 연령 ${a.retirementAge === null ? '미확인' : '만 '+a.retirementAge+'세'}. ` + (!a.validTiming ? '연금 개시일이 미확인입니다.' : a.gapDays === 0 ? (a.publicStart! < a.retirement! ? '공적연금이 퇴직 전에 이미 개시되어 퇴직 후 개시 전 공백은 0입니다.' : '공적연금이 퇴직일에 개시되어 퇴직 후 개시 전 공백은 0입니다.') : `${input.profile.retirement === 'early' ? '명예퇴직 후 ' : '퇴직 후 '}${a.gapMonths}개월(완료 월)·${a.gapDays}일의 개시 전 기간이 있습니다.`),
    issue: '수급조건 충족일·지급대상월·실제 입금일과 월액의 확정 여부가 다릅니다.',
    action: a.validTiming && a.gapDays === 0 ? '첫 입금일과 생활비 결제일 차이, 재취업 감액 등을 검토하세요.' : '공백 기간의 생활비와 단기 지출을 먼저 정리하고 수령 시점이 맞는 재원을 검토하세요.',
    confirm: `공단 실제 지급일·개인별 감액·세금 확인이 필요합니다. ${r.pensionSource === 'automatic' ? '자동 월액은 외부 금액 검증 미완료입니다.' : '직접 입력 조회값의 진위를 앱이 검증하지 않습니다.'}` });
  result.push({ id:'ktcu', title: a.split.selected ? '선택한 공제회 분할기간과 공백을 비교하세요' : '공제회 일시금의 사용 순서를 정하세요',
    situation: a.split.selected ? a.split.valid ? `${a.split.years}년 분할 가정 · 정기 월 ${won(a.split.monthlyWon)} · ${a.split.first}~${a.split.last}.` : '분할을 선택했으나 월액·기간을 계산할 자료가 부족합니다.' : `공제회 일시금 예상 ${won(r.ktcu.amountWon, '미확인')}.`,
    issue: a.split.selected ? a.split.afterCount === null ? '공적연금 개시 전후 지급 횟수를 아직 비교할 수 없습니다.' : `공적연금 개시 전 ${a.split.beforeCount}회, 퇴직 이후 개시 후 ${a.split.afterCount}회가 가상 일정에 포함됩니다. 첫 지급 전과 분할 종료 후에는 이 월액이 없습니다.` : '목돈은 정기 월수입과 다르며 한 번 사용한 금액을 다시 사용할 수 없습니다.',
    action: a.split.selected ? '지원되는 5·10·15·20·25·30년 선택 범위에서 공백 중 지급 일정과 종료 후 재원을 비교하세요. 공백 길이에 맞춰 임의 상품 기간을 만들지 않습니다.' : '공백 생활비·비상예비자금·장기 투자 재원의 용도를 나누어 검토하세요.',
    confirm: '전체 세전 적립금을 사용하는 가상 분할입니다. 실제 전환 가능 세후액·가입 조건·지급률·첫 25일·최종 정산은 공제회 확인이 필요하며 일시금과 중복 합산하지 않습니다.' });
  result.push({ id:'accounts', title:'IRP·연금저축은 수령 조건과 유동성을 나눠 보세요',
    situation: a.accounts.map(x => `${x.title} ${won(x.balanceWon, '미확인')} · 요건 ${x.receipt.eligibleDate ?? '가입기간 등 미확인'} · ${x.eligibleAtRetirement === null ? '판정 보류' : x.eligibleAtRetirement ? '퇴직일 연령·기간 요건 충족 예상' : '퇴직일 요건 미충족'}`).join(' / '),
    issue: '55세 도달이나 큰 적립금만으로 전액을 즉시 인출할 수 있다고 볼 수 없습니다. 연간 한도 검토용 인출 입력은 월수입으로 환산하지 않았습니다.',
    action: '두 계좌의 요건 충족일을 비교하고, 공백 중 개시를 검토할 계좌는 03에서 신청일·한도용 평가액을 확인하세요. 인출을 설계한다면 지급액을 잔액에서 차감하는 현금흐름이 필요합니다.',
    confirm: '가입일·실제 이연퇴직소득·재원별 공제 이력·연금수령한도·세금 확인 필요. 공제 납입금과 운용수익의 연금외수령은 일반적으로 16.5% 기타소득세이며 과세제외 원금·이연퇴직소득은 구분합니다. 세후액 미산출.' });
  result.push({ id:'benefits', title: a.benefitsWon === null ? '미계산 수당을 확정 재원으로 사용하지 마세요' : '퇴직급여 목돈의 용도와 위험을 함께 검토하세요',
    situation: `퇴직수당 ${won(r.allowance.amountWon, '추정 불가')} / ${input.profile.retirement === 'early' ? '명예퇴직수당 '+won(r.honorary.amountWon,'추정 불가')+' / ' : ''}세전 합계 ${won(a.benefitsWon,'합산 불가')}.`,
    issue: a.benefitsWon === null ? '누락 금액을 0원이나 받을 것이 확정된 자금으로 처리할 수 없습니다.' : '조건부 자동 추정이며 실제 선정·지급일·세금이 확정되지 않았습니다. 한 번에 투자하면 손실과 단기 인출 위험이 겹칠 수 있습니다.',
    action: '공백 생활비와 비상예비자금에 필요한 유동성, 예금 등 안정적 자산과 장기 투자자산의 역할을 비교하세요. 단기 지출 때문에 장기 투자자산을 급히 팔지 않도록 검토하세요.',
    confirm: '04의 산식·선정·개인별 지급액·세금을 확인하세요. 위험 성향과 지출 정보가 없어 특정 상품·배분 비율·수익을 확정 추천하지 않습니다. IRP 자동 이체·중복 합산도 하지 않습니다.' });
  result.push({ id:'living', title: a.expenseWon === null ? '희망 생활비를 입력하면 비교 범위를 넓힐 수 있어요' : '생활비와 계산 가능한 월액의 차이를 검토하세요',
    situation: a.expenseWon === null ? '은퇴 후 희망 월 생활비는 선택 입력이며 현재 비교 기준이 없습니다.' : `희망 월 생활비 ${won(a.expenseWon)}. 지급 시기에 따라 비교 가능한 월액이 달라집니다.`,
    issue: '근로·임대·기타수입과 IRP·연금저축 월 인출은 미반영입니다. 계산 가능한 월액 소계는 전체 수입이나 정확한 세후액이 아닙니다.',
    action: '개시 전후 그래프의 지급 구간별 소계와 생활비 차이를 참고하고, 누락 수입·세금·물가·의료비를 따로 점검하세요. 적립금÷공백개월을 실제 인출 가능액으로 사용하지 마세요.',
    confirm: '표시된 차이는 선택 자료의 산술 비교이며 확정 부족액·잉여액이 아닙니다. 분할 마지막 정산액·종료 후 소득 변화도 확인하세요.' });
  return result;
}
