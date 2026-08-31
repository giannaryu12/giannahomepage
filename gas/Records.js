/**
 * 수업 기록 조회·저장.
 *
 * (studentId, date)를 유일 키로 삼아 upsert한다. 같은 날 같은 학생을
 * 두 번 저장해도 행이 늘지 않는다.
 *
 * 멱등성은 이 (studentId, date) upsert가 전부 책임진다. clientRequestId를
 * CacheService에 기록해 두었다가 같은 id면 저장을 건너뛰는 분기가 있었지만
 * 지웠다. 프런트는 클릭할 때마다 새 id를 만들고 쓰기를 재시도하지 않아서
 * 도달할 수 없었고, 만에 하나 걸리면 수정된 기록을 저장하지 않은 채
 * 성공을 돌려주는 함정이었다. clientRequestId 자체는 어느 배치에서 쓴
 * 행인지 추적하려고 Records에 계속 기록한다.
 */

function recordsOfStudent_(studentId) {
  return readTable(SHEETS.RECORDS).filter(function (r) {
    return String(r.studentId) === String(studentId);
  });
}

function handleAdminRoster(body) {
  requireSession_(body.sessionKey);

  // Records는 한 번만 읽는다. 그날 기록과 직전 교재를 여기서 함께 뽑는다.
  const allRecords = readTable(SHEETS.RECORDS);

  const students = readTable(SHEETS.STUDENTS)
    .filter(function (s) {
      return String(s.classId) === String(body.classId)
        && String(s.active).toUpperCase() === 'TRUE';
    })
    .map(function (s) {
      const mine = allRecords.filter(function (r) {
        return String(r.studentId) === String(s.studentId);
      });
      return {
        studentId: s.studentId,
        name: s.name,
        grade: s.grade,
        lastBooks: lastBooksOf(mine),
        lastSessionNo: lastSessionNoOf(mine),
      };
    });

  const existing = allRecords.filter(function (r) {
    return String(r.classId) === String(body.classId)
      && String(r.date) === String(body.date);
  });

  return ok({ students: students, existingRecords: existing });
}

function handleAdminSaveBatch(body) {
  requireSession_(body.sessionKey);

  const clientRequestId = body.clientRequestId;
  if (typeof clientRequestId !== 'string' || clientRequestId.length < 1 || clientRequestId.length > 200) {
    return fail('MISSING_PARAM', 'clientRequestId가 올바르지 않습니다.');
  }

  const problems = validateBatch(body.records);
  if (problems.length) {
    return fail('INVALID_RECORD',
      problems.length + '건의 입력이 올바르지 않습니다: ' + problems[0].errors.join(', '));
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const now = new Date().toISOString();

    // Records 시트는 요청당 한 번만 읽는다. 예전에는 레코드마다 시트 전체를
    // 다시 읽고 셀 단위로 setValue 해서, 한 반(20명)이면 전체 읽기 20회 +
    // setValue 280회가 나갔고 프런트의 15초 타임아웃을 넘길 수 있었다.
    const view = readTableView_(SHEETS.RECORDS);

    // 진도 영역 컬럼이 아직 없으면 여기서 만든다. 없는 채로 쓰면 값이
    // 조용히 버려지면서 저장에 성공한 것처럼 보인다.
    const header = ensureColumns_(view.sheet, view.header,
      RECORD_AREA_FIELDS.concat(RECORD_EXTRA_FIELDS));

    const plan = planRecordBatch({
      existingRows: view.rows,
      records: body.records,
      classId: body.classId,
      clientRequestId: clientRequestId,
      now: now,
      newIdFn: function () { return generateRecordId(new Date()); },
    });

    plan.updates.forEach(function (u) {
      writeRowValues_(view.sheet, header, u.rowIndex, u.row);
    });
    appendRowsValues_(view.sheet, header, plan.appends);

    SpreadsheetApp.flush();
    return ok({ saved: plan.saved });
  } finally {
    lock.releaseLock();
  }
}

function handleParentLoad(body) {
  const student = findStudentByToken(body.token);

  // 토큰이 없는 경우와 있는 경우의 문구를 동일하게 유지한다.
  // 토큰의 유효성 자체를 알려주지 않기 위함이다.
  if (!student) {
    return fail('NOT_FOUND', '링크가 올바르지 않거나 만료되었습니다. 선생님께 문의해 주세요.');
  }

  const monthKey = body.monthKey || new Date().toISOString().slice(0, 7);

  return ok(toParentPayload({
    student: student,
    className: classNameOf_(student.classId),
    records: recordsOfStudent_(student.studentId),
    monthKey: monthKey,
  }));
}
