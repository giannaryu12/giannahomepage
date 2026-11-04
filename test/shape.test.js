import { describe, it, expect } from 'vitest';
import {
  toParentRecord, toParentStudent, toParentPayload,
  hasParentContent_, PARENT_RECORD_FIELDS, toParentCalendar,
} from '../gas/lib/shape.js';

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

  it('영역별 교재·진도를 학부모에게 전달한다', () => {
    const out = toParentRecord({
      date: '2026-08-30', vocabBook: '능률보카', vocabProgress: 'Day 12',
      listeningBook: '', listeningProgress: '',
    });
    expect(out.vocabBook).toBe('능률보카');
    expect(out.vocabProgress).toBe('Day 12');
    expect(out.listeningProgress).toBe('');
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
      // 진도가 없으면 목록에서 걸러진다. 여기서 보려는 건 그게 아니다.
      records: [{
        date: '2026-08-10', vocabProgress: 'Day 12',
        attendance: '출석', homeworkStatus: '제출', testScore: '', testMax: '',
      }],
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
      records: [
        { date: '2026-08-01', vocabProgress: 'a' },
        { date: '2026-08-20', vocabProgress: 'b' },
        { date: '2026-08-10', vocabProgress: 'c' },
      ],
      monthKey: '',
    });
    expect(out.records.map(r => r.date)).toEqual(['2026-08-20', '2026-08-10', '2026-08-01']);
  });
});

describe('hasParentContent_ — 수업이 있었던 날만', () => {
  it('진도가 하나라도 적혀 있으면 낸다', () => {
    expect(hasParentContent_({ vocabProgress: 'Day 12' })).toBe(true);
    expect(hasParentContent_({ etcProgress: '자유 독해' })).toBe(true);
  });

  it('시험대비는 적어 둔 칸이나 통과 여부만으로도 낸다', () => {
    // 통과 여부 한 낱말이 그날의 기록 전부일 수 있다. 거르면 학부모 쪽에서
    // 그 시험이 아예 없던 일이 된다.
    expect(hasParentContent_({ kind: 'exam', examTests: '[{"text":"중간 1차"}]' })).toBe(true);
    expect(hasParentContent_({ kind: 'exam' })).toBe(false);
  });

  it('변경한 날은 적어 둔 것이 있어도 내지 않는다', () => {
    // 그날 수업은 다른 날로 옮겨 갔다. 두 날에 같은 수업이 두 번 서면
    // 학부모는 수업을 두 번 받은 줄 안다.
    expect(hasParentContent_({ attendance: '변경' })).toBe(false);
    expect(hasParentContent_({ attendance: '변경', vocabProgress: 'Day 12' })).toBe(false);
    expect(hasParentContent_({ attendance: '변경', comment: '다음 주에 봅니다' })).toBe(false);
  });

  it('결석한 날은 그대로 낸다 — 안 온 것은 전할 일이다', () => {
    expect(hasParentContent_({ attendance: '결석' })).toBe(true);
  });

  it('영역이 나뉘기 전의 progress도 진도로 본다', () => {
    expect(hasParentContent_({ progress: 'Unit 7' })).toBe(true);
  });

  it('시험 점수와 만점이 함께 있으면 낸다', () => {
    expect(hasParentContent_({ vocabTestScore: 18, vocabTestMax: 20 })).toBe(true);
    expect(hasParentContent_({ listeningTestScore: 8, listeningTestMax: 10 })).toBe(true);
    expect(hasParentContent_({ testScore: 50, testMax: 100 })).toBe(true);
  });

  it('0점도 기록으로 본다', () => {
    // "안 봤음"으로 뭉개면 그날 줄이 통째로 사라진다.
    expect(hasParentContent_({ grammarTestScore: 0, grammarTestMax: 10 })).toBe(true);
  });

  it('만점 없이 점수만 있으면 시험으로 보지 않는다', () => {
    expect(hasParentContent_({ vocabTestScore: 18 })).toBe(false);
    expect(hasParentContent_({ vocabTestScore: 18, vocabTestMax: 0 })).toBe(false);
  });

  it('숙제만 적힌 날도 낸다', () => {
    expect(hasParentContent_({ vocabNext: 'Day 14 외우기' })).toBe(true);
    expect(hasParentContent_({ nextHomework: '옛 숙제' })).toBe(true);
  });

  it('코멘트만 적힌 날도 낸다', () => {
    expect(hasParentContent_({ comment: '오늘은 문법만 봤습니다' })).toBe(true);
  });

  it('결석은 그 자체가 기록이다', () => {
    // 진도도 숙제도 코멘트도 없지만, 결석했다는 사실은 학부모가 봐야 한다.
    expect(hasParentContent_({ attendance: '결석' })).toBe(true);
  });

  it('출결만 찍은 날은 내지 않는다', () => {
    expect(hasParentContent_({ attendance: '출석' })).toBe(false);
    expect(hasParentContent_({ attendance: '지각', homeworkStatus: '제출', homeworkLevel: '상' })).toBe(false);
  });

  it('교재만 채워진 날은 내지 않는다', () => {
    // 교재는 직전 수업에서 자동으로 채워지므로 그날 수업했다는 근거가 아니다.
    expect(hasParentContent_({
      vocabBook: '능률보카', vocabTestBook: '단어시험지', vocabNextBook: '워크북',
    })).toBe(false);
  });

  it('빈 문자열 코멘트는 코멘트가 아니다', () => {
    expect(hasParentContent_({ comment: '   ' })).toBe(false);
  });

  it('빈 기록과 없는 값에 흔들리지 않는다', () => {
    expect(hasParentContent_({})).toBe(false);
    expect(hasParentContent_(null)).toBe(false);
    expect(hasParentContent_({ vocabProgress: '   ' })).toBe(false);
  });
});

