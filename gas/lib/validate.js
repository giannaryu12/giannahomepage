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

  // 점수 짝은 둘 다 비어 있거나, 둘 다 유효해야 한다.
  // testScore/testMax는 시험이 단어·듣기로 나뉘기 전에 쓰던 칸이다.
  checkScorePair_(rec, 'testScore', 'testMax', errors);
  checkScorePair_(rec, 'vocabTestScore', 'vocabTestMax', errors);
  checkScorePair_(rec, 'listeningTestScore', 'listeningTestMax', errors);

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
  module.exports = {
    HOMEWORK_STATUS,
    HOMEWORK_LEVEL,
    ATTENDANCE,
    validateRecord,
    validateBatch,
  };
}
