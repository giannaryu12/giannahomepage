/**
 * "로그인 상태 유지" 토큰의 순수 부분.
 *
 * 선생님 기기에 오래 남는 열쇠라, 비밀번호와 같은 힘을 갖는다. 그래서
 * 저장할 때 그때의 비밀번호 지문을 함께 적어 둔다. 비밀번호를 바꾸면
 * 지문이 달라져 남아 있던 열쇠가 전부 한꺼번에 끊긴다 — 기기를 잃어버렸을
 * 때 선생님이 쓸 수 있는 유일한 수단이다.
 *
 * 저장 형태는 'expiresAt|fingerprint' 한 줄. ScriptProperties에는 문자열만
 * 넣을 수 있고, 값마다 JSON을 파싱하면 만료된 것을 치울 때 느려진다.
 */

const REMEMBER_PREFIX = 'remember:';
const REMEMBER_DAYS = 30;

function serializeRemember_(expiresAt, fingerprint) {
  return String(expiresAt) + '|' + String(fingerprint);
}

/** 'expiresAt|fingerprint' → 객체. 모양이 아니면 null. */
function parseRemember_(raw) {
  if (typeof raw !== 'string') return null;

  const at = raw.indexOf('|');
  if (at < 1 || at === raw.length - 1) return null;

  return {
    expiresAt: raw.slice(0, at),
    fingerprint: raw.slice(at + 1),
  };
}

/**
 * 아직 쓸 수 있는 열쇠인가.
 *
 * 지문이 다르면 만료 전이라도 거절한다. 비밀번호가 바뀌었다는 뜻이다.
 */
function rememberIsValid_(parsed, nowIso, fingerprint) {
  if (!parsed) return false;
  if (parsed.fingerprint !== String(fingerprint)) return false;
  return String(parsed.expiresAt) > String(nowIso);
}

/** 만료된 열쇠의 키 목록. 로그인할 때 한 번씩 치운다. */
function expiredRememberKeys_(all, nowIso) {
  const out = [];
  Object.keys(all || {}).forEach(function (key) {
    if (key.indexOf(REMEMBER_PREFIX) !== 0) return;

    const parsed = parseRemember_(all[key]);
    // 모양이 깨진 값도 치운다. 어차피 쓸 수 없다.
    if (!parsed || String(parsed.expiresAt) <= String(nowIso)) out.push(key);
  });
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = {
    REMEMBER_PREFIX,
    REMEMBER_DAYS,
    serializeRemember_,
    parseRemember_,
    rememberIsValid_,
    expiredRememberKeys_,
  };
}
