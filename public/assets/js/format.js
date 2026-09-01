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

    // 시트의 날짜 칸이 텍스트가 아니라 날짜 서식이면 서버가 Date를 담아
    // 보내고, JSON을 거치며 '2026-08-30T15:00:00.000Z' 같은 UTC 시각이 된다.
    // 그대로 찍으면 학부모 화면에 이 문자열이 그냥 보인다. 앞 열 글자만
    // 떼어도 안 된다 — 한국 자정은 전날 15시 UTC라 하루가 밀린다.
    // 그래서 진짜 Date로 읽어 보는 사람이 있는 지역의 날짜를 쓴다.
    if (!m) {
      const parsed = new Date(s);
      if (s && !isNaN(parsed.getTime())) return labelOf_(parsed);
      return s;
    }

    const month = Number(m[2]);
    const day = Number(m[3]);
    const d = new Date(Number(m[1]), month - 1, day);

    // 2026-02-30 같은 값은 Date가 3월로 굴려 버린다. 그 요일을 붙이면
    // 있지도 않은 날의 요일이 되므로 날짜만 낸다.
    if (d.getMonth() !== month - 1 || d.getDate() !== day) {
      return m[2] + '/' + m[3];
    }

    return labelOf_(d);
  }

  /** Date 하나를 '08/30 (일)'로. 월·일은 두 자리로 맞춘다. */
  function labelOf_(d) {
    const mm = String(d.getMonth() + 1);
    const dd = String(d.getDate());
    return (mm.length < 2 ? '0' + mm : mm) + '/' +
      (dd.length < 2 ? '0' + dd : dd) +
      ' (' + WEEKDAYS[d.getDay()] + ')';
  }

  const api = { WEEKDAYS, dateLabel };

  global.GI_FORMAT = api;

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
