# 학생관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지아나영어 홈페이지에 `학생관리` 탭을 추가하고, 학부모가 토큰 링크로 자녀의 누적 수업 기록을 열람하고 선생님이 반 단위로 피드백을 입력하는 앱을 붙인다.

**Architecture:** 프론트엔드는 정적 HTML/CSS/JS로 Netlify에 배포하고, Google Apps Script Web App이 JSON API 역할을 하며 구글시트가 DB다. GAS 코드는 clasp로 저장소 안에서 관리한다. `SpreadsheetApp`을 건드리지 않는 순수 로직은 `gas/lib/`로 분리해 Node + vitest로 단위 테스트하고, 시트 접근 계층은 얇게 유지해 수동 검증한다.

**Tech Stack:** 순수 HTML/CSS/JS (프레임워크 없음) · Google Apps Script (V8) · Google Sheets · clasp · Netlify · vitest

**Spec:** `docs/superpowers/specs/2026-08-30-student-management-design.md`

## Global Constraints

- **Node 실행 경로** — 이 머신에서 `node`/`npm`이 PATH에 없을 수 있다. 없으면 새 터미널을 열어 확인하고, 그래도 없으면 `"C:\Program Files\nodejs\npm.cmd"`처럼 전체 경로로 호출한다. 설치 확인: Node v24.20.0 / npm 11.19.0.
- **`package.json`에 `"type": "module"`을 넣지 않는다.** `gas/lib/*.js`는 GAS와 Node에서 모두 로드돼야 하므로 CommonJS여야 한다.
- **GAS 파일의 export는 반드시 가드한다** — 모든 `gas/lib/*.js` 끝에 `if (typeof module !== 'undefined') { module.exports = {...}; }`. GAS 런타임에는 `module`이 없어 무시되고, Node에서는 require된다.
- **GAS는 V8 런타임** — `const`/`let`/화살표 함수/템플릿 리터럴 사용 가능. `import`/`export` 구문은 불가.
- **모든 API 요청은 POST**, `Content-Type: text/plain;charset=utf-8`. preflight(OPTIONS)를 피하기 위함이며 GAS는 OPTIONS를 처리하지 못한다.
- **모든 API 응답은 JSON** — `{ok:true, data:{...}}` 또는 `{ok:false, error:"코드", message:"사람이 읽는 문구"}`. 모든 핸들러를 try/catch로 감싼다.
- **PIN·레이트리밋 없음** — 학부모 인증은 32자 토큰 단독. 스펙 §8의 의도된 결정이므로 추가하지 않는다.
- **학부모 응답은 allowlist로 필드를 고른다.** 절대 blacklist(삭제 방식)로 만들지 않는다.
- **디자인 토큰** — 포레스트 `#1b3b2b`, 가넷 `#8b0f0f`, 골드 `#b3894f`, 크림 `#f6f2e6`. 상태색: 출석/제출=포레스트, 지각/부분제출=골드, 결석/미제출=가넷. 형광색 금지.
- **모바일 우선** — 375px에서 가로 스크롤이 없어야 한다.
- **커밋 메시지 끝에** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` 를 붙인다.
- **작업 브랜치**: `feat/student-management` (이미 생성됨).

---

### Task 1: 프로젝트 셋업과 테스트 하네스

GAS용 CommonJS 모듈을 vitest에서 import할 수 있는지를 이 태스크에서 실제로 증명한다. 여기가 되면 이후 순수 로직 태스크가 전부 안전해진다.

**Files:**
- Create: `package.json`, `vitest.config.js`, `.gitignore`, `gas/lib/ids.js`, `test/harness.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `npm test` 명령. `gas/lib/*.js`의 가드된 `module.exports` 패턴.

- [ ] **Step 1: `package.json` 생성**

```json
{
  "name": "gianna-student-management",
  "version": "1.0.0",
  "private": true,
  "description": "지아나영어 학생관리 - 학부모 열람 / 선생님 입력",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "gas:push": "clasp push",
    "gas:deploy": "clasp deploy"
  },
  "devDependencies": {
    "vitest": "^2.1.8",
    "@google/clasp": "^2.4.2"
  }
}
```

- [ ] **Step 2: `vitest.config.js` 생성**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: `.gitignore` 생성**

```
node_modules/
.netlify/
.clasprc.json
*.log
```

- [ ] **Step 4: 의존성 설치**

Run: `npm install`
Expected: `node_modules/`가 생기고 vitest가 설치된다.

- [ ] **Step 5: 실패하는 테스트 작성**

`test/harness.test.js`:

```js
import { generateToken } from '../gas/lib/ids.js';

describe('테스트 하네스', () => {
  it('GAS용 CommonJS 모듈을 vitest에서 import할 수 있다', () => {
    expect(typeof generateToken).toBe('function');
  });
});
```

`vitest.config.js`에 `globals`를 켜지 않았으므로 `describe`/`it`/`expect`를 import해야 한다. 파일 맨 위에 추가한다:

```js
import { describe, it, expect } from 'vitest';
```

- [ ] **Step 6: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../gas/lib/ids.js"`

- [ ] **Step 7: 최소 구현**

`gas/lib/ids.js`:

```js
/**
 * ID · 토큰 생성. SpreadsheetApp을 사용하지 않는 순수 함수.
 */

const TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LENGTH = 32;

function generateToken(randomFn) {
  const rnd = randomFn || Math.random;
  let out = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out += TOKEN_CHARS.charAt(Math.floor(rnd() * TOKEN_CHARS.length));
  }
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = { generateToken, TOKEN_CHARS, TOKEN_LENGTH };
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — 1 test passed

- [ ] **Step 9: 커밋**

```bash
git add package.json package-lock.json vitest.config.js .gitignore gas/lib/ids.js test/harness.test.js
git commit -m "chore: vitest 하네스 셋업, GAS CommonJS 모듈 로딩 검증

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `lib/ids.js` — 토큰과 ID 생성

**Files:**
- Modify: `gas/lib/ids.js`
- Test: `test/ids.test.js`

**Interfaces:**
- Consumes: `generateToken(randomFn?)` (Task 1)
- Produces:
  - `generateToken(randomFn?) -> string` (32자)
  - `nextStudentId(existingIds: string[]) -> string` (`S001` 형태)
  - `generateRecordId(now: Date, randomFn?) -> string` (`R` + 타임스탬프 + 접미사)

- [ ] **Step 1: 실패하는 테스트 작성**

`test/ids.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { generateToken, nextStudentId, generateRecordId, TOKEN_CHARS } from '../gas/lib/ids.js';

describe('generateToken', () => {
  it('32자를 만든다', () => {
    expect(generateToken()).toHaveLength(32);
  });

  it('허용된 문자만 사용한다', () => {
    for (const ch of generateToken()) {
      expect(TOKEN_CHARS).toContain(ch);
    }
  });

  it('연속 호출에서 값이 달라진다', () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  it('주입한 난수 함수를 사용한다', () => {
    expect(generateToken(() => 0)).toBe('A'.repeat(32));
  });
});

describe('nextStudentId', () => {
  it('빈 목록이면 S001을 준다', () => {
    expect(nextStudentId([])).toBe('S001');
  });

  it('기존 최대값 다음 번호를 준다', () => {
    expect(nextStudentId(['S001', 'S002', 'S003'])).toBe('S004');
  });

  it('중간이 비어 있어도 최대값 기준으로 준다', () => {
    expect(nextStudentId(['S001', 'S007'])).toBe('S008');
  });

  it('형식에 맞지 않는 값은 무시한다', () => {
    expect(nextStudentId(['', 'foo', 'S002'])).toBe('S003');
  });

  it('999를 넘으면 자릿수가 늘어난다', () => {
    expect(nextStudentId(['S999'])).toBe('S1000');
  });
});

describe('generateRecordId', () => {
  it('R로 시작하고 타임스탬프를 담는다', () => {
    const id = generateRecordId(new Date('2026-08-30T01:02:03.000Z'), () => 0);
    expect(id.startsWith('R20260830010203')).toBe(true);
  });

  it('같은 시각이어도 난수 접미사로 구분된다', () => {
    const now = new Date('2026-08-30T01:02:03.000Z');
    expect(generateRecordId(now, () => 0)).not.toBe(generateRecordId(now, () => 0.5));
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `nextStudentId is not a function`

- [ ] **Step 3: 구현**

`gas/lib/ids.js`를 아래로 교체한다:

```js
/**
 * ID · 토큰 생성. SpreadsheetApp을 사용하지 않는 순수 함수.
 */

const TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LENGTH = 32;

function generateToken(randomFn) {
  const rnd = randomFn || Math.random;
  let out = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out += TOKEN_CHARS.charAt(Math.floor(rnd() * TOKEN_CHARS.length));
  }
  return out;
}

