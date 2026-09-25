# Venture Pick — 수업용 모의투자 프로젝트

학생이 자기 조를 제외한 3개 사업에 가상 투자하고, 교사가 실시간 제출 현황과 최종 순위를 확인하는 웹사이트입니다.
**GitHub Pages + Firebase Firestore + Firebase Authentication**으로 동작합니다. 운영에 Node 서버, 빌드, Cloud Functions는 필요하지 않습니다.

- 학생 화면: `index.html`
- 관리자 화면: `admin.html`
- 디자인 미리보기: `preview.html` (더블클릭 가능, 실제 제출 기능 없음)
- 실제 학생/관리자 화면은 `file://`로 열지 말고 GitHub Pages의 HTTPS 주소로 접속하세요.

## 현재 연결 상태

- Firebase 프로젝트: `venture-pick-bfbe4` / 표시 이름 `venture-pick`
- 요금제: Spark (무료)
- 웹 앱: `Venture Pick Web`; `js/firebase-config.js`에 실제 연결값 입력 완료
- Firestore: `(default)`, Standard, 서울 `asia-northeast3`; 검증한 보안 규칙 게시 완료
- Authentication: 이메일/비밀번호 로그인 활성화 완료
- 승인된 GitHub Pages 도메인: `choi586.github.io`
- 관리자 계정 생성 및 관리자 UID 등록 완료
- 관리자 로그인과 기본 세션 생성, 학생 화면의 실제 Firestore 설정 읽기 확인 완료
- 남은 작업: 관리자 화면에서 조별 PIN 입력 및 설정 저장 → GitHub Pages 배포
- GitHub Pages 배포는 아직 진행하지 않았습니다.

