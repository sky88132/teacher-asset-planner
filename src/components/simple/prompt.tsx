import { useMemo, useRef, useState } from 'react';
import type { SimpleInputs } from '@/lib/simple/model';
import { generateSimplePrompt, simpleAnalyses } from '@/lib/simple/prompt';
import { validateSimpleProfile } from '@/lib/simple/validation';
import { aiServices, aiDisclaimer, type PromptWorkspace, type PromptSettings } from '@/lib/ai/prompt-input';
import { privacyFindings } from '@/lib/ai/prompt-privacy';
import { Field, OfficialLink } from './shared';
export function SimplePromptPanel({ input, today, value, onChange }: { input: SimpleInputs; today: string; value: PromptWorkspace; onChange: (v: PromptWorkspace) => void }) {
  const [message, setMessage] = useState('');
  const text = useRef<HTMLTextAreaElement>(null), s = value.settings;
  const preview = useMemo(() => generateSimplePrompt(input, s, today), [input, s, today]);
  // Memory-only freshness marker. Never display, log or export the raw source JSON.
  const key = useMemo(() => JSON.stringify({ input, settings: s, today }), [input, s, today]);
  const stale = !!value.generatedKey && value.generatedKey !== key;
  const findings = privacyFindings(value.draft, s);
  const errors = validateSimpleProfile(input.profile, today);
  const set = <K extends keyof PromptSettings>(field: K, v: PromptSettings[K]) => {
    const privacyChanged = ['anonymize', 'money', 'allowExactDates'].includes(field);
    onChange({ ...value, settings: { ...s, [field]: v, ...(field === 'question' ? { questionReviewed: false } : {}), ...(field === 'anonymize' ? { allowExactDates: false } : {}) },
      inclusionReviewed: false, ...(privacyChanged ? { draft: '', original: '', generatedKey: null } : {}) }); setMessage('');
  };
  const select = () => { text.current?.focus(); text.current?.select(); };
  return <div className="simple-panel"><p className="form-description">01 기본정보만 유효하면 생성할 수 있습니다. 다른 금융 입력은 선택 사항이며 미입력 금액은 만들지 않습니다.</p>
    <fieldset><legend>분석 유형</legend><div className="prompt-types">{Object.entries(simpleAnalyses).map(([id, label]) => <label key={id} className={`school ${s.analysis === id ? 'chosen' : ''}`}><input type="radio" name="simple-analysis" checked={s.analysis === id} onChange={() => set('analysis', id as PromptSettings['analysis'])} /><strong>{label}</strong></label>)}</div></fieldset>
    <label className="checkbox"><input type="checkbox" checked={s.anonymize} onChange={e => set('anonymize', e.target.checked)} />익명화 모드</label><p className="profile-help">기본값은 연령대·임용연도만 포함하며 정확한 생년월일·임용일·학교명은 제외합니다. 익명화를 꺼도 날짜는 포함하지 않습니다. 자유 질문과 편집본은 직접 검토하세요.</p>
    <div className="benefit-fields"><Field label="금융금액 표시 방식" value={s.money} onChange={v => set('money', v as PromptSettings['money'])}><option value="round">10만 원 단위 반올림</option><option value="range">100만 원 구간</option><option value="exact">정확한 금액</option></Field><Field label="요청문 분량" value={s.detail} onChange={v => set('detail', v as PromptSettings['detail'])}><option value="simple">간단</option><option value="detailed">상세</option></Field></div>
    <div className="benefit-field"><label>추가 질문<textarea aria-label="추가 질문" rows={3} value={s.question} onChange={e => set('question', e.target.value)} maxLength={4000} /></label></div>
    {s.question.trim() && <label className="checkbox"><input type="checkbox" checked={s.questionReviewed} onChange={e => set('questionReviewed', e.target.checked)} />추가 질문에 개인정보가 없는지 검토했습니다.</label>}
    <details className="simple-details" aria-label="포함 정보 미리보기"><summary>포함 정보 미리보기</summary><p className="profile-help">연금제도·연령·임용연도·호봉·군복무 관련 상태·선택 퇴직일과 입력된 금융 결과·고정 가정·누락 이유만 포함합니다. 원본 입력 전체와 기존 자유 메모는 내보내지 않습니다.</p>{preview ? <pre className="simple-prompt-preview">{preview}</pre> : <ul className="profile-help">{errors.map(e => <li key={e}>{e}</li>)}</ul>}</details>
    <label className="checkbox"><input type="checkbox" checked={value.inclusionReviewed} onChange={e => onChange({ ...value, inclusionReviewed: e.target.checked })} />포함 정보·익명화·누락 사항을 확인했습니다.</label>
    <button className="primary" disabled={!preview || !value.inclusionReviewed} onClick={() => { if (preview) { onChange({ ...value, draft: preview, original: preview, generatedKey: key }); setMessage('현재 입력과 계산 결과로 요청문을 생성했습니다. 복사 전 확인해 주세요.'); } }}>AI 요청문 {value.generatedKey ? '다시 생성' : '생성'}</button>
    {!preview && <p className="profile-help">기본정보를 먼저 확인해 주세요. 02~05 금융 금액은 필수가 아닙니다.</p>}
    <section className="benefit-section" aria-label="생성된 AI 요청문"><h3>생성된 요청문 · 직접 수정 가능</h3>{stale && <p className="field-error">입력 또는 계산 조건이 변경되었습니다. 요청문을 다시 생성해 주세요. 이전 편집본의 복사는 보류합니다.</p>}
      {findings.length > 0 && <p className="field-error">개인정보 점검 필요: {findings.join(', ')}. 자동 탐지는 완전하지 않으므로 직접 확인하세요.</p>}
      <div className="benefit-field"><label>AI 분석 요청문<textarea aria-label="AI 분석 요청문" ref={text} rows={16} value={value.draft} spellCheck={false} onChange={e => { onChange({ ...value, draft: e.target.value }); setMessage(''); }} /></label></div>
      <div className="comparison-actions"><button className="primary" disabled={!value.draft || stale || !!findings.length || !value.inclusionReviewed} onClick={async () => {
        try { await navigator.clipboard.writeText(value.draft); setMessage('전체 요청문을 복사했습니다.'); } catch { select(); setMessage('자동 복사에 실패했습니다. 선택된 텍스트를 직접 복사해 주세요.'); }
      }}>전체 복사</button><button className="secondary" disabled={!value.draft} onClick={select}>전체 텍스트 선택</button></div><p className="profile-help">다시 생성하면 기존 편집본을 대체합니다. 복사가 실패하면 Ctrl+C 또는 모바일 복사를 사용하세요.</p>
    </section>{message && <p role="status" className="feedback">{message}</p>}
    <div className="comparison-actions">{aiServices.map(a => <OfficialLink key={a.name} href={a.url}>{a.name} 공식 사이트</OfficialLink>)}</div><p className="profile-help">요청문을 자동 전송하지 않습니다. 사용자가 외부 AI에 직접 붙여넣으면 해당 서비스로 전달됩니다.</p><p className="benefit-disclaimer">{aiDisclaimer}</p></div>;
}
