# 밴드 합주 시간표 (Band Schedule)

대학교 밴드 합주 시간 조율을 위한 실시간 스케줄 앱입니다. 별도 서버 없이 GitHub Pages + Firebase(Firestore)만으로 동작합니다.

## 기능

- 세션 5종 등록: 드럼 / 베이스 / 일렉기타 / 보컬(여) / 보컬(남)
- 요일(월~일) × 시간(09:00~24:00, 1시간 단위) 그리드에서 내 가능 시간을 클릭으로 표시
- 다른 멤버가 표시한 가능 시간이 **실시간**으로 반영 (새로고침 불필요)
- 전 세션(5개 파트 모두)이 동시에 가능한 시간을 자동으로 상단에 하이라이트

## 1. Firebase 프로젝트 준비

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 새 프로젝트를 만듭니다. (Google Analytics는 꺼도 됩니다.)
2. 왼쪽 메뉴 **빌드 > Firestore Database** 로 이동해 **데이터베이스 만들기**를 누릅니다. 위치는 `asia-northeast3(서울)` 추천, 모드는 우선 **테스트 모드**로 시작합니다.
3. 프로젝트 개요 옆 톱니바퀴 > **프로젝트 설정** > 하단 **내 앱**에서 웹 앱(`</>`) 추가. 앱 닉네임은 아무거나 입력하고, Firebase Hosting 설정은 체크하지 않아도 됩니다.
4. 발급된 `firebaseConfig` 값을 복사해서 이 저장소의 [firebase-config.js](firebase-config.js) 안의 값들을 교체합니다.

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

이 값들은 클라이언트에 그대로 노출되어도 되는 값입니다(비밀키 아님). 실제 접근 제어는 아래 Firestore 보안 규칙으로 합니다.

## 2. Firestore 보안 규칙 설정

Firestore Database > **규칙** 탭에서 아래처럼 설정하세요. 밴드원끼리만 쓰는 소규모 도구이므로 로그인 없이 열어두되, `members` 컬렉션 형식만 검증합니다.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /members/{memberId} {
      allow read: if true;
      allow create, update: if request.resource.data.name is string
                    && request.resource.data.name.size() <= 12
                    && request.resource.data.session in
                       ['drum', 'bass', 'guitar', 'vocal_f', 'vocal_m'];
      allow delete: if true;
    }
  }
}
```

> 링크를 아는 밴드원만 쓰는 용도라면 이 정도로 충분합니다. 더 엄격하게 하려면 Firebase Authentication(예: 익명 로그인)을 추가하고 `memberId`가 `request.auth.uid`와 같은지 검사하도록 확장할 수 있습니다.

## 3. 로컬에서 확인하기

`app.js`가 ES 모듈이라 `file://`로 바로 열면 동작하지 않습니다. 로컬 서버로 열어주세요.

```bash
npx serve .
# 또는
python3 -m http.server 5500
```

브라우저에서 열리는 주소로 접속해 확인합니다.

## 4. GitHub에 올리고 GitHub Pages로 배포

```bash
git init
git add .
git commit -m "Init band schedule app"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

그 다음 GitHub 저장소 페이지에서 **Settings > Pages** 로 이동해 Source를 `Deploy from a branch`, Branch를 `main` / `/(root)` 로 설정하면 몇 분 뒤 `https://<계정>.github.io/<저장소명>/` 주소로 접속할 수 있습니다.

## 사용 방법

1. 처음 접속하면 이름과 세션을 입력하는 창이 뜹니다. 입력하면 브라우저에 저장되어 다음에 다시 입력할 필요가 없습니다.
2. 표에서 원하는 요일/시간 칸을 클릭하면 내 가능 시간으로 표시(파란 테두리)됩니다. 다시 클릭하면 해제됩니다.
3. 칸에 마우스를 올리면 그 시간에 가능한 멤버 이름을 세션별로 볼 수 있습니다.
4. 5개 세션이 모두 가능한 칸은 노란 테두리로 표시되고, 상단 "전 세션 합주 가능 시간"에도 자동으로 나열됩니다.
5. 오른쪽 상단 "내 정보"로 이름/세션을 수정하거나, 밴드에서 나갈 수 있습니다.

## 커스터마이징

- 시간 범위/요일: [app.js](app.js) 상단의 `DAYS`, `HOURS` 배열 수정
- 세션 종류/색상: [app.js](app.js)의 `SESSIONS` 배열과 [styles.css](styles.css)의 `:root` 색상 변수 수정
