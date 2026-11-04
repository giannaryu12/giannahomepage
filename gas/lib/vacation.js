/**
 * 방학 기간 목록. 학원 전체가 함께 쓴다.
 *
 * 하나가 아니라 목록인 까닭: 방학은 해마다 두세 번 돌아오고, 지난 방학에
 * 한 수업도 그때 시간표로 서 있어야 한다. 기간을 하나만 들고 다음 방학으로
 * 갈아 끼우면, 지난 겨울방학 날들이 학기중 시간으로 되돌아가 버린다.
 *
 * 학생마다 두지 않는 까닭: 방학은 학원이 정한다. 학생 칸에 넣으면 스무 번
 * 적어야 하고, 한 명만 날짜를 잘못 적어도 그 학생만 다른 시간표를 따른다.
 *
 * 시트가 아니라 스크립트 속성에 둔다 — 행이 아니라 값 하나이고, 시트에
 * 한 줄짜리 표를 만들면 선생님이 손으로 고치다 날짜 칸이 날짜로 바뀌어
 * 버린다.
 */

/** 'yyyy-MM-dd'인가. 다른 모양은 받지 않는다. */
function isDay_(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v == null ? '' : v));
}

/**
 * 기간 하나를 다듬는다. 쓸 수 없으면 null.
 *
 * 한쪽만 적힌 기간은 '언제부터 끝까지'가 되어, 적다 만 것인지 그렇게
 * 정한 것인지 알 수 없다. 거꾸로 적은 기간은 어느 날도 그 사이에 들지
 * 않아, 아무 일도 하지 않는 줄이 목록에 남는다.
 */
function cleanVacation(input) {
  const v = input || {};
  const from = String(v.from == null ? '' : v.from).trim();
  const to = String(v.to == null ? '' : v.to).trim();

  if (!isDay_(from) || !isDay_(to)) return null;
  if (to < from) return null;

  return { from: from, to: to };
}

/**
 * 기간 목록을 다듬는다. 하나라도 쓸 수 없으면 null — 목록 전체를 되돌린다.
 *
 * 빈 줄은 조용히 버린다. 화면에서 날짜를 지우고 저장하는 것이 그 줄을
 * 지우는 길이다.
 *
 * 겹치는 기간은 받지 않는다. 겹친 날이 어느 방학에 속하는지는 어차피
 * 같은 시간표라 달라질 게 없지만, 겹쳐 적었다는 것은 한쪽 날짜를 잘못
 * 적었다는 뜻이다. 조용히 받아 두면 그 잘못이 드러나지 않는다.
 *
 * 이른 날부터 세워 돌려준다 — 화면이 다시 세우지 않아도 되고, 겹치는지도
 * 이웃끼리만 보면 된다.
 */
function cleanVacations(list) {
  const out = [];

  for (let i = 0; i < (list || []).length; i++) {
    const raw = list[i] || {};
    const from = String(raw.from == null ? '' : raw.from).trim();
    const to = String(raw.to == null ? '' : raw.to).trim();
    if (!from && !to) continue;

    const one = cleanVacation(raw);
    if (!one) return null;
    out.push(one);
  }

  out.sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });

  for (let i = 1; i < out.length; i++) {
    if (out[i].from <= out[i - 1].to) return null;
  }
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = { cleanVacation, cleanVacations };
}
