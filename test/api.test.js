import { describe, it, expect, vi } from 'vitest';
import { createApi } from '../public/assets/js/api.js';

function jsonResponse(payload) {
  return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(payload)) });
}

describe('createApi', () => {
  it('POST로 text/plain 본문을 보낸다', async () => {
    const fetchMock = vi.fn(() => jsonResponse({ ok: true, data: { x: 1 } }));
    const api = createApi('https://gas.example/exec', fetchMock);

    await api.call('ping', { echo: 'hi' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://gas.example/exec');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(JSON.parse(init.body)).toEqual({ action: 'ping', echo: 'hi' });
  });

  it('성공 시 data를 돌려준다', async () => {
    const api = createApi('u', () => jsonResponse({ ok: true, data: { saved: 3 } }));
    expect(await api.call('admin.saveBatch', {})).toEqual({ saved: 3 });
  });

  it('ok:false면 error와 message를 담아 reject한다', async () => {
    const api = createApi('u', () => jsonResponse({ ok: false, error: 'NOT_FOUND', message: '없습니다' }));
    await expect(api.call('parent.load', {})).rejects.toMatchObject({
      code: 'NOT_FOUND', message: '없습니다',
    });
  });

  it('JSON이 아닌 응답은 BAD_RESPONSE로 정규화한다', async () => {
    const api = createApi('u', () => Promise.resolve({ ok: true, text: () => Promise.resolve('<html>') }));
    await expect(api.call('ping', {})).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('네트워크 오류는 NETWORK로 정규화한다', async () => {
    const api = createApi('u', () => Promise.reject(new Error('boom')), { retries: 0 });
    await expect(api.call('parent.load', {})).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('읽기 요청은 실패 시 한 번 재시도한다', async () => {
    let calls = 0;
    const fetchMock = vi.fn(() => {
      calls++;
      return calls === 1 ? Promise.reject(new Error('boom')) : jsonResponse({ ok: true, data: { x: 1 } });
    });
    const api = createApi('u', fetchMock, { retries: 1 });

    expect(await api.call('parent.load', {})).toEqual({ x: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('쓰기 요청은 재시도하지 않는다', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('boom')));
    const api = createApi('u', fetchMock, { retries: 1 });

    await expect(api.call('admin.saveBatch', {})).rejects.toMatchObject({ code: 'NETWORK' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('GAS URL이 비어 있으면 NOT_CONFIGURED로 실패한다', async () => {
    const api = createApi('', () => jsonResponse({ ok: true, data: {} }));
    await expect(api.call('ping', {})).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});
