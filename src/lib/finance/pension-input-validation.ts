import { isCalendarDate, todayInKorea } from '../profile-validation.ts';
import type { AllowancePreparation, BenefitInput, MoneyInput, MoneyUnit } from './pension-input.ts';

export type InputErrors = Partial<Record<keyof BenefitInput, string>>;
export type PreparationErrors = Partial<Record<keyof AllowancePreparation, string>>;
export type ParsedMoney = { won: number | null; error?: string };

// Unit conversion only: this module does not calculate pension benefits or taxes.
export function parseMoney(input: MoneyInput): ParsedMoney {
  const raw = input.amount.trim();
  if (!raw) return { won: null };
  if (input.unit !== 'won' && input.unit !== 'manwon') return { won: null, error: '금액 단위를 확인해 주세요.' };
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)) {
    return { won: null, error: '음수·지수 표기 없이 숫자를 입력해 주세요. 쉼표는 세 자리마다 사용할 수 있습니다.' };
  }
  const [whole, fraction = ''] = raw.replaceAll(',', '').split('.');
  const precision = input.unit === 'won' ? 0 : 4;
  if (fraction.length > precision) return { won: null, error: input.unit === 'won'
    ? '원 단위는 정수로 입력해 주세요.' : '만 원 단위는 소수점 넷째 자리(1원)까지만 입력해 주세요.' };
  // Limit size before BigInt parsing; never round a monetary input.
  if (whole.replace(/^0+/, '').length > 16) return { won: null, error: '입력 가능한 금액 범위를 초과했습니다.' };
  const won = BigInt(whole) * (input.unit === 'won' ? 1n : 10000n)
    + BigInt(fraction.padEnd(precision, '0') || '0');
  if (won > BigInt(Number.MAX_SAFE_INTEGER)) return { won: null, error: '입력 가능한 금액 범위를 초과했습니다.' };
  return { won: Number(won) };
}

export function changeMoneyUnit(input: MoneyInput, unit: MoneyUnit): MoneyInput {
  const parsed = parseMoney(input);
  if (parsed.error) return input;
  if (parsed.won === null) return { amount: '', unit };
  const won = BigInt(parsed.won);
  const remainder = String(won % 10000n).padStart(4, '0').replace(/0+$/, '');
  return { unit, amount: unit === 'won' ? String(won)
    : `${won / 10000n}${remainder ? `.${remainder}` : ''}` };
}

export function validateBenefit(input: BenefitInput, kind: 'pension' | 'allowance',
  profile: { birthDate: string; appointmentDate: string }, today = todayInKorea()): InputErrors {
  if (!isCalendarDate(today)) throw new Error('유효한 기준일이 필요합니다.');
  const errors: InputErrors = {};
  const money = parseMoney(input.money);
  if (money.error || money.won === null) errors.money = money.error ?? '예상 금액을 입력해 주세요. 미입력은 0원이 아닙니다.';
  if (!['gross', 'net'].includes(input.taxBasis)) errors.taxBasis = '세전·세후를 선택해 주세요.';
  if (!['official', 'user-estimate'].includes(input.source)) errors.source = '입력 출처를 선택해 주세요.';
  if (kind === 'allowance' && input.source !== 'official') errors.source = '퇴직수당은 공식 조회값을 직접 입력해 주세요.';
  const dateFields = kind === 'pension' ? ['queryDate', 'retirementDate', 'startDate'] as const
    : ['queryDate', 'retirementDate'] as const;
  for (const field of dateFields) {
    if (!input[field]) errors[field] = '날짜를 입력해 주세요.';
    else if (!isCalendarDate(input[field])) errors[field] = '실제 달력에 있는 날짜를 입력해 주세요.';
  }
  if (!errors.queryDate && input.queryDate > today) errors.queryDate = '조회 기준일은 오늘(한국 시간)보다 늦을 수 없습니다.';
  if (!errors.retirementDate && isCalendarDate(profile.appointmentDate) && input.retirementDate <= profile.appointmentDate) {
    errors.retirementDate = '가정한 퇴직일은 최초 임용일보다 뒤여야 합니다.';
  }
  if (!errors.retirementDate && isCalendarDate(profile.birthDate) && input.retirementDate <= profile.birthDate) {
    errors.retirementDate = '가정한 퇴직일은 생년월일보다 뒤여야 합니다.';
  }
  if (kind === 'pension' && !errors.startDate && !errors.retirementDate && input.startDate < input.retirementDate) {
    errors.startDate = '연금 지급개시일은 가정한 퇴직일보다 빠를 수 없습니다.';
  }
  if (!errors.queryDate && isCalendarDate(profile.birthDate) && input.queryDate < profile.birthDate) {
    errors.queryDate = '조회 기준일은 생년월일보다 빠를 수 없습니다.';
  }
  return errors;
}

export function validatePreparation(input: AllowancePreparation): PreparationErrors {
  const errors: PreparationErrors = {};
  if (!/^\d{1,3}$/.test(input.years) || Number(input.years) > 100) errors.years = '재직연수는 0~100의 정수로 입력해 주세요. 인정 여부는 별도 확인이 필요합니다.';
  if (!/^\d{1,2}$/.test(input.months) || Number(input.months) > 11) errors.months = '개월은 0~11의 정수로 입력해 주세요.';
  const money = parseMoney(input.finalIncome);
  if (money.error || money.won === null || money.won === 0) errors.finalIncome = money.error ?? '최종 기준소득월액을 0원보다 크게 입력해 주세요.';
  if (!['yes', 'no', 'unknown'].includes(input.before2010)) errors.before2010 = '2009년 이전 재직 여부를 선택해 주세요.';
  return errors;
}
