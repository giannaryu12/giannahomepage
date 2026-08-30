import { describe, it, expect } from 'vitest';
import { planRecordBatch, rowValuesFor } from '../gas/lib/batch.js';

const HEADER = [
  'recordId', 'studentId', 'classId', 'date', 'progress', 'homeworkStatus',
  'homeworkLevel', 'testName', 'testScore', 'testMax', 'attendance',
  'nextHomework', 'comment', 'clientRequestId', 'createdAt', 'updatedAt',
];

function plan(existingRows, records, ids) {
  let i = 0;
  return planRecordBatch({
    existingRows: existingRows,
    records: records,
    classId: 'C01',
    clientRequestId: 'req-1',
    now: '2026-08-30T01:00:00.000Z',
    newIdFn: function () { return (ids || ['R-NEW'])[i++]; },
  });
}

describe('planRecordBatch', () => {
  it('신규 레코드는 append 목록으로 간다', () => {
    const p = plan([], [{ studentId: 'S001', date: '2026-08-30' }]);
    expect(p.updates).toHaveLength(0);
    expect(p.appends).toHaveLength(1);
    expect(p.appends[0].recordId).toBe('R-NEW');
    expect(p.appends[0].createdAt).toBe('2026-08-30T01:00:00.000Z');
    expect(p.saved).toBe(1);
  });

  it('기존 (studentId,date) 행은 그 행의 _rowIndex로 update한다', () => {
    const rows = [
      { _rowIndex: 2, recordId: 'R1', studentId: 'S001', date: '2026-08-30', comment: '이전' },
      { _rowIndex: 3, recordId: 'R2', studentId: 'S002', date: '2026-08-30', comment: '이전' },
    ];
    const p = plan(rows, [{ studentId: 'S002', date: '2026-08-30', comment: '새것' }]);
    expect(p.appends).toHaveLength(0);
    expect(p.updates).toHaveLength(1);
    expect(p.updates[0].rowIndex).toBe(3);
    expect(p.updates[0].row.recordId).toBe('R2');
    expect(p.updates[0].row.comment).toBe('새것');
  });

  it('#2 회귀: 학생마다 서로 다른 행을 쓴다 (교차 덮어쓰기 없음)', () => {
    const rows = [
      { _rowIndex: 2, recordId: 'R1', studentId: 'S001', date: '2026-08-30' },
      { _rowIndex: 3, recordId: 'R2', studentId: 'S002', date: '2026-08-30' },
    ];
    const p = plan(rows, [
      { studentId: 'S001', date: '2026-08-30', comment: 'A' },
      { studentId: 'S002', date: '2026-08-30', comment: 'B' },
    ]);
    expect(p.updates.map(function (u) { return u.rowIndex; })).toEqual([2, 3]);
    expect(p.updates[0].row.comment).toBe('A');
    expect(p.updates[1].row.comment).toBe('B');
  });

  it('update 행은 기존 recordId·createdAt을 보존한다', () => {
    const rows = [{
      _rowIndex: 2, recordId: 'R1', studentId: 'S001', date: '2026-08-30',
      createdAt: '2026-08-01T00:00:00.000Z',
    }];
    const p = plan(rows, [{ studentId: 'S001', date: '2026-08-30', comment: 'x' }]);
    expect(p.updates[0].row.recordId).toBe('R1');
    expect(p.updates[0].row.createdAt).toBe('2026-08-01T00:00:00.000Z');
    expect(p.updates[0].row.updatedAt).toBe('2026-08-30T01:00:00.000Z');
  });

  it('같은 배치에 같은 (학생,날짜)가 두 번 오면 행이 하나만 늘어난다', () => {
    const p = plan([], [
      { studentId: 'S001', date: '2026-08-30', comment: '처음' },
      { studentId: 'S001', date: '2026-08-30', comment: '나중' },
    ], ['R-A', 'R-B']);
    expect(p.appends).toHaveLength(1);
    expect(p.updates).toHaveLength(0);
    expect(p.appends[0].comment).toBe('나중');
    expect(p.appends[0].recordId).toBe('R-A');
    expect(p.saved).toBe(2);
  });

  it('신규 레코드마다 새 id를 한 번씩만 뽑는다', () => {
    const p = plan([], [
      { studentId: 'S001', date: '2026-08-30' },
      { studentId: 'S002', date: '2026-08-30' },
    ], ['R-A', 'R-B']);
    expect(p.appends.map(function (a) { return a.recordId; })).toEqual(['R-A', 'R-B']);
  });

  it('레코드가 없으면 아무것도 쓰지 않는다', () => {
    const p = plan([], []);
    expect(p.saved).toBe(0);
    expect(p.updates).toHaveLength(0);
    expect(p.appends).toHaveLength(0);
  });
});

describe('rowValuesFor', () => {
  it('헤더 순서대로 값을 배열로 만든다', () => {
    const values = rowValuesFor(HEADER, {
      _rowIndex: 5, recordId: 'R1', studentId: 'S001', classId: 'C01', date: '2026-08-30',
    });
    expect(values).toHaveLength(HEADER.length);
    expect(values[0]).toBe('R1');
    expect(values[1]).toBe('S001');
    expect(values[3]).toBe('2026-08-30');
  });

  it('없는 값은 빈 문자열로 채운다 (undefined를 시트에 쓰지 않는다)', () => {
    const values = rowValuesFor(HEADER, { recordId: 'R1', comment: null });
    expect(values[HEADER.indexOf('comment')]).toBe('');
    expect(values.every(function (v) { return v !== undefined && v !== null; })).toBe(true);
  });

  it('_rowIndex 같은 내부 필드는 헤더에 없으므로 새어나가지 않는다', () => {
    expect(rowValuesFor(HEADER, { _rowIndex: 5 }).join('')).toBe('');
  });

  it('빈 헤더 칸은 건너뛴다', () => {
    expect(rowValuesFor(['a', '', 'b'], { a: 1, b: 2 })).toEqual([1, '', 2]);
  });
});
