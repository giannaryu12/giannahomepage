import { describe, it, expect } from 'vitest';
import { promoteGrade, planPromotions } from '../gas/lib/promote.js';

describe('promoteGrade', () => {
  it('같은 학교급 안에서는 한 학년 올린다', () => {
    expect(promoteGrade('초5', 1)).toBe('초6');
    expect(promoteGrade('중1', 1)).toBe('중2');
    expect(promoteGrade('고2', 1)).toBe('고3');
  });

  it('초6은 중1로, 중3은 고1로 올라간다', () => {
    expect(promoteGrade('초6', 1)).toBe('중1');
    expect(promoteGrade('중3', 1)).toBe('고1');
  });

  it('고3은 그대로 둔다 — 졸업은 선생님이 판단한다', () => {
    expect(promoteGrade('고3', 1)).toBe('고3');
    expect(promoteGrade('고3', 5)).toBe('고3');
  });

  it('여러 해를 건너뛰면 그만큼 올린다', () => {
    expect(promoteGrade('초5', 2)).toBe('중1');
    expect(promoteGrade('초4', 3)).toBe('중1');
    expect(promoteGrade('중2', 2)).toBe('고1');
  });

  it('읽을 수 없는 학년은 손대지 않는다', () => {
    expect(promoteGrade('초', 1)).toBe('초');
    expect(promoteGrade('', 1)).toBe('');
    expect(promoteGrade('6학년', 1)).toBe('6학년');
    expect(promoteGrade(null, 1)).toBe('');
  });

  it('올릴 해가 없으면 그대로다', () => {
    expect(promoteGrade('초5', 0)).toBe('초5');
    expect(promoteGrade('초5', -3)).toBe('초5');
  });
});

describe('planPromotions', () => {
  it('지난해에 적어 둔 학생만 올린다', () => {
    const plan = planPromotions([
      { studentId: 'S1', grade: '초6', gradeYear: '2026' },
      { studentId: 'S2', grade: '중1', gradeYear: '2027' },
    ], 2027);

    expect(plan).toEqual([{ studentId: 'S1', grade: '중1', gradeYear: 2027 }]);
  });

  it('gradeYear가 비어 있으면 올리지 않고 올해를 적어 둔다', () => {
    expect(planPromotions([{ studentId: 'S1', grade: '초6' }], 2027))
      .toEqual([{ studentId: 'S1', grade: '초6', gradeYear: 2027 }]);
  });

  it('두 해를 건너뛴 학생은 두 칸 올린다', () => {
    expect(planPromotions([{ studentId: 'S1', grade: '초4', gradeYear: '2025' }], 2027)[0].grade)
      .toBe('초6');
  });

  it('올릴 것이 없으면 빈 배열이다 — 시트를 쓰지 않는다', () => {
    expect(planPromotions([{ studentId: 'S1', grade: '초6', gradeYear: '2027' }], 2027))
      .toEqual([]);
    expect(planPromotions([], 2027)).toEqual([]);
  });

  it('studentId가 없는 행은 건너뛴다', () => {
    expect(planPromotions([{ grade: '초6', gradeYear: '2026' }], 2027)).toEqual([]);
  });

  it('해를 읽을 수 없으면 아무것도 하지 않는다', () => {
    expect(planPromotions([{ studentId: 'S1', grade: '초6' }], NaN)).toEqual([]);
  });
});