describe('toParentPayload — 거르기와 요약', () => {
  const base = { student: { name: '테스트' }, className: '고1 A반' };

  it('아무것도 적히지 않은 날은 목록에서 뺀다', () => {
    const out = toParentPayload(Object.assign({}, base, {
      records: [
        { date: '2026-08-30', vocabProgress: 'Day 12', attendance: '출석' },
        { date: '2026-08-28', attendance: '결석' },
        { date: '2026-08-26', attendance: '출석' },
      ],
    }));
    // 결석한 날은 남고, 출석만 찍힌 26일만 빠진다.
    expect(out.records.map((r) => r.date)).toEqual(['2026-08-30', '2026-08-28']);
  });

  it('걸러진 날도 출석률에는 그대로 들어간다', () => {
    // 거르기를 먼저 하면 세어야 할 날이 통계에서 빠진다.
    const out = toParentPayload(Object.assign({}, base, {
      records: [
        { date: '2026-08-30', vocabProgress: 'Day 12', attendance: '출석' },
        { date: '2026-08-28', attendance: '출석' },
        { date: '2026-08-26', attendance: '결석' },
        { date: '2026-08-24', attendance: '결석' },
      ],
    }));
    expect(out.records.map((r) => r.date)).toEqual(['2026-08-30', '2026-08-26', '2026-08-24']);
    expect(out.summary.attendanceRate).toBe(50);
  });
});

describe('toParentPayload — 누적과 이달', () => {
  const base = { student: { name: '테스트' }, className: '고1 A반' };
  const records = [
    { date: '2026-09-01', vocabProgress: 'a', attendance: '출석', homeworkStatus: '제출' },
    { date: '2026-08-30', vocabProgress: 'b', attendance: '결석' },
    { date: '2026-08-28', vocabProgress: 'c', attendance: '결석', homeworkStatus: '미제출' },
  ];

  it('본체는 늘 전체 기록이다', () => {
    const out = toParentPayload(Object.assign({}, base, { records, monthKey: '2026-09' }));
    expect(out.summary.attendanceRate).toBe(33);  // 3건 중 출석 1
    expect(out.summary.homeworkRate).toBe(50);    // 2건 중 제출 1
    expect(out.summary.recordCount).toBe(3);
  });

  it('이달 숫자를 따로 낸다', () => {
    const out = toParentPayload(Object.assign({}, base, { records, monthKey: '2026-09' }));
    expect(out.summary.monthKey).toBe('2026-09');
    expect(out.summary.monthAttendanceRate).toBe(100);
    expect(out.summary.monthHomeworkRate).toBe(100);
  });

  it('이달 기록이 없으면 이달만 null이고 누적은 그대로다', () => {
    // 달이 바뀐 1일. 예전에는 이 경우 카드가 전부 비었다.
    const out = toParentPayload(Object.assign({}, base, { records, monthKey: '2026-10' }));
    expect(out.summary.monthAttendanceRate).toBeNull();
    expect(out.summary.monthHomeworkRate).toBeNull();
    expect(out.summary.attendanceRate).toBe(33);
  });

  it('달을 주지 않으면 이달 숫자는 null이다', () => {
    const out = toParentPayload(Object.assign({}, base, { records }));
    expect(out.summary.monthKey).toBe('');
    expect(out.summary.monthAttendanceRate).toBeNull();
    expect(out.summary.attendanceRate).toBe(33);
  });
});


