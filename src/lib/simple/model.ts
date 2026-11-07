import { createPensionInputs, type BenefitInput } from '../finance/pension-input.ts';
export type SimpleScheme = 'civil' | 'private-school' | 'national';
export const schemeNames: Record<SimpleScheme, string> = { civil: '공무원연금', 'private-school': '사학연금', national: '국민연금' };
export type SimpleProfile = {
  birthDate: string; appointmentDate: string; scheme: SimpleScheme; step: string; promotionMonth: string;
  military: 'approved' | 'not' | 'unknown'; retirement: 'normal' | 'early'; earlyDate: string;
  manualNormal: boolean; normalDate: string;
};
export type SimpleAccount = { balance: string; monthly: string };
export type SimpleBenefits = { pension: BenefitInput; allowance: BenefitInput; honorary: BenefitInput;
  eligibility: 'unknown' | 'confirmed' | 'no'; selection: 'unknown' | 'selected' | 'rejected' };
export type SimpleInputs = {
  profile: SimpleProfile;
  ktcu: SimpleAccount & { split: boolean; years: string };
  irp: SimpleAccount; saving: SimpleAccount; reinvest: boolean;
  benefits: Record<SimpleScheme, SimpleBenefits>;
};
export function createSimpleInputs(): SimpleInputs {
  const benefits = (): SimpleBenefits => {
    const p = createPensionInputs().civil;
    return { pension: p.pension, allowance: p.allowance, honorary: createPensionInputs().civil.allowance,
      eligibility: 'unknown', selection: 'unknown' };
  };
  return { profile: { birthDate: '', appointmentDate: '', scheme: 'civil', step: '', promotionMonth: '', military: 'unknown',
    retirement: 'normal', earlyDate: '', manualNormal: false, normalDate: '' },
    ktcu: { balance: '', monthly: '', split: false, years: '10' }, irp: { balance: '', monthly: '' },
    saving: { balance: '', monthly: '' }, reinvest: false,
    benefits: { civil: benefits(), 'private-school': benefits(), national: benefits() } };
}
