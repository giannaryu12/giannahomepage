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

/**
 * 레코드 id. 접미사는 CSPRNG인 UUID에서 온다.
 *
 * 한 반을 한꺼번에 저장하면 여러 건이 같은 '초'에 만들어진다. 초 단위
 * 타임스탬프 + 짧은 난수로는 배치 내부 충돌이 실제로 일어나고, 충돌하면
 * 다른 학생의 행을 덮어쓴다. 그래서 Math.random 대신 UUID를 쓴다.
 *
 * uuidFn은 주입 가능하다(Node 테스트용). GAS에서는 Utilities.getUuid를
 * 기본값으로 쓴다. 대체 난수원으로 Math.random을 쓰지 않는다 —
 * 조용히 충돌 가능한 id로 되돌아가는 것을 막기 위함이다.
 */
function generateRecordId(now, uuidFn) {
  const gen = uuidFn || function () {
    if (typeof Utilities === 'undefined' || !Utilities.getUuid) {
      throw new Error('generateRecordId: Utilities.getUuid가 필요합니다.');
    }
    return Utilities.getUuid();
  };
  const stamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const suffix = String(gen()).replace(/[^0-9a-zA-Z]/g, '').toLowerCase().slice(0, 16);
  return 'R' + stamp + suffix;
}

if (typeof module !== 'undefined') {
  module.exports = {
    nextStudentId,
    generateRecordId,
  };
}
