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
  // 이미 적어 둔 출결. '날짜|학생' → { attendance, sessionNo }.
  // 달력에서 기록을 마친 수업과 아직 안 적은 수업을 가르는 값이다.
  let marks = {};
  // 화면에 그려진 달 'YYYY-MM'. 비어 있으면 아직 한 번도 안 열어 본 것이다.
  let month = '';
  // 아래에 펼쳐 둔 날짜. 늘 하루가 펼쳐져 있다 — 비워 두면 무엇을 눌러야
  // 고칠 수 있는지 화면 어디에도 적혀 있지 않다.
  let openDate = '';
  // 고치는 칸을 화면으로 끌어온 날. 날이 바뀐 순간에만 끌어온다 — 저장할
  // 때마다 끌어오면 칸을 만지는 동안 화면이 계속 움직인다.
  let shownDate = '';

  function todayIso() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  /** 그 달에서 처음 펼쳐 둘 날. 이번 달이면 오늘, 아니면 1일이다. */
  function defaultDateIn(key) {
    const today = todayIso();
    return S.monthOf(today) === key ? today : key + '-01';
  }

  /** '2026-11' → '2026년 11월'. */
  function monthLabel(key) {
    return key.slice(0, 4) + '년 ' + Number(key.slice(5)) + '월';
  }

  /** '2026-11-05' → '11/05 (목)'. */
  function dayLabel(iso) {
    return iso.slice(5).replace('-', '/') + ' (' + S.WEEKDAYS[S.weekdayIndex(iso)] + ')';
  }

  // 빼기의 까닭. 시트에는 영어로 쌓고 화면에는 한글로 보인다.
  const SKIP_LABEL = { absent: '결석', moved: '변경' };

  // 출결 색. 출석이 초록이고 나머지는 저마다 다르다 — 한 가지만 칠하면
  // 지각·결석을 적어 둔 수업이 아직 안 적은 수업과 똑같아 보인다.
  const MARK_CLASS = {
    '출석': 'is-good', '지각': 'is-warn', '결석': 'is-bad', '변경': 'is-bad',
    '보강': 'is-extra',
  };

  // 하루 칸에서 바로 고르는 출결. 기록 화면의 차례와 같아야 한다 —
  // 두 곳의 순서가 다르면 손이 기억한 자리에 다른 것이 있다.
  const ATTENDANCE = ['출석', '지각', '결석', '변경', '보강'];

  // 한 묶음의 마지막 회차. 이 날 수업이 끝나면 다음 묶음을 이야기해야
  // 하므로 달력에서 미리 눈에 걸려야 한다.
  const CYCLE_LAST = 8;

  // 그날 수업을 안 한 출결. 이름을 흐리게 하고 줄을 긋는다.
  const OFF_MARKS = ['결석', '변경'];

  function markFor(iso, studentId) {
    return marks[String(iso) + '|' + String(studentId)];
  }

  /** 이름 앞 동그라미와 뒤 회차. 안 적은 수업에는 아무것도 붙지 않는다. */
  function markHtml(iso, studentId) {
    const m = markFor(iso, studentId);
    if (!m) return { dot: '', no: '', off: false, last: false, word: '' };

    return {
      dot: '<span class="gi-dot ' + (MARK_CLASS[m.attendance] || 'is-none') + '"' +
        ' title="' + A.esc(m.attendance) + '"></span>',
      // 결석한 날은 회차를 안 센다. 서버가 저장할 때 비우지만, 규칙이
      // 생기기 전에 쌓인 기록에는 숫자가 남아 있다 — 화면에서도 가린다.
      no: (m.sessionNo && OFF_MARKS.indexOf(m.attendance) === -1)
        ? '<span class="gi-cal-no">' + A.esc(m.sessionNo) + '회</span>' : '',
      // 안 온 학생은 이름을 흐리게 하고 줄을 긋는다. 빨간 점 하나로는 칸이
      // 이름으로 가득 찼을 때 눈에 걸리지 않는다.
      off: OFF_MARKS.indexOf(m.attendance) !== -1,
      // 묶음의 마지막 회차인가. 수업을 안 한 날은 회차가 없으므로 아니다.
      last: Number(m.sessionNo) === CYCLE_LAST && OFF_MARKS.indexOf(m.attendance) === -1,
      // 꼬리표에 적을 말. 적어 둔 출결을 그대로 쓴다.
      word: m.attendance,
    };
  }

  function entriesOn(iso) {
    return S.applyOverrides(S.studentsOnDate(students, iso), overrides, iso, students);
  }

  /* ---------- 달력 ---------- */

  function nameBtnHtml(entry, iso) {
    const s = entry.student;
    // 반이 없으면 기록을 열 수 없다. 누를 수 있게 두면 눌러 보고 나서야 안다.
    // 뺀 줄도 누를 일이 없다 — 그날 오지 않는 학생의 기록을 열 까닭이 없다.
    const disabled = (s.classId && !entry.skip) ? '' : ' disabled';
    const m = markHtml(iso, s.studentId);
    // 꼬리표는 하나만 단다. 미리 뺀 까닭이 있으면 그것이 먼저다 — 왜 빠진
    // 날인지를 말해 준다. 그다음이 적어 둔 결석이다.
    //
    // 더해 둔 줄에는 '보충'을 달지 않는다. 그날 무슨 수업이었는지는
    // 선생님이 하루 칸의 드롭박스에서 고른다 — 고르기도 전에 꼬리표가
    // 붙어 있으면 이미 정해진 것처럼 보인다.
    //
    // 점선 네모도 마찬가지다. 더해 둔 날이 곧 보강은 아니다 — 날짜를
    // 하루 옮기거나 시간만 바꾸려고 더하는 날도 있다. 드롭박스에서
    // '보강'을 고른 줄에만 두른다.
    const extra = m.word === '보강';

    const mark = entry.skip
      ? '<span class="gi-cal-tag is-off">' + SKIP_LABEL[entry.skip.reason] + '</span>'
      : m.off
        ? '<span class="gi-cal-tag is-off">' + A.esc(m.word) + '</span>'
        : '';

    return '<button class="gi-choice gi-cal-name' +
      (extra ? ' is-extra' : '') + (entry.skip || m.off ? ' is-off' : '') +
      (m.last ? ' is-last' : '') + '"' +
      ' type="button" data-student="' + A.esc(s.studentId) + '" data-date="' + A.esc(iso) + '"' +
      // 동그라미는 이름 안에 넣는다. 밖에 두면 좁은 칸에서 시간 줄 끝에
      // 혼자 남고 이름은 다음 줄로 넘어간다.
      disabled + '><span class="gi-cal-at">' + A.esc(entry.time) + '</span>' +
      '<span class="gi-cal-who">' + m.dot + A.esc(s.name) + '</span>' + m.no + mark + '</button>';
  }

  function cellHtml(cell, today) {
    const cls = 'gi-cal-cell' +
      (cell.inMonth ? '' : ' is-out') +
      (cell.iso === today ? ' is-today' : '') +
      (cell.iso === openDate ? ' is-open' : '');

    // 칸 어디를 눌러도 그날 일정 고치는 칸이 열린다. 숫자만 누를 수 있게
    // 두면 휴대폰에서 글자 높이 12px이 유일한 과녁이 된다. 학생 이름은
    // 먼저 걸러지므로(아래 눌렀을 때) 이름을 눌렀다가 날이 열리지 않는다.
    return '<td class="' + cls + '" data-day="' + A.esc(cell.iso) + '">' +
      // 숫자는 버튼으로 남긴다 — 키보드로도 날을 열 수 있어야 한다.
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

  /**
   * 더할 학생 드롭박스. 가나다 순이다.
   *
   * 서버가 주는 차례는 시트에 적은 차례라 선생님 머릿속에 없다 — 이름을
   * 찾으려면 목록을 처음부터 끝까지 훑어야 한다.
   *
   * slice()로 베껴서 세운다. 원본을 세우면 달력 줄 차례(시간 → 이름)가
   * 함께 흔들린다.
   */
  function studentOptionsHtml() {
    return students.slice().sort(function (x, y) {
      return String(x.name).localeCompare(String(y.name), 'ko');
    }).map(function (s) {
      return '<option value="' + A.esc(s.studentId) + '">' + A.esc(s.name) + '</option>';
    }).join('');
  }

  /**
   * 하루 칸의 줄 하나.
   *
   * 줄이 세 가지다. 평소 일정에서 온 줄은 뺄 수 있고(결석·변경), 이미 뺀
   * 줄은 되돌릴 수 있고, 하루치로 더한 줄(보충)은 지울 수 있다. 하는 일이
   * 다르므로 버튼도 다르다.
   */
  /** 줄 하나의 출결 드롭박스. 비어 있으면 아직 안 적은 것이다. */
  function attendHtml(studentId) {
    const now = markFor(openDate, studentId);
    const cur = (now && now.attendance) || '';

    return '<select class="gi-select gi-day-att" data-att="' + A.esc(studentId) + '">' +
        '<option value=""' + (cur ? '' : ' selected') + '>출결</option>' +
        ATTENDANCE.map(function (v) {
          return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + v + '</option>';
        }).join('') +
      '</select>';
  }

  /**
   * 평소 일정에서 온 줄을 그날 목록에서 빼는 단추.
   *
   * 보충 줄에는 달지 않는다 — 그쪽은 '지우기'가 조각 자체를 지운다.
   */
  function delHtml(e) {
    return '<button class="gi-choice gi-day-del" type="button" data-del="' +
      A.esc(e.student.studentId) + '" aria-label="이 수업 삭제">삭제</button>';
  }

  function dayRowHtml(e) {
    const m = markHtml(openDate, e.student.studentId);
    let tail;

    if (e.skip) {
      // 드롭박스가 생기기 전에 빼 둔 줄이다. 까닭을 바꾸는 일은 이제
      // 드롭박스가 하므로 되돌리는 길만 남긴다.
      tail = '<span class="gi-badge is-bad">' + SKIP_LABEL[e.skip.reason] + '</span>' +
        '<button class="gi-choice" type="button" data-drop="' + A.esc(e.skip.overrideId) +
          '">되돌리기</button>';
    } else if (e.overrideId) {
      // 더해 둔 줄도 다른 줄과 똑같이 보인다 — 드롭박스 옆에 '삭제'
      // 하나. 선생님에게는 둘 다 '이 날 이 수업을 목록에서 뺀다'는
      // 한 가지 일이다. 속으로 하는 일만 다르다(아래 removeAddedClass).
      //
      // '보충' 꼬리표도 달지 않는다. 그날 무슨 수업이었는지는 옆
      // 드롭박스에서 고르는데, 고르기도 전에 꼬리표가 붙어 있으면 이미
      // 정해진 것처럼 보인다. 달력 쪽 꼬리표는 그대로 둔다 — 거기서는
      // 평소 요일에 없던 줄이 왜 서 있는지를 말해 준다.
      tail = '<button class="gi-choice gi-day-del" type="button" data-drop-add="' +
        A.esc(e.overrideId) + '" data-who="' + A.esc(e.student.studentId) +
        '" aria-label="이 수업 삭제">삭제</button>';
    } else if (m.off) {
      // 이미 결석·변경으로 적어 둔 날이다. 미리 빼는 버튼은 내린다 —
      // 적어 둔 결석 옆에 '결석' 버튼이 또 있으면 무엇이 무엇인지 모른다.
      tail = '<span class="gi-badge is-bad">' + A.esc(m.word) + '</span>' + delHtml(e);
    } else {
      // 결석·변경은 드롭박스에서 고른다. 삭제는 다른 일이다 — 그날 그
      // 수업 자체가 없었던 것으로 목록에서 뺀다(휴강). 결석으로 적지
      // 않으므로 학부모 달력에도 결석으로 뜨지 않는다.
      tail = delHtml(e);
    }

    return '<li class="gi-day-row' + (e.skip || m.off ? ' is-off' : '') + '">' +
      '<span class="gi-day-at">' + A.esc(e.time) + '</span>' +
      '<span class="gi-day-who">' + m.dot + A.esc(e.student.name) + m.no + '</span>' +
      // 학생 관리 탭을 거치지 않고 여기서 바로 출결을 적는다.
      attendHtml(e.student.studentId) +
      tail +
      '</li>';
  }

  function renderDayEdit() {
    // 브라우저가 옛 화면 파일을 들고 있으면 이 칸이 아예 없다. 조용히
    // 넘기면 날짜를 눌러도 아무 일이 없고, 고장과 구별되지 않는다.
    if (!$('dayEdit')) {
      A.showError($('scheduleError'),
        '화면이 오래된 상태입니다. 새로고침해 주세요.');
      return;
    }

    if (!openDate) {
      $('dayEdit').hidden = true;
      $('dayEdit').innerHTML = '';
      shownDate = '';
      return;
    }

    const rows = entriesOn(openDate).map(dayRowHtml).join('');

    $('dayEdit').hidden = false;
    $('dayEdit').innerHTML = '' +
      '<div class="gi-day-head">' +
        '<h3 class="gi-day-title">' + A.esc(dayLabel(openDate)) + ' 일정 고치기</h3>' +
        // 달력을 누르지 않고도 날을 바꿀 수 있어야 한다. 누를 자리를 못
        // 찾으면 고치는 길이 통째로 막힌다.
        '<input class="gi-input" type="date" data-pick value="' + A.esc(openDate) + '">' +
      '</div>' +
      (rows ? '<ul class="gi-day-list">' + rows + '</ul>'
            : '<p class="gi-note">이 날은 수업이 없습니다.</p>') +
      '<div class="gi-day-add">' +
        '<select class="gi-select" id="dayAddWho">' + studentOptionsHtml() + '</select>' +
        '<input class="gi-input" type="time" id="dayAddTime" value="17:00">' +
        '<button class="gi-choice" type="button" data-add>추가</button>' +
      '</div>' +
      '<p class="gi-note">이 날 하루만 바뀝니다. 평소 요일·시간은 그대로입니다.</p>';

    // 달력 한 달이 화면을 다 쓰므로 고치는 칸은 접힌 아래에서 열린다.
    // 끌어오지 않으면 눌러도 아무 일이 없어 보인다.
    if (openDate !== shownDate) {
      shownDate = openDate;
      $('dayEdit').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
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
      A.api.call('admin.attendance', {
        sessionKey: A.getSessionKey(), from: range.from, to: range.to,
      }),
    ]).then(function (res) {
      // 비활성 학생은 달력에 넣지 않는다. 그만둔 학생이 계속 칸을 차지한다.
      students = (res[0].students || []).filter(function (s) { return s.active; });
      overrides = res[1].overrides || [];

      marks = {};
      (res[2].marks || []).forEach(function (m) {
        marks[String(m.date) + '|' + String(m.studentId)] = m;
      });
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
        // 같은 날 같은 학생을 다시 빼면 서버가 먼저 쌓인 조각을 돌려준다.
        // 그대로 밀어 넣으면 줄이 두 번 생기므로 있던 것부터 걷어낸다.
        overrides = overrides.filter(function (x) { return x.overrideId !== data.overrideId; });
        overrides.push({
          overrideId: data.overrideId, date: o.date, studentId: o.studentId,
          time: o.time || '', kind: o.kind, reason: o.reason || '',
        });
        render();
      })
      .catch(function (err) {
        if (!A.handleAuthLoss(err)) A.showError($('scheduleError'), err.message);
      });
  }

  /**
   * 출결 한 칸만 저장한다.
   *
   * 서버가 회차까지 정해 돌려주므로 받아서 화면에 꽂는다. 화면에서 따로
   * 세면 두 곳의 규칙이 갈라진다.
   */
  function setAttendance(studentId, value) {
    A.showError($('scheduleError'), '');
    const key = openDate + '|' + studentId;

    return A.api.call('admin.setAttendance', {
      sessionKey: A.getSessionKey(), studentId: studentId, date: openDate, attendance: value,
    }).then(function (data) {
      if (!value) delete marks[key];
      else {
        marks[key] = {
          date: openDate, studentId: studentId, attendance: value,
          sessionNo: String(data.sessionNo || ''),
        };
      }
      render();
    }).catch(function (err) {
      if (!A.handleAuthLoss(err)) A.showError($('scheduleError'), err.message);
    });
  }

  /**
   * 그날 그 학생의 수업을 목록에서 뺀다 — 휴강.
   *
   * 적어 둔 출결이 있으면 먼저 지운다. 수업이 없던 날로 해 놓고 출결만
   * 남으면 학부모 달력에 동그라미가 혼자 떠 있다.
   */
  function removeDayClass(studentId) {
    const had = markFor(openDate, studentId);
    const first = had ? setAttendance(studentId, '') : Promise.resolve();

    return first.then(function () {
      return saveOverride({
        date: openDate, studentId: studentId, kind: 'skip', reason: 'off',
      });
    });
  }

  /**
   * 더해 둔 수업을 그날 목록에서 지운다.
   *
   * 적어 둔 출결이 있으면 먼저 지운다. 수업 줄만 사라지고 출결이 남으면,
   * 학부모 달력은 '요일에 없는 날에 출결이 적혔다'고 읽고 그 날 수업을
   * 혼자 다시 세운다(parent-schedule.js의 markOnly_).
   */
  function removeAddedClass(id, studentId) {
    const had = markFor(openDate, studentId);
    const first = had ? setAttendance(studentId, '') : Promise.resolve();

    return first.then(function () { return dropOverride(id); });
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
    // 옮긴 달의 날로 갈아 끼운다. 그냥 두면 보이지 않는 날이 아래에 남아
    // 엉뚱한 날짜를 고치게 되고, 닫아 버리면 고칠 자리가 화면에서 사라진다.
    openDate = defaultDateIn(month);
    load();
  }

  $('weekPrev').addEventListener('click', function () { showMonth(S.addMonths(month, -1)); });
  $('weekNext').addEventListener('click', function () { showMonth(S.addMonths(month, 1)); });
  $('weekToday').addEventListener('click', function () { showMonth(S.monthOf(todayIso())); });

  $('timetable').addEventListener('click', function (e) {
    // 이름을 먼저 본다. 이름 버튼도 날짜 칸 안에 있으므로 날짜를 먼저 보면
    // 이름을 누를 때마다 기록 대신 일정 칸이 열린다.
    const btn = e.target.closest('[data-student]');

    if (!btn) {
      const day = e.target.closest('[data-day]');
      if (day) {
        // 같은 날을 다시 눌러도 닫지 않는다. 닫히면 고칠 자리가 사라진다.
        openDate = day.dataset.day;
        render();
      }
      return;
    }

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
    const dropAdd = e.target.closest('[data-drop-add]');
    if (dropAdd) {
      removeAddedClass(dropAdd.dataset.dropAdd, dropAdd.dataset.who);
      return;
    }

    const drop = e.target.closest('[data-drop]');
    if (drop) {
      dropOverride(drop.dataset.drop);
      return;
    }

    const del = e.target.closest('[data-del]');
    if (del) {
      removeDayClass(del.dataset.del);
      return;
    }

    if (e.target.closest('[data-add]')) {
      const who = $('dayAddWho').value;
      const time = $('dayAddTime').value;
      if (!who || !time) return;
      saveOverride({ date: openDate, studentId: who, time: time, kind: 'add' });
    }
  });

  $('dayEdit').addEventListener('change', function (e) {
    const att = e.target.closest('[data-att]');
    if (att) {
      setAttendance(att.dataset.att, att.value);
      return;
    }

    const pick = e.target.closest('[data-pick]');
    if (!pick || !pick.value) return;

    openDate = pick.value;
    // 다른 달을 고르면 달력도 그 달로 넘긴다. 달력과 아래 칸이 다른 달을
    // 가리키면 어느 날을 고치는 중인지 알 수 없다.
    if (S.monthOf(openDate) !== month) {
      month = S.monthOf(openDate);
      load();
      return;
    }
    render();
  });

  window.renderScheduleView = function () {
    if (!month) month = S.monthOf(todayIso());
    if (!openDate) openDate = defaultDateIn(month);
    // 처음 열 때는 끌어오지 않는다 — 화면이 열리자마자 아래로 내려가면
    // 달력을 보려고 다시 올려야 한다.
    shownDate = openDate;
    load();
  };
})();
