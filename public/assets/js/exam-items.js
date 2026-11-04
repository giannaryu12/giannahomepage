/**
 * 시험대비 기록의 '칸' 목록. 순수 함수 — 시트도 DOM도 만지지 않는다.
 *
 * 정규수업의 진도·숙제는 단어·독해·문법·듣기·기타 다섯 영역이 시트 컬럼으로
 * 박혀 있다. 시험대비는 그 다섯으로 담기지 않는다 — 모의고사 3회분, 어법
 * 오답정리, 학교 기출 같은 것이 시험마다 달라진다. 그래서 칸을 선생님이
 * 그때그때 만들고 지울 수 있게 하고, 목록 전체를 한 칸에 JSON으로 적는다.
 *
 * 컬럼을 늘리지 않는 까닭: 칸 이름이 자유로우면 컬럼 이름도 자유로워야 하는데,
 * 그러면 학생마다 다른 컬럼이 시트 오른쪽으로 끝없이 늘어난다.
 *
 * 칸 하나는 {text, result}다 — 내용 한 줄과, 시험 칸에만 쓰는 통과 여부.
 * 통과 여부를 기록 하나에 하나만 두면 '모의고사는 통과, 단어는 미통과'를
 * 적을 수 없다. 시험은 칸마다 따로 본다.
 *
 * 이름과 교재를 따로 받던 때가 있었지만,
 * 시험대비에 적는 것은 '모의고사 3회분 1~20번'처럼 이미 한 문장이다. 칸을
 * 셋으로 나누면 어디에 무엇을 적을지부터 망설이게 된다.
 */

(function (global) {
  /** 칸 하나의 자리. 순서가 화면의 칸 순서다. */
  const EXAM_ITEM_KEYS = ['text'];

  /** 시험 칸의 통과 여부. 모르는 값은 비운다. */
  const EXAM_RESULTS = ['통과', '미통과', '미응시'];

  function str_(v) {
    return v === null || v === undefined ? '' : String(v);
  }

  /**
   * 칸이 비었는가. 빈 줄은 저장하지 않는다.
   *
   * 통과 여부만 누르고 내용을 안 적은 줄은 빈 줄이다 — '통과'만 있고 무엇을
   * 통과했는지 없으면 학부모 쪽에서 읽을 것이 없다.
   */
  function isEmptyItem(item) {
    return EXAM_ITEM_KEYS.every(function (k) { return !str_(item && item[k]).trim(); });
  }

  /** 아는 통과 여부만 남긴다. */
  function itemResult_(v) {
    const r = str_(v).trim();
    return EXAM_RESULTS.indexOf(r) === -1 ? '' : r;
  }

  /**
   * 칸 하나를 내용 한 줄로 읽는다.
   *
   * 이름·교재·내용 셋으로 나뉘어 저장된 옛 줄은 하나로 합친다. 버리면
   * 선생님이 적어 둔 것이 조용히 사라지고, 학부모 화면에서도 빈 줄이 된다.
   */
  function itemText_(it) {
    const own = str_(it && it.text).trim();
    const old = [str_(it && it.name).trim(), str_(it && it.book).trim()]
      .filter(function (v) { return v; }).join(' · ');

    if (!old) return own;
    return own ? old + ' · ' + own : old;
  }

  /**
   * 시트 한 칸의 JSON을 칸 목록으로 읽는다.
   *
   * 깨진 글자가 들어 있어도 던지지 않는다 — 선생님이 시트를 손으로 고칠 수
   * 있고, 한 칸이 깨졌다고 기록 화면 전체가 빈 화면이 되면 안 된다.
   */
  function parseItems(raw) {
    const text = str_(raw).trim();
    if (!text) return [];

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return [];
    }
    if (!Array.isArray(parsed)) return [];

    return parsed.map(function (it) {
      return { text: itemText_(it), result: itemResult_(it && it.result) };
    }).filter(function (it) { return !isEmptyItem(it); });
  }

  /**
   * 칸 목록을 시트에 적을 한 줄로 만든다. 빈 줄은 버린다.
   *
   * 하나도 남지 않으면 '[]'가 아니라 빈 문자열이다 — 시트를 눈으로 훑을 때
   * 아무것도 없는 칸이 '[]'로 차 있으면 뭔가 적힌 것처럼 보인다.
   */
  function stringifyItems(list) {
    const kept = (list || []).map(function (it) {
      const out = { text: str_(it && it.text).trim() };
      // 누르지 않은 통과 여부는 아예 적지 않는다. 진도·숙제 칸에도 빈
      // result가 따라붙으면 시트 한 칸이 두 배로 길어진다.
      const r = itemResult_(it && it.result);
      if (r) out.result = r;
      return out;
    }).filter(function (it) { return !isEmptyItem(it); });

    return kept.length ? JSON.stringify(kept) : '';
  }

  /**
   * 다음 기록을 열 때 미리 깔아 둘 칸. 개수만 물려받고 내용은 비운다.
   *
   * 내용까지 물려주면 지난주에 푼 3회분이 이번 주 칸에 그대로 앉아 있다가,
   * 선생님이 못 보고 저장하면 하지 않은 수업이 기록에 남는다. 몇 칸을 쓰는지는
   * 그 학생의 시험 대비 틀이라 잘 바뀌지 않으므로 그것만 물려준다.
   */
  function itemTemplate(list) {
    return (list || []).map(function () { return { text: '', result: '' }; });
  }

  const api = { EXAM_ITEM_KEYS, EXAM_RESULTS, isEmptyItem, parseItems, stringifyItems, itemTemplate };

  global.GI_EXAM_ITEMS = api;

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
