/**
 * 학생 단위 기록 입력 화면의 순수 함수 모음. DOM을 만지지 않는다.
 *
 * api.js와 같은 이중 로드 패턴(IIFE + module.exports)을 쓴다.
 */
(function (global) {
  // 브라우저에서는 progress-areas.js가 먼저 실행돼 전역에 올려 둔다.
  // Node(테스트)에서는 그 전역이 없으므로 직접 읽는다.
  const PA = typeof module !== 'undefined'
    ? require('./progress-areas.js')
    : global.GI_PROGRESS_AREAS;
  const AREAS = PA.PROGRESS_AREAS;
  const AREA_FIELDS = PA.RECORD_AREA_FIELDS;

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
    const out = {
      // 영역 구분이 생기기 전에 쌓인 진도. 화면에 입력칸은 없지만 그대로
      // 실어 보내야 저장할 때 서버가 빈 값으로 덮어쓰지 않는다.
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

    AREA_FIELDS.forEach(function (f) { out[f] = str(r[f]); });

    return out;
  }

  /**
   * 빈 교재 칸만 직전 수업 교재로 채운다. 이미 적힌 값은 건드리지 않는다.
   *
   * 이미 저장된 기록을 열 때는 부르지 않는다. 그날 안 한 영역에 교재만
   * 슬쩍 채워 넣으면 하지도 않은 수업이 기록에 남는다.
   */
  function withBookDefaults(values, lastBooks) {
    const out = Object.assign({}, values);
    const books = lastBooks || {};
    AREAS.forEach(function (a) {
      const field = a.key + 'Book';
      if (!out[field]) out[field] = str(books[a.key]);
    });
    return out;
  }

  function buildRecord(studentId, date, form) {
    const f = form || {};
    const out = {
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

    AREA_FIELDS.forEach(function (k) { out[k] = str(f[k]); });

    return out;
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

  const api = { findRecordFor, toFormValues, buildRecord, rosterStatus, withBookDefaults };

  global.GI_RECORD_FORM = api;

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
