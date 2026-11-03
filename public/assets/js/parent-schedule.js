/**
 * 학부모 화면의 수업 일정 달력.
 *
 * 선생님 달력(admin-schedule.js)과 같은 셈을 쓴다 — 평소 요일·시간 위에
 * 그날 하루치 조각(보충·결석·변경)을 얹고, 적어 둔 출결을 동그라미로 찍는다.
 * 두 화면의 달력이 다르게 보이면 "선생님 화면에는 보충이 있는데 우리 화면에는
 * 없다"는 전화가 온다.
 *
 * 다른 점은 셋이다: 한 학생만 그린다, 아무것도 누를 수 없다, 묻는 길이 없다 —
 * 달은 parent.load가 한 번에 내려준 것으로 앞뒤로 넘긴다.
 */
(function () {
  const S = window.GI_SCHEDULE;

  const SKIP_LABEL = { absent: '결석', moved: '변경' };

  const MARK_CLASS = {
    '출석': 'is-good', '지각': 'is-warn', '결석': 'is-bad', '변경': 'is-bad',
    '보강': 'is-extra',
  };

  // 그날 수업을 안 한 출결. 회차를 세지 않으므로 달력에도 적지 않는다.
  const OFF_MARKS = ['결석', '변경'];

  // 학부모 달력이 보여 주는 첫 달. 이 앱으로 일정을 적기 시작한 달이다.
  // 그 앞은 요일·시간만으로 그려져서, 다니지도 않던 때의 수업이 달력에
  // 가득 찬 것처럼 보인다.
  const FIRST_MONTH = '2026-11';

  let student = null;
  let overrides = [];
  let marks = {};
  let month = '';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function todayIso() {
    const d = new Date();
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getDate()).slice(-2);
  }

  function monthLabel(key) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
    return m ? m[1] + '년 ' + Number(m[2]) + '월' : '';
  }

  /** 이름 앞 동그라미와 뒤 회차. 아직 안 적은 수업에는 아무것도 붙지 않는다. */
  function markHtml(iso) {
    const m = marks[String(iso)];
    if (!m) return { dot: '', no: '', off: false, word: '' };

    const off = OFF_MARKS.indexOf(m.attendance) !== -1;
    return {
      dot: '<span class="gi-dot ' + (MARK_CLASS[m.attendance] || 'is-none') + '"' +
        ' title="' + esc(m.attendance) + '"></span>',
      no: (m.sessionNo && !off)
        ? '<span class="gi-cal-no">' + esc(m.sessionNo) + '회</span>' : '',
      off: off,
      word: m.attendance,
    };
  }

  /** 이번 달. 첫 달 앞이면 첫 달을 연다. */
  function thisMonth() {
    const now = S.monthOf(todayIso());
    return now < FIRST_MONTH ? FIRST_MONTH : now;
  }

  function entriesOn(iso) {
    return S.applyOverrides(S.studentsOnDate([student], iso), overrides, iso, [student]);
  }

  /**
   * 한 줄 = 그날 한 번의 수업. 누를 수 없다 — 학부모 화면에서 수업을 열어
   * 볼 곳이 없고, 누를 수 있어 보이면 눌러 보고 나서야 안다.
   */
  function entryHtml(entry, iso) {
    const m = markHtml(iso);

    const tag = entry.skip
      ? '<span class="gi-cal-tag is-off">' + SKIP_LABEL[entry.skip.reason] + '</span>'
      : m.off
        ? '<span class="gi-cal-tag is-off">' + esc(m.word) + '</span>'
        : (entry.overrideId ? '<span class="gi-cal-tag is-extra">보충</span>' : '');

    return '<span class="gi-choice gi-cal-name' +
      (entry.overrideId ? ' is-extra' : '') +
      (entry.skip || m.off ? ' is-off' : '') + '">' +
      '<span class="gi-cal-at">' + esc(entry.time) + '</span>' +
      '<span class="gi-cal-who">' + m.dot + '수업</span>' + m.no + tag + '</span>';
  }

  function cellHtml(cell, today) {
    const cls = 'gi-cal-cell' +
      (cell.inMonth ? '' : ' is-out') +
      (cell.iso === today ? ' is-today' : '');

    return '<td class="' + cls + '">' +
      '<span class="gi-cal-day">' + cell.day + '</span>' +
      entriesOn(cell.iso).map(function (e) { return entryHtml(e, cell.iso); }).join('') +
      '</td>';
  }

  function render() {
    document.getElementById('calLabel').textContent = monthLabel(month);

    // 첫 달에서는 더 뒤로 갈 곳이 없다. 눌러도 그대로인 버튼을 살려 두면
    // 몇 번을 눌러 보고 나서야 끝인 줄 안다.
    document.querySelector('#calNav [data-mon="-1"]').disabled = month <= FIRST_MONTH;

    const today = todayIso();

    const head = '<tr>' + S.WEEKDAYS.map(function (w) {
      return '<th class="gi-cal-head">' + esc(w) + '</th>';
    }).join('') + '</tr>';

    const body = S.monthGrid(month).map(function (week) {
      return '<tr>' + week.map(function (c) { return cellHtml(c, today); }).join('') + '</tr>';
    }).join('');

    document.getElementById('parentCal').innerHTML =
      '<table class="gi-cal gi-cal-read">' + head + body + '</table>';
  }

  /**
   * 달력을 띄운다. 평소 요일·시간이 비어 있으면 달력을 그리지 않는다 —
   * 빈 칸만 다섯 줄 있는 달력은 "수업이 없다"로 읽힌다.
   */
  function init(data) {
    const cal = (data && data.calendar) || {};

    student = {
      studentId: (data && data.student && data.student.studentId) || 'me',
      name: (data && data.student && data.student.name) || '',
      schedule: cal.schedule || '',
    };
    overrides = cal.overrides || [];
    marks = cal.marks || {};
    month = thisMonth();

    if (!S.parseSchedule(student.schedule).length && !overrides.length) {
      document.getElementById('planTab').innerHTML =
        '<p class="gi-note">아직 등록된 수업 요일이 없습니다. 선생님께 문의해 주세요.</p>';
      return;
    }

    document.getElementById('calNav').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-mon]');
      if (!btn) return;

      const step = Number(btn.dataset.mon);
      const want = step === 0 ? thisMonth() : S.addMonths(month, step);
      month = want < FIRST_MONTH ? FIRST_MONTH : want;
      render();
    });

    render();
  }

  window.GI_PARENT_CAL = { init: init };
})();
