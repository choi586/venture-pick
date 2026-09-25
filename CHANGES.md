# 변경 파일과 검증 결과

## 수정 파일

| 파일 | 변경 이유 |
|---|---|
| `index.html` | 프로젝트명 실시간 표시, 연결 전 입장 방지, 오류·접근성 안내 |
| `admin.html` | ‘프로젝트명 / 프로젝트·투자 설정’ 용어, 숫자 입력 조건, 오류 안내 |
| `preview.html` | 프로젝트 용어 통일; 기존 샘플 화면 유지 |
| `css/styles.css` | 기존 구성·보라색 디자인 유지, 카드·단상 세부 디자인 개선, 320px 모바일 넘침 및 긴 글자 대응 |
| `js/student.js` | PIN 검증, 자기 조/한도 제한, 중복 클릭 차단, 제출 후 투자자 재선택, 변경된 설정·마감·연결 상태 대응 |
| `js/admin.js` | 관리자 UID 확인, 설정/PIN 원자적 저장, 입력 검증, 실시간 집계, CSV, 마감 후 초기화, 시상식 연출·오디오 처리 |
| `js/common.js` | 총액 우선 순위(평균은 참고), 설정·주소·금액 검증, PIN 해시, 정확한 금액 표시, CSV 수식 방지, 모바일 오디오 준비 |
| `js/default-config.js` | 공개 기본 PIN 제거, PIN 확인용 해시와 설정 버전 추가 |
| `js/firebase.js` | 필수 Firebase 설정 검사 및 초기화 오류 처리 |
| `firestore.rules` | 관리자 등록 확인, 공개 설정/비공개 PIN 분리, 문서 ID·PIN·투자금·한도·잔액·시각 검증, 수정/중복 차단 |
| `firebase.json` | 재현 가능한 로컬 Firestore/Auth 테스트 설정 추가 |
| `.gitignore` | 개발 패키지·테스트 로그·결과물 제외 |
| `README.md` | 초보자용 Firebase/관리자 UID/GitHub Pages/수업 운영 절차와 문제 해결 정리 |

## 추가 파일

- `.nojekyll`: GitHub Pages에서 정적 파일 그대로 제공
- `package.json`, `package-lock.json`: 재현 가능한 개발용 검증 도구; 사이트 운영에 npm/Node 불필요
- `tests/common.test.mjs`: 순위 계산, 금액·URL·설정 검증, PIN 해시, CSV
- `tests/static.test.mjs`: JS 문법, HTML의 상대경로·중복 ID·JS 연결 요소 검사
- `tests/rules.test.mjs`: Firestore 보안 규칙의 허용/거절 시나리오
- `tests/browser.mjs`: 실제 웹 SDK + Firestore/Auth 에뮬레이터 + Chrome 화면 검증
- `CHANGES.md`: 이 변경 기록

`js/firebase-config.js`의 설정 입력 형식은 유지하고, 생성한 Firebase 프로젝트 `venture-pick-bfbe4`의 실제 웹 앱 연결값을 입력했습니다.
`landing/team1.html`~`team4.html`, `assets/team1.svg`~`team4.svg` 샘플은 유지했습니다.

## 검증

2026-09-25, 로컬 환경에서 확인했습니다.

- 기본 로직·문법·상대경로 테스트 6개 통과. 총액과 평균 순위가 달라지는 경우에도 총액 우선으로 정렬하는지 포함합니다.
- Firestore 에뮬레이터 규칙 테스트 7개 통과. 일반 로그인 계정의 관리자 권한 거절, 학생의 제출 조회/삭제 거절, 조별 동일 번호 중복 및 동시 제출 차단, 잘못된 PIN/자기 조 투자/음수/단위 위반/합계 조작/마감 후 제출 거절을 포함합니다.
- 실제 Firebase JavaScript SDK 12.19.0을 사용한 Chrome 테스트 통과: 관리자 이메일 로그인, 기본 세션 생성, 프로젝트명·투자 한도·단위·4개 조 인원/PIN/사업 설명/URL 저장, 학생 번호 표시, PIN 확인, 투자 한도, 남은 금액 확인/취소, 일부·0원 투자, 중복 제출 거절, 투자자 재선택, 실시간 집계, CSV, 접수 마감, 결과 공개, 전체 초기화, 로그아웃.
- 320/390/768/1440px 화면에서 가로 넘침 없음.
- 2위 → 3위 → 1위 등장 순서, 중앙 1위 단상 높이, confetti 생성 확인. 오디오는 버튼 클릭 시 준비하고 1위 등장 시 실행하도록 구현했으며 실제 스피커 소리는 기기에서 확인해야 합니다.
- PC·모바일 화면 캡처를 검토했습니다. 테스트 화면에 사용한 프로젝트명·데이터·Firebase 값은 로컬 에뮬레이터 전용이며 배포 파일에 저장하지 않았습니다.

Firebase 후속 설정: `venture-pick-bfbe4` 프로젝트와 웹 앱을 생성하고, 서울 리전 Firestore 및 보안 규칙 게시, 이메일/비밀번호 로그인 활성화, `choi586.github.io` 승인 도메인 등록을 완료했습니다. 관리자 비밀번호 입력/계정 생성 및 UID 등록, 최초 세션 설정, 실제 로그인·제출 확인은 아직 남아 있습니다. GitHub Pages는 아직 배포하지 않았습니다.