function nextStudentId(existingIds) {
  let max = 0;
  (existingIds || []).forEach(function (id) {
    const m = /^S(\d+)$/.exec(String(id || ''));
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  const next = max + 1;
  const padded = next < 1000 ? String(next).padStart(3, '0') : String(next);
  return 'S' + padded;
}

function generateRecordId(now, randomFn) {
  const rnd = randomFn || Math.random;
  const stamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const suffix = Math.floor(rnd() * 1000000).toString(36).padStart(4, '0');
  return 'R' + stamp + suffix;
}

if (typeof module !== 'undefined') {
  module.exports = {
    generateToken,
    nextStudentId,
    generateRecordId,
    TOKEN_CHARS,
    TOKEN_LENGTH,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — ids 관련 11개 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add gas/lib/ids.js test/ids.test.js
git commit -m "feat: 토큰·학생ID·기록ID 생성 함수

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `lib/validate.js` — 기록 검증

**Files:**
- Create: `gas/lib/validate.js`, `test/validate.test.js`

**Interfaces:**
- Produces:
  - `HOMEWORK_STATUS`, `HOMEWORK_LEVEL`, `ATTENDANCE` — 허용값 배열
  - `validateRecord(rec) -> string[]` (빈 배열이면 통과)
  - `validateBatch(records) -> {index:number, errors:string[]}[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/validate.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { validateRecord, validateBatch } from '../gas/lib/validate.js';

function valid(over) {
  return Object.assign({
    studentId: 'S001',
    date: '2026-08-30',
    attendance: '출석',
    homeworkStatus: '제출',
    homeworkLevel: '상',
    testName: '',
    testScore: '',
    testMax: '',
  }, over || {});
}

describe('validateRecord', () => {
  it('정상 기록은 오류가 없다', () => {
    expect(validateRecord(valid())).toEqual([]);
  });

  it('객체가 아니면 오류다', () => {
    expect(validateRecord(null).length).toBeGreaterThan(0);
    expect(validateRecord('x').length).toBeGreaterThan(0);
  });

  it('studentId가 없으면 오류다', () => {
    expect(validateRecord(valid({ studentId: '' }))).toContain('studentId 누락');
  });

  it('date 형식이 틀리면 오류다', () => {
    expect(validateRecord(valid({ date: '2026/08/30' }))).toContain('date 형식 오류');
    expect(validateRecord(valid({ date: '' }))).toContain('date 형식 오류');
  });

  it('attendance가 허용값이 아니면 오류다', () => {
    expect(validateRecord(valid({ attendance: '조퇴' }))).toContain('attendance 값 오류');
  });

  it('attendance가 비어 있으면 통과한다', () => {
    expect(validateRecord(valid({ attendance: '' }))).toEqual([]);
  });

  it('homeworkStatus가 허용값이 아니면 오류다', () => {
    expect(validateRecord(valid({ homeworkStatus: '했음' }))).toContain('homeworkStatus 값 오류');
  });

  it('homeworkLevel이 허용값이 아니면 오류다', () => {
    expect(validateRecord(valid({ homeworkLevel: 'A' }))).toContain('homeworkLevel 값 오류');
  });

  it('점수가 비어 있으면 통과한다', () => {
    expect(validateRecord(valid({ testScore: '', testMax: '' }))).toEqual([]);
  });

  it('점수만 있고 만점이 없으면 오류다', () => {
    expect(validateRecord(valid({ testScore: '18', testMax: '' }))).toContain('testMax 오류');
  });

  it('점수가 만점보다 크면 오류다', () => {
    expect(validateRecord(valid({ testScore: '21', testMax: '20' })))
      .toContain('testScore가 testMax보다 큽니다');
  });

  it('음수 점수는 오류다', () => {
    expect(validateRecord(valid({ testScore: '-1', testMax: '20' }))).toContain('testScore 오류');
  });

  it('숫자가 아닌 점수는 오류다', () => {
    expect(validateRecord(valid({ testScore: '십팔', testMax: '20' }))).toContain('testScore 오류');
  });

  it('만점이 0이면 오류다', () => {
    expect(validateRecord(valid({ testScore: '0', testMax: '0' }))).toContain('testMax 오류');
  });

  it('점수와 만점이 정상이면 통과한다', () => {
    expect(validateRecord(valid({ testName: '단어시험', testScore: '18', testMax: '20' }))).toEqual([]);
  });
});

describe('validateBatch', () => {
  it('전부 정상이면 빈 배열이다', () => {
    expect(validateBatch([valid(), valid({ studentId: 'S002' })])).toEqual([]);
  });

  it('문제가 있는 항목의 인덱스와 오류를 돌려준다', () => {
    const result = validateBatch([valid(), valid({ date: 'bad' })]);
    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(1);
    expect(result[0].errors).toContain('date 형식 오류');
  });

  it('배열이 아니면 통째로 오류다', () => {
    expect(validateBatch(null)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../gas/lib/validate.js"`

- [ ] **Step 3: 구현**

`gas/lib/validate.js`:

```js
/**
 * 수업 기록 검증. 순수 함수.
 */

const HOMEWORK_STATUS = ['제출', '부분제출', '미제출', '해당없음'];
const HOMEWORK_LEVEL = ['상', '중', '하', ''];
const ATTENDANCE = ['출석', '지각', '결석', '보강'];

function isBlank(v) {
  return v === '' || v === null || v === undefined;
}

function validateRecord(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
    return ['record가 객체가 아닙니다'];
  }

  const errors = [];

  if (isBlank(rec.studentId)) errors.push('studentId 누락');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(rec.date || ''))) errors.push('date 형식 오류');

  if (!isBlank(rec.attendance) && ATTENDANCE.indexOf(rec.attendance) === -1) {
    errors.push('attendance 값 오류');
  }
  if (!isBlank(rec.homeworkStatus) && HOMEWORK_STATUS.indexOf(rec.homeworkStatus) === -1) {
    errors.push('homeworkStatus 값 오류');
  }
  if (!isBlank(rec.homeworkLevel) && HOMEWORK_LEVEL.indexOf(rec.homeworkLevel) === -1) {
    errors.push('homeworkLevel 값 오류');
  }

  // 점수는 셋 다 비어 있거나, score/max가 함께 유효해야 한다.
  if (!isBlank(rec.testScore) || !isBlank(rec.testMax)) {
    const score = Number(rec.testScore);
    const max = Number(rec.testMax);
    const scoreOk = !isBlank(rec.testScore) && isFinite(score) && score >= 0;
    const maxOk = !isBlank(rec.testMax) && isFinite(max) && max > 0;

    if (!scoreOk) errors.push('testScore 오류');
    if (!maxOk) errors.push('testMax 오류');
    if (scoreOk && maxOk && score > max) errors.push('testScore가 testMax보다 큽니다');
  }

  return errors;
}

function validateBatch(records) {
  if (!Array.isArray(records)) {
    return [{ index: -1, errors: ['records가 배열이 아닙니다'] }];
  }
  const out = [];
  records.forEach(function (rec, i) {
    const errors = validateRecord(rec);
    if (errors.length) out.push({ index: i, errors: errors });
  });
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = {
    HOMEWORK_STATUS,
    HOMEWORK_LEVEL,
    ATTENDANCE,
    validateRecord,
    validateBatch,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — validate 관련 18개 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add gas/lib/validate.js test/validate.test.js
git commit -m "feat: 수업 기록 검증 로직

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `lib/summary.js` — 요약 통계

학부모 화면 상단 카드 3개(출석률·과제 제출률·평균 점수)를 계산한다.

**집계 규칙** (스펙 §9의 요약 카드 정의를 확정한 것):
- 출석률 = (출석 + 지각 + 보강) / 출결이 기록된 건수. **결석만 미출석으로 센다.**
- 과제 제출률 = (제출 + 부분제출) / (`해당없음` 제외한 건수)
- 평균 점수 = `testScore / testMax * 100` 의 평균. 점수가 있는 기록만.
- 계산 대상이 0건이면 `0`이 아니라 **`null`**을 돌려준다. "0%"와 "데이터 없음"은 학부모에게 전혀 다른 의미다.

**Files:**
- Create: `gas/lib/summary.js`, `test/summary.test.js`

**Interfaces:**
- Produces: `computeSummary(records, monthKey) -> {attendanceRate, homeworkRate, avgScore, recordCount}`
  - `monthKey`는 `'2026-08'` 형태. 비우면 전체 기간.
  - 비율은 0~100 정수, 데이터 없으면 `null`.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/summary.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeSummary } from '../gas/lib/summary.js';

function rec(over) {
  return Object.assign({
    date: '2026-08-10',
    attendance: '출석',
    homeworkStatus: '제출',
    testScore: '',
    testMax: '',
  }, over || {});
}

describe('computeSummary', () => {
  it('기록이 없으면 전부 null이다', () => {
    expect(computeSummary([], '2026-08')).toEqual({
      attendanceRate: null, homeworkRate: null, avgScore: null, recordCount: 0,
    });
  });

  it('해당 월의 기록만 센다', () => {
    const r = computeSummary([rec({ date: '2026-08-10' }), rec({ date: '2026-07-10' })], '2026-08');
    expect(r.recordCount).toBe(1);
  });

  it('monthKey가 비면 전체 기간을 센다', () => {
    const r = computeSummary([rec({ date: '2026-08-10' }), rec({ date: '2026-07-10' })], '');
    expect(r.recordCount).toBe(2);
  });

  it('결석만 미출석으로 센다', () => {
    const r = computeSummary([
      rec({ attendance: '출석' }), rec({ attendance: '지각' }),
      rec({ attendance: '보강' }), rec({ attendance: '결석' }),
    ], '2026-08');
    expect(r.attendanceRate).toBe(75);
  });

  it('출결이 비어 있는 기록은 출석률 분모에서 뺀다', () => {
    const r = computeSummary([rec({ attendance: '출석' }), rec({ attendance: '' })], '2026-08');
    expect(r.attendanceRate).toBe(100);
  });

  it('제출과 부분제출을 제출로 센다', () => {
    const r = computeSummary([
      rec({ homeworkStatus: '제출' }), rec({ homeworkStatus: '부분제출' }),
      rec({ homeworkStatus: '미제출' }), rec({ homeworkStatus: '미제출' }),
    ], '2026-08');
    expect(r.homeworkRate).toBe(50);
  });

  it('해당없음은 과제 분모에서 뺀다', () => {
    const r = computeSummary([
      rec({ homeworkStatus: '제출' }), rec({ homeworkStatus: '해당없음' }),
    ], '2026-08');
    expect(r.homeworkRate).toBe(100);
  });

  it('과제가 전부 해당없음이면 null이다', () => {
    const r = computeSummary([rec({ homeworkStatus: '해당없음' })], '2026-08');
    expect(r.homeworkRate).toBe(null);
  });

  it('평균 점수를 100점 환산으로 낸다', () => {
    const r = computeSummary([
      rec({ testScore: '18', testMax: '20' }),
      rec({ testScore: '5', testMax: '10' }),
    ], '2026-08');
    expect(r.avgScore).toBe(70);
  });

  it('점수 없는 기록은 평균에서 뺀다', () => {
    const r = computeSummary([
      rec({ testScore: '20', testMax: '20' }), rec({ testScore: '', testMax: '' }),
    ], '2026-08');
    expect(r.avgScore).toBe(100);
  });

  it('점수가 하나도 없으면 null이다', () => {
    expect(computeSummary([rec()], '2026-08').avgScore).toBe(null);
  });

  it('만점이 0인 기록은 무시한다', () => {
    const r = computeSummary([
      rec({ testScore: '5', testMax: '0' }), rec({ testScore: '10', testMax: '10' }),
    ], '2026-08');
    expect(r.avgScore).toBe(100);
  });

  it('반올림해서 정수로 낸다', () => {
    const r = computeSummary([
      rec({ attendance: '출석' }), rec({ attendance: '출석' }), rec({ attendance: '결석' }),
    ], '2026-08');
    expect(r.attendanceRate).toBe(67);
  });

  it('records가 배열이 아니면 빈 결과를 낸다', () => {
    expect(computeSummary(null, '2026-08').recordCount).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../gas/lib/summary.js"`

- [ ] **Step 3: 구현**

`gas/lib/summary.js`:

```js
/**
 * 학부모 화면 요약 통계. 순수 함수.
 *
 * 집계 규칙
 *  - 출석률: (출석+지각+보강) / 출결이 기록된 건수. 결석만 미출석.
 *  - 제출률: (제출+부분제출) / 해당없음을 뺀 건수.
 *  - 평균점수: score/max*100 의 평균, 점수가 있는 기록만.
 *  - 분모가 0이면 0이 아니라 null. "0%"와 "데이터 없음"은 다르다.
 */

const PRESENT_VALUES = ['출석', '지각', '보강'];
const SUBMITTED_VALUES = ['제출', '부분제출'];

function rate(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 100);
}

function computeSummary(records, monthKey) {
  const list = Array.isArray(records) ? records : [];
  const scoped = monthKey
    ? list.filter(function (r) { return String(r.date || '').slice(0, 7) === monthKey; })
    : list;

  let attTotal = 0, attPresent = 0;
  let hwTotal = 0, hwDone = 0;
  let scoreSum = 0, scoreCount = 0;

  scoped.forEach(function (r) {
    if (r.attendance) {
      attTotal++;
      if (PRESENT_VALUES.indexOf(r.attendance) !== -1) attPresent++;
    }

    if (r.homeworkStatus && r.homeworkStatus !== '해당없음') {
      hwTotal++;
      if (SUBMITTED_VALUES.indexOf(r.homeworkStatus) !== -1) hwDone++;
    }

    const score = Number(r.testScore);
    const max = Number(r.testMax);
    const hasScore = r.testScore !== '' && r.testScore !== null && r.testScore !== undefined;
    if (hasScore && isFinite(score) && isFinite(max) && max > 0) {
      scoreSum += (score / max) * 100;
      scoreCount++;
    }
  });

  return {
    attendanceRate: rate(attPresent, attTotal),
    homeworkRate: rate(hwDone, hwTotal),
    avgScore: scoreCount ? Math.round(scoreSum / scoreCount) : null,
    recordCount: scoped.length,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { computeSummary, PRESENT_VALUES, SUBMITTED_VALUES };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — summary 관련 14개 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add gas/lib/summary.js test/summary.test.js
git commit -m "feat: 학부모 화면 요약 통계 계산

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `lib/shape.js` — 학부모 응답 위생

**보안상 가장 중요한 순수 모듈이다.** `parentToken`·`note`가 학부모 응답에 새어나가지 않도록 **allowlist**로 필드를 고른다. 삭제(blacklist) 방식은 새 컬럼이 추가될 때 조용히 유출되므로 쓰지 않는다.

**Files:**
- Create: `gas/lib/shape.js`, `test/shape.test.js`

**Interfaces:**
- Produces:
  - `PARENT_RECORD_FIELDS: string[]`
  - `toParentRecord(row) -> object`
  - `toParentStudent(student, className) -> {name, grade, className}`
  - `toParentPayload({student, className, records, monthKey}) -> {student, summary, records}`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/shape.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { toParentRecord, toParentStudent, toParentPayload, PARENT_RECORD_FIELDS } from '../gas/lib/shape.js';

describe('toParentRecord', () => {
  it('허용된 필드만 남긴다', () => {
    const out = toParentRecord({
      date: '2026-08-30', progress: 'Unit 7', comment: '좋음',
      studentId: 'S001', recordId: 'R1', clientRequestId: 'c1',
    });
    expect(Object.keys(out).sort()).toEqual([...PARENT_RECORD_FIELDS].sort());
  });

  it('민감 필드를 절대 포함하지 않는다', () => {
    const out = toParentRecord({ date: '2026-08-30', parentToken: 'SECRET', note: '학부모 민감' });
    expect(out.parentToken).toBeUndefined();
    expect(out.note).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('SECRET');
  });

  it('없는 값은 빈 문자열로 채운다', () => {
    expect(toParentRecord({ date: '2026-08-30' }).comment).toBe('');
  });
});

describe('toParentStudent', () => {
  it('이름·학년·반만 남긴다', () => {
    const out = toParentStudent(
      { name: '김민준', grade: '고1', parentToken: 'SECRET', note: '메모', active: true },
      'Structure 화목 5시'
    );
    expect(out).toEqual({ name: '김민준', grade: '고1', className: 'Structure 화목 5시' });
  });

  it('반이 없으면 빈 문자열이다', () => {
    expect(toParentStudent({ name: '김민준', grade: '고1' }, null).className).toBe('');
  });
});

describe('toParentPayload', () => {
  it('학생·요약·기록을 함께 낸다', () => {
    const out = toParentPayload({
      student: { name: '김민준', grade: '고1', parentToken: 'SECRET' },
      className: 'A반',
      records: [{ date: '2026-08-10', attendance: '출석', homeworkStatus: '제출', testScore: '', testMax: '' }],
      monthKey: '2026-08',
    });
    expect(out.student.name).toBe('김민준');
    expect(out.summary.attendanceRate).toBe(100);
    expect(out.records).toHaveLength(1);
    expect(JSON.stringify(out)).not.toContain('SECRET');
  });

  it('기록을 최신순으로 정렬한다', () => {
    const out = toParentPayload({
      student: { name: 'x', grade: 'y' }, className: '',
      records: [{ date: '2026-08-01' }, { date: '2026-08-20' }, { date: '2026-08-10' }],
      monthKey: '',
    });
    expect(out.records.map(r => r.date)).toEqual(['2026-08-20', '2026-08-10', '2026-08-01']);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../gas/lib/shape.js"`

- [ ] **Step 3: 구현**

`gas/lib/shape.js`:

```js
/**
 * 학부모 응답 정형화.
 *
 * 반드시 allowlist로 고른다. 삭제(blacklist) 방식은 시트에 새 컬럼이
 * 늘어날 때 조용히 유출되므로 쓰지 않는다.
 */

const PARENT_RECORD_FIELDS = [
  'date',
  'progress',
  'homeworkStatus',
  'homeworkLevel',
  'testName',
  'testScore',
  'testMax',
  'attendance',
  'nextHomework',
  'comment',
];

function toParentRecord(row) {
  const src = row || {};
  const out = {};
  PARENT_RECORD_FIELDS.forEach(function (f) {
    out[f] = src[f] === null || src[f] === undefined ? '' : src[f];
  });
  return out;
}

function toParentStudent(student, className) {
  const s = student || {};
  return {
    name: s.name || '',
    grade: s.grade || '',
    className: className || '',
  };
}

function toParentPayload(input) {
  const opts = input || {};
  const records = (Array.isArray(opts.records) ? opts.records.slice() : [])
    .sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    })
    .map(toParentRecord);

  return {
    student: toParentStudent(opts.student, opts.className),
    summary: computeSummary(records, opts.monthKey),
    records: records,
  };
}

if (typeof module !== 'undefined') {
  /* eslint-disable no-var */
  var computeSummary = require('./summary.js').computeSummary;
  module.exports = {
    PARENT_RECORD_FIELDS,
    toParentRecord,
    toParentStudent,
    toParentPayload,
  };
}
```

> **주의: `var`를 `const`/`let`으로 바꾸지 말 것.**
>
> GAS는 모든 파일이 하나의 전역 스코프를 공유하므로 `summary.js`의 `computeSummary`를 그냥 호출하면 된다. Node에서는 가드 블록 안의 `require`가 그 이름을 채워야 한다.
>
> `var`는 블록이 아니라 모듈 스코프로 호이스팅되므로 `toParentPayload`가 볼 수 있고, 할당은 파일 로드 시점에 끝난다. GAS에서는 블록이 실행되지 않지만 `var computeSummary;`(할당 없는 재선언)는 이미 존재하는 전역 함수를 덮어쓰지 않으므로 안전하다.
>
> `const`로 바꾸면 `if` 블록에 갇혀 Node에서 `toParentPayload`가 참조하지 못한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — shape 관련 7개 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add gas/lib/shape.js test/shape.test.js
git commit -m "feat: 학부모 응답 allowlist 정형화

민감 필드가 새 컬럼 추가 시에도 유출되지 않도록 blacklist가 아닌
allowlist로 필드를 고른다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `lib/router.js` — 요청 파싱과 액션 검증

**Files:**
- Create: `gas/lib/router.js`, `test/router.test.js`

**Interfaces:**
- Produces:
  - `ACTIONS` — `{[action]: {auth: 'none'|'token'|'session', required: string[]}}`
  - `parseRequest(rawBody) -> {ok:true, action, auth, body} | {ok:false, error, message}`
  - `ok(data) -> {ok:true, data}`
  - `fail(error, message) -> {ok:false, error, message}`

- [ ] **Step 1: 실패하는 테스트 작성**

`test/router.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseRequest, ok, fail, ACTIONS } from '../gas/lib/router.js';

describe('parseRequest', () => {
  it('정상 요청을 파싱한다', () => {
    const r = parseRequest(JSON.stringify({ action: 'parent.load', token: 'abc' }));
    expect(r.ok).toBe(true);
    expect(r.action).toBe('parent.load');
    expect(r.auth).toBe('token');
    expect(r.body.token).toBe('abc');
  });

  it('JSON이 아니면 BAD_JSON이다', () => {
    const r = parseRequest('not json');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('BAD_JSON');
  });

  it('빈 본문이면 BAD_JSON이다', () => {
    expect(parseRequest('').error).toBe('BAD_JSON');
    expect(parseRequest(null).error).toBe('BAD_JSON');
  });

  it('모르는 action이면 UNKNOWN_ACTION이다', () => {
    const r = parseRequest(JSON.stringify({ action: 'admin.dropTable' }));
    expect(r.error).toBe('UNKNOWN_ACTION');
  });

  it('action이 없으면 UNKNOWN_ACTION이다', () => {
    expect(parseRequest(JSON.stringify({ token: 'x' })).error).toBe('UNKNOWN_ACTION');
  });

  it('필수 파라미터가 빠지면 MISSING_PARAM이다', () => {
    const r = parseRequest(JSON.stringify({ action: 'parent.load' }));
    expect(r.error).toBe('MISSING_PARAM');
    expect(r.message).toContain('token');
  });

  it('세션이 필요한 action은 sessionKey를 요구한다', () => {
    const r = parseRequest(JSON.stringify({ action: 'admin.classes' }));
    expect(r.error).toBe('MISSING_PARAM');
    expect(r.message).toContain('sessionKey');
  });

  it('sessionKey가 있으면 통과한다', () => {
    const r = parseRequest(JSON.stringify({ action: 'admin.classes', sessionKey: 'k' }));
    expect(r.ok).toBe(true);
  });

  it('admin.login은 세션이 필요 없다', () => {
    const r = parseRequest(JSON.stringify({ action: 'admin.login', password: 'p' }));
    expect(r.ok).toBe(true);
    expect(r.auth).toBe('none');
  });

  it('모든 action이 auth와 required를 갖는다', () => {
    Object.keys(ACTIONS).forEach((k) => {
      expect(['none', 'token', 'session']).toContain(ACTIONS[k].auth);
      expect(Array.isArray(ACTIONS[k].required)).toBe(true);
    });
  });
});

describe('ok / fail', () => {
  it('ok는 성공 봉투를 만든다', () => {
    expect(ok({ a: 1 })).toEqual({ ok: true, data: { a: 1 } });
  });

  it('fail은 실패 봉투를 만든다', () => {
    expect(fail('X', '문제')).toEqual({ ok: false, error: 'X', message: '문제' });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../gas/lib/router.js"`

- [ ] **Step 3: 구현**

`gas/lib/router.js`:

```js
/**
 * 요청 파싱과 액션 검증. 순수 함수.
 */

const ACTIONS = {
  'parent.load':         { auth: 'token',   required: ['token'] },
  'parent.more':         { auth: 'token',   required: ['token', 'cursor'] },
  'admin.login':         { auth: 'none',    required: ['password'] },
  'admin.classes':       { auth: 'session', required: [] },
  'admin.roster':        { auth: 'session', required: ['classId', 'date'] },
  'admin.saveBatch':     { auth: 'session', required: ['classId', 'date', 'records', 'clientRequestId'] },
  'admin.students':      { auth: 'session', required: [] },
  'admin.upsertStudent': { auth: 'session', required: ['student'] },
  'admin.reissueToken':  { auth: 'session', required: ['studentId'] },
};

function ok(data) {
  return { ok: true, data: data };
}

function fail(error, message) {
  return { ok: false, error: error, message: message };
}

function isBlank(v) {
  return v === '' || v === null || v === undefined;
}

function parseRequest(rawBody) {
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return fail('BAD_JSON', '요청 형식이 올바르지 않습니다.');
  }
  if (!body || typeof body !== 'object') {
    return fail('BAD_JSON', '요청 형식이 올바르지 않습니다.');
  }

  const spec = ACTIONS[body.action];
  if (!spec) {
    return fail('UNKNOWN_ACTION', '알 수 없는 요청입니다.');
  }

  const required = spec.required.slice();
  if (spec.auth === 'session') required.push('sessionKey');

  const missing = required.filter(function (k) { return isBlank(body[k]); });
  if (missing.length) {
    return fail('MISSING_PARAM', '필수 항목이 없습니다: ' + missing.join(', '));
  }

  return { ok: true, action: body.action, auth: spec.auth, body: body };
}

if (typeof module !== 'undefined') {
  module.exports = { ACTIONS, parseRequest, ok, fail };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — router 관련 12개 테스트 통과. 전체 62개 통과.

- [ ] **Step 5: 커밋**

```bash
git add gas/lib/router.js test/router.test.js
git commit -m "feat: 요청 파싱·액션 검증 라우터 로직

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: 저장소 재구조화와 디자인 토큰 추출

기존 `index.html`을 `public/`으로 옮기고, `:root` 토큰 블록만 외부 CSS로 뽑아 세 화면이 공유하게 한다. **인라인 CSS 전체를 옮기지 않는다** — 토큰 블록만 건드리는 게 회귀 위험이 가장 낮다.

**Files:**
- Move: `index.html` → `public/index.html`
- Create: `public/assets/css/tokens.css`, `netlify.toml`
- Modify: `public/index.html` (토큰 블록 제거 + link 추가 + nav에 `학생관리` 추가)

**Interfaces:**
- Produces: `public/assets/css/tokens.css` — 세 화면이 공유하는 CSS 변수. 클래스는 넣지 않는다.

- [ ] **Step 1: 파일 이동**

```bash
mkdir -p public/assets/css public/assets/js
git mv index.html public/index.html
```

- [ ] **Step 2: `public/assets/css/tokens.css` 생성**

`public/index.html`의 `:root` 3개 블록(기본 / `@media (prefers-color-scheme: dark)` / `:root[data-theme="dark"]`)을 그대로 옮기고, 상태색 4개를 추가한다.

```css
/* 지아나영어 공유 디자인 토큰 — 홈페이지 / 학부모 / 선생님 화면 공용 */
:root{
  --bg: #f6f2e6;
  --bg-elevated: #ffffff;
  --surface: #ffffff;
  --surface-dim: #efe8d6;
  --text: #1c2620;
  --text-soft: #4f5b51;
  --forest: #1b3b2b;
  --forest-deep: #10241a;
  --heading: #1b3b2b;
  --garnet: #8b0f0f;
  --garnet-deep: #6a0b0b;
  --gold: #b3894f;
  --border: rgba(27,59,43,0.16);
  --shadow: 0 20px 50px -25px rgba(16,36,26,0.35);

  --hero-bg: #12271c;
  --hero-bg-2: #1b3b2b;
  --hero-text: #f6f2e6;
  --hero-text-soft: rgba(246,242,230,0.78);
  --hero-border: rgba(246,242,230,0.18);

  /* 상태색 — 형광색 금지, 기존 팔레트에서만 고른다 */
  --state-good: var(--forest);
  --state-warn: var(--gold);
  --state-bad: var(--garnet);
  --state-none: var(--text-soft);

  --font-display: 'Fraunces', 'Noto Serif KR', ui-serif, Georgia, serif;
  --font-body: 'Rosario', 'Noto Sans KR', ui-sans-serif, system-ui, sans-serif;
  --font-kr-display: 'Song Myung', 'Fraunces', serif;
  --font-kr-body: 'Noto Sans KR', 'Rosario', sans-serif;
}

@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg: #12211a;
    --bg-elevated: #17301f;
    --surface: #1a3524;
    --surface-dim: #16291c;
    --text: #f0ece0;
    --text-soft: #b9c4b9;
    --heading: #b7e0c3;
    --border: rgba(240,236,224,0.14);
    --shadow: 0 20px 50px -20px rgba(0,0,0,0.6);
    --state-good: #7fc898;
    --state-warn: #d8ab68;
    --state-bad: #e08585;
  }
}
:root[data-theme="dark"]{
  --bg: #12211a;
  --bg-elevated: #17301f;
  --surface: #1a3524;
  --surface-dim: #16291c;
  --text: #f0ece0;
  --text-soft: #b9c4b9;
  --heading: #b7e0c3;
  --border: rgba(240,236,224,0.14);
  --shadow: 0 20px 50px -20px rgba(0,0,0,0.6);
  --state-good: #7fc898;
  --state-warn: #d8ab68;
  --state-bad: #e08585;
}
```

> 다크모드에서 `--state-*`를 밝은 톤으로 다시 정의하는 이유: 어두운 배경 위에서 `#8b0f0f` 같은 진한 색은 판별이 거의 불가능하다.

- [ ] **Step 3: `public/index.html` 수정**

1. `<style>` 블록 안의 `/* ---------- Tokens ---------- */` 주석부터 `:root[data-theme="dark"]{...}` 닫는 중괄호까지(원본 12~64행)를 **삭제**한다.
2. 그 자리를 대신할 `<link>`를 폰트 `<link>` 바로 다음 줄에 추가한다:

```html
<link rel="stylesheet" href="/assets/css/tokens.css">
```

3. nav의 `<ul class="nav-links">`에서 `Results` 항목 다음에 한 줄 추가한다:

```html
<li><a href="/students/">학생관리</a></li>
```

4. footer의 `<ul class="footer-links">`에도 같은 항목을 `Results` 다음에 추가한다:

```html
<li><a href="/students/">학생관리</a></li>
```

- [ ] **Step 4: `netlify.toml` 생성**

```toml
[build]
  publish = "public"

# 학부모 링크를 짧게: /p/<토큰> → /parent/?t=<토큰>
[[redirects]]
  from = "/p/:token"
  to = "/parent/index.html?t=:token"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "no-referrer"
```

> `Referrer-Policy: no-referrer`가 중요하다. 학부모 링크에 토큰이 들어 있으므로, 페이지에서 외부 링크를 누를 때 리퍼러로 토큰이 새어나가면 안 된다.

- [ ] **Step 5: 브라우저에서 회귀 확인**

Run: `npx serve public -l 5000` (또는 임의의 정적 서버)
브라우저에서 `http://localhost:5000` 확인:
- 배경이 크림색, 히어로가 짙은 초록으로 **이전과 동일하게** 보인다
- nav에 `학생관리`가 보인다 (링크는 아직 404 — 정상)
- OS를 다크모드로 바꾸면 어두운 테마로 전환된다

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "refactor: public/으로 재구조화, 디자인 토큰 추출, netlify 설정

- index.html을 public/으로 이동해 Netlify publish 디렉터리를 분리
- :root 토큰 블록만 assets/css/tokens.css로 추출 (인라인 CSS는 유지)
- 상태색 4종 추가, 다크모드용 밝은 변형 포함
- nav/footer에 학생관리 링크 추가
- Referrer-Policy: no-referrer — 링크의 토큰이 리퍼러로 새지 않게

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: GAS 시트 계층과 라우터 배선

**Files:**
- Create: `gas/appsscript.json`, `gas/Sheets.js`, `gas/Code.js`, `.claspignore`

**Interfaces:**
- Consumes: `parseRequest`, `ok`, `fail` (Task 6)
- Produces:
  - `SHEETS` — 시트명 상수 `{STUDENTS, CLASSES, RECORDS, CONFIG}`
  - `readTable(sheetName) -> object[]` — 1행을 헤더로 삼아 객체 배열 반환
  - `appendRow(sheetName, obj) -> void`
  - `updateRowById(sheetName, idColumn, idValue, patch) -> boolean`
  - `findRow(sheetName, column, value) -> object|null`
  - `doPost(e)` — 라우터 진입점
  - `handlePing(body) -> object` — 배선 확인용

- [ ] **Step 1: `gas/appsscript.json` 생성**

```json
{
  "timeZone": "Asia/Seoul",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

- [ ] **Step 2: `.claspignore` 생성 (저장소 루트)**

```
**/**
!gas/**/*.js
!gas/appsscript.json
gas/**/*.test.js
```

- [ ] **Step 3: `gas/Sheets.js` 생성**

```js
/**
 * 시트 접근 계층. 얇게 유지하고 수동 검증한다.
 * 로직이 붙기 시작하면 gas/lib/으로 빼서 단위 테스트한다.
 */

const SHEETS = {
  STUDENTS: 'Students',
  CLASSES: 'Classes',
  RECORDS: 'Records',
  CONFIG: 'Config',
};

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('SHEET_ID 스크립트 속성이 설정되지 않았습니다.');
  return SpreadsheetApp.openById(id);
}

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + name);
  return sheet;
}

/** 1행을 헤더로 삼아 객체 배열로 읽는다. */
function readTable(sheetName) {
  const values = getSheet_(sheetName).getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0].map(function (h) { return String(h).trim(); });
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(function (c) { return c === '' || c === null; })) continue;

    const obj = { _rowIndex: i + 1 };
    header.forEach(function (key, j) {
      if (key) obj[key] = row[j] === null || row[j] === undefined ? '' : row[j];
    });
    rows.push(obj);
  }
  return rows;
}

