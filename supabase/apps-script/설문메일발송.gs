/**
 * 브랜치Q 설문 메일 발송 (Google Apps Script)
 * ────────────────────────────────────────────────────────────
 * 설치 위치: "구글폼 응답이 저장되는 스프레드시트"에서
 *   확장 프로그램 → Apps Script → 이 코드 전체 붙여넣기 → 저장
 *
 * 이 스프레드시트에 탭 2개가 있어야 합니다 (웹 '설문 발송 관리'에서 자동 기록):
 *   • 발송대상 : A=업체명 | B=사업자번호 | C=이메일  (1행 헤더)
 *   • 메일양식 : A=key | B=value
 *        auto_subject / auto_body / remind_subject / remind_body / form_link / apps_script_url
 *
 * 사용:
 *   1) [자동발송] 트리거 → 시계 아이콘 → sendWeekly, 주 단위, 목요일, 오전 9~10시
 *   2) [수동발송] 배포 → 새 배포 → 웹앱 (실행:나 / 액세스: 모든 사용자)
 *      → 나오는 /exec URL 을 웹 '설문 발송 관리 → Apps Script 웹앱 URL' 칸에 입력
 */

var RESPONSE_HINT = /응답|response|form/i;   // 응답 탭 이름 힌트
var CONFIG_SHEET = '메일양식';
var TARGET_SHEET = '발송대상';

// ── 유틸 ──
function _ss() { return SpreadsheetApp.getActive(); }

function _config() {
  var sh = _ss().getSheetByName(CONFIG_SHEET);
  var cfg = {};
  if (!sh) return cfg;
  var v = sh.getRange('A1:B50').getValues();
  for (var i = 0; i < v.length; i++) { if (v[i][0]) cfg[String(v[i][0]).trim()] = v[i][1] == null ? '' : String(v[i][1]); }
  return cfg;
}

function _targets() {
  var sh = _ss().getSheetByName(TARGET_SHEET);
  if (!sh) return [];
  var v = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < v.length; i++) { // 1행 헤더 skip
    var email = String(v[i][2] || '').trim();
    if (!email) continue;
    out.push({ name: String(v[i][0] || '').trim(), biz: String(v[i][1] || '').replace(/[^0-9]/g, ''), email: email });
  }
  return out;
}

function _mondayStart(d) {
  var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var day = (x.getDay() + 6) % 7; // 월=0
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0);
  return x;
}

// 이번 주 응답한 사업자번호 집합
function _respondedThisWeek() {
  var sheets = _ss().getSheets();
  var resp = null;
  for (var i = 0; i < sheets.length; i++) {
    var nm = sheets[i].getName();
    if (nm === CONFIG_SHEET || nm === TARGET_SHEET) continue;
    if (RESPONSE_HINT.test(nm)) { resp = sheets[i]; break; }
  }
  if (!resp) { // 힌트 없으면 설정탭 아닌 첫 시트
    for (var j = 0; j < sheets.length; j++) { var n = sheets[j].getName(); if (n !== CONFIG_SHEET && n !== TARGET_SHEET) { resp = sheets[j]; break; } }
  }
  var set = {};
  if (!resp) return set;
  var data = resp.getDataRange().getValues();
  if (data.length < 2) return set;
  var header = data[0];
  var bizCol = -1, tsCol = 0;
  for (var c = 0; c < header.length; c++) {
    var h = String(header[c]);
    if (bizCol < 0 && /사업자/.test(h)) bizCol = c;
    if (/타임스탬프|timestamp/i.test(h)) tsCol = c;
  }
  var weekStart = _mondayStart(new Date());
  for (var r = 1; r < data.length; r++) {
    var ts = data[r][tsCol];
    var d = (ts instanceof Date) ? ts : new Date(ts);
    if (isNaN(d.getTime()) || d < weekStart) continue;
    var biz = bizCol >= 0 ? String(data[r][bizCol]).replace(/[^0-9]/g, '') : '';
    if (biz) set[biz] = true;
  }
  return set;
}

function _fill(tpl, name, formLink) {
  return String(tpl || '').replace(/\{업체명\}/g, name || '').replace(/\{폼링크\}/g, formLink || '');
}

function _send(email, subject, body) {
  GmailApp.sendEmail(email, subject, body);
}

// ── ① 매주 목요일 자동발송 (미참여자에게 auto 양식) ──
function sendWeekly() {
  var cfg = _config();
  var responded = _respondedThisWeek();
  var targets = _targets();
  var sent = 0;
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    if (t.biz && responded[t.biz]) continue; // 이미 참여 → skip
    try {
      _send(t.email, _fill(cfg.auto_subject, t.name, cfg.form_link), _fill(cfg.auto_body, t.name, cfg.form_link));
      sent++;
      Utilities.sleep(200);
    } catch (e) { /* 개별 실패 무시 */ }
  }
  return sent;
}

// ── ② 수동발송 (웹앱) : 웹에서 선택한 대상에게 remind 양식 ──
function doPost(e) {
  var out = { sent: 0, failed: 0 };
  try {
    var p = JSON.parse(e.postData.contents || '{}');
    var cfg = _config();
    var key = p.templateKey === 'auto' ? 'auto' : 'remind';
    var subjectTpl = cfg[key + '_subject'];
    var bodyTpl = cfg[key + '_body'];
    var list = p.recipients || [];

    // 테스트 모드: 내 메일로 미리보기 1통만
    if (p.testEmail) {
      var sample = list[0] || { name: '(테스트업체)' };
      _send(p.testEmail, '[테스트] ' + _fill(subjectTpl, sample.name, cfg.form_link), '※ 테스트 발송 미리보기 (실제 발송 아님)\n\n' + _fill(bodyTpl, sample.name, cfg.form_link));
      out.sent = 1;
      return _json(out);
    }
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (!r.email) { out.failed++; continue; }
      try { _send(r.email, _fill(subjectTpl, r.name, cfg.form_link), _fill(bodyTpl, r.name, cfg.form_link)); out.sent++; Utilities.sleep(200); }
      catch (err) { out.failed++; }
    }
  } catch (err) {
    out.error = String(err);
  }
  return _json(out);
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 설치 확인용 (한 번 실행해 권한 승인)
function testConfig() { Logger.log(JSON.stringify(_config())); Logger.log('대상 ' + _targets().length + '개사'); }
