/**
 * 수업 기록 검증. 순수 함수.
 */

const HOMEWORK_STATUS = ['제출', '부분제출', '미제출', '해당없음'];
const HOMEWORK_LEVEL = ['상', '중', '하', ''];
// 휴강 — 그날 그 수업을 하지 않았다. 결석과 구별해야 한다: 결석은
// 학생이 오지 않은 날이고, 휴강은 수업 자체가 없던 날이다.
//
// '변경'은 휴강의 옛 이름이다. 그때 쌓인 행을 다시 저장할 수 있으므로
// 함께 받는다 — 받지 않으면 지난 기록을 열어 한 글자 고치는 순간
// 저장이 막힌다.
const ATTENDANCE = ['출석', '지각', '결석', '휴강', '보강', '변경'];
const RECORD_KINDS = ['regular', 'exam'];
const EXAM_ITEM_FIELDS = ['examTests', 'examItems', 'examNext'];

function isBlank(v) {
  return v === '' || v === null || v === undefined;
}

function validateRecord(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
    return ['record가 객체가 아닙니다'];
  }

  const errors = [];

  if (isBlank(rec.studentId)) errors.push('studentId 누락');

  // 갈래. 빈 값은 정규수업이다 (gas/lib/records.js의 recordKind_).
  if (!isBlank(rec.kind) && RECORD_KINDS.indexOf(String(rec.kind)) === -1) {
    errors.push('kind 값 오류');
  }

  // 시험대비 칸 목록은 JSON 한 줄이다. 길이만 막는다 — 한 셀에 50000자까지
  // 들어가므로 실수로 붙여 넣은 긴 글이 시트를 통째로 망가뜨릴 수 있다.
  EXAM_ITEM_FIELDS.forEach(function (f) {
    if (!isBlank(rec[f]) && String(rec[f]).length > 8000) errors.push(f + ' 너무 깁니다');
  });
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

  // 회차는 비워 둘 수 있다. 적었다면 1 이상의 수여야 한다.
  if (!isBlank(rec.sessionNo)) {
    const n = Number(rec.sessionNo);
    if (!isFinite(n) || n < 1) errors.push('sessionNo 오류');
  }

  // 점수 짝은 둘 다 비어 있거나, 둘 다 유효해야 한다.
  // testScore/testMax는 시험이 영역별로 나뉘기 전에 쓰던 칸이다.
  checkScorePair_(rec, 'testScore', 'testMax', errors);
  testAreaKeys_().forEach(function (k) {
    checkScorePair_(rec, k + 'TestScore', k + 'TestMax', errors);
  });

  return errors;
}

function checkScorePair_(rec, scoreField, maxField, errors) {
  if (isBlank(rec[scoreField]) && isBlank(rec[maxField])) return;

  const score = Number(rec[scoreField]);
  const max = Number(rec[maxField]);
  const scoreOk = !isBlank(rec[scoreField]) && isFinite(score) && score >= 0;
  const maxOk = !isBlank(rec[maxField]) && isFinite(max) && max > 0;

  if (!scoreOk) errors.push(scoreField + ' 오류');
  if (!maxOk) errors.push(maxField + ' 오류');
  if (scoreOk && maxOk && score > max) errors.push(scoreField + '가 ' + maxField + '보다 큽니다');
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
  /* eslint-disable no-var */
  // shape.js 아래쪽 주석과 같은 이유로 const/let이 아니라 var다.
  // GAS는 전역을 공유해 records.js의 testAreaKeys_를 그냥 쓰고,
  // Node에서는 이 가드 안의 require가 그 이름을 채운다.
  var testAreaKeys_ = require('./records.js').testAreaKeys_;
  module.exports = {
    HOMEWORK_STATUS,
    HOMEWORK_LEVEL,
    ATTENDANCE,
    validateRecord,
    validateBatch,
  };
}
