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


  let student = null;
  let overrides = [];
  let marks = {};
  let month = '';
  // 이 학생의 첫 수업이 있는 달. 서버가 기록에서 찾아 보낸다. 그 앞은
  // 요일·시간만으로 그려져서, 다니지도 않던 때의 수업이 달력에 가득 찬
  // 것처럼 보인다. 학생마다 다르다 — 올해 온 학생에게 작년 달력을 열어
  // 줄 까닭이 없다.
  let firstMonth = '';
  // 첫 수업 날짜. 그 앞의 날에는 줄을 세우지 않는다 — 첫 달만 맞추면
  // 그 달 1일부터 다닌 것처럼 보인다. 서버가 보내지 않으면 비어 있고,
  // 그때는 달만으로 자른다.
  let firstDate = '';

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

  /**
   * 갈 수 있는 마지막 달 — 다음 달.
   *
   * 그 뒤는 요일·시간만으로 그려진 빈 달이다. 끝없이 넘길 수 있으면
   * 아직 잡지도 않은 수업이 1년 치 달력에 가득 찬 것처럼 보인다.
   * 첫 달이 다음 달보다 뒤면(이제 등록한 학생) 첫 달이 끝이다.
   */
  function lastMonth() {
    const next = S.addMonths(S.monthOf(todayIso()), 1);
    return next < firstMonth ? firstMonth : next;
  }

  /** 갈 수 있는 범위 안으로 끌어당긴다. */
  function clamp_(key) {
    if (key < firstMonth) return firstMonth;
    const last = lastMonth();
    return key > last ? last : key;
  }

  /** 이번 달. 범위 밖이면 가장 가까운 끝을 연다. */
  function thisMonth() {
    return clamp_(S.monthOf(todayIso()));
  }

  /**
   * 다른 날로 옮긴 수업인가.
   *
   * 옮긴 날에 그 수업이 그대로 서므로, 원래 날에도 남겨 두면 한 수업이
   * 달력에 두 번 보인다. 선생님 달력에는 그대로 남는다 — 어느 날을
   * 옮겼는지는 선생님이 알아야 한다.
   */
  function movedOut_(entry, iso) {
    if (entry.skip) return String(entry.skip.reason) === 'moved';
    const m = marks[String(iso)];
    return !!(m && String(m.attendance) === '변경');
  }

  /**
   * 요일에도 하루치 조각에도 없지만 출결이 적힌 날.
   *
   * 보강이 그렇다 — 평소 요일이 아닌 날에 한 번 더 하고, 선생님이 그날
   * 기록에 '보강'을 눌러 둔다. 달력이 요일과 조각만 보면 그 수업은 아예
   * 없던 일이 되고, 학부모는 분명히 다녀온 날이 빈 칸인 것을 본다.
   *
   * 시간은 모른다 — 적어 둔 곳이 출결뿐이다. 시간 자리를 비우고 꼬리표로
   * 무슨 날이었는지 말한다.
   */
  function markOnly_(iso) {
    const m = marks[String(iso)];
    if (!m || OFF_MARKS.indexOf(m.attendance) !== -1) return [];
    return [{ time: '', student: student, fromMark: true }];
  }

  function entriesOn(iso) {
    if (firstDate && String(iso) < firstDate) return [];

    const list = S.applyOverrides(S.studentsOnDate([student], iso), overrides, iso, [student])
      .filter(function (e) { return !movedOut_(e, iso); });

    return list.length ? list : markOnly_(iso);
  }

  /**
   * 한 줄 = 그날 한 번의 수업. 누를 수 없다 — 학부모 화면에서 수업을 열어
   * 볼 곳이 없고, 누를 수 있어 보이면 눌러 보고 나서야 안다.
   */
  function entryHtml(entry, iso) {
    const m = markHtml(iso);

    // 꼬리표는 선생님이 고른 말만 단다.
    //
    // 하루치로 더해 둔 줄이라고 '보충'을 자동으로 달지 않는다. 날짜를
    // 하루 옮기거나 시간만 바꾸려고 더하는 날도 있어서, 더한 줄이 곧
    // 보충인 것은 아니다. 보충이면 선생님이 출결에서 '보강'을 고른다.
    //
    // 출결에만 적힌 날도 마찬가지다 — 적힌 말이 '출석'이면 꼬리표가
    // '출석'이 되는데, 동그라미가 이미 그 말을 하고 있다.
    const extra = m.word === '보강';

    const tag = entry.skip
      ? '<span class="gi-cal-tag is-off">' + SKIP_LABEL[entry.skip.reason] + '</span>'
      : m.off
        ? '<span class="gi-cal-tag is-off">' + esc(m.word) + '</span>'
        : (extra ? '<span class="gi-cal-tag is-extra">보강</span>' : '');

    return '<span class="gi-choice gi-cal-name' +
      (extra ? ' is-extra' : '') +
      (entry.skip || m.off ? ' is-off' : '') + '">' +
      (entry.time ? '<span class="gi-cal-at">' + esc(entry.time) + '</span>' : '') +
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
    document.querySelector('#calNav [data-mon="-1"]').disabled = month <= firstMonth;
    document.querySelector('#calNav [data-mon="1"]').disabled = month >= lastMonth();

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
    // 기록도 등록일도 없으면 이번 달이 첫 달이다. 빈 값을 그대로 두면
    // 모든 달이 '첫 달보다 앞'이 아니게 되어 한없이 뒤로 갈 수 있다.
    firstMonth = cal.firstMonth || S.monthOf(todayIso());
    firstDate = cal.firstDate || '';
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
      month = clamp_(want);
      render();
    });

    render();
  }

  window.GI_PARENT_CAL = { init: init };
})();