function getHeader_(sheetName) {
  const sheet = getSheet_(sheetName);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function (h) { return String(h).trim(); });
}

function appendRow(sheetName, obj) {
  const header = getHeader_(sheetName);
  const row = header.map(function (key) {
    return obj[key] === null || obj[key] === undefined ? '' : obj[key];
  });
  getSheet_(sheetName).appendRow(row);
}

function findRow(sheetName, column, value) {
  const rows = readTable(sheetName);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][column]) === String(value)) return rows[i];
  }
  return null;
}

/** 지정 컬럼의 값이 일치하는 첫 행을 부분 갱신한다. 갱신했으면 true. */
function updateRowById(sheetName, idColumn, idValue, patch) {
  const sheet = getSheet_(sheetName);
  const header = getHeader_(sheetName);
  const target = findRow(sheetName, idColumn, idValue);
  if (!target) return false;

  header.forEach(function (key, j) {
    if (key && Object.prototype.hasOwnProperty.call(patch, key)) {
      sheet.getRange(target._rowIndex, j + 1).setValue(patch[key]);
    }
  });
  return true;
}

function getConfig(key, fallback) {
  const row = findRow(SHEETS.CONFIG, 'key', key);
  return row && row.value !== '' ? row.value : fallback;
}
```

- [ ] **Step 4: `gas/Code.js` 생성**

```js
/**
 * Web App 진입점. 모든 요청은 POST + text/plain.
 *
 * 응답은 어떤 경우에도 JSON이어야 한다. 예외가 새어나가면 GAS가
 * HTML 오류 페이지를 반환하고, 프런트의 JSON 파싱이 깨진다.
 */

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const raw = e && e.postData ? e.postData.contents : '';
    const parsed = parseRequest(raw);
    if (!parsed.ok) return jsonOutput_(parsed);

    return jsonOutput_(dispatch_(parsed));
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return jsonOutput_(fail('SERVER_ERROR', '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'));
  }
}

function doGet() {
  return jsonOutput_(fail('METHOD_NOT_ALLOWED', 'POST로 요청해 주세요.'));
}

function dispatch_(parsed) {
  const body = parsed.body;

  switch (parsed.action) {
    case 'ping':
      return handlePing(body);
    default:
      return fail('UNKNOWN_ACTION', '알 수 없는 요청입니다.');
  }
}

function handlePing(body) {
  return ok({
    pong: true,
    echo: body.echo || '',
    sheets: readTable(SHEETS.CONFIG).length,
  });
}
```

- [ ] **Step 5: `ping`을 라우터에 등록**

`gas/lib/router.js`의 `ACTIONS`에 첫 항목으로 추가한다:

```js
  'ping':                { auth: 'none',    required: [] },
