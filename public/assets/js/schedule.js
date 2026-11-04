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

  /** 'YYYY-MM-DD' → 'YYYY-MM'. 달력이 어느 달을 보고 있는지 가리키는 값. */
  function monthOf(iso) {
    return /^\d{4}-\d{2}/.test(String(iso == null ? '' : iso)) ? String(iso).slice(0, 7) : '';
  }

  /** 달을 앞뒤로 옮긴다. 12월에서 한 달 뒤는 다음 해 1월이다. */
  function addMonths(monthKey, n) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey == null ? '' : monthKey));
    if (!m) return '';

    const d = new Date(Number(m[1]), Number(m[2]) - 1 + Number(n), 1);
    return d.getFullYear() + '-' + pad2_(d.getMonth() + 1);
  }

  /**
   * 한 달 달력의 칸들. 월요일로 시작하는 주 단위 배열이다.
   *
   * 앞뒤로 모자란 칸은 옆 달 날짜로 채우고 inMonth:false로 표시한다. 빈 칸으로
   * 두면 달의 첫 주와 마지막 주에서 요일과 칸이 어긋나 보인다.
   */
  function monthGrid(monthKey) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey == null ? '' : monthKey));
    if (!m) return [];

    const first = m[1] + '-' + m[2] + '-01';
    const last = new Date(Number(m[1]), Number(m[2]), 0).getDate();
    const start = mondayOf(first);
    const weeks = [];

    // 앞의 빈 칸 + 그 달의 날 수를 7로 올림한 만큼만 그린다. 늘 6주를 그리면
    // 마지막 한 줄이 통째로 옆 달인 달이 생긴다.
    const lead = weekdayIndex(first);
    const rows = Math.ceil((lead + last) / 7);

    for (let w = 0; w < rows; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const iso = addDays(start, w * 7 + d);
        week.push({ iso: iso, day: Number(iso.slice(8)), inMonth: monthOf(iso) === monthKey });
      }
      weeks.push(week);
    }
    return weeks;
  }

  /**
   * 그 날짜에 수업이 있는 학생을 이른 시간부터.
   *
   * 같은 시간이면 이름 순이다. 매번 순서가 바뀌면 어제 본 자리에 오늘은
   * 다른 학생이 있어 눈이 다시 처음부터 훑어야 한다.
   */
  /**
   * 그날이 방학인가.
   *
   * 두 날짜가 다 있어야 기간이다. 한쪽만 적힌 기간은 '언제부터 끝까지'가
   * 되어, 적다 만 것인지 그렇게 정한 것인지 알 수 없다.
   */
  function inVacation(iso, vacation) {
    const v = vacation || {};
    const from = String(v.from || '');
    const to = String(v.to || '');
    if (!from || !to) return false;

    const day = String(iso || '');
    return day >= from && day <= to;
  }

  /**
   * 그날 그 학생이 따르는 요일표.
   *
   * 방학에는 학원 전체가 시간을 바꾼다. 평소 요일표를 고쳐 쓰면 방학이
   * 끝날 때 학생 수만큼 되돌려야 하고, 요일표에는 날짜가 없으므로 지난
   * 학기 수업까지 방학 시간으로 다시 그려진다.
   *
   * 그래서 둘을 따로 들고 날짜로 고른다. 방학 요일표를 안 적은 학생은
   * 방학에도 평소대로다 — 비운 칸을 '그날 수업 없음'으로 읽으면,
   * 적기를 빠뜨린 학생이 달력에서 조용히 사라진다.
   */
  function scheduleOf(student, iso, vacation) {
    const s = student || {};
    const vac = String(s.vacationSchedule || '').trim();
    return (vac && inVacation(iso, vacation)) ? vac : s.schedule;
  }

  function studentsOnDate(students, iso, vacation) {
    const idx = weekdayIndex(iso);
    if (idx < 0) return [];

    const day = WEEKDAYS[idx];
    const out = [];

    (students || []).forEach(function (s) {
      parseSchedule(scheduleOf(s, iso, vacation)).forEach(function (e) {
        if (e.day === day) out.push({ time: e.time, student: s });
      });
    });

    return out.sort(function (a, b) {
      if (a.time !== b.time) return a.time < b.time ? -1 : 1;
      const an = String(a.student && a.student.name);
      const bn = String(b.student && b.student.name);
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
  }

  /**
   * 평소 일정 위에 그날 하루치 변경을 얹는다.
   *
   * 빼도 줄은 남는다. 지워 버리면 그날 그 학생이 원래 있었는지, 애초에
   * 수업이 없었는지 달력만 보고는 알 수 없다 — 빠진 사실이 적혀 있어야
   * 쉰 날과 없던 날이 구별된다. 그래서 줄에 skip을 달아 돌려준다:
   *   skip.reason 'absent' 결석 — 학생이 안 왔다
   *   skip.reason 'moved'  변경 — 다른 날로 옮겼다
   *   skip.reason 'off'    휴강 — 그날 그 수업 자체가 없다. 이 줄은 아예
   *                        돌려주지 않는다 — 수업이 없던 날과 같다.
   * 시간을 적은 조각은 그 시간 하나만, 비운 조각은 그날 전부에 붙는다 —
   * 하루에 두 번 오는 학생의 한 번만 쉴 수 있게.
   *
   * add로 더한 줄에는 overrideId가 붙는다(보충). 그 줄이 하루치 조각에서
   * 온 것인지 평소 일정에서 온 것인지 화면이 알아야 — 지울 때 하는 일이
   * 달라진다.
   */
  function applyOverrides(base, overrides, iso, students) {
    const mine = (overrides || []).filter(function (o) { return String(o.date) === String(iso); });
    const byId = {};
    (students || []).forEach(function (s) { if (s) byId[String(s.studentId)] = s; });

    const skips = mine.filter(function (o) { return o.kind === 'skip'; });
    const used = {};

    const rows = (base || []).map(function (e) {
      const sid = String(e.student && e.student.studentId);
      const hit = skips.filter(function (o) {
        return String(o.studentId) === sid && (!o.time || String(o.time) === e.time);
      })[0];
      if (!hit) return e;

      used[String(hit.overrideId)] = true;
      // 휴강은 자취를 남기지 않는다. 그날 그 수업 자체가 없었던 것이라,
      // 줄이 남아 있으면 '있었는데 빠진 수업'으로 읽힌다.
      if (skipOf_(hit).reason === 'off') return null;
      return { time: e.time, student: e.student, skip: skipOf_(hit) };
    }).filter(function (e) { return e; });

    // 붙을 자리가 없는 빼기 조각도 줄로 남긴다. 뺀 뒤에 평소 요일을 고치면
    // 조각만 남는데, 안 보이면 되돌릴 방법이 없다.
    skips.forEach(function (o) {
      if (used[String(o.overrideId)]) return;
      if (skipOf_(o).reason === 'off') return;
      const s = byId[String(o.studentId)];
      if (s) rows.push({ time: String(o.time || ''), student: s, skip: skipOf_(o) });
    });

    mine.filter(function (o) { return o.kind === 'add'; }).forEach(function (o) {
      const s = byId[String(o.studentId)];
      // 그만뒀거나 지워진 학생의 조각은 이름을 붙일 수 없다. 조용히 넘긴다.
      if (s) rows.push({ time: String(o.time || ''), student: s, overrideId: o.overrideId });
    });

    return rows.sort(function (a, b) {
      if (a.time !== b.time) return a.time < b.time ? -1 : 1;
      const an = String(a.student && a.student.name);
      const bn = String(b.student && b.student.name);
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
  }

  /** 빼기 조각 한 장 → 줄에 달아 둘 표시. 까닭이 비면 결석으로 읽는다. */
  function skipOf_(o) {
    const r = String(o.reason);
    return {
      overrideId: o.overrideId,
      reason: (r === 'moved' || r === 'off') ? r : 'absent',
    };
  }

  /** 그날 실제로 오는 줄만. 빼 둔 줄은 뺀다. */
  function activeOnly(entries) {
    return (entries || []).filter(function (e) { return !e.skip; });
  }

  const api = {
    WEEKDAYS,
    parseSchedule,
    formatSchedule,
    weekdayIndex,
    mondayOf,
    addDays,
    monthOf,
    addMonths,
    monthGrid,
    inVacation,
    scheduleOf,
    studentsOnDate,
    applyOverrides,
    activeOnly,
  };

  global.GI_SCHEDULE = api;

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
