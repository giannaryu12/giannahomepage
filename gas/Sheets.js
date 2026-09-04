/**
 * 시트 접근 계층. 얇게 유지하고 수동 검증한다.
 * 로직이 붙기 시작하면 gas/lib/으로 빼서 단위 테스트한다.
 */

const SHEETS = {
  STUDENTS: 'Students',
  CLASSES: 'Classes',
  RECORDS: 'Records',
};

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('SHEET_ID 스크립트 속성이 설정되지 않았습니다.');
  return SpreadsheetApp.openById(id);
}

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('시트를 찾을 수 없습니다: ' + name);
  return sheet;
}

/** Sheets가 날짜로 파싱한 셀을 문자열로 되돌린다. 시각 성분이 있으면 보존한다. */
function normalizeCell_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    const hasTime = v.getHours() || v.getMinutes() || v.getSeconds();
    return hasTime
      ? Utilities.formatDate(v, 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ss")
      : Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
  }
  return v;
}

/**
 * 시트를 한 번만 읽어 sheet·header·rows를 함께 돌려준다.
 * 같은 요청에서 헤더와 본문이 모두 필요할 때 getDataRange를 두 번 치지 않기 위함.
 */
function readTableView_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  const header = values.length
    ? values[0].map(function (h) { return String(h).trim(); })
    : [];
  return { sheet: sheet, header: header, rows: rowsFromValues_(values, header) };
}

function rowsFromValues_(values, header) {
  if (values.length < 2) return [];
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(function (c) { return c === '' || c === null; })) continue;

    const obj = { _rowIndex: i + 1 };
    header.forEach(function (key, j) {
      if (key) obj[key] = normalizeCell_(row[j]);
    });
    rows.push(obj);
  }
  return rows;
}

/** 1행을 헤더로 삼아 객체 배열로 읽는다. */
function readTable(sheetName) {
  return readTableView_(sheetName).rows;
}

/**
 * 쓸 범위의 서식을 먼저 정한다. 값을 넣은 뒤에 고쳐서는 늦다 — 변환은
 * setValues 시점에 이미 끝나 있다.
 *
 * 숫자로 둘 칸(점수·회차)만 General로 두고 나머지는 '@'(텍스트)로 고정한다.
 * 그래야 진도에 적은 '9-12'가 9월 12일로 바뀌지 않는다.
 */
function applyColumnFormats_(range, header) {
  const formats = header.map(function (key) {
    return isNumericColumn_(key) ? 'General' : '@';
  });

  const rows = [];
  for (let i = 0; i < range.getNumRows(); i++) rows.push(formats);
  range.setNumberFormats(rows);
}

/** 한 행 전체를 setValues 한 번으로 쓴다. 셀 단위 setValue를 반복하지 않기 위함. */
function writeRowValues_(sheet, header, rowIndex, row) {
  const values = rowValuesFor(header, row);
  const range = sheet.getRange(rowIndex, 1, 1, values.length);
  applyColumnFormats_(range, header);
  range.setValues([values]);
}

/** 여러 행을 시트 끝에 setValues 한 번으로 덧붙인다. */
function appendRowsValues_(sheet, header, rows) {
  if (!rows.length) return;
  const values = rows.map(function (r) { return rowValuesFor(header, r); });
  const range = sheet.getRange(sheet.getLastRow() + 1, 1, values.length, header.length);
  applyColumnFormats_(range, header);
  range.setValues(values);
}

/**
 * 헤더에 없는 컬럼을 시트 오른쪽 끝에 덧붙이고 갱신된 헤더를 돌려준다.
 *
 * rowValuesFor는 헤더에 없는 필드를 조용히 버린다. 즉 컬럼을 만들지 않으면
 * 선생님이 입력한 값이 사라진 채로 "저장했습니다"가 뜬다. 새 필드가 생겼을 때
 * 시트를 손으로 고치게 하는 대신 저장 직전에 맞춘다.
 */
function ensureColumns_(sheet, header, required) {
  const missing = required.filter(function (k) { return header.indexOf(k) === -1; });
  if (!missing.length) return header;

  sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]);
  return header.concat(missing);
}

function getHeader_(sheetName) {
  const sheet = getSheet_(sheetName);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function (h) { return String(h).trim(); });
}

function appendRow(sheetName, obj) {
  const sheet = getSheet_(sheetName);
  const header = getHeader_(sheetName);
  const row = header.map(function (key) {
    return obj[key] === null || obj[key] === undefined ? '' : obj[key];
  });

  // sheet.appendRow는 서식을 정할 틈이 없어 쓰지 않는다. 학부모 토큰이
  // 숫자로만 이뤄지면 앞자리 0을 잃는다.
  const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, header.length);
  applyColumnFormats_(range, header);
  range.setValues([row]);
}

function findRow(sheetName, column, value) {
  const rows = readTable(sheetName);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][column]) === String(value)) return rows[i];
  }
  return null;
}

/** 지정 컬럼의 값이 일치하는 첫 행을 부분 갱신한다. 갱신했으면 true. */
function updateRowById(sheetName, idColumn, idValue, patch) {
  if (idValue === '' || idValue === null || idValue === undefined) return false;

  // 시트는 한 번만 읽는다 (예전에는 getSheet_ + getHeader_ + findRow로 세 번 읽었다).
  const view = readTableView_(sheetName);
  const target = view.rows.filter(function (r) {
    return String(r[idColumn]) === String(idValue);
  })[0];
  if (!target) return false;

  view.header.forEach(function (key, j) {
    if (key && Object.prototype.hasOwnProperty.call(patch, key)) {
      const cell = view.sheet.getRange(target._rowIndex, j + 1);
      cell.setNumberFormat(isNumericColumn_(key) ? 'General' : '@');
      cell.setValue(patch[key]);
    }
  });
  return true;
}
