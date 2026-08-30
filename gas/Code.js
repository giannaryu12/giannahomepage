/**
 * Web App 진입점. 모든 요청은 POST + text/plain.
 *
 * 응답은 어떤 경우에도 JSON이어야 한다. 예외가 새어나가면 GAS가
 * HTML 오류 페이지를 반환하고, 프런트의 JSON 파싱이 깨진다.
 */

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const raw = e && e.postData ? e.postData.contents : '';
    const parsed = parseRequest(raw);
    if (!parsed.ok) return jsonOutput_(parsed);

    return jsonOutput_(dispatch_(parsed));
  } catch (err) {
    if (err && err.name === 'AuthError') {
      return jsonOutput_(fail('UNAUTHORIZED', err.message));
    }
    console.error(err && err.stack ? err.stack : err);
    return jsonOutput_(fail('SERVER_ERROR', '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'));
  }
}

function doGet() {
  return jsonOutput_(fail('METHOD_NOT_ALLOWED', 'POST로 요청해 주세요.'));
}

function dispatch_(parsed) {
  const body = parsed.body;

  switch (parsed.action) {
    case 'ping':                return handlePing(body);
    case 'admin.login':         return handleAdminLogin(body);
    case 'admin.classes':       return handleAdminClasses(body);
    case 'admin.students':      return handleAdminStudents(body);
    case 'admin.upsertStudent': return handleAdminUpsertStudent(body);
    case 'admin.reissueToken':  return handleAdminReissueToken(body);
    case 'admin.roster':        return handleAdminRoster(body);
    case 'admin.saveBatch':     return handleAdminSaveBatch(body);
    case 'parent.load':         return handleParentLoad(body);
    default:                    return fail('UNKNOWN_ACTION', '알 수 없는 요청입니다.');
  }
}

/**
 * 라이브 스모크 테스트. 스프레드시트에 실제로 붙는지까지 확인한다.
 * 예전에는 Config 시트의 행 수를 셌지만 Config는 어디서도 쓰지 않으므로
 * 시트 개수로 바꿨다. 응답 필드 이름은 그대로 둔다.
 */
function handlePing(body) {
  return ok({
    pong: true,
    echo: body.echo || '',
    sheets: getSpreadsheet_().getSheets().length,
  });
}
