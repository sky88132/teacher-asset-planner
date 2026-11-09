import { parseMoney } from '../finance/pension-input-validation.ts';
import type { SimpleProfile } from './model.ts';
import type { PensionEstimate, PensionEstimateInput } from './pension-types.ts';
/** Confirmation dates and UI mode are metadata, not supplied income or coefficients.
 * Explicit 0/invalid non-empty input still selects validation; never silently replace it. */
export function hasEnteredPensionIncome(v: PensionEstimateInput): boolean {
  return [v.averageIncome,v.currentIncome,v.legacyIncome,v.redistributedIncome,v.factorPercent]
    .some(raw=>raw!==undefined&&raw!==null&&raw!=='');
}
export function positiveMoney(raw: string, label: string, r: PensionEstimate): number | null {
  const p = parseMoney({ amount: raw, unit: 'won' });
  if (p.error || p.won === null || p.won <= 0) { r.errors.push(`${label}이 필요합니다. ${p.error ?? '0원보다 큰 공단 확인 소득자료를 만원 단위로 입력해 주세요.'}`); return null; }
  return p.won;
}
export function pensionIncome(v: PensionEstimateInput, r: PensionEstimate): number | null {
  if (v.incomeMode === 'current') {
    r.method = '현재 소득을 평균소득으로 고정한 가정 시나리오';
    const n = positiveMoney(v.currentIncome, '현재 기준소득월액', r);
    if (!v.constantIncome) r.errors.push('현재 소득은 재평가된 평균소득과 다릅니다. 고정소득 시나리오에 명시적으로 동의하거나 평균소득 자료를 입력해 주세요.');
    r.notes.push('현재 기준소득월액이 전체 가입기간의 재평가 평균소득과 같다는 사용자 가정입니다. 과거 소득·미래 승급·보수 인상을 예측한 값이 아닙니다.');
    return n;
  }
  if (v.incomeMode !== 'average') { r.errors.push('소득 적용 방식을 확인해 주세요.'); return null; }
  r.notes.push('입력 평균소득은 2026년 가격으로 재평가·상한을 반영한 값이라는 가정입니다. 앱이 과거 월별 소득의 재평가를 대신하지 않습니다.');
  return positiveMoney(v.averageIncome, '재평가된 평균기준소득월액', r);
}
export function checkPensionContext(p: SimpleProfile, v: PensionEstimateInput, date: string | null, r: PensionEstimate) {
  if (!date) r.errors.push('01의 기본정보와 예상 퇴직일을 확인해 주세요.');
  if (v.confirmedRetirementDate !== date || v.confirmedAppointmentDate !== p.appointmentDate) r.errors.push('소득·계수·가입기간 가정이 현재 임용일/퇴직일에 맞는지 상세 설정에서 확인해 주세요. 날짜 변경 후에는 다시 확인해야 합니다.');
  if (v.complexCareer) r.errors.push('중단·휴직·시간제·재임용·직역 합산·기수령 이력은 연도별 공단 인정기간과 경과규정 검증이 필요하여 자동 금액 계산을 지원하지 않습니다.');
}
