import type { AllowancePreparation, SupportedScheme } from './pension-input.ts';

export type AutoAllowanceInput = AllowancePreparation & {
  appointmentDate: string;
  profileHasSpecialCareer: boolean;
};
export type AllowanceErrors = Partial<Record<keyof AutoAllowanceInput, string>>;
export interface AllowanceIssue { code: string; message: string }
export interface AllowanceBasis {
  scheme: SupportedScheme;
  reviewedOn: string;
  effectiveOn: string;
  law: string;
  lawUrl: string;
  regulation: string;
  regulationUrl: string;
  /** Reference only: no rate is selected or applied until legal verification is complete. */
  referenceRates: readonly { minMonths: number; numerator: number; denominator: number }[];
  referenceCapMonths: number;
  verification: 'incomplete';
}

// An incomplete legal verification can never produce a payable amount, including zero.
export interface BlockedAllowanceResult {
  status: 'blocked';
  confidence: '계산 불가';
  amountWon: null;
  taxBasis: 'gross';
  payment: 'lump-sum';
  source: 'app';
  inputMonths: number | null;
  inputIncomeWon: number | null;
  appliedMonths: null;
  appliedRate: null;
  calculationDate: string;
  errors: AllowanceErrors;
  reasons: AllowanceIssue[];
  basis: AllowanceBasis;
  rounding: '미적용 · 원 미만 및 지급 끝수 처리 검증 전';
  excluded: readonly string[];
}

export const allowanceDisclaimer = '본 계산 결과는 입력한 정보와 적용된 규정을 바탕으로 산출한 예상 금액입니다. 실제 지급액은 재직기간, 소득 이력, 휴직 및 관련 법령에 따라 달라질 수 있습니다. 참고용으로 활용하시고 정확한 금액은 해당 연금공단의 공식 조회 결과를 확인하시기 바랍니다.';

export interface AllowanceValidation {
  errors: AllowanceErrors;
  inputMonths: number | null;
  inputIncomeWon: number | null;
  issues: AllowanceIssue[];
}

export function blockedAllowanceResult(input: AutoAllowanceInput, validation: AllowanceValidation,
  basis: AllowanceBasis): BlockedAllowanceResult {
  return {
    status: 'blocked', confidence: '계산 불가', amountWon: null, taxBasis: 'gross', payment: 'lump-sum', source: 'app',
    inputMonths: validation.inputMonths, inputIncomeWon: validation.inputIncomeWon,
    appliedMonths: null, appliedRate: null, calculationDate: input.calculationDate,
    errors: validation.errors, basis,
    reasons: [...validation.issues,
      { code: 'official-examples-missing', message: '해당 제도의 공식 숫자 사례와 지급액 대조 검증을 완료하지 못했습니다.' },
      { code: 'rounding-unverified', message: '급여 계산의 원 미만·지급 끝수 절사 위치와 월수 경계 검증이 남아 있습니다.' },
      { code: 'transitions-unverified', message: '현행 본문과 관련 부칙·경과규정의 적용 검증을 완료하지 못했습니다.' }],
    rounding: '미적용 · 원 미만 및 지급 끝수 처리 검증 전',
    excluded: ['세금·미납금 등 공제', '구법 재직분의 보수 환산', '휴직·병역·합산기간의 인정 및 감축',
      '형벌·징계 등에 따른 감액·지급제한', '기존 수당 수령·재임용 정산', '미래 법령·소득 변동', '명예퇴직수당'],
  };
}
