export type ProfileDateErrors = Partial<Record<'birthDate' | 'appointmentDate', string>>;

// Date-only values stay strings: never parse them as UTC/local timestamps.
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function todayInKorea(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function validateProfileDates(
  dates: { birthDate: string; appointmentDate: string }, today = todayInKorea(),
): ProfileDateErrors {
  if (!isCalendarDate(today)) throw new Error('유효한 기준일이 필요합니다.');
  const errors: ProfileDateErrors = {};
  for (const field of ['birthDate', 'appointmentDate'] as const) {
    const label = field === 'birthDate' ? '생년월일' : '최초 임용일';
    if (!dates[field]) errors[field] = `${label}을 입력해 주세요.`;
    else if (!isCalendarDate(dates[field])) errors[field] = '실제 달력에 있는 날짜를 입력해 주세요.';
    else if (dates[field] > today) errors[field] = `${label}은 오늘(한국 시간)보다 늦을 수 없습니다.`;
  }
  if (!errors.birthDate && !errors.appointmentDate && dates.appointmentDate <= dates.birthDate) {
    errors.appointmentDate = '최초 임용일은 생년월일보다 뒤여야 합니다.';
  }
  return errors;
}
