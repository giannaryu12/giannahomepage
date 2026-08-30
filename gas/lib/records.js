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

/** 시험은 단어·듣기 둘만 본다. */
const TEST_AREA_KEYS = ['vocab', 'listening'];

const TEST_FIELDS = TEST_AREA_KEYS.reduce(function (acc, k) {
  acc.push(k + 'TestBook', k + 'TestScore', k + 'TestMax');
  return acc;
}, []);

/** 시트 컬럼과 저장 페이로드가 챙겨야 할 영역 필드 전부. */
const RECORD_AREA_FIELDS = PROGRESS_FIELDS.concat(NEXT_FIELDS, TEST_FIELDS);

/** 직전 수업 값으로 미리 채우는 교재 칸들. */
const BOOK_FIELDS =
  PROGRESS_AREA_KEYS.map(function (k) { return k + 'Book'; })
    .concat(PROGRESS_AREA_KEYS.map(function (k) { return k + 'NextBook'; }))
    .concat(TEST_AREA_KEYS.map(function (k) { return k + 'TestBook'; }));

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

if (typeof module !== 'undefined') {
  module.exports = {
    PROGRESS_AREA_KEYS,
    PROGRESS_FIELDS,
    NEXT_FIELDS,
    TEST_FIELDS,
    BOOK_FIELDS,
    RECORD_AREA_FIELDS,
    findRecordMatch,
    buildRecordPayload,
    lastBooksOf,
  };
}
