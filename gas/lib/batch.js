/**
 * 일괄 저장 계획. SpreadsheetApp을 쓰지 않는 순수 함수.
 *
 * Records 시트를 요청당 한 번만 읽고, 어떤 행을 어떻게 쓸지 여기서
 * 전부 결정한다. 호출자는 결정된 대로 setValues 한 번씩만 하면 된다.
 * (이전에는 레코드마다 시트 전체를 다시 읽고 셀 단위로 setValue 했다.)
 */

function planRecordBatch(input) {
  const opts = input || {};
  const existing = (opts.existingRows || []).slice();
  const records = opts.records || [];
  const updates = [];
  const appends = [];
  let saved = 0;

  records.forEach(function (rec) {
    const match = findRecordMatch(existing, rec.studentId, rec.date);
    const payload = buildRecordPayload(rec, opts.classId, opts.clientRequestId, opts.now);

    if (match) {
      // 기존 행 위에 덮어쓴다. recordId·createdAt은 payload에 없으므로 보존된다.
      Object.keys(payload).forEach(function (k) { match[k] = payload[k]; });

      if (match._rowIndex) {
        updates.push({ rowIndex: match._rowIndex, row: match });
      }
      // _rowIndex가 없으면 같은 배치에서 방금 append하기로 한 행이다.
      // 이미 같은 객체를 갱신했으므로 append 목록에 그대로 반영된다.
    } else {
      payload.recordId = opts.newIdFn();
      payload.createdAt = opts.now;
      appends.push(payload);
      existing.push(payload);
    }
    saved++;
  });

  return { updates: updates, appends: appends, saved: saved };
}

/** 헤더 순서대로 한 행의 셀 값 배열을 만든다. 헤더에 없는 내부 필드(_rowIndex)는 빠진다. */
function rowValuesFor(header, row) {
  const src = row || {};
  return (header || []).map(function (key) {
    if (!key) return '';
    const v = src[key];
    return v === null || v === undefined ? '' : v;
  });
}

if (typeof module !== 'undefined') {
  /* eslint-disable no-var */
  var findRecordMatch = require('./records.js').findRecordMatch;
  var buildRecordPayload = require('./records.js').buildRecordPayload;
  module.exports = { planRecordBatch, rowValuesFor };
}

// 주의: 위 var를 const/let으로 바꾸지 말 것 (shape.js의 같은 주석 참고).
// GAS는 전역 스코프를 공유하므로 records.js의 함수를 그대로 호출한다.
