/**
 * ID · 토큰 생성. SpreadsheetApp을 사용하지 않는 순수 함수.
 */

function nextStudentId(existingIds) {
  let max = 0;
  (existingIds || []).forEach(function (id) {
    const m = /^S(\d+)$/.exec(String(id || ''));
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  const next = max + 1;
  const padded = next < 1000 ? String(next).padStart(3, '0') : String(next);
  return 'S' + padded;
}

function generateRecordId(now, randomFn) {
  const rnd = randomFn || Math.random;
  const stamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const suffix = Math.floor(rnd() * 1000000).toString(36).padStart(4, '0');
  return 'R' + stamp + suffix;
}

if (typeof module !== 'undefined') {
  module.exports = {
    nextStudentId,
    generateRecordId,
  };
}
