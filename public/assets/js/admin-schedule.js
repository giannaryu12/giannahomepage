/**
 * 수업 일정 탭 — 한 달 달력.
 *
 * 날짜 칸마다 그날 수업이 있는 학생이 이른 시간부터 들어간다. 이름을 누르면
 * 그 날짜의 기록 입력 화면이 바로 열린다 — 수업 입력 탭에서 반과 날짜를
 * 다시 고르지 않아도 되게.
 *
 * 누가 언제 오는지는 학생마다 적어 둔 요일·시간에서 나온다 (schedule.js).
 */
(function () {
  const A = window.GI_ADMIN;
  const S = window.GI_SCHEDULE;
  const $ = function (id) { return document.getElementById(id); };

  let students = [];
  // 화면에 그려진 달 'YYYY-MM'. 비어 있으면 아직 한 번도 안 열어 본 것이다.
  let month = '';

  function todayIso() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  /** '2026-11' → '2026년 11월'. */
  function monthLabel(key) {
    return key.slice(0, 4) + '년 ' + Number(key.slice(5)) + '월';
  }

  function nameBtnHtml(entry, iso) {
    const s = entry.student;
    // 반이 없으면 기록을 열 수 없다. 누를 수 있게 두면 눌러 보고 나서야 안다.
    const disabled = s.classId ? '' : ' disabled';
    return '<button class="gi-choice gi-cal-name" type="button"' +
      ' data-student="' + A.esc(s.studentId) + '" data-date="' + A.esc(iso) + '"' +
      disabled + '><span class="gi-cal-at">' + A.esc(entry.time) + '</span>' +
      A.esc(s.name) + '</button>';
  }

  function cellHtml(cell, today) {
    const cls = 'gi-cal-cell' +
      (cell.inMonth ? '' : ' is-out') +
      (cell.iso === today ? ' is-today' : '');

    return '<td class="' + cls + '">' +
      '<span class="gi-cal-day">' + cell.day + '</span>' +
      S.studentsOnDate(students, cell.iso).map(function (e) {
        return nameBtnHtml(e, cell.iso);
      }).join('') +
      '</td>';
  }

  function render() {
    const today = todayIso();
    const weeks = S.monthGrid(month);

    $('weekLabel').textContent = monthLabel(month);

    const head = '<tr>' + S.WEEKDAYS.map(function (w) {
      return '<th class="gi-cal-head">' + A.esc(w) + '</th>';
    }).join('') + '</tr>';

    const body = weeks.map(function (week) {
      return '<tr>' + week.map(function (c) { return cellHtml(c, today); }).join('') + '</tr>';
    }).join('');

    // 요일·시간을 아직 안 적은 학생은 달력 아래에 이름을 남긴다. 달력에서만
    // 사라지면 등록은 했는데 보이지 않는 학생이 된다.
    const rest = students.filter(function (s) {
      return s.active && !S.parseSchedule(s.schedule).length;
    });
    const restHtml = rest.length
      ? '<p class="gi-note gi-cal-rest">요일·시간 미지정 — ' +
          rest.map(function (s) { return A.esc(s.name); }).join(', ') +
        '</p>'
      : '';

    $('timetable').innerHTML = '<table class="gi-cal">' + head + body + '</table>' + restHtml;
  }

  function load() {
    $('timetable').innerHTML = '<p class="gi-state">불러오는 중…</p>';
    A.api.call('admin.students', { sessionKey: A.getSessionKey() }).then(function (data) {
      // 비활성 학생은 달력에 넣지 않는다. 그만둔 학생이 계속 칸을 차지한다.
      students = (data.students || []).filter(function (s) { return s.active; });
      render();
    }).catch(function (err) {
      if (!A.handleAuthLoss(err)) {
        $('timetable').innerHTML = '<div class="gi-error">' + A.esc(err.message) + '</div>';
      }
    });
  }

  function showMonth(key) {
    month = key || S.monthOf(todayIso());
    render();
  }

  $('weekPrev').addEventListener('click', function () { showMonth(S.addMonths(month, -1)); });
  $('weekNext').addEventListener('click', function () { showMonth(S.addMonths(month, 1)); });
  $('weekToday').addEventListener('click', function () { showMonth(S.monthOf(todayIso())); });

  $('timetable').addEventListener('click', function (e) {
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

  window.renderScheduleView = function () {
    if (!month) month = S.monthOf(todayIso());
    load();
  };
})();
