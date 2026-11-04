/**
 * 학부모 응답 정형화.
 *
 * 반드시 allowlist로 고른다. 삭제(blacklist) 방식은 시트에 새 컬럼이
 * 늘어날 때 조용히 유출되므로 쓰지 않는다.
 */

// 진도 영역 필드는 일부러 하나씩 적는다. records.js의 PROGRESS_FIELDS를
// 이어 붙이면 그쪽에 필드가 늘 때 학부모에게 조용히 새어 나간다. 두 목록이
// 어긋나지 않는지는 test/field-parity.test.js가 확인한다.
const PARENT_RECORD_FIELDS = [
  'date',
  // 'regular' 정규수업 · 'exam' 시험대비. 화면이 꼬리표를 달고, 시험대비는
  // 시험·진도·숙제 세 줄만 그린다.
  'kind',
  'examTests',
  'examItems',
  'examNext',
  'sessionNo',
  'progress',
  'vocabBook',
  'vocabProgress',
  'readingBook',
  'readingProgress',
  'grammarBook',
  'grammarProgress',
  'listeningBook',
  'listeningProgress',
  'etcBook',
  'etcProgress',
  'vocabNextBook',
  'vocabNext',
  'readingNextBook',
  'readingNext',
  'grammarNextBook',
  'grammarNext',
  'listeningNextBook',
  'listeningNext',
  'etcNextBook',
  'etcNext',
  'vocabTestBook',
  'vocabTestScore',
  'vocabTestMax',
  'vocab2TestBook',
  'vocab2TestScore',
  'vocab2TestMax',
  'grammarTestBook',
  'grammarTestScore',
  'grammarTestMax',
  'listeningTestBook',
  'listeningTestScore',
  'listeningTestMax',
  'homeworkStatus',
  'homeworkLevel',
  'testName',
  'testScore',
  'testMax',
  'attendance',
  'nextHomework',
  'comment',
];

function toParentRecord(row) {
  const src = row || {};
  const out = {};
  PARENT_RECORD_FIELDS.forEach(function (f) {
    out[f] = src[f] === null || src[f] === undefined ? '' : src[f];
  });
  return out;
}

function toParentStudent(student, className) {
  const s = student || {};
  return {
    name: s.name || '',
    grade: s.grade || '',
    className: className || '',
  };
}

function filled_(v) {
  if (v === '' || v === null || v === undefined) return false;
  return String(v).trim() !== '';
}

/**
 * 학부모 화면에 낼 만한 기록인가 — 그날 수업이 있었다는 자취가 하나라도
 * 남은 날. 진도 · 시험 · 숙제 · 코멘트 중 하나라도 있으면 낸다.
 *
 * 넷 다 없는 날은 수업이 없던 날이다. 날짜만 열었다가 그대로 저장된 날이
 * 목록에 남으면 학부모가 열어 봐야 읽을 것이 없다.
 *
 * 결석은 그 자체가 그날의 기록이라 따로 통과시킨다. 화면에서도 진도 자리에
 * '결석'이라고 낸다.
 *
 * 교재는 근거가 아니다 — 직전 수업 값이 자동으로 채워지므로 그날 그 영역을
 * 했다는 뜻이 되지 못한다.
 *
 * 시험은 점수와 만점이 함께 있어야 기록으로 본다. 0점은 기록이다 —
 * "안 봤음"으로 뭉개면 그 줄이 통째로 사라진다.
 */
