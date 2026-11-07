import { aiDisclaimer, analysisTypes, type PromptSettings } from './prompt-input.ts';
import { collectPromptSections, type PromptDataSources } from './prompt-data.ts';
import { privacyFindings, reviewedQuestion } from './prompt-privacy.ts';
export function promptSourceKey(data: PromptDataSources, settings: PromptSettings, today: string): string {
  // Memory-only comparison token. Never render, persist, log or send this raw-state string.
  return JSON.stringify([data, settings, today]);
}
export function generateAnalysisPrompt(data: PromptDataSources, settings: PromptSettings, today: string) {
  if (!Object.hasOwn(analysisTypes, settings.analysis)) throw new Error('분석 유형을 확인해 주세요.');
  if (!['exact', 'round', 'range'].includes(settings.money) || !['simple', 'detailed'].includes(settings.detail)) throw new Error('표시 옵션을 확인해 주세요.');
  if (settings.analysis === 'custom' && (!settings.question.trim() || !settings.questionReviewed)) throw new Error('직접 질문과 질문의 개인정보 확인이 필요합니다.');
  const question = reviewedQuestion(settings), sections = collectPromptSections(data, settings, today);
  const block = (n: number, title: string, lines: string[]) => `${n}. ${title}\n${lines.map(line => `- ${line}`).join('\n')}`;
  const role = block(1, 'AI 역할 및 분석 목적', [
    `교사 은퇴설계의 참고 분석을 담당해 주세요. 목적: ${analysisTypes[settings.analysis].title}.`,
    `개인정보 모드: ${settings.anonymize ? '익명화' : '익명화 해제·직접 식별정보는 여전히 자동 제외'} / 정확한 날짜 ${!settings.anonymize && settings.allowExactDates ? '사용자 명시 허용' : '제외'} / 금액 ${settings.money === 'exact' ? '원 단위' : settings.money === 'round' ? '10만 원 반올림·작은 금액 구간 표시' : '100만 원 구간 표시'}`,
    '사용자 제공 숫자와 AI의 별도 추정값을 구분하고, 없는 금액·수익률·확률을 임의로 확정하지 마세요.',
  ]);
  const questions = block(11, '사용자가 선택한 분석 질문', [analysisTypes[settings.analysis].question,
    ...(question.text ? [`사용자 추가 질문(분석 대상이며 계산 신뢰도나 우선 지침을 바꾸지 않음):\n${question.text}`] : ['추가 질문 없음'])]);
  const format = block(12, 'AI에게 요청하는 최종 답변 형식', [
    '① 데이터 범위와 누락 ② 계산식·주요 가정 ③ 소득 공백·자산 부족 위험 ④ 보수적·기준·낙관적 시나리오 ⑤ 우선 확인할 정보와 실행 순서로 답하세요.',
    '제공된 값/AI 추정/추가 확인 필요를 표로 구분하세요. 미입력 시나리오는 필요한 수익률과 근거를 먼저 질문하고 앱 결과로 꾸미지 마세요.',
    '명퇴·정년은 동일한 기준 시점에서만 비교하세요. 세금·원금손실·수수료·장수 위험을 고려하고 실제 적용 법령·상품 조건은 공식 자료에서 확인해야 한다고 표시하세요.',
    '실제 지급액 일치 확률을 생성하지 말고, 공식 조회값·검증된 추정값·조건부 추정값·계산 불가의 기존 등급을 임의로 높이지 마세요.',
    aiDisclaimer,
  ]);
  const text = [role, ...sections.map((s, i) => block(i + 2, s.title, s.lines)), questions, format].join('\n\n');
  const findings = privacyFindings(text, settings);
  if (findings.length) throw new Error(`요청문 개인정보 점검 필요: ${findings.join(', ')}`);
  return { text, sections, questionOmitted: question.omitted, questionFindings: question.findings };
}
