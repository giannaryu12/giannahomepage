/**
 * 학생 관리 탭 — 등록 / 수정 / 링크 복사 / 링크 재발급 / 비활성화.
 *
 * 링크 재발급은 PIN을 두지 않기로 한 결정의 상쇄 장치다 (설계 문서 §8).
 * 링크가 샜다고 판단되면 즉시 이전 링크를 무효화할 수 있어야 한다.
 */
(function () {
  const A = window.GI_ADMIN;
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

  function studentHtml(s) {
    return '' +
      '<article class="gi-rec" style="padding:.9rem" data-id="' + A.esc(s.studentId) + '">' +
        '<div style="display:flex;justify-content:space-between;gap:.6rem;align-items:baseline">' +
          '<span class="gi-rec-date">' + A.esc(s.name) + '</span>' +
          '<span class="gi-note">' + A.esc(s.studentId) + ' · ' +
            (s.active ? A.esc(s.className || '반 없음') : '비활성') + '</span>' +
        '</div>' +
        '<div class="gi-field" style="display:flex;gap:.4rem;margin-top:.7rem;margin-bottom:.6rem">' +
          '<input class="gi-input" style="flex:2" type="text" data-field="name" value="' + A.esc(s.name) + '">' +
          '<input class="gi-input" style="flex:1" type="text" data-field="grade" placeholder="학년" value="' + A.esc(s.grade || '') + '">' +
          '<select class="gi-select" style="flex:2" data-field="classId">' + optionsHtml(s.classId) + '</select>' +
        '</div>' +
        '<div class="gi-choices">' +
          '<button class="gi-choice" type="button" data-act="save">저장</button>' +
          '<button class="gi-choice" type="button" data-act="record">기록 입력</button>' +
          '<button class="gi-choice" type="button" data-act="copy">링크 복사</button>' +
          '<button class="gi-choice" type="button" data-act="reissue">링크 재발급</button>' +
          '<button class="gi-choice" type="button" data-act="toggle">' +
            (s.active ? '비활성화' : '다시 활성화') + '</button>' +
        '</div>' +
        '<p class="gi-note" data-role="msg" style="margin-top:.5rem"></p>' +
      '</article>';
  }

  function render() {
    $view.innerHTML = '' +
      '<div id="studentsError" class="gi-error" hidden></div>' +
      '<h2 class="gi-h2">학생 등록</h2>' +
      '<div class="gi-field" style="display:flex;gap:.4rem">' +
        '<input class="gi-input" style="flex:2" type="text" id="newName" placeholder="이름">' +
        '<input class="gi-input" style="flex:1" type="text" id="newGrade" placeholder="학년">' +
        '<select class="gi-select" style="flex:2" id="newClass">' + optionsHtml('') + '</select>' +
      '</div>' +
      '<button class="gi-btn gi-btn-primary" id="addBtn" type="button">등록</button>' +
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
