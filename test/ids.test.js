import { describe, it, expect } from 'vitest';
import { generateToken, nextStudentId, generateRecordId, TOKEN_CHARS } from '../gas/lib/ids.js';

describe('generateToken', () => {
  it('32자를 만든다', () => {
    expect(generateToken()).toHaveLength(32);
  });

  it('허용된 문자만 사용한다', () => {
    for (const ch of generateToken()) {
      expect(TOKEN_CHARS).toContain(ch);
    }
  });

  it('연속 호출에서 값이 달라진다', () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  it('주입한 난수 함수를 사용한다', () => {
    expect(generateToken(() => 0)).toBe('A'.repeat(32));
  });
});

describe('nextStudentId', () => {
  it('빈 목록이면 S001을 준다', () => {
    expect(nextStudentId([])).toBe('S001');
  });

  it('기존 최대값 다음 번호를 준다', () => {
    expect(nextStudentId(['S001', 'S002', 'S003'])).toBe('S004');
  });

  it('중간이 비어 있어도 최대값 기준으로 준다', () => {
    expect(nextStudentId(['S001', 'S007'])).toBe('S008');
  });

  it('형식에 맞지 않는 값은 무시한다', () => {
    expect(nextStudentId(['', 'foo', 'S002'])).toBe('S003');
  });

  it('999를 넘으면 자릿수가 늘어난다', () => {
    expect(nextStudentId(['S999'])).toBe('S1000');
  });
});

describe('generateRecordId', () => {
  it('R로 시작하고 타임스탬프를 담는다', () => {
    const id = generateRecordId(new Date('2026-08-30T01:02:03.000Z'), () => 0);
    expect(id.startsWith('R20260830010203')).toBe(true);
  });

  it('같은 시각이어도 난수 접미사로 구분된다', () => {
    const now = new Date('2026-08-30T01:02:03.000Z');
    expect(generateRecordId(now, () => 0)).not.toBe(generateRecordId(now, () => 0.5));
  });
});
