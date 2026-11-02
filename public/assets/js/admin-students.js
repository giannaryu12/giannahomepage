/**
 * 학생 관리 탭 — 등록 / 수정 / 링크 복사 / 링크 재발급 / 비활성화.
 *
 * 링크 재발급은 PIN을 두지 않기로 한 결정의 상쇄 장치다 (설계 문서 §8).
 * 링크가 샜다고 판단되면 즉시 이전 링크를 무효화할 수 있어야 한다.
 */
(function () {
  const A = window.GI_ADMIN;
  const S = window.GI_SCHEDULE;
  const $view = document.getElementById('studentsView');

  let students = [];
  let classes = [];

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

  function render() {
    $view.innerHTML = '' +
      '<div id="studentsError" class="gi-error" hidden></div>' +
      '<h2 class="gi-h2">학생 등록</h2>' +
      '<div class="gi-stu-new">' +
        '<input class="gi-input" type="text" id="newName" placeholder="이름">' +
        '<input class="gi-input" type="text" id="newGrade" placeholder="학년">' +
        '<select class="gi-select" id="newClass">' + optionsHtml('') + '</select>' +
        '<button class="gi-btn gi-btn-primary" id="addBtn" type="button">등록</button>' +
      '</div>' +
      '<div id="newSched">' + schedHtml('') + '</div>' +
      '<h2 class="gi-h2">학생 목록 (' + students.length + '명)</h2>' +
      (students.length ? students.map(studentHtml).join('') : '<p class="gi-note">등록된 학생이 없습니다.</p>');

    document.getElementById('addBtn').addEventListener('click', addStudent);
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

  window.renderStudentsView = load;
})();
