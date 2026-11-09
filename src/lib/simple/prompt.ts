import { teacherPayAssumptions, teacherPriceNote } from './teacher-pay.ts';
import { ageAt } from '../finance/cashflow-validation.ts';
import { isCalendarDate } from '../profile-validation.ts';
import { reviewedQuestion } from '../ai/prompt-privacy.ts';
import { formatWonAsKoreanCurrency } from './currency.ts';
import type { PromptSettings } from '../ai/prompt-input.ts';
import type { SimpleInputs } from './model.ts';
import { schemeNames } from './model.ts';
import { validateSimpleProfile, moneyWon } from './validation.ts';
import { calculateSimple, type SimpleAmount } from './calculation.ts';
import { simpleConfig } from './config.ts';
import { receiptTaxNotes } from './account-receipt.ts';
import { calculateRetirementAnalysis } from './retirement-analysis.ts';
import { generateRetirementAdvice } from './retirement-advice.ts';
import { simplePromptContext } from './prompt-context.ts';
export const simpleAnalyses = {
  comprehensive: '은퇴설계 종합 분석', comparison: '명예퇴직·정년퇴직 관련 조언', gap: '공적연금 및 퇴직급여 분석',
  ktcu: '교직원공제회 수령 전략', irp: 'IRP·연금저축 활용 전략', custom: '직접 질문 작성',
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
  const money = (n: number | null) => formatWonAsKoreanCurrency(n, '미입력 또는 계산 불가', settings.money === 'range' ? 'range' : undefined);
  const date = (d: string | null) => !d || !isCalendarDate(d) ? '추가 확인 필요' : !settings.anonymize && settings.allowExactDates ? d :
    `${settings.anonymize ? `${Math.floor(ageAt(p.birthDate, d) / 5) * 5}~${Math.floor(ageAt(p.birthDate, d) / 5) * 5 + 4}세` : `만 ${ageAt(p.birthDate, d)}세`} 시점 (정확한 날짜 제외)`;
  const amount = (name: string, a: SimpleAmount) => `${name}: ${money(a.amountWon)} / ${a.confidence}${a.amountWon === null ? ` / ${a.errors.join(' ')}` : ''}`;
  const currentAge = ageAt(p.birthDate, today), question = reviewedQuestion(settings);
  const context = simplePromptContext(input, r);
  const inputMoney = (label: string, raw: string | undefined) => {
    if (raw === undefined || raw === '') return `${label}: [미입력]`;
    const parsed = moneyWon(raw);
    return `${label}: [사용자 입력값] ${parsed.error ? '[계산 불가] ' + parsed.error : money(parsed.won)}`;
  };
  const military = { approved: '산입 승인 완료로 사용자 입력·소급기여금 완납 확인 아님', not: '산입하지 않음', unknown: '확인 필요' };

  const lines = [
    `1. 역할과 목적\n교사 은퇴설계 검토자로서 '${simpleAnalyses[settings.analysis as keyof typeof simpleAnalyses] ?? simpleAnalyses.comprehensive}'을 수행해 주세요.`,
    `2. 기본 조건\n가입 제도: ${schemeNames[p.scheme]}\n현재 연령: ${settings.anonymize ? `${Math.floor(currentAge / 10) * 10}대` : `만 ${currentAge}세`}\n임용 시점: ${settings.anonymize ? `${p.appointmentDate.slice(0, 4)}년 (정확한 날짜 제외)` : date(p.appointmentDate)}\n현재 ${p.step}호봉 / 승급월 ${p.promotionMonth}월\n군복무 관련 상태: ${p.scheme === 'national' ? '국민연금 군복무 크레딧 별도 확인·공무원 산입 상태 적용 안 함' : military[p.military]}`,
    `3. 퇴직 조건\n방식: ${p.retirement === 'early' ? '명예퇴직' : '정년퇴직'} / 퇴직 ${date(r.retirement.date)} / 정년 ${date(r.retirement.normal)}\n퇴직 호봉 참고: ${r.step ?? '계산 불가'}호봉 (조건부·제한 없는 정기승급 가정, 실제 발령 아님)\n정년 자동 날짜는 일반 초·중등 62세·학기말 가정이며 사립·대학 등은 기관 확인 필요. 명퇴 자격과 실제 선정은 별개.`,
    `4. 공적연금과 퇴직급여\n${amount('월 공적연금 (자산 합산 제외)', r.pension)} / ${r.pensionSource === 'teacher-model' ? `세전 · ${r.pensionDetails.priceYear}년 개시 명목 가정` : r.pensionSource !== 'quote' ? '세전 · 2026년 가격 고정' : q.pension.taxBasis === 'net' ? '입력액 세후' : q.pension.taxBasis === 'gross' ? '세전' : '세금 기준 미입력'}\n지급개시 ${date(r.pensionStartDate)}\n정상 개시연령 ${r.pensionDetails.normalAge === null ? '경과규정 추가 확인 필요' : '만 ' + r.pensionDetails.normalAge + '세'} / 정상 수급조건 충족 ${date(r.pensionDetails.normalStartDate)}\n퇴직 후 연금 전 소득 공백 ${r.pensionGapMonths === null ? '개시일 확인 필요' : r.pensionGapMonths + '개월(완료 월) · ' + r.pensionGapDays + '일'}\n공적연금 출처 ${r.pensionSource !== 'quote' ? '웹앱 자동 추정 · 외부 금액 검증 미완료' : '사용자 직접 입력 조회액 · 기관 진위 미검증'}\n자동 추정 방법 ${r.pensionDetails.method} / 계산 기준 ${r.pensionDetails.priceYear}년 / 자료 확인 ${r.pensionDetails.checkedOn.slice(0,4)}년 ${r.pensionDetails.checkedOn.slice(5,7)}월 (정확한 날짜 제외)\n공식 산식 구조 ${r.pensionDetails.formula}\n재직·가입 구간 ${r.pensionDetails.periods.map(x => x.label + ' ' + x.months + '개월').join(' / ')}\n가정·한계 ${r.pensionDetails.notes.join(' ')}\n조기 가능성과 선택 구분 ${r.pensionDetails.earlyNote}\n추가 확인 사항 ${r.pension.errors.join(' ') || '소득 자료·개인별 경과규정·공단 실제 예상액 대조 필요'}\n${amount('퇴직수당 (일시금)', r.allowance) + ' / ' + r.allowanceDetails.basis + ' / 산식 ' + r.allowanceDetails.formula}\n${p.retirement === 'early' ? amount('명예퇴직수당 (일시금)', r.honorary) + ' / ' + r.honoraryDetails.basis + ' / 산식 ' + r.honoraryDetails.formula : '명예퇴직수당: 정년 선택으로 대상에서 제외'}\n별도 2026 가격 고정·개인 입력 소득 경로 수당 합계 ${money(r.benefitsTotal)} (이 경로의 소득 미입력 시 계산 불가; 아래 화면 참고 합계와 구분)\n공식 조회값은 사용자가 직접 입력한 값이며 앱이 기관 조회·진위를 검증하지 않음. 자동 추정과 조회액을 구분할 것. 국민연금은 퇴직 전 개시가 가능하나 소득활동 감액·지급정지·개인별 경과규정은 별도 공단 확인이 필요함. 퇴직 전 수령액을 자산에 더하지 말 것.`,
    `5. 교직원공제회\n${amount('퇴직 시 적립금', r.ktcu)}\n수령: ${input.ktcu.split ? `가정 기반 분할 수령 ${input.ktcu.years}년, 매월 25일 / 월 ${money(r.split?.monthlyWon ?? null)} / 총 ${money(r.split?.totalWon ?? null)} (공식 상품 금액 아님)` : '일시금'}\n연 ${simpleConfig.ktcuRate}%를 미래에도 유지하는 가정. 세금·가입 최소 금액·승인·실제 전환일·끝수 처리 미검증. 일시금과 분할 지급 합계를 더하지 말 것.`,
    `6. IRP·연금저축\n${amount('퇴직 IRP 적립금', r.irp)} / 가정 연 ${simpleConfig.irpRate}%\n${amount('퇴직 연금저축 적립금', r.saving)} / 가정 연 ${simpleConfig.savingRate}%\n계좌 합산 ${money(r.accountsTotal)}\n납입 주기: IRP ${input.irp.cycle === 'yearly' ? '12월 말 연납' : '매월 말 월납'}, 연금저축 ${input.saving.cycle === 'yearly' ? '12월 말 연납' : '매월 말 월납'}\n환급 재투자 ${input.reinvest ? r.reinvestError || ('조건부 가정으로 IRP에 반영 / 추가 효과 ' + money(r.reinvestEffect) + ' / 13.2% 공제 효과 계획 가정·다음 해 5월 말 재투자·충분한 세액 여력 가정·개인별 실제 환급 미확인·환급 보장 아님') : '미선택·효과 미반영'}\n납입한도 검사는 입력된 향후 납입 계획의 연도별 합계만 확인하며 올해 기납입·다른 계좌·특례·실제 잔여한도를 확정하지 않음. 세금·수수료·환율 미반영이며 원금손실 가능.`,
    `7. 종합과 계산 한계\n퇴직 시 주요 적립금 합계 ${money(r.accumulationTotal)} (공제회+IRP+연금저축만, 월연금·분할 총수령액 제외)\n금액 기준: 공제회는 ${date(r.lastCalculatedDate)}까지 완료 월 계산. 연금계좌는 실제 월말/연말 납입과 퇴직일까지 ACT/ACT 복리 적용. 설정 ${simpleConfig.version}.\n선택 생활비·계산 가능한 월액 비교와 규칙 기반 조언을 반영함. 근로소득·연금계좌 월 인출·완전한 현금흐름은 미반영. 동일 시점과 동일 세전/세후 기준 없이 명퇴/정년의 최종 유불리를 확정하지 말 것.`,
  ];
  const allowanceReference = r.allowanceReference;
  lines[3] += `\n04·05와 동일한 참고 결과 · ${r.benefitReference.priceYear}년 ${r.benefitReference.source==='teacher-model'?'미래 명목':'가격 고정'} · 세전\n` + r.benefitReference.rows.map(s=>`${s.label}: ${p.retirement==='early'?'명예퇴직수당 '+money(s.honoraryWon)+' / ':''}퇴직수당 ${money(s.allowanceWon)}${p.retirement==='early'?' / 참고 합계 '+money(s.combinedWon):''}`).join('\n') + '\n민감도 분석에 따른 참고 추정이며 확정 지급액이 아닙니다.';
  if (allowanceReference.rows.length) lines[3] += '\n퇴직수당 참고 시뮬레이션 (개인 공식 예상액 아님)\n' + allowanceReference.rows.map(x => x.label + ' / 기준소득월액 ' + money(x.income) + ' / 전체액 ' + money(x.amountWon) + ' / 동일2026기준 세전 참고 합계 ' + money(x.combinedWon) + ' / 2009년 이전 ' + x.oldMonths + '개월·2010년 이후 ' + x.newMonths + '개월 / 이후분 참고 소계 ' + money(x.postWon)).join('\n') + '\n' + allowanceReference.oldReason + '\n' + allowanceReference.notes + '\n기존 개인 소득 기반 수당 합계에 참고 시나리오를 자동 합산하지 않았습니다.';
  if (input.profile.scheme === 'civil' && input.profile.teacherModel !== false) lines[3] += '\n교원 보수 경로 시뮬레이션\n' + teacherPayAssumptions + '\n' + teacherPriceNote + '\n퇴직연도 미래 명목 기본봉급 ' + money(r.teacherPay.finalSalaryWon) + '\n' + r.teacherPension.rows.map(s=>s.label + ' 월연금 ' + money(s.estimate.amountWon) + ' (' + s.estimate.priceYear + '년 개시 명목) / 2026 보수수준 환산 ' + money(s.basis2026Won)).join('\n') + '\n' + r.teacherPension.errors.join(' ') + '\n' + r.teacherBenefits.rows.map(s=>s.label + ' 미래 명목 퇴직수당 ' + money(s.allowanceWon) + ' / 명퇴수당 ' + money(s.honoraryWon) + ' / 동일 가정 기준 세전 참고 합계 ' + money(s.combinedWon)).join('\n') + '\n' + r.teacherBenefits.notes + '\n' + r.teacherBenefits.errors.join(' ');
  const statusLines = context.rows.map(x => x.label + ': [' + x.inputState + '] / [' + x.state + '] / ' + money(x.amountWon) + ' (' + x.unit + ') / ' + x.confidence + ' / [' + x.review + ']' + (x.amountWon === null ? ' / ' + x.reasons.join(' ') : ''));
  lines[0] += '\n입력 상태·계산 신뢰도\n' + statusLines.join('\n') + '\n공식 조회값은 사용자 입력 출처이며 앱이 기관 진위를 검증한 값이 아닙니다. 법령 기반 추정값도 실제 지급액 검증 완료를 뜻하지 않습니다. 미입력·계산 불가를 실제 0원과 구분하세요.';
  if (context.basicOnly) lines[0] += '\n현재는 01 기본정보 중심입니다. 현재 경력 단계의 은퇴 준비 방향, 명퇴·정년 고려사항, 공적연금 개시 조건, 필요한 소득·기관 조회자료와 은퇴설계 정보를 우선 안내하세요. 02~05 입력은 생성 요건이 아닙니다. 제공된 교원 보수 기반 가정 시뮬레이션과 미확인을 구분하고 새 자산·월연금·근로소득을 만들어내지 마세요.';
  lines[4] += '\n' + inputMoney('공제회 현재 적립금', input.ktcu.balance) + '\n' + inputMoney('공제회 월 납입액', input.ktcu.monthly);
  lines[5] += '\n' + (['irp','saving'] as const).map(key => {
    const a = input[key], title = key === 'irp' ? 'IRP' : '연금저축';
    return inputMoney(title + ' 현재 적립금', a.balance) + '\n' + inputMoney(title + (a.cycle === 'yearly' ? ' 연 납입액 (12월 말 연납)' : ' 월 납입액 (매월 말 월납)'), a.cycle === 'yearly' ? a.annual : a.monthly);
  }).join('\n');
  if (q.income) lines[3] += '\n' + inputMoney('퇴직수당용 기준소득월액', q.income);
  if (vHasIncome()) lines[3] += '\n공적연금 기초 소득 (사용자가 공단 자료로 입력한 값의 진위는 미검증)\n' + [
    inputMoney('공적연금 적용 소득', q.pensionEstimate!.incomeMode === 'current' ? q.pensionEstimate!.currentIncome : q.pensionEstimate!.averageIncome),
    ...(p.scheme !== 'national' ? [ ...(r.pensionDetails.periods[0]?.months ? [inputMoney('구기간 평균보수월액', q.pensionEstimate!.legacyIncome)] : []), ...(r.pensionDetails.periods[2]?.months ? [inputMoney('소득재분배 반영 평균소득', q.pensionEstimate!.redistributedIncome)] : []) ] : []),
  ].join('\n');
  if (r.pensionSource !== 'quote' && r.pension.amountWon !== null && p.scheme !== 'national' && q.pensionEstimate) lines[3] += '\n사용자 확인 적용비율 ' + q.pensionEstimate.factorPercent + '% (개인별 진위 미검증)';
  if (r.pensionSource === 'quote') lines[3] += '\n직접 입력 경로 선택: 유효한 조회/사용자 추정 월액을 우선하고 검증 실패 시 금액을 사용하지 않습니다. 위 자동 추정 산식·일반 정상 개시조건은 별도 참고 경로이며 해당 조회액의 산출 근거로 간주하지 마세요.';
  function vHasIncome() { const v=q.pensionEstimate; return r.pensionSource !== 'quote' && !!v && (v.incomeMode === 'current' ? v.currentIncome : v.averageIncome) !== ''; }
  lines.splice(6, 0, '6-1. 연금계좌 수령 조건 (2026년 세법 기준, 조건부)\n' + (['irp','saving'] as const).map(key => {
    const a = r.accountReceipts[key], v = input[key].receipt;
    return [key === 'irp' ? 'IRP' : '연금저축',
      '최초 계좌 가입일 ' + date(v?.openedDate ?? null),
      '만 55세 도달 ' + date(a.age55Date) + ' / 가입 5년 충족 ' + date(a.fiveYearDate),
      '연령·기간 요건 충족 예상 ' + date(a.eligibleDate) + ' / ' + a.status,
      '5년 예외 ' + (a.exceptionApplied ? '실제 이연퇴직소득 보유를 사용자가 확인하여 조건부 적용' : '미적용') + ' / 재원 상태 ' + (v?.deferred === 'confirmed' ? '사용자 확인 (기관 진위 미검증)' : v?.deferred === 'no' ? '개인 납입금·수익만 있다고 입력' : '미확인'),
      '개시 신청 ' + date(v?.applicationDate ?? null) + ' / 조건 충족은 실제 신청·지급 보장이 아님',
      '한도 계산 과세연도 ' + (a.taxYear ?? '미확인') + ' / 한도용 연차 ' + (a.receiptYear ?? '미확인') + ' / 연간 한도 ' + (a.unlimited ? '11년차 이상 계산식 미적용 (세금·잔액 제약은 유지)' : money(a.limitWon)),
      '한도용 평가 기준일 ' + date(v?.referenceDate ?? null) + ' / 기준액 ' + money(moneyWon(v?.referenceValue ?? '').won),
      '예상 세전 인출액(한도 산입분) ' + money(a.withdrawalWon) + ' / 한도 이내 ' + money(a.withinWon) + ' / 초과 연금외수령 ' + money(a.excessWon),
      '금융기관 확인 실제 수령연차 ' + (v?.actualReceiptYears || '미확인') + ' / 퇴직소득세 적용비율 ' + (a.deferredPercent === null ? '미확인' : a.deferredPercent + '% (연금외수령 퇴직소득세 대비)'),
      '공적연금 전 공백 활용: ' + a.bridge + ' / 검토 시작 ' + date(a.bridgeStart),
      '추가 확인 ' + [...a.errors, ...a.limitErrors, ...a.taxErrors].join(' '),
    ].join('\n');
  }).join('\n\n') + '\n' + receiptTaxNotes.join(' ') + '\n퇴직수당·명퇴수당은 IRP에 자동 합산하지 않았고 이체 자격을 판정하지 않음. 적립금은 인출 없이 퇴직일까지 납입하는 기존 시나리오이며 신청 이후 납입 제한·실제 인출은 반영하지 않음. 예상 적립금 전액을 소득 공백 충당액으로 사용하지 말 것. 정확한 세후액·생활비 충당액은 별도 계산 필요.');
  const strategy = calculateRetirementAnalysis(input, r);
  const safeAdviceText = (text: string) => text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, value => date(value));
  const advice = generateRetirementAdvice(input, r, strategy, money);
  lines.splice(7, 0, [
    '6-2. 은퇴설계 종합 분석 (규칙 기반·조건부)',
    '희망 월 생활비 ' + money(strategy.expenseWon) + ' / 미입력은 0원 아님',
    '공적연금 전 공백 ' + (strategy.gapMonths === null ? '미확인' : strategy.gapMonths + '개월(완료 월)·' + strategy.gapDays + '일'),
    '일시 수령 검토 재원 ' + strategy.lumpItems.map(x => x.label + ' ' + money(x.won)).join(' / ') + ' (지급·세금 미확정)',
    '공제회 분할 가상 일정: ' + (strategy.split.selected ? strategy.split.years + '년 / 정기 월 ' + money(strategy.split.monthlyWon) + ' / 첫 지급 ' + date(strategy.split.first) + ' / 마지막 ' + date(strategy.split.last) + ' / 개시 전 ' + (strategy.split.beforeCount ?? '미확인') + '회·개시 후 ' + (strategy.split.afterCount ?? '미확인') + '회 / 잔액 비교 기준 ' + date(strategy.split.balanceSnapshotDate) + ' / 기준일 직전 가상 누적 지급 ' + money(strategy.split.paidBeforeStartWon) + ' / 지급 후 남은 가상 잔액 ' + money(strategy.split.balanceAtPublicStartWon) : '일시금 선택·분할 월액 미반영'),
    ...strategy.windows.map(w => (w.phase === 'before' ? '공적연금 개시 전' : w.phase === 'after' ? '공적연금 개시 후' : '구간 미확인') + ' / ' + w.label + ' / ' + date(w.from) + ' ~ ' + (w.until ? date(w.until) : '이후') + ' / 월액 소계 ' + money(w.subtotalWon) + ' / ' + (w.tax === 'gross' ? '세전' : w.tax === 'net' ? '입력 세후' : '세금 기준 미확인') + ' / 생활비 대비 선택자료 차이 ' + (w.differenceWon === null ? '보류' : (w.differenceWon < 0 ? '부족 방향 ' : '잔여 방향 ') + money(Math.abs(w.differenceWon))) + ' (실제 부족액·잉여액 아님) / ' + w.missing.join('·')),
    '위 월액은 구간별 지급 수준이며 구간 전체 평균·실제 세후 수입 아님. 일시금·월연금을 혼합하거나 공제회 일시금·분할을 중복 합산하지 말 것. IRP·연금저축 인출은 미설계이며 한도용 연간 입력액을 월수입으로 만들지 말 것. 인출을 설계하면 지급액만큼 잔액 차감 필요. 총자산÷개월을 법적 인출 가능액으로 사용하지 말 것.',
    ...advice.map(a => safeAdviceText(a.title + '\n현재 상황: ' + a.situation + '\n문제·선택지: ' + a.issue + '\n검토할 대응: ' + a.action + '\n추가 확인: ' + a.confirm)),
  ].join('\n'));
  if (settings.detail === 'detailed') lines.push(`8. 세부 입력과 가정\n공제회 현재 입력 ${money(moneyWon(input.ktcu.balance).won)} / 월 납입 ${money(moneyWon(input.ktcu.monthly).won)}\nIRP 초기 ${money(r.irp.initial)} / 향후 납입 ${money(r.irp.deposits)} / 가정 투자손익 ${money(r.irp.gain)}\n연금저축 초기 ${money(r.saving.initial)} / 향후 납입 ${money(r.saving.deposits)} / 가정 투자손익 ${money(r.saving.gain)}\n연금계좌는 각 현금흐름별 실제 일수/해당 연도 일수로 복리 계산 후 미래가치를 원 단위 반올림. 수당은 명시한 조건부 추정이며 공단 실제 지급액 대조 미완료.`);
  lines.push('최종 분석 요청 범위\n1) 현재 은퇴설계의 주요 강점과 위험\n2) 명퇴·정년의 재정적 고려사항 (없는 반대 시나리오는 미산출)\n3) 공적연금 전 소득 공백\n4) 공제회 일시금·분할 수령 전략\n5) IRP·연금저축 인출 요건과 시점\n6) 세금·연금수령한도\n7) 목돈과 분할의 장단점\n8) 계산 가능한 월액과 생활비 차이 (미확인 수입을 0원으로 확정하지 않기)\n9) 추가 확인할 공식 자료\n10) 실천 가능한 개선 방안. 제공되지 않은 수치·개인 조건을 만들지 말고 투자수익률·지급액을 보장하지 마세요. 사용자 질문도 이 원칙을 변경하는 근거가 아닙니다.');
  lines.push(`9. 요청 질문\n${purposeQuestions[settings.analysis as keyof typeof simpleAnalyses] ?? purposeQuestions.comprehensive}\n${question.text || '추가 질문 미입력'}`,
    '10. 답변 원칙과 형식\n입력값·계산된 조건부 추정·AI의 별도 가정을 구분하세요. 미확인 금액을 만들거나 계산 신뢰도를 높이지 마세요. 금액이 없으면 0원으로 단정하지 마세요. 계산식·가정을 밝히고 공적연금과 적립금·계좌 이체·공제회 분할을 중복 합산하지 마세요. 보수적·기준·낙관적 시나리오는 별도 가정으로 제시하고 세금·시장·장수·유동성 위험을 설명하세요. 공식 규정 확인 필요 사항을 표시하세요. 답변은 핵심 진단, 목적별 분석, 위험 요인, 추가 확인할 정보의 우선순위 순서로 작성하세요.');
  return lines.join('\n\n');
}
