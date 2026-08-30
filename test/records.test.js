import { describe, it, expect } from 'vitest';
import { findRecordMatch, buildRecordPayload } from '../gas/lib/records.js';

describe('findRecordMatch', () => {
  const rows = [
    { recordId: 'R1', studentId: 'S001', date: '2026-08-30' },
    { recordId: 'R2', studentId: 'S002', date: '2026-08-30' },
  ];

  it('studentId와 date가 모두 일치하는 행을 찾는다', () => {
    expect(findRecordMatch(rows, 'S001', '2026-08-30')).toBe(rows[0]);
  });

  it('studentId만 다르면 매치하지 않는다', () => {
    expect(findRecordMatch(rows, 'S999', '2026-08-30')).toBeNull();
  });

  it('date만 다르면 매치하지 않는다', () => {
    expect(findRecordMatch(rows, 'S001', '2026-08-31')).toBeNull();
  });

  it('빈 배열이면 null이다', () => {
    expect(findRecordMatch([], 'S001', '2026-08-30')).toBeNull();
  });

  it('#3 회귀: 방금 append한 payload를 rows에 push하면 같은 배치의 다음 레코드가 찾아낸다', () => {
    const existing = [];
    const first = buildRecordPayload(
      { studentId: 'S001', date: '2026-08-30' },
      'C01', 'req-1', '2026-08-30T00:00:00.000Z'
    );
    first.recordId = 'R-NEW';
    existing.push(first);

    const match = findRecordMatch(existing, 'S001', '2026-08-30');
    expect(match).toBe(first);
  });
});

describe('buildRecordPayload', () => {
  it('16개 Records 컬럼 중 buildRecordPayload가 채우는 필드를 모두 매핑한다', () => {
    const rec = {
      studentId: 'S001',
      date: '2026-08-30',
      progress: 'Unit 7',
      homeworkStatus: '제출',
      homeworkLevel: '상',
      testName: '단어시험',
      testScore: 18,
      testMax: 20,
      attendance: '출석',
      nextHomework: 'Unit 8 예습',
      comment: '좋음',
    };

    const payload = buildRecordPayload(rec, 'C01', 'req-1', '2026-08-30T01:00:00.000Z');

    expect(payload).toEqual({
      studentId: 'S001',
      classId: 'C01',
      date: '2026-08-30',
      progress: 'Unit 7',
      homeworkStatus: '제출',
      homeworkLevel: '상',
      testName: '단어시험',
      testScore: 18,
      testMax: 20,
      attendance: '출석',
      nextHomework: 'Unit 8 예습',
      comment: '좋음',
      clientRequestId: 'req-1',
      updatedAt: '2026-08-30T01:00:00.000Z',
    });
  });

  it('testScore/testMax가 빈 문자열이면 0이 아니라 빈 문자열로 남는다', () => {
    const payload = buildRecordPayload(
      { studentId: 'S001', date: '2026-08-30', testScore: '', testMax: '' },
      'C01', 'req-1', '2026-08-30T01:00:00.000Z'
    );
    expect(payload.testScore).toBe('');
    expect(payload.testMax).toBe('');
  });

  it('testScore/testMax가 null이면 빈 문자열로 남는다', () => {
    const payload = buildRecordPayload(
      { studentId: 'S001', date: '2026-08-30', testScore: null, testMax: null },
      'C01', 'req-1', '2026-08-30T01:00:00.000Z'
    );
    expect(payload.testScore).toBe('');
    expect(payload.testMax).toBe('');
  });

  it('누락된 선택 필드는 빈 문자열로 채운다', () => {
    const payload = buildRecordPayload(
      { studentId: 'S001', date: '2026-08-30' },
      'C01', 'req-1', '2026-08-30T01:00:00.000Z'
    );
    expect(payload.progress).toBe('');
    expect(payload.homeworkStatus).toBe('');
    expect(payload.homeworkLevel).toBe('');
    expect(payload.testName).toBe('');
    expect(payload.attendance).toBe('');
    expect(payload.nextHomework).toBe('');
    expect(payload.comment).toBe('');
  });
});
