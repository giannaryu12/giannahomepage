import { describe, it, expect } from 'vitest';
import { cleanVacation } from '../gas/lib/vacation.js';

describe('cleanVacation — 방학 기간 다듬기', () => {
  it('두 날짜가 제대로 있으면 그대로 둔다', () => {
    expect(cleanVacation({ from: '2026-12-22', to: '2027-01-31' }))
      .toEqual({ from: '2026-12-22', to: '2027-01-31' });
  });

  it('하루짜리 방학도 기간이다', () => {
    expect(cleanVacation({ from: '2026-12-25', to: '2026-12-25' }))
      .toEqual({ from: '2026-12-25', to: '2026-12-25' });
  });

  it('둘 다 비우면 방학 아님이다', () => {
    // 지우는 길을 따로 두지 않는다 — 비우고 저장하면 그것이 지우기다.
    expect(cleanVacation({ from: '', to: '' })).toEqual({ from: '', to: '' });
    expect(cleanVacation({})).toEqual({ from: '', to: '' });
    expect(cleanVacation(null)).toEqual({ from: '', to: '' });
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
