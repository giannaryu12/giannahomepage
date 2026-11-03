/**
 * 해가 바뀌면 학년을 한 칸 올린다. 순수 함수 — SpreadsheetApp을 쓰지 않는다.
 *
 * 시트에는 학년을 '초5'처럼 짧게 적는다 (화면 쪽 규칙은 class-level.js).
 * 초6 다음은 중1, 중3 다음은 고1이다.
 *
 * 올린 해를 학생마다 gradeYear 칸에 적어 둔다. 이 칸이 올해와 같으면
 * 이미 올린 학생이므로 건드리지 않는다 — 선생님이 1월에 화면을 열 때마다
 * 학년이 한 칸씩 올라가면 안 된다.
 */

/** 학교급별 마지막 학년. 초등은 6학년, 중·고는 3학년에서 올라간다. */
const TOP_GRADE = { '초': 6, '중': 3, '고': 3 };

/** 올라갈 다음 학교급. 고등부 위는 없다. */
const NEXT_LEVEL = { '초': '중', '중': '고' };

const GRADE_RE = /^\s*(초|중|고)\s*([1-9])\s*$/;

/**
 * 학년 한 칸(또는 years칸) 올리기. '초6' → '중1', '중3' → '고1'.
 *
 * 읽을 수 없는 값('초', '', '6학년')은 그대로 돌려준다. 손으로 적어 둔 값을
 * 추측해서 고치면, 틀렸을 때 선생님이 뭘 잃었는지 알 수 없다.
 *
 * 고3은 그대로 둔다. 졸업을 자동으로 처리하지 않는다 — 수능이 끝나고도
 * 다니는 학생이 있고, 비활성화는 선생님이 판단할 일이다.
 */
function promoteGrade(grade, years) {
  const n = Math.max(0, Math.floor(Number(years) || 0));
  let cur = String(grade == null ? '' : grade).trim();

  for (let i = 0; i < n; i++) {
    const m = GRADE_RE.exec(cur);
    if (!m) return cur;

    const mark = m[1];
    const num = Number(m[2]);

    if (num < TOP_GRADE[mark]) { cur = mark + (num + 1); continue; }

    const next = NEXT_LEVEL[mark];
    if (!next) return cur;
    cur = next + '1';
  }

  return cur;
}

/**
 * 올려야 할 학생만 골라 쓸 값을 만든다. 쓸 것이 없으면 빈 배열이다.
 *
 * gradeYear가 비어 있는 학생은 올리지 않고 올해를 적어 둔다. 이 칸이
 * 생기기 전에 등록된 학생들인데, 비었다고 올려 버리면 칸을 만든 그날
 * 모든 학생의 학년이 한 칸 틀어진다.
 *
 * 몇 해를 건너뛴 학생(2년 동안 안 열어 본 시트)은 그만큼 올린다.
 */
function planPromotions(students, year) {
  const now = Number(year);
  if (!isFinite(now) || now <= 0) return [];

  const out = [];

  (students || []).forEach(function (s) {
    if (!s || s.studentId === '' || s.studentId === undefined || s.studentId === null) return;

    const was = Number(s.gradeYear);

    if (!isFinite(was) || was <= 0) {
      out.push({ studentId: s.studentId, grade: String(s.grade == null ? '' : s.grade), gradeYear: now });
      return;
    }

    if (was >= now) return;

    out.push({
      studentId: s.studentId,
      grade: promoteGrade(s.grade, now - was),
      gradeYear: now,
    });
  });

  return out;
}

if (typeof module !== 'undefined') {
  module.exports = { promoteGrade, planPromotions };
}
