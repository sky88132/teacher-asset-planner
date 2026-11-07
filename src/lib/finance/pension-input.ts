export type SupportedScheme = 'civil' | 'private-school';
export type MoneyUnit = 'won' | 'manwon';
export interface MoneyInput { amount: string; unit: MoneyUnit }
export type TaxBasis = '' | 'gross' | 'net';
export type InputSource = '' | 'official' | 'user-estimate';

export interface BenefitInput {
  money: MoneyInput;
  queryDate: string;
  retirementDate: string;
  startDate: string;
  taxBasis: TaxBasis;
  source: InputSource;
  assumptions: string;
}

export interface AllowancePreparation {
  years: string;
  months: string;
  finalIncome: MoneyInput;
  before2010: '' | 'yes' | 'no' | 'unknown';
  specialCareer: 'profile' | 'yes' | 'no' | 'unknown';
  retirementDate: string;
  calculationDate: string;
  periodSource: '' | 'official' | 'calendar' | 'unknown';
  reduction: '' | 'yes' | 'no' | 'unknown';
  previouslyReceived: '' | 'yes' | 'no' | 'unknown';
}

export interface SchemeInputs {
  pension: BenefitInput;
  allowance: BenefitInput;
  preparation: AllowancePreparation;
}
export type PensionInputs = Record<SupportedScheme, SchemeInputs>;

function emptyBenefit(source: InputSource = ''): BenefitInput {
  return { money: { amount: '', unit: 'won' }, queryDate: '', retirementDate: '',
    startDate: '', taxBasis: '', source, assumptions: '' };
}

export function createPensionInputs(): PensionInputs {
  const emptyScheme = (): SchemeInputs => ({
    pension: emptyBenefit(), allowance: emptyBenefit('official'),
    preparation: { years: '', months: '', finalIncome: { amount: '', unit: 'won' },
      before2010: '', specialCareer: 'profile', retirementDate: '', calculationDate: '',
      periodSource: '', reduction: '', previouslyReceived: '' },
  });
  return { civil: emptyScheme(), 'private-school': emptyScheme() };
}

export const benefitDisclaimer = '본 결과는 입력정보와 적용된 계산 기준에 따른 예상 금액으로 실제 지급액과 차이가 발생할 수 있습니다. 참고용으로 활용하시고 정확한 금액은 해당 연금기관의 공식 조회 결과를 확인하시기 바랍니다.';
