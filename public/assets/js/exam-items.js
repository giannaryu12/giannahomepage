/**
 * 시험대비 기록의 '칸' 목록. 순수 함수 — 시트도 DOM도 만지지 않는다.
 *
 * 정기수업의 진도·숙제는 단어·독해·문법·듣기·기타 다섯 영역이 시트 컬럼으로
 * 박혀 있다. 시험대비는 그 다섯으로 담기지 않는다 — 모의고사 3회분, 어법
 * 오답정리, 학교 기출 같은 것이 시험마다 달라진다. 그래서 칸을 선생님이
 * 그때그때 만들고 지울 수 있게 하고, 목록 전체를 한 칸에 JSON으로 적는다.
 *
 * 컬럼을 늘리지 않는 까닭: 칸 이름이 자유로우면 컬럼 이름도 자유로워야 하는데,
 * 그러면 학생마다 다른 컬럼이 시트 오른쪽으로 끝없이 늘어난다.
 *
 * 칸 하나는 {name, book, text}다 — 이름·교재·내용.
 */
(function (global) {
  /** 칸 하나의 자리. 순서가 화면의 칸 순서다. */
  const EXAM_ITEM_KEYS = ['name', 'book', 'text'];

  function str_(v) {
    return v === null || v === undefined ? '' : String(v);
  }

  /** 세 칸이 모두 비었는가. 빈 줄은 저장하지 않는다. */
  function isEmptyItem(item) {
    return EXAM_ITEM_KEYS.every(function (k) { return !str_(item && item[k]).trim(); });
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
      return {
        name: str_(it && it.name),
        book: str_(it && it.book),
        text: str_(it && it.text),
      };
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
      return { name: str_(it && it.name).trim(), book: str_(it && it.book).trim(), text: str_(it && it.text).trim() };
    }).filter(function (it) { return !isEmptyItem(it); });

    return kept.length ? JSON.stringify(kept) : '';
  }

  /**
   * 다음 기록을 열 때 미리 깔아 둘 칸. 이름만 남기고 교재·내용은 비운다.
   *
   * 교재까지 물려주면 지난주에 푼 3회분이 이번 주 칸에 그대로 앉아 있다가,
   * 선생님이 못 보고 저장하면 하지 않은 수업이 기록에 남는다. 칸 이름은
   * 그 학생에게 무엇을 시키는지라 잘 바뀌지 않으므로 물려준다.
   */
  function itemTemplate(list) {
    return (list || [])
      .filter(function (it) { return str_(it && it.name).trim(); })
      .map(function (it) { return { name: str_(it.name).trim(), book: '', text: '' }; });
  }

  const api = { EXAM_ITEM_KEYS, isEmptyItem, parseItems, stringifyItems, itemTemplate };

  global.GI_EXAM_ITEMS = api;

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
