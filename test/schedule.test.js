import { describe, it, expect } from 'vitest';
import {
  WEEKDAYS, parseSchedule, formatSchedule,
  weekdayIndex, mondayOf, addDays,
  monthOf, addMonths, monthGrid, studentsOnDate, applyOverrides, activeOnly,
  inVacation, scheduleOf,
} from '../public/assets/js/schedule.js';

describe('parseSchedule', () => {
  it('요일마다 다른 시간을 읽는다', () => {
    // 화 5시, 목 7시처럼 요일별로 시간이 다른 학생이 있다.
    expect(parseSchedule('화 17:00, 목 19:00')).toEqual([
      { day: '화', time: '17:00' },
      { day: '목', time: '19:00' },
    ]);
  });

  it('띄어쓰기와 자릿수를 강요하지 않는다', () => {
    // 선생님이 시트에 손으로 적는 칸이다.
    expect(parseSchedule('화17:00,목 9:30')).toEqual([
      { day: '화', time: '17:00' },
      { day: '목', time: '09:30' },
    ]);
  });

  it('요일 순서로 정렬한다', () => {
    expect(parseSchedule('금 19:00, 월 17:00, 수 18:00').map((e) => e.day))
      .toEqual(['월', '수', '금']);
  });

  it('같은 요일이면 이른 시간이 먼저다', () => {
    expect(parseSchedule('화 19:00, 화 17:00').map((e) => e.time))
      .toEqual(['17:00', '19:00']);
  });

  it('똑같은 짝은 한 번만 센다', () => {
    expect(parseSchedule('화 17:00, 화 17:00')).toHaveLength(1);
  });

  it('깨진 조각만 버리고 나머지는 지킨다', () => {
    // 한 조각이 깨졌다고 나머지 요일까지 시간표에서 사라지면 안 된다.
    expect(parseSchedule('화 17:00, 쓰레기, 목 19:00').map((e) => e.day))
      .toEqual(['화', '목']);
  });

  it('있을 수 없는 시각은 버린다', () => {
    expect(parseSchedule('화 25:00')).toEqual([]);
    expect(parseSchedule('화 17:70')).toEqual([]);
  });

  it('빈 값에 흔들리지 않는다', () => {
    expect(parseSchedule('')).toEqual([]);
    expect(parseSchedule(null)).toEqual([]);
    expect(parseSchedule(undefined)).toEqual([]);
    expect(parseSchedule('   ')).toEqual([]);
  });
});

describe('formatSchedule', () => {
  it('적은 그대로 되읽는다', () => {
    const raw = '화 17:00, 목 19:00';
    expect(formatSchedule(parseSchedule(raw))).toBe(raw);
  });

  it('순서가 뒤섞여 들어와도 요일 순서로 적는다', () => {
    expect(formatSchedule([{ day: '목', time: '19:00' }, { day: '화', time: '17:00' }]))
      .toBe('화 17:00, 목 19:00');
  });

  it('빈 목록은 빈 문자열이다', () => {
    expect(formatSchedule([])).toBe('');
    expect(formatSchedule(null)).toBe('');
  });
});

