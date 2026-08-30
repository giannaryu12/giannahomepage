/**
 * 요청 파싱과 액션 검증. 순수 함수.
 */

const ACTIONS = {
  'parent.load':         { auth: 'token',   required: ['token'] },
  'parent.more':         { auth: 'token',   required: ['token', 'cursor'] },
  'admin.login':         { auth: 'none',    required: ['password'] },
  'admin.classes':       { auth: 'session', required: [] },
  'admin.roster':        { auth: 'session', required: ['classId', 'date'] },
  'admin.saveBatch':     { auth: 'session', required: ['classId', 'date', 'records', 'clientRequestId'] },
  'admin.students':      { auth: 'session', required: [] },
  'admin.upsertStudent': { auth: 'session', required: ['student'] },
  'admin.reissueToken':  { auth: 'session', required: ['studentId'] },
};

function ok(data) {
  return { ok: true, data: data };
}

function fail(error, message) {
  return { ok: false, error: error, message: message };
}

function isBlank(v) {
  return v === '' || v === null || v === undefined;
}

function parseRequest(rawBody) {
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return fail('BAD_JSON', '요청 형식이 올바르지 않습니다.');
  }
  if (!body || typeof body !== 'object') {
    return fail('BAD_JSON', '요청 형식이 올바르지 않습니다.');
  }

  const spec = ACTIONS[body.action];
  if (!spec) {
    return fail('UNKNOWN_ACTION', '알 수 없는 요청입니다.');
  }

  const required = spec.required.slice();
  if (spec.auth === 'session') required.push('sessionKey');

  const missing = required.filter(function (k) { return isBlank(body[k]); });
  if (missing.length) {
    return fail('MISSING_PARAM', '필수 항목이 없습니다: ' + missing.join(', '));
  }

  return { ok: true, action: body.action, auth: spec.auth, body: body };
}

if (typeof module !== 'undefined') {
  module.exports = { ACTIONS, parseRequest, ok, fail };
}
