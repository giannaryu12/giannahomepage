import { describe, it, expect } from 'vitest';
import { buildStudentPatch } from '../gas/lib/students.js';

describe('buildStudentPatch', () => {
  it('#1 회귀: note를 보내지 않으면 patch에 note가 없다 (선생님 메모 보존)', () => {
    const patch = buildStudentPatch({
      studentId: 'S001', name: '김지아', grade: '중2', classId: 'C01', active: true,
    });
    expect(Object.prototype.hasOwnProperty.call(patch, 'note')).toBe(false);
  });

  it('note를 명시적으로 보내면 그 값을 쓴다', () => {
    expect(buildStudentPatch({ name: '김지아', note: '메모' }).note).toBe('메모');
  });

  it('note를 빈 문자열로 보내면 비운다 (명시적 삭제는 허용)', () => {
    const patch = buildStudentPatch({ name: '김지아', note: '' });
    expect(Object.prototype.hasOwnProperty.call(patch, 'note')).toBe(true);
    expect(patch.note).toBe('');
  });

  it('프런트가 항상 보내는 name·grade·classId는 그대로 설정한다', () => {
    expect(buildStudentPatch({ name: '김지아', grade: '중2', classId: 'C01' }))
      .toEqual({ name: '김지아', grade: '중2', classId: 'C01' });
  });

  it('grade·classId를 빈 문자열로 보내면 비운다', () => {
    expect(buildStudentPatch({ name: '김지아', grade: '', classId: '' }))
      .toEqual({ name: '김지아', grade: '', classId: '' });
  });

  it('grade·classId가 없으면 건드리지 않는다', () => {
    expect(buildStudentPatch({ name: '김지아' })).toEqual({ name: '김지아' });
  });

  it('active가 boolean일 때만 TRUE/FALSE 문자열로 넣는다', () => {
    expect(buildStudentPatch({ name: 'A', active: true }).active).toBe('TRUE');
    expect(buildStudentPatch({ name: 'A', active: false }).active).toBe('FALSE');
    expect(Object.prototype.hasOwnProperty.call(buildStudentPatch({ name: 'A' }), 'active')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(
      buildStudentPatch({ name: 'A', active: 'TRUE' }), 'active')).toBe(false);
  });

  it('studentId는 patch에 넣지 않는다 (키 컬럼을 덮어쓰지 않는다)', () => {
    expect(Object.prototype.hasOwnProperty.call(
      buildStudentPatch({ studentId: 'S001', name: 'A' }), 'studentId')).toBe(false);
  });

  it('parentToken은 절대 patch에 넣지 않는다', () => {
    expect(Object.prototype.hasOwnProperty.call(
      buildStudentPatch({ name: 'A', parentToken: 'x'.repeat(32) }), 'parentToken')).toBe(false);
  });
});

describe('classNameMap', () => {
  it('classId → className 맵을 한 번에 만든다', async () => {
    const { classNameMap } = await import('../gas/lib/students.js');
    const map = classNameMap([
      { classId: 'C01', className: '중2 A반' },
      { classId: 'C02', className: '고1 B반' },
    ]);
    expect(map.C01).toBe('중2 A반');
    expect(map.C02).toBe('고1 B반');
    expect(map.C99).toBe(undefined);
  });

  it('빈 입력도 안전하다', async () => {
    const { classNameMap } = await import('../gas/lib/students.js');
    expect(classNameMap(undefined)).toEqual({});
  });
});
