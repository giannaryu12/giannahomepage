# 지아나영어 홈페이지 · 학생관리

정적 홈페이지와 학생관리 앱. 프론트엔드는 Netlify, 데이터는 Google Sheets,
API는 Google Apps Script Web App이다.

## 구조

- `public/` — Netlify publish 디렉터리
  - `index.html` 홈페이지 · `students/` 랜딩 · `parent/` 학부모 · `admin/` 선생님
- `gas/` — Apps Script 소스 (clasp로 관리)
  - `lib/` — 시트를 건드리지 않는 순수 로직, Node에서 단위 테스트
- `test/` — vitest
- `docs/superpowers/` — 설계 문서와 구현 계획

## 개발

```bash
npm install
npm test              # 단위 테스트
npx serve public      # 로컬 미리보기
```

## GAS 배포

```bash
npx clasp push
```

푸시 후 Apps Script 편집기에서 **배포 → 배포 관리 → 편집 → 새 버전 → 배포**로
기존 배포를 갱신한다. 새 배포를 만들면 URL이 바뀌므로 주의한다.

## 최초 설정

1. 구글시트 생성 — 시트 3장(`Students` `Classes` `Records`), 헤더는 설계 문서 §6 참조
2. 시트 공유를 선생님 계정 단독으로 제한
3. Apps Script API 활성화 (https://script.google.com/home/usersettings) → `npx clasp login` →
   `npx clasp create-script --parentId <시트ID>` (`--type`는 쓰지 않는다 — 붙이면 새 시트가
   따로 생성되어 기존 시트에 바인딩되지 않는다). `create-script`는 `gas/appsscript.json`을
   기본값으로 덮어쓰므로 직후 `git checkout -- gas/appsscript.json`으로 복원한다.
4. Apps Script 스크립트 속성에 `SHEET_ID`, `ADMIN_PASSWORD`(16자 이상) 등록
5. 웹 앱 배포: 실행 = 나 / 액세스 = 모든 사용자로 `npx clasp create-deployment` 실행 후,
   Apps Script 편집기에서 **배포 → 새 배포**로 소유자가 직접 OAuth 승인을 완료해야 한다.
   이 과정은 자동화할 수 없으며, 승인 전에는 웹 앱이 403을 반환한다.
6. 배포 URL을 `public/assets/js/config.js`의 `GAS_URL`에 기입
7. Netlify에 저장소 연결 (publish 디렉터리는 `netlify.toml`이 지정)

## 보안 메모

학부모 링크는 32자 토큰 단독으로 열린다. PIN과 시도 횟수 제한은 두지 않기로
했으므로 **링크 자체가 열쇠다**. 링크가 유출되었다고 판단되면 선생님 화면의
`링크 재발급`으로 즉시 이전 링크를 무효화한다. 근거와 트레이드오프는
`docs/superpowers/specs/2026-08-30-student-management-design.md` §8에 있다.