```

`test/router.test.js`에 테스트를 추가한다:

```js
  it('ping은 인증이 필요 없다', () => {
    const r = parseRequest(JSON.stringify({ action: 'ping' }));
    expect(r.ok).toBe(true);
    expect(r.auth).toBe('none');
  });
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — 63개 통과

- [ ] **Step 7: 구글시트와 GAS 프로젝트 준비 (수동 1회)**

1. 구글시트를 새로 만들고 이름을 `지아나영어 학생관리`로 한다
2. 시트 4장을 만들고 **1행에 헤더를 정확히** 입력한다:

   `Students`: `studentId` `name` `grade` `classId` `parentToken` `active` `note` `createdAt`

   `Classes`: `classId` `className` `schedule` `active`

   `Records`: `recordId` `studentId` `classId` `date` `progress` `homeworkStatus` `homeworkLevel` `testName` `testScore` `testMax` `attendance` `nextHomework` `comment` `clientRequestId` `createdAt` `updatedAt`

   `Config`: `key` `value`

3. `Config`에 한 행 넣는다: `academyName` / `지아나영어`
4. `Classes`에 한 행 넣는다: `C01` / `Structure 화목 5시` / `화·목 17:00` / `TRUE`
5. 시트 공유를 **선생님 계정 단독**으로 제한한다 (링크 공유 끄기)
6. 시트 URL에서 ID를 복사해 둔다 (`/d/` 와 `/edit` 사이 문자열)

- [ ] **Step 8: clasp로 GAS 프로젝트 생성과 배포**

```bash
npx clasp login
npx clasp create --type sheets --title "지아나영어 학생관리" --rootDir gas --parentId <시트ID>
npx clasp push
```

Apps Script 편집기에서:
1. 프로젝트 설정 → 스크립트 속성 → `SHEET_ID` = 위 시트ID, `ADMIN_PASSWORD` = **16자 이상** 비밀번호
2. 배포 → 새 배포 → 유형: 웹 앱 → 실행: **나** / 액세스: **모든 사용자** → 배포
3. 웹 앱 URL을 복사해 둔다

- [ ] **Step 9: 배선 수동 검증**

Run (URL을 실제 배포 URL로 교체):

```bash
curl -sL -X POST "<웹앱URL>" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"ping","echo":"hello"}'
```

Expected: `{"ok":true,"data":{"pong":true,"echo":"hello","sheets":1}}`

`-L`이 필요하다 — GAS는 `script.googleusercontent.com`으로 302 리다이렉트한다.

이어서 오류 경로도 확인한다:

```bash
curl -sL -X POST "<웹앱URL>" -H "Content-Type: text/plain;charset=utf-8" -d 'not json'
```

Expected: `{"ok":false,"error":"BAD_JSON","message":"요청 형식이 올바르지 않습니다."}`

- [ ] **Step 10: 커밋**

`.clasp.json`은 커밋한다 (scriptId는 자격증명이 아니다). OAuth 토큰이 든 `.clasprc.json`은 `.gitignore`에 이미 있다.

```bash
git add gas/ .claspignore .clasp.json test/router.test.js
git commit -m "feat: GAS 시트 계층과 라우터 배선

- appsscript.json: V8, 실행=나 / 접근=모든 사용자
- Sheets.js: 헤더 기반 read/append/update, openById로 명시적 접근
- Code.js: doPost 진입점, 모든 경로에서 JSON 응답 보장
- ping 액션으로 배선 수동 검증

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: GAS 인증과 학생·반 관리

**Files:**
- Create: `gas/Auth.js`, `gas/Students.js`
- Modify: `gas/Code.js` (dispatch에 액션 연결)

**Interfaces:**
- Consumes: `readTable`, `appendRow`, `updateRowById`, `findRow`, `SHEETS` (Task 8) · `generateToken`, `nextStudentId` (Task 2) · `ok`, `fail` (Task 6)
- Produces:
  - `createSession() -> {sessionKey, expiresAt}`
  - `requireSession_(sessionKey) -> void` (실패 시 throw `AuthError`)
  - `findStudentByToken(token) -> object|null`
  - `handleAdminLogin(body)`, `handleAdminClasses(body)`, `handleAdminStudents(body)`, `handleAdminUpsertStudent(body)`, `handleAdminReissueToken(body)`

- [ ] **Step 1: `gas/Auth.js` 생성**

```js
/**
 * 인증. 학부모는 토큰 단독, 선생님은 비밀번호 + 세션키.
 *
 * 레이트리밋은 의도적으로 두지 않는다 (설계 문서 §8).
 * 대신 관리자 비밀번호를 16자 이상으로 두고, 학부모 토큰은 32자를 쓴다.
 */

const SESSION_TTL_SECONDS = 8 * 60 * 60;

function AuthError(message) {
  this.name = 'AuthError';
  this.message = message;
}
AuthError.prototype = Object.create(Error.prototype);

function createSession() {
  const key = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  CacheService.getScriptCache().put('session:' + key, expiresAt, SESSION_TTL_SECONDS);
  return { sessionKey: key, expiresAt: expiresAt };
}

function requireSession_(sessionKey) {
  const hit = CacheService.getScriptCache().get('session:' + sessionKey);
  if (!hit) throw new AuthError('로그인이 만료되었습니다. 다시 로그인해 주세요.');
}

function handleAdminLogin(body) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!expected) return fail('SERVER_ERROR', '관리자 비밀번호가 설정되지 않았습니다.');

  if (String(body.password) !== String(expected)) {
    return fail('BAD_CREDENTIALS', '비밀번호가 올바르지 않습니다.');
  }
  return ok(createSession());
}

/** 학부모 토큰으로 학생을 찾는다. 비활성 학생은 없는 것으로 취급한다. */
function findStudentByToken(token) {
  const student = findRow(SHEETS.STUDENTS, 'parentToken', token);
  if (!student) return null;
  if (String(student.active).toUpperCase() === 'FALSE') return null;
  return student;
}
```

- [ ] **Step 2: `gas/Students.js` 생성**

```js
/**
 * 학생·반 조회와 학생 등록/수정/토큰 재발급.
 */

function listClasses_() {
  return readTable(SHEETS.CLASSES)
    .filter(function (c) { return String(c.active).toUpperCase() !== 'FALSE'; })
    .map(function (c) {
      return { classId: c.classId, className: c.className, schedule: c.schedule };
    });
}

function classNameOf_(classId) {
  const row = findRow(SHEETS.CLASSES, 'classId', classId);
  return row ? row.className : '';
}

function handleAdminClasses(body) {
  requireSession_(body.sessionKey);
  return ok({ classes: listClasses_() });
}

/** 선생님 화면용 — 토큰을 포함한다. 학부모에게는 절대 이 형태를 주지 않는다. */
function handleAdminStudents(body) {
  requireSession_(body.sessionKey);

  const students = readTable(SHEETS.STUDENTS).map(function (s) {
    return {
      studentId: s.studentId,
      name: s.name,
      grade: s.grade,
      classId: s.classId,
      className: classNameOf_(s.classId),
      parentToken: s.parentToken,
      active: String(s.active).toUpperCase() !== 'FALSE',
      note: s.note,
    };
  });
  return ok({ students: students, classes: listClasses_() });
}

function handleAdminUpsertStudent(body) {
  requireSession_(body.sessionKey);

  const input = body.student || {};
  if (!input.name) return fail('MISSING_PARAM', '학생 이름은 필수입니다.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (input.studentId) {
      const updated = updateRowById(SHEETS.STUDENTS, 'studentId', input.studentId, {
        name: input.name,
        grade: input.grade || '',
        classId: input.classId || '',
        active: input.active === false ? 'FALSE' : 'TRUE',
        note: input.note || '',
      });
      if (!updated) return fail('NOT_FOUND', '학생을 찾을 수 없습니다.');
      return ok({ studentId: input.studentId });
    }

    const existingIds = readTable(SHEETS.STUDENTS).map(function (s) { return s.studentId; });
    const studentId = nextStudentId(existingIds);

    appendRow(SHEETS.STUDENTS, {
      studentId: studentId,
      name: input.name,
      grade: input.grade || '',
      classId: input.classId || '',
      parentToken: generateToken(),
      active: 'TRUE',
      note: input.note || '',
      createdAt: new Date().toISOString(),
    });
    return ok({ studentId: studentId });
  } finally {
    lock.releaseLock();
  }
}

function handleAdminReissueToken(body) {
  requireSession_(body.sessionKey);

  const token = generateToken();
  const updated = updateRowById(SHEETS.STUDENTS, 'studentId', body.studentId, { parentToken: token });
  if (!updated) return fail('NOT_FOUND', '학생을 찾을 수 없습니다.');
  return ok({ parentToken: token });
}
```

- [ ] **Step 3: `gas/Code.js`의 `dispatch_`에 액션 연결**

`switch` 문을 아래로 교체한다:

```js
  switch (parsed.action) {
    case 'ping':                return handlePing(body);
    case 'admin.login':         return handleAdminLogin(body);
    case 'admin.classes':       return handleAdminClasses(body);
    case 'admin.students':      return handleAdminStudents(body);
    case 'admin.upsertStudent': return handleAdminUpsertStudent(body);
    case 'admin.reissueToken':  return handleAdminReissueToken(body);
    default:                    return fail('UNKNOWN_ACTION', '알 수 없는 요청입니다.');
  }
```

`doPost`의 catch에서 `AuthError`를 401 성격의 응답으로 구분한다. `try` 블록 다음의 `catch`를 교체한다:

```js
  } catch (err) {
    if (err && err.name === 'AuthError') {
      return jsonOutput_(fail('UNAUTHORIZED', err.message));
    }
    console.error(err && err.stack ? err.stack : err);
    return jsonOutput_(fail('SERVER_ERROR', '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'));
  }
```

- [ ] **Step 4: 푸시**

Run: `npx clasp push`
그리고 Apps Script 편집기에서 **배포 → 배포 관리 → 편집 → 버전: 새 버전 → 배포**로 기존 배포를 갱신한다. (새 배포를 만들면 URL이 바뀐다.)

- [ ] **Step 5: 수동 검증**

```bash
# 1) 로그인 실패
curl -sL -X POST "<웹앱URL>" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"admin.login","password":"wrong"}'
# Expected: {"ok":false,"error":"BAD_CREDENTIALS",...}

# 2) 로그인 성공 → sessionKey 복사
curl -sL -X POST "<웹앱URL>" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"admin.login","password":"<실제비번>"}'

# 3) 세션 없이 접근
curl -sL -X POST "<웹앱URL>" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"admin.classes"}'
# Expected: {"ok":false,"error":"MISSING_PARAM",...}

# 4) 잘못된 세션
curl -sL -X POST "<웹앱URL>" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"admin.classes","sessionKey":"bogus"}'
# Expected: {"ok":false,"error":"UNAUTHORIZED",...}

# 5) 정상 조회
curl -sL -X POST "<웹앱URL>" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"admin.classes","sessionKey":"<발급받은키>"}'
# Expected: C01 반이 담긴 목록

# 6) 학생 등록
curl -sL -X POST "<웹앱URL>" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"admin.upsertStudent","sessionKey":"<키>","student":{"name":"테스트학생","grade":"고1","classId":"C01"}}'
# Expected: {"ok":true,"data":{"studentId":"S001"}}
```

시트의 `Students`에 행이 생기고 `parentToken`이 32자로 채워졌는지 눈으로 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add gas/Auth.js gas/Students.js gas/Code.js
git commit -m "feat: GAS 인증과 학생·반 관리

- 관리자 비밀번호 → 8시간 세션키 (CacheService)
- 학부모 토큰 조회, 비활성 학생은 없는 것으로 취급
- 학생 등록/수정/토큰 재발급, 쓰기는 LockService로 보호

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: GAS 기록 저장과 조회

**Files:**
- Create: `gas/Records.js`
- Modify: `gas/Code.js` (dispatch에 액션 연결)

**Interfaces:**
- Consumes: Task 8·9의 전부 · `validateBatch` (Task 3) · `generateRecordId` (Task 2) · `toParentPayload` (Task 5)
- Produces: `handleAdminRoster(body)`, `handleAdminSaveBatch(body)`, `handleParentLoad(body)`

- [ ] **Step 1: `gas/Records.js` 생성**

```js
/**
 * 수업 기록 조회·저장.
 *
 * (studentId, date)를 유일 키로 삼아 upsert한다. 같은 날 같은 학생을
 * 두 번 저장해도 행이 늘지 않는다.
 */

const DEDUP_TTL_SECONDS = 10 * 60;

function recordsOfStudent_(studentId) {
  return readTable(SHEETS.RECORDS).filter(function (r) {
    return String(r.studentId) === String(studentId);
  });
}

function handleAdminRoster(body) {
  requireSession_(body.sessionKey);

  const students = readTable(SHEETS.STUDENTS)
    .filter(function (s) {
      return String(s.classId) === String(body.classId)
        && String(s.active).toUpperCase() !== 'FALSE';
    })
    .map(function (s) {
      return { studentId: s.studentId, name: s.name, grade: s.grade };
    });

  const existing = readTable(SHEETS.RECORDS).filter(function (r) {
    return String(r.classId) === String(body.classId)
      && String(r.date) === String(body.date);
  });

  return ok({ students: students, existingRecords: existing });
}

function handleAdminSaveBatch(body) {
  requireSession_(body.sessionKey);

  const cache = CacheService.getScriptCache();
  const dedupKey = 'req:' + body.clientRequestId;
  const seen = cache.get(dedupKey);
  if (seen) return ok({ saved: Number(seen), deduped: true });

  const problems = validateBatch(body.records);
  if (problems.length) {
    return fail('INVALID_RECORD',
      problems.length + '건의 입력이 올바르지 않습니다: ' + problems[0].errors.join(', '));
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const now = new Date().toISOString();
    const existing = readTable(SHEETS.RECORDS);
    let saved = 0;

    body.records.forEach(function (rec) {
      const match = existing.filter(function (r) {
        return String(r.studentId) === String(rec.studentId)
          && String(r.date) === String(rec.date);
      })[0];

      const payload = {
        studentId: rec.studentId,
        classId: body.classId,
        date: rec.date,
        progress: rec.progress || '',
        homeworkStatus: rec.homeworkStatus || '',
        homeworkLevel: rec.homeworkLevel || '',
        testName: rec.testName || '',
        testScore: rec.testScore === '' || rec.testScore === null ? '' : rec.testScore,
        testMax: rec.testMax === '' || rec.testMax === null ? '' : rec.testMax,
        attendance: rec.attendance || '',
        nextHomework: rec.nextHomework || '',
        comment: rec.comment || '',
        clientRequestId: body.clientRequestId,
        updatedAt: now,
      };

      if (match) {
        updateRowById(SHEETS.RECORDS, 'recordId', match.recordId, payload);
      } else {
        payload.recordId = generateRecordId(new Date());
        payload.createdAt = now;
        appendRow(SHEETS.RECORDS, payload);
      }
      saved++;
    });

    cache.put(dedupKey, String(saved), DEDUP_TTL_SECONDS);
    return ok({ saved: saved });
  } finally {
    lock.releaseLock();
  }
}