describe('weekdayIndex — 월요일이 0', () => {
  it('한 주 일곱 날이 순서대로 나온다', () => {
    const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05',
      '2026-11-06', '2026-11-07', '2026-11-08'];
    expect(week.map(weekdayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(week.map((d) => WEEKDAYS[weekdayIndex(d)])).toEqual(WEEKDAYS);
  });

  it('없는 날짜와 날짜가 아닌 값은 -1이다', () => {
    expect(weekdayIndex('2026-02-30')).toBe(-1);
    expect(weekdayIndex('나중에')).toBe(-1);
    expect(weekdayIndex('')).toBe(-1);
    expect(weekdayIndex(null)).toBe(-1);
  });
});

describe('mondayOf', () => {
  it('그 주의 월요일을 낸다', () => {
    expect(mondayOf('2026-11-05')).toBe('2026-11-02');
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
    expect(mondayOf('2026-11-08')).toBe('2026-11-02');
  });

  it('일요일은 그 주의 월요일로 간다 — 다음 주가 아니다', () => {
    // getDay()는 일요일이 0이라, 밀어 주지 않으면 일요일만 한 주 어긋난다.
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
  });

  it('달과 해를 넘어가도 맞는다', () => {
    expect(mondayOf('2027-01-01')).toBe('2026-12-28');
  });

  it('날짜가 아니면 빈 문자열이다', () => {
    expect(mondayOf('나중에')).toBe('');
  });
});

describe('addDays', () => {
  it('주를 앞뒤로 옮긴다', () => {
    expect(addDays('2026-11-02', 7)).toBe('2026-11-09');
    expect(addDays('2026-11-02', -7)).toBe('2026-10-26');
  });

  it('달을 넘어가도 맞는다', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });

  it('윤년 2월을 넘어간다', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('날짜가 아니면 빈 문자열이다', () => {
    expect(addDays('나중에', 1)).toBe('');
  });
});

describe('monthOf / addMonths', () => {
  it('날짜에서 달을 떼어낸다', () => {
    expect(monthOf('2026-11-05')).toBe('2026-11');
    expect(monthOf('나중에')).toBe('');
  });

  it('달을 앞뒤로 옮긴다', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-11', -1)).toBe('2026-10');
  });

  it('해를 넘어간다', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('달이 아니면 빈 문자열이다', () => {
    expect(addMonths('2026-11-05', 1)).toBe('');
    expect(addMonths('', 1)).toBe('');
  });
});

describe('monthGrid', () => {
  it('월요일로 시작하는 주 단위다', () => {
    const weeks = monthGrid('2026-11');
    weeks.forEach((w) => expect(w).toHaveLength(7));
    // 2026-11-01은 일요일 — 그 주의 월요일은 10월 26일이다.
    expect(weeks[0][0].iso).toBe('2026-10-26');
  });

  it('그 달의 1일과 말일이 모두 들어 있다', () => {
    const flat = monthGrid('2026-11').flat();
    const inMonth = flat.filter((c) => c.inMonth).map((c) => c.day);
    expect(inMonth[0]).toBe(1);
    expect(inMonth[inMonth.length - 1]).toBe(30);
    expect(inMonth).toHaveLength(30);
  });

  it('앞뒤 모자란 칸은 옆 달 날짜로 채우고 표시해 둔다', () => {
    // 빈 칸으로 두면 첫 주와 마지막 주에서 요일과 칸이 어긋나 보인다.
    const weeks = monthGrid('2026-12');
    expect(weeks[0][0].iso).toBe('2026-11-30');
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks[0][1].inMonth).toBe(true);
  });

  it('마지막 줄이 통째로 옆 달인 달을 만들지 않는다', () => {
    // 늘 6주를 그리면 2월처럼 딱 떨어지는 달에서 빈 줄이 남는다.
    const weeks = monthGrid('2027-02');
    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every((c) => c.inMonth)).toBe(true);
  });

  it('윤년 2월 29일이 들어 있다', () => {
    expect(monthGrid('2028-02').flat().filter((c) => c.inMonth)).toHaveLength(29);
  });

  it('달이 아니면 빈 배열이다', () => {
    expect(monthGrid('나중에')).toEqual([]);
  });
});

describe('studentsOnDate', () => {
  const students = [
    { studentId: 'S1', name: '김민준', schedule: '화 17:00, 목 19:00' },
    { studentId: 'S2', name: '이서연', schedule: '화 17:00' },
    { studentId: 'S3', name: '강하늘', schedule: '화 17:00' },
    { studentId: 'S4', name: '박지후', schedule: '' },
  ];

  it('그 요일에 수업이 있는 학생만 낸다', () => {
    // 2026-11-03은 화요일.
    expect(studentsOnDate(students, '2026-11-03').map((e) => e.student.name))
      .toEqual(['강하늘', '김민준', '이서연']);
    expect(studentsOnDate(students, '2026-11-04')).toEqual([]);
  });

  it('이른 시간이 먼저고 같은 시간이면 이름 순이다', () => {
    // 매번 순서가 바뀌면 어제 본 자리에 오늘은 다른 학생이 있다.
    const mixed = [
      { name: '가', schedule: '화 19:00' },
      { name: '다', schedule: '화 17:00' },
      { name: '나', schedule: '화 17:00' },
    ];
    expect(studentsOnDate(mixed, '2026-11-03').map((e) => e.time + ' ' + e.student.name))
      .toEqual(['17:00 나', '17:00 다', '19:00 가']);
  });

  it('요일마다 다른 시간을 그날 시간으로 낸다', () => {
    expect(studentsOnDate(students, '2026-11-05')).toEqual([
      { time: '19:00', student: students[0] },
    ]);
  });

  it('빈 값에 흔들리지 않는다', () => {
    expect(studentsOnDate(null, '2026-11-03')).toEqual([]);
    expect(studentsOnDate(students, '나중에')).toEqual([]);
  });
});

