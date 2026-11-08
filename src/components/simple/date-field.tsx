import { useEffect, useId, useRef, useState } from 'react';
import { isCalendarDate, todayInKorea } from '@/lib/profile-validation';
import { calendarMonth, normalizeDateText } from '@/lib/date-input';

export function DateField({ label, value, onChange, disabled = false }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const id = useId(), root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false), [view, setView] = useState(() => {
    const date = isCalendarDate(value) ? value : todayInKorea();
    return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
  });
  const invalid = value !== '' && !isCalendarDate(value);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const yearNow = Number(todayInKorea().slice(0, 4));
  const years = Array.from(new Set([...Array.from({ length: yearNow + 100 - 1900 + 1 }, (_, i) => 1900 + i), view.year])).sort((a, b) => a - b);
  const calendar = calendarMonth(view.year, view.month);
  const move = (delta: number) => { const index = view.year * 12 + view.month - 1 + delta; setView({ year: Math.floor(index / 12), month: index % 12 + 1 }); };
  return <div ref={root} className="benefit-field date-field" onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); close(); } }}>
    <label htmlFor={id}>{label}</label>
    <div className="date-input-row"><input id={id} aria-label={label} aria-describedby={id + '-help'} aria-invalid={invalid} type="text" inputMode="numeric" enterKeyHint="next"
      placeholder="예: 1980-05-10" maxLength={10} value={value} disabled={disabled}
      onChange={event => { onChange(normalizeDateText(event.target.value)); setOpen(false); }} />
      <button ref={trigger} type="button" className="date-calendar-trigger" disabled={disabled} aria-label={label + ' 달력 열기'} aria-expanded={open && !disabled} aria-controls={id + '-calendar'} onClick={() => {
        if (open) { setOpen(false); return; }
        const date = isCalendarDate(value) ? value : todayInKorea();
        setView({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) }); setOpen(true);
      }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-12 4h2m2 0h2"/></svg><span>달력</span></button></div>
    <p id={id + '-help'} className={invalid ? 'field-error' : 'profile-help'}>{invalid ? '연도 4자리·월 2자리·일 2자리로 실제 날짜를 입력하세요. 예: 19800510 또는 1980-05-10' : '직접 입력: 19800510 또는 1980-05-10 · 달력에서 연도·월 바로 선택'}</p>
    {open && !disabled && <div id={id + '-calendar'} role="region" aria-label={label + ' 달력'} className="date-picker">
      <div className="date-picker-title"><strong>{label} 선택</strong><button type="button" aria-label={label + ' 달력 닫기'} onClick={close}>닫기</button></div>
      <div className="date-picker-selects"><select aria-label={label + ' 달력 연도'} value={view.year} onChange={e => setView({ ...view, year: Number(e.target.value) })}>{years.map(year => <option key={year} value={year}>{year}년</option>)}</select>
        <select aria-label={label + ' 달력 월'} value={view.month} onChange={e => setView({ ...view, month: Number(e.target.value) })}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}월</option>)}</select></div>
      <div className="date-picker-month"><button type="button" aria-label={label + ' 이전 달'} disabled={view.year === 1 && view.month === 1} onClick={() => move(-1)}>‹</button><span aria-live="polite">{view.year}년 {view.month}월</span><button type="button" aria-label={label + ' 다음 달'} disabled={view.year === 9999 && view.month === 12} onClick={() => move(1)}>›</button></div>
      <div className="date-picker-days">{['일', '월', '화', '수', '목', '금', '토'].map(day => <span className="weekday" key={day} aria-hidden="true">{day}</span>)}
        {Array.from({ length: calendar.offset }, (_, i) => <span key={'empty-' + i} aria-hidden="true" />)}
        {calendar.days.map(({ day, date }) => <button type="button" key={date} aria-label={view.year + '년 ' + view.month + '월 ' + day + '일'} aria-pressed={value === date} className={value === date ? 'date-selected' : ''} onClick={() => { onChange(date); close(); }}>{day}</button>)}
      </div><p className="profile-help">연도와 월을 먼저 고르면 과거 날짜도 바로 찾을 수 있어요.</p>
    </div>}
  </div>;
}
