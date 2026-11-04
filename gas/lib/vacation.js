/**
 * 방학 기간. 학원 전체가 함께 쓰는 값 하나다.
 *
 * 학생마다 두지 않는 까닭: 방학은 학원이 정한다. 학생 칸에 넣으면 스무
 * 번 적어야 하고, 한 명만 날짜를 잘못 적어도 그 학생만 다른 시간표를
 * 따르게 된다.
 *
 * 시트가 아니라 스크립트 속성에 둔다 — 행이 아니라 값 하나이고, 시트에
 * 한 줄짜리 표를 만들면 선생님이 손으로 고치다 날짜 칸이 날짜로
 * 바뀌어 버린다.
 */

/** 'yyyy-MM-dd'인가. 다른 모양은 받지 않는다. */
function isDay_(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v == null ? '' : v));
}

/**
 * 받은 기간을 쓸 수 있는 꼴로 다듬는다.
 *
 * 한쪽만 적힌 기간은 통째로 비운다 — '언제부터 끝까지'가 되어, 적다 만
 * 것인지 그렇게 정한 것인지 화면에서 알 수 없다. 거꾸로 적은 기간도
 * 비운다. 끝이 시작보다 앞이면 어느 날도 그 사이에 들지 않아, 아무 일도
 * 일어나지 않는 기간이 저장된 채로 남는다.
 *
 * 둘 다 비우는 것은 '방학 아님'이다. 지우는 길이 따로 필요 없다.
 */
function cleanVacation(input) {
  const v = input || {};
  const from = String(v.from == null ? '' : v.from).trim();
  const to = String(v.to == null ? '' : v.to).trim();

  if (!from && !to) return { from: '', to: '' };
  if (!isDay_(from) || !isDay_(to)) return null;
  if (to < from) return null;

  return { from: from, to: to };
}

if (typeof module !== 'undefined') {
  module.exports = { cleanVacation };
}
