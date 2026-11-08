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
/** Display only: integer 만원, half away from zero. Never feed this text back to a calculation. */
export function formatWonAsKoreanCurrency(valueWon: number | null, missing = '미입력 또는 계산 불가', mode?: 'range'): string {
  if (valueWon === null || !Number.isSafeInteger(valueWon)) return missing;
  if (mode === 'range' && valueWon !== 0) {
    const n=BigInt(Math.abs(valueWon)), lower=n/1000000n*1000000n, upper=lower+1000000n;
    if(upper>BigInt(Number.MAX_SAFE_INTEGER))return `${valueWon<0?'-':''}${formatWonAsKoreanCurrency(Number(lower))} (표시 상한 구간)`;
    return valueWon > 0 ? `${formatWonAsKoreanCurrency(Number(lower))} 이상~${formatWonAsKoreanCurrency(Number(upper))} 미만 (100만원 구간)` : `−${formatWonAsKoreanCurrency(Number(upper))} 초과~${lower===0n?'0만원':'−'+formatWonAsKoreanCurrency(Number(lower))} 미만 (100만원 구간)`;
  }
  const sign = valueWon < 0 ? '-' : '';
  const raw=BigInt(Math.abs(valueWon)), n=(raw+5000n)/10000n;
  if (raw>0n && n===0n) return valueWon>0 ? '0만원 초과~1만원 미만' : '-1만원 초과~0만원 미만';
  const eok = n / 10000n, rest = n % 10000n;
  const manwon = rest.toLocaleString('ko-KR');
  return sign + (eok ? eok.toLocaleString('ko-KR') + '억' + (rest ? ' ' + manwon + '만원' : '원') : manwon + '만원');
}
