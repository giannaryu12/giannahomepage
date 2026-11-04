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
  const PA = window.GI_PROGRESS_AREAS;
  const CL = window.GI_CLASS_LEVEL;
  const EI = window.GI_EXAM_ITEMS;
  const AREAS = PA.PROGRESS_AREAS;
  const TEST_AREAS = PA.TEST_AREAS;

  // 값을 채워 넣어야 하는, JS가 그리는 입력칸 묶음
  const FIELD_CONTAINERS = ['recAreas', 'recTests', 'recNext'];
  const SESSION_STORE = 'gi.session';
  // 세션키는 탭을 닫으면 사라진다. 날을 넘겨 기억하는 건 이 열쇠다.
  const REMEMBER_STORE = 'gi.remember';
  const DRAFT_PREFIX = 'gi.draft.';

  const ATTENDANCE = ['출석', '지각', '결석', '변경', '보강'];
  const HOMEWORK = ['제출', '부분제출', '미제출', '해당없음'];
  const LEVELS = ['상', '중', '하'];

  let sessionKey = sessionStorage.getItem(SESSION_STORE) || '';

  // 기록 입력 화면 상태
  let currentStudent = null;
  // 'regular' 정규수업 · 'exam' 시험대비. 같은 날에 둘이 따로 쌓인다.
  let currentKind = 'regular';
  // 그 날짜에 이미 있는 기록들. 탭을 옮길 때 서버에 다시 묻지 않으려고 쥐고 있다.
  let openRecords = [];
  let currentClassId = '';
  let currentDate = '';
  let recordOrigin = 'schedule'; // 'schedule' | 'students' — 돌아가기 목적지
  let recordForm = {};

  const $ = function (id) { return document.getElementById(id); };

  // 화면에 띄우는 판 번호. 브라우저가 옛 페이지를 들고 있으면 눌러도
  // 아무 일이 없는데, 고장과 구별이 안 된다. 번호가 보이면 한눈에 갈린다.
  // 화면을 고칠 때마다 index.html의 ?v= 와 함께 올린다.
  const BUILD = 'v20261105u';

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
    $('headSub').textContent = '선생님 전용 · 로그인됨 · ' + BUILD;
    $('logoutBtn').hidden = false;
    if (window.renderScheduleView) window.renderScheduleView();
  }

  function login() {
    const pw = $('password').value;
    if (!pw) return showError($('loginError'), '비밀번호를 입력해 주세요.');

    $('loginBtn').disabled = true;
    showError($('loginError'), '');
    $('loginStatus').textContent = '로그인 중…';

    // 그날 첫 요청은 GAS가 실행 환경을 다시 띄우느라 수십 초가 걸린다.
    // 아무 말도 없이 멈춰 있으면 고장으로 읽히고 버튼을 거듭 누르게 된다.
    const slowTimer = setTimeout(function () {
      $('loginStatus').textContent = '서버를 깨우는 중입니다. 처음 열 때는 시간이 걸립니다…';
    }, 4000);

    api.call('admin.login', { password: pw }).then(function (data) {
      sessionKey = data.sessionKey;
      sessionStorage.setItem(SESSION_STORE, sessionKey);
      // 이 기기에서는 당분간 비밀번호를 묻지 않는다.
      setRemember(data.rememberToken || '');
      $('password').value = '';
      showApp();
    }).catch(function (err) {
      showError($('loginError'), err.message);
    }).finally(function () {
      clearTimeout(slowTimer);
      $('loginStatus').textContent = '';
      $('loginBtn').disabled = false;
    });
  }

  /* ---------- 로그인 상태 유지 ---------- */

  function storedRemember() {
    try {
      return localStorage.getItem(REMEMBER_STORE) || '';
    } catch (e) {
      return '';
    }
  }

  function setRemember(token) {
    try {
      if (token) localStorage.setItem(REMEMBER_STORE, token);
      else localStorage.removeItem(REMEMBER_STORE);
    } catch (e) {
      // 저장 공간이 없으면 다음에 비밀번호를 다시 물을 뿐이다.
    }
  }

  function showLoginView(message) {
    $('logoutBtn').hidden = true;
    $('appView').hidden = true;
    $('loginView').hidden = false;
    showError($('loginError'), message || '');
  }

  /**
   * 저장해 둔 열쇠로 비밀번호 없이 세션을 다시 받는다.
   *
   * 실패하면 열쇠를 버리고 조용히 비밀번호 화면에 둔다. 기간이 지났거나
   * 선생님이 비밀번호를 바꾼 경우라, 알릴 만한 사고가 아니다.
   */
  function resumeSession() {
    const token = storedRemember();
    if (!token) return Promise.resolve(false);

    $('loginStatus').textContent = '로그인 중…';
    return api.call('admin.resume', { rememberToken: token })
      .then(function (data) {
        sessionKey = data.sessionKey;
        sessionStorage.setItem(SESSION_STORE, sessionKey);
        showApp();
        return true;
      })
      .catch(function () {
        setRemember('');
        return false;
      })
      .finally(function () {
        $('loginStatus').textContent = '';
      });
  }

  function logout() {
    const token = storedRemember();
    const key = sessionKey;

    // 화면은 먼저 정리한다. 서버 응답을 기다리느라 로그인된 채로 남으면
    // 자리를 비우는 선생님이 나간 줄 알고 그냥 간다.
    setRemember('');
    sessionKey = '';
    sessionStorage.removeItem(SESSION_STORE);
    showLoginView('');

    if (key) {
      api.call('admin.logout', { sessionKey: key, rememberToken: token })
        .catch(function () { /* 끊겼어도 이 기기에서는 이미 나갔다 */ });
    }
  }

  function handleAuthLoss(err) {
    if (err.code !== 'UNAUTHORIZED') return false;

    sessionKey = '';
    sessionStorage.removeItem(SESSION_STORE);
    showLoginView(err.message);

    // 세션은 6시간이라 수업 중에도 끊긴다. 열쇠가 있으면 말없이 다시 받는다.
    // 하던 작업은 이미 실패했지만, 입력한 내용은 이 기기에 남아 있다.
    resumeSession();
    return true;
  }

  /* ---------- 기록 입력 화면 ---------- */

  // 갈래까지 키에 넣는다. 같은 날 정규수업과 시험대비를 번갈아 적을 때
  // 키가 같으면 한쪽 초안이 다른 쪽을 덮어쓴다.
  function recordDraftKey(classId, date, studentId, kind) {
    return DRAFT_PREFIX + classId + '.' + date + '.' + studentId +
      (kind === 'exam' ? '.exam' : '');
  }

  function saveRecordDraft() {
    if (!currentStudent) return;
    try {
      localStorage.setItem(
        recordDraftKey(currentClassId, currentDate, currentStudent.studentId, currentKind),
        JSON.stringify(recordForm)
      );
    } catch (e) { /* 저장 공간이 없으면 조용히 넘어간다 */ }
  }

  function loadRecordDraft(classId, date, studentId, kind) {
    try {
      const raw = localStorage.getItem(recordDraftKey(classId, date, studentId, kind));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearRecordDraft(classId, date, studentId, kind) {
    try { localStorage.removeItem(recordDraftKey(classId, date, studentId, kind)); } catch (e) { /* noop */ }
  }

  function renderChoiceGroup(containerId, values, field) {
    $(containerId).innerHTML = values.map(function (v) {
      const on = recordForm[field] === v;
      return '<button type="button" class="gi-choice" data-field="' + field + '" data-value="' + esc(v) +
        '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(v) + '</button>';
    }).join('');
  }

  function textInput(field, placeholder, label) {
    return '<input class="gi-input" type="text" data-field="' + field +
      '" placeholder="' + placeholder + '" aria-label="' + esc(label) + '">';
  }

  function numberInput(field, placeholder, label) {
    return '<input class="gi-input" type="number" inputmode="numeric" data-field="' + field +
      '" placeholder="' + placeholder + '" aria-label="' + esc(label) + '">';
  }

  /** 영역별 입력칸을 그린다. 값은 fillFieldValues가 채운다. */
  function renderFieldGroups() {
    $('recAreas').innerHTML = AREAS.map(function (a) {
      return '<div class="gi-area">' +
        '<span class="gi-area-label">' + esc(a.label) + '</span>' +
        textInput(a.key + 'Book', '교재', a.label + ' 교재') +
        textInput(a.key + 'Progress', '진도', a.label + ' 진도') +
        '</div>';
    }).join('');

    $('recTests').innerHTML = TEST_AREAS.map(function (a) {
      return '<div class="gi-area is-test">' +
        '<span class="gi-area-label">' + esc(a.label) + '</span>' +
        textInput(a.key + 'TestBook', '교재', a.label + ' 시험 교재') +
        numberInput(a.key + 'TestScore', '점수', a.label + ' 시험 점수') +
        numberInput(a.key + 'TestMax', '만점', a.label + ' 시험 만점') +
        '</div>';
    }).join('');

    $('recNext').innerHTML = AREAS.map(function (a) {
      return '<div class="gi-area">' +
        '<span class="gi-area-label">' + esc(a.label) + '</span>' +
        textInput(a.key + 'NextBook', '교재', a.label + ' 숙제 교재') +
        textInput(a.key + 'Next', '숙제', a.label + ' 숙제') +
        '</div>';
    }).join('');
  }

  /* ---------- 시험대비 칸 ---------- */

  /**
   * 칸 한 줄 — 내용 · 지우기.
   *
   * 적는 칸은 하나다. 이름·교재로 셋으로 나누면 '모의고사 3회분 1~20번'을
   * 어디에 적을지부터 망설이게 된다.
   *
   * 줄마다 자리 번호를 붙인다. 지울 때 그 번호로 빼므로, 같은 내용의 칸이
   * 둘 있어도 누른 줄만 사라진다.
   */
  /** 시험 칸에만 붙는 통과 여부 세 단추. */
  function examResultHtml(list, at, row) {
    const cur = (row && row.result) || '';

    return '<div class="gi-choices gi-exam-res">' +
      EI.EXAM_RESULTS.map(function (v) {
        return '<button class="gi-choice" type="button"' +
          ' data-exam-res="' + list + '" data-at="' + at + '" data-value="' + esc(v) + '"' +
          ' aria-pressed="' + (v === cur ? 'true' : 'false') + '">' + esc(v) + '</button>';
      }).join('') +
    '</div>';
  }

  function examRowHtml(list, at, row) {
    const cell = function (key, placeholder) {
      return '<input class="gi-input" type="text"' +
        ' data-exam="' + list + '" data-at="' + at + '" data-key="' + key + '"' +
        ' placeholder="' + placeholder + '" aria-label="' + placeholder + '">';
    };

    return '<div class="gi-area gi-exam-row' + (list === 'examTests' ? ' is-exam-test' : '') + '">' +
      cell('text', '내용') +
      (list === 'examTests' ? examResultHtml(list, at, row) : '') +
      '<button class="gi-choice gi-exam-del" type="button"' +
      ' data-exam-del="' + list + '" data-at="' + at + '"' +
      ' aria-label="이 칸 지우기">✕</button>' +
    '</div>';
  }

  function renderExamList(list) {
    const rows = recordForm[list] || [];

    $(list).innerHTML = rows.length
      ? rows.map(function (row, at) { return examRowHtml(list, at, row); }).join('')
      : '<p class="gi-note">아직 칸이 없습니다. 아래 + 칸 추가를 눌러 주세요.</p>';

    // 값은 속성이 아니라 프로퍼티로 넣는다. 따옴표가 든 교재명이 마크업을
    // 깨뜨리지 않는다 (영역 입력칸과 같은 이유).
    $(list).querySelectorAll('[data-exam]').forEach(function (el) {
      const row = rows[Number(el.dataset.at)] || {};
      el.value = row[el.dataset.key] || '';
    });
  }

  function renderExamFields() {
    renderExamList('examTests');
    renderExamList('examItems');
    renderExamList('examNext');
  }

  function fillFieldValues() {
    // value는 속성 문자열이 아니라 프로퍼티로 넣는다. 따옴표가 든 교재명이
    // 마크업을 깨뜨리지 않는다.
    FIELD_CONTAINERS.forEach(function (id) {
      $(id).querySelectorAll('[data-field]').forEach(function (el) {
        el.value = recordForm[el.dataset.field] || '';
      });
    });
  }

  /**
   * 영역 구분이 생기기 전에 쌓인 값. 입력칸은 없지만 저장할 때 그대로 다시
   * 실려 나가므로, 무엇이 남아 있는지 보여만 준다.
   */
  function showLegacy(elId, prefix, text) {
    $(elId).hidden = !text;
    $(elId).textContent = text ? prefix + text : '';
  }

  function legacyTestText() {
    const score = recordForm.testScore;
    const max = recordForm.testMax;
    const name = recordForm.testName;
    if (!name && score === '' && max === '') return '';

    const scoreText = (score !== '' && max !== '') ? score + '/' + max : '';
    return [name, scoreText].filter(Boolean).join(' ');
  }

  function syncKindTabs() {
    $('recKindTabs').querySelectorAll('[data-kind]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.kind === currentKind));
    });
    $('regularFields').hidden = currentKind !== 'regular';
    $('examFields').hidden = currentKind !== 'exam';
  }

  function fillRecordView() {
    $('recordWho').textContent = currentStudent.name + (currentStudent.grade ? ' · ' + currentStudent.grade : '');
    $('recordDateInput').value = currentDate;
    syncKindTabs();
    renderExamFields();
    renderFieldGroups();
    fillFieldValues();

    showLegacy('recLegacyProgress', '이전 진도 기록: ', recordForm.progress);
    showLegacy('recLegacyTest', '이전 시험 기록: ', legacyTestText());
    showLegacy('recLegacyNext', '이전 숙제 기록: ', recordForm.nextHomework);

    $('recSessionNo').value = recordForm.sessionNo;
    $('recComment').value = recordForm.comment;
    renderChoiceGroup('recAttendance', ATTENDANCE, 'attendance');
    syncSessionNo();
    renderChoiceGroup('recHomeworkStatus', HOMEWORK, 'homeworkStatus');
    renderChoiceGroup('recHomeworkLevel', LEVELS, 'homeworkLevel');
    showError($('recordError'), '');
    $('recordStatus').textContent = '';
  }

  // 탭 이름 → [탭 버튼, 화면].
  const TABS = {
    schedule: ['tabSchedule', 'scheduleView'],
    students: ['tabStudents', 'studentsView'],
  };

  function showTab(name) {
    Object.keys(TABS).forEach(function (key) {
      const pair = TABS[key];
      $(pair[0]).setAttribute('aria-pressed', key === name ? 'true' : 'false');
      $(pair[1]).hidden = key !== name;
    });
    $('recordView').hidden = true;
  }

  /**
   * 기록 화면을 연다.
   *
   * 어느 탭에서 들어왔든 눌린 탭은 '학생 관리'다. 기록을 적는 일은
   * 그 학생을 다루는 일이고, 달력에서 들어왔다고 '수업 일정'이 눌린
   * 채로 두면 탭은 달력을 가리키는데 화면은 기록 칸이다 — 눌린 탭이
   * 지금 보는 화면을 가리키지 않으면 탭을 믿지 못하게 된다.
   *
   * 돌아가기는 들어온 곳으로 되돌린다. 달력에서 들어왔으면 달력이다.
   */
  function showRecordView() {
    Object.keys(TABS).forEach(function (key) {
      $(TABS[key][0]).setAttribute('aria-pressed', key === 'students' ? 'true' : 'false');
      $(TABS[key][1]).hidden = true;
    });
    $('recordView').hidden = false;
  }

  function goBack() {
    currentStudent = null;
    showTab(TABS[recordOrigin] ? recordOrigin : 'schedule');
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
    openRecords = records || [];
    loadKind();
  }

  /**
   * 열어 둔 날짜의 기록 중 지금 갈래의 것을 화면에 올린다.
   *
   * 탭을 옮길 때도 이 함수만 다시 부른다 — 그 날짜 기록은 이미 손에
   * 있으므로 서버에 다시 묻지 않는다.
   */
  function loadKind() {
    const student = currentStudent;
    const rec = RF.findRecordFor(openRecords, student.studentId, currentKind);
    let values = RF.toFormValues(rec);
    values.kind = currentKind;

    const saved = loadRecordDraft(currentClassId, currentDate, student.studentId, currentKind);
    if (saved) values = Object.assign({}, values, saved);

    // 자동 채움은 초안을 얹은 뒤에 한다. 먼저 채우면, 교재가 빈 채로 저장된
    // 초안이 그 위를 덮어써서 칸이 계속 비어 있게 된다. 두 함수 모두 비어
    // 있는 칸만 채우므로 순서를 뒤로 미뤄도 적어 둔 값은 그대로다.
    //
    // 그날 기록이 아직 없을 때만 채운다. 지난 기록을 고치러 열었을 때
    // 채우면 그때 쓰지 않던 최신 교재가 옛 기록에 들어앉는다.
    if (!rec) {
      // 교재는 정규수업만 물려받는다. 시험대비에는 영역 교재 칸이 없다.
      if (currentKind === 'regular') {
        values = RF.withBookDefaults(values, student.lastBooks);
      }
      values = RF.withSessionDefault(values, student.lastSessionNo);
    }

    // 시험대비는 칸 개수만 지난번 구성에서 물려받는다. 적어 둔 것도
    // 초안도 없을 때만이다 — 있으면 그것이 선생님이 만든 구성이다.
    if (!rec && !saved && currentKind === 'exam') {
      const last = (student.lastExam || {});
      values.examTests = (last.tests || []).slice();
      values.examItems = (last.items || []).slice();
      values.examNext = (last.next || []).slice();
    }

    recordForm = values;
    fillRecordView();
    showRecordView();
  }

  // date·origin을 생략하면 오늘, 학생 관리 탭에서 연 것으로 본다.
  // 수업 일정 탭은 시간표에서 누른 칸의 날짜를 그대로 넘긴다.
  function openRecordForStudent(student, date, origin) {
    if (!student.classId) return false;
    date = date || todayIso();
    origin = origin || 'students';
    return api.call('admin.roster', { sessionKey: sessionKey, classId: student.classId, date: date })
      .then(function (data) {
        // 학생 관리 탭의 학생 객체에는 직전 교재가 없다. 명단 응답에서 가져온다.
        const inRoster = (data.students || []).filter(function (s) {
          return s.studentId === student.studentId;
        })[0];
        const withLast = Object.assign({}, student, {
          lastBooks: inRoster && inRoster.lastBooks,
          lastSessionNo: inRoster && inRoster.lastSessionNo,
          // 시험대비 칸 구성(이름만). 그 학생의 지난 시험대비 기록에서 왔다.
          lastExam: inRoster && inRoster.lastExam,
        });

        openRecord(withLast, student.classId, date, origin, data.existingRecords);
      });
  }

  // 기록 화면에서 날짜를 바꾸면 그 날짜의 기록을 다시 불러온다.
  // 입력 중이던 내용은 (반·날짜·학생) 단위로 임시저장돼 있으므로 사라지지 않고,
  // 원래 날짜로 되돌리면 그대로 다시 나타난다.
  let dateReqSeq = 0;

  function changeRecordDate() {
    if (!currentStudent) return;

    const newDate = $('recordDateInput').value;
    if (!newDate || newDate === currentDate) return;

    const st = currentStudent;
    const cid = currentClassId;
    const seq = ++dateReqSeq;

    // 불러오는 중에 저장하면 어느 날짜에 쓰는 것인지 모호해진다.
    $('recordSaveBtn').disabled = true;
    $('recordStatus').textContent = '불러오는 중…';
    showError($('recordError'), '');

    api.call('admin.roster', { sessionKey: sessionKey, classId: cid, date: newDate })
      .then(function (data) {
        // 그 사이 날짜를 또 바꿨거나 다른 학생을 열었으면 이 응답은 버린다.
        if (seq !== dateReqSeq || currentStudent !== st) return;

        // 직전 교재·회차는 방금 받은 응답 것으로 갈아 끼운다. 손에 든 st는
        // 명단을 불러오던 때의 값이라, 그 사이 저장한 교재를 모른다.
        const fresh = (data.students || []).filter(function (s) {
          return s.studentId === st.studentId;
        })[0];
        const withLast = fresh
          ? Object.assign({}, st, { lastBooks: fresh.lastBooks, lastSessionNo: fresh.lastSessionNo })
          : st;

        openRecord(withLast, cid, newDate, recordOrigin, data.existingRecords);
      })
      .catch(function (err) {
        if (seq !== dateReqSeq || currentStudent !== st) return;
        $('recordStatus').textContent = '';
        if (!handleAuthLoss(err)) {
          showError($('recordError'), err.message);
          // 못 불러왔으면 화면은 아직 원래 날짜의 기록이다. 칸도 되돌려 놓는다.
          $('recordDateInput').value = currentDate;
        }
      })
      .finally(function () {
        if (seq === dateReqSeq) $('recordSaveBtn').disabled = false;
      });
  }

  $('recordDateInput').addEventListener('change', changeRecordDate);

  $('recordView').addEventListener('click', function (e) {
    const btn = e.target.closest('.gi-choice');
    if (!btn) return;

    const field = btn.dataset.field;
    // 출결·과제처럼 값을 고르는 단추만 여기서 다룬다. 갈래 탭과 칸
    // 더하기·지우기도 같은 .gi-choice인데, 걸러 내지 않으면 그 단추를
    // 누를 때마다 recordForm[undefined]에 값이 적히고 눌러 둔 탭이 꺼진다.
    if (!field) return;

    const value = btn.dataset.value;
    const wasOn = btn.getAttribute('aria-pressed') === 'true';
    const group = btn.parentElement;

    group.querySelectorAll('.gi-choice').forEach(function (b) {
      b.setAttribute('aria-pressed', 'false');
    });
    if (!wasOn) btn.setAttribute('aria-pressed', 'true');

    recordForm[field] = wasOn ? '' : value;
    if (field === 'attendance') syncSessionNo(true);
    saveRecordDraft();
  });

  /**
   * 결석을 고르면 회차 칸을 비우고 잠근다.
   *
   * 결석한 날은 회차를 세지 않는다 — 수업을 안 했으니 다음에 오는 날이 그
   * 회차다. 서버도 같은 규칙으로 비우지만, 화면에 숫자가 남아 있으면
   * 저장한 뒤에야 사라진 것을 보게 된다.
   *
   * restore는 선생님이 출결을 눌렀을 때만 참이다. 결석을 눌렀다 무르면
   * 비워 둔 회차를 도로 채워 준다 — 잘못 눌렀다고 숫자를 다시 적게 할
   * 일은 아니다. 화면을 처음 그릴 때는 채우지 않는다. 회차를 비워 둔 채
   * 저장해 둔 기록을 열었을 뿐인데 숫자가 생기면 안 된다.
   */
  function syncSessionNo(restore) {
    const box = $('recSessionNo');
    // 변경도 그날은 수업을 안 한 것이다. 옮긴 날에 가서 회차를 센다.
    const absent = recordForm.attendance === '결석' || recordForm.attendance === '변경';

    box.disabled = absent;
    box.placeholder = absent ? recordForm.attendance + ' — 회차를 세지 않습니다' : '예: 12';

    if (absent) {
      recordForm.sessionNo = '';
      box.value = '';
      return;
    }

    if (!restore || recordForm.sessionNo || !currentStudent) return;

    const filled = RF.withSessionDefault(recordForm, currentStudent.lastSessionNo);
    recordForm.sessionNo = filled.sessionNo;
    box.value = filled.sessionNo;
  }

  $('recordView').addEventListener('input', function (e) {
    const data = e.target.dataset || {};

    if (data.exam) {
      const rows = recordForm[data.exam] || [];
      const row = rows[Number(data.at)];
      if (!row) return;

      row[data.key] = e.target.value;
      saveRecordDraft();
      return;
    }

    if (!data.field) return;
    recordForm[data.field] = e.target.value;
    saveRecordDraft();
  });

  /* ---------- 갈래 탭과 칸 더하기·지우기 ---------- */

  $('recKindTabs').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-kind]');
    if (!btn || !currentStudent) return;

    const want = btn.dataset.kind;
    if (want === currentKind) return;

    // 옮기기 전에 지금 적던 것을 초안으로 남긴다. 돌아오면 그대로 있다.
    saveRecordDraft();
    currentKind = want;
    loadKind();
    $('recordStatus').textContent = '';
  });

  $('examFields').addEventListener('click', function (e) {
    const add = e.target.closest('[data-exam-add]');
    if (add) {
      const list = add.dataset.examAdd;
      recordForm[list] = (recordForm[list] || []).concat([{ text: '', result: '' }]);
      saveRecordDraft();
      renderExamList(list);

      // 새로 만든 줄로 바로 커서를 옮긴다. 더하고 나서 다시 눌러야 적을 수
      // 있으면 칸을 여러 개 만들 때마다 손이 두 번 간다.
      const rows = $(list).querySelectorAll('[data-key="text"]');
      if (rows.length) rows[rows.length - 1].focus();
      return;
    }

    const res = e.target.closest('[data-exam-res]');
    if (res) {
      const list = res.dataset.examRes;
      const row = (recordForm[list] || [])[Number(res.dataset.at)];
      if (!row) return;

      // 누른 것을 다시 누르면 무른다. 잘못 눌렀을 때 되돌릴 길이 없으면
      // 칸을 지웠다 다시 만들어야 한다.
      row.result = row.result === res.dataset.value ? '' : res.dataset.value;
      saveRecordDraft();
      renderExamList(list);
      return;
    }

    const del = e.target.closest('[data-exam-del]');
    if (!del) return;

    const list = del.dataset.examDel;
    const at = Number(del.dataset.at);
    recordForm[list] = (recordForm[list] || []).filter(function (row, i) { return i !== at; });
    saveRecordDraft();
    renderExamList(list);
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
    const kd = currentKind;
    // 날짜만 바꿔도 화면은 다른 기록이 된다. 학생과 날짜가 모두 그대로일 때만
    // 이 저장의 결과를 화면에 반영한다.
    const stillOpen = function () { return currentStudent === st && currentDate === dt; };

    $('recordSaveBtn').disabled = true;
    $('recordBack').disabled = true;
    $('recordDateInput').disabled = true;
    $('recordStatus').textContent = '저장 중…';
    showError($('recordError'), '');

    // GAS는 한동안 요청이 없으면 실행 환경을 내렸다가 다시 띄운다. 그 첫
    // 요청이 수십 초 걸릴 수 있다. 멈춘 줄 알고 버튼을 거듭 누르지 않도록
    // 몇 초 뒤에 무슨 일이 벌어지는지 알려 준다.
    const slowTimer = setTimeout(function () {
      if (stillOpen()) $('recordStatus').textContent = '서버를 깨우는 중입니다. 잠시만 기다려 주세요…';
    }, 4000);

    const record = RF.buildRecord(st.studentId, dt, recordForm);

    api.call('admin.saveBatch', {
      sessionKey: sessionKey,
      classId: cid,
      date: dt,
      clientRequestId: 'b' + Date.now() + Math.random().toString(36).slice(2, 8),
      records: [record],
    }).then(function () {
      clearRecordDraft(cid, dt, st.studentId, kd);
      if (stillOpen()) $('recordStatus').textContent = '저장했습니다.';
    }).catch(function (err) {
      if (stillOpen()) $('recordStatus').textContent = '';
      if (!handleAuthLoss(err) && stillOpen()) {
        // 시간 초과는 저장이 안 됐다는 뜻이 아니다. 브라우저가 기다리기를
        // 그만뒀을 뿐이고 서버는 계속 돌아 저장을 마쳤을 수 있다.
        const tail = err.code === 'TIMEOUT'
          ? ' 저장은 이미 되었을 수도 있으니 잠시 후 목록에서 확인해 주세요.'
          : '';
        showError($('recordError'),
          err.message + tail + ' 입력하신 내용은 이 기기에 보관되어 있습니다.');
      }
    }).finally(function () {
      clearTimeout(slowTimer);
      $('recordSaveBtn').disabled = false;
      $('recordBack').disabled = false;
      $('recordDateInput').disabled = false;
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

  $('tabSchedule').addEventListener('click', function () {
    showTab('schedule');
    if (window.renderScheduleView) window.renderScheduleView();
  });

  $('tabStudents').addEventListener('click', function () {
    showTab('students');
    if (window.renderStudentsView) window.renderStudentsView();
  });

  // 다른 모듈이 쓸 수 있게 최소한만 노출한다
  window.GI_ADMIN = {
    api: api,
    esc: esc,
    showError: showError,
    getSessionKey: function () { return sessionKey; },
    handleAuthLoss: handleAuthLoss,
    openRecordForStudent: openRecordForStudent,
  };

  /**
   * 화면이 뜨자마자 서버를 한 번 깨워 둔다.
   *
   * GAS는 한동안 요청이 없으면 실행 환경을 내리고, 다음 요청이 그것을 다시
   * 띄우느라 수십 초를 쓴다. 선생님이 비밀번호를 입력하는 동안 미리 깨워 두면
   * 그 값을 로그인이 아니라 여기서 치른다.
   *
   * 실패해도 무시한다. 이건 준비 운동이지 화면에 필요한 값이 아니다.
   */
  function prewarm() {
    api.call('ping', {}).catch(function () { /* 준비 운동일 뿐이다 */ });
  }

  $('logoutBtn').addEventListener('click', logout);

  prewarm();
  if (sessionKey) showApp();
  else resumeSession();
})();
