import { describe, it, expect } from 'vitest';
import { generateToken } from '../gas/lib/ids.js';

describe('테스트 하네스', () => {
  it('GAS용 CommonJS 모듈을 vitest에서 import할 수 있다', () => {
    expect(typeof generateToken).toBe('function');
  });
});
