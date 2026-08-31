/**
 * 진도의 5개 영역 정의. 선생님 입력 화면과 학부모 리포트가 함께 쓴다.
 *
 * 서버에도 같은 필드 목록이 gas/lib/records.js의 PROGRESS_FIELDS로 있다.
 * 둘이 어긋나면 입력한 값이 저장되지 않거나 학부모에게 보이지 않으므로
 * test/field-parity.test.js가 두 목록이 같은지 지킨다.
 *
 * api.js와 같은 이중 로드 패턴(IIFE + module.exports)을 쓴다.
 */
(function (global) {
  const PROGRESS_AREAS = [
    { key: 'vocab', label: '단어' },
    { key: 'reading', label: '독해' },
    { key: 'grammar', label: '문법' },
    { key: 'listening', label: '듣기' },
    { key: 'etc', label: '기타' },
  ];

  /**
   * 시험 영역. 진도 영역을 걸러서는 만들 수 없다 — 단어는 두 번 보고(단어1·단어2),
   * 독해·기타는 시험을 보지 않는다. 그래서 따로 적는다.
   * key는 그대로 시트 컬럼 이름이 되므로 한 번 정한 뒤 바꾸지 않는다.
   */
  const TEST_AREAS = [
    { key: 'vocab', label: '단어1' },
    { key: 'vocab2', label: '단어2' },
    { key: 'grammar', label: '문법' },
    { key: 'listening', label: '듣기' },
  ];

  const PROGRESS_FIELDS = [];
  PROGRESS_AREAS.forEach(function (a) {
    PROGRESS_FIELDS.push(a.key + 'Book', a.key + 'Progress');
  });

  const NEXT_FIELDS = [];
  PROGRESS_AREAS.forEach(function (a) {
    NEXT_FIELDS.push(a.key + 'NextBook', a.key + 'Next');
  });

  const TEST_FIELDS = [];
  TEST_AREAS.forEach(function (a) {
    TEST_FIELDS.push(a.key + 'TestBook', a.key + 'TestScore', a.key + 'TestMax');
  });

  /** 시트 컬럼과 저장 페이로드가 챙겨야 할 영역 필드 전부. */
  const RECORD_AREA_FIELDS = PROGRESS_FIELDS.concat(NEXT_FIELDS, TEST_FIELDS);

  /** 직전 수업 값으로 미리 채우는 교재 칸들. */
  const BOOK_FIELDS =
    PROGRESS_AREAS.map(function (a) { return a.key + 'Book'; })
      .concat(PROGRESS_AREAS.map(function (a) { return a.key + 'NextBook'; }))
      .concat(TEST_AREAS.map(function (a) { return a.key + 'TestBook'; }));

  function trimmed(v) {
    return v === null || v === undefined ? '' : String(v).trim();
  }

  /**
   * 진도가 적힌 영역만 골라 돌려준다.
   *
   * 교재는 그 학생이 쓰는 책이라 새 기록마다 미리 채워지지만, 그날 그 영역을
   * 했다는 뜻은 아니다. 그래서 판단 기준은 교재가 아니라 진도다.
   */
  function areaLines(record) {
    const r = record || {};
    const out = [];
    PROGRESS_AREAS.forEach(function (a) {
      const progress = trimmed(r[a.key + 'Progress']);
      if (!progress) return;
      out.push({ key: a.key, label: a.label, book: trimmed(r[a.key + 'Book']), progress: progress });
    });
    return out;
  }

  /** 접힌 줄에 쓸 한 줄 요약. 영역 구분이 없던 옛 기록은 progress를 그대로 쓴다. */
  function areaSummary(record) {
    const lines = areaLines(record);
    if (lines.length) {
      return lines.map(function (l) { return l.label + ' ' + l.progress; }).join(' · ');
    }
    return trimmed((record || {}).progress);
  }

  /** 내용이 적힌 숙제만 진도와 같은 순서로. 교재는 미리 채워지므로 기준이 아니다. */
  function nextLines(record) {
    const r = record || {};
    const out = [];
    PROGRESS_AREAS.forEach(function (a) {
      const text = trimmed(r[a.key + 'Next']);
      if (!text) return;
      out.push({ key: a.key, label: a.label, book: trimmed(r[a.key + 'NextBook']), text: text });
    });
    return out;
  }

  /**
   * 점수와 만점이 모두 있는 시험만. 0점은 기록으로 본다 —
   * "안 봤음"으로 뭉개면 학부모가 볼 기록이 사라진다.
   */
  function testLines(record) {
    const r = record || {};
    const out = [];
    TEST_AREAS.forEach(function (a) {
      const rawScore = r[a.key + 'TestScore'];
      const score = Number(rawScore);
      const max = Number(r[a.key + 'TestMax']);
      if (trimmed(rawScore) === '' || !isFinite(score) || !isFinite(max) || !(max > 0)) return;

      out.push({
        key: a.key,
        label: a.label,
        book: trimmed(r[a.key + 'TestBook']),
        score: String(score),
        max: String(max),
        pct: Math.round((score / max) * 100),
      });
    });
    return out;
  }

  const api = {
    PROGRESS_AREAS, PROGRESS_FIELDS,
    TEST_AREAS, TEST_FIELDS, NEXT_FIELDS, BOOK_FIELDS, RECORD_AREA_FIELDS,
    areaLines, areaSummary, nextLines, testLines,
  };

  global.GI_PROGRESS_AREAS = api;

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
