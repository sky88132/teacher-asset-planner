import { pensionCreditBase } from '../finance/irp-tax.ts';

/** Planning scenario only: sufficient tax capacity, 12% national + local tax effect.
 * Eligibility caps stay in the existing tax engine; this is never a refund quote. */
export function plannedReinvestment(irpWon: number, savingWon: number) {
  const eligible = pensionCreditBase(irpWon, savingWon);
  return Number(BigInt(eligible) * 132n / 1000n);
}