function hasParentContent_(record) {
  const rec = record || {};

  // 변경한 날은 학부모 쪽에 아예 내지 않는다. 그날 수업은 다른 날로
  // 옮겨 갔으니 그 날짜에는 전할 것이 없고, 옮겨 간 날에 그 수업이
  // 그대로 선다. 적어 둔 진도나 코멘트가 있어도 마찬가지다 — 두 날에
  // 같은 수업이 두 번 서는 쪽이 더 헷갈린다.
  //
  // 출석률에서도 이미 빼고 센다(summary.js의 RATE_EXCLUDED).
  if (rec.attendance === '변경') return false;

  // 출결을 누른 쪽이 그날 실제로 한 수업이다. 다른 칸이 비어 있어도
  // 보인다 — 왔다는 사실만으로도 학부모가 읽을 것이 있다.
  //
  // 같은 날 정규수업과 시험대비가 따로 쌓일 때, 선생님이 출결을 누른
  // 쪽만 그날 한 수업이다. 나머지 한 쪽은 회차와 교재가 자동으로 채워진
  // 채 저장되었을 뿐이라 아래 검사에서 걸러진다 — 둘 다 근거로 치지
  // 않으므로. 손으로 적은 것이 있으면 그 쪽도 함께 보인다.
  if (filled_(rec.attendance)) return true;

  // 시험대비는 적어 둔 칸이 전부다. 출결도 시험 점수도 없다.
  if (filled_(rec.examTests)) return true;
  if (filled_(rec.examItems) || filled_(rec.examNext)) return true;
  if (filled_(rec.comment)) return true;

  if (filled_(rec.progress)) return true;
  if (filled_(rec.nextHomework)) return true;

  const anyArea = progressAreaKeys_().some(function (k) {
    return filled_(rec[k + 'Progress']) || filled_(rec[k + 'Next']);
  });
  if (anyArea) return true;

  const scored = function (scoreField, maxField) {
    return filled_(rec[scoreField]) && Number(rec[maxField]) > 0;
  };
  if (scored('testScore', 'testMax')) return true;

  return testAreaKeys_().some(function (k) {
    return scored(k + 'TestScore', k + 'TestMax');
  });
}

/**
 * 함께 옮겨야 뜻이 통하는 칸 묶음.
 *
 * 교재만 옮기면 '능률보카'만 덩그러니 남고, 진도만 옮기면 무슨 책의
 * Day 12인지 알 수 없다. 점수는 만점과 함께여야 숫자가 된다.
 */
function mergeGroups_() {
  const groups = [
    ['progress'], ['nextHomework'],
    ['examTests'], ['examItems'], ['examNext'],
    ['testName', 'testScore', 'testMax'],
  ];

  progressAreaKeys_().forEach(function (k) {
    groups.push([k + 'Book', k + 'Progress']);
    groups.push([k + 'NextBook', k + 'Next']);
  });
  testAreaKeys_().forEach(function (k) {
    groups.push([k + 'TestBook', k + 'TestScore', k + 'TestMax']);
  });
  return groups;
}

/** 이 묶음에 손으로 적은 것이 있는가. 교재는 근거가 아니다. */
function groupFilled_(rec, group) {
  const score = group.filter(function (f) { return /[Tt]estScore$/.test(f); })[0];
  if (score) {
    const max = group.filter(function (f) { return /[Tt]estMax$/.test(f); })[0];
    return filled_(rec[score]) && Number(rec[max]) > 0;
  }
  return group.some(function (f) {
    return !/Book$/.test(f) && filled_(rec[f]);
  });
}

/**
 * 출결을 누르지 않은 기록의 내용을 누른 기록에 옮긴다.
 *
 * 같은 날 정규수업과 시험대비가 따로 쌓인다. 선생님이 출결을 누른 쪽이
 * 그날 실제로 한 수업이고, 다른 쪽은 회차와 교재가 자동으로 채워진 채
 * 저장되었을 뿐이다. 그런데 거기에 손으로 적은 진도나 숙제가 있으면
 * 그것도 그날 한 것이다 — 줄을 따로 세우는 대신 한 줄 안에 담는다.
 *
 * 줄이 둘이면 학부모는 어느 쪽이 '진짜' 그날인지부터 가려야 한다.
 *
 * 이미 찬 칸은 덮어쓰지 않는다. 코멘트만은 둘 다 남긴다 — 한마디를
 * 말없이 지우면 선생님은 적은 줄 알고 학부모는 읽지 못한다.
 */
