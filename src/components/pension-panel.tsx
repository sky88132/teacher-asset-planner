'use client';

import { useState, type ReactNode } from 'react';
import type { TeacherProfile, PensionScheme } from '@/lib/profile';
import { benefitDisclaimer, type BenefitInput, type MoneyInput, type PensionInputs, type SchemeInputs } from '@/lib/finance/pension-input';
import { changeMoneyUnit, parseMoney, validateBenefit, validatePreparation } from '@/lib/finance/pension-input-validation';

const schemeNames = { civil: '공무원연금', 'private-school': '사학연금' };

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return <div className="benefit-field"><label htmlFor={id}>{label}</label>{children}
    {error && <span id={`${id}-error`} className="field-error" role="alert">{error}</span>}</div>;
}

function MoneyField({ id, label, value, onChange, error }: {
  id: string; label: string; value: MoneyInput; onChange: (value: MoneyInput) => void; error?: string;
}) {
  const parsed = parseMoney(value);
  const visibleError = error ?? parsed.error;
  return <Field id={id} label={label} error={visibleError}>
    <div className="money-input"><input id={id} type="text" inputMode="decimal" value={value.amount}
      aria-invalid={!!visibleError} aria-describedby={visibleError ? `${id}-error` : undefined}
      onChange={event => onChange({ ...value, amount: event.target.value })} />
      <select aria-label={`${label} 단위`} value={value.unit}
        onChange={event => onChange(changeMoneyUnit(value, event.target.value as MoneyInput['unit']))}>
        <option value="won">원</option><option value="manwon">만 원</option>
      </select></div>
    <small>단위를 바꾸면 같은 금액으로 환산합니다. 미입력과 0원은 구분합니다.</small>
  </Field>;
}

