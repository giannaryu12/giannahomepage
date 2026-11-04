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

/**
 * 그 학생이 마지막으로 쓴 시험대비 칸 구성. 없으면 빈 목록이다.
 *
 * 가장 최근 시험대비 기록의 칸 이름만 뽑는다. 따로 저장해 두지 않는
 * 까닭: 구성은 결국 "지난번에 뭘 했나"이고, 그 답은 이미 기록에 있다.
 * 칸 목록을 또 어딘가에 적어 두면 기록과 어긋날 자리가 하나 생긴다.
 */
function lastExamTemplateOf_(records) {
  const exams = (records || [])
    .filter(function (r) { return recordKind_(r && r.kind) === 'exam'; })
    .sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });

  const last = exams[0];
  return {
    tests: itemTemplate(parseItems(last && last.examTests)),
    items: itemTemplate(parseItems(last && last.examItems)),
    next: itemTemplate(parseItems(last && last.examNext)),
  };
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
        // 그날 앞의 기록만 본다. 보충을 끼워 넣을 때 그 뒤 수업의
        // 회차를 받아 오면 두 날이 같은 회차가 된다.
        lastSessionNo: lastSessionNoOf(mine, body.date),
        // 시험대비 칸 구성. 이름만 물려준다 — 칸은 학생마다 다르고
        // 잘 바뀌지 않지만, 지난주에 푼 교재·범위까지 따라오면 하지 않은
        // 수업이 기록에 남는다.
        lastExam: lastExamTemplateOf_(mine),
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

  // 요약의 본체는 늘 전체 기록이다. monthKey는 그 옆에 함께 내려보내는
  // '이달' 숫자에만 쓴다. 예전에는 요약 전체를 이번 달로 잘랐는데, 그러면
  // 달이 바뀌는 1일마다 카드가 전부 '기록 없음'이 됐다.
  //
  // toISOString은 UTC라 한국 시각 1일 오전에 아직 지난달로 잡힌다.
  // 스크립트 표준시간대(Asia/Seoul)로 뽑는다.
  const monthKey = body.monthKey ||
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM');

  const records = recordsOfStudent_(student.studentId);

  const payload = toParentPayload({
    student: student,
    className: classNameOf_(student.classId),
    records: records,
    monthKey: monthKey,
  });

  // 달력은 평소 일정 + 하루치 조각 + 출결로 그린다. 한 달을 넘길 때마다
  // 다시 묻지 않도록 한 번에 내려보낸다 — 학부모 쪽에는 새로 고치기밖에
  // 없어서, 묻는 길이 늘면 그만큼 기다리는 화면이 늘어난다.
  payload.calendar = toParentCalendar({
    student: student,
    records: records,
    overrides: listOverrides_('', ''),
    vacations: readVacations_(),
  });

  return ok(payload);
}

/**
 * 달력에 찍을 출결만. 한 달치를 가볍게 읽는다.
 *
 * 기록 전체를 돌려주면 코멘트와 진도까지 딸려 와 한 달이 수백 KB가 된다.
 * 달력이 쓰는 건 그날 그 학생이 왔는지와 몇 회차인지뿐이다.
 */
function handleAdminAttendance(body) {
  requireSession_(body.sessionKey);

  const from = String(body.from || '');
  const to = String(body.to || '');

  const marks = readTable(SHEETS.RECORDS)
    .filter(function (r) {
      const d = String(r.date);
      return (!from || d >= from) && (!to || d <= to) && String(r.attendance || '') !== '';
    })
    .map(function (r) {
      return {
        date: String(r.date),
        studentId: String(r.studentId),
        attendance: String(r.attendance),
        sessionNo: r.sessionNo === '' || r.sessionNo === null || r.sessionNo === undefined
          ? '' : String(r.sessionNo),
        // 그날 그 수업을 한 시각. 적어 둔 날은 요일표가 바뀌어도
        // 이 시각 그대로 선다.
        classTime: String(r.classTime || ''),
      };
    });

  return ok({ marks: marks });
}

/**
 * 출결 한 칸만 고친다. 달력의 하루 칸에서 쓴다.
 *
 * saveBatch를 쓰지 않는 이유: 그쪽은 레코드 한 건을 통째로 다시 쓴다.
 * 출결만 보내면 진도·시험·코멘트가 빈 문자열로 덮여 사라진다. 여기서는
 * 있는 행의 출결(과 회차)만 건드리고 나머지 칸은 손대지 않는다.
 *
 * 그날 기록이 없으면 새로 만든다 — 달력에서 출결만 찍어 두고 나중에
 * 기록 화면에서 나머지를 채우는 쓰임을 막지 않는다.
 */
function handleAdminSetAttendance(body) {
  requireSession_(body.sessionKey);

  const studentId = String(body.studentId || '');
  const date = String(body.date || '');
  const attendance = String(body.attendance || '');
  // 그날 달력에 서 있던 시각. 화면이 보내 준다 — 서버는 요일표를
  // 다시 풀지 않는다(그 셈은 schedule.js 한 곳에만 둔다).
  const classTime = String(body.time || '');
  if (!studentId || !date) return fail('MISSING_PARAM', '학생과 날짜가 필요합니다.');

  // 빈 값은 '아직 안 적음'으로 되돌리는 것이다.
  if (attendance && ATTENDANCE.indexOf(attendance) === -1) {
    return fail('INVALID_RECORD', '알 수 없는 출결입니다.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rows = readTable(SHEETS.RECORDS);
    const mine = rows.filter(function (r) { return String(r.studentId) === studentId; });
    const today = mine.filter(function (r) { return String(r.date) === date; })[0];

    // 수업을 안 한 날은 회차를 세지 않는다. 적어 둔 숫자가 있으면 비운다.
    // 다시 출석으로 돌리면 그날 앞의 기록에서 이어 간다.
    const sessionNo = isOffDay_(attendance) || !attendance
      ? ''
      : (today && today.sessionNo) || (lastSessionNoOf(mine, date) + 1);

    if (today) {
      const patch = {
        attendance: attendance,
        sessionNo: sessionNo,
        updatedAt: new Date().toISOString(),
      };
      // 시각을 안 보냈으면 적어 둔 것을 그대로 둔다. 빈 값으로 덮으면
      // 지난 수업이 다시 요일표를 따라가 버린다.
      if (classTime) patch.classTime = classTime;
      updateRowById(SHEETS.RECORDS, 'recordId', today.recordId, patch);
      SpreadsheetApp.flush();
      return ok({ recordId: today.recordId, sessionNo: sessionNo });
    }

    const student = readTable(SHEETS.STUDENTS).filter(function (s) {
      return String(s.studentId) === studentId;
    })[0];
    if (!student) return fail('INVALID_RECORD', '학생을 찾을 수 없습니다.');

    const now = new Date();
    const recordId = generateRecordId(now);
    appendRow(SHEETS.RECORDS, {
      recordId: recordId,
      studentId: studentId,
      classId: student.classId || '',
      date: date,
      attendance: attendance,
      sessionNo: sessionNo,
      classTime: classTime,
      clientRequestId: 'cal-' + recordId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    SpreadsheetApp.flush();
    return ok({ recordId: recordId, sessionNo: sessionNo });
  } finally {
    lock.releaseLock();
  }
}