function handleParentLoad(body) {
  const student = findStudentByToken(body.token);

  // 토큰이 없는 경우와 있는 경우의 문구를 동일하게 유지한다.
  // 토큰의 유효성 자체를 알려주지 않기 위함이다.
  if (!student) {
    return fail('NOT_FOUND', '링크가 올바르지 않거나 만료되었습니다. 선생님께 문의해 주세요.');
  }

  const monthKey = body.monthKey || new Date().toISOString().slice(0, 7);

  return ok(toParentPayload({
    student: student,
    className: classNameOf_(student.classId),
    records: recordsOfStudent_(student.studentId),
    monthKey: monthKey,
  }));
}
```

> `parent.more` 액션은 MVP에서 구현하지 않는다. `parent.load`가 전체 기록을 한 번에 내려주고 화면에서 잘라 보여준다. 학생 1명의 기록은 연 100건 내외라 페이징 없이 충분하다. 라우터의 `ACTIONS`에서 `parent.more`를 **제거한다** — 스펙에는 있었으나 MVP에는 불필요한 복잡도다.

- [ ] **Step 2: `parent.more` 제거와 테스트 갱신**

`gas/lib/router.js`의 `ACTIONS`에서 `'parent.more'` 줄을 삭제한다.

`test/router.test.js`에 회귀 방지 테스트를 추가한다:

```js
  it('MVP에 없는 parent.more는 거부한다', () => {
    const r = parseRequest(JSON.stringify({ action: 'parent.more', token: 'a', cursor: '1' }));
    expect(r.error).toBe('UNKNOWN_ACTION');
  });
```

- [ ] **Step 3: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — 64개 통과

- [ ] **Step 4: `gas/Code.js`의 `dispatch_`에 액션 연결**

```js
    case 'admin.roster':        return handleAdminRoster(body);
    case 'admin.saveBatch':     return handleAdminSaveBatch(body);
    case 'parent.load':         return handleParentLoad(body);
```

- [ ] **Step 5: 푸시하고 수동 검증**

Run: `npx clasp push` 후 배포 갱신.

```bash
# 1) 명단 조회
curl -sL -X POST "<웹앱URL>" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"admin.roster","sessionKey":"<키>","classId":"C01","date":"2026-08-30"}'

# 2) 기록 저장
curl -sL -X POST "<웹앱URL>" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"admin.saveBatch","sessionKey":"<키>","classId":"C01","date":"2026-08-30","clientRequestId":"test-1","records":[{"studentId":"S001","date":"2026-08-30","progress":"Unit 7","attendance":"출석","homeworkStatus":"제출","homeworkLevel":"상","testName":"단어시험","testScore":"18","testMax":"20","comment":"관계대명사 확인 필요","nextHomework":"Unit 8 예습"}]}'
# Expected: {"ok":true,"data":{"saved":1}}

# 3) 같은 clientRequestId로 다시 → 중복 방지
# Expected: {"ok":true,"data":{"saved":1,"deduped":true}}

# 4) clientRequestId만 바꿔 다시 → 행이 늘지 않고 갱신되는지 시트에서 확인
curl -sL -X POST "<웹앱URL>" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"admin.saveBatch","sessionKey":"<키>","classId":"C01","date":"2026-08-30","clientRequestId":"test-2","records":[{"studentId":"S001","date":"2026-08-30","progress":"Unit 7 수정","attendance":"지각","homeworkStatus":"제출","homeworkLevel":"중","testName":"","testScore":"","testMax":"","comment":"수정됨","nextHomework":""}]}'

# 5) 잘못된 값 거부
curl -sL -X POST "<웹앱URL>" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"admin.saveBatch","sessionKey":"<키>","classId":"C01","date":"2026-08-30","clientRequestId":"test-3","records":[{"studentId":"S001","date":"bad","attendance":"조퇴"}]}'
# Expected: {"ok":false,"error":"INVALID_RECORD",...}

# 6) 학부모 조회 (시트에서 parentToken 복사)
curl -sL -X POST "<웹앱URL>" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"parent.load","token":"<parentToken>"}'
# Expected: student/summary/records. parentToken·note·studentId가 응답에 없어야 한다.

# 7) 잘못된 토큰
curl -sL -X POST "<웹앱URL>" -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"parent.load","token":"bogus"}'
# Expected: NOT_FOUND — 6번의 유효 토큰과 문구가 구분되지 않아야 한다
```

**Records 시트에 행이 1개만 있는지** 반드시 확인한다. 2개면 upsert가 깨진 것이다.

- [ ] **Step 6: 커밋**

```bash
git add gas/Records.js gas/Code.js gas/lib/router.js test/router.test.js
git commit -m "feat: 수업 기록 저장·조회

- (studentId, date) 유일 키로 upsert, 같은 날 재저장 시 행이 늘지 않음
- clientRequestId 기반 중복 방지 (CacheService 10분)
- 쓰기는 LockService로 직렬화
- 잘못된 토큰과 유효한 토큰의 실패 문구를 동일하게 유지
- MVP 범위 축소: parent.more 제거, parent.load가 전체를 내려줌

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: 프론트엔드 API 래퍼

**Files:**
- Create: `public/assets/js/config.js`, `public/assets/js/api.js`, `test/api.test.js`

**Interfaces:**
- Produces:
  - `window.GIANNA_CONFIG = {GAS_URL}` (config.js)
  - `createApi(gasUrl, fetchImpl, options) -> {call(action, params)}`
  - `call`은 성공 시 `data`를 resolve, 실패 시 `{error, message}` 형태의 Error를 reject

- [ ] **Step 1: 실패하는 테스트 작성**

`test/api.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { createApi } from '../public/assets/js/api.js';

function jsonResponse(payload) {
  return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(payload)) });
}

describe('createApi', () => {
  it('POST로 text/plain 본문을 보낸다', async () => {
    const fetchMock = vi.fn(() => jsonResponse({ ok: true, data: { x: 1 } }));
    const api = createApi('https://gas.example/exec', fetchMock);

    await api.call('ping', { echo: 'hi' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://gas.example/exec');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(JSON.parse(init.body)).toEqual({ action: 'ping', echo: 'hi' });
  });

  it('성공 시 data를 돌려준다', async () => {
    const api = createApi('u', () => jsonResponse({ ok: true, data: { saved: 3 } }));
    expect(await api.call('admin.saveBatch', {})).toEqual({ saved: 3 });
  });

  it('ok:false면 error와 message를 담아 reject한다', async () => {
    const api = createApi('u', () => jsonResponse({ ok: false, error: 'NOT_FOUND', message: '없습니다' }));
    await expect(api.call('parent.load', {})).rejects.toMatchObject({
      code: 'NOT_FOUND', message: '없습니다',
    });
  });

  it('JSON이 아닌 응답은 BAD_RESPONSE로 정규화한다', async () => {
    const api = createApi('u', () => Promise.resolve({ ok: true, text: () => Promise.resolve('<html>') }));
    await expect(api.call('ping', {})).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('네트워크 오류는 NETWORK로 정규화한다', async () => {
    const api = createApi('u', () => Promise.reject(new Error('boom')), { retries: 0 });
    await expect(api.call('parent.load', {})).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('읽기 요청은 실패 시 한 번 재시도한다', async () => {
    let calls = 0;
    const fetchMock = vi.fn(() => {
      calls++;
      return calls === 1 ? Promise.reject(new Error('boom')) : jsonResponse({ ok: true, data: { x: 1 } });
    });
    const api = createApi('u', fetchMock, { retries: 1 });

    expect(await api.call('parent.load', {})).toEqual({ x: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('쓰기 요청은 재시도하지 않는다', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('boom')));
    const api = createApi('u', fetchMock, { retries: 1 });

    await expect(api.call('admin.saveBatch', {})).rejects.toMatchObject({ code: 'NETWORK' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('GAS URL이 비어 있으면 NOT_CONFIGURED로 실패한다', async () => {
    const api = createApi('', () => jsonResponse({ ok: true, data: {} }));
    await expect(api.call('ping', {})).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../public/assets/js/api.js"`

- [ ] **Step 3: `public/assets/js/config.js` 생성**

```js
/**
 * GAS 웹앱 배포 URL. 비밀이 아니다 — 인증은 토큰과 비밀번호가 담당한다.
 * clasp deploy 후 나온 URL로 교체한다.
 */
window.GIANNA_CONFIG = {
  GAS_URL: '',
};
```

- [ ] **Step 4: `public/assets/js/api.js` 생성**

```js
/**
 * GAS 웹앱 호출 래퍼.
 *
 * - 모든 요청은 POST + text/plain (preflight 회피)
 * - 읽기만 1회 재시도. 쓰기는 재시도하지 않는다.
 * - 어떤 실패든 {code, message}를 가진 Error로 정규화한다.
 */
(function (global) {
  const TIMEOUT_MS = 15000;
  const WRITE_ACTIONS = ['admin.saveBatch', 'admin.upsertStudent', 'admin.reissueToken'];

  function apiError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
  }

  function createApi(gasUrl, fetchImpl, options) {
    const opts = options || {};
    const doFetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    const maxRetries = opts.retries === undefined ? 1 : opts.retries;
    const timeoutMs = opts.timeoutMs || TIMEOUT_MS;

    function once(action, params) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;

      return doFetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action: action }, params || {})),
        redirect: 'follow',
        signal: controller ? controller.signal : undefined,
      }).then(function (res) {
        if (timer) clearTimeout(timer);
        return res.text();
      }).then(function (text) {
        let payload;
        try {
          payload = JSON.parse(text);
        } catch (e) {
          throw apiError('BAD_RESPONSE', '서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
        if (!payload || payload.ok !== true) {
          throw apiError(
            (payload && payload.error) || 'SERVER_ERROR',
            (payload && payload.message) || '처리 중 문제가 발생했습니다.'
          );
        }
        return payload.data;
      }).catch(function (err) {
        if (timer) clearTimeout(timer);
        if (err && err.code) throw err;
        throw apiError('NETWORK', '네트워크 연결을 확인해 주세요.');
      });
    }

    function call(action, params) {
      if (!gasUrl) {
        return Promise.reject(apiError('NOT_CONFIGURED', '서버 주소가 설정되지 않았습니다.'));
      }
      const isWrite = WRITE_ACTIONS.indexOf(action) !== -1;
      const retries = isWrite ? 0 : maxRetries;

      return once(action, params).catch(function (err) {
        if (retries > 0 && err.code === 'NETWORK') return once(action, params);
        throw err;
      });
    }

    return { call: call };
  }

  global.createApi = createApi;

  if (typeof module !== 'undefined') {
    module.exports = { createApi };
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — api 관련 8개 테스트 통과. 전체 72개.

- [ ] **Step 6: 커밋**

```bash
git add public/assets/js/config.js public/assets/js/api.js test/api.test.js
git commit -m "feat: GAS 호출 래퍼

- POST + text/plain으로 preflight 회피
- 읽기만 1회 재시도, 쓰기는 재시도 없음 (중복 저장 방지)
- 모든 실패를 {code, message} Error로 정규화

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: 공용 스타일시트

**Files:**
- Create: `public/assets/css/app.css`

**Interfaces:**
- Produces: `.gi-*` 접두사 클래스. 학부모/선생님/랜딩 세 화면이 공유한다.

- [ ] **Step 1: `public/assets/css/app.css` 생성**

```css
/* 학생관리 공용 스타일. tokens.css를 먼저 로드해야 한다. */

*{ box-sizing:border-box; }

body.gi{
  margin:0;
  background:var(--bg);
  color:var(--text);
  font-family:var(--font-kr-body);
  font-size:16px;
  line-height:1.6;
  -webkit-font-smoothing:antialiased;
}

.gi-wrap{
  max-width:44rem;
  margin-inline:auto;
  padding:0 1.1rem 4rem;
}

/* ---------- 헤더 ---------- */
.gi-head{
  background:var(--hero-bg);
  color:var(--hero-text);
  padding:1.6rem 0 1.9rem;
  margin-bottom:1.4rem;
}
.gi-head .gi-wrap{ padding-bottom:0; }
.gi-head-brand{
  font-family:var(--font-body);
  font-size:0.68rem;
  font-weight:700;
  letter-spacing:0.22em;
  text-transform:uppercase;
  color:var(--gold);
  margin-bottom:0.7rem;
}
.gi-head h1{
  font-family:var(--font-kr-display);
  font-weight:400;
  font-size:1.75rem;
  line-height:1.2;
  margin:0;
}
.gi-head-sub{
  margin-top:0.45rem;
  font-size:0.85rem;
  color:var(--hero-text-soft);
}

/* ---------- 요약 카드 ---------- */
.gi-cards{
  display:grid;
  grid-template-columns:repeat(3, 1fr);
  gap:0.6rem;
  margin-bottom:1.6rem;
}
.gi-card{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:3px;
  padding:0.95rem 0.7rem;
  text-align:center;
}
.gi-card-label{
  font-size:0.68rem;
  letter-spacing:0.1em;
  color:var(--text-soft);
  margin-bottom:0.3rem;
}
.gi-card-value{
  font-family:var(--font-display);
  font-weight:600;
  font-size:1.85rem;
  line-height:1;
  color:var(--heading);
}
.gi-card-value .gi-unit{ font-size:0.9rem; margin-left:0.08em; }
.gi-card-value.is-empty{ color:var(--text-soft); font-size:1.1rem; }

/* ---------- 섹션 제목 ---------- */
.gi-h2{
  font-family:var(--font-body);
  font-size:0.72rem;
  font-weight:700;
  letter-spacing:0.16em;
  text-transform:uppercase;
  color:var(--garnet);
  padding-bottom:0.5rem;
  margin:2rem 0 0.9rem;
  border-bottom:1px solid var(--border);
}

/* ---------- 차트 ---------- */
.gi-chart{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:3px;
  padding:1rem 0.8rem 0.6rem;
}
.gi-chart svg{ display:block; width:100%; height:auto; }

/* ---------- 타임라인 ---------- */
.gi-rec{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:3px;
  margin-bottom:0.55rem;
  overflow:hidden;
}
.gi-rec-top{
  width:100%;
  background:none;
  border:0;
  text-align:left;
  padding:0.85rem 0.9rem;
  cursor:pointer;
  font:inherit;
  color:inherit;
  display:flex;
  align-items:baseline;
  gap:0.7rem;
}
.gi-rec-top:focus-visible{ outline:2px solid var(--gold); outline-offset:-2px; }
.gi-rec-date{
  font-family:var(--font-display);
  font-weight:600;
  font-size:0.95rem;
  color:var(--heading);
  flex:none;
}
.gi-rec-progress{
  font-size:0.88rem;
  color:var(--text-soft);
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.gi-rec-body{
  padding:0 0.9rem 0.95rem;
  border-top:1px solid var(--border);
  padding-top:0.8rem;
}
.gi-rec[hidden-body] .gi-rec-body{ display:none; }
.gi-rec-row{ display:flex; gap:0.5rem; margin-bottom:0.5rem; font-size:0.88rem; }
.gi-rec-row dt{ flex:none; width:4.5rem; color:var(--text-soft); margin:0; }
.gi-rec-row dd{ margin:0; }
.gi-rec-comment{
  margin-top:0.7rem;
  padding-inline-start:0.8rem;
  border-inline-start:3px solid var(--garnet);
  font-size:0.9rem;
  white-space:pre-wrap;
}

/* ---------- 뱃지 ---------- */
.gi-badge{
  display:inline-block;
  font-size:0.72rem;
  font-weight:700;
  padding:0.15rem 0.5rem;
  border-radius:2px;
  border:1px solid currentColor;
  margin-right:0.3rem;
}
.gi-badge.is-good{ color:var(--state-good); }
.gi-badge.is-warn{ color:var(--state-warn); }
.gi-badge.is-bad{ color:var(--state-bad); }
.gi-badge.is-none{ color:var(--state-none); }

/* ---------- 폼 ---------- */
.gi-field{ margin-bottom:1rem; }
.gi-label{
  display:block;
  font-size:0.75rem;
  font-weight:700;
  letter-spacing:0.06em;
  color:var(--text-soft);
  margin-bottom:0.35rem;
}
.gi-input, .gi-select, .gi-textarea{
  width:100%;
  font:inherit;
  font-size:0.95rem;
  color:var(--text);
  background:var(--bg-elevated);
  border:1px solid var(--border);
  border-radius:2px;
  padding:0.6rem 0.7rem;
}
.gi-textarea{ min-height:3.6rem; resize:vertical; }
.gi-input:focus, .gi-select:focus, .gi-textarea:focus{
  outline:2px solid var(--gold);
  outline-offset:1px;
}

/* 선택형 버튼 그룹 */
.gi-choices{ display:flex; flex-wrap:wrap; gap:0.3rem; }
.gi-choice{
  font:inherit;
  font-size:0.82rem;
  padding:0.4rem 0.6rem;
  border:1px solid var(--border);
  border-radius:2px;
  background:var(--bg-elevated);
  color:var(--text-soft);
  cursor:pointer;
}
.gi-choice[aria-pressed="true"]{
  background:var(--forest);
  border-color:var(--forest);
  color:#f6f2e6;
}
.gi-choice:focus-visible{ outline:2px solid var(--gold); outline-offset:1px; }

/* ---------- 버튼 ---------- */
.gi-btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:0.4rem;
  font:inherit;
  font-weight:700;
  font-size:0.92rem;
  padding:0.75rem 1.4rem;
  border-radius:2px;
  border:1px solid transparent;
  cursor:pointer;
  text-decoration:none;
}
.gi-btn-primary{ background:var(--garnet); color:#f6f2e6; }
.gi-btn-primary:disabled{ opacity:0.5; cursor:not-allowed; }
.gi-btn-outline{ background:transparent; border-color:var(--border); color:var(--text); }
.gi-btn:focus-visible{ outline:2px solid var(--gold); outline-offset:2px; }

/* ---------- 상태 표시 ---------- */
.gi-state{
  text-align:center;
  padding:3rem 1rem;
  color:var(--text-soft);
}
.gi-error{
  background:var(--surface);
  border:1px solid var(--state-bad);
  border-inline-start-width:3px;
  border-radius:2px;
  padding:0.8rem 0.9rem;
  color:var(--text);
  font-size:0.9rem;
  margin-bottom:1rem;
}
.gi-note{ font-size:0.82rem; color:var(--text-soft); }

/* ---------- 저장 바 ---------- */
.gi-savebar{
  position:sticky;
  bottom:0;
  background:var(--bg);
  border-top:1px solid var(--border);
  padding:0.75rem 0;
  display:flex;
  align-items:center;
  gap:0.8rem;
}
.gi-savebar .gi-btn{ flex:1; }

@media (min-width: 600px){
  .gi-head h1{ font-size:2.1rem; }
}
```

