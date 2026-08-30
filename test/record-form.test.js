import { describe, it, expect } from 'vitest';
import {
  findRecordFor, toFormValues, buildRecord, rosterStatus, withBookDefaults,
} from '../public/assets/js/record-form.js';
import { RECORD_AREA_FIELDS } from '../public/assets/js/progress-areas.js';

/** 영역 필드(진도·다음 과제·시험)가 전부 빈 상태. 아래 전체 모양 비교에 쓴다. */
const EMPTY_AREAS = Object.fromEntries(RECORD_AREA_FIELDS.map((f) => [f, '']));

describe('findRecordFor', () => {
  const records = [
    { studentId: 's1', progress: 'Unit 1' },
    { studentId: 's2', progress: 'Unit 2' },
  ];

  it('해당 학생의 기록을 찾는다', () => {
    expect(findRecordFor(records, 's2')).toEqual({ studentId: 's2', progress: 'Unit 2' });
  });

  it('다른 학생의 기록이 섞이지 않는다', () => {
    const r = findRecordFor(records, 's1');
    expect(r.studentId).toBe('s1');
    expect(r).not.toEqual(records[1]);
  });

  it('기록이 없는 학생은 null', () => {
    expect(findRecordFor(records, 's3')).toBeNull();
  });

  it('existingRecords가 null이어도 안전하다', () => {
    expect(findRecordFor(null, 's1')).toBeNull();
    expect(findRecordFor(undefined, 's1')).toBeNull();
  });

  it('studentId가 빈 값이면 null', () => {
    expect(findRecordFor(records, '')).toBeNull();
    expect(findRecordFor(records, null)).toBeNull();
    expect(findRecordFor(records, undefined)).toBeNull();
  });
});

describe('toFormValues', () => {
  it('record가 null이면 전부 빈 문자열', () => {
    expect(toFormValues(null)).toEqual({
      progress: '', attendance: '', homeworkStatus: '', homeworkLevel: '',
      testName: '', testScore: '', testMax: '', nextHomework: '', comment: '',
      ...EMPTY_AREAS,
    });
  });

  it('기존 기록 값을 그대로 채운다', () => {
    const record = {
      progress: 'Unit 7', attendance: '출석', homeworkStatus: '제출', homeworkLevel: '상',
      testName: '중간고사', testScore: 85, testMax: 100, nextHomework: 'Unit 8', comment: '잘함',
    };
    expect(toFormValues(record)).toEqual({
      progress: 'Unit 7', attendance: '출석', homeworkStatus: '제출', homeworkLevel: '상',
      testName: '중간고사', testScore: '85', testMax: '100', nextHomework: 'Unit 8', comment: '잘함',
      ...EMPTY_AREAS,
    });
  });

  it('testScore가 숫자 0이어도 빈 칸이 아닌 "0"으로 남는다', () => {
    const record = { testScore: 0, testMax: 0 };
    const v = toFormValues(record);
    expect(v.testScore).toBe('0');
    expect(v.testMax).toBe('0');
  });

  it('null/undefined 필드는 전부 빈 문자열로 정규화된다', () => {
    const record = { progress: null, attendance: undefined, testScore: null, testMax: undefined };
    const v = toFormValues(record);
    expect(v.progress).toBe('');
    expect(v.attendance).toBe('');
    expect(v.testScore).toBe('');
    expect(v.testMax).toBe('');
  });
});

describe('buildRecord', () => {
  it('키가 서버 규격과 정확히 동일한 레코드를 만든다', () => {
    const form = {
      progress: 'Unit 7', attendance: '출석', homeworkStatus: '제출', homeworkLevel: '상',
      testName: '중간고사', testScore: '85', testMax: '100', nextHomework: 'Unit 8', comment: '잘함',
    };
    const rec = buildRecord('s1', '2026-08-30', form);
    expect(rec).toEqual({
      studentId: 's1', date: '2026-08-30', progress: 'Unit 7', nextHomework: 'Unit 8',
      attendance: '출석', homeworkStatus: '제출', homeworkLevel: '상',
      testName: '중간고사', testScore: '85', testMax: '100', comment: '잘함',
      ...EMPTY_AREAS,
    });
  });

  it('값이 없으면 undefined가 아니라 빈 문자열이다', () => {
    const rec = buildRecord('s1', '2026-08-30', {});
    Object.keys(rec).forEach((key) => {
      expect(rec[key]).not.toBeUndefined();
    });
    expect(rec.progress).toBe('');
    expect(rec.comment).toBe('');
  });

  it('form이 null/undefined여도 안전하다', () => {
    const rec = buildRecord('s1', '2026-08-30', null);
    expect(rec.studentId).toBe('s1');
    expect(rec.date).toBe('2026-08-30');
    expect(rec.progress).toBe('');
  });
});

describe('rosterStatus', () => {
  const students = [
    { studentId: 's1', name: '김학생', grade: '고1' },
    { studentId: 's2', name: '이학생', grade: '고2' },
    { studentId: 's3', name: '박학생', grade: '고3' },
  ];
  const existingRecords = [
    { studentId: 's2', progress: 'Unit 2' },
  ];

  it('기록 유무를 정확히 표시하고 students 순서를 유지한다', () => {
    expect(rosterStatus(students, existingRecords)).toEqual([
      { studentId: 's1', name: '김학생', grade: '고1', hasRecord: false },
      { studentId: 's2', name: '이학생', grade: '고2', hasRecord: true },
      { studentId: 's3', name: '박학생', grade: '고3', hasRecord: false },
    ]);
  });

  it('existingRecords가 없으면 전부 미입력이다', () => {
    const result = rosterStatus(students, []);
    expect(result.every((r) => r.hasRecord === false)).toBe(true);
  });

  it('students가 비어 있으면 빈 배열', () => {
    expect(rosterStatus([], existingRecords)).toEqual([]);
  });
});

