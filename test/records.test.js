import { describe, it, expect } from 'vitest';
import {
  findRecordMatch,
  buildRecordPayload,
  lastSessionNoOf,
  isNumericColumn_,
  RECORD_AREA_FIELDS,
  BOOK_FIELDS,
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
      sessionNo: '',
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
      sessionNo: '',
      progress: 'Unit 7',
      vocabBook: '능률보카', vocabProgress: 'Day 12',
      readingBook: '리딩튜터', readingProgress: 'Unit 5',
      grammarBook: '', grammarProgress: '',
      listeningBook: '', listeningProgress: '',
      etcBook: '', etcProgress: '',
      vocabNextBook: '', vocabNext: '', readingNextBook: '', readingNext: '',
      grammarNextBook: '', grammarNext: '', listeningNextBook: '', listeningNext: '',
      etcNextBook: '', etcNext: '',
      vocabTestBook: '', vocabTestScore: '', vocabTestMax: '',
      vocab2TestBook: '', vocab2TestScore: '', vocab2TestMax: '',
      grammarTestBook: '', grammarTestScore: '', grammarTestMax: '',
      listeningTestBook: '', listeningTestScore: '', listeningTestMax: '',
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
    RECORD_AREA_FIELDS.forEach((f) => expect(payload[f]).toBe(''));
  });

  it('결석한 날은 회차를 세지 않는다', () => {
    // 수업을 안 했으니 다음에 오는 날이 그 회차다. 화면이 숫자를 보내도
    // 비운다 — 출결보다 회차가 먼저 채워지므로 누른 순서에 따라 남을 수 있다.
    const payload = buildRecordPayload(
      { studentId: 'S001', date: '2026-08-30', attendance: '결석', sessionNo: 12 },
      'C01', 'req-1', '2026-08-30T01:00:00.000Z'
    );
    expect(payload.sessionNo).toBe('');
    expect(payload.attendance).toBe('결석');
  });

  it('결석이 아니면 회차를 그대로 둔다', () => {
    ['출석', '지각', '보강', ''].forEach((att) => {
      const payload = buildRecordPayload(
        { studentId: 'S001', date: '2026-08-30', attendance: att, sessionNo: 12 },
        'C01', 'req-1', '2026-08-30T01:00:00.000Z'
      );
      expect(payload.sessionNo).toBe(12);
    });
  });

  it('시험 점수 0점이 빈 칸으로 뭉개지지 않는다', () => {
    const payload = buildRecordPayload(
      { studentId: 'S001', date: '2026-08-30', vocabTestScore: 0, vocabTestMax: 20 },
      'C01', 'req-1', '2026-08-30T01:00:00.000Z'
    );
    expect(payload.vocabTestScore).toBe(0);
    expect(payload.vocabTestMax).toBe(20);
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
  it('가장 최근 날짜의 교재를 교재 칸마다 돌려준다', () => {
    const books = lastBooksOf([
      { date: '2026-08-16', vocabBook: '옛 단어책', readingBook: '옛 독해책' },
      { date: '2026-08-23', vocabBook: '새 단어책' },
    ]);
    expect(books.vocabBook).toBe('새 단어책');
  });

  it('진도·숙제·시험 교재를 각각 따로 기억한다', () => {
    const books = lastBooksOf([{
      date: '2026-08-30',
      vocabBook: '능률보카', vocabNextBook: '워크북', vocabTestBook: '단어시험지',
    }]);
    expect(books.vocabBook).toBe('능률보카');
    expect(books.vocabNextBook).toBe('워크북');
    expect(books.vocabTestBook).toBe('단어시험지');
  });

  it('최근 기록에 그 칸이 비어 있으면 더 예전 기록에서 찾는다', () => {
    // 그날 독해를 안 했다고 해서 독해 교재가 바뀐 것은 아니다.
    const books = lastBooksOf([
      { date: '2026-08-16', readingBook: '리딩튜터' },
      { date: '2026-08-23', readingBook: '' },
    ]);
    expect(books.readingBook).toBe('리딩튜터');
  });

  it('날짜 순서와 무관하게 최신 것이 이긴다', () => {
    const books = lastBooksOf([
      { date: '2026-08-30', vocabBook: '최신' },
      { date: '2026-08-02', vocabBook: '옛것' },
      { date: '2026-08-16', vocabBook: '중간' },
    ]);
    expect(books.vocabBook).toBe('최신');
  });

  it('기록이 없으면 교재 칸이 모두 빈 문자열이다', () => {
    const books = lastBooksOf([]);
    BOOK_FIELDS.forEach((f) => expect(books[f]).toBe(''));
    expect(lastBooksOf(null).vocabBook).toBe('');
  });

  it('공백만 있는 교재는 값으로 치지 않는다', () => {
    expect(lastBooksOf([{ date: '2026-08-30', vocabBook: '   ' }]).vocabBook).toBe('');
  });
});

