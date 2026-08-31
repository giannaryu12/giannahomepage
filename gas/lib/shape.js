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
  'vocab2TestBook',
  'vocab2TestScore',
  'vocab2TestMax',
  'grammarTestBook',
  'grammarTestScore',
  'grammarTestMax',
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

function filled_(v) {
  if (v === '' || v === null || v === undefined) return false;
  return String(v).trim() !== '';
}

/**
 * 학부모 화면에 낼 만한 기록인가 — 그날 수업이 있었다는 자취가 하나라도
 * 남은 날. 진도 · 시험 · 숙제 · 코멘트 중 하나라도 있으면 낸다.
 *
 * 넷 다 없는 날은 수업이 없던 날이다. 날짜만 열었다가 그대로 저장된 날이
 * 목록에 남으면 학부모가 열어 봐야 읽을 것이 없다.
 *
 * 결석은 그 자체가 그날의 기록이라 따로 통과시킨다. 화면에서도 진도 자리에
 * '결석'이라고 낸다.
 *
 * 교재는 근거가 아니다 — 직전 수업 값이 자동으로 채워지므로 그날 그 영역을
 * 했다는 뜻이 되지 못한다.
 *
 * 시험은 점수와 만점이 함께 있어야 기록으로 본다. 0점은 기록이다 —
 * "안 봤음"으로 뭉개면 그 줄이 통째로 사라진다.
 */
function hasParentContent_(record) {
  const rec = record || {};

  if (rec.attendance === '결석') return true;
  if (filled_(rec.comment)) return true;

  if (filled_(rec.progress)) return true;
  if (filled_(rec.nextHomework)) return true;

  const anyArea = progressAreaKeys_().some(function (k) {
    return filled_(rec[k + 'Progress']) || filled_(rec[k + 'Next']);
  });
  if (anyArea) return true;

  const scored = function (scoreField, maxField) {
    return filled_(rec[scoreField]) && Number(rec[maxField]) > 0;
  };
  if (scored('testScore', 'testMax')) return true;

  return testAreaKeys_().some(function (k) {
    return scored(k + 'TestScore', k + 'TestMax');
  });
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
    // 요약은 거르기 전 전체로 낸다. 결석한 날은 진도도 시험도 없어 목록에서
    // 빠지는데, 빠진 채로 출석률을 내면 결석이 지워져 100%가 되어 버린다.
    summary: computeSummary(records, opts.monthKey),
    records: records.filter(hasParentContent_),
  };
}

if (typeof module !== 'undefined') {
  /* eslint-disable no-var */
  var computeSummary = require('./summary.js').computeSummary;
  var testAreaKeys_ = require('./records.js').testAreaKeys_;
  var progressAreaKeys_ = require('./records.js').progressAreaKeys_;
  module.exports = {
    PARENT_RECORD_FIELDS,
    toParentRecord,
    toParentStudent,
    toParentPayload,
    hasParentContent_,
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
