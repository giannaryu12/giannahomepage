import { describe, it, expect } from 'vitest';
import { nextStudentId, generateRecordId } from '../gas/lib/ids.js';

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
  const uuidA = () => '3f1c9d2e-0b4a-4c6d-9e8f-1a2b3c4d5e6f';
  const uuidB = () => '7a8b9c0d-1e2f-4a3b-8c9d-0e1f2a3b4c5d';

  it('R로 시작하고 타임스탬프를 담는다', () => {
    const id = generateRecordId(new Date('2026-08-30T01:02:03.000Z'), uuidA);
    expect(id.startsWith('R20260830010203')).toBe(true);
  });

  it('#2 회귀: 같은 초에 만들어도 UUID 접미사로 구분된다', () => {
    const now = new Date('2026-08-30T01:02:03.000Z');
    expect(generateRecordId(now, uuidA)).not.toBe(generateRecordId(now, uuidB));
  });

  it('#2 회귀: 같은 초에 20건을 만들어도 모두 다르다', () => {
    const now = new Date('2026-08-30T01:02:03.000Z');
    let n = 0;
    const seq = () => String(n++).padStart(16, '0') + '-0000-0000-0000-000000000000';
    const ids = new Set();
    for (let i = 0; i < 20; i++) ids.add(generateRecordId(now, seq));
    expect(ids.size).toBe(20);
  });

  it('접미사는 UUID 전체 엔트로피에서 온다 (하이픈 제거, 16자)', () => {
    const id = generateRecordId(new Date('2026-08-30T01:02:03.000Z'), uuidA);
    expect(id).toBe('R20260830010203' + '3f1c9d2e0b4a4c6d');
  });

  it('시트에서 안전한 문자만 쓴다', () => {
    const id = generateRecordId(new Date('2026-08-30T01:02:03.000Z'), uuidA);
    expect(/^R[0-9a-z]+$/.test(id)).toBe(true);
  });

  it('uuidFn을 주지 않으면 Math.random으로 대체하지 않고 실패한다', () => {
    expect(() => generateRecordId(new Date('2026-08-30T01:02:03.000Z')))
      .toThrow(/Utilities\.getUuid/);
  });
});
