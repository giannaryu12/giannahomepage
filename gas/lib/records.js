/**
 * 수업 기록 저장의 순수 함수 부분. SpreadsheetApp을 쓰지 않는다.
 */

/**
 * 진도 5개 영역의 교재·진도 컬럼.
 *
 * 화면에도 같은 정의가 public/assets/js/progress-areas.js에 있다. 둘이
 * 어긋나면 입력한 값이 저장되지 않거나 학부모에게 보이지 않으므로
 * test/field-parity.test.js가 두 목록이 같은지 지킨다.
 */
const PROGRESS_AREA_KEYS = ['vocab', 'reading', 'grammar', 'listening', 'etc'];

const PROGRESS_FIELDS = PROGRESS_AREA_KEYS.reduce(function (acc, k) {
  acc.push(k + 'Book', k + 'Progress');
  return acc;
}, []);

const NEXT_FIELDS = PROGRESS_AREA_KEYS.reduce(function (acc, k) {
  acc.push(k + 'NextBook', k + 'Next');
  return acc;
}, []);

/**
 * 시험 영역. 진도 영역의 부분집합이 아니다 — 단어는 두 번 보고(vocab·vocab2),
 * 독해·기타는 시험을 보지 않는다. 화면 쪽 정의는 progress-areas.js의 TEST_AREAS다.
 */
const TEST_AREA_KEYS = ['vocab', 'vocab2', 'grammar', 'listening'];

const TEST_FIELDS = TEST_AREA_KEYS.reduce(function (acc, k) {
  acc.push(k + 'TestBook', k + 'TestScore', k + 'TestMax');
  return acc;
}, []);

/** 시트 컬럼과 저장 페이로드가 챙겨야 할 영역 필드 전부. */
const RECORD_AREA_FIELDS = PROGRESS_FIELDS.concat(NEXT_FIELDS, TEST_FIELDS);

/** 영역 필드는 아니지만 시트에 없으면 만들어야 하는 칸. */
const RECORD_EXTRA_FIELDS = ['sessionNo'];

/** 직전 수업 값으로 미리 채우는 교재 칸들. */
const BOOK_FIELDS =
  PROGRESS_AREA_KEYS.map(function (k) { return k + 'Book'; })
    .concat(PROGRESS_AREA_KEYS.map(function (k) { return k + 'NextBook'; }))
    .concat(TEST_AREA_KEYS.map(function (k) { return k + 'TestBook'; }));

/**
 * 시험 영역 키. summary.js·validate.js가 이걸로 읽는다.
 *
 * 상수를 그대로 넘기지 않고 함수로 감싼 이유: 저쪽 파일들이 Node에서
 * `var`로 받으면, GAS에서는 그 var 선언이
 * 여기 최상위 `const TEST_AREA_KEYS`와 같은 전역 스코프에서 부딪쳐
 * 로드 시점 SyntaxError가 난다. 함수 선언은 var와 부딪치지 않는다.
 */
function testAreaKeys_() {
  return TEST_AREA_KEYS;
}

/** 진도 영역 키. 위와 같은 이유로 함수다. */
function progressAreaKeys_() {
  return PROGRESS_AREA_KEYS;
}

/** rows 중 studentId·date가 모두 일치하는 첫 행. 없으면 null. */
function findRecordMatch(rows, studentId, date) {
  const match = (rows || []).filter(function (r) {
    return String(r.studentId) === String(studentId)
      && String(r.date) === String(date);
  })[0];
  return match || null;
}

/** 저장할 레코드 한 건의 시트 페이로드를 만든다. recordId·createdAt은 호출자가 신규 행일 때만 붙인다. */
function buildRecordPayload(rec, classId, clientRequestId, now) {
  const payload = {
    studentId: rec.studentId,
    classId: classId,
    date: rec.date,
    // 영역 구분이 생기기 전에 쌓인 진도. 새 기록에는 쓰지 않지만, 화면이
    // 돌려준 값을 그대로 다시 적어 옛 기록이 지워지지 않게 한다.
    progress: rec.progress || '',
    homeworkStatus: rec.homeworkStatus || '',
    homeworkLevel: rec.homeworkLevel || '',
    // 회차. 0이나 빈 값을 `||`로 뭉개면 안 되므로 따로 본다.
    sessionNo: rec.sessionNo === '' || rec.sessionNo === null || rec.sessionNo === undefined
      ? '' : rec.sessionNo,
    testName: rec.testName || '',
    testScore: rec.testScore === '' || rec.testScore === null ? '' : rec.testScore,
    testMax: rec.testMax === '' || rec.testMax === null ? '' : rec.testMax,
    attendance: rec.attendance || '',
    nextHomework: rec.nextHomework || '',
    comment: rec.comment || '',
    clientRequestId: clientRequestId,
    updatedAt: now,
  };

  // `|| ''`를 쓰면 안 된다. 시험 점수 0점이 빈 칸이 되어 사라진다.
  RECORD_AREA_FIELDS.forEach(function (f) {
    const v = rec[f];
    payload[f] = v === '' || v === null || v === undefined ? '' : v;
  });

  return payload;
}

/**
 * 그 학생이 마지막으로 쓴 교재를 교재 칸마다 찾는다. 키는 필드 이름 그대로다.
 *
 * 최신 기록부터 훑으며 처음 만나는 비어 있지 않은 값을 쓴다. 그날 안 한
 * 영역은 교재가 비어 있을 뿐 교재가 바뀐 것이 아니므로, 최신 한 건만
 * 보면 멀쩡한 교재를 잃는다.
 */
function lastBooksOf(records) {
  const sorted = (records || []).slice().sort(function (a, b) {
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  const out = {};
  BOOK_FIELDS.forEach(function (field) {
    out[field] = '';
    for (let i = 0; i < sorted.length; i++) {
      const v = sorted[i][field];
      const book = v === null || v === undefined ? '' : String(v).trim();
      if (book) { out[field] = book; return; }
    }
  });
  return out;
}

/**
 * 그 학생이 마지막으로 적은 회차. 없으면 0.
 *
 * 최신 기록부터 훑어 처음 만나는 숫자를 쓴다. 회차를 빼먹은 날이 있어도
 * 그 앞의 값을 찾아 이어 간다.
 */
function lastSessionNoOf(records) {
  const sorted = (records || []).slice().sort(function (a, b) {
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  for (let i = 0; i < sorted.length; i++) {
    const n = Number(sorted[i].sessionNo);
    if (isFinite(n) && n > 0) return n;
  }
  return 0;
}

if (typeof module !== 'undefined') {
  module.exports = {
    PROGRESS_AREA_KEYS,
    RECORD_EXTRA_FIELDS,
    lastSessionNoOf,
    TEST_AREA_KEYS,
    PROGRESS_FIELDS,
    NEXT_FIELDS,
    TEST_FIELDS,
    BOOK_FIELDS,
    RECORD_AREA_FIELDS,
    testAreaKeys_,
    progressAreaKeys_,
    findRecordMatch,
    buildRecordPayload,
    lastBooksOf,
  };
}
