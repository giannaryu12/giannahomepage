/**
 * 학생 수정의 순수 로직. SpreadsheetApp을 쓰지 않는다.
 */

/**
 * 부분 갱신 patch를 만든다.
 *
 * 원칙: "요청에 없는 필드는 건드리지 않는다."
 * 이전 구현은 note를 항상 `input.note || ''`로 썼는데, 프런트는 note를
 * 보내지 않으므로 저장/비활성화를 누를 때마다 선생님이 시트에 직접 적은
 * 메모가 지워졌다. name·grade·classId는 프런트가 매번 보내므로 그대로
 * 반영되고, 빈 문자열을 보내면 "비운다"는 의도이므로 비운다.
 * 아예 보내지 않으면(undefined/null) 그대로 둔다.
 *
 * studentId(키)와 parentToken(전용 재발급 경로가 따로 있다)은 절대 넣지 않는다.
 */
const STUDENT_PATCH_FIELDS = ['name', 'grade', 'classId', 'note'];

function buildStudentPatch(input) {
  const src = input || {};
  const patch = {};

  STUDENT_PATCH_FIELDS.forEach(function (field) {
    const v = src[field];
    if (v !== undefined && v !== null) patch[field] = String(v);
  });

  if (typeof src.active === 'boolean') patch.active = src.active ? 'TRUE' : 'FALSE';

  return patch;
}

/** Classes 행 배열을 classId → className 맵으로 만든다. 학생 수만큼 시트를 읽지 않기 위함. */
function classNameMap(classRows) {
  const map = {};
  (classRows || []).forEach(function (c) {
    if (c && c.classId !== undefined && c.classId !== null && c.classId !== '') {
      map[String(c.classId)] = c.className;
    }
  });
  return map;
}

if (typeof module !== 'undefined') {
  module.exports = {
    STUDENT_PATCH_FIELDS,
    buildStudentPatch,
    classNameMap,
  };
}
