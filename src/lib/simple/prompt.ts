import { ageAt } from '../finance/cashflow-validation.ts';
import { isCalendarDate } from '../profile-validation.ts';
import { displayPromptMoney, reviewedQuestion } from '../ai/prompt-privacy.ts';
import type { PromptSettings } from '../ai/prompt-input.ts';
import type { SimpleInputs } from './model.ts';
import { schemeNames } from './model.ts';
import { validateSimpleProfile, moneyWon } from './validation.ts';
import { calculateSimple, type SimpleAmount } from './calculation.ts';
import { simpleConfig } from './config.ts';
export const simpleAnalyses = {
  comprehensive: '나의 은퇴설계 종합 분석', comparison: '명예퇴직·정년퇴직 관련 조언', gap: '공적연금 및 퇴직급여 분석',
  ktcu: '교직원공제회 수령 전략', irp: 'IRP·연금저축 투자 전략', custom: '직접 질문 작성',
} as const;
const purposeQuestions: Record<keyof typeof simpleAnalyses, string> = {
  comprehensive: '입력한 은퇴설계의 강점·누락·우선 보완사항을 종합 검토해 주세요.',
  comparison: '명예퇴직과 정년퇴직의 재정적 장단점과 연금 개시 전 소득 공백을 검토하되, 제공되지 않은 반대 시나리오의 급여·자산을 임의 산출하지 마세요.',
  gap: '제도별 공적연금 개시 조건과 퇴직수당·명퇴수당의 확인 사항을 구분하고 추가 공식 조회의 우선순위를 알려 주세요.',
  ktcu: '교직원공제회 일시금과 가상 분할의 유동성·금리·가입 조건을 비교하고 공식 상품 결과와 시뮬레이션의 차이를 설명해 주세요.',
  irp: 'IRP·연금저축의 고정 가정 수익률·세금·수수료·환율·원금손실 위험과 세액공제 환급 재투자 조건을 검토해 주세요.',
  custom: '아래 검토된 직접 질문에 제공된 입력과 계산 결과의 범위 안에서 답해 주세요.',
};
export function generateSimplePrompt(input: SimpleInputs, settings: PromptSettings, today: string): string | null {
  if (validateSimpleProfile(input.profile, today).length) return null;
  const r = calculateSimple(input, today), p = input.profile, q = input.benefits[p.scheme];
  const money = (n: number | null) => n === null ? '미입력 또는 계산 불가' : displayPromptMoney(n, settings.money);
  const date = (d: string | null) => !d || !isCalendarDate(d) ? '추가 확인 필요' : !settings.anonymize && settings.allowExactDates ? d :
    `${settings.anonymize ? `${Math.floor(ageAt(p.birthDate, d) / 5) * 5}~${Math.floor(ageAt(p.birthDate, d) / 5) * 5 + 4}세` : `만 ${ageAt(p.birthDate, d)}세`} 시점 (정확한 날짜 제외)`;
  const amount = (name: string, a: SimpleAmount) => `${name}: ${money(a.amountWon)} / ${a.confidence}${a.amountWon === null ? ` / ${a.errors.join(' ')}` : ''}`;
  const currentAge = ageAt(p.birthDate, today), question = reviewedQuestion(settings);
  const military = { approved: '산입 승인 완료로 사용자 입력·소급기여금 완납 확인 아님', not: '산입하지 않음', unknown: '확인 필요' };
  const tax = (basis: string) => basis === 'gross' ? '세전' : basis === 'net' ? '입력액 세후' : '세금 기준 미입력';
  const quoteMeta = (kind: 'pension' | 'allowance' | 'honorary') => ' / ' + tax(q[kind].taxBasis) + ' / 조회 ' + date(q[kind].queryDate) + ' / 가정 퇴직 ' + date(q[kind].retirementDate);
  const lines = [
    `1. 역할과 목적\n교사 은퇴설계 검토자로서 '${simpleAnalyses[settings.analysis as keyof typeof simpleAnalyses] ?? simpleAnalyses.comprehensive}'을 수행해 주세요.`,
    `2. 기본 조건\n가입 제도: ${schemeNames[p.scheme]}\n현재 연령: ${settings.anonymize ? `${Math.floor(currentAge / 10) * 10}대` : `만 ${currentAge}세`}\n임용 시점: ${settings.anonymize ? `${p.appointmentDate.slice(0, 4)}년 (정확한 날짜 제외)` : date(p.appointmentDate)}\n현재 ${p.step}호봉 / 승급월 ${p.promotionMonth}월\n군복무 관련 상태: ${p.scheme === 'national' ? '국민연금 군복무 크레딧 별도 확인·공무원 산입 상태 적용 안 함' : military[p.military]}`,
    `3. 퇴직 조건\n방식: ${p.retirement === 'early' ? '명예퇴직' : '정년퇴직'} / 퇴직 ${date(r.retirement.date)} / 정년 ${date(r.retirement.normal)}\n퇴직 호봉 참고: ${r.step ?? '계산 불가'}호봉 (조건부·제한 없는 정기승급 가정, 실제 발령 아님)\n정년 자동 날짜는 일반 초·중등 62세·학기말 가정이며 사립·대학 등은 기관 확인 필요. 명퇴 자격과 실제 선정은 별개.`,
    `4. 공적연금과 퇴직급여\n${amount('월 공적연금 (자산 합산 제외)', r.pension)} / ${q.pension.taxBasis === 'net' ? '입력액 세후' : q.pension.taxBasis === 'gross' ? '세전' : '세금 기준 미입력'}\n지급개시 ${r.pension.amountWon === null ? '제도·개인별 조건 확인 필요' : date(q.pension.startDate)}\n${amount('퇴직수당 (일시금)', r.allowance) + quoteMeta('allowance')}\n${p.retirement === 'early' ? amount('명예퇴직수당 (일시금)', r.honorary) + quoteMeta('honorary') : '명예퇴직수당: 정년 선택으로 대상에서 제외'}\n수당 합계 ${money(r.benefitsTotal)} (누락 또는 세금 기준 불일치 시 합산 불가)\n공식 조회값은 사용자가 직접 입력한 값이며 앱이 기관 조회·진위를 검증하지 않음.`,
    `5. 교직원공제회\n${amount('퇴직 시 적립금', r.ktcu)}\n수령: ${input.ktcu.split ? `가정 기반 분할 수령 ${input.ktcu.years}년, 매월 25일 / 월 ${money(r.split?.monthlyWon ?? null)} / 총 ${money(r.split?.totalWon ?? null)} (공식 상품 금액 아님)` : '일시금'}\n연 5%를 미래에도 유지하는 가정. 세금·가입 최소 금액·승인·실제 전환일·끝수 처리 미검증. 일시금과 분할 지급 합계를 더하지 말 것.`,
    `6. IRP·연금저축\n${amount('퇴직 IRP 적립금', r.irp)} / 가정 연 7%\n${amount('퇴직 연금저축 적립금', r.saving)} / 가정 연 8%\n계좌 합산 ${money(r.accountsTotal)}\n환급 재투자 ${input.reinvest ? '선택했으나 소득·결정세액·실제 환급·추가 납입한도 확인이 없어 효과 미반영 (0원 확정 아님)' : '미선택·효과 미반영'}\n세금·수수료·환율 미반영이며 원금손실 가능.`,
    `7. 종합과 계산 한계\n퇴직 시 주요 적립금 합계 ${money(r.accumulationTotal)} (공제회+IRP+연금저축만, 월연금·분할 총수령액 제외)\n금액 기준: ${date(r.lastCalculatedDate)}까지 완료 월 계산 후 퇴직일까지 추가 납입·수익 없음 가정. 설정 ${simpleConfig.version}.\n생활비·근로소득·은퇴 후 인출·완전한 현금흐름은 이 간편 버전에 없음. 동일 시점과 동일 세전/세후 기준 없이 명퇴/정년의 최종 유불리를 확정하지 말 것.`,
  ];
  if (settings.detail === 'detailed') lines.push(`8. 세부 입력과 가정\n공제회 현재 입력 ${money(moneyWon(input.ktcu.balance).won)} / 월 납입 ${money(moneyWon(input.ktcu.monthly).won)}\nIRP 초기 ${money(r.irp.initial)} / 향후 납입 ${money(r.irp.deposits)} / 가정 투자손익 ${money(r.irp.gain)}\n연금저축 초기 ${money(r.saving.initial)} / 향후 납입 ${money(r.saving.deposits)} / 가정 투자손익 ${money(r.saving.gain)}\n월 이율 (1+연 수익률)^(1/12)-1, 수익 반영 후 월 납입, 원 단위 반올림. 공식 연금·퇴직급여 자동 산식 미검증.`);
  lines.push(`9. 요청 질문\n${purposeQuestions[settings.analysis as keyof typeof simpleAnalyses] ?? purposeQuestions.comprehensive}\n${question.text || '추가 질문 미입력'}`,
    '10. 답변 원칙과 형식\n입력값·계산된 조건부 추정·AI의 별도 가정을 구분하세요. 미확인 금액을 만들거나 계산 신뢰도를 높이지 마세요. 금액이 없으면 0원으로 단정하지 마세요. 계산식·가정을 밝히고 공적연금과 적립금·계좌 이체·공제회 분할을 중복 합산하지 마세요. 보수적·기준·낙관적 시나리오는 별도 가정으로 제시하고 세금·시장·장수·유동성 위험을 설명하세요. 공식 규정 확인 필요 사항을 표시하세요. 답변은 핵심 진단, 목적별 분석, 위험 요인, 추가 확인할 정보의 우선순위 순서로 작성하세요.');
  return lines.join('\n\n');
}
