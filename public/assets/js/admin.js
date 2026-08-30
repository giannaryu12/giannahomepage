/**
 * 선생님 입력 화면.
 *
 * 입력 중인 내용은 localStorage에 계속 저장한다. 수업 직후 20명분을
 * 입력하다 네트워크 오류로 날리는 것이 이 앱에서 가장 나쁜 시나리오다.
 */
(function () {
  const api = createApi(window.GIANNA_CONFIG.GAS_URL);
  const SESSION_STORE = 'gi.session';
  const DRAFT_PREFIX = 'gi.draft.';

  const ATTENDANCE = ['출석', '지각', '결석', '보강'];
  const HOMEWORK = ['제출', '부분제출', '미제출', '해당없음'];
  const LEVELS = ['상', '중', '하'];

  let sessionKey = sessionStorage.getItem(SESSION_STORE) || '';
  let roster = [];
  let draft = {};

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

  /* ---------- 초안 저장 ---------- */

  function draftKey() {
    return DRAFT_PREFIX + $('classSelect').value + '.' + $('dateInput').value;
  }

  function saveDraft() {
    try {
      localStorage.setItem(draftKey(), JSON.stringify({
        progressAll: $('progressAll').value,
        nextAll: $('nextAll').value,
        rows: draft,
      }));
    } catch (e) { /* 저장 공간이 없으면 조용히 넘어간다 */ }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(draftKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearDraft() {
    try { localStorage.removeItem(draftKey()); } catch (e) { /* noop */ }
  }

  /* ---------- 명단 ---------- */

  function choiceGroup(studentId, field, values) {
    return '<div class="gi-choices" data-student="' + esc(studentId) + '" data-field="' + field + '">' +
      values.map(function (v) {
        const on = draft[studentId] && draft[studentId][field] === v;
        return '<button type="button" class="gi-choice" data-value="' + esc(v) + '" aria-pressed="' +
          (on ? 'true' : 'false') + '">' + esc(v) + '</button>';
      }).join('') + '</div>';
  }

  function studentHtml(s) {
    const d = draft[s.studentId] || {};
    return '' +
      '<article class="gi-rec" style="padding:.9rem">' +
        '<div class="gi-rec-date" style="margin-bottom:.6rem">' +
          esc(s.name) + ' <span class="gi-note">' + esc(s.grade || '') + '</span></div>' +

        '<div class="gi-field"><span class="gi-label">출결</span>' +
          choiceGroup(s.studentId, 'attendance', ATTENDANCE) + '</div>' +

        '<div class="gi-field"><span class="gi-label">과제</span>' +
          choiceGroup(s.studentId, 'homeworkStatus', HOMEWORK) + '</div>' +

        '<div class="gi-field"><span class="gi-label">완성도</span>' +
          choiceGroup(s.studentId, 'homeworkLevel', LEVELS) + '</div>' +

        '<div class="gi-field" style="display:flex;gap:.4rem">' +
          '<input class="gi-input" style="flex:2" type="text" placeholder="시험명" ' +
            'data-student="' + esc(s.studentId) + '" data-field="testName" value="' + esc(d.testName || '') + '">' +
          '<input class="gi-input" style="flex:1" type="number" inputmode="numeric" placeholder="점수" ' +
            'data-student="' + esc(s.studentId) + '" data-field="testScore" value="' + esc(d.testScore || '') + '">' +
          '<input class="gi-input" style="flex:1" type="number" inputmode="numeric" placeholder="만점" ' +
            'data-student="' + esc(s.studentId) + '" data-field="testMax" value="' + esc(d.testMax || '') + '">' +
        '</div>' +

        '<div class="gi-field" style="margin-bottom:0">' +
          '<textarea class="gi-textarea" placeholder="코멘트" ' +
            'data-student="' + esc(s.studentId) + '" data-field="comment">' + esc(d.comment || '') + '</textarea>' +
        '</div>' +
      '</article>';
  }

  function renderRoster() {
    $('roster').innerHTML = roster.length
      ? roster.map(studentHtml).join('')
      : '<p class="gi-note">이 반에 등록된 학생이 없습니다. 학생 관리 탭에서 등록해 주세요.</p>';
    $('saveBar').hidden = !roster.length;
  }

  function loadRoster() {
    const classId = $('classSelect').value;
    const date = $('dateInput').value;
    if (!classId || !date) return;

    showError($('entryError'), '');
    $('roster').innerHTML = '<p class="gi-state">불러오는 중…</p>';

    api.call('admin.roster', { sessionKey: sessionKey, classId: classId, date: date })
      .then(function (data) {
        roster = data.students;
        draft = {};

        // 서버에 이미 저장된 값을 먼저 채운다
        data.existingRecords.forEach(function (r) {
          draft[r.studentId] = {
            attendance: r.attendance, homeworkStatus: r.homeworkStatus,
            homeworkLevel: r.homeworkLevel, testName: r.testName,
            testScore: r.testScore === '' ? '' : String(r.testScore),
            testMax: r.testMax === '' ? '' : String(r.testMax),
            comment: r.comment,
          };
          if (r.progress) $('progressAll').value = r.progress;
          if (r.nextHomework) $('nextAll').value = r.nextHomework;
        });

        // 저장 못 하고 남은 초안이 있으면 그것으로 덮는다
        const saved = loadDraft();
        if (saved) {
          if (saved.progressAll) $('progressAll').value = saved.progressAll;
          if (saved.nextAll) $('nextAll').value = saved.nextAll;
          Object.keys(saved.rows || {}).forEach(function (id) {
            draft[id] = Object.assign({}, draft[id], saved.rows[id]);
          });
        }

        renderRoster();
      })
      .catch(function (err) {
        if (!handleAuthLoss(err)) showError($('entryError'), err.message);
        $('roster').innerHTML = '';
      });
  }

  /* ---------- 입력 이벤트 (위임) ---------- */

  $('roster').addEventListener('click', function (e) {
    const btn = e.target.closest('.gi-choice');
    if (!btn) return;

    const group = btn.parentElement;
    const id = group.dataset.student;
    const field = group.dataset.field;
    const value = btn.dataset.value;
    const wasOn = btn.getAttribute('aria-pressed') === 'true';

    group.querySelectorAll('.gi-choice').forEach(function (b) {
      b.setAttribute('aria-pressed', 'false');
    });
    if (!wasOn) btn.setAttribute('aria-pressed', 'true');

    draft[id] = draft[id] || {};
    draft[id][field] = wasOn ? '' : value;
    saveDraft();
  });

  $('roster').addEventListener('input', function (e) {
    const el = e.target;
    if (!el.dataset || !el.dataset.student) return;
    draft[el.dataset.student] = draft[el.dataset.student] || {};
    draft[el.dataset.student][el.dataset.field] = el.value;
    saveDraft();
  });

  $('progressAll').addEventListener('input', saveDraft);
  $('nextAll').addEventListener('input', saveDraft);
  $('classSelect').addEventListener('change', loadRoster);
  $('dateInput').addEventListener('change', loadRoster);

  /* ---------- 저장 ---------- */

  function buildRecords() {
    const date = $('dateInput').value;
    const progress = $('progressAll').value;
    const next = $('nextAll').value;

    return roster.map(function (s) {
      const d = draft[s.studentId] || {};
      return {
        studentId: s.studentId,
        date: date,
        progress: progress,
        nextHomework: next,
        attendance: d.attendance || '',
        homeworkStatus: d.homeworkStatus || '',
        homeworkLevel: d.homeworkLevel || '',
        testName: d.testName || '',
        testScore: d.testScore || '',
        testMax: d.testMax || '',
        comment: d.comment || '',
      };
    });
  }

  function save() {
    const records = buildRecords();
    if (!records.length) return;

    $('saveBtn').disabled = true;
    $('saveStatus').textContent = '저장 중…';
    showError($('entryError'), '');

    api.call('admin.saveBatch', {
      sessionKey: sessionKey,
      classId: $('classSelect').value,
      date: $('dateInput').value,
      clientRequestId: 'b' + Date.now() + Math.random().toString(36).slice(2, 8),
      records: records,
    }).then(function (data) {
      clearDraft();
      $('saveStatus').textContent = data.saved + '명 저장했습니다.';
    }).catch(function (err) {
      $('saveStatus').textContent = '';
      if (!handleAuthLoss(err)) {
        showError($('entryError'), err.message + ' 입력하신 내용은 이 기기에 보관되어 있습니다.');
      }
    }).finally(function () {
      $('saveBtn').disabled = false;
    });
  }

  $('saveBtn').addEventListener('click', save);
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
  });

  $('tabStudents').addEventListener('click', function () {
    $('tabStudents').setAttribute('aria-pressed', 'true');
    $('tabEntry').setAttribute('aria-pressed', 'false');
    $('studentsView').hidden = false;
    $('entryView').hidden = true;
    if (window.renderStudentsView) window.renderStudentsView();
  });

  // 다른 모듈이 쓸 수 있게 최소한만 노출한다
  window.GI_ADMIN = {
    api: api,
    esc: esc,
    getSessionKey: function () { return sessionKey; },
    handleAuthLoss: handleAuthLoss,
  };

  if (sessionKey) showApp();
})();
