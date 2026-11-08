import type { ReactNode } from 'react';
import type { SimpleAmount } from '@/lib/simple/calculation';
export const won = (n: number | null, missing = '미입력 또는 계산 불가') => n === null ? missing : `${n.toLocaleString('ko-KR')}원`;
export function Field({ label, value, onChange, type = 'text', children, disabled = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; children?: ReactNode; disabled?: boolean;
}) {
  const money = type === 'text' && !children && /금액|적립금|납입액/.test(label);
  const display = money && /^\d+$/.test(value) ? value.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : value;
  return <div className="benefit-field"><label>{label}{children ? <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>{children}</select>
    : <input aria-label={label} type={type} inputMode={type === 'text' ? 'numeric' : undefined} value={display} enterKeyHint="next" placeholder={type === 'date' ? undefined : money ? '금액을 입력하세요' : undefined} onChange={e => onChange(money ? e.target.value.replaceAll(',', '') : e.target.value)} disabled={disabled} />}</label></div>;
}
export function Result({ title, result, children }: { title: string; result: SimpleAmount; children?: ReactNode }) {
  return <section className={`benefit-result ${result.amountWon === null ? 'result-empty' : 'result-ready'}`} aria-label={title}><h3>{title}</h3><strong className="benefit-amount">{won(result.amountWon)}</strong>{result.amountWon === null && <p className="empty-guidance">입력 정보와 아래 확인 사항을 채우면 결과를 볼 수 있어요.</p>}
    <p className="profile-help">{result.confidence} · 기준 퇴직일 {result.date ?? '확인 필요'}</p>
    {result.errors.length > 0 && <ul className="profile-help">{result.errors.map(e => <li key={e}>{e}</li>)}</ul>}{children}</section>;
}
export function OfficialLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{children}</a>;
}
