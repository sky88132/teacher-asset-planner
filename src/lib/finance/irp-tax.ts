export const taxRule = { checkedOn: '2026-11-07', savingCap: 6000000, combinedCap: 9000000,
  source: 'https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7875&mi=2227' } as const;
export function pensionTaxCredit(irp: number, saving: number, incomeKind: 'wage' | 'comprehensive', income: number, capacity: number | null) {
  for (const n of [irp, saving, income, ...(capacity === null ? [] : [capacity])]) if (!Number.isSafeInteger(n) || n < 0) throw new Error('유효한 원 단위 금액이 필요합니다.');
  if (!['wage', 'comprehensive'].includes(incomeKind)) throw new Error('소득 구분을 확인해 주세요.');
  const rate = income <= (incomeKind === 'wage' ? 55000000 : 45000000) ? 15 : 12;
  const eligible = Math.min(taxRule.combinedCap, irp + Math.min(saving, taxRule.savingCap));
  const theoretical = Number(BigInt(eligible) * BigInt(rate) / 100n); // national income tax only, sub-won truncated
  return { eligible, rate, theoretical, usable: capacity === null ? null : Math.min(capacity, theoretical), cashRefund: null };
}
// No unverified transfer enters any portfolio or credit base.
export function retirementTransfer() { return { enabled: false, amountWon: null, reason: '급여별 과세대상 금액·이전 기한·금융회사 수용 조건 검증이 필요합니다. 이전 금액은 자산과 세액공제에 반영하지 않습니다.' } as const; }
