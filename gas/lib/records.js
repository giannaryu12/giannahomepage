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

  PROGRESS_FIELDS.forEach(function (f) {
    payload[f] = rec[f] || '';
  });

  return payload;
}

/**
 * 그 학생이 마지막으로 쓴 교재를 영역별로 찾는다.
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
  PROGRESS_AREA_KEYS.forEach(function (key) {
    out[key] = '';
    for (let i = 0; i < sorted.length; i++) {
      const v = sorted[i][key + 'Book'];
      const book = v === null || v === undefined ? '' : String(v).trim();
      if (book) { out[key] = book; return; }
    }
  });
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = {
    PROGRESS_AREA_KEYS,
    PROGRESS_FIELDS,
    findRecordMatch,
    buildRecordPayload,
    lastBooksOf,
  };
}
