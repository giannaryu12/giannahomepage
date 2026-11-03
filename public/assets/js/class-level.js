/**
 * 반 이름에서 학교급(초등부·중등부·고등부)을 읽는다. 순수 함수.
 *
 * 시트에는 학교급 칸이 없다. 반 이름 맨 앞의 초·중·고를 보고 나눈다 —
 * 선생님이 이미 쓰는 이름 그대로이고, 시트에 칸을 더 만들지 않아도 된다.
 *
 * 앞에서만 찾는 이유: 이름 어디서든 찾으면 '기초반'이 초등부로,
 * '수능 고난도'가 고등부로 끌려간다. 글자 뒤에 등·등부·숫자가 오거나
 * 거기서 낱말이 끝나야 학교급으로 인정한다 — '고급반'의 고는 학교급이 아니다.
 *
 * api.js와 같은 이중 로드 패턴(IIFE + module.exports)을 쓴다.
 */
(function (global) {
  const LEVELS = [
    { key: 'elem', label: '초등부', mark: '초' },
    { key: 'mid', label: '중등부', mark: '중' },
    { key: 'high', label: '고등부', mark: '고' },
  ];

  // 초·중·고 + (등부|등|학년 숫자)? + 낱말 끝. 뒤에 붙는 숫자는 초6·중3·고2처럼
  // 학년까지 이름에 적는 경우를 받는다.
  const LEVEL_RE = /^\s*(초|중|고)(등부|등|[1-6])?(?=$|[\s·,.\-_/()[\]])/;

  /** 반 이름 → 'elem' | 'mid' | 'high'. 읽을 수 없으면 빈 문자열. */
  function classLevel(className) {
    const m = LEVEL_RE.exec(String(className == null ? '' : className));
    if (!m) return '';

    const found = LEVELS.filter(function (l) { return l.mark === m[1]; })[0];
    return found ? found.key : '';
  }

  /**
   * 화면에 적을 학년. '초5' → '초등부 5학년'.
   *
   * 시트에는 짧게 적는다 — 선생님이 손으로 넣는 칸이라 짧은 편이 낫다.
   * 화면에서는 풀어 적는다. 학교급과 학년이 두 글자에 붙어 있으면 읽는
   * 쪽이 매번 머릿속에서 풀어야 한다.
   *
   * 학년을 읽을 수 없으면 반 이름에서 학교급만 읽고, 그것도 없으면 적힌
   * 그대로 돌려준다 — 손으로 적어 둔 값을 추측해서 고치지 않는다.
   */
  function gradeLabel(grade, className) {
    const raw = String(grade == null ? '' : grade).trim();
    const key = classLevel(raw) || classLevel(className);
    const level = LEVELS.filter(function (l) { return l.key === key; })[0];
    if (!level) return raw;

    const num = (/(\d)/.exec(raw) || [])[1];
    return level.label + (num ? ' ' + num + '학년' : '');
  }

  /**
   * 반 목록을 세 학교급으로 나눈다. 순서는 늘 초·중·고로 고정이고,
   * 비어 있는 학교급도 자리를 지킨다 — 열이 셋이어야 칸이 밀리지 않는다.
   *
   * 학교급을 읽을 수 없는 반은 other로 모은다. 이름을 아직 안 고친 반이
   * 화면에서 통째로 사라지면 반이 없어진 것처럼 보인다.
   */
  function groupByLevel(classes) {
    const list = classes || [];
    const groups = LEVELS.map(function (l) {
      return {
        key: l.key,
        label: l.label,
        classes: list.filter(function (c) { return classLevel(c && c.className) === l.key; }),
      };
    });

    return {
      groups: groups,
      other: list.filter(function (c) { return !classLevel(c && c.className); }),
    };
  }

  const api = { LEVELS, classLevel, gradeLabel, groupByLevel };

  global.GI_CLASS_LEVEL = api;

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
