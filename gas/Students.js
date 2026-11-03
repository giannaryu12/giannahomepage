/**
 * 학생·반 조회와 학생 등록/수정/토큰 재발급.
 */

/** rows를 넘기면 시트를 다시 읽지 않는다. */
function listClasses_(rows) {
  return (rows || readTable(SHEETS.CLASSES))
    .filter(function (c) { return String(c.active).toUpperCase() !== 'FALSE'; })
    .map(function (c) {
      return { classId: c.classId, className: c.className, schedule: c.schedule };
    });
}

function classNameOf_(classId) {
  const row = findRow(SHEETS.CLASSES, 'classId', classId);
  return row ? row.className : '';
}


/**
 * 지금 몇 해인가. 스크립트 시간대(Asia/Seoul)로 읽는다.
 *
 * new Date().getFullYear()를 쓰지 않는 이유: GAS 서버는 UTC로 돌아가므로,
 * 1월 1일 0시부터 아침 9시 사이에 작년으로 읽힌다 — 승급이 꼬박 아홉 시간
 * 늦는다.
 */
function currentYear_() {
  return Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy'));
}

/**
 * 해가 바뀌었으면 학년을 올려 시트에 쓴다. 쓴 행 수를 돌려준다.
 *
 * 따로 시간 트리거를 두지 않고 선생님이 학생 목록을 열 때 한다. 트리거는
 * 조용히 죽어도 아무도 모르고, 1월 1일 새벽에 꼭 돌 필요도 없다 — 처음
 * 목록을 여는 그때 올라가 있으면 된다.
 */
function promoteIfNewYear_(rows) {
  const plan = planPromotions(rows, currentYear_());
  if (!plan.length) return 0;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    plan.forEach(function (p) {
      updateRowById(SHEETS.STUDENTS, 'studentId', p.studentId,
        { grade: p.grade, gradeYear: String(p.gradeYear) });

      // 읽어 둔 행에도 반영한다. 같은 요청이 올린 학년을 내려보내지 않으면
      // 선생님은 한 번 더 새로 고쳐야 바뀐 학년을 본다.
      rows.forEach(function (r) {
        if (String(r.studentId) === String(p.studentId)) {
          r.grade = p.grade;
          r.gradeYear = String(p.gradeYear);
        }
      });
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  return plan.length;
}

function handleAdminClasses(body) {
  requireSession_(body.sessionKey);
  return ok({ classes: listClasses_() });
}

/** 선생님 화면용 — 토큰을 포함한다. 학부모에게는 절대 이 형태를 주지 않는다. */
function handleAdminStudents(body) {
  requireSession_(body.sessionKey);

  // Classes는 학생 수와 무관하게 딱 한 번만 읽는다.
  const classRows = readTable(SHEETS.CLASSES);
  const names = classNameMap(classRows);

  const rows = readTable(SHEETS.STUDENTS);
  promoteIfNewYear_(rows);

  const students = rows.map(function (s) {
    return {
      studentId: s.studentId,
      name: s.name,
      grade: s.grade,
      classId: s.classId,
      className: names[String(s.classId)] || '',
      parentToken: s.parentToken,
      active: String(s.active).toUpperCase() === 'TRUE',
      note: s.note,
      // 수업 요일·시간. '화 17:00, 목 19:00' 한 칸에 적는다 (schedule.js).
      schedule: s.schedule || '',
    };
  });
  return ok({ students: students, classes: listClasses_(classRows) });
}

function handleAdminUpsertStudent(body) {
  requireSession_(body.sessionKey);

  const input = body.student || {};
  if (!input.name) return fail('MISSING_PARAM', '학생 이름은 필수입니다.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (input.studentId) {
      // 요청에 없는 필드는 건드리지 않는다 (gas/lib/students.js 참고).
      // 특히 note: 프런트는 note를 보내지 않으므로, 예전처럼 ''로 덮어쓰면
      // 선생님이 시트에 직접 적은 메모가 저장할 때마다 지워졌다.
      const patch = buildStudentPatch(input);

      // 학년을 고쳤으면 올린 해도 올해로 적는다. 안 적으면 다음 1월에
      // 승급이 두 칸 올라간다 — 손으로 고친 것과 승급이 겹친다.
      if (patch.grade !== undefined) patch.gradeYear = String(currentYear_());

      const updated = updateRowById(SHEETS.STUDENTS, 'studentId', input.studentId, patch);
      if (!updated) return fail('NOT_FOUND', '학생을 찾을 수 없습니다.');
      SpreadsheetApp.flush();
      return ok({ studentId: input.studentId });
    }

    const existingIds = readTable(SHEETS.STUDENTS).map(function (s) { return s.studentId; });
    const studentId = nextStudentId(existingIds);

    appendRow(SHEETS.STUDENTS, {
      studentId: studentId,
      name: input.name,
      grade: input.grade || '',
      // 등록한 해. 이 해가 지나야 승급 대상이 된다.
      gradeYear: String(currentYear_()),
      classId: input.classId || '',
      parentToken: secureToken_(32),
      active: 'TRUE',
      note: input.note || '',
      schedule: input.schedule || '',
      createdAt: new Date().toISOString(),
    });
    SpreadsheetApp.flush();
    return ok({ studentId: studentId });
  } finally {
    lock.releaseLock();
  }
}

function handleAdminReissueToken(body) {
  requireSession_(body.sessionKey);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const token = secureToken_(32);
    const updated = updateRowById(SHEETS.STUDENTS, 'studentId', body.studentId, { parentToken: token });
    if (!updated) return fail('NOT_FOUND', '학생을 찾을 수 없습니다.');
    SpreadsheetApp.flush();
    return ok({ parentToken: token });
  } finally {
    lock.releaseLock();
  }
}
