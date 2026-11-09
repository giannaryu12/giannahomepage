# 지아나영어 저장소 안내

## 저장소 두 개를 따로 관리한다

| | 저장소 | 공개 | 배포 |
|---|---|---|---|
| 홈페이지 | `giannaryu12/giannahomepage` (이 저장소) | Public | `master` → https://gianna-english.netlify.app/ |
| 학생관리 | `giannaryu12/gianna-student-management` | Private | `main` → https://inquisitive-marzipan-325129.netlify.app/ (Netlify 자동 배포) |

- 학생관리(선생님 화면, 학부모 달력, 출결·성적, Apps Script) 수정 요청이 오면
  이 저장소가 아니라 `giannaryu12/gianna-student-management`를 세션에 연결해서 작업한다.
- 학생관리 코드·학생 정보·설계 문서는 이 공개 저장소에 올리지 않는다.
- 홈페이지와 학생관리는 서로 링크하지 않는다.

## 이 저장소

- `index.html` 한 파일짜리 정적 홈페이지와 `assets/` 이미지.
- 커밋 메시지는 `부위: 바꾼 내용` 형식 (예: `Footer: ...`, `Nav: ...`).
