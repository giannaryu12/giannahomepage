/**
 * 학부모 열람 화면.
 * URL의 ?t=<토큰>으로 기록을 불러와 요약·추이·타임라인을 그린다.
 */
(function () {
  const api = createApi(window.GIANNA_CONFIG.GAS_URL);
  const PA = window.GI_PROGRESS_AREAS;
  const FMT = window.GI_FORMAT;
  const CL = window.GI_CLASS_LEVEL;
  const EI = window.GI_EXAM_ITEMS;
  const $state = document.getElementById('state');
  const $content = document.getElementById('content');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showError(msg) {
    $state.hidden = false;
    $state.textContent = msg;
    $content.hidden = true;
  }

  /* ---------- 요약 카드 ---------- */

  // 고리 반지름. viewBox 64 안에서 stroke 7이 잘리지 않는 최대치.
  const GAUGE_R = 26;

  /** 이달 숫자와 지난달 숫자의 차. 둘 중 하나라도 없으면 null이다. */
  function deltaOf(now, before) {
    if (now === null || now === undefined) return null;
    if (before === null || before === undefined) return null;
    return Math.round(Number(now) - Number(before));
  }

  /**
   * 지난달과 견준 화살표. 92%가 잘한 것인지는 견줄 것이 있어야 안다.
   * 지난달 기록이 없으면 '지난달 —'로 둔다 — 0에서 올랐다고 적으면
   * 안 다니던 달이 바닥 점수가 된다.
   */
  function deltaHtml(d) {
    if (d === null) return '<span class="gi-delta is-flat">지난달 —</span>';
    if (d === 0) return '<span class="gi-delta is-flat">지난달과 같음</span>';

    const up = d > 0;
    return '<span class="gi-delta ' + (up ? 'is-up' : 'is-down') + '">지난달 ' +
      (up ? '▲' : '▼') + Math.abs(d) + '</span>';
  }

  /**
   * 도넛 카드. 가운데 숫자는 이달, 아래 작은 글씨는 누적과 화살표다.
   *
   * 이달 기록이 없으면 고리를 그리지 않는다 — 빈 고리는 0%와 구별되지
   * 않는다. 달이 막 바뀐 1일에는 늘 그런 상태가 된다.
   */
  function ringCard(label, pct, total, prev, color) {
    if (pct === null || pct === undefined) {
      return '<div class="gi-ring-card">' +
        '<div class="gi-ring-label">' + esc(label) + '</div>' +
        '<p class="gi-note gi-ring-empty">이달 기록이 아직 없습니다.</p>' +
        (total === null || total === undefined ? '' :
          '<div class="gi-ring-sub">누적 ' + esc(total) + '%</div>') +
      '</div>';
    }

    const value = Math.max(0, Math.min(100, Number(pct)));
    const circumference = 2 * Math.PI * GAUGE_R;
    const filled = (circumference * value) / 100;

    const sub = (total === null || total === undefined)
      ? deltaHtml(deltaOf(pct, prev))
      : '누적 ' + esc(total) + '% · ' + deltaHtml(deltaOf(pct, prev));

    return '' +
      '<div class="gi-ring-card">' +
        '<div class="gi-ring-label">' + esc(label) + '</div>' +
        '<svg class="gi-gauge gi-ring" viewBox="0 0 64 64" role="img" ' +
          'aria-label="' + esc(label) + ' ' + value + '퍼센트">' +
          '<circle cx="32" cy="32" r="' + GAUGE_R + '" fill="none" ' +
            'stroke="var(--border)" stroke-width="7"/>' +
          '<circle cx="32" cy="32" r="' + GAUGE_R + '" fill="none" stroke="' + color + '" ' +
            'stroke-width="7" stroke-linecap="round" ' +
            'stroke-dasharray="' + filled.toFixed(1) + ' ' + circumference.toFixed(1) + '" ' +
            'transform="rotate(-90 32 32)"/>' +
          '<text x="32" y="32" class="gi-gauge-num" text-anchor="middle" ' +
            'dominant-baseline="central">' + value +
            '<tspan class="gi-gauge-unit">%</tspan></text>' +
        '</svg>' +
        '<div class="gi-ring-sub">' + sub + '</div>' +
      '</div>';
  }

  /**
   * 시험 한 줄. 막대는 누적 평균이고, 화살표는 이달과 지난달을 견준다.
   *
   * 점수가 없는 영역은 줄을 만들지 않는다. '기록 없음' 칸이 셋 서 있으면
   * 아직 아무것도 안 한 것처럼 보인다.
   */
  function testBarHtml(label, avg, month, prev) {
    const value = Math.max(0, Math.min(100, Number(avg)));

    return '' +
      '<div class="gi-bar">' +
        '<div class="gi-bar-head">' +
          '<span class="gi-bar-name">' + esc(label) + '</span>' +
          '<span class="gi-bar-num">' + esc(Math.round(Number(avg))) + '점</span>' +
          deltaHtml(deltaOf(month, prev)) +
        '</div>' +
        '<div class="gi-track">' +
          '<span class="gi-fill" style="width:' + value + '%"></span>' +
        '</div>' +
      '</div>';
  }

  /** '2026-11' → '11월'. 달을 안 받았으면 '이달'. */
  function monthWord(monthKey) {
    const m = /^\d{4}-(\d{2})$/.exec(String(monthKey || ''));
    return m ? Number(m[1]) + '월' : '이달';
  }

  function renderCards(summary) {
    const when = monthWord(summary.monthKey);

    const rings =
      ringCard(when + ' 출석', summary.monthAttendanceRate, summary.attendanceRate,
        summary.prevAttendanceRate, 'var(--state-good-dot)') +
      ringCard(when + ' 숙제', summary.monthHomeworkRate, summary.homeworkRate,
        summary.prevHomeworkRate, 'var(--gold)');

    // 묶음이 바뀐 뒤 아직 갱신되지 않은 응답에는 그 칸이 없다.
    const monthTests = summary.monthTests || {};
    const prevTests = summary.prevTests || {};

    let bars = '';
    PA.TEST_SUMMARY_AREAS.forEach(function (a) {
      const avg = summary[a.key + 'Avg'];
      if (avg === null || avg === undefined) return;
      bars += testBarHtml(a.label, avg, monthTests[a.key], prevTests[a.key]);
    });

    // 시험이 영역별로 나뉘기 전에 쌓인 점수. 있을 때만 덧붙인다.
    if (summary.avgScore !== null && summary.avgScore !== undefined) {
      bars += testBarHtml('이전 시험', summary.avgScore, null, null);
    }

    document.getElementById('cards').innerHTML =
      '<div class="gi-rings">' + rings + '</div>' +
      (bars ? '<div class="gi-bars">' + bars + '</div>' : '');
  }
  /* ---------- 성적 추이 ---------- */


  // 선 색은 tokens.css의 --chart-1..4. 어두운 화면에서도 배경과 붙지 않게
  // 테마별로 값이 다르므로 --garnet 같은 원색을 직접 쓰지 않는다.
  const SERIES_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

  const SERIES = PA.TEST_SUMMARY_AREAS.map(function (a, i) {
    return {
      key: a.key,
      label: a.label,
      memberKeys: a.memberKeys,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    };
  });

  function pctOf(rawScore, rawMax) {
    if (rawScore === '' || rawScore === null || rawScore === undefined) return null;
    const score = Number(rawScore);
    const max = Number(rawMax);
    if (!isFinite(score) || !(max > 0)) return null;
    return (score / max) * 100;
  }

  function scorePoints(records, scoreField, maxField) {
    const out = [];
    records.forEach(function (r) {
      const pct = pctOf(r[scoreField], r[maxField]);
      if (pct !== null) out.push({ date: r.date, pct: pct });
    });
    return out.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  }

  /**
   * 묶음 하나의 점. 한 수업에 단어 시험이 둘이면 그날 점 하나로 평균낸다.
   * 같은 날 같은 이름의 점이 둘이면 선이 접혀 읽히지 않는다.
   */
  function groupPoints(records, memberKeys) {
    const out = [];
    records.forEach(function (r) {
      let sum = 0;
      let n = 0;
      memberKeys.forEach(function (key) {
        const pct = pctOf(r[key + 'TestScore'], r[key + 'TestMax']);
        if (pct === null) return;
        sum += pct;
        n++;
      });
      if (n) out.push({ date: r.date, pct: sum / n });
    });
    return out.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  }

  /** 그릴 선들. 새 시험 기록이 하나도 없으면 옛 점수 한 선으로 되돌아간다. */
  function chartSeries(records) {
    const out = [];

    SERIES.forEach(function (s) {
      const pts = groupPoints(records, s.memberKeys);
      if (pts.length) out.push({ label: s.label, color: s.color, pts: pts });
    });
    if (out.length) return out;

    const legacy = scorePoints(records, 'testScore', 'testMax');
    return legacy.length ? [{ label: '시험', color: SERIES_COLORS[0], pts: legacy }] : [];
  }

  /**
   * 묶음 하나의 그림.
   *
   * 가로축은 그 묶음이 가진 날짜만 쓴다. 단어는 매주 보고 듣기는 한 달에
   * 한 번 보는 식이라, 날짜를 하나로 합치면 듣기 선은 점 두 개가 양 끝에
   * 멀찍이 떨어져 '떨어졌다'처럼 보인다.
   */
  function chartOneHtml(s) {
    const W = 320, H = 72, PAD = 9;

    const dates = s.pts.map(function (p) { return p.date; });
    const stepX = dates.length > 1 ? (W - PAD * 2) / (dates.length - 1) : 0;

    const coords = s.pts.map(function (p, i) {
      return {
        x: dates.length > 1 ? PAD + stepX * i : W / 2,
        y: PAD + (1 - p.pct / 100) * (H - PAD * 2),
        pct: Math.round(p.pct),
        date: p.date,
      };
    });

    // 점이 하나뿐인 선도 점은 찍는다. 선만 그리면 화면에서 사라진다.
    const path = coords.length > 1
      ? '<path d="' + coords.map(function (c, i) {
          return (i ? 'L' : 'M') + c.x.toFixed(1) + ' ' + c.y.toFixed(1);
        }).join(' ') + '" fill="none" stroke="' + s.color + '" stroke-width="2" ' +
        'stroke-linejoin="round" stroke-linecap="round"/>'
      : '';

    const dots = coords.map(function (c) {
      return '<circle cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) +
        '" r="3" fill="' + s.color + '"><title>' + esc(s.label) + ' · ' +
        esc(c.date) + ' · ' + c.pct + '점</title></circle>';
    }).join('');

    const last = coords[coords.length - 1];

    return '<div class="gi-chart-one">' +
        '<p class="gi-chart-head">' +
          '<span class="gi-legend-dot" style="background:' + s.color + '"></span>' +
          '<span class="gi-chart-name">' + esc(s.label) + '</span>' +
          '<span class="gi-chart-last">' + last.pct + '점</span>' +
          '<span class="gi-chart-when">' + esc(dates[0]) + ' ~ ' + esc(dates[dates.length - 1]) + '</span>' +
        '</p>' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
          esc(s.label) + ' 점수 추이, ' + coords.length + '회 기록">' +
          '<line x1="' + PAD + '" y1="' + (H - PAD) + '" x2="' + (W - PAD) +
          '" y2="' + (H - PAD) + '" stroke="var(--border)" stroke-width="1"/>' +
          path + dots +
        '</svg>' +
      '</div>';
  }

  /**
   * 성적 추이.
   *
   * 묶음마다 제 칸을 갖는다 — 단어가 위, 듣기가 아래. 한 그림에 겹쳐
   * 그리면 선 둘이 가로지르며 만나는 자리마다 어느 쪽이 어느 쪽인지
   * 범례를 다시 보게 되고, 100점 환산이라 두 선이 같은 높이에 몰린다.
   *
   * 기록이 있는 묶음만 칸을 받는다. 본 적 없는 시험이 빈 칸으로 서 있으면
   * 안 본 것인지 못 본 것인지 알 수 없다.
   */
  function renderChart(records) {
    const $chart = document.getElementById('chart');
    const series = chartSeries(records);

    let total = 0;
    series.forEach(function (s) { total += s.pts.length; });

    if (total < 2) {
      $chart.innerHTML = '<p class="gi-note">점수 기록이 2회 이상 쌓이면 추이가 표시됩니다.</p>';
      return;
    }

    $chart.innerHTML = series.map(chartOneHtml).join('') +
      '<p class="gi-note" style="margin-top:.4rem">100점 환산 기준</p>';
  }

  /* ---------- 타임라인 ---------- */

  // 파랑은 된 것, 주황은 반쯤, 빨강은 안 된 것. 세 줄이 같은 색 차례를
  // 쓰므로 학부모는 낱말을 읽기 전에 색으로 먼저 안다.
  //
  // 보강은 출석과 같은 파랑이다 — 날이 옮겨졌을 뿐 그날 수업을 했다.
  const ATTENDANCE_TONE = { '출석': 'is-info', '보강': 'is-info', '지각': 'is-bad', '결석': 'is-bad' };
  const HOMEWORK_TONE = { '제출': 'is-info', '부분제출': 'is-mid', '미제출': 'is-bad', '해당없음': 'is-none' };
  const LEVEL_TONE = { '상': 'is-info', '중': 'is-mid', '하': 'is-bad' };
  // 학생관리의 뜻풀이와 같은 색이다 — 선생님이 누를 때 본 색과 학부모가
  // 읽는 색이 다르면, 같은 낱말을 두 사람이 다른 무게로 읽는다.
  const EXAM_RESULT_TONE = { '통과': 'is-info', '미통과': 'is-bad', '미응시': 'is-plain' };

  function badge(text, tone) {
    if (!text) return '';
    return '<span class="gi-badge ' + (tone || 'is-none') + '">' + esc(text) + '</span>';
  }

  function row(label, value) {
    if (!value) return '';
    return '<div class="gi-rec-row"><dt>' + label + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  /** 결석한 날은 진도가 없다. 그 자리에 '결석'이라고 낸다. */
  function progressText(r) {
    if (r.progress) return r.progress;
    return r.attendance === '결석' ? '결석' : '';
  }

  /**
   * 영역별 진도 줄. 진도가 적힌 영역만 나온다.
   * 영역이 하나도 없는 옛 기록은 예전처럼 progress 한 줄로 보여준다.
   */
  /**
   * 왼쪽 이름 하나(진도·시험·숙제) 옆에 영역별 항목을 여러 개 담는다.
   * 영역 이름을 왼쪽 칸에 쓰면 항목 이름과 뒤섞여 무엇의 목록인지 흐려진다.
   *
   * 항목 하나가 한 줄을 차지한다. 교재명이 중간에서 끊기면 어느 책인지
   * 읽기 어려워 줄바꿈을 막았고(.gi-rec-groupline), 그래서 넘칠 수 있는
   * 만큼 묶음 자체가 옆으로 밀린다(.gi-rec-group).
   */
  function groupRow(label, items) {
    if (!items.length) return '';
    const body = items.map(function (it) {
      const text = it.strong ? '<strong>' + esc(it.text) + '</strong>' : esc(it.text);

      // bookBelow면 교재명을 아랫줄로 내린다. 값이 앞에 오므로 교재명이
      // 길어도 점수가 화면 밖으로 밀리지 않는다.
      const inline = (it.book && !it.bookBelow)
        ? '<span class="gi-area-book">' + esc(it.book) + '</span> · ' : '';
      const below = (it.book && it.bookBelow)
        ? '<span class="gi-rec-subline">' + esc(it.book) + '</span>' : '';

      // 꼬리표가 없는 묶음도 있다 — 시험대비 칸은 내용 한 줄이 전부다.
      // 빈 <span>을 그려 두면 그 자리만큼 글이 오른쪽으로 밀린다.
      const tag = it.label
        ? '<span class="gi-area-book">' + esc(it.label) + '</span> ' : '';

      // 통과 여부는 그 칸 앞에 붙는다. 시험마다 다르다 — 모의고사는
      // 통과했고 단어는 미통과일 수 있다.
      const mark = it.result
        ? badge(it.result, EXAM_RESULT_TONE[it.result]) + ' ' : '';

      return '<div class="gi-rec-groupline">' +
        mark + tag + inline + text + below +
        '</div>';
    }).join('');
    return '<div class="gi-rec-row"><dt>' + label + '</dt>' +
      '<dd class="gi-rec-group">' + body + '</dd></div>';
  }

  /**
   * 시험이 영역별로 나뉘기 전에 쌓인 기록의 점수 한 줄.
   *
   * 빈 값 검사에 undefined·null도 넣어야 한다. 서버 응답은 shape.js가
   * 빠진 칸을 ''로 채워 주지만, 그 손질을 거치지 않은 레코드가 들어오면
   * `undefined !== ''`가 참이라 학부모 화면에 '시험 undefined/undefined'가
   * 그대로 찍힌다.
   */
  function legacyTestText(r) {
    const blank = function (v) { return v === '' || v === null || v === undefined; };
    if (blank(r.testScore) || blank(r.testMax)) return '';
    return (r.testName ? r.testName + ' ' : '') + r.testScore + '/' + r.testMax;
  }

  /**
   * 날짜 옆 한 줄. 진도는 펼치면 그대로 나오므로 여기서는 회차를 낸다.
   * 회차를 안 적은 결석일은 결석이라고만 적어 접힌 채로도 읽히게 한다.
   */
  function topLine(r) {
    const n = Number(r.sessionNo);
    if (isFinite(n) && n > 0) return n + '회차';
    return r.attendance === '결석' ? '결석' : '';
  }

  /** 시험대비 칸을 묶음 한 줄의 항목으로. 꼬리표 자리는 비운다. */
  function examItemsOf(raw, withResult) {
    return EI.parseItems(raw).map(function (it) {
      return { label: '', text: it.text, result: withResult ? it.result : '' };
    });
  }

  /**
   * 시험 · 진도 · 숙제 세 줄.
   *
   * 한 기록 안에 두 갈래의 내용이 함께 들어 있을 수 있다 — 선생님이
   * 시험대비에 출결을 누른 날, 정규수업 쪽에 손으로 적어 둔 진도가 있으면
   * 서버가 그것을 이 기록에 옮겨 담는다(shape.js의 mergeSameDay_).
   *
   * 그래서 갈래로 갈라 그리지 않고 뜻이 같은 것끼리 한 줄에 모은다.
   * '진도' 줄이 두 개 서 있으면 학부모는 둘이 어떻게 다른지부터 묻는다.
   */
  function contentRows(r) {
    const exam = isExam(r);

    const tests = examItemsOf(r.examTests, true).concat(
      PA.testLines(r).map(function (l) {
        // 점수는 굵게, 그리고 맨 앞에 — 학부모가 가장 먼저 찾는 값이다.
        // 교재명은 아랫줄로 내린다.
        return {
          label: l.label, book: l.book, bookBelow: true,
          text: l.score + '/' + l.max, strong: true,
        };
      }));

    const prog = examItemsOf(r.examItems, false).concat(
      PA.areaLines(r).map(function (l) {
        return { label: l.label, book: l.book, bookBelow: true, text: l.progress };
      }));

    const next = examItemsOf(r.examNext, false).concat(
      PA.nextLines(r).map(function (l) {
        // 범위가 앞줄, 교재명은 아랫줄이다 — 교재명이 길면 뒤에 붙은
        // 범위가 화면 밖으로 밀려 정작 할 일이 안 보인다.
        return { label: l.label, book: l.book, bookBelow: true, text: l.text };
      }));

    return (tests.length ? groupRow('시험', tests) : row('시험', legacyTestText(r))) +
      // 결석한 날 '진도: 결석'은 정규수업에서만 낸다. 시험대비는 적어 둔
      // 칸이 전부라, 없는 날은 줄도 없는 것이 맞다.
      (prog.length ? groupRow('진도', prog)
        : row('진도', exam ? r.progress : progressText(r))) +
      (next.length ? groupRow('숙제', next) : row('숙제', r.nextHomework));
  }

  /** 시험대비 기록인가. 빈 값은 정규수업이다. */
  function isExam(r) {
    return String((r && r.kind) || '') === 'exam';
  }

  function recordHtml(r, index) {
    const badges =
      badge(r.attendance, ATTENDANCE_TONE[r.attendance]) +
      badge(r.homeworkStatus, HOMEWORK_TONE[r.homeworkStatus]) +
      (r.homeworkLevel
        ? badge('완성도 ' + r.homeworkLevel, LEVEL_TONE[r.homeworkLevel]) : '');

    // 선생님 한마디는 그날 기록의 맨 밑이다. 위로 따로 빼 두면 어느 날
    // 수업을 두고 한 말인지가 끊긴다 — 그날의 시험·진도 바로 아래에
    // 있어야 무엇을 보고 한 말인지 읽힌다.
    const comment = r.comment
      ? '<div class="gi-rec-comment">' +
          '<p class="gi-say-who">Today\'s comment</p>' +
          '<p class="gi-say-text">' + esc(r.comment) + '</p>' +
        '</div>' : '';

    // 상태 · 시험 · 진도 · 숙제 차례는 두 갈래가 같다. 학부모가 먼저 찾는
    // 것은 왔는지와 그날 본 시험이고, 진도와 숙제는 그 뒤에 읽는다.
    //
    // 시험대비도 출결을 적는다 — 그날도 학생은 오거나 안 온다. 아무것도
    // 적지 않은 날은 상태 줄을 내지 않는다. 빈 줄이 하나 서 있으면
    // 적기를 빠뜨린 것인지 그런 날인지 알 수 없다.
    const state = badges
      ? '<div class="gi-rec-row"><dt>상태</dt><dd>' + badges + '</dd></div>'
      : '';

    const inner = (isExam(r)
      ? state
      : '<div class="gi-rec-row"><dt>상태</dt><dd>' + (badges || '—') + '</dd></div>') +
      contentRows(r);

    // 접힌 줄은 '12회차 정규수업'처럼 읽힌다. 갈래를 늘 적는다 — 시험대비
    // 쪽에만 꼬리표가 붙어 있으면, 꼬리표 없는 줄이 무엇인지는 아는 사람만
    // 안다. 같은 날 두 줄이 설 때도 이 낱말로 갈린다.
    const no = topLine(r);
    const tail =
      (no ? '<span class="gi-rec-progress">' + esc(no) + '</span>' : '') +
      '<span class="gi-rec-kind' + (isExam(r) ? '' : ' is-regular') + '">' +
        (isExam(r) ? '시험대비' : '정규수업') +
      '</span>';

    return '' +
      '<article class="gi-rec">' +
        '<button class="gi-rec-top" type="button" aria-expanded="false" aria-controls="rb' + index + '">' +
          '<span class="gi-rec-date">' + esc(FMT.dateLabel(r.date)) + '</span>' +
          tail +
        '</button>' +
        '<div class="gi-rec-body" id="rb' + index + '" hidden>' +
          '<dl style="margin:0">' + inner + '</dl>' + comment +
        '</div>' +
      '</article>';
  }

  // 처음에 펴 두는 기록 수와 '더보기' 한 번에 늘어나는 수.
  //
  // 한 해를 다니면 기록이 백 건을 넘는다. 다 그려 두면 학부모가 보려는
  // 지난주 수업이 스크롤 막대 맨 위 몇 픽셀이 된다.
  const FIRST_SHOWN = 5;
  const MORE_STEP = 8;

  let shown = FIRST_SHOWN;

  /**
   * 넘치는 기록은 숨기기만 한다. 지웠다 다시 그리면 펴 둔 기록이 접히고
   * 읽던 자리가 사라진다 — '더보기'를 누른 사람이 잃는 것이 얻는 것보다
   * 많아진다.
   */
  function applyLimit(total) {
    const $records = document.getElementById('records');

    $records.querySelectorAll('.gi-rec').forEach(function (card, i) {
      card.hidden = i >= shown;
    });

    const $more = document.getElementById('moreRecords');
    const left = total - shown;

    $more.hidden = left <= 0;
    if (left > 0) $more.textContent = '더보기 (' + left + '개 남음)';
  }

  function renderRecords(records) {
    const $records = document.getElementById('records');

    if (!records.length) {
      $records.innerHTML = '<p class="gi-note">아직 등록된 수업 기록이 없습니다.</p>';
      document.getElementById('moreRecords').hidden = true;
      return;
    }

    $records.innerHTML = records.map(recordHtml).join('');

    $records.querySelectorAll('.gi-rec-top').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const body = document.getElementById(btn.getAttribute('aria-controls'));
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        body.hidden = open;
      });
    });

    document.getElementById('moreRecords').addEventListener('click', function () {
      shown += MORE_STEP;
      applyLimit(records.length);
    });

    applyLimit(records.length);
  }

  /* ---------- 탭 ---------- */

  /**
   * 탭은 둘 다 그려 두고 하나만 보여 준다.
   *
   * 누를 때마다 다시 그리면 접어 둔 수업 기록이 펴지고, 달력은 보던 달이
   * 이번 달로 돌아간다 — 탭을 옮겼다가 돌아온 사람은 자기가 뭘 잘못
   * 눌렀는지 알 수 없다.
   */
  function initTabs() {
    const $tabs = document.getElementById('parentTabs');

    $tabs.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;

      const want = btn.dataset.tab;

      $tabs.querySelectorAll('[data-tab]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.tab === want));
      });

      document.getElementById('reportTab').hidden = want !== 'report';
      document.getElementById('planTab').hidden = want !== 'plan';
    });
  }

  /* ---------- 진입 ---------- */

  /**
   * 이름 아래 한 줄 — '가온초 5'.
   *
   * '학년'이라는 글자는 적지 않는다. 학교 이름 뒤의 숫자가 학년이라는
   * 것은 학부모가 가장 잘 아는 사실이고, 머리글은 짧을수록 이름이
   * 먼저 읽힌다.
   *
   * 학교를 아직 안 적은 학생은 예전처럼 '초등부 5학년'으로 둔다 —
   * 숫자 하나만 덩그러니 서면 무엇의 5인지 알 수 없다. 반 이름은
   * 어느 쪽에도 적지 않는다. 학부모에게 알려 준 적 없는 말이다.
   */
  function metaOf(student) {
    const school = String((student && student.school) || '').trim();
    if (!school) return CL.gradeLabel(student.grade, student.className);

    const hit = /\d+/.exec(String((student && student.grade) || ''));
    return hit ? school + ' ' + hit[0] : school;
  }

  function tokenFromUrl() {
    const q = new URLSearchParams(window.location.search).get('t');
    if (q) return q;

    // 짧은 링크 /p/<토큰>. netlify.toml의 재작성(status 200)은 브라우저 주소를
    // /p/<토큰> 그대로 두므로 location.search가 비어 있다. 경로에서 직접 읽는다.
    const m = /^\/p\/([^/?#]+)\/?$/.exec(window.location.pathname);
    if (!m) return '';

    // 깨진 이스케이프(/p/%E0%A4)면 decodeURIComponent가 던진다.
    // 여기서 새어나가면 안내 문구 대신 빈 화면이 남는다.
    try {
      return decodeURIComponent(m[1]);
    } catch (e) {
      return '';
    }
  }

  function start() {
    const token = tokenFromUrl();
    if (!token) {
      showError('링크가 올바르지 않습니다. 선생님께 받으신 주소로 다시 접속해 주세요.');
      return;
    }

    api.call('parent.load', { token: token }).then(function (data) {
      document.getElementById('studentName').textContent = data.student.name + ' 학습 리포트';
      document.getElementById('studentMeta').textContent = metaOf(data.student);
      document.title = data.student.name + ' 학습 리포트 · 지아나영어';

      renderCards(data.summary);
      renderChart(data.records);
      renderRecords(data.records);
      initTabs();
      window.GI_PARENT_CAL.init(data);

      $state.hidden = true;
      $content.hidden = false;
    }).catch(function (err) {
      showError(err.message || '불러오지 못했습니다.');
    });
  }

  start();
})();