describe('진도 영역', () => {
  const record = {
    studentId: 's1',
    vocabBook: '능률보카', vocabProgress: 'Day 12',
    readingBook: '리딩튜터', readingProgress: 'Unit 5',
  };

  it('toFormValues가 영역별 교재·진도를 채운다', () => {
    const v = toFormValues(record);
    expect(v.vocabBook).toBe('능률보카');
    expect(v.vocabProgress).toBe('Day 12');
    expect(v.grammarBook).toBe('');
    expect(v.etcProgress).toBe('');
  });

  it('buildRecord가 열 개 영역 필드를 모두 담는다', () => {
    const rec = buildRecord('s1', '2026-08-30', toFormValues(record));
    RECORD_AREA_FIELDS.forEach((f) => expect(rec[f]).toBeDefined());
    expect(rec.readingProgress).toBe('Unit 5');
  });

  it('영역 구분 없던 옛 progress를 그대로 실어 보낸다', () => {
    // 화면에 입력칸이 없다고 빼버리면 서버가 빈 값으로 덮어써서
    // 이미 쌓인 진도 기록이 사라진다.
    const v = toFormValues({ progress: '예전 진도' });
    expect(v.progress).toBe('예전 진도');
    expect(buildRecord('s1', '2026-08-30', v).progress).toBe('예전 진도');
  });
});

describe('withBookDefaults', () => {
  const lastBooks = {
    vocabBook: '능률보카', readingBook: '리딩튜터',
    vocabNextBook: '단어 워크북', vocabTestBook: '단어시험지',
  };

  it('빈 교재 칸을 직전 수업 교재로 채운다', () => {
    const v = withBookDefaults(toFormValues(null), lastBooks);
    expect(v.vocabBook).toBe('능률보카');
    expect(v.readingBook).toBe('리딩튜터');
    expect(v.grammarBook).toBe('');
  });

  it('숙제 교재와 시험 교재도 채운다', () => {
    const v = withBookDefaults(toFormValues(null), lastBooks);
    expect(v.vocabNextBook).toBe('단어 워크북');
    expect(v.vocabTestBook).toBe('단어시험지');
    expect(v.listeningTestBook).toBe('');
  });

  it('이미 값이 있는 교재 칸은 덮어쓰지 않는다', () => {
    const v = withBookDefaults(toFormValues({ vocabBook: '다른 단어책' }), lastBooks);
    expect(v.vocabBook).toBe('다른 단어책');
  });

  it('진도 칸은 건드리지 않는다', () => {
    const v = withBookDefaults(toFormValues(null), lastBooks);
    expect(v.vocabProgress).toBe('');
  });

  it('lastBooks가 없어도 안전하다', () => {
    expect(withBookDefaults(toFormValues(null), null).vocabBook).toBe('');
    expect(withBookDefaults(toFormValues(null), undefined).etcBook).toBe('');
  });

  it('원본 객체를 바꾸지 않고 새 객체를 돌려준다', () => {
    const src = toFormValues(null);
    const out = withBookDefaults(src, lastBooks);
    expect(src.vocabBook).toBe('');
    expect(out).not.toBe(src);
  });
});

describe('다음 과제·시험 영역', () => {
  it('toFormValues가 영역별 다음 과제와 두 시험 점수를 채운다', () => {
    const v = toFormValues({
      vocabNext: 'Day 14 외우기', etcNext: '영어 일기',
      vocabTestScore: 18, vocabTestMax: 20,
      listeningTestScore: 0, listeningTestMax: 10,
    });
    expect(v.vocabNext).toBe('Day 14 외우기');
    expect(v.etcNext).toBe('영어 일기');
    expect(v.readingNext).toBe('');
    expect(v.vocabTestScore).toBe('18');
    // 0점이 빈 칸으로 바뀌면 안 된다.
    expect(v.listeningTestScore).toBe('0');
  });

  it('영역 구분 없던 옛 시험명·점수와 옛 다음 과제를 그대로 실어 보낸다', () => {
    const v = toFormValues({
      testName: '중간고사', testScore: 85, testMax: 100, nextHomework: '옛 과제',
    });
    const rec = buildRecord('s1', '2026-08-30', v);
    expect(rec.testName).toBe('중간고사');
    expect(rec.testScore).toBe('85');
    expect(rec.testMax).toBe('100');
    expect(rec.nextHomework).toBe('옛 과제');
  });

  it('교재 자동 채움이 숙제 내용·시험 점수 칸을 건드리지 않는다', () => {
    const v = withBookDefaults(toFormValues(null), {
      vocabBook: '능률보카', vocabNextBook: '워크북', vocabTestBook: '시험지',
    });
    expect(v.vocabNext).toBe('');
    expect(v.vocabTestScore).toBe('');
    expect(v.vocabTestMax).toBe('');
  });
});
