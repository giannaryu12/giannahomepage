/**
 * 학생 관리 탭 — 등록 / 수정 / 링크 복사 / 링크 재발급 / 비활성화.
 *
 * 위 칸은 등록이 기본이다. 고치는 칸은 목록에서 그 학생의 '수정'을
 * 누를 때만 열린다.
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
  // 학원 방학 기간. 네임카드에 어느 시간표를 낼지, 고치는 칸이 어느
  // 쪽부터 열릴지를 이것으로 정한다.
  let vacation = { from: '', to: '' };
  // 고치는 칸이 보고 있는 요일표. 'term' 학기중 | 'vacation' 방학중
  let schedKind = 'term';
  // 위 칸이 등록 중인지 수정 중인지. 'new' | 'edit'
  let mode = 'new';
  // 수정 칸이 보고 있는 학생.
  let editId = '';
  // 수정 칸의 학교급 드롭박스. 학생을 먼저 이 안에서 좁혀 찾는다.
  let editLevel = '';

  /**
   * 학생 한 명의 학교급. 학년에서 먼저 읽고, 없으면 반 이름에서 읽는다.
   *
   * 학년은 등록할 때 드롭박스로 고르고 해마다 자동으로 올라간다. 반 이름은
   * 선생님이 옮겨 줘야 바뀐다 — 1월에 중1이 된 학생이 '초등부 A'에 그대로
   * 있으면, 반을 먼저 보는 쪽은 그 학생을 초등부 열에 둔다.
   *
   * 반만 보면 반을 아직 안 정한 학생이 모두 '그 외'로 몰리는 문제도 그대로다.
   */
  function levelOf(s) {
    return CL.classLevel(s && s.grade) || CL.classLevel(s && s.className) || '';
  }


  /** 학교급마다 있는 학년. 초등은 6학년까지, 중·고는 3학년까지다. */
  const GRADE_MAX = { elem: 6, mid: 3, high: 3 };

  /** 'elem' → '초'. 시트에는 '초5'처럼 짧게 적는다 (class-level.js의 규칙). */
  function markOf(key) {
    const level = CL.LEVELS.filter(function (l) { return l.key === key; })[0];
    return level ? level.mark : '';
  }

  function levelOptionsHtml(key) {
    return CL.LEVELS.map(function (l) {
      return '<option value="' + l.key + '"' + (l.key === key ? ' selected' : '') +
        '>' + l.label + '</option>';
    }).join('');
  }

  /**
   * 학년 보기. 그 학교급에 있는 학년만 넣는다 — 중2는 있지만 중5는 없다.
   * 학교급을 바꾸면 이 보기를 다시 만든다.
   *
   * 맨 앞은 빈 칸으로 둔다. 1학년이 먼저 골라져 있으면 학년을 안 고른
   * 학생이 1학년으로 저장된다.
   */
  function gradeOptionsHtml(key, num) {
    const max = GRADE_MAX[key] || 6;
    const out = ['<option value="">학년</option>'];
    for (let i = 1; i <= max; i++) {
      out.push('<option value="' + i + '"' +
        (String(i) === String(num) ? ' selected' : '') + '>' + i + '학년</option>');
    }
    return out.join('');
  }

  /** 두 드롭박스를 시트의 한 칸으로 합친다. '초' + '5' → '초5'. */
  function newGradeValue() {
    const key = document.getElementById('newLevel').value;
    const num = document.getElementById('newGrade').value;
    return markOf(key) + num;
  }

  function todayIso() {
    const d = new Date();
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getDate()).slice(-2);
  }

  /** 오늘이 방학인가. 고치는 칸을 어느 쪽부터 열지에 쓴다. */
  function onVacation() {
    return S.inVacation(todayIso(), vacation);
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
  /** 요일·시간 고르는 칸. 끝내는 단추는 위 네 칸 줄 끝에 있다. */
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


  /**
   * 학생 카드.
   *
   * editable이면 이름·학년·반과 요일·시간을 고칠 수 있다 (수정 탭).
   * 목록에서는 같은 값을 읽기만 한다 — 이름과 반은 카드 머리에 이미
   * 적혀 있고, 고치는 일은 수정 탭 한 곳에서 한다. 열 하나가 350px인데
   * 입력 칸까지 넣으면 어느 것도 제 너비를 못 가진다.
   */
  /** 학년 칸에서 숫자만. '초5' → '5'. 없으면 빈 값. */
  function gradeNum(s) {
    const hit = /\d+/.exec(String((s && s.grade) || ''));
    return hit ? hit[0] : '';
  }

  /**
   * 카드 머리 왼쪽 — 이름, 학교와 학년 숫자, 수업 시간.
   *
   * 이름만 제 크기로 읽힌다. 학교·시간은 한 단계씩 작고 흐리다 —
   * 찾을 때 눈이 좇는 것은 이름이고, 나머지는 찾고 나서 읽는 값이다.
   * 쉼표나 가운뎃점으로 잇지 않는다. 크기와 색이 이미 나누고 있어,
   * 거기에 기호까지 넣으면 한 줄에 구분선이 두 겹으로 선다.
   *
   * '초등부 5학년'이라 적지 않는다. 학교급은 오른쪽 끝에 한 번 서고,
   * 어느 열에 있는지로도 이미 안다 — 한 줄에서 같은 말이 두 번 나오면
   * 정작 다른 학생과 갈리는 값(학교·시간)이 밀려난다.
   *
   * 반 이름도 적지 않는다. 반이 없을 때만 적는다 — 그 학생은 기록을
   * 열 수 없어서, 왜 안 되는지가 여기 적혀 있어야 한다.
   */
  function headLeft(s) {
    const where = [s.school, gradeNum(s)].filter(function (v) { return v; }).join(' ');
    // 오늘 따르는 요일표 하나만 낸다. 둘을 나란히 적으면 카드마다 줄이
    // 두 배가 되고, 지금 몇 시에 오는 학생인지가 오히려 흐려진다.
    const when = S.formatSchedule(S.parseSchedule(S.scheduleOf(s, todayIso(), vacation)));

    let flag = '';
    if (!s.active) flag = '비활성';
    else if (!s.className) flag = '반 없음';

    return '<span class="gi-stu-name">' + A.esc(s.name) + '</span>' +
      '<span class="gi-stu-at">' + A.esc(where || '학년 없음') + '</span>' +
      (when ? '<span class="gi-stu-when">' + A.esc(when) + '</span>' : '') +
      (flag ? '<span class="gi-stu-flag">' + A.esc(flag) + '</span>' : '');
  }

  /** 카드 머리 오른쪽 — 학교급 한 낱말. */
  function headRight(s) {
    const lv = CL.LEVELS.filter(function (l) { return l.key === levelOf(s); })[0];
    return lv ? lv.label : '';
  }

  /**
   * 등록 칸과 같은 모양의 네 칸 — 이름 · 학교급 · 학년 · 학교 이름.
   *
   * 고치는 칸이 등록 칸과 달라 보이면, 같은 값을 두 가지 방식으로
   * 적는 셈이다. 학년도 등록할 때처럼 드롭박스로 고른다 — 글자로
   * 적게 두면 '5학년'·'초5'·'5'가 섞여 쌓인다.
   */
  function editFieldsHtml(s) {
    const key = levelOf(s) || 'elem';

    return '<div class="gi-stu-new">' +
        '<input class="gi-input" type="text" data-field="name" value="' + A.esc(s.name) + '">' +
        '<select class="gi-select" data-field="level">' + levelOptionsHtml(key) + '</select>' +
        '<select class="gi-select" data-field="gradeNum">' + gradeOptionsHtml(key, gradeNum(s)) + '</select>' +
        '<input class="gi-input" type="text" data-field="school" placeholder="학교 이름" value="' + A.esc(s.school || '') + '">' +
        // 등록 단추와 같은 자리, 같은 모양. 두 칸이 같은 줄을 쓰는데
        // 끝내는 단추만 다른 데 있으면, 고치고 나서 그 단추를 다시
        // 찾아야 한다.
        '<button class="gi-btn gi-btn-primary" type="button" data-act="save">수정</button>' +
      '</div>' +
      '<div class="gi-stu-row">' +
        '<select class="gi-select" data-field="classId">' + optionsHtml(s.classId) + '</select>' +
      '</div>' +
      schedPickHtml();
  }

  /**
   * 학기중 · 방학중 고르기.
   *
   * 한 칸에 둘을 함께 펼치지 않는다. 요일 단추 일곱 개가 두 줄이면
   * 어느 줄이 지금 쓰는 시간표인지 매번 읽어야 하고, 고치다가 다른
   * 줄을 건드리기도 쉽다. 한 번에 한 쪽만 열고 그쪽만 저장한다.
   */
  function schedPickHtml() {
    const label = vacation.from
      ? '방학 ' + vacation.from + ' ~ ' + vacation.to
      : '방학 기간을 아직 안 정했습니다';

    return '<div class="gi-choices gi-sched-kind">' +
        '<button class="gi-choice" type="button" data-sk="term"' +
          ' aria-pressed="' + (schedKind === 'term') + '">학기중</button>' +
        '<button class="gi-choice" type="button" data-sk="vacation"' +
          ' aria-pressed="' + (schedKind === 'vacation') + '">방학중</button>' +
        '<span class="gi-note gi-sched-when">' + A.esc(label) + '</span>' +
      '</div>';
  }

  /**
   * 학생 카드.
   *
   * 목록에서는 머리 한 줄만 보인다. 이름을 누르면 아래가 열린다 —
   * 카드마다 버튼 다섯 개가 늘 펼쳐져 있으면 한 열에 서너 명밖에
   * 안 들어가고, 찾는 이름은 늘 스크롤 아래에 있다.
   *
   * editable이면(수정 칸) 늘 열려 있다. 고치려고 연 카드를 한 번 더
   * 눌러 열게 할 까닭이 없다.
   */
  function studentHtml(s, editable) {
    return '' +
      '<article class="gi-rec gi-stu" data-id="' + A.esc(s.studentId) + '">' +
        '<button class="gi-stu-head" type="button" data-act="fold"' +
          ' aria-expanded="' + (editable ? 'true' : 'false') + '">' +
          '<span class="gi-stu-who">' + headLeft(s) + '</span>' +
          '<span class="gi-stu-lv">' + A.esc(headRight(s)) + '</span>' +
        '</button>' +
        '<div class="gi-stu-more"' + (editable ? '' : ' hidden') + '>' +
          (editable ? editFieldsHtml(s) : '') +
          // 수정 칸에는 저장만 둔다. 기록 입력·링크·비활성화는 목록에서
          // 하는 일이고, 고치는 칸에 같이 두면 고치다 말고 누르게 된다.
          (editable ? '' :
            '<div class="gi-choices gi-stu-acts">' +
              '<button class="gi-choice" type="button" data-act="edit">수정</button>' +
              '<button class="gi-choice" type="button" data-act="record">기록 입력</button>' +
              '<button class="gi-choice" type="button" data-act="copy">링크 복사</button>' +
              '<button class="gi-choice" type="button" data-act="reissue">링크 재발급</button>' +
              '<button class="gi-choice" type="button" data-act="toggle">' +
                (s.active ? '비활성화' : '다시 활성화') + '</button>' +
            '</div>') +
          (editable
            ? schedHtml(schedKind === 'vacation' ? s.vacationSchedule : s.schedule)
            : '') +
          '<p class="gi-note gi-stu-msg" data-role="msg"></p>' +
        '</div>' +
      '</article>';
  }

  /**
   * 등록 칸 — 이름 · 학교급 · 학년 · 학교 이름.
   *
   * 반 드롭박스는 여기 두지 않는다. 반 이름이 '초등부 A'라서 바로 옆
   * 학교급 드롭박스와 '초등부'가 두 번 나오고, 등록하는 자리에서 둘 중
   * 어느 쪽이 학교급인지 고르게 된다. 반은 나중에 목록에서 정한다.
   */
  function newFormHtml() {
    return '<div class="gi-stu-new">' +
        '<input class="gi-input" type="text" id="newName" placeholder="이름">' +
        '<select class="gi-select" id="newLevel">' + levelOptionsHtml('elem') + '</select>' +
        '<select class="gi-select" id="newGrade">' + gradeOptionsHtml('elem', '') + '</select>' +
        '<input class="gi-input" type="text" id="newSchool" placeholder="학교 이름">' +
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
    // 고르는 칸을 열 때마다 그 학생의 학교급에서 시작한다.
    editLevel = levelOf(cur) || editLevel || CL.LEVELS[0].key;

    // 학교급을 먼저 좁히고 그 안에서 가나다로 찾는다. 스무 명이 넘으면
    // 이름 하나를 고르려고 목록을 처음부터 끝까지 훑게 된다.
    const mine = students.filter(function (s) { return levelOf(s) === editLevel; })
      .sort(function (x, y) { return String(x.name).localeCompare(String(y.name), 'ko'); });

    // 차례는 아래 칸과 같다 — 이름이 첫 칸, 학교급이 둘째 칸. 고르는
    // 칸과 고치는 칸이 세로로 맞아떨어져야, 고른 학생이 그 아래 칸에
    // 그대로 이어진다는 것이 눈으로 읽힌다.
    return '<div class="gi-stu-pick">' +
        '<select class="gi-select" id="editWho">' +
          (mine.length
            ? mine.map(function (s) {
                return '<option value="' + A.esc(s.studentId) + '"' +
                  (s.studentId === cur.studentId ? ' selected' : '') + '>' +
                  A.esc(s.name) + (s.active ? '' : ' · 비활성') + '</option>';
              }).join('')
            : '<option value="">이 학교급에는 학생이 없습니다</option>') +
        '</select>' +
        '<select class="gi-select" id="editLevel">' + levelOptionsHtml(editLevel) + '</select>' +
        // 보이지 않는 자리지기. 아래 줄 끝에는 '수정' 단추가 서 있어서,
        // 이 줄에 같은 자리를 비워 두지 않으면 남는 폭이 네 칸에 나뉘어
        // 두 줄의 칸이 조금씩 어긋난다.
        '<span class="gi-btn gi-btn-primary" aria-hidden="true">수정</span>' +
      '</div>' +
      studentHtml(cur, true);
  }

  /**
   * 학년이 낮은 쪽부터, 같은 학년이면 가나다로.
   *
   * 시트에 적어 넣은 차례는 선생님 머릿속에 없다. 학년으로 먼저 묶으면
   * 한 열 안에서도 또래끼리 모여, 같은 진도를 나가는 학생들이 붙어 선다.
   *
   * 학년을 아직 안 적은 학생은 맨 뒤로 보낸다 — 0으로 치면 1학년 앞에
   * 서서, 가장 먼저 눈에 들어오는 자리를 빈 값이 차지한다.
   */
  function byGradeThenName_(x, y) {
    const gx = Number(gradeNum(x)) || 99;
    const gy = Number(gradeNum(y)) || 99;
    if (gx !== gy) return gx - gy;
    return String(x.name).localeCompare(String(y.name), 'ko');
  }

  /** 한 학교급의 열. 비어 있어도 자리를 지킨다 — 열이 셋이어야 칸이 안 밀린다. */
  function columnHtml(level) {
    const mine = students.filter(function (s) { return levelOf(s) === level.key; })
      .sort(byGradeThenName_);

    return '<section class="gi-stu-col">' +
      '<h3 class="gi-stu-col-title">' + level.label + ' (' + mine.length + '명)</h3>' +
      (mine.length ? mine.map(function (s) { return studentHtml(s); }).join('')
                   : '<p class="gi-note">아직 없습니다.</p>') +
    '</section>';
  }

  function render() {
    // 반도 학년도 초·중·고로 읽히지 않는 학생. 열에서 빠지면 등록은 했는데
    // 화면 어디에도 없는 학생이 된다.
    const rest = students.filter(function (s) { return !levelOf(s); })
      .sort(byGradeThenName_);

    $view.innerHTML = '' +
      '<div id="studentsError" class="gi-error" hidden></div>' +
      // 위 칸은 열 하나 너비다. 같은 격자에 넣어 폭을 맞춘다 — 숫자로
      // 따로 적으면 열 너비를 고칠 때마다 두 군데를 고쳐야 한다.
      '<div class="gi-stu-cols">' +
        '<div class="gi-stu-panel">' +
          // 탭을 두지 않는다. 고치는 일은 목록에서 그 학생의 '수정'을
          // 눌러 시작한다 — 탭에서 들어오면 드롭박스로 학생을 한 번 더
          // 찾아야 하고, 눈으로 이미 찾은 일을 또 하는 셈이다.
          (mode === 'edit'
            ? '<div class="gi-choices gi-stu-tabs">' +
                '<button class="gi-choice" type="button" data-mode="new">← 학생 등록</button>' +
              '</div>' + editFormHtml()
            : '<h3 class="gi-stu-col-title">학생 등록</h3>' + newFormHtml()) +
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
                rest.map(function (s) { return studentHtml(s); }).join('') +
              '</section></div>'
            : '')
        : '<p class="gi-note">등록된 학생이 없습니다.</p>');

    const add = document.getElementById('addBtn');
    if (add) add.addEventListener('click', addStudent);

    // 학교급을 바꾸면 학년 보기를 다시 만든다. 고른 학년이 새 학교급에
    // 없으면(초6 → 중등부) 아무것도 안 골라진 상태로 돌아간다.
    const lv = document.getElementById('newLevel');
    if (lv) {
      lv.addEventListener('change', function () {
        const box = document.getElementById('newGrade');
        box.innerHTML = gradeOptionsHtml(lv.value, box.value);
      });
    }
  }

  function load() {
    $view.innerHTML = '<p class="gi-state">불러오는 중…</p>';
    A.api.call('admin.students', { sessionKey: A.getSessionKey() }).then(function (data) {
      students = data.students;
      classes = data.classes;
      vacation = data.vacation || { from: '', to: '' };
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
        grade: newGradeValue(),
        school: document.getElementById('newSchool').value.trim(),
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

    if (act === 'fold') {
      const more = card.querySelector('.gi-stu-more');
      const open = more.hidden;
      more.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }

    if (act === 'edit') {
      // 위 수정 칸을 이 학생으로 연다. 드롭박스에서 같은 학생을 다시
      // 찾게 하면, 목록에서 눈으로 찾은 일을 한 번 더 하는 셈이다.
      mode = 'edit';
      editId = id;
      // 지금 쓰는 시간표부터 연다 — 방학 중에 고치러 들어오면 고치려는
      // 것도 방학 시간표다.
      schedKind = onVacation() ? 'vacation' : 'term';
      render();
      $view.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }

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
      // 등록 칸과 같은 규칙으로 합친다. '초' + '5' → '초5'.
      patch.grade = markOf(card.querySelector('[data-field="level"]').value) +
        card.querySelector('[data-field="gradeNum"]').value;
      patch.school = card.querySelector('[data-field="school"]').value.trim();
      patch.classId = card.querySelector('[data-field="classId"]').value;
      // 보고 있는 쪽만 적는다. 안 보이는 쪽까지 함께 쓰면 빈 칸을 읽어
      // 반대쪽 요일표가 지워진다.
      if (schedKind === 'vacation') patch.vacationSchedule = readSched(card);
      else patch.schedule = readSched(card);
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
    const sk = e.target.closest('[data-sk]');
    if (sk) {
      schedKind = sk.dataset.sk;
      render();
      return;
    }

    const tab = e.target.closest('[data-mode]');
    if (!tab) return;

    mode = tab.dataset.mode;
    render();
  });

  $view.addEventListener('change', function (e) {
    if (e.target.id === 'editLevel') {
      editLevel = e.target.value;
      // 그 학교급의 첫 학생을 연다. 고르던 학생을 그대로 두면 드롭박스는
      // 중등부인데 카드는 초등부 학생인 채로 남는다.
      const first = students.filter(function (s) { return levelOf(s) === editLevel; })
        .sort(function (x, y) { return String(x.name).localeCompare(String(y.name), 'ko'); })[0];
      if (first) editId = first.studentId;
      render();
      return;
    }

    if (e.target.id !== 'editWho' || !e.target.value) return;

    editId = e.target.value;
    render();
  });

  window.renderStudentsView = load;
})();
