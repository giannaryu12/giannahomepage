import { describe, it, expect } from 'vitest';
import { classLevel, gradeLabel, groupByLevel, LEVELS } from '../public/assets/js/class-level.js';

describe('classLevel', () => {
  it('이름 맨 앞의 초·중·고를 읽는다', () => {
    expect(classLevel('초등부 Phonics 월수 4시')).toBe('elem');
    expect(classLevel('중등부 내신 화목 6시')).toBe('mid');
    expect(classLevel('고등부 Structure 화목 5시')).toBe('high');
  });

  it('등·등부 없이 한 글자만 적어도 읽는다', () => {
    expect(classLevel('초 Phonics')).toBe('elem');
    expect(classLevel('중 내신')).toBe('mid');
    expect(classLevel('고 Structure')).toBe('high');
  });

  it('학년까지 붙은 이름도 읽는다', () => {
    expect(classLevel('초6 심화')).toBe('elem');
    expect(classLevel('중3 내신')).toBe('mid');
    expect(classLevel('고2 Structure 화목 5시')).toBe('high');
    expect(classLevel('중3·고1 혼합')).toBe('mid');
  });

  it('초등/중등/고등도 읽는다', () => {
    expect(classLevel('초등 파닉스')).toBe('elem');
    expect(classLevel('중등 문법')).toBe('mid');
    expect(classLevel('고등 독해')).toBe('high');
  });

  it('학교급을 뜻하지 않는 글자에 끌려가지 않는다', () => {
    // 여기서 틀리면 선생님이 보기에 반이 엉뚱한 열에 가 있다.
    expect(classLevel('기초반')).toBe('');
    expect(classLevel('고급반')).toBe('');
    expect(classLevel('중급 독해')).toBe('');
    expect(classLevel('초급 회화')).toBe('');
  });

  it('이름 가운데의 초·중·고는 보지 않는다', () => {
    expect(classLevel('Structure 고2 화목 5시')).toBe('');
    expect(classLevel('수능 고난도')).toBe('');
  });

  it('앞에 공백이 있어도 읽는다', () => {
    expect(classLevel('  고2 Structure')).toBe('high');
  });

  it('빈 값에 흔들리지 않는다', () => {
    expect(classLevel('')).toBe('');
    expect(classLevel(null)).toBe('');
    expect(classLevel(undefined)).toBe('');
  });
});

describe('groupByLevel', () => {
  const classes = [
    { classId: 'C01', className: '고2 Structure 화목 5시' },
    { classId: 'C02', className: '초등부 Phonics 월수 4시' },
    { classId: 'C03', className: '중3 내신' },
    { classId: 'C04', className: '고1 독해' },
    { classId: 'C05', className: '기초반' },
  ];

  it('초·중·고 순서로 세 묶음을 낸다', () => {
    // 열이 셋이어야 칸이 밀리지 않는다. 순서도 화면 순서와 같아야 한다.
    const out = groupByLevel(classes);
    expect(out.groups.map((g) => g.key)).toEqual(['elem', 'mid', 'high']);
    expect(out.groups.map((g) => g.label)).toEqual(['초등부', '중등부', '고등부']);
  });

  it('반을 자기 학교급에 넣고 이름 순서는 그대로 둔다', () => {
    const out = groupByLevel(classes);
    expect(out.groups[0].classes.map((c) => c.classId)).toEqual(['C02']);
    expect(out.groups[1].classes.map((c) => c.classId)).toEqual(['C03']);
    expect(out.groups[2].classes.map((c) => c.classId)).toEqual(['C01', 'C04']);
  });

  it('학교급을 읽을 수 없는 반은 따로 모은다', () => {
    // 이름을 아직 안 고친 반이 사라지면 반이 없어진 것처럼 보인다.
    expect(groupByLevel(classes).other.map((c) => c.classId)).toEqual(['C05']);
  });

  it('비어 있는 학교급도 자리를 지킨다', () => {
    const out = groupByLevel([{ classId: 'C01', className: '고2 Structure' }]);
    expect(out.groups).toHaveLength(3);
    expect(out.groups[0].classes).toEqual([]);
    expect(out.groups[1].classes).toEqual([]);
  });

  it('빈 값에 흔들리지 않는다', () => {
    const out = groupByLevel(null);
    expect(out.groups.map((g) => g.classes)).toEqual([[], [], []]);
    expect(out.other).toEqual([]);
  });

  it('LEVELS는 화면이 그리는 세 열과 같다', () => {
    expect(LEVELS.map((l) => l.key)).toEqual(['elem', 'mid', 'high']);
  });
});


describe('gradeLabel — 화면에 적을 학년', () => {
  it("'초5'를 '초등부 5학년'으로 푼다", () => {
    expect(gradeLabel('초5')).toBe('초등부 5학년');
    expect(gradeLabel('중2')).toBe('중등부 2학년');
    expect(gradeLabel('고3')).toBe('고등부 3학년');
  });

  it('학년에 학교급이 없으면 반 이름에서 읽는다', () => {
    expect(gradeLabel('6학년', '초등부 A')).toBe('초등부 6학년');
  });

  it('학교급만 있으면 학년은 적지 않는다', () => {
    expect(gradeLabel('초')).toBe('초등부');
  });

  it('읽을 수 없으면 적힌 그대로 둔다', () => {
    expect(gradeLabel('예비고1반')).toBe('예비고1반');
    expect(gradeLabel('')).toBe('');
    expect(gradeLabel(null)).toBe('');
  });
});
