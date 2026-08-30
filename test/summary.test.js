import { describe, it, expect } from 'vitest';
import { computeSummary } from '../gas/lib/summary.js';

function rec(over) {
  return Object.assign({
    date: '2026-08-10',
    attendance: '출석',
    homeworkStatus: '제출',
    testScore: '',
    testMax: '',
  }, over || {});
}

describe('computeSummary', () => {
  it('기록이 없으면 전부 null이다', () => {
    expect(computeSummary([], '2026-08')).toEqual({
      attendanceRate: null, homeworkRate: null, avgScore: null, recordCount: 0,
    });
  });

  it('해당 월의 기록만 센다', () => {
    const r = computeSummary([rec({ date: '2026-08-10' }), rec({ date: '2026-07-10' })], '2026-08');
    expect(r.recordCount).toBe(1);
  });

  it('monthKey가 비면 전체 기간을 센다', () => {
    const r = computeSummary([rec({ date: '2026-08-10' }), rec({ date: '2026-07-10' })], '');
    expect(r.recordCount).toBe(2);
  });

  it('결석만 미출석으로 센다', () => {
    const r = computeSummary([
      rec({ attendance: '출석' }), rec({ attendance: '지각' }),
      rec({ attendance: '보강' }), rec({ attendance: '결석' }),
    ], '2026-08');
    expect(r.attendanceRate).toBe(75);
  });

  it('출결이 비어 있는 기록은 출석률 분모에서 뺀다', () => {
    const r = computeSummary([rec({ attendance: '출석' }), rec({ attendance: '' })], '2026-08');
    expect(r.attendanceRate).toBe(100);
  });

  it('제출과 부분제출을 제출로 센다', () => {
    const r = computeSummary([
      rec({ homeworkStatus: '제출' }), rec({ homeworkStatus: '부분제출' }),
      rec({ homeworkStatus: '미제출' }), rec({ homeworkStatus: '미제출' }),
    ], '2026-08');
    expect(r.homeworkRate).toBe(50);
  });

  it('해당없음은 과제 분모에서 뺀다', () => {
    const r = computeSummary([
      rec({ homeworkStatus: '제출' }), rec({ homeworkStatus: '해당없음' }),
    ], '2026-08');
    expect(r.homeworkRate).toBe(100);
  });

  it('과제가 전부 해당없음이면 null이다', () => {
    const r = computeSummary([rec({ homeworkStatus: '해당없음' })], '2026-08');
    expect(r.homeworkRate).toBe(null);
  });

  it('평균 점수를 100점 환산으로 낸다', () => {
    const r = computeSummary([
      rec({ testScore: '18', testMax: '20' }),
      rec({ testScore: '5', testMax: '10' }),
    ], '2026-08');
    expect(r.avgScore).toBe(70);
  });

  it('점수 없는 기록은 평균에서 뺀다', () => {
    const r = computeSummary([
      rec({ testScore: '20', testMax: '20' }), rec({ testScore: '', testMax: '' }),
    ], '2026-08');
    expect(r.avgScore).toBe(100);
  });

  it('점수가 하나도 없으면 null이다', () => {
    expect(computeSummary([rec()], '2026-08').avgScore).toBe(null);
  });

  it('만점이 0인 기록은 무시한다', () => {
    const r = computeSummary([
      rec({ testScore: '5', testMax: '0' }), rec({ testScore: '10', testMax: '10' }),
    ], '2026-08');
    expect(r.avgScore).toBe(100);
  });

  it('반올림해서 정수로 낸다', () => {
    const r = computeSummary([
      rec({ attendance: '출석' }), rec({ attendance: '출석' }), rec({ attendance: '결석' }),
    ], '2026-08');
    expect(r.attendanceRate).toBe(67);
  });

  it('records가 배열이 아니면 빈 결과를 낸다', () => {
    expect(computeSummary(null, '2026-08').recordCount).toBe(0);
  });
});
