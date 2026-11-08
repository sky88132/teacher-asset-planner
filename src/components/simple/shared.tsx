import { DateField } from './date-field';
import { useId, useState } from 'react';
import { manwonToWon, wonToManwon, groupManwon, formatWonAsKoreanCurrency } from '@/lib/simple/currency';
import type { ReactNode } from 'react';
import type { SimpleAmount } from '@/lib/simple/calculation';
export const won = formatWonAsKoreanCurrency;
export function Field({ label, value, onChange, type = 'text', children, disabled = false, inputMode }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; children?: ReactNode; disabled?: boolean; inputMode?: 'numeric' | 'decimal';
}) {
  if (type === 'date' && !children) return <DateField label={label} value={value} onChange={onChange} disabled={disabled} />;
  return <div className="benefit-field"><label>{label}{children ? <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>{children}</select>
    : <input aria-label={label} type={type} inputMode={inputMode ?? (type === 'text' ? 'numeric' : undefined)} value={value} enterKeyHint="next" onChange={e => onChange(e.target.value)} disabled={disabled} />}</label></div>;
}
export function Result({ title, result, children }: { title: string; result: SimpleAmount; children?: ReactNode }) {
  return <section className={`benefit-result ${result.amountWon === null ? 'result-empty' : 'result-ready'}`} aria-label={title}><h3>{title}</h3><strong className="benefit-amount">{won(result.amountWon)}</strong>{result.amountWon === null && <p className="empty-guidance">입력 정보와 아래 확인 사항을 채우면 결과를 볼 수 있어요.</p>}
    <p className="profile-help">{result.confidence} · 기준 퇴직일 {result.date ?? '확인 필요'}</p>
    {result.errors.length > 0 && <ul className="profile-help">{result.errors.map(e => <li key={e}>{e}</li>)}</ul>}{children}</section>;
}
export function OfficialLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{children}</a>;
}

/** Parent state stays in 원. Only the focused editing draft is in 만원. */
export function MoneyField({ label, valueWon, onChangeWon }: { label: string; valueWon: string; onChangeWon: (v: string) => void }) {
  const id = useId();
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(''), [error, setError] = useState('');
  const display = editing ? draft : wonToManwon(valueWon);
  const parsed = manwonToWon(display.endsWith('.') ? display.slice(0, -1) : display);
  return <div className="benefit-field money-field"><label htmlFor={id}>{label}</label>
    <div className="money-input-wrap"><input id={id} aria-label={label} aria-describedby={id + '-help'} aria-invalid={!!error}
      inputMode="decimal" enterKeyHint="next" type="text" placeholder="예: 3,000" value={groupManwon(display)}
      onFocus={() => { setDraft(wonToManwon(valueWon)); setEditing(true); }}
      onBlur={() => { setEditing(false); setError(''); }}
      onChange={e => {
        const raw = e.target.value.replaceAll(',', '');
        if (!/^(?:\d+(?:\.\d{0,4})?)?$/.test(raw)) { setError('음수·문자 없이 소수점 넷째 자리까지 입력하세요. 직전 유효 금액을 유지합니다.'); return; }
        const converted = manwonToWon(raw.endsWith('.') ? raw.slice(0, -1) : raw);
        if (converted.error) { setError(converted.error + ' 직전 유효 금액을 유지합니다.'); return; }
        setError(''); setDraft(raw); onChangeWon(converted.valueWon!);
      }} /><span aria-hidden="true">만원</span></div>
    <p id={id + '-help'} className={error ? 'field-error' : 'profile-help'} aria-live="polite">{error || (display === '' ? '만원 단위 · 소수점 넷째 자리(1원)까지 입력할 수 있습니다.' : groupManwon(display) + '만원 = ' + (parsed.valueWon === null ? '확인 필요' : Number(parsed.valueWon).toLocaleString('ko-KR') + '원') + ' · 최대 소수점 4자리')}</p>
  </div>;
}
