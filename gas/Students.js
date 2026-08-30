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

  const students = readTable(SHEETS.STUDENTS).map(function (s) {
    return {
      studentId: s.studentId,
      name: s.name,
      grade: s.grade,
      classId: s.classId,
      className: names[String(s.classId)] || '',
      parentToken: s.parentToken,
      active: String(s.active).toUpperCase() === 'TRUE',
      note: s.note,
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
      classId: input.classId || '',
      parentToken: secureToken_(32),
      active: 'TRUE',
      note: input.note || '',
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
