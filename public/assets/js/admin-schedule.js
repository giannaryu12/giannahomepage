/**
 * 수업 일정 탭 — 한 달 달력.
 *
 * 날짜 칸마다 그날 수업이 있는 학생이 이른 시간부터 들어간다. 이름을 누르면
 * 그 날짜의 기록 입력 화면이 바로 열린다.
 *
 * 누가 언제 오는지는 두 겹이다 (schedule.js):
 *   평소 일정 — 학생마다 적어 둔 요일·시간
 *   하루치 변경 — 보강·휴강처럼 그날 하루만 달라지는 것
 * 평소 일정을 고치면 지난 달력까지 같이 바뀌므로, 하루짜리는 조각으로 얹는다.
 */
(function () {
  const A = window.GI_ADMIN;
  const S = window.GI_SCHEDULE;
  const $ = function (id) { return document.getElementById(id); };

  let students = [];
  let overrides = [];
  // 화면에 그려진 달 'YYYY-MM'. 비어 있으면 아직 한 번도 안 열어 본 것이다.
  let month = '';
  // 아래에 펼쳐 둔 날짜. 비어 있으면 안 펼친 것이다.
  let openDate = '';

  function todayIso() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  /** '2026-11' → '2026년 11월'. */
  function monthLabel(key) {
    return key.slice(0, 4) + '년 ' + Number(key.slice(5)) + '월';
  }

  /** '2026-11-05' → '11/05 (목)'. */
  function dayLabel(iso) {
    return iso.slice(5).replace('-', '/') + ' (' + S.WEEKDAYS[S.weekdayIndex(iso)] + ')';
  }

  function entriesOn(iso) {
    return S.applyOverrides(S.studentsOnDate(students, iso), overrides, iso, students);
  }

  /* ---------- 달력 ---------- */

  function nameBtnHtml(entry, iso) {
    const s = entry.student;
    // 반이 없으면 기록을 열 수 없다. 누를 수 있게 두면 눌러 보고 나서야 안다.
    const disabled = s.classId ? '' : ' disabled';
    return '<button class="gi-choice gi-cal-name' + (entry.overrideId ? ' is-extra' : '') + '"' +
      ' type="button" data-student="' + A.esc(s.studentId) + '" data-date="' + A.esc(iso) + '"' +
      disabled + '><span class="gi-cal-at">' + A.esc(entry.time) + '</span>' +
      A.esc(s.name) + '</button>';
  }

  function cellHtml(cell, today) {
    const cls = 'gi-cal-cell' +
      (cell.inMonth ? '' : ' is-out') +
      (cell.iso === today ? ' is-today' : '') +
      (cell.iso === openDate ? ' is-open' : '');

    return '<td class="' + cls + '">' +
      // 날짜를 누르면 그날 일정을 고치는 칸이 달력 아래에 열린다. 칸 안에
      // 넣기에는 휴대폰에서 한 칸이 50px도 안 된다.
      '<button class="gi-cal-day" type="button" data-day="' + A.esc(cell.iso) + '">' +
        cell.day + '</button>' +
      entriesOn(cell.iso).map(function (e) { return nameBtnHtml(e, cell.iso); }).join('') +
      '</td>';
  }

  function render() {
    const today = todayIso();

    $('weekLabel').textContent = monthLabel(month);

    const head = '<tr>' + S.WEEKDAYS.map(function (w) {
      return '<th class="gi-cal-head">' + A.esc(w) + '</th>';
    }).join('') + '</tr>';

    const body = S.monthGrid(month).map(function (week) {
      return '<tr>' + week.map(function (c) { return cellHtml(c, today); }).join('') + '</tr>';
    }).join('');

    // 요일·시간을 아직 안 적은 학생은 달력 아래에 이름을 남긴다. 달력에서만
    // 사라지면 등록은 했는데 보이지 않는 학생이 된다.
    const rest = students.filter(function (s) { return !S.parseSchedule(s.schedule).length; });
    const restHtml = rest.length
      ? '<p class="gi-note gi-cal-rest">요일·시간 미지정 — ' +
          rest.map(function (s) { return A.esc(s.name); }).join(', ') +
        '</p>'
      : '';

    $('timetable').innerHTML = '<table class="gi-cal">' + head + body + '</table>' + restHtml;
    renderDayEdit();
  }

  /* ---------- 하루 고치기 ---------- */

  function studentOptionsHtml() {
    return students.map(function (s) {
      return '<option value="' + A.esc(s.studentId) + '">' + A.esc(s.name) + '</option>';
    }).join('');
  }

  function dayRowHtml(e) {
    // 평소 일정에서 온 줄은 '빼기'(skip 조각을 더한다), 하루치로 더한 줄은
    // '지우기'(그 조각을 지운다). 같은 × 하나로 보이지만 하는 일이 다르다.
    return '<li class="gi-day-row">' +
      '<span class="gi-day-at">' + A.esc(e.time) + '</span>' +
      '<span class="gi-day-who">' + A.esc(e.student.name) + '</span>' +
      (e.overrideId
        ? '<span class="gi-badge is-good">추가</span>' +
          '<button class="gi-choice" type="button" data-drop="' + A.esc(e.overrideId) + '">지우기</button>'
        : '<button class="gi-choice" type="button" data-skip="' + A.esc(e.student.studentId) +
            '" data-time="' + A.esc(e.time) + '">빼기</button>') +
      '</li>';
  }

  function skippedRowsHtml() {
    return overrides.filter(function (o) {
      return o.date === openDate && o.kind === 'skip';
    }).map(function (o) {
      const s = students.filter(function (x) { return x.studentId === o.studentId; })[0];
      if (!s) return '';
      return '<li class="gi-day-row is-off">' +
        '<span class="gi-day-at">' + A.esc(o.time || '종일') + '</span>' +
        '<span class="gi-day-who">' + A.esc(s.name) + '</span>' +
        '<span class="gi-badge is-bad">휴강</span>' +
        '<button class="gi-choice" type="button" data-drop="' + A.esc(o.overrideId) + '">되돌리기</button>' +
        '</li>';
    }).join('');
  }

  function renderDayEdit() {
    if (!openDate) {
      $('dayEdit').hidden = true;
      $('dayEdit').innerHTML = '';
      return;
    }

    const rows = entriesOn(openDate).map(dayRowHtml).join('') + skippedRowsHtml();

    $('dayEdit').hidden = false;
    $('dayEdit').innerHTML = '' +
      '<div class="gi-day-head">' +
        '<h3 class="gi-day-title">' + A.esc(dayLabel(openDate)) + '</h3>' +
        '<button class="gi-choice" type="button" data-close>닫기</button>' +
      '</div>' +
      (rows ? '<ul class="gi-day-list">' + rows + '</ul>'
            : '<p class="gi-note">이 날은 수업이 없습니다.</p>') +
      '<div class="gi-day-add">' +
        '<select class="gi-select" id="dayAddWho">' + studentOptionsHtml() + '</select>' +
        '<input class="gi-input" type="time" id="dayAddTime" value="17:00">' +
        '<button class="gi-choice" type="button" data-add>추가</button>' +
      '</div>' +
      '<p class="gi-note">이 날 하루만 바뀝니다. 평소 요일·시간은 그대로입니다.</p>';
  }

  /* ---------- 서버 ---------- */

  function monthRange() {
    const weeks = S.monthGrid(month);
    // 달력에 보이는 옆 달 날짜까지 받아야 첫 주와 마지막 주가 비어 보이지 않는다.
    return weeks.length
      ? { from: weeks[0][0].iso, to: weeks[weeks.length - 1][6].iso }
      : { from: '', to: '' };
  }

  function load() {
    $('timetable').innerHTML = '<p class="gi-state">불러오는 중…</p>';
    const range = monthRange();

    Promise.all([
      A.api.call('admin.students', { sessionKey: A.getSessionKey() }),
      A.api.call('admin.overrides', {
        sessionKey: A.getSessionKey(), from: range.from, to: range.to,
      }),
    ]).then(function (res) {
      // 비활성 학생은 달력에 넣지 않는다. 그만둔 학생이 계속 칸을 차지한다.
      students = (res[0].students || []).filter(function (s) { return s.active; });
      overrides = res[1].overrides || [];
      render();
    }).catch(function (err) {
      if (!A.handleAuthLoss(err)) {
        $('timetable').innerHTML = '<div class="gi-error">' + A.esc(err.message) + '</div>';
      }
    });
  }

  function saveOverride(o) {
    A.showError($('scheduleError'), '');
    return A.api.call('admin.saveOverride', { sessionKey: A.getSessionKey(), override: o })
      .then(function (data) {
        // 서버를 다시 부르지 않고 화면의 목록에 바로 얹는다. 한 번 더 부르면
        // 달력 전체가 깜빡이고, 그날 칸을 다시 찾아 눌러야 한다.
        overrides.push({
          overrideId: data.overrideId, date: o.date, studentId: o.studentId,
          time: o.time || '', kind: o.kind,
        });
        render();
      })
      .catch(function (err) {
        if (!A.handleAuthLoss(err)) A.showError($('scheduleError'), err.message);
      });
  }

  function dropOverride(id) {
    A.showError($('scheduleError'), '');
    return A.api.call('admin.deleteOverride', { sessionKey: A.getSessionKey(), overrideId: id })
      .then(function () {
        overrides = overrides.filter(function (o) { return o.overrideId !== id; });
        render();
      })
      .catch(function (err) {
        if (!A.handleAuthLoss(err)) A.showError($('scheduleError'), err.message);
      });
  }

  /* ---------- 눌렀을 때 ---------- */

  function showMonth(key) {
    month = key || S.monthOf(todayIso());
    // 달을 옮기면 펼쳐 둔 날은 닫는다. 보이지 않는 날이 아래에 남아 있으면
    // 엉뚱한 날짜를 고치게 된다.
    openDate = '';
    load();
  }

  $('weekPrev').addEventListener('click', function () { showMonth(S.addMonths(month, -1)); });
  $('weekNext').addEventListener('click', function () { showMonth(S.addMonths(month, 1)); });
  $('weekToday').addEventListener('click', function () { showMonth(S.monthOf(todayIso())); });

  $('timetable').addEventListener('click', function (e) {
    const day = e.target.closest('[data-day]');
    if (day) {
      openDate = day.dataset.day === openDate ? '' : day.dataset.day;
      render();
      return;
    }

    const btn = e.target.closest('[data-student]');
    if (!btn) return;

    const student = students.filter(function (s) {
      return s.studentId === btn.dataset.student;
    })[0];
    if (!student) return;

    const result = A.openRecordForStudent(student, btn.dataset.date, 'schedule');
    if (result === false) {
      A.showError($('scheduleError'),
        student.name + ' 학생의 반이 지정되지 않았습니다. 학생 관리 탭에서 반을 먼저 지정해 주세요.');
      return;
    }

    A.showError($('scheduleError'), '');
    result.catch(function (err) {
      if (!A.handleAuthLoss(err)) A.showError($('scheduleError'), err.message);
    });
  });

  $('dayEdit').addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) {
      openDate = '';
      render();
      return;
    }

    const drop = e.target.closest('[data-drop]');
    if (drop) {
      dropOverride(drop.dataset.drop);
      return;
    }

    const skip = e.target.closest('[data-skip]');
    if (skip) {
      saveOverride({
        date: openDate, studentId: skip.dataset.skip, time: skip.dataset.time, kind: 'skip',
      });
      return;
    }

    if (e.target.closest('[data-add]')) {
      const who = $('dayAddWho').value;
      const time = $('dayAddTime').value;
      if (!who || !time) return;
      saveOverride({ date: openDate, studentId: who, time: time, kind: 'add' });
    }
  });

  window.renderScheduleView = function () {
    if (!month) month = S.monthOf(todayIso());
    load();
  };
})();
