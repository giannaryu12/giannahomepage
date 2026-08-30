import { describe, it, expect } from 'vitest';
import {
  findRecordFor, toFormValues, buildRecord, rosterStatus,
} from '../public/assets/js/record-form.js';

describe('findRecordFor', () => {
  const records = [
    { studentId: 's1', progress: 'Unit 1' },
    { studentId: 's2', progress: 'Unit 2' },
  ];

  it('해당 학생의 기록을 찾는다', () => {
    expect(findRecordFor(records, 's2')).toEqual({ studentId: 's2', progress: 'Unit 2' });
  });

  it('다른 학생의 기록이 섞이지 않는다', () => {
    const r = findRecordFor(records, 's1');
    expect(r.studentId).toBe('s1');
    expect(r).not.toEqual(records[1]);
  });

  it('기록이 없는 학생은 null', () => {
    expect(findRecordFor(records, 's3')).toBeNull();
  });

  it('existingRecords가 null이어도 안전하다', () => {
    expect(findRecordFor(null, 's1')).toBeNull();
    expect(findRecordFor(undefined, 's1')).toBeNull();
  });

  it('studentId가 빈 값이면 null', () => {
    expect(findRecordFor(records, '')).toBeNull();
    expect(findRecordFor(records, null)).toBeNull();
    expect(findRecordFor(records, undefined)).toBeNull();
  });
});

describe('toFormValues', () => {
  it('record가 null이면 전부 빈 문자열', () => {
    expect(toFormValues(null)).toEqual({
      progress: '', attendance: '', homeworkStatus: '', homeworkLevel: '',
      testName: '', testScore: '', testMax: '', nextHomework: '', comment: '',
    });
  });

  it('기존 기록 값을 그대로 채운다', () => {
    const record = {
      progress: 'Unit 7', attendance: '출석', homeworkStatus: '제출', homeworkLevel: '상',
      testName: '중간고사', testScore: 85, testMax: 100, nextHomework: 'Unit 8', comment: '잘함',
    };
    expect(toFormValues(record)).toEqual({
      progress: 'Unit 7', attendance: '출석', homeworkStatus: '제출', homeworkLevel: '상',
      testName: '중간고사', testScore: '85', testMax: '100', nextHomework: 'Unit 8', comment: '잘함',
    });
  });

  it('testScore가 숫자 0이어도 빈 칸이 아닌 "0"으로 남는다', () => {
    const record = { testScore: 0, testMax: 0 };
    const v = toFormValues(record);
    expect(v.testScore).toBe('0');
    expect(v.testMax).toBe('0');
  });

  it('null/undefined 필드는 전부 빈 문자열로 정규화된다', () => {
    const record = { progress: null, attendance: undefined, testScore: null, testMax: undefined };
    const v = toFormValues(record);
    expect(v.progress).toBe('');
    expect(v.attendance).toBe('');
    expect(v.testScore).toBe('');
    expect(v.testMax).toBe('');
  });
});

describe('buildRecord', () => {
  it('키가 서버 규격과 정확히 동일한 레코드를 만든다', () => {
    const form = {
      progress: 'Unit 7', attendance: '출석', homeworkStatus: '제출', homeworkLevel: '상',
      testName: '중간고사', testScore: '85', testMax: '100', nextHomework: 'Unit 8', comment: '잘함',
    };
    const rec = buildRecord('s1', '2026-08-30', form);
    expect(rec).toEqual({
      studentId: 's1', date: '2026-08-30', progress: 'Unit 7', nextHomework: 'Unit 8',
      attendance: '출석', homeworkStatus: '제출', homeworkLevel: '상',
      testName: '중간고사', testScore: '85', testMax: '100', comment: '잘함',
    });
  });

  it('값이 없으면 undefined가 아니라 빈 문자열이다', () => {
    const rec = buildRecord('s1', '2026-08-30', {});
    Object.keys(rec).forEach((key) => {
      expect(rec[key]).not.toBeUndefined();
    });
    expect(rec.progress).toBe('');
    expect(rec.comment).toBe('');
  });

  it('form이 null/undefined여도 안전하다', () => {
    const rec = buildRecord('s1', '2026-08-30', null);
    expect(rec.studentId).toBe('s1');
    expect(rec.date).toBe('2026-08-30');
    expect(rec.progress).toBe('');
  });
});

describe('rosterStatus', () => {
  const students = [
    { studentId: 's1', name: '김학생', grade: '고1' },
    { studentId: 's2', name: '이학생', grade: '고2' },
    { studentId: 's3', name: '박학생', grade: '고3' },
  ];
  const existingRecords = [
    { studentId: 's2', progress: 'Unit 2' },
  ];

  it('기록 유무를 정확히 표시하고 students 순서를 유지한다', () => {
    expect(rosterStatus(students, existingRecords)).toEqual([
      { studentId: 's1', name: '김학생', grade: '고1', hasRecord: false },
      { studentId: 's2', name: '이학생', grade: '고2', hasRecord: true },
      { studentId: 's3', name: '박학생', grade: '고3', hasRecord: false },
    ]);
  });

  it('existingRecords가 없으면 전부 미입력이다', () => {
    const result = rosterStatus(students, []);
    expect(result.every((r) => r.hasRecord === false)).toBe(true);
  });

  it('students가 비어 있으면 빈 배열', () => {
    expect(rosterStatus([], existingRecords)).toEqual([]);
  });
});
