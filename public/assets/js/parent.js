/**
 * 학부모 열람 화면.
 * URL의 ?t=<토큰>으로 기록을 불러와 요약·추이·타임라인을 그린다.
 */
(function () {
  const api = createApi(window.GIANNA_CONFIG.GAS_URL);
  const PA = window.GI_PROGRESS_AREAS;
  const FMT = window.GI_FORMAT;
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

  function cardHtml(label, value, unit) {
    const inner = value === null
      ? '<span class="gi-card-value is-empty">기록 없음</span>'
      : '<span class="gi-card-value">' + esc(value) + '<span class="gi-unit">' + unit + '</span></span>';
    return '<div class="gi-card"><div class="gi-card-label">' + label + '</div>' + inner + '</div>';
  }

  /**
   * 요약 카드는 두 줄이다 — 출결·과제 한 줄, 시험 평균 한 줄.
   *
   * 한 묶음으로 흘려 두면 화면 폭에 따라 두 갈래가 섞여 뜬다.
   * 성격이 다른 수치라 줄이 갈려 있어야 한 눈에 읽힌다.
   */
  /**
   * 비율 카드. 숫자 대신 고리로 채워 한 눈에 보이게 한다.
   *
   * 기록이 없으면 고리를 그리지 않는다 — 빈 고리는 0%와 구별되지 않는다.
   */
  function gaugeCard(label, pct, color) {
    if (pct === null || pct === undefined) return cardHtml(label, null, '%');

    const value = Math.max(0, Math.min(100, Number(pct)));
    const circumference = 2 * Math.PI * GAUGE_R;
    const filled = (circumference * value) / 100;

    return '' +
      '<div class="gi-card">' +
        '<div class="gi-card-label">' + label + '</div>' +
        '<svg class="gi-gauge" viewBox="0 0 64 64" role="img" ' +
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
      '</div>';
  }

  function renderCards(summary) {
    const rates =
      gaugeCard('출석률', summary.attendanceRate, 'var(--chart-3)') +
      gaugeCard('숙제 제출률', summary.homeworkRate, 'var(--chart-2)');

    let tests = '';
    PA.TEST_SUMMARY_AREAS.forEach(function (a) {
      // 묶음이 바뀐 뒤 아직 갱신되지 않은 응답에는 그 칸이 없다.
      // undefined를 그대로 넘기면 '기록 없음' 대신 undefined가 찍힌다.
      const avg = summary[a.key + 'Avg'];
      tests += cardHtml(a.label, avg === undefined ? null : avg, '점');
    });

    // 시험이 영역별로 나뉘기 전에 쌓인 점수. 있을 때만 덧붙인다.
    // 늘 띄우면 옛 기록이 없는 학생에게 뜻 없는 칸이 하나 남는다.
    if (summary.avgScore !== null && summary.avgScore !== undefined) {
      tests += cardHtml('이전 시험', summary.avgScore, '점');
    }

    document.getElementById('cards').innerHTML =
      '<div class="gi-cards gi-cards-rates">' + rates + '</div>' +
      '<div class="gi-cards gi-cards-tests">' + tests + '</div>';
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

  function renderChart(records) {
    const $chart = document.getElementById('chart');
    const series = chartSeries(records);

    let total = 0;
    series.forEach(function (s) { total += s.pts.length; });

    if (total < 2) {
      $chart.innerHTML = '<p class="gi-note">점수 기록이 2회 이상 쌓이면 추이가 표시됩니다.</p>';
      return;
    }

    // 두 시험의 날짜가 서로 달라도 같은 가로축 위에 놓여야 비교가 된다.
    const dates = [];
    series.forEach(function (s) {
      s.pts.forEach(function (p) { if (dates.indexOf(p.date) === -1) dates.push(p.date); });
    });
    dates.sort();

    const W = 320, H = 110, PAD = 10;
    const stepX = dates.length > 1 ? (W - PAD * 2) / (dates.length - 1) : 0;
    const xOf = function (date) {
      return dates.length > 1 ? PAD + stepX * dates.indexOf(date) : W / 2;
    };

    let paths = '';
    let dots = '';

    series.forEach(function (s) {
      const coords = s.pts.map(function (p) {
        return {
          x: xOf(p.date),
          y: PAD + (1 - p.pct / 100) * (H - PAD * 2),
          pct: Math.round(p.pct),
          date: p.date,
        };
      });

      // 점이 하나뿐인 선도 점은 찍는다. 선만 그리면 화면에서 사라진다.
      if (coords.length > 1) {
        const d = coords.map(function (c, i) {
          return (i ? 'L' : 'M') + c.x.toFixed(1) + ' ' + c.y.toFixed(1);
        }).join(' ');
        paths += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2" ' +
          'stroke-linejoin="round" stroke-linecap="round"/>';
      }

      dots += coords.map(function (c) {
        return '<circle cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) +
          '" r="3" fill="' + s.color + '"><title>' + esc(s.label) + ' · ' +
          esc(c.date) + ' · ' + c.pct + '점</title></circle>';
      }).join('');
    });

    const legend = series.map(function (s) {
      return '<span class="gi-legend-item"><span class="gi-legend-dot" style="background:' +
        s.color + '"></span>' + esc(s.label) + '</span>';
    }).join('');

    $chart.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="시험 점수 추이, ' + total + '회 기록">' +
      '<line x1="' + PAD + '" y1="' + (H - PAD) + '" x2="' + (W - PAD) + '" y2="' + (H - PAD) +
      '" stroke="var(--border)" stroke-width="1"/>' + paths + dots + '</svg>' +
      '<p class="gi-note gi-legend" style="margin-top:.4rem">' + legend +
      '<span>100점 환산 기준 · ' + esc(dates[0]) + ' ~ ' + esc(dates[dates.length - 1]) +
      '</span></p>';
  }

  /* ---------- 타임라인 ---------- */

  const ATTENDANCE_TONE = { '출석': 'is-good', '보강': 'is-good', '지각': 'is-warn', '결석': 'is-bad' };
  const HOMEWORK_TONE = { '제출': 'is-good', '부분제출': 'is-warn', '미제출': 'is-bad', '해당없음': 'is-none' };

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
  function progressRows(r) {
    const lines = PA.areaLines(r);
    if (!lines.length) return row('진도', progressText(r));

    // 시험·숙제와 같은 꼴. 왼쪽 이름은 '진도' 하나뿐이고 영역은 그 옆에 들어간다.
    return groupRow('진도', lines.map(function (l) {
      return { label: l.label, book: l.book, bookBelow: true, text: l.progress };
    }));
  }

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

      return '<div class="gi-rec-groupline">' +
        '<span class="gi-area-book">' + esc(it.label) + '</span> ' + inline + text + below +
        '</div>';
    }).join('');
    return '<div class="gi-rec-row"><dt>' + label + '</dt>' +
      '<dd class="gi-rec-group">' + body + '</dd></div>';
  }

  function testRows(r) {
    const lines = PA.testLines(r);
    if (lines.length) {
      return groupRow('시험', lines.map(function (l) {
        // 점수는 굵게, 그리고 맨 앞에 — 학부모가 가장 먼저 찾는 값이다.
        // 교재명은 아랫줄로 내린다.
        return {
          label: l.label,
          book: l.book,
          bookBelow: true,
          text: l.score + '/' + l.max,
          strong: true,
        };
      }));
    }

    // 시험이 영역별로 나뉘기 전에 쌓인 기록.
    //
    // 빈 값 검사에 undefined·null도 넣어야 한다. 서버 응답은 shape.js가
    // 빠진 칸을 ''로 채워 주지만, 그 손질을 거치지 않은 레코드가 들어오면
    // `undefined !== ''`가 참이라 학부모 화면에 '시험 undefined/undefined'가
    // 그대로 찍힌다.
    const blank = function (v) { return v === '' || v === null || v === undefined; };
    const scoreText = (!blank(r.testScore) && !blank(r.testMax))
      ? (r.testName ? r.testName + ' ' : '') + r.testScore + '/' + r.testMax
      : '';
    return row('시험', scoreText);
  }

  function nextRows(r) {
    const lines = PA.nextLines(r);
    if (lines.length) {
      return groupRow('숙제', lines.map(function (l) {
        // 시험과 같은 꼴. 범위가 앞줄, 교재명은 아랫줄이다 — 교재명이 길면
        // 뒤에 붙은 범위가 화면 밖으로 밀려 정작 할 일이 안 보인다.
        return { label: l.label, book: l.book, bookBelow: true, text: l.text };
      }));
    }
    return row('숙제', r.nextHomework);
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

  function recordHtml(r, index) {
    const badges =
      badge(r.attendance, ATTENDANCE_TONE[r.attendance]) +
      badge(r.homeworkStatus, HOMEWORK_TONE[r.homeworkStatus]) +
      (r.homeworkLevel ? badge('완성도 ' + r.homeworkLevel, 'is-none') : '');

    const comment = r.comment
      ? '<div class="gi-rec-comment">' + esc(r.comment) + '</div>' : '';

    return '' +
      '<article class="gi-rec">' +
        '<button class="gi-rec-top" type="button" aria-expanded="false" aria-controls="rb' + index + '">' +
          '<span class="gi-rec-date">' + esc(FMT.dateLabel(r.date)) + '</span>' +
          '<span class="gi-rec-progress">' + esc(topLine(r)) + '</span>' +
        '</button>' +
        '<div class="gi-rec-body" id="rb' + index + '" hidden>' +
          '<dl style="margin:0">' +
            '<div class="gi-rec-row"><dt>상태</dt><dd>' + (badges || '—') + '</dd></div>' +
            progressRows(r) +
            testRows(r) +
            nextRows(r) +
          '</dl>' + comment +
        '</div>' +
      '</article>';
  }

  function renderRecords(records) {
    const $records = document.getElementById('records');

    if (!records.length) {
      $records.innerHTML = '<p class="gi-note">아직 등록된 수업 기록이 없습니다.</p>';
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
  }

  /* ---------- 진입 ---------- */

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
      document.getElementById('studentMeta').textContent =
        [data.student.grade, data.student.className].filter(Boolean).join(' · ');
      document.title = data.student.name + ' 학습 리포트 · 지아나영어';

      renderCards(data.summary);
      renderChart(data.records);
      renderRecords(data.records);

      $state.hidden = true;
      $content.hidden = false;
    }).catch(function (err) {
      showError(err.message || '불러오지 못했습니다.');
    });
  }

  start();
})();
