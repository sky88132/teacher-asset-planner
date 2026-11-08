# 최종 유지보수 점검 보고서

시작일: 2026-11-09 (Asia/Seoul)
작업 폴더: C:\VSCODE\새 폴더\teacher-asset-planner
시작 브랜치: main
시작 커밋: f9fb992885fbd47c3b13c31dc955da7fd9d1da5b feat: finalize retirement planner calculations and dashboard
원격: https://github.com/sky88132/teacher-asset-planner.git

## 작업 시작 시 Git 상태

```text
 M next-env.d.ts
 M src/components/simple/benefits.tsx
 M src/components/simple/overview.tsx
 M src/components/simple/profile.tsx
 M src/components/simple/public-pension.tsx
 M src/components/simple/retirement-strategy.tsx
 M src/lib/simple/benefit-estimates.ts
 M src/lib/simple/calculation.ts
 M src/lib/simple/config.ts
 M src/lib/simple/model.ts
 M src/lib/simple/occupational-pension.ts
 M src/lib/simple/prompt-context.ts
 M src/lib/simple/prompt.ts
 M src/lib/simple/retirement-advice.ts
 M src/lib/simple/retirement-analysis.ts
 M tests/browser/public-pension.spec.ts
 M tests/final-release-audit.test.mjs
 M tests/public-pension.test.mjs
?? docs/teacher-income-pension-model.md
?? src/components/simple/teacher-scenarios.tsx
?? src/lib/simple/teacher-benefits.ts
?? src/lib/simple/teacher-pay.ts
?? src/lib/simple/teacher-pension.ts
?? teacher-browser.log
?? teacher-build.log
?? teacher-unit.log
?? tests/browser/teacher-income-model.spec.ts
?? tests/teacher-income-model.test.mjs
```

시작 상태는 위와 같이 보존했다. 아래는 실제 실행한 유지보수 결과다.


## 1. 중단되었던 작업 복구 결과

시작일2026-11-09(한국), 기존 main에서 이어 작업했다. 초기 tracked변경17개(자동 생성 next-env 제외) 및 신규 교원 모델/문서/테스트가 남아 있었다. 어제 교원 보수·연금 코드의 최초 작성/수정 시각은2026-11-08로 확인했다. 기존 로그 teacher-unit.log/teacher-build.log/teacher-browser.log는 참고자료로 보존하고 이번 실행 결과로 오인하지 않았다. 원본 삭제·초기화·프로젝트 재생성 없음.

중단 직전 단위315개와 타입 검사는 이번에 재실행해 통과를 확인했다. 보수3%·호봉 승급·담임 계속·표준 수당·조건부 공적연금 시나리오·수당 참고 합계·종합·AI 연결은 이미 구현되어 있었다. 미완성 설명이 남아 있던 문서와 README를 현재 구현/검증 범위에 맞춰 보완했다.

## 2. 검증한 기능

| 범위 | 실제 확인한 내용 |
| --- | --- |
| 01 기본정보 | 날짜 직접/달력 입력, 연금3제도, 호봉/승급, 정년/명퇴, 변경시 재계산, 군 승인/미확인 분리 |
| 02 공제회 | 만원 입력→원 계산,5% 가정 적립, 일시/5~30년 가상 분할,25일 일정, 중복 합산 방지 |
| 03 연금계좌 | IRP7%·저축8%, 월말납/12월말 연납 전환·입력 유지, ACT/ACT 복리,13.2% 충분한 세액 여력 가정 재투자, 연간 납입한도·수령 조건 |
| 04 퇴직급여 | 일반 공무원 명퇴68%·잔여월 구간·20년/1년 조건, 퇴직수당 지급률·33년 상한·확인 소득, 구기간 보류, 동일시점 세전 참고 합계 |
| 05 종합 | 개시전 공백, 분할 지급 구간, 공적연금/계좌/일시금 구분, 시점·세금 다른 금액 합산 보류, 생활비와 부분 월수입 비교 |
| 06 AI | 실제 공통 결과·수당 참고 합계·보수 가정·생활비 반영, 익명화·편집·복사·변경 후 재생성, 미확인 금액을0으로 채우지 않음 |

수령 조건/연간 한도용 입력은 실제 월 인출 스케줄이 아니다. 공제회는 공식 상품 급여금이 아닌 가상 모델이다. 재투자는 실제 환급액 확인값이 아니며 다른 자산과 이중 합산하지 않는다. 기존6메뉴·디자인·원 계산/만원 입력·만원 정수 반올림을 유지했다.