function mergeSameDay_(records) {
  const byDate = {};
  const out = [];

  (records || []).forEach(function (r) {
    const date = String((r && r.date) || '');
    const host = byDate[date];

    // 출결을 누른 기록이 그날의 주인이다. 하루에 하나뿐이면 주인이 되고,
    // 둘 다 눌렀으면 둘 다 그날 한 수업이라 합치지 않는다.
    if (!host) {
      byDate[date] = r;
      out.push(r);
      return;
    }
    const hostHas = filled_(host.attendance);
    const mineHas = filled_(r.attendance);
    if (hostHas === mineHas) {
      out.push(r);
      return;
    }

    const keep = hostHas ? host : r;
    const drop = hostHas ? r : host;

    mergeGroups_().forEach(function (g) {
      if (!groupFilled_(drop, g) || groupFilled_(keep, g)) return;
      g.forEach(function (f) { keep[f] = drop[f]; });
    });
    if (filled_(drop.comment)) {
      keep.comment = filled_(keep.comment)
        ? String(keep.comment) + '\n' + String(drop.comment)
        : drop.comment;
    }

    byDate[date] = keep;
    if (keep !== host) out[out.indexOf(host)] = keep;
  });

  return out;
}

function toParentPayload(input) {
  const opts = input || {};
  const records = (Array.isArray(opts.records) ? opts.records.slice() : [])
    .sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    })
    .map(toParentRecord);

  // 요약은 거르기 전 전체로 낸다. 결석한 날은 진도도 시험도 없어 목록에서
  // 빠지는데, 빠진 채로 출석률을 내면 결석이 지워져 100%가 되어 버린다.
  const summary = computeSummary(records, '');

  // 출결·숙제는 누적과 이달을 나란히 낸다. 이달 기록이 없으면 null이고,
  // 그때는 옆의 누적 숫자가 있으니 빈 칸으로 보여도 오해가 없다.
  const monthKey = opts.monthKey || '';
  const month = monthKey ? computeSummary(records, monthKey) : null;
  summary.monthKey = monthKey;
  summary.monthAttendanceRate = month ? month.attendanceRate : null;
  summary.monthHomeworkRate = month ? month.homeworkRate : null;

  // 지난달. 92%가 잘한 것인지 아닌지는 비교할 것이 있어야 안다. 견줄
  // 상대는 지난달의 자기 자신이다 — 다른 학생과 견주는 숫자는 내려보내지
  // 않는다.
  const prevKey = prevMonthKey_(monthKey);
  const prev = prevKey ? computeSummary(records, prevKey) : null;
  summary.prevAttendanceRate = prev ? prev.attendanceRate : null;
  summary.prevHomeworkRate = prev ? prev.homeworkRate : null;
  summary.monthTests = testAvgsOf_(month);
  summary.prevTests = testAvgsOf_(prev);


  return {
    student: toParentStudent(opts.student, opts.className),
    summary: summary,
    // 합치기는 거른 뒤가 아니라 거르기 전에 한다. 먼저 거르면 출결 없는
    // 기록이 사라지면서 거기 적힌 진도도 함께 사라진다.
    records: mergeSameDay_(records).filter(hasParentContent_),
  };
}

/** 'yyyy-MM'의 한 달 앞. 1월 앞은 지난해 12월이다. 읽을 수 없으면 빈 값. */
function prevMonthKey_(monthKey) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ''));
  if (!m) return '';

  const year = Number(m[1]);
  const mon = Number(m[2]);
  return mon > 1
    ? year + '-' + ('0' + (mon - 1)).slice(-2)
    : (year - 1) + '-12';
}

/** 요약 한 벌에서 시험 묶음 평균만 추린다. 없으면 빈 객체. */
function testAvgsOf_(summary) {
  const out = {};
  if (!summary) return out;

  testSummaryGroups_().forEach(function (g) {
    out[g.key] = summary[g.key + 'Avg'];
  });
  return out;
}

/**
 * 그 학생의 첫 수업 날짜 'yyyy-MM-dd'.
 *
 * 출결을 적어 둔 날 중 가장 이른 날이다. 출결이 그 학생이 실제로 그날
 * 수업을 했다는 유일한 자취다 — 회차나 교재만 자동으로 채워진 채 저장된
 * 날은 수업을 한 날이 아니다.
 *
 * 그 앞은 요일·시간만으로 그려지므로, 다니지도 않던 때의 수업이 달력에
 * 가득 찬 것처럼 보인다.
 *
 * 적어 둔 출결이 하나도 없으면 빈 값이다 — 자를 자리가 없다.
 */
function parentFirstDate_(records) {
  let first = '';

  (records || []).forEach(function (r) {
    const d = String((r && r.date) || '');
    if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return;
    if (!filled_(r && r.attendance)) return;
    if (!first || d < first) first = d;
  });
  return first ? first.slice(0, 10) : '';
}

