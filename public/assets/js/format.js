/**
 * 화면에 찍는 문자열 만들기. 순수 함수.
 *
 * api.js와 같은 이중 로드 패턴(IIFE + module.exports)을 쓴다.
 */
(function (global) {
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  /**
   * '2026-08-30' → '08/30 (일)'.
   *
   * new Date('2026-08-30')은 UTC 자정으로 읽혀 시간대에 따라 하루 밀린다.
   * 연·월·일을 따로 넣어 보는 사람이 있는 지역의 그 날짜로 만든다.
   *
   * 날짜 꼴이 아니면 받은 값을 그대로 돌려준다 — 요일을 붙이겠다고 학부모
   * 화면에서 날짜 자체를 지워 버리면 안 된다.
   */
  function dateLabel(iso) {
    const s = iso === null || iso === undefined ? '' : String(iso);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return s;

    const month = Number(m[2]);
    const day = Number(m[3]);
    const d = new Date(Number(m[1]), month - 1, day);

    // 2026-02-30 같은 값은 Date가 3월로 굴려 버린다. 그 요일을 붙이면
    // 있지도 않은 날의 요일이 되므로 날짜만 낸다.
    if (d.getMonth() !== month - 1 || d.getDate() !== day) {
      return m[2] + '/' + m[3];
    }

    return m[2] + '/' + m[3] + ' (' + WEEKDAYS[d.getDay()] + ')';
  }

  const api = { WEEKDAYS, dateLabel };

  global.GI_FORMAT = api;

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