- [ ] **Step 2: 커밋**

```bash
git add public/assets/css/app.css
git commit -m "feat: 학생관리 공용 스타일시트

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: 학부모 열람 화면

**Files:**
- Create: `public/parent/index.html`, `public/assets/js/parent.js`

**Interfaces:**
- Consumes: `createApi` (Task 11), `parent.load` 응답 `{student, summary, records}` (Task 10)

- [ ] **Step 1: `public/parent/index.html` 생성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>학습 리포트 · 지아나영어</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Song+Myung&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="gi">

<header class="gi-head">
  <div class="gi-wrap">
    <p class="gi-head-brand">Gianna English</p>
    <h1 id="studentName">학습 리포트</h1>
    <p class="gi-head-sub" id="studentMeta"></p>
  </div>
</header>

<main class="gi-wrap">
  <div id="state" class="gi-state">불러오는 중…</div>
  <div id="content" hidden>
    <section class="gi-cards" id="cards"></section>
    <h2 class="gi-h2">성적 추이</h2>
    <div class="gi-chart" id="chart"></div>
    <h2 class="gi-h2">수업 기록</h2>
    <div id="records"></div>
  </div>
</main>

<script src="/assets/js/config.js"></script>
<script src="/assets/js/api.js"></script>
<script src="/assets/js/parent.js"></script>
</body>
</html>
```

> `noindex, nofollow`와 `referrer: no-referrer`가 중요하다. 토큰이 URL에 있으므로 검색엔진 색인과 리퍼러 유출을 둘 다 막아야 한다.

- [ ] **Step 2: `public/assets/js/parent.js` 생성**

```js
/**
 * 학부모 열람 화면.
 * URL의 ?t=<토큰>으로 기록을 불러와 요약·추이·타임라인을 그린다.
 */
(function () {
  const api = createApi(window.GIANNA_CONFIG.GAS_URL);
  const $state = document.getElementById('state');
  const $content = document.getElementById('content');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showError(msg) {
    $state.hidden = false;
    $state.textContent = msg;
    $content.hidden = true;
  }

  /* ---------- 요약 카드 ---------- */

  function cardHtml(label, value, unit) {
    const inner = value === null
      ? '<span class="gi-card-value is-empty">기록 없음</span>'
      : '<span class="gi-card-value">' + value + '<span class="gi-unit">' + unit + '</span></span>';
    return '<div class="gi-card"><div class="gi-card-label">' + label + '</div>' + inner + '</div>';
  }

  function renderCards(summary) {
    document.getElementById('cards').innerHTML =
      cardHtml('출석률', summary.attendanceRate, '%') +
      cardHtml('과제 제출률', summary.homeworkRate, '%') +
      cardHtml('평균 점수', summary.avgScore, '점');
  }

  /* ---------- 성적 추이 ---------- */

  function scorePoints(records) {
    return records
      .filter(function (r) {
        return r.testScore !== '' && Number(r.testMax) > 0;
      })
      .map(function (r) {
        return { date: r.date, pct: (Number(r.testScore) / Number(r.testMax)) * 100 };
      })
      .sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  function renderChart(records) {
    const pts = scorePoints(records);
    const $chart = document.getElementById('chart');

    if (pts.length < 2) {
      $chart.innerHTML = '<p class="gi-note">점수 기록이 2회 이상 쌓이면 추이가 표시됩니다.</p>';
      return;
    }

    const W = 320, H = 110, PAD = 10;
    const stepX = (W - PAD * 2) / (pts.length - 1);
    const coords = pts.map(function (p, i) {
      return {
        x: PAD + stepX * i,
        y: PAD + (1 - p.pct / 100) * (H - PAD * 2),
        pct: Math.round(p.pct),
        date: p.date,
      };
    });

    const line = coords.map(function (c, i) {
      return (i ? 'L' : 'M') + c.x.toFixed(1) + ' ' + c.y.toFixed(1);
    }).join(' ');

    const dots = coords.map(function (c) {
      return '<circle cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) +
        '" r="3" fill="var(--garnet)"><title>' + esc(c.date) + ' · ' + c.pct + '점</title></circle>';
    }).join('');

    $chart.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="시험 점수 추이, ' + pts.length + '회 기록">' +
      '<line x1="' + PAD + '" y1="' + (H - PAD) + '" x2="' + (W - PAD) + '" y2="' + (H - PAD) +
      '" stroke="var(--border)" stroke-width="1"/>' +
      '<path d="' + line + '" fill="none" stroke="var(--garnet)" stroke-width="2" ' +
      'stroke-linejoin="round" stroke-linecap="round"/>' + dots + '</svg>' +
      '<p class="gi-note" style="margin-top:.4rem">100점 환산 기준 · ' +
      esc(coords[0].date) + ' ~ ' + esc(coords[coords.length - 1].date) + '</p>';
  }

  /* ---------- 타임라인 ---------- */

  const ATTENDANCE_TONE = { '출석': 'is-good', '보강': 'is-good', '지각': 'is-warn', '결석': 'is-bad' };
  const HOMEWORK_TONE = { '제출': 'is-good', '부분제출': 'is-warn', '미제출': 'is-bad', '해당없음': 'is-none' };

  function badge(text, tone) {
    if (!text) return '';
    return '<span class="gi-badge ' + (tone || 'is-none') + '">' + esc(text) + '</span>';
  }

  function row(label, value) {
    if (!value) return '';
    return '<div class="gi-rec-row"><dt>' + label + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  function recordHtml(r, index) {
    const scoreText = (r.testScore !== '' && r.testMax !== '')
      ? (r.testName ? r.testName + ' ' : '') + r.testScore + '/' + r.testMax
      : '';

    const badges =
      badge(r.attendance, ATTENDANCE_TONE[r.attendance]) +
      badge(r.homeworkStatus, HOMEWORK_TONE[r.homeworkStatus]) +
      (r.homeworkLevel ? badge('완성도 ' + r.homeworkLevel, 'is-none') : '');

    const comment = r.comment
      ? '<div class="gi-rec-comment">' + esc(r.comment) + '</div>' : '';

    return '' +
      '<article class="gi-rec">' +
        '<button class="gi-rec-top" type="button" aria-expanded="false" aria-controls="rb' + index + '">' +
          '<span class="gi-rec-date">' + esc(r.date.slice(5).replace('-', '/')) + '</span>' +
          '<span class="gi-rec-progress">' + esc(r.progress || '진도 미기록') + '</span>' +
        '</button>' +
        '<div class="gi-rec-body" id="rb' + index + '" hidden>' +
          '<dl style="margin:0">' +
            '<div class="gi-rec-row"><dt>상태</dt><dd>' + (badges || '—') + '</dd></div>' +
            row('진도', r.progress) +
            row('시험', scoreText) +
            row('다음 과제', r.nextHomework) +
          '</dl>' + comment +
        '</div>' +
      '</article>';
  }

  function renderRecords(records) {
    const $records = document.getElementById('records');

    if (!records.length) {
      $records.innerHTML = '<p class="gi-note">아직 등록된 수업 기록이 없습니다.</p>';
      return;
    }

    $records.innerHTML = records.map(recordHtml).join('');

    $records.querySelectorAll('.gi-rec-top').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const body = document.getElementById(btn.getAttribute('aria-controls'));
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        body.hidden = open;
      });
    });
  }

  /* ---------- 진입 ---------- */

  function tokenFromUrl() {
    return new URLSearchParams(window.location.search).get('t') || '';
  }

  function start() {
    const token = tokenFromUrl();
    if (!token) {
      showError('링크가 올바르지 않습니다. 선생님께 받으신 주소로 다시 접속해 주세요.');
      return;
    }

    api.call('parent.load', { token: token }).then(function (data) {
      document.getElementById('studentName').textContent = data.student.name + ' 학습 리포트';
      document.getElementById('studentMeta').textContent =
        [data.student.grade, data.student.className].filter(Boolean).join(' · ');
      document.title = data.student.name + ' 학습 리포트 · 지아나영어';

      renderCards(data.summary);
      renderChart(data.records);
      renderRecords(data.records);

      $state.hidden = true;
      $content.hidden = false;
    }).catch(function (err) {
      showError(err.message || '불러오지 못했습니다.');
    });
  }

  start();
})();
```

- [ ] **Step 3: GAS URL 설정**

`public/assets/js/config.js`의 `GAS_URL`을 Task 8에서 받은 실제 웹앱 URL로 채운다.

- [ ] **Step 4: 브라우저 수동 검증**

Run: `npx serve public -l 5000`

시트 `Students`에서 `parentToken`을 복사해 `http://localhost:5000/parent/?t=<토큰>` 접속:

- [ ] 학생 이름과 학년·반이 헤더에 보인다
- [ ] 요약 카드 3개가 보이고, 데이터 없는 항목은 "기록 없음"으로 나온다
- [ ] 점수 기록이 1개면 차트 자리에 안내 문구가 나온다
- [ ] 수업 기록 카드를 누르면 상세가 펼쳐지고 다시 누르면 접힌다
- [ ] `?t=bogus`로 접속하면 "링크가 올바르지 않거나…" 문구가 나온다
- [ ] `?t=` 없이 접속하면 안내 문구가 나온다
- [ ] 375px 폭에서 가로 스크롤이 없다
- [ ] OS 다크모드에서 뱃지 색이 판별된다

- [ ] **Step 5: 커밋**

```bash
git add public/parent/ public/assets/js/parent.js public/assets/js/config.js
git commit -m "feat: 학부모 열람 화면

요약 카드 → 성적 추이 → 수업 기록 타임라인 3단 구성.
차트는 외부 라이브러리 없이 인라인 SVG로 그린다.
noindex + no-referrer로 토큰이 색인·리퍼러로 새지 않게 한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: 선생님 입력 화면

**Files:**
- Create: `public/admin/index.html`, `public/assets/js/admin.js`

**Interfaces:**
- Consumes: `createApi` (Task 11) · `admin.login`, `admin.classes`, `admin.roster`, `admin.saveBatch` (Task 9·10)

- [ ] **Step 1: `public/admin/index.html` 생성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>수업 기록 입력 · 지아나영어</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Song+Myung&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="gi">

<header class="gi-head">
  <div class="gi-wrap">
    <p class="gi-head-brand">Gianna English</p>
    <h1>수업 기록 입력</h1>
    <p class="gi-head-sub" id="headSub">선생님 전용</p>
  </div>
</header>

<main class="gi-wrap">

  <section id="loginView">
    <div id="loginError" class="gi-error" hidden></div>
    <div class="gi-field">
      <label class="gi-label" for="password">비밀번호</label>
      <input class="gi-input" type="password" id="password" autocomplete="current-password">
    </div>
    <button class="gi-btn gi-btn-primary" id="loginBtn" type="button">로그인</button>
  </section>

  <section id="appView" hidden>
    <nav style="display:flex;gap:.5rem;margin-bottom:1.2rem">
      <button class="gi-choice" id="tabEntry" type="button" aria-pressed="true">수업 입력</button>
      <button class="gi-choice" id="tabStudents" type="button" aria-pressed="false">학생 관리</button>
    </nav>

    <div id="entryView">
      <div class="gi-field">
        <label class="gi-label" for="classSelect">반</label>
        <select class="gi-select" id="classSelect"></select>
      </div>
      <div class="gi-field">
        <label class="gi-label" for="dateInput">날짜</label>
        <input class="gi-input" type="date" id="dateInput">
      </div>
      <div class="gi-field">
        <label class="gi-label" for="progressAll">진도 (반 전체 일괄 적용)</label>
        <input class="gi-input" type="text" id="progressAll" placeholder="예: Unit 7 관계대명사">
      </div>
      <div class="gi-field">
        <label class="gi-label" for="nextAll">다음 과제 (반 전체 일괄 적용)</label>
        <input class="gi-input" type="text" id="nextAll" placeholder="예: Unit 8 단어 1~40">
      </div>

      <div id="entryError" class="gi-error" hidden></div>
      <div id="roster"></div>

      <div class="gi-savebar" id="saveBar" hidden>
        <span class="gi-note" id="saveStatus"></span>
        <button class="gi-btn gi-btn-primary" id="saveBtn" type="button">전체 저장</button>
      </div>
    </div>

    <div id="studentsView" hidden></div>
  </section>

</main>

<script src="/assets/js/config.js"></script>
<script src="/assets/js/api.js"></script>
<script src="/assets/js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 2: `public/assets/js/admin.js` 생성 — 로그인과 입력 부분**

```js
/**
 * 선생님 입력 화면.
 *
 * 입력 중인 내용은 localStorage에 계속 저장한다. 수업 직후 20명분을
 * 입력하다 네트워크 오류로 날리는 것이 이 앱에서 가장 나쁜 시나리오다.
 */