describe('휴강으로 뺀 줄', () => {
  it('목록에서 아예 사라진다 — 수업이 없던 날과 같다', () => {
    // 줄이 남으면 '있었는데 빠진 수업'으로 읽힌다. 결석·변경과는 다르다.
    const rows = applyOverrides(
      [
        { time: '17:00', student: { studentId: 'S1', name: '가' } },
        { time: '18:00', student: { studentId: 'S2', name: '나' } },
      ],
      [{ overrideId: 'O1', date: '2026-11-09', studentId: 'S1', time: '', kind: 'skip', reason: 'off' }],
      '2026-11-09',
      [{ studentId: 'S1', name: '가' }, { studentId: 'S2', name: '나' }]
    );
    expect(rows.map(function (r) { return r.student.studentId; })).toEqual(['S2']);
  });

  it('붙을 자리가 없는 휴강 조각도 줄을 만들지 않는다', () => {
    const rows = applyOverrides(
      [],
      [{ overrideId: 'O1', date: '2026-11-09', studentId: 'S1', time: '17:00', kind: 'skip', reason: 'off' }],
      '2026-11-09',
      [{ studentId: 'S1', name: '가' }]
    );
    expect(rows).toEqual([]);
  });

  it('모르는 까닭은 결석으로 읽는다', () => {
    const rows = applyOverrides(
      [{ time: '17:00', student: { studentId: 'S1', name: '가' } }],
      [{ overrideId: 'O1', date: '2026-11-09', studentId: 'S1', time: '', kind: 'skip', reason: '휴무' }],
      '2026-11-09',
      [{ studentId: 'S1', name: '가' }]
    );
    expect(rows[0].skip.reason).toBe('absent');
  });
});

