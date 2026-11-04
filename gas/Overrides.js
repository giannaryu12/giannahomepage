/**
 * 하루치 일정 변경 — 달력에서 그날만 학생을 넣거나 뺀다.
 *
 * 학생마다 적어 둔 요일·시간은 평소 일정이다. 보강·휴강·시간 한 번 바꾸기는
 * 평소 일정을 고칠 일이 아니다 — 고치면 지난 달력까지 같이 바뀐다.
 * 그래서 그날 하루에만 얹는 조각으로 따로 쌓는다.
 *
 * kind:
 *   add  — 그날 그 시간에 온다 (보충)
 *   skip — 그날은 오지 않는다. 까닭을 reason에 남긴다:
 *          absent 결석 — 학생이 안 왔다
 *          moved  변경 — 다른 날로 옮겼다
 *          off    휴강 — 그날 그 수업 자체가 없다
 *          둘은 나중에 전혀 다른 뜻이 된다. 묻지 않고 빼면 달력에 왜
 *          빠졌는지가 남지 않는다.
 */

const OVERRIDES_SHEET = 'Overrides';
const OVERRIDE_HEADER = ['overrideId', 'date', 'studentId', 'time', 'kind', 'reason', 'createdAt'];

/**
 * 시트가 없으면 만든다.
 *
 * 선생님이 구글 시트에 탭을 손으로 추가하지 않아도 되게. 새 칸을 저장 직전에
 * 만드는 ensureColumns_와 같은 이유다 — 없으면 "저장했습니다"만 뜨고 값이
 * 사라지는데, 화면에는 아무 문제가 없어 보인다.
 */
function overridesSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(OVERRIDES_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(OVERRIDES_SHEET);
  sheet.getRange(1, 1, 1, OVERRIDE_HEADER.length).setValues([OVERRIDE_HEADER]);
  return sheet;
}

function listOverrides_(from, to) {
  overridesSheet_();
  return readTable(OVERRIDES_SHEET)
    .filter(function (r) {
      const d = String(r.date);
      return (!from || d >= String(from)) && (!to || d <= String(to));
    })
    .map(function (r) {
      return {
        overrideId: String(r.overrideId),
        date: String(r.date),
        studentId: String(r.studentId),
        time: String(r.time),
        kind: String(r.kind),
        reason: String(r.reason || ''),
      };
    });
}

/** 달력 한 화면이 쓰는 범위만 읽는다. 한 해치를 다 보내면 달을 넘길 때마다 느려진다. */
function handleAdminOverrides(body) {
  requireSession_(body.sessionKey);
  return ok({ overrides: listOverrides_(body.from, body.to) });
}

/** 빼는 까닭. 모르는 값은 결석으로 둔다 — 시트에 뜻 모를 글자가 쌓이지 않게. */
function skipReason_(reason) {
  const r = String(reason || '');
  return (r === 'moved' || r === 'off') ? r : 'absent';
}

function handleAdminSaveOverride(body) {
  requireSession_(body.sessionKey);

  const o = body.override || {};
  if (!o.date || !o.studentId) return fail('MISSING_PARAM', '날짜와 학생이 필요합니다.');
  if (o.kind !== 'add' && o.kind !== 'skip') return fail('MISSING_PARAM', '알 수 없는 변경 종류입니다.');

  // 까닭은 빼기에만 붙는다. 모르는 값은 결석으로 둔다 — 화면이 바뀌어도
  // 시트에 뜻 모를 글자가 쌓이지 않는다.
  const reason = o.kind === 'skip' ? skipReason_(o.reason) : '';

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    overridesSheet_();

    // 같은 날 같은 학생에 같은 종류가 두 번 쌓이면 달력에 이름이 두 번 뜬다.
    const dup = listOverrides_(o.date, o.date).filter(function (r) {
      return r.studentId === String(o.studentId) && r.kind === o.kind &&
        (o.kind === 'skip' || r.time === String(o.time || ''));
    })[0];
    if (dup) {
      // 결석으로 뺀 뒤 변경으로 고쳐 누를 수 있다. 까닭만 갈아 끼운다 —
      // 지웠다 다시 넣게 하면 잘못 누른 한 번이 두 걸음이 된다.
      if (reason && reason !== dup.reason) {
        updateRowById(OVERRIDES_SHEET, 'overrideId', dup.overrideId, { reason: reason });
        SpreadsheetApp.flush();
      }
      return ok({ overrideId: dup.overrideId });
    }

    const overrideId = 'O' + Date.now() + Utilities.getUuid().slice(0, 8);
    appendRow(OVERRIDES_SHEET, {
      overrideId: overrideId,
      date: String(o.date),
      studentId: String(o.studentId),
      time: String(o.time || ''),
      kind: o.kind,
      reason: reason,
      createdAt: new Date().toISOString(),
    });
    SpreadsheetApp.flush();
    return ok({ overrideId: overrideId });
  } finally {
    lock.releaseLock();
  }
}

function handleAdminDeleteOverride(body) {
  requireSession_(body.sessionKey);
  if (!body.overrideId) return fail('MISSING_PARAM', '지울 대상이 없습니다.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = overridesSheet_();
    const rows = readTable(OVERRIDES_SHEET);
    const target = rows.filter(function (r) {
      return String(r.overrideId) === String(body.overrideId);
    })[0];
    if (!target) return ok({ deleted: false });

    sheet.deleteRow(target._rowIndex);
    SpreadsheetApp.flush();
    return ok({ deleted: true });
  } finally {
    lock.releaseLock();
  }
}
