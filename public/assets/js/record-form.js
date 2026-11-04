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
  // 시험대비 칸은 서버와 같은 규칙으로 읽고 쓴다 (gas/lib/exam-items.js).
  const EI = typeof module !== 'undefined'
    ? require('./exam-items.js')
    : global.GI_EXAM_ITEMS;
  const AREA_FIELDS = PA.RECORD_AREA_FIELDS;
  const BOOK_FIELDS = PA.BOOK_FIELDS;

  function str(v) {
    return v === null || v === undefined ? '' : String(v);
  }

  /** 빈 값은 정기수업이다 — 이 칸이 생기기 전에 쌓인 기록이 전부 그렇다. */
  function kindOf(kind) {
    return String(kind || '') === 'exam' ? 'exam' : 'regular';
  }

  /**
   * 그 학생의 그날 기록. 갈래까지 맞춰 찾는다 — 같은 날 정기수업과
   * 시험대비가 따로 쌓이므로, 학생만 보면 둘 중 먼저 나온 것이 걸린다.
   */
  function findRecordFor(existingRecords, studentId, kind) {
    if (!studentId) return null;
    if (!existingRecords || !existingRecords.length) return null;

    const want = kindOf(kind);
    for (let i = 0; i < existingRecords.length; i++) {
      const r = existingRecords[i];
      if (r.studentId === studentId && kindOf(r.kind) === want) return r;
    }
    return null;
  }

  function toFormValues(record) {
    const r = record || {};
    const out = {
      kind: kindOf(r.kind),
      // 시험대비의 시험·진도·숙제 칸 목록. 화면에서는 배열로 다루고, 보낼 때만
      // 다시 JSON 한 줄로 만든다.
      examTests: EI.parseItems(r.examTests),
      examItems: EI.parseItems(r.examItems),
      examNext: EI.parseItems(r.examNext),
      sessionNo: str(r.sessionNo),
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
    BOOK_FIELDS.forEach(function (field) {
      if (!out[field]) out[field] = str(books[field]);
    });
    return out;
  }

  /**
   * 회차가 비어 있으면 직전 회차 +1을 넣는다. 이미 적힌 값은 건드리지 않는다.
   *
   * 교재 채우기와 같은 규칙이다 — 이미 저장된 기록을 열 때는 부르지 않는다.
   * 직전 기록이 없으면 1회차로 시작한다.
   */
  function withSessionDefault(values, lastSessionNo) {
    const out = Object.assign({}, values);
    if (out.sessionNo) return out;

    const last = Number(lastSessionNo);
    out.sessionNo = String(isFinite(last) && last > 0 ? last + 1 : 1);
    return out;
  }

  function buildRecord(studentId, date, form) {
    const f = form || {};
    const out = {
      studentId: str(studentId),
      date: str(date),
      kind: kindOf(f.kind),
      examTests: EI.stringifyItems(f.examTests),
      examItems: EI.stringifyItems(f.examItems),
      examNext: EI.stringifyItems(f.examNext),
      sessionNo: str(f.sessionNo),
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

  const api = {
    kindOf,
    findRecordFor, toFormValues, buildRecord,
    withBookDefaults, withSessionDefault,
  };

  global.GI_RECORD_FORM = api;

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
