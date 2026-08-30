/**
 * 학부모 응답 정형화.
 *
 * 반드시 allowlist로 고른다. 삭제(blacklist) 방식은 시트에 새 컬럼이
 * 늘어날 때 조용히 유출되므로 쓰지 않는다.
 */

// 진도 영역 필드는 일부러 하나씩 적는다. records.js의 PROGRESS_FIELDS를
// 이어 붙이면 그쪽에 필드가 늘 때 학부모에게 조용히 새어 나간다. 두 목록이
// 어긋나지 않는지는 test/field-parity.test.js가 확인한다.
const PARENT_RECORD_FIELDS = [
  'date',
  'progress',
  'vocabBook',
  'vocabProgress',
  'readingBook',
  'readingProgress',
  'grammarBook',
  'grammarProgress',
  'listeningBook',
  'listeningProgress',
  'etcBook',
  'etcProgress',
  'vocabNextBook',
  'vocabNext',
  'readingNextBook',
  'readingNext',
  'grammarNextBook',
  'grammarNext',
  'listeningNextBook',
  'listeningNext',
  'etcNextBook',
  'etcNext',
  'vocabTestBook',
  'vocabTestScore',
  'vocabTestMax',
  'listeningTestBook',
  'listeningTestScore',
  'listeningTestMax',
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

// 주의: 위 var를 const/let으로 바꾸지 말 것.
//
// GAS는 모든 파일이 하나의 전역 스코프를 공유하므로 summary.js의
// computeSummary를 그냥 호출하면 된다. Node에서는 가드 블록 안의
// require가 그 이름을 채워야 한다.
//
// var는 블록이 아니라 모듈 스코프로 호이스팅되므로 toParentPayload가
// 볼 수 있고, 할당은 파일 로드 시점에 끝난다. GAS에서는 블록이
// 실행되지 않지만 var computeSummary;(할당 없는 재선언)는 이미 존재하는
// 전역 함수를 덮어쓰지 않으므로 안전하다.
//
// const로 바꾸면 if 블록에 갇혀 Node에서 toParentPayload가 참조하지
// 못한다.