## 3. 발견한 오류

중간 심각도의 재현 가능한 계산 불일치1건:1월1일 퇴직처럼 퇴직연도와 마지막 근무연도가 다르면 교원 퇴직수당 소득 기초를 환산하면서 담임·교직·정근가산 고정액까지 연3% 올렸다. “봉급표만 연3% 상승”이라는 기존 가정과 달랐다.

가상2017-04-01 임용·현재20호봉·4월 승급·2040-01-01 퇴직의 기준 소득 기초가9,929,017원으로 계산됐다. 실제 개인 자료가 아니라 표준 보수의 월평균 모델 값이다. 그 밖에 실행한 회귀에서 중대한 미해결 산술·단위·날짜·중복합산 오류는 발견하지 못했다. 오류가 전혀 없거나 개인별 지급액이 맞는다는 인증은 아니다.

## 4. 수정한 오류

teacher-benefits.ts에서 전년도 보수→퇴직연도 환산시 봉급·봉급연동 정근/명절 발생분만3% 인상하고, 고정 수당은 유지한다. 위 가상 사례는9,912,217원으로 변경된다. 같은 연도에는 기존 incomeProxyWon을 유지한다. 새 법정 금융 산식이나 새로운 상품 기능을 추가하지 않았다.

단위 회귀2개와 PC/모바일 브라우저 시나리오1개×2환경을 추가했다. 브라우저에서273개월/39%의 퇴직수당 참고액 표시와 펼친 교원 보수표의320px 가로 넘침 방지를 확인했다. 금액 단위·복리 엔진·5/7/8% 수익률·정년 규칙은 변경하지 않았다.

## 5. 수정한 파일

다음 목록은 어제 미커밋 작업과 이번 보완을 합친 최종 대상이다. 이번 직접 코드 수정은 teacher-benefits.ts의 경계 환산이며 나머지 기존 미커밋 구현은 보존했다. 문서·회귀 테스트를 함께 정리한다.

- README.md
- docs/final-maintenance-report.md
- docs/public-pension-estimation.md
- docs/teacher-income-pension-model.md
- src/components/simple/benefits.tsx
- src/components/simple/overview.tsx
- src/components/simple/profile.tsx
- src/components/simple/public-pension.tsx
- src/components/simple/retirement-strategy.tsx
- src/components/simple/teacher-scenarios.tsx
- src/lib/simple/benefit-estimates.ts
- src/lib/simple/calculation.ts
- src/lib/simple/config.ts
- src/lib/simple/model.ts
- src/lib/simple/occupational-pension.ts
- src/lib/simple/prompt-context.ts
- src/lib/simple/prompt.ts
- src/lib/simple/retirement-advice.ts
- src/lib/simple/retirement-analysis.ts
- src/lib/simple/teacher-benefits.ts
- src/lib/simple/teacher-pay.ts
- src/lib/simple/teacher-pension.ts
- tests/browser/public-pension.spec.ts
- tests/browser/teacher-income-model.spec.ts
- tests/final-release-audit.test.mjs
- tests/public-pension.test.mjs
- tests/teacher-income-model.test.mjs

next-env.d.ts는 시작 당시의 .next/dev/types 참조 상태를 보존하고 제외한다. 기존3개 teacher-*.log, .next, test-results, Playwright 캡처와 임시 설정은 커밋하지 않는다. 로그는 삭제하지 않는다.

## 6. 실제 실행한 검사

| 검사 | 결과 |
| --- | --- |
| TypeScript | 통과 |
| ESLint | 설정/의존성/스크립트 없음, 미실행 |
| 중단 상태 기존 단위 |315/315 통과 |
| 새 경계 대상 단위 | 교원 모델20/20 통과 |
| 최종 전체 단위·금융 경계·복리·회귀 |317/317 통과, 실패0 |
| 프로덕션 빌드 | 성공, 정적 페이지 생성 |
| 새 경계 브라우저 대상 |2/2 통과 |
| 최종 브라우저 E2E | 프로덕션 next start3100, Edge PC/모바일128/128 통과, 실패0 |
| 모바일 |390px 및320px 에뮬레이션, 메뉴·표·그래프·날짜·복사·입력 유지 확인. 캡처 시각 점검 수행 |
| 비밀키·환경변수·개인정보 | 소스143개·공개 JS묶음10개 검사, 키 패턴 없음. PII 형태5개 파일은 익명화 테스트의 가상 데이터 확인. 추적 .env/개인키 파일 없음 |
| 외부 전송/저장 | 소스의 금융 fetch/환경변수 노출/저장/로그 참조 없음. E2E 외부 요청·쓰기 요청·local/sessionStorage 검사 통과 |
| git diff --check | 통과 |
| 실기기·Safari·전체 보안/접근성 전문감사 | 미실행 |