(function () {
  const api = createApi(window.GIANNA_CONFIG.GAS_URL);
  const SESSION_STORE = 'gi.session';
  const DRAFT_PREFIX = 'gi.draft.';

  const ATTENDANCE = ['출석', '지각', '결석', '보강'];
  const HOMEWORK = ['제출', '부분제출', '미제출', '해당없음'];
  const LEVELS = ['상', '중', '하'];

  let sessionKey = sessionStorage.getItem(SESSION_STORE) || '';
  let roster = [];
  let draft = {};

  const $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showError(el, msg) {
    if (!msg) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = msg;
  }

  function todayIso() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  /* ---------- 로그인 ---------- */

  function showApp() {
    $('loginView').hidden = true;
    $('appView').hidden = false;
    $('headSub').textContent = '선생님 전용 · 로그인됨';
    loadClasses();
  }

  function login() {
    const pw = $('password').value;
    if (!pw) return showError($('loginError'), '비밀번호를 입력해 주세요.');

    $('loginBtn').disabled = true;
    showError($('loginError'), '');

    api.call('admin.login', { password: pw }).then(function (data) {
      sessionKey = data.sessionKey;
      sessionStorage.setItem(SESSION_STORE, sessionKey);
      $('password').value = '';
      showApp();
    }).catch(function (err) {
      showError($('loginError'), err.message);
    }).finally(function () {
      $('loginBtn').disabled = false;
    });
  }

  function handleAuthLoss(err) {
    if (err.code === 'UNAUTHORIZED') {
      sessionKey = '';
      sessionStorage.removeItem(SESSION_STORE);
      $('appView').hidden = true;
      $('loginView').hidden = false;
      showError($('loginError'), err.message);
      return true;
    }
    return false;
  }

  /* ---------- 반 목록 ---------- */

  function loadClasses() {
    api.call('admin.classes', { sessionKey: sessionKey }).then(function (data) {
      $('classSelect').innerHTML = data.classes.map(function (c) {
        return '<option value="' + esc(c.classId) + '">' + esc(c.className) + '</option>';
      }).join('');
      if (!$('dateInput').value) $('dateInput').value = todayIso();
      loadRoster();
    }).catch(function (err) {
      if (!handleAuthLoss(err)) showError($('entryError'), err.message);
    });
  }

  /* ---------- 초안 저장 ---------- */

  function draftKey() {
    return DRAFT_PREFIX + $('classSelect').value + '.' + $('dateInput').value;
  }

  function saveDraft() {
    try {
      localStorage.setItem(draftKey(), JSON.stringify({
        progressAll: $('progressAll').value,
        nextAll: $('nextAll').value,
        rows: draft,
      }));
    } catch (e) { /* 저장 공간이 없으면 조용히 넘어간다 */ }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(draftKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearDraft() {
    try { localStorage.removeItem(draftKey()); } catch (e) { /* noop */ }
  }

  /* ---------- 명단 ---------- */

  function choiceGroup(studentId, field, values) {
    return '<div class="gi-choices" data-student="' + esc(studentId) + '" data-field="' + field + '">' +
      values.map(function (v) {
        const on = draft[studentId] && draft[studentId][field] === v;
        return '<button type="button" class="gi-choice" data-value="' + esc(v) + '" aria-pressed="' +
          (on ? 'true' : 'false') + '">' + esc(v) + '</button>';
      }).join('') + '</div>';
  }

  function studentHtml(s) {
    const d = draft[s.studentId] || {};
    return '' +
      '<article class="gi-rec" style="padding:.9rem">' +
        '<div class="gi-rec-date" style="margin-bottom:.6rem">' +
          esc(s.name) + ' <span class="gi-note">' + esc(s.grade || '') + '</span></div>' +

        '<div class="gi-field"><span class="gi-label">출결</span>' +
          choiceGroup(s.studentId, 'attendance', ATTENDANCE) + '</div>' +

        '<div class="gi-field"><span class="gi-label">과제</span>' +
          choiceGroup(s.studentId, 'homeworkStatus', HOMEWORK) + '</div>' +

        '<div class="gi-field"><span class="gi-label">완성도</span>' +
          choiceGroup(s.studentId, 'homeworkLevel', LEVELS) + '</div>' +

        '<div class="gi-field" style="display:flex;gap:.4rem">' +
          '<input class="gi-input" style="flex:2" type="text" placeholder="시험명" ' +
            'data-student="' + esc(s.studentId) + '" data-field="testName" value="' + esc(d.testName || '') + '">' +
          '<input class="gi-input" style="flex:1" type="number" inputmode="numeric" placeholder="점수" ' +
            'data-student="' + esc(s.studentId) + '" data-field="testScore" value="' + esc(d.testScore || '') + '">' +
          '<input class="gi-input" style="flex:1" type="number" inputmode="numeric" placeholder="만점" ' +
            'data-student="' + esc(s.studentId) + '" data-field="testMax" value="' + esc(d.testMax || '') + '">' +
        '</div>' +

        '<div class="gi-field" style="margin-bottom:0">' +
          '<textarea class="gi-textarea" placeholder="코멘트" ' +
            'data-student="' + esc(s.studentId) + '" data-field="comment">' + esc(d.comment || '') + '</textarea>' +
        '</div>' +
      '</article>';
  }

  function renderRoster() {
    $('roster').innerHTML = roster.length
      ? roster.map(studentHtml).join('')
      : '<p class="gi-note">이 반에 등록된 학생이 없습니다. 학생 관리 탭에서 등록해 주세요.</p>';
    $('saveBar').hidden = !roster.length;
  }

  function loadRoster() {
    const classId = $('classSelect').value;
    const date = $('dateInput').value;
    if (!classId || !date) return;

    showError($('entryError'), '');
    $('roster').innerHTML = '<p class="gi-state">불러오는 중…</p>';

    api.call('admin.roster', { sessionKey: sessionKey, classId: classId, date: date })
      .then(function (data) {
        roster = data.students;
        draft = {};

        // 서버에 이미 저장된 값을 먼저 채운다
        data.existingRecords.forEach(function (r) {
          draft[r.studentId] = {
            attendance: r.attendance, homeworkStatus: r.homeworkStatus,
            homeworkLevel: r.homeworkLevel, testName: r.testName,
            testScore: r.testScore === '' ? '' : String(r.testScore),
            testMax: r.testMax === '' ? '' : String(r.testMax),
            comment: r.comment,
          };
          if (r.progress) $('progressAll').value = r.progress;
          if (r.nextHomework) $('nextAll').value = r.nextHomework;
        });

        // 저장 못 하고 남은 초안이 있으면 그것으로 덮는다
        const saved = loadDraft();
        if (saved) {
          if (saved.progressAll) $('progressAll').value = saved.progressAll;
          if (saved.nextAll) $('nextAll').value = saved.nextAll;
          Object.keys(saved.rows || {}).forEach(function (id) {
            draft[id] = Object.assign({}, draft[id], saved.rows[id]);
          });
        }

        renderRoster();
      })
      .catch(function (err) {
        if (!handleAuthLoss(err)) showError($('entryError'), err.message);
        $('roster').innerHTML = '';
      });
  }

  /* ---------- 입력 이벤트 (위임) ---------- */

  $('roster').addEventListener('click', function (e) {
    const btn = e.target.closest('.gi-choice');
    if (!btn) return;

    const group = btn.parentElement;
    const id = group.dataset.student;
    const field = group.dataset.field;
    const value = btn.dataset.value;
    const wasOn = btn.getAttribute('aria-pressed') === 'true';

    group.querySelectorAll('.gi-choice').forEach(function (b) {
      b.setAttribute('aria-pressed', 'false');
    });
    if (!wasOn) btn.setAttribute('aria-pressed', 'true');

    draft[id] = draft[id] || {};
    draft[id][field] = wasOn ? '' : value;
    saveDraft();
  });

  $('roster').addEventListener('input', function (e) {
    const el = e.target;
    if (!el.dataset || !el.dataset.student) return;
    draft[el.dataset.student] = draft[el.dataset.student] || {};
    draft[el.dataset.student][el.dataset.field] = el.value;
    saveDraft();
  });

  $('progressAll').addEventListener('input', saveDraft);
  $('nextAll').addEventListener('input', saveDraft);
  $('classSelect').addEventListener('change', loadRoster);
  $('dateInput').addEventListener('change', loadRoster);

  /* ---------- 저장 ---------- */

  function buildRecords() {
    const date = $('dateInput').value;
    const progress = $('progressAll').value;
    const next = $('nextAll').value;

    return roster.map(function (s) {
      const d = draft[s.studentId] || {};
      return {
        studentId: s.studentId,
        date: date,
        progress: progress,
        nextHomework: next,
        attendance: d.attendance || '',
        homeworkStatus: d.homeworkStatus || '',
        homeworkLevel: d.homeworkLevel || '',
        testName: d.testName || '',
        testScore: d.testScore || '',
        testMax: d.testMax || '',
        comment: d.comment || '',
      };
    });
  }

  function save() {
    const records = buildRecords();
    if (!records.length) return;

    $('saveBtn').disabled = true;
    $('saveStatus').textContent = '저장 중…';
    showError($('entryError'), '');

    api.call('admin.saveBatch', {
      sessionKey: sessionKey,
      classId: $('classSelect').value,
      date: $('dateInput').value,
      clientRequestId: 'b' + Date.now() + Math.random().toString(36).slice(2, 8),
      records: records,
    }).then(function (data) {
      clearDraft();
      $('saveStatus').textContent = data.saved + '명 저장했습니다.';
    }).catch(function (err) {
      $('saveStatus').textContent = '';
      if (!handleAuthLoss(err)) {
        showError($('entryError'), err.message + ' 입력하신 내용은 이 기기에 보관되어 있습니다.');
      }
    }).finally(function () {
      $('saveBtn').disabled = false;
    });
  }

  $('saveBtn').addEventListener('click', save);
  $('loginBtn').addEventListener('click', login);
  $('password').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') login();
  });

  /* ---------- 탭 ---------- */

  $('tabEntry').addEventListener('click', function () {
    $('tabEntry').setAttribute('aria-pressed', 'true');
    $('tabStudents').setAttribute('aria-pressed', 'false');
    $('entryView').hidden = false;
    $('studentsView').hidden = true;
  });

  $('tabStudents').addEventListener('click', function () {
    $('tabStudents').setAttribute('aria-pressed', 'true');
    $('tabEntry').setAttribute('aria-pressed', 'false');
    $('studentsView').hidden = false;
    $('entryView').hidden = true;
    if (window.renderStudentsView) window.renderStudentsView();
  });

  // 다른 모듈이 쓸 수 있게 최소한만 노출한다
  window.GI_ADMIN = {
    api: api,
    esc: esc,
    getSessionKey: function () { return sessionKey; },
    handleAuthLoss: handleAuthLoss,
  };

  if (sessionKey) showApp();
})();
```

- [ ] **Step 3: 브라우저 수동 검증**

Run: `npx serve public -l 5000` → `http://localhost:5000/admin/`

- [ ] 틀린 비밀번호를 넣으면 오류 문구가 나온다
- [ ] 맞는 비밀번호로 로그인하면 반 선택과 명단이 나온다
- [ ] 출결·과제 버튼을 누르면 선택되고, 같은 버튼을 다시 누르면 해제된다
- [ ] 진도를 상단에 한 번 입력하고 저장하면 반 전원의 기록에 들어간다 (시트에서 확인)
- [ ] 저장 후 새로고침하면 입력한 값이 그대로 다시 나온다
- [ ] 저장 후 시트 `Records`에 학생 수만큼만 행이 생긴다 (중복 없음)
- [ ] 같은 날짜로 다시 저장해도 행이 늘지 않는다
- [ ] 개발자도구에서 네트워크를 오프라인으로 두고 저장 → 오류 문구가 나오고, 새로고침해도 입력값이 남아 있다
- [ ] 375px 폭에서 가로 스크롤이 없다

- [ ] **Step 4: 커밋**

```bash
git add public/admin/ public/assets/js/admin.js
git commit -m "feat: 선생님 수업 기록 입력 화면

- 반 선택 → 날짜 → 명단 일괄 입력 → 전체 저장 1회 호출
- 진도·다음과제는 반 전체 일괄 적용 (입력 시간 절반 이하)
- 입력 중 localStorage 초안 저장, 저장 성공 시에만 삭제
- 세션 만료 시 로그인 화면으로 되돌림

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 15: 학생 관리 탭

**Files:**
- Create: `public/assets/js/admin-students.js`
- Modify: `public/admin/index.html` (스크립트 추가)

**Interfaces:**
- Consumes: `window.GI_ADMIN` (Task 14) · `admin.students`, `admin.upsertStudent`, `admin.reissueToken` (Task 9)
- Produces: `window.renderStudentsView()`

- [ ] **Step 1: `public/assets/js/admin-students.js` 생성**

```js
/**
 * 학생 관리 탭 — 등록 / 수정 / 링크 복사 / 링크 재발급 / 비활성화.
 *
 * 링크 재발급은 PIN을 두지 않기로 한 결정의 상쇄 장치다 (설계 문서 §8).
 * 링크가 샜다고 판단되면 즉시 이전 링크를 무효화할 수 있어야 한다.
 */