/**
 * 그 학생의 달력이 시작하는 달 'yyyy-MM'.
 *
 * 첫 수업이 있는 달이다. 그 수업이 아직 없으면 등록한 달로, 그것도
 * 없으면 빈 값으로 둔다 — 화면이 이번 달을 쓴다.
 */
function parentFirstMonth_(student, records) {
  const first = parentFirstDate_(records);
  if (first) return first.slice(0, 7);

  const made = String((student && student.createdAt) || '');
  return /^\d{4}-\d{2}/.test(made) ? made.slice(0, 7) : '';
}

/**
 * 학부모 달력이 쓰는 것만 추려 낸다 — 평소 일정 한 줄, 그 학생의 하루치
 * 조각, 날짜별 출결이다.
 *
 * 기록 전체를 다시 쓰지 않는다. 달력 칸에 적는 것은 그날 왔는지와 몇
 * 회차인지뿐이고, 코멘트·진도는 아래 수업 기록 탭이 이미 담고 있다.
 *
 * 거르기 전 기록을 받는다. 결석한 날은 진도도 코멘트도 없어 학부모 목록에서
 * 빠지는데, 달력에서는 빠진 그날이야말로 보여야 하는 칸이다.
 */
function toParentCalendar(input) {
  const opts = input || {};
  const student = opts.student || {};
  const sid = String(student.studentId == null ? '' : student.studentId);

  const marks = {};
  (opts.records || []).forEach(function (r) {
    const date = String((r && r.date) || '');
    const attendance = String((r && r.attendance) || '');
    if (!date || !attendance) return;

    marks[date] = {
      attendance: attendance,
      sessionNo: r.sessionNo === null || r.sessionNo === undefined ? '' : String(r.sessionNo),
    };
  });

  return {
    schedule: String(student.schedule == null ? '' : student.schedule),
    firstMonth: parentFirstMonth_(student, opts.records),
    // 첫 수업 날짜. 그 달 안에서도 첫 수업 앞의 날에는 줄을 세우지
    // 않는다 — 달만 맞추면 그 달 1일부터 수업이 있던 것처럼 보인다.
    firstDate: parentFirstDate_(opts.records),
    // 하루치 조각은 그 학생 것만 내려보낸다. 다른 학생의 보강·결석이
    // 학부모 쪽으로 새어 나갈 길을 아예 두지 않는다.
    overrides: (opts.overrides || [])
      .filter(function (o) { return o && String(o.studentId) === sid; })
      .map(function (o) {
        return {
          overrideId: String(o.overrideId),
          date: String(o.date),
          studentId: sid,
          time: String(o.time || ''),
          kind: String(o.kind),
          reason: String(o.reason || ''),
        };
      }),
    marks: marks,
  };
}

if (typeof module !== 'undefined') {
  /* eslint-disable no-var */
  var computeSummary = require('./summary.js').computeSummary;
  var testAreaKeys_ = require('./records.js').testAreaKeys_;
  var progressAreaKeys_ = require('./records.js').progressAreaKeys_;
  var testSummaryGroups_ = require('./records.js').testSummaryGroups_;
  module.exports = {
    PARENT_RECORD_FIELDS,
    toParentRecord,
    toParentStudent,
    toParentPayload,
    toParentCalendar,
    parentFirstMonth_,
    parentFirstDate_,
    hasParentContent_,
    mergeSameDay_,
  };
}

// 주의: 위 var를 const/let으로 바꾸지 말 것.
//
// GAS는 모든 파일이 하나의 전역 스코프를 공유하므로 summary.js의
// computeSummary를 그냥 호출하면 된다. Node에서는 가드 블록 안의
// require가 그 이름을 채워야 한다.
//
// var는 블록이 아니라 모듈 스코프로 호이스팅되므로 toParentPayload가
// 볼 수 있고, 할당은 파일 로드 시점에 끝난다. GAS에서는 블록이
// 실행되지 않지만 var computeSummary;(할당 없는 재선언)는 이미 존재하는
// 전역 함수를 덮어쓰지 않으므로 안전하다.
//
// const로 바꾸면 if 블록에 갇혀 Node에서 toParentPayload가 참조하지
// 못한다.
