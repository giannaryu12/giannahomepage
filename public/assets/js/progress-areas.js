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

  const PROGRESS_FIELDS = [];
  PROGRESS_AREAS.forEach(function (a) {
    PROGRESS_FIELDS.push(a.key + 'Book', a.key + 'Progress');
  });

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

  const api = { PROGRESS_AREAS, PROGRESS_FIELDS, areaLines, areaSummary };

  global.GI_PROGRESS_AREAS = api;

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
