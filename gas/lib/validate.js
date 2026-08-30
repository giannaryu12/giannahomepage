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
