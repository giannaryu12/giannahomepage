import { describe, it, expect } from 'vitest';
import {
  parseItems,
  stringifyItems,
  itemTemplate,
  isEmptyItem,
} from '../gas/lib/exam-items.js';

describe('시험대비 칸 읽기', () => {
  it('빈 값과 깨진 JSON은 빈 목록이다', () => {
    expect(parseItems('')).toEqual([]);
    expect(parseItems(null)).toEqual([]);
    expect(parseItems('{그냥 글자}')).toEqual([]);
    // 배열이 아닌 JSON도 빈 목록 — 시트를 손으로 고치다 들어올 수 있다.
    expect(parseItems('{"text":"하나"}')).toEqual([]);
  });

  it('내용 한 줄짜리 칸을 읽는다', () => {
    expect(parseItems('[{"text":"모의고사 3회분 1~20번"}]'))
      .toEqual([{ text: '모의고사 3회분 1~20번', result: '' }]);
  });

  it('빈 줄은 읽을 때 버린다', () => {
    expect(parseItems('[{"text":"어법"},{"text":"  "}]'))
      .toEqual([{ text: '어법', result: '' }]);
  });

  it('통과 여부는 칸마다 따로 읽는다', () => {
    expect(parseItems('[{"text":"모의고사","result":"통과"},{"text":"단어","result":"미통과"}]'))
      .toEqual([{ text: '모의고사', result: '통과' }, { text: '단어', result: '미통과' }]);
  });

  it('모르는 통과 여부는 비운다', () => {
    expect(parseItems('[{"text":"모의고사","result":"합격"}]'))
      .toEqual([{ text: '모의고사', result: '' }]);
  });

  it('통과만 누르고 내용을 안 적은 줄은 빈 줄이다', () => {
    expect(parseItems('[{"text":"","result":"통과"}]')).toEqual([]);
  });

  it('이름·교재·내용으로 나뉘어 저장됐던 옛 줄은 한 줄로 합친다', () => {
    // 버리면 선생님이 적어 둔 것이 조용히 사라진다.
    expect(parseItems('[{"name":"모의고사","book":"9월 모평","text":"3회분"}]'))
      .toEqual([{ text: '모의고사 · 9월 모평 · 3회분', result: '' }]);
    expect(parseItems('[{"name":"어법 오답정리","book":"","text":""}]'))
      .toEqual([{ text: '어법 오답정리', result: '' }]);
  });
});

describe('시험대비 칸 쓰기', () => {
  it('하나도 남지 않으면 빈 문자열이다', () => {
    expect(stringifyItems([])).toBe('');
    expect(stringifyItems([{ text: '' }, { text: '   ' }])).toBe('');
    expect(stringifyItems(null)).toBe('');
  });

  it('앞뒤 공백을 떼고 내용만 적는다', () => {
    expect(stringifyItems([{ text: ' 중간 1차 ' }, { text: '' }]))
      .toBe('[{"text":"중간 1차"}]');
  });

  it('읽고 쓴 값이 그대로 돌아온다', () => {
    const raw = '[{"text":"어법 1~40번"},{"text":"듣기 2회"}]';
    expect(stringifyItems(parseItems(raw))).toBe(raw);
  });

  it('누르지 않은 통과 여부는 적지 않는다', () => {
    // 진도·숙제 칸까지 빈 result를 달고 다니면 시트 한 칸이 두 배가 된다.
    expect(stringifyItems([{ text: '어법', result: '' }])).toBe('[{"text":"어법"}]');
  });

  it('누른 통과 여부는 칸에 함께 적는다', () => {
    expect(stringifyItems([{ text: '모의고사', result: '통과' }]))
      .toBe('[{"text":"모의고사","result":"통과"}]');
  });
});

describe('다음 기록에 깔아 둘 칸', () => {
  it('개수만 물려받고 내용은 비운다', () => {
    const last = parseItems('[{"text":"모의고사 3회분"},{"text":"어법"}]');
    expect(itemTemplate(last)).toEqual([{ text: '', result: '' }, { text: '', result: '' }]);
  });

  it('지난번에 적은 것이 없으면 깔아 둘 칸도 없다', () => {
    expect(itemTemplate([])).toEqual([]);
    expect(itemTemplate(null)).toEqual([]);
  });

  it('깔아 둔 칸은 비어 있으므로 저장하면 사라진다', () => {
    // 선생님이 한 칸도 쓰지 않고 저장해도 빈 줄이 기록에 남지 않는다.
    expect(itemTemplate([{ text: '어법' }]).every(isEmptyItem)).toBe(true);
    expect(stringifyItems(itemTemplate([{ text: '어법' }]))).toBe('');
  });
});
