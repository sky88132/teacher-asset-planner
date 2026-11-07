'use client';
import { useEffect, useMemo, useState } from 'react';
import { createSimpleInputs, schemeNames } from '@/lib/simple/model';
import { calculateSimple } from '@/lib/simple/calculation';
import { todayInKorea } from '@/lib/profile-validation';
import { createPromptWorkspace } from '@/lib/ai/prompt-input';
import { SimpleProfilePanel } from './simple/profile';
import { SimpleKtcuPanel, SimpleAccountsPanel } from './simple/assets';
import { SimpleBenefitsPanel } from './simple/benefits';
import { SimpleOverview } from './simple/overview';
import { SimplePromptPanel } from './simple/prompt';
import { simpleDisclaimer } from '@/lib/simple/config';
const menus = ['교사 기본정보','교직원공제회','IRP·연금저축','퇴직급여 계산','은퇴설계 종합','AI 분석 요청문'];
export function SimplePlanner() {
  const [active, setActive] = useState(0), [input, setInput] = useState(createSimpleInputs);
  const [workspace, setWorkspace] = useState(createPromptWorkspace);
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => { setToday(todayInKorea()); }, []);
  const result = useMemo(() => today ? calculateSimple(input, today) : null, [input, today]);
  if (!today || !result) return <main><p className="profile-help">간편 계산 화면을 준비하고 있습니다.</p></main>;
  const navigate = (index: number) => { setActive(index); window.scrollTo({ top: 0, behavior: 'auto' }); };
  return <div className="shell"><aside className="sidebar"><a className="brand" href="/" onClick={e => { e.preventDefault(); navigate(0); }}><span className="brand-icon">▥</span><span>교사 은퇴 연금<br />시뮬레이터<small>TEACHER RETIREMENT PLANNER</small></span></a><div className="nav-label">나의 은퇴 설계</div>
    <nav aria-label="주요 메뉴">{menus.map((name, i) => <button key={name} className={`nav-item ${active === i ? 'selected' : ''}`} aria-current={active === i ? 'step' : undefined} onClick={() => navigate(i)}><span className="nav-number">{String(i + 1).padStart(2, '0')}</span>{name}</button>)}</nav>
    <div className="privacy"><span>◈ 개인정보 보호</span><p>입력 정보는 저장되지 않으며, 새로고침하면 초기화됩니다.</p></div><div className="sidebar-bottom">선생님의 오늘과 내일을 잇는 설계</div></aside>
    <div className="workspace"><header><span>나의 은퇴 설계 <span className="breadcrumb">/ {menus[active]}</span></span><span className="status"><i />로그인 없는 간편 계산</span></header><main>
      <div className="eyebrow">RETIREMENT PLANNING</div><div className="page-heading"><div><h1>선생님의 다음을 준비하세요.</h1><p>최소한의 입력으로 퇴직 시점의 연금과 적립금을 살펴보세요.</p></div><span className="step-badge">STEP {String(active + 1).padStart(2, '0')} <span>/ 06</span></span></div>
      <div className="mode-bar"><div><strong>간편 계산 모드</strong><span>퇴직일은 기본정보에서 한 번만 입력합니다.</span></div><span className="coming">정밀 계산 모드 · 준비 중</span></div>
      <div className="content-grid"><section className="card form-card"><div className="card-heading"><div><span className="section-tag">{String(active + 1).padStart(2, '0')} · SIMPLE PLAN</span><h2>{menus[active]}</h2></div><span className="outline-icon">▤</span></div>
        {active === 0 ? <SimpleProfilePanel value={input.profile} onChange={profile => setInput({ ...input, profile })} result={result} />
          : active === 1 ? <SimpleKtcuPanel value={input.ktcu} onChange={ktcu => setInput({ ...input, ktcu })} result={result} />
          : active === 2 ? <SimpleAccountsPanel value={input} onChange={setInput} result={result} />
          : active === 3 ? <SimpleBenefitsPanel input={input} onChange={setInput} result={result} />
          : active === 4 ? <SimpleOverview input={input} onChange={setInput} result={result} />
          : <SimplePromptPanel input={input} today={today} value={workspace} onChange={setWorkspace} />}
        <div className="simple-navigation">{active > 0 && <button className="secondary" onClick={() => navigate(active - 1)}>이전 단계</button>}{active < 5 && <button className="primary" onClick={() => navigate(active + 1)}>다음 단계 →</button>}{active === 0 && <button className="secondary" onClick={() => navigate(5)}>AI 요청문으로 바로 이동</button>}</div>
      </section><aside className="right-column"><section className="card summary"><span className="section-tag">MY PLAN</span><h2>나의 퇴직 기준</h2><div className="summary-row"><span>가입 제도</span><strong>{schemeNames[input.profile.scheme]}</strong></div><div className="summary-row"><span>퇴직 방식</span><strong>{input.profile.retirement === 'early' ? '명예퇴직' : '정년퇴직'}</strong></div><div className="summary-row"><span>예상 퇴직일</span><strong>{result.retirement.date ?? '확인 필요'}</strong></div><p>입력한 금융정보는 선택한 퇴직일에 맞춰 자동 갱신됩니다. 공식 조회액의 가정 퇴직일이 다르면 재확인이 필요합니다.</p><button className="secondary" onClick={() => navigate(4)}>종합 결과 보기</button></section><section className="note"><span>참고용 시뮬레이션</span><h3>공식 조회값과 가정을 구분합니다</h3><p>{simpleDisclaimer}</p></section></aside></div>
      <footer>교사 은퇴 연금 시뮬레이터 · 입력 기준일 {today}</footer>
    </main></div></div>;
}