describe('toParentCalendar — 학부모 달력', () => {
  const student = { studentId: 'S1', schedule: '화 17:00', createdAt: '2026-11-03T01:00:00Z' };

  it('첫 수업 기록이 있는 달부터 보여 준다', () => {
    const cal = toParentCalendar({
      student: student,
      records: [{ date: '2027-01-05', attendance: '출석' }, { date: '2026-12-08', attendance: '출석' }],
    });
    expect(cal.firstMonth).toBe('2026-12');
  });

  it('기록이 없으면 등록한 달부터다', () => {
    expect(toParentCalendar({ student: student, records: [] }).firstMonth).toBe('2026-11');
  });

  it('기록도 등록일도 없으면 비워 둔다 — 화면이 이번 달을 쓴다', () => {
    expect(toParentCalendar({ student: { studentId: 'S1' }, records: [] }).firstMonth).toBe('');
  });

  it('그 학생의 하루치 조각만 내려보낸다', () => {
    const cal = toParentCalendar({
      student: student,
      records: [],
      overrides: [
        { overrideId: 'O1', date: '2026-11-10', studentId: 'S1', kind: 'skip', reason: 'moved' },
        { overrideId: 'O2', date: '2026-11-10', studentId: 'S9', kind: 'add', time: '16:00' },
      ],
    });
    expect(cal.overrides).toHaveLength(1);
    expect(cal.overrides[0].overrideId).toBe('O1');
  });

  it('날짜별 출결과 회차를 모은다', () => {
    const cal = toParentCalendar({
      student: student,
      records: [{ date: '2026-11-03', attendance: '출석', sessionNo: 7 }, { date: '2026-11-05' }],
    });
    expect(cal.marks).toEqual({ '2026-11-03': { attendance: '출석', sessionNo: '7' } });
  });
});


describe('toParentPayload — 지난달과 한마디', () => {
  const recs = [
    { studentId: 'S1', date: '2026-11-20', attendance: '출석', homeworkStatus: '제출', comment: '잘했습니다', vocabTestScore: 9, vocabTestMax: 10 },
    { studentId: 'S1', date: '2026-11-18', attendance: '출석', homeworkStatus: '미제출' },
    { studentId: 'S1', date: '2026-10-20', attendance: '결석', homeworkStatus: '제출', comment: '지난달 한마디', vocabTestScore: 8, vocabTestMax: 10 },
  ];
  const p = toParentPayload({ student: { studentId: 'S1', name: '최지우' }, records: recs, monthKey: '2026-11' });

  it('지난달 출결·숙제 비율을 함께 낸다', () => {
    expect(p.summary.monthAttendanceRate).toBe(100);
    expect(p.summary.prevAttendanceRate).toBe(0);
    expect(p.summary.monthHomeworkRate).toBe(50);
    expect(p.summary.prevHomeworkRate).toBe(100);
  });

  it('시험 묶음 평균도 이달·지난달로 낸다', () => {
    expect(p.summary.monthTests.vocab).toBe(90);
    expect(p.summary.prevTests.vocab).toBe(80);
  });

  it('코멘트는 그날 기록에 그대로 실린다 — 요약으로 따로 빼지 않는다', () => {
    expect(p.records[0].comment).toBe('잘했습니다');
  });

  it('1월의 지난달은 지난해 12월이다', () => {
    const jan = toParentPayload({
      student: { studentId: 'S1' },
      records: [{ studentId: 'S1', date: '2026-12-10', attendance: '출석' }],
      monthKey: '2027-01',
    });
    expect(jan.summary.prevAttendanceRate).toBe(100);
  });
});
