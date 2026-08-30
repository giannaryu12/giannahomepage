/**
 * 수업 기록 저장의 순수 함수 부분. SpreadsheetApp을 쓰지 않는다.
 */

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
  return {
    studentId: rec.studentId,
    classId: classId,
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
    clientRequestId: clientRequestId,
    updatedAt: now,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { findRecordMatch, buildRecordPayload };
}
