/**
 * 인증. 학부모는 토큰 단독, 선생님은 비밀번호 + 세션키.
 *
 * 레이트리밋은 의도적으로 두지 않는다 (설계 문서 §8).
 * 대신 관리자 비밀번호를 16자 이상으로 두고, 학부모 토큰은 32자를 쓴다.
 */

const SESSION_TTL_SECONDS = 6 * 60 * 60;

function AuthError(message) {
  this.name = 'AuthError';
  this.message = message;
}
AuthError.prototype = Object.create(Error.prototype);

/** CSPRNG 기반 토큰. Utilities.getUuid()는 Math.random과 달리 예측할 수 없다. */
function secureToken_(length) {
  let hex = '';
  while (hex.length < length) hex += Utilities.getUuid().replace(/-/g, '');
  return hex.slice(0, length);
}

function createSession() {
  const key = secureToken_(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  CacheService.getScriptCache().put('session:' + key, expiresAt, SESSION_TTL_SECONDS);
  return { sessionKey: key, expiresAt: expiresAt };
}

function requireSession_(sessionKey) {
  const hit = CacheService.getScriptCache().get('session:' + sessionKey);
  if (!hit) throw new AuthError('로그인이 만료되었습니다. 다시 로그인해 주세요.');
}

function handleAdminLogin(body) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!expected) return fail('SERVER_ERROR', '관리자 비밀번호가 설정되지 않았습니다.');

  if (String(body.password) !== String(expected)) {
    return fail('BAD_CREDENTIALS', '비밀번호가 올바르지 않습니다.');
  }
  return ok(createSession());
}

/** 학부모 토큰으로 학생을 찾는다. 비활성 학생은 없는 것으로 취급한다. */
function findStudentByToken(token) {
  const student = findRow(SHEETS.STUDENTS, 'parentToken', token);
  if (!student) return null;
  if (String(student.active).toUpperCase() !== 'TRUE') return null;
  return student;
}
