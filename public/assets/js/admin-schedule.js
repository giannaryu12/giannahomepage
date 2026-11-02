/**
 * 수업 일정 탭 — 주간 시간표.
 *
 * 세로가 시간, 가로가 월~일이고 칸 안에 그 시간 그 요일에 오는 학생이 들어간다.
 * 이름을 누르면 그 주 그 날짜의 기록 입력 화면이 바로 열린다 — 수업 입력 탭에서
 * 반과 날짜를 다시 고르지 않아도 되게.
 *
 * 시간 행은 실제 등록된 시간만 만든다 (schedule.js의 buildTimetable).
 */
(function () {
  const A = window.GI_ADMIN;
  const S = window.GI_SCHEDULE;
  const $ = function (id) { return document.getElementById(id); };

  let students = [];
  // 화면에 그려진 주의 월요일. 비어 있으면 아직 한 번도 안 열어 본 것이다.
  let monday = '';

  function todayIso() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  /** '2026-11-02' → '11/02'. 요일은 시간표 머리에 따로 적히므로 날짜만 낸다. */
  function headLabel(iso) {
    return String(iso || '').slice(5).replace('-', '/');
  }

  function nameBtnHtml(s, iso) {
    // 반이 없으면 기록을 열 수 없다. 누를 수 있게 두면 눌러 보고 나서야 안다.
    const disabled = s.classId ? '' : ' disabled';
    return '<button class="gi-choice gi-tt-name" type="button"' +
      ' data-student="' + A.esc(s.studentId) + '" data-date="' + A.esc(iso) + '"' +
      disabled + '>' + A.esc(s.name) + '</button>';
  }

  function cellHtml(list, iso, isToday) {
    return '<td class="gi-tt-cell' + (isToday ? ' is-today' : '') + '">' +
      list.map(function (s) { return nameBtnHtml(s, iso); }).join('') +
      '</td>';
  }

  function tableHtml(rows, dates, today) {
    const head = '<tr><th class="gi-tt-time"></th>' +
      S.WEEKDAYS.map(function (w, i) {
        return '<th class="gi-tt-day' + (dates[i] === today ? ' is-today' : '') + '">' +
          A.esc(w) + '<span class="gi-tt-date">' + A.esc(headLabel(dates[i])) + '</span></th>';
      }).join('') + '</tr>';

    const body = rows.map(function (r) {
      return '<tr><th class="gi-tt-time">' + A.esc(r.time) + '</th>' +
        r.days.map(function (list, i) {
          return cellHtml(list, dates[i], dates[i] === today);
        }).join('') + '</tr>';
    }).join('');

    return '<table class="gi-tt">' + head + body + '</table>';
  }

  function render() {
    const dates = S.WEEKDAYS.map(function (w, i) { return S.addDays(monday, i); });
    const today = todayIso();
    const built = S.buildTimetable(students.filter(function (s) { return s.active; }));

    $('weekLabel').textContent = headLabel(dates[0]) + ' – ' + headLabel(dates[6]);

    const none = '<p class="gi-note">요일과 시간이 정해진 학생이 없습니다. ' +
      '학생 관리 탭에서 학생마다 요일과 시간을 정해 주세요.</p>';

    // 요일·시간을 아직 안 적은 학생은 표 아래에 그대로 둔다. 시간표에서만
    // 사라지면 등록은 했는데 보이지 않는 학생이 된다.
    const rest = built.unscheduled.length
      ? '<p class="gi-note gi-tt-rest">요일·시간 미지정 — ' +
          built.unscheduled.map(function (s) { return A.esc(s.name); }).join(', ') +
        '</p>'
      : '';

    $('timetable').innerHTML =
      (built.rows.length ? tableHtml(built.rows, dates, today) : none) + rest;
  }

  function load() {
    $('timetable').innerHTML = '<p class="gi-state">불러오는 중…</p>';
    A.api.call('admin.students', { sessionKey: A.getSessionKey() }).then(function (data) {
      students = data.students || [];
      render();
    }).catch(function (err) {
      if (!A.handleAuthLoss(err)) {
        $('timetable').innerHTML = '<div class="gi-error">' + A.esc(err.message) + '</div>';
      }
    });
  }

  function showWeek(iso) {
    monday = S.mondayOf(iso) || S.mondayOf(todayIso());
    render();
  }

  $('weekPrev').addEventListener('click', function () { showWeek(S.addDays(monday, -7)); });
  $('weekNext').addEventListener('click', function () { showWeek(S.addDays(monday, 7)); });
  $('weekToday').addEventListener('click', function () { showWeek(todayIso()); });

  $('timetable').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-student]');
    if (!btn) return;

    const student = students.filter(function (s) {
      return s.studentId === btn.dataset.student;
    })[0];
    if (!student) return;

    const result = A.openRecordForStudent(student, btn.dataset.date, 'schedule');
    if (result === false) {
      A.showError($('scheduleError'), student.name + ' 학생의 반이 지정되지 않았습니다. 학생 관리 탭에서 반을 먼저 지정해 주세요.');
      return;
    }

    A.showError($('scheduleError'), '');
    result.catch(function (err) {
      if (!A.handleAuthLoss(err)) A.showError($('scheduleError'), err.message);
    });
  });

  window.renderScheduleView = function () {
    if (!monday) monday = S.mondayOf(todayIso());
    load();
  };
})();
