import { useMemo, useRef, useState } from 'react';
import { todayInKorea } from '@/lib/profile-validation';
import { aiDisclaimer, aiServices, analysisTypes, type PromptSettings, type PromptWorkspace } from '@/lib/ai/prompt-input';
import type { PromptDataSources } from '@/lib/ai/prompt-data';
import { generateAnalysisPrompt, promptSourceKey } from '@/lib/ai/prompt-generator';
import { privacyFindings, reviewedQuestion } from '@/lib/ai/prompt-privacy';

export function AnalysisPromptPanel({ data, value, onChange }: { data: PromptDataSources; value: PromptWorkspace; onChange: (v: PromptWorkspace) => void }) {
  const [message, setMessage] = useState('');
  const textArea = useRef<HTMLTextAreaElement>(null), today = todayInKorea(), settings = value.settings;
  const sourceKey = useMemo(() => promptSourceKey(data, settings, today), [data, settings, today]);
  const preview = useMemo(() => {
    try { return { result: generateAnalysisPrompt(data, settings, today), error: '' }; }
    catch (e) { return { result: null, error: e instanceof Error ? e.message : '생성 조건을 확인해 주세요.' }; }
  }, [data, settings, today]);
  const stale = value.generatedKey !== null && value.generatedKey !== sourceKey;
  const draftFindings = useMemo(() => privacyFindings(value.draft, settings), [value.draft, settings]);
  const question = reviewedQuestion(settings);
  function changeSettings(patch: Partial<PromptSettings>) {
    const privacyChange = 'anonymize' in patch || 'allowExactDates' in patch || 'money' in patch;
    onChange({ ...value, inclusionReviewed: false,
      settings: { ...settings, ...patch, ...('question' in patch ? { questionReviewed: false } : {}), ...(patch.anonymize === true ? { allowExactDates: false } : {}) },
      ...(privacyChange ? { draft: '', original: '', generatedKey: null } : {}) });
    setMessage(privacyChange ? '개인정보·금액 옵션을 변경하여 이전 요청문을 초기화했습니다. 포함 정보 확인 후 다시 생성해 주세요.' : '');
  }
  function selectText() { textArea.current?.focus(); textArea.current?.select(); }
  async function copy() {
    if (!value.draft || stale || draftFindings.length || !value.inclusionReviewed) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value.draft); setMessage('전체 요청문을 복사했습니다. 원하는 AI에서 내용을 확인하고 직접 붙여넣으세요.');
    } catch { selectText(); setMessage('자동 복사에 실패했습니다. 텍스트를 선택했습니다. Ctrl+C 또는 모바일의 복사 기능을 사용해 주세요.'); }
  }
  return <div className="prompt-panel ktcu-panel"><p className="form-description">현재 입력과 계산 결과를 외부 AI에 붙여넣을 분석 요청문으로 바꿉니다. 유료 API·자동 전송·서버 저장을 사용하지 않습니다.</p>
    <section className="benefit-section"><h3>분석 유형</h3><fieldset><legend>요청할 분석 목적 선택</legend><div className="prompt-types">{Object.entries(analysisTypes).map(([key, item]) => <label className={settings.analysis === key ? 'school chosen' : 'school'} key={key}><input type="radio" name="analysis-purpose" value={key} checked={settings.analysis === key} onChange={() => changeSettings({ analysis: key as PromptSettings['analysis'] })} /><strong>{item.title}</strong></label>)}</div></fieldset></section>
    <section className="benefit-section"><h3>개인정보·표시 옵션</h3><label className="checkbox"><input type="checkbox" checked={settings.anonymize} onChange={e => changeSettings({ anonymize: e.target.checked })} />익명화 모드</label>
      <p className="profile-help">기본값은 익명화입니다. 연령대·달력상 재직연수·퇴직 연령 구간만 사용하며 이름·학교명·이메일·계좌번호와 기존 자유 메모는 자동 포함하지 않습니다. 익명화 해제도 직접 식별정보를 자동으로 포함하는 기능은 아닙니다.</p>
      {!settings.anonymize && <label className="checkbox"><input type="checkbox" checked={settings.allowExactDates} onChange={e => changeSettings({ allowExactDates: e.target.checked })} />정확한 생년월일·최초 임용일 및 조회·퇴직·수령 날짜를 요청문에 포함하는 데 명시적으로 동의합니다.</label>}
      <div className="benefit-fields"><div className="benefit-field"><label>금융금액 표시 방식<select aria-label="금융금액 표시 방식" value={settings.money} onChange={e => changeSettings({ money: e.target.value as PromptSettings['money'] })}><option value="round">10만 원 단위 반올림 · 기본</option><option value="range">100만 원 구간</option><option value="exact">원 단위 그대로</option></select></label><small>축약한 금액은 합산·비율을 역산하는 데 사용하면 안 됩니다. 0원 미만으로 반올림되는 작은 양의 금액은 별도 구간으로 표시합니다.</small></div><div className="benefit-field"><label>요청문 분량<select aria-label="요청문 분량" value={settings.detail} onChange={e => changeSettings({ detail: e.target.value as PromptSettings['detail'] })}><option value="detailed">상세 · 계좌 소진·연령 구간 포함</option><option value="simple">간단 · 핵심 결과·가정·제한 유지</option></select></label></div></div>
      <p className="profile-help">개인정보·금액 옵션을 바꾸면 기존 편집본도 초기화합니다. 그 외 데이터나 옵션이 바뀌면 기존 요청문은 남겨 두되 재생성 전에는 전체 복사를 막습니다. 외부 AI 서비스의 개인정보·대화 저장 설정은 사용자가 직접 확인하세요.</p>
    </section>
    <section className="benefit-section"><h3>추가 질문</h3><div className="benefit-field"><label>사용자 추가 질문<textarea aria-label="사용자 추가 질문" maxLength={4000} rows={4} value={settings.question} onChange={e => changeSettings({ question: e.target.value })} /></label><small>이름·학교명·계좌번호 등을 입력하지 마세요. 입력은 기기 메모리에만 유지되며 새로고침 시 초기화됩니다.</small></div>
      <label className="checkbox"><input type="checkbox" checked={settings.questionReviewed} onChange={e => changeSettings({ questionReviewed: e.target.checked })} />추가 질문에 직접 식별정보가 없는지 확인했으며, 검토된 질문을 요청문에 포함합니다.</label>
      {settings.question.trim() && <p className="profile-help">{!settings.questionReviewed ? '질문은 확인 전까지 포함하지 않습니다.' : question.omitted ? `의심되는 질문 줄은 제외했습니다. 점검 유형: ${question.findings.join(', ')}` : '확인한 질문을 포함합니다. 자동 탐지는 모든 이름·학교명·식별정보를 탐지하지 못하므로 미리보기를 직접 검토해 주세요.'}</p>}
    </section>
    <section className="benefit-section" aria-label="포함 정보 미리보기"><h3>포함 정보 미리보기</h3><p className="profile-help">아래 항목만 골라 변환하며, 원본 상태 전체나 기존 급여 메모는 내보내지 않습니다. 데이터는 현재 계산 모듈에서 다시 도출하며 미입력은 0원이 아닙니다.</p>
      <ul className="profile-help"><li>기본 조건: 연금제도·연령대·달력상 경과기간</li><li>퇴직 시나리오와 공식 조회액: 금액·월/일시금·세전/세후·조회 조건</li><li>공제회·IRP·연금저축: 잔액·납입·인출·재투자와 수익률 가정</li><li>현금흐름: 생활비·물가·연령별 잔액·부족액·소진과 누락 사항</li><li>계산 신뢰도·검토 근거·가정·완전한 비교의 제한</li></ul>
      {preview.error ? <p className="field-error" role="alert">{preview.error}</p> : preview.result && <div className="prompt-preview">{preview.result.sections.map(s => <details key={s.title}><summary>{s.title}</summary><ul className="profile-help">{s.lines.map((line, i) => <li key={i}>{line}</li>)}</ul></details>)}</div>}
      <label className="checkbox"><input type="checkbox" checked={value.inclusionReviewed} onChange={e => onChange({ ...value, inclusionReviewed: e.target.checked })} />포함 정보의 종류·익명화·금액 표시와 누락 사항을 확인했습니다.</label>
      <button type="button" className="primary" disabled={!value.inclusionReviewed || !preview.result} onClick={() => {
        if (!preview.result) return;
        onChange({ ...value, draft: preview.result.text, original: preview.result.text, generatedKey: sourceKey });
        setMessage(preview.result.questionOmitted ? '요청문을 생성했습니다. 미확인 질문 또는 개인정보 의심 줄은 제외되었습니다.' : '현재 입력과 계산 결과로 요청문을 생성했습니다. 복사 전 내용을 확인해 주세요.');
      }}>AI 요청문 {value.generatedKey ? '다시 생성' : '생성'}</button>
      <p className="profile-help">다시 생성하면 기존 사용자 편집본을 현재 데이터로 대체합니다.</p>
    </section>
    <section className="benefit-section" aria-label="생성된 AI 요청문"><h3>생성된 요청문 · 확인 후 수정 가능</h3>
      {stale && <p className="field-error" role="alert">다른 메뉴의 입력정보 또는 분석 옵션이 변경되었습니다. 현재 계산 결과로 요청문을 다시 생성해 주세요. 이전 편집본은 보존했으며 전체 복사는 보류합니다.</p>}
      {value.draft && value.draft !== value.original && <p className="profile-help">사용자 편집본입니다. 숫자·가정·신뢰도를 바꿨다면 원래 계산 결과와 다시 대조해 주세요.</p>}
      {draftFindings.length > 0 && <p className="field-error" role="alert">편집본의 개인정보 점검 필요: {draftFindings.join(', ')}. 해당 내용을 지우거나 허용 날짜 옵션을 확인한 뒤 복사해 주세요.</p>}
      <div className="benefit-field"><label>AI 분석 요청문<textarea ref={textArea} aria-label="AI 분석 요청문" rows={20} spellCheck={false} value={value.draft} onChange={e => { onChange({ ...value, draft: e.target.value }); setMessage(''); }} /></label></div>
      <div className="comparison-actions"><button className="primary" disabled={!value.draft || stale || draftFindings.length > 0 || !value.inclusionReviewed} onClick={copy}>전체 복사</button><button className="secondary" disabled={!value.draft} onClick={() => { selectText(); setMessage('전체 텍스트를 선택했습니다. 복사 전 개인정보와 계산 조건을 다시 확인하세요.'); }}>전체 텍스트 선택</button></div>
      {message && <p className="feedback" role="status">{message}</p>}
      <p className="profile-help">복사가 지원되지 않거나 권한이 거부되면 전체 선택 후 Ctrl+C 또는 모바일 복사를 사용하세요. 수동 편집·복사에는 자동 검사의 한계가 있으니 직접 식별정보가 남지 않았는지 확인하세요.</p>
    </section>
    <section className="benefit-section"><h3>외부 AI 직접 열기</h3><p className="profile-help">요청문을 복사한 뒤 서비스를 직접 열어 붙여넣으세요. 링크에는 요청문이나 금융 데이터를 붙이지 않습니다. 각 서비스의 계정·요금·이용 조건은 해당 서비스에서 확인하세요.</p><div className="comparison-actions">{aiServices.map(service => <a className="secondary" key={service.name} href={service.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{service.name} 공식 사이트</a>)}</div></section>
    <p className="benefit-disclaimer">{aiDisclaimer}</p>
  </div>;
}
