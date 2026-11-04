import { describe, it, expect } from 'vitest';
import { cleanVacation, cleanVacations } from '../gas/lib/vacation.js';

describe('cleanVacation — 방학 기간 다듬기', () => {
  it('두 날짜가 제대로 있으면 그대로 둔다', () => {
    expect(cleanVacation({ from: '2026-12-22', to: '2027-01-31' }))
      .toEqual({ from: '2026-12-22', to: '2027-01-31' });
  });

  it('하루짜리 방학도 기간이다', () => {
    expect(cleanVacation({ from: '2026-12-25', to: '2026-12-25' }))
      .toEqual({ from: '2026-12-25', to: '2026-12-25' });
  });

  it('빈 기간은 기간이 아니다', () => {
    expect(cleanVacation({ from: '', to: '' })).toBe(null);
    expect(cleanVacation({})).toBe(null);
    expect(cleanVacation(null)).toBe(null);
  });

  it('한쪽만 적힌 기간은 받지 않는다', () => {
    // '언제부터 끝까지'가 되어, 적다 만 것인지 그렇게 정한 것인지 모른다.
    expect(cleanVacation({ from: '2026-12-22', to: '' })).toBe(null);
    expect(cleanVacation({ from: '', to: '2027-01-31' })).toBe(null);
  });

  it('거꾸로 적은 기간은 받지 않는다', () => {
    // 어느 날도 그 사이에 들지 않아, 아무 일도 안 하는 기간이 남는다.
    expect(cleanVacation({ from: '2027-01-31', to: '2026-12-22' })).toBe(null);
  });

  it('날짜 꼴이 아니면 받지 않는다', () => {
    expect(cleanVacation({ from: '2026/12/22', to: '2027/01/31' })).toBe(null);
    expect(cleanVacation({ from: '겨울', to: '봄' })).toBe(null);
  });
});

describe('cleanVacations — 기간 목록', () => {
  it('이른 날부터 세워 돌려준다', () => {
    expect(cleanVacations([
      { from: '2027-07-20', to: '2027-08-20' },
      { from: '2026-12-22', to: '2027-01-31' },
    ])).toEqual([
      { from: '2026-12-22', to: '2027-01-31' },
      { from: '2027-07-20', to: '2027-08-20' },
    ]);
  });

  it('빈 줄은 조용히 버린다', () => {
    // 화면에서 날짜를 지우고 저장하는 것이 그 줄을 지우는 길이다.
    expect(cleanVacations([
      { from: '', to: '' },
      { from: '2026-12-22', to: '2027-01-31' },
    ])).toEqual([{ from: '2026-12-22', to: '2027-01-31' }]);
  });

  it('빈 목록은 방학 없음이다', () => {
    expect(cleanVacations([])).toEqual([]);
    expect(cleanVacations(null)).toEqual([]);
  });

  it('하나라도 반쯤 적혔으면 목록 전체를 되돌린다', () => {
    expect(cleanVacations([
      { from: '2026-12-22', to: '2027-01-31' },
      { from: '2027-07-20', to: '' },
    ])).toBe(null);
  });

  it('겹치는 기간은 받지 않는다', () => {
    // 겹쳐 적었다는 것은 한쪽 날짜를 잘못 적었다는 뜻이다.
    expect(cleanVacations([
      { from: '2026-12-22', to: '2027-01-31' },
      { from: '2027-01-20', to: '2027-02-10' },
    ])).toBe(null);
  });

  it('끝난 다음 날 시작하는 기간은 겹치지 않는다', () => {
    expect(cleanVacations([
      { from: '2026-12-22', to: '2027-01-31' },
      { from: '2027-02-01', to: '2027-02-10' },
    ])).toHaveLength(2);
  });

  it('지난 방학과 다음 방학이 나란히 남는다', () => {
    // 지난 방학을 지우면 그때 한 수업이 학기중 시간으로 되돌아간다.
    const out = cleanVacations([
      { from: '2026-01-05', to: '2026-02-28' },
      { from: '2026-07-20', to: '2026-08-20' },
      { from: '2026-12-22', to: '2027-01-31' },
    ]);
    expect(out).toHaveLength(3);
  });
});
