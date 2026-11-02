import { describe, it, expect } from 'vitest';
import {
  WEEKDAYS, parseSchedule, formatSchedule,
  weekdayIndex, mondayOf, addDays, buildTimetable,
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

describe('buildTimetable', () => {
  const students = [
    { studentId: 'S1', name: '김민준', schedule: '화 17:00, 목 19:00' },
    { studentId: 'S2', name: '이서연', schedule: '화 17:00' },
    { studentId: 'S3', name: '박지후', schedule: '' },
    { studentId: 'S4', name: '최예준', schedule: '월 15:00' },
  ];

  it('등록된 시간만 행으로 만든다', () => {
    // 9시부터 10시까지 빈 줄을 늘어놓으면 정작 수업이 있는 칸을 찾기 어렵다.
    expect(buildTimetable(students).rows.map((r) => r.time))
      .toEqual(['15:00', '17:00', '19:00']);
  });

  it('학생을 자기 요일 칸에 넣는다', () => {
    const rows = buildTimetable(students).rows;
    const at = (time, day) => rows.filter((r) => r.time === time)[0]
      .days[WEEKDAYS.indexOf(day)].map((s) => s.name);

    expect(at('17:00', '화')).toEqual(['김민준', '이서연']);
    expect(at('19:00', '목')).toEqual(['김민준']);
    expect(at('15:00', '월')).toEqual(['최예준']);
    expect(at('17:00', '월')).toEqual([]);
  });

  it('한 학생이 요일마다 다른 시간에 들어간다', () => {
    const rows = buildTimetable([students[0]]).rows;
    expect(rows.map((r) => r.time)).toEqual(['17:00', '19:00']);
    expect(rows[0].days[WEEKDAYS.indexOf('화')]).toHaveLength(1);
    expect(rows[1].days[WEEKDAYS.indexOf('목')]).toHaveLength(1);
  });

  it('요일·시간이 비어 있는 학생은 따로 모은다', () => {
    // 시간표에서 통째로 사라지면 등록은 했는데 보이지 않는 학생이 생긴다.
    expect(buildTimetable(students).unscheduled.map((s) => s.name)).toEqual(['박지후']);
  });

  it('모든 행이 일곱 칸이다', () => {
    buildTimetable(students).rows.forEach((r) => expect(r.days).toHaveLength(7));
  });

  it('빈 값에 흔들리지 않는다', () => {
    expect(buildTimetable(null)).toEqual({ rows: [], unscheduled: [] });
    expect(buildTimetable([])).toEqual({ rows: [], unscheduled: [] });
  });
});
