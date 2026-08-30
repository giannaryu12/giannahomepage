/**
 * ID · 토큰 생성. SpreadsheetApp을 사용하지 않는 순수 함수.
 */

const TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LENGTH = 32;

function generateToken(randomFn) {
  const rnd = randomFn || Math.random;
  let out = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out += TOKEN_CHARS.charAt(Math.floor(rnd() * TOKEN_CHARS.length));
  }
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = { generateToken, TOKEN_CHARS, TOKEN_LENGTH };
}
