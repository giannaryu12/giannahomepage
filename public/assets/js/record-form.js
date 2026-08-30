/**
 * 학생 단위 기록 입력 화면의 순수 함수 모음. DOM을 만지지 않는다.
 *
 * api.js와 같은 이중 로드 패턴(IIFE + module.exports)을 쓴다.
 */
(function (global) {
  function str(v) {
    return v === null || v === undefined ? '' : String(v);
  }

  function findRecordFor(existingRecords, studentId) {
    if (!studentId) return null;
    if (!existingRecords || !existingRecords.length) return null;
    for (let i = 0; i < existingRecords.length; i++) {
      if (existingRecords[i].studentId === studentId) return existingRecords[i];
    }
    return null;
  }

  function toFormValues(record) {
    const r = record || {};
    return {
      progress: str(r.progress),
      attendance: str(r.attendance),
      homeworkStatus: str(r.homeworkStatus),
      homeworkLevel: str(r.homeworkLevel),
      testName: str(r.testName),
      testScore: str(r.testScore),
      testMax: str(r.testMax),
      nextHomework: str(r.nextHomework),
      comment: str(r.comment),
    };
  }

  function buildRecord(studentId, date, form) {
    const f = form || {};
    return {
      studentId: str(studentId),
      date: str(date),
      progress: str(f.progress),
      nextHomework: str(f.nextHomework),
      attendance: str(f.attendance),
      homeworkStatus: str(f.homeworkStatus),
      homeworkLevel: str(f.homeworkLevel),
      testName: str(f.testName),
      testScore: str(f.testScore),
      testMax: str(f.testMax),
      comment: str(f.comment),
    };
  }

  function rosterStatus(students, existingRecords) {
    const list = students || [];
    return list.map(function (s) {
      return {
        studentId: s.studentId,
        name: s.name,
        grade: s.grade,
        hasRecord: !!findRecordFor(existingRecords, s.studentId),
      };
    });
  }

  const api = { findRecordFor, toFormValues, buildRecord, rosterStatus };

  global.GI_RECORD_FORM = api;

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
