import { blockedAllowanceResult, type AllowanceBasis, type AutoAllowanceInput } from './retirement-allowance.ts';
import { validateAutoAllowance } from './retirement-allowance-validation.ts';

export const privateAllowanceBasis: AllowanceBasis = {
  scheme: 'private-school', reviewedOn: '2026-11-07', effectiveOn: '2026-10-02', verification: 'incomplete',
  law: '사립학교교직원 연금법 제31조·제42조 (법률 제21490호) 및 준용 조문',
  lawUrl: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=290719',
  regulation: '사학연금법 시행령 제63조의3 (대통령령 제36728호)',
  regulationUrl: 'https://law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=03&joNo=0063&lsiSeq=290433&urlMode=lsScJoRltInfoR',
  referenceCapMonths: 396,
  referenceRates: [{ minMonths: 12, numerator: 650, denominator: 10000 },
    { minMonths: 60, numerator: 2275, denominator: 10000 }, { minMonths: 120, numerator: 2925, denominator: 10000 },
    { minMonths: 180, numerator: 3250, denominator: 10000 }, { minMonths: 240, numerator: 3900, denominator: 10000 }],
};

/** Kept separate from the civil scheme; no assumption that its transitional rules are identical. */
export function calculatePrivateAllowance(input: AutoAllowanceInput) {
  return blockedAllowanceResult(input, validateAutoAllowance(input), privateAllowanceBasis);
}