[Firebase 콘솔 열기](https://console.firebase.google.com/project/venture-pick-bfbe4/overview)

아래 1장은 새 프로젝트를 다시 구성할 때의 안내입니다. 현재 프로젝트를 다시 만들거나 연결값을 placeholder로 바꾸지 마세요.

## 1. Firebase 만들기

### 1-1. 프로젝트와 웹 앱 등록

1. [Firebase Console](https://console.firebase.google.com/)에서 **프로젝트 만들기**를 누릅니다.
2. 프로젝트 개요에서 **웹 앱 `</>` 추가**를 누르고 이름을 정합니다. Firebase Hosting은 선택하지 않아도 됩니다.
3. 웹 앱의 `firebaseConfig`에 표시된 설정값을 복사합니다. 나중에는 **프로젝트 설정 → 일반 → 내 앱 → SDK 설정 및 구성**에서 다시 찾을 수 있습니다.
4. `js/firebase-config.js`를 열고 **아래 객체의 값만** 실제 값으로 바꿉니다. 파일 맨 앞의 `export const FIREBASE_CONFIG =`는 유지하세요.

```js
export const FIREBASE_CONFIG = {
  apiKey: "Firebase에서 복사한 값",
  authDomain: "내프로젝트.firebaseapp.com",
  projectId: "내프로젝트ID",
  storageBucket: "Firebase에서 복사한 값",
  messagingSenderId: "Firebase에서 복사한 값",
  appId: "Firebase에서 복사한 값"
};
```

이 값은 브라우저 연결용 공개 설정입니다. 관리자 비밀번호, 서비스 계정 JSON, 개인 키를 넣지 마세요. Firebase 설정값 자체가 관리자 권한을 부여하지는 않습니다.

### 1-2. Firestore 생성 및 규칙 적용

1. **빌드 → Firestore Database → 데이터베이스 만들기**를 누릅니다.
2. **Standard 에디션**, 기본 데이터베이스 **`(default)`**, 프로덕션 모드를 선택합니다. 위치는 수업 장소와 가까운 곳을 선택하세요.
3. **규칙(Rules)** 탭에서 기존 내용을 지우고 이 프로젝트의 **`firestore.rules` 전체 내용**을 붙여넣습니다.
4. **게시(Publish)**를 누릅니다. 테스트 모드의 전체 허용 규칙을 그대로 사용하면 안 됩니다.

### 1-3. 관리자 계정 만들기

1. **빌드 → Authentication → 시작하기**를 누릅니다.
2. **로그인 방법(Sign-in method) → 이메일/비밀번호(Email/Password)**를 켭니다. 이메일 링크 로그인이나 익명 로그인은 필요하지 않습니다.
3. **사용자(Users) → 사용자 추가(Add user)**에서 관리자 이메일과 비밀번호를 등록합니다.
4. 생성된 사용자의 **UID**를 복사합니다. 이메일 주소와는 다른 긴 문자열입니다.

### 1-4. 해당 계정을 관리자로 지정 — 반드시 필요

로그인 계정이 있다는 이유만으로 관리자 권한을 주지 않습니다. Firebase Console에서 아래 문서를 직접 만드세요.

1. **Firestore Database → 데이터(Data) → 컬렉션 시작**을 누릅니다.
2. 컬렉션 ID: **`admins`**
3. 문서 ID: **방금 복사한 관리자 UID** (자동 ID 선택 금지)
4. 필드 이름: **`enabled`** / 유형: **boolean** / 값: **true**
5. 저장합니다. 문자열 `"true"`가 아니라 불리언 `true`여야 합니다.

```text
admins
└─ 관리자UID
   └─ enabled: true (boolean)
```

추가 관리자도 같은 방법으로 등록합니다. 권한을 회수하려면 `enabled`를 false로 바꿉니다. 웹 화면에서는 관리자 권한을 새로 부여할 수 없습니다.

### 1-5. 배포 도메인 등록

Authentication → **설정(Settings) → 승인된 도메인(Authorized domains)**에 `내아이디.github.io`를 추가합니다. `https://`, `/저장소이름/`은 넣지 않습니다. 사용자 지정 도메인을 사용하면 그 도메인도 추가하세요.

## 2. GitHub Pages 배포

1. GitHub에서 새 저장소(repository)를 만듭니다. 처음에는 **Public** 저장소가 가장 간단합니다.
2. **Add file → Upload files**에서 `venture-pick` **폴더 안의 내용**을 업로드합니다.
3. 저장소 첫 화면에 `index.html`, `admin.html`, `css`, `js`, `assets`, `landing`이 바로 보여야 합니다. ZIP 파일 자체를 올리거나 `venture-pick` 폴더만 한 겹 더 올리지 마세요.
4. **Commit changes**로 저장합니다.
5. **Settings → Pages → Build and deployment → Source: Deploy from a branch**를 선택합니다.
6. **Branch: main**, **Folder: / (root)**를 선택하고 **Save**를 누릅니다.
7. 배포 완료 후 표시되는 주소를 엽니다. 필요하면 **Actions** 탭에서 Pages 배포가 초록색인지 확인합니다.

| 용도 | 주소 예시 |
|---|---|
| 학생 | `https://내아이디.github.io/저장소이름/` |
| 관리자 | `https://내아이디.github.io/저장소이름/admin.html` |
| 미리보기 | `https://내아이디.github.io/저장소이름/preview.html` |

필수 배포 파일은 HTML, `css/`, `js/`, `assets/`, `landing/`입니다. `firestore.rules`를 GitHub에 올리는 것만으로 Firebase 규칙이 바뀌지는 않습니다. Firebase Console에도 별도로 게시해야 합니다.

`package.json`, `package-lock.json`, `tests/`, `firebase.json`은 개발자가 검증을 다시 실행할 때 쓰는 파일입니다. Pages 배포에 npm 실행은 필요하지 않습니다. `node_modules/`, 테스트 로그, `test-results/`는 업로드하지 마세요.

## 3. 첫 수업 준비

1. `admin.html`에서 앞서 만든 이메일/비밀번호로 로그인합니다.
2. **기본 세션 만들기**를 한 번 누릅니다. 처음에는 접수가 닫혀 있고 PIN은 비어 있습니다.
3. **프로젝트명**, 메인 문구, 설명, **1인 투자 한도**, **투자 단위**를 입력합니다. 금액은 원 단위 정수입니다.
4. 4개 조의 **조 이름, 인원수(1~99명), PIN(숫자 4~12자리), 사업명, 설명, 랜딩페이지 주소, 썸네일 주소**를 설정합니다. PIN은 조별로 다르게, 가능하면 8~12자리로 정하세요.
5. **설정 저장**을 누르고 저장 완료 문구를 확인합니다.
6. **투자 접수 열기**를 누릅니다.
7. 학생에게 학생 화면 주소, 자기 조 PIN과 번호를 알려줍니다. 같은 조 안에서 번호가 겹치지 않게 배정하세요.

학생은 자기 조와 번호를 선택하고 PIN을 입력합니다. 자기 조 사업에는 투자할 수 없습니다. 다른 3개 사업에 단위별로 배분하며, 전액을 쓸 필요가 없습니다. 0원 투자도 허용하며, 남은 금액이 있으면 제출 전 확인합니다.

**한 조의 한 번호는 한 번만 제출**할 수 있습니다. 화면에 **제출 완료**가 표시될 때까지 기다리세요. 네트워크가 끊기면 제출 확인이 지연될 수 있습니다. 재시도 시 이미 제출됐다는 안내가 나오면 관리자 화면의 제출 목록에서 번호를 확인하세요.

## 4. 설정 변경·마감·결과 공개

- 설정 수정은 접수를 마감한 뒤 가능합니다. 저장되지 않은 입력이 있으면 먼저 저장하세요.
- 제출이 남아 있는 상태에서는 한도·단위·인원수 변경을 막습니다. 다른 조건으로 수업을 진행하려면 CSV 저장 → 제출 초기화 → 설정 변경 순서로 진행하세요.
- PIN, 사업 설명, 주소 등도 저장 후 반영됩니다. 설정 버전이 바뀌면 아직 제출하지 않은 학생은 다시 입장합니다.
- **조별 제출 현황과 투자 상세**는 관리자의 Firestore 실시간 구독으로 갱신됩니다.
- **CSV 저장**은 조·번호·사용액·미사용액·4개 사업 투자액을 저장합니다. 한글 Excel용 BOM을 포함하며 PIN은 내보내지 않습니다.
- **접수 마감 → 결과 공개** 순서로 누릅니다. **2위 → 3위 → 마지막 1위**가 등장하며 1위 썸네일은 중앙 높은 단상에 표시됩니다. 전체 순위표도 1위 등장 후 나타납니다.
- 결과 버튼을 직접 누르면 빵빠레가 준비됩니다. 기기 음량·브라우저 오디오 설정에 따라 소리가 나지 않을 수 있습니다. 모바일 브라우저에서도 직접 누르세요.
- confetti 효과를 유지합니다. 기기에서 ‘동작 줄이기’를 설정한 경우 움직이는 confetti를 생략합니다.

### 순위 계산

**각 사업이 받은 총 투자액이 큰 순서**로 1~4위를 정합니다. 시상식 단상에도 총 투자액을 표시합니다.

예: 1조 사업이 4억원, 2조 사업이 3억원을 받았다면 1조가 더 높은 순위입니다.

관리자 상세표에는 **총 투자액 ÷ 실제 제출한 타 조 투자자 수**로 계산한 평균 투자액도 참고용으로 표시합니다. 0원을 투자한 제출자도 평균의 분모에 포함하고, 미제출자와 자기 조 제출자는 제외합니다. 외부 제출자가 없으면 평균은 0원입니다.

총액이 같을 때만 평균 투자액, 그다음 조 이름 순으로 정렬합니다. 공동 순위 대신 시상식의 1~4위 순서를 결정하는 기준입니다.

자기 조에는 투자할 수 없으므로 조별 인원수가 다르면 투자 가능한 외부 학생 수에도 차이가 생깁니다. 총액은 ‘투자유치 성과’를 직접 보여주며, 조별 인원수에 따른 보정은 하지 않습니다.

## 5. 실제 랜딩페이지·썸네일 연결

샘플 `landing/team1.html`~`team4.html`, `assets/team1.svg`~`team4.svg`는 그대로 남겨두었습니다.

- 같은 이름의 HTML 파일로 교체하여 GitHub에 업로드하면 주소를 바꾸지 않아도 됩니다.
- 또는 관리자 화면에서 해당 조의 랜딩페이지 주소를 바꾸고 저장하세요.
- 프로젝트 안의 파일: `landing/team1.html`, `assets/team1.svg`
- 외부 사이트/이미지: `https://example.com/project1`, `https://example.com/photo.jpg`
- `/landing/team1.html`처럼 맨 앞에 `/`를 붙이지 마세요. GitHub Pages의 저장소 경로를 벗어납니다. 로컬 경로는 `index.html`과 같은 폴더를 기준으로 작성합니다.
- 외부 주소는 HTTPS를 사용하세요. 썸네일은 로그인 없이 이미지 자체가 열리는 주소여야 합니다. 파일명의 대소문자도 정확히 맞춰야 합니다.

## 6. 다음 수업으로 초기화

1. 접수를 마감합니다.
2. 필요하면 **CSV 저장**으로 백업합니다.
3. **모든 제출 초기화**를 누르고 삭제를 확인합니다. 삭제한 제출은 되돌릴 수 없습니다.
4. 설정은 유지되며 접수는 닫힌 상태입니다. 필요한 설정을 바꾸고 저장한 후 다시 엽니다.

기존 결과를 Firestore에 보관하고 새 수업을 시작하려면 `js/default-config.js`의 `SESSION_ID`를 예를 들어 `venture-pick-2026-class2`로 바꾸고 재배포합니다. 관리자 화면에서 새 기본 세션을 만드세요. 이 ID는 화면에 표시되는 프로젝트명과 다릅니다.

## 7. 데이터와 권한

```text
admins/{관리자UID}                         관리자 등록 (Console에서만 수정)
sessions/{SESSION_ID}                    공개 프로젝트 설정 + PIN 확인용 해시
sessions/{SESSION_ID}/private/pins       관리자 전용 조별 PIN 원문
sessions/{SESSION_ID}/submissions/team1-01  1조 1번 제출 (관리자만 조회)
```

- 학생은 지정된 프로젝트 설정 문서만 읽고 유효한 새 제출만 생성할 수 있습니다.
- PIN 원문은 공개 설정에 저장하지 않습니다. 브라우저 입장 화면은 PIN 해시를 비교하고, 최종 제출은 보안 규칙이 비공개 PIN 원문과 다시 비교합니다. 제출에는 검증용 PIN이 포함되지만 학생은 제출 문서를 읽을 수 없고 관리자만 읽을 수 있습니다.
- 조별 공유 PIN은 개인 계정 인증이 아닙니다. 같은 조 PIN을 아는 학생은 다른 번호를 선택할 수 있으므로 교사가 번호를 배정해야 합니다. 짧은 숫자 PIN의 해시는 추측 가능하므로 민감한 서비스의 인증 수단으로 사용하지 않습니다.
- 규칙은 고정 문서 ID, 인원수 범위, 프로젝트 버전, PIN, 자기 조 0원, 정수·단위·합계·한도·잔액·서버 시간을 검사합니다.
- 관리자도 기존 제출을 덮어쓸 수 없습니다. 전체 조회와 접수 마감 후 삭제만 가능합니다.
- 일반 Firebase 로그인 계정은 관리자 권한이 없습니다. `admins/{UID}.enabled == true` 등록이 필요합니다.
- 기존 버전의 공개 `teamPins`가 있는 프로젝트를 사용 중이라면 접수를 닫고 이 버전의 설정 저장을 실행하세요. 공개 PIN 필드를 제거하면서 비공개 문서를 만듭니다. 아직 설정을 적용하지 않은 새 배포라면 위의 첫 수업 절차만 따르면 됩니다.

## 8. 문제 해결

| 증상 | 확인할 곳 |
|---|---|
| Firebase 설정 안내가 뜸 | `js/firebase-config.js`의 placeholder가 실제 값으로 바뀌었는지 확인 |
| 화면이 비거나 연결이 안 됨 | HTTPS 주소, 인터넷/학교망의 `www.gstatic.com`·Firebase 접속 허용 확인 |
| 로그인은 되지만 관리자 권한이 없음 | `admins` 문서 ID가 Authentication UID인지, enabled가 boolean true인지 확인 |
| 기본 세션/설정 저장 실패 | `(default)` Firestore 생성 및 새 규칙 게시 여부 확인 |
| PIN 입력 후 입장 불가 | 조·PIN·접수 상태 확인. 기본 PIN은 없으며 관리자에서 먼저 저장해야 함 |
| 이미 제출한 번호 안내 | 관리자 제출 목록 확인. 학생은 제출 문서를 직접 조회할 수 없어 중복·마감·설정 변경을 함께 안내 |
| Pages 404 | index.html이 저장소 최상위인지, main/(root)인지, Actions 배포 성공 여부 확인 |
| 랜딩페이지/이미지 404 | 상대경로, 실제 업로드 여부, 파일명 대소문자 확인 |
| 수정 내용이 안 보임 | Pages 배포 완료 후 새로고침. 관리자에서 설정 저장했는지 확인 |

## 9. 개발용 검증 (교사는 실행하지 않아도 됨)

Node.js 22/24, Java 21 이상이 있으면 다음 테스트를 실행할 수 있습니다. 테스트 도구는 배포 서버가 아닙니다.

```sh
npm ci
npm test
npm run test:rules
```

브라우저 전체 흐름은 실제 Firebase SDK와 로컬 Firestore/Auth 에뮬레이터로 검증합니다. 운영 프로젝트는 사용하지 않습니다.

```sh
npx playwright install chromium
npm run test:browser
```

테스트는 `demo-venture-pick` 에뮬레이터의 테스트 데이터만 초기화합니다. `test-results/`에 모바일·PC 캡처와 테스트 CSV를 만듭니다. 실제 사용자 Firebase 프로젝트와 GitHub 계정 연결은 배포 후 별도로 확인해야 합니다.

참고: [Firebase 웹 SDK 설정](https://firebase.google.com/docs/web/setup), [Firestore 필드별 보안 검증](https://firebase.google.com/docs/firestore/security/rules-fields), [GitHub Pages 배포 위치 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
