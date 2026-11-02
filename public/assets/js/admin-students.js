/**
 * 학생 관리 탭 — 등록 / 수정 / 링크 복사 / 링크 재발급 / 비활성화.
 *
 * 링크 재발급은 PIN을 두지 않기로 한 결정의 상쇄 장치다 (설계 문서 §8).
 * 링크가 샜다고 판단되면 즉시 이전 링크를 무효화할 수 있어야 한다.
 */
(function () {
  const A = window.GI_ADMIN;
  const S = window.GI_SCHEDULE;
  const CL = window.GI_CLASS_LEVEL;
  const $view = document.getElementById('studentsView');

  let students = [];
  let classes = [];
  // 위 칸이 등록 중인지 수정 중인지. 'new' | 'edit'
  let mode = 'new';
  // 수정 칸이 보고 있는 학생.
  let editId = '';

  /**
   * 학생 한 명의 학교급. 반 이름에서 먼저 읽고, 없으면 학년에서 읽는다.
   *
   * 반을 아직 안 정한 학생이 많은데 학년(초5·중2·고1)은 등록할 때 적는다.
   * 반만 보면 그 학생들이 모두 '그 외'로 몰린다.
   */
  function levelOf(s) {
    return CL.classLevel(s && s.className) || CL.classLevel(s && s.grade) || '';
  }

  function parentUrl(token) {
    return window.location.origin + '/p/' + token;
  }

  function optionsHtml(selectedId) {
    return classes.map(function (c) {
      return '<option value="' + A.esc(c.classId) + '"' +
        (c.classId === selectedId ? ' selected' : '') + '>' + A.esc(c.className) + '</option>';
    }).join('');
  }

  /* ---------- 요일·시간 ---------- */

  /**
   * 요일 버튼 일곱 개 + 켜진 요일의 시간 칸.
   *
   * 요일마다 시간이 다를 수 있어 (화 5시 · 목 7시) 요일 하나에 시간 칸
   * 하나를 붙인다. 꺼진 요일의 칸은 아예 그리지 않는다 — 일곱 칸이 늘
   * 떠 있으면 어느 요일에 수업이 있는지가 한눈에 안 들어온다.
   */
  function schedHtml(raw) {
    const entries = S.parseSchedule(raw);
    const on = {};
    entries.forEach(function (e) { on[e.day] = e.time; });

    return '<div class="gi-sched" data-sched>' +
        '<div class="gi-choices gi-sched-days">' +
          S.WEEKDAYS.map(function (w) {
            return '<button class="gi-choice" type="button" data-day="' + w + '"' +
              ' aria-pressed="' + (on[w] ? 'true' : 'false') + '">' + w + '</button>';
          }).join('') +
        '</div>' +
        '<div class="gi-sched-times" data-times>' + timesHtml(entries) + '</div>' +
      '</div>';
  }

  function timesHtml(entries) {
    return entries.map(function (e) {
      return '<label class="gi-sched-time">' +
        '<span>' + e.day + '</span>' +
        '<input class="gi-input" type="time" data-time="' + e.day + '" value="' + e.time + '">' +
        '</label>';
    }).join('');
  }

  /** 화면에 켜진 요일과 시간을 '화 17:00, 목 19:00' 한 줄로 읽는다. */
  function readSched(root) {
    const box = root.querySelector('[data-sched]');
    if (!box) return '';

    const times = {};
    box.querySelectorAll('[data-time]').forEach(function (input) {
      times[input.dataset.time] = input.value;
    });

    return S.formatSchedule(S.WEEKDAYS.filter(function (w) {
      return box.querySelector('[data-day="' + w + '"]').getAttribute('aria-pressed') === 'true';
    }).map(function (w) {
      // 켜자마자 시간을 안 고르면 저장할 값이 없다. 학원 수업이 가장 많은
      // 시간대를 기본으로 둔다 — 틀리면 그 자리에서 고치면 된다.
      return { day: w, time: times[w] || '17:00' };
    }));
  }

  /** 요일 버튼을 눌렀을 때 시간 칸을 다시 그린다. 적어 둔 시간은 지키고. */
  function toggleDay(box, btn) {
    const nowOn = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', nowOn ? 'true' : 'false');

    const kept = {};
    box.querySelectorAll('[data-time]').forEach(function (input) {
      kept[input.dataset.time] = input.value;
    });

    const entries = S.WEEKDAYS.filter(function (w) {
      return box.querySelector('[data-day="' + w + '"]').getAttribute('aria-pressed') === 'true';
    }).map(function (w) {
      return { day: w, time: kept[w] || firstTime_(kept) || '17:00' };
    });

    box.querySelector('[data-times]').innerHTML = timesHtml(entries);
  }

  /** 이미 적어 둔 시간이 있으면 새 요일도 같은 시간으로 시작한다. */
  function firstTime_(kept) {
    const days = Object.keys(kept).filter(function (d) { return kept[d]; });
    return days.length ? kept[days[0]] : '';
  }

  function studentHtml(s) {
    return '' +
      '<article class="gi-rec gi-stu" data-id="' + A.esc(s.studentId) + '">' +
        '<div class="gi-stu-head">' +
          '<span class="gi-rec-date">' + A.esc(s.name) + '</span>' +
          '<span class="gi-note">' + A.esc(s.studentId) + ' · ' +
            (s.active ? A.esc(s.className || '반 없음') : '비활성') + '</span>' +
        '</div>' +
        '<div class="gi-stu-row">' +
          '<div class="gi-stu-field">' +
            '<input class="gi-input" type="text" data-field="name" value="' + A.esc(s.name) + '">' +
            '<input class="gi-input" type="text" data-field="grade" placeholder="학년" value="' + A.esc(s.grade || '') + '">' +
            '<select class="gi-select" data-field="classId">' + optionsHtml(s.classId) + '</select>' +
          '</div>' +
          '<div class="gi-choices gi-stu-acts">' +
            '<button class="gi-choice" type="button" data-act="save">저장</button>' +
            '<button class="gi-choice" type="button" data-act="record">기록 입력</button>' +
            '<button class="gi-choice" type="button" data-act="copy">링크 복사</button>' +
            '<button class="gi-choice" type="button" data-act="reissue">링크 재발급</button>' +
            '<button class="gi-choice" type="button" data-act="toggle">' +
              (s.active ? '비활성화' : '다시 활성화') + '</button>' +
          '</div>' +
        '</div>' +
        schedHtml(s.schedule) +
        '<p class="gi-note gi-stu-msg" data-role="msg"></p>' +
      '</article>';
  }

  function newFormHtml() {
    return '<div class="gi-stu-new">' +
        '<input class="gi-input" type="text" id="newName" placeholder="이름">' +
        '<input class="gi-input" type="text" id="newGrade" placeholder="학년">' +
        '<select class="gi-select" id="newClass">' + optionsHtml('') + '</select>' +
        '<button class="gi-btn gi-btn-primary" id="addBtn" type="button">등록</button>' +
      '</div>' +
      '<div id="newSched">' + schedHtml('') + '</div>';
  }

  /**
   * 수정 칸. 학생을 고르면 그 학생의 카드를 그대로 띄운다.
   *
   * 목록의 카드와 같은 마크업이라 저장·링크 복사 같은 동작이 한 벌로 끝난다.
   * 목록은 세 열로 나뉘어 한 칸이 350px인데, 여기서는 열 하나를 통으로
   * 쓰므로 같은 카드가 더 넓게 펼쳐진다.
   */
  function editFormHtml() {
    if (!students.length) return '<p class="gi-note">등록된 학생이 없습니다.</p>';

    const cur = findStudent(editId) || students[0];
    editId = cur.studentId;

    return '<select class="gi-select gi-stu-pick" id="editWho">' +
        students.map(function (s) {
          return '<option value="' + A.esc(s.studentId) + '"' +
            (s.studentId === cur.studentId ? ' selected' : '') + '>' +
            A.esc(s.name) + (s.grade ? ' (' + A.esc(s.grade) + ')' : '') +
            (s.active ? '' : ' · 비활성') + '</option>';
        }).join('') +
      '</select>' +
      studentHtml(cur);
  }

  /** 한 학교급의 열. 비어 있어도 자리를 지킨다 — 열이 셋이어야 칸이 안 밀린다. */
  function columnHtml(level) {
    const mine = students.filter(function (s) { return levelOf(s) === level.key; });

    return '<section class="gi-stu-col">' +
      '<h3 class="gi-stu-col-title">' + level.label + ' (' + mine.length + '명)</h3>' +
      (mine.length ? mine.map(studentHtml).join('')
                   : '<p class="gi-note">아직 없습니다.</p>') +
    '</section>';
  }

  function render() {
    // 반도 학년도 초·중·고로 읽히지 않는 학생. 열에서 빠지면 등록은 했는데
    // 화면 어디에도 없는 학생이 된다.
    const rest = students.filter(function (s) { return !levelOf(s); });

    $view.innerHTML = '' +
      '<div id="studentsError" class="gi-error" hidden></div>' +
      // 위 칸은 열 하나 너비다. 같은 격자에 넣어 폭을 맞춘다 — 숫자로
      // 따로 적으면 열 너비를 고칠 때마다 두 군데를 고쳐야 한다.
      '<div class="gi-stu-cols">' +
        '<div>' +
          '<div class="gi-choices gi-stu-tabs">' +
            '<button class="gi-choice" type="button" data-mode="new"' +
              ' aria-pressed="' + (mode === 'new') + '">학생 등록</button>' +
            '<button class="gi-choice" type="button" data-mode="edit"' +
              ' aria-pressed="' + (mode === 'edit') + '">수정</button>' +
          '</div>' +
          (mode === 'edit' ? editFormHtml() : newFormHtml()) +
        '</div>' +
      '</div>' +
      '<h2 class="gi-h2">학생 목록 (' + students.length + '명)</h2>' +
      (students.length
        ? '<div class="gi-stu-cols">' + CL.LEVELS.map(columnHtml).join('') + '</div>' +
          (rest.length
            // 그 외도 열 하나 폭으로 둔다. 혼자 화면을 가로지르면 수가
            // 적은데도 가장 큰 덩어리로 보인다.
            ? '<div class="gi-stu-cols"><section class="gi-stu-col">' +
                '<h3 class="gi-stu-col-title">그 외 (' + rest.length + '명)</h3>' +
                '<p class="gi-note">반 이름이나 학년에 초·중·고가 없는 학생입니다.</p>' +
                rest.map(studentHtml).join('') +
              '</section></div>'
            : '')
        : '<p class="gi-note">등록된 학생이 없습니다.</p>');

    const add = document.getElementById('addBtn');
    if (add) add.addEventListener('click', addStudent);
  }

  function load() {
    $view.innerHTML = '<p class="gi-state">불러오는 중…</p>';
    A.api.call('admin.students', { sessionKey: A.getSessionKey() }).then(function (data) {
      students = data.students;
      classes = data.classes;
      render();
    }).catch(function (err) {
      if (!A.handleAuthLoss(err)) {
        $view.innerHTML = '<div class="gi-error">' + A.esc(err.message) + '</div>';
      }
    });
  }

  function addStudent() {
    const name = document.getElementById('newName').value.trim();
    if (!name) return;

    document.getElementById('addBtn').disabled = true;
    A.api.call('admin.upsertStudent', {
      sessionKey: A.getSessionKey(),
      student: {
        name: name,
        grade: document.getElementById('newGrade').value.trim(),
        classId: document.getElementById('newClass').value,
        schedule: readSched(document.getElementById('newSched')),
      },
    }).then(load).catch(function (err) {
      if (!A.handleAuthLoss(err)) {
        const box = document.getElementById('studentsError');
        box.hidden = false;
        box.textContent = err.message;
      }
      document.getElementById('addBtn').disabled = false;
    });
  }

  function findStudent(id) {
    return students.filter(function (s) { return s.studentId === id; })[0];
  }

  function copyLink(token, $msg) {
    const url = parentUrl(token);
    const done = function () { $msg.textContent = '복사됨: ' + url; };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function () {
        $msg.textContent = url;
      });
    } else {
      $msg.textContent = url;
    }
  }

  // 요일 버튼은 등록 줄과 학생 카드 양쪽에 있다. 한 군데서 받아 누른
  // 버튼이 속한 묶음만 다시 그린다.
  $view.addEventListener('click', function (e) {
    const day = e.target.closest('[data-day]');
    if (!day) return;
    toggleDay(day.closest('[data-sched]'), day);
  });

  $view.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;

    const card = btn.closest('[data-id]');
    const id = card.dataset.id;
    const student = findStudent(id);
    const $msg = card.querySelector('[data-role="msg"]');
    const act = btn.dataset.act;

    if (act === 'copy') {
      copyLink(student.parentToken, $msg);
      return;
    }

    if (act === 'record') {
      const result = A.openRecordForStudent(student);
      if (result === false) {
        $msg.textContent = '반이 지정되지 않았습니다. 반을 먼저 지정해 주세요.';
        return;
      }
      $msg.textContent = '';
      result.catch(function (err) {
        if (!A.handleAuthLoss(err)) $msg.textContent = err.message;
      });
      return;
    }

    if (act === 'reissue') {
      if (!window.confirm(student.name + ' 학생의 링크를 새로 발급합니다.\n기존 링크는 즉시 사용할 수 없게 됩니다. 계속할까요?')) return;
      $msg.textContent = '발급 중…';
      A.api.call('admin.reissueToken', { sessionKey: A.getSessionKey(), studentId: id })
        .then(function (data) {
          student.parentToken = data.parentToken;
          $msg.textContent = '새 링크 발급됨 — 학부모님께 다시 보내주세요.';
        })
        .catch(function (err) {
          if (!A.handleAuthLoss(err)) $msg.textContent = err.message;
        });
      return;
    }

    const patch = { studentId: id, name: student.name, grade: student.grade, classId: student.classId, active: student.active };

    if (act === 'save') {
      patch.name = card.querySelector('[data-field="name"]').value.trim();
      patch.grade = card.querySelector('[data-field="grade"]').value.trim();
      patch.classId = card.querySelector('[data-field="classId"]').value;
      patch.schedule = readSched(card);
      if (!patch.name) { $msg.textContent = '이름은 비울 수 없습니다.'; return; }
    } else if (act === 'toggle') {
      patch.active = !student.active;
    } else {
      return;
    }

    $msg.textContent = '저장 중…';
    A.api.call('admin.upsertStudent', { sessionKey: A.getSessionKey(), student: patch })
      .then(load)
      .catch(function (err) {
        if (!A.handleAuthLoss(err)) $msg.textContent = err.message;
      });
  });

  $view.addEventListener('click', function (e) {
    const tab = e.target.closest('[data-mode]');
    if (!tab) return;

    mode = tab.dataset.mode;
    render();
  });

  $view.addEventListener('change', function (e) {
    if (e.target.id !== 'editWho') return;

    editId = e.target.value;
    render();
  });

  window.renderStudentsView = load;
})();
