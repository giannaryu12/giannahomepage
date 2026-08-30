/**
 * GAS 웹앱 호출 래퍼.
 *
 * - 모든 요청은 POST + text/plain (preflight 회피)
 * - 읽기만 1회 재시도. 쓰기는 재시도하지 않는다.
 * - 어떤 실패든 {code, message}를 가진 Error로 정규화한다.
 */
(function (global) {
  const TIMEOUT_MS = 15000;
  const WRITE_ACTIONS = ['admin.saveBatch', 'admin.upsertStudent', 'admin.reissueToken'];

  function apiError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
  }

  function createApi(gasUrl, fetchImpl, options) {
    const opts = options || {};
    const doFetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    const maxRetries = opts.retries === undefined ? 1 : opts.retries;
    const timeoutMs = opts.timeoutMs || TIMEOUT_MS;

    function once(action, params) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;

      return doFetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action: action }, params || {})),
        redirect: 'follow',
        signal: controller ? controller.signal : undefined,
      }).then(function (res) {
        if (timer) clearTimeout(timer);
        return res.text();
      }).then(function (text) {
        let payload;
        try {
          payload = JSON.parse(text);
        } catch (e) {
          throw apiError('BAD_RESPONSE', '서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
        if (!payload || payload.ok !== true) {
          throw apiError(
            (payload && payload.error) || 'SERVER_ERROR',
            (payload && payload.message) || '처리 중 문제가 발생했습니다.'
          );
        }
        return payload.data;
      }).catch(function (err) {
        if (timer) clearTimeout(timer);
        if (err && err.code) throw err;
        throw apiError('NETWORK', '네트워크 연결을 확인해 주세요.');
      });
    }

    function call(action, params) {
      if (!gasUrl) {
        return Promise.reject(apiError('NOT_CONFIGURED', '서버 주소가 설정되지 않았습니다.'));
      }
      const isWrite = WRITE_ACTIONS.indexOf(action) !== -1;
      const retries = isWrite ? 0 : maxRetries;

      return once(action, params).catch(function (err) {
        if (retries > 0 && err.code === 'NETWORK') return once(action, params);
        throw err;
      });
    }

    return { call: call };
  }

  global.createApi = createApi;

  if (typeof module !== 'undefined') {
    module.exports = { createApi };
  }
})(typeof window !== 'undefined' ? window : globalThis);
