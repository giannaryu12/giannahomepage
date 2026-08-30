/**
 * 학생·반 조회와 학생 등록/수정/토큰 재발급.
 */

function listClasses_() {
  return readTable(SHEETS.CLASSES)
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

  const students = readTable(SHEETS.STUDENTS).map(function (s) {
    return {
      studentId: s.studentId,
      name: s.name,
      grade: s.grade,
      classId: s.classId,
      className: classNameOf_(s.classId),
      parentToken: s.parentToken,
      active: String(s.active).toUpperCase() !== 'FALSE',
      note: s.note,
    };
  });
  return ok({ students: students, classes: listClasses_() });
}

function handleAdminUpsertStudent(body) {
  requireSession_(body.sessionKey);

  const input = body.student || {};
  if (!input.name) return fail('MISSING_PARAM', '학생 이름은 필수입니다.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (input.studentId) {
      const updated = updateRowById(SHEETS.STUDENTS, 'studentId', input.studentId, {
        name: input.name,
        grade: input.grade || '',
        classId: input.classId || '',
        active: input.active === false ? 'FALSE' : 'TRUE',
        note: input.note || '',
      });
      if (!updated) return fail('NOT_FOUND', '학생을 찾을 수 없습니다.');
      return ok({ studentId: input.studentId });
    }

    const existingIds = readTable(SHEETS.STUDENTS).map(function (s) { return s.studentId; });
    const studentId = nextStudentId(existingIds);

    appendRow(SHEETS.STUDENTS, {
      studentId: studentId,
      name: input.name,
      grade: input.grade || '',
      classId: input.classId || '',
      parentToken: generateToken(),
      active: 'TRUE',
      note: input.note || '',
      createdAt: new Date().toISOString(),
    });
    return ok({ studentId: studentId });
  } finally {
    lock.releaseLock();
  }
}

function handleAdminReissueToken(body) {
  requireSession_(body.sessionKey);

  const token = generateToken();
  const updated = updateRowById(SHEETS.STUDENTS, 'studentId', body.studentId, { parentToken: token });
  if (!updated) return fail('NOT_FOUND', '학생을 찾을 수 없습니다.');
  return ok({ parentToken: token });
}