describe('applyOverrides — 하루치 일정 변경', () => {
  const students = [
    { studentId: 'S1', name: '김민준', schedule: '화 17:00' },
    { studentId: 'S2', name: '이서연', schedule: '화 17:00' },
    { studentId: 'S3', name: '최예준', schedule: '' },
  ];
  const TUE = '2026-11-03';
  const base = () => studentsOnDate(students, TUE);

  it('변경이 없으면 평소 일정 그대로다', () => {
    expect(applyOverrides(base(), [], TUE, students).map((e) => e.student.name))
      .toEqual(['김민준', '이서연']);
    expect(applyOverrides(base(), null, TUE, students)).toHaveLength(2);
  });

  it('skip은 줄을 남기고 표시만 단다', () => {
    // 지워 버리면 쉰 날과 애초에 수업이 없던 날이 구별되지 않는다.
    const ov = [{ overrideId: 'O1', date: TUE, studentId: 'S1', time: '', kind: 'skip' }];
    const out = applyOverrides(base(), ov, TUE, students);
    expect(out.map((e) => e.student.name)).toEqual(['김민준', '이서연']);
    expect(out[0].skip).toEqual({ overrideId: 'O1', reason: 'absent' });
    expect(out[1].skip).toBeUndefined();
  });

  it('결석과 변경을 가려 담는다', () => {
    const moved = [{ overrideId: 'O1', date: TUE, studentId: 'S1', time: '', kind: 'skip', reason: 'moved' }];
    expect(applyOverrides(base(), moved, TUE, students)[0].skip.reason).toBe('moved');

    // 까닭이 없는 옛 조각은 결석으로 읽는다. 시트에 먼저 쌓인 줄이 있다.
    const old = [{ overrideId: 'O1', date: TUE, studentId: 'S1', time: '', kind: 'skip' }];
    expect(applyOverrides(base(), old, TUE, students)[0].skip.reason).toBe('absent');
  });

  it('붙을 자리가 없는 빼기 조각도 줄로 남긴다', () => {
    // 뺀 뒤에 평소 요일을 고치면 조각만 남는다. 안 보이면 되돌릴 수 없다.
    const ov = [{ overrideId: 'O7', date: TUE, studentId: 'S3', time: '16:00', kind: 'skip' }];
    const out = applyOverrides(base(), ov, TUE, students);
    expect(out.map((e) => e.student.name)).toEqual(['최예준', '김민준', '이서연']);
    expect(out[0].skip.overrideId).toBe('O7');
  });

  it('activeOnly는 빼 둔 줄을 걷어낸다', () => {
    const ov = [{ overrideId: 'O1', date: TUE, studentId: 'S1', time: '', kind: 'skip' }];
    expect(activeOnly(applyOverrides(base(), ov, TUE, students)).map((e) => e.student.name))
      .toEqual(['이서연']);
    expect(activeOnly(null)).toEqual([]);
  });

  it('skip에 시간을 적으면 그 시간 하나만 표시한다', () => {
    // 하루에 두 번 오는 학생의 한 번만 쉴 수 있어야 한다.
    const twice = [{ studentId: 'S1', name: '김민준', schedule: '화 17:00, 화 19:00' }];
    const ov = [{ overrideId: 'O1', date: TUE, studentId: 'S1', time: '17:00', kind: 'skip' }];
    const out = applyOverrides(studentsOnDate(twice, TUE), ov, TUE, twice);
    expect(out.map((e) => e.time)).toEqual(['17:00', '19:00']);
    expect(out.map((e) => !!e.skip)).toEqual([true, false]);
  });

  it('add는 평소 일정에 없는 날에도 넣는다', () => {
    const ov = [{ overrideId: 'O2', date: TUE, studentId: 'S3', time: '16:00', kind: 'add' }];
    const out = applyOverrides(base(), ov, TUE, students);
    expect(out.map((e) => e.student.name)).toEqual(['최예준', '김민준', '이서연']);
    expect(out[0].overrideId).toBe('O2');
  });

  it('평소 일정에서 온 줄에는 overrideId가 없다', () => {
    // 지울 때 평소 일정을 건드릴지 조각만 지울지가 여기서 갈린다.
    const ov = [{ overrideId: 'O2', date: TUE, studentId: 'S3', time: '16:00', kind: 'add' }];
    const out = applyOverrides(base(), ov, TUE, students);
    expect(out.filter((e) => !e.overrideId).map((e) => e.student.name))
      .toEqual(['김민준', '이서연']);
  });

  it('다른 날의 변경에 흔들리지 않는다', () => {
    const ov = [{ overrideId: 'O1', date: '2026-11-10', studentId: 'S1', time: '', kind: 'skip' }];
    const out = applyOverrides(base(), ov, TUE, students);
    expect(out).toHaveLength(2);
    expect(out.every((e) => !e.skip)).toBe(true);
  });

  it('없는 학생의 조각은 조용히 넘긴다', () => {
    // 그만둔 학생의 조각이 남아 있어도 달력이 깨지면 안 된다.
    const ov = [{ overrideId: 'O9', date: TUE, studentId: '없음', time: '16:00', kind: 'add' }];
    expect(applyOverrides(base(), ov, TUE, students)).toHaveLength(2);
  });

  it('더한 뒤에도 이른 시간부터, 같은 시간이면 이름 순이다', () => {
    const ov = [{ overrideId: 'O3', date: TUE, studentId: 'S3', time: '17:00', kind: 'add' }];
    expect(applyOverrides(base(), ov, TUE, students).map((e) => e.student.name))
      .toEqual(['김민준', '이서연', '최예준']);
  });
});

describe('inVacation — 그날이 방학인가', () => {
  // 기간은 목록이다 — 방학은 해마다 두세 번 돌아온다.
  const vac = [{ from: '2026-12-22', to: '2027-01-31' }];

  it('기간 안과 양 끝날은 방학이다', () => {
    expect(inVacation('2026-12-22', vac)).toBe(true);
    expect(inVacation('2027-01-05', vac)).toBe(true);
    expect(inVacation('2027-01-31', vac)).toBe(true);
  });

  it('하루 앞뒤는 방학이 아니다', () => {
    expect(inVacation('2026-12-21', vac)).toBe(false);
    expect(inVacation('2027-02-01', vac)).toBe(false);
  });

  it('한쪽만 적힌 기간은 기간이 아니다', () => {
    expect(inVacation('2027-01-05', [{ from: '2026-12-22', to: '' }])).toBe(false);
    expect(inVacation('2027-01-05', [{ from: '', to: '2027-01-31' }])).toBe(false);
    expect(inVacation('2027-01-05', null)).toBe(false);
  });
});