describe('lastSessionNoOf', () => {
  it('결석한 날은 숫자가 남아 있어도 세지 않는다', () => {
    // 규칙이 생기기 전에 쌓인 결석 기록에는 회차가 적혀 있다. 그 숫자를
    // 이어받으면 안 온 날이 한 회차를 먹는다.
    expect(lastSessionNoOf([
      { date: '2026-08-16', sessionNo: 9, attendance: '출석' },
      { date: '2026-08-23', sessionNo: 10, attendance: '결석' },
    ])).toBe(9);
  });

  it('beforeDate를 주면 그 앞의 기록만 본다', () => {
    // 보충은 빠진 날보다 뒤, 그 뒤 수업보다는 앞에 끼어든다. 전체에서
    // 가장 큰 회차를 쓰면 보충과 그 뒤 수업이 같은 회차가 된다.
    const recs = [
      { date: '2026-08-16', sessionNo: 9 },
      { date: '2026-08-19', sessionNo: '' },
      { date: '2026-08-23', sessionNo: 11 },
    ];
    expect(lastSessionNoOf(recs, '2026-08-21')).toBe(9);
    expect(lastSessionNoOf(recs, '2026-08-30')).toBe(11);
    expect(lastSessionNoOf(recs)).toBe(11);
  });

  it('같은 날의 기록은 제 회차를 물려주지 않는다', () => {
    // 고쳐 넣는 중인 그 기록이다. 세면 저장할 때마다 회차가 하나씩 는다.
    expect(lastSessionNoOf([
      { date: '2026-08-16', sessionNo: 9 },
      { date: '2026-08-23', sessionNo: 11 },
    ], '2026-08-23')).toBe(9);
  });

  it('그 앞에 기록이 없으면 0이다', () => {
    expect(lastSessionNoOf([{ date: '2026-08-23', sessionNo: 11 }], '2026-08-01')).toBe(0);
  });

  it('가장 최근 기록의 회차를 돌려준다', () => {
    expect(lastSessionNoOf([
      { date: '2026-08-16', sessionNo: 9 },
      { date: '2026-08-23', sessionNo: 11 },
    ])).toBe(11);
  });

  it('회차를 빼먹은 날은 건너뛰고 그 앞을 찾는다', () => {
    expect(lastSessionNoOf([
      { date: '2026-08-16', sessionNo: 9 },
      { date: '2026-08-23', sessionNo: '' },
    ])).toBe(9);
  });

  it('회차가 하나도 없으면 0이다', () => {
    expect(lastSessionNoOf([{ date: '2026-08-23' }])).toBe(0);
    expect(lastSessionNoOf([])).toBe(0);
    expect(lastSessionNoOf(null)).toBe(0);
  });
});

describe('buildRecordPayload — 회차', () => {
  it('회차를 그대로 싣는다', () => {
    const payload = buildRecordPayload(
      { studentId: 'S001', date: '2026-08-30', sessionNo: 12 }, 'C01', 'r', 'now'
    );
    expect(payload.sessionNo).toBe(12);
  });

  it('회차가 비면 빈 문자열이다', () => {
    const payload = buildRecordPayload(
      { studentId: 'S001', date: '2026-08-30' }, 'C01', 'r', 'now'
    );
    expect(payload.sessionNo).toBe('');
  });
});

describe('isNumericColumn_', () => {
  it('점수와 회차만 숫자로 둔다', () => {
    expect(isNumericColumn_('sessionNo')).toBe(true);
    expect(isNumericColumn_('testScore')).toBe(true);
    expect(isNumericColumn_('testMax')).toBe(true);
    expect(isNumericColumn_('vocabTestScore')).toBe(true);
    expect(isNumericColumn_('vocab2TestMax')).toBe(true);
    expect(isNumericColumn_('listeningTestScore')).toBe(true);
  });

  it('선생님이 글로 적는 칸은 전부 텍스트다', () => {
    // 여기가 숫자로 새면 진도의 '9-12'가 9월 12일로 저장된다.
    ['vocabProgress', 'vocabNext', 'vocabBook', 'vocabTestBook', 'vocabNextBook',
      'progress', 'nextHomework', 'comment', 'testName', 'date', 'attendance',
      'homeworkStatus', 'homeworkLevel', 'studentId', 'parentToken', 'name', 'grade',
    ].forEach((k) => expect(isNumericColumn_(k)).toBe(false));
  });

  it('이름이 없어도 터지지 않는다', () => {
    expect(isNumericColumn_('')).toBe(false);
    expect(isNumericColumn_(null)).toBe(false);
    expect(isNumericColumn_(undefined)).toBe(false);
  });
});
