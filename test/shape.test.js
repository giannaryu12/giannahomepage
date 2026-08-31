import { describe, it, expect } from 'vitest';
import {
  toParentRecord, toParentStudent, toParentPayload,
  hasParentContent_, PARENT_RECORD_FIELDS,
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

describe('hasParentContent_ — 진도나 시험이 있는 날만', () => {
  it('진도가 하나라도 적혀 있으면 낸다', () => {
    expect(hasParentContent_({ vocabProgress: 'Day 12' })).toBe(true);
    expect(hasParentContent_({ etcProgress: '자유 독해' })).toBe(true);
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

  it('출결·숙제·코멘트만 있는 날은 내지 않는다', () => {
    expect(hasParentContent_({
      attendance: '결석', homeworkStatus: '미제출', homeworkLevel: '하',
      vocabNextBook: '보카 워크북', vocabNext: 'Day 14', comment: '전화 드렸습니다',
    })).toBe(false);
  });

  it('교재만 채워진 날은 내지 않는다', () => {
    // 교재는 직전 수업에서 자동으로 채워지므로 그날 수업했다는 근거가 아니다.
    expect(hasParentContent_({
      vocabBook: '능률보카', vocabTestBook: '단어시험지', vocabNextBook: '워크북',
    })).toBe(false);
  });

  it('빈 기록과 없는 값에 흔들리지 않는다', () => {
    expect(hasParentContent_({})).toBe(false);
    expect(hasParentContent_(null)).toBe(false);
    expect(hasParentContent_({ vocabProgress: '   ' })).toBe(false);
  });
});

describe('toParentPayload — 거르기와 요약', () => {
  const base = { student: { name: '테스트' }, className: '고1 A반' };

  it('진도도 시험도 없는 날은 목록에서 뺀다', () => {
    const out = toParentPayload(Object.assign({}, base, {
      records: [
        { date: '2026-08-30', vocabProgress: 'Day 12', attendance: '출석' },
        { date: '2026-08-28', attendance: '결석' },
        { date: '2026-08-26', attendance: '출석' },
      ],
    }));
    expect(out.records.map((r) => r.date)).toEqual(['2026-08-30']);
  });

  it('걸러진 날도 출석률에는 그대로 들어간다', () => {
    // 결석한 날은 진도도 시험도 없다. 거르고 나서 세면 결석이 지워져 100%가 된다.
    const out = toParentPayload(Object.assign({}, base, {
      records: [
        { date: '2026-08-30', vocabProgress: 'Day 12', attendance: '출석' },
        { date: '2026-08-28', attendance: '결석' },
      ],
    }));
    expect(out.records).toHaveLength(1);
    expect(out.summary.attendanceRate).toBe(50);
  });
});
