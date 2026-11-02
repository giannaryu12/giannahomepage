/**
 * 학생의 수업 요일·시간. 순수 함수.
 *
 * 요일마다 시간이 다를 수 있다 — 화요일 5시, 목요일 7시처럼. 그래서
 * 요일 목록과 시간 하나가 아니라 (요일, 시간) 짝의 목록으로 둔다.
 *
 * 시트에는 한 칸에 '화 17:00, 목 19:00'로 적는다. 칸을 요일 수만큼
 * 늘리면 선생님이 시트에서 읽기 어렵고, 요일이 하나 늘 때마다 칸을
 * 또 만들어야 한다.
 *
 * api.js와 같은 이중 로드 패턴(IIFE + module.exports)을 쓴다.
 */
(function (global) {
  // 월요일이 0. 시간표를 월요일부터 그리기 때문이다.
  const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

  // '화 17:00' / '화17:00' / '화 5:00' 모두 받는다. 선생님이 손으로 적는
  // 칸이라 띄어쓰기와 자릿수를 강요하지 않는다.
  const ENTRY_RE = /^([월화수목금토일])\s*(\d{1,2}):(\d{2})$/;

  function pad2_(n) {
    const s = String(n);
    return s.length < 2 ? '0' + s : s;
  }

  /**
   * '화 17:00, 목 19:00' → [{day:'화', time:'17:00'}, …].
   *
   * 읽을 수 없는 조각은 버린다. 한 조각이 깨졌다고 나머지 요일까지
   * 시간표에서 사라지면 안 된다.
   * 요일 순서(월→일)로 정렬하고 같은 날이면 이른 시간이 먼저다.
   */
  function parseSchedule(raw) {
    const out = [];
    const seen = {};

    String(raw == null ? '' : raw).split(',').forEach(function (chunk) {
      const m = ENTRY_RE.exec(chunk.trim());
      if (!m) return;

      const h = Number(m[2]);
      const min = Number(m[3]);
      if (h > 23 || min > 59) return;

      const entry = { day: m[1], time: pad2_(h) + ':' + pad2_(min) };
      const key = entry.day + entry.time;
      if (seen[key]) return;

      seen[key] = true;
      out.push(entry);
    });

    return out.sort(function (a, b) {
      const d = WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day);
      return d !== 0 ? d : (a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
    });
  }

  /** [{day,time}, …] → '화 17:00, 목 19:00'. 저장할 때 쓴다. */
  function formatSchedule(entries) {
    return parseSchedule((entries || []).map(function (e) {
      return String(e && e.day) + ' ' + String(e && e.time);
    }).join(',')).map(function (e) {
      return e.day + ' ' + e.time;
    }).join(', ');
  }

  /** 'YYYY-MM-DD' → 0(월)~6(일). 날짜가 아니면 -1. */
  function weekdayIndex(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso == null ? '' : iso));
    if (!m) return -1;

    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return -1;

    // getDay()는 일요일이 0이다. 월요일을 0으로 민다.
    return (d.getDay() + 6) % 7;
  }

  function isoOf_(d) {
    return d.getFullYear() + '-' + pad2_(d.getMonth() + 1) + '-' + pad2_(d.getDate());
  }

  /** 그 날짜가 속한 주의 월요일. 시간표는 늘 월요일부터 그린다. */
  function mondayOf(iso) {
    const idx = weekdayIndex(iso);
    if (idx < 0) return '';

    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - idx);
    return isoOf_(d);
  }

  /** 월요일 날짜에 n일을 더한다. 주를 옮길 때도 쓴다. */
  function addDays(iso, n) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso == null ? '' : iso));
    if (!m) return '';

    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Number(n));
    return isoOf_(d);
  }

  /**
   * 학생 목록 → 시간표.
   *
   * 시간 행은 실제 등록된 시간만 만든다. 9시부터 10시까지 빈 줄을 늘어놓으면
   * 정작 수업이 있는 칸을 찾기 어렵다.
   *
   * 요일·시간이 비어 있는 학생은 unscheduled로 뺀다. 시간표에서 통째로
   * 사라지면 등록은 했는데 보이지 않는 학생이 생긴다.
   */
  function buildTimetable(students) {
    const byTime = {};
    const unscheduled = [];

    (students || []).forEach(function (s) {
      const entries = parseSchedule(s && s.schedule);
      if (!entries.length) {
        unscheduled.push(s);
        return;
      }

      entries.forEach(function (e) {
        if (!byTime[e.time]) {
          byTime[e.time] = WEEKDAYS.map(function () { return []; });
        }
        byTime[e.time][WEEKDAYS.indexOf(e.day)].push(s);
      });
    });

    const rows = Object.keys(byTime).sort().map(function (time) {
      return { time: time, days: byTime[time] };
    });

    return { rows: rows, unscheduled: unscheduled };
  }

  const api = {
    WEEKDAYS,
    parseSchedule,
    formatSchedule,
    weekdayIndex,
    mondayOf,
    addDays,
    buildTimetable,
  };

  global.GI_SCHEDULE = api;

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