과거 teacher-browser.log의126개 성공은 참고 기록이며 이번 결과는128개다. 테스트 산출물은 로컬 ignored 경로에만 있다. Node의 MODULE_TYPELESS_PACKAGE_JSON 및 NO_COLOR 경고는 기존 실행환경의 비실패 안내로 보존했다.

## 7. 공적연금·퇴직급여 검증 수준

- 공무원: 구기간/2010~2015/2016이후, 연도별 지급률, 이행률·재분배·30년 한도·33~36년 경과상한·종전급여 비교·산입연도·개시연령을 코드와 기존 회귀에서 확인했다. 새 모델에는2010년 이후 신규자 열만 적용하며 다른 경력으로 확장하지 않는다.
- 사학: 기존 독립 소득/부칙 입력 경로 유지. 새 공무원 교원 모델·공무원 평균을 자동 적용하지 않는다. 학교별 명퇴 규정은 자동 확정하지 않는다.
- 국민연금: 실제 납부월·A/B·연도별 계수·공단 확인 크레딧·별도 개시연령 경로 유지. 공무원 군 산입을 국민연금 크레딧으로 복사하지 않는다.
- 보수 모델의3%는 미래 봉급표 가정이다. 승급과 따로 적용하고, 과거 보수는2026 표를 이용한 대체 경로다. 담임20만원·교직25만원·정근/명절·가산금과 비과세 급식16만원을 구분하되 공식 기준소득월액으로 확정하지 않는다.
- 구기간 현가액·특수 경력·군 산입·과거40호봉 경로 등 자료 부족시 월연금/전체 수당을 보류한다. 명퇴 실제 선정·세후액은 확정하지 않는다.
- 교원 참고 합계는 같은 퇴직연도의 미래 명목·세전, 기존 참고 합계는2026 고정·세전으로 구분한다. 2026 환산은 물가 구매력 현재가치가 아니다. 월연금은 목돈/적립금에 더하지 않는다.

## 8. 공식 자료와 비교한 부분 / 비교하지 못한 부분

2026-11-09에 아래 공식 자료를 실제 열람했다. 법령 구조·정액·표 검증과 기관 개인 지급액 검증을 구분한다.

