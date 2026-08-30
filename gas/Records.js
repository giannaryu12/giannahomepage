/**
 * 수업 기록 조회·저장.
 *
 * (studentId, date)를 유일 키로 삼아 upsert한다. 같은 날 같은 학생을
 * 두 번 저장해도 행이 늘지 않는다.
 */

const DEDUP_TTL_SECONDS = 10 * 60;

function recordsOfStudent_(studentId) {
  return readTable(SHEETS.RECORDS).filter(function (r) {
    return String(r.studentId) === String(studentId);
  });
}

function handleAdminRoster(body) {
  requireSession_(body.sessionKey);

  const students = readTable(SHEETS.STUDENTS)
    .filter(function (s) {
      return String(s.classId) === String(body.classId)
        && String(s.active).toUpperCase() !== 'FALSE';
    })
    .map(function (s) {
      return { studentId: s.studentId, name: s.name, grade: s.grade };
    });

  const existing = readTable(SHEETS.RECORDS).filter(function (r) {
    return String(r.classId) === String(body.classId)
      && String(r.date) === String(body.date);
  });

  return ok({ students: students, existingRecords: existing });
}

function handleAdminSaveBatch(body) {
  requireSession_(body.sessionKey);

  const cache = CacheService.getScriptCache();
  const dedupKey = 'req:' + body.clientRequestId;
  const seen = cache.get(dedupKey);
  if (seen) return ok({ saved: Number(seen), deduped: true });

  const problems = validateBatch(body.records);
  if (problems.length) {
    return fail('INVALID_RECORD',
      problems.length + '건의 입력이 올바르지 않습니다: ' + problems[0].errors.join(', '));
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const now = new Date().toISOString();
    const existing = readTable(SHEETS.RECORDS);
    let saved = 0;

    body.records.forEach(function (rec) {
      const match = existing.filter(function (r) {
        return String(r.studentId) === String(rec.studentId)
          && String(r.date) === String(rec.date);
      })[0];

      const payload = {
        studentId: rec.studentId,
        classId: body.classId,
        date: rec.date,
        progress: rec.progress || '',
        homeworkStatus: rec.homeworkStatus || '',
        homeworkLevel: rec.homeworkLevel || '',
        testName: rec.testName || '',
        testScore: rec.testScore === '' || rec.testScore === null ? '' : rec.testScore,
        testMax: rec.testMax === '' || rec.testMax === null ? '' : rec.testMax,
        attendance: rec.attendance || '',
        nextHomework: rec.nextHomework || '',
        comment: rec.comment || '',
        clientRequestId: body.clientRequestId,
        updatedAt: now,
      };

      if (match) {
        updateRowById(SHEETS.RECORDS, 'recordId', match.recordId, payload);
      } else {
        payload.recordId = generateRecordId(new Date());
        payload.createdAt = now;
        appendRow(SHEETS.RECORDS, payload);
      }
      saved++;
    });

    cache.put(dedupKey, String(saved), DEDUP_TTL_SECONDS);
    return ok({ saved: saved });
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
