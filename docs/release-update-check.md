# GitHub·Vercel 업데이트 최종 점검

기준일2026-11-08. 사용자가 최신 코드 검증 후 지정 메시지로 커밋·일반 Push 및 기존 Vercel 자동 배포 확인을 요청했다. 기존 코드/계산/디자인을 추가로 변경하지 않고 문서의 오래된 설명만 현행화했다.

## 저장소와 변경 범위

- 로컬 main, upstream origin/main, 원격 https://github.com/sky88132/teacher-asset-planner.git.
- 시작 커밋 및 원격 main:15d2c5e1759af78585cf610ef8c36f6475259fce. 원격 실제 조회로 일치를 확인했다.
- GitHub 기본 브랜치 main, 기존 main 커밋의 Vercel 체크 success / Deployment has completed. 기존 프로젝트 hans-90df/teacher-asset-planner.
- GitHub에 설정된 홈페이지 https://teacher-asset-planner.vercel.app 는 HTTP200 및 앱 제목을 확인했다. Vercel 공개 개요는 상세 환경·Source 값이 로딩 상태이고 로컬 CLI 인증은 없어 내부 Production Branch 설정은 직접 확인하지 못했다. 기존 main의 Vercel 연결을 사용하며 설정이나 프로젝트를 변경하지 않는다. Push 후 새 커밋의 체크·사이트를 별도로 확인하고 실제 확인된 범위만 보고한다.
- 삭제 파일 없음. 기존 금융 엔진·6메뉴·5/7/8% 가정과 이전 구현은 보존했다. 변경은 완료된 UI/추정/재투자/요청문 개선, 테스트, 문서다. 새 환경변수·패키지·DB·로그인 추가 없음.
- 생성된 next-env.d.ts 변경은 원래 상태로 복원했다. 빌드 산출물·테스트 로그·캡처는 커밋에서 제외한다.

## 민감정보 검사

Git 추적 및 신규 대상 텍스트136개에 비밀키 형태, 개인키 헤더, GitHub/AWS/OpenAI 토큰, 자격증명 대입, URL 내 자격증명, 이메일/전화/주민번호/사용자 홈 경로 패턴을 검사했다. 비밀키/자격증명 패턴은 발견되지 않았다. 개인정보 형태15개 탐지는 테스트의 example.test 이메일·가상 전화/주민번호·가상 식별정보로, 익명화 차단 검증용임을 해당 줄에서 확인했다. 실제 사용자 입력·금융 데이터·.env·비밀키 파일은 포함하지 않는다. 이는 패턴 검사와 변경 내용 검토이며 보안 전문 감사 전체를 의미하지 않는다.

## 이번 실행한 최종 테스트

| 검사 | 결과 |
| --- | --- |
| TypeScript | 통과, 생성 파일 복원 후 재확인 |
| 단위·금융 경계·복리·기존 회귀 | 297/297 통과, 실패0 |
| 브라우저 E2E | Edge 데스크톱/모바일 총114/114 통과, 실패0 |
| 모바일 반응형 | 390px 및320px 에뮬레이션·전 메뉴 가로 넘침·핵심2열 요약 포함 통과 |
| 프로덕션 빌드 | 성공, 정적 페이지 생성 완료 |
| git diff --check | 통과 |
| ESLint | 설정 없음, 미실행 |
| 실제 휴대폰·Safari | 미실행 |

공통 퇴직일·호봉·공제회 일시/분할·월납/연납·퇴직급여/공적연금 추정·재투자 ON/OFF·수령 조건·대시보드·생활비 공유·AI 생성/익명화/편집/복사·입력 변경 후 갱신을 기존 회귀와 신규 테스트로 확인했다. 원 단위 산술과 만원 정수 표시를 분리한다.

법령에 따른 계산 구조 검증과 실제 공단의 개인별 지급액 대조는 별개다. 외부 금액 검증은 미완료이며 화면은 추정/조건부/공식 조회 입력을 구분한다. 기관이 확정한 지급액인 것처럼 표시하는 중대한 문제는 이번 변경 검토에서 발견하지 않았다.

## 남은 금융 검증과 실제 사용자 체크리스트

- 공단 개인 조회와 자동 추정의 차이, 구기간 현가 소득·경과규정·기여/가입 이력·실제 수령일을 확인한다.
- 사학 구기간·이전 경력/휴직/합산 등 지원 외 조건은 금액 보류 상태를 확인한다.
- 공제회 실제 전환 자격·세후 지급액, 연금계좌 한도·공제 이력·재원별 세후액을 확인한다.
-13.2% 재투자는 충분한 세액 여력을 가정한 참고 시나리오이며 실제 환급액/시점·다른 납입·공제와 대조한다.
- 실제 사용자 기기에서 생년월일·임용일·정년/명퇴 입력 후 예상일·호봉을 확인한다.
- 만원 입력/수정/삭제/실제0, 월납↔연납 전환, 재투자 체크·해제, 퇴직일 변경 후 전 메뉴 갱신을 확인한다.
- 공제회 일시/분할 선택에 따른 중복 합산 방지, 미입력 연금·수당의 미확인 표시를 확인한다.
-06에서 생활비 입력/삭제 후05·요청문 반영, 기본정보만 생성, 미리보기 익명화·복사·모바일 수동 복사를 확인한다.
- 새로고침 시 입력 초기화 및 외부 서비스 자동 전송 없음, 실제 iOS Safari/Android Chrome 사용성을 확인한다.

## 커밋 대상 파일

- README.md
- docs/final-release-audit.md
- docs/simple-ui-final-improvement.md
- src/app/planner-theme.css
- src/components/simple-planner.tsx
- src/components/simple/account-receipt.tsx
- src/components/simple/allowance-reference.tsx
- src/components/simple/assets.tsx
- src/components/simple/benefits.tsx
- src/components/simple/overview.tsx
- src/components/simple/profile.tsx
- src/components/simple/prompt.tsx
- src/components/simple/public-pension.tsx
- src/components/simple/retirement-strategy.tsx
- src/components/simple/shared.tsx
- src/lib/finance/irp-tax.ts
- src/lib/simple/allowance-reference.ts
- src/lib/simple/benefit-estimates.ts
- src/lib/simple/calculation.ts
- src/lib/simple/config.ts
- src/lib/simple/currency.ts
- src/lib/simple/model.ts
- src/lib/simple/prompt.ts
- src/lib/simple/reinvestment.ts
- tests/browser/account-receipt.spec.ts
- tests/browser/final-release-audit.spec.ts
- tests/browser/public-pension.spec.ts
- tests/browser/retirement-strategy.spec.ts
- tests/browser/simple-planner.spec.ts
- tests/browser/simple-ui-followup.spec.ts
- tests/browser/simple-ui-improvement.spec.ts
- tests/calculation-upgrade.test.mjs
- tests/final-release-audit.test.mjs
- tests/public-pension.test.mjs
- tests/retirement-strategy.test.mjs
- tests/simple-currency.test.mjs
- tests/simple-planner.test.mjs
- tests/simple-ui-followup.test.mjs
- tests/simple-ui-improvement.test.mjs
- docs/release-update-check.md

지정 커밋 메시지: feat: finalize retirement planner calculations and dashboard

Push 후 Vercel 확인 경로: 기존 프로젝트 Deployments → 해당 Git 커밋 → Ready/Environment/Source Branch 확인. GitHub 새 커밋의 Vercel 체크 링크로 동일 배포를 열고 Production 도메인에서 최신 기능을 확인한다. 자동 배포가 확인되지 않으면 성공으로 보고하지 않는다.
