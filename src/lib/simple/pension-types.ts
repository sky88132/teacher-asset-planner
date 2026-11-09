export type PensionEstimateInput = {
  simulationInflation?: string;
  incomeMode: 'average' | 'current'; averageIncome: string; currentIncome: string; constantIncome: boolean;
  legacyIncome: string; redistributedIncome: string; factorPercent: string;
  complexCareer: boolean; militaryMonths: string; militaryCreditYear: string; recognizedAt2016: string;
  nationalStartMonth: string; nationalEndMonth: string; nationalAutomaticEnd: boolean;
  nationalLastFiveIncome: string; nationalMilitaryMonths: string; nationalChildMonths: string;
  confirmedRetirementDate: string; confirmedAppointmentDate: string; verifiedNormalDate: string;
};
export function createPensionEstimateInput(): PensionEstimateInput {
  return { simulationInflation: '0', incomeMode: 'average', averageIncome: '', currentIncome: '', constantIncome: false,
    legacyIncome: '', redistributedIncome: '', factorPercent: '', complexCareer: false,
    militaryMonths: '', militaryCreditYear: '', recognizedAt2016: '', nationalStartMonth: '', nationalEndMonth: '', nationalAutomaticEnd: true,
    nationalLastFiveIncome: '', nationalMilitaryMonths: '', nationalChildMonths: '',
    confirmedRetirementDate: '', confirmedAppointmentDate: '', verifiedNormalDate: '' };
}
export type PensionPeriod = { label: string; months: number; amountWon: number | null };
export type PensionEstimate = {
  amountWon: number | null; errors: string[]; notes: string[]; method: string; formula: string;
  normalAge: number | null; normalStartDate: string | null; firstPaymentMonth: string | null;
  gapMonths: number | null; gapDays: number | null; earlyAge: number | null; earlyNote: string;
  months: number | null; capMonths: number | null; periods: PensionPeriod[];
  sources: { title: string; url: string }[]; confidence: string;
  checkedOn: string; priceYear: number; externalValidation: string;
};
export function emptyPension(): PensionEstimate {
  return { amountWon: null, errors: [], notes: [], method: '추가 소득정보 기반 조건부 추정', formula: '',
    normalAge: null, normalStartDate: null, firstPaymentMonth: null, gapMonths: null, gapDays: null,
    earlyAge: null, earlyNote: '', months: null, capMonths: null, periods: [], sources: [],
    confidence: '추정에 필요한 정보 확인', checkedOn: '2026-11-08', priceYear: 2026,
    externalValidation: '외부 금액 검증 미완료' };
}
