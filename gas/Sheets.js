/**
 * 시트 접근 계층. 얇게 유지하고 수동 검증한다.
 * 로직이 붙기 시작하면 gas/lib/으로 빼서 단위 테스트한다.
 */

const SHEETS = {
  STUDENTS: 'Students',
  CLASSES: 'Classes',
  RECORDS: 'Records',
  CONFIG: 'Config',
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

/** 1행을 헤더로 삼아 객체 배열로 읽는다. */
function readTable(sheetName) {
  const values = getSheet_(sheetName).getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0].map(function (h) { return String(h).trim(); });
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(function (c) { return c === '' || c === null; })) continue;

    const obj = { _rowIndex: i + 1 };
    header.forEach(function (key, j) {
      if (key) obj[key] = row[j] === null || row[j] === undefined ? '' : row[j];
    });
    rows.push(obj);
  }
  return rows;
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
  const sheet = getSheet_(sheetName);
  const header = getHeader_(sheetName);
  const target = findRow(sheetName, idColumn, idValue);
  if (!target) return false;

  header.forEach(function (key, j) {
    if (key && Object.prototype.hasOwnProperty.call(patch, key)) {
      sheet.getRange(target._rowIndex, j + 1).setValue(patch[key]);
    }
  });
  return true;
}

function getConfig(key, fallback) {
  const row = findRow(SHEETS.CONFIG, 'key', key);
  return row && row.value !== '' ? row.value : fallback;
}
