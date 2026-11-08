import { isCalendarDate } from '../profile-validation.ts';
import { birthAnniversary } from './pension-dates.ts';
import { parseMoney } from '../finance/pension-input-validation.ts';

export type AccountReceiptInput = {
  openedDate: string;
  deferred: 'unknown' | 'no' | 'confirmed'; deferredDepositDate: string;
  specialHistory: boolean;
  taxYear: string; applicationDate: string; referenceDate: string; referenceValue: string;
  annualWithdrawal: string; actualReceiptYears: string;
};
export function createAccountReceiptInput(): AccountReceiptInput {
  return { openedDate: '', deferred: 'unknown', deferredDepositDate: '', specialHistory: false,
    taxYear: '', applicationDate: '', referenceDate: '', referenceValue: '', annualWithdrawal: '', actualReceiptYears: '' };
}
export const receiptSources = [
  { title: '소득세법 시행령 제40조의2~4 (요건·한도·인출순서)', url: 'https://www.law.go.kr/lumLsLinkPop.do?chrClsCd=010202&lspttninfSeq=126416' },
  { title: '소득세법 제129조 (2026 원천징수)', url: 'https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1034033989' },
  { title: '시행령 제187조의3 (실제 수령연차)', url: 'https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lspttninfSeq=126754' },
  { title: '국세청 연금소득 과세 안내', url: 'https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7888&mi=6608' },
];
export const receiptTaxNotes = [
  '세액공제 받지 않은 납입금은 증빙 확인 후 과세제외입니다. 세액공제 받은 납입금·운용수익·이연퇴직소득과 구분해야 합니다. 일반 인출순서는 과세제외 → 이연퇴직소득 → 공제 납입금·수익이며 손실·이체 이력도 확인해야 합니다.',
  '세액공제 받은 납입금·운용수익의 적격 연금수령 원천징수는 70세 미만 5.5%, 70~79세 4.4%, 80세 이상 3.3%(지방소득세 포함)입니다. 2026년부터 중도해지 불가 종신계약은 3.3%이며 중복 요건에서는 낮은 세율을 적용합니다. 이 화면에서 종신계약을 선택한 것은 아닙니다.',
  '이연퇴직소득 등 별도 분리과세분을 제외한 과세대상 사적연금소득은 전 금융기관 합산 연 1,500만원 기준을 확인해야 합니다. 초과 시 종합과세 또는 16.5% 분리과세 선택·신고가 필요할 수 있으며 원천징수로 최종 세액이 확정되지 않습니다.',
  '일반 연금외수령·한도 초과분의 공제 납입금과 운용수익은 기타소득세 16.5%(지방세 포함), 이연퇴직소득은 감면 없는 퇴직소득세가 적용됩니다. 과세제외금액은 별도이며 의료비·부득이한 인출의 증빙·기한·특례는 금융기관 확인이 필요합니다.',
  '2026년 이후 이연퇴직소득의 적격 연금수령은 실제 수령연차 10년 이하/11~20년/21년 이상에 연금외수령 퇴직소득세의 70%/60%/50%를 적용합니다. 인출액의 70%를 세금으로 내는 뜻이 아닙니다.',
  '정확한 세후액은 계산하지 않습니다. 소득·세액공제 확인서, 재원별 잔액·손실, 이연퇴직소득세, 실제 수령한 과세연도 이력, 타 계좌 과세대상 연금·다른 소득 및 계약조건이 필요합니다.',
];
export function deferredTaxPercent(actualYears: number): number | null {
  return !Number.isInteger(actualYears) || actualYears < 1 || actualYears > 100 ? null : actualYears <= 10 ? 70 : actualYears <= 20 ? 60 : 50;
}
/** Legal ceiling only; not a withdrawal schedule or an after-tax/cash balance. */
export function statutoryReceiptLimit(value: number, year: number): number | null {
  if (!Number.isSafeInteger(value) || value < 0 || !Number.isInteger(year) || year < 1 || year >= 11) return null;
  const result = BigInt(value) * 6n / (BigInt(11 - year) * 5n);
  return result > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(result);
}
export function calculateAccountReceipt(v: AccountReceiptInput, birth: string, retirement: string | null, today: string, publicStart: string | null) {
  const errors: string[] = [], limitErrors: string[] = [], taxErrors: string[] = [];
  const age55Date = birthAnniversary(birth, 55);
  if (!age55Date || birth > today) errors.push('01의 유효한 생년월일을 확인해 주세요.');
  const hasOpen = !!v.openedDate;
  const validOpen = isCalendarDate(v.openedDate) && isCalendarDate(birth) && v.openedDate > birth && v.openedDate <= today;
  if (!hasOpen) errors.push('만 55세 이후 연금수령이 가능할 수 있으나, 가입기간 충족 여부는 추가 확인이 필요합니다.');
  else if (!validOpen) errors.push('최초 계좌 가입일은 출생일 이후부터 오늘까지의 실제 가입일로 입력해 주세요.');
  const fiveYearDate = validOpen ? birthAnniversary(v.openedDate, 5) : null;
  const generalDate = age55Date && fiveYearDate ? (age55Date > fiveYearDate ? age55Date : fiveYearDate) : null;
  let exceptionDate: string | null = null;
  if (v.deferred === 'confirmed') {
    if (!validOpen || !isCalendarDate(v.deferredDepositDate) || v.deferredDepositDate < v.openedDate || v.deferredDepositDate > today) errors.push('5년 예외에는 금융기관에서 실제 이연퇴직소득 보유를 확인한 계좌의 입금일(가입일~오늘)이 필요합니다. 미래 이체 계획은 적용하지 않습니다.');
    else if (age55Date) exceptionDate = age55Date > v.deferredDepositDate ? age55Date : v.deferredDepositDate;
  }
  if (v.specialHistory || (validOpen && v.openedDate < '2001-01-01')) errors.push('승계·계좌이체·구 개인연금 등 특수 이력은 유효 가입일·기산연차·계약조건을 금융기관에 확인해야 하므로 자동 판정을 보류합니다.');
  const eligibleDate = errors.length ? null : exceptionDate && generalDate ? (exceptionDate < generalDate ? exceptionDate : generalDate) : generalDate;
  const exceptionApplied = !!eligibleDate && !!exceptionDate && !!generalDate && exceptionDate < generalDate;
  const status = !eligibleDate || !retirement ? '확인 필요' : eligibleDate <= retirement ? '퇴직일 기준 연령·기간 요건 충족 예상' : '퇴직일 기준 연령·기간 요건 미충족';
  const yearRaw = v.taxYear || retirement?.slice(0, 4) || '';
  const taxYear = /^\d{4}$/.test(yearRaw) && Number(yearRaw) >= 2026 && Number(yearRaw) <= 9900 ? Number(yearRaw) : null;
  if (!taxYear) limitErrors.push('2026년 이후의 한도 계산 과세연도를 확인해 주세요.');
  if (!eligibleDate) limitErrors.push('수령 요건 충족 예상일을 먼저 확인해 주세요.');
  if (eligibleDate && eligibleDate < '2013-01-01') limitErrors.push('2013년 제도개편 전 수급요건 충족 계좌는 경과 기산연차를 금융기관에 확인해야 합니다.');
  if (eligibleDate && taxYear && `${taxYear}-12-31` < eligibleDate) limitErrors.push('선택 과세연도에는 아직 연령·기간 요건을 충족하지 않습니다.');
  const receiptYear = eligibleDate && taxYear && !limitErrors.length ? taxYear - Number(eligibleDate.slice(0, 4)) + (v.openedDate < '2013-03-01' ? 6 : 1) : null;
  const unlimited = receiptYear !== null && receiptYear >= 11;
  const validApplication = isCalendarDate(v.applicationDate) && !!eligibleDate && v.applicationDate >= eligibleDate && !!taxYear && Number(v.applicationDate.slice(0, 4)) <= taxYear;
  if (!validApplication) limitErrors.push('실제 또는 계획한 연금개시 신청일은 요건 충족일 이후, 선택 과세연도 이내여야 합니다. 신청일을 임의로 퇴직일로 설정하지 않습니다.');
  const requiredReferenceDate = validApplication ? (Number(v.applicationDate.slice(0, 4)) === taxYear ? v.applicationDate : `${taxYear}-01-01`) : null;
  const parsed = parseMoney({ amount: v.referenceValue, unit: 'won' });
  if (!unlimited && (!requiredReferenceDate || v.referenceDate !== requiredReferenceDate || parsed.error || parsed.won === null)) limitErrors.push('한도 계산에는 개시 신청연도는 신청일, 이후 연도는 1월 1일의 별도 계좌 평가액과 일치하는 평가 기준일이 필요합니다. 퇴직 예상 적립금으로 자동 대체하지 않습니다.');
  const limitWon = !limitErrors.length && !unlimited && parsed.won !== null && receiptYear !== null ? statutoryReceiptLimit(parsed.won, receiptYear) : null;
  if (!limitErrors.length && !unlimited && limitWon === null) limitErrors.push('한도가 안전한 원 단위 범위를 초과했습니다.');
  const withdrawal = parseMoney({ amount: v.annualWithdrawal, unit: 'won' });
  if (v.annualWithdrawal && (withdrawal.error || withdrawal.won === null)) limitErrors.push('연간 한도 산입 인출액을 유효한 금액으로 입력해 주세요.');
  const comparisonReady = !limitErrors.length && withdrawal.won !== null && (unlimited || limitWon !== null);
  const withinWon = comparisonReady ? unlimited ? withdrawal.won : Math.min(withdrawal.won!, limitWon!) : null;
  const excessWon = comparisonReady ? unlimited ? 0 : Math.max(0, withdrawal.won! - limitWon!) : null;
  const actualYears = /^\d+$/.test(v.actualReceiptYears) ? Number(v.actualReceiptYears) : NaN;
  const deferredPercent = v.deferred === 'confirmed' && exceptionDate ? deferredTaxPercent(actualYears) : null;
  if (v.actualReceiptYears && deferredPercent === null) taxErrors.push('퇴직소득세 비율은 이연퇴직소득 실제 보유 및 금융기관 확인 실제 수령연차(1~100)가 필요합니다.');
  let bridgeStart: string | null = null;
  if (eligibleDate && retirement && isCalendarDate(retirement)) bridgeStart = eligibleDate > retirement ? eligibleDate : retirement;
  const bridge = !publicStart || !isCalendarDate(publicStart) || !retirement ? '공적연금 개시일·퇴직일 확인 후 판단 가능' : publicStart <= retirement ? '퇴직 후 공적연금 개시 전 공백 없음' : !bridgeStart ? '가입기간 등 추가 확인 후 공백 중 활용 여부 판단' : bridgeStart < publicStart ? '공적연금 공백 중 연금계좌 활용 검토 가능 (신청·한도·세금 별도 확인)' : '일반 연금수령 요건으로는 공적연금 공백 중 활용 어려움';
  return { age55Date, fiveYearDate, generalDate, eligibleDate, exceptionApplied, status, errors, taxYear,
    receiptYear, unlimited: unlimited && !limitErrors.length, requiredReferenceDate, limitWon, limitErrors,
    withdrawalWon: withdrawal.error ? null : withdrawal.won, withinWon, excessWon, deferredPercent, taxErrors, bridgeStart, bridge,
    applicationRequired: true, netWon: null, checkedOn: '2026-11-08' };
}
export type AccountReceiptResult = ReturnType<typeof calculateAccountReceipt>;