describe('scheduleOf — 그날 따르는 요일표', () => {
  // 기간은 목록이다 — 방학은 해마다 두세 번 돌아온다.
  const vac = [{ from: '2026-12-22', to: '2027-01-31' }];
  const student = { schedule: '월 16:00', vacationSchedule: '화 10:00' };

  it('학기중에는 평소 요일표다', () => {
    expect(scheduleOf(student, '2026-12-01', vac)).toBe('월 16:00');
    expect(scheduleOf(student, '2027-02-02', vac)).toBe('월 16:00');
  });

  it('방학에는 방학 요일표다', () => {
    expect(scheduleOf(student, '2027-01-05', vac)).toBe('화 10:00');
  });

  it('방학 요일표를 안 적었으면 방학에도 평소대로다', () => {
    // 빈 칸을 '그날 수업 없음'으로 읽으면, 적기를 빠뜨린 학생이 달력에서
    // 조용히 사라진다.
    expect(scheduleOf({ schedule: '월 16:00' }, '2027-01-05', vac)).toBe('월 16:00');
    expect(scheduleOf({ schedule: '월 16:00', vacationSchedule: '   ' }, '2027-01-05', vac))
      .toBe('월 16:00');
  });

  it('방학 기간이 없으면 늘 평소 요일표다', () => {
    expect(scheduleOf(student, '2027-01-05', [])).toBe('월 16:00');
  });
});

describe('studentsOnDate — 방학 요일표로 세운다', () => {
  // 기간은 목록이다 — 방학은 해마다 두세 번 돌아온다.
  const vac = [{ from: '2026-12-22', to: '2027-01-31' }];
  const student = { studentId: 'S1', schedule: '월 16:00', vacationSchedule: '화 10:00' };

  it('방학 중 화요일에는 방학 시간으로 선다', () => {
    // 2027-01-05는 화요일.
    const out = studentsOnDate([student], '2027-01-05', vac);
    expect(out).toHaveLength(1);
    expect(out[0].time).toBe('10:00');
  });

  it('방학 중 월요일에는 아무도 서지 않는다', () => {
    // 2027-01-04는 월요일 — 방학 요일표에 월요일이 없다.
    expect(studentsOnDate([student], '2027-01-04', vac)).toHaveLength(0);
  });

  it('학기중 월요일에는 평소 시간으로 선다', () => {
    // 2026-12-07은 월요일.
    const out = studentsOnDate([student], '2026-12-07', vac);
    expect(out).toHaveLength(1);
    expect(out[0].time).toBe('16:00');
  });

  it('방학 기간을 안 넘기면 평소 요일표만 본다', () => {
    expect(studentsOnDate([student], '2027-01-05')).toHaveLength(0);
    expect(studentsOnDate([student], '2027-01-04')).toHaveLength(1);
  });
});

describe('inVacation — 기간이 여럿일 때', () => {
  const many = [
    { from: '2026-01-05', to: '2026-02-28' },
    { from: '2026-07-20', to: '2026-08-20' },
    { from: '2026-12-22', to: '2027-01-31' },
  ];

  it('어느 기간에든 들면 방학이다', () => {
    expect(inVacation('2026-01-20', many)).toBe(true);
    expect(inVacation('2026-08-01', many)).toBe(true);
    expect(inVacation('2027-01-10', many)).toBe(true);
  });

  it('기간 사이의 학기는 방학이 아니다', () => {
    expect(inVacation('2026-05-01', many)).toBe(false);
    expect(inVacation('2026-10-01', many)).toBe(false);
  });

  it('지난 방학도 그대로 방학이다', () => {
    // 다음 방학을 더해도 지난 방학 날들이 학기중으로 되돌아가지 않는다.
    expect(inVacation('2026-01-20', many)).toBe(true);
  });
});
