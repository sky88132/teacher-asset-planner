import { createPensionInputs, type BenefitInput, type SupportedScheme } from './pension-input.ts';

export type ScenarioKey = 'early' | 'normal' | 'custom';
export type ScenarioQuotes = { pension: BenefitInput; allowance: BenefitInput; honorary: BenefitInput };
export interface RetirementScenario {
  date: string;
  scheme: 'profile' | SupportedScheme;
  pensionSource: 'linked' | 'local';
  allowanceSource: 'linked' | 'local';
  quotes: Record<SupportedScheme, ScenarioQuotes>;
  eligibility: 'unknown' | 'confirmed' | 'no';
  selection: 'unknown' | 'selected' | 'rejected';
  ktcuSource: 'simulation' | 'official';
  ktcuStopMode: 'retirement' | 'shared' | 'custom'; ktcuStop: string; ktcuRate: string;
  irpStopMode: 'retirement' | 'shared' | 'custom'; irpStop: string; irpRate: string;
  savingStopMode: 'retirement' | 'shared' | 'custom'; savingStop: string; savingRate: string;
}
export interface RetirementComparisonInput {
  schoolLevel: '' | 'kindergarten' | 'primary' | 'middle' | 'high' | 'special' | 'university' | 'other';
  position: '' | 'regular-teacher' | 'principal' | 'vice-principal' | 'fixed-term' | 'other';
  ruleConfirmed: boolean; normalMode: 'auto' | 'manual'; customEnabled: boolean;
  scenarios: Record<ScenarioKey, RetirementScenario>;
}
export function createRetirementComparisonInput(): RetirementComparisonInput {
  function scenario(): RetirementScenario {
    const p = createPensionInputs();
    const quotes = (scheme: SupportedScheme): ScenarioQuotes => ({ pension: { ...p[scheme].pension, source: 'official' },
      allowance: p[scheme].allowance, honorary: { ...p[scheme].allowance, money: { amount: '', unit: 'won' } } });
    return { date: '', scheme: 'profile', pensionSource: 'linked', allowanceSource: 'linked',
      quotes: { civil: quotes('civil'), 'private-school': quotes('private-school') }, eligibility: 'unknown', selection: 'unknown',
      ktcuSource: 'simulation', ktcuStopMode: 'retirement', ktcuStop: '', ktcuRate: '',
      irpStopMode: 'retirement', irpStop: '', irpRate: '', savingStopMode: 'retirement', savingStop: '', savingRate: '' };
  }
  return { schoolLevel: '', position: '', ruleConfirmed: false, normalMode: 'auto', customEnabled: false,
    scenarios: { early: scenario(), normal: scenario(), custom: scenario() } };
}
export const comparisonDisclaimer = '본 비교 결과는 입력정보 및 적용된 가정에 따른 예상 시뮬레이션입니다. 실제 퇴직급여, 연금수령액, 퇴직 가능 여부 및 지급 조건은 관련 법령과 개별 상황에 따라 달라질 수 있습니다. 참고용으로 활용하시고 정확한 금액과 자격은 해당 기관에서 확인하시기 바랍니다.';
