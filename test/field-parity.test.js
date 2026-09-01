/**
 * 진도 영역 필드 목록은 세 곳에 있다.
 *   - 화면:        public/assets/js/progress-areas.js
 *   - 저장:        gas/lib/records.js
 *   - 학부모 응답: gas/lib/shape.js (allowlist)
 *
 * GAS와 브라우저는 모듈을 공유하지 않아 한 곳에 둘 수 없다. 어긋나면
 * 선생님이 입력한 값이 저장되지 않거나 학부모 화면에서 사라지는데, 둘 다
 * 조용히 일어나므로 여기서 막는다.
 */
import { describe, it, expect } from 'vitest';
import {
  PROGRESS_FIELDS as UI_PROGRESS,
  NEXT_FIELDS as UI_NEXT,
  TEST_FIELDS as UI_TEST,
  RECORD_AREA_FIELDS as UI_FIELDS,
  TEST_AREAS,
  TEST_SUMMARY_AREAS as UI_SUMMARY,
} from '../public/assets/js/progress-areas.js';
import {
  PROGRESS_FIELDS as GAS_PROGRESS,
  NEXT_FIELDS as GAS_NEXT,
  TEST_FIELDS as GAS_TEST,
  RECORD_AREA_FIELDS as GAS_FIELDS,
  TEST_SUMMARY_GROUPS as GAS_SUMMARY,
} from '../gas/lib/records.js';
import { PARENT_RECORD_FIELDS } from '../gas/lib/shape.js';

describe('진도 영역 필드 목록', () => {
  it('화면과 저장이 같은 필드를 같은 순서로 갖는다', () => {
    expect(UI_PROGRESS).toEqual(GAS_PROGRESS);
    expect(UI_NEXT).toEqual(GAS_NEXT);
    expect(UI_TEST).toEqual(GAS_TEST);
    expect(UI_FIELDS).toEqual(GAS_FIELDS);
  });

  it('학부모 응답 allowlist가 영역 필드를 모두 포함한다', () => {
    GAS_FIELDS.forEach((f) => expect(PARENT_RECORD_FIELDS).toContain(f));
  });

  it('학부모 응답 allowlist에 영역 필드 아닌 값이 섞여 들어오지 않았다', () => {
    const known = [
      'date', 'sessionNo', 'progress', 'homeworkStatus', 'homeworkLevel',
      'testName', 'testScore', 'testMax', 'attendance', 'nextHomework', 'comment',
    ].concat(GAS_FIELDS);

    PARENT_RECORD_FIELDS.forEach((f) => expect(known).toContain(f));
  });
});

describe('시험 통계 묶음', () => {
  it('화면과 서버가 같은 묶음을 같은 순서로 갖는다', () => {
    // 어긋나면 학부모 카드에 있지도 않은 <key>Avg를 찾아 '기록 없음'이 뜬다.
    expect(UI_SUMMARY.map((g) => g.key)).toEqual(GAS_SUMMARY.map((g) => g.key));
    UI_SUMMARY.forEach((g, i) => {
      expect(g.memberKeys).toEqual(GAS_SUMMARY[i].memberKeys);
    });
  });

  it('묶음이 시험 영역을 하나도 빠짐없이, 겹치지 않게 담는다', () => {
    const members = UI_SUMMARY.reduce((acc, g) => acc.concat(g.memberKeys), []);
    expect(new Set(members).size).toBe(members.length);
    expect(members.slice().sort()).toEqual(TEST_AREAS.map((a) => a.key).slice().sort());
  });
});