- [인사혁신처2026 교원 봉급표](https://www.mpm.go.kr/mpm/info/resultPay/bizSalary/2026/):1~40호봉 표를 기존 배열과 대조.
- [현행 수당규정](https://www.law.go.kr/LSW/lsInfoR.do?ancYnChk=0&chrClsCd=010202&efYd=20261002&lsiSeq=290323), [별표2](https://www.law.go.kr/LSW/flDownload.do?bylClsCd=110201&flSeq=169637279&gubun=), [별표11](https://www.law.go.kr/LSW/flDownload.do?bylClsCd=110201&flSeq=169637383&gubun=): 정근 구간·가산금·교직/학급담당·급식비 확인. 개인별 지급 자격·실제 명절 지급일은 미검증.
- [현행 공무원연금법](https://www.law.go.kr/LSW/lsInfoR.do?lsiSeq=290745&efYd=20261002&chrClsCd=010202&ancYnChk=0): 제3조·부칙11~13조 등. [공식 시행령 보관본](https://www.nhis.or.kr/lm/lmxsrv/law/lawFullContent.do?SEQ=228&SEQ_HISTORY=): 부칙10조10항 첨부이미지3개를 다운로드해 신규자33개 이행률을 눈으로 대조. [인사혁신처 재분배표](https://www.mpm.go.kr/mpm/info/retireAnnuity/annuityBoard/index.jsp?boardId=bbs_0000000000000124&category=연금&cntId=13&mode=view&pageIdx=2): 개인/전체 평균의 비율 구간 확인.
- [공무원연금공단 퇴직급여 안내](https://www.geps.or.kr/bizInformation_pensionBiz_retirementBenefit_salaryType): 연금/수당 구분, 구·신기간 지급률과33년 수당 상한 확인.
- [현행 국가공무원 명퇴 규정](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=290347)은 일부 본문/별표가 외곽 HTML만 반환했다. 기존 교육청·법령 매뉴얼 교차 검증을 유지하며, 이번에 [2026 인천교육청 사립교원 시행계획](https://iss.ice.go.kr/upload/ice/na/bbs_1482/2026/04/48d7cae05c8fa5e64050e11710f41f95.pdf)에서도68%/잔여기간 구조를 참고 확인했다. 해당 사립 공고를 모든 사학/공무원의 보편 자격 근거로 사용하지 않는다.

미확보: 실제 개인별 과거소득·직종별8개 평균수당·기준소득 적용월 조정·실제 퇴직 전3년 전체 평균·기여/휴직/합산 원장·공단/교육청 산정 숫자 사례의 최종 지급액 대조·세금·선정·끝수 전체. 법령 기준의 모든 개인 예외를 검증했다고 주장하지 않는다. 새 모델은 실제 평균기준소득월액이 아닌 소득 시나리오이며 상수595만원도 실제 미래3년 평균이 아닌 가정 A다.

## 9. Git 커밋

검증된 기능 수정 커밋: 2214f1132258ae7e96602ef18322ebb14495399d

기능 변경은 지정 메시지 chore: complete retirement planner verification and fixes로 저장한다. 시작 원격과 로컬은 f9fb992885fbd47c3b13c31dc955da7fd9d1da5b로 일치했고 같은 메시지의 기존 커밋은 없었다. 강제 Push/이력 재작성/원본 삭제 없음. 완료 결과를 담는 본 보고서는 별도 문서 커밋으로 저장한다.

## 10. GitHub Push

성공. 기능 수정 커밋2214f1132258ae7e96602ef18322ebb14495399d를 origin/main에 일반 Push했고 git ls-remote의 실제 원격 SHA 일치를 확인했다. 기존 main=f9fb992에서 순방향 갱신했으며 강제 Push·이력 재작성은 하지 않았다. 이 완료 보고서는 실제 결과를 기입한 별도 문서 커밋으로 같은 main에 저장한다.

## 11. Vercel

시작 원격 main=f9fb992의 GitHub Vercel 체크 success를 실제 조회했다. 프로젝트 체크 URL은 https://vercel.com/hans-90df/teacher-asset-planner/6TrNdxyJGnqhvoyM3z4nWidVroYU 이다. GitHub deployments API에는 해당 SHA의 환경 레코드가 없었고 Vercel CLI/대시보드 인증은 없어 Production Branch·Preview 보호 등 내부 설정을 직접 조회하지 못했다. main Push가 외부 공개 자동 배포로 이어질 수 있음을 전제로 검사했다.

기능 커밋2214f11 Push 직후 GitHub combined status는 pending이고 개별 status 목록은 비어 있었다. 이 시점에는 자동 배포 시작·Production 성공을 확인할 수 없으므로 성공이라고 보고하지 않는다. 직접 Vercel 배포/프로젝트 생성/설정 변경은 수행하지 않았다. 확인 시점 이후 변할 수 있는 상태이며 최신 결과는 해당 커밋의 Vercel 체크 및 기존 프로젝트 Deployments에서 확인해야 한다.

## 12. 남은 문제·우선순위

1. 가상 연속경력과 공단/교육청 개인 조회 결과를 비식별 검증 데이터로 대조하고, 과거 소득/현가화·실제 기준소득·전체 끝수·선정 조건을 확인한다.
2. 구기간·군 산입/합산·휴직/재임용 등은 확인된 원장 없이 지원 범위를 늘리지 않는다. 현재 보류/한계 안내를 유지한다.
3. 실제 세액 여력·올해 기납입·다른 계좌·추가 공제/납입한도와 공제회 실제 전환 조건을 확인한다.13.2%는 개인 환급액이 아니다.
4. 실제 iOS/Android 기기·Safari 및 전문 접근성/보안 검사를 진행한다. 이번 브라우저 모바일은 에뮬레이션이다.
5. Vercel 내부 Production/Preview 설정과 최신 배포 환경을 계정에서 확인한다. 새 프로젝트·로그인·Supabase·DB·AI API는 추가하지 않았다.
