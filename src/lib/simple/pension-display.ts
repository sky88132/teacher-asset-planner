import type { SimpleResults } from './calculation.ts';
/** Headline monthly pension. For the teacher model the headline is the 2026-pay-level equivalent ("지금 가치")
 * of the base scenario, and the start-year nominal amount is shown as secondary. Other sources are shown as entered/estimated. */
export function pensionDisplay(r: SimpleResults) {
  const base = r.pensionSource === 'teacher-model' ? r.teacherPension.rows.find(x => x.id === 'base') ?? null : null;
  if (base && base.basis2026Won !== null && r.pension.amountWon !== null)
    return { primaryWon: base.basis2026Won as number | null, present: true, futureWon: r.pension.amountWon as number | null, futureYear: r.pensionDetails.priceYear as number | null };
  return { primaryWon: r.pension.amountWon, present: false, futureWon: null, futureYear: null };
}