(function () {
  const A = window.GI_ADMIN;
  const $view = document.getElementById('studentsView');

  let students = [];
  let classes = [];

  function parentUrl(token) {
    return window.location.origin + '/p/' + token;
  }

  function optionsHtml(selectedId) {
    return classes.map(function (c) {
      return '<option value="' + A.esc(c.classId) + '"' +
        (c.classId === selectedId ? ' selected' : '') + '>' + A.esc(c.className) + '</option>';
    }).join('');
  }

  function studentHtml(s) {
    return '' +
      '<article class="gi-rec" style="padding:.9rem" data-id="' + A.esc(s.studentId) + '">' +
        '<div style="display:flex;justify-content:space-between;gap:.6rem;align-items:baseline">' +
          '<span class="gi-rec-date">' + A.esc(s.name) + '</span>' +
          '<span class="gi-note">' + A.esc(s.studentId) + ' · ' +
            (s.active ? A.esc(s.className || '반 없음') : '비활성') + '</span>' +
        '</div>' +
        '<div class="gi-field" style="display:flex;gap:.4rem;margin-top:.7rem;margin-bottom:.6rem">' +
          '<input class="gi-input" style="flex:2" type="text" data-field="name" value="' + A.esc(s.name) + '">' +
          '<input class="gi-input" style="flex:1" type="text" data-field="grade" placeholder="학년" value="' + A.esc(s.grade || '') + '">' +
          '<select class="gi-select" style="flex:2" data-field="classId">' + optionsHtml(s.classId) + '</select>' +
        '</div>' +
        '<div class="gi-choices">' +
          '<button class="gi-choice" type="button" data-act="save">저장</button>' +
          '<button class="gi-choice" type="button" data-act="copy">링크 복사</button>' +
          '<button class="gi-choice" type="button" data-act="reissue">링크 재발급</button>' +
          '<button class="gi-choice" type="button" data-act="toggle">' +
            (s.active ? '비활성화' : '다시 활성화') + '</button>' +
        '</div>' +
        '<p class="gi-note" data-role="msg" style="margin-top:.5rem"></p>' +
      '</article>';
  }

  function render() {
    $view.innerHTML = '' +
      '<div id="studentsError" class="gi-error" hidden></div>' +
      '<h2 class="gi-h2">학생 등록</h2>' +
      '<div class="gi-field" style="display:flex;gap:.4rem">' +
        '<input class="gi-input" style="flex:2" type="text" id="newName" placeholder="이름">' +
        '<input class="gi-input" style="flex:1" type="text" id="newGrade" placeholder="학년">' +
        '<select class="gi-select" style="flex:2" id="newClass">' + optionsHtml('') + '</select>' +
      '</div>' +
      '<button class="gi-btn gi-btn-primary" id="addBtn" type="button">등록</button>' +
      '<h2 class="gi-h2">학생 목록 (' + students.length + '명)</h2>' +
      (students.length ? students.map(studentHtml).join('') : '<p class="gi-note">등록된 학생이 없습니다.</p>');

    document.getElementById('addBtn').addEventListener('click', addStudent);
  }

  function load() {
    $view.innerHTML = '<p class="gi-state">불러오는 중…</p>';
    A.api.call('admin.students', { sessionKey: A.getSessionKey() }).then(function (data) {
      students = data.students;
      classes = data.classes;
      render();
    }).catch(function (err) {
      if (!A.handleAuthLoss(err)) {
        $view.innerHTML = '<div class="gi-error">' + A.esc(err.message) + '</div>';
      }
    });
  }

  function addStudent() {
    const name = document.getElementById('newName').value.trim();
    if (!name) return;

    document.getElementById('addBtn').disabled = true;
    A.api.call('admin.upsertStudent', {
      sessionKey: A.getSessionKey(),
      student: {
        name: name,
        grade: document.getElementById('newGrade').value.trim(),
        classId: document.getElementById('newClass').value,
      },
    }).then(load).catch(function (err) {
      if (!A.handleAuthLoss(err)) {
        const box = document.getElementById('studentsError');
        box.hidden = false;
        box.textContent = err.message;
      }
      document.getElementById('addBtn').disabled = false;
    });
  }

  function findStudent(id) {
    return students.filter(function (s) { return s.studentId === id; })[0];
  }

  function copyLink(token, $msg) {
    const url = parentUrl(token);
    const done = function () { $msg.textContent = '복사됨: ' + url; };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function () {
        $msg.textContent = url;
      });
    } else {
      $msg.textContent = url;
    }
  }

  $view.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;

    const card = btn.closest('[data-id]');
    const id = card.dataset.id;
    const student = findStudent(id);
    const $msg = card.querySelector('[data-role="msg"]');
    const act = btn.dataset.act;

    if (act === 'copy') {
      copyLink(student.parentToken, $msg);
      return;
    }

    if (act === 'reissue') {
      if (!window.confirm(student.name + ' 학생의 링크를 새로 발급합니다.\n기존 링크는 즉시 사용할 수 없게 됩니다. 계속할까요?')) return;
      $msg.textContent = '발급 중…';
      A.api.call('admin.reissueToken', { sessionKey: A.getSessionKey(), studentId: id })
        .then(function (data) {
          student.parentToken = data.parentToken;
          $msg.textContent = '새 링크 발급됨 — 학부모님께 다시 보내주세요.';
        })
        .catch(function (err) {
          if (!A.handleAuthLoss(err)) $msg.textContent = err.message;
        });
      return;
    }

    const patch = { studentId: id, name: student.name, grade: student.grade, classId: student.classId, active: student.active };

    if (act === 'save') {
      patch.name = card.querySelector('[data-field="name"]').value.trim();
      patch.grade = card.querySelector('[data-field="grade"]').value.trim();
      patch.classId = card.querySelector('[data-field="classId"]').value;
      if (!patch.name) { $msg.textContent = '이름은 비울 수 없습니다.'; return; }
    } else if (act === 'toggle') {
      patch.active = !student.active;
    } else {
      return;
    }

    $msg.textContent = '저장 중…';
    A.api.call('admin.upsertStudent', { sessionKey: A.getSessionKey(), student: patch })
      .then(load)
      .catch(function (err) {
        if (!A.handleAuthLoss(err)) $msg.textContent = err.message;
      });
  });

  window.renderStudentsView = load;
})();
```

- [ ] **Step 2: `public/admin/index.html`에 스크립트 추가**

`admin.js` 다음 줄에 추가한다:

```html
<script src="/assets/js/admin-students.js"></script>
```

- [ ] **Step 3: 브라우저 수동 검증**

`http://localhost:5000/admin/` → 로그인 → `학생 관리` 탭:

- [ ] 학생을 등록하면 목록에 나타나고 시트에도 행이 생긴다
- [ ] 이름/학년/반을 고치고 저장하면 반영된다
- [ ] `링크 복사`를 누르면 `/p/<토큰>` 주소가 클립보드에 들어간다
- [ ] 복사한 링크를 새 탭에서 열면 그 학생의 리포트가 보인다
- [ ] `링크 재발급` → 확인 → **이전 링크로 접속하면 오류**, 새 링크로는 정상
- [ ] `비활성화` 후 그 학생의 링크로 접속하면 오류가 난다
- [ ] `다시 활성화`하면 링크가 되살아난다
- [ ] 비활성 학생은 수업 입력 탭의 명단에서 빠진다

- [ ] **Step 4: 커밋**

```bash
git add public/assets/js/admin-students.js public/admin/index.html
git commit -m "feat: 학생 관리 탭

등록 / 수정 / 링크 복사 / 링크 재발급 / 비활성화.
링크 재발급은 PIN을 두지 않기로 한 결정의 상쇄 장치다 —
링크가 샜다고 판단되면 즉시 이전 링크를 무효화할 수 있다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 16: 학생관리 랜딩과 배포

**Files:**
- Create: `public/students/index.html`, `README.md`

**Interfaces:**
- Consumes: 없음 (정적 안내 페이지)

- [ ] **Step 1: `public/students/index.html` 생성**

기존 홈페이지의 톤을 그대로 쓰되, 인라인 스타일 없이 공용 CSS만 사용한다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>학생관리 · 지아나영어</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Song+Myung&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="gi">

<header class="gi-head">
  <div class="gi-wrap">
    <p class="gi-head-brand">Gianna English</p>
    <h1>학생관리</h1>
    <p class="gi-head-sub">수업 기록과 학습 리포트</p>
  </div>
</header>

<main class="gi-wrap">

  <h2 class="gi-h2">학부모님</h2>
  <article class="gi-rec" style="padding:1rem">
    <p style="margin:0 0 .6rem">
      자녀의 학습 리포트는 <strong>선생님께서 보내드린 링크</strong>로 바로 들어가실 수 있습니다.
      별도의 로그인이나 회원가입은 없습니다.
    </p>
    <p class="gi-note" style="margin:0">
      링크를 받지 못하셨거나 열리지 않으면 선생님께 문의해 주세요.
      링크는 언제든 새로 발급해 드릴 수 있습니다.
    </p>
  </article>

  <h2 class="gi-h2">선생님</h2>
  <article class="gi-rec" style="padding:1rem">
    <p style="margin:0 0 .9rem">수업 기록 입력과 학생 관리는 아래에서 진행합니다.</p>
    <a class="gi-btn gi-btn-primary" href="/admin/">수업 기록 입력하기</a>
  </article>

  <p class="gi-note" style="margin-top:2rem">
    <a href="/" style="color:inherit">← 지아나영어 홈으로</a>
  </p>

</main>

</body>
</html>
```

- [ ] **Step 2: `README.md` 생성**

```markdown
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

1. 구글시트 생성 — 시트 4장(`Students` `Classes` `Records` `Config`), 헤더는 설계 문서 §6 참조
2. 시트 공유를 선생님 계정 단독으로 제한
3. `npx clasp login` → `npx clasp create --type sheets --rootDir gas --parentId <시트ID>`
4. Apps Script 스크립트 속성에 `SHEET_ID`, `ADMIN_PASSWORD`(16자 이상) 등록
5. 웹 앱 배포: 실행 = 나 / 액세스 = 모든 사용자
6. 배포 URL을 `public/assets/js/config.js`의 `GAS_URL`에 기입
7. Netlify에 저장소 연결 (publish 디렉터리는 `netlify.toml`이 지정)

## 보안 메모

학부모 링크는 32자 토큰 단독으로 열린다. PIN과 시도 횟수 제한은 두지 않기로
했으므로 **링크 자체가 열쇠다**. 링크가 유출되었다고 판단되면 선생님 화면의
`링크 재발급`으로 즉시 이전 링크를 무효화한다. 근거와 트레이드오프는
`docs/superpowers/specs/2026-08-30-student-management-design.md` §8에 있다.
```

- [ ] **Step 3: 전체 테스트 실행**

Run: `npm test`
Expected: PASS — 72개 전부 통과

- [ ] **Step 4: Netlify 배포**

1. Netlify에서 GitHub 저장소를 연결한다 (`netlify.toml`이 publish 디렉터리를 지정하므로 별도 설정 불필요)
2. `feat/student-management` 브랜치로 배포하거나, master 병합 후 배포한다
3. 배포된 도메인을 확인한다

- [ ] **Step 5: 배포본 최종 검증**

배포 URL에서 확인한다:

- [ ] 홈페이지가 이전과 동일하게 보이고 nav에 `학생관리`가 있다
- [ ] `/students/`가 열리고 두 안내가 보인다
- [ ] `/admin/`에서 로그인 → 반/날짜 선택 → 입력 → 저장이 동작한다
- [ ] `/p/<토큰>` 짧은 주소가 학부모 화면으로 열린다 (netlify.toml 리다이렉트 확인)
- [ ] 잘못된 토큰은 정보를 노출하지 않는 문구를 보여준다
- [ ] 실제 휴대폰에서 두 화면 모두 가로 스크롤 없이 보인다
- [ ] 개발자도구 Network에서 `parent.load` 응답에 `parentToken`·`note`·`studentId`가 **없다**
- [ ] 다크모드에서 상태 뱃지가 판별된다

- [ ] **Step 6: 커밋**

```bash
git add public/students/ README.md
git commit -m "feat: 학생관리 랜딩과 프로젝트 문서

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## 자체 검토 결과

**1. 스펙 커버리지**

| 스펙 항목 | 담당 태스크 |
|---|---|
| §5 저장소 구조 | 7 |
| §6 시트 4장 스키마 | 8 (수동 생성) |
| §6 (studentId, date) upsert | 10 |
| §7 호출 규약 (POST/text-plain) | 11 |
| §7 엔드포인트 | 8·9·10 |
| §7 응답 위생 | 5 (allowlist) · 10 |
| §7 LockService | 9·10 |
| §7 clientRequestId 중복 방지 | 10 |
| §8 토큰 단독 인증 | 9 |
| §8 링크 재발급·비활성화 | 15 |
| §8 관리자 세션 | 9·14 |
| §9 디자인 토큰 상속 | 7·12 |
| §9 학부모 3단 화면 | 13 |
| §9 진도 일괄 적용 | 14 |
| §9 localStorage 초안 | 14 |
| §9 프론트 에러 처리 | 11 |
| §10 netlify.toml · clasp | 7·8·16 |
| §11 순수 로직 단위 테스트 | 2·3·4·5·6·11 |
| §11 수동 검증 체크리스트 | 13·14·15·16 |

**의도적 축소 1건** — 스펙 §7의 `parent.more`(페이징)를 Task 10에서 제거했다. 학생 1명의 기록은 연 100건 내외라 `parent.load`가 전체를 내려줘도 충분하고, 페이징은 MVP에 불필요한 복잡도다. 라우터에서 거부하도록 회귀 테스트도 넣었다.

**스펙 §9의 미정 사항 확정 2건** — 요약 카드의 집계 규칙(출석률에서 지각·보강을 출석으로 셈, 제출률에서 부분제출을 제출로 셈, 분모 0이면 `null`)을 Task 4에서 확정했다. 스펙에는 "출석률·제출률·평균"까지만 있었다.

**2. 플레이스홀더 스캔** — `<웹앱URL>`, `<시트ID>`, `<키>`, `<parentToken>`은 사용자 환경에서만 정해지는 값이고 얻는 방법이 각 스텝에 적혀 있으므로 플레이스홀더가 아니다. 그 외 TBD·"적절히 처리" 류는 없다.

**3. 타입 일관성 확인**

- `generateToken` / `nextStudentId` / `generateRecordId` — Task 2 정의, Task 9·10 사용, 이름 일치
- `validateBatch(records) -> [{index, errors}]` — Task 3 정의, Task 10에서 `problems[0].errors` 사용, 일치
- `computeSummary(records, monthKey)` — Task 4 정의, Task 5 `toParentPayload` 내부 호출, 인자 순서 일치
- `toParentPayload({student, className, records, monthKey})` — Task 5 정의, Task 10 호출, 키 이름 일치
- `parseRequest` / `ok` / `fail` — Task 6 정의, Task 8·9·10 사용, 일치
- `readTable` / `appendRow` / `updateRowById` / `findRow` / `SHEETS` — Task 8 정의, Task 9·10 사용, 일치
- `requireSession_` / `findStudentByToken` — Task 9 정의, Task 10 사용, 일치
- `classNameOf_` — Task 9 정의, Task 10 사용, 일치
- `createApi(url, fetchImpl, options).call(action, params)` — Task 11 정의, Task 13·14·15 사용, 일치
- `window.GI_ADMIN.{api, esc, getSessionKey, handleAuthLoss}` — Task 14 정의, Task 15 사용, 일치
- 응답 봉투 `{ok, data}` / `{ok, error, message}` — Task 6에서 정의, Task 11이 `{code, message}` Error로 정규화, 화면들은 `err.message`·`err.code`만 사용, 일치
