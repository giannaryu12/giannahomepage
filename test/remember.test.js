import { describe, it, expect } from 'vitest';
import {
  REMEMBER_PREFIX,
  serializeRemember_,
  parseRemember_,
  rememberIsValid_,
  expiredRememberKeys_,
} from '../gas/lib/remember.js';

const NOW = '2026-11-02T00:00:00.000Z';
const LATER = '2026-12-02T00:00:00.000Z';
const EARLIER = '2026-10-02T00:00:00.000Z';
const FP = 'a1b2c3d4';

describe('serializeRemember_ / parseRemember_', () => {
  it('적은 그대로 되읽는다', () => {
    expect(parseRemember_(serializeRemember_(LATER, FP)))
      .toEqual({ expiresAt: LATER, fingerprint: FP });
  });

  it('모양이 아니면 null이다', () => {
    expect(parseRemember_('')).toBeNull();
    expect(parseRemember_('구분자없음')).toBeNull();
    expect(parseRemember_('|지문만')).toBeNull();
    expect(parseRemember_('만료만|')).toBeNull();
    expect(parseRemember_(null)).toBeNull();
    expect(parseRemember_(123)).toBeNull();
  });
});

describe('rememberIsValid_', () => {
  it('만료 전이고 지문이 같으면 쓴다', () => {
    expect(rememberIsValid_(parseRemember_(serializeRemember_(LATER, FP)), NOW, FP)).toBe(true);
  });

  it('만료됐으면 못 쓴다', () => {
    expect(rememberIsValid_(parseRemember_(serializeRemember_(EARLIER, FP)), NOW, FP)).toBe(false);
  });

  it('비밀번호가 바뀌면 만료 전이라도 못 쓴다', () => {
    // 기기를 잃어버렸을 때 선생님이 끊을 수 있는 유일한 수단이다.
    expect(rememberIsValid_(parseRemember_(serializeRemember_(LATER, FP)), NOW, '다른지문')).toBe(false);
  });

  it('깨진 값은 못 쓴다', () => {
    expect(rememberIsValid_(null, NOW, FP)).toBe(false);
  });
});

describe('expiredRememberKeys_', () => {
  it('만료된 것과 깨진 것만 고른다', () => {
    const all = {
      [REMEMBER_PREFIX + 'alive']: serializeRemember_(LATER, FP),
      [REMEMBER_PREFIX + 'dead']: serializeRemember_(EARLIER, FP),
      [REMEMBER_PREFIX + 'broken']: '쓰레기',
      ADMIN_PASSWORD: '건드리면 안 되는 값',
      SHEET_ID: '건드리면 안 되는 값',
    };
    expect(expiredRememberKeys_(all, NOW).sort())
      .toEqual([REMEMBER_PREFIX + 'broken', REMEMBER_PREFIX + 'dead']);
  });

  it('다른 설정값은 절대 고르지 않는다', () => {
    // 여기서 새면 로그인하다가 비밀번호나 시트 주소를 지운다.
    const all = { ADMIN_PASSWORD: 'x', SHEET_ID: 'y' };
    expect(expiredRememberKeys_(all, NOW)).toEqual([]);
  });

  it('빈 값에 흔들리지 않는다', () => {
    expect(expiredRememberKeys_(null, NOW)).toEqual([]);
    expect(expiredRememberKeys_({}, NOW)).toEqual([]);
  });
});
