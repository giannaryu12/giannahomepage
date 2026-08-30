import { describe, it, expect } from 'vitest';
import { toParentRecord, toParentStudent, toParentPayload, PARENT_RECORD_FIELDS } from '../gas/lib/shape.js';

describe('toParentRecord', () => {
  it('허용된 필드만 남긴다', () => {
    const out = toParentRecord({
      date: '2026-08-30', progress: 'Unit 7', comment: '좋음',
      studentId: 'S001', recordId: 'R1', clientRequestId: 'c1',
    });
    expect(Object.keys(out).sort()).toEqual([...PARENT_RECORD_FIELDS].sort());
  });

  it('민감 필드를 절대 포함하지 않는다', () => {
    const out = toParentRecord({ date: '2026-08-30', parentToken: 'SECRET', note: '학부모 민감' });
    expect(out.parentToken).toBeUndefined();
    expect(out.note).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('SECRET');
  });

  it('없는 값은 빈 문자열로 채운다', () => {
    expect(toParentRecord({ date: '2026-08-30' }).comment).toBe('');
  });
});

describe('toParentStudent', () => {
  it('이름·학년·반만 남긴다', () => {
    const out = toParentStudent(
      { name: '김민준', grade: '고1', parentToken: 'SECRET', note: '메모', active: true },
      'Structure 화목 5시'
    );
    expect(out).toEqual({ name: '김민준', grade: '고1', className: 'Structure 화목 5시' });
  });

  it('반이 없으면 빈 문자열이다', () => {
    expect(toParentStudent({ name: '김민준', grade: '고1' }, null).className).toBe('');
  });
});

describe('toParentPayload', () => {
  it('학생·요약·기록을 함께 낸다', () => {
    const out = toParentPayload({
      student: { name: '김민준', grade: '고1', parentToken: 'SECRET' },
      className: 'A반',
      records: [{ date: '2026-08-10', attendance: '출석', homeworkStatus: '제출', testScore: '', testMax: '' }],
      monthKey: '2026-08',
    });
    expect(out.student.name).toBe('김민준');
    expect(out.summary.attendanceRate).toBe(100);
    expect(out.records).toHaveLength(1);
    expect(JSON.stringify(out)).not.toContain('SECRET');
  });

  it('기록을 최신순으로 정렬한다', () => {
    const out = toParentPayload({
      student: { name: 'x', grade: 'y' }, className: '',
      records: [{ date: '2026-08-01' }, { date: '2026-08-20' }, { date: '2026-08-10' }],
      monthKey: '',
    });
    expect(out.records.map(r => r.date)).toEqual(['2026-08-20', '2026-08-10', '2026-08-01']);
  });
});
