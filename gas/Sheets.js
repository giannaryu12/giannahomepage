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

/** 한 행 전체를 setValues 한 번으로 쓴다. 셀 단위 setValue를 반복하지 않기 위함. */
function writeRowValues_(sheet, header, rowIndex, row) {
  const values = rowValuesFor(header, row);
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
}

/** 여러 행을 시트 끝에 setValues 한 번으로 덧붙인다. */
function appendRowsValues_(sheet, header, rows) {
  if (!rows.length) return;
  const values = rows.map(function (r) { return rowValuesFor(header, r); });
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, header.length).setValues(values);
}

function getHeader_(sheetName) {
  const sheet = getSheet_(sheetName);
  return sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function (h) { return String(h).trim(); });
}

function appendRow(sheetName, obj) {
  const header = getHeader_(sheetName);
  const row = header.map(function (key) {
    return obj[key] === null || obj[key] === undefined ? '' : obj[key];
  });
  getSheet_(sheetName).appendRow(row);
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
      view.sheet.getRange(target._rowIndex, j + 1).setValue(patch[key]);
    }
  });
  return true;
}
