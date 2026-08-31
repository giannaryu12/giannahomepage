import { describe, it, expect } from 'vitest';
import { validateRecord, validateBatch } from '../gas/lib/validate.js';

function valid(over) {
  return Object.assign({
    studentId: 'S001',
    date: '2026-08-30',
    attendance: '출석',
    homeworkStatus: '제출',
    homeworkLevel: '상',
    testName: '',
    testScore: '',
    testMax: '',
  }, over || {});
}

describe('validateRecord', () => {
  it('정상 기록은 오류가 없다', () => {
    expect(validateRecord(valid())).toEqual([]);
  });

  it('객체가 아니면 오류다', () => {
    expect(validateRecord(null).length).toBeGreaterThan(0);
    expect(validateRecord('x').length).toBeGreaterThan(0);
  });

  it('studentId가 없으면 오류다', () => {
    expect(validateRecord(valid({ studentId: '' }))).toContain('studentId 누락');
  });

  it('date 형식이 틀리면 오류다', () => {
    expect(validateRecord(valid({ date: '2026/08/30' }))).toContain('date 형식 오류');
    expect(validateRecord(valid({ date: '' }))).toContain('date 형식 오류');
  });

  it('attendance가 허용값이 아니면 오류다', () => {
    expect(validateRecord(valid({ attendance: '조퇴' }))).toContain('attendance 값 오류');
  });

  it('attendance가 비어 있으면 통과한다', () => {
    expect(validateRecord(valid({ attendance: '' }))).toEqual([]);
  });

  it('homeworkStatus가 허용값이 아니면 오류다', () => {
    expect(validateRecord(valid({ homeworkStatus: '했음' }))).toContain('homeworkStatus 값 오류');
  });

  it('homeworkLevel이 허용값이 아니면 오류다', () => {
    expect(validateRecord(valid({ homeworkLevel: 'A' }))).toContain('homeworkLevel 값 오류');
  });

  it('점수가 비어 있으면 통과한다', () => {
    expect(validateRecord(valid({ testScore: '', testMax: '' }))).toEqual([]);
  });

  it('점수만 있고 만점이 없으면 오류다', () => {
    expect(validateRecord(valid({ testScore: '18', testMax: '' }))).toContain('testMax 오류');
  });

  it('점수가 만점보다 크면 오류다', () => {
    expect(validateRecord(valid({ testScore: '21', testMax: '20' })))
      .toContain('testScore가 testMax보다 큽니다');
  });

  it('음수 점수는 오류다', () => {
    expect(validateRecord(valid({ testScore: '-1', testMax: '20' }))).toContain('testScore 오류');
  });

  it('숫자가 아닌 점수는 오류다', () => {
    expect(validateRecord(valid({ testScore: '십팔', testMax: '20' }))).toContain('testScore 오류');
  });

  it('만점이 0이면 오류다', () => {
    expect(validateRecord(valid({ testScore: '0', testMax: '0' }))).toContain('testMax 오류');
  });

  it('점수와 만점이 정상이면 통과한다', () => {
    expect(validateRecord(valid({ testName: '단어시험', testScore: '18', testMax: '20' }))).toEqual([]);
  });
});

describe('validateBatch', () => {
  it('전부 정상이면 빈 배열이다', () => {
    expect(validateBatch([valid(), valid({ studentId: 'S002' })])).toEqual([]);
  });

  it('문제가 있는 항목의 인덱스와 오류를 돌려준다', () => {
    const result = validateBatch([valid(), valid({ date: 'bad' })]);
    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(1);
    expect(result[0].errors).toContain('date 형식 오류');
  });

  it('배열이 아니면 통째로 오류다', () => {
    expect(validateBatch(null)).toHaveLength(1);
  });
});

describe('영역별 시험 점수', () => {
  const valid = (extra) => Object.assign({ studentId: 'S001', date: '2026-08-30' }, extra);

  it('단어 시험 점수만 있고 만점이 없으면 오류다', () => {
    expect(validateRecord(valid({ vocabTestScore: '18' })))
      .toContain('vocabTestMax 오류');
  });

  it('듣기 시험 점수가 만점보다 크면 오류다', () => {
    expect(validateRecord(valid({ listeningTestScore: '11', listeningTestMax: '10' })))
      .toContain('listeningTestScore가 listeningTestMax보다 큽니다');
  });

  it('두 시험이 다 비어 있으면 오류가 없다', () => {
    expect(validateRecord(valid({
      vocabTestScore: '', vocabTestMax: '', listeningTestScore: '', listeningTestMax: '',
    }))).toEqual([]);
  });

  it('0점은 정상이다', () => {
    expect(validateRecord(valid({ vocabTestScore: '0', vocabTestMax: '20' }))).toEqual([]);
  });

  it('한 시험의 오류가 다른 시험 검사를 막지 않는다', () => {
    const errors = validateRecord(valid({
      vocabTestScore: '18', vocabTestMax: '',
      listeningTestScore: '-1', listeningTestMax: '10',
    }));
    expect(errors).toContain('vocabTestMax 오류');
    expect(errors).toContain('listeningTestScore 오류');
  });

  it('둘째 단어 시험과 문법 시험도 검사한다', () => {
    const errors = validateRecord(valid({
      vocab2TestScore: '21', vocab2TestMax: '20',
      grammarTestScore: '5', grammarTestMax: '',
    }));
    expect(errors).toContain('vocab2TestScore가 vocab2TestMax보다 큽니다');
    expect(errors).toContain('grammarTestMax 오류');
  });

  it('네 시험이 모두 정상이면 오류가 없다', () => {
    expect(validateRecord(valid({
      vocabTestScore: '18', vocabTestMax: '20',
      vocab2TestScore: '0', vocab2TestMax: '20',
      grammarTestScore: '15', grammarTestMax: '20',
      listeningTestScore: '9', listeningTestMax: '10',
    }))).toEqual([]);
  });
});
