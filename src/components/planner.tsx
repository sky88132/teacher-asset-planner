'use client';

import { useState } from 'react';
import { changeSchool, initialProfile, toggleSpecialCareer, type PensionScheme, type TeacherProfile, type SpecialCareer } from '@/lib/profile';
import { validateProfileDates, type ProfileDateErrors } from '@/lib/profile-validation';
const pensions: Record<PensionScheme, string> = { civil: '공무원연금', 'private-school': '사학연금', other: '기타 연금제도', unconfirmed: '추가 확인 필요' };
const careers: { value: SpecialCareer; label: string }[] = [
  { value: 'military', label: '군 복무' }, { value: 'parental-leave', label: '육아휴직' },
  { value: 'other-leave', label: '기타 휴직' }, { value: 'combined-service', label: '과거 재직기간 합산' },
];

const sections = ['교사 기본정보', '공적연금·퇴직수당', '교직원공제회', 'IRP·연금저축', '개인연금', '기타 자산·부채', '명퇴·정년 비교', '은퇴 현금흐름', 'AI 분석 요청문'];

export function Planner() {
  const [active, setActive] = useState('교사 기본정보');
  const [profile, setProfile] = useState<TeacherProfile>(initialProfile);
  const [errors, setErrors] = useState<ProfileDateErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  function updateDate(field: 'birthDate' | 'appointmentDate', value: string) {
    const next = { ...profile, [field]: value };
    setProfile(next);
    setMessage('');
    if (submitted) setErrors(validateProfileDates(next));
  }
  return <div className="shell">
    <aside className="sidebar">
      <a className="brand" href="/" onClick={event => { event.preventDefault(); setActive(sections[0]); setMessage(''); }}> <span className="brand-icon">▥</span><span>교사 자산 플래너<small>TEACHER ASSET PLANNER</small></span></a>
      <div className="nav-label">나의 은퇴 설계</div>
      <nav aria-label="주요 메뉴">{sections.map((name, index) => <button key={name} className={active === name ? 'nav-item selected' : 'nav-item'} onClick={() => { setActive(name); setMessage(''); }}><span className="nav-number">{String(index + 1).padStart(2, '0')}</span>{name}</button>)}</nav>
      <div className="privacy"><span>◈ 개인정보 보호</span><p>주민등록번호를 수집하지 않습니다. 현재 입력은 서버에 저장되지 않습니다.</p></div>
      <div className="sidebar-bottom">선생님의 오늘과 내일을 잇는 설계</div>
    </aside>
    <div className="workspace">
      <header><span>나의 은퇴 설계 <span className="breadcrumb">/ {active}</span></span><span className="status"><i />기초 화면 · 저장 미연결</span></header>
      <main>
        <div className="eyebrow">RETIREMENT PLANNING</div>
        <div className="page-heading"><div><h1>선생님의 다음을 준비하세요.</h1><p>흩어진 자산을 한곳에, 은퇴 후의 생활을 더 선명하게.</p></div><span className="step-badge">STEP 01 <span>/ 09</span></span></div>
        <div className="mode-bar"><div><strong>간편 계산 모드</strong><span>기본 정보부터 차근차근 시작하세요.</span></div><span className="coming">정밀 계산 모드 · 준비 중</span></div>
        <div className="content-grid"><section className="card form-card">
          <div className="card-heading"><div><span className="section-tag">{active === sections[0] ? '01 · PROFILE' : '준비 중'}</span><h2>{active}</h2></div><span className="outline-icon">▤</span></div>
          {active === sections[0] ? <form noValidate onSubmit={(event) => {
            event.preventDefault();
            const nextErrors = validateProfileDates(profile);
            setSubmitted(true);
            setErrors(nextErrors);
            setMessage(Object.keys(nextErrors).length ? '' : '기본정보 입력을 확인했습니다. 현재 앱에서만 유지되며 서버에는 저장되지 않습니다. 금융 계산은 아직 제공하지 않습니다.');
            if (Object.keys(nextErrors).length) {
              event.currentTarget.querySelector<HTMLInputElement>(nextErrors.birthDate ? '[name="birthDate"]' : '[name="appointmentDate"]')?.focus();
            }
          }}>
            <p className="form-description">연금 제도를 구분하기 위한 기본정보를 입력해 주세요.</p>
            <fieldset><legend>학교 구분</legend><div className="school-options"><label className={profile.schoolType === 'public' ? 'school chosen' : 'school'}><input type="radio" name="school" value="public" checked={profile.schoolType === 'public'} onChange={() => { setProfile(p => changeSchool(p, 'public')); setMessage(''); }} /><strong>국공립학교</strong><small>공무원연금 기본 선택</small></label><label className={profile.schoolType === 'private' ? 'school chosen' : 'school'}><input type="radio" name="school" value="private" checked={profile.schoolType === 'private'} onChange={() => { setProfile(p => changeSchool(p, 'private')); setMessage(''); }} /><strong>사립학교</strong><small>사학연금 기본 선택</small></label></div></fieldset>
            <label className="pension-field">가입 연금제도 확인<select value={profile.pension.source === 'school-default' ? 'school-default' : profile.pension.scheme} onChange={event => {
              const value = event.target.value;
              setProfile(p => value === 'school-default'
                ? changeSchool({ ...p, pension: { ...p.pension, source: 'school-default' } }, p.schoolType)
                : { ...p, pension: { scheme: value as PensionScheme, source: 'user-selected' } });
              setMessage('');
            }}><option value="school-default">학교 구분에 따른 기본값</option>{Object.entries(pensions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <p className="profile-help">학교 구분만으로 실제 가입 제도를 확정할 수 없습니다. 직접 선택한 연금제도는 학교를 변경해도 유지됩니다.</p>
            <div className="fields"><label>생년월일<input type="date" name="birthDate" aria-label="생년월일" required value={profile.birthDate} onChange={e => updateDate('birthDate', e.target.value)} aria-invalid={!!errors.birthDate} aria-describedby={errors.birthDate ? 'birthDate-error' : undefined} />{errors.birthDate && <span id="birthDate-error" className="field-error" role="alert">{errors.birthDate}</span>}</label><label>최초 임용일<input type="date" name="appointmentDate" aria-label="최초 임용일" required value={profile.appointmentDate} onChange={e => updateDate('appointmentDate', e.target.value)} aria-invalid={!!errors.appointmentDate} aria-describedby={errors.appointmentDate ? 'appointmentDate-error' : undefined} />{errors.appointmentDate && <span id="appointmentDate-error" className="field-error" role="alert">{errors.appointmentDate}</span>}</label></div>
            <fieldset className="special"><legend>특수 경력 확인 · 복수 선택</legend><div className="career-options">{careers.map(career => <label className="checkbox" key={career.value}><input type="checkbox" checked={profile.specialCareers.includes(career.value)} onChange={() => { setProfile(p => toggleSpecialCareer(p, career.value)); setMessage(''); }} />{career.label}</label>)}</div><p>{profile.hasSpecialCareer ? '군 복무, 휴직, 경력 합산 등은 간편 계산에 일부 반영되지 않을 수 있습니다. 정확한 금액은 공식 연금 조회 결과를 확인해 주세요.' : '특수 경력은 연금 가입기간과 지급액에 영향을 줄 수 있습니다.'}</p><p>현재 특수 경력 상세 입력은 제공하지 않으며, 선택한 경력은 계산에 반영되지 않습니다. 소급기여금 이력도 공식 조회 시 확인해 주세요.</p></fieldset>
            <div className="form-footer"><span>메뉴 이동 시 유지됩니다. 새로고침하면 초기화됩니다.</span><button className="primary" type="submit">입력 확인 <span>→</span></button></div>
          </form> : <div className="empty"><span>◇</span><h3>다음 단계에서 연결됩니다.</h3><p>공식 자료 검토와 계산 검증 후 제공할 예정입니다.<br/>현재 표시할 계산 결과가 없습니다.</p><button className="secondary" onClick={() => setActive(sections[0])}>기본정보 입력으로 돌아가기</button></div>}
          {message && <p className="feedback" role="status">{message}</p>}
        </section>
        <aside className="right-column"><section className="card summary"><span className="section-tag">MY PLAN</span><h2>은퇴 설계 미리보기</h2><p>기본정보를 바탕으로<br/>나만의 은퇴 지도를 만듭니다.</p><div className="summary-row"><span>선택 연금</span><strong>{pensions[profile.pension.scheme]}</strong></div><div className="summary-row"><span>예상 은퇴자산</span><strong className="muted">계산 전</strong></div><div className="summary-row"><span>월 은퇴 현금흐름</span><strong className="muted">계산 전</strong></div><div className="chart-placeholder" aria-label="계산 결과 준비 중"><div /><div /><div /><div /><div /><div /><span>자산 입력 후 확인할 수 있어요</span></div></section><section className="note"><span>알아두세요</span><h3>정확한 설계를 위한 첫걸음</h3><p>간편 모드는 참고용 설계 도구입니다. 실제 연금과 수당은 공단 및 소속 기관의 확인이 필요합니다.</p><p>현재 단계에서는 금융 계산을 제공하지 않습니다.</p></section></aside></div>
        <footer>교사 자산 플래너 <span>·</span> 선생님의 안정적인 내일을 함께 준비합니다.</footer>
      </main>
    </div>
  </div>;
}