function BenefitEditor({ kind, value, onChange, profile, scheme }: {
  kind: 'pension' | 'allowance'; value: BenefitInput; onChange: (value: BenefitInput) => void;
  profile: TeacherProfile; scheme: keyof typeof schemeNames;
}) {
  const [attempted, setAttempted] = useState(false);
  const errors = validateBenefit(value, kind, profile);
  const valid = Object.keys(errors).length === 0;
  const title = kind === 'pension' ? '예상 월연금' : '예상 퇴직수당';
  const update = <K extends keyof BenefitInput>(field: K, next: BenefitInput[K]) => onChange({ ...value, [field]: next });
  const error = (field: keyof BenefitInput) => attempted ? errors[field] : undefined;
  const dateField = (field: 'queryDate' | 'retirementDate' | 'startDate', label: string) => {
    const id = `${kind}-${field}`;
    return <Field id={id} label={label} error={error(field)}><input id={id} type="date" value={value[field]}
      aria-invalid={!!error(field)} aria-describedby={error(field) ? `${id}-error` : undefined}
      onChange={event => update(field, event.target.value)} /></Field>;
  };
  return <section className="benefit-section" aria-labelledby={`${kind}-heading`}>
    <h3 id={`${kind}-heading`}>{kind === 'pension' ? '01 · 월연금 입력' : '02 · 퇴직수당 직접 입력'}</h3>
    <p className="profile-help">{kind === 'pension' ? '공단 조회액 또는 직접 추정한 월 금액을 입력해 주세요.' : '연금과 별도로 받는 일시금입니다. 명예퇴직수당·퇴직연금일시금과 구분해 입력해 주세요.'}</p>
    <form noValidate onSubmit={event => {
      event.preventDefault(); setAttempted(true);
      if (!valid) {
        const first = Object.keys(errors)[0];
        event.currentTarget.querySelector<HTMLElement>(`#${kind}-${first}`)?.focus();
      }
    }}>
      <div className="benefit-fields">
        <MoneyField id={`${kind}-money`} label={`${title}액`} value={value.money} onChange={next => update('money', next)} error={error('money')} />
        <Field id={`${kind}-taxBasis`} label={`${title} 세전·세후`} error={error('taxBasis')}>
          <select id={`${kind}-taxBasis`} value={value.taxBasis} aria-invalid={!!error('taxBasis')}
            aria-describedby={error('taxBasis') ? `${kind}-taxBasis-error` : undefined}
            onChange={event => update('taxBasis', event.target.value as BenefitInput['taxBasis'])}>
            <option value="">선택해 주세요</option><option value="gross">세전</option><option value="net">세후</option>
          </select>
        </Field>
        {dateField('queryDate', `${title} 조회 기준일`)}
        {dateField('retirementDate', `${title} 산정 시 가정한 퇴직일`)}
        {kind === 'pension' && dateField('startDate', '예상 연금 지급개시일')}
        <Field id={`${kind}-source`} label={`${title} 입력 출처`} error={error('source')}>
          <select id={`${kind}-source`} value={value.source} aria-invalid={!!error('source')}
            aria-describedby={error('source') ? `${kind}-source-error` : undefined}
            onChange={event => update('source', event.target.value as BenefitInput['source'])}>
            {kind === 'pension' && <option value="">선택해 주세요</option>}
            <option value="official">공식 조회값 · 사용자 직접 입력</option>
            {kind === 'pension' && <option value="user-estimate">사용자 추정값 · 미검증</option>}
          </select>
        </Field>
      </div>
      <Field id={`${kind}-assumptions`} label={`${title} 추가 가정·확인할 사항 (선택)`}>
        <textarea id={`${kind}-assumptions`} rows={2} maxLength={2000} value={value.assumptions}
          onChange={event => update('assumptions', event.target.value)} />
      </Field>
      <p className="profile-help">공식 조회값도 사용자가 직접 입력한 값입니다. 앱이 기관에서 조회하거나 입력값의 진위를 확인하지 않습니다. 세전·세후 변환은 하지 않습니다.</p>
      <button type="submit" className="secondary">{title} 입력 확인</button>
      {attempted && <p className="profile-help" role="status">{valid ? '입력을 확인했습니다. 아래에 입력 조건 그대로 표시합니다.' : '표시된 입력 항목을 확인해 주세요.'}</p>}
    </form>
    <section className="benefit-result" aria-label={`${title} 결과`}>
      <div className="benefit-result-heading"><h4>{title}</h4><span className="coming">{kind === 'pension' ? '월 지급' : '일시금'}</span></div>
      <strong className="benefit-amount">{valid ? `${parseMoney(value.money).won!.toLocaleString('ko-KR')}원` : value.money.amount.trim() ? '입력 확인 필요' : '미입력'}</strong>
      {!valid ? <p className="profile-help">{value.money.amount.trim() ? '금액·출처·날짜·세전/세후를 모두 확인한 뒤 표시합니다.' : '아직 금액이 없습니다. 0원으로 처리하지 않습니다.'}</p> : <>
        <dl className="benefit-details">
          <dt>제도</dt><dd>{schemeNames[scheme]}</dd>
          <dt>세전·세후</dt><dd>{value.taxBasis === 'gross' ? '세전' : '세후'} · 입력값 그대로</dd>
          <dt>조회 기준일</dt><dd>{value.queryDate}</dd>
          <dt>입력 출처</dt><dd>{value.source === 'official' ? '공식 조회값 · 사용자 직접 입력 (진위 미확인)' : '사용자 추정값 · 미검증 (앱 계산 아님)'}</dd>
          <dt>가정한 퇴직일</dt><dd>{value.retirementDate}</dd>
          {kind === 'pension' && <><dt>지급개시일</dt><dd>{value.startDate}</dd></>}
          <dt>추가 가정</dt><dd>{value.assumptions.trim() || '추가 가정 미입력'}</dd>
          <dt>확인 필요</dt><dd>조회 당시의 재직기간·소득·퇴직일 및 세금·공제 반영 여부를 확인해 주세요. 다른 날짜의 금액으로 자동 환산하지 않습니다.
            {value.source === 'user-estimate' && ' 사용자 추정액은 공식 산식으로 검증되지 않았습니다.'}
            {profile.hasSpecialCareer && ' 기본정보에 선택한 특수 경력의 반영 여부도 공단에서 확인해 주세요.'}
            {profile.pension.source === 'school-default' && ' 가입제도는 학교 구분의 기본값이므로 실제 가입을 확인해 주세요.'}
            {(!profile.birthDate || !profile.appointmentDate) && ' 교사 기본정보의 날짜가 미입력 상태입니다.'}
          </dd>
        </dl>
      </>}
      <p className="benefit-disclaimer">{benefitDisclaimer}</p>
    </section>
  </section>;
}

