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
      attendanceRate: null, homeworkRate: null, avgScore: null,
      vocabAvg: null, grammarAvg: null, listeningAvg: null,
      recordCount: 0,
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

describe('영역별 평균 점수', () => {
  it('단어·문법·듣기 셋으로 평균낸다', () => {
    const s = computeSummary([
      {
        vocabTestScore: 18, vocabTestMax: 20,
        vocab2TestScore: 6, vocab2TestMax: 10,
        grammarTestScore: 14, grammarTestMax: 20,
        listeningTestScore: 5, listeningTestMax: 10,
      },
      { vocabTestScore: 16, vocabTestMax: 20 },
    ], '');
    expect(s.vocabAvg).toBe(77);   // 90, 60, 80 → 76.67
    expect(s.grammarAvg).toBe(70);
    expect(s.listeningAvg).toBe(50);
    expect(s.vocab2Avg).toBeUndefined();
  });

  it('두 단어 시험을 한 묶음으로 센다', () => {
    // 한 수업에 두 번 보므로 두 점수가 각각 한 번씩 평균에 들어간다.
    const s = computeSummary([
      { vocabTestScore: 20, vocabTestMax: 20, vocab2TestScore: 0, vocab2TestMax: 20 },
    ], '');
    expect(s.vocabAvg).toBe(50);
  });

  it('둘째 단어 시험만 봐도 단어 평균이 나온다', () => {
    const s = computeSummary([{ vocab2TestScore: 15, vocab2TestMax: 20 }], '');
    expect(s.vocabAvg).toBe(75);
  });

  it('기록이 없는 영역은 0이 아니라 null이다', () => {
    // "0점"과 "아직 안 봤다"는 다르다.
    const s = computeSummary([{ vocabTestScore: 20, vocabTestMax: 20 }], '');
    expect(s.vocabAvg).toBe(100);
    expect(s.grammarAvg).toBeNull();
    expect(s.listeningAvg).toBeNull();
  });

  it('0점도 평균에 들어간다', () => {
    const s = computeSummary([
      { vocabTestScore: 0, vocabTestMax: 20 },
      { vocabTestScore: 20, vocabTestMax: 20 },
    ], '');
    expect(s.vocabAvg).toBe(50);
  });

  it('만점이 0이면 세지 않는다', () => {
    expect(computeSummary([{ vocabTestScore: 5, vocabTestMax: 0 }], '').vocabAvg).toBeNull();
  });

  it('옛 시험 평균은 영역 점수와 섞이지 않는다', () => {
    const s = computeSummary([
      { testScore: 50, testMax: 100 },
      { vocabTestScore: 20, vocabTestMax: 20 },
    ], '');
    expect(s.avgScore).toBe(50);
    expect(s.vocabAvg).toBe(100);
  });
});

describe('달 범위를 주지 않으면 전체를 센다', () => {
  it('여러 달에 걸친 기록을 모두 센다', () => {
    // 달로 자르면 1일마다 카드가 전부 '기록 없음'이 된다.
    const s = computeSummary([
      { date: '2026-07-30', attendance: '출석', homeworkStatus: '제출' },
      { date: '2026-08-30', attendance: '결석', homeworkStatus: '미제출' },
    ], '');
    expect(s.attendanceRate).toBe(50);
    expect(s.homeworkRate).toBe(50);
    expect(s.recordCount).toBe(2);
  });

  it('달을 주면 그 달만 센다', () => {
    const s = computeSummary([
      { date: '2026-07-30', attendance: '결석' },
      { date: '2026-08-30', attendance: '출석' },
    ], '2026-08');
    expect(s.attendanceRate).toBe(100);
    expect(s.recordCount).toBe(1);
  });
});
