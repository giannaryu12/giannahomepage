/**
 * 학부모 열람 화면.
 * URL의 ?t=<토큰>으로 기록을 불러와 요약·추이·타임라인을 그린다.
 */
(function () {
  const api = createApi(window.GIANNA_CONFIG.GAS_URL);
  const PA = window.GI_PROGRESS_AREAS;
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

  function cardHtml(label, value, unit) {
    const inner = value === null
      ? '<span class="gi-card-value is-empty">기록 없음</span>'
      : '<span class="gi-card-value">' + esc(value) + '<span class="gi-unit">' + unit + '</span></span>';
    return '<div class="gi-card"><div class="gi-card-label">' + label + '</div>' + inner + '</div>';
  }

  function renderCards(summary) {
    let html =
      cardHtml('출석률', summary.attendanceRate, '%') +
      cardHtml('과제 제출률', summary.homeworkRate, '%') +
      cardHtml('단어 평균', summary.vocabAvg, '점') +
      cardHtml('듣기 평균', summary.listeningAvg, '점');

    // 시험이 단어·듣기로 나뉘기 전에 쌓인 점수. 있을 때만 덧붙인다.
    // 늘 띄우면 옛 기록이 없는 학생에게 뜻 없는 칸이 하나 남는다.
    if (summary.avgScore !== null && summary.avgScore !== undefined) {
      html += cardHtml('이전 시험 평균', summary.avgScore, '점');
    }

    document.getElementById('cards').innerHTML = html;
  }

  /* ---------- 성적 추이 ---------- */

  const SERIES = [
    { key: 'vocab', label: '단어', color: 'var(--garnet)' },
    { key: 'listening', label: '듣기', color: 'var(--gold)' },
  ];

  function scorePoints(records, scoreField, maxField) {
    return records
      .filter(function (r) {
        return r[scoreField] !== '' && r[scoreField] !== null && r[scoreField] !== undefined
          && Number(r[maxField]) > 0;
      })
      .map(function (r) {
        return { date: r.date, pct: (Number(r[scoreField]) / Number(r[maxField])) * 100 };
      })
      .sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  /** 그릴 선들. 새 시험 기록이 하나도 없으면 옛 점수 한 선으로 되돌아간다. */
  function chartSeries(records) {
    const out = [];

    SERIES.forEach(function (s) {
      const pts = scorePoints(records, s.key + 'TestScore', s.key + 'TestMax');
      if (pts.length) out.push({ label: s.label, color: s.color, pts: pts });
    });
    if (out.length) return out;

    const legacy = scorePoints(records, 'testScore', 'testMax');
    return legacy.length ? [{ label: '시험', color: 'var(--garnet)', pts: legacy }] : [];
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

  /**
   * 영역별 진도 줄. 진도가 적힌 영역만 나온다.
   * 영역이 하나도 없는 옛 기록은 예전처럼 progress 한 줄로 보여준다.
   */
  function progressRows(r) {
    const lines = PA.areaLines(r);
    if (!lines.length) return row('진도', r.progress);

    return lines.map(function (l) {
      const book = l.book ? '<span class="gi-area-book">' + esc(l.book) + '</span> · ' : '';
      return '<div class="gi-rec-row"><dt>' + esc(l.label) + '</dt><dd>' +
        book + esc(l.progress) + '</dd></div>';
    }).join('');
  }

  /** 한 줄 안에 영역별 항목을 여러 개 담는다. 진도 줄과 이름이 겹쳐 보이지 않게. */
  function groupRow(label, items) {
    if (!items.length) return '';
    const body = items.map(function (it) {
      return '<div><span class="gi-area-book">' + esc(it.label) + '</span> ' + esc(it.text) + '</div>';
    }).join('');
    return '<div class="gi-rec-row"><dt>' + label + '</dt><dd>' + body + '</dd></div>';
  }

  function testRows(r) {
    const lines = PA.testLines(r);
    if (lines.length) {
      return groupRow('시험', lines.map(function (l) {
        return { label: l.label, text: l.score + '/' + l.max };
      }));
    }

    // 시험이 단어·듣기로 나뉘기 전에 쌓인 기록.
    const scoreText = (r.testScore !== '' && r.testMax !== '')
      ? (r.testName ? r.testName + ' ' : '') + r.testScore + '/' + r.testMax
      : '';
    return row('시험', scoreText);
  }

  function nextRows(r) {
    const lines = PA.nextLines(r);
    if (lines.length) {
      return groupRow('다음 과제', lines.map(function (l) {
        return { label: l.label, text: l.text };
      }));
    }
    return row('다음 과제', r.nextHomework);
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
          '<span class="gi-rec-date">' + esc(r.date.slice(5).replace('-', '/')) + '</span>' +
          '<span class="gi-rec-progress">' + esc(PA.areaSummary(r) || '진도 미기록') + '</span>' +
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
