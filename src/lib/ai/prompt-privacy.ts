import type { MoneyDisplay, PromptSettings } from './prompt-input.ts';
import { aiServices } from './prompt-input.ts';
import { ktcuProducts } from '../finance/ktcu-products.ts';
import { taxRule } from '../finance/irp-tax.ts';
import { retirementRule } from '../finance/retirement-comparison-validation.ts';

export function displayPromptMoney(value: number | null, mode: MoneyDisplay): string {
  if (value === null || !Number.isSafeInteger(value)) return '계산 불가 · 금액 없음';
  if (value === 0) return '0원 (계산값 또는 명시적 입력값)';
  const n = BigInt(Math.abs(value)), sign = value < 0 ? '-' : '';
  const format = (n: bigint) => n.toLocaleString('ko-KR');
  if (mode === 'exact') return `${sign}${format(n)}원`;
  const step = mode === 'round' ? 100000n : 1000000n;
  if (mode === 'round') {
    const rounded = (n + step / 2n) / step * step;
    return rounded === 0n ? (value > 0 ? '0원 초과~100,000원 미만 (표시 축약)' : '-100,000원 초과~0원 미만 (표시 축약)')
      : `약 ${sign}${format(rounded)}원 (10만 원 단위 반올림)`;
  }
  const lower = n / step * step, upper = lower + step;
  return value > 0 ? `${format(lower)}원 이상~${format(upper)}원 미만 (100만 원 구간)`
    : `-${format(upper)}원 초과~${lower === 0n ? '0' : `-${format(lower)}`}원 이하 (100만 원 구간)`;
}
const datePattern = /\b\d{4}[-./]\d{1,2}[-./]\d{1,2}\b|\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g;
const allowedUrls = [...aiServices.map(s => s.url), ...Object.values(ktcuProducts).map(p => p.url), taxRule.source, retirementRule.source];
/** A local pattern check, not an exhaustive personal-name/identifier classifier. */
export function privacyFindings(text: string, settings: Pick<PromptSettings, 'anonymize' | 'allowExactDates'>): string[] {
  let value = text.normalize('NFKC');
  value = value.replace(/https?:\/\/[^\s<>)]+/g, url => allowedUrls.includes(url) ? '[공식 링크]' : url);
  const findings: string[] = [];
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) findings.push('이메일');
  if (/\b(?:\+82[- ]?)?0?1[016789][- ]?\d{3,4}[- ]?\d{4}\b/.test(value)) findings.push('전화번호');
  if (/\b\d{6}[- ]?[1-8]\d{6}\b/.test(value)) findings.push('주민등록번호 형태');
  if (/(?:이름|성명|학교명|계좌번호|이메일|주민등록번호)\s*[:：]|(?:저는|이름은|성명은)\s*[가-힣]{2,4}\s*(?:입니다|교사)|[가-힣]{2,}(?:초등학교|중학교|고등학교|유치원)/.test(value)) findings.push('직접 식별정보 표기');
  if ((settings.anonymize || !settings.allowExactDates) && new RegExp(datePattern).test(value)) findings.push('허용되지 않은 정확한 날짜');
  // Remove date forms before looking for account-number patterns; amounts use comma grouping.
  const withoutDates = value.replace(datePattern, '[날짜]');
  if (/\b\d{8,}\b|\b\d{2,6}[- ]\d{2,6}[- ]\d{2,8}\b/.test(withoutDates)) findings.push('계좌번호 등 긴 식별번호 형태');
  if (/https?:\/\//i.test(withoutDates)) findings.push('검토되지 않은 외부 주소');
  return [...new Set(findings)];
}
export function reviewedQuestion(settings: PromptSettings): { text: string; omitted: boolean; findings: string[] } {
  if (!settings.question.trim()) return { text: '', omitted: false, findings: [] };
  if (!settings.questionReviewed) return { text: '추가 질문은 개인정보 확인 전이라 포함하지 않았습니다.', omitted: true, findings: [] };
  const lines = settings.question.slice(0, 4000).split(/\r?\n/);
  const findings = lines.flatMap(line => privacyFindings(line, settings));
  const safe = lines.map(line => privacyFindings(line, settings).length ? '[개인정보 또는 정확한 날짜가 의심되는 질문 줄 제외]' : line).join('\n');
  return { text: safe, omitted: findings.length > 0, findings: [...new Set(findings)] };
}
