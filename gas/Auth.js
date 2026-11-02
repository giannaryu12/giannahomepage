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

/**
 * 지금 비밀번호의 지문. 비밀번호 자체는 어디에도 남기지 않는다.
 *
 * 비밀번호를 바꾸면 지문이 달라지고, 그 순간 남아 있던 '로그인 유지'
 * 열쇠가 전부 끊긴다. 기기를 잃어버렸을 때 선생님이 쓸 수 있는 수단이다.
 */
function passwordFingerprint_(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(password), Utilities.Charset.UTF_8);

  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += ('0' + (bytes[i] & 0xff).toString(16)).slice(-2);
  }
  return hex;
}

/**
 * 오래 가는 '로그인 유지' 열쇠를 만든다.
 *
 * 세션키는 CacheService에 두는데 그쪽 보관 기한이 최대 6시간이라 날을
 * 넘기지 못한다. 그래서 이 열쇠만 ScriptProperties에 따로 적는다.
 */
function createRememberToken_(password) {
  const props = PropertiesService.getScriptProperties();
  const now = new Date();

  // 만료된 열쇠는 로그인할 때마다 한 번씩 치운다. 쌓이면 저장 한도를 먹는다.
  const stale = expiredRememberKeys_(props.getProperties(), now.toISOString());
  stale.forEach(function (key) { props.deleteProperty(key); });

  const token = secureToken_(32);
  const expiresAt = new Date(now.getTime() + REMEMBER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  props.setProperty(REMEMBER_PREFIX + token,
    serializeRemember_(expiresAt, passwordFingerprint_(password)));

  return { rememberToken: token, rememberExpiresAt: expiresAt };
}

function handleAdminLogin(body) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!expected) return fail('SERVER_ERROR', '관리자 비밀번호가 설정되지 않았습니다.');

  if (String(body.password) !== String(expected)) {
    return fail('BAD_CREDENTIALS', '비밀번호가 올바르지 않습니다.');
  }

  const session = createSession();
  const remember = createRememberToken_(expected);
  return ok({
    sessionKey: session.sessionKey,
    expiresAt: session.expiresAt,
    rememberToken: remember.rememberToken,
    rememberExpiresAt: remember.rememberExpiresAt,
  });
}

/**
 * 저장해 둔 열쇠로 다시 세션을 받는다. 비밀번호는 묻지 않는다.
 *
 * 열쇠는 돌리지 않는다. 선생님이 탭을 여럿 열어 두는 경우가 흔한데,
 * 돌리면 먼저 쓴 탭 하나만 살고 나머지가 조용히 로그아웃된다.
 */
function handleAdminResume(body) {
  const props = PropertiesService.getScriptProperties();
  const expected = props.getProperty('ADMIN_PASSWORD');
  if (!expected) return fail('SERVER_ERROR', '관리자 비밀번호가 설정되지 않았습니다.');

  const key = REMEMBER_PREFIX + String(body.rememberToken);
  const parsed = parseRemember_(props.getProperty(key));

  if (!rememberIsValid_(parsed, new Date().toISOString(), passwordFingerprint_(expected))) {
    if (parsed) props.deleteProperty(key);
    return fail('UNAUTHORIZED', '로그인 유지 기간이 지났습니다. 비밀번호를 다시 입력해 주세요.');
  }

  return ok(createSession());
}

/** 이 기기의 열쇠만 버린다. 다른 기기는 그대로 둔다. */
function forgetRememberToken_(token) {
  if (!token) return;
  PropertiesService.getScriptProperties().deleteProperty(REMEMBER_PREFIX + String(token));
}

/** 이 기기에서 나간다. 세션과 열쇠를 함께 버린다. */
function handleAdminLogout(body) {
  requireSession_(body.sessionKey);
  forgetRememberToken_(body.rememberToken);
  CacheService.getScriptCache().remove('session:' + body.sessionKey);
  return ok({ loggedOut: true });
}

/** 학부모 토큰으로 학생을 찾는다. 비활성 학생은 없는 것으로 취급한다. */
function findStudentByToken(token) {
  const student = findRow(SHEETS.STUDENTS, 'parentToken', token);
  if (!student) return null;
  if (String(student.active).toUpperCase() !== 'TRUE') return null;
  return student;
}