export function PensionPanel({ profile, inputs, onChange, onSchemeChange }: {
  profile: TeacherProfile; inputs: PensionInputs; onChange: (value: PensionInputs) => void;
  onSchemeChange: (scheme: PensionScheme) => void;
}) {
  const [preparationAttempted, setPreparationAttempted] = useState(false);
  const scheme = profile.pension.scheme;
  const supported = scheme === 'civil' || scheme === 'private-school';
  const data = supported ? inputs[scheme] : null;
  const update = (value: Partial<SchemeInputs>) => {
    if (supported) onChange({ ...inputs, [scheme]: { ...inputs[scheme], ...value } });
  };
  const prep = data?.preparation;
  const prepErrors = prep ? validatePreparation(prep) : {};
  return <div className="pension-panel">
    <p className="form-description">공적연금 조회 금액과 산정 조건을 함께 기록하세요.</p>
    <label className="pension-field">공적연금 입력 제도<select value={scheme} onChange={event => onSchemeChange(event.target.value as PensionScheme)}>
      <option value="civil">공무원연금</option><option value="private-school">사학연금</option>
      <option value="other">기타 연금제도</option><option value="unconfirmed">추가 확인 필요</option>
    </select></label>
    <p className="profile-help">교사 기본정보와 연동됩니다. 제도별 입력은 따로 유지하며, 제도를 바꾸어도 기존 금액을 다른 제도로 옮기지 않습니다.</p>
    <div className="profile-context">생년월일: {profile.birthDate || '미입력'} · 최초 임용일: {profile.appointmentDate || '미입력'}<br />
      특수 경력: {profile.hasSpecialCareer ? '선택됨 · 인정기간은 공단 확인 필요' : '선택 없음 · 실제 경력 확인 필요'}</div>
    {supported && data && prep ? <>
      <BenefitEditor key={`${scheme}-pension`} kind="pension" value={data.pension} onChange={pension => update({ pension })} profile={profile} scheme={scheme} />
      <BenefitEditor key={`${scheme}-allowance`} kind="allowance" value={data.allowance} onChange={allowance => update({ allowance })} profile={profile} scheme={scheme} />
      <section className="benefit-section" aria-labelledby="preparation-heading">
        <h3 id="preparation-heading">03 · 퇴직수당 자동 계산 준비</h3>
        <p className="profile-help">퇴직수당용 인정기간은 연금 재직기간과 다를 수 있습니다. 공단에서 확인한 정보를 입력해 주세요.</p>
        <form noValidate onSubmit={event => { event.preventDefault(); setPreparationAttempted(true); }}>
          <div className="benefit-fields">
            {(['years', 'months'] as const).map(field => <Field key={field} id={`prep-${field}`} label={`수당 인정 재직기간 (${field === 'years' ? '년' : '월'})`} error={preparationAttempted ? prepErrors[field] : undefined}>
              <input id={`prep-${field}`} inputMode="numeric" value={prep[field]} aria-invalid={preparationAttempted && !!prepErrors[field]}
                aria-describedby={preparationAttempted && prepErrors[field] ? `prep-${field}-error` : undefined}
                onChange={event => update({ preparation: { ...prep, [field]: event.target.value } })} />
            </Field>)}
            <MoneyField id="prep-income" label="최종 기준소득월액" value={prep.finalIncome} error={preparationAttempted ? prepErrors.finalIncome : undefined}
              onChange={finalIncome => update({ preparation: { ...prep, finalIncome } })} />
            <Field id="prep-before2010" label="2009년 이전 재직 여부" error={preparationAttempted ? prepErrors.before2010 : undefined}>
              <select id="prep-before2010" value={prep.before2010} aria-invalid={preparationAttempted && !!prepErrors.before2010}
                aria-describedby={preparationAttempted && prepErrors.before2010 ? 'prep-before2010-error' : undefined}
                onChange={event => update({ preparation: { ...prep, before2010: event.target.value as typeof prep.before2010 } })}>
                <option value="">선택해 주세요</option><option value="yes">있음</option><option value="no">없음</option><option value="unknown">확인 필요</option>
              </select>
            </Field>
            <Field id="prep-special" label="휴직·경력 합산 등 특수 경력 여부">
              <select id="prep-special" value={prep.specialCareer} onChange={event => update({ preparation: { ...prep, specialCareer: event.target.value as typeof prep.specialCareer } })}>
                <option value="profile">기본정보 연동 · {profile.hasSpecialCareer ? '선택됨' : '선택 없음'}</option><option value="yes">있음</option><option value="no">없음</option><option value="unknown">확인 필요</option>
              </select>
            </Field>
          </div>
          <p className="profile-help">최초 임용일로 수당 인정기간이나 과거 경력 합산 여부를 자동 확정하지 않습니다.</p>
          <button className="secondary" type="submit">준비 입력 확인</button>
          {preparationAttempted && <p role="status" className="profile-help">{Object.keys(prepErrors).length ? '준비 입력의 오류를 확인해 주세요.' : '준비 입력을 확인했습니다. 자동 계산은 아직 제공하지 않습니다.'}</p>}
        </form>
        <div className="benefit-result"><h4>자동 계산 결과 · 계산 불가</h4><p className="profile-help">공식 산식의 적용 범위·예외·경과규정 검증이 남아 있습니다. 입력을 모두 채워도 자동 계산 금액을 표시하지 않습니다. 공식 예상 퇴직수당은 위 직접 입력 영역에서 기록할 수 있습니다. 명예퇴직수당은 포함하지 않습니다.</p></div>
      </section>
    </> : <p className="feedback">선택한 연금제도는 입력 지원 대상이 아닙니다. 실제 가입이 확인된 공무원연금 또는 사학연금을 선택해 주세요. 기존 제도별 입력은 유지됩니다.</p>}
    <p className="profile-help">메뉴 이동 시 유지됩니다. 새로고침하면 초기화됩니다. 서버·브라우저 저장소에는 저장하지 않습니다.</p>
  </div>;
}
