import { describe, it, expect } from 'vitest';
import {
  toParentRecord, toParentStudent, toParentPayload,
  hasParentContent_, PARENT_RECORD_FIELDS, toParentCalendar, mergeSameDay_,
  parentFirstDate_, PARENT_SELF_ID,
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
  it('이름·학년·학교·반만 남긴다', () => {
    const out = toParentStudent(
      { name: '김민준', grade: '고1', school: '수원고', parentToken: 'SECRET', note: '메모', active: true },
      'Structure 화목 5시'
    );
    expect(out).toEqual({
      name: '김민준', grade: '고1', school: '수원고', className: 'Structure 화목 5시',
    });
  });

  it('학교를 안 적었으면 빈 문자열이다', () => {
    expect(toParentStudent({ name: '김민준', grade: '고1' }, '').school).toBe('');
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

  it('출결을 누른 날은 다른 칸이 비어도 낸다', () => {
    // 선생님이 출결을 누른 쪽이 그날 실제로 한 수업이다.
    expect(hasParentContent_({ attendance: '출석' })).toBe(true);
    expect(hasParentContent_({ attendance: '지각' })).toBe(true);
    expect(hasParentContent_({ attendance: '보강' })).toBe(true);
  });

  it('출결도 적은 것도 없는 날은 내지 않는다', () => {
    // 같은 날 다른 갈래에 출결을 누르면, 이쪽은 회차와 교재가 자동으로
    // 채워진 채 저장되었을 뿐이다. 둘 다 근거로 치지 않는다.
    expect(hasParentContent_({ sessionNo: 12 })).toBe(false);
    expect(hasParentContent_({ attendance: '', homeworkStatus: '', vocabBook: '능률보카' })).toBe(false);
  });

  it('교재만 채워진 날은 내지 않는다', () => {
    // 교재는 직전 수업에서 자동으로 채워지므로 그날 수업했다는 근거가 아니다.
    expect(hasParentContent_({
      vocabBook: '능률보카', vocabTestBook: '단어시험지', vocabNextBook: '워크북',
    })).toBe(false);
  });

  it('출결이 없어도 손으로 적은 것이 있으면 낸다', () => {
    // 시험대비에 출결을 누른 날, 정규수업 쪽에 적어 둔 진도가 있으면
    // 그것도 전한다 — 자동으로 채워진 것이 아니라 손으로 적은 것이다.
    expect(hasParentContent_({ vocabProgress: 'Day 12' })).toBe(true);
    expect(hasParentContent_({ examTests: '[{"text":"모의고사"}]' })).toBe(true);
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
        { date: '2026-08-26', sessionNo: 9, vocabBook: '능률보카' },
      ],
    }));
    // 회차와 교재만 자동으로 채워진 26일만 빠진다.
    expect(out.records.map((r) => r.date)).toEqual(['2026-08-30', '2026-08-28']);
  });

  it('같은 날 두 갈래 중 출결을 누른 쪽만 낸다', () => {
    const out = toParentPayload(Object.assign({}, base, {
      records: [
        { date: '2026-08-30', kind: 'exam', attendance: '출석', examTests: '[{"text":"모의고사"}]' },
        { date: '2026-08-30', kind: 'regular', sessionNo: 12, vocabBook: '능률보카' },
      ],
    }));
    expect(out.records.map((r) => r.kind)).toEqual(['exam']);
  });

  it('출결을 누르지 않은 갈래에 적힌 것은 누른 쪽에 담아 한 줄로 낸다', () => {
    const out = toParentPayload(Object.assign({}, base, {
      records: [
        { date: '2026-08-30', kind: 'exam', attendance: '출석' },
        { date: '2026-08-30', kind: 'regular', sessionNo: 12, vocabBook: '능률보카', vocabProgress: 'Day 12' },
      ],
    }));
    expect(out.records.length).toBe(1);
    expect(out.records[0].kind).toBe('exam');
    expect(out.records[0].vocabProgress).toBe('Day 12');
    // 교재는 진도와 함께 따라온다 — 'Day 12'만 있으면 무슨 책인지 모른다.
    expect(out.records[0].vocabBook).toBe('능률보카');
    // 옮겨 온 쪽의 회차는 가져오지 않는다. 회차는 출결을 누른 쪽의 것이다.
    expect(out.records[0].sessionNo).toBe('');
  });

  it('걸러진 날도 출석률에는 그대로 들어간다', () => {
    // 거르기를 먼저 하면 세어야 할 날이 통계에서 빠진다.
    const out = toParentPayload(Object.assign({}, base, {
      records: [
        { date: '2026-08-30', vocabProgress: 'Day 12', attendance: '출석' },
        { date: '2026-08-28', attendance: '변경' },
        { date: '2026-08-26', attendance: '결석' },
        { date: '2026-08-24', attendance: '결석' },
      ],
    }));
    // 변경한 날은 목록에서 빠지지만 출석률에서도 빠지므로 1/3이 아니다.
    expect(out.records.map((r) => r.date)).toEqual(['2026-08-30', '2026-08-26', '2026-08-24']);
    expect(out.summary.attendanceRate).toBe(33);
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
    expect(cal.firstDate).toBe('2026-12-08');
  });

  it('출결을 적지 않은 날은 첫 수업으로 치지 않는다', () => {
    // 회차와 교재만 자동으로 채워진 채 저장된 날이다. 그날 수업을
    // 했다는 자취는 출결뿐이다.
    const cal = toParentCalendar({
      student: student,
      records: [
        { date: '2026-11-10', sessionNo: 1, vocabBook: '능률보카' },
        { date: '2026-12-08', attendance: '출석' },
      ],
    });
    expect(cal.firstMonth).toBe('2026-12');
    expect(cal.firstDate).toBe('2026-12-08');
  });

  it('결석으로 시작해도 그날이 첫 수업이다', () => {
    // 첫날부터 못 온 학생이다. 그날을 안 세면 달력이 다음 수업부터
    // 시작해, 빠진 첫날이 학부모 쪽에서 사라진다.
    const cal = toParentCalendar({
      student: student,
      records: [{ date: '2026-12-08', attendance: '결석' }],
    });
    expect(cal.firstDate).toBe('2026-12-08');
  });

  it('기록이 없으면 등록한 달부터다', () => {
    const cal = toParentCalendar({ student: student, records: [] });
    expect(cal.firstMonth).toBe('2026-11');
    // 자를 날이 없다. 그 달은 통째로 보여 준다.
    expect(cal.firstDate).toBe('');
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
    // 학생 번호는 화면이 쓰는 이름으로 바꿔 보낸다. 시트의 번호를 그대로
    // 실어 보내면 화면이 조각을 그 학생에게 붙이지 못한다.
    expect(cal.overrides[0].studentId).toBe(PARENT_SELF_ID);
  });

  it('날짜별 출결과 회차를 모은다', () => {
    const cal = toParentCalendar({
      student: student,
      records: [
        { date: '2026-11-03', attendance: '출석', sessionNo: 7, classTime: '16:00' },
        { date: '2026-11-05' },
      ],
    });
    expect(cal.marks).toEqual({
      '2026-11-03': { attendance: '출석', sessionNo: '7', classTime: '16:00' },
    });
  });

  it('시각을 안 적어 둔 날은 빈 값이다', () => {
    // 요일표가 생기기 전에 쌓인 기록이다. 화면이 요일표에서 시각을 찾는다.
    const cal = toParentCalendar({
      student: student,
      records: [{ date: '2026-11-03', attendance: '출석' }],
    });
    expect(cal.marks['2026-11-03'].classTime).toBe('');
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

describe('mergeSameDay_ — 출결을 누른 쪽에 담기', () => {
  it('출결이 없고 자동으로 채워지기만 한 기록은 사라진다', () => {
    const out = mergeSameDay_([
      { date: '2026-08-30', kind: 'exam', attendance: '출석', examTests: '[{"text":"모의고사"}]' },
      { date: '2026-08-30', kind: 'regular', sessionNo: 12, vocabBook: '능률보카' },
    ]);
    expect(out.length).toBe(1);
    expect(out[0].kind).toBe('exam');
    // 자동으로 채워진 교재는 따라오지 않는다 — 함께 올 진도가 없다.
    expect(out[0].vocabBook).toBeUndefined();
  });

  it('이미 찬 칸은 덮어쓰지 않는다', () => {
    const out = mergeSameDay_([
      { date: '2026-08-30', attendance: '출석', vocabProgress: '적은 것' },
      { date: '2026-08-30', vocabProgress: '옮겨 올 것', grammarProgress: '빈 칸으로 온다' },
    ]);
    expect(out[0].vocabProgress).toBe('적은 것');
    expect(out[0].grammarProgress).toBe('빈 칸으로 온다');
  });

  it('코멘트는 둘 다 남긴다', () => {
    const out = mergeSameDay_([
      { date: '2026-08-30', attendance: '출석', comment: '앞말' },
      { date: '2026-08-30', comment: '뒷말' },
    ]);
    expect(out[0].comment).toBe('앞말\n뒷말');
  });

  it('점수는 만점과 함께 옮긴다', () => {
    const out = mergeSameDay_([
      { date: '2026-08-30', attendance: '출석' },
      { date: '2026-08-30', vocabTestBook: '단어장', vocabTestScore: 18, vocabTestMax: 20 },
    ]);
    expect(out[0].vocabTestScore).toBe(18);
    expect(out[0].vocabTestMax).toBe(20);
    expect(out[0].vocabTestBook).toBe('단어장');
  });

  it('만점이 없는 점수는 옮기지 않는다', () => {
    // 18/0은 숫자가 아니다. 화면에 '18/0'이 그대로 찍힌다.
    const out = mergeSameDay_([
      { date: '2026-08-30', attendance: '출석' },
      { date: '2026-08-30', vocabTestScore: 18, vocabTestMax: '' },
    ]);
    expect(out[0].vocabTestScore).toBeUndefined();
  });

  it('둘 다 출결을 누른 날은 두 줄 그대로다', () => {
    // 정규수업도 하고 시험대비도 한 날이다. 둘 다 그날 한 수업이다.
    const out = mergeSameDay_([
      { date: '2026-08-30', kind: 'regular', attendance: '출석' },
      { date: '2026-08-30', kind: 'exam', attendance: '출석' },
    ]);
    expect(out.length).toBe(2);
  });

  it('둘 다 출결이 없는 날도 건드리지 않는다', () => {
    const out = mergeSameDay_([
      { date: '2026-08-30', kind: 'regular', vocabProgress: 'Day 12' },
      { date: '2026-08-30', kind: 'exam', examTests: '[{"text":"모의고사"}]' },
    ]);
    expect(out.length).toBe(2);
  });

  it('출결을 누른 쪽이 뒤에 와도 그쪽이 주인이다', () => {
    const out = mergeSameDay_([
      { date: '2026-08-30', kind: 'regular', vocabProgress: 'Day 12' },
      { date: '2026-08-30', kind: 'exam', attendance: '출석' },
    ]);
    expect(out.length).toBe(1);
    expect(out[0].kind).toBe('exam');
    expect(out[0].vocabProgress).toBe('Day 12');
  });

  it('날이 다르면 합치지 않는다', () => {
    const out = mergeSameDay_([
      { date: '2026-08-30', attendance: '출석' },
      { date: '2026-08-28', vocabProgress: 'Day 12' },
    ]);
    expect(out.length).toBe(2);
  });

  it('빈 목록과 없는 값에 흔들리지 않는다', () => {
    expect(mergeSameDay_([])).toEqual([]);
    expect(mergeSameDay_(null)).toEqual([]);
  });
});

describe('parentFirstDate_ — 첫 수업 날짜', () => {
  it('출결을 적은 날 중 가장 이른 날이다', () => {
    expect(parentFirstDate_([
      { date: '2026-12-08', attendance: '출석' },
      { date: '2026-11-30', attendance: '지각' },
      { date: '2027-01-05', attendance: '출석' },
    ])).toBe('2026-11-30');
  });

  it('빈 출결과 날짜 아닌 값에 흔들리지 않는다', () => {
    expect(parentFirstDate_([
      { date: '2026-11-01', attendance: '   ' },
      { date: '그날', attendance: '출석' },
      { date: '2026-12-08', attendance: '출석' },
    ])).toBe('2026-12-08');
  });

  it('하나도 없으면 빈 값이다', () => {
    expect(parentFirstDate_([])).toBe('');
    expect(parentFirstDate_(null)).toBe('');
    expect(parentFirstDate_([{ date: '2026-11-01' }])).toBe('');
  });
});
