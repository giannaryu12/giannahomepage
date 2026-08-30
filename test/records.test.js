import { describe, it, expect } from 'vitest';
import {
  findRecordMatch,
  buildRecordPayload,
  PROGRESS_FIELDS,
  lastBooksOf,
} from '../gas/lib/records.js';

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
  it('Records 컬럼 중 buildRecordPayload가 채우는 필드를 모두 매핑한다', () => {
    const rec = {
      studentId: 'S001',
      date: '2026-08-30',
      progress: 'Unit 7',
      vocabBook: '능률보카', vocabProgress: 'Day 12',
      readingBook: '리딩튜터', readingProgress: 'Unit 5',
      grammarBook: '', grammarProgress: '',
      listeningBook: '', listeningProgress: '',
      etcBook: '', etcProgress: '',
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
      vocabBook: '능률보카', vocabProgress: 'Day 12',
      readingBook: '리딩튜터', readingProgress: 'Unit 5',
      grammarBook: '', grammarProgress: '',
      listeningBook: '', listeningProgress: '',
      etcBook: '', etcProgress: '',
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

  it('영역 필드를 안 보내면 빈 문자열로 채운다', () => {
    const payload = buildRecordPayload(
      { studentId: 'S001', date: '2026-08-30' },
      'C01', 'req-1', '2026-08-30T01:00:00.000Z'
    );
    PROGRESS_FIELDS.forEach((f) => expect(payload[f]).toBe(''));
  });

  it('영역 구분 없이 쌓인 옛 progress는 화면이 그대로 돌려주면 보존된다', () => {
    // 화면에서 안 보낸다는 이유로 지워지면 이미 쌓인 기록이 사라진다.
    const payload = buildRecordPayload(
      { studentId: 'S001', date: '2026-08-30', progress: '예전 진도 메모', vocabProgress: 'Day 1' },
      'C01', 'req-1', '2026-08-30T01:00:00.000Z'
    );
    expect(payload.progress).toBe('예전 진도 메모');
    expect(payload.vocabProgress).toBe('Day 1');
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

describe('lastBooksOf', () => {
  it('가장 최근 날짜의 교재를 영역별로 돌려준다', () => {
    const books = lastBooksOf([
      { date: '2026-08-16', vocabBook: '옛 단어책', readingBook: '옛 독해책' },
      { date: '2026-08-23', vocabBook: '새 단어책' },
    ]);
    expect(books.vocab).toBe('새 단어책');
  });

  it('최근 기록에 그 영역 교재가 비어 있으면 더 예전 기록에서 찾는다', () => {
    // 그날 독해를 안 했다고 해서 독해 교재가 바뀐 것은 아니다.
    const books = lastBooksOf([
      { date: '2026-08-16', readingBook: '리딩튜터' },
      { date: '2026-08-23', readingBook: '' },
    ]);
    expect(books.reading).toBe('리딩튜터');
  });

  it('날짜 순서와 무관하게 최신 것이 이긴다', () => {
    const books = lastBooksOf([
      { date: '2026-08-30', vocabBook: '최신' },
      { date: '2026-08-02', vocabBook: '옛것' },
      { date: '2026-08-16', vocabBook: '중간' },
    ]);
    expect(books.vocab).toBe('최신');
  });

  it('기록이 없으면 다섯 영역이 모두 빈 문자열이다', () => {
    expect(lastBooksOf([])).toEqual({ vocab: '', reading: '', grammar: '', listening: '', etc: '' });
    expect(lastBooksOf(null).vocab).toBe('');
  });

  it('공백만 있는 교재는 값으로 치지 않는다', () => {
    expect(lastBooksOf([{ date: '2026-08-30', vocabBook: '   ' }]).vocab).toBe('');
  });
});
