# GitHub 연결 복구 및 코드 보존

2026-11-09, Asia/Seoul.

- 원본: `C:\vscode\teacher-asset-planner-main`. `.git` 없는 작업 복사본을 삭제·초기화하지 않았다. 소스·설정·테스트·문서155개에 대해 SHA-256 보존 검사를 수행한다.
- Clone: `C:\vscode\teacher-asset-planner`. 대상 경로가 없음을 확인한 뒤 기존 GitHub 저장소를 새로 Clone했다.
- 원격: `https://github.com/sky88132/teacher-asset-planner.git`.
- 비교 기준: `origin/main`의 `8a767ba1f27c3dbecf2e4cda7fb4a12c3950a445`.
- 보존·게시 브랜치: `fix/stabilize-pension-benefits`. main에 직접 Push하거나 강제 Push하지 않는다. Vercel 설정에 따라 이 브랜치의 Preview 배포가 생성될 수 있으므로 실제 상태는 GitHub commit Checks와 기존 Vercel 프로젝트 Deployments에서 확인한다.

## 비교와 선택적 반영

원본/Clone153개 공통 파일과 원본에만 있는 문서2개를 비교했다. 줄바꿈만 다른136개 파일은 복사하지 않았다. 원격에만 있는 파일은 없었다. 로컬 내용 차이17개 중 아래 생성·설치 차이2개는 반영하지 않았다.

- `package-lock.json`: 의존성 버전·다운로드 integrity 변경이 아닌28개 선택 패키지의 libc 메타데이터 누락만 확인했다. 원격 lockfile을 유지해 Linux glibc/musl 선택 정보를 보존했다.
- `next-env.d.ts`: Next.js dev/build가 생성한 경로 차이로, 원본 파일을 복사하지 않고 Clone의 Next.js가 생성하도록 했다.

반영한17개는 소스10개, 테스트4개, 개발 문서2개, `.gitignore`의 `.tools/` 제외1개다. 원본과 복사 직후 바이트 해시를 대조했다. 금융계산 엔진 전체를 다시 작성하거나 원격 파일 전체를 덮어쓰지 않았다. 이 복구 기록 문서는 별도로 추가했다.

| 작업 | 보존한 내용 |
| --- | --- |
| 연금 상태 연결 | 날짜 확인값을 실제 소득 입력과 구분, 기본정보 기반 교원 추정, 공식 조회 우선 및 오류 상태 |
| 퇴직급여 | 명퇴→퇴직수당→참고 합계, 금액 기본 표시·근거 접기, 동일 가격/세전 기준의 원 합계 |
| 종합·AI | 04·05·06의 공통 참고 결과·가격 기준·가정 수준 |
| 회귀 검사 | 날짜 확인/변경, 기본 노출·순서, 기준 일치와 화면 연결 |

연3% 봉급표 상승·별도 호봉 승급·담임 계속·표준 수당의 기존 모델은 유지했다. IRP·연금저축·세액공제 재투자·기존6메뉴와 디자인 파일의 내용은 변경하지 않았다. 개인정보 입력·브라우저 세션은 복사하지 않았고 `node_modules`, `.next`, `.env*`, 도구·캐시·테스트 산출물은 Git 반영 대상에서 제외했다.

## 검증과 게시 조건

Clone에서 시스템 Node.js v26.13.0 / npm11.20.0을 사용한다. 원본 node_modules를 복사하지 않고 원격 lockfile에 `npm.cmd ci`를 실행했다.

검증 결과: npm.cmd ci successful; TypeScript exit0; 437 unit tests passed; production build exit0; 154 desktop/mobile E2E tests passed, exit0.

Push 전에 원격 main이 비교 기준과 같은지, 새 브랜치가 원격에 없는지, 전체 검사 통과 및 변경 파일의 민감정보 패턴 부재를 확인한다. 조건이 달라지면 중단한다. 원격 업데이트가 있다면 자동 덮어쓰기하지 않는다.

공무원연금·수당 결과는 가정 기반 참고 추정이며 확정 지급액이 아니다. 실제 과거 소득·직종별 평균수당·법정 재평가·개인 경과규정 자료가 없는 범위는 화면에 미확인/미지원으로 표시한다. 코드 산술·회귀 검증과 실제 공단 개인 지급액 대조는 별개다. 후자는 미완료 상태를 유지한다.
