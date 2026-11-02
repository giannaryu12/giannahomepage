import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseRequest, ok, fail, ACTIONS } from '../gas/lib/router.js';

describe('parseRequest', () => {
  it('정상 요청을 파싱한다', () => {
    const r = parseRequest(JSON.stringify({ action: 'parent.load', token: 'abc' }));
    expect(r.ok).toBe(true);
    expect(r.action).toBe('parent.load');
    expect(r.auth).toBe('token');
    expect(r.body.token).toBe('abc');
  });

  it('JSON이 아니면 BAD_JSON이다', () => {
    const r = parseRequest('not json');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('BAD_JSON');
  });

  it('빈 본문이면 BAD_JSON이다', () => {
    expect(parseRequest('').error).toBe('BAD_JSON');
    expect(parseRequest(null).error).toBe('BAD_JSON');
  });

  it('모르는 action이면 UNKNOWN_ACTION이다', () => {
    const r = parseRequest(JSON.stringify({ action: 'admin.dropTable' }));
    expect(r.error).toBe('UNKNOWN_ACTION');
  });

  it('action이 없으면 UNKNOWN_ACTION이다', () => {
    expect(parseRequest(JSON.stringify({ token: 'x' })).error).toBe('UNKNOWN_ACTION');
  });

  it('필수 파라미터가 빠지면 MISSING_PARAM이다', () => {
    const r = parseRequest(JSON.stringify({ action: 'parent.load' }));
    expect(r.error).toBe('MISSING_PARAM');
    expect(r.message).toContain('token');
  });

  it('세션이 필요한 action은 sessionKey를 요구한다', () => {
    const r = parseRequest(JSON.stringify({ action: 'admin.classes' }));
    expect(r.error).toBe('MISSING_PARAM');
    expect(r.message).toContain('sessionKey');
  });

  it('sessionKey가 있으면 통과한다', () => {
    const r = parseRequest(JSON.stringify({ action: 'admin.classes', sessionKey: 'k' }));
    expect(r.ok).toBe(true);
  });

  it('admin.login은 세션이 필요 없다', () => {
    const r = parseRequest(JSON.stringify({ action: 'admin.login', password: 'p' }));
    expect(r.ok).toBe(true);
    expect(r.auth).toBe('none');
  });

  it('ping은 인증이 필요 없다', () => {
    const r = parseRequest(JSON.stringify({ action: 'ping' }));
    expect(r.ok).toBe(true);
    expect(r.auth).toBe('none');
  });

  it('MVP에 없는 parent.more는 거부한다', () => {
    const r = parseRequest(JSON.stringify({ action: 'parent.more', token: 'a', cursor: '1' }));
    expect(r.error).toBe('UNKNOWN_ACTION');
  });

  it('모든 action이 auth와 required를 갖는다', () => {
    Object.keys(ACTIONS).forEach((k) => {
      expect(['none', 'token', 'session']).toContain(ACTIONS[k].auth);
      expect(Array.isArray(ACTIONS[k].required)).toBe(true);
    });
  });
});

describe('ok / fail', () => {
  it('ok는 성공 봉투를 만든다', () => {
    expect(ok({ a: 1 })).toEqual({ ok: true, data: { a: 1 } });
  });

  it('fail은 실패 봉투를 만든다', () => {
    expect(fail('X', '문제')).toEqual({ ok: false, error: 'X', message: '문제' });
  });
});

describe('ACTIONS와 dispatch_의 액션 목록', () => {
  it('둘이 정확히 같다', () => {
    // 액션을 더할 때 Code.js의 switch만 고치면 ACTIONS가 먼저 걸러내
    // UNKNOWN_ACTION이 난다. 핸들러는 멀쩡한데 요청이 닿지 않으므로
    // 어디가 잘못됐는지 보이지 않는다. 실제로 한 번 그렇게 배포했다.
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'gas', 'Code.js'), 'utf8');
    const cases = [];
    const re = /case\s+'([^']+)':/g;
    let m;
    while ((m = re.exec(src))) cases.push(m[1]);

    expect(cases.sort()).toEqual(Object.keys(ACTIONS).sort());
  });
});
