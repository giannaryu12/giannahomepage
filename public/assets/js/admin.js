/**
 * 선생님 입력 화면.
 *
 * 반은 1~2명뿐이라 일괄 입력의 이점이 없다. 수업 탭은 그날 누가 입력됐는지
 * 보여주는 조회 화면이고, 실제 입력·저장은 학생 한 명 단위 기록 화면에서 한다.
 *
 * 입력 중인 내용은 학생 단위로 localStorage에 계속 저장한다. 네트워크 오류로
 * 입력한 내용을 날리는 것이 이 앱에서 가장 나쁜 시나리오다.
 */
(function () {
  const api = createApi(window.GIANNA_CONFIG.GAS_URL);
  const RF = window.GI_RECORD_FORM;
  const SESSION_STORE = 'gi.session';
  const DRAFT_PREFIX = 'gi.draft.';

  const ATTENDANCE = ['출석', '지각', '결석', '보강'];
  const HOMEWORK = ['제출', '부분제출', '미제출', '해당없음'];
  const LEVELS = ['상', '중', '하'];

  let sessionKey = sessionStorage.getItem(SESSION_STORE) || '';

  // 수업 탭(조회 전용) 상태
  let entryRoster = [];
  let entryExistingRecords = [];

  // 기록 입력 화면 상태
  let currentStudent = null;
  let currentClassId = '';
  let currentDate = '';
  let recordOrigin = 'entry'; // 'entry' | 'students' — 돌아가기 목적지
  let recordForm = {};

  const $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showError(el, msg) {
    if (!msg) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = msg;
  }

  function todayIso() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  /* ---------- 로그인 ---------- */

  function showApp() {
    $('loginView').hidden = true;
    $('appView').hidden = false;
    $('headSub').textContent = '선생님 전용 · 로그인됨';
    loadClasses();
  }

  function login() {
    const pw = $('password').value;
    if (!pw) return showError($('loginError'), '비밀번호를 입력해 주세요.');

    $('loginBtn').disabled = true;
    showError($('loginError'), '');

    api.call('admin.login', { password: pw }).then(function (data) {
      sessionKey = data.sessionKey;
      sessionStorage.setItem(SESSION_STORE, sessionKey);
      $('password').value = '';
      showApp();
    }).catch(function (err) {
      showError($('loginError'), err.message);
    }).finally(function () {
      $('loginBtn').disabled = false;
    });
  }

  function handleAuthLoss(err) {
    if (err.code === 'UNAUTHORIZED') {
      sessionKey = '';
      sessionStorage.removeItem(SESSION_STORE);
      $('appView').hidden = true;
      $('loginView').hidden = false;
      showError($('loginError'), err.message);
      return true;
    }
    return false;
  }

  /* ---------- 반 목록 ---------- */

  function loadClasses() {
    api.call('admin.classes', { sessionKey: sessionKey }).then(function (data) {
      $('classSelect').innerHTML = data.classes.map(function (c) {
        return '<option value="' + esc(c.classId) + '">' + esc(c.className) + '</option>';
      }).join('');
      if (!$('dateInput').value) $('dateInput').value = todayIso();
      loadRoster();
    }).catch(function (err) {
      if (!handleAuthLoss(err)) showError($('entryError'), err.message);
    });
  }

  /* ---------- 수업 탭 명단 (조회 전용) ---------- */

  function rosterRowHtml(s) {
    return '' +
      '<div class="gi-rec">' +
        '<button type="button" class="gi-rec-top" data-student="' + esc(s.studentId) + '">' +
          '<span class="gi-rec-date">' + esc(s.name) + '</span>' +
          '<span class="gi-note">' + esc(s.grade || '') + '</span>' +
          '<span class="gi-badge ' + (s.hasRecord ? 'is-good' : 'is-none') + '" style="margin-left:auto">' +
            (s.hasRecord ? '입력됨' : '미입력') +
          '</span>' +
        '</button>' +
      '</div>';
  }

  function renderRoster() {
    const statuses = RF.rosterStatus(entryRoster, entryExistingRecords);
    $('roster').innerHTML = statuses.length
      ? statuses.map(rosterRowHtml).join('')
      : '<p class="gi-note">이 반에 등록된 학생이 없습니다. 학생 관리 탭에서 등록해 주세요.</p>';
  }

  function loadRoster() {
    const classId = $('classSelect').value;
    const date = $('dateInput').value;
    if (!classId || !date) return;

    showError($('entryError'), '');
    $('roster').innerHTML = '<p class="gi-state">불러오는 중…</p>';

    api.call('admin.roster', { sessionKey: sessionKey, classId: classId, date: date })
      .then(function (data) {
        entryRoster = data.students || [];
        entryExistingRecords = data.existingRecords || [];
        renderRoster();
      })
      .catch(function (err) {
        if (!handleAuthLoss(err)) showError($('entryError'), err.message);
        $('roster').innerHTML = '';
      });
  }

  function upsertExistingRecord(rec) {
    const idx = entryExistingRecords.findIndex(function (r) { return r.studentId === rec.studentId; });
    if (idx >= 0) entryExistingRecords[idx] = rec;
    else entryExistingRecords.push(rec);
  }

  $('roster').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-student]');
    if (!btn) return;
    const id = btn.dataset.student;
    const student = entryRoster.filter(function (s) { return s.studentId === id; })[0];
    if (!student) return;
    openRecord(student, $('classSelect').value, $('dateInput').value, 'entry');
  });

  $('classSelect').addEventListener('change', loadRoster);
  $('dateInput').addEventListener('change', loadRoster);

  /* ---------- 기록 입력 화면 ---------- */

  function recordDraftKey(classId, date, studentId) {
    return DRAFT_PREFIX + classId + '.' + date + '.' + studentId;
  }

  function saveRecordDraft() {
    if (!currentStudent) return;
    try {
      localStorage.setItem(
        recordDraftKey(currentClassId, currentDate, currentStudent.studentId),
        JSON.stringify(recordForm)
      );
    } catch (e) { /* 저장 공간이 없으면 조용히 넘어간다 */ }
  }

  function loadRecordDraft(classId, date, studentId) {
    try {
      const raw = localStorage.getItem(recordDraftKey(classId, date, studentId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearRecordDraft(classId, date, studentId) {
    try { localStorage.removeItem(recordDraftKey(classId, date, studentId)); } catch (e) { /* noop */ }
  }

  function renderChoiceGroup(containerId, values, field) {
    $(containerId).innerHTML = values.map(function (v) {
      const on = recordForm[field] === v;
      return '<button type="button" class="gi-choice" data-field="' + field + '" data-value="' + esc(v) +
        '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(v) + '</button>';
    }).join('');
  }

  function fillRecordView() {
    $('recordWho').textContent = currentStudent.name + (currentStudent.grade ? ' · ' + currentStudent.grade : '');
    $('recordDate').textContent = currentDate + ' 기록';
    $('recProgress').value = recordForm.progress;
    $('recTestName').value = recordForm.testName;
    $('recTestScore').value = recordForm.testScore;
    $('recTestMax').value = recordForm.testMax;
    $('recNextHomework').value = recordForm.nextHomework;
    $('recComment').value = recordForm.comment;
    renderChoiceGroup('recAttendance', ATTENDANCE, 'attendance');
    renderChoiceGroup('recHomeworkStatus', HOMEWORK, 'homeworkStatus');
    renderChoiceGroup('recHomeworkLevel', LEVELS, 'homeworkLevel');
    showError($('recordError'), '');
    $('recordStatus').textContent = '';
  }

  function showRecordView() {
    $('entryView').hidden = true;
    $('studentsView').hidden = true;
    $('recordView').hidden = false;
  }

  function goBack() {
    $('recordView').hidden = true;
    currentStudent = null;
    if (recordOrigin === 'students') {
      $('studentsView').hidden = false;
      $('tabStudents').setAttribute('aria-pressed', 'true');
      $('tabEntry').setAttribute('aria-pressed', 'false');
    } else {
      $('entryView').hidden = false;
      $('tabEntry').setAttribute('aria-pressed', 'true');
      $('tabStudents').setAttribute('aria-pressed', 'false');
    }
  }

  // records: 학생 관리 탭처럼 수업 탭에서 로드해 둔 것과 다른 반/날짜 조합을
  // 열 때 넘겨준다. 생략하면 수업 탭이 이미 들고 있는 값을 쓴다.
  function openRecord(student, classId, date, origin, records) {
    currentStudent = student;
    currentClassId = classId;
    currentDate = date;
    recordOrigin = origin;

    // records를 넘겼으면 그것만 본다. 빈 배열도 유효한 답(기록 없음)이므로
    // 수업 탭이 들고 있는 다른 반/날짜 기록으로 넘어가면 안 된다.
    const lookupRecords = records === undefined ? entryExistingRecords : (records || []);
    const rec = RF.findRecordFor(lookupRecords, student.studentId);
    let values = RF.toFormValues(rec);

    const saved = loadRecordDraft(classId, date, student.studentId);
    if (saved) values = Object.assign({}, values, saved);

    recordForm = values;
    fillRecordView();
    showRecordView();
  }

  function openRecordForStudent(student) {
    if (!student.classId) return false;
    const date = todayIso();
    return api.call('admin.roster', { sessionKey: sessionKey, classId: student.classId, date: date })
      .then(function (data) {
        openRecord(student, student.classId, date, 'students', data.existingRecords);
      });
  }

  $('recordView').addEventListener('click', function (e) {
    const btn = e.target.closest('.gi-choice');
    if (!btn) return;

    const field = btn.dataset.field;
    const value = btn.dataset.value;
    const wasOn = btn.getAttribute('aria-pressed') === 'true';
    const group = btn.parentElement;

    group.querySelectorAll('.gi-choice').forEach(function (b) {
      b.setAttribute('aria-pressed', 'false');
    });
    if (!wasOn) btn.setAttribute('aria-pressed', 'true');

    recordForm[field] = wasOn ? '' : value;
    saveRecordDraft();
  });

  $('recordView').addEventListener('input', function (e) {
    const field = e.target.dataset && e.target.dataset.field;
    if (!field) return;
    recordForm[field] = e.target.value;
    saveRecordDraft();
  });

  function saveRecord() {
    if (!currentStudent) return;

    // 응답은 1초쯤 뒤에 온다. 그 사이에 선생님이 돌아가서 다른 학생을 열 수 있다.
    // 콜백 안에서 currentXxx를 읽으면 그때는 이미 다른 학생을 가리키므로,
    // 남의 초안을 지우고 남의 화면에 "저장했습니다"를 띄우게 된다.
    // 보낼 대상을 여기서 붙잡아 둔다.
    const st = currentStudent;
    const cid = currentClassId;
    const dt = currentDate;
    const stillOpen = function () { return currentStudent === st; };

    $('recordSaveBtn').disabled = true;
    $('recordBack').disabled = true;
    $('recordStatus').textContent = '저장 중…';
    showError($('recordError'), '');

    const record = RF.buildRecord(st.studentId, dt, recordForm);

    api.call('admin.saveBatch', {
      sessionKey: sessionKey,
      classId: cid,
      date: dt,
      clientRequestId: 'b' + Date.now() + Math.random().toString(36).slice(2, 8),
      records: [record],
    }).then(function () {
      clearRecordDraft(cid, dt, st.studentId);
      if (stillOpen()) $('recordStatus').textContent = '저장했습니다.';
      if (cid === $('classSelect').value && dt === $('dateInput').value) {
        upsertExistingRecord(record);
        renderRoster();
      }
    }).catch(function (err) {
      if (stillOpen()) $('recordStatus').textContent = '';
      if (!handleAuthLoss(err) && stillOpen()) {
        showError($('recordError'), err.message + ' 입력하신 내용은 이 기기에 보관되어 있습니다.');
      }
    }).finally(function () {
      $('recordSaveBtn').disabled = false;
      $('recordBack').disabled = false;
    });
  }

  $('recordBack').addEventListener('click', goBack);
  $('recordSaveBtn').addEventListener('click', saveRecord);

  /* ---------- 로그인 폼 ---------- */

  $('loginBtn').addEventListener('click', login);
  $('password').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') login();
  });

  /* ---------- 탭 ---------- */

  $('tabEntry').addEventListener('click', function () {
    $('tabEntry').setAttribute('aria-pressed', 'true');
    $('tabStudents').setAttribute('aria-pressed', 'false');
    $('entryView').hidden = false;
    $('studentsView').hidden = true;
    $('recordView').hidden = true;
  });

  $('tabStudents').addEventListener('click', function () {
    $('tabStudents').setAttribute('aria-pressed', 'true');
    $('tabEntry').setAttribute('aria-pressed', 'false');
    $('studentsView').hidden = false;
    $('entryView').hidden = true;
    $('recordView').hidden = true;
    if (window.renderStudentsView) window.renderStudentsView();
  });

  // 다른 모듈이 쓸 수 있게 최소한만 노출한다
  window.GI_ADMIN = {
    api: api,
    esc: esc,
    getSessionKey: function () { return sessionKey; },
    handleAuthLoss: handleAuthLoss,
    openRecordForStudent: openRecordForStudent,
  };

  if (sessionKey) showApp();
})();
