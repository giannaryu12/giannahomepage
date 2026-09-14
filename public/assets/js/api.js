/**
 * GAS 웹앱 호출 래퍼.
 *
 * - 모든 요청은 POST + text/plain (preflight 회피)
 * - 읽기만 1회 재시도. 쓰기는 재시도하지 않는다.
 * - 어떤 실패든 {code, message}를 가진 Error로 정규화한다.
 */
(function (global) {
  // GAS는 평소 1~2초지만 가끔 20초를 넘긴다. 짧게 끊으면 멀쩡한 저장이
  // 실패한 것처럼 보인다.
  const TIMEOUT_MS = 30000;
  const WRITE_ACTIONS = ['admin.saveBatch', 'admin.upsertStudent', 'admin.reissueToken'];

  // 잠깐 어긋났을 뿐이라 다시 걸면 되는 것들. 구글이 /exec에 404 HTML을
  // 내놓는 일이 드물지 않은데, 그것도 여기 BAD_RESPONSE로 들어온다.
  const RETRYABLE = ['NETWORK', 'TIMEOUT', 'BAD_RESPONSE'];

  function apiError(code, message) {
    const err = new Error(message);
    err.code = code;
    // 우리 오류라는 표. DOMException에도 code가 있어서(AbortError는 20)
    // code만 보고 가리면 남의 오류를 우리 것으로 착각한다.
    err.isApiError = true;
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
          throw apiError('BAD_RESPONSE', '서버가 일시적으로 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.');
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
        if (err && err.isApiError) throw err;

        // 시간 초과. 이 갈래가 없으면 DOMException이 그대로 새어 나가
        // 화면에 'signal is aborted without reason'이 찍힌다.
        if (err && err.name === 'AbortError') {
          throw apiError('TIMEOUT', '서버가 제때 응답하지 않았습니다. 잠시 후 다시 시도해 주세요.');
        }
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
        if (retries > 0 && RETRYABLE.indexOf(err.code) !== -1) return once(action, params);
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
