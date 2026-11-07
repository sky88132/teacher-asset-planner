import { blockedAllowanceResult, type AllowanceBasis, type AutoAllowanceInput } from './retirement-allowance.ts';
import { validateAutoAllowance } from './retirement-allowance-validation.ts';

export const civilAllowanceBasis: AllowanceBasis = {
  scheme: 'civil', reviewedOn: '2026-11-07', effectiveOn: '2026-10-02', verification: 'incomplete',
  law: '공무원연금법 제25조·제62조·제65조 (법률 제21857호)',
  lawUrl: 'https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1030484361',
  regulation: '공무원연금법 시행령 제58조·제61조 (대통령령 제36728호)',
  regulationUrl: 'https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=82190',
  referenceCapMonths: 396,
  referenceRates: [{ minMonths: 12, numerator: 650, denominator: 10000 },
    { minMonths: 60, numerator: 2275, denominator: 10000 }, { minMonths: 120, numerator: 2925, denominator: 10000 },
    { minMonths: 180, numerator: 3250, denominator: 10000 }, { minMonths: 240, numerator: 3900, denominator: 10000 }],
};

/** No monetary formula is enabled until official worked cases, transitions and rounding are verified. */
export function calculateCivilAllowance(input: AutoAllowanceInput) {
  return blockedAllowanceResult(input, validateAutoAllowance(input), civilAllowanceBasis);
}
