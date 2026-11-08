import { parseMoney, changeMoneyUnit } from '../finance/pension-input-validation.ts';
/** UI 만원 text -> exact internal 원 text. Empty remains empty; invalid input never becomes zero. */
export function manwonToWon(value: string): { valueWon: string | null; error?: string } {
  const parsed = parseMoney({ amount: value, unit: 'manwon' });
  return parsed.error ? { valueWon: null, error: parsed.error } : { valueWon: parsed.won === null ? '' : String(parsed.won) };
}
/** Internal 원 text -> UI 만원 text, without floating point arithmetic. */
export function wonToManwon(valueWon: string): string {
  return changeMoneyUnit({ amount: valueWon, unit: 'won' }, 'manwon').amount;
}
export function groupManwon(value: string): string {
  const [whole, fraction] = value.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : '.' + fraction);
}
/** Exact Korean display; up to 4 decimal places in 만원 preserve single won results. */
export function formatWonAsKoreanCurrency(valueWon: number | null, missing = '미입력 또는 계산 불가'): string {
  if (valueWon === null || !Number.isSafeInteger(valueWon)) return missing;
  const sign = valueWon < 0 ? '-' : '';
  const n = BigInt(Math.abs(valueWon));
  const eok = n / 100000000n, rest = n % 100000000n;
  const manwon = groupManwon(wonToManwon(String(rest)));
  return sign + (eok ? eok.toLocaleString('ko-KR') + '억' + (rest ? ' ' + manwon + '만원' : '원') : manwon + '만원');
}
