import { describe, it, expect } from 'vitest';
import { dateLabel, WEEKDAYS } from '../public/assets/js/format.js';

describe('dateLabel', () => {
  it('월/일과 요일을 함께 낸다', () => {
    expect(dateLabel('2026-08-30')).toBe('08/30 (일)');
    expect(dateLabel('2026-08-31')).toBe('08/31 (월)');
    expect(dateLabel('2026-09-05')).toBe('09/05 (토)');
  });

  it('한 주 일곱 날의 요일이 순서대로 나온다', () => {
    const week = ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02',
      '2026-09-03', '2026-09-04', '2026-09-05'];
    expect(week.map((d) => dateLabel(d).slice(-2, -1))).toEqual(WEEKDAYS);
  });

  it('연도가 넘어가도 맞는다', () => {
    expect(dateLabel('2027-01-01')).toBe('01/01 (금)');
  });

  it('윤년 2월 29일을 그날의 요일로 낸다', () => {
    expect(dateLabel('2028-02-29')).toBe('02/29 (화)');
  });

  it('없는 날짜에는 요일을 붙이지 않는다', () => {
    // Date가 3월로 굴려 버린 요일을 붙이면 있지도 않은 날의 요일이 된다.
    expect(dateLabel('2026-02-30')).toBe('02/30');
    expect(dateLabel('2026-11-31')).toBe('11/31');
  });

  it('날짜 꼴이 아니면 받은 값을 그대로 돌려준다', () => {
    // 요일을 붙이겠다고 학부모 화면에서 날짜 자체를 지우면 안 된다.
    // 자릿수가 안 맞아도 날짜로 읽히면 날짜로 낸다.
    expect(dateLabel('2026-8-3')).toBe('08/03 (월)');
    expect(dateLabel('나중에')).toBe('나중에');
    expect(dateLabel('')).toBe('');
    expect(dateLabel(null)).toBe('');
    expect(dateLabel(undefined)).toBe('');
  });
});

describe('dateLabel — 시트 날짜 칸이 날짜 서식일 때', () => {
  it('ISO 시각 문자열도 요일이 붙은 날짜로 낸다', () => {
    // 서버가 Date를 담아 보내면 JSON을 거치며 UTC 시각 문자열이 된다.
    // 그대로 찍히면 학부모 화면에 '2026-08-30T15:00:00.000Z'가 그냥 보인다.
    expect(dateLabel('2026-08-30T15:00:00.000Z'))
      .toMatch(/^\d{2}\/\d{2} \([일월화수목금토]\)$/);
  });

  it('보는 사람이 있는 지역의 날짜로 읽는다', () => {
    // 한국 자정은 전날 15시 UTC다. 앞 열 글자만 떼면 하루가 밀린다.
    const d = new Date('2026-08-30T15:00:00.000Z');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    expect(dateLabel('2026-08-30T15:00:00.000Z').slice(0, 5)).toBe(mm + '/' + dd);
  });

  it('날짜로 읽을 수 없으면 여전히 받은 값 그대로다', () => {
    expect(dateLabel('나중에')).toBe('나중에');
    expect(dateLabel('')).toBe('');
  });
});
